// WHAT: Globes: a planet drawn as a sphere with surface features in the vector look. HOME carries the real
//       coastlines (config/coastline.json, Natural Earth, public domain); the other worlds get seeded bands, craters
//       or polar caps. One drawer serves the PLANET VIEW, the close-approach scene, the system map when zoomed in
//       close, and PERIMETER's planet.
// WHY:  Owner 2026-10-24: "earth should have proper continents on it and be realistic in views that are close enough
//       to see it ... all planets if there are views of them close by". A wireframe sphere with a flat seeded blob
//       read as a diagram; a turning globe with the real shorelines reads as the place being defended.
// HOW:  Orthographic projection: (lon, lat) on the unit sphere, turned by `rot` about the pole, the pole tipped
//       toward the viewer by `tilt`; z > 0 faces the viewer. A polyline is cut into front runs at the limb and drawn
//       bright, the back runs faint (the wire feel). The coastline file is a dynamic import so the boot chunk stays
//       small (docs/DECISIONS.md): until it lands the globe shows its graticule only. Feature generators are pure
//       and seeded (tests/globe.test.ts); drawing never mutates them.
// LORE: G8 (the look), O12 (close approach), T7 (the worlds)

import { Rng } from '../sim/rng';
import type { Surface } from './canvas';

export type GlobeKind = 'EARTH' | 'BANDED' | 'ROCKY' | 'ICY';

export interface GlobeStyle {
  color: string;
  /** Limb colour (defaults to `color`). */
  limb?: string;
  alpha?: number;
  glow?: number;
  width?: number;
  /** Faint latitude / longitude lines (default on). */
  graticule?: boolean;
  /** Back-hemisphere alpha as a fraction of the front (default 0.18; 0 hides it). */
  back?: number;
}

/** Scratch polyline for runs: s.stroke reads synchronously, so one buffer serves every run. */
const RUN: number[] = [];

/**
 * Orthographic projection of a point at (lon, lat) degrees on a sphere of radius R turned by `rot` radians, the
 * pole tipped toward the viewer by `tilt`. Returns [sx - cx, sy - cy, z] with screen y down and z > 0 facing the
 * viewer. Example: (0, 90) with tilt 0 -> [0, -R, 0] (the pole on the top limb); with tilt pi/2 -> [0, 0, R].
 */
export function orthographic(lonDeg: number, latDeg: number, R: number, rot: number, tilt: number): [number, number, number] {
  const lon = (lonDeg * Math.PI) / 180 + rot;
  const lat = (latDeg * Math.PI) / 180;
  const x = Math.cos(lat) * Math.sin(lon);
  const y = Math.sin(lat);
  const z = Math.cos(lat) * Math.cos(lon);
  const c = Math.cos(tilt);
  const si = Math.sin(tilt);
  const y2 = y * c - z * si;
  const z2 = y * si + z * c;
  return [x * R, -y2 * R, z2 * R];
}

/**
 * Cut a (lon, lat) polyline into runs of consecutive front-facing (z > 0) or back-facing points, projected. Each run
 * is { front, pts: [x, y, ...] relative to the centre }. A run with one point is dropped. Example: a meridian
 * sampled every 30 degrees seen edge-on splits into one front run and one back run.
 */
export function projectRuns(line: ArrayLike<number>, R: number, rot: number, tilt: number): { front: boolean; pts: number[] }[] {
  const out: { front: boolean; pts: number[] }[] = [];
  let cur: { front: boolean; pts: number[] } | null = null;
  for (let i = 0; i + 1 < line.length; i += 2) {
    const [x, y, z] = orthographic(line[i] as number, line[i + 1] as number, R, rot, tilt);
    const front = z > 0;
    if (!cur || cur.front !== front) {
      if (cur && cur.pts.length >= 4) out.push(cur);
      cur = { front, pts: [] };
    }
    cur.pts.push(x, y);
  }
  if (cur && cur.pts.length >= 4) out.push(cur);
  return out;
}

