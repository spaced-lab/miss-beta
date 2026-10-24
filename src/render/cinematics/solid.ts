// WHAT: Solid bodies for the cinematics: seeded wireframe polyhedra that tumble, fracture into chunks that fly with
//       momentum and spin, and a camera that backs away as the cloud grows.
// WHY:  Owner 2026-10-24: "asteroid should react with physics and be convincing ... more 3D and detailed chunks
//       and rotations, no more static 2D ... back away and show blasts if they are large explosions". The old scene
//       drew one flat outline and flat shards; this gives every body and every piece a volume, a lit side and a
//       silhouette, and lets the pieces go where an impact would send them.
// HOW:  A body is an icosahedron (subdivided once for the main body: 42 vertices, 80 faces) with seeded radial
//       noise. State is a pure function of time: position = p0 + v (t - t0), orientation = a0 + w (t - t0), so
//       scrubbing and skipping cost nothing. Drawing projects orthographically after the three axis rotations,
//       strokes the front faces at an alpha set by a fixed light, and the silhouette (edges with one front face)
//       brighter. `fracture` hands out chunk sizes falling as (1/(i+1))^0.6 from the largest remnant, radial
//       velocities biased toward an ejecta direction, big pieces slower than small ones. `extent` is the cloud's
//       radius for the pull-back camera. Everything here is pure; tests/solid.test.ts.
// LORE: G8 (the look), D4 (fragmentation), D3 (kinetic and beta)

import type { Rng } from '../../sim/rng';
import type { Surface } from '../canvas';
import type { Role } from '../palettes';

export interface Poly3 {
  /** Unit-ish vertices, flat xyz triples. */
  v: Float64Array;
  /** Triangles, outward-facing (counter-clockwise seen from outside). */
  f: number[][];
}

export interface Chunk {
  poly: Poly3;
  /** Radius scale, scene px. */
  size: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Orientation at t0 (rad about x, y, z) and angular velocity (rad/s). */
  ax: number;
  ay: number;
  az: number;
  wx: number;
  wy: number;
  wz: number;
  t0: number;
  role: Role;
  /** Seconds the piece glows in false colour after t0 (fresh, hot). */
  hot: number;
  /** Downward acceleration, px/s^2 (a spent stage falling back; 0 in free space). */
  g?: number;
}

const PHI = (1 + Math.sqrt(5)) / 2;

/** The unit icosahedron: 12 vertices, 20 faces. */
export function icosahedron(): Poly3 {
  const a = 1 / Math.sqrt(1 + PHI * PHI);
  const b = PHI * a;
  const v = new Float64Array([-a, b, 0, a, b, 0, -a, -b, 0, a, -b, 0, 0, -a, b, 0, a, b, 0, -a, -b, 0, a, -b, b, 0, -a, b, 0, a, -b, 0, -a, -b, 0, a]);
  const f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  return { v, f };
}

/** One Loop-style subdivision: each triangle into four, new vertices pushed back onto the unit sphere. */
export function subdivide(p: Poly3): Poly3 {
  const verts: number[] = Array.from(p.v);
  const mid = new Map<string, number>();
  const midpoint = (i: number, j: number): number => {
    const key = i < j ? `${i}:${j}` : `${j}:${i}`;
    const m = mid.get(key);
    if (m !== undefined) return m;
    let x = ((verts[i * 3] ?? 0) + (verts[j * 3] ?? 0)) / 2;
    let y = ((verts[i * 3 + 1] ?? 0) + (verts[j * 3 + 1] ?? 0)) / 2;
    let z = ((verts[i * 3 + 2] ?? 0) + (verts[j * 3 + 2] ?? 0)) / 2;
    const r = Math.hypot(x, y, z) || 1;
    x /= r;
    y /= r;
    z /= r;
    const idx = verts.length / 3;
    verts.push(x, y, z);
    mid.set(key, idx);
    return idx;
  };
  const f: number[][] = [];
  for (const [a, b, c] of p.f as [number, number, number][]) {
    const ab = midpoint(a, b);
    const bc = midpoint(b, c);
    const ca = midpoint(c, a);
    f.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
  }
  return { v: new Float64Array(verts), f };
}

/**
 * Push each vertex in or out by seeded noise (radius 1 +- amp), then squash the whole body along a seeded axis by
 * `squash` (0.75: a potato, 1: a sphere). Example: amp 0 and squash 1 leave the sphere alone.
 */
export function roughen(p: Poly3, rng: Rng, amp: number, squash = 0.8): Poly3 {
  const v = new Float64Array(p.v.length);
  const sq = [rng.float(squash, 1), rng.float(squash, 1), 1];
  for (let i = 0; i < p.v.length; i += 3) {
    const r = 1 + rng.float(-amp, amp);
    v[i] = (p.v[i] ?? 0) * r * (sq[0] ?? 1);
    v[i + 1] = (p.v[i + 1] ?? 0) * r * (sq[1] ?? 1);
    v[i + 2] = (p.v[i + 2] ?? 0) * r * (sq[2] ?? 1);
  }
  return { v, f: p.f };
}

