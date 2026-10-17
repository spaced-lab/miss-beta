import { describe, expect, it } from 'vitest';
import { KNOBS } from '../src/config/knobs';
import { AU, MU_SUN, YEAR } from '../src/physics/constants';
import { flyby, periapsisForTurn, signedAngle, soiRadius, turnAngle, turnAngleMax } from '../src/physics/flyby';
import { stateToElements } from '../src/physics/elements';
import { eulerStep, gravityDeriv, integrate, rk4Step } from '../src/physics/integrate';
import { propagate, specificEnergy, visViva } from '../src/physics/kepler';
import { characteristicAccel, integrateSail, lightness, sailAccel, sailTier } from '../src/physics/sail';
import vectors from './vectors/m4.json';

const MU_GIANT = 1.26686534e17;
const R_GIANT = 6.9911e7;

describe('integrate', () => {
  it('RK4 at 6 h tracks Kepler to under a kilometre over a year; Euler does not; energy error tiny', () => {
    const vc = visViva(MU_SUN, AU, AU);
    const s = integrate(gravityDeriv(MU_SUN), [AU, 0, 0, vc], 0, YEAR, 6 * 3600);
    const k = propagate({ a: AU, e: 0, w: 0, M0: 0, t0: 0 }, MU_SUN, YEAR);
    expect(Math.hypot(s[0] - k.r.x, s[1] - k.r.y)).toBeLessThan(1e3);
    const eps0 = specificEnergy(MU_SUN, AU, vc);
    const eps1 = specificEnergy(MU_SUN, Math.hypot(s[0], s[1]), Math.hypot(s[2], s[3]));
    expect(Math.abs((eps1 - eps0) / eps0)).toBeLessThan(1e-8);
    const e = integrate(gravityDeriv(MU_SUN), [AU, 0, 0, vc], 0, YEAR, 6 * 3600, eulerStep);
    expect(Math.hypot(e[0] - k.r.x, e[1] - k.r.y)).toBeGreaterThan(1e8);
    expect(rk4Step(gravityDeriv(MU_SUN), 0, [AU, 0, 0, vc], 1)[0]).toBeCloseTo(AU, 0);
  });
});

describe('sail', () => {
  it('SAIL: sigma 10 g/m^2, eta 0.9 -> a_c ≈ 0.82 mm/s^2; one year SPIRAL OUT from 1 AU builds 8..11 km/s', () => {
    const aC = characteristicAccel(0.01, 0.9);
    expect(aC * 1e3).toBeCloseTo(0.817, 2);
    expect(lightness(aC)).toBeCloseTo(0.138, 2);
    expect(sailTier(3).sigma).toBe(0.01);
    const vc = visViva(MU_SUN, AU, AU);
    const r = integrateSail([AU, 0, 0, vc], 0, YEAR, aC, MU_SUN, 'SPIRAL_OUT');
    // NOTE: GAME_PLAN 16 says 8..11 km/s; that figure holds the sail at 1 AU. The honest integral along the
    // spiral (flux falls as (AU/r)^2 while it climbs past 1.2 AU) is about 6.7 km/s. See STATUS.md.
    expect(r.dvEquiv).toBeGreaterThan(6e3);
    expect(r.dvEquiv).toBeLessThan(11e3);
    expect((0.385 * aC * YEAR) / 1e3).toBeCloseTo(9.97, 1); // the 1 AU figure the plan quotes
    expect(Math.hypot(r.state[0], r.state[1])).toBeGreaterThan(1.2 * AU);
    expect(r.samples.length).toBeGreaterThan(1000);
    const inward = integrateSail([AU, 0, 0, vc], 0, YEAR, aC, MU_SUN, 'SPIRAL_IN');
    expect(Math.hypot(inward.state[0], inward.state[1])).toBeLessThan(AU);
    const coast = integrateSail([AU, 0, 0, vc], 0, 0.1 * YEAR, aC, MU_SUN, 'COAST');
    expect(coast.dvEquiv).toBe(0);
  });

  it('sail acceleration components follow cos^3 / cos^2 sin and vanish when feathered', () => {
    const aC = 1e-3;
    const a = sailAccel({ x: AU, y: 0 }, KNOBS.SAIL_ALPHA_OPT, aC);
    expect(a.x).toBeCloseTo(aC * Math.cos(KNOBS.SAIL_ALPHA_OPT) ** 3, 12);
    expect(a.y).toBeCloseTo(aC * Math.cos(KNOBS.SAIL_ALPHA_OPT) ** 2 * Math.sin(KNOBS.SAIL_ALPHA_OPT), 12);
    expect(a.y / aC).toBeCloseTo(0.385, 3);
    expect(sailAccel({ x: AU, y: 0 }, Math.PI / 2, aC)).toEqual({ x: 0, y: 0 });
    expect(sailAccel({ x: 2 * AU, y: 0 }, 0, aC).x).toBeCloseTo(aC / 4, 12);
  });

  it('TARGET STEER lands nearer the target than a blind spiral', () => {
    const aC = characteristicAccel(0.01, 0.9);
    const vc = visViva(MU_SUN, AU, AU);
    // Target: a point on a 1.3 AU circle one year out, ahead in longitude.
    const tgt = { r: { x: 1.3 * AU * Math.cos(2.6), y: 1.3 * AU * Math.sin(2.6) }, t: 1.2 * YEAR };
    const steered = integrateSail([AU, 0, 0, vc], 0, YEAR, aC, MU_SUN, 'TARGET_STEER', tgt);
    const blind = integrateSail([AU, 0, 0, vc], 0, YEAR, aC, MU_SUN, 'SPIRAL_OUT');
    const missOf = (s: readonly number[]): number => {
      const el = stateToElements({ x: s[0]!, y: s[1]! }, { x: s[2]!, y: s[3]! }, MU_SUN, YEAR);
      const p = propagate(el, MU_SUN, tgt.t);
      return Math.hypot(p.r.x - tgt.r.x, p.r.y - tgt.r.y);
    };
    expect(missOf(steered.state)).toBeLessThan(missOf(blind.state));
  });
});

