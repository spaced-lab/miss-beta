// WHAT: Draws a MinigameState onto a Surface. Reads state, never mutates it.
// WHY:  GAME_PLAN 14: "Rendering reads state; it never mutates it." Keeping this file free of rules
//       means the look (PHOSPHOR today, SPECTRUM and HOLO later) can change without touching the game.
// HOW:  World units are planet radii with y up; the screen is CSS px with y down. One scale factor fits
//       MG.VIEW_R on the shorter axis. Order back to front: range rings, particles, planet, launchers,
//       bullets, asteroids, pulse ring, HUD, overlays.
// LORE: G2 (screens and HUD), G8 (the look)

import type { Surface } from '../render/canvas';
import { withAlpha } from '../render/palettes';
import { drawText } from '../render/vectorFont';
import { MG } from './config';
import { launcherAngleAt, type MinigameState } from './sim';

export interface RenderOpts {
  debug: boolean;
  frameMs: number;
  best: number;
}

const scratch: number[] = [];

export function renderMinigame(s: Surface, st: MinigameState, opts: RenderOpts): void {
  const p = s.palette;
  const W = s.width;
  const H = s.height;
  const k = Math.min(W, H) / 2 / MG.VIEW_R;
  // Camera shake: a deterministic wobble from state.shake and time.
  const sh = st.shake * k;
  const cx = W / 2 + Math.sin(st.t * 61) * sh;
  const cy = H / 2 + Math.cos(st.t * 47) * sh;
  const X = (x: number): number => cx + x * k;
  const Y = (y: number): number => cy - y * k;

  s.clear();

  // Range rings for depth.
  for (const r of [2, 4]) s.circle(cx, cy, r * k, { color: p.dim, glow: 0, width: 1, alpha: 0.6, dash: [4, 8] });

  // Particles: fading pixels.
  for (const q of st.particles) {
    const a = q.life / q.max;
    s.dot(X(q.x), Y(q.y), 2, a > 0.5 ? p.hot : p.ink, a);
  }

  // Planet and continents.
  s.circle(cx, cy, MG.PLANET_R * k, { glow: 1.4, width: p.lineWidth + 0.25 });
  for (const c of st.continents) {
    scratch.length = 0;
    for (let i = 0; i < c.length; i += 2) scratch.push(X(c[i] as number), Y(c[i + 1] as number));
    s.stroke(scratch, { closed: true, glow: 0.6, alpha: 0.85, width: 1 });
  }

  // Launchers: a chevron riding the limb with a short barrel.
  for (let i = 0; i < st.launcherCount; i++) {
    const a = launcherAngleAt(st, i);
    const base = MG.PLANET_R * 1.0;
    const tip = MG.PLANET_R * 1.24;
    const half = 0.07;
    scratch.length = 0;
    scratch.push(
      X(base * Math.cos(a - half)), Y(base * Math.sin(a - half)),
      X(tip * Math.cos(a)), Y(tip * Math.sin(a)),
      X(base * Math.cos(a + half)), Y(base * Math.sin(a + half)),
    );
    s.stroke(scratch, { color: i === 0 ? p.hot : p.ink, glow: 1.2 });
    s.stroke([X(tip * Math.cos(a)), Y(tip * Math.sin(a)), X(1.34 * Math.cos(a)), Y(1.34 * Math.sin(a))], { color: p.hot, glow: 1 });
  }

  // Bullets: pixels.
  for (const b of st.bullets) s.dot(X(b.x), Y(b.y), 3, p.hot);

  // Asteroids: jagged polygons.
  for (const a of st.asteroids) {
    const n = a.shape.length;
    scratch.length = 0;
    for (let i = 0; i < n; i++) {
      const t = a.rot + (i / n) * Math.PI * 2;
      const rr = a.r * (a.shape[i] as number);
      scratch.push(X(a.x + rr * Math.cos(t)), Y(a.y + rr * Math.sin(t)));
    }
    s.stroke(scratch, { closed: true, glow: 1 });
  }

  // Shockwave.
  if (st.pulseR >= 0) {
    s.circle(cx, cy, st.pulseR * k, { color: p.hot, glow: 2.5, width: 2 });
    s.circle(cx, cy, st.pulseR * k * 0.92, { color: p.ink, glow: 1, width: 1, alpha: 0.5 });
  }

  drawHud(s, st, opts);

  if (st.status === 'ready') drawReady(s, st);
  if (st.status === 'over') drawOver(s, st, opts);
}

