// WHAT: Draws a MinigameState onto a Surface. Reads state, never mutates it.
// WHY:  GAME_PLAN 14: "Rendering reads state; it never mutates it." Keeping this file free of rules
//       means the look (PHOSPHOR today, SPECTRUM and HOLO later) can change without touching the game.
// HOW:  World units are planet radii with y up; the screen is CSS px with y down. One scale factor fits
//       MG.VIEW_R on the shorter axis. Neon colours unlock by spectrum stage (sim.spectrumStage): stage 0
//       is all phosphor green; 1 colours rock hardness; 2 colours bullet strength; 3 adds moon, turret
//       and particle accents. Hardness is also drawn as line width and, for cores, a double outline, so
//       the information survives without colour. All pixel sizes come from the PX table below: the look is
//       fine on purpose (1 px dust and sentry shots, sub-pixel outlines that sharpen at DPR 2).
// LORE: G2 (screens and HUD), G8 (the look)

import type { StrokeStyle, Surface } from '../render/canvas';
import { withAlpha } from '../render/palettes';
import { drawText, measureText } from '../render/vectorFont';
import { MG } from './config';
import { displayTier, laserArmed, laserStage, launcherAngleAt, moonActive, moonAlive, moonPosition, spectrumStage, streamDamage, strengthLevel, turretPosition, type MinigameState, type SentryKind } from './sim';

export interface RenderOpts {
  debug: boolean;
  frameMs: number;
  best: number;
  /** e.g. "SND ON  KIT DELICATE" */
  sound: string;
  /** A saved game is waiting on the ready panel: its headline numbers, or null. */
  resume?: { level: number; score: number; t: number } | null;
}

/** Neon accents (SPECTRUM-style, GAME_PLAN 24.1). Index by tier / damage. */
const NEON = {
  tier: ['#33FF33', '#FFB000', '#00F0FF', '#FF2BD6'],
  bullet: ['#B6FFB6', '#00F0FF', '#FF2BD6'],
  core: '#FF3B3B',
  moon: '#7DF9FF',
  turret: ['#CCFF00', '#00F0FF', '#FF2BD6'],
  heat: '#FF6A00',
} as const;

/**
 * Pixel sizes. Everything is deliberately fine (owner's note, 2026-10-17: "all detail gets finer"):
 * sentry bullets are single pixels, player bullets barely bigger, dust is 1 px, outlines are sub-pixel at
 * DPR 1 and crisp at DPR 2. Hardness still reads through colour and the width ladder (ROCK_W + tier * ROCK_W_STEP).
 */
const PX = {
  particle: 1,
  autoBullet: 1,
  /** Player bullet: base + damage * step (1.3, 1.6, 1.9 px for damage 1..3). */
  bullet: 1.0,
  bulletStep: 0.3,
  rockW: 0.55,
  rockWStep: 0.22,
  coreRing: 0.5,
  moonW: 0.75,
  moonDetail: 0.5,
  sentryW: 0.7,
  sentryDetail: 0.5,
  sentryBarrel: 0.8,
  continentW: 0.7,
} as const;

const scratch: number[] = [];

/** Push a point rotated by `rot` about (cx, cy) onto `scratch`. */
function pt(cx: number, cy: number, dx: number, dy: number, rot: number): void {
  const c = Math.cos(rot);
  const si = Math.sin(rot);
  scratch.push(cx + dx * c - dy * si, cy + dx * si + dy * c);
}

/**
 * Sentry silhouettes, radius r px, `facing` is the screen angle the shape points along:
 *   orbiter  slowly turning hexagon with an inner ring;
 *   sweeper  chevron, apex forward, with a short tail bar;
 *   picket   a bar across the facing with a dish (half ring) opening forward;
 *   chaser   two triangles nose to tail along the facing.
 */
