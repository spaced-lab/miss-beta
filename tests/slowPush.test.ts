import { describe, expect, it } from 'vitest';
import { KNOBS } from '../src/config/knobs';
import { AU, MU_SUN, YEAR } from '../src/physics/constants';
import { missFromPush } from '../src/physics/estimates';
import { integratePush, pushForce, tractorPropellant, yarkovskyDrift } from '../src/physics/slowPush';
import { propagate } from '../src/physics/kepler';
import { pushMethodsForTier } from '../src/planner/candidates';
import vectors from './vectors/slowPush.json';

describe('slow push (GAME_PLAN 6.12, 20.2)', () => {
  it('a 1 t gravity tractor on a 100 m stony body gives ~0.4 mm/s per year; a 1 MW laser ~30 N', () => {
    const M = 1.4e9;
    const gt = pushForce({ method: 'GRAVITY_TRACTOR', tier: 0 }, M, 50, AU);
    const a = gt.force / M;
    expect(a * YEAR).toBeGreaterThan(0.3e-3);
    expect(a * YEAR).toBeLessThan(0.5e-3);
    expect(pushForce({ method: 'LASER', tier: 2 }, M, 50, AU).force).toBeCloseTo(30, 6);
    expect(pushForce({ method: 'ION_BEAM', tier: 1 }, M, 50, AU).force).toBe(0.5);
    expect(pushForce({ method: 'SAIL_ON_BODY', tier: 0 }, M, 50, AU).force).toBeCloseTo(9.08, 1);
    expect(tractorPropellant(1000, M, 50, YEAR)).toBeGreaterThan(0);
  });
  it('NOT VIABLE methods report zero force with their honest numbers', () => {
    const M = 1.4e12;
    expect(pushForce({ method: 'ELECTROSTATIC', tier: 0 }, M, 500, AU).viable).toBe(false);
    const tether = pushForce({ method: 'TETHER', tier: 0 }, M, 500, AU);
    expect(tether.viable).toBe(false);
    expect(tether.comShift).toBeLessThan(1000);
    expect(pushForce({ method: 'MAGNETIC', tier: 1 }, M, 500, AU, false).viable).toBe(false);
    expect(pushForce({ method: 'MAGNETIC', tier: 1 }, M, 500, AU, true).viable).toBe(true);
    expect(yarkovskyDrift(10 * YEAR)).toBeLessThan(1000);
    expect(pushMethodsForTier(1, false, 0)).toEqual(['GRAVITY_TRACTOR', 'TETHER', 'ELECTROSTATIC']);
    expect(pushMethodsForTier(3, true, 2)).toContain('LASER');
    expect(pushMethodsForTier(3, true, 2)).toContain('MAGNETIC');
  });
  it('the push arc raises the orbit and the 3 a tau (T + tau/2) estimate is the right order', () => {
    const el = { a: 1.2 * AU, e: 0.3, w: 0.7, M0: 2.0, t0: 0 };
    const arc = integratePush(el, MU_SUN, 0, YEAR, 1e-7);
    expect(arc.dv).toBeCloseTo(1e-7 * YEAR, 6);
    expect(arc.elements.a).toBeGreaterThan(el.a);
    // Along-track displacement at the end of the arc versus the estimate with T_rem = 0.
    const pushed = propagate(arc.elements, MU_SUN, YEAR).r;
    const free = propagate(el, MU_SUN, YEAR).r;
    const d = Math.hypot(pushed.x - free.x, pushed.y - free.y);
    const est = missFromPush(1e-7, YEAR, 0);
    expect(d / est).toBeGreaterThan(0.3);
    expect(d / est).toBeLessThan(3);
    expect(KNOBS.PUSH_END_MARGIN).toBeGreaterThan(0);
  });
  it('agrees with the Python vectors', () => {
    const v = vectors as { push: { a: number; e: number; w: number; M0: number; accel: number; t1: number; outA: number; outE: number; outW: number; outM0: number; dv: number }; tractor: { mSc: number; M: number; R: number; F: number; prop1y: number }[]; yarkovsky10y: number };
    const arc = integratePush({ a: v.push.a, e: v.push.e, w: v.push.w, M0: v.push.M0, t0: 0 }, MU_SUN, 0, v.push.t1, v.push.accel);
    expect(arc.elements.a / v.push.outA).toBeCloseTo(1, 9);
    expect(arc.elements.e).toBeCloseTo(v.push.outE, 9);
    expect(arc.elements.w).toBeCloseTo(v.push.outW, 8);
    expect(arc.elements.M0).toBeCloseTo(v.push.outM0, 8);
    for (const c of v.tractor) {
      const tier = KNOBS.TRACTOR_SC_MASS_KG.indexOf(c.mSc);
      expect(tier).toBeGreaterThanOrEqual(0);
      expect(pushForce({ method: 'GRAVITY_TRACTOR', tier }, c.M, c.R, AU).force / c.F).toBeCloseTo(1, 9);
      expect(tractorPropellant(c.mSc, c.M, c.R, YEAR) / c.prop1y).toBeCloseTo(1, 9);
    }
    expect(yarkovskyDrift(10 * YEAR)).toBeCloseTo(v.yarkovsky10y, 6);
  });
});
