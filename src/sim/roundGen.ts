// WHAT: Seeded round generation: a threat built backward from the impact point so it is guaranteed to hit.
// WHY:  GAME_PLAN 10. Searching for a colliding orbit would be slow and flaky; constructing one is exact:
//       take HOME's state at the impact epoch, add a closing velocity of the type's speed in a random
//       direction, convert to elements, and accept if the orbit is sane. Lead time, diameter and type ramp
//       with the round index. Every draw comes from the round's RNG in a fixed order.
// HOW:  From M5 the lead time is discovery-derived (Section 10 note, 18.2): draw the orbit and size, run the
//       discovery search against the run's networks, keep the candidate if the lead lands in the round's window,
//       then re-base the clock so t = 0 is the discovery (planet and threat epochs shift). With probability
//       p_surprise(k) a never-discovered candidate becomes a NO WARNING round with a few days of lead.
//       The plain draw stays as the fallback (`skipDiscovery`). Names are vector-style designations
//       ("2041 KX-7"). Python has no mirror: this is sim, not physics.
// LORE: T1, T2, O7, O14

import threatsJson from '../config/threats.json';
import { AU, YEAR } from '../physics/constants';
import { sphereMass } from '../physics/closeApproach';
import { OrbitError, stateToElements } from '../physics/elements';
import { apoapsis, periapsis, type Elements } from '../physics/kepler';
import { KNOBS } from '../config/knobs';
import { discover } from './detection';
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

/** Shift an element set's epoch so that new time t' = t - dt describes the same motion. */
export function shiftEpoch(el: Elements, dt: number): Elements {
  return { ...el, t0: el.t0 - dt };
}

export interface GenerateOpts {
  /** Use the plain lead-time draw (M1 behaviour); tests and the title attract use it. */
  skipDiscovery?: boolean;
}

/** p_surprise(k): chance that a never-discovered candidate is kept as a NO WARNING round. */
export function surpriseProbability(k: number): number {
  return Math.min(KNOBS.SURPRISE_MAX, KNOBS.SURPRISE_BASE + KNOBS.SURPRISE_PER_ROUND * (k - 1));
}

/** One colliding orbit for the given size/type at impact epoch tImpact, or null if 200 draws fail. */
function drawCollidingOrbit(rng: Rng, world: World, type: ThreatType, tImpact: number): { elements: Elements; uInf: number } | null {
  const home = planetById(world, 'HOME');
  const hs = planetState(world, home, tImpact);
  const maxApo = (type.kind === 'comet' ? 40 : 6) * AU;
  for (let attempt = 0; attempt < 200; attempt++) {
    const uInf = rng.logUniform(type.vInfMin * 1000, type.vInfMax * 1000);
    const phi = rng.float(0, Math.PI * 2);
    const v = { x: hs.v.x + uInf * Math.cos(phi), y: hs.v.y + uInf * Math.sin(phi) };
    let elements: Elements;
    try {
      elements = stateToElements(hs.r, v, world.star.mu, tImpact);
    } catch (e) {
      if (e instanceof OrbitError) continue;
      throw e;
    }
    if (periapsis(elements) <= 0.25 * AU) continue;
    if (apoapsis(elements) >= maxApo) continue;
    if (elements.e >= 0.98) continue;
    return { elements, uInf };
  }
  return null;
}

/**
 * Build the round's threat. `now` is the round's start time (world.t). With discovery on, the world's planet
 * epochs are shifted so the round clock starts at the discovery. Throws only if every attempt fails.
 */
export function generateThreat(rng: Rng, world: World, k: number, now = world.t, opts: GenerateOpts = {}): Threat {
  const lead = drawLeadTime(rng, k);
  const D = drawDiameter(rng, k);
  const type = drawType(rng, k);
  const name = drawName(rng);
  const shape = generateAsteroidShape(rng);
  const home = planetById(world, 'HOME');
  const inner = planetById(world, 'INNER');
  const albedo = KNOBS.ALBEDO[type.id] ?? 0.15;

  if (!opts.skipDiscovery) {
    const [lo, hi] = KNOBS.LEAD_WINDOW;
    const pSurprise = surpriseProbability(k);
    for (let attempt = 0; attempt < 40; attempt++) {
      // Candidate impact epoch: a draw in the round's window; the discovery decides the actual lead.
      const tCand = now + lead * rng.float(lo, hi) * 1.2;
      const orbit = drawCollidingOrbit(rng, world, type, tCand);
      if (!orbit) continue;
      const disc = discover({ threat: orbit.elements, home: home.elements, inner: inner.elements, muSun: world.star.mu, tImpact: tCand, D, albedo, activeIds: world.networks.active, sinceOverride: world.networks.since }, rng);
      if (disc.tDisc === null) {
        if (rng.chance(pSurprise)) {
          // NO WARNING: sensed only at the end. Re-base so the round starts NO_WARNING_LEAD before impact.
          const tDisc = tCand - KNOBS.NO_WARNING_LEAD;
          return finish(world, rng, { name, type, D, shape, elements: shiftEpoch(orbit.elements, tDisc), tImpact: tCand - tDisc, uInf: orbit.uInf, discoveredBy: null, noWarning: true }, tDisc);
        }
        continue;
      }
      if (disc.lead < lo * lead || disc.lead > hi * lead) continue;
      const tDisc = disc.tDisc;
      return finish(world, rng, { name, type, D, shape, elements: shiftEpoch(orbit.elements, tDisc), tImpact: tCand - tDisc, uInf: orbit.uInf, discoveredBy: disc.networkId, noWarning: false }, tDisc);
    }
    // Fall through to the plain draw if rejection sampling found nothing (rare; keeps the game going).
  }

  const tImpact = now + lead;
  const orbit = drawCollidingOrbit(rng, world, type, tImpact);
  if (!orbit) throw new Error('generateThreat: no acceptable orbit in 200 attempts');
  return finish(world, rng, { name, type, D, shape, elements: orbit.elements, tImpact, uInf: orbit.uInf, discoveredBy: 'ASSUMED', noWarning: false }, 0);
}

interface Draft {
  name: string;
  type: ThreatType;
  D: number;
  shape: Float64Array;
  elements: Elements;
  tImpact: number;
  uInf: number;
  discoveredBy: string | null;
  noWarning: boolean;
}

/** Shift the world's planet epochs by tDisc (so t = 0 is the discovery) and assemble the threat record. */
function finish(world: World, rng: Rng, d: Draft, tDisc: number): Threat {
  void rng;
  if (tDisc !== 0) {
    for (const p of world.planets) (p as { elements: Elements }).elements = shiftEpoch(p.elements, tDisc);
  }
  return {
    kind: 'THREAT',
    id: `T${world.round}`,
    name: d.name,
    type: d.type,
    D: d.D,
    mass: sphereMass(d.D, d.type.density),
    elements: d.elements,
    tImpact: d.tImpact,
    vInfNominal: d.uInf,
    shape: d.shape,
    discoveredBy: d.discoveredBy,
    noWarning: d.noWarning,
  };
}
