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
//       ("2041 KX-7"). Visitors from other stars (REALISTIC dial and SCI-FI INTERSTELLAR) are built in 3-D
//       (drawCollidingOrbit3, M14 phase 2); every other round stays planar and draws exactly as before.
//       Python has no mirror: this is sim, not physics.
// LORE: T1, T2, O7, O14

import threatsJson from '../config/threats.json';
import { AU, YEAR } from '../physics/constants';
import { sphereMass } from '../physics/closeApproach';
import { OrbitError, stateToElements } from '../physics/elements';
import { stateToElements3 } from '../physics/elements3';
import { apoapsis, periapsis, type Elements } from '../physics/kepler';
import { KNOBS } from '../config/knobs';
import { discover } from './detection';
import { hashSeed, Rng } from './rng';
import { targetOf, type Target, type TargetId } from './targets';
import { generateAsteroidShape } from './shapes';
import type { Threat, ThreatFlavor, ThreatType } from './threat';
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
  /** SCI-FI mode (21.2): a share of rounds are interstellar objects, long-period comets or 5 km bodies. */
  scifi?: boolean;
  /** Force a SCI-FI flavor (tests, SPAWN). */
  flavor?: ThreatFlavor;
  /** REALISTIC: chance this round is a visitor from another star (OPTIONS INTERSTELLAR RATE), 0 for none. */
  interstellarRate?: number;
  /** SCI-FI: share of rounds that are visitors from other stars (OPTIONS SCI-FI VISITORS); default the knob. */
  scifiVisitorShare?: number;
  /** Run seed, for the visitor draw's own stream (keeps every other draw of the round unchanged). */
  runSeed?: string;
  /** IDEAS 26: protected sites built so far; a share of rounds aim at one of them (own seeded stream). */
  sites?: readonly TargetId[];
}

/** The body a round aims at: HOME, or with chance SITE_TARGET_SHARE one built site, drawn on its own stream. */
export function pickTarget(runSeed: string, k: number, sites: readonly TargetId[] = []): TargetId {
  if (sites.length === 0) return 'HOME';
  const side = new Rng(hashSeed(`${runSeed}:${k}:TARGET`));
  if (!side.chance(KNOBS.SITE_TARGET_SHARE)) return 'HOME';
  return sites[side.int(0, sites.length - 1)] ?? 'HOME';
}

/** Orbit-draw limits for one flavor. */
interface OrbitDrawOpts {
  uInfMin: number;
  uInfMax: number;
  maxApo: number;
  maxE: number;
  allowUnbound: boolean;
}

/** [knob] SCI-FI flavor shares per round: interstellar 0.3, long-period 0.25, giant 0.2, else the ordinary draw. */
export function drawFlavor(rng: Rng, interstellarShare: number = KNOBS.SCIFI_SHARE_INTERSTELLAR): ThreatFlavor | null {
  const u = rng.next();
  if (u < interstellarShare) return 'INTERSTELLAR';
  if (u < interstellarShare + KNOBS.SCIFI_SHARE_LONG_PERIOD) return 'LONG_PERIOD';
  if (u < interstellarShare + KNOBS.SCIFI_SHARE_LONG_PERIOD + KNOBS.SCIFI_SHARE_GIANT) return 'GIANT';
  return null;
}

/** p_surprise(k): chance that a never-discovered candidate is kept as a NO WARNING round. */
export function surpriseProbability(k: number): number {
  return Math.min(KNOBS.SURPRISE_MAX, KNOBS.SURPRISE_BASE + KNOBS.SURPRISE_PER_ROUND * (k - 1));
}

function orbitOptsFor(type: ThreatType, flavor: ThreatFlavor | null): OrbitDrawOpts {
  switch (flavor) {
    case 'INTERSTELLAR':
      return { uInfMin: KNOBS.INTERSTELLAR_VINF_KMS[0] * 1000, uInfMax: KNOBS.INTERSTELLAR_VINF_KMS[1] * 1000, maxApo: Infinity, maxE: Infinity, allowUnbound: true };
    case 'LONG_PERIOD':
      // NOTE: a 2-D prograde world has no retrograde comets, so the bound long-period set needs v_inf under ~45 km/s.
      return { uInfMin: 25e3, uInfMax: 45e3, maxApo: KNOBS.LONG_PERIOD_MAX_APO_AU * AU, maxE: 0.9995, allowUnbound: false };
    default:
      return { uInfMin: type.vInfMin * 1000, uInfMax: type.vInfMax * 1000, maxApo: (type.kind === 'comet' ? 40 : 6) * AU, maxE: 0.98, allowUnbound: false };
  }
}

