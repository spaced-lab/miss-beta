// WHAT: Plan candidates from a porkchop grid, ranked (GAME_PLAN 7.2, 7.3): KINETIC singles and SWARM bundles,
//       each flagged DISRUPT when the hit would exceed Q*.
// WHY:  The player should see the few cells that matter, with the planner's work printed. Two passes: a
//       cheap estimate (the 3 dv T rule with the mid-range beta) over every feasible cell, then a full
//       deterministic resolve of the top few (with the missions already committed, so margins are totals),
//       then the score of 7.3. P(miss) here is the deterministic verdict (1 MISS, 0.35 PARTIAL, 0 HIT);
//       the Monte Carlo of monteCarlo.ts refines it for the selected plan in the overlay.
// HOW:  Pure: (grid, context) -> Candidate[]. The resolve callback is injected so this module does not
//       depend on the resolver's world type. A SWARM takes the best single cell and adds k-1 launches on
//       the next grid steps (staggered windows, GAME_PLAN 7.2 "k small impactors on staggered windows").
// LORE: G3 (the planner), D2 (early beats big), D3 (kinetic and beta), D4 (fragmentation)

import { KNOBS } from '../config/knobs';
import { missFromImpulse } from '../physics/estimates';
import { qStar, specificEnergy } from '../physics/fragment';
import { fuzeOk, nuclearBurst, warheadMass, yieldsForTier } from '../physics/nuclear';
import { pushForce, type PushMethod } from '../physics/slowPush';
import { missFromPush } from '../physics/estimates';
import type { Mission } from '../sim/mission';
import type { Vec2 } from '../util/vec';
import { cellTimes, type PorkchopGrid } from './porkchop';

export interface ResolveVerdict {
  outcome: 'HIT' | 'MISS' | 'PARTIAL';
  marginRadii: number;
  hitEnergyMt: number;
  producedFragments: boolean;
}

export interface CandidateContext {
  /** Target body (the threat or a fragment). */
  targetId: string;
  targetMass: number;
  targetD: number;
  threatType: string;
  threatDensity: number;
  threatStrength: number;
  threatMaterial: 'basalt' | 'ice';
  /** Original threat energy, Mt, for the residual term. */
  threatEnergyMt: number;
  tImpact: number;
  rHome: number;
  launcherTier: number;
  impactorTier: number;
  budget: number;
  committedAt: number;
  /** Target velocity at a given time, for the along-track projection. */
  targetVelocity: (t: number) => Vec2;
  /** Resolve the candidate's missions together with the committed ones. */
  resolve: (ms: Mission[]) => ResolveVerdict;
  /** Allow SWARM bundles (k = 2, 3). */
  swarm?: boolean;
  /** Swarm tier (2: split bus x3, 3: x8) adds SPLIT carrier candidates. */
  swarmTier?: number;
  /** Fields the commit stamps on every mission: autonomy tier, dv budget, rules. */
  autonomyTier?: number;
  dvBudget?: number;
}

export interface Candidate {
  archetype: 'KINETIC' | 'SWARM' | 'SPLIT' | 'KINETIC_FLYBY' | 'SAIL_KINETIC' | 'NUKE_STANDOFF' | 'NUKE_DISRUPT' | 'SLOW_PUSH';
  missions: Mission[];
  iL: number;
  iA: number;
  missEstRadii: number;
  verdict: ResolveVerdict | null;
  pMiss: number;
  score: number;
  betaRange: readonly [number, number];
  /** Predicted Q/Q* of the first hit. */
  qRatio: number;
  cost: number;
}

/** Score pre-built missions (flyby and sail plans) with the same verdict and score as grid candidates. */
export function rankMissions(list: { archetype: Candidate['archetype'] | 'KINETIC_FLYBY' | 'SAIL_KINETIC'; missions: Mission[] }[], ctx: CandidateContext): Candidate[] {
  const range = KNOBS.BETA_RANGE[ctx.threatType] ?? ([2, 4] as const);
  const betaMid = (range[0] + range[1]) / 2;
  const out: Candidate[] = [];
  for (const item of list) {
    const first = item.missions[0];
    if (!first) continue;
    const dvAlong = estimateDvAlong(first, ctx, betaMid);
    const missEst = Math.abs(missFromImpulse(dvAlong, ctx.tImpact - first.arrivalTime)) / ctx.rHome;
    const cost = item.missions.reduce((a, m) => a + m.cost, 0);
    out.push({ archetype: item.archetype as Candidate['archetype'], missions: item.missions, iL: -1, iA: -1, missEstRadii: missEst, verdict: null, pMiss: 0, score: 0, betaRange: range, qRatio: qRatioFor(first, ctx), cost });
  }
  out.sort((a, b) => b.missEstRadii - a.missEstRadii);
  const top = out.slice(0, KNOBS.PLANNER_RESOLVE_TOP);
  for (const c of top) {
    const v = ctx.resolve(c.missions);
    c.verdict = v;
    const sc = scoreOf(v, c.cost, ctx);
    c.pMiss = sc.pMiss;
    c.score = sc.score;
  }
  return top;
}

