// WHAT: The planner's ranking pass as one pure function of plain data: build the candidate context for a target
//       body, rank the porkchop grid (kinetic, swarm, nuclear, slow push, PI) and the flyby / sail plans.
// WHY:  Ranking resolves the top cells against the whole round and cost 0.6 to 1 s on the UI thread every time the
//       planner opened or a plan was committed: the visible freeze in AUTOPLAY and the SUPER-DUPER-DEMO. As plain
//       data it can run in the planner worker (D11 in docs/DECISIONS.md), with the same code inline as the fallback.
// HOW:  RankInput carries the world, the committed missions, the target body and the tiers; contextFor() rebuilds
//       the resolve and velocity callbacks from them on whichever thread runs the job. Same inputs, same list.
// LORE: G3 (the planner), C1 (how the game is built)

import { KNOBS } from '../config/knobs';
import type { Mission } from '../sim/mission';
import { stateAt } from '../sim/orbit3';
import { elementsAt, resolveRound, type Body } from '../sim/resolver';
import { planetById, type World } from '../sim/world';
import { rankCandidates, rankMissions, rankNukes, rankPI, rankSlowPush, type Candidate, type CandidateContext } from './candidates';
import type { FlybyResult } from './flybySearch';
import { missionFromFlyby, missionFromSail } from './legs';
import type { PorkchopGrid } from './porkchop';
import type { SailResult } from './sailSearch';

export interface RankInput {
  world: World;
  /** Missions already committed this round (verdicts are totals with them). */
  missions: Mission[];
  /** The body being planned against (the threat or a live fragment). */
  target: Body;
  /** Energy of the original threat, Mt (the residual term of the score). */
  threatEnergyMt: number;
  launcherTier: number;
  impactorTier: number;
  warheadTier: number;
  slowPushTier: number;
  sailTier: number;
  swarmTier: number;
  autonomyTier: number;
  pi: boolean;
  dsmBudget: number;
  budget: number;
}

/** The candidate context for one target; null without a threat. */
export function contextFor(inp: RankInput): CandidateContext | null {
  const w = inp.world;
  const th = w.threat;
  if (!th) return null;
  const target = inp.target;
  const home = planetById(w, 'HOME');
  const range = KNOBS.BETA_RANGE[th.type.id] ?? ([2, 4] as const);
  const betaMid = (range[0] + range[1]) / 2;
  return {
    targetId: target.id,
    targetMass: target.mass,
    targetD: target.D,
    threatType: th.type.id,
    threatDensity: th.type.density,
    threatStrength: th.type.strengthMult,
    threatMaterial: th.type.kind === 'comet' ? 'ice' : 'basalt',
    threatEnergyMt: inp.threatEnergyMt,
    tImpact: th.tImpact,
    rHome: home.radius,
    launcherTier: inp.launcherTier,
    impactorTier: inp.impactorTier,
    budget: inp.budget,
    committedAt: w.t,
    targetVelocity: (t) => stateAt(elementsAt(target.segments, t), w.star.mu, t).v,
    resolve: (ms) => {
      const r = resolveRound(w, [...inp.missions, ...ms], { betaOverride: betaMid });
      return { outcome: r.outcome, marginRadii: r.ca.marginRadii, hitEnergyMt: r.hitEnergyMt, producedFragments: r.producedFragments };
    },
    swarmTier: inp.swarmTier,
    autonomyTier: inp.autonomyTier,
    dvBudget: inp.dsmBudget,
  };
}

/** Every grid plan for the target, unfiltered (the overlay applies the launch cadence and the top-N cut). */
export function rankGrid(g: PorkchopGrid, inp: RankInput): Candidate[] {
  const ctx = contextFor(inp);
  if (!ctx) return [];
  const iron = (inp.world.threat?.type.id ?? '') === 'IRON';
  return [...rankCandidates(g, ctx), ...rankNukes(g, ctx, inp.warheadTier), ...rankSlowPush(g, ctx, inp.slowPushTier, inp.sailTier, inp.dsmBudget, iron), ...rankPI(g, ctx, inp.pi)];
}

/** Flyby and sail plans: the best few flyby cells by closing speed per planet, the best six sail arcs. */
export function rankExtras(flyby: FlybyResult | null, sail: SailResult | null, inp: RankInput): Candidate[] {
  const ctx = contextFor(inp);
  if (!ctx) return [];
  const w = inp.world;
  const home = planetById(w, 'HOME');
  const legCtx = { home: home.elements, muSun: w.star.mu, launcherTier: inp.launcherTier, impactorTier: inp.impactorTier, committedAt: w.t, targetId: inp.target.id };
  const list: { archetype: 'KINETIC_FLYBY' | 'SAIL_KINETIC'; missions: Mission[] }[] = [];
  if (flyby) {
    // Keep the best few flyby cells by closing speed per planet so the resolve budget is spent well.
    const byPlanet = new Map<string, FlybyResult['cells']>();
    for (const c of flyby.cells) {
      const arr = byPlanet.get(c.planetId) ?? [];
      arr.push(c);
      byPlanet.set(c.planetId, arr);
    }
    for (const arr of byPlanet.values()) {
      arr.sort((a, b) => b.U * Math.min(b.payload, 2e4) - a.U * Math.min(a.payload, 2e4));
      for (const c of arr.slice(0, 4)) {
        const m = missionFromFlyby(c, legCtx, 'FLYBY');
        if (m) list.push({ archetype: 'KINETIC_FLYBY', missions: [m] });
      }
    }
  }
  if (sail) {
    const cells = [...sail.cells].sort((a, b) => b.U * b.impactorKg - a.U * a.impactorKg).slice(0, 6);
    for (const c of cells) {
      const m = missionFromSail(c, legCtx, 'SAIL', inp.sailTier);
      if (m) list.push({ archetype: 'SAIL_KINETIC', missions: [m] });
    }
  }
  return rankMissions(list, ctx);
}
