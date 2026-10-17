// WHAT: Monte Carlo over the resolver: P(miss), P(partial) and expected residual energy for a mission set.
// WHY:  GAME_PLAN 7.3 step 3. Beta is uncertain until tracked, fragment ejection is random, and the 3-D
//       correction is a coin flip per fragment; the only honest number is a distribution. N samples of
//       the deterministic resolver with different sample seeds give it.
// HOW:  Pure and synchronous (the worker calls it). Sample 0 is the canonical ground truth; samples 1..N
//       re-draw every per-mission stream. Mean residual energy counts PARTIAL and HIT samples.
// LORE: O14 (randomness and probability), G3 (the planner)

import type { Mission } from '../sim/mission';
import { resolveRound } from '../sim/resolver';
import type { World } from '../sim/world';

export interface MonteCarloResult {
  n: number;
  pMiss: number;
  pPartial: number;
  pHit: number;
  /** Mean energy delivered by bodies that hit, Mt. */
  meanResidualMt: number;
  /** Mean and spread of the primary body's margin, planet radii. */
  marginMean: number;
  marginSigma: number;
  /** Fraction of samples that produced fragments. */
  pFragmented: number;
}

export function monteCarlo(world: World, missions: readonly Mission[], n: number): MonteCarloResult {
  let miss = 0;
  let partial = 0;
  let hit = 0;
  let residual = 0;
  let frag = 0;
  let mSum = 0;
  let m2Sum = 0;
  for (let i = 1; i <= n; i++) {
    const r = resolveRound(world, missions, { sampleSeed: i });
    if (r.outcome === 'MISS') miss++;
    else if (r.outcome === 'PARTIAL') partial++;
    else hit++;
    residual += r.hitEnergyMt;
    if (r.producedFragments) frag++;
    mSum += r.ca.marginRadii;
    m2Sum += r.ca.marginRadii * r.ca.marginRadii;
  }
  const mean = n > 0 ? mSum / n : 0;
  const varr = n > 0 ? Math.max(0, m2Sum / n - mean * mean) : 0;
  return { n, pMiss: n ? miss / n : 0, pPartial: n ? partial / n : 0, pHit: n ? hit / n : 0, meanResidualMt: n ? residual / n : 0, marginMean: mean, marginSigma: Math.sqrt(varr), pFragmented: n ? frag / n : 0 };
}
