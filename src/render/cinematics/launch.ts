// WHAT: The LAUNCH cinematic's pixel art: pad, tower, terrain, stars, the rocket, its false-colour plume, embers,
//       pad smoke and the spent stages.
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
import { drawSprite, falseRamp, falseStep, fireColor, hash01, nozzles, pixelPalette, ROCKETS, SPENT_STAGE, towerSprite } from './pixel';
import { launchArc, launchProgress, type Scene } from './scene';

/** Launch cell size in CSS px for a window scale k: the knob times k, snapped to half pixels, at least 1. */
export function launchCell(k: number): number {
  return Math.max(1, Math.round(KNOBS.CINE_LAUNCH_CELL_PX * k * 2) / 2);
}

/** Stars, HOME's limb, terrain, the pad deck and the tower. Drawn under reduce-motion too (the still frame). */
export function drawLaunchStage(s: Surface, sc: Scene, elapsed: number, ox: number, oy: number, k: number): void {
  const p = s.palette;
  const pal = pixelPalette(s);
  const cell = launchCell(k);
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
  // Terrain: blocky ridges three cells wide, lit along the top row.
  const span = Math.ceil((260 * k) / cell);
  for (let gx = -span; gx <= span; gx++) {
    const blk = Math.floor(gx / 3);
    const hgt = 1 + Math.floor(hash01(blk + 99, 7, sc.seed) * 3 + hash01(gx + 99, 8, sc.seed) * 1.6);
    for (let gy = 0; gy < hgt; gy++) s.dot(ox + gx * cell, oy + cell + gy * cell, cell, gy === 0 ? (pal.G ?? p.ink) : (pal.k ?? p.dim), gy === 0 ? 0.55 : 0.3 + 0.1 * gy);
  }
  const tier = sc.launch?.tier ?? 1;
  const rocket = ROCKETS[tier] ?? ROCKETS[1] ?? [];
  const rw = (rocket[0]?.length ?? 9) * cell;
  // Pad deck: two rows of plating with the flame trench open under the engines.
  const deckHalf = Math.ceil(rw / 2 / cell) + 14;
  const trench = Math.ceil((rw * 0.42) / cell);
  for (let i = -deckHalf; i <= deckHalf; i++) {
    const open = Math.abs(i) <= trench;
    s.dot(ox + i * cell, oy, cell, open ? (pal.k ?? p.dim) : (pal.g ?? p.dim), open ? 0.6 : 0.95);
    if (!open || i % 2 === 0) s.dot(ox + i * cell, oy - cell, cell, i % 4 === 0 ? (pal.w ?? p.ink) : (pal.g ?? p.dim), 0.85);
  }
  s.stroke([ox - deckHalf * cell, oy + cell / 2, ox + deckHalf * cell, oy + cell / 2], { color: p.ink, glow: 0.4, width: 1 });
  // Tower: as tall as the rocket, arms reaching to its left side.
  const tower = towerSprite(Math.ceil(rocket.length * 0.95));
  const tw = (tower[0]?.length ?? 10) * cell;
  const tcx = ox - rw / 2 - tw / 2 - cell;
  const tcy = oy - cell - (tower.length * cell) / 2;
  drawSprite(s, tower, tcx, tcy, cell, 0, 0.9);
  // The beacon (row 0, column 2 of the tower sprite) flares once a second.
  if (Math.floor(elapsed * 2) % 2 === 0) s.dot(tcx + (2 - ((tower[0]?.length ?? 10) - 1) / 2) * cell, tcy - ((tower.length - 1) / 2) * cell, cell * 2, s.role('danger'), 0.9);
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
  const sprite = ROCKETS[tier] ?? ROCKETS[1] ?? [];
  const cell = launchCell(k);
  const heading = Math.atan2(tx, -ty);
  const ca = Math.cos(heading);
  const sa = Math.sin(heading);
  const frame = Math.floor(t * 30);
  // The arc point is the core nozzle; the sprite centre sits half a rocket above it along the heading.
  const nz = nozzles(tier);
  const yCore = nz[0]?.[1] ?? sprite.length / 2;
  const nx0 = X(x);
  const ny0 = Y(y);
  const cx = nx0 + yCore * cell * sa;
  const cy = ny0 - yCore * cell * ca;
  // Plume axis (down the rocket) and across it.
  const dx = -sa;
  const dy = ca;
  const px = ca;
  const py = sa;

  // Pad smoke: grey puffs of mixed sizes billowing out sideways and rising, lit from the plume at the base.
  if (t < sc.duration) {
    const fade = Math.max(0, 0.85 - t * 0.33);
    for (let i = 0; i < 150 && fade > 0; i++) {
      const a = (hash01(i, 11, sc.seed) - 0.5) * Math.PI;
      const sp = 18 + 70 * hash01(i, 12, sc.seed);
      const r = sp * Math.min(t, 1.8);
      const rise = 14 * t * hash01(i, 14, sc.seed);
      const sx = X(Math.sin(a) * r * 1.7);
      const sy = Y(-cell - Math.abs(Math.cos(a)) * r * 0.35 - rise);
      const h = hash01(i, 13, sc.seed);
      const col = h > 0.85 ? (pal.w ?? s.palette.ink) : h > 0.4 ? (pal.g ?? s.palette.dim) : (pal.k ?? s.palette.dim);
      s.dot(Math.round(sx), Math.round(sy), cell * (2 + Math.floor(h * 4)), col, fade * (0.55 + 0.45 * hash01(i, 15)));
    }
  }

  // Plumes: core first, then the boosters (shorter, narrower).
  for (let ni = 0; ni < nz.length; ni++) {
    const n0 = nz[ni];
    if (!n0) continue;
    const booster = ni > 0;
    const ex = cx + n0[0] * cell * ca - n0[1] * cell * sa;
    const ey = cy + n0[0] * cell * sa + n0[1] * cell * ca;
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

  drawSprite(s, sprite, cx, cy, cell, heading);

  // Spent stages fall away and tumble after each separation, venting a few last sparks.
  for (const su of launch.stages) {
    const ts = Math.pow(su, 1 / 1.5) * sc.duration * 0.92;
    if (t < ts) continue;
    const dt = t - ts;
    const [sx0, sy0, stx, sty] = launchArc(su, tier);
    const sxp = X(sx0 + stx * 20 * dt);
    const syp = Y(sy0 + sty * 20 * dt + 45 * dt * dt);
    const fade = Math.max(0, 1 - dt / 1.6);
    drawSprite(s, SPENT_STAGE, sxp, syp, cell, Math.atan2(stx, -sty) + dt * 3, fade);
    for (let e = 0; e < 8 && dt < 0.6; e++) {
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
