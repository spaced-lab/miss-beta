// WHAT: The World: star, planets, sim clock and warp. Seeded construction per run and round.
// WHY:  GAME_PLAN 5.2 and 10: each round re-phases the planets (random mean anomalies) so flyby geometry
//       differs every time, and an optional per-run scale of axes and star mass makes no two runs alike.
//       The world is plain data; functions here are the only way it changes.
// HOW:  `createWorld(runSeed, round)` draws, in a fixed order from the round's RNG stream: a-scale, mu-scale,
//       then one M0 per planet. `advance` moves the clock by real seconds times the warp level.
//       `planetState` is just Kepler propagation at the clock time.
// LORE: O6 (Kepler), O14 (randomness), G7 (under the hood)

import bodies from '../config/bodies.json';
import { KNOBS } from '../config/knobs';
import { AU } from '../physics/constants';
import { propagate, type Elements, type PropagatedState } from '../physics/kepler';
import type { Planet, Star } from './body';
import { defaultActiveNetworks } from './detection';
import type { Threat } from './threat';
import { roundRng, type Rng } from './rng';

export interface World {
  readonly runSeed: string;
  readonly round: number;
  readonly star: Star;
  readonly planets: readonly Planet[];
  /** Sim time, s, from round start. */
  t: number;
  /** Index into KNOBS.WARP_LEVELS. */
  warp: number;
  /** The round's threat; null before roundGen runs (tests, title attract). */
  threat: Threat | null;
  /** Detection networks active this run and activation-year overrides for ones built in-game. */
  networks: { active: string[]; since: Record<string, number> };
}

interface PlanetRow {
  id: string;
  name: string;
  mu: number;
  a_au: number;
  e: number;
  radius: number;
  detailLines: number;
}

export function createWorld(runSeed: string, round: number, rng: Rng = roundRng(runSeed, round)): World {
  // NOTE: draw order is part of the save format; changing it changes every round. Keep it stable.
  const aScale = 1 + rng.float(-KNOBS.SYSTEM_A_SCALE_SPREAD, KNOBS.SYSTEM_A_SCALE_SPREAD);
  const muScale = 1 + rng.float(-KNOBS.SYSTEM_MU_SPREAD, KNOBS.SYSTEM_MU_SPREAD);
  const star: Star = { id: 'STAR', name: bodies.star.name, mu: bodies.star.mu * muScale, radius: bodies.star.radius };
  const planets: Planet[] = (bodies.planets as PlanetRow[]).map((p) => {
    const elements: Elements = {
      a: p.a_au * AU * aScale,
      e: p.e,
      w: rng.float(0, 2 * Math.PI),
      M0: rng.float(0, 2 * Math.PI),
      t0: 0,
    };
    return { kind: 'PLANET', id: p.id, name: p.name, mu: p.mu, radius: p.radius, elements, detailLines: p.detailLines };
  });
  return { runSeed, round, star, planets, t: 0, warp: KNOBS.WARP_DEFAULT, threat: null, networks: { active: defaultActiveNetworks(), since: {} } };
}

export function planetById(w: World, id: string): Planet {
  const p = w.planets.find((q) => q.id === id);
  if (!p) throw new Error(`no planet ${id}`);
  return p;
}

export function planetState(w: World, p: Planet, t = w.t): PropagatedState {
  return propagate(p.elements, w.star.mu, t);
}

/** Advance the clock by `realSeconds` of wall time at the current warp. */
export function advance(w: World, realSeconds: number): void {
  const rate = KNOBS.WARP_LEVELS[w.warp] ?? 0;
  w.t += rate * realSeconds;
}

/** Advance the clock by `simSeconds` directly (PLAY IT OUT runs the clock on its own schedule, not a warp level). */
export function advanceBy(w: World, simSeconds: number): void {
  w.t += simSeconds;
}

export function setWarp(w: World, index: number): void {
  w.warp = Math.max(0, Math.min(KNOBS.WARP_LEVELS.length - 1, index));
}

export function warpLabel(w: World): string {
  return KNOBS.WARP_LABELS[w.warp] ?? '?';
}
