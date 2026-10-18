// WHAT: Wireframe meshes for the Learning Center's 3-D model viewer: primitives, transforms, projection.
// WHY:  Owner, 2026-10-18: "3D rotations of devices, telescopes, mechanisms, impactors, antennas". A mesh is a
//       list of line segments in metres, tagged with a semantic role, so it draws in the vector look and in
//       either colour setting. No textures, no fills: lines only, like everything else on screen.
// HOW:  Builders return Part[] in a right-handed frame (x right, y up, z toward the viewer), metres. `rotY`,
//       `rotX`, `move` and `scale` transform parts. `project` rotates by yaw/pitch, applies perspective
//       (focal / (focal + z)) and maps to a box. Everything is a pure function of its inputs.
//       Example: box(1, 2, 3) is 12 segments; dish(35, 10, 8, 12) is a 70 m paraboloid of 8 rings x 12 ribs.
// LORE: G8 (the look), F5 (surveys), F6 (radar), D3 (kinetic impactors)

import type { Role } from '../../render/palettes';

export type V3 = [number, number, number];

/** A group of segments drawn in one role: flat [x0,y0,z0, x1,y1,z1, ...], two points per segment. */
export interface Part {
  role: Role;
  seg: number[];
  /** Thinner, dimmer lines for detail (struts, ribs). */
  fine?: boolean;
}

function line(out: number[], a: V3, b: V3): void {
  out.push(a[0], a[1], a[2], b[0], b[1], b[2]);
}

/** Axis-aligned box centred on the origin, w x h x d metres. */
export function box(w: number, h: number, d: number, role: Role = 'craft'): Part {
  const x = w / 2;
  const y = h / 2;
  const z = d / 2;
  const c: V3[] = [[-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z], [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]];
  const e = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  const seg: number[] = [];
  for (const [i, j] of e) line(seg, c[i as number] as V3, c[j as number] as V3);
  return { role, seg };
}

/** Circle of radius r in the plane y = y0 (n segments). */
export function ring(r: number, y0: number, n = 24, role: Role = 'craft', fine = false): Part {
  const seg: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const b = ((i + 1) / n) * Math.PI * 2;
    line(seg, [r * Math.cos(a), y0, r * Math.sin(a)], [r * Math.cos(b), y0, r * Math.sin(b)]);
  }
  return { role, seg, fine };
}

/** Cylinder along y from y0 to y1 (or a cone frustum with r0 != r1), with `ribs` vertical lines. */
export function cylinder(r0: number, r1: number, y0: number, y1: number, ribs = 8, role: Role = 'craft'): Part[] {
  const out: Part[] = [ring(r0, y0, 24, role), ring(r1, y1, 24, role)];
  const seg: number[] = [];
  for (let i = 0; i < ribs; i++) {
    const a = (i / ribs) * Math.PI * 2;
    line(seg, [r0 * Math.cos(a), y0, r0 * Math.sin(a)], [r1 * Math.cos(a), y1, r1 * Math.sin(a)]);
  }
  out.push({ role, seg, fine: true });
  return out;
}

/**
 * Paraboloid dish opening toward +y: radius R, depth h (rim height above the vertex), `rings` x `ribs`.
 * y = h (r / R)^2. Example: Goldstone's 70 m DSS-14 is R 35, h about 9.
 */
export function dish(R: number, h: number, rings = 6, ribs = 12, role: Role = 'craft'): Part[] {
  const out: Part[] = [];
  for (let k = 1; k <= rings; k++) {
    const r = (R * k) / rings;
    out.push(ring(r, h * (r / R) ** 2, 32, role, k < rings));
  }
  const seg: number[] = [];
  for (let i = 0; i < ribs; i++) {
    const a = (i / ribs) * Math.PI * 2;
    let prev: V3 = [0, 0, 0];
    for (let k = 1; k <= 8; k++) {
      const r = (R * k) / 8;
      const p: V3 = [r * Math.cos(a), h * (r / R) ** 2, r * Math.sin(a)];
      line(seg, prev, p);
      prev = p;
    }
  }
  out.push({ role, seg, fine: true });
  return out;
}

