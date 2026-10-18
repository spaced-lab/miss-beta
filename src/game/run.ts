// WHAT: Run state: the things that persist across rounds (seed, round index, budget, research, score).
// WHY:  A run is a sequence of rounds on one seed; the world is rebuilt per round, the run carries on.
// HOW:  Plain record plus small helpers. SAVE.md serialization arrives in M5.
// LORE: G1 (how to play), G5 (scoring)

import { createPrograms, defaultEffects, type ProgramState, type RunEffects } from '../sim/programs';
import { createEconomy, type Economy } from './economy';
import { reapplyTech, TECH } from './tech';

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
  /** 0 none, 1..3 propulsion tiers (P1 chemical kick .. P3 NEP); sets the onboard dv budget. */
  propulsionTier: number;
  /** Owned tech node ids (config/tech.json). */
  tech: string[];
  softImpactor: boolean;
  hammer: boolean;
  /** 1 separate launches (k <= 3), 2 split bus x3, 3 split bus x8. */
  swarmTier: number;
  trackingTier: number;
  autonomyTier: number;
  warheadTier: number;
  slowPushTier: number;
  pi: boolean;
  netTier: number;
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
  /** Learning mode: unlimited budget and research, every REALISTIC tech, full tracking; never recorded. */
  sandbox: boolean;
}

export function createRun(seed: string, opts: { sandbox?: boolean } = {}): RunState {
  const run: RunState = {
    seed,
    round: 1,
    economy: createEconomy(),
    research: 0,
    score: 0,
    roundsSurvived: 0,
    launcherTier: 1,
    impactorTier: 1,
    // NOTE: the tech tree (game/tech.ts) raises these; a run starts with the basics of GAME_PLAN 9.
    navTier: 0,
    sailTier: 0,
    propulsionTier: 0,
    tech: [],
    softImpactor: false,
    hammer: false,
    swarmTier: 1,
    trackingTier: 0,
    autonomyTier: 0,
    warheadTier: 0,
    slowPushTier: 0,
    pi: false,
    netTier: 0,
    assisted: false,
    startedAt: new Date().toISOString().slice(0, 10),
    programs: createPrograms(),
    effects: defaultEffects(),
    networks: { active: [], since: {} },
    evacuatedAt: null,
    history: [],
    cheatsUsed: [],
    sandbox: opts.sandbox ?? false,
  };
  if (run.sandbox) {
    // SANDBOX: a run to experiment in. Everything that money or research would buy is already bought.
    run.economy = createEconomy(1e6, 1e4);
    run.research = 9999;
    run.tech = TECH.filter((n) => n.mode !== 'SCIFI').map((n) => n.id);
    reapplyTech(run);
    run.cheatsUsed = ['SANDBOX'];
    run.assisted = true;
  }
  return run;
}

/** Advance to the next round: budget balance carries over as the new starting balance. */
export function nextRound(run: RunState, budgetNow: number): void {
  run.round += 1;
  run.roundsSurvived += 1;
  run.economy = createEconomy(budgetNow, run.economy.perYear);
  run.evacuatedAt = null;
}
