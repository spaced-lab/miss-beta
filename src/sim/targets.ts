// WHAT: The bodies a round can threaten (IDEAS 26): HOME, a Moon base, Mars-like cities on OUTER, and outposts on a
//       moon of GIANT. Each target gives its gravity, radius and heliocentric state at any time, and a close
//       approach of a threat orbit to it.
// WHY:  A civilisation that spreads out has more than one thing to protect, and the arithmetic changes with the
//       target: the Moon's gravity barely focuses an incoming rock (small b-crit), so the same miss in kilometres
//       is a bigger miss in lunar radii; Mars is further out, so rocks reach it at different speeds.
// HOW:  Planets use their Kepler elements and the physics close approach unchanged (so HOME rounds are exactly
//       as before). Moons ride a circular orbit around their planet: r = r_planet + a (cos(n t + phi), sin(n t +
//       phi)) with theta = n (t - t0_planet) + phi, n = sqrt(mu_planet / a^3) and the phase phi from a hash of the run seed (no Rng draw). Their close
//       approach is the same coarse scan plus golden-section refinement, on that moving state. Python has no
//       mirror: this is sim, built from the mirrored physics (bCrit, escapeSpeed, propagate). A tilted threat
//       orbit (M14 phase 2, sim/orbit3.ts is3D) is measured in 3-D: closeApproach3 for planets, the same scan
//       with the z separation for moons.
// LORE: T7 (protecting more than one world), O12 (close approach and b-crit)

import { KNOBS } from '../config/knobs';
import { bCrit, closeApproach, escapeSpeed, goldenMin, type CloseApproach, type CloseApproachOpts } from '../physics/closeApproach';
import { closeApproach3 } from '../physics/closeApproach3';
import { propagate, type Elements } from '../physics/kepler';
import { liftElements, propagate3, type Elements3 } from '../physics/kepler3';
import type { Vec2 } from '../util/vec';
import { is3D } from './orbit3';
import { hashSeed } from './rng';
import { planetById, type World } from './world';

export type TargetId = 'HOME' | 'MOON' | 'OUTER' | 'GIANT_MOON';
export const SITES: readonly TargetId[] = ['MOON', 'OUTER', 'GIANT_MOON'];

export interface Target {
  id: TargetId;
  /** What is being defended there, for the HUD and the debrief. */
  label: string;
  mu: number;
  radius: number;
  /** Heliocentric position and velocity at round time t. */
  state(t: number): { r: Vec2; v: Vec2 };
  /** Present for planets: the Kepler elements (the exact physics close approach is used). */
  elements?: Elements;
}

/** Circular moon orbit around a planet. Example: the Moon, a 3.844e8 m, mu_E 3.986e14 -> period 27.4 d. */
function moonState(world: World, planetId: string, a: number, phaseTag: string): (t: number) => { r: Vec2; v: Vec2 } {
  const p = planetById(world, planetId);
  const n = Math.sqrt(p.mu / (a * a * a));
  const phi = ((hashSeed(`${world.runSeed}:${phaseTag}`) >>> 0) / 4294967296) * 2 * Math.PI;
  return (t) => {
    const ps = propagate(p.elements, world.star.mu, t);
    // NOTE: measured from the planet's epoch, so re-basing the round clock (shiftEpoch) moves the moon with it.
    const th = n * (t - p.elements.t0) + phi;
    return {
      r: { x: ps.r.x + a * Math.cos(th), y: ps.r.y + a * Math.sin(th) },
      v: { x: ps.v.x - a * n * Math.sin(th), y: ps.v.y + a * n * Math.cos(th) },
    };
  };
}

export function targetOf(world: World, id: TargetId = 'HOME'): Target {
  if (id === 'MOON') return { id, label: 'MOON BASE', mu: KNOBS.MOON_MU, radius: KNOBS.MOON_RADIUS, state: moonState(world, 'HOME', KNOBS.MOON_A, 'MOON') };
  if (id === 'GIANT_MOON') return { id, label: 'GIANT-MOON OUTPOSTS', mu: KNOBS.GIANT_MOON_MU, radius: KNOBS.GIANT_MOON_RADIUS, state: moonState(world, 'GIANT', KNOBS.GIANT_MOON_A, 'GIANT_MOON') };
  const p = planetById(world, id);
  return { id, label: id === 'HOME' ? 'HOME' : 'OUTER CITIES', mu: p.mu, radius: p.radius, elements: p.elements, state: (t) => propagate(p.elements, world.star.mu, t) };
}