function drawSentry(s: Surface, kind: SentryKind, cx: number, cy: number, r: number, facing: number, t: number, style: StrokeStyle): void {
  const detail = { ...style, glow: 0.6, width: PX.sentryDetail };
  scratch.length = 0;
  switch (kind) {
    case 'orbiter':
      for (let i = 0; i < 6; i++) {
        const a = t * 0.8 + (i / 6) * Math.PI * 2;
        scratch.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      s.stroke(scratch, { ...style, closed: true });
      s.circle(cx, cy, r * 0.45, detail);
      break;
    case 'sweeper':
      pt(cx, cy, -r * 0.6, -r, facing);
      pt(cx, cy, r, 0, facing);
      pt(cx, cy, -r * 0.6, r, facing);
      pt(cx, cy, -r * 0.2, 0, facing);
      s.stroke(scratch, { ...style, closed: true });
      scratch.length = 0;
      pt(cx, cy, -r * 0.9, -r * 0.45, facing);
      pt(cx, cy, -r * 0.9, r * 0.45, facing);
      s.stroke(scratch, detail);
      break;
    case 'picket':
      pt(cx, cy, -r * 0.3, -r, facing);
      pt(cx, cy, -r * 0.3, r, facing);
      s.stroke(scratch, style);
      scratch.length = 0;
      pt(cx, cy, -r * 0.3, 0, facing);
      pt(cx, cy, r * 0.3, 0, facing);
      s.stroke(scratch, detail);
      scratch.length = 0;
      for (let i = 0; i <= 8; i++) {
        const a = -Math.PI / 2 + (i / 8) * Math.PI;
        pt(cx, cy, r * 0.3 + Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7, facing);
      }
      s.stroke(scratch, style);
      break;
    case 'chaser':
      pt(cx, cy, r, 0, facing);
      pt(cx, cy, 0, -r * 0.55, facing);
      pt(cx, cy, 0, r * 0.55, facing);
      s.stroke(scratch, { ...style, closed: true });
      scratch.length = 0;
      pt(cx, cy, -r * 0.1, 0, facing);
      pt(cx, cy, -r, -r * 0.45, facing);
      pt(cx, cy, -r, r * 0.45, facing);
      s.stroke(scratch, { ...detail, closed: true });
      break;
  }
}

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
    s.dot(X(q.x), Y(q.y), PX.particle, color, a);
  }

  // Planet and continents.
  s.circle(cx, cy, MG.PLANET_R * k, { glow: 1.4, width: p.lineWidth + 0.25 });
  for (const c of st.continents) {
    scratch.length = 0;
    for (let i = 0; i < c.length; i += 2) scratch.push(X(c[i] as number), Y(c[i + 1] as number));
    s.stroke(scratch, { closed: true, glow: 0.6, alpha: 0.85, width: PX.continentW });
  }

  // Moon: faint orbit ring, disc, craters fixed to its face (tidally locked), cracks as it wears.
  if (moonActive(st.level)) {
    s.circle(cx, cy, MG.MOON_ORBIT_R * k, { color: p.dim, glow: 0, width: 1, alpha: 0.3, dash: [2, 10] });
    if (moonAlive(st)) {
      const m = moonPosition(st);
      const mc = stage >= 3 ? NEON.moon : p.ink;
      const mr = MG.MOON_R * k;
      const wear = 1 - st.moonHp / MG.MOON_HP;
      s.circle(X(m.x), Y(m.y), mr, { color: mc, glow: 1.2, alpha: 1 - 0.3 * wear, width: PX.moonW });
      const ca = Math.cos(st.moonAngle);
      const sa = Math.sin(st.moonAngle);
      for (const [dx, dy, cr] of st.craters) {
        const rx = dx * ca - dy * sa;
        const ry = dx * sa + dy * ca;
        s.circle(X(m.x + rx * MG.MOON_R), Y(m.y + ry * MG.MOON_R), cr * mr, { color: mc, glow: 0.3, width: PX.moonDetail, alpha: 0.8 });
      }
      // Cracks: one jagged line per 25% lost.
      const cracks = Math.floor(wear * 4);
      for (let c = 0; c < cracks; c++) {
        const a0 = st.moonAngle + c * 1.9;
        scratch.length = 0;
        for (let i = 0; i <= 4; i++) {
          const rr = (i / 4) * mr * 0.9;
          const aa = a0 + Math.sin(i * 2.3 + c) * 0.5;
          scratch.push(X(m.x) + Math.cos(aa) * rr, Y(m.y) + Math.sin(aa) * rr);
        }
        s.stroke(scratch, { color: mc, glow: 0.2, width: PX.moonDetail, alpha: 0.9 });
      }
    }
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

  // Sentries: one vector shape per archetype (drawSentry), a barrel toward the target, a life arc;
  // colour by tier, SUPER cycles hue.
  for (const tr of st.turrets) {
    const pos = turretPosition(tr);
    const tx = X(pos.x);
    const ty = Y(pos.y);
    const r = tr.superb ? 9 : 7;
    const tc = tr.superb ? `hsl(${Math.floor((st.t * 140) % 360)}, 100%, 65%)` : stage >= 3 ? (NEON.turret[tr.tier] ?? p.hot) : p.hot;
    const fading = tr.life < 3 ? 0.4 + 0.6 * Math.abs(Math.sin(tr.life * 8)) : 1;
    const target = st.asteroids.find((a) => a.id === tr.targetId);
    // Facing on screen (y down): outward along the radial, or at the target for the chaser.
    const outward = -tr.angle;
    const facing = tr.kind === 'chaser' && target ? Math.atan2(Y(target.y) - ty, X(target.x) - tx) : outward;
    drawSentry(s, tr.kind, tx, ty, r, facing, st.t, { color: tc, glow: tr.superb ? 2 : 1.4, alpha: fading, width: PX.sentryW });
    if (target) {
      const ang = Math.atan2(Y(target.y) - ty, X(target.x) - tx);
      s.stroke([tx + Math.cos(ang) * r * 0.5, ty + Math.sin(ang) * r * 0.5, tx + Math.cos(ang) * (r + 7), ty + Math.sin(ang) * (r + 7)], { color: tc, glow: 0.8, width: tr.superb ? PX.sentryBarrel * 1.6 : PX.sentryBarrel });
    }
    // Life arc.
    const frac = tr.life / tr.maxLife;
    scratch.length = 0;
    for (let i = 0; i <= 16; i++) {
      const a = -Math.PI / 2 + (i / 16) * Math.PI * 2 * frac;
      scratch.push(tx + Math.cos(a) * (r + 3), ty + Math.sin(a) * (r + 3));
    }
    if (scratch.length >= 4) s.stroke(scratch, { color: tc, glow: 0, width: PX.sentryDetail, alpha: 0.5 });
  }

  // Bullets: sentry shots are single pixels; player shots size by damage, colour by damage.
  for (const b of st.bullets) s.dot(X(b.x), Y(b.y), b.auto ? PX.autoBullet : PX.bullet + b.damage * PX.bulletStep, bulletColor(s, b.damage, stage));

  // Seekers: a small dart along the velocity with a short fading exhaust trail.
  for (const sk of st.seekers) {
    const sc = stage >= 2 ? NEON.bullet[2] : p.hot;
    if (sk.trail.length >= 4) {
      scratch.length = 0;
      for (let i = 0; i < sk.trail.length; i += 2) scratch.push(X(sk.trail[i] as number), Y(sk.trail[i + 1] as number));
      scratch.push(X(sk.x), Y(sk.y));
      s.stroke(scratch, { color: sc, width: PX.sentryDetail, glow: 0.4, alpha: 0.45 });
    }
    const facing = Math.atan2(-sk.vy, sk.vx);
    const dx = X(sk.x);
    const dy = Y(sk.y);
    scratch.length = 0;
    pt(dx, dy, 5, 0, facing);
    pt(dx, dy, -3, -2, facing);
    pt(dx, dy, -1.5, 0, facing);
    pt(dx, dy, -3, 2, facing);
    s.stroke(scratch, { closed: true, color: sc, width: PX.sentryW, glow: 1.4 });
    s.dot(dx - Math.cos(facing) * 4, dy - Math.sin(facing) * 4, 1, p.hot, 0.6 + 0.4 * Math.abs(Math.sin(st.t * 60)));
  }

  // Sentinel drones: a tiny three-fin mark along the velocity, blinking in the last second.
  for (const d of st.drones) {
    const dc = stage >= 3 ? NEON.turret[0] : p.ink;
    const blink = d.life < 1 ? 0.3 + 0.7 * Math.abs(Math.sin(d.life * 20)) : 1;
    const facing = Math.atan2(-d.vy, d.vx);
    const dx = X(d.x);
    const dy = Y(d.y);
    scratch.length = 0;
    pt(dx, dy, 3, 0, facing);
    pt(dx, dy, 0, 0, facing);
    pt(dx, dy, -2.2, -2.2, facing);
    pt(dx, dy, 0, 0, facing);
    pt(dx, dy, -2.2, 2.2, facing);
    s.stroke(scratch, { color: dc, width: PX.sentryDetail, glow: 0.8, alpha: blink });
    s.dot(dx, dy, 1, dc, blink);
  }

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
    s.stroke(scratch, { closed: true, glow: 0.7 + dt * 0.25, color, width: PX.rockW + dt * PX.rockWStep, alpha: a.passing ? 0.8 : 1 });
    if (a.core) s.circle(X(a.x), Y(a.y), a.r * k * 0.45, { color, glow: 0.6, width: PX.coreRing });
  }

  // Laser beams: a bright core line and a wider faint one, fading.
  for (const b of st.beams) {
    const a = b.t / MG.BEAM_FADE;
    const x0 = X(1.28 * Math.cos(b.angle));
    const y0 = Y(1.28 * Math.sin(b.angle));
    const x1 = X(MG.LASER_RANGE * Math.cos(b.angle));
    const y1 = Y(MG.LASER_RANGE * Math.sin(b.angle));
    const lc = stage >= 2 ? NEON.bullet[2] : p.hot;
    s.stroke([x0, y0, x1, y1], { color: lc, width: 6, alpha: a * 0.25, glow: 0 });
    s.stroke([x0, y0, x1, y1], { color: p.hot, width: 1.5, alpha: a, glow: 2 });
  }

  // Shockwave.
  if (st.pulseR >= 0) {
    s.circle(cx, cy, st.pulseR * k, { color: p.hot, glow: 2.5, width: 2 });
    s.circle(cx, cy, st.pulseR * k * 0.92, { color: stage >= 3 ? NEON.tier[2] : p.ink, glow: 1, width: 1, alpha: 0.5 });
  }

  drawHud(s, st, opts, stage);
  if (st.status === 'ready') drawReady(s, st, opts);
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

