// WHAT: Draws a MinigameState onto a Surface. Reads state, never mutates it.
// WHY:  GAME_PLAN 14: "Rendering reads state; it never mutates it." Keeping this file free of rules
//       means the look (PHOSPHOR today, SPECTRUM and HOLO later) can change without touching the game.
// HOW:  World units are planet radii with y up; the screen is CSS px with y down. One scale factor fits
//       MG.VIEW_R on the shorter axis. Neon colours unlock by spectrum stage (sim.spectrumStage): stage 0
//       is all phosphor green; 1 colours rock hardness; 2 colours bullet strength; 3 adds moon, turret
//       and particle accents. Hardness is also drawn as line width and, for cores, a double outline, so
//       the information survives without colour.
// LORE: G2 (screens and HUD), G8 (the look)

import type { Surface } from '../render/canvas';
import { withAlpha } from '../render/palettes';
import { drawText, measureText } from '../render/vectorFont';
import { MG } from './config';
import { displayTier, launcherAngleAt, moonActive, moonPosition, spectrumStage, streamDamage, strengthLevel, type MinigameState } from './sim';

export interface RenderOpts {
  debug: boolean;
  frameMs: number;
  best: number;
}

/** Neon accents (SPECTRUM-style, GAME_PLAN 24.1). Index by tier / damage. */
const NEON = {
  tier: ['#33FF33', '#FFB000', '#00F0FF', '#FF2BD6'],
  bullet: ['#B6FFB6', '#00F0FF', '#FF2BD6'],
  core: '#FF3B3B',
  moon: '#7DF9FF',
  turret: '#CCFF00',
  heat: '#FF6A00',
} as const;

const scratch: number[] = [];

function tierColor(s: Surface, tier: number, stage: number): string {
  return stage >= 1 ? (NEON.tier[tier] ?? s.palette.ink) : s.palette.ink;
}
function bulletColor(s: Surface, damage: number, stage: number): string {
  return stage >= 2 ? (NEON.bullet[damage - 1] ?? s.palette.hot) : s.palette.hot;
}

