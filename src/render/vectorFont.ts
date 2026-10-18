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

/** Lowercase, x-height 4 (rows 2..6), ascenders to row 0, descenders to row 8. Used only with `lower: true`
 *  (lore prose); the HUD keeps mapping lowercase to capitals so existing strings do not change. */
const LOWER: Record<string, Glyph> = {
  a: [[[4, 6], [4, 3], [3, 2], [1, 2], [0, 3], [0, 5], [1, 6], [3, 6], [4, 5]]],
  b: [[[0, 0], [0, 6]], [[0, 3], [1, 2], [3, 2], [4, 3], [4, 5], [3, 6], [1, 6], [0, 5]]],
  c: [[[4, 3], [3, 2], [1, 2], [0, 3], [0, 5], [1, 6], [3, 6], [4, 5]]],
  d: [[[4, 0], [4, 6]], [[4, 3], [3, 2], [1, 2], [0, 3], [0, 5], [1, 6], [3, 6], [4, 5]]],
  e: [[[0, 4], [4, 4], [4, 3], [3, 2], [1, 2], [0, 3], [0, 5], [1, 6], [3, 6], [4, 5.4]]],
  f: [[[1, 6], [1, 1], [2, 0], [3, 0]], [[0, 3], [2.5, 3]]],
  g: [[[4, 2], [4, 7], [3, 8], [1, 8], [0, 7]], [[4, 3], [3, 2], [1, 2], [0, 3], [0, 5], [1, 6], [3, 6], [4, 5]]],
  h: [[[0, 0], [0, 6]], [[0, 3], [1, 2], [3, 2], [4, 3], [4, 6]]],
  i: [[[2, 2], [2, 6]], [[2, 0], [2, 0.6]]],
  j: [[[2.5, 2], [2.5, 7], [1.5, 8], [0.5, 7.4]], [[2.5, 0], [2.5, 0.6]]],
  k: [[[0, 0], [0, 6]], [[3.5, 2], [0, 4.5]], [[1.3, 3.6], [3.5, 6]]],
  l: [[[1.5, 0], [1.5, 5], [2.5, 6], [3, 6]]],
  m: [[[0, 6], [0, 2]], [[0, 3], [1, 2], [1.7, 2], [2.2, 3], [2.2, 6]], [[2.2, 3], [2.8, 2], [3.5, 2], [4, 3], [4, 6]]],
  n: [[[0, 6], [0, 2]], [[0, 3], [1, 2], [3, 2], [4, 3], [4, 6]]],
  o: [[[1, 2], [3, 2], [4, 3], [4, 5], [3, 6], [1, 6], [0, 5], [0, 3], [1, 2]]],
  p: [[[0, 2], [0, 8]], [[0, 3], [1, 2], [3, 2], [4, 3], [4, 5], [3, 6], [1, 6], [0, 5]]],
  q: [[[4, 2], [4, 8]], [[4, 3], [3, 2], [1, 2], [0, 3], [0, 5], [1, 6], [3, 6], [4, 5]]],
  r: [[[0.5, 6], [0.5, 2]], [[0.5, 3.5], [1.5, 2.3], [3, 2], [4, 2.4]]],
  s: [[[4, 2.6], [3, 2], [1, 2], [0.3, 2.8], [1, 3.8], [3, 4.2], [3.8, 5], [3, 6], [1, 6], [0, 5.4]]],
  t: [[[1.5, 0.5], [1.5, 5], [2.5, 6], [3.5, 6]], [[0, 2], [3, 2]]],
  u: [[[0, 2], [0, 5], [1, 6], [3, 6], [4, 5]], [[4, 2], [4, 6]]],
  v: [[[0, 2], [2, 6], [4, 2]]],
  w: [[[0, 2], [1, 6], [2, 3.5], [3, 6], [4, 2]]],
  x: [[[0, 2], [4, 6]], [[4, 2], [0, 6]]],
  y: [[[0, 2], [2, 6]], [[4, 2], [1.5, 8], [0.5, 8]]],
  z: [[[0, 2], [4, 2], [0, 6], [4, 6]]],
  // Characters the lore text uses that the capitals set lacks.
  '{': [[[3, 0], [2, 0.5], [2, 2.5], [1, 3], [2, 3.5], [2, 5.5], [3, 6]]],
  '}': [[[1, 0], [2, 0.5], [2, 2.5], [3, 3], [2, 3.5], [2, 5.5], [1, 6]]],
  '`': [[[1.5, 0], [2.5, 1.2]]],
  '&': [[[4, 6], [1, 2.5], [1, 1], [2, 0], [3, 1], [3, 1.8], [0.5, 4], [0.5, 5], [1.5, 6], [2.5, 6], [4, 4]]],
  '@': [[[3, 2.5], [2, 2], [1.3, 2.7], [1.3, 3.8], [2, 4.5], [3, 4]], [[3, 2.5], [3, 4.2], [3.8, 4.2], [4, 3], [3.5, 1], [2.5, 0.3], [1, 0.5], [0, 2], [0, 4.5], [1, 6], [3, 6]]],
  '$': [[[2, -0.3], [2, 6.8]], [[4, 1], [3, 0.3], [1, 0.3], [0, 1.3], [1, 2.6], [3, 3.4], [4, 4.6], [3, 5.7], [1, 5.7], [0, 5]]],
};

