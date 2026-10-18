import { describe, expect, it } from 'vitest';
import { KNOBS } from '../src/config/knobs';
import { fuzeOk, interceptedFraction, nuclearBurst, warheadMass, yieldsForTier } from '../src/physics/nuclear';
import { qStar } from '../src/physics/fragment';
import vectors from './vectors/nuclear.json';

describe('nuclear (GAME_PLAN 6.11)', () => {
  it('NUCLEAR: 1 Mt standoff at H = R/2 on a 1 km stony body gives 2..6 cm/s', () => {
    const M = (4 / 3) * Math.PI * 500 ** 3 * 2700;
    const r = nuclearBurst(1, 'STANDOFF', M, 500, 250);
    expect(r.dv).toBeGreaterThan(0.02);
    expect(r.dv).toBeLessThan(0.06);
    expect(r.fOmega).toBeCloseTo(0.1273, 3);
    expect(r.Q).toBeLessThan(qStar(500, 2700)); // no breakup from a standoff burst
  });
  it('surface and subsurface couple more and can disrupt; HAIV applies the accuracy factor', () => {
    const M = (4 / 3) * Math.PI * 150 ** 3 * 2700; // 300 m
    const standoff = nuclearBurst(1, 'STANDOFF', M, 150, 75);
    const surface = nuclearBurst(1, 'SURFACE', M, 150, 0);
    const sub = nuclearBurst(1, 'SUBSURFACE', M, 150, 0);
    const haiv = nuclearBurst(1, 'HAIV', M, 150, 0);
    expect(surface.dv).toBeGreaterThan(standoff.dv);
    expect(sub.dv).toBeGreaterThan(surface.dv);
    expect(haiv.eAbs).toBeCloseTo(sub.eAbs * KNOBS.HAIV_ACCURACY, 6);
    expect(sub.Q).toBeGreaterThan(qStar(150, 2700)); // a 1 Mt subsurface burst shatters a 300 m stony body
  });
  it('fuze limits, yields and masses by tier', () => {
    expect(fuzeOk(4000, 1)).toBe(true);
    expect(fuzeOk(8000, 1)).toBe(false);
    expect(fuzeOk(8000, 2)).toBe(true);
    expect(yieldsForTier(0)).toEqual([]);
    expect(yieldsForTier(1)).toEqual([0.1, 0.3]);
    expect(yieldsForTier(3)).toEqual([0.1, 0.3, 1, 5]);
    expect(warheadMass(1)).toBe(2000);
    expect(interceptedFraction(500, 0)).toBeCloseTo(0.5, 12);
  });
  it('agrees with the Python vectors', () => {
    const vec = vectors as { burst: { yieldMt: number; mode: 'STANDOFF' | 'SURFACE' | 'SUBSURFACE' | 'HAIV'; M: number; R: number; H: number; eAbs: number; dp: number; dv: number; Q: number; fOmega: number }[]; fOmega: { R: number; H: number; f: number }[]; mass: { Mt: number; kg: number }[] };
    for (const c of vec.burst) {
      const r = nuclearBurst(c.yieldMt, c.mode, c.M, c.R, c.H);
      expect(r.eAbs / c.eAbs).toBeCloseTo(1, 12);
      expect(r.dv / c.dv).toBeCloseTo(1, 12);
      expect(r.Q / c.Q).toBeCloseTo(1, 12);
      expect(r.fOmega).toBeCloseTo(c.fOmega, 12);
    }
    for (const c of vec.fOmega) expect(interceptedFraction(c.R, c.H)).toBeCloseTo(c.f, 12);
    for (const c of vec.mass) expect(warheadMass(c.Mt)).toBe(c.kg);
  });
});
