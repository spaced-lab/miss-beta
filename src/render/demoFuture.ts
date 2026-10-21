// WHAT: The SUPER-DUPER-DEMO's "future" scenes: launch salvos that grow from one small rocket to six pads of mixed
//       craft, launches from the Moon, Mars and Europa, data centres on other worlds, lasers fired from the world
//       map at falling rocks, steered solar eruptions, a wormhole flight back in time, dinosaurs watching an impact
//       and a launch, and a flying saucer whose gray pilot helps out.
// WHY:  Owner 2026-10-20: "launches are kind of boring ... multiple launches at once and different rockets", "data
//       centers on other planets, launches from other planets, stuff that's not even in the game yet, like lasers
//       shooting from the large map at asteroids, guided solar eruptions", "the time warp needs to be more of a worm
//       hole than a spiral", dinosaurs in wireframe, "a gray alien helping, UFO, weird stuff", "more complex
//       renderings of future stuff but retro". Every caption and craft here is FICTION in character (GAME_PLAN 30):
//       none of it is a claim about real hardware, and none of it is a feature of the game.
// HOW:  Same contract as render/demoScenes.ts: each scene is a pure function of (surface, local time t in s, colours,
//       intensity k in 0..1); layout noise comes from `hash01` or a seeded Rng built per call, so a frame redraws
//       identically and nothing is stored. Everything repeats on short cycles, so no scene is ever still. Craft:
//       the launch cinematic's pixel rockets (tiers 1-3) plus three vector craft (spaceplane, nuclear truss, ring
//       ship); which ones appear is drawn per pad and cycle from the first 2 + 4k kinds. Fire, plasma and debris
//       are render/pixelDust.ts. The only canvas state touched is a save / clip / restore around a panel.
//       Photosensitive safety (docs/WARNINGS.md): strokes and small pixels only; no fill or flash covers the screen.
// LORE: G1 (how to play), G8 (the look)

import coastline from '../config/coastline.json';
import { Rng } from '../sim/rng';
import type { Surface } from './canvas';
import { drawSprite, hash01, ROCKETS, SPENT_STAGE } from './cinematics/pixel';
import { dcGlobe, impacts, planning, racks, strike, type DemoScene, type Ui } from './demoScenes';
import { dustBurst, dustColors, dustField, dustTrail } from './pixelDust';
import { drawText } from './vectorFont';
import { wireSphere } from './wire';

const TAU = Math.PI * 2;

/** A vivid hue on a glowing mode, the mode's own colour otherwise (DAYLIGHT keeps dark ink). */
function tint(s: Surface, hex: string, mono: string): string {
  return s.palette.glow ? hex : mono;
}

/** Fractional part. Example: frac(2.25) = 0.25; frac(-0.25) = 0.75. */
function frac(x: number): number {
  return x - Math.floor(x);
}

/**
 * Local points [x, y, ...] (y down; 0 rad = nose up) scaled by `sc`, mirrored by `flip` (+1 / -1), rotated by `ang`
 * and moved to (x, y). Example: xf([0, -1], 10, 10, 5) -> [10, 5].
 */
function xf(pts: readonly number[], x: number, y: number, sc: number, ang = 0, flip = 1): number[] {
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const out: number[] = [];
  for (let i = 0; i + 1 < pts.length; i += 2) {
    const lx = (pts[i] ?? 0) * sc * flip;
    const ly = (pts[i + 1] ?? 0) * sc;
    out.push(x + lx * ca - ly * sa, y + lx * sa + ly * ca);
  }
  return out;
}

/** Ellipse outline (or an arc a0..a1) as a flat point list, rotated by `rot`. */
function ell(cx: number, cy: number, rx: number, ry: number, rot = 0, n = 32, a0 = 0, a1 = TAU): number[] {
  const out: number[] = [];
  const c = Math.cos(rot);
  const sn = Math.sin(rot);
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const ex = Math.cos(a) * rx;
    const ey = Math.sin(a) * ry;
    out.push(cx + ex * c - ey * sn, cy + ex * sn + ey * c);
  }
  return out;
}

/** The top of a huge circle (a planet's limb) between x0 and x1, sampled finely so it never shows facets. */
function limb(s: Surface, cx: number, cy: number, R: number, x0: number, x1: number, color: string, glow = 1, alpha = 1): void {
  const pts: number[] = [];
  for (let i = 0; i <= 60; i++) {
    const x = x0 + ((x1 - x0) * i) / 60;
    const dx = Math.min(R, Math.abs(x - cx));
    pts.push(x, cy - Math.sqrt(R * R - dx * dx));
  }
  s.stroke(pts, { color, glow, alpha, width: 1.5 });
}

/** A tumbling rock: nine vertices at seeded radii. */
function rock(s: Surface, x: number, y: number, r: number, rot: number, seed: number, color: string): void {
  const pts: number[] = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + rot;
    const rr = r * (0.7 + 0.4 * hash01(i, seed, 41));
    pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  s.stroke(pts, { closed: true, color, glow: 1 });
}

// ---------------------------------------------------------------------------------------------------------------
// Launch salvos

type Craft = 'T1' | 'T2' | 'T3' | 'PLANE' | 'NUKE' | 'RING';
/** In order of how advanced they look; the first 2 + 4k kinds can appear at intensity k. */
const CRAFTS: readonly Craft[] = ['T1', 'T2', 'T3', 'PLANE', 'NUKE', 'RING'];

const PLANE = [0, -22, 5, -6, 18, 14, 5, 11, 0, 16, -5, 11, -18, 14, -5, -6];
const NUKE_SHIELD = [-9, 22, 9, 22, 6, 27, -6, 27];
const NUKE_RAD = [-3, -10, -16, -2, -16, 10, -3, 4];
const RING_NOSE = [-3, -20, 0, -28, 3, -20];
const RING_BELL = [-4, 24, 4, 24, 6, 30, -6, 30];

function spriteTier(c: Craft): number {
  return c === 'T1' ? 1 : c === 'T2' ? 2 : c === 'T3' ? 3 : 0;
}

/** Distance from a craft's centre to its nozzle, px. */
function craftHalf(c: Craft, cell: number, sc: number): number {
  const tier = spriteTier(c);
  if (tier > 0) return ((ROCKETS[tier]?.length ?? 30) * cell) / 2;
  return (c === 'NUKE' ? 30 : c === 'RING' ? 30 : 16) * sc * 1.6;
}

/** Draw one craft centred on (x, y), heading `ang` (0 = up). */
function drawCraft(s: Surface, c: Craft, x: number, y: number, ang: number, cell: number, sc: number, t: number, ui: Ui): void {
  const tier = spriteTier(c);
  if (tier > 0) {
    drawSprite(s, ROCKETS[tier] ?? [], x, y, cell, ang);
    return;
  }
  const v = sc * 1.6;
  if (c === 'PLANE') {
    const col = tint(s, '#2EF2FF', ui.text);
    s.stroke(xf(PLANE, x, y, v, ang), { closed: true, color: col, glow: 1.3 });
    s.stroke(xf([-2, -13, 0, -17, 2, -13], x, y, v, ang), { color: tint(s, '#FFFFFF', ui.sel), glow: 1 });
    s.stroke(xf([-12, 12, 12, 12], x, y, v, ang), { color: col, glow: 0.6, alpha: 0.6 });
  } else if (c === 'NUKE') {
    const col = tint(s, '#B04DFF', ui.text);
    s.stroke(xf([-3, -28, -3, 22], x, y, v, ang), { color: col, glow: 1 });
    s.stroke(xf([3, -28, 3, 22], x, y, v, ang), { color: col, glow: 1 });
    const zig: number[] = [];
    for (let i = 0; i <= 10; i++) zig.push(i % 2 ? 3 : -3, -28 + i * 5);
    s.stroke(xf(zig, x, y, v, ang), { color: col, glow: 0.4, alpha: 0.7 });
    s.stroke(xf(ell(0, -32, 5, 5, 0, 14), x, y, v, ang), { closed: true, color: tint(s, '#FFFFFF', ui.sel), glow: 1 });
    s.stroke(xf(NUKE_SHIELD, x, y, v, ang), { closed: true, color: tint(s, '#FFE14D', ui.sel), glow: 1.2 });
    s.stroke(xf(NUKE_RAD, x, y, v, ang), { closed: true, color: tint(s, '#FF4FD8', ui.sub), glow: 0.8 });
    s.stroke(xf(NUKE_RAD, x, y, v, ang, -1), { closed: true, color: tint(s, '#FF4FD8', ui.sub), glow: 0.8 });
  } else {
    const col = tint(s, '#FFE14D', ui.text);
    s.stroke(xf([0, -22, 0, 24], x, y, v, ang), { color: col, glow: 1, width: 2 });
    s.stroke(xf(RING_NOSE, x, y, v, ang), { color: col, glow: 1 });
    s.stroke(xf(RING_BELL, x, y, v, ang), { closed: true, color: col, glow: 1 });
    s.stroke(xf(ell(0, -4, 20, 6, 0, 28), x, y, v, ang), { closed: true, color: tint(s, '#7CFF4F', ui.sel), glow: 1.2 });
    const cols = dustColors(s);
    for (let i = 0; i < 6; i++) {
      const a = t * 6 + (i / 6) * TAU;
      const p = xf([Math.cos(a) * 20, -4 + Math.sin(a) * 6], x, y, v, ang);
      s.dot(p[0] ?? x, p[1] ?? y, 2.2, cols[i % cols.length] ?? '#FFFFFF', 0.5 + 0.5 * Math.sin(a));
    }
  }
}

interface Flight {
  /** Nozzle position. */
  x: number;
  y: number;
  ang: number;
}

/** Seconds on the pad before lift-off. */
const IGNITE = 0.22;

/**
 * Nozzle position at local time tl for a craft on a pad at (px, gy): still until IGNITE, then
 * y = gy - a tt^2 / 2 and a gravity turn x = px + dir 0.12 a tt^3 (tt = tl - IGNITE, a in px/s^2).
 * Example: flight(0.22 + 1, 100, 500, 400, 1) -> x 148, y 300.
 */
function flight(tl: number, px: number, gy: number, a: number, dir: number): Flight {
  if (tl < IGNITE) return { x: px, y: gy, ang: 0 };
  const tt = tl - IGNITE;
  const vx = dir * 0.36 * a * tt * tt;
  return { x: px + dir * 0.12 * a * tt * tt * tt, y: gy - 0.5 * a * tt * tt, ang: Math.atan2(vx, Math.max(1e-6, a * tt)) };
}

