// WHAT: Run-level infrastructure programs (GAME_PLAN 19): progress, funding, cost, and effects on completion.
// WHY:  Two clocks of investment run side by side: missions (this threat) and programs (every future
//       threat). Lead time is the strongest deflection multiplier in the game (miss ≈ 3 dv T), and lead
//       time is what most programs buy.
// HOW:  progress += funding_fraction * dt / (years * YEAR); the per-year cost drains the economy as time
//       advances (economy.spent grows). When progress reaches 1 the program's effects are applied once to
//       a RunEffects record and, for networks, to the world's active set with the completion year.
// LORE: G4 (programs), F7 (future missions), F5 (today's surveys)

import programsJson from '../config/programs.json';
import { KNOBS } from '../config/knobs';
import { YEAR } from '../physics/constants';
import type { Economy } from '../game/economy';
import { yearOf } from './detection';

export type EffectKind = 'BUDGET_PER_YEAR' | 'RESEARCH_MULT' | 'WARHEAD_PENALTY_MULT' | 'EVAC_MIN_DAYS' | 'DAMAGE_MULT' | 'ACTIVATE_NETWORK' | 'NETWORK_PCOVER' | 'TRACKING_TIER' | 'PRECURSOR' | 'BUILD_TIME_YEARS' | 'LAUNCH_CAP' | 'LAUNCHER_TIER' | 'C3_BONUS' | 'WARHEAD_BUILD_YEARS' | 'GROUND_LASER' | 'SIGMA_V_MULT' | 'SAIL_DEPOT' | 'ORBITAL_LASER' | 'LUNAR_DRIVER' | 'FUSION_TUGS' | 'DISASSEMBLER' | 'NANOFORGE' | 'THRUSTER_SWARM' | 'SHEPHERD';

export interface Effect {
  kind: EffectKind;
  value?: number;
  network?: string;
}

export interface ProgramDef {
  id: string;
  name: string;
  tag: 'REAL' | 'PROPOSED' | 'SPECULATIVE';
  years: number;
  costPerYear: number;
  mode: 'REALISTIC' | 'SCIFI';
  effects: Effect[];
  note: string;
}

export const PROGRAMS = (programsJson as { programs: ProgramDef[] }).programs;

export function programById(id: string): ProgramDef {
  const p = PROGRAMS.find((x) => x.id === id);
  if (!p) throw new Error(`no program ${id}`);
  return p;
}

export interface ProgramState {
  id: string;
  progress: number;
  /** Funding fraction in [0, 1]. */
  funding: number;
  /** Round time at which it completed, or null. */
  completedAt: number | null;
}

/** Accumulated effects of completed programs on the run. */
export interface RunEffects {
  budgetPerYearBonus: number;
  researchMult: number;
  warheadPenaltyMult: number;
  evacMinDays: number;
  damageMult: number;
  trackingTier: number;
  precursor: boolean;
  buildTimeYears: number;
  launchCap: number;
  launcherTierUnlock: number;
  c3Bonus: number;
  warheadBuildYears: number | null;
  groundLaser: boolean;
  sigmaVMult: number;
  /** Network coverage overrides. */
  pCover: Record<string, number>;
  /** SCI-FI (20.3): pre-accelerated sail impactors on hand; orbital laser power (W) or 0; lunar driver C3 (km^2/s^2) or 0;
   *  fusion tug thrust (N) or 0; disassembler time constant (years) or 0. */
  sailDepot: number;
  orbitalLaserW: number;
  lunarDriverC3: number;
  fusionTugN: number;
  disassemblerTauYears: number;
  /** 30: speculative standing capabilities owned (0 / 1). */
  nanoforge: number;
  thrusterSwarm: number;
  shepherd: number;
}

export function defaultEffects(): RunEffects {
  return {
    budgetPerYearBonus: 0,
    researchMult: 1,
    warheadPenaltyMult: 1,
    evacMinDays: KNOBS.EVACUATE_MIN_DAYS,
    damageMult: 1,
    trackingTier: 0,
    precursor: false,
    buildTimeYears: KNOBS.BUILD_TIME_KINETIC / YEAR,
    launchCap: 2,
    launcherTierUnlock: 1,
    c3Bonus: 0,
    warheadBuildYears: null,
    groundLaser: false,
    sigmaVMult: 1,
    pCover: {},
    sailDepot: 0,
    orbitalLaserW: 0,
    lunarDriverC3: 0,
    fusionTugN: 0,
    disassemblerTauYears: 0,
    nanoforge: 0,
    thrusterSwarm: 0,
    shepherd: 0,
  };
}

export function createPrograms(mode: 'REALISTIC' | 'SCIFI' = 'REALISTIC'): ProgramState[] {
  return PROGRAMS.filter((p) => p.mode === 'REALISTIC' || mode === 'SCIFI').map((p) => ({ id: p.id, progress: 0, funding: 0, completedAt: null }));
}