export function renderMinigame(s: Surface, st: MinigameState, opts: RenderOpts): void {
  const p = s.palette;
  const W = s.width;
  const H = s.height;
  const k = Math.min(W, H) / 2 / MG.VIEW_R;
  const sh = st.shake * k;
  const cx = W / 2 + Math.sin(st.t * 61) * sh;
  const cy = H / 2 + Math.cos(st.t * 47) * sh;
  const X = (x: number): number => cx + x * k;
  const Y = (y: number): number => cy - y * k;
  const stage = spectrumStage(st.level);

  s.clear();

  for (const r of [2, 4]) s.circle(cx, cy, r * k, { color: p.dim, glow: 0, width: 1, alpha: 0.6, dash: [4, 8] });

  // Particles.
  for (const q of st.particles) {
    const a = q.life / q.max;
    const color = q.tier < 0 ? p.hot : stage >= 3 ? tierColor(s, q.tier, stage) : a > 0.5 ? p.hot : p.ink;
    s.dot(X(q.x), Y(q.y), 2, color, a);
  }

  // Planet and continents.
  s.circle(cx, cy, MG.PLANET_R * k, { glow: 1.4, width: p.lineWidth + 0.25 });
  for (const c of st.continents) {
    scratch.length = 0;
    for (let i = 0; i < c.length; i += 2) scratch.push(X(c[i] as number), Y(c[i + 1] as number));
    s.stroke(scratch, { closed: true, glow: 0.6, alpha: 0.85, width: 1 });
  }

  // Moon: orbit ring (faint) and disc with one crater line.
  if (moonActive(st.level)) {
    const m = moonPosition(st);
    const mc = stage >= 3 ? NEON.moon : p.ink;
    s.circle(cx, cy, MG.MOON_ORBIT_R * k, { color: p.dim, glow: 0, width: 1, alpha: 0.35, dash: [2, 10] });
    s.circle(X(m.x), Y(m.y), MG.MOON_R * k, { color: mc, glow: 1.2 });
    s.stroke([X(m.x) - MG.MOON_R * k * 0.5, Y(m.y) + 2, X(m.x) + MG.MOON_R * k * 0.3, Y(m.y) + 2], { color: mc, glow: 0.4, width: 1 });
  }

  // Launchers.
  for (let i = 0; i < st.launcherCount; i++) {
    const a = launcherAngleAt(st, i);
    const base = MG.PLANET_R;
    const tip = MG.PLANET_R * 1.24;
    const half = 0.07;
    scratch.length = 0;
    scratch.push(X(base * Math.cos(a - half)), Y(base * Math.sin(a - half)), X(tip * Math.cos(a)), Y(tip * Math.sin(a)), X(base * Math.cos(a + half)), Y(base * Math.sin(a + half)));
    const hot = st.overheated ? NEON.heat : i === 0 ? p.hot : p.ink;
    s.stroke(scratch, { color: hot, glow: 1.2 });
    s.stroke([X(tip * Math.cos(a)), Y(tip * Math.sin(a)), X(1.34 * Math.cos(a)), Y(1.34 * Math.sin(a))], { color: hot, glow: 1 });
  }

  // Turrets: a small diamond on its orbit with a barrel toward the target.
  for (const tr of st.turrets) {
    const tx = X(MG.TURRET_ORBIT_R * Math.cos(tr.angle));
    const ty = Y(MG.TURRET_ORBIT_R * Math.sin(tr.angle));
    const r = 6;
    const tc = stage >= 3 ? NEON.turret : p.hot;
    s.stroke([tx, ty - r, tx + r, ty, tx, ty + r, tx - r, ty], { closed: true, color: tc, glow: 1.5, alpha: tr.life < 3 ? 0.4 + 0.6 * Math.abs(Math.sin(tr.life * 8)) : 1 });
    const target = st.asteroids.find((a) => a.id === tr.targetId);
    if (target) {
      const ang = Math.atan2(Y(target.y) - ty, X(target.x) - tx);
      s.stroke([tx, ty, tx + Math.cos(ang) * 11, ty + Math.sin(ang) * 11], { color: tc, glow: 0.8 });
    }
  }

  // Bullets: size and colour by damage.
  for (const b of st.bullets) s.dot(X(b.x), Y(b.y), 2.5 + b.damage * 0.7, bulletColor(s, b.damage, stage));

  // Asteroids: jagged polygons; width by tier, double outline for cores.
  for (const a of st.asteroids) {
    const n = a.shape.length;
    scratch.length = 0;
    for (let i = 0; i < n; i++) {
      const t = a.rot + (i / n) * Math.PI * 2;
      const rr = a.r * (a.shape[i] as number);
      scratch.push(X(a.x + rr * Math.cos(t)), Y(a.y + rr * Math.sin(t)));
    }
    const dt = displayTier(a);
    const color = a.core ? (stage >= 1 ? NEON.core : p.hot) : tierColor(s, dt, stage);
    s.stroke(scratch, { closed: true, glow: 1 + dt * 0.3, color, width: p.lineWidth + dt * 0.5, alpha: a.passing ? 0.8 : 1 });
    if (a.core) s.circle(X(a.x), Y(a.y), a.r * k * 0.45, { color, glow: 0.8, width: 1 });
  }

  // Shockwave.
  if (st.pulseR >= 0) {
    s.circle(cx, cy, st.pulseR * k, { color: p.hot, glow: 2.5, width: 2 });
    s.circle(cx, cy, st.pulseR * k * 0.92, { color: stage >= 3 ? NEON.tier[2] : p.ink, glow: 1, width: 1, alpha: 0.5 });
  }

  drawHud(s, st, opts, stage);
  if (st.status === 'ready') drawReady(s, st);
  if (st.status === 'over') drawOver(s, st, opts);
}

function pad(n: number, w: number): string {
  return String(Math.floor(n)).padStart(w, '0');
}
function clock(t: number): string {
  return `${pad(t / 60, 2)}:${pad(t % 60, 2)}`;
}

function bar(s: Surface, x: number, y: number, w: number, h: number, frac: number, color: string, glow: number): void {
  s.stroke([x, y, x + w, y, x + w, y + h, x, y + h], { closed: true, glow: 0.5 });
  const f = Math.max(0, Math.min(1, frac));
  if (f > 0) s.stroke([x + 3, y + h / 2, x + 3 + (w - 6) * f, y + h / 2], { color, width: h - 6, glow });
}

