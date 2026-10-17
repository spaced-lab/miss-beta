// WHAT: Kinetic impactor deflection: the momentum transfer with the beta enhancement factor (GAME_PLAN 6.9).
// WHY:  The DART result (2022) is the calibration point of the whole game: 580 kg at 6.14 km/s into a
//       4.3e9 kg body with beta ≈ 3.6 changed its speed by about 3 mm/s. Everything the planner promises
//       about a kinetic plan comes from this one formula and the resolver's propagation of its result.
// HOW:  U_vec = v_impactor - v_threat;  dv_vec = beta (m / M) U_vec. Beta is drawn per impact from the
//       type's range (knobs) and revealed to the player only after the tracking tier's assessment delay.
//       The specific energy Q = 0.5 m U^2 / M feeds the disruption test of M3.
//       Python mirror: pymiss/physics/kinetic.py.
// LORE: D1 (impulse), D3 (kinetic and beta)

import type { Vec2 } from '../util/vec';

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
