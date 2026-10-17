// WHAT: Seeded round generation: a threat built backward from the impact point so it is guaranteed to hit.
// WHY:  GAME_PLAN 10. Searching for a colliding orbit would be slow and flaky; constructing one is exact:
//       take HOME's state at the impact epoch, add a closing velocity of the type's speed in a random
//       direction, convert to elements, and accept if the orbit is sane. Lead time, diameter and type ramp
//       with the round index. Every draw comes from the round's RNG in a fixed order.
// HOW:  Fallback lead-time draw (the detection model of M5 replaces it). Names are vector-style
//       designations ("2041 KX-7"). Python has no mirror: this is sim, not physics.
// LORE: T1, T2, O7, O14

import threatsJson from '../config/threats.json';
import { AU, YEAR } from '../physics/constants';
import { sphereMass } from '../physics/closeApproach';
import { OrbitError, stateToElements } from '../physics/elements';
import { apoapsis, periapsis } from '../physics/kepler';
import type { Rng } from './rng';
import { generateAsteroidShape } from './shapes';
import type { Threat, ThreatType } from './threat';
import { planetById, planetState, type World } from './world';

export const THREAT_TYPES = (threatsJson as { types: ThreatType[] }).types;

/** Lead time in years for round k: clamp(12 - 0.8 k, 2.5, 12) * U(0.7, 1.3). */
export function drawLeadTime(rng: Rng, k: number): number {
  const base = Math.max(2.5, Math.min(12, 12 - 0.8 * k));
  return base * rng.float(0.7, 1.3) * YEAR;
}

/** Diameter in m for round k: logUniform(50 * 1.15^k, 200 * 1.2^k), capped at 2000. */
export function drawDiameter(rng: Rng, k: number): number {
  return Math.min(2000, rng.logUniform(50 * Math.pow(1.15, k), 200 * Math.pow(1.2, k)));
}

export function drawType(rng: Rng, k: number): ThreatType {
  const pool = THREAT_TYPES.filter((t) => k >= t.fromRound);
  const total = pool.reduce((s, t) => s + t.weight, 0);
  let u = rng.next() * total;
  for (const t of pool) {
    u -= t.weight;
    if (u <= 0) return t;
  }
  return pool[pool.length - 1] as ThreatType;
}

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export function drawName(rng: Rng): string {
  const year = 2027 + rng.int(0, 24);
  const a = LETTERS[rng.int(0, LETTERS.length - 1)] ?? 'K';
  const b = LETTERS[rng.int(0, LETTERS.length - 1)] ?? 'X';
  return `${year} ${a}${b}-${rng.int(1, 99)}`;
}

/**
 * Build the round's threat. `now` is the round's start time (world.t). Throws only if 200 attempts fail,
 * which the acceptance tests show does not happen for the default system.
 */
export function generateThreat(rng: Rng, world: World, k: number, now = world.t): Threat {
  const lead = drawLeadTime(rng, k);
  const D = drawDiameter(rng, k);
  const type = drawType(rng, k);
  const name = drawName(rng);
  const shape = generateAsteroidShape(rng);
  const tImpact = now + lead;
  const home = planetById(world, 'HOME');
  const hs = planetState(world, home, tImpact);
  const maxApo = (type.kind === 'comet' ? 40 : 6) * AU;

  for (let attempt = 0; attempt < 200; attempt++) {
    const uInf = rng.logUniform(type.vInfMin * 1000, type.vInfMax * 1000);
    const phi = rng.float(0, Math.PI * 2);
    const v = { x: hs.v.x + uInf * Math.cos(phi), y: hs.v.y + uInf * Math.sin(phi) };
    let elements;
    try {
      elements = stateToElements(hs.r, v, world.star.mu, tImpact);
    } catch (e) {
      if (e instanceof OrbitError) continue;
      throw e;
    }
    if (periapsis(elements) <= 0.25 * AU) continue;
    if (apoapsis(elements) >= maxApo) continue;
    if (elements.e >= 0.98) continue;
    return {
      kind: 'THREAT',
      id: `T${k}`,
      name,
      type,
      D,
      mass: sphereMass(D, type.density),
      elements,
      tImpact,
      vInfNominal: uInf,
      shape,
    };
  }
  throw new Error('generateThreat: no acceptable orbit in 200 attempts');
}