/** Methods a slow-push tier unlocks (GAME_PLAN 9 and 20.2). NOT VIABLE ones are listed so their numbers show. */
export function pushMethodsForTier(tier: number, iron: boolean, sailTier: number): PushMethod[] {
  const out: PushMethod[] = [];
  if (tier >= 1) out.push('GRAVITY_TRACTOR', 'TETHER', 'ELECTROSTATIC');
  if (tier >= 2) out.push('ION_BEAM', 'MIRRORS', 'TUGBOAT');
  if (tier >= 2 && iron) out.push('MAGNETIC');
  if (tier >= 3) out.push('LASER', 'MASS_DRIVER');
  if (sailTier >= 2 && tier >= 1) out.push('ESAIL');
  return out;
}

/**
 * Slow-push candidates: the cells with the lowest closing speed (rendezvous mismatch paid by onboard dv),
 * one mission per unlocked method, pushed along track in the sign the planner finds best (both tried).
 */
export function rankSlowPush(g: PorkchopGrid, ctx: CandidateContext, pushTier: number, sailTier: number, dsmBudget: number, iron: boolean): Candidate[] {
  if (pushTier <= 0) return [];
  const cells: { iL: number; iA: number; U: number }[] = [];
  for (let iL = 0; iL < g.nL; iL++) for (let iA = 0; iA < g.nA; iA++) {
    const i = iL * g.nA + iA;
    if ((g.payload[i] ?? 0) > 0 && (g.U[i] ?? Infinity) <= dsmBudget) cells.push({ iL, iA, U: g.U[i] ?? Infinity });
  }
  cells.sort((a, b) => a.U - b.U);
  const out: Candidate[] = [];
  const methods = pushMethodsForTier(pushTier, iron, sailTier);
  for (const c of cells.slice(0, 2)) {
    for (const method of methods) {
      const base = missionFromCell(g, c.iL, c.iA, ctx, 'PUSH');
      if (!base) continue;
      const tier = Math.max(0, pushTier - 1);
      const pf = pushForce({ method, tier }, ctx.targetMass, ctx.targetD / 2, 1.495978707e11, iron);
      const tau = Math.max(0, ctx.tImpact - KNOBS.PUSH_END_MARGIN - base.arrivalTime);
      const accel = pf.force / ctx.targetMass;
      const est = Math.abs(missFromPush(accel, tau, 0)) / ctx.rHome;
      const cost = (KNOBS.COST_LAUNCHER[ctx.launcherTier - 1] ?? 0) + (KNOBS.COST_SLOW_PUSH[tier] ?? 4);
      let best: Candidate | null = null;
      for (const sign of [1, -1] as const) {
        const mission: Mission = { ...base, archetype: 'SLOW_PUSH', cost, dsmUsed: c.U, push: { method, tier, sign, tauMax: tau } };
        const v = ctx.resolve([mission]);
        const sc = scoreOf(v, cost, ctx);
        const cand: Candidate = { archetype: 'SLOW_PUSH', missions: [mission], iL: c.iL, iA: c.iA, missEstRadii: est, verdict: v, pMiss: sc.pMiss, score: pf.viable ? sc.score : sc.score - 5, betaRange: [1, 1], qRatio: 0, cost };
        if (!best || cand.score > best.score) best = cand;
      }
      if (best) out.push(best);
    }
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, 5);
}

export function missionCost(launcherTier: number, impactorTier: number): number {
  return (KNOBS.COST_LAUNCHER[launcherTier - 1] ?? 0) + (KNOBS.COST_IMPACTOR[impactorTier - 1] ?? 0);
}

export function missionFromCell(g: PorkchopGrid, iL: number, iA: number, ctx: CandidateContext, id: string): Mission | null {
  if (iL < 0 || iA < 0 || iL >= g.nL || iA >= g.nA) return null;
  const i = iL * g.nA + iA;
  const payload = g.payload[i] ?? NaN;
  if (!(payload > 0)) return null;
  const { tL, tA } = cellTimes(g, iL, iA);
  const cap = KNOBS.IMPACTOR_KG[ctx.impactorTier - 1] ?? 1000;
  return {
    id,
    archetype: 'KINETIC',
    launcherTier: ctx.launcherTier,
    impactorTier: ctx.impactorTier,
    launchTime: tL,
    arrivalTime: tA,
    impactorKg: Math.min(payload, cap),
    c3: g.c3[i] ?? NaN,
    departureV: { x: g.v1x[i] ?? 0, y: g.v1y[i] ?? 0 },
    arrivalV: { x: g.v2x[i] ?? 0, y: g.v2y[i] ?? 0 },
    interceptR: { x: g.rx[i] ?? 0, y: g.ry[i] ?? 0 },
    U: g.U[i] ?? NaN,
    cost: missionCost(ctx.launcherTier, ctx.impactorTier),
    committedAt: ctx.committedAt,
    targetId: ctx.targetId,
  };
}

