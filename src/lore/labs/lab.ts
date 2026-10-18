// WHAT: The LAB interface (EDUCATION.md Section 7): sliders on the left, a live vector plot on the right,
//       the formula with the current numbers substituted, and the code path for SHOW CODE.
// WHY:  Labs reuse the game's physics functions directly and are never reimplemented; they are code-split
//       modules loaded only when opened (GAME_PLAN 23).
// HOW:  A lab is data plus two pure functions: `lines(values)` returns the formula lines with numbers in,
//       `draw(s, values, box)` strokes the plot into a box. The Learning Center owns the slider state.
// LORE: C2 (reading the code)

import type { Surface } from '../../render/canvas';

export interface Slider {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  /** Display unit suffix. */
  unit?: string;
  /** Logarithmic slider (min and max > 0). */
  log?: boolean;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Lab {
  id: string;
  title: string;
  sliders: Slider[];
  /** Formula lines with the current numbers substituted. */
  lines(v: Record<string, number>): string[];
  /** `t` is seconds since the page loaded: labs may animate (a rotating model, a craft moving on its arc). */
  draw(s: Surface, v: Record<string, number>, box: Box, t?: number): void;
  /** The real function(s) this lab calls, for SHOW CODE. */
  code: string[];
}

export function values(sliders: readonly Slider[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const sl of sliders) out[sl.key] = sl.value;
  return out;
}

/** Step a slider by n steps (log sliders step by a ratio). */
export function nudge(sl: Slider, n: number): void {
  if (sl.log) {
    const ratio = Math.pow(sl.max / sl.min, 1 / Math.max(1, (sl.max - sl.min) / sl.step));
    sl.value = Math.min(sl.max, Math.max(sl.min, sl.value * Math.pow(ratio, n)));
  } else sl.value = Math.min(sl.max, Math.max(sl.min, sl.value + n * sl.step));
}

export const fmt = (x: number, digits = 3): string => (Math.abs(x) >= 1e5 || (Math.abs(x) < 1e-3 && x !== 0) ? x.toExponential(2) : Number(x.toPrecision(digits)).toString());