function drawHud(s: Surface, st: MinigameState, opts: RenderOpts, stage: number): void {
  const p = s.palette;
  const W = s.width;
  const H = s.height;
  const m = 16;
  const fs = 14;

  drawText(s, `SCORE ${pad(st.score, 6)}`, m, m, fs);
  drawText(s, `BEST  ${pad(opts.best, 6)}`, m, m + fs * 1.7, fs, { color: p.dim, glow: 0 });
  drawText(s, `LEVEL ${st.level}`, m, m + fs * 3.4, fs, { color: p.hot, glow: 1.2 });

  // Right column: HULL, HEAT, PULSE.
  const bw = 160;
  const bh = 12;
  const bx = W - m - bw;
  let by = m + 2;
  drawText(s, 'HULL', bx, by - fs - 6, fs);
  const hf = st.hp / MG.MAX_HP;
  bar(s, bx, by, bw, bh, hf, hf < 0.3 ? p.hot : p.ink, hf < 0.3 ? 1.5 : 0.8);

  by += bh + 28;
  drawText(s, st.overheated ? 'HEAT  OVERHEAT' : 'HEAT', bx, by - fs - 6, fs, { color: st.overheated ? NEON.heat : p.ink, glow: st.overheated ? 1.5 : 1 });
  bar(s, bx, by, bw, bh, st.heat, st.heat > 0.75 || st.overheated ? NEON.heat : p.ink, st.heat > 0.75 ? 1.5 : 0.6);

  by += bh + 28;
  drawText(s, 'PULSE', bx, by - fs - 6, fs);
  for (let i = 0; i < MG.PULSE_MAX; i++) {
    const dx = bx + 10 + i * 22;
    const dy = by + bh / 2;
    const r = 6;
    const have = i < st.pulses;
    s.stroke([dx, dy - r, dx + r, dy, dx, dy + r, dx - r, dy], { closed: true, color: have ? p.hot : p.dim, glow: have ? 1.5 : 0 });
  }
  const cbx = bx + 10 + MG.PULSE_MAX * 22 + 6;
  const cbw = bw - (cbx - bx);
  s.stroke([cbx, by + bh / 2, cbx + cbw, by + bh / 2], { color: p.dim, glow: 0 });
  if (st.pulseCharge > 0) s.stroke([cbx, by + bh / 2, cbx + cbw * Math.min(1, st.pulseCharge), by + bh / 2], { width: 4, glow: 0.8 });

  // Turret progress (only once turrets can be earned).
  if (st.level >= MG.TURRET_LEVEL) {
    by += bh + 28;
    drawText(s, `TURRET ${st.turretProgress}/${MG.TURRET_HITS}`, bx, by - fs - 6, fs, { color: stage >= 3 ? NEON.turret : p.ink });
    bar(s, bx, by, bw, bh, st.turretProgress / MG.TURRET_HITS, stage >= 3 ? NEON.turret : p.ink, 0.6);
  }

  // Stream strength ladder: one dot per stream coloured by damage.
  const bottom = H - m - fs;
  const status = `T ${clock(st.t)}   LAUNCHERS X${st.launcherCount}   STREAMS X${st.streamCount}`;
  drawText(s, status, m, bottom, fs);
  const lx = m + measureText(status, fs) + 18;
  for (let j = 0; j < st.streamCount; j++) {
    const d = streamDamage(st.streamCount, j);
    s.dot(lx + j * 12, bottom + fs / 2, 3 + d * 1.2, bulletColor(s, d, stage));
  }
  drawText(s, `STR ${strengthLevel(st.streamCount)}`, lx + st.streamCount * 12 + 8, bottom, fs, { color: p.dim, glow: 0 });
  if (st.status === 'playing') drawText(s, 'ARROWS MOVE  SPACE FIRE  ENTER PULSE', W - m, bottom, fs, { align: 'right', color: p.dim, glow: 0 });
  if (st.cheats.assisted) drawText(s, 'ASSISTED', W / 2, bottom, fs, { align: 'center', color: p.dim, glow: 0 });

  let fy = s.height / 2 - MG.PLANET_R * (Math.min(W, H) / 2 / MG.VIEW_R) - 70;
  for (const f of st.flashes) {
    const a = Math.min(1, f.t / 0.4);
    drawText(s, f.text, W / 2, fy, 22, { align: 'center', color: p.hot, glow: 2, alpha: a });
    fy -= 32;
  }

  if (opts.debug) {
    const acc = st.shots > 0 ? ((st.hits / Math.max(1, st.shots * st.launcherCount * st.streamCount)) * 100).toFixed(0) : '0';
    const lines = [
      `FRAME ${opts.frameMs.toFixed(2)} MS`,
      `AST ${st.asteroids.length}  BUL ${st.bullets.length}  PRT ${st.particles.length}  TUR ${st.turrets.length}`,
      `PRESSURE ${st.pressure.toFixed(2)}  HITS ${st.hits}  ACC ${acc}%`,
      `COLLISION ${st.collision.toUpperCase()}  CHECKS ${st.stats.collisionChecksLastStep}`,
      `GLOW ${s.glowMode.toUpperCase()}  DPR ${s.dpr}  STAGE ${stage}`,
      `SEED ${st.seed}`,
    ];
    let y = m + fs * 5.2;
    for (const l of lines) {
      drawText(s, l, m, y, 11, { color: p.dim, glow: 0 });
      y += 16;
    }
  }
}