/** Pad smoke: grey and white puffs rolling out sideways from the flame trench, `age` s after ignition. */
function padSmoke(s: Surface, x: number, gy: number, age: number, seed: number, sc: number): void {
  if (age < 0 || age > 1.8) return;
  const greys = ['#FFFFFF', '#C9D6E8', '#8A97AA', '#5A6270'];
  const out = 1 - Math.exp(-age * 3);
  for (let i = 0; i < 46; i++) {
    const side = hash01(i, seed, 1) > 0.5 ? 1 : -1;
    const d = (20 + 150 * hash01(i, seed, 2)) * sc * out;
    const lift = (4 + 40 * hash01(i, seed, 3) * age) * sc;
    s.dot(x + side * d, gy - lift, 2 + Math.round(hash01(i, seed, 4) * 2), greys[i % 4] ?? '#FFFFFF', (1 - age / 1.8) * 0.75);
  }
}

/** A launch tower: a lattice mast with an arm, `h` px tall. */
function tower(s: Surface, x: number, gy: number, h: number, color: string): void {
  s.stroke([x - 3, gy, x - 3, gy - h], { color, glow: 0.3 });
  s.stroke([x + 3, gy, x + 3, gy - h], { color, glow: 0.3 });
  const zig: number[] = [];
  for (let y = 0; y <= h; y += 8) zig.push(y % 16 ? x + 3 : x - 3, gy - y);
  s.stroke(zig, { color, glow: 0, alpha: 0.6 });
}

interface SalvoOpts {
  x0: number;
  x1: number;
  gy: number;
  /** Pads. */
  n: number;
  /** Intensity: which craft can appear. */
  level: number;
  seed: number;
  /** Seconds per launch cycle (each pad relaunches on its own phase, so something is always lifting off). */
  cycle?: number;
}

/** Pads, towers, smoke, plumes, craft and spent stages for one salvo; returns the launches made so far. */
function salvoCore(s: Surface, t: number, o: SalvoOpts, sc: number, ui: Ui): number {
  const C = o.cycle ?? 2.6;
  const cell = Math.max(1.5, Math.round(2 * sc * 2) / 2);
  const kinds = Math.min(CRAFTS.length, 2 + Math.round(o.level * 4));
  const towerCol = tint(s, '#8A97AA', ui.dim);
  let launched = 0;
  for (let i = 0; i < o.n; i++) {
    const off = (i / o.n) * C * 0.7 + hash01(i, o.seed, 1) * 0.3;
    const cyc = Math.floor((t + off) / C);
    const tl = t + off - cyc * C;
    launched += cyc + (tl > IGNITE ? 1 : 0);
    const px = o.x0 + ((o.x1 - o.x0) * (i + 0.5)) / o.n;
    const craft = CRAFTS[Math.floor(hash01(i, cyc, o.seed + 5) * kinds)] ?? 'T1';
    const a = o.gy * (0.75 + 0.6 * hash01(i, cyc, o.seed + 6));
    const dir = hash01(i, cyc, o.seed + 7) > 0.5 ? 1 : -1;
    const half = craftHalf(craft, cell, sc);
    s.stroke([px - 30 * sc, o.gy, px + 30 * sc, o.gy], { color: towerCol, glow: 0.4 });
    tower(s, px - 18 * sc - half * 0.2, o.gy, half * 2.3, towerCol);
    padSmoke(s, px, o.gy, tl - IGNITE * 0.5, i * 31 + cyc, sc);
    // The next craft rolls out onto the pad while this one climbs, so a pad is never empty for long.
    if (tl > C - 0.9) {
      const nextCraft = CRAFTS[Math.floor(hash01(i, cyc + 1, o.seed + 5) * kinds)] ?? 'T1';
      const nh = craftHalf(nextCraft, cell, sc);
      drawCraft(s, nextCraft, px, o.gy - nh, 0, cell, sc, t, ui);
    }
    if (tl > IGNITE) dustBurst(s, px, o.gy, tl - IGNITE, i * 53 + cyc, { n: 90, speed: 320 * sc, life: 0.6, size: 1.5, from: Math.PI, to: Math.PI * 2 });
    const nozzle = (te: number): { x: number; y: number } | null => (te < IGNITE * 0.5 ? null : flight(te, px, o.gy, a, dir));
    dustTrail(s, tl, nozzle, i * 97 + cyc * 13 + o.seed, 1.1, 0.014, 60 * sc, 40 * sc, Math.max(1.4, 2 * sc));
    const f = flight(tl, px, o.gy, a, dir);
    const cx = f.x + Math.sin(f.ang) * half;
    const cy = f.y - Math.cos(f.ang) * half;
    drawCraft(s, craft, cx, cy, f.ang, cell, sc, t, ui);
    // Staging: tiers 2 and 3 drop a spent stage 0.9 s after lift-off, with a puff of sparks.
    const sep = tl - IGNITE - 0.9;
    if ((craft === 'T2' || craft === 'T3') && sep > 0) {
      const at = flight(IGNITE + 0.9, px, o.gy, a, dir);
      dustBurst(s, at.x, at.y, sep, i * 7 + cyc, { n: 40, speed: 170 * sc, life: 0.5, size: 1.3 });
      drawSprite(s, SPENT_STAGE, at.x - dir * 24 * sc * sep, at.y + 160 * sc * sep * sep, cell, at.ang + sep * 3 * dir, Math.max(0, 1 - sep));
    }
  }
  return launched;
}

/**
 * Launch salvo from HOME: 1 + 6k pads of mixed craft lifting off on their own phases, plumes of coloured pixel
 * dust, pad smoke, spent stages and a launch counter. Used by the montage, the cutaways and the demo's own
 * LAUNCH cinematic.
 */
export const salvo: DemoScene = (s, t, ui, k) => {
  const W = s.width;
  const H = s.height;
  const sc = Math.min(W, H) / 720;
  dustField(s, t, 160, 11);
  const gy = H * 0.84;
  const R = W * 1.6;
  limb(s, W / 2, gy + R - 4, R, 0, W, tint(s, '#7CFF4F', ui.sub), 1.2);
  for (let i = 1; i <= 3; i++) limb(s, W / 2, gy + R - 4, R + i * 10 * sc, 0, W, tint(s, '#2EF2FF', ui.dim), 0, 0.4 - i * 0.1);
  const n = 1 + Math.round(k * 6);
  const count = salvoCore(s, t, { x0: W * 0.05, x1: W * 0.95, gy, n, level: k, seed: 3 }, sc, ui);
  drawText(s, `LAUNCHES ${String(count + Math.floor(k * 140)).padStart(4, '0')}   PADS HOT ${n}`, 16, H - 70, 10, { color: ui.text, glow: 0.6 });
};

/** A lunar mass driver: an inclined rail of coils flinging capsules off the Moon, sparks at every exit. */
function massDriver(s: Surface, t: number, x0: number, x1: number, gy: number, k: number, sc: number, ui: Ui): void {
  const ax = x0 + (x1 - x0) * 0.08;
  const ay = gy - 4;
  const bx = x0 + (x1 - x0) * 0.78;
  const by = gy - 150 * sc;
  const len = Math.hypot(bx - ax, by - ay);
  const ux = (bx - ax) / len;
  const uy = (by - ay) / len;
  const col = tint(s, '#C9D6E8', ui.text);
  s.stroke([ax - uy * 4, ay + ux * 4, bx - uy * 4, by + ux * 4], { color: col, glow: 0.6 });
  s.stroke([ax + uy * 4, ay - ux * 4, bx + uy * 4, by - ux * 4], { color: col, glow: 0.6 });
  const cols = dustColors(s);
  const m = 3 + Math.round(k * 3);
  const P = 0.9;
  for (let j = 0; j < m; j++) {
    const ph = t / P + j / m;
    const f = frac(ph);
    const cyc = Math.floor(ph);
    const d = f < 0.6 ? len * (f / 0.6) ** 2 : len + (f - 0.6) * len * 5;
    const x = ax + ux * d;
    const y = ay + uy * d;
    s.stroke(xf([-5, -2, 5, -2, 5, 2, -5, 2], x, y, sc, Math.atan2(uy, ux)), { closed: true, color: tint(s, '#FFFFFF', ui.sel), glow: 1.2 });
    if (f < 0.6) {
      // The coil under the capsule lights up.
      s.stroke([x - uy * 8, y + ux * 8, x + uy * 8, y - ux * 8], { color: cols[j % cols.length] ?? '#FFFFFF', glow: 1.6, width: 2 });
      for (let q = 0; q < 6; q++) s.dot(x - ux * q * 6 + (hash01(q, cyc, j) - 0.5) * 6, y - uy * q * 6 + (hash01(q, cyc, j + 3) - 0.5) * 6, 1.4, cols[(q + j) % cols.length] ?? '#FFFFFF', 1 - q / 6);
    } else {
      dustBurst(s, bx, by, (f - 0.6) * P, cyc * 5 + j, { n: 50, speed: 200 * sc, life: 0.45, size: 1.3 });
    }
  }
}

/**
 * Launches from other worlds: three panels (LUNA with a mass driver, MARS and EUROPA with their own salvos),
 * each under its own coloured limb.
 */
export const worldsSalvo: DemoScene = (s, t, ui, k) => {
  const W = s.width;
  const H = s.height;
  const sc = (Math.min(W, H) / 720) * 0.8;
  dustField(s, t, 140, 12);
  const panels = [
    { name: 'LUNA  /  MASS DRIVER 2', col: '#C9D6E8' },
    { name: 'MARS  /  ARSIA PADS', col: '#FF6B3D' },
    { name: 'EUROPA  /  ICE YARD', col: '#8FE8FF' },
  ];
  const pw = W / 3;
  const gy = H * 0.82;
  const ctx = s.ctx;
  panels.forEach((p, j) => {
    const x0 = j * pw;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, 44, pw, H - 88);
    ctx.clip();
    const R = pw * 1.5;
    limb(s, x0 + pw / 2, gy + R, R, x0, x0 + pw, tint(s, p.col, ui.sub), 1.2);
    if (j === 0) massDriver(s, t, x0, x0 + pw, gy, k, sc, ui);
    else salvoCore(s, t + j * 0.7, { x0: x0 + pw * 0.12, x1: x0 + pw * 0.88, gy, n: 1 + Math.round(k * 2), level: 0.5 + 0.5 * k, seed: 20 + j, cycle: 2.2 }, sc, ui);
    ctx.restore();
    if (j > 0) s.stroke([x0, 60, x0, H - 60], { color: ui.dim, glow: 0, dash: [4, 6] });
    drawText(s, p.name, x0 + pw / 2, 62, 10, { align: 'center', color: tint(s, p.col, ui.text), glow: 0.8 });
  });
};

// ---------------------------------------------------------------------------------------------------------------
// Data centres on other worlds

