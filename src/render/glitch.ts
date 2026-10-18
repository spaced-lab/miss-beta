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
  if (hud) drawText(s, hud, W - 16, H - 46, 9, { align: 'right', color: s.palette.dim, glow: 0 });
}
