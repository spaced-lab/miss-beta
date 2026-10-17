// WHAT: Close approach between the threat and HOME, the gravitational-focusing impact test, and impact
//       energy / category (GAME_PLAN 6.4).
// WHY:  This is the ground truth of every round: after all missions have been applied, does d_min at closest
//       approach fall inside the focusing radius b_crit? Everything else (planner estimates, Monte Carlo) is
//       checked against this function.
// HOW:  Both bodies are propagated analytically. A coarse scan (one sample per hour over the window) finds
//       the bracket, then a golden-section search refines t_ca to one second. The heliocentric model ignores
//       HOME's gravity, so d_min is the asymptotic impact parameter b, and focusing enlarges the target:
//         v_esc = sqrt(2 mu_home / R);  b_crit = R sqrt(1 + (v_esc / v_inf)^2);  impact if d_min < b_crit.
//       Python mirror: pymiss/physics/close_approach.py.
// LORE: O12 (close approach), T2 (size ladder), D1 (impulse)

import { DAY, MT_TNT } from './constants';
import { propagate, type Elements } from './kepler';

export interface CloseApproach {
  /** Time of closest approach, s. */
  tCa: number;
  /** Minimum heliocentric separation, m (the impact parameter b). */
  dMin: number;
  /** Relative speed at closest approach, m/s. */
  vInf: number;
  /** Focusing radius, m. */
  bCrit: number;
  impact: boolean;
  /** (dMin - bCrit) / R_home: negative means hit. */
  marginRadii: number;
  /** Surface impact speed sqrt(vInf^2 + vEsc^2), m/s (meaningful when impact is true). */
  vImpact: number;
}

/** Escape speed from the surface: sqrt(2 mu / R). Example: HOME -> 11.19 km/s. */
export function escapeSpeed(mu: number, R: number): number {
  return Math.sqrt((2 * mu) / R);
}

/**
 * Critical impact parameter with gravitational focusing: b_crit = R sqrt(1 + (v_esc / v_inf)^2).
 * Example: HOME, v_inf = 10 km/s -> b_crit ≈ 1.50 R.
 */
export function bCrit(mu: number, R: number, vInf: number): number {
  const vEsc = escapeSpeed(mu, R);
  return R * Math.sqrt(1 + (vEsc * vEsc) / (vInf * vInf));
}

/** Golden-section minimum of a unimodal f on [a, b] to width tol. */
export function goldenMin(f: (t: number) => number, a: number, b: number, tol: number): number {
  const gr = (Math.sqrt(5) - 1) / 2;
  let lo = a;
  let hi = b;
  let c = hi - gr * (hi - lo);
  let d = lo + gr * (hi - lo);
  let fc = f(c);
  let fd = f(d);
  while (hi - lo > tol) {
    if (fc < fd) {
      hi = d;
      d = c;
      fd = fc;
      c = hi - gr * (hi - lo);
      fc = f(c);
    } else {
      lo = c;
      c = d;
      fc = fd;
      d = lo + gr * (hi - lo);
      fd = f(d);
    }
  }
  return (lo + hi) / 2;
}

export interface CloseApproachOpts {
  /** Half-width of the search window around tNominal, s. Default 90 days. */
  window?: number;
  /** Coarse sample spacing, s. Default 1 hour. */
  coarseStep?: number;
  /** Refinement tolerance on t, s. Default 1 s. */
  tol?: number;
}

/**
 * Closest approach of `threat` to `home` near `tNominal`, with the focusing test.
 * Example: a threat constructed to hit HOME at t_i (GAME_PLAN 10) returns dMin ≈ 0, impact true.
 */
export function closeApproach(threat: Elements, home: Elements, muSun: number, muHome: number, rHome: number, tNominal: number, opts: CloseApproachOpts = {}): CloseApproach {
  const window = opts.window ?? 90 * DAY;
  const coarse = opts.coarseStep ?? 3600;
  const tol = opts.tol ?? 1;
  const dist = (t: number): number => {
    const a = propagate(threat, muSun, t);
    const b = propagate(home, muSun, t);
    return Math.hypot(a.r.x - b.r.x, a.r.y - b.r.y);
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
  const b = propagate(home, muSun, tCa);
  const dMin = Math.hypot(a.r.x - b.r.x, a.r.y - b.r.y);
  const vInf = Math.hypot(a.v.x - b.v.x, a.v.y - b.v.y);
  const bc = bCrit(muHome, rHome, vInf);
  const vEsc = escapeSpeed(muHome, rHome);
  return {
    tCa,
    dMin,
    vInf,
    bCrit: bc,
    impact: dMin < bc,
    marginRadii: (dMin - bc) / rHome,
    vImpact: Math.sqrt(vInf * vInf + vEsc * vEsc),
  };
}

/** Mass of a sphere: (4/3) pi (D/2)^3 rho. Example: D = 100 m, rho 2700 -> 1.41e9 kg. */
export function sphereMass(D: number, rho: number): number {
  return (4 / 3) * Math.PI * Math.pow(D / 2, 3) * rho;
}

export interface ImpactEnergy {
  mass: number;
  energyJ: number;
  energyMt: number;
}

/** Kinetic energy at impact. Example: D = 100 m stony at 20 km/s -> ~67 Mt. */
export function impactEnergy(D: number, rho: number, vImpact: number): ImpactEnergy {
  const mass = sphereMass(D, rho);
  const energyJ = 0.5 * mass * vImpact * vImpact;
  return { mass, energyJ, energyMt: energyJ / MT_TNT };
}

export type ImpactCategory = 'AIRBURST' | 'CITY' | 'REGIONAL' | 'GLOBAL';

/** Size category (GAME_PLAN 6.4). Iron bodies airburst only below 10 m; everything else below 25 m. */
export function impactCategory(D: number, iron = false): ImpactCategory {
  if (D < (iron ? 10 : 25)) return 'AIRBURST';
  if (D < 140) return 'CITY';
  if (D < 1000) return 'REGIONAL';
  return 'GLOBAL';
}
