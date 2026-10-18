// WHAT: Orbit uncertainty and impact probability (GAME_PLAN 6.14).
// WHY:  Knowledge of the orbit is imperfect and improves with tracking tier and observed arc. The brief's
//       P(IMPACT) and the planner's MISS CONFIDENCE come from a 1-D Gaussian over the impact parameter.
// HOW:  sigma_v by tracking tier; sigma_b = 3 sigma_v T_remaining (the 3 dv T rule applied to the velocity
//       error); P = Phi((d + b_crit)/sigma_b) - Phi((d - b_crit)/sigma_b) with Phi the standard normal CDF
//       (Abramowitz-Stegun 7.1.26 erf, 1.5e-7 accurate). Arc improvement:
//       sigma_v(arc) = max(sigma_tier, sigma_0 sqrt(30 d / arc_days)). Python mirror: pymiss/physics/uncertainty.py.
// LORE: F8 (dots to orbits, uncertainty, keyholes), O14 (randomness and probability)

import { KNOBS } from '../config/knobs';

/** Error function, |error| < 1.5e-7 (Abramowitz and Stegun 7.1.26). */
export function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return sign * y;
}

/** Standard normal CDF. */
export function phi(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

export function sigmaVForTier(tier: number): number {
  return KNOBS.SIGMA_V_BY_TIER[Math.max(0, Math.min(KNOBS.SIGMA_V_BY_TIER.length - 1, tier))] ?? 0.005;
}

/** Velocity knowledge after `arcDays` of observations at a given tier. */
export function sigmaVWithArc(tier: number, arcDays: number): number {
  const floor = sigmaVForTier(tier);
  if (arcDays <= 0) return Math.max(floor, KNOBS.SIGMA_V_INITIAL);
  return Math.max(floor, KNOBS.SIGMA_V_INITIAL * Math.sqrt(KNOBS.SIGMA_V_ARC_REF_DAYS / arcDays));
}

/** Projected 1-sigma spread of the impact parameter at close approach: 3 sigma_v T. */
export function sigmaB(sigmaV: number, tRemaining: number): number {
  return 3 * sigmaV * Math.max(0, tRemaining);
}

/**
 * Impact probability for a nominal impact parameter dMin (signed distance is not known in 2-D; use the
 * magnitude) against the focusing radius bCrit with spread sigmaB.
 * Example: dMin = 0, bCrit = 9.5e6, sigmaB = 1e6 -> ~1.0; sigmaB = 2e7 -> ~0.37.
 */
export function impactProbability(dMin: number, bCrit: number, sb: number): number {
  if (sb <= 0) return dMin < bCrit ? 1 : 0;
  return phi((dMin + bCrit) / sb) - phi((dMin - bCrit) / sb);
}

/** Days after an impact before the beta is assessed, by tracking tier. */
export function betaAssessDelay(tier: number): number {
  return KNOBS.BETA_ASSESS_DELAY[Math.max(0, Math.min(KNOBS.BETA_ASSESS_DELAY.length - 1, tier))] ?? 60 * 86400;
}
