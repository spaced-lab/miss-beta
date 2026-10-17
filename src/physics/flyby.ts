// WHAT: Patched-conic gravity assist (GAME_PLAN 6.7).
// WHY:  A flyby is a free rotation of the spacecraft's planet-relative velocity: |v_inf| is preserved,
//       its direction turns by delta, and the heliocentric velocity changes by up to 2 v_inf sin(delta/2).
//       It is how a small launcher reaches a fast intercept.
// HOW:  r_SOI = a_planet (mu_planet / mu_sun)^(2/5) (event detection only)
//       delta(r_p) = 2 asin(1 / (1 + r_p v_inf^2 / mu_planet));  delta_max at r_p = R + h_min
//       v_inf_out = rotate(v_inf_in, +/- delta);  v_out = v_planet + v_inf_out;  |dv_helio| = 2 v_inf sin(delta/2)
//       Python mirror: pymiss/physics/flyby.py.
// LORE: O11 (gravity assists)

import type { Vec2 } from '../util/vec';

/** Sphere of influence radius, m. Example: GIANT at 5.203 AU -> 4.8e10 m (0.32 AU). */
export function soiRadius(aPlanet: number, muPlanet: number, muSun: number): number {
  return aPlanet * Math.pow(muPlanet / muSun, 2 / 5);
}

/** Turn angle for a periapsis radius r_p and excess speed v_inf, rad. Example: GIANT, r_p = 10 R, 10 km/s -> 80.2 deg. */
export function turnAngle(rP: number, vInf: number, muPlanet: number): number {
  return 2 * Math.asin(1 / (1 + (rP * vInf * vInf) / muPlanet));
}

/** Largest turn available: periapsis at R + h_min. */
export function turnAngleMax(R: number, hMin: number, vInf: number, muPlanet: number): number {
  return turnAngle(R + hMin, vInf, muPlanet);
}

/** Periapsis radius that gives a desired turn (inverse of turnAngle), m. */
export function periapsisForTurn(delta: number, vInf: number, muPlanet: number): number {
  return (muPlanet / (vInf * vInf)) * (1 / Math.sin(delta / 2) - 1);
}

export interface FlybyResult {
  vInfOut: Vec2;
  vOut: Vec2;
  delta: number;
  /** Heliocentric speed change magnitude, m/s: 2 v_inf sin(delta/2). */
  dvHelio: number;
  rP: number;
}

/**
 * Apply a flyby: rotate the incoming excess velocity by `delta` (rad), sign = side of the planet passed.
 * Example: v_inf_in = (10 km/s, 0), delta = 80.2 deg -> |v_inf_out| = 10 km/s, dv_helio = 12.9 km/s.
 */
export function flyby(vSc: Vec2, vPlanet: Vec2, delta: number, side: 1 | -1, muPlanet: number): FlybyResult {
  const ix = vSc.x - vPlanet.x;
  const iy = vSc.y - vPlanet.y;
  const vInf = Math.hypot(ix, iy);
  const c = Math.cos(side * delta);
  const s = Math.sin(side * delta);
  const ox = ix * c - iy * s;
  const oy = ix * s + iy * c;
  return {
    vInfOut: { x: ox, y: oy },
    vOut: { x: vPlanet.x + ox, y: vPlanet.y + oy },
    delta,
    dvHelio: 2 * vInf * Math.sin(delta / 2),
    rP: periapsisForTurn(delta, vInf, muPlanet),
  };
}

/** Signed angle from vector a to vector b, rad in (-pi, pi]. */
export function signedAngle(a: Vec2, b: Vec2): number {
  return Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y);
}