/** One colliding orbit for the given size/type at impact epoch tImpact, or null if 200 draws fail. */
function drawCollidingOrbit(rng: Rng, world: World, type: ThreatType, tImpact: number, o: OrbitDrawOpts = orbitOptsFor(type, null), attempts = 200, target?: Target): { elements: Elements; uInf: number } | null {
  // The rock is built backward from the target's state at impact (HOME unless a site was drawn).
  const hs = target ? target.state(tImpact) : planetState(world, planetById(world, 'HOME'), tImpact);
  for (let attempt = 0; attempt < attempts; attempt++) {
    const uInf = rng.logUniform(o.uInfMin, o.uInfMax);
    const phi = rng.float(0, Math.PI * 2);
    const v = { x: hs.v.x + uInf * Math.cos(phi), y: hs.v.y + uInf * Math.sin(phi) };
    let elements: Elements;
    try {
      elements = stateToElements(hs.r, v, world.star.mu, tImpact, o.allowUnbound);
    } catch (e) {
      if (e instanceof OrbitError) continue;
      throw e;
    }
    if (o.allowUnbound && elements.e < 1) continue; // an interstellar object is unbound by definition
    if (periapsis(elements) <= 0.25 * AU) continue;
    if (elements.e < 1 && apoapsis(elements) >= o.maxApo) continue;
    if (elements.e >= o.maxE) continue;
    return { elements, uInf };
  }
  return null;
}

/**
 * A colliding orbit in three dimensions (M14 phase 2): HOME's state at impact plus a closing velocity of speed
 * u_inf in a direction drawn uniformly on the sphere (cos(theta) = 1 - 2 u, phi uniform), converted with
 * stateToElements3. The impact point is HOME's position, so it lies on the orbit's line of nodes (z = 0) and
 * the hit stays exact. Retrograde (i > 90 deg) is allowed. Draw order per attempt: u_inf, cos(theta), phi.
 * Example: u_inf 26 km/s straight down the pole (cos(theta) = -1) gives i near 90 deg and a node on HOME.
 */
function drawCollidingOrbit3(rng: Rng, world: World, tImpact: number, o: OrbitDrawOpts, attempts: number): { elements: Elements; uInf: number } | null {
  const hs = planetState(world, planetById(world, 'HOME'), tImpact);
  for (let attempt = 0; attempt < attempts; attempt++) {
    const uInf = rng.logUniform(o.uInfMin, o.uInfMax);
    const ct = 1 - 2 * rng.next();
    const phi = rng.float(0, Math.PI * 2);
    const st = Math.sqrt(Math.max(0, 1 - ct * ct));
    const v = { x: hs.v.x + uInf * st * Math.cos(phi), y: hs.v.y + uInf * st * Math.sin(phi), z: uInf * ct };
    let elements: Elements;
    try {
      elements = stateToElements3({ x: hs.r.x, y: hs.r.y, z: 0 }, v, world.star.mu, tImpact, o.allowUnbound);
    } catch (e) {
      if (e instanceof OrbitError) continue;
      throw e;
    }
    if (o.allowUnbound && elements.e < 1) continue;
    if (periapsis(elements) <= 0.25 * AU) continue;
    if (elements.e < 1 && apoapsis(elements) >= o.maxApo) continue;
    if (elements.e >= o.maxE) continue;
    return { elements, uInf };
  }
  return null;
}

/**
 * Build the round's threat. `now` is the round's start time (world.t). With discovery on, the world's planet
 * epochs are shifted so the round clock starts at the discovery. Throws only if every attempt fails.
 */
