// WHAT: PERIMETER's on-screen controls for phones and tablets: turn left and right on the left thumb, fire, pulse,
//       seeker and swarm on the right thumb, and the BACK tab top-left (ui/touchBack.ts).
// WHY:  Owner 2026-10-20: "give on screen controls to minigame if on a phone however it makes sense". The old touch
//       scheme (IDEAS 2: screen thirds, a two-finger tap to pulse) had no visible buttons and no way to fire a seeker
//       or a swarm, or to leave the screen without a keyboard.
// HOW:  Pure functions. `padLayout(W, H)` places round buttons in CSS px from the window size: two turn buttons
//       bottom-left, a large FIRE bottom-right with PULSE above it and SEEK / SWARM to its left, each radius
//       r = clamp(min(W, H) x 0.085, 26, 46). Held sideways (`landscape(W, H)`, W > 1.3 H) the screen is short, so
//       SEEK and SWARM sit above the turn buttons and PULSE beside FIRE: the right thumb's stack would otherwise run
//       up into the HUD's bars (owner 2026-10-21, "landscape mode in the minigame is a little weird"). `padHeld(points, layout)` returns the buttons under any finger (a
//       finger counts for a button within 1.25 r of its centre, so a thumb that drifts keeps holding). The screen
//       turns held buttons into the sim's Input: left / right / fire while held, pulse / seeker / swarm on the frame a
//       button becomes held (an edge, like the keys). Drawing reads the layout and the held set and touches nothing.
// LORE: G1 (how to play)

import type { Surface } from '../render/canvas';
import { drawText } from '../render/vectorFont';
import { drawBackTab, onBackTab } from '../ui/touchBack';

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
  if (landscape(W, H)) {
    return [
      { id: 'left', x: m + r * 1.1, y: by, r, label: '<' },
      { id: 'right', x: m + r * 3.5, y: by, r, label: '>' },
      { id: 'seeker', x: m + r * 1.1, y: by - r * 2.35, r, label: 'SEEK' },
      { id: 'swarm', x: m + r * 3.5, y: by - r * 2.35, r, label: 'SWARM' },
      { id: 'fire', x: fx, y: fy, r: fr, label: 'FIRE' },
      { id: 'pulse', x: fx - fr - r * 1.3, y: fy + fr - r, r, label: 'PULSE' },
    ];
  }
  return [
    { id: 'left', x: m + r * 1.1, y: by, r, label: '<' },
    { id: 'right', x: m + r * 3.5, y: by, r, label: '>' },
    { id: 'fire', x: fx, y: fy, r: fr, label: 'FIRE' },
    { id: 'pulse', x: fx, y: fy - fr - r * 1.25, r, label: 'PULSE' },
    { id: 'seeker', x: fx - fr - r * 1.3, y: fy + fr - r, r, label: 'SEEK' },
    { id: 'swarm', x: fx - fr - r * 1.15, y: fy - fr - r * 0.55, r, label: 'SWARM' },
  ];
}


/** A phone held sideways: wider than 1.3 times its height. Example: landscape(780, 360) true; landscape(390, 740) false. */
export function landscape(W: number, H: number): boolean {
  return W > H * 1.3;
}

/**
 * The buttons under any of `points`. Example: a finger on FIRE's centre holds 'fire'; one far from every button
 * holds nothing.
 */
export function padHeld(points: readonly { x: number; y: number }[], layout: readonly PadButton[]): Set<PadId> {
  const held = new Set<PadId>();
  for (const p of points) {
    if (onBackTab(p.x, p.y)) {
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
  drawBackTab(s);
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