function drawPanel(s: Surface, w: number, h: number): { x: number; y: number } {
  const x = (s.width - w) / 2;
  const y = (s.height - h) / 2;
  s.ctx.fillStyle = withAlpha(s.palette.bg, 0.72);
  s.ctx.fillRect(0, 0, s.width, s.height);
  s.stroke([x, y, x + w, y, x + w, y + h, x, y + h], { closed: true, glow: 1.2 });
  return { x, y };
}

function drawReady(s: Surface, st: MinigameState): void {
  const { y } = drawPanel(s, Math.min(600, s.width - 32), 340);
  const cx = s.width / 2;
  drawText(s, 'PERIMETER', cx, y + 26, 34, { align: 'center', glow: 2, color: s.palette.hot });
  drawText(s, 'BETA ARCADE MODE', cx, y + 74, 13, { align: 'center', color: s.palette.dim, glow: 0 });
  drawText(s, 'ROCKS ARE INBOUND. KEEP THE HULL ABOVE ZERO.', cx, y + 100, 12, { align: 'center' });
  const rows: Array<[string, string]> = [
    ['LEFT / RIGHT  OR  A / D', 'MOVE THE LAUNCHER'],
    ['SPACE', 'FIRE (WATCH THE HEAT)'],
    ['ENTER OR SHIFT', 'PULSE (CLEARS THE FIELD)'],
  ];
  let ly = y + 128;
  for (const [key, what] of rows) {
    drawText(s, key, cx - 250, ly, 12, { color: s.palette.hot, glow: 1 });
    drawText(s, what, cx + 10, ly, 12);
    ly += 22;
  }
  const notes = [
    'LEVELS RAISE STREAMS, LAUNCHERS AND ROCK HARDNESS.',
    'HARDER ROCKS CHANGE COLOUR AS THEY WEAKEN. SHOTS NUDGE ROCKS.',
    'A MOON ARRIVES AT LEVEL 3. TURRETS ARE EARNED FROM LEVEL 6.',
  ];
  for (const n of notes) {
    drawText(s, n, cx, ly + 4, 11, { align: 'center', color: s.palette.dim, glow: 0 });
    ly += 18;
  }
  const blink = Math.floor(performance.now() / 500) % 2 === 0;
  if (blink) drawText(s, 'PRESS SPACE TO START', cx, y + 278, 16, { align: 'center', color: s.palette.hot, glow: 1.5 });
  drawText(s, `ESC TITLE    1 DEBUG    2 GLOW    3 COLLISION    SEED ${st.seed}`, cx, y + 312, 10, { align: 'center', color: s.palette.dim, glow: 0 });
}

function drawOver(s: Surface, st: MinigameState, opts: RenderOpts): void {
  const { y } = drawPanel(s, Math.min(480, s.width - 32), 250);
  const cx = s.width / 2;
  drawText(s, 'HOME LOST', cx, y + 28, 34, { align: 'center', glow: 2, color: s.palette.hot });
  drawText(s, `SCORE ${st.score}`, cx, y + 86, 18, { align: 'center' });
  const isBest = st.score >= opts.best && !st.cheats.assisted && st.score > 0;
  drawText(s, isBest ? 'NEW BEST' : `BEST ${opts.best}`, cx, y + 116, 14, { align: 'center', color: isBest ? s.palette.hot : s.palette.dim, glow: isBest ? 1.5 : 0 });
  drawText(s, `LEVEL ${st.level}   SURVIVED ${clock(st.t)}   ROCKS ${st.kills}`, cx, y + 146, 13, { align: 'center' });
  if (st.cheats.assisted) drawText(s, 'ASSISTED RUN: NOT SAVED', cx, y + 172, 11, { align: 'center', color: s.palette.dim, glow: 0 });
  drawText(s, 'SPACE RETRY    ESC TITLE', cx, y + 212, 14, { align: 'center', color: s.palette.hot, glow: 1.5 });
}
