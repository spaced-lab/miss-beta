// WHAT: The LAUNCH cinematic: pad, tower, terrain and stars in pixel art, the rocket as a 3-D wireframe that rolls
//       and pitches along the arc (vehicle.ts), its false-colour pixel plume, embers, fine pad smoke and the spent
//       stages tumbling away as solids.
// WHY:  Owner 2026-10-18: "increase launch animations to finer pixels and use false colour for the head of
//       thrust and tiny pixels". Split out of draw.ts so the launch, the scene with the most pixels, has one home.
// HOW:  Pure functions of (scene, elapsed): positions come from launchArc / launchProgress and `hash01` noise keyed
//       on (index, 30 Hz frame, scene seed), so a frame redraws identically and nothing is mutated. Cells are
//       KNOBS.CINE_LAUNCH_CELL_PX x the window scale, snapped to half pixels. The plume is drawn per nozzle as rows
//       of pixels across a widening jet: the first CINE_FALSE_HEAD_FRAC of it steps through the false-colour ramp
//       (white at the throat, then ice, cyan, magenta, violet), a dithered band hands off to the fire palette,
//       and the tail is orange, red and smoke. Shock diamonds flash the hottest step on the jet's axis. Embers are
//       one-pixel sparks on looping lifetimes, coloured by age on the same ramp.
// LORE: G8 (the look), M3 (launchers and C3)

import { KNOBS } from '../../config/knobs';
import type { Surface } from '../canvas';
import { falseRamp, falseStep, fireColor, hash01, pixelPalette, ROCKETS } from './pixel';
import { launchArc, launchProgress, type Scene } from './scene';
import { drawChunk, type Chunk } from './solid';
import { localToScreen, spentStage, vehicle } from './vehicle';

/** Launch cell size in CSS px for a window scale k: the knob times k, snapped to half pixels, 1 to CINE_LAUNCH_CELL_MAX_PX. */
export function launchCell(k: number): number {
  return Math.min(KNOBS.CINE_LAUNCH_CELL_MAX_PX, Math.max(1, Math.round(KNOBS.CINE_LAUNCH_CELL_PX * k * 2) / 2));
}

/** The vehicle's length on screen at scale k: the old sprite's rows at the uncapped cell, times CINE_VEHICLE_SCALE. */
export function vehicleLength(tier: number, k: number): number {
  const rows = ROCKETS[tier]?.length ?? ROCKETS[1]?.length ?? 28;
  return rows * KNOBS.CINE_LAUNCH_CELL_PX * k * KNOBS.CINE_VEHICLE_SCALE;
}

/** Stars, HOME's limb, terrain, the pad deck and the tower, as vector strokes that scale with the camera (owner
 *  2026-10-24: no blocks). Drawn under reduce-motion too (the still frame). */
