// WHAT: Small drawing helpers shared by the deflection and risk labs: animation phase, outlined bars,
//       arrows, log-scale positions and labels that never leave their box.
// WHY:  Labs animate as a pure function of (values, t) and must read in monochrome, so the same few
//       primitives (a dashed outline, an arrowhead, a fitted label) recur in every one of them.
// HOW:  `phase(t, P)` is the position 0..1 inside a repeating P-second loop; `ease` smooths it. Everything
//       else strokes through the Surface; nothing is stored between frames.
// LORE: G8 (the look), C2 (reading the code)

import type { Surface, StrokeStyle } from '../../render/canvas';
import { drawTextFit } from '../../render/vectorFont';
import type { Box } from './lab';

/** Position 0..1 inside a repeating loop of `period` seconds. */
export function phase(t: number, period: number): number {
  const x = (t % period) / period;
  return x < 0 ? x + 1 : x;
}

/** Smoothstep ease 0..1 on a clamped input. */
export function ease(x: number): number {
  const c = Math.max(0, Math.min(1, x));
  return c * c * (3 - 2 * c);
}

/** Outlined rectangle (lines only, no fill). */
export function rect(s: Surface, x: number, y: number, w: number, h: number, style: StrokeStyle = {}): void {
  s.stroke([x, y, x + w, y, x + w, y + h, x, y + h], { glow: 0.4, ...style, closed: true });
}

/** A line with an arrowhead at (x1, y1). */
export function arrow(s: Surface, x0: number, y0: number, x1: number, y1: number, style: StrokeStyle = {}, head = 5): void {
  s.stroke([x0, y0, x1, y1], { glow: 0.5, ...style });
  const a = Math.atan2(y1 - y0, x1 - x0);
  s.stroke([x1 - head * Math.cos(a - 0.45), y1 - head * Math.sin(a - 0.45), x1, y1, x1 - head * Math.cos(a + 0.45), y1 - head * Math.sin(a + 0.45)], { glow: 0.5, ...style, dash: [] });
}

/** Fraction 0..1 of `x` between lo and hi on a log scale (clamped). */
export function logFrac(x: number, lo: number, hi: number): number {
  if (!(x > 0)) return 0;
  return Math.max(0, Math.min(1, Math.log(x / lo) / Math.log(hi / lo)));
}

/** A label clipped to the right edge of its box (shrinks rather than overflowing). */
export function label(s: Surface, box: Box, text: string, x: number, y: number, size: number, color: string, glow = 0): void {
  drawTextFit(s, text, x, y, size, Math.max(10, box.x + box.w - 4 - x), { color, glow });
}

/** Frame of a lab box in the dim ink. */
export function frame(s: Surface, box: Box): void {
  rect(s, box.x, box.y, box.w, box.h, { color: s.palette.dim, glow: 0 });
}