/** Add the program states a mode allows but the run does not have yet (entering SCI-FI adds its programs). */
export function syncPrograms(states: ProgramState[], mode: 'REALISTIC' | 'SCIFI'): number {
  let added = 0;
  for (const st of createPrograms(mode)) {
    if (!states.some((s) => s.id === st.id)) {
      states.push(st);
      added++;
    }
  }
  return added;
}

export interface ProgramsContext {
  economy: Economy;
  effects: RunEffects;
  networks: { active: string[]; since: Record<string, number> };
}

/** Apply a completed program's effects once. Exported for tests and the save loader. */
export function applyEffects(def: ProgramDef, ctx: ProgramsContext, t: number): void {
  for (const e of def.effects) {
    const v = e.value ?? 0;
    switch (e.kind) {
      case 'BUDGET_PER_YEAR':
        ctx.effects.budgetPerYearBonus += v;
        ctx.economy.perYear += v;
        break;
      case 'RESEARCH_MULT':
        ctx.effects.researchMult *= v;
        break;
      case 'WARHEAD_PENALTY_MULT':
        ctx.effects.warheadPenaltyMult *= v;
        break;
      case 'EVAC_MIN_DAYS':
        ctx.effects.evacMinDays = Math.min(ctx.effects.evacMinDays, v);
        break;
      case 'DAMAGE_MULT':
        ctx.effects.damageMult *= v;
        break;
      case 'ACTIVATE_NETWORK':
        if (e.network && !ctx.networks.active.includes(e.network)) {
          ctx.networks.active.push(e.network);
          ctx.networks.since[e.network] = yearOf(t);
        }
        break;
      case 'NETWORK_PCOVER':
        if (e.network) ctx.effects.pCover[e.network] = v;
        break;
      case 'TRACKING_TIER':
        ctx.effects.trackingTier = Math.max(ctx.effects.trackingTier, v);
        break;
      case 'PRECURSOR':
        ctx.effects.precursor = true;
        break;
      case 'BUILD_TIME_YEARS':
        ctx.effects.buildTimeYears = Math.min(ctx.effects.buildTimeYears, v);
        break;
      case 'LAUNCH_CAP':
        ctx.effects.launchCap = Math.max(ctx.effects.launchCap, v);
        break;
      case 'LAUNCHER_TIER':
        ctx.effects.launcherTierUnlock = Math.max(ctx.effects.launcherTierUnlock, v);
        break;
      case 'C3_BONUS':
        ctx.effects.c3Bonus += v;
        break;
      case 'WARHEAD_BUILD_YEARS':
        ctx.effects.warheadBuildYears = v;
        break;
      case 'GROUND_LASER':
        ctx.effects.groundLaser = true;
        break;
      case 'SIGMA_V_MULT':
        ctx.effects.sigmaVMult *= v;
        break;
      case 'SAIL_DEPOT':
        ctx.effects.sailDepot += v;
        break;
      case 'ORBITAL_LASER':
        ctx.effects.orbitalLaserW = Math.max(ctx.effects.orbitalLaserW, v);
        break;
      case 'LUNAR_DRIVER':
        ctx.effects.lunarDriverC3 = Math.max(ctx.effects.lunarDriverC3, v);
        break;
      case 'FUSION_TUGS':
        ctx.effects.fusionTugN = Math.max(ctx.effects.fusionTugN, v);
        break;
      case 'DISASSEMBLER':
        ctx.effects.disassemblerTauYears = v;
        break;
      case 'NANOFORGE':
        ctx.effects.nanoforge = 1;
        break;
      case 'THRUSTER_SWARM':
        ctx.effects.thrusterSwarm = 1;
        break;
      case 'SHEPHERD':
        ctx.effects.shepherd = 1;
        break;
    }
  }
}

/**
 * Advance every program by dt seconds of sim time: progress at the funding fraction, cost drained from the
 * economy, effects applied on completion. Returns the ids completed during this step.
 */
export function advancePrograms(states: ProgramState[], ctx: ProgramsContext, t: number, dt: number): string[] {
  const done: string[] = [];
  for (const st of states) {
    if (st.completedAt !== null || st.funding <= 0) continue;
    const def = programById(st.id);
    ctx.economy.spent += (st.funding * def.costPerYear * dt) / YEAR;
    st.progress = Math.min(1, st.progress + (st.funding * dt) / (def.years * YEAR));
    if (st.progress >= 1 - 1e-12) {
      st.progress = 1;
      st.completedAt = t;
      st.funding = 0;
      applyEffects(def, ctx, t);
      done.push(st.id);
    }
  }
  return done;
}

/** Total funded cost per year right now, budget units. */
export function programBurn(states: readonly ProgramState[]): number {
  return states.reduce((a, s) => (s.completedAt === null ? a + s.funding * programById(s.id).costPerYear : a), 0);
}