export function drawLaunchStage(s: Surface, sc: Scene, elapsed: number, ox: number, oy: number, k: number): void {
  const p = s.palette;
  const pal = pixelPalette(s);
  for (let i = 0; i < 140; i++) {
    const sx = hash01(i, 1, sc.seed) * s.width;
    const sy = hash01(i, 2, sc.seed) * s.height * 0.7;
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(elapsed * (1 + hash01(i, 3)) * 2 + i));
    s.dot(sx, sy, hash01(i, 4) > 0.92 ? 2 : 1, hash01(i, 5) > 0.85 && s.spectrum ? s.role('orbit') : (pal.w ?? p.ink), tw * 0.8);
  }
  // HOME's limb as a vector arc with an atmosphere band.
  const limbR = 900 * k;
  s.circle(ox, oy + limbR, limbR, { color: s.role('planet'), glow: 1, width: 1.5 });
  for (let i = 1; i <= 3; i++) s.circle(ox, oy + limbR, limbR + i * 9 * k, { color: s.spectrum ? s.role('orbit') : p.dim, glow: 0, alpha: 0.35 - i * 0.08 });
  // Terrain: a ridge line of seeded heights across the pad, and a fainter far line behind it.
  const span = 300 * k;
  const step = 9 * k;
  const ridge: number[] = [];
  const far: number[] = [];
  for (let gx = -span; gx <= span; gx += step) {
    const i = Math.round(gx / step);
    // The ground follows the limb's curve: a flat line would float above the planet at the edges.
    const drop = (gx * gx) / (2 * limbR);
    ridge.push(ox + gx, oy + drop + 2 * k - (0.5 + hash01(Math.floor(i / 3) + 99, 7, sc.seed) * 3 + hash01(i + 99, 8, sc.seed) * 1.6) * 2.2 * k);
    far.push(ox + gx * 1.2, oy + (gx * 1.2 * gx * 1.2) / (2 * limbR) - 6 * k - hash01(i + 17, 9, sc.seed) * 9 * k);
  }
  s.stroke(far, { color: pal.k ?? p.dim, glow: 0, width: 1, alpha: 0.4 });
  s.stroke(ridge, { color: pal.G ?? p.ink, glow: 0.3, width: 1, alpha: 0.7 });
  const tier = sc.launch?.tier ?? 1;
  const len = vehicleLength(tier, k);
  const rw = len * (tier === 3 ? 0.42 : 0.2);
  // Pad deck: a plated slab with the flame trench open under the engines.
  const deckHalf = rw / 2 + 36 * k;
  const trench = rw * 0.3;
  const dh = 4 * k;
  for (const sx of [-1, 1]) {
    const x0 = ox + sx * trench;
    const x1 = ox + sx * deckHalf;
    s.stroke([x0, oy, x1, oy, x1, oy - dh, x0, oy - dh], { closed: true, color: pal.g ?? p.dim, glow: 0.2, width: 1, alpha: 0.9 });
    for (let x = Math.min(x0, x1) + 8 * k; x < Math.max(x0, x1); x += 8 * k) s.stroke([x, oy, x, oy - dh], { color: pal.k ?? p.dim, glow: 0, width: 1, alpha: 0.5 });
  }
  s.stroke([ox - trench, oy + 2 * k, ox + trench, oy + 2 * k], { color: pal.k ?? p.dim, glow: 0, width: 1, alpha: 0.6 });
  // Tower: a lattice as tall as the rocket, X-braced, two swing arms reaching to the rocket's side, a beacon.
  const th = len * 0.95;
  const tw = Math.max(6 * k, len * 0.09);
  const tcx = ox - rw / 2 - tw * 0.9 - 4 * k;
  const col = pal.g ?? p.dim;
  s.stroke([tcx - tw / 2, oy - dh, tcx - tw / 2, oy - dh - th], { color: col, glow: 0.3, width: 1 });
  s.stroke([tcx + tw / 2, oy - dh, tcx + tw / 2, oy - dh - th], { color: col, glow: 0.3, width: 1 });
  const bays = 9;
  for (let b = 0; b <= bays; b++) {
    const y = oy - dh - (b / bays) * th;
    s.stroke([tcx - tw / 2, y, tcx + tw / 2, y], { color: col, glow: 0, width: 1, alpha: 0.7 });
    if (b < bays) {
      const y2 = oy - dh - ((b + 1) / bays) * th;
      s.stroke([tcx - tw / 2, y, tcx + tw / 2, y2], { color: col, glow: 0, width: 1, alpha: 0.4 });
      s.stroke([tcx + tw / 2, y, tcx - tw / 2, y2], { color: col, glow: 0, width: 1, alpha: 0.4 });
    }
  }
  for (const f of [0.18, 0.55]) {
    const y = oy - dh - f * th;
    s.stroke([tcx + tw / 2, y, ox - rw / 2 - 2 * k, y], { color: col, glow: 0.3, width: 1.2 });
    s.stroke([tcx + tw / 2, y + 3 * k, ox - rw / 2 - 2 * k, y + 3 * k], { color: col, glow: 0, width: 1, alpha: 0.5 });
  }
  // The beacon flares once a second.
  s.stroke([tcx, oy - dh - th, tcx, oy - dh - th - 6 * k], { color: col, glow: 0, width: 1 });
  if (Math.floor(elapsed * 2) % 2 === 0) s.dot(tcx, oy - dh - th - 7 * k, Math.max(2, 2 * k), s.role('danger'), 0.9);
}

/** Colour of one plume pixel at fraction f down the jet (0 = nozzle), edge distance e in [0, 1]. */
function plumeColor(s: Surface, ramp: readonly string[], f: number, e: number, dither: number): string {
  if (!KNOBS.CINE_FALSE_COLOUR) return fireColor(s, (1 - f) * (1 - 0.3 * e));
  const head = KNOBS.CINE_FALSE_HEAD_FRAC;
  const band = KNOBS.CINE_FALSE_DITHER_FRAC;
  if (f < head) return falseStep(ramp, 1 - f / head - 0.35 * e);
  // Ordered hand-off: the share of false-colour pixels falls linearly across the band.
  if (f < head + band && dither > (f - head) / band) return falseStep(ramp, 0);
  return fireColor(s, 0.82 * (1 - (f - head) / (1 - head)) * (1 - 0.25 * e));
}