function pad(n: number, w: number): string {
  return String(Math.floor(n)).padStart(w, '0');
}

function clock(t: number): string {
  const m = Math.floor(t / 60);
  const sec = Math.floor(t % 60);
  return `${pad(m, 2)}:${pad(sec, 2)}`;
}

function drawHud(s: Surface, st: MinigameState, opts: RenderOpts): void {
  const p = s.palette;
  const W = s.width;
  const H = s.height;
  const m = 16;
  const fs = 14;

  drawText(s, `SCORE ${pad(st.score, 6)}`, m, m, fs);
  drawText(s, `BEST  ${pad(opts.best, 6)}`, m, m + fs * 1.7, fs, { color: p.dim, glow: 0 });

  // Hull bar: outline plus a thick inner line proportional to hp.
  const bw = 160;
  const bh = 12;
  const bx = W - m - bw;
  const by = m + 2;
  drawText(s, 'HULL', bx, by - fs - 6, fs);
  s.stroke([bx, by, bx + bw, by, bx + bw, by + bh, bx, by + bh], { closed: true, glow: 0.5 });
  const frac = Math.max(0, st.hp / MG.MAX_HP);
  if (frac > 0) {
    const color = frac < 0.3 ? p.hot : p.ink;
    s.stroke([bx + 3, by + bh / 2, bx + 3 + (bw - 6) * frac, by + bh / 2], { color, width: bh - 6, glow: frac < 0.3 ? 1.5 : 0.8 });
  }

  // Pulses: stock diamonds and a charge bar.
  const py = by + bh + 14;
  drawText(s, 'PULSE', bx, py, fs);
  for (let i = 0; i < MG.PULSE_MAX; i++) {
    const dx = bx + 62 + i * 22;
    const dy = py + fs / 2;
    const r = 6;
    const have = i < st.pulses;
    s.stroke([dx, dy - r, dx + r, dy, dx, dy + r, dx - r, dy], { closed: true, color: have ? p.hot : p.dim, glow: have ? 1.5 : 0 });
  }
  const cbx = bx + 62 + MG.PULSE_MAX * 22;
  const cbw = bw - (cbx - bx);
  s.stroke([cbx, py + fs / 2, cbx + cbw, py + fs / 2], { color: p.dim, glow: 0 });
  if (st.pulseCharge > 0) s.stroke([cbx, py + fs / 2, cbx + cbw * Math.min(1, st.pulseCharge), py + fs / 2], { width: 4, glow: 0.8 });

  // Bottom line.
  const bottom = H - m - fs;
  drawText(s, `T ${clock(st.t)}   LAUNCHERS X${st.launcherCount}   STREAMS X${st.streamCount}`, m, bottom, fs);
  if (st.status === 'playing') {
    drawText(s, 'ARROWS MOVE  SPACE FIRE  ENTER PULSE', W - m, bottom, fs, { align: 'right', color: p.dim, glow: 0 });
  }
  if (st.cheats.assisted) drawText(s, 'ASSISTED', W / 2, bottom, fs, { align: 'center', color: p.dim, glow: 0 });

  // Flash messages above the planet.
  let fy = s.height / 2 - MG.PLANET_R * (Math.min(W, H) / 2 / MG.VIEW_R) - 70;
  for (const f of st.flashes) {
    const a = Math.min(1, f.t / 0.4);
    drawText(s, f.text, W / 2, fy, 22, { align: 'center', color: p.hot, glow: 2, alpha: a });
    fy -= 32;
  }

  if (opts.debug) {
    const lines = [
      `FRAME ${opts.frameMs.toFixed(2)} MS`,
      `AST ${st.asteroids.length}  BUL ${st.bullets.length}  PRT ${st.particles.length}`,
      `COLLISION ${st.collision.toUpperCase()}  CHECKS ${st.stats.collisionChecksLastStep}`,
      `GLOW ${s.glowMode.toUpperCase()}  DPR ${s.dpr}`,
      `SEED ${st.seed}`,
    ];
    let y = m + fs * 3.6;
    for (const l of lines) {
      drawText(s, l, m, y, 11, { color: p.dim, glow: 0 });
      y += 16;
    }
  }
}