/**
 * Dent the surface: `n` seeded craters, each pulling the vertices within `rad` radians of its centre inward by up to
 * `depth` (a cosine bowl). Example: n 0 leaves the body unchanged.
 */
export function dent(p: Poly3, rng: Rng, n: number, rad: number, depth: number): Poly3 {
  const v = new Float64Array(p.v);
  for (let c = 0; c < n; c++) {
    const lon = rng.float(0, Math.PI * 2);
    const lat = rng.float(-1.2, 1.2);
    const cx = Math.cos(lat) * Math.cos(lon);
    const cy = Math.sin(lat);
    const cz = Math.cos(lat) * Math.sin(lon);
    const r = rad * rng.float(0.6, 1.3);
    for (let i = 0; i < v.length; i += 3) {
      const x = v[i] ?? 0;
      const y = v[i + 1] ?? 0;
      const z = v[i + 2] ?? 0;
      const len = Math.hypot(x, y, z) || 1;
      const ang = Math.acos(Math.max(-1, Math.min(1, (x * cx + y * cy + z * cz) / len)));
      if (ang >= r) continue;
      const f = 1 - depth * 0.5 * (1 + Math.cos((ang / r) * Math.PI));
      v[i] = x * f;
      v[i + 1] = y * f;
      v[i + 2] = z * f;
    }
  }
  return { v, f: p.f };
}

/** A main body: the icosahedron subdivided twice (162 vertices, 320 faces), 22 % radial noise, a seeded squash and
 *  four craters, so the silhouette is lumpy and the lit side shows a surface rather than a die. */
export function makeBody(rng: Rng): Poly3 {
  return dent(roughen(subdivide(subdivide(icosahedron())), rng, 0.22, 0.75), rng, 4, 0.45, 0.16);
}

/** A chunk: the plain icosahedron with 35 % radial noise, which reads as a jagged rock at any size. */
export function makeChunkPoly(rng: Rng): Poly3 {
  return roughen(icosahedron(), rng, 0.35, 0.65);
}

/**
 * The remnant after a hit from direction (dx, dy): every vertex within `depth` of the hit face is pushed back onto
 * that plane (a crater floor), the rest scaled by `frac`. Example: frac 1, depth 0 returns the body unchanged.
 */
export function cratered(p: Poly3, frac: number, dx: number, dy: number, depth: number): Poly3 {
  const v = new Float64Array(p.v.length);
  const n = Math.hypot(dx, dy) || 1;
  const ux = dx / n;
  const uy = dy / n;
  for (let i = 0; i < p.v.length; i += 3) {
    let x = (p.v[i] ?? 0) * frac;
    let y = (p.v[i + 1] ?? 0) * frac;
    const z = (p.v[i + 2] ?? 0) * frac;
    const d = x * ux + y * uy;
    if (d > frac - depth) {
      x -= (d - (frac - depth)) * ux;
      y -= (d - (frac - depth)) * uy;
    }
    v[i] = x;
    v[i + 1] = y;
    v[i + 2] = z;
  }
  return { v, f: p.f };
}

/** Rotate (x, y, z) about x, then y, then z. */
export function rotate3(x: number, y: number, z: number, ax: number, ay: number, az: number): [number, number, number] {
  let cx = Math.cos(ax);
  let sx = Math.sin(ax);
  let y1 = y * cx - z * sx;
  let z1 = y * sx + z * cx;
  cx = Math.cos(ay);
  sx = Math.sin(ay);
  const x2 = x * cx + z1 * sx;
  const z2 = -x * sx + z1 * cx;
  cx = Math.cos(az);
  sx = Math.sin(az);
  const x3 = x2 * cx - y1 * sx;
  const y3 = x2 * sx + y1 * cx;
  y1 = y3;
  z1 = z2;
  return [x3, y1, z1];
}

/** Position and orientation at scene time t. Example: a chunk with vx 10 is 10 px further along after one second. */
export function chunkAt(c: Chunk, t: number): { x: number; y: number; z: number; ax: number; ay: number; az: number } {
  const dt = Math.max(0, t - c.t0);
  return { x: c.x + c.vx * dt, y: c.y + c.vy * dt + 0.5 * (c.g ?? 0) * dt * dt, z: c.z + c.vz * dt, ax: c.ax + c.wx * dt, ay: c.ay + c.wy * dt, az: c.az + c.wz * dt };
}

/**
 * A surface of revolution about the y axis: `profile` is (radius, y) from the top down, `segs` around. Open ends
 * are capped by the profile itself (give it a zero radius at an end for a point). Faces wind outward.
 * Example: profile [[0, -1], [1, 0], [0, 1]] with 4 segments is a double cone of 8 faces.
 */
