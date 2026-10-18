// WHAT: Pixel-art layer for the event cinematics: sprites from strings, a fire ramp, a false-colour thrust ramp,
//       procedural rocket / tower / stage sprites, smoke and debris.
// WHY:  Owner, 2026-10-18: launch and impact scenes in the PERIMETER style, "use pixel art". Vector strokes
//       carry the geometry; square pixels carry fire, smoke and debris, the way the arcade games did. Later the
//       same day: "finer pixels, and false colour for the head of thrust and tiny pixels".
// HOW:  A sprite is rows of characters; each character maps to a colour key ('.' is transparent). Pixels are
//       Surface.dot squares placed on a rotated grid, so a sprite can tilt along its flight path. Everything is
//       a pure function of (scene seed, elapsed time): `hash01` gives per-pixel noise without an Rng.
//       The rocket sprites are built procedurally at about twice the old resolution (nose cone, fairing seam,
//       porthole, livery stripe, interstage bands, roll marks, fins, engine bells, strap-on boosters on the
//       heavy) and drawn at KNOBS.CINE_LAUNCH_CELL_PX. `falseRamp` gives the thermal false-colour steps:
//       KNOBS.CINE_FALSE_RAMP under NEON, the mode's own hot / ink / alt / dim under a mono palette.
// LORE: G8 (the look)

import { KNOBS } from '../../config/knobs';
import type { Surface } from '../canvas';
import type { Palette } from '../palettes';

/** Deterministic noise in [0, 1) from integers (a small integer hash). */
export function hash01(a: number, b = 0, c = 0): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Colours for sprite keys under the current palette: NEON hues when the colour layer is on, else mono steps. */
export function pixelPalette(s: Surface): Record<string, string> {
  const p = s.palette;
  if (s.spectrum) {
    return { W: '#FFFFFF', w: '#C9D6E8', g: '#8A97AA', c: s.role('craft'), b: s.role('orbit'), y: '#FFE9A8', o: s.role('nuclear'), r: s.role('danger'), a: s.role('threat'), m: s.role('fragment'), k: '#3A4250', G: s.role('planet') };
  }
  return { W: p.hot, w: p.ink, g: p.dim, c: p.ink, b: p.ink, y: p.hot, o: p.ink, r: p.ink, a: p.ink, m: p.ink, k: p.dim, G: p.ink };
}

/** Fire colour by heat in [0, 1]: white-hot, yellow, orange, red, smoke. */
export function fireColor(s: Surface, heat: number): string {
  const pal = pixelPalette(s);
  if (heat > 0.85) return pal.W ?? '#fff';
  if (heat > 0.65) return pal.y ?? '#fff';
  if (heat > 0.4) return pal.o ?? '#fff';
  if (heat > 0.2) return pal.r ?? '#fff';
  return pal.g ?? '#888';
}

/**
 * The false-colour ramp, hottest first. NEON (spectrum on a glowing mode) uses KNOBS.CINE_FALSE_RAMP; a mono
 * palette steps through its own hot / ink / alt / dim, so the thrust head still reads as hotter than the fire
 * without leaving the mode's hue. Same rule as roleColor: DAYLIGHT (no glow) stays mono.
 * Example: falseRamp(PALETTES.PHOSPHOR, false) -> ['#B6FFB6', '#B6FFB6', '#33FF33', '#33FF33', '#0B4D0B'].
 */
export function falseRamp(p: Palette, spectrum: boolean): readonly string[] {
  if (spectrum && p.glow && KNOBS.CINE_FALSE_RAMP.length > 0) return KNOBS.CINE_FALSE_RAMP;
  return [p.hot, p.hot, p.ink, p.alt ?? p.ink, p.dim];
}

/**
 * Ramp step for heat in [0, 1] (1 = hottest = the first step); out-of-range or NaN heat clamps.
 * Example: falseStep(['A', 'B', 'C', 'D'], 1) -> 'A'; 0.6 -> 'B'; 0 -> 'D'.
 */
export function falseStep(ramp: readonly string[], heat: number): string {
  const h = Number.isFinite(heat) ? Math.max(0, Math.min(1, heat)) : 0;
  const i = Math.min(ramp.length - 1, Math.floor((1 - h) * ramp.length));
  return ramp[i] ?? ramp[0] ?? '#FFFFFF';
}