const WORLDS = [
  { name: 'LUNAR FARM 7', col: '#C9D6E8', x: 0.15, y: 0.4, r: 0.1, ring: false },
  { name: 'OLYMPUS RACKS', col: '#FF6B3D', x: 0.37, y: 0.64, r: 0.13, ring: false },
  { name: 'EUROPA COLD STORE', col: '#8FE8FF', x: 0.6, y: 0.36, r: 0.11, ring: false },
  { name: 'JOVIAN RING DC', col: '#E8A86B', x: 0.83, y: 0.6, r: 0.16, ring: true },
] as const;

/**
 * Data centres on other worlds: four turning wire planets with racks blinking across their faces (10 + 16k each),
 * a ring of orbital nodes round the giant, and laser links between them carrying coloured packets.
 */
export const dcPlanets: DemoScene = (s, t, ui, k) => {
  const W = s.width;
  const H = s.height;
  const m = Math.min(W, H);
  const cols = dustColors(s);
  dustField(s, t, 120, 13);
  const step = Math.floor(t * (14 + 16 * k));
  for (let j = 0; j + 1 < WORLDS.length; j++) {
    const a = WORLDS[j];
    const b = WORLDS[j + 1];
    if (!a || !b) continue;
    const ax = a.x * W;
    const ay = a.y * H;
    const bx = b.x * W;
    const by = b.y * H;
    s.stroke([ax, ay, bx, by], { color: ui.dim, glow: 0, dash: [3, 5] });
    const packets = 4 + Math.round(k * 8);
    for (let q = 0; q < packets; q++) {
      const f = frac(t * (0.7 + k) + q / packets);
      s.dot(ax + (bx - ax) * f, ay + (by - ay) * f, 2.5, cols[(q + j) % cols.length] ?? '#FFFFFF', 1);
    }
    const pulse = frac(t * 1.6 + j * 0.3);
    s.stroke([ax + (bx - ax) * pulse, ay + (by - ay) * pulse, ax + (bx - ax) * Math.min(1, pulse + 0.12), ay + (by - ay) * Math.min(1, pulse + 0.12)], { color: tint(s, '#FFFFFF', ui.sel), glow: 2, width: 2 });
  }
  WORLDS.forEach((w, j) => {
    const cx = w.x * W;
    const cy = w.y * H;
    const R = w.r * m * 1.25;
    const col = tint(s, w.col, ui.text);
    const spin = t * (0.5 + k) * (j % 2 ? -1 : 1);
    wireSphere(s, cx, cy, R, spin, 4, 8, col);
    if (w.ring) {
      s.stroke(ell(cx, cy, R * 1.9, R * 0.42, -0.3, 48), { color: col, glow: 0.6, alpha: 0.7 });
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * TAU + t * 0.8;
        const ex = Math.cos(a) * R * 1.9;
        const ey = Math.sin(a) * R * 0.42;
        const x = cx + ex * Math.cos(-0.3) - ey * Math.sin(-0.3);
        const y = cy + ex * Math.sin(-0.3) + ey * Math.cos(-0.3);
        if (hash01(i, step, 3) > 0.3) s.dot(x, y, 2.4, cols[i % cols.length] ?? '#FFFFFF', 0.9);
      }
    }
    const rng = new Rng(500 + j);
    const sites = 10 + Math.round(k * 16);
    for (let i = 0; i < sites; i++) {
      const lon = rng.float(-Math.PI, Math.PI) + spin;
      const lat = Math.asin(rng.float(-0.8, 0.8));
      const z = Math.cos(lat) * Math.cos(lon);
      if (z < 0.1) continue;
      const x = cx + R * Math.cos(lat) * Math.sin(lon);
      const y = cy - R * Math.sin(lat);
      s.stroke([x - 4, y - 3, x + 4, y - 3, x + 4, y + 3, x - 4, y + 3], { closed: true, color: col, glow: 0.4, alpha: 0.5 + 0.5 * z });
      if (hash01(i, step, j) > 0.35) s.dot(x - 1, y, 2, cols[(i + j) % cols.length] ?? '#FFFFFF', z);
    }
    drawText(s, w.name, cx, cy + R + (w.ring ? 30 : 14), 9, { align: 'center', color: ui.text, glow: 0.5 });
  });
  drawText(s, `OFF-WORLD RACKS ${String(4000 + Math.floor(t * 3100 * (1 + k))).padStart(7, '0')}`, 16, H - 70, 10, { color: ui.text, glow: 0.6 });
};

// ---------------------------------------------------------------------------------------------------------------
// Lasers from the map

/**
 * Lasers from the world map: rocks fall from the top of the screen and beams from defence sites on the map burn
 * each one into a coloured burst. Rock j appears at j x gap (gap 0.3 / (1 + 2.5k) s) and dies 0.55-1.15 s later;
 * its beam shows for the last 0.14 s.
 */
export const laserMap: DemoScene = (s, t, ui, k) => {
  const W = s.width;
  const H = s.height;
  const cols = dustColors(s);
  dustField(s, t, 90, 14);
  const mw = Math.min(W - 40, H * 0.5 * 2);
  const mh = mw / 2;
  const x0 = (W - mw) / 2;
  const y0 = H * 0.94 - mh;
  const px = (lon: number): number => x0 + ((lon + 180) / 360) * mw;
  const py = (lat: number): number => y0 + ((90 - lat) / 180) * mh;
  const mapCol = tint(s, '#3D7BFF', ui.sub);
  for (const line of (coastline as { lines: number[][] }).lines) {
    const pts: number[] = [];
    for (let i = 0; i + 1 < line.length; i += 2) pts.push(px(line[i] ?? 0), py(line[i + 1] ?? 0));
    s.stroke(pts, { color: mapCol, glow: 0.4 });
  }
  const rng = new Rng(77);
  const sites: { x: number; y: number }[] = [];
  for (let i = 0; i < 14; i++) sites.push({ x: px(rng.float(-120, 140)), y: py(rng.float(-35, 60)) });
  for (const st of sites) s.stroke([st.x - 4, st.y + 3, st.x, st.y - 4, st.x + 4, st.y + 3], { closed: true, color: tint(s, '#7CFF4F', ui.sel), glow: 1 });
  const gap = 0.3 / (1 + 2.5 * k);
  const last = Math.floor(t / gap);
  const first = Math.max(0, last - Math.ceil(2.4 / gap));
  let kills = 0;
  for (let j = first; j <= last; j++) {
    const sp = j * gap;
    const life = 0.55 + 0.6 * hash01(j, 1, 77);
    const kill = sp + life;
    const ax = W * (0.06 + 0.88 * hash01(j, 2, 77));
    const vy = ((y0 - 30) * (0.35 + 0.4 * hash01(j, 3, 77))) / life;
    const yAt = (tt: number): number => 20 + (tt - sp) * vy;
    const st = sites[j % sites.length];
    if (!st || t < sp) continue;
    if (t < kill) {
      const y = yAt(t);
      rock(s, ax, y, 7 + 6 * hash01(j, 4, 77), t * 3 + j, j, tint(s, '#FFB000', ui.text));
      s.stroke([ax, y - 10, ax, y - 34], { color: ui.dim, glow: 0, alpha: 0.6 });
      if (t > kill - 0.14) {
        const c = cols[j % cols.length] ?? '#FFFFFF';
        s.stroke([st.x, st.y, ax, y], { color: c, glow: 2, width: 3 });
        s.stroke([st.x, st.y, ax, y], { color: '#FFFFFF', glow: 0, width: 1 });
        s.circle(st.x, st.y, 6, { color: c, glow: 1.4 });
      }
    } else {
      kills++;
      dustBurst(s, ax, yAt(kill), t - kill, j * 13 + 5, { n: 64, speed: 240, life: 0.7, gravity: 60 });
    }
  }
  drawText(s, `INTERCEPTS ${String(last + 1 - kills + Math.floor(t * 9)).padStart(5, '0')}   BEAM SITES ${sites.length}`, 16, H - 70, 10, { color: ui.text, glow: 0.6 });
};

// ---------------------------------------------------------------------------------------------------------------
// Guided solar eruptions

/** Cubic Bezier point. Example: bez(0, a, b, c, d) = a; bez(1, a, b, c, d) = d. */
function bez(u: number, a: number, b: number, c: number, d: number): number {
  const v = 1 - u;
  return v * v * v * a + 3 * v * v * u * b + 3 * v * u * u * c + u * u * u * d;
}

/**
 * Steered solar eruptions: a churning wire Sun ringed by collector swarms; every 1 / (1 + k) s an eruption
 * leaves the surface and follows a chain of guide satellites (a cubic Bezier through them) to a rock, which
 * vaporises in a coloured burst.
 */
