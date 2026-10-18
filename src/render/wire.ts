// WHAT: Wireframe and holographic dressing (GAME_PLAN 24.2, 24.3): a parallax star field, a wireframe
//       sphere, and the "materialize" panel transition.
// WHY:  Depth cues and the instrument feel, all as lines, all cheap, all off under reduce-motion.
// HOW:  Stars: three seeded layers drawn as dots offset by the pan times a layer factor. Sphere: latitude
//       ellipses plus longitude ellipses rotated with time. Materialize: a frame that draws itself in over
//       0.35 s with one vertical light sweep; `Materialize.frame` is a drop-in for a plain rectangle.
// LORE: G8 (the look)

import { Rng } from '../sim/rng';
import type { Surface } from './canvas';

/** Parallax factor per star layer (far to near). */
const LAYER_FACTORS = [0.15, 0.3, 0.5] as const;
/** Scratch polyline for wireSphere: 49 points. s.stroke reads it synchronously, so one buffer serves every ring
 *  (it was two fresh arrays per ring per frame; docs/DECISIONS.md D6). */
const RING = new Float64Array(98);

export class StarField {
  private readonly layers: Float64Array[] = [];
  constructor(seed = 7, counts: readonly number[] = [90, 60, 30]) {
    const rng = new Rng(seed);
    for (const n of counts) {
      const a = new Float64Array(n * 2);
      for (let i = 0; i < n * 2; i++) a[i] = rng.float(0, 1);
      this.layers.push(a);
    }
  }
  /** Draw with the given pan (px); factor per layer 0.15, 0.3, 0.5 so far stars move least. */
  draw(s: Surface, panX: number, panY: number, parallax = true): void {
    const p = s.palette;
    this.layers.forEach((a, li) => {
      const f = parallax ? (LAYER_FACTORS[li] ?? 0) : 0;
      const size = li === 2 ? 1.6 : 1.1;
      const alpha = li === 0 ? 0.25 : li === 1 ? 0.4 : 0.6;
      for (let i = 0; i < a.length; i += 2) {
        const x = ((((a[i] as number) * s.width + panX * f) % s.width) + s.width) % s.width;
        const y = ((((a[i + 1] as number) * s.height + panY * f) % s.height) + s.height) % s.height;
        s.dot(x, y, size, p.dim, alpha);
      }
    });
  }
}

/** A wireframe sphere: `lat` latitude rings, `lon` meridians rotating by `rot` radians. */
export function wireSphere(s: Surface, cx: number, cy: number, R: number, rot: number, lat = 5, lon = 8, color?: string): void {
  const col = color ?? s.palette.dim;
  for (let i = 1; i <= lat; i++) {
    const phi = (i / (lat + 1)) * Math.PI - Math.PI / 2;
    const ry = R * Math.sin(phi);
    const rr = R * Math.cos(phi);
    for (let k = 0; k <= 48; k++) {
      const th = (k / 48) * Math.PI * 2;
      RING[2 * k] = cx + rr * Math.cos(th);
      RING[2 * k + 1] = cy + ry * 0.35 + rr * 0.0 + Math.sin(th) * rr * 0.25;
    }
    s.stroke(RING, { color: col, glow: 0, width: 1, alpha: 0.6 });
  }
  for (let j = 0; j < lon; j++) {
    const lam = rot + (j / lon) * Math.PI;
    const rx = Math.abs(R * Math.cos(lam));
    for (let k = 0; k <= 48; k++) {
      const th = (k / 48) * Math.PI * 2;
      RING[2 * k] = cx + rx * Math.sin(th) * Math.sign(Math.cos(lam) || 1);
      RING[2 * k + 1] = cy - R * Math.cos(th);
    }
    s.stroke(RING, { color: col, glow: 0, width: 1, alpha: 0.35 });
  }
}

/** Panel materialize transition (24.2). Call start() when the panel opens; frame() draws the rectangle. */
export class Materialize {
  private t = 1;
  /** Seconds for the frame to draw itself in. [knob] */
  static readonly DURATION = 0.35;
  start(): void {
    this.t = 0;
  }
  tick(dtSeconds: number): void {
    this.t = Math.min(1, this.t + dtSeconds / Materialize.DURATION);
  }
  get done(): boolean {
    return this.t >= 1;
  }
  frame(s: Surface, x: number, y: number, w: number, h: number, glow = 1.2, reduceMotion = false): void {
    const p = s.palette;
    const f = reduceMotion ? 1 : this.t;
    const perim = 2 * (w + h);
    const len = perim * f;
    // Walk the rectangle clockwise from the top-left for `len` px.
    const corners: [number, number][] = [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];
    const pts: number[] = [x, y];
    let left = len;
    for (let i = 0; i < 4 && left > 0; i++) {
      const [ax, ay] = corners[i] as [number, number];
      const [bx, by] = corners[i + 1] as [number, number];
      const segLen = Math.hypot(bx - ax, by - ay);
      const take = Math.min(segLen, left);
      pts.push(ax + ((bx - ax) * take) / segLen, ay + ((by - ay) * take) / segLen);
      left -= take;
    }
    s.stroke(pts, { closed: f >= 1, glow });
    if (!reduceMotion && f < 1) {
      const sx = x + w * f;
      s.stroke([sx, y, sx, y + h], { color: p.hot, glow: 1.5, alpha: 0.5 * (1 - f) });
    }
  }
}
