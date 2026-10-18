// WHAT: Lambert's problem in universal variables: the transfer from r1 at t1 to r2 at t2 (GAME_PLAN 6.5).
// WHY:  Every intercept, rendezvous and flyby leg in the game is a Lambert arc. The porkchop grid calls
//       this thousands of times per plan, so it must be robust (bisection) and then precise (Newton).
// HOW:  Curtis, Orbital Mechanics for Engineering Students, Algorithm 5.2, prograde, single revolution:
//         dtheta from the cross product sign;  A = sin(dtheta) sqrt(r1 r2 / (1 - cos dtheta))
//         y(z) = r1 + r2 + A (z S - 1) / sqrt(C);   F(z) = (y/C)^1.5 S + A sqrt(y) - sqrt(mu) dt
//       Bracket z in [-4pi^2, 4pi^2) where y > 0 (extended down to Z_FLOOR for fast hyperbolic transfers),
//       bisect until the bracket is 1e-13 wide, then three Newton steps. Lagrange coefficients give v1 and v2. Returns null when the geometry is degenerate (dtheta
//       within 1e-3 of 0 or pi: A -> 0 and the plane is undefined) or no root exists.
//       lambert3 (M14 phase 2) is the same root in the plane of r1 and r2, with the prograde sense taken from
//       the z part of r1 x r2, for targets off the ecliptic.
//       Python mirror: pymiss/physics/lambert.py.
// LORE: O10 (A to B), G3 (the planner)

import type { Vec2 } from '../util/vec';
import type { Vec3 } from './kepler3';
import { stumpffC, stumpffS } from './stumpff';

export interface LambertResult {
  /** Heliocentric departure velocity, m/s. */
  v1: Vec2;
  /** Heliocentric arrival velocity, m/s. */
  v2: Vec2;
  /** Universal variable at the solution (sign tells the orbit type). */
  z: number;
  /** Transfer angle, rad, prograde in [0, 2pi). */
  dtheta: number;
  /** Semi-major axis of the transfer, m (negative for hyperbolic). */
  a: number;
}

export const LAMBERT_DEGENERATE = 1e-3;
/** Lowest z the bracket extends to: sqrt(-z) = 316 keeps cosh in the Stumpff functions finite in float64. */
export const Z_FLOOR = -1e5;

/**
 * Solve the prograde single-revolution Lambert problem.
 * Example (near-Hohmann): r1 = 1 AU, r2 = 1.524 AU at 177 deg, dt = 259 d, mu = MU_SUN gives a departure
 * speed about 2.9 km/s above circular and an arrival speed about 2.6 km/s below circular (Section 16).
 */
export function lambert(r1v: Vec2, r2v: Vec2, dt: number, mu: number): LambertResult | null {
  if (!(dt > 0)) return null;
  const r1 = Math.hypot(r1v.x, r1v.y);
  const r2 = Math.hypot(r2v.x, r2v.y);
  const cross = r1v.x * r2v.y - r1v.y * r2v.x;
  const cosd = Math.max(-1, Math.min(1, (r1v.x * r2v.x + r1v.y * r2v.y) / (r1 * r2)));
  let dtheta = Math.acos(cosd);
  if (cross < 0) dtheta = 2 * Math.PI - dtheta;
  if (dtheta < LAMBERT_DEGENERATE || Math.abs(dtheta - Math.PI) < LAMBERT_DEGENERATE || 2 * Math.PI - dtheta < LAMBERT_DEGENERATE) return null;

  const A = Math.sin(dtheta) * Math.sqrt((r1 * r2) / (1 - Math.cos(dtheta)));
  const root = solveUniversal(r1, r2, A, dt, mu);
  if (!root) return null;
  const { z, yy, C } = root;
  const f = 1 - yy / r1;
  const g = A * Math.sqrt(yy / mu);
  const gd = 1 - yy / r2;
  const v1 = { x: (r2v.x - f * r1v.x) / g, y: (r2v.y - f * r1v.y) / g };
  const v2 = { x: (gd * r2v.x - r1v.x) / g, y: (gd * r2v.y - r1v.y) / g };
  const a = Math.abs(z) > 1e-12 ? yy / (C * z) : Infinity;
  return { v1, v2, z, dtheta, a };
}