/** False colour for heat in [0, 1] under the surface's palette. */
export function falseColor(s: Surface, heat: number): string {
  return falseStep(falseRamp(s.palette, s.spectrum), heat);
}

/**
 * Draw a sprite centred on (cx, cy), cell size `cell` px, rotated by `angle` (0 = up). Rows top to bottom.
 * Example: drawSprite(s, ['.W.', 'WcW'], 100, 100, 3, 0) draws a 3 x 2 sprite of 3 px squares.
 */
export function drawSprite(s: Surface, rows: readonly string[], cx: number, cy: number, cell: number, angle: number, alpha = 1): void {
  const pal = pixelPalette(s);
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  // NOTE: a tilted grid of axis-aligned squares leaves hairline gaps; 10 % overlap closes them at fine cells.
  const size = cell * (angle === 0 ? 1.02 : 1.1);
  for (let j = 0; j < h; j++) {
    const row = rows[j] ?? '';
    for (let i = 0; i < row.length; i++) {
      const ch = row[i] ?? '.';
      if (ch === '.' || ch === ' ') continue;
      const lx = (i - (w - 1) / 2) * cell;
      const ly = (j - (h - 1) / 2) * cell;
      // angle 0 = up; rotate the local grid so the sprite's top points along the heading.
      const x = cx + lx * ca - ly * sa;
      const y = cy + lx * sa + ly * ca;
      s.dot(x, y, size, pal[ch] ?? s.palette.ink, alpha);
    }
  }
}

type Grid = string[][];

function grid(w: number, h: number): Grid {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => '.'));
}

function put(g: Grid, x: number, y: number, ch: string): void {
  const row = g[y];
  if (row && x >= 0 && x < row.length) row[x] = ch;
}

/** One row of a tube, lit from the upper left: white edge W, body w, shaded right edge g. */
function tubeRow(g: Grid, x0: number, w: number, y: number): void {
  for (let i = 0; i < w; i++) put(g, x0 + i, y, i === 0 ? 'W' : i === w - 1 ? 'g' : 'w');
}

/** Core width in cells by tier. */
function coreWidth(t: number): number {
  return t === 1 ? 5 : 7;
}

/** Interstage band positions as fractions of the core body (top to bottom), by tier. */
export function stageBands(tier: number): readonly number[] {
  return tier <= 1 ? [] : tier === 2 ? [0.42] : [0.3, 0.6];
}

/**
 * Rocket sprite for a launcher tier (1 small, 2 medium, 3 heavy with two strap-on boosters), nose at the top.
 * Tier 1 is 9 x 28 cells, tier 2 11 x 35, tier 3 17 x 40: about twice the old sprite resolution.
 */