export function lathe(profile: readonly (readonly [number, number])[], segs: number): Poly3 {
  const verts: number[] = [];
  const f: number[][] = [];
  const n = profile.length;
  for (let i = 0; i < n; i++) {
    const [r, y] = profile[i] as [number, number];
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      verts.push(Math.cos(a) * r, y, Math.sin(a) * r);
    }
  }
  const at = (i: number, j: number): number => i * segs + (j % segs);
  for (let i = 0; i + 1 < n; i++) {
    for (let j = 0; j < segs; j++) {
      const a = at(i, j);
      const b = at(i, j + 1);
      const c = at(i + 1, j + 1);
      const d = at(i + 1, j);
      // Two triangles per quad, wound so the normal points away from the axis (y down the profile).
      f.push([a, d, b], [b, d, c]);
    }
  }
  return { v: new Float64Array(verts), f };
}

/** A flat, two-sided polygon (a fin): both windings, so one face always faces the viewer and every edge is silhouette. */
export function flat(pts: readonly (readonly [number, number, number])[]): Poly3 {
  const verts: number[] = [];
  for (const [x, y, z] of pts) verts.push(x, y, z);
  const idx = pts.map((_, i) => i);
  const rev = [...idx].reverse();
  return { v: new Float64Array(verts), f: [idx, rev] };
}

/** Merge meshes into one (indices offset). */
export function merge(parts: readonly Poly3[]): Poly3 {
  const verts: number[] = [];
  const f: number[][] = [];
  let off = 0;
  for (const p of parts) {
    for (const x of p.v) verts.push(x);
    for (const face of p.f) f.push(face.map((i) => i + off));
    off += p.v.length / 3;
  }
  return { v: new Float64Array(verts), f };
}

/** A still chunk at the origin: the main body before anything happens, with a slow tumble. */
export function restingChunk(poly: Poly3, size: number, rng: Rng, role: Role = 'threat'): Chunk {
  return { poly, size, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, ax: rng.float(0, 6.28), ay: rng.float(0, 6.28), az: rng.float(0, 6.28), wx: rng.float(-0.25, 0.25), wy: rng.float(-0.35, 0.35), wz: rng.float(-0.2, 0.2), t0: 0, role, hot: 0 };
}

/**
 * Pieces of a body of radius R breaking at t0: `count` chunks with sizes falling as (1/(i+1))^0.6 from
 * R * largestFrac (floor 2 px), spread inside 0.7 R, moving outward at lo..hi px/s scaled by (R/size)^0.3 so small
 * pieces fly faster, biased toward `dir` when given (an ejecta cone of half-width `spread`), tumbling at up to
 * `spin` rad/s. Example: count 1 gives one piece of size R * largestFrac.
 */
export function fracture(rng: Rng, R: number, count: number, largestFrac: number, lo: number, hi: number, spin: number, t0: number, role: Role, hot: number, dir?: number, spread = Math.PI): Chunk[] {
  const out: Chunk[] = [];
  for (let i = 0; i < count; i++) {
    const size = Math.max(2, R * largestFrac * Math.pow(1 / (i + 1), 0.6));
    const a = rng.float(0, Math.PI * 2);
    const rr = R * 0.7 * Math.sqrt(rng.next());
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr;
    const z = rng.float(-R * 0.5, R * 0.5);
    const d = dir === undefined ? Math.atan2(y, x) + rng.float(-0.5, 0.5) : dir + rng.float(-spread, spread);
    const el = rng.float(-0.6, 0.6);
    const v = rng.float(lo, hi) * Math.pow(R / size, 0.3);
    out.push({ poly: makeChunkPoly(rng), size, x, y, z, vx: Math.cos(d) * Math.cos(el) * v, vy: Math.sin(d) * Math.cos(el) * v, vz: Math.sin(el) * v, ax: rng.float(0, 6.28), ay: rng.float(0, 6.28), az: rng.float(0, 6.28), wx: rng.float(-spin, spin), wy: rng.float(-spin, spin), wz: rng.float(-spin, spin), t0, role, hot });
  }
  return out;
}

/** The cloud's radius at t: the farthest chunk's distance from the origin plus its size. Example: nothing -> 0. */
export function extent(chunks: readonly Chunk[], t: number): number {
  let m = 0;
  for (const c of chunks) {
    if (t < c.t0) continue;
    const q = chunkAt(c, t);
    m = Math.max(m, Math.hypot(q.x, q.y) + c.size);
  }
  return m;
}

/**
 * The pull-back camera: the scale that keeps a cloud of radius `ext` px inside `fit` px, never above 1, eased so
 * it never jumps. Example: ext 100, fit 300 -> 1; ext 600, fit 300 -> 0.5.
 */