/** Along-track dv estimate for a mission with the given beta: beta (m/M) U cos(angle to the track). */
export function estimateDvAlong(m: Mission, ctx: CandidateContext, beta: number): number {
  const vt = ctx.targetVelocity(m.arrivalTime);
  const ux = m.arrivalV.x - vt.x;
  const uy = m.arrivalV.y - vt.y;
  const vm = Math.hypot(vt.x, vt.y);
  const along = vm > 0 ? (ux * vt.x + uy * vt.y) / vm : 0;
  return (beta * m.impactorKg * along) / ctx.targetMass;
}

export function qRatioFor(m: Mission, ctx: CandidateContext): number {
  const Qs = qStar(ctx.targetD / 2, ctx.threatDensity, ctx.threatStrength, ctx.threatMaterial);
  return specificEnergy(m.impactorKg, ctx.targetMass, m.U) / Qs;
}

function scoreOf(v: ResolveVerdict, cost: number, ctx: CandidateContext, nuke = false): { pMiss: number; score: number } {
  const pMiss = v.outcome === 'MISS' ? 1 : v.outcome === 'PARTIAL' ? 0.35 : 0;
  const affordable = cost <= ctx.budget + 1e-9;
  const score =
    KNOBS.W_MISS * pMiss -
    KNOBS.W_RES * (ctx.threatEnergyMt > 0 ? v.hitEnergyMt / ctx.threatEnergyMt : 0) -
    KNOBS.W_COST * (cost / Math.max(1, ctx.budget)) +
    KNOBS.W_MARGIN * Math.max(0, Math.min(1, v.marginRadii / 3)) -
    (nuke ? KNOBS.W_NUKE : 0) -
    (affordable ? 0 : 10);
  return { pMiss, score };
}

/**
 * Nuclear candidates from the grid (GAME_PLAN 6.11): STANDOFF wants a slow approach (fuze limit), DISRUPT
 * (subsurface) takes any cell. The warhead is the payload: the cell must lift its mass. Returns up to a
 * handful per mode, resolved and scored with the W_NUKE penalty.
 */
export function rankNukes(g: PorkchopGrid, ctx: CandidateContext, warheadTier: number): Candidate[] {
  if (warheadTier <= 0) return [];
  const yields = yieldsForTier(warheadTier);
  const out: Candidate[] = [];
  const Qs = qStar(ctx.targetD / 2, ctx.threatDensity, ctx.threatStrength, ctx.threatMaterial);
  const make = (iL: number, iA: number, yieldMt: number, mode: 'STANDOFF' | 'SUBSURFACE'): Candidate | null => {
    const m = missionFromCell(g, iL, iA, ctx, 'NUKE');
    if (!m) return null;
    const mass = warheadMass(yieldMt);
    const i = iL * g.nA + iA;
    if ((g.payload[i] ?? 0) < mass) return null;
    if (mode === 'STANDOFF' && !fuzeOk(m.U, warheadTier)) return null;
    const nb = nuclearBurst(yieldMt, mode, ctx.targetMass, ctx.targetD / 2, KNOBS.NUKE_STANDOFF_H_FRAC * ctx.targetD / 2);
    const cost = (KNOBS.COST_LAUNCHER[ctx.launcherTier - 1] ?? 0) + (KNOBS.COST_WARHEAD[Math.min(2, warheadTier - 1)] ?? 6);
    const mission: Mission = { ...m, archetype: mode === 'STANDOFF' ? 'NUKE_STANDOFF' : 'NUKE_DISRUPT', impactorKg: mass, cost, warhead: { yieldMt, mode, tier: warheadTier, pulses: 1 } };
    const missEst = Math.abs(missFromImpulse(nb.dv, ctx.tImpact - m.arrivalTime)) / ctx.rHome;
    return { archetype: mission.archetype as Candidate['archetype'], missions: [mission], iL, iA, missEstRadii: missEst, verdict: null, pMiss: 0, score: 0, betaRange: [1, 1], qRatio: nb.Q / Qs, cost };
  };
  // Standoff: the slowest feasible cells (low U) with the biggest yield; disrupt: the cells with the most payload.
  const cells: { iL: number; iA: number; U: number; payload: number }[] = [];
  for (let iL = 0; iL < g.nL; iL++) for (let iA = 0; iA < g.nA; iA++) {
    const i = iL * g.nA + iA;
    const pay = g.payload[i] ?? 0;
    if (pay > 0) cells.push({ iL, iA, U: g.U[i] ?? Infinity, payload: pay });
  }
  const biggest = yields[yields.length - 1] ?? 0.1;
  const slow = [...cells].sort((a, b) => a.U - b.U).slice(0, 6);
  for (const c of slow) {
    const cand = make(c.iL, c.iA, biggest, 'STANDOFF');
    if (cand) out.push(cand);
  }
  if (warheadTier >= 2) {
    const heavy = [...cells].sort((a, b) => b.payload - a.payload).slice(0, 4);
    for (const c of heavy) {
      const cand = make(c.iL, c.iA, biggest, 'SUBSURFACE');
      if (cand) out.push(cand);
    }
  }
  for (const c of out) {
    const v = ctx.resolve(c.missions);
    c.verdict = v;
    const sc = scoreOf(v, c.cost, ctx, true);
    c.pMiss = sc.pMiss;
    c.score = sc.score;
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, 4);
}