export function generateThreat(rng: Rng, world: World, k: number, now = world.t, opts: GenerateOpts = {}): Threat {
  const flavor = opts.flavor ?? (opts.scifi ? drawFlavor(rng, opts.scifiVisitorShare) : null);
  if (flavor) return generateFlavored(rng, world, k, now, flavor);
  // NOTE: the visitor chance draws from its own stream, so a seed's ordinary rounds are the same at any rate.
  if (!opts.scifi && !opts.skipDiscovery && (opts.interstellarRate ?? 0) > 0) {
    const side = new Rng(hashSeed(`${opts.runSeed ?? world.runSeed}:${k}:INTERSTELLAR`));
    if (side.chance(opts.interstellarRate ?? 0)) return generateRealVisitor(side, world, k, now);
  }
  const targetId = pickTarget(opts.runSeed ?? world.runSeed, k, opts.sites);
  const target = targetId === 'HOME' ? undefined : targetOf(world, targetId);
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
      const orbit = drawCollidingOrbit(rng, world, type, tCand, undefined, 200, target);
      if (!orbit) continue;
      const disc = discover({ threat: orbit.elements, home: home.elements, inner: inner.elements, muSun: world.star.mu, tImpact: tCand, D, albedo, activeIds: world.networks.active, sinceOverride: world.networks.since }, rng);
      if (disc.tDisc === null) {
        if (rng.chance(pSurprise)) {
          // NO WARNING: sensed only at the end. Re-base so the round starts NO_WARNING_LEAD before impact.
          const tDisc = tCand - KNOBS.NO_WARNING_LEAD;
          return aimed(finish(world, rng, { name, type, D, shape, elements: shiftEpoch(orbit.elements, tDisc), tImpact: tCand - tDisc, uInf: orbit.uInf, discoveredBy: null, noWarning: true }, tDisc), targetId);
        }
        continue;
      }
      if (disc.lead < lo * lead || disc.lead > hi * lead) continue;
      const tDisc = disc.tDisc;
      return aimed(finish(world, rng, { name, type, D, shape, elements: shiftEpoch(orbit.elements, tDisc), tImpact: tCand - tDisc, uInf: orbit.uInf, discoveredBy: disc.networkId, noWarning: false }, tDisc), targetId);
    }
    // Fall through to the plain draw if rejection sampling found nothing (rare; keeps the game going).
  }

  const tImpact = now + lead;
  const orbit = drawCollidingOrbit(rng, world, type, tImpact, undefined, 200, target);
  if (!orbit) throw new Error('generateThreat: no acceptable orbit in 200 attempts');
  return aimed(finish(world, rng, { name, type, D, shape, elements: orbit.elements, tImpact, uInf: orbit.uInf, discoveredBy: 'ASSUMED', noWarning: false }, 0), targetId);
}

/** Tag a threat with its target (HOME stays untagged, so HOME rounds and their saves are unchanged). */
function aimed(th: Threat, targetId: TargetId): Threat {
  return targetId === 'HOME' ? th : { ...th, targetId };
}

/**
 * A REALISTIC visitor from another star: a hyperbolic orbit arriving from a direction drawn uniformly on the
 * sphere (a true 3-D orbit since M14 phase 2: elements carry i and raan), dark, and found only by the real
 * discovery search over the last few years. Weeks of warning, or none. Draws from `rng` (the visitor stream) in
 * a fixed order: D, type, name, shape, impact delay, orbit (u_inf, cos(theta), phi per attempt), then the
 * discovery's own coverage draws.
 */
