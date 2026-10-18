// WHAT: Pixel-art layer for the event cinematics: sprites from strings, a fire ramp, smoke, chunky debris.
// WHY:  Owner, 2026-10-18: launch and impact scenes in the PERIMETER style, "use pixel art". Vector strokes
//       carry the geometry; chunky square pixels carry fire, smoke and debris, the way the arcade games did.
// HOW:  A sprite is rows of characters; each character maps to a colour key ('.' is transparent). Pixels are
//       Surface.dot squares placed on a rotated grid, so a sprite can tilt along its flight path. Everything is
//       a pure function of (scene seed, elapsed time): `hash01` gives per-pixel noise without an Rng.
// LORE: G8 (the look)

import type { Surface } from '../canvas';

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
 * Draw a sprite centred on (cx, cy), cell size `cell` px, rotated by `angle` (0 = up). Rows top to bottom.
 * Example: drawSprite(s, ['.W.', 'WcW'], 100, 100, 3, 0) draws a 3 x 2 sprite of 3 px squares.
 */
export function drawSprite(s: Surface, rows: readonly string[], cx: number, cy: number, cell: number, angle: number, alpha = 1): void {
  const pal = pixelPalette(s);
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
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
      s.dot(x, y, cell * 1.05, pal[ch] ?? s.palette.ink, alpha);
    }
  }
}

/** Rocket sprites by launcher tier (1 small, 2 medium, 3 heavy with side boosters). Nose at the top. */
export const ROCKETS: Readonly<Record<number, readonly string[]>> = {
  1: ['..W..', '.wWw.', '.wcw.', '.www.', '.wcw.', '.www.', '.www.', '.wbw.', '.www.', 'gwwwg', 'g.k.g'],
  2: ['...W...', '..wWw..', '..wcw..', '..www..', '..wcw..', '..bbb..', '..www..', '..www..', '..www..', '..wcw..', '..www..', '..www..', '.gwwwg.', 'gg.k.gg'],
  3: ['....W....', '...wWw...', '...wcw...', '...www...', '...wcw...', '...bbb...', '.W.www.W.', '.w.www.w.', '.w.www.w.', '.w.wcw.w.', '.w.www.w.', '.w.www.w.', '.w.www.w.', 'gwgwwwgwg', 'g.g.k.g.g'],
};

/** A spent stage: a short tube with an engine bell. */
export const SPENT_STAGE: readonly string[] = ['.www.', '.www.', '.wcw.', '.www.', '.www.', 'gwwwg', '.kkk.'];

/** Launch tower: a lattice 3 cells wide, `h` cells tall, with arms. */
export function towerSprite(h: number): string[] {
  const rows: string[] = [];
  for (let j = 0; j < h; j++) rows.push(j % 3 === 0 ? 'ggg' : j % 2 === 0 ? 'g.g' : '.g.');
  rows[2] = 'gggggg';
  rows[Math.floor(h * 0.55)] = 'gggggg';
  return rows;
}