export const solar: DemoScene = (s, t, ui, k) => {
  const W = s.width;
  const H = s.height;
  dustField(s, t, 100, 15);
  const cx = W * 0.17;
  const cy = H * 0.55;
  const R = Math.min(W, H) * 0.26;
  const warm = s.palette.glow ? ['#FFFFFF', '#FFE14D', '#FF8A1F', '#FF3B6B', '#FF4FD8'] : dustColors(s);
  wireSphere(s, cx, cy, R, t * 0.4, 6, 10, tint(s, '#FF8A1F', ui.text));
  const churn = Math.floor(t * 12);
  for (let i = 0; i < 170; i++) {
    const a = (i / 170) * TAU;
    const rr = R * (1.02 + 0.14 * hash01(i, churn, 3) * (0.5 + k));
    s.dot(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 1.6, warm[i % warm.length] ?? '#FFFFFF', 0.75);
  }
  const swarm = 30 + Math.round(k * 40);
  for (let i = 0; i < swarm; i++) {
    const dir = i % 2 ? 1 : -1;
    const a = (i / swarm) * TAU + t * 0.5 * dir;
    const x = cx + Math.cos(a) * R * 1.55;
    const y = cy + Math.sin(a) * R * (i % 2 ? 0.5 : 1.3);
    s.stroke([x - 3, y - 1, x + 3, y + 1], { color: tint(s, '#2EF2FF', ui.sel), glow: 1 });
  }
  const P = 1 / (1 + k);
  const cur = Math.floor(t / P);
  for (let e = Math.max(0, cur - 1); e <= cur; e++) {
    const age = t - e * P;
    if (age < 0) continue;
    const a0 = -0.6 + 1.2 * hash01(e, 1, 9);
    const sx = cx + Math.cos(a0) * R;
    const sy = cy + Math.sin(a0) * R;
    const tx = W * (0.72 + 0.2 * hash01(e, 2, 9));
    const ty = H * (0.22 + 0.56 * hash01(e, 3, 9));
    const c1x = W * 0.42;
    const c1y = sy - H * 0.4 * (hash01(e, 4, 9) - 0.2);
    const c2x = W * 0.6;
    const c2y = ty + H * 0.3 * (hash01(e, 5, 9) - 0.5);
    for (const u of [0.3, 0.55, 0.8]) {
      const gx = bez(u, sx, c1x, c2x, tx);
      const gy = bez(u, sy, c1y, c2y, ty);
      s.stroke([gx, gy - 6, gx + 6, gy, gx, gy + 6, gx - 6, gy], { closed: true, color: tint(s, '#7CFF4F', ui.sel), glow: 1 });
      s.circle(gx, gy, 9 + 5 * frac(t * 3 + u), { color: tint(s, '#7CFF4F', ui.sub), glow: 0.6, alpha: 1 - frac(t * 3 + u) });
    }
    const f = age / 0.8;
    const tail = 0.35;
    for (let u = Math.max(0, f - tail); u <= Math.min(1, f); u += 0.005) {
      const x = bez(u, sx, c1x, c2x, tx);
      const y = bez(u, sy, c1y, c2y, ty);
      const q = Math.floor(u * 1000);
      const w = 8 + 26 * (f - u);
      const fade = (u - (f - tail)) / tail;
      for (let r = 0; r < 3; r++) s.dot(x + (hash01(q, e + r * 7, churn) - 0.5) * w, y + (hash01(q, e + r * 7 + 1, churn) - 0.5) * w, r === 0 ? 2.6 : 1.6, warm[(q + r) % warm.length] ?? '#FFFFFF', Math.max(0, fade));
    }
    if (f < 1) rock(s, tx, ty, 12, t * 2 + e, e, tint(s, '#FFB000', ui.text));
    else {
      dustBurst(s, tx, ty, age - 0.8, e * 11 + 3, { n: 130, speed: 320, life: 0.85 });
      if (age - 0.8 < 0.5) s.circle(tx, ty, 6 + (age - 0.8) * 160, { color: warm[2] ?? '#FFFFFF', glow: 1.2, alpha: 1 - (age - 0.8) / 0.5 });
    }
  }
  drawText(s, `CME ${String(cur).padStart(3, '0')} STEERED  /  TARGET VAPORISED  /  SUN: UNBOTHERED`, 16, H - 70, 10, { color: ui.text, glow: 0.6 });
};

// ---------------------------------------------------------------------------------------------------------------
// Wormhole

/**
 * The time warp as a wormhole flight: 26 rings rushing at the viewer down a tunnel whose far end swings around,
 * joined by longitudinal lines, with star streaks pouring out of the throat and a year counter running back to
 * 66 million years ago. Ring depth d in 0..1 (0 far, 1 here) scales the radius by d^2.6.
 */
export const wormhole: DemoScene = (s, t, ui, k) => {
  const W = s.width;
  const H = s.height;
  const cx = W / 2;
  const cy = H / 2 + 10;
  const Rmax = Math.hypot(W, H) * 0.6;
  const cols = dustColors(s);
  const centre = (d: number): { x: number; y: number } => ({
    x: cx + Math.sin(t * 1.3 + (1 - d) * 3.2) * W * 0.16 * (1 - d) ** 1.5,
    y: cy + Math.cos(t * 1.1 + (1 - d) * 2.6) * H * 0.14 * (1 - d) ** 1.5,
  });
  const N = 26;
  const M = 14;
  const sp = 0.55 + 0.6 * k;
  const rings: { d: number; i: number; pts: number[] }[] = [];
  for (let i = 0; i < N; i++) {
    const d = frac(i / N + t * sp);
    const c = centre(d);
    const r = 5 + Rmax * d ** 2.6;
    const rot = (1 - d) * 2.2 + t * 0.9;
    const pts: number[] = [];
    for (let v = 0; v < M; v++) {
      const a = rot + (v / M) * TAU;
      pts.push(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r * 0.9);
    }
    rings.push({ d, i, pts });
  }
  rings.sort((a, b) => a.d - b.d);
  // Star streaks out of the throat, behind the rings.
  const throat = centre(0);
  for (let i = 0; i < 150; i++) {
    const a = hash01(i, 1, 66) * TAU;
    const f = frac(hash01(i, 2, 66) + t * (1.1 + k));
    const d0 = 8 + Rmax * f ** 3;
    const d1 = d0 * 1.1 + 2;
    s.stroke([throat.x + Math.cos(a) * d0, throat.y + Math.sin(a) * d0, throat.x + Math.cos(a) * d1, throat.y + Math.sin(a) * d1], { color: cols[i % cols.length] ?? '#FFFFFF', glow: 0.6, alpha: f });
  }
  for (let j = 0; j < rings.length; j++) {
    const rg = rings[j];
    if (!rg) continue;
    const col = cols[(rg.i + Math.floor(t * 4)) % cols.length] ?? '#FFFFFF';
    s.stroke(rg.pts, { closed: true, color: col, glow: 1, alpha: 0.15 + 0.85 * rg.d });
    const nx = rings[j + 1];
    if (nx && nx.d > rg.d) {
      for (let v = 0; v < M; v += 2) s.stroke([rg.pts[2 * v] ?? 0, rg.pts[2 * v + 1] ?? 0, nx.pts[2 * v] ?? 0, nx.pts[2 * v + 1] ?? 0], { color: col, glow: 0, alpha: 0.12 + 0.4 * rg.d });
    }
  }
  for (let i = 0; i < 24; i++) {
    const a = hash01(i, Math.floor(t * 20), 5) * TAU;
    const r = 3 + 9 * hash01(i, Math.floor(t * 20), 6);
    s.dot(throat.x + Math.cos(a) * r, throat.y + Math.sin(a) * r, 1.6, '#FFFFFF', 0.8);
  }
  const years = Math.min(66_000_000, Math.floor(66e6 * Math.min(1, t / 1.8) ** 3));
  drawText(s, `T MINUS ${years.toLocaleString('en-US')} YEARS`, cx, H - 92, 14, { align: 'center', color: ui.sel, glow: 1.4 });
};

// ---------------------------------------------------------------------------------------------------------------
// Dinosaurs (wireframe, side view, facing right; units of body height, y up is negative)

const REX_BODY = [-1.0, -0.5, -0.55, -0.62, -0.1, -0.74, 0.22, -0.76, 0.36, -0.84, 0.42, -0.72, 0.32, -0.56, 0.12, -0.44, -0.12, -0.42, -0.55, -0.52];
const REX_HEAD = [0, -0.03, 0.05, -0.17, 0.36, -0.18, 0.44, -0.11, 0.42, -0.05, 0.2, -0.06, 0.38, -0.01, 0.34, 0.05, 0.05, 0.05];
const SAURO_BODY = [-1.2, -0.62, -0.7, -0.66, -0.35, -0.88, 0.05, -0.92, 0.35, -0.82, 0.45, -0.66, 0.3, -0.5, -0.3, -0.48, -0.7, -0.56];

/**
 * A wireframe tyrannosaur at (x, ground y), `h` px tall, facing `dir`. `look` tilts the head up (radians),
 * `cheer` waves the little arms, `walk` swings the legs; the tail sways with t.
 */
function trex(s: Surface, x: number, y: number, h: number, dir: number, t: number, look: number, cheer: number, walk: number, col: string): void {
  const body = REX_BODY.slice();
  body[1] = -0.5 + 0.05 * Math.sin(t * 3);
  s.stroke(xf(body, x, y, h, 0, dir), { closed: true, color: col, glow: 1 });
  // Head about the neck pivot (0.38, -0.80); looking up turns the snout towards the sky.
  const px = x + dir * 0.38 * h;
  const py = y - 0.8 * h;
  const head = REX_HEAD.slice();
  head[13] = 0.05 + 0.04 * Math.max(0, Math.sin(t * 9)) * (look > 0.3 ? 1 : 0);
  s.stroke(xf(head, px, py, h, -look * dir, dir), { closed: true, color: col, glow: 1.2 });
  const eye = xf([0.3, -0.13], px, py, h, -look * dir, dir);
  s.dot(eye[0] ?? px, eye[1] ?? py, 2.5, '#FFFFFF', 1);
  for (let l = 0; l < 2; l++) {
    const ph = t * 6 * walk + l * Math.PI;
    const sw = Math.sin(ph) * 0.08 * walk;
    s.stroke(xf([0, -0.5, 0.1 + sw, -0.25, -0.02 + sw, -0.08, 0.14 + sw, 0], x - dir * 0.04 * h * l, y, h, 0, dir), { color: col, glow: 0.9, alpha: l ? 0.6 : 1 });
  }
  const wave = cheer * (0.5 + 0.5 * Math.sin(t * 14));
  s.stroke(xf([0.3, -0.6, 0.38, -0.55 - 0.08 * wave, 0.43, -0.6 - 0.1 * wave], x, y, h, 0, dir), { color: col, glow: 0.9 });
}

/** A wireframe sauropod at (x, ground y), `h` px tall (body), neck swaying, head at about 1.8 h. */
function sauropod(s: Surface, x: number, y: number, h: number, dir: number, t: number, look: number, col: string): void {
  s.stroke(xf(SAURO_BODY, x, y, h, 0, dir), { closed: true, color: col, glow: 1 });
  const hx = 0.62 + 0.06 * Math.sin(t * 1.7) + look * 0.2;
  const hy = -1.8 - look * 0.15;
  for (const off of [0, 0.08]) {
    const pts: number[] = [];
    for (let i = 0; i <= 12; i++) {
      const u = i / 12;
      const v = 1 - u;
      pts.push(v * v * (0.33 + off) + 2 * v * u * (0.62 + off) + u * u * (hx + off * 0.5), v * v * -0.82 + 2 * v * u * -1.25 + u * u * hy);
    }
    s.stroke(xf(pts, x, y, h, 0, dir), { color: col, glow: 0.9 });
  }
  s.stroke(xf([hx, hy - 0.02, hx + 0.16, hy - 0.04 - look * 0.05, hx + 0.2, hy + 0.02, hx + 0.03, hy + 0.06], x, y, h, 0, dir), { closed: true, color: col, glow: 1.1 });
  for (const lx of [-0.5, -0.36, 0.14, 0.28]) s.stroke(xf([lx, -0.5, lx, 0, lx + 0.09, 0, lx + 0.09, -0.5], x, y, h, 0, dir), { color: col, glow: 0.7 });
}

const TRI_BODY = [-0.9, -0.35, -0.6, -0.56, -0.1, -0.62, 0.3, -0.56, 0.45, -0.42, 0.3, -0.3, -0.5, -0.28];
const TRI_FRILL = [0.35, -0.66, 0.48, -0.88, 0.63, -0.74, 0.58, -0.5];
const TRI_HEAD = [0.45, -0.56, 0.76, -0.46, 0.79, -0.36, 0.5, -0.3];

