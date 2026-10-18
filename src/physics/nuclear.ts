// WHAT: Nuclear deflection and disruption (GAME_PLAN 6.11): standoff, surface, subsurface, HAIV, pulse train.
// WHY:  Standoff is a deflection tool (X-ray ablation of the facing surface; lab-verified on the Z machine
//       in 2024, never flown); surface and subsurface are disruption tools. Both are delivered like
//       impactors. The numbers are order-of-magnitude (NRC 2010) and the coupling constants are knobs.
// HOW:  f_omega = (1 - sqrt(1 - (R / (R + H))^2)) / 2   fraction of an isotropic yield intercepted at burst height H
//       E_abs = eps f_omega Y;  dp = C_m E_abs;  dv = dp / M along the burst-to-centre line;  Q_nuc = E_abs / M
//       Surface: f_omega 0.5, eps 0.5.  Subsurface: f_omega 1, eps 0.9.  HAIV: subsurface x accuracy.
//       Calibration: 1 Mt standoff at H = R/2 on a 1 km stony body gives ~3.4 cm/s with C_m = 3e-4.
//       Python mirror: pymiss/physics/nuclear.py.
// LORE: D5 (nuclear), D4 (fragmentation)

import { KNOBS } from '../config/knobs';
import { MT_TNT } from './constants';

export type BurstMode = 'STANDOFF' | 'SURFACE' | 'SUBSURFACE' | 'HAIV';

/** Fraction of an isotropic yield geometrically intercepted by a sphere of radius R from height H. */
export function interceptedFraction(R: number, H: number): number {
  const x = R / (R + H);
  return (1 - Math.sqrt(Math.max(0, 1 - x * x))) / 2;
}

export interface NuclearResult {
  /** Absorbed energy, J. */
  eAbs: number;
  /** Momentum delivered, N s. */
  dp: number;
  /** Speed change, m/s. */
  dv: number;
  /** Specific energy for the disruption test, J/kg. */
  Q: number;
  fOmega: number;
}

/**
 * Nuclear burst on a body of mass M and radius R. H is the standoff height (ignored for other modes).
 * Example: 1 Mt STANDOFF, R = 500 m, H = 250 m, M = 1.41e12 kg -> dv ≈ 0.034 m/s.
 */
export function nuclearBurst(yieldMt: number, mode: BurstMode, M: number, R: number, H: number): NuclearResult {
  const Y = yieldMt * MT_TNT;
  const eps = KNOBS.NUKE_EPS[mode] ?? 0.3;
  let fOmega: number;
  if (mode === 'STANDOFF') fOmega = interceptedFraction(R, H);
  else if (mode === 'SURFACE') fOmega = 0.5;
  else fOmega = 1;
  let eAbs = eps * fOmega * Y;
  if (mode === 'HAIV') eAbs *= KNOBS.HAIV_ACCURACY;
  const dp = KNOBS.NUKE_CM * eAbs;
  return { eAbs, dp, dv: dp / M, Q: eAbs / M, fOmega };
}

/** Warhead mass, kg: 1500 + 500 per Mt. */
export function warheadMass(yieldMt: number): number {
  return KNOBS.NUKE_MASS_BASE_KG + KNOBS.NUKE_MASS_PER_MT_KG * yieldMt;
}

/** Can a standoff burst be fuzed at closing speed U with this warhead tier? */
export function fuzeOk(U: number, warheadTier: number): boolean {
  return U <= (KNOBS.NUKE_FUZE_U[warheadTier] ?? 0);
}

/** Yields (Mt) available at a warhead tier. */
export function yieldsForTier(tier: number): number[] {
  return (KNOBS.NUKE_YIELDS_BY_TIER[tier] ?? []).map((i) => KNOBS.NUKE_YIELDS_MT[i] ?? 0);
}