/**
 * Closest approach of a threat orbit to a target near tNominal, with the focusing test. Planets delegate to the
 * physics closeApproach (identical numbers); moons scan their moving state the same way.
 */
export function targetCloseApproach(threat: Elements, target: Target, muSun: number, tNominal: number, opts: CloseApproachOpts = {}): CloseApproach {
  if (is3D(threat)) return targetCloseApproach3(threat, target, muSun, tNominal, opts);
  if (target.elements) return closeApproach(threat, target.elements, muSun, target.mu, target.radius, tNominal, opts);
  const window = opts.window ?? 90 * 86400;
  const coarse = opts.coarseStep ?? 3600;
  const tol = opts.tol ?? 1;
  const dist = (t: number): number => {
    const a = propagate(threat, muSun, t).r;
    const b = target.state(t).r;
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  let bestT = tNominal;
  let bestD = Infinity;
  for (let t = tNominal - window; t <= tNominal + window; t += coarse) {
    const d = dist(t);
    if (d < bestD) {
      bestD = d;
      bestT = t;
    }
  }
  const tCa = goldenMin(dist, bestT - coarse, bestT + coarse, tol);
  const a = propagate(threat, muSun, tCa);
  const b = target.state(tCa);
  const dMin = Math.hypot(a.r.x - b.r.x, a.r.y - b.r.y);
  const vInf = Math.hypot(a.v.x - b.v.x, a.v.y - b.v.y);
  const bc = bCrit(target.mu, target.radius, vInf);
  const vEsc = escapeSpeed(target.mu, target.radius);
  return { tCa, dMin, vInf, bCrit: bc, impact: dMin < bc, marginRadii: (dMin - bc) / target.radius, vImpact: Math.sqrt(vInf * vInf + vEsc * vEsc) };
}

/**
 * The same test for a tilted threat orbit (M14 phase 2): planets use closeApproach3 against their lifted (i = 0)
 * elements; moons, which ride in the plane, are scanned with the 3-D separation |r_T - r_moon| (z_moon = 0).
 */
function targetCloseApproach3(threat: Elements3, target: Target, muSun: number, tNominal: number, opts: CloseApproachOpts): CloseApproach {
  if (target.elements) return closeApproach3(threat, liftElements(target.elements), muSun, target.mu, target.radius, tNominal, opts);
  const window = opts.window ?? 90 * 86400;
  const coarse = opts.coarseStep ?? 3600;
  const tol = opts.tol ?? 1;
  const dist = (t: number): number => {
    const a = propagate3(threat, muSun, t).r;
    const b = target.state(t).r;
    return Math.hypot(a.x - b.x, a.y - b.y, a.z);
  };
  let bestT = tNominal;
  let bestD = Infinity;
  for (let t = tNominal - window; t <= tNominal + window; t += coarse) {
    const d = dist(t);
    if (d < bestD) {
      bestD = d;
      bestT = t;
    }
  }
  const tCa = goldenMin(dist, bestT - coarse, bestT + coarse, tol);
  const a = propagate3(threat, muSun, tCa);
  const b = target.state(tCa);
  const dMin = Math.hypot(a.r.x - b.r.x, a.r.y - b.r.y, a.r.z);
  const vInf = Math.hypot(a.v.x - b.v.x, a.v.y - b.v.y, a.v.z);
  const bc = bCrit(target.mu, target.radius, vInf);
  const vEsc = escapeSpeed(target.mu, target.radius);
  return { tCa, dMin, vInf, bCrit: bc, impact: dMin < bc, marginRadii: (dMin - bc) / target.radius, vImpact: Math.sqrt(vInf * vInf + vEsc * vEsc) };
}