/**
 * The universal-variable root shared by the planar and 3-D wrappers (Curtis 5.2): given |r1|, |r2|, the
 * geometry constant A = sin(dtheta) sqrt(r1 r2 / (1 - cos dtheta)) and the flight time, find z with
 * F(z) = (y/C)^1.5 S + A sqrt(y) - sqrt(mu) dt = 0. Returns z, y(z) and C(z), or null without a root.
 * Units: m, s, m^3/s^2. Example: the Section 16 near-Hohmann case has z of about 9.71 (an ellipse, z > 0).
 */
function solveUniversal(r1: number, r2: number, A: number, dt: number, mu: number): { z: number; yy: number; C: number } | null {
  const sqrtMuDt = Math.sqrt(mu) * dt;
  const y = (z: number): number => r1 + r2 + (A * (z * stumpffS(z) - 1)) / Math.sqrt(stumpffC(z));
  const F = (z: number): number => {
    const yy = y(z);
    return Math.pow(yy / stumpffC(z), 1.5) * stumpffS(z) + A * Math.sqrt(yy) - sqrtMuDt;
  };

  // Lower bracket: walk up from -4pi^2 until y > 0 (A < 0 for dtheta > pi makes y negative at low z).
  const zMax = 4 * Math.PI * Math.PI * 0.999;
  let lo = -4 * Math.PI * Math.PI;
  let steps = 0;
  while (!(y(lo) > 0) && lo < zMax && steps < 400) {
    lo += 0.1;
    steps++;
  }
  if (!(y(lo) > 0)) return null;
  // Fast transfers are strongly hyperbolic; F rises steeply from -sqrt(mu) dt at the edge where y reaches 0, so the
  // first 0.1 step past the edge can already be beyond the root (dtheta < pi), and with dtheta > pi (y grows as z
  // falls) the root can lie below -4pi^2. If F(lo) > 0, close in on the edge by bisection on y, or extend the
  // bracket down by doubling to Z_FLOOR. NOTE: such cells read infeasible on the porkchop and autonomy retargets
  // failed (code review 2026-10-18).
  if (F(lo) > 0) {
    const edge = (bad: number, good: number): number => {
      for (let i = 0; i < 100; i++) {
        const mid = 0.5 * (bad + good);
        if (y(mid) > 0 && Number.isFinite(F(mid))) good = mid;
        else bad = mid;
      }
      return good;
    };
    if (steps > 0) lo = edge(lo - 0.1, lo);
    else {
      for (let k = 0; k < 20 && F(lo) > 0 && lo > Z_FLOOR; k++) {
        const next = Math.max(Z_FLOOR, lo * 2);
        if (y(next) > 0 && Number.isFinite(F(next))) lo = next;
        else {
          lo = edge(next, lo);
          break;
        }
      }
    }
  }
  let hi = zMax;
  let flo = F(lo);
  let fhi = F(hi);
  if (!Number.isFinite(flo) || !Number.isFinite(fhi) || flo > 0 || fhi < 0) return null;
  for (let i = 0; i < 200 && hi - lo > 1e-13; i++) {
    const mid = 0.5 * (lo + hi);
    const fm = F(mid);
    if (fm > 0) {
      hi = mid;
      fhi = fm;
    } else {
      lo = mid;
      flo = fm;
    }
  }
  let z = 0.5 * (lo + hi);
  // Newton polish (derivative from Curtis 5.43), guarded against stepping out of the bracket.
  for (let i = 0; i < 3; i++) {
    const S = stumpffS(z);
    const C = stumpffC(z);
    const yy = y(z);
    if (!(yy > 0)) break;
    let dF: number;
    if (Math.abs(z) > 1e-6) {
      dF = Math.pow(yy / C, 1.5) * ((1 / (2 * z)) * (C - (1.5 * S) / C) + (0.75 * S * S) / C) + (A / 8) * ((3 * S * Math.sqrt(yy)) / C + A * Math.sqrt(C / yy));
    } else {
      dF = (Math.SQRT2 / 40) * Math.pow(yy, 1.5) + (A / 8) * (Math.sqrt(yy) + A * Math.sqrt(1 / (2 * yy)));
    }
    const zn = z - F(z) / dF;
    if (!Number.isFinite(zn) || zn < lo - 1e-6 || zn > hi + 1e-6) break;
    z = zn;
  }

  const yy = y(z);
  const C = stumpffC(z);
  return { z, yy, C };
}