/** A wireframe triceratops: body, frill, beaked head nodding, three horns, four short legs. */
function triceratops(s: Surface, x: number, y: number, h: number, dir: number, t: number, col: string): void {
  const nod = 0.06 * Math.sin(t * 3);
  s.stroke(xf(TRI_BODY, x, y, h, 0, dir), { closed: true, color: col, glow: 1 });
  s.stroke(xf(TRI_FRILL, x, y + nod * h, h, 0, dir), { color: col, glow: 1 });
  s.stroke(xf(TRI_HEAD, x, y + nod * h, h, 0, dir), { closed: true, color: col, glow: 1.1 });
  for (const hn of [[0.55, -0.6, 0.82, -0.76], [0.62, -0.56, 0.88, -0.68], [0.74, -0.44, 0.84, -0.53]]) s.stroke(xf(hn, x, y + nod * h, h, 0, dir), { color: col, glow: 1.2 });
  for (const lx of [-0.6, -0.4, 0.1, 0.26]) s.stroke(xf([lx, -0.3, lx, 0], x, y, h, 0, dir), { color: col, glow: 0.8 });
}

const COW_BODY = [-0.5, -0.75, 0.35, -0.75, 0.4, -0.35, -0.5, -0.35];
const COW_HEAD = [0.35, -0.8, 0.6, -0.86, 0.66, -0.6, 0.45, -0.55];

/** A wireframe cow (for the tractor beam, naturally), turning slowly; `h` px tall. */
function cow(s: Surface, x: number, y: number, h: number, ang: number, col: string): void {
  s.stroke(xf(COW_BODY, x, y, h, ang), { closed: true, color: col, glow: 1 });
  s.stroke(xf(COW_HEAD, x, y, h, ang), { closed: true, color: col, glow: 1 });
  s.stroke(xf([0.4, -0.84, 0.36, -0.95, 0.52, -0.88, 0.56, -0.98], x, y, h, ang), { color: col, glow: 0.8 });
  for (const lx of [-0.42, -0.3, 0.2, 0.32]) s.stroke(xf([lx, -0.35, lx + 0.05 * Math.sin(ang * 9 + lx * 9), 0], x, y, h, ang), { color: col, glow: 0.8 });
  for (const sp of [[-0.25, -0.6], [0.05, -0.52], [0.15, -0.66]]) {
    const p = xf(sp, x, y, h, ang);
    s.dot(p[0] ?? x, p[1] ?? y, 3, col, 0.8);
  }
}

/** A palm: a leaning trunk and five drooping fronds that stir in the wind. */
function palm(s: Surface, x: number, y: number, h: number, t: number, col: string): void {
  const lean = 0.18 * h;
  s.stroke([x, y, x + lean * 0.4, y - h * 0.5, x + lean, y - h], { color: col, glow: 0.6 });
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.7 + 0.08 * Math.sin(t * 2 + i);
    const ex = x + lean + Math.cos(a) * h * 0.45;
    const ey = y - h + Math.sin(a) * h * 0.25 + h * 0.18;
    s.stroke([x + lean, y - h, (x + lean + ex) / 2, Math.min(y - h, ey) - h * 0.08, ex, ey], { color: col, glow: 0.6 });
  }
}

/** Rolling ground with a few ridges. */
function cretaceousGround(s: Surface, gy: number, col: string): void {
  const W = s.width;
  const pts: number[] = [];
  for (let i = 0; i <= 40; i++) pts.push((W * i) / 40, gy - 12 * Math.sin(i * 0.7) - 8 * Math.sin(i * 1.9));
  s.stroke(pts, { color: col, glow: 0.6 });
  for (let i = 0; i < 30; i++) s.stroke([hash01(i, 1, 3) * W, gy + 10 + hash01(i, 2, 3) * 60, hash01(i, 1, 3) * W + 14, gy + 10 + hash01(i, 2, 3) * 60], { color: col, glow: 0, alpha: 0.35 });
}

/**
 * Dinosaurs watching an impact: a tyrannosaur and a sauropod on a ridge turn their heads up to follow a bolide
 * that crosses the sky on a dust trail and lands on the horizon in a wire dome of fire, ejecta and a ground shock.
 * Cycle 2.4 s, impact at 0.9 s.
 */
export const dinoImpact: DemoScene = (s, t, ui, k) => {
  const W = s.width;
  const H = s.height;
  dustField(s, t, 110, 16);
  const gy = H * 0.76;
  const green = tint(s, '#7CFF4F', ui.text);
  cretaceousGround(s, gy, tint(s, '#3D7BFF', ui.sub));
  const C = 2.4;
  const cyc = Math.floor(t / C);
  const tc = t - cyc * C;
  const ix = W * (0.68 + 0.1 * hash01(cyc, 1, 4));
  const iy = gy - 6;
  const bolide = (te: number): { x: number; y: number } | null => {
    if (te < 0 || te > 0.9) return null;
    const f = te / 0.9;
    return { x: W * 0.98 + (ix - W * 0.98) * f, y: H * 0.06 + (iy - H * 0.06) * f * f };
  };
  dustTrail(s, tc, bolide, cyc * 3 + 1, 0.9, 0.015, 30, 10, 1.8);
  const b = bolide(tc);
  if (b) s.circle(b.x, b.y, 5, { color: '#FFFFFF', glow: 2 });
  const age = tc - 0.9;
  if (age >= 0) {
    const cols = dustColors(s);
    for (let i = 0; i < 4; i++) {
      const r = 10 + (age * (260 + 120 * k) * (1 - i * 0.18));
      s.stroke(ell(ix, iy, r, r * 0.8, 0, 36, Math.PI, TAU), { color: cols[(i + 1) % cols.length] ?? '#FFFFFF', glow: 1.3, alpha: Math.max(0, 1 - age / 1.4) });
    }
    dustBurst(s, ix, iy, age, cyc * 17 + 2, { n: 180 + Math.round(k * 120), speed: 520, life: 1.2, gravity: 320, from: Math.PI * 1.05, to: Math.PI * 1.95, size: 1.8 });
    const sh = age * W * 0.5;
    for (const sd of [-1, 1]) s.stroke([ix + sd * sh, iy + 4, ix + sd * (sh + 40), iy + 4], { color: '#FFFFFF', glow: 1.4, width: 2, alpha: Math.max(0, 1 - age) });
  }
  const shake = age >= 0 && age < 0.6 ? Math.sin(t * 70) * 4 * (1 - age / 0.6) : 0;
  const look = b ? 0.5 + 0.3 * (1 - (b.x - W * 0.3) / W) : age < 0.6 ? 0.25 : 0.1;
  trex(s, W * 0.2 + shake, gy, H * 0.22, 1, t, look, 0, age >= 0 ? 0.6 : 0, green);
  sauropod(s, W * 0.44 + shake, gy, H * 0.17, 1, t, look, green);
  // After the hit a pack of small raptors bolts away from it, and the pterosaurs scatter.
  if (age >= 0) {
    for (let j = 0; j < 3 + Math.round(k * 4); j++) {
      const x = W * 0.62 - age * W * (0.32 + 0.08 * hash01(j, cyc, 5)) - j * W * 0.035;
      trex(s, x, gy + 4, H * (0.07 + 0.02 * hash01(j, 2, 5)), -1, t * 1.7 + j, 0.2, 0, 1.6, green);
    }
    for (let j = 0; j < 4; j++) {
      const x = ix - age * W * (0.25 + 0.1 * j);
      const y = H * (0.22 + 0.06 * j) - age * 40;
      const flap = Math.sin(t * 16 + j) * 8;
      s.stroke([x - 14, y - flap, x, y, x + 14, y - flap], { color: green, glow: 0.8 });
    }
  }
  drawText(s, '66,000,000 BC  /  LOCAL OBSERVERS: CONCERNED', 16, H - 70, 10, { color: ui.text, glow: 0.6 });
};

/**
 * Dinosaurs and a launch, which makes no sense: a jungle of palms, a volcano puffing coloured ash, pterosaurs
 * flapping past, a tyrannosaur cheering and a sauropod craning its neck as a rocket lifts off the pad beside them.
 */
export const dinoLaunch: DemoScene = (s, t, ui, k) => {
  const W = s.width;
  const H = s.height;
  const sc = Math.min(W, H) / 720;
  dustField(s, t, 100, 17);
  const gy = H * 0.8;
  const green = tint(s, '#7CFF4F', ui.text);
  const sub = tint(s, '#3D7BFF', ui.sub);
  cretaceousGround(s, gy, sub);
  // Volcano with an ash plume.
  const vx = W * 0.86;
  s.stroke([vx - W * 0.12, gy - 4, vx - W * 0.02, gy - H * 0.3, vx + W * 0.02, gy - H * 0.3, vx + W * 0.12, gy - 4], { color: tint(s, '#FF6B3D', ui.text), glow: 0.9 });
  for (let p = 0; p < 3; p++) dustBurst(s, vx, gy - H * 0.3, frac(t / 1.3 + p / 3) * 1.3, Math.floor(t / 1.3 + p / 3) * 3 + p, { n: 50, speed: 150, life: 1.1, gravity: -20, from: Math.PI * 1.2, to: Math.PI * 1.8 });
  for (let i = 0; i < 6; i++) palm(s, W * (0.04 + i * 0.09 + (i > 2 ? 0.28 : 0)), gy - 2, H * (0.16 + 0.06 * hash01(i, 2, 8)), t, sub);
  // Pterosaurs: flapping Vs crossing the sky.
  for (let i = 0; i < 3 + Math.round(k * 3); i++) {
    const x = frac(hash01(i, 1, 9) + t * 0.15) * (W + 80) - 40;
    const y = H * (0.15 + 0.3 * hash01(i, 2, 9));
    const flap = Math.sin(t * 10 + i) * 8;
    s.stroke([x - 14, y - flap, x, y, x + 14, y - flap], { color: green, glow: 0.8 });
  }
  salvoCore(s, t, { x0: W * 0.46, x1: W * 0.6, gy, n: 1, level: 0.3, seed: 66, cycle: 2.4 }, sc, ui);
  trex(s, W * 0.33, gy, H * 0.2, 1, t, 0.5, 1, 0, green);
  // The tyrannosaur wears a fishbowl helmet: it is going up next.
  s.circle(W * 0.33 + 0.5 * H * 0.2, gy - 0.9 * H * 0.2, H * 0.2 * 0.32, { color: tint(s, '#2EF2FF', ui.sel), glow: 1.2 });
  s.dot(W * 0.33 + 0.62 * H * 0.2, gy - 1.05 * H * 0.2, 2.5, '#FFFFFF', 0.9);
  sauropod(s, W * 0.72, gy, H * 0.14, -1, t, 0.6, green);
  triceratops(s, W * 0.17, gy, H * 0.11, 1, t, green);
  drawText(s, 'CRETACEOUS LAUNCH COMPLEX 1  /  PAD CREW: UNCLEAR', 16, H - 70, 10, { color: ui.text, glow: 0.6 });
};