export function rankCandidates(g: PorkchopGrid, ctx: CandidateContext): Candidate[] {
  const range = KNOBS.BETA_RANGE[ctx.threatType] ?? ([2, 4] as const);
  const betaMid = (range[0] + range[1]) / 2;
  const all: Candidate[] = [];
  for (let iL = 0; iL < g.nL; iL++) {
    for (let iA = 0; iA < g.nA; iA++) {
      const m = missionFromCell(g, iL, iA, ctx, 'CAND');
      if (!m) continue;
      const dvAlong = estimateDvAlong(m, ctx, betaMid);
      const missEst = Math.abs(missFromImpulse(dvAlong, ctx.tImpact - m.arrivalTime)) / ctx.rHome;
      all.push({ archetype: 'KINETIC', missions: [m], iL, iA, missEstRadii: missEst, verdict: null, pMiss: 0, score: 0, betaRange: range, qRatio: qRatioFor(m, ctx), cost: m.cost });
    }
  }
  all.sort((a, b) => b.missEstRadii - a.missEstRadii);
  const top = all.slice(0, KNOBS.PLANNER_RESOLVE_TOP);

  // SPLIT carriers (swarm tiers 2, 3): the best cell's payload split into k sub-impactors with their own dv.
  if ((ctx.swarmTier ?? 1) >= 2) {
    const tierIdx = Math.min(3, ctx.swarmTier ?? 2);
    for (const base of top.slice(0, 2)) {
      const m = missionFromCell(g, base.iL, base.iA, ctx, 'CAND');
      if (!m) continue;
      const count = KNOBS.SPLIT_COUNT[tierIdx] ?? 3;
      const dvEach = KNOBS.SPLIT_DV[tierIdx] ?? 150;
      const cost = m.cost + 1; // the carrier bus
      top.push({ archetype: 'SPLIT', missions: [{ ...m, cost, split: { count, dvEach, deployed: false } }], iL: base.iL, iA: base.iA, missEstRadii: base.missEstRadii, verdict: null, pMiss: 0, score: 0, betaRange: range, qRatio: base.qRatio, cost });
    }
  }

  // SWARM bundles from the best single cells: k launches on consecutive grid steps.
  if (ctx.swarm !== false) {
    for (const base of top.slice(0, 2)) {
      for (const k of [2, 3]) {
        const ms: Mission[] = [];
        for (let j = 0; j < k; j++) {
          const m = missionFromCell(g, base.iL + j, base.iA + j, ctx, `CAND-${j}`);
          if (m) ms.push(m);
        }
        if (ms.length === k) {
          top.push({ archetype: 'SWARM', missions: ms, iL: base.iL, iA: base.iA, missEstRadii: base.missEstRadii * k, verdict: null, pMiss: 0, score: 0, betaRange: range, qRatio: base.qRatio, cost: ms.reduce((a, m) => a + m.cost, 0) });
        }
      }
    }
  }

  let n = 0;
  for (const c of top) {
    c.missions.forEach((m, j) => {
      m.id = `${c.archetype === 'SWARM' ? 'SWARM' : c.archetype === 'SPLIT' ? 'CARRIER' : 'IMPACTOR'}-${n + 1}${c.missions.length > 1 ? String.fromCharCode(65 + j) : ''}`;
      m.autonomyTier = ctx.autonomyTier ?? 0;
      m.dvBudget = ctx.dvBudget ?? 0;
    });
    n++;
    const v = ctx.resolve(c.missions);
    c.verdict = v;
    const sc = scoreOf(v, c.cost, ctx);
    c.pMiss = sc.pMiss;
    c.score = sc.score;
  }
  top.sort((a, b) => b.score - a.score);
  return top.slice(0, KNOBS.PLANNER_SHOW_TOP);
}
