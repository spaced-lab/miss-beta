// WHAT: Fragmentation: disruption threshold, largest remnant, fragment masses and ejection (GAME_PLAN 6.10).
// WHY:  Hitting too hard, or too late, is the central trap of planetary defense. The numbers here produce
//       the lesson on their own: a cloud spreads along track at roughly 3 v_ej T, so an early breakup
//       scatters past the planet and a late one aims a shotgun at it.
// HOW:  Q = 0.5 m U^2 / M (J/kg). Q* from the Benz and Asphaug (1999) scaling law in cgs:
//         Q*_cgs = Q0 R_cm^a + B rho_cgs R_cm^b, times 1e-4 for J/kg, times the type's strength multiplier.
//       If Q >= Q*: largest remnant f_LR = clamp(1 - 0.5 Q/Q*, 0.02, 0.5); the remainder is split into N
//       pieces with Pareto-distributed diameters (N(>D) ~ D^-2.5) renormalised to the remainder mass; the
//       centre of mass gets dv_com = (m / (M + m)) U u_hat (beta = 1: every gram is tracked); each piece
//       gets dv_com plus a Rayleigh ejection speed (scale k_ej v_esc sqrt(Q/Q*)) in a uniform in-plane
//       direction, with the mass-weighted mean ejection removed so momentum is conserved exactly.
//       Python mirror: pymiss/physics/fragment.py (same draw order from the same Rng).
// LORE: D4 (fragmentation), D2 (early beats big), O5 (energy and momentum)

import { KNOBS } from '../config/knobs';
import type { Rng } from '../sim/rng';
import type { Vec2 } from '../util/vec';
import { G } from './constants';

export type Material = 'basalt' | 'ice';

/** Catastrophic disruption threshold, J/kg. Example: R = 100 m, rho 2700, basalt -> ≈ 364 J/kg. */
export function qStar(R: number, rho: number, strengthMult = 1, material: Material = 'basalt'): number {
  const c = material === 'ice' ? KNOBS.QSTAR_ICE : KNOBS.QSTAR_BASALT;
  const Rcm = R * 100;
  const rhoCgs = rho / 1000;
  const qCgs = c.Q0 * Math.pow(Rcm, c.a) + c.B * rhoCgs * Math.pow(Rcm, c.b);
  return qCgs * 1e-4 * strengthMult;
}

/** Specific energy delivered by an impactor: 0.5 m U^2 / M. */
export function specificEnergy(m: number, M: number, U: number): number {
  return (0.5 * m * U * U) / M;
}

/** Largest remnant mass fraction: clamp(1 - 0.5 Q/Q*, 0.02, 0.5). */
export function largestRemnantFraction(Q: number, Qs: number): number {
  return Math.max(0.02, Math.min(0.5, 1 - 0.5 * (Q / Qs)));
}

/** Diameter of a sphere of mass `mass` and density `rho`, m. */
export function diameterFromMass(mass: number, rho: number): number {
  return 2 * Math.cbrt((3 * mass) / (4 * Math.PI * rho));
}

/** Surface escape speed sqrt(2 G M / R). Example: M = 1.4e9 kg, R = 50 m -> 0.061 m/s. */
export function escapeSpeedBody(M: number, R: number): number {
  return Math.sqrt((2 * G * M) / R);
}

/**
 * Fragment masses: n Pareto-distributed sizes (cumulative N(>D) ~ D^-alpha), masses ~ D^3, renormalised so
 * they sum to `total` exactly (to floating point). Returns descending order.
 */
export function fragmentMasses(rng: Rng, total: number, n: number, alpha = KNOBS.FRAG_PARETO_ALPHA): number[] {
  const sizes: number[] = [];
  for (let i = 0; i < n; i++) {
    let u = 0;
    while (u === 0) u = rng.next();
    sizes.push(Math.pow(u, -1 / alpha)); // Pareto with x_min = 1
  }
  const weights = sizes.map((d) => d * d * d);
  const sum = weights.reduce((a, b) => a + b, 0);
  const masses = weights.map((w) => (w / sum) * total);
  masses.sort((a, b) => b - a);
  // Absorb rounding into the largest piece so the sum is exact.
  const drift = total - masses.reduce((a, b) => a + b, 0);
  if (masses.length > 0) masses[0] = (masses[0] as number) + drift;
  return masses;
}

export interface Fragment {
  mass: number;
  D: number;
  /** Heliocentric velocity, m/s. */
  v: Vec2;
  largestRemnant: boolean;
}

export interface DisruptInput {
  M: number;
  R: number;
  rho: number;
  Q: number;
  Qstar: number;
  /** Impactor mass and relative velocity (v_impactor - v_threat). */
  m: number;
  Uvec: Vec2;
  /** Threat heliocentric velocity before impact. */
  vThreat: Vec2;
  nFrag: number;
  kEj?: number;
}

/**
 * Disrupt a body. Draw order from `rng` (shared with Python): fragment sizes (n draws), then per piece one
 * Rayleigh draw and one angle draw. The largest remnant is piece 0 and also receives an ejection velocity;
 * the mass-weighted mean ejection is subtracted from every piece so the total momentum equals
 * M v_threat + m U (the impactor's momentum is absorbed).
 */
export function disrupt(rng: Rng, inp: DisruptInput): Fragment[] {
  const fLR = largestRemnantFraction(inp.Q, inp.Qstar);
  const mLR = fLR * inp.M;
  const remainder = inp.M - mLR;
  const n = Math.max(1, inp.nFrag);
  const pieces = fragmentMasses(rng, remainder, n);
  const masses = [mLR, ...pieces];
  const U = Math.hypot(inp.Uvec.x, inp.Uvec.y);
  const kcom = inp.m / (inp.M + inp.m);
  const dvCom = { x: kcom * inp.Uvec.x, y: kcom * inp.Uvec.y };
  const vEsc = escapeSpeedBody(inp.M, inp.R);
  const scale = (inp.kEj ?? KNOBS.K_EJ) * vEsc * Math.sqrt(inp.Q / inp.Qstar);
  const ej: Vec2[] = [];
  for (let i = 0; i < masses.length; i++) {
    const speed = rng.rayleigh(scale);
    const ang = rng.float(0, Math.PI * 2);
    ej.push({ x: speed * Math.cos(ang), y: speed * Math.sin(ang) });
  }
  let px = 0;
  let py = 0;
  for (let i = 0; i < masses.length; i++) {
    px += (masses[i] as number) * (ej[i] as Vec2).x;
    py += (masses[i] as number) * (ej[i] as Vec2).y;
  }
  const mx = px / inp.M;
  const my = py / inp.M;
  const out: Fragment[] = [];
  for (let i = 0; i < masses.length; i++) {
    const mass = masses[i] as number;
    const e = ej[i] as Vec2;
    out.push({
      mass,
      D: diameterFromMass(mass, inp.rho),
      v: { x: inp.vThreat.x + dvCom.x + e.x - mx, y: inp.vThreat.y + dvCom.y + e.y - my },
      largestRemnant: i === 0,
    });
  }
  void U;
  return out;
}

/** 3-D correction to a fragment's 2-D hit probability: min(1, b_crit / (k v_ej T)). */
export function f3D(bCrit: number, vEj: number, T: number): number {
  const denom = KNOBS.F3D_K * vEj * T;
  return denom > 0 ? Math.min(1, bCrit / denom) : 1;
}

/** Below this diameter a fragment airbursts harmlessly (6.4). */
export function harmlessDiameter(iron: boolean): number {
  return iron ? KNOBS.FRAG_HARMLESS_D_IRON : KNOBS.FRAG_HARMLESS_D;
}