// ---------------------------------------------------------------------------------------------------------------
// The gray alien and the saucer

/** A saucer at (x, y), radius r: a hull of two ellipses, a dome, chasing rim lights. */
function saucer(s: Surface, x: number, y: number, r: number, t: number, ui: Ui): void {
  const col = tint(s, '#C9D6E8', ui.text);
  const cols = dustColors(s);
  s.stroke(ell(x, y, r, r * 0.22, 0, 40), { closed: true, color: col, glow: 1.2 });
  s.stroke(ell(x, y + r * 0.08, r * 0.62, r * 0.14, 0, 32, 0, Math.PI), { color: col, glow: 0.8 });
  s.stroke(ell(x, y - r * 0.12, r * 0.38, r * 0.3, 0, 24, Math.PI, TAU), { color: tint(s, '#2EF2FF', ui.sel), glow: 1.2 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + t * 4;
    if (Math.sin(a) < -0.2) continue;
    s.dot(x + Math.cos(a) * r * 0.92, y + Math.sin(a) * r * 0.2, 3, cols[(i + Math.floor(t * 8)) % cols.length] ?? '#FFFFFF', 1);
  }
}

/** A gray alien, `h` px tall, standing at (x, y): big head, almond eyes, one hand waving, one on a tablet. */
function grayAlien(s: Surface, x: number, y: number, h: number, t: number, ui: Ui): void {
  const col = tint(s, '#C9D6E8', ui.text);
  const hy = y - 0.8 * h;
  const head: number[] = [];
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * TAU;
    const narrow = 1 - 0.45 * Math.max(0, Math.sin(a));
    head.push(x + Math.cos(a) * 0.17 * h * narrow, hy + Math.sin(a) * 0.17 * h);
  }
  s.stroke(head, { closed: true, color: col, glow: 1.2 });
  const blink = frac(t / 2.3) > 0.95 ? 0.2 : 1;
  for (const sd of [-1, 1]) {
    const ex = x + sd * 0.065 * h;
    const ey = hy + 0.02 * h;
    for (const f of [1, 0.65, 0.3]) s.stroke(ell(ex, ey, 0.055 * h * f, 0.022 * h * f * blink, sd * 0.45, 18), { closed: true, color: tint(s, '#5A6270', ui.dim), glow: 0, width: 2 });
    s.dot(ex - sd * 0.015 * h, ey - 0.006 * h, 2, '#FFFFFF', 0.9);
  }
  s.stroke([x - 0.02 * h, hy + 0.11 * h, x + 0.02 * h, hy + 0.11 * h], { color: col, glow: 0.4 });
  s.stroke([x - 0.02 * h, y - 0.63 * h, x - 0.02 * h, y - 0.57 * h], { color: col, glow: 0.6 });
  s.stroke([x + 0.02 * h, y - 0.63 * h, x + 0.02 * h, y - 0.57 * h], { color: col, glow: 0.6 });
  s.stroke([x - 0.09 * h, y - 0.56 * h, x + 0.09 * h, y - 0.56 * h, x + 0.06 * h, y - 0.32 * h, x + 0.08 * h, y - 0.27 * h, x - 0.08 * h, y - 0.27 * h, x - 0.06 * h, y - 0.32 * h], { closed: true, color: col, glow: 1 });
  s.stroke([x - 0.05 * h, y - 0.27 * h, x - 0.06 * h, y], { color: col, glow: 0.9 });
  s.stroke([x + 0.05 * h, y - 0.27 * h, x + 0.06 * h, y], { color: col, glow: 0.9 });
  // Left hand on a tablet of blinking keys.
  s.stroke([x - 0.09 * h, y - 0.55 * h, x - 0.17 * h, y - 0.42 * h, x - 0.12 * h, y - 0.33 * h], { color: col, glow: 0.9 });
  const tx = x - 0.2 * h;
  const ty = y - 0.36 * h;
  s.stroke([tx, ty, tx + 0.1 * h, ty - 0.03 * h, tx + 0.1 * h, ty + 0.04 * h, tx, ty + 0.07 * h], { closed: true, color: tint(s, '#2EF2FF', ui.sel), glow: 1 });
  const cols = dustColors(s);
  for (let i = 0; i < 6; i++) if (hash01(i, Math.floor(t * 10), 2) > 0.4) s.dot(tx + 0.02 * h + (i % 3) * 0.03 * h, ty + 0.01 * h + Math.floor(i / 3) * 0.03 * h, 2, cols[i % cols.length] ?? '#FFFFFF', 1);
  // Right arm waving, three long fingers.
  const wave = Math.sin(t * 7) * 0.5;
  const ex = x + 0.2 * h;
  const ey = y - 0.66 * h;
  const hx = ex + Math.sin(wave) * 0.13 * h;
  const hy2 = ey - Math.cos(wave) * 0.13 * h;
  s.stroke([x + 0.09 * h, y - 0.55 * h, ex, ey, hx, hy2], { color: col, glow: 0.9 });
  for (let f = -1; f <= 1; f++) s.stroke([hx, hy2, hx + Math.sin(wave + f * 0.35) * 0.05 * h, hy2 - Math.cos(wave + f * 0.35) * 0.05 * h], { color: col, glow: 0.8 });
}

/**
 * Outside help: a saucer (more of them with k) hauls a rock away from HOME in a tractor beam of rising dust, while
 * its gray pilot waves from the foreground and types "HAPPY TO HELP".
 */
export const ufo: DemoScene = (s, t, ui, k) => {
  const W = s.width;
  const H = s.height;
  const cols = dustColors(s);
  dustField(s, t, 140, 18);
  const gy = H * 0.9;
  const R = W * 1.4;
  limb(s, W / 2, gy + R, R, 0, W, tint(s, '#7CFF4F', ui.sub), 1.2);
  for (let i = 1; i <= 2; i++) limb(s, W / 2, gy + R, R + i * 10, 0, W, tint(s, '#2EF2FF', ui.dim), 0, 0.35 - i * 0.1);
  const extra = Math.round(k * 4);
  for (let i = 0; i < extra; i++) {
    const x = frac(hash01(i, 1, 21) + t * (0.1 + 0.1 * hash01(i, 2, 21))) * W;
    saucer(s, x, H * (0.12 + 0.12 * hash01(i, 3, 21)), 18 + 10 * hash01(i, 4, 21), t + i, ui);
  }
  const ux = W * 0.6 + Math.sin(t * 1.3) * W * 0.04;
  const uy = H * 0.26 + Math.sin(t * 2.1) * 6;
  const ur = Math.min(W, H) * 0.14;
  const C = 2.2;
  const cyc = Math.floor(t / C);
  const f = (t - cyc * C) / C;
  const rx = ux + Math.sin(t * 2) * 6;
  const ry = gy - H * 0.12 - f * (gy - H * 0.12 - uy - ur * 0.6);
  const bw = ur * 0.5;
  const beamCol = tint(s, '#7CFF4F', ui.sel);
  s.stroke([ux - ur * 0.25, uy + ur * 0.18, rx - bw, gy - H * 0.06], { color: beamCol, glow: 1, alpha: 0.7 });
  s.stroke([ux + ur * 0.25, uy + ur * 0.18, rx + bw, gy - H * 0.06], { color: beamCol, glow: 1, alpha: 0.7 });
  for (let i = 0; i < 5; i++) {
    const g = frac(i / 5 - t * 1.2);
    const yy = uy + ur * 0.18 + g * (gy - H * 0.06 - uy - ur * 0.18);
    const half = ur * 0.25 + g * (bw - ur * 0.25);
    s.stroke(ell(ux + (rx - ux) * g, yy, half, half * 0.18, 0, 24), { closed: true, color: beamCol, glow: 0.6, alpha: 0.5 * (1 - g) + 0.2 });
  }
  for (let i = 0; i < 70; i++) {
    const g = frac(hash01(i, 1, 23) - t * 0.8);
    const yy = uy + ur * 0.18 + g * (gy - H * 0.06 - uy - ur * 0.18);
    const half = ur * 0.25 + g * (bw - ur * 0.25);
    s.dot(ux + (rx - ux) * g + (hash01(i, 2, 23) - 0.5) * 2 * half, yy, 1.5, cols[i % cols.length] ?? '#FFFFFF', 0.8);
  }
  rock(s, rx, ry, ur * 0.28, t * 1.5, cyc, tint(s, '#FFB000', ui.text));
  // A cow rides up the beam under the rock. Nobody asked for the cow.
  cow(s, rx - ur * 0.1, ry + ur * 0.75, ur * 0.4, Math.sin(t * 1.4) * 0.6, tint(s, '#FFFFFF', ui.sel));
  if (f > 0.9) dustBurst(s, ux, uy + ur * 0.2, (f - 0.9) * C, cyc, { n: 60, speed: 200, life: 0.4 });
  saucer(s, ux, uy, ur, t, ui);
  grayAlien(s, W * 0.2, gy - 6, H * 0.5, t, ui);
  grayAlien(s, W * 0.86, gy - 6, H * 0.3, t * 1.3 + 2, ui);
  const msg = 'HAPPY TO HELP.';
  const n = Math.min(msg.length, Math.floor(frac(t / 2.2) * 2.2 * 14));
  drawText(s, `${msg.slice(0, n)}${Math.floor(t * 4) % 2 ? '_' : ''}`, W * 0.2 + H * 0.13, gy - H * 0.52, 14, { color: tint(s, '#7CFF4F', ui.sel), glow: 1.4 });
};

// ---------------------------------------------------------------------------------------------------------------
// Hit after hit (owner 2026-10-20: "the asteroids just hit after hit and hit, or earth getting hit and hit and hit")

/** Hits land every HIT_P s at i x HIT_P + 0.1, so any cut of 0.34 s or more shows at least one. */
const HIT_P = 0.3;

/**
 * A big asteroid struck again and again: an impactor streaks in every 0.3 s from a new side and lands in a cone of
 * pixel dust, a ring, a crack and three chunks thrown off; the rock jolts with each hit.
 */
