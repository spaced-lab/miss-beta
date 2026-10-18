// WHAT: SIMULATION-mode glitch pass (GAME_PLAN 21.3): scanline tears, slices shifted sideways, a flicker,
//       and the HUD line with frame time and entity ids.
// WHY:  "HOME is inside a simulation and you have found the console." The renderer should look like it knows.
// HOW:  A post-pass over the finished frame: a few horizontal slices are copied back shifted by a few px
//       (drawImage from the canvas onto itself), with a seeded-per-frame jitter so it is cheap and never
//       reads pixels back. Reduce-motion (M8/M10) will disable it.
// LORE: G6 (modes), G8 (the look)

import type { Surface } from './canvas';
import { drawText } from './vectorFont';

export function glitchPass(s: Surface, t: number, intensity = 1, hud = ''): void {
  const ctx = s.ctx;
  const W = s.width;
  const H = s.height;
  // Deterministic jitter from time so a screenshot is reproducible for a given t.
  const seed = Math.floor(t * 7) % 1000;
  const slices = Math.floor(2 + intensity * 3);
  for (let i = 0; i < slices; i++) {
    const y = ((seed * 131 + i * 977) % H) | 0;
    const h = 2 + ((seed * 17 + i * 31) % 10);
    const dx = (((seed * 53 + i * 211) % 21) - 10) * intensity;
    if (dx === 0) continue;
    // Copy the slice sideways; the DPR transform is already applied to the context.
    ctx.drawImage(s.canvas, 0, y * s.dpr, W * s.dpr, h * s.dpr, dx, y, W, h);
  }
  // Occasional whole-frame flicker.
  if (seed % 37 === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(0, 0, W, H);
  }
  if (hud) drawText(s, hud, W - 16, H - 64, 9, { align: 'right', color: s.palette.dim, glow: 0 });
}

/**
 * SIMULATION "peel" (GAME_PLAN 30): a corner of the world curls back like wallpaper and shows the render layer
 * underneath: a debug grid and the raw state. `amount` 0..1 is how far it is peeled (0 draws nothing); `corner`
 * 0..3 picks top-left, top-right, bottom-right, bottom-left. `lines` is what is written on the layer underneath.
 * Pure function of its inputs; cheap (a clip, a grid, a few text lines, the flap outline).
 */
export function peelPass(s: Surface, amount: number, corner: number, lines: readonly string[], t: number): void {
  if (amount <= 0) return;
  const ctx = s.ctx;
  const W = s.width;
  const H = s.height;
  const L = Math.min(W, H) * (0.18 + 0.5 * amount);
  const cx = corner === 1 || corner === 2 ? W : 0;
  const cy = corner >= 2 ? H : 0;
  const sx = cx === 0 ? 1 : -1;
  const sy = cy === 0 ? 1 : -1;
  const a: [number, number] = [cx + sx * L, cy];
  const b: [number, number] = [cx, cy + sy * L];
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = s.palette.bg;
  ctx.fillRect(Math.min(cx, a[0]), Math.min(cy, b[1]), L, L);
  const grid = s.spectrum ? s.role('orbit') : s.palette.dim;
  for (let g = 0; g <= L; g += 16) {
    s.stroke([cx + sx * g, cy, cx + sx * g, cy + sy * L], { color: grid, glow: 0, alpha: 0.5 });
    s.stroke([cx, cy + sy * g, cx + sx * L, cy + sy * g], { color: grid, glow: 0, alpha: 0.5 });
  }
  let y = cy === 0 ? 12 : H - 14 - lines.length * 12;
  for (const line of lines) {
    drawText(s, line, cx === 0 ? 10 : W - 10, y, 8, { align: cx === 0 ? 'left' : 'right', color: s.spectrum ? s.role('program') : s.palette.ink, glow: 0.3 });
    y += 12;
  }
  // A blinking cursor: the layer is live.
  if (Math.floor(t * 2) % 2 === 0) drawText(s, '_', cx === 0 ? 10 : W - 16, y, 8, { color: s.palette.hot, glow: 0.5 });
  ctx.restore();
  // The flap: the peeled-back triangle folded over the diagonal, its back side drawn as an outline.
  const fold: [number, number] = [cx + sx * L * 0.82, cy + sy * L * 0.82];
  s.stroke([a[0], a[1], fold[0], fold[1], b[0], b[1]], { closed: true, color: s.palette.hot, glow: 1, alpha: 0.9 });
  s.stroke([a[0], a[1], b[0], b[1]], { color: s.palette.ink, glow: 0.4, dash: [4, 3] });
}

/** Ambient peel schedule: every 23 s a random-ish corner peels for 4 s (ease in, hold, ease back). */
export function ambientPeel(t: number): { amount: number; corner: number } {
  const cycle = 23;
  const k = Math.floor(t / cycle);
  const ph = t - k * cycle;
  if (ph > 4) return { amount: 0, corner: 0 };
  const u = ph < 1 ? ph : ph > 3 ? 4 - ph : 1;
  return { amount: 0.25 * u, corner: (k * 7) % 4 };
}