const UNKNOWN: Glyph = [[[0, 0], [4, 0], [4, 6], [0, 6], [0, 0]]];

/** Substitutions for characters the font lacks (lore prose): drawn as the nearest ASCII. */
const SUBST: Record<string, string> = { '\u2248': '~', '\u00d7': 'x', '\u00b2': '^2', '\u00b3': '^3', '\u00b1': '+/-', '\u2013': '-', '\u2212': '-', '\u00b7': '.', '\u2192': '->', '\u2264': '<=', '\u2265': '>=', '\u03bd': 'nu', '\u03c0': 'pi', '\u03c9': 'w', '\u03d6': 'w', '\u03b1': 'alpha', '\u03c3': 'sigma', '\u03c4': 'tau', '\u03b7': 'eta', '\u0394': 'D', '\u03bc': 'mu', '\u03c1': 'rho', '\u2026': '...', '\u2019': "'", '\u201c': '"', '\u201d': '"', '\u00b0': '\u00b0' };

/** Replace characters the font cannot draw with ASCII stand-ins (keeps degree, beta, proportional). */
export function substitute(text: string): string {
  let out = '';
  for (const ch of text) out += SUBST[ch] ?? ch;
  return out;
}

/** Glyph cell is 4 wide; advance is 5.5 so letters breathe. */
export const GLYPH_W = 4;
export const GLYPH_H = 6;
export const ADVANCE = 5.5;

export function glyph(ch: string, lower = false): Glyph {
  if (lower) return LOWER[ch] ?? G[ch] ?? G[ch.toUpperCase()] ?? UNKNOWN;
  return G[ch] ?? G[ch.toUpperCase()] ?? UNKNOWN;
}

export function hasGlyph(ch: string, lower = false): boolean {
  return ch in G || ch.toUpperCase() in G || (lower && ch in LOWER);
}

/** How many characters of cap height `size` fit in `widthPx` (uses the current text scale). */
export function charsPerLine(widthPx: number, size: number): number {
  return Math.max(8, Math.floor(widthPx / ((size * textScale * ADVANCE) / GLYPH_H)));
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
  /** Draw lowercase letters as lowercase (lore prose); default maps them to capitals. */
  lower?: boolean;
}

/**
 * Draw `text` with its top-left at (x, y) (or centred / right-aligned on x). Returns the drawn width.
 * Example: drawText(s, 'SCORE 120', 16, 16, 14) draws 14 px high capitals.
 */
/** Global text scale from the options screen (TEXT SIZE); 1 is the designed size. */
let textScale = 1;
export function setTextScale(f: number): void {
  textScale = Math.max(0.5, Math.min(2, f));
}
export function getTextScale(): number {
  return textScale;
}

export function drawText(s: Surface, text: string, x: number, y: number, size0: number, style: TextStyle = {}): number {
  const size = size0 * textScale;
  const u = size / GLYPH_H;
  const adv = (ADVANCE + (style.spacing ?? 0)) * u;
  const width = text.length * adv - (ADVANCE - GLYPH_W) * u;
  let cx = x;
  if (style.align === 'center') cx = x - width / 2;
  else if (style.align === 'right') cx = x - width;

  const buf: number[] = [];
  for (const ch of text) {
    for (const stroke of glyph(ch, style.lower ?? false)) {
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

/**
 * drawText, shrunk if needed so the drawn width never exceeds `maxW` px (the box it belongs to).
 * Text that already fits is drawn at `size` unchanged. Example: a 13 px key row in a 600 px panel.
 */
export function drawTextFit(s: Surface, text: string, x: number, y: number, size: number, maxW: number, style: TextStyle = {}): number {
  const w = measureText(text, size) * textScale;
  const f = w > maxW && w > 0 ? maxW / w : 1;
  return drawText(s, text, x, y, size * f, style);
}

/** Word-wrap `text` into lines that fit `widthPx` at cap height `size` (TEXT SIZE included). */
export function wrapText(text: string, widthPx: number, size: number): string[] {
  const cols = charsPerLine(widthPx, size);
  const out: string[] = [];
  let cur = '';
  for (const word of text.split(/\s+/).filter((w) => w.length > 0)) {
    if (cur.length === 0) cur = word;
    else if (cur.length + 1 + word.length <= cols) cur += ' ' + word;
    else {
      out.push(cur);
      cur = word;
    }
  }
  if (cur.length > 0) out.push(cur);
  return out;
}