/** The rocket in flight with its plumes, embers, pad smoke, spent stages and the arc flown so far. */
export function drawLaunchVehicle(s: Surface, sc: Scene, t: number, X: (x: number) => number, Y: (y: number) => number, k: number): void {
  const launch = sc.launch;
  if (!launch) return;
  const pal = pixelPalette(s);
  const ramp = falseRamp(s.palette, s.spectrum);
  const u = launchProgress(t, sc.duration);
  const [x, y, tx, ty] = launchArc(u, launch.tier);
  const tier = launch.tier;
  const cell = launchCell(k);
  const heading = Math.atan2(tx, -ty);
  const ca = Math.cos(heading);
  const sa = Math.sin(heading);
  const frame = Math.floor(t * 30);
  // The vehicle (vehicle.ts): half a rocket length is the lathe's unit; the arc point is the core nozzle, so the
  // vehicle's centre sits one unit back up the heading. It rolls about its own axis as it climbs.
  const model = vehicle(tier);
  const size = vehicleLength(tier, k) / 2;
  const roll = t * 0.9 + sc.seed * 0.001;
  const nx0 = X(x);
  const ny0 = Y(y);
  const [bx0, by0] = localToScreen(0, 1, 0, size, roll, heading);
  const cx = nx0 - bx0;
  const cy = ny0 - by0;
  const nz = model.nozzles;
  // Plume axis (down the rocket) and across it.
  const dx = -sa;
  const dy = ca;
  const px = ca;
  const py = sa;

  // Pad smoke (owner 2026-10-24, no big blocks): hundreds of one- to two-pixel grains billowing out of the trench
  // sideways and rising, each on its own speed and loop, the ones nearest the plume lit in false colour.
  if (t < sc.duration) {
    const fade = Math.max(0, 0.85 - t * 0.3);
    const n = KNOBS.CINE_PAD_SMOKE;
    for (let i = 0; i < n && fade > 0; i++) {
      const a = (hash01(i, 11, sc.seed) - 0.5) * Math.PI;
      const sp = 14 + 80 * hash01(i, 12, sc.seed);
      const r = sp * Math.min(t, 2.2);
      const rise = (8 + 26 * hash01(i, 14, sc.seed)) * t;
      const wob = Math.sin(t * 3 + i) * 2 * hash01(i, 16, sc.seed);
      const sx = X(Math.sin(a) * r * 1.7 + wob);
      const sy = Y(-cell - Math.abs(Math.cos(a)) * r * 0.3 - rise);
      const h = hash01(i, 13, sc.seed);
      const near = r < 26 && t < 1.4;
      const col = near && KNOBS.CINE_FALSE_COLOUR ? falseStep(ramp, 0.2 + 0.5 * h) : h > 0.85 ? (pal.w ?? s.palette.ink) : h > 0.4 ? (pal.g ?? s.palette.dim) : (pal.k ?? s.palette.dim);
      s.dot(Math.round(sx), Math.round(sy), Math.min(KNOBS.CINE_SPRAY_MAX_PX, cell * (0.6 + 0.9 * h)), col, fade * (0.5 + 0.5 * hash01(i, 15)));
    }
  }

  // Plumes: core first, then the boosters (shorter, narrower).
  for (let ni = 0; ni < nz.length; ni++) {
    const n0 = nz[ni];
    if (!n0) continue;
    const booster = ni > 0;
    const [nxl, nyl] = localToScreen(n0[0], n0[1], n0[2], size, roll, heading);
    const ex = cx + nxl;
    const ey = cy + nyl;
    const L = (30 + 14 * tier) * k * (booster ? 0.7 : 1) * (0.9 + 0.2 * hash01(frame, 7, ni));
    const rows = Math.max(6, Math.ceil(L / cell));
    const exitW = (booster ? 2 : tier === 1 ? 4 : 6) * cell;
    for (let i = 0; i < rows; i++) {
      const f = i / rows;
      const d = f * L * (0.9 + 0.2 * hash01(i, frame, ni));
      // The jet necks a little past the exit, then spreads.
      const w = exitW * (0.85 + 1.4 * f * f) + cell;
      const m = Math.max(1, Math.round(w / cell));
      // Shock diamonds: a white-hot pixel on the axis every sixth of the head.
      const diamond = f < KNOBS.CINE_FALSE_HEAD_FRAC && Math.floor(f * 14) % 3 === 0 && i % 2 === 0;
      for (let j = 0; j < m; j++) {
        const hj = hash01(i * 31 + j, frame, ni + 5);
        if (hj < f * 0.55) continue;
        const lat = (j - (m - 1) / 2) * cell + (hash01(j, i, frame) - 0.5) * cell * (0.5 + 2 * f);
        const e = m > 1 ? Math.abs(j - (m - 1) / 2) / ((m - 1) / 2) : 0;
        const col = diamond && e < 0.34 ? (ramp[0] ?? '#FFFFFF') : plumeColor(s, ramp, f, e, hash01(i, j, frame + 3));
        s.dot(Math.round(ex + dx * d + px * lat), Math.round(ey + dy * d + py * lat), cell, col, 0.97 - 0.55 * f);
      }
    }
    // Embers: tiny false-colour sparks shed from the exit on looping lifetimes.
    const nE = Math.round(KNOBS.CINE_EMBERS * (booster ? 0.5 : 1));
    const tiny = Math.max(1, cell * 0.6);
    for (let e = 0; e < nE; e++) {
      const life = KNOBS.CINE_EMBER_LIFE_S * (0.6 + 0.8 * hash01(e, 1, ni));
      const phase = (((t + hash01(e, 2, ni) * life) % life) + life) % life / life;
      const age = phase * life;
      const v = (70 + 150 * hash01(e, 3, ni)) * k;
      const spread = (hash01(e, 4, ni) - 0.5) * 1.1;
      const ax = dx + px * spread;
      const ay = dy + py * spread;
      const col = KNOBS.CINE_FALSE_COLOUR ? falseStep(ramp, 1 - phase) : fireColor(s, 1 - phase);
      s.dot(Math.round(ex + ax * v * age), Math.round(ey + ay * v * age + 30 * k * age * age), tiny, col, 1 - 0.75 * phase);
    }
  }

  // The vehicle: a lit wireframe at its screen position, rolled and pointed along the heading.
  const craft = s.role('craft');
  const body: Chunk = { poly: model.poly, size, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, ax: 0, ay: roll, az: heading, wx: 0, wy: 0, wz: 0, t0: t, role: 'craft', hot: 0 };
  drawChunk(s, body, t, cx, cy, 1, craft, null, 1, 0.4);

  // Spent stages fall away after each separation: the tube below the lowest remaining band drops, tumbling under
  // gravity (solid.ts g), venting a few last sparks. Stage i (from the bottom) spans the band above it to the one below.
  const ox0 = X(0);
  const kk = X(1) - X(0);
  for (let si = 0; si < launch.stages.length; si++) {
    const su = launch.stages[si] ?? 0;
    const ts = Math.pow(su, 1 / 1.5) * sc.duration * 0.92;
    if (t < ts) continue;
    const dt = t - ts;
    const [sx0, sy0, stx, sty] = launchArc(su, tier);
    const bands = model.bands;
    const top = bands[bands.length - 1 - si] ?? 0;
    const bottom = si === 0 ? 1 : (bands[bands.length - si] ?? 1);
    const head0 = Math.atan2(stx, -sty);
    const piece: Chunk = { poly: spentStage(tier, top, bottom), size: size / kk, x: sx0, y: sy0, z: 0, vx: stx * 20, vy: sty * 20 + 10, vz: 0, ax: 0, ay: roll, az: head0, wx: 0.6, wy: 0, wz: 2.6, t0: ts, role: 'craft', hot: 0, g: 45 };
    const fade = Math.max(0, 1 - dt / 1.8);
    drawChunk(s, piece, t, ox0, Y(0), kk, craft, null, fade, 0.4);
    const sxp = X(sx0 + stx * 20 * dt);
    const syp = Y(sy0 + (sty * 20 + 10) * dt + 22.5 * dt * dt);
    for (let e = 0; e < 10 && dt < 0.6; e++) {
      const a = hash01(e, 9, sc.seed) * Math.PI * 2;
      const r = (10 + 40 * hash01(e, 10, sc.seed)) * dt * k;
      s.dot(Math.round(sxp + Math.cos(a) * r), Math.round(syp + Math.sin(a) * r), Math.max(1, cell * 0.6), falseStep(ramp, 1 - dt / 0.6), fade);
    }
  }
  // The arc flown so far.
  const buf: number[] = [];
  for (let i = 0; i <= 24; i++) {
    const [ax, ay] = launchArc((u * i) / 24, tier);
    buf.push(X(ax), Y(ay));
  }
  if (buf.length >= 4) s.stroke(buf, { color: s.role('craft'), glow: 0.3, dash: [2, 4], alpha: 0.6 });
}
