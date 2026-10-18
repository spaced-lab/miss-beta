// WHAT: The rocket equation (EDUCATION.md D8): delta-v from Isp and mass ratio, identical-stage staging, and
//       the mass ratio a given delta-v costs.
// WHY:  The launcher tables (estimates.ts payloadForC3) are the game's rocket model; LAB_ROCKET_EQ shows the
//       equation behind them: every extra km/s multiplies the mass ratio, which is why payload falls so fast
//       with C3.
// HOW:  Tsiolkovsky: dv = Isp g0 ln(m0 / mf). With n identical stages that each burn a propellant fraction
//       f of their own gross mass (upper stages and payload included), each stage has m0/mf = 1/(1-f), so
//       dv = n Isp g0 ln(1 / (1 - f)). Inverse: m0/mf = exp(dv / (Isp g0)).
//       Python mirror: pymiss/physics/rocket.py.
// LORE: D8 (rockets: delta-v, Isp, C3)

import { G0 } from './constants';

/**
 * Tsiolkovsky delta-v, m/s: Isp (s) x g0 x ln(m0/mf).
 * Example: Isp 320 s, m0/mf = 5 -> 320 x 9.80665 x ln 5 = 5051 m/s.
 */
export function rocketDv(isp: number, massRatio: number): number {
  return isp * G0 * Math.log(massRatio);
}

/**
 * Delta-v of n identical stages, each burning propellant fraction f (0..1) of its gross mass, m/s.
 * Example: Isp 320 s, f = 0.8, 2 stages -> 2 x 5051 = 10101 m/s.
 */
export function stagedDv(isp: number, propFraction: number, stages: number): number {
  return stages * rocketDv(isp, 1 / (1 - propFraction));
}

/**
 * Mass ratio m0/mf needed for a delta-v (m/s) at a given Isp (s): exp(dv / (Isp g0)).
 * Example: dv = 5051 m/s at Isp 320 s -> 5.0.
 */
export function massRatioFor(dv: number, isp: number): number {
  return Math.exp(dv / (isp * G0));
}