export const rockHits: DemoScene = (s, t, ui, k) => {
  const W = s.width;
  const H = s.height;
  const cx = W / 2;
  const cy = H / 2 + 10;
  const R = Math.min(W, H) * 0.22;
  dustField(s, t, 80, 31);
  const cur = Math.floor((t - 0.1) / HIT_P);
  const since = t - (cur * HIT_P + 0.1);
  const jolt = since >= 0 && since < 0.2 ? Math.sin(t * 90) * 7 * (1 - since / 0.2) : 0;
  const body: number[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU + t * 0.4;
    const r = R * (0.78 + 0.3 * hash01(i, 3, 31));
    body.push(cx + jolt + Math.cos(a) * r, cy + Math.sin(a) * r * 0.85);
  }
  const rockCol = tint(s, '#FFB000', ui.text);
  s.stroke(body, { closed: true, color: rockCol, glow: 1.2 });
  for (let i = 0; i < 5; i++) {
    const a = hash01(i, 1, 32) * TAU + t * 0.4;
    s.stroke(ell(cx + jolt + Math.cos(a) * R * 0.45, cy + Math.sin(a) * R * 0.35, R * 0.12, R * 0.06, a, 14), { closed: true, color: rockCol, glow: 0.3, alpha: 0.6 });
  }
  const cols = dustColors(s);
  for (let i = Math.max(0, cur - 3); i <= cur + 1; i++) {
    const at = i * HIT_P + 0.1;
    const a = hash01(i, 1, 33) * TAU;
    const hx = cx + jolt + Math.cos(a) * R * 0.85;
    const hy = cy + Math.sin(a) * R * 0.72;
    const dt = t - at;
    const col = cols[i % cols.length] ?? '#FFFFFF';
    if (dt < 0 && dt > -0.15) {
      const f = 1 + dt / 0.15;
      const d = R * 2.6 * (1 - f);
      s.stroke([hx + Math.cos(a) * (d + 36), hy + Math.sin(a) * (d + 36), hx + Math.cos(a) * d, hy + Math.sin(a) * d], { color: '#FFFFFF', glow: 1.6, width: 2 });
    } else if (dt >= 0 && dt < 1.2) {
      dustBurst(s, hx, hy, dt, i * 13 + 1, { n: 120 + Math.round(80 * k), speed: 420, life: 0.8, size: 1.6, from: a - 1.2, to: a + 1.2 });
      if (dt < 0.45) s.circle(hx, hy, 4 + dt * 260, { color: col, glow: 1.4, alpha: 1 - dt / 0.45 });
      const crack: number[] = [hx, hy];
      for (let c = 1; c <= 3; c++) crack.push(hx - Math.cos(a) * R * 0.18 * c + (hash01(i, c, 34) - 0.5) * 16, hy - Math.sin(a) * R * 0.18 * c + (hash01(i, c, 35) - 0.5) * 16);
      s.stroke(crack, { color: '#FFFFFF', glow: 1, alpha: Math.max(0, 1 - dt) });
      for (let c = 0; c < 3; c++) {
        const da = a + (c - 1) * 0.5;
        rock(s, hx + Math.cos(da) * 240 * dt, hy + Math.sin(da) * 240 * dt, 6 + 4 * hash01(i, c, 36), t * 6 + c, i * 3 + c, rockCol);
      }
    }
  }
  drawText(s, `KINETIC IMPACTS ${String(Math.max(0, cur + 1)).padStart(3, '0')}   HIT  HIT  HIT`, 16, H - 70, 10, { color: ui.text, glow: 0.6 });
};

/**
 * HOME hit again and again: a big wire Earth takes a strike every 0.3 s somewhere on its face, each with a streak, a
 * flattened shock ring, coloured ejecta and a glowing scar that stays for a few seconds; the planet jolts.
 */
export const earthHits: DemoScene = (s, t, ui, k) => {
  const W = s.width;
  const H = s.height;
  const cx = W / 2;
  const cy = H / 2 + 14;
  const R = Math.min(W, H) * 0.32;
  dustField(s, t, 90, 37);
  const cur = Math.floor((t - 0.1) / HIT_P);
  const since = t - (cur * HIT_P + 0.1);
  const jolt = since >= 0 && since < 0.25 ? Math.sin(t * 80) * 8 * (1 - since / 0.25) : 0;
  const ex = cx + jolt;
  wireSphere(s, ex, cy, R, t * 0.3, 6, 12, tint(s, '#7CFF4F', ui.text));
  for (let i = 1; i <= 3; i++) s.circle(ex, cy, R + i * 7, { color: tint(s, '#2EF2FF', ui.dim), glow: 0, alpha: 0.4 - i * 0.1 });
  const cols = dustColors(s);
  const warm = s.palette.glow ? ['#FFFFFF', '#FFE14D', '#FF8A1F', '#FF3B6B'] : cols;
  for (let i = Math.max(0, cur - 12); i <= cur + 1; i++) {
    const at = i * HIT_P + 0.1;
    const pa = hash01(i, 1, 38) * TAU;
    const pr = R * 0.85 * Math.sqrt(hash01(i, 2, 38));
    const hx = ex + Math.cos(pa) * pr;
    const hy = cy + Math.sin(pa) * pr;
    const dt = t - at;
    const inA = -Math.PI / 2 + (hash01(i, 3, 38) - 0.5) * 2;
    if (dt < 0 && dt > -0.16) {
      const f = 1 + dt / 0.16;
      const d = R * 2 * (1 - f);
      s.stroke([hx - Math.cos(inA) * (d + 40), hy + Math.sin(inA) * (d + 40), hx - Math.cos(inA) * d, hy + Math.sin(inA) * d], { color: '#FFFFFF', glow: 1.8, width: 2 });
    } else if (dt >= 0) {
      // A scar that cools over 3.5 s.
      if (dt < 3.5) for (let q = 0; q < 6; q++) s.dot(hx + (hash01(i, q, 39) - 0.5) * 10, hy + (hash01(i, q, 40) - 0.5) * 6, 2, warm[q % warm.length] ?? '#FFFFFF', (1 - dt / 3.5) * (0.5 + 0.5 * hash01(i, q, Math.floor(t * 20))));
      if (dt < 1.2) {
        const flat = 0.35 + 0.65 * Math.sqrt(Math.max(0, 1 - (pr / R) ** 2));
        for (let r = 0; r < 2; r++) if (dt < 0.6) s.stroke(ell(hx, hy, 4 + dt * (180 + 120 * k) * (1 - r * 0.35), (4 + dt * (180 + 120 * k) * (1 - r * 0.35)) * flat, pa, 30), { closed: true, color: cols[(i + r) % cols.length] ?? '#FFFFFF', glow: 1.3, alpha: 1 - dt / 0.6 });
        dustBurst(s, hx, hy, dt, i * 17 + 5, { n: 110 + Math.round(70 * k), speed: 360, life: 0.9, size: 1.6, gravity: 140, from: Math.PI * 1.05, to: Math.PI * 1.95 });
      }
    }
  }
  drawText(s, `HOME  HIT ${String(Math.max(0, cur + 1)).padStart(3, '0')}   SIMULATED, NOT SURVIVED`, cx, H - 70, 11, { align: 'center', color: ui.text, glow: 0.6 });
};

// ---------------------------------------------------------------------------------------------------------------
// The laser battle

/**
 * Lasers from everywhere: HOME ringed by 8 + 12k satellites, the Moon, Mars and an orbital station all firing at
 * rocks that pour in from every side faster and faster (r0 (t + t^2 / 2) rocks by local time t, r0 = 3 + 9k), one to
 * three beams converging on each.
 */
