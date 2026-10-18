import { describe, expect, it } from 'vitest';
import { DAY, YEAR } from '../src/physics/constants';
import { betaAssessDelay, erf, impactProbability, phi, sigmaB, sigmaVForTier, sigmaVWithArc } from '../src/physics/uncertainty';
import { formatEvent } from '../src/sim/eventLog';
import vectors from './vectors/uncertainty.json';

describe('uncertainty (GAME_PLAN 6.14)', () => {
  it('erf and Phi are accurate to 1e-6', () => {
    expect(erf(0)).toBeCloseTo(0, 8);
    expect(erf(1)).toBeCloseTo(0.8427008, 6);
    expect(erf(-1)).toBeCloseTo(-0.8427008, 6);
    expect(phi(0)).toBeCloseTo(0.5, 7);
    expect(phi(1.96)).toBeCloseTo(0.975, 3);
  });
  it('P(impact) follows the Gaussian over the impact parameter', () => {
    expect(impactProbability(0, 9.5e6, 1e6)).toBeGreaterThan(0.999);
    expect(impactProbability(0, 9.5e6, 2e7)).toBeCloseTo(0.3647, 2);
    expect(impactProbability(3e7, 9.5e6, 1e7)).toBeLessThan(0.05);
    expect(impactProbability(5e6, 9.5e6, 0)).toBe(1);
    expect(sigmaB(0.005, 10 * YEAR) / 4.7e6).toBeCloseTo(1, 1);
  });
  it('tiers and arcs: better tracking tightens sigma_v; longer arcs improve it to the tier floor', () => {
    expect(sigmaVForTier(0)).toBe(0.005);
    expect(sigmaVForTier(2)).toBe(0.0002);
    expect(sigmaVWithArc(0, 0)).toBe(0.02);
    expect(sigmaVWithArc(0, 120)).toBeCloseTo(0.01, 9);
    expect(sigmaVWithArc(0, 1e6)).toBe(0.005);
    expect(betaAssessDelay(0)).toBe(60 * DAY);
    expect(betaAssessDelay(2)).toBe(5 * DAY);
  });
  it('the play-by-play hides beta until the assessment time', () => {
    const e = { t: YEAR, kind: 'IMPACT' as const, missionId: 'IMPACTOR-1', U: 10000, beta: 3.21, dvAlong: 0.001, dvTotal: 0.0011, massKg: 1500, targetId: 'THREAT', qRatio: 0.1, betaKnownAt: YEAR + 60 * DAY };
    expect(formatEvent(e, 5 * YEAR, YEAR + 10 * DAY)).toContain('BETA ?');
    expect(formatEvent(e, 5 * YEAR, YEAR + 70 * DAY)).toContain('BETA 3.21');
    expect(formatEvent(e, 5 * YEAR)).toContain('BETA 3.21');
  });
  it('agrees with the Python vectors', () => {
    const v = vectors as { phi: { x: number; p: number }[]; pImpact: { d: number; b: number; s: number; p: number }[]; arc: { tier: number; days: number; s: number }[] };
    for (const c of v.phi) expect(phi(c.x)).toBeCloseTo(c.p, 12);
    for (const c of v.pImpact) expect(impactProbability(c.d, c.b, c.s)).toBeCloseTo(c.p, 12);
    for (const c of v.arc) expect(sigmaVWithArc(c.tier, c.days)).toBeCloseTo(c.s, 12);
  });
});