/** Flat rectangular panel in the x-z plane (y = 0), w x d, with `cells` dividing lines along x. */
export function panel(w: number, d: number, cells = 4, role: Role = 'program'): Part[] {
  const x = w / 2;
  const z = d / 2;
  const edge: number[] = [];
  line(edge, [-x, 0, -z], [x, 0, -z]);
  line(edge, [x, 0, -z], [x, 0, z]);
  line(edge, [x, 0, z], [-x, 0, z]);
  line(edge, [-x, 0, z], [-x, 0, -z]);
  const grid: number[] = [];
  for (let i = 1; i < cells; i++) {
    const xx = -x + (w * i) / cells;
    line(grid, [xx, 0, -z], [xx, 0, z]);
  }
  return [{ role, seg: edge }, { role, seg: grid, fine: true }];
}

/** A straight strut between two points. */
export function strut(a: V3, b: V3, role: Role = 'craft', fine = true): Part {
  const seg: number[] = [];
  line(seg, a, b);
  return { role, seg, fine };
}

/** Lat-long wire sphere (asteroids get a `bump(lat, lon)` radius multiplier). */
export function sphere(R: number, lat = 6, lon = 10, role: Role = 'threat', bump: (u: number, v: number) => number = () => 1): Part[] {
  const seg: number[] = [];
  const pt = (u: number, v: number): V3 => {
    const r = R * bump(u, v);
    const th = u * Math.PI; // 0..pi from the north pole
    const ph = v * Math.PI * 2;
    return [r * Math.sin(th) * Math.cos(ph), r * Math.cos(th), r * Math.sin(th) * Math.sin(ph)];
  };
  for (let i = 1; i < lat; i++) for (let j = 0; j < lon * 2; j++) line(seg, pt(i / lat, j / (lon * 2)), pt(i / lat, (j + 1) / (lon * 2)));
  for (let j = 0; j < lon; j++) for (let i = 0; i < lat * 2; i++) line(seg, pt(i / (lat * 2), j / lon), pt((i + 1) / (lat * 2), j / lon));
  return [{ role, seg }];
}

function mapPart(p: Part, f: (v: V3) => V3): Part {
  const seg = p.seg.slice();
  for (let i = 0; i + 2 < seg.length; i += 3) {
    const [x, y, z] = f([seg[i] ?? 0, seg[i + 1] ?? 0, seg[i + 2] ?? 0]);
    seg[i] = x;
    seg[i + 1] = y;
    seg[i + 2] = z;
  }
  return { ...p, seg };
}

export const move = (ps: Part[], d: V3): Part[] => ps.map((p) => mapPart(p, ([x, y, z]) => [x + d[0], y + d[1], z + d[2]]));
export const scale = (ps: Part[], k: number): Part[] => ps.map((p) => mapPart(p, ([x, y, z]) => [x * k, y * k, z * k]));
export const rotX = (ps: Part[], a: number): Part[] => ps.map((p) => mapPart(p, ([x, y, z]) => [x, y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)]));
export const rotY = (ps: Part[], a: number): Part[] => ps.map((p) => mapPart(p, ([x, y, z]) => [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)]));
export const rotZ = (ps: Part[], a: number): Part[] => ps.map((p) => mapPart(p, ([x, y, z]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), z]));
export const recolor = (ps: Part[], role: Role): Part[] => ps.map((p) => ({ ...p, role }));

/** Largest |coordinate| over all parts: the viewer scales the model to fit its box from this. */
export function extent(ps: readonly Part[]): number {
  let m = 1e-9;
  for (const p of ps) for (const v of p.seg) m = Math.max(m, Math.abs(v));
  return m;
}

export interface View {
  /** Yaw about y and pitch about x, radians. */
  yaw: number;
  pitch: number;
  cx: number;
  cy: number;
  /** Pixels per metre after fitting. */
  k: number;
  /** Perspective focal length in model units (metres); larger is flatter. */
  focal: number;
}

/** Project every segment to screen [x0, y0, x1, y1] pairs; screen y grows down. */
export function project(p: Part, v: View): number[] {
  const cy = Math.cos(v.yaw);
  const sy = Math.sin(v.yaw);
  const cp = Math.cos(v.pitch);
  const sp = Math.sin(v.pitch);
  const out: number[] = [];
  for (let i = 0; i + 2 < p.seg.length; i += 3) {
    const x = p.seg[i] ?? 0;
    const y = p.seg[i + 1] ?? 0;
    const z = p.seg[i + 2] ?? 0;
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    const y2 = y * cp - z1 * sp;
    const z2 = y * sp + z1 * cp;
    const f = v.focal / (v.focal - z2);
    out.push(v.cx + x1 * v.k * f, v.cy - y2 * v.k * f);
  }
  return out;
}
