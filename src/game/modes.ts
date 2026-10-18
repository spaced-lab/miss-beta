// WHAT: Modes (GAME_PLAN 21): REALISTIC inside SCI-FI inside SIMULATION inside MULTIVERSE, nested.
// WHY:  Nothing in a later mode leaks into an earlier one. Each mode has its own leaderboard tab; FICTION
//       commands exist only once the player has found the console in SIMULATION.
// HOW:  `enterMode` enforces the nesting (SIMULATION needs SCIFI active, MULTIVERSE needs SIMULATION) and
//       records the highest mode reached; `allowsTag` gates methods and programs by tag; `boardFor` maps a
//       mode to its leaderboard tab (SIMULATION and MULTIVERSE share the FICTION board).
// LORE: G6 (modes, civilization levels and cheat codes)

import type { Mode as BoardMode } from './leaderboard';
import type { RunState } from './run';

export type Mode = 'REALISTIC' | 'SCIFI' | 'SIMULATION' | 'MULTIVERSE';
export type Tag = 'REAL' | 'PROPOSED' | 'SPECULATIVE' | 'FICTION';

export const MODE_ORDER: readonly Mode[] = ['REALISTIC', 'SCIFI', 'SIMULATION', 'MULTIVERSE'];

export function modeIndex(m: Mode): number {
  return MODE_ORDER.indexOf(m);
}

export type ModeVerdict = 'OK' | 'ALREADY' | 'REQUIRES_SCIFI' | 'REQUIRES_SIMULATION';

/** Enter a mode from the current one. Modes are entered in order; leaving is not a game action. */
export function enterMode(run: RunState, target: Mode): ModeVerdict {
  const cur = modeIndex(run.mode);
  const want = modeIndex(target);
  if (want <= cur) return 'ALREADY';
  if (target === 'SIMULATION' && run.mode !== 'SCIFI') return 'REQUIRES_SCIFI';
  if (target === 'MULTIVERSE' && run.mode !== 'SIMULATION') return 'REQUIRES_SIMULATION';
  if (target === 'SCIFI' && run.mode !== 'REALISTIC') return 'ALREADY';
  run.mode = target;
  if (modeIndex(target) > modeIndex(run.highestMode)) run.highestMode = target;
  return 'OK';
}

/** Which method / program tags the current mode may use. */
export function allowsTag(mode: Mode, tag: Tag): boolean {
  switch (tag) {
    case 'REAL':
    case 'PROPOSED':
      return true;
    case 'SPECULATIVE':
      return modeIndex(mode) >= 1;
    case 'FICTION':
      return modeIndex(mode) >= 2;
  }
}

export function boardFor(mode: Mode): BoardMode {
  return mode === 'REALISTIC' ? 'REALISTIC' : mode === 'SCIFI' ? 'SCIFI' : 'FICTION';
}

/** Budget scale by mode (SCI-FI x10 per GAME_PLAN 21.2; the later modes inherit it). */
export function budgetScale(mode: Mode): number {
  return modeIndex(mode) >= 1 ? 10 : 1;
}

/**
 * Civilization level (22.3): 0 today, 1 when every REALISTIC program is complete (unlocks SCI-FI without a
 * code), 2 when every SPECULATIVE program is complete (unlocks SIMULATION). The Kardashev-style readout is
 * flavour: energy budget in watts from completed programs.
 */
export function civilizationLevel(completedRealistic: number, totalRealistic: number, completedScifi: number, totalScifi: number): 0 | 1 | 2 {
  if (totalScifi > 0 && completedScifi >= totalScifi) return 2;
  if (totalRealistic > 0 && completedRealistic >= totalRealistic) return 1;
  return 0;
}

/** Flavour: a Kardashev-style power readout, W. Level 0 ~ 2e13 W (today), each completed program adds a slice. */
export function kardashevWatts(level: number, completed: number): number {
  return 2e13 * Math.pow(10, level * 1.5) * (1 + 0.25 * completed);
}