function drawPanel(s: Surface, w: number, h: number): { x: number; y: number } {
  const x = (s.width - w) / 2;
  const y = (s.height - h) / 2;
  // Dim the field behind the panel with the one permitted "fill": the background colour at low alpha.
  s.ctx.fillStyle = withAlpha(s.palette.bg, 0.72);
  s.ctx.fillRect(0, 0, s.width, s.height);
  s.stroke([x, y, x + w, y, x + w, y + h, x, y + h], { closed: true, glow: 1.2 });
  return { x, y };
}

function drawReady(s: Surface, st: MinigameState): void {
  const { y } = drawPanel(s, Math.min(560, s.width - 32), 300);
  const cx = s.width / 2;
  drawText(s, 'PERIMETER', cx, y + 28, 34, { align: 'center', glow: 2, color: s.palette.hot });
  drawText(s, 'BETA ARCADE MODE', cx, y + 76, 13, { align: 'center', color: s.palette.dim, glow: 0 });
  const lines = [
    'ROCKS ARE INBOUND. KEEP THE HULL ABOVE ZERO.',
    'LEFT / RIGHT  OR  A / D   MOVE THE LAUNCHER',
    'SPACE                      FIRE',
    'ENTER OR SHIFT             PULSE (CLEARS THE FIELD)',
    'LAUNCHERS AND STREAMS MULTIPLY AS TIME GOES ON.',
  ];
  let ly = y + 110;
  for (const l of lines) {
    drawText(s, l, cx, ly, 12, { align: 'center' });
    ly += 22;
  }
  const blink = Math.floor(performance.now() / 500) % 2 === 0;
  if (blink) drawText(s, 'PRESS SPACE TO START', cx, y + 240, 16, { align: 'center', color: s.palette.hot, glow: 1.5 });
  drawText(s, `ESC TITLE    B DEBUG    G GLOW    C COLLISION    SEED ${st.seed}`, cx, y + 272, 10, { align: 'center', color: s.palette.dim, glow: 0 });
}

function drawOver(s: Surface, st: MinigameState, opts: RenderOpts): void {
  const { y } = drawPanel(s, Math.min(480, s.width - 32), 230);
  const cx = s.width / 2;
  drawText(s, 'HOME LOST', cx, y + 28, 34, { align: 'center', glow: 2, color: s.palette.hot });
  drawText(s, `SCORE ${st.score}`, cx, y + 86, 18, { align: 'center' });
  const isBest = st.score >= opts.best && !st.cheats.assisted && st.score > 0;
  drawText(s, isBest ? 'NEW BEST' : `BEST ${opts.best}`, cx, y + 116, 14, { align: 'center', color: isBest ? s.palette.hot : s.palette.dim, glow: isBest ? 1.5 : 0 });
  drawText(s, `SURVIVED ${clock(st.t)}   ROCKS ${st.kills}`, cx, y + 146, 13, { align: 'center' });
  if (st.cheats.assisted) drawText(s, 'ASSISTED RUN: NOT SAVED', cx, y + 170, 11, { align: 'center', color: s.palette.dim, glow: 0 });
  drawText(s, 'SPACE RETRY    ESC TITLE', cx, y + 198, 14, { align: 'center', color: s.palette.hot, glow: 1.5 });
}