describe('flyby', () => {
  it('FLYBY: GIANT, r_p = 10 R, v_inf = 10 km/s -> delta ≈ 80.2 deg; |v_inf| preserved to 1e-9', () => {
    const d = turnAngle(10 * R_GIANT, 1e4, MU_GIANT);
    expect((d * 180) / Math.PI).toBeCloseTo(80.2, 1);
    expect(turnAngleMax(R_GIANT, 2 * R_GIANT, 1e4, MU_GIANT)).toBeGreaterThan(d);
    const r = flyby({ x: 1e4, y: 2e3 }, { x: 0, y: 13000 }, d, 1, MU_GIANT);
    const vin = Math.hypot(1e4 - 0, 2e3 - 13000);
    expect(Math.abs(Math.hypot(r.vInfOut.x, r.vInfOut.y) / vin - 1)).toBeLessThan(1e-9);
    expect(r.dvHelio).toBeCloseTo(2 * vin * Math.sin(d / 2), 6);
    expect(turnAngle(periapsisForTurn(d, 1e4, MU_GIANT), 1e4, MU_GIANT)).toBeCloseTo(d, 12);
    expect(soiRadius(5.203 * AU, MU_GIANT, MU_SUN) / AU).toBeCloseTo(0.322, 2);
    expect(signedAngle({ x: 1, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(Math.PI / 2, 12);
    expect(signedAngle({ x: 1, y: 0 }, { x: 0, y: -1 })).toBeCloseTo(-Math.PI / 2, 12);
  });
});

describe('shared vectors (generated by pymiss)', () => {
  interface Vec {
    rk4: { t1: number; h: number; x: number; y: number; vx: number; vy: number };
    sail: { aC: number; law: 'SPIRAL_OUT'; t1: number; x: number; y: number; vx: number; vy: number; dvEquiv: number; accel: { x: number; y: number; alpha: number; ax: number; ay: number }[] };
    flyby: { turn: { rP: number; vInf: number; mu: number; delta: number }[]; soi: number; flyby: { vsx: number; vsy: number; vpx: number; vpy: number; delta: number; side: 1 | -1; mu: number; outx: number; outy: number; voutx: number; vouty: number; dvHelio: number; rP: number } };
  }
  const vec = vectors as Vec;
  it('RK4, sail and flyby agree with Python', () => {
    const vc = visViva(MU_SUN, AU, AU);
    const s = integrate(gravityDeriv(MU_SUN), [AU, 0, 0, vc], 0, vec.rk4.t1, vec.rk4.h);
    expect(s[0] / vec.rk4.x).toBeCloseTo(1, 9);
    expect(s[1] / vec.rk4.y).toBeCloseTo(1, 9);
    expect(s[3] / vec.rk4.vy).toBeCloseTo(1, 9);
    const r = integrateSail([AU, 0, 0, vc], 0, vec.sail.t1, vec.sail.aC, MU_SUN, vec.sail.law);
    expect(r.state[0] / vec.sail.x).toBeCloseTo(1, 8);
    expect(r.state[1] / vec.sail.y).toBeCloseTo(1, 8);
    expect(r.dvEquiv / vec.sail.dvEquiv).toBeCloseTo(1, 8);
    for (const c of vec.sail.accel) {
      const a = sailAccel({ x: c.x, y: c.y }, c.alpha, vec.sail.aC);
      expect(a.x).toBeCloseTo(c.ax, 12);
      expect(a.y).toBeCloseTo(c.ay, 12);
    }
    for (const c of vec.flyby.turn) expect(turnAngle(c.rP, c.vInf, c.mu)).toBeCloseTo(c.delta, 12);
    expect(soiRadius(5.203 * AU, MU_GIANT, MU_SUN) / vec.flyby.soi).toBeCloseTo(1, 12);
    const f = vec.flyby.flyby;
    const res = flyby({ x: f.vsx, y: f.vsy }, { x: f.vpx, y: f.vpy }, f.delta, f.side, f.mu);
    expect(res.vInfOut.x).toBeCloseTo(f.outx, 6);
    expect(res.vOut.y).toBeCloseTo(f.vouty, 6);
    expect(res.dvHelio).toBeCloseTo(f.dvHelio, 6);
    expect(res.rP / f.rP).toBeCloseTo(1, 10);
  });
});
