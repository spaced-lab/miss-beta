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
import { drawText, drawTextFit, getTextScale, measureText, wrapText } from '../render/vectorFont';
import { MG } from './config';
import { arrayOn, displayTier, pulseKillsNeeded, swarmCountRange, laserArmed, laserRange, laserStage, launcherAngleAt, moonActive, moonAlive, moonPosition, seekerHitsNeeded, seekerMax, spectrumStage, streamDamage, strengthLevel, swarmKillsNeeded, swarmMax, turretHitsNeeded, turretPosition, type MinigameState, type SentryKind } from './sim';

export interface RenderOpts {
  debug: boolean;
  frameMs: number;
  best: number;
  /** e.g. "SND ON  KIT DELICATE" */
  sound: string;
  /** A saved game is waiting on the ready panel: its headline numbers, or null. */
  resume?: { level: number; score: number; t: number } | null;
  /** DAILY mode: today's date and the day's best, or null. */
  daily?: { date: string; best: number } | null;
  /** SUPER DEMO running: its speed, and seconds to the next demo game after a game over (else null). */
  demo?: { speed: number; restartIn: number | null } | null;
  /** Difficulty and start level chosen on the ready panel. */
  options?: { difficulty: string; startLevel: number };
  /** Main OPTIONS > REDUCE MOTION: no screen shake. */
  reduceMotion?: boolean;
  /** The on-screen touch pad is shown (touchPad.ts): the top of its highest button, CSS px. The left column starts
   *  below its BACK button, the status line sits just above the buttons, and the key hints and sound line go. */
  touchTop?: number | null;
}

/** Neon accents (SPECTRUM-style, GAME_PLAN 24.1). Index by tier / damage. */
const NEON = {
  /** Rock hardness 0..5: green, amber, cyan, magenta, then violet and white-hot for tiers 4 and 5. */
  tier: ['#33FF33', '#FFB000', '#00F0FF', '#FF2BD6', '#9D4DFF', '#FFF6D5'],
  bullet: ['#B6FFB6', '#00F0FF', '#FF2BD6'],
  core: '#FF3B3B',
  moon: '#7DF9FF',
  turret: ['#CCFF00', '#00F0FF', '#FF2BD6'],
  /** Drone tiers 0..3 (v3.4): lime, cyan, magenta, white-hot. */
  drone: ['#CCFF00', '#00F0FF', '#FF2BD6', '#FFF6D5'],
  /** The beam array (tier 5 beams). */
  array: '#FFF6D5',
  heat: '#FF6A00',
} as const;

/**
 * Pixel sizes. Everything is deliberately fine (owner's note, 2026-10-17: "all detail gets finer"):
 * sentry bullets are single pixels, player bullets barely bigger, dust is 1 px, outlines are sub-pixel at
 * DPR 1 and crisp at DPR 2. Hardness still reads through colour and the width ladder (ROCK_W + tier * ROCK_W_STEP,
 * six tiers: 0.55 px to 1.45 px).
 */
