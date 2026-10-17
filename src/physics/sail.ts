// WHAT: Solar sail force model, control laws and the integrated sail arc (GAME_PLAN 6.8).
// WHY:  Sails trade time for free dv: a good sail builds about 10 km/s in a year, which turns a small
//       impactor into a very fast one. That is the SAIL_KINETIC plan.
// HOW:  sigma = m / A (loading);  a_c = 2 eta P_rad / sigma (characteristic acceleration at 1 AU)
//       Flat ideal sail at cone angle alpha from the sun line: a = a_c (AU/r)^2 cos^2(alpha) n_hat, with
//       radial cos^3 and tangential cos^2 sin components; tangential thrust peaks at alpha = 35.26 deg.
//       Control laws: SPIRAL_OUT (+alpha_opt), SPIRAL_IN (-alpha_opt), COAST (feathered), TARGET_STEER
//       (greedy: each step tries SAIL_STEER_ANGLES and keeps the one whose one-step-then-coast prediction
//       lands closest to the target point at the target time). The arc is RK4 at SAIL_DT.
//       dvEquiv is the integral of the tangential (energy-raising) acceleration, the "dv the sail built".
//       Python mirror: pymiss/physics/sail.py (SPIRAL laws; TARGET_STEER is TypeScript-only, tested by result).
// LORE: D7 (sails), O13 (integration)

import { KNOBS } from '../config/knobs';
import type { Vec2 } from '../util/vec';
import { AU, P_RAD_1AU, SUN_ACCEL_1AU } from './constants';
import { stateToElements } from './elements';
import { integrate, rk4Step, type Deriv, type State4 } from './integrate';
import { propagate } from './kepler';

export type SailLaw = 'SPIRAL_OUT' | 'SPIRAL_IN' | 'COAST' | 'TARGET_STEER';

export interface SailSpec {
  tier: number;
  /** Loading, kg/m^2. */
  sigma: number;
  eta: number;
}

/** Characteristic acceleration a_c = 2 eta P_rad / sigma, m/s^2. Example: sigma 0.01, eta 0.9 -> 0.82 mm/s^2. */
export function characteristicAccel(sigma: number, eta = 0.9): number {
  return (2 * eta * P_RAD_1AU) / sigma;
}

/** Lightness number beta_s = a_c / (mu_sun / AU^2). Example: a_c 0.82 mm/s^2 -> 0.138. */
export function lightness(aC: number): number {
  return aC / SUN_ACCEL_1AU;
}

export function sailTier(tier: number): SailSpec {
  const t = KNOBS.SAIL_TIERS.find((s) => s.tier === tier);
  if (!t) throw new Error(`no sail tier ${tier}`);
  return { tier: t.tier, sigma: t.sigma, eta: t.eta };
}

/**
 * Sail acceleration vector at heliocentric position r for cone angle alpha (rad, positive turns the normal
 * toward the direction of orbital motion, i.e. counter-clockwise of the sun line). |alpha| >= 90 deg: zero.
 */
export function sailAccel(r: Vec2, alpha: number, aC: number): Vec2 {
  const rm = Math.hypot(r.x, r.y);
  if (rm === 0 || Math.abs(alpha) >= Math.PI / 2) return { x: 0, y: 0 };
  const rx = r.x / rm;
  const ry = r.y / rm;
  // Normal: sun line rotated by alpha (counter-clockwise).
  const nx = rx * Math.cos(alpha) - ry * Math.sin(alpha);
  const ny = rx * Math.sin(alpha) + ry * Math.cos(alpha);
  const mag = aC * (AU / rm) * (AU / rm) * Math.cos(alpha) * Math.cos(alpha);
  return { x: mag * nx, y: mag * ny };
}

export interface SailArcResult {
  state: State4;
  tEnd: number;
  /** Integral of the tangential acceleration along the arc, m/s. */
  dvEquiv: number;
  /** Sampled positions every step for drawing: flat [x0, y0, ...]. */
  samples: Float64Array;
}

export interface SteerTarget {
  r: Vec2;
  t: number;
}

/**
 * Integrate a sail arc from `s0` at `t0` to `t1`. For TARGET_STEER a target point and time are required.
 * Example: Tier 3 (a_c 0.82 mm/s^2), SPIRAL_OUT from 1 AU circular for one year -> dvEquiv 8..11 km/s.
 */
export function integrateSail(s0: State4, t0: number, t1: number, aC: number, mu: number, law: SailLaw, target?: SteerTarget, h = KNOBS.SAIL_DT): SailArcResult {
  const alphaOpt = KNOBS.SAIL_ALPHA_OPT;
  const fixedAlpha = law === 'SPIRAL_OUT' ? alphaOpt : law === 'SPIRAL_IN' ? -alphaOpt : Math.PI / 2;
  const derivFor = (alpha: number): Deriv => (_t, s) => {
    const r2 = s[0] * s[0] + s[1] * s[1];
    const r3 = r2 * Math.sqrt(r2);
    const a = sailAccel({ x: s[0], y: s[1] }, alpha, aC);
    return [s[2], s[3], (-mu * s[0]) / r3 + a.x, (-mu * s[1]) / r3 + a.y];
  };
  const n = Math.ceil((t1 - t0) / h) + 1;
  const samples = new Float64Array(n * 2 + 2);
  let count = 0;
  let dv = 0;
  const record = (s: State4, alpha: number, dt: number): void => {
    samples[count * 2] = s[0];
    samples[count * 2 + 1] = s[1];
    count++;
    // Tangential component of the sail acceleration along the velocity direction.
    const a = sailAccel({ x: s[0], y: s[1] }, alpha, aC);
    const vm = Math.hypot(s[2], s[3]);
    if (vm > 0) dv += Math.abs((a.x * s[2] + a.y * s[3]) / vm) * dt;
  };

  if (law !== 'TARGET_STEER') {
    const f = derivFor(fixedAlpha);
    let last = t0;
    const s = integrate(f, s0, t0, t1, h, rk4Step, (t, st) => {
      record(st, fixedAlpha, t - last);
      last = t;
    });
    return { state: s, tEnd: t1, dvEquiv: dv, samples: samples.subarray(0, count * 2) };
  }

  if (!target) throw new Error('TARGET_STEER needs a target');
  // Greedy steering: try each candidate angle for one step, coast analytically to the target time, keep the best.
  const missAfter = (s: State4, t: number): number => {
    try {
      const el = stateToElements({ x: s[0], y: s[1] }, { x: s[2], y: s[3] }, mu, t);
      const p = propagate(el, mu, target.t);
      return Math.hypot(p.r.x - target.r.x, p.r.y - target.r.y);
    } catch {
      return Infinity;
    }
  };
  let s = s0;
  let t = t0;
  record(s, 0, 0);
  while (t < t1 - 1e-9) {
    const dt = Math.min(h, t1 - t);
    let bestS = s;
    let bestAlpha = 0;
    let bestMiss = Infinity;
    for (const alpha of KNOBS.SAIL_STEER_ANGLES) {
      const cand = rk4Step(derivFor(alpha), t, s, dt);
      const miss = missAfter(cand, t + dt);
      if (miss < bestMiss) {
        bestMiss = miss;
        bestS = cand;
        bestAlpha = alpha;
      }
    }
    s = bestS;
    t += dt;
    record(s, bestAlpha, dt);
  }
  return { state: s, tEnd: t1, dvEquiv: dv, samples: samples.subarray(0, count * 2) };
}
