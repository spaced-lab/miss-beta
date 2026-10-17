// WHAT: Run state: the things that persist across rounds (seed, round index, budget, research, score).
// WHY:  A run is a sequence of rounds on one seed; the world is rebuilt per round, the run carries on.
// HOW:  Plain record plus small helpers. SAVE.md serialization arrives in M5.
// LORE: G1 (how to play), G5 (scoring)

import { createEconomy, type Economy } from './economy';

export interface RunState {
  seed: string;
  round: number;
  economy: Economy;
  research: number;
  score: number;
  roundsSurvived: number;
  /** Tech levels available this run (M6 grows this). */
  launcherTier: number;
  impactorTier: number;
  assisted: boolean;
  startedAt: string;
}

export function createRun(seed: string): RunState {
  return {
    seed,
    round: 1,
    economy: createEconomy(),
    research: 0,
    score: 0,
    roundsSurvived: 0,
    launcherTier: 1,
    impactorTier: 1,
    assisted: false,
    startedAt: new Date().toISOString().slice(0, 10),
  };
}

/** Advance to the next round: budget balance carries over as the new starting balance. */
export function nextRound(run: RunState, budgetNow: number): void {
  run.round += 1;
  run.roundsSurvived += 1;
  run.economy = createEconomy(budgetNow);
}