/** A small circle of `n` points around (lon, lat) with angular radius `deg`, as a flat (lon, lat) polyline, closed. */
export function smallCircle(lonDeg: number, latDeg: number, deg: number, n = 20): number[] {
  const out: number[] = [];
  const lat0 = (latDeg * Math.PI) / 180;
  const lon0 = (lonDeg * Math.PI) / 180;
  const r = (deg * Math.PI) / 180;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    // Spherical offset: destination point at bearing a, distance r.
    const lat = Math.asin(Math.sin(lat0) * Math.cos(r) + Math.cos(lat0) * Math.sin(r) * Math.cos(a));
    const lon = lon0 + Math.atan2(Math.sin(a) * Math.sin(r) * Math.cos(lat0), Math.cos(r) - Math.sin(lat0) * Math.sin(lat));
    out.push((lon * 180) / Math.PI, (lat * 180) / Math.PI);
  }
  return out;
}

/** A parallel at `latDeg` with a wavy edge: amplitude `amp` degrees over `waves` cycles with `phase`. */
export function wavyParallel(latDeg: number, amp: number, waves: number, phase: number, n = 72): number[] {
  const out: number[] = [];
  for (let i = 0; i <= n; i++) {
    const lon = (i / n) * 360 - 180;
    out.push(lon, latDeg + amp * Math.sin(((lon * Math.PI) / 180) * waves + phase));
  }
  return out;
}

export interface GlobeFeatures {
  /** (lon, lat) polylines drawn at full alpha. */
  lines: number[][];
  /** (lon, lat) polylines drawn fainter (bands, caps). */
  faint: number[][];
}

/**
 * Seeded surface features for a world without a map. BANDED: 7-10 wavy cloud belts and one great spot. ROCKY: 14-22
 * craters of 2-9 degrees and three ridge walks. ICY: two polar caps with ragged edges and a few long cracks. Pure:
 * the same seed gives the same world every round.
 */
export function globeFeatures(kind: Exclude<GlobeKind, 'EARTH'>, seed: number): GlobeFeatures {
  const rng = new Rng(seed);
  const lines: number[][] = [];
  const faint: number[][] = [];
  if (kind === 'BANDED') {
    const n = rng.int(7, 10);
    for (let i = 0; i < n; i++) {
      const lat = -70 + ((i + 0.5) / n) * 140;
      faint.push(wavyParallel(lat, rng.float(1.5, 4), rng.int(3, 7), rng.float(0, Math.PI * 2)));
    }
    lines.push(smallCircle(rng.float(-180, 180), rng.float(-30, -12), rng.float(7, 11), 24));
  } else if (kind === 'ROCKY') {
    const n = rng.int(14, 22);
    for (let i = 0; i < n; i++) {
      const r = rng.float(2, 9);
      lines.push(smallCircle(rng.float(-180, 180), rng.float(-75, 75), r, r > 6 ? 20 : 12));
    }
    for (let i = 0; i < 3; i++) {
      let lon = rng.float(-180, 180);
      let lat = rng.float(-50, 50);
      const walk: number[] = [lon, lat];
      let dir = rng.float(0, Math.PI * 2);
      for (let j = 0; j < 14; j++) {
        dir += rng.float(-0.5, 0.5);
        lon += Math.cos(dir) * 5;
        lat = Math.max(-80, Math.min(80, lat + Math.sin(dir) * 5));
        walk.push(lon, lat);
      }
      faint.push(walk);
    }
  } else {
    faint.push(wavyParallel(rng.float(62, 72), rng.float(2, 5), rng.int(4, 8), rng.float(0, 6)));
    faint.push(wavyParallel(-rng.float(62, 72), rng.float(2, 5), rng.int(4, 8), rng.float(0, 6)));
    for (let i = 0; i < 5; i++) {
      const lon = rng.float(-180, 180);
      const lat = rng.float(-50, 50);
      lines.push([lon, lat, lon + rng.float(-25, 25), lat + rng.float(-15, 15), lon + rng.float(-40, 40), lat + rng.float(-25, 25)]);
    }
  }
  return { lines, faint };
}

