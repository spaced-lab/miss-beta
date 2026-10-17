// WHAT: A hand-built stroke font (Asteroids style) and a text renderer for the play field.
// WHY:  GAME_PLAN 4: text in the play field is a stroke font, never a raster font, so it glows and scales
//       like every other line. This 16-ish-segment face is the arcade option from Section 28; Hershey
//       simplex is the alternative and can be dropped in behind the same `glyph()` interface (M8).
// HOW:  Each glyph is a list of polylines on a 4 x 6 grid (x right, y down, origin top-left). Lowercase
//       maps to uppercase. Unknown characters draw a box so a missing glyph is obvious in play, not silent.
//       `measureText` and `drawText` work in CSS px; `size` is the cap height.
// LORE: G8 (the look), C4 (build your own)

import type { Surface, StrokeStyle } from './canvas';

type Stroke = readonly (readonly [number, number])[];
type Glyph = readonly Stroke[];

const G: Record<string, Glyph> = {
  A: [[[0, 6], [0, 2], [2, 0], [4, 2], [4, 6]], [[0, 4], [4, 4]]],
  B: [[[0, 0], [0, 6], [3, 6], [4, 5], [4, 4], [3, 3], [0, 3]], [[0, 0], [3, 0], [4, 1], [4, 2], [3, 3]]],
  C: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5]]],
  D: [[[0, 0], [0, 6], [3, 6], [4, 5], [4, 1], [3, 0], [0, 0]]],
  E: [[[4, 0], [0, 0], [0, 6], [4, 6]], [[0, 3], [3, 3]]],
  F: [[[4, 0], [0, 0], [0, 6]], [[0, 3], [3, 3]]],
  G: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5], [4, 3], [2, 3]]],
  H: [[[0, 0], [0, 6]], [[4, 0], [4, 6]], [[0, 3], [4, 3]]],
  I: [[[1, 0], [3, 0]], [[2, 0], [2, 6]], [[1, 6], [3, 6]]],
  J: [[[3, 0], [3, 5], [2, 6], [1, 6], [0, 5]]],
  K: [[[0, 0], [0, 6]], [[4, 0], [0, 3.2]], [[1.4, 2.2], [4, 6]]],
  L: [[[0, 0], [0, 6], [4, 6]]],
  M: [[[0, 6], [0, 0], [2, 3], [4, 0], [4, 6]]],
  N: [[[0, 6], [0, 0], [4, 6], [4, 0]]],
  O: [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]]],
  P: [[[0, 6], [0, 0], [3, 0], [4, 1], [4, 2], [3, 3], [0, 3]]],
  Q: [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]], [[2.5, 4.5], [4.5, 6.5]]],
  R: [[[0, 6], [0, 0], [3, 0], [4, 1], [4, 2], [3, 3], [0, 3]], [[2, 3], [4, 6]]],
  S: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 2], [1, 3], [3, 3], [4, 4], [4, 5], [3, 6], [1, 6], [0, 5]]],
  T: [[[0, 0], [4, 0]], [[2, 0], [2, 6]]],
  U: [[[0, 0], [0, 5], [1, 6], [3, 6], [4, 5], [4, 0]]],
  V: [[[0, 0], [2, 6], [4, 0]]],
  W: [[[0, 0], [1, 6], [2, 3], [3, 6], [4, 0]]],
  X: [[[0, 0], [4, 6]], [[4, 0], [0, 6]]],
  Y: [[[0, 0], [2, 3], [4, 0]], [[2, 3], [2, 6]]],
  Z: [[[0, 0], [4, 0], [0, 6], [4, 6]]],
  '0': [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]], [[0, 5], [4, 1]]],
  '1': [[[1, 1], [2, 0], [2, 6]], [[1, 6], [3, 6]]],
  '2': [[[0, 1], [1, 0], [3, 0], [4, 1], [4, 2], [0, 6], [4, 6]]],
  '3': [[[0, 0], [4, 0], [2, 2.5], [3, 2.5], [4, 3.5], [4, 5], [3, 6], [1, 6], [0, 5]]],
  '4': [[[3, 6], [3, 0], [0, 4], [4, 4]]],
  '5': [[[4, 0], [0, 0], [0, 3], [3, 3], [4, 4], [4, 5], [3, 6], [1, 6], [0, 5]]],
  '6': [[[3, 0], [1, 2], [0, 4], [0, 5], [1, 6], [3, 6], [4, 5], [4, 4], [3, 3], [0, 3]]],
  '7': [[[0, 0], [4, 0], [1.5, 6]]],
  '8': [[[1, 0], [3, 0], [4, 1], [4, 2], [3, 3], [1, 3], [0, 2], [0, 1], [1, 0]], [[1, 3], [0, 4], [0, 5], [1, 6], [3, 6], [4, 5], [4, 4], [3, 3]]],
  '9': [[[1, 6], [3, 4], [4, 2], [4, 1], [3, 0], [1, 0], [0, 1], [0, 2], [1, 3], [4, 3]]],
  ' ': [],
  '.': [[[2, 5.6], [2, 6]]],
  ',': [[[2, 5.5], [1.4, 6.8]]],
  ':': [[[2, 1.8], [2, 2.3]], [[2, 5.5], [2, 6]]],
  ';': [[[2, 1.8], [2, 2.3]], [[2, 5.5], [1.4, 6.8]]],
  '-': [[[1, 3], [3, 3]]],
  '+': [[[1, 3], [3, 3]], [[2, 2], [2, 4]]],
  '/': [[[0, 6], [4, 0]]],
  '\\': [[[0, 0], [4, 6]]],
  '(': [[[3, 0], [1.5, 1.5], [1.5, 4.5], [3, 6]]],
  ')': [[[1, 0], [2.5, 1.5], [2.5, 4.5], [1, 6]]],
  '[': [[[3, 0], [1, 0], [1, 6], [3, 6]]],
  ']': [[[1, 0], [3, 0], [3, 6], [1, 6]]],
  '!': [[[2, 0], [2, 4]], [[2, 5.6], [2, 6]]],
  '?': [[[0, 1], [1, 0], [3, 0], [4, 1], [4, 2], [2, 3.5], [2, 4]], [[2, 5.6], [2, 6]]],
  '=': [[[0.5, 2.2], [3.5, 2.2]], [[0.5, 3.8], [3.5, 3.8]]],
  '<': [[[3.5, 0.5], [0.5, 3], [3.5, 5.5]]],
  '>': [[[0.5, 0.5], [3.5, 3], [0.5, 5.5]]],
  '*': [[[2, 1], [2, 5]], [[0.3, 2], [3.7, 4]], [[3.7, 2], [0.3, 4]]],
  '%': [[[0, 6], [4, 0]], [[0.5, 0], [1.5, 0], [1.5, 1], [0.5, 1], [0.5, 0]], [[2.5, 5], [3.5, 5], [3.5, 6], [2.5, 6], [2.5, 5]]],
  "'": [[[2, 0], [2, 1.5]]],
  '"': [[[1.5, 0], [1.5, 1.5]], [[2.5, 0], [2.5, 1.5]]],
  '_': [[[0, 6], [4, 6]]],
  '#': [[[1, 0], [1, 6]], [[3, 0], [3, 6]], [[0, 2], [4, 2]], [[0, 4], [4, 4]]],
  '^': [[[1, 2], [2, 0], [3, 2]]],
  '~': [[[0, 3.5], [1, 2.5], [2, 3.5], [3, 3.5], [4, 2.5]]],
  '|': [[[2, 0], [2, 6]]],
  // Greek beta with a descender: the title glyph.
  'β': [[[0, 8], [0, 1], [1, 0], [3, 0], [4, 1], [4, 2], [3, 3], [1, 3]], [[3, 3], [4, 4], [4, 5], [3, 6], [1, 6], [0, 5]]],
  // Proportional-to: a closed loop on the left, open arms on the right.
  '∝': [[[2, 3], [1.2, 1.8], [0.4, 2], [0, 3], [0.4, 4], [1.2, 4.2], [2, 3]], [[2, 3], [3, 1.8], [4, 1.6]], [[2, 3], [3, 4.2], [4, 4.4]]],
  '°': [[[1.5, 0], [2.5, 0], [3, 0.5], [3, 1.5], [2.5, 2], [1.5, 2], [1, 1.5], [1, 0.5], [1.5, 0]]],
};