const PX = {
  particle: 1,
  autoBullet: 1,
  /** Player bullet: base + damage * step (1.3, 1.6, 1.9 px for damage 1..3). */
  bullet: 1.0,
  bulletStep: 0.3,
  rockW: 0.55,
  rockWStep: 0.18,
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

/** Screen-shake amplitude in px: shake (world radii) x scale. NOTE: REDUCE MOTION (the main game's photosensitivity
 *  setting) turns it off entirely; the flash text and particles stay. Example: shakePx(0.1, 50, false) = 5. */
export const shakePx = (shake: number, scale: number, reduceMotion: boolean): number => (reduceMotion ? 0 : shake * scale);

/**
 * Px per world unit: MG.VIEW_R world units fit the shorter half-axis, except that a window held sideways (wider than
 * 1.3 times its height) scales from min(W, 1.35 H), so the planet is a third larger and rocks still start off screen
 * (the field's edge, FIELD_R, lies past the top and bottom at 4.6 units). Example: viewScale(780, 360) = 39.2;
 * viewScale(390, 740) = 31.5.
 */
export function viewScale(W: number, H: number): number {
  const short = W > H * 1.3 ? Math.min(W, H * 1.35) : Math.min(W, H);
  return short / 2 / MG.VIEW_R;
}

export function renderMinigame(s: Surface, st: MinigameState, opts: RenderOpts): void {
  const p = s.palette;
  const W = s.width;
  const H = s.height;
  const k = viewScale(W, H);
  const sh = shakePx(st.shake, k, opts.reduceMotion === true);
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
    // A MIRV warhead is a smaller dart than the bus it split from, in the hot colour.
    const z = sk.warhead ? 0.6 : 1;
    pt(dx, dy, 5 * z, 0, facing);
    pt(dx, dy, -3 * z, -2 * z, facing);
    pt(dx, dy, -1.5 * z, 0, facing);
    pt(dx, dy, -3 * z, 2 * z, facing);
    s.stroke(scratch, { closed: true, color: sk.warhead ? p.hot : sc, width: PX.sentryW, glow: 1.4 });
    s.dot(dx - Math.cos(facing) * 4, dy - Math.sin(facing) * 4, 1, p.hot, 0.6 + 0.4 * Math.abs(Math.sin(st.t * 60)));
  }

  // Sentinel drones: a tiny three-fin mark along the velocity, blinking in the last second; colour by tier (v3.4).
  for (const d of st.drones) {
    const dc = stage >= 3 ? (NEON.drone[d.tier] ?? NEON.drone[0]) : p.ink;
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
    s.stroke(scratch, { color: dc, width: PX.sentryDetail + d.tier * 0.3, glow: 0.8 + d.tier * 0.3, alpha: blink });
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

  // Laser beams: a bright core line and a wider faint one, fading; a MESH pull leaves every fan on screen at once.
  // Colour by source (v3.4): the player's beam, a sentry's tier colour (SUPER cycles), white-hot for the beam array.
  for (const b of st.beams) {
    const a = b.t / MG.BEAM_FADE;
    const x0 = X(b.x);
    const y0 = Y(b.y);
    const x1 = X(b.x + b.len * Math.cos(b.angle));
    const y1 = Y(b.y + b.len * Math.sin(b.angle));
    const array = b.tier === 5;
    const lc = stage < 2 ? p.hot : array ? NEON.array : b.tier >= 0 ? (NEON.turret[b.tier] ?? p.hot) : NEON.bullet[2];
    s.stroke([x0, y0, x1, y1], { color: lc, width: array ? 9 : 6, alpha: a * 0.25, glow: 0 });
    s.stroke([x0, y0, x1, y1], { color: array ? NEON.array : b.tier >= 0 && stage >= 2 ? lc : p.hot, width: array ? 2.2 : 1.5, alpha: a, glow: array ? 3 : 2 });
  }

  // Shockwave.
  if (st.pulseR >= 0) {
    s.circle(cx, cy, st.pulseR * k, { color: p.hot, glow: 2.5, width: 2 });
    s.circle(cx, cy, st.pulseR * k * 0.92, { color: stage >= 3 ? NEON.tier[2] : p.ink, glow: 1, width: 1, alpha: 0.5 });
  }

  drawHud(s, st, opts, stage);
  if (opts.demo) drawDemoBanner(s, opts.demo);
  if (st.status === 'ready') drawReady(s, st, opts);
  if (st.status === 'over' && !opts.demo) drawOver(s, st, opts);
}

/** The SUPER DEMO banner: what is playing and how to leave. */
function drawDemoBanner(s: Surface, demo: { speed: number; restartIn: number | null }): void {
  const p = s.palette;
  const cx = s.width / 2;
  const w = Math.min(560, s.width - 32);
  const blink = Math.floor(performance.now() / 600) % 2 === 0;
  drawTextFit(s, `SUPER DEMO  ${demo.speed.toFixed(2)}X  THE BOT IS PLAYING`, cx, s.height * 0.16, 16, w, { align: 'center', color: p.hot, glow: blink ? 1.5 : 0.6 });
  const sub = demo.restartIn !== null ? `HOME LOST. NEXT DEMO IN ${Math.ceil(demo.restartIn)} S.  ANY KEY TO EXIT` : 'ANY KEY TO EXIT  (1 DEBUG  2 GLOW  4 SOUND KEEP IT RUNNING)';
  drawTextFit(s, sub, cx, s.height * 0.16 + 24, 11, w, { align: 'center', color: p.dim, glow: 0 });
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

/** An earned-weapon row: label, `max` stock diamonds (lit up to `have`; packed tighter once the cap grows past 3), and a 0..1 charge bar after them. */
function stockRow(s: Surface, bx: number, by: number, bw: number, bh: number, fs: number, label: string, have: number, max: number, charge: number, color: string): void {
  const p = s.palette;
  drawText(s, label, bx, by - fs - 6, fs);
  const gap = max > 3 ? 15 : 22;
  const r = max > 3 ? 4.5 : 6;
  for (let i = 0; i < max; i++) {
    const dx = bx + 10 + i * gap;
    const dy = by + bh / 2;
    const lit = i < have;
    s.stroke([dx, dy - r, dx + r, dy, dx, dy + r, dx - r, dy], { closed: true, color: lit ? color : p.dim, glow: lit ? 1.5 : 0 });
  }
  const cbx = bx + 10 + max * gap + 6;
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
  // The left column's top: below the touch BACK tab when it is shown.
  const touch = typeof opts.touchTop === 'number';
  const lt = touch ? 36 : m;
  // Held sideways on a phone: the bar column is narrower and its rows closer, so the stack ends above FIRE.
  const wide = touch && W > H * 1.3;

  drawText(s, `SCORE ${pad(st.score, 6)}`, m, lt, fs);
  drawText(s, opts.daily ? `DAILY ${opts.daily.date}  BEST ${pad(opts.daily.best, 6)}` : `BEST  ${pad(opts.best, 6)}`, m, lt + fs * 1.7, fs, { color: opts.daily ? p.hot : p.dim, glow: 0 });
  drawText(s, `LEVEL ${st.level}`, m, lt + fs * 3.4, fs, { color: p.hot, glow: 1.2 });
  const tags = [st.difficulty !== 'normal' ? st.difficulty.toUpperCase() : '', st.startLevel > 1 ? `FROM ${st.startLevel}` : ''].filter((t) => t).join('  ');
  if (tags && st.status !== 'ready') drawText(s, tags, m, lt + fs * 5.1, 11, { color: p.dim, glow: 0 });

  // Right column: HULL, HEAT, PULSE.
  const bw = wide ? 120 : 160;
  const bh = 12;
  // NOTE: on a touch screen the column steps left of the GEAR tab in the top-right corner (ui/gearMenu.ts).
  const bx = W - m - bw - (touch ? 30 : 0);
  const rowGap = wide ? 18 : 28;
  // The first label sits above its bar: leave it room so it is never clipped by the top edge.
  let by = m + fs + 8;
  drawText(s, 'HULL', bx, by - fs - 6, fs);
  const hf = st.hp / MG.MAX_HP;
  bar(s, bx, by, bw, bh, hf, hf < 0.3 ? p.hot : p.ink, hf < 0.3 ? 1.5 : 0.8);

  by += bh + rowGap;
  drawText(s, st.overheated ? 'HEAT  OVERHEAT' : 'HEAT', bx, by - fs - 6, fs, { color: st.overheated ? NEON.heat : p.ink, glow: st.overheated ? 1.5 : 1 });
  bar(s, bx, by, bw, bh, st.heat, st.heat > 0.75 || st.overheated ? NEON.heat : p.ink, st.heat > 0.75 ? 1.5 : 0.6);

  const lstage = laserStage(st.streamCount, st.level);
  if (lstage > 0) {
    const armed = laserArmed(st);
    const name = lstage >= 3 ? 'MESH' : 'LASER';
    drawText(s, armed ? `${name} READY` : name, bx + bw, by - fs - 6, 11, { align: 'right', color: armed ? (stage >= 2 ? NEON.bullet[2] : p.hot) : p.dim, glow: armed ? 1.5 : 0 });
  }

  // Earned weapons: stock diamonds plus a charge bar, one row each.
  by += bh + rowGap;
  stockRow(s, bx, by, bw, bh, fs, 'PULSE', st.pulses, MG.PULSE_MAX, st.pulseCharge, p.hot);
  by += bh + rowGap;
  stockRow(s, bx, by, bw, bh, fs, 'SEEKER  <', st.seekerStock, seekerMax(st.level), st.seekerProgress / seekerHitsNeeded(st.level), stage >= 2 ? NEON.bullet[2] : p.hot);
  by += bh + rowGap;
  stockRow(s, bx, by, bw, bh, fs, 'SWARM  >', st.swarmStock, swarmMax(st.level), st.swarmProgress / swarmKillsNeeded(st.level), stage >= 3 ? NEON.turret[0] : p.hot);

  // Turret progress (only once turrets can be earned).
  if (st.level >= MG.TURRET_LEVEL) {
    by += bh + rowGap;
    const need = turretHitsNeeded(st.level);
    drawText(s, `SENTRY ${st.turretProgress}/${need}`, bx, by - fs - 6, fs, { color: stage >= 3 ? NEON.turret[0] : p.ink });
    bar(s, bx, by, bw, bh, st.turretProgress / need, stage >= 3 ? NEON.turret[0] : p.ink, 0.6);
    if (arrayOn(st.level)) {
      // Beam array (v3.4): charge readout under the sentry bar.
      const ready = st.turrets.length >= MG.SENTRY_ARRAY_MIN;
      const label = !ready ? `ARRAY NEEDS ${MG.SENTRY_ARRAY_MIN}` : st.arrayCd <= 0 ? 'ARRAY READY' : `ARRAY ${st.arrayCd.toFixed(1)} S`;
      drawText(s, label, bx, by + bh + 5, fs * 0.9, { color: stage >= 3 ? NEON.array : p.ink, alpha: ready ? 1 : 0.6 });
    }
  }

  // Stream strength ladder: one dot per stream coloured by damage.
  // Sideways the pad reaches the middle of the screen, so the status line goes to the top between the columns.
  const bottom = wide ? m : touch ? (opts.touchTop ?? H) - fs - 12 : H - m - fs;
  const status = `T ${clock(st.t)}   LAUNCHERS X${st.launcherCount}   STREAMS X${st.streamCount}`;
  // NOTE: above the touch pad the line shrinks to leave room for its stream dots on a phone's width.
  // Sideways it must also end before the bar column (bx) with room for its stream dots.
  // The STR label scales with the line, so both widths are counted (sideways the line used to run under the column).
  const strText = `STR ${strengthLevel(st.streamCount)}`;
  const room = (wide ? bx - (m + 150) - 12 : W - 2 * m) - st.streamCount * 12 - 18 - 8;
  const sfs = touch ? Math.min(fs, (fs * room) / ((measureText(status, fs) + measureText(strText, fs)) * getTextScale())) : fs;
  // On a touch screen the status line sits where the ready and game-over panels are; it shows only in play.
  const sx = wide ? m + 150 : m;
  if (!touch || st.status === 'playing') drawText(s, status, sx, bottom, sfs);
  const lx = sx + measureText(status, sfs) * getTextScale() + 18;
  for (let j = 0; j < st.streamCount; j++) {
    const d = streamDamage(st.streamCount, j);
    s.dot(lx + j * 12, bottom + sfs / 2, 3 + d * 1.2, bulletColor(s, d, stage));
  }
  drawText(s, strText, lx + st.streamCount * 12 + 8, bottom, sfs, { color: p.dim, glow: 0 });
  if (!touch) {
    if (st.status === 'playing') drawTextFit(s, '<ARROWS> MOVE  <SPACE> FIRE  <SHIFT> PULSE  < SEEKER  > SWARM', W - m, bottom, fs, W * 0.45, { align: 'right', color: p.dim, glow: 0 });
    drawText(s, opts.sound, W - m, bottom - fs * 1.5, 11, { align: 'right', color: p.dim, glow: 0 });
  }
  if (st.cheats.assisted) drawText(s, 'ASSISTED', m, lt + fs * 5.1, 11, { color: p.dim, glow: 0 });

  let fy = s.height / 2 - MG.PLANET_R * viewScale(W, H) - 70;
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

/**
 * The ready panel on a touch screen (owner 2026-10-20, on-screen controls on a phone): the pad's buttons named
 * instead of keys, TAP TO START, and the difficulty and start level read out with where to change them (OPTIONS >
 * PERIMETER; keys 9 and 0 need a keyboard). Text sizes shrink to the panel's width.
 */
/** Buttons drawn on the touch panels this frame: a tap on one presses its key code (index.ts). */
export const PANEL_HITS: { x: number; y: number; w: number; h: number; code: string }[] = [];

/** A row of three touch buttons on a panel: difficulty (9), start level (0), the SOUND LAB (L). */
function optionButtons(s: Surface, x: number, y: number, w: number, o: NonNullable<RenderOpts['options']>): void {
  const p = s.palette;
  const gap = 8;
  const bw = (w - 2 * gap) / 3;
  const bh = 34;
  const items: [string, string][] = [[`${o.difficulty.toUpperCase()}`, 'Digit9'], [`START ${o.startLevel}`, 'Digit0'], ['SOUND LAB', 'KeyL']];
  items.forEach(([label, code], i) => {
    const bx = x + i * (bw + gap);
    s.stroke([bx, y, bx + bw, y, bx + bw, y + bh, bx, y + bh], { closed: true, color: p.dim, glow: 0.2, alpha: 0.9 });
    drawTextFit(s, label, bx + bw / 2, y + bh / 2 - 5, 10, bw - 10, { align: 'center', color: p.ink, glow: 0.4 });
    PANEL_HITS.push({ x: bx, y, w: bw, h: bh, code });
  });
}

function drawReadyTouch(s: Surface, opts: RenderOpts): void {
  PANEL_HITS.length = 0;
  const p = s.palette;
  const pw = Math.min(560, s.width - 24);
  const inner = pw - 32;
  const rows: Array<[string, string]> = [
    ['<  >', 'TURN THE LAUNCHER'],
    ['FIRE', 'HOLD TO FIRE (WATCH THE HEAT)'],
    ['PULSE', 'CLEARS THE FIELD WHEN CHARGED'],
    ['SEEK', 'HOMING MISSILE, SPLITS NEAR ITS TARGET'],
    ['SWARM', 'A SWARM OF SENTINEL DRONES'],
  ];
  // A phone held sideways (under 420 px tall) gets a shorter panel: smaller title, no subtitle, tighter rows.
  const short = s.height < 420;
  const ks = Math.min(short ? 10 : 12, (12 * inner) / ((measureText('SWARM   HOLD TO FIRE (WATCH THE HEAT)', 12) + 20) * getTextScale()));
  const lh = ks * (short ? 1.45 : 1.7) * getTextScale();
  const o = opts.options;
  const h = (short ? 84 : 150) + rows.length * lh + (o ? (short ? 58 : 62) : 0) + (short ? 56 : 70);
  const { x, y } = drawPanel(s, pw, Math.min(h, s.height - 12));
  const cx = s.width / 2;
  drawTextFit(s, 'PERIMETER', cx, y + (short ? 10 : 22), short ? 20 : 30, inner, { align: 'center', glow: 2, color: p.hot });
  if (!short) drawTextFit(s, 'BETA ARCADE MODE', cx, y + 64, 12, inner, { align: 'center', color: p.dim, glow: 0 });
  drawTextFit(s, 'ROCKS ARE INBOUND. KEEP THE HULL ABOVE ZERO.', cx, y + (short ? 40 : 88), short ? 10 : 12, inner, { align: 'center' });
  let ly = y + (short ? 60 : 120);
  const kw = measureText('SWARM', ks) * getTextScale() + 18;
  for (const [key, what] of rows) {
    drawText(s, key, x + 16, ly, ks, { color: p.hot, glow: 1 });
    drawTextFit(s, what, x + 16 + kw, ly, ks, inner - kw, {});
    ly += lh;
  }
  if (o) {
    // Owner 2026-10-21 (IDEAS 39): the options as buttons, not a note pointing at OPTIONS.
    ly += short ? 4 : 8;
    drawTextFit(s, `DIFFICULTY   START LEVEL${o.startLevel > 1 ? ' (NOT RANKED)' : ''}`, x + 16, ly, ks * 0.8, inner, { color: p.dim, glow: 0 });
    // NOTE: below the label's drawn height (it grows with OPTIONS > TEXT SIZE), not a fixed 12 px.
    optionButtons(s, x + 16, ly + Math.max(12, ks * 0.8 * getTextScale() + 5), inner, o);
    ly += short ? 54 : 62;
  }
  const r = opts.resume;
  const hh = Math.min(h, s.height - 12);
  if (r) drawTextFit(s, `SAVED GAME: LEVEL ${r.level}   SCORE ${r.score}`, cx, y + hh - (short ? 48 : 64), 11, inner, { align: 'center', color: p.dim, glow: 0 });
  if (Math.floor(performance.now() / 500) % 2 === 0) drawTextFit(s, r ? 'TAP TO RESUME' : 'TAP TO START', cx, y + hh - (short ? 30 : 40), short ? 14 : 18, inner, { align: 'center', color: p.hot, glow: 1.5 });
}

function drawReady(s: Surface, st: MinigameState, opts: RenderOpts): void {
  if (typeof opts.touchTop === 'number') {
    drawReadyTouch(s, opts);
    return;
  }
  // Laid out from its content: the key column is as wide as its widest label, descriptions wrap in the column
  // beside it, the notes wrap to the panel, and the panel grows to fit (owner screenshot, 2026-10-18).
  const p = s.palette;
  const pw = Math.min(860, s.width - 32);
  const inner = pw - 56;
  const sw = swarmCountRange(1);
  const rows: Array<[string, string]> = [
    ['<LEFT> <RIGHT>  OR  A / D', 'MOVE THE LAUNCHER'],
    ['<SPACE>', 'FIRE  (WATCH THE HEAT)'],
    ['<SHIFT>', `PULSE  (CLEARS THE FIELD, EARNED PER ${pulseKillsNeeded(1)} KILLS)`],
    ['<  (COMMA)', `SEEKER MISSILE  (HOMES, SPLITS INTO A MIRV NEAR ITS TARGET, PER ${seekerHitsNeeded(1)} HITS; VOLLEYS FROM LEVEL ${MG.SEEKER_VOLLEY_LEVELS[0] ?? 10})`],
    ['>  (PERIOD)', `SWARM OF SENTINELS  (${sw.min}-${sw.max} DRONES, MORE EACH LEVEL, PER ${swarmKillsNeeded(1)} KILLS)`],
  ];
  const notes = [
    'LEVELS RAISE STREAMS, LAUNCHERS AND ROCK HARDNESS. HARDER ROCKS CHANGE COLOUR AS THEY WEAKEN. SHOTS NUDGE ROCKS.',
    `A MOON ARRIVES AT LEVEL ${MG.MOON_LEVEL}. SENTRIES ARE EARNED FROM LEVEL ${MG.TURRET_LEVEL} AND FIRE LASERS FROM LEVEL ${MG.SENTRY_LASER_LEVEL}; FROM LEVEL ${MG.SENTRY_ARRAY_LEVEL} THREE OR MORE FIRE A BEAM ARRAY.`,
    `FROM 3 STREAMS THE FIRST SHOT AFTER A BREAK IS A LASER PULSE; FROM LEVEL ${MG.LASER_MESH_LEVEL} IT FANS INTO A MESH.`,
  ];
  const ks = 12;
  const keyW = Math.max(...rows.map(([k]) => measureText(k, ks))) * getTextScale() + 24;
  const descW = Math.max(160, inner - keyW);
  const rowLines = rows.map(([, what]) => wrapText(what, descW, ks));
  const noteLines = notes.flatMap((n) => wrapText(n, inner, 11));
  const lh = (sz: number): number => sz * 1.6 * getTextScale();
  const rowsH = rowLines.reduce((a, ls) => a + ls.length * lh(ks) + 4, 0);
  const o = opts.options;
  // GAME SETUP box (owner 2026-10-18: the skip-to-level menu was hard to find): three framed rows, keys in the left
  // column, every choice spelled out with the current one in brackets.
  const setupH = o ? 3 * lh(12) + 50 : 0;
  const h = 128 + rowsH + 8 + noteLines.length * lh(11) + 110 + setupH;
  const { x, y } = drawPanel(s, pw, h);
  const cx = s.width / 2;
  const x0 = x + 28;
  drawTextFit(s, 'PERIMETER', cx, y + 26, 34, inner, { align: 'center', glow: 2, color: p.hot });
  drawTextFit(s, 'BETA ARCADE MODE', cx, y + 74, 13, inner, { align: 'center', color: p.dim, glow: 0 });
  drawTextFit(s, 'ROCKS ARE INBOUND. KEEP THE HULL ABOVE ZERO.', cx, y + 100, 12, inner, { align: 'center' });
  let ly = y + 128;
  rows.forEach(([key], i) => {
    drawTextFit(s, key, x0, ly, ks, keyW - 16, { color: p.hot, glow: 1 });
    for (const l of rowLines[i] ?? []) {
      drawText(s, l, x0 + keyW, ly, ks);
      ly += lh(ks);
    }
    ly += 4;
  });
  ly += 8;
  for (const n of noteLines) {
    drawText(s, n, cx, ly, 11, { align: 'center', color: p.dim, glow: 0 });
    ly += lh(11);
  }
  if (o) {
    const bx = x0;
    const bw = inner;
    const bt = ly + 6;
    s.stroke([bx, bt, bx + bw, bt, bx + bw, bt + setupH - 12, bx, bt + setupH - 12], { closed: true, color: p.hot, glow: 0.8 });
    drawText(s, 'GAME SETUP', bx + 12, bt + 8, 12, { color: p.hot, glow: 1.2 });
    const pick = (list: readonly (string | number)[], cur: string | number): string => list.map((v) => (v === cur ? `[${String(v).toUpperCase()}]` : String(v).toUpperCase())).join('  ');
    const setup: [string, string, string][] = [
      ['9', 'DIFFICULTY', pick(MG.DIFFICULTY_ORDER, o.difficulty)],
      ['0', 'START LEVEL', `${pick(MG.START_LEVELS, o.startLevel)}${o.startLevel > 1 ? '   NOT RANKED' : ''}`],
      ['8', 'SUPER DEMO', 'WATCH IT PLAY ITSELF'],
    ];
    let sy = bt + 8 + lh(12) + 4;
    for (const [key, label, val] of setup) {
      drawText(s, key, bx + 12, sy, 12, { color: p.hot, glow: 1 });
      drawText(s, label, bx + 40, sy, 12, { color: p.ink, glow: 0.5 });
      drawTextFit(s, val, bx + 40 + measureText('START LEVEL', 12) * getTextScale() + 24, sy, 12, bw - 200, { color: p.ink, glow: 0.8 });
      sy += lh(12);
    }
  }
  const blink = Math.floor(performance.now() / 500) % 2 === 0;
  const r = opts.resume;
  const by = y + h - 80;
  if (r) {
    drawTextFit(s, `SAVED GAME: LEVEL ${r.level}   SCORE ${r.score}   ${clock(r.t)}`, cx, by, 11, inner, { align: 'center', color: p.dim, glow: 0 });
    if (blink) drawTextFit(s, '<SPACE> RESUME     <BACKSPACE> NEW GAME', cx, by + 20, 16, inner, { align: 'center', color: p.hot, glow: 1.5 });
  } else if (blink) {
    drawTextFit(s, 'PRESS SPACE TO START', cx, by + 20, 16, inner, { align: 'center', color: p.hot, glow: 1.5 });
  }
  drawTextFit(s, `ESC TITLE  1 DEBUG  2 GLOW  3 COLLISION  4 SOUND  5 KIT  6 DAILY${opts.daily ? ' (ON)' : ''}  7 WATCH BEST  L SOUND LAB  SEED ${st.seed}`, cx, y + h - 26, 10, inner, { align: 'center', color: p.dim, glow: 0 });
}

function drawOver(s: Surface, st: MinigameState, opts: RenderOpts): void {
  PANEL_HITS.length = 0;
  const touch = typeof opts.touchTop === 'number';
  const pw = Math.min(580, s.width - 32);
  const { x, y } = drawPanel(s, pw, opts.options ? (touch ? 290 : 272) : 250);
  const cx = s.width / 2;
  drawTextFit(s, 'HOME LOST', cx, y + 28, 34, Math.min(580, s.width - 32) - 32, { align: 'center', glow: 2, color: s.palette.hot });
  drawText(s, `SCORE ${st.score}`, cx, y + 86, 18, { align: 'center' });
  const isBest = st.score >= opts.best && !st.cheats.assisted && st.score > 0;
  drawText(s, isBest ? 'NEW BEST' : `BEST ${opts.best}`, cx, y + 116, 14, { align: 'center', color: isBest ? s.palette.hot : s.palette.dim, glow: isBest ? 1.5 : 0 });
  drawTextFit(s, `LEVEL ${st.level}   SURVIVED ${clock(st.t)}   ROCKS ${st.kills}`, cx, y + 146, 13, Math.min(580, s.width - 32) - 32, { align: 'center' });
  if (st.cheats.assisted) drawText(s, 'ASSISTED RUN: NOT SAVED', cx, y + 172, 11, { align: 'center', color: s.palette.dim, glow: 0 });
  else if (st.startLevel > 1) drawText(s, `STARTED AT LEVEL ${st.startLevel}: NOT RANKED`, cx, y + 172, 11, { align: 'center', color: s.palette.dim, glow: 0 });
  if (st.difficulty !== 'normal') drawText(s, `${st.difficulty.toUpperCase()}`, cx, y + 188, 11, { align: 'center', color: s.palette.dim, glow: 0 });
  drawTextFit(s, typeof opts.touchTop === 'number' ? 'TAP TO RETRY' : 'SPACE RETRY    L SOUND LAB    ESC TITLE', cx, y + 212, 14, Math.min(580, s.width - 32) - 32, { align: 'center', color: s.palette.hot, glow: 1.5 });
  const o = opts.options;
  if (o && !touch) drawTextFit(s, `RETRY AS:  9 ${o.difficulty.toUpperCase()}   0 START LEVEL ${o.startLevel}${o.startLevel > 1 ? ' (NOT RANKED)' : ''}`, cx, y + 240, 11, pw - 32, { align: 'center', color: s.palette.ink, glow: 0.6 });
  else if (o) optionButtons(s, x + 16, y + 238, pw - 32, o);
}