export const laserFleet: DemoScene = (s, t, ui, k) => {
  const W = s.width;
  const H = s.height;
  const m = Math.min(W, H);
  const cols = dustColors(s);
  dustField(s, t, 110, 41);
  const ex = W * 0.5;
  const ey = H * 0.6;
  const R = m * 0.14;
  wireSphere(s, ex, ey, R, t * 0.5, 5, 10, tint(s, '#7CFF4F', ui.text));
  const moon = { x: W * 0.84, y: H * 0.3 };
  const mars = { x: W * 0.13, y: H * 0.26 };
  const station = { x: W * 0.5, y: H * 0.15 };
  wireSphere(s, moon.x, moon.y, R * 0.32, t, 3, 6, tint(s, '#C9D6E8', ui.sub));
  wireSphere(s, mars.x, mars.y, R * 0.38, -t * 0.8, 3, 6, tint(s, '#FF6B3D', ui.sub));
  s.stroke(ell(station.x, station.y, R * 0.6, R * 0.16, 0, 32), { closed: true, color: tint(s, '#FFE14D', ui.text), glow: 1.2 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + t;
    s.stroke([station.x, station.y, station.x + Math.cos(a) * R * 0.6, station.y + Math.sin(a) * R * 0.16], { color: tint(s, '#FFE14D', ui.sub), glow: 0.4, alpha: 0.6 });
  }
  const em: { x: number; y: number }[] = [moon, mars, station];
  const nSat = 8 + Math.round(12 * k);
  for (let i = 0; i < nSat; i++) {
    const a = (i / nSat) * TAU + t * 0.7;
    const p = { x: ex + Math.cos(a) * R * 1.9, y: ey + Math.sin(a) * R * 0.6 };
    em.push(p);
    s.stroke([p.x - 4, p.y, p.x, p.y - 3, p.x + 4, p.y, p.x, p.y + 3], { closed: true, color: tint(s, '#2EF2FF', ui.sel), glow: 1 });
    s.stroke([p.x - 9, p.y, p.x + 9, p.y], { color: tint(s, '#3D7BFF', ui.sub), glow: 0.4 });
  }
  const r0 = 3 + 9 * k;
  const count = (tt: number): number => (tt <= 0 ? 0 : r0 * (tt + (tt * tt) / 2));
  const spawn = (j: number): number => -1 + Math.sqrt(1 + (2 * j) / r0);
  const jmax = Math.floor(count(t));
  const jmin = Math.max(0, Math.floor(count(t - 1.6)));
  let beams = 0;
  const diag = Math.hypot(W, H) * 0.6;
  for (let j = jmin; j <= jmax; j++) {
    const sj = spawn(j);
    const life = 0.45 + 0.4 * hash01(j, 1, 42);
    const kill = sj + life;
    const a = hash01(j, 2, 42) * TAU;
    const sx = ex + Math.cos(a) * diag;
    const sy = ey + Math.sin(a) * diag;
    const at = (tt: number): { x: number; y: number } => {
      const f = Math.min(1, (tt - sj) / 1.4);
      return { x: sx + (ex - sx) * f, y: sy + (ey - sy) * f };
    };
    if (t < sj) continue;
    if (t < kill) {
      const p = at(t);
      rock(s, p.x, p.y, 6 + 5 * hash01(j, 3, 42), t * 4 + j, j, tint(s, '#FFB000', ui.text));
      if (t > kill - 0.13) {
        const nb = 1 + Math.floor(hash01(j, 4, 42) * (1 + 2.99 * k));
        for (let b = 0; b < nb; b++) {
          const e = em[Math.floor(hash01(j, 5 + b, 42) * em.length)];
          if (!e) continue;
          beams++;
          const c = cols[(j + b) % cols.length] ?? '#FFFFFF';
          s.stroke([e.x, e.y, p.x, p.y], { color: c, glow: 2, width: 2.5 });
          s.stroke([e.x, e.y, p.x, p.y], { color: '#FFFFFF', glow: 0, width: 1 });
        }
      }
    } else {
      const p = at(kill);
      dustBurst(s, p.x, p.y, t - kill, j * 11 + 7, { n: 70, speed: 260, life: 0.6 });
    }
  }
  drawText(s, `BEAMS FIRING ${String(beams).padStart(2, '0')}   ROCKS BURNED ${String(Math.max(0, jmin + Math.floor((jmax - jmin) / 2))).padStart(4, '0')}`, 16, H - 70, 10, { color: ui.text, glow: 0.6 });
};

// ---------------------------------------------------------------------------------------------------------------
// The mothership

/**
 * The mothership: a hull across the top of the screen with a row of windows, a gray head bobbing in each, chasing
 * lights, small saucers dropping from its bay to laser rocks, and every 1.6 s a great beam that shatters a big rock.
 */
export const mothership: DemoScene = (s, t, ui, k) => {
  const W = s.width;
  const H = s.height;
  const cols = dustColors(s);
  dustField(s, t, 130, 43);
  const R = W * 1.4;
  limb(s, W / 2, H * 0.94 + R, R, 0, W, tint(s, '#7CFF4F', ui.sub), 1.2);
  const hx = W / 2;
  const hy = H * 0.2;
  const rx = W * 0.42;
  const ry = H * 0.075;
  const hull = tint(s, '#C9D6E8', ui.text);
  s.stroke(ell(hx, hy, rx, ry, 0, 64), { closed: true, color: hull, glow: 1.3 });
  s.stroke(ell(hx, hy - ry * 0.4, rx * 0.55, ry * 1.1, 0, 40, Math.PI, TAU), { color: hull, glow: 1 });
  s.stroke(ell(hx, hy + ry * 0.35, rx * 0.8, ry * 0.4, 0, 48, 0, Math.PI), { color: hull, glow: 0.6, alpha: 0.7 });
  const nWin = 13;
  for (let i = 0; i < nWin; i++) {
    const wx = hx + (i - (nWin - 1) / 2) * rx * 0.13;
    const wy = hy - ry * 0.1;
    s.stroke([wx - 9, wy - 7, wx + 9, wy - 7, wx + 9, wy + 7, wx - 9, wy + 7], { closed: true, color: tint(s, '#2EF2FF', ui.sub), glow: 0.6 });
    const bob = Math.sin(t * 5 + i) * 1.5;
    s.stroke(ell(wx, wy - 1 + bob, 4, 5, 0, 12), { closed: true, color: hull, glow: 0.6 });
    s.dot(wx - 1.6, wy - 1 + bob, 1.6, '#000000', 1);
    s.dot(wx + 1.6, wy - 1 + bob, 1.6, '#000000', 1);
  }
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU + t * 3;
    if (Math.sin(a) < 0) continue;
    s.dot(hx + Math.cos(a) * rx * 0.97, hy + Math.sin(a) * ry * 0.9, 3, cols[(i + Math.floor(t * 10)) % cols.length] ?? '#FFFFFF', 1);
  }
  // Small saucers dropping from the bay to laser rocks below.
  const nS = 3 + Math.round(4 * k);
  for (let i = 0; i < nS; i++) {
    const ph = frac(t / 1.3 + i / nS);
    const cyc = Math.floor(t / 1.3 + i / nS);
    const tx = W * (0.08 + 0.84 * hash01(i, cyc, 44));
    const ty = H * (0.55 + 0.25 * hash01(i, cyc, 45));
    const sx = hx + (tx - hx) * Math.min(1, ph * 2);
    const sy = hy + ry + (ty - H * 0.18 - hy - ry) * Math.min(1, ph * 2);
    saucer(s, sx, sy, 16, t + i, ui);
    if (ph < 0.75) rock(s, tx, ty, 9, t * 3 + i, i + cyc, tint(s, '#FFB000', ui.text));
    if (ph > 0.6 && ph < 0.75) s.stroke([sx, sy + 4, tx, ty], { color: tint(s, '#7CFF4F', ui.sel), glow: 1.8, width: 2 });
    if (ph >= 0.75) dustBurst(s, tx, ty, (ph - 0.75) * 1.3, cyc * 7 + i, { n: 60, speed: 220, life: 0.5 });
  }
  // The great beam.
  const B = 1.6;
  const bc = Math.floor(t / B);
  const bt = t - bc * B;
  const gx = W * (0.3 + 0.4 * hash01(bc, 1, 46));
  const gy = H * 0.72;
  if (bt < 0.9) rock(s, gx, gy, 30, t, bc, tint(s, '#FFB000', ui.text));
  if (bt > 0.5 && bt < 0.9) {
    for (let l = -2; l <= 2; l++) s.stroke([hx + l * 5, hy + ry, gx + l * 4, gy], { color: cols[(l + 2 + bc) % cols.length] ?? '#FFFFFF', glow: 2, width: 2 });
  }
  if (bt >= 0.9) dustBurst(s, gx, gy, bt - 0.9, bc * 3 + 1, { n: 220, speed: 480, life: 0.7, size: 1.8 });
  drawText(s, "MOTHERSHIP 'GOOD NEIGHBOUR' ON STATION   CREW WAVING", 16, H - 70, 10, { color: ui.text, glow: 0.6 });
};

// ---------------------------------------------------------------------------------------------------------------
// Multiple realities (owner 2026-10-20: "make time warps and multiple realities split the screen into 4 ... then split
// those in 4 after with more wormholes to make 16 simulations all different playing out")

/**
 * Draw `scene` into the cell (x, y, w, h) as a miniature screen: clipped, translated and scaled by 1/2, the scene
 * laid out on a surface twice the cell's size (so its text and craft shrink with it). `plain` drops the glow pass
 * for the cell (sixteen scenes at once would otherwise cost about 30 ms a frame); the surface's mode is restored.
 */
function inCell(s: Surface, x: number, y: number, w: number, h: number, scene: DemoScene, t: number, ui: Ui, k: number, plain: boolean): void {
  const ctx = s.ctx;
  const glow = s.glowMode;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.translate(x, y);
  ctx.scale(0.5, 0.5);
  if (plain) s.glowMode = 'none';
  try {
    scene({ ...s, width: w * 2, height: h * 2 }, t, ui, k);
  } finally {
    s.glowMode = glow;
    ctx.restore();
  }
}

/** A small wormhole throat at a cell junction: coloured rings shrinking into it, turning. */
function throat(s: Surface, x: number, y: number, r: number, t: number, seed: number): void {
  const cols = dustColors(s);
  for (let i = 0; i < 7; i++) {
    const d = frac(i / 7 + t * 0.9);
    const rr = 2 + r * d * d;
    const pts: number[] = [];
    for (let v = 0; v < 10; v++) {
      const a = (v / 10) * TAU + (1 - d) * 2 + t + seed;
      pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.85);
    }
    s.stroke(pts, { closed: true, color: cols[(i + seed) % cols.length] ?? '#FFFFFF', glow: 1, alpha: 0.2 + 0.8 * d });
  }
}

/**
 * Lay out an n x n grid of realities. During the first OPEN_S seconds each cell grows out of its parent's centre
 * (the split); borders are drawn in the dust colours, wormhole throats sit on the inner junctions, and each cell
 * carries a REALITY label.
 */
function realities(s: Surface, t: number, ui: Ui, k: number, n: number, cast: readonly (readonly [DemoScene, number])[], prefix: string): void {
  const OPEN_S = 0.35;
  const W = s.width;
  const H = s.height;
  const cols = dustColors(s);
  const open = Math.min(1, t / OPEN_S);
  const e = 1 - (1 - open) ** 3;
  const cw = W / n;
  const ch = H / n;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const i = r * n + c;
      const entry = cast[i % cast.length];
      if (!entry) continue;
      // Grow from the centre of the parent cell (the half grid) into place.
      const pc = Math.floor(c / 2) * 2 + 1;
      const pr = Math.floor(r / 2) * 2 + 1;
      const fx = n === 2 ? W / 2 : pc * cw;
      const fy = n === 2 ? H / 2 : pr * ch;
      const x = fx + (c * cw - fx) * e;
      const y = fy + (r * ch - fy) * e;
      const w = cw * e;
      const h = ch * e;
      if (w < 4 || h < 4) continue;
      inCell(s, x, y, w, h, entry[0], t + entry[1], ui, Math.min(1, k * (0.7 + 0.3 * hash01(i, 1, 47)) + 0.1), n > 2);
      s.stroke([x + 1, y + 1, x + w - 1, y + 1, x + w - 1, y + h - 1, x + 1, y + h - 1], { closed: true, color: cols[(i + Math.floor(t * 3)) % cols.length] ?? '#FFFFFF', glow: 1, width: 1.5 });
      drawText(s, `${prefix} ${String(i + 1).padStart(2, '0')}`, x + 8, y + 8, n > 2 ? 7 : 9, { color: ui.sel, glow: 0.6 });
    }
  }
  for (let r = 1; r < n; r++) for (let c = 1; c < n; c++) throat(s, c * cw, r * ch, Math.min(cw, ch) * (r === n / 2 && c === n / 2 ? 0.22 : 0.12) * e, t, r * 3 + c);
}

/** Four realities, each a different simulation, opening out of one wormhole. */
export const split4: DemoScene = (s, t, ui, k) => {
  realities(s, t, ui, k, 2, [[earthHits, 0.4], [dinoImpact, 0.6], [laserFleet, 1.2], [ufo, 0.8]], 'REALITY');
};

/**
 * Sixteen realities: every one of the four splits again, all different, wormholes at every junction.
 * NOTE: cast chosen for cost (measured 2026-10-20, Chrome, 1440 px, glow off in the cells): the launch salvos and
 * the laser battle are 2-3 ms each at this size, the rest 0.3-1.5 ms; with them in, sixteen cells took 30 ms a frame.
 */
export const split16: DemoScene = (s, t, ui, k) => {
  realities(s, t, ui, k, 4, [
    [racks, 0.5], [rockHits, 0.2], [laserMap, 0.7], [dinoLaunch, 0.4],
    [mothership, 0.9], [earthHits, 1.1], [solar, 0.6], [strike, 0.3],
    [dcPlanets, 0.3], [wormhole, 1], [ufo, 1.5], [impacts, 1.2],
    [dinoImpact, 0.75], [dcGlobe, 0.4], [planning, 0.8], [rockHits, 2.3],
  ], 'SIM');
};
