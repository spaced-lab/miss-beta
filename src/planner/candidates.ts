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
}

export interface Candidate {
  archetype: 'KINETIC' | 'SWARM' | 'KINETIC_FLYBY' | 'SAIL_KINETIC';
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

function scoreOf(v: ResolveVerdict, cost: number, ctx: CandidateContext): { pMiss: number; score: number } {
  const pMiss = v.outcome === 'MISS' ? 1 : v.outcome === 'PARTIAL' ? 0.35 : 0;
  const affordable = cost <= ctx.budget + 1e-9;
  const score =
    KNOBS.W_MISS * pMiss -
    KNOBS.W_RES * (ctx.threatEnergyMt > 0 ? v.hitEnergyMt / ctx.threatEnergyMt : 0) -
    KNOBS.W_COST * (cost / Math.max(1, ctx.budget)) +
    KNOBS.W_MARGIN * Math.max(0, Math.min(1, v.marginRadii / 3)) -
    (affordable ? 0 : 10);
  return { pMiss, score };
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
      m.id = `${c.archetype === 'SWARM' ? 'SWARM' : 'IMPACTOR'}-${n + 1}${c.missions.length > 1 ? String.fromCharCode(65 + j) : ''}`;
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
