// WHAT: Run state: the things that persist across rounds (seed, round index, budget, research, score).
// WHY:  A run is a sequence of rounds on one seed; the world is rebuilt per round, the run carries on.
// HOW:  Plain record plus small helpers. SAVE.md serialization arrives in M5.
// LORE: G1 (how to play), G5 (scoring)

import { createPrograms, defaultEffects, type ProgramState, type RunEffects } from '../sim/programs';
import { createEconomy, type Economy } from './economy';

export interface RunState {
  seed: string;
  round: number;
  economy: Economy;
  research: number;
  score: number;
  roundsSurvived: number;
  /** Tech levels available this run (M6 grows this through the tech tree). */
  launcherTier: number;
  impactorTier: number;
  /** 0 none, 1 single flyby (NAV N1). */
  navTier: number;
  /** 0 none, 1..4 sail tiers (SL1..SL4). */
  sailTier: number;
  /** 1..3 propulsion tiers (P1 chemical kick .. P3 NEP); sets the onboard dv budget. */
  propulsionTier: number;
  assisted: boolean;
  startedAt: string;
  programs: ProgramState[];
  effects: RunEffects;
  /** Networks active this run (ids) and activation years for ones completed in-game. */
  networks: { active: string[]; since: Record<string, number> };
  /** Round time at which EVACUATE was ordered this round, or null. */
  evacuatedAt: number | null;
  /** One line per finished round for SAVE.md. */
  history: { round: number; threat: string; type: string; D: number; lead: number; by: string; plan: string; outcome: string; score: number }[];
  cheatsUsed: string[];
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
    // NOTE: until the tech tree lands (M6), flyby navigation, a Tier 1 sail and a chemical kick stage are
    // available from the start so every M4 plan type can be played. STATUS.md records this.
    navTier: 1,
    sailTier: 1,
    propulsionTier: 1,
    assisted: false,
    startedAt: new Date().toISOString().slice(0, 10),
    programs: createPrograms(),
    effects: defaultEffects(),
    networks: { active: [], since: {} },
    evacuatedAt: null,
    history: [],
    cheatsUsed: [],
  };
}

/** Advance to the next round: budget balance carries over as the new starting balance. */
export function nextRound(run: RunState, budgetNow: number): void {
  run.round += 1;
  run.roundsSurvived += 1;
  run.economy = createEconomy(budgetNow, run.economy.perYear);
  run.evacuatedAt = null;
}