export function pullBack(ext: number, fit: number): number {
  if (ext <= fit) return 1;
  return fit / ext;
}

/** Light from upper-left-front, unit. */
const LX = -0.46;
const LY = -0.55;
const LZ = 0.7;

export interface ProjectedFace {
  pts: number[];
  /** Diffuse term 0..1 against the fixed light. */
  lit: number;
}

/**
 * Front faces of a chunk at t, projected orthographically: each as a closed polyline in screen px around (ox, oy)
 * with scale k, plus the silhouette edges (edges with exactly one front face) as one flat list of segments.
 */
export function projectChunk(c: Chunk, t: number, ox: number, oy: number, k: number): { faces: ProjectedFace[]; silhouette: number[] } {
  const q = chunkAt(c, t);
  const n = c.poly.v.length / 3;
  const px = new Float64Array(n);
  const py = new Float64Array(n);
  const pz = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const [x, y, z] = rotate3((c.poly.v[i * 3] ?? 0) * c.size, (c.poly.v[i * 3 + 1] ?? 0) * c.size, (c.poly.v[i * 3 + 2] ?? 0) * c.size, q.ax, q.ay, q.az);
    px[i] = x + q.x;
    py[i] = y + q.y;
    pz[i] = z + q.z;
  }
  const faces: ProjectedFace[] = [];
  const edgeFront = new Map<number, number>();
  const frontFace: boolean[] = [];
  for (let fi = 0; fi < c.poly.f.length; fi++) {
    const face = c.poly.f[fi] as number[];
    const a = face[0] ?? 0;
    const b = face[1] ?? 0;
    const d = face[2] ?? 0;
    const ux = (px[b] ?? 0) - (px[a] ?? 0);
    const uy = (py[b] ?? 0) - (py[a] ?? 0);
    const uz = (pz[b] ?? 0) - (pz[a] ?? 0);
    const vx = (px[d] ?? 0) - (px[a] ?? 0);
    const vy = (py[d] ?? 0) - (py[a] ?? 0);
    const vz = (pz[d] ?? 0) - (pz[a] ?? 0);
    // Normal = u x v (screen y points down, so the winding seen on screen is mirrored: z of the cross flips).
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const front = nz < 0;
    frontFace[fi] = front;
    if (!front) continue;
    const nl = Math.hypot(nx, ny, nz) || 1;
    const lit = Math.max(0, (-nx * LX - ny * LY - nz * LZ) / nl);
    const pts: number[] = [];
    for (const vi of face) pts.push(ox + (px[vi] ?? 0) * k, oy + (py[vi] ?? 0) * k);
    faces.push({ pts, lit });
    for (let e = 0; e < face.length; e++) {
      const i = face[e] ?? 0;
      const j = face[(e + 1) % face.length] ?? 0;
      const key = i < j ? i * 4096 + j : j * 4096 + i;
      edgeFront.set(key, (edgeFront.get(key) ?? 0) + 1);
    }
  }
  const silhouette: number[] = [];
  for (const [key, cnt] of edgeFront) {
    if (cnt !== 1) continue;
    const i = Math.floor(key / 4096);
    const j = key % 4096;
    silhouette.push(ox + (px[i] ?? 0) * k, oy + (py[i] ?? 0) * k, ox + (px[j] ?? 0) * k, oy + (py[j] ?? 0) * k);
  }
  return { faces, silhouette };
}

/**
 * Draw a chunk: front faces as thin lines whose alpha follows the light, the silhouette bright with glow. A piece
 * under 3 px on screen is one dot. `hotColor` (false colour) replaces the role colour while the piece is hot.
 */
export function drawChunk(s: Surface, c: Chunk, t: number, ox: number, oy: number, k: number, color: string, hotColor: string | null, alpha = 1, faceAlpha = 1): void {
  const q = chunkAt(c, t);
  const r = c.size * k;
  if (r < 3) {
    s.dot(ox + q.x * k, oy + q.y * k, Math.max(1, r * 1.2), hotColor ?? color, alpha);
    return;
  }
  const { faces, silhouette } = projectChunk(c, t, ox, oy, k);
  const col = hotColor ?? color;
  const fine = r >= 9;
  if (fine) for (const f of faces) s.stroke(f.pts, { closed: true, color: col, glow: 0, width: 1, alpha: alpha * faceAlpha * (0.12 + 0.5 * f.lit) });
  if (silhouette.length >= 4) {
    for (let i = 0; i + 3 < silhouette.length; i += 4) s.stroke([silhouette[i] ?? 0, silhouette[i + 1] ?? 0, silhouette[i + 2] ?? 0, silhouette[i + 3] ?? 0], { color: col, glow: fine ? 1.1 : 0.5, width: fine ? 1.4 : 1, alpha });
  }
}