/** An earned-weapon row: label, `max` stock diamonds (lit up to `have`), and a 0..1 charge bar after them. */
function stockRow(s: Surface, bx: number, by: number, bw: number, bh: number, fs: number, label: string, have: number, max: number, charge: number, color: string): void {
  const p = s.palette;
  drawText(s, label, bx, by - fs - 6, fs);
  for (let i = 0; i < max; i++) {
    const dx = bx + 10 + i * 22;
    const dy = by + bh / 2;
    const r = 6;
    const lit = i < have;
    s.stroke([dx, dy - r, dx + r, dy, dx, dy + r, dx - r, dy], { closed: true, color: lit ? color : p.dim, glow: lit ? 1.5 : 0 });
  }
  const cbx = bx + 10 + max * 22 + 6;
  const cbw = bw - (cbx - bx);
  s.stroke([cbx, by + bh / 2, cbx + cbw, by + bh / 2], { color: p.dim, glow: 0 });
  if (charge > 0) s.stroke([cbx, by + bh / 2, cbx + cbw * Math.min(1, charge), by + bh / 2], { width: 4, glow: 0.8 });
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

  if (laserStage(st.streamCount) > 0) {
    const armed = laserArmed(st);
    drawText(s, armed ? 'LASER READY' : 'LASER', bx + bw, by - fs - 6, 11, { align: 'right', color: armed ? (stage >= 2 ? NEON.bullet[2] : p.hot) : p.dim, glow: armed ? 1.5 : 0 });
  }

  // Earned weapons: stock diamonds plus a charge bar, one row each.
  by += bh + 28;
  stockRow(s, bx, by, bw, bh, fs, 'PULSE', st.pulses, MG.PULSE_MAX, st.pulseCharge, p.hot);
  by += bh + 28;
  stockRow(s, bx, by, bw, bh, fs, 'SEEKER  <', st.seekerStock, MG.SEEKER_MAX, st.seekerProgress / MG.SEEKER_HITS, stage >= 2 ? NEON.bullet[2] : p.hot);
  by += bh + 28;
  stockRow(s, bx, by, bw, bh, fs, 'SWARM  >', st.swarmStock, MG.SWARM_MAX, st.swarmProgress / MG.SWARM_KILLS, stage >= 3 ? NEON.turret[0] : p.hot);

  // Turret progress (only once turrets can be earned).
  if (st.level >= MG.TURRET_LEVEL) {
    by += bh + 28;
    drawText(s, `SENTRY ${st.turretProgress}/${MG.TURRET_HITS}`, bx, by - fs - 6, fs, { color: stage >= 3 ? NEON.turret[0] : p.ink });
    bar(s, bx, by, bw, bh, st.turretProgress / MG.TURRET_HITS, stage >= 3 ? NEON.turret[0] : p.ink, 0.6);
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
  if (st.status === 'playing') drawText(s, '<ARROWS> MOVE  <SPACE> FIRE  <SHIFT> PULSE  < SEEKER  > SWARM', W - m, bottom, fs, { align: 'right', color: p.dim, glow: 0 });
  drawText(s, opts.sound, W - m, bottom - fs * 1.5, 11, { align: 'right', color: p.dim, glow: 0 });
  if (st.cheats.assisted) drawText(s, 'ASSISTED', m, m + fs * 5.1, 11, { color: p.dim, glow: 0 });

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
      `AST ${st.asteroids.length}  BUL ${st.bullets.length}  PRT ${st.particles.length}  TUR ${st.turrets.length}  SKR ${st.seekers.length}  DRN ${st.drones.length}`,
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

function drawReady(s: Surface, st: MinigameState, opts: RenderOpts): void {
  const { y } = drawPanel(s, Math.min(600, s.width - 32), 400);
  const cx = s.width / 2;
  drawText(s, 'PERIMETER', cx, y + 26, 34, { align: 'center', glow: 2, color: s.palette.hot });
  drawText(s, 'BETA ARCADE MODE', cx, y + 74, 13, { align: 'center', color: s.palette.dim, glow: 0 });
  drawText(s, 'ROCKS ARE INBOUND. KEEP THE HULL ABOVE ZERO.', cx, y + 100, 12, { align: 'center' });
  const rows: Array<[string, string]> = [
    ['<LEFT> <RIGHT>  (OR A / D)', 'MOVE THE LAUNCHER'],
    ['<SPACE>', 'FIRE  (WATCH THE HEAT)'],
    ['<SHIFT>', 'PULSE  (CLEARS THE FIELD, EARNED PER 14 KILLS)'],
    ['<  (COMMA)', 'SEEKER MISSILE  (HOMES AND BLASTS, PER 35 HITS)'],
    ['>  (PERIOD)', 'SWARM OF SENTINELS  (5-8 DRONES, PER 22 KILLS)'],
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
    'A MOON ARRIVES AT LEVEL 3. SENTRIES ARE EARNED FROM LEVEL 6.',
    'FROM 3 STREAMS, THE FIRST SHOT AFTER A BREAK IS A LASER PULSE.',
  ];
  for (const n of notes) {
    drawText(s, n, cx, ly + 4, 11, { align: 'center', color: s.palette.dim, glow: 0 });
    ly += 18;
  }
  const blink = Math.floor(performance.now() / 500) % 2 === 0;
  const r = opts.resume;
  if (r) {
    drawText(s, `SAVED GAME: LEVEL ${r.level}   SCORE ${r.score}   ${clock(r.t)}`, cx, y + 320, 11, { align: 'center', color: s.palette.dim, glow: 0 });
    if (blink) drawText(s, '<SPACE> RESUME     <BACKSPACE> NEW GAME', cx, y + 340, 16, { align: 'center', color: s.palette.hot, glow: 1.5 });
  } else if (blink) {
    drawText(s, 'PRESS SPACE TO START', cx, y + 340, 16, { align: 'center', color: s.palette.hot, glow: 1.5 });
  }
  drawText(s, `ESC TITLE   1 DEBUG   2 GLOW   3 COLLISION   4 SOUND   5 KIT   SEED ${st.seed}`, cx, y + 374, 10, { align: 'center', color: s.palette.dim, glow: 0 });
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