export interface Lambert3Result {
  /** Heliocentric departure and arrival velocities, m/s. */
  v1: Vec3;
  v2: Vec3;
  z: number;
  /** Transfer angle in the transfer plane, rad in [0, 2pi). */
  dtheta: number;
  a: number;
}

/**
 * Lambert in three dimensions (M14 phase 2): the same universal-variable root, in the plane spanned by r1 and r2.
 *   cos(dtheta) = r1 . r2 / (|r1| |r2|);  prograde: dtheta = 2pi - acos(...) when (r1 x r2)_z < 0 (Curtis 5.2)
 *   v1 = (r2 - f r1) / g;  v2 = (gdot r2 - r1) / g   with f, g, gdot from y(z) as in the planar function.
 * The transfer orbit's angular momentum points along +(r1 x r2) for dtheta < pi and along -(r1 x r2) beyond, so
 * a prograde transfer always has h_z >= 0. `prograde = false` takes the other way round. Degenerate (null) when
 * dtheta is within LAMBERT_DEGENERATE of 0 or pi (the plane is undefined).
 * Units: m, s, m^3/s^2 -> m/s. Example: r1 = (1 AU, 0, 0), r2 = (0, 1 AU, 0.2 AU), dt = 100 d, mu = MU_SUN
 * gives dtheta = 90 deg and v1 ≈ (2.38, 28.33, 5.67) km/s (the craft climbs toward the target); with r2 in
 * the plane (z = 0) the answer equals the planar lambert (and z = 0 parts).
 */
export function lambert3(r1v: Vec3, r2v: Vec3, dt: number, mu: number, prograde = true): Lambert3Result | null {
  if (!(dt > 0)) return null;
  const r1 = Math.hypot(r1v.x, r1v.y, r1v.z);
  const r2 = Math.hypot(r2v.x, r2v.y, r2v.z);
  const cz = r1v.x * r2v.y - r1v.y * r2v.x;
  const cosd = Math.max(-1, Math.min(1, (r1v.x * r2v.x + r1v.y * r2v.y + r1v.z * r2v.z) / (r1 * r2)));
  let dtheta = Math.acos(cosd);
  if (prograde ? cz < 0 : cz >= 0) dtheta = 2 * Math.PI - dtheta;
  if (dtheta < LAMBERT_DEGENERATE || Math.abs(dtheta - Math.PI) < LAMBERT_DEGENERATE || 2 * Math.PI - dtheta < LAMBERT_DEGENERATE) return null;
  const A = Math.sin(dtheta) * Math.sqrt((r1 * r2) / (1 - Math.cos(dtheta)));
  const root = solveUniversal(r1, r2, A, dt, mu);
  if (!root) return null;
  const { z, yy, C } = root;
  const f = 1 - yy / r1;
  const g = A * Math.sqrt(yy / mu);
  const gd = 1 - yy / r2;
  const v1 = { x: (r2v.x - f * r1v.x) / g, y: (r2v.y - f * r1v.y) / g, z: (r2v.z - f * r1v.z) / g };
  const v2 = { x: (gd * r2v.x - r1v.x) / g, y: (gd * r2v.y - r1v.y) / g, z: (gd * r2v.z - r1v.z) / g };
  const a = Math.abs(z) > 1e-12 ? yy / (C * z) : Infinity;
  return { v1, v2, z, dtheta, a };
}