let coast: number[][] | null = null;
let coastLoading = false;

/** The real coastlines once their chunk has loaded (the first call starts the load); null until then. */
export function coastlines(): number[][] | null {
  if (!coast && !coastLoading) {
    coastLoading = true;
    import('../config/coastline.json')
      .then((m) => {
        coast = (m.default as { lines: number[][] }).lines;
      })
      .catch(() => {
        coastLoading = false;
      });
  }
  return coast;
}

/** Test seam: supply coastlines without the chunk. */
export function setCoastlines(lines: number[][] | null): void {
  coast = lines;
}

const featureCache = new Map<string, GlobeFeatures>();

function featuresFor(kind: Exclude<GlobeKind, 'EARTH'>, seed: number): GlobeFeatures {
  const key = `${kind}:${seed}`;
  let f = featureCache.get(key);
  if (!f) {
    f = globeFeatures(kind, seed);
    featureCache.set(key, f);
  }
  return f;
}

function strokeRuns(s: Surface, line: ArrayLike<number>, cx: number, cy: number, R: number, rot: number, tilt: number, color: string, alpha: number, glow: number, width: number, back: number): void {
  for (const run of projectRuns(line, R, rot, tilt)) {
    if (!run.front && back <= 0) continue;
    RUN.length = 0;
    for (let i = 0; i < run.pts.length; i += 2) RUN.push(cx + (run.pts[i] as number), cy + (run.pts[i + 1] as number));
    s.stroke(RUN, { color, glow: run.front ? glow : 0, alpha: run.front ? alpha : alpha * back, width });
  }
}

/**
 * Draw a globe of radius R px at (cx, cy), turned by `rot` radians, the pole tipped toward the viewer by `tilt`.
 * EARTH draws the real coastlines (graticule only until the chunk loads); the other kinds their seeded features.
 */
export function drawGlobe(s: Surface, kind: GlobeKind, cx: number, cy: number, R: number, rot: number, tilt: number, style: GlobeStyle, seed = 1): void {
  const alpha = style.alpha ?? 0.9;
  const glow = style.glow ?? 0.6;
  const width = style.width ?? 1;
  const back = style.back ?? 0.18;
  s.circle(cx, cy, R, { color: style.limb ?? style.color, glow: glow + 0.6, width: width + 0.25, alpha: 1 });
  if (style.graticule !== false && R >= 14) {
    for (const lat of [-60, -30, 0, 30, 60]) strokeRuns(s, wavyParallel(lat, 0, 1, 0, 48), cx, cy, R, rot, tilt, style.color, alpha * (lat === 0 ? 0.3 : 0.16), 0, 1, 0);
    for (let lon = -180; lon < 180; lon += 30) {
      const mer: number[] = [];
      for (let lat = -90; lat <= 90; lat += 10) mer.push(lon, lat);
      strokeRuns(s, mer, cx, cy, R, rot, tilt, style.color, alpha * 0.14, 0, 1, 0);
    }
  }
  if (kind === 'EARTH') {
    const lines = coastlines();
    if (!lines) return;
    for (const line of lines) strokeRuns(s, line, cx, cy, R, rot, tilt, style.color, alpha, glow, width, back);
    return;
  }
  const f = featuresFor(kind, seed);
  for (const line of f.faint) strokeRuns(s, line, cx, cy, R, rot, tilt, style.color, alpha * 0.7, glow * 0.3, width, back * 0.5);
  for (const line of f.lines) strokeRuns(s, line, cx, cy, R, rot, tilt, style.color, alpha * 0.85, glow * 0.6, width, back * 0.5);
}

/** The globe kind of a system planet by id: HOME is EARTH; INNER (Venus-like) banded clouds; OUTER and moons rocky; GIANT banded. */
export function globeKindFor(planetId: string): GlobeKind {
  if (planetId === 'HOME') return 'EARTH';
  if (planetId === 'GIANT' || planetId === 'INNER') return 'BANDED';
  return 'ROCKY';
}
