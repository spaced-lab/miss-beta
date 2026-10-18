// WHAT: Attract mode (GAME_PLAN 13.1): a seeded round that plans itself with the top kinetic candidate and
//       resolves on the title screen's clock. Also the daily seed helper (GAME_PLAN 12).
// WHY:  The title should show the game being played; it doubles as a smoke test of the planner on boot.
// HOW:  createWorld + generateThreat (plain draw) + porkchop + rankCandidates with the tier-1 launcher;
//       the best candidate's missions are committed and the round is resolved once. The clock then runs at
//       `KNOBS.ATTRACT_RATE` years per real second; when the close approach passes a new seed is drawn.
// LORE: G1 (how to play), O10 (A to B)

import { KNOBS } from '../config/knobs';
import { YEAR } from '../physics/constants';
import { launcherTier } from '../physics/estimates';
import { propagate } from '../physics/kepler';
import { rankCandidates } from '../planner/candidates';
import { computePorkchop } from '../planner/porkchop';
import type { Mission } from '../sim/mission';
import { elementsAt, resolveRound, type RoundResult } from '../sim/resolver';
import { stateAt } from '../sim/orbit3';
import { roundRng } from '../sim/rng';
import { generateThreat } from '../sim/roundGen';
import { createWorld, planetById, type World } from '../sim/world';

export interface AttractRound {
  world: World;
  missions: Mission[];
  result: RoundResult;
  seed: string;
}


/** The daily seed: everyone gets the same rounds on the same calendar day (UTC). */
export function dailySeed(date = new Date()): string {
  return `DAILY-${date.toISOString().slice(0, 10)}`;
}

export function buildAttract(seed: string): AttractRound {
  const world = createWorld(seed, 1);
  world.threat = generateThreat(roundRng(seed, 1), world, 1, 0, { skipDiscovery: true });
  const th = world.threat;
  const home = planetById(world, 'HOME');
  const base = resolveRound(world);
  const g = computePorkchop({ home: home.elements, threat: th.elements, muSun: world.star.mu, tMin: KNOBS.BUILD_TIME_KINETIC, tImpact: th.tImpact, tier: launcherTier(1) });
  const range = KNOBS.BETA_RANGE[th.type.id] ?? ([2, 4] as const);
  const betaMid = (range[0] + range[1]) / 2;
  const threatBody = base.bodies[0];
  const cands = threatBody
    ? rankCandidates(g, {
        targetId: 'THREAT',
        targetMass: th.mass,
        targetD: th.D,
        threatType: th.type.id,
        threatDensity: th.type.density,
        threatStrength: th.type.strengthMult,
        threatMaterial: th.type.kind === 'comet' ? 'ice' : 'basalt',
        threatEnergyMt: base.energy.energyMt,
        tImpact: th.tImpact,
        rHome: home.radius,
        launcherTier: 1,
        impactorTier: 1,
        budget: KNOBS.BUDGET_START,
        committedAt: 0,
        targetVelocity: (t) => stateAt(elementsAt(threatBody.segments, t), world.star.mu, t).v,
        resolve: (ms) => {
          const r = resolveRound(world, ms, { betaOverride: betaMid });
          return { outcome: r.outcome, marginRadii: r.ca.marginRadii, hitEnergyMt: r.hitEnergyMt, producedFragments: r.producedFragments };
        },
      })
    : [];
  const best = cands.find((c) => c.archetype === 'KINETIC') ?? cands[0];
  const missions = best ? best.missions.map((m) => ({ ...m, committedAt: 0 })) : [];
  const result = resolveRound(world, missions);
  return { world, missions, result, seed };
}

/** Advance the attract clock; returns true when the round is over and a new one should be built. */
export function tickAttract(a: AttractRound, dtSeconds: number): boolean {
  a.world.t += dtSeconds * KNOBS.ATTRACT_RATE * YEAR;
  return a.world.t >= a.result.ca.tCa + 0.15 * YEAR;
}
