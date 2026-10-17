// WHAT: Lambert's problem in universal variables: the transfer from r1 at t1 to r2 at t2 (GAME_PLAN 6.5).
// WHY:  Every intercept, rendezvous and flyby leg in the game is a Lambert arc. The porkchop grid calls
//       this thousands of times per plan, so it must be robust (bisection) and then precise (Newton).
// HOW:  Curtis, Orbital Mechanics for Engineering Students, Algorithm 5.2, prograde, single revolution:
//         dtheta from the cross product sign;  A = sin(dtheta) sqrt(r1 r2 / (1 - cos dtheta))
//         y(z) = r1 + r2 + A (z S - 1) / sqrt(C);   F(z) = (y/C)^1.5 S + A sqrt(y) - sqrt(mu) dt
//       Bracket z in [-4pi^2, 4pi^2) where y > 0, bisect until the bracket is 1e-13 wide, then three Newton
//       steps. Lagrange coefficients give v1 and v2. Returns null when the geometry is degenerate (dtheta
//       within 1e-3 of 0 or pi: A -> 0 and the plane is undefined) or no root exists.
//       Python mirror: pymiss/physics/lambert.py.
// LORE: O10 (A to B), G3 (the planner)

import type { Vec2 } from '../util/vec';
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
  const f = 1 - yy / r1;
  const g = A * Math.sqrt(yy / mu);
  const gd = 1 - yy / r2;
  const v1 = { x: (r2v.x - f * r1v.x) / g, y: (r2v.y - f * r1v.y) / g };
  const v2 = { x: (gd * r2v.x - r1v.x) / g, y: (gd * r2v.y - r1v.y) / g };
  const a = Math.abs(z) > 1e-12 ? yy / (C * z) : Infinity;
  return { v1, v2, z, dtheta, a };
}