function generateRealVisitor(rng: Rng, world: World, k: number, now: number): Threat {
  const D = rng.logUniform(KNOBS.REAL_INTERSTELLAR_D_M[0], KNOBS.REAL_INTERSTELLAR_D_M[1]);
  const type = (rng.chance(0.5) ? THREAT_TYPES.find((t) => t.id === 'ICY') : THREAT_TYPES.find((t) => t.id === 'STONY')) as ThreatType;
  const name = drawName(rng);
  const shape = generateAsteroidShape(rng);
  const tCand = now + rng.float(1.2, 2) * YEAR;
  const o: OrbitDrawOpts = { uInfMin: KNOBS.REAL_INTERSTELLAR_VINF_KMS[0] * 1000, uInfMax: KNOBS.REAL_INTERSTELLAR_VINF_KMS[1] * 1000, maxApo: Infinity, maxE: Infinity, allowUnbound: true };
  const orbit = drawCollidingOrbit3(rng, world, tCand, o, 2000);
  if (!orbit) throw new Error('generateThreat: no acceptable interstellar orbit in 2000 attempts');
  const home = planetById(world, 'HOME');
  const inner = planetById(world, 'INNER');
  // The discovery search sees the 3-D orbit itself (detection.ts: 3-D view geometry, trailing loss, latitude).
  const disc = discover({ threat: orbit.elements, home: home.elements, inner: inner.elements, muSun: world.star.mu, tImpact: tCand, D, albedo: KNOBS.REAL_INTERSTELLAR_ALBEDO, activeIds: world.networks.active, sinceOverride: world.networks.since, windowYears: KNOBS.REAL_INTERSTELLAR_WINDOW_YEARS }, rng);
  // Found: the round starts at the discovery. Never found: NO WARNING, sensed in the last days.
  const tDisc = disc.tDisc ?? tCand - KNOBS.NO_WARNING_LEAD;
  const th = finish(world, rng, { name, type, D, shape, elements: shiftEpoch(orbit.elements, tDisc), tImpact: tCand - tDisc, uInf: orbit.uInf, discoveredBy: disc.tDisc === null ? null : disc.networkId, noWarning: disc.tDisc === null }, tDisc);
  void k;
  return { ...th, flavor: 'INTERSTELLAR' };
}

/** The best SCI-FI visitor warning multiplier among the active networks. Example: ['ATLAS', 'HIVE_2'] gives 1.5. */
export function visitorWarningMult(active: readonly string[]): number {
  let m = 1;
  for (const id of active) m = Math.max(m, KNOBS.SCIFI_VISITOR_WARNING_MULT[id] ?? 1);
  return m;
}

/**
 * SCI-FI round types (21.2). The lead is fixed by the flavor (the civilization's networks are assumed to
 * see everything; discovery is not simulated): INTERSTELLAR 0.6 to 1.5 yr on a hyperbola at 50 to 90 km/s, times the
 * deep-space survey multiplier (visitorWarningMult);
 * LONG_PERIOD a comet 0.5 to 3 km with one year of warning; GIANT a 5 km body with the ordinary lead x1.5.
 */
function generateFlavored(rng: Rng, world: World, k: number, now: number, flavor: ThreatFlavor): Threat {
  const name = drawName(rng);
  const shape = generateAsteroidShape(rng);
  let type: ThreatType;
  let D: number;
  let lead: number;
  switch (flavor) {
    case 'INTERSTELLAR':
      type = (rng.chance(0.5) ? THREAT_TYPES.find((t) => t.id === 'ICY') : THREAT_TYPES.find((t) => t.id === 'STONY')) as ThreatType;
      D = rng.logUniform(100, 800);
      // NOTE: the deep-space surveys see a visitor sooner (IDEAS 27, knob SCIFI_VISITOR_WARNING_MULT). Applied after
      // the draw, so a run without them draws exactly as before.
      lead = rng.float(0.6, 1.5) * YEAR * visitorWarningMult(world.networks.active);
      break;
    case 'LONG_PERIOD':
      type = THREAT_TYPES.find((t) => t.id === 'ICY') as ThreatType;
      D = rng.logUniform(500, 3000);
      lead = rng.float(0.9, 1.1) * YEAR;
      break;
    case 'GIANT':
      type = drawType(rng, k);
      D = KNOBS.GIANT_D_M;
      lead = drawLeadTime(rng, k) * 1.5;
      break;
  }
  const tImpact = now + lead;
  // NOTE: an interstellar object arrives from any direction on the sky, so its orbit is drawn in 3-D (M14).
  const orbit = flavor === 'INTERSTELLAR' ? drawCollidingOrbit3(rng, world, tImpact, orbitOptsFor(type, flavor), 2000) : drawCollidingOrbit(rng, world, type, tImpact, orbitOptsFor(type, flavor), 2000);
  if (!orbit) throw new Error(`generateThreat: no acceptable ${flavor} orbit in 2000 attempts`);
  return { ...finish(world, rng, { name, type, D, shape, elements: orbit.elements, tImpact, uInf: orbit.uInf, discoveredBy: 'ASSUMED', noWarning: false }, 0), flavor };
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
