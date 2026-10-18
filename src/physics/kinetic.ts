// WHAT: Kinetic impactor deflection: the momentum transfer with the beta enhancement factor (GAME_PLAN 6.9).
// WHY:  The DART result (2022) is the calibration point of the whole game: 580 kg at 6.14 km/s into a
//       4.3e9 kg body with beta ≈ 3.6 changed its speed by about 3 mm/s. Everything the planner promises
//       about a kinetic plan comes from this one formula and the resolver's propagation of its result.
// HOW:  U_vec = v_impactor - v_threat;  dv_vec = beta (m / M) U_vec. Beta is drawn per impact from the
//       type's range (knobs) and revealed to the player only after the tracking tier's assessment delay.
//       The specific energy Q = 0.5 m U^2 / M feeds the disruption test of M3.
//       kineticImpact3 and alongTrack3 are the same formulas with a z part, for bodies off the ecliptic (M14).
//       Python mirror: pymiss/physics/kinetic.py.
// LORE: D1 (impulse), D3 (kinetic and beta)

import type { Vec2 } from '../util/vec';
import type { Vec3 } from './kepler3';

export interface KineticResult {
  /** Velocity change of the threat, m/s (vector). */
  dv: Vec2;
  /** Closing speed, m/s. */
  U: number;
  /** Unit vector of the momentum transfer (into the target). */
  uHat: Vec2;
  /** Specific energy delivered, J/kg: 0.5 m U^2 / M. */
  Q: number;
}

/**
 * Deflection from an impact of mass m at velocity vImpactor on a body of mass M moving at vThreat.
 * Example (DART): m = 580, U = 6140 m/s, M = 4.3e9, beta = 3.6 -> |dv| ≈ 2.98e-3 m/s.
 */
export function kineticImpact(m: number, M: number, vImpactor: Vec2, vThreat: Vec2, beta: number): KineticResult {
  const ux = vImpactor.x - vThreat.x;
  const uy = vImpactor.y - vThreat.y;
  const U = Math.hypot(ux, uy);
  const k = (beta * m) / M;
  const uHat = U > 0 ? { x: ux / U, y: uy / U } : { x: 0, y: 0 };
  return { dv: { x: k * ux, y: k * uy }, U, uHat, Q: (0.5 * m * U * U) / M };
}

/** Scalar form used by the estimates: |dv| = beta (m/M) U. */
export function kineticDv(m: number, M: number, U: number, beta: number): number {
  return (beta * m * U) / M;
}

/** Along-track component of a dv vector given the threat velocity direction. */
export function alongTrack(dv: Vec2, vThreat: Vec2): number {
  const v = Math.hypot(vThreat.x, vThreat.y);
  return v > 0 ? (dv.x * vThreat.x + dv.y * vThreat.y) / v : 0;
}

/**
 * kineticImpact in three dimensions: U_vec = v_impactor - v_threat (3-D), dv_vec = beta (m / M) U_vec, Q = 0.5 m U^2 / M.
 * Units: kg, m/s. Example: m = 580, M = 4.3e9, vImpactor - vThreat = (0, 0, 6140) m/s, beta = 3.6 ->
 * dv = (0, 0, 2.98e-3) m/s: the same DART number, pointed out of the plane.
 */
export function kineticImpact3(m: number, M: number, vImpactor: Vec3, vThreat: Vec3, beta: number): { dv: Vec3; U: number; uHat: Vec3; Q: number } {
  const ux = vImpactor.x - vThreat.x;
  const uy = vImpactor.y - vThreat.y;
  const uz = vImpactor.z - vThreat.z;
  const U = Math.hypot(ux, uy, uz);
  const k = (beta * m) / M;
  const uHat = U > 0 ? { x: ux / U, y: uy / U, z: uz / U } : { x: 0, y: 0, z: 0 };
  return { dv: { x: k * ux, y: k * uy, z: k * uz }, U, uHat, Q: (0.5 * m * U * U) / M };
}

/** Along-track part of a 3-D dv: dv . v_hat. Example: dv = (1, 0, 1), v = (0, 0, 5) -> 1. */
export function alongTrack3(dv: Vec3, vThreat: Vec3): number {
  const v = Math.hypot(vThreat.x, vThreat.y, vThreat.z);
  return v > 0 ? (dv.x * vThreat.x + dv.y * vThreat.y + dv.z * vThreat.z) / v : 0;
}
