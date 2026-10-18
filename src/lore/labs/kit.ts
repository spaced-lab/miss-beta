// WHAT: Small shared tools for the animated labs: a bounded memo cache, an arrow, a box-fitted label, a loop
//       clock and a marker per semantic role.
// WHY:  Heavy labs (a porkchop grid, Monte Carlo samples, an integrated spiral) must not recompute every
//       frame. Their output is a pure function of the slider values, so caching by the rounded values keeps
//       a frame under about 2 ms while the result stays exactly what a fresh computation would give.
// HOW:  `Memo` is a Map keyed by a string of rounded inputs; past `cap` entries the oldest is dropped
//       (insertion order). `loop(t, period)` turns page time into a 0..1 phase. `arrow` strokes a shaft and a
//       two-line head. `fitLabel` shrinks text so it never leaves the box. `roleDash` pairs each role with its
//       line style from palettes.json so a lab still reads with COLOUR set to MONO.
// LORE: C2 (reading the code), G8 (the look)

import type { Surface } from '../../render/canvas';
import { ROLE_STYLE, type Role } from '../../render/palettes';
import { drawTextFit } from '../../render/vectorFont';
import type { Box } from './lab';

export class Memo<T> {
  private readonly map = new Map<string, T>();
  constructor(private readonly cap = 12) {}
  get(key: string, make: () => T): T {
    const hit = this.map.get(key);
    if (hit !== undefined) return hit;
    const v = make();
    this.map.set(key, v);
    if (this.map.size > this.cap) {
      const oldest = this.map.keys().next();
      if (!oldest.done) this.map.delete(oldest.value);
    }
    return v;
  }
}

/** Key from slider values rounded to 6 significant digits (so float noise in a slider never misses the cache). */
export function keyOf(...xs: number[]): string {
  return xs.map((x) => Number(x.toPrecision(6))).join('|');
}

/** Phase in [0, 1) of a loop of `period` seconds at page time t. Example: loop(7, 4) = 0.75. */
export function loop(t: number, period: number): number {
  const p = (t / period) % 1;
  return p < 0 ? p + 1 : p;
}

/** Arrow from (x0, y0) to (x1, y1) in screen px with a head of `head` px. */
export function arrow(s: Surface, x0: number, y0: number, x1: number, y1: number, color: string, dash?: readonly number[], head = 6): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const L = Math.hypot(dx, dy);
  s.stroke([x0, y0, x1, y1], { color, glow: 0.5, ...(dash && dash.length > 0 ? { dash } : {}) });
  if (L < 1) return;
  const ux = dx / L;
  const uy = dy / L;
  const h = Math.min(head, L * 0.5);
  s.stroke([x1 - h * (ux - 0.5 * uy), y1 - h * (uy + 0.5 * ux), x1, y1, x1 - h * (ux + 0.5 * uy), y1 - h * (uy - 0.5 * ux)], { color, glow: 0.5 });
}

/** A label at (x, y) that shrinks to stay inside `box` (right edge minus 4 px). */
export function fitLabel(s: Surface, box: Box, text: string, x: number, y: number, color: string, size = 8): void {
  const xx = Math.max(box.x + 3, Math.min(x, box.x + box.w - 20));
  const yy = Math.max(box.y + 3, Math.min(y, box.y + box.h - size - 3));
  drawTextFit(s, text, xx, yy, size, box.x + box.w - 4 - xx, { color, glow: 0 });
}

/** The dash pattern paired with a role (empty for solid), so colour is never the only cue. */
export function roleDash(role: Role): readonly number[] | undefined {
  const d = ROLE_STYLE[role]?.dash;
  return d && d.length > 0 ? d : undefined;
}

/** Linear interpolation into a flat [x0, y0, x1, y1, ...] array at fraction f in [0, 1]. */
export function along(pts: ArrayLike<number>, f: number): [number, number] {
  const n = Math.floor(pts.length / 2);
  if (n === 0) return [0, 0];
  const u = Math.max(0, Math.min(1, f)) * (n - 1);
  const i = Math.min(n - 2, Math.floor(u));
  if (i < 0) return [pts[0] ?? 0, pts[1] ?? 0];
  const k = u - i;
  const x = (pts[2 * i] ?? 0) * (1 - k) + (pts[2 * i + 2] ?? 0) * k;
  const y = (pts[2 * i + 1] ?? 0) * (1 - k) + (pts[2 * i + 3] ?? 0) * k;
  return [x, y];
}

/**
 * Many disjoint segments in one canvas path ([x0, y0, x1, y1] per segment, screen px): a contour map has
 * hundreds, and one Surface.stroke per segment would cost a millisecond or more. No glow, by design.
 */
export function segments(s: Surface, segs: ArrayLike<number>, color: string, dash?: readonly number[]): void {
  const ctx = s.ctx;
  if (segs.length < 4) return;
  ctx.beginPath();
  for (let i = 0; i + 3 < segs.length; i += 4) {
    ctx.moveTo(segs[i] as number, segs[i + 1] as number);
    ctx.lineTo(segs[i + 2] as number, segs[i + 3] as number);
  }
  ctx.setLineDash(dash ? (dash as number[]) : []);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = s.palette.lineWidth;
  ctx.stroke();
  ctx.setLineDash([]);
}

/**
 * Marching squares on a row-major grid z[i * nj + j] (NaN cells skipped): the level-`level` contour as
 * segments in grid coordinates (i, j). Four-crossing saddles are split pairwise (good enough to look at).
 * Example: z = i + j on a 3 x 3 grid at level 1.5 gives the anti-diagonal segments.
 */
export function contourSegments(z: ArrayLike<number>, ni: number, nj: number, level: number): number[] {
  const out: number[] = [];
  const at = (i: number, j: number): number => z[i * nj + j] ?? NaN;
  const pts: number[] = [];
  for (let i = 0; i + 1 < ni; i++) {
    for (let j = 0; j + 1 < nj; j++) {
      const a = at(i, j);
      const b = at(i + 1, j);
      const c = at(i + 1, j + 1);
      const d = at(i, j + 1);
      if (!(Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(c) && Number.isFinite(d))) continue;
      pts.length = 0;
      const edge = (v0: number, v1: number, x0: number, y0: number, x1: number, y1: number): void => {
        if ((v0 < level) === (v1 < level)) return;
        const k = (level - v0) / (v1 - v0);
        pts.push(x0 + k * (x1 - x0), y0 + k * (y1 - y0));
      };
      edge(a, b, i, j, i + 1, j);
      edge(b, c, i + 1, j, i + 1, j + 1);
      edge(c, d, i + 1, j + 1, i, j + 1);
      edge(d, a, i, j + 1, i, j);
      for (let k = 0; k + 3 < pts.length; k += 4) out.push(pts[k] as number, pts[k + 1] as number, pts[k + 2] as number, pts[k + 3] as number);
    }
  }
  return out;
}
