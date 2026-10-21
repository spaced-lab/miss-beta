// WHAT: PERIMETER's on-screen controls for phones and tablets: turn left and right on the left thumb, fire, pulse,
//       seeker and swarm on the right thumb, and a BACK button top-left.
// WHY:  Owner 2026-10-20: "give on screen controls to minigame if on a phone however it makes sense". The old touch
//       scheme (IDEAS 2: screen thirds, a two-finger tap to pulse) had no visible buttons and no way to fire a seeker
//       or a swarm, or to leave the screen without a keyboard.
// HOW:  Pure functions. `padLayout(W, H)` places round buttons in CSS px from the window size: two turn buttons
//       bottom-left, a large FIRE bottom-right with PULSE above it and SEEK / SWARM to its left, each radius
//       r = clamp(min(W, H) x 0.085, 26, 46). `padHeld(points, layout)` returns the buttons under any finger (a
//       finger counts for a button within 1.25 r of its centre, so a thumb that drifts keeps holding). The screen
//       turns held buttons into the sim's Input: left / right / fire while held, pulse / seeker / swarm on the frame a
//       button becomes held (an edge, like the keys). Drawing reads the layout and the held set and touches nothing.
// LORE: G1 (how to play)

import type { Surface } from '../render/canvas';
import { drawText } from '../render/vectorFont';

export type PadId = 'left' | 'right' | 'fire' | 'pulse' | 'seeker' | 'swarm' | 'back';

export interface PadButton {
  id: PadId;
  x: number;
  y: number;
  r: number;
  label: string;
}

/**
 * Button layout for a W x H window, CSS px.
 * Example: padLayout(390, 740): r = 33; FIRE at (390 - 16 - 1.35 r, 740 - 16 - 1.35 r).
 */
export function padLayout(W: number, H: number): PadButton[] {
  const r = Math.max(26, Math.min(46, Math.min(W, H) * 0.085));
  const m = 16;
  const by = H - m - r * 1.1;
  const fr = r * 1.35;
  const fx = W - m - fr;
  const fy = H - m - fr;
  return [
    { id: 'left', x: m + r * 1.1, y: by, r, label: '<' },
    { id: 'right', x: m + r * 3.5, y: by, r, label: '>' },
    { id: 'fire', x: fx, y: fy, r: fr, label: 'FIRE' },
    { id: 'pulse', x: fx, y: fy - fr - r * 1.25, r, label: 'PULSE' },
    { id: 'seeker', x: fx - fr - r * 1.3, y: fy + fr - r, r, label: 'SEEK' },
    { id: 'swarm', x: fx - fr - r * 1.15, y: fy - fr - r * 0.55, r, label: 'SWARM' },
  ];
}

/** The BACK button's box, CSS px (a box like the other screens' BACK, not a circle; `padHeld` reports it as 'back'). */
export const BACK_BOX = { x: 8, y: 8, w: 78, h: 34 };

/**
 * The buttons under any of `points`. Example: a finger on FIRE's centre holds 'fire'; one far from every button
 * holds nothing.
 */
export function padHeld(points: readonly { x: number; y: number }[], layout: readonly PadButton[]): Set<PadId> {
  const held = new Set<PadId>();
  for (const p of points) {
    if (p.x >= BACK_BOX.x && p.x <= BACK_BOX.x + BACK_BOX.w + 6 && p.y >= BACK_BOX.y && p.y <= BACK_BOX.y + BACK_BOX.h + 6) {
      held.add('back');
      continue;
    }
    let best: PadButton | null = null;
    let bestD = Infinity;
    for (const b of layout) {
      const d = Math.hypot(p.x - b.x, p.y - b.y) / b.r;
      if (d < 1.25 && d < bestD) {
        best = b;
        bestD = d;
      }
    }
    if (best) held.add(best.id);
  }
  return held;
}

/** Draw the pad: outlined circles, filled faintly while held. `playing` false shows only BACK (the panels). */
export function drawPad(s: Surface, layout: readonly PadButton[], held: ReadonlySet<PadId>, playing: boolean): void {
  const p = s.palette;
  const b = BACK_BOX;
  s.ctx.fillStyle = p.bg;
  s.ctx.fillRect(b.x, b.y, b.w, b.h);
  s.stroke([b.x, b.y, b.x + b.w, b.y, b.x + b.w, b.y + b.h, b.x, b.y + b.h], { closed: true, color: p.hot, glow: 1 });
  drawText(s, '< BACK', b.x + b.w / 2, b.y + b.h / 2 - 6, 12, { align: 'center', color: p.hot, glow: 0.8 });
  if (!playing) return;
  for (const btn of layout) {
    const on = held.has(btn.id);
    if (on) {
      s.ctx.globalAlpha = 0.18;
      s.ctx.fillStyle = p.ink;
      s.ctx.beginPath();
      s.ctx.arc(btn.x, btn.y, btn.r, 0, Math.PI * 2);
      s.ctx.fill();
      s.ctx.globalAlpha = 1;
    }
    s.circle(btn.x, btn.y, btn.r, { color: on ? p.hot : p.ink, glow: on ? 1.2 : 0.5, alpha: on ? 0.95 : 0.55 });
    const size = btn.label.length > 2 ? Math.min(11, (btn.r * 1.5) / btn.label.length) : 18;
    drawText(s, btn.label, btn.x, btn.y - size / 2, size, { align: 'center', color: on ? p.hot : p.ink, glow: 0.5, alpha: on ? 1 : 0.7 });
  }
}
