// WHAT: KINETIC plan candidates from a porkchop grid, ranked (GAME_PLAN 7.2, 7.3).
// WHY:  The player should see the few cells that matter, with the planner's work printed. Two passes:
//       a cheap estimate (the 3 dv T rule with the mid-range beta) over every feasible cell, then a full
//       deterministic resolve of the top few, then the score of 7.3 (Monte Carlo P(miss) arrives in M3;
//       until then P(miss) is 1 for a positive margin and 0 otherwise).
// HOW:  Pure: (grid, context) -> Candidate[]. The resolve callback is injected so this module does not
//       depend on the resolver's world type (and so tests can stub it).
// LORE: G3 (the planner), D2 (early beats big), D3 (kinetic and beta)

import { KNOBS } from '../config/knobs';
import { missFromImpulse } from '../physics/estimates';
import type { Mission } from '../sim/mission';
import type { Vec2 } from '../util/vec';
import { cellTimes, type PorkchopGrid } from './porkchop';

export interface CandidateContext {
  threatMass: number;
  threatType: string;
  tImpact: number;
  rHome: number;
  launcherTier: number;
  impactorTier: number;
  budget: number;
  committedAt: number;
  /** Threat velocity at a given time, for the along-track projection. */
  threatVelocity: (t: number) => Vec2;
  /** Resolve the mission deterministically with the mid beta; returns the margin in planet radii. */
  resolveMargin: (m: Mission) => number;
}

export interface Candidate {
  mission: Mission;
  iL: number;
  iA: number;
  /** Quick estimate of the miss in planet radii (mid beta). */
  missEstRadii: number;
  /** Resolved margin in planet radii, or null if not resolved. */
  marginRadii: number | null;
  pMiss: number;
  score: number;
  betaRange: readonly [number, number];
}

export function missionCost(launcherTier: number, impactorTier: number): number {
  return (KNOBS.COST_LAUNCHER[launcherTier - 1] ?? 0) + (KNOBS.COST_IMPACTOR[impactorTier - 1] ?? 0);
}

export function missionFromCell(g: PorkchopGrid, iL: number, iA: number, ctx: CandidateContext, id: string): Mission | null {
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
  };
}

/** Along-track dv estimate for a mission with the given beta: beta (m/M) U cos(angle to the track). */
export function estimateDvAlong(m: Mission, ctx: CandidateContext, beta: number): number {
  const vt = ctx.threatVelocity(m.arrivalTime);
  const ux = m.arrivalV.x - vt.x;
  const uy = m.arrivalV.y - vt.y;
  const vm = Math.hypot(vt.x, vt.y);
  const along = vm > 0 ? (ux * vt.x + uy * vt.y) / vm : 0;
  return (beta * m.impactorKg * along) / ctx.threatMass;
}

export function rankCandidates(g: PorkchopGrid, ctx: CandidateContext): Candidate[] {
  const range = KNOBS.BETA_RANGE[ctx.threatType] ?? ([2, 4] as const);
  const betaMid = (range[0] + range[1]) / 2;
  const all: Candidate[] = [];
  let n = 0;
  for (let iL = 0; iL < g.nL; iL++) {
    for (let iA = 0; iA < g.nA; iA++) {
      const m = missionFromCell(g, iL, iA, ctx, `IMPACTOR-${++n}`);
      if (!m) continue;
      const dvAlong = estimateDvAlong(m, ctx, betaMid);
      const missEst = Math.abs(missFromImpulse(dvAlong, ctx.tImpact - m.arrivalTime)) / ctx.rHome;
      all.push({ mission: m, iL, iA, missEstRadii: missEst, marginRadii: null, pMiss: 0, score: 0, betaRange: range });
    }
  }
  all.sort((a, b) => b.missEstRadii - a.missEstRadii);
  const top = all.slice(0, KNOBS.PLANNER_RESOLVE_TOP);
  let k = 0;
  for (const c of top) {
    c.mission.id = `IMPACTOR-${++k}`;
    const margin = ctx.resolveMargin(c.mission);
    c.marginRadii = margin;
    c.pMiss = margin > 0 ? 1 : 0;
    const affordable = c.mission.cost <= ctx.budget;
    c.score = KNOBS.W_MISS * c.pMiss - KNOBS.W_COST * (c.mission.cost / Math.max(1, ctx.budget)) + KNOBS.W_MARGIN * Math.max(0, Math.min(1, margin / 3)) - (affordable ? 0 : 10);
  }
  top.sort((a, b) => b.score - a.score);
  return top.slice(0, KNOBS.PLANNER_SHOW_TOP);
}