export function rocketSprite(tier: number): string[] {
  const t = Math.max(1, Math.min(3, Math.round(tier)));
  const cw = coreWidth(t);
  const noseH = t === 1 ? 6 : 8;
  const bodyH = 14 + 5 * t;
  const side = t === 3 ? 5 : 2;
  const W = cw + 2 * side;
  const H = noseH + bodyH + 3;
  const g = grid(W, H);
  const x0 = side;
  // Nose cone: widths 1, 1, 3, 3, 5, 5 (, 7, 7); the tip catches the sun.
  for (let r = 0; r < noseH; r++) {
    const w = Math.min(cw, 1 + 2 * Math.floor(r / 2));
    const l = x0 + (cw - w) / 2;
    if (w === 1) put(g, l, r, 'W');
    else tubeRow(g, l, w, r);
  }
  for (let r = 0; r < bodyH; r++) tubeRow(g, x0, cw, noseH + r);
  // Fairing seam, a porthole on the payload, a livery stripe.
  for (let i = 1; i < cw - 1; i++) put(g, x0 + i, noseH + 1, 'k');
  put(g, x0 + (cw - 1) / 2, noseH + 3, 'c');
  for (let i = 1; i < cw - 1; i++) put(g, x0 + i, noseH + 6, 'r');
  // Interstage bands (craft colour) with a dark seam under each.
  for (const f of stageBands(t)) {
    const y = noseH + Math.round(f * bodyH);
    for (let i = 0; i < cw; i++) put(g, x0 + i, y, 'b');
    for (let i = 1; i < cw - 1; i++) put(g, x0 + i, y + 1, 'k');
  }
  // Roll marks: the black-and-white quarters a tracking camera reads the roll from.
  const ry = noseH + bodyH - 7;
  for (let i = 1; i < cw - 1; i++) {
    put(g, x0 + i, ry, i < cw / 2 ? 'k' : 'w');
    put(g, x0 + i, ry + 1, i < cw / 2 ? 'w' : 'k');
  }
  const bottom = noseH + bodyH - 1;
  if (t < 3) {
    // Fins: a five-cell root and a three-cell tip on each side.
    for (let r = 0; r < 5; r++) {
      put(g, x0 - 1, bottom - r, r === 4 ? 'w' : 'g');
      put(g, x0 + cw, bottom - r, r === 4 ? 'w' : 'g');
    }
    for (let r = 0; r < 3; r++) {
      put(g, x0 - 2, bottom - r, 'g');
      put(g, x0 + cw + 1, bottom - r, 'g');
    }
  } else {
    // Strap-on boosters, three cells wide, a cell clear of the core, with struts and their own bells.
    const by0 = noseH + Math.round(bodyH * 0.32);
    for (const bx of [x0 - 4, x0 + cw + 1]) {
      const strut = bx < x0 ? x0 - 1 : x0 + cw;
      put(g, bx + 1, by0, 'W');
      for (let y = by0 + 1; y <= bottom; y++) tubeRow(g, bx, 3, y);
      put(g, bx + 1, by0 + 4, 'r');
      put(g, strut, by0 + 6, 'k');
      put(g, strut, bottom - 3, 'k');
      put(g, bx + 1, bottom + 1, 'k');
      put(g, bx, bottom + 2, 'g');
      put(g, bx + 1, bottom + 2, 'o');
      put(g, bx + 2, bottom + 2, 'g');
    }
  }
  // Core engine bells: throat, flare, and the hot exit ring.
  for (let i = 1; i < cw - 1; i++) put(g, x0 + i, bottom + 1, 'k');
  for (let i = 0; i < cw; i++) put(g, x0 + i, bottom + 2, i === 0 || i === cw - 1 ? 'g' : 'k');
  for (let i = 0; i < cw; i++) put(g, x0 + i, bottom + 3, i % 2 === 0 ? 'o' : 'y');
  return g.map((row) => row.join(''));
}

/**
 * Nozzle exits of a tier in sprite cells from the sprite centre (x right, y down), core first.
 * Example: tier 1 (28 rows) -> [[0, 13.5]], the bottom row's centre.
 */
export function nozzles(tier: number): readonly (readonly [number, number])[] {
  const t = Math.max(1, Math.min(3, Math.round(tier)));
  const h = rocketSprite(t).length;
  const yCore = (h - 1) / 2;
  if (t < 3) return [[0, yCore]];
  // Booster bells sit one row above the core exit; their centres are 4 cells beyond the core's half width.
  const off = (coreWidth(t) - 1) / 2 + 3;
  return [[0, yCore], [-off, yCore - 1], [off, yCore - 1]];
}

/** Rocket sprites by launcher tier, built once. */
export const ROCKETS: Readonly<Record<number, readonly string[]>> = { 1: rocketSprite(1), 2: rocketSprite(2), 3: rocketSprite(3) };

/** A spent stage at the fine scale: interstage band, seam, porthole-less tube, fins and an engine bell. */
export const SPENT_STAGE: readonly string[] = ['.bbbbb.', '.Wkkkg.', '.Wwwwg.', '.Wwwwg.', '.Wkwwg.', '.Wwkwg.', '.Wwwwg.', '.Wwwwg.', 'gWwwwgg', 'gWwwwgg', '..kkk..', '.kkkkk.', '.o.y.o.'];

/** Launch tower at the fine scale: a 5-cell lattice with X bracing, `h` cells tall, a beacon, two swing arms. */
export function towerSprite(h: number): string[] {
  const L = ['ggggg', 'gg.gg', 'g.g.g', 'gg.gg'];
  const rows: string[] = ['..r..'];
  for (let j = 0; j < h; j++) rows.push(L[j % 4] ?? 'g...g');
  // Swing arms reach toward the rocket on the right.
  for (const f of [0.18, 0.55]) rows[1 + Math.floor(h * f)] = 'gggggggggg';
  const w = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => r.padEnd(w, '.'));
}