const UNKNOWN: Glyph = [[[0, 0], [4, 0], [4, 6], [0, 6], [0, 0]]];

/** Glyph cell is 4 wide; advance is 5.5 so letters breathe. */
export const GLYPH_W = 4;
export const GLYPH_H = 6;
export const ADVANCE = 5.5;

export function glyph(ch: string): Glyph {
  return G[ch] ?? G[ch.toUpperCase()] ?? UNKNOWN;
}

export function hasGlyph(ch: string): boolean {
  return ch in G || ch.toUpperCase() in G;
}

/** Width in CSS px of `text` drawn at cap height `size`. */
export function measureText(text: string, size: number): number {
  if (text.length === 0) return 0;
  const u = size / GLYPH_H;
  return (text.length * ADVANCE - (ADVANCE - GLYPH_W)) * u;
}

export type Align = 'left' | 'center' | 'right';

export interface TextStyle extends StrokeStyle {
  align?: Align;
  /** Extra letter spacing in glyph units. */
  spacing?: number;
}

/**
 * Draw `text` with its top-left at (x, y) (or centred / right-aligned on x). Returns the drawn width.
 * Example: drawText(s, 'SCORE 120', 16, 16, 14) draws 14 px high capitals.
 */
export function drawText(s: Surface, text: string, x: number, y: number, size: number, style: TextStyle = {}): number {
  const u = size / GLYPH_H;
  const adv = (ADVANCE + (style.spacing ?? 0)) * u;
  const width = text.length * adv - (ADVANCE - GLYPH_W) * u;
  let cx = x;
  if (style.align === 'center') cx = x - width / 2;
  else if (style.align === 'right') cx = x - width;

  const buf: number[] = [];
  for (const ch of text) {
    for (const stroke of glyph(ch)) {
      buf.length = 0;
      for (const [gx, gy] of stroke) buf.push(cx + gx * u, y + gy * u);
      s.stroke(buf, style);
    }
    cx += adv;
  }
  return width;
}

/** Draw several lines, top-left anchored, with 1.6x line height. */
export function drawLines(s: Surface, lines: readonly string[], x: number, y: number, size: number, style: TextStyle = {}): void {
  let yy = y;
  for (const line of lines) {
    drawText(s, line, x, yy, size, style);
    yy += size * 1.6;
  }
}
