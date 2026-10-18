// WHAT: Three-dimensional two-body propagation: the planar Kepler solution lifted into space by inclination i and
//       longitude of the ascending node raan (M14 phase 1, physics layer only).
// WHY:  Real asteroids and interstellar visitors fly tilted orbits. The planar code (kepler.ts) stays the game's
//       engine until phase 2 wires this in; these functions are a strict superset of it: with i = 0 and raan = 0
//       they return the 2-D answer with z = 0, bit for bit for r and v (tests/kepler3.test.ts checks it).
// HOW:  An orbit is a flat ellipse (or hyperbola) in its own plane. propagate() already solves Kepler's equation
//       and rotates the perifocal point by w; here w is read as the argument of periapsis (angle from the
//       ascending node, in the orbit plane) and the in-plane point is then tilted by R1(i) about the node line
//       (+x) and turned by R3(raan) about the ecliptic pole (+z). Together: r = R3(raan) R1(i) R3(w) r_perifocal,
//       which is the textbook passive form R3(-raan) R1(-i) R3(-w) read from the other side.
//       Python mirror: pymiss/physics/kepler3.py.
// LORE: O7 (elements), O9 (anomalies), O6 (Kepler)

import { propagate, type Elements } from './kepler';

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface Elements3 extends Elements {
  /** Inclination, rad in [0, pi]: angle between the orbit's angular momentum and the ecliptic pole (+z). */
  readonly i: number;
  /** Longitude of the ascending node, rad in [0, 2pi), from +x to where the body climbs through z = 0. */
  readonly raan: number;
  // NOTE: `w` (inherited) is the ARGUMENT of periapsis here, measured in the orbit plane from the ascending node.
  //       For i = 0 the node is taken on +x (raan = 0), so w is again the longitude of periapsis of the 2-D code.
}

export interface State3 {
  readonly r: Vec3;
  readonly v: Vec3;
}

export interface PropagatedState3 extends State3 {
  /** Eccentric anomaly, rad (the hyperbolic anomaly H when e > 1). */
  readonly E: number;
  /** True anomaly, rad. */
  readonly nu: number;
  /** Mean anomaly used, rad. */
  readonly M: number;
}

/** Lift planar elements into 3-D on the ecliptic: i = 0, raan = 0. Example: HOME -> same orbit with z = 0. */
export function liftElements(el: Elements): Elements3 {
  return { a: el.a, e: el.e, w: el.w, M0: el.M0, t0: el.t0, i: 0, raan: 0 };
}

/**
 * Rotate a vector given in the orbit-plane node frame (x along the ascending node, y 90 deg ahead in the plane,
 * z = 0) into the ecliptic frame: R3(raan) R1(i) (x, y, 0).
 *   x' = x cos(raan) - y cos(i) sin(raan)
 *   y' = x sin(raan) + y cos(i) cos(raan)
 *   z' = y sin(i)
 * Units: whatever the input carries (m or m/s). Example: (1, 0) at i = 90 deg, raan = 90 deg -> (0, 1, 0); (0, 1)
 * at i = 90 deg, raan = 0 -> (0, 0, 1) to round-off. With i = raan = 0 it returns (x, y, 0) exactly.
 */
export function planeToEcliptic(x: number, y: number, i: number, raan: number): Vec3 {
  const ci = Math.cos(i);
  const si = Math.sin(i);
  const cO = Math.cos(raan);
  const sO = Math.sin(raan);
  const yc = y * ci;
  return { x: x * cO - yc * sO, y: x * sO + yc * cO, z: y * si };
}

/**
 * Position and velocity at time t from 3-D elements.
 *   (x, y), (vx, vy) = propagate(el) in the orbit plane, rotated by w from the node line  (kepler.ts, both branches)
 *   r = R3(raan) R1(i) (x, y, 0);  v = R3(raan) R1(i) (vx, vy, 0)
 * Units: a in m, angles in rad, mu in m^3/s^2, t in s; returns m and m/s.
 * Example: Earth (mu = 3.986004418e14), a = 7000 km, e = 0, i = 90 deg, raan = w = M0 = 0, t = t0 ->
 * r = (7000 km, 0, 0), v = (0, ~0, 7.546 km/s): a polar orbit climbs straight up out of the equator.
 */
export function propagate3(el: Elements3, mu: number, t: number): PropagatedState3 {
  const s = propagate(el, mu, t);
  return {
    r: planeToEcliptic(s.r.x, s.r.y, el.i, el.raan),
    v: planeToEcliptic(s.v.x, s.v.y, el.i, el.raan),
    E: s.E,
    nu: s.nu,
    M: s.M,
  };
}

/** Specific angular momentum h = r x v, m^2/s. Example: r = (1, 0, 0) m, v = (0, 1, 0) m/s -> (0, 0, 1). */
export function angularMomentum3(r: Vec3, v: Vec3): Vec3 {
  return { x: r.y * v.z - r.z * v.y, y: r.z * v.x - r.x * v.z, z: r.x * v.y - r.y * v.x };
}

/**
 * Sampled 3-D orbit outline as a flat [x0, y0, z0, ...] array, same sampling as orbitPoints (kepler.ts):
 * r(nu) = a (1 - e^2) / (1 + e cos nu), point at angle w + nu in the plane, then planeToEcliptic.
 * Units: m. Example: i = 90 deg, raan = 0, e = 0: every point has y = 0 to round-off and |z| up to a.
 */
export function orbitPoints3(el: Elements3, n = 128, rMax = 12 * 1.495978707e11): Float64Array {
  const out = new Float64Array(n * 3);
  const p = el.a * (1 - el.e * el.e);
  const nuLim = el.e > 1 ? Math.acos(Math.max(-1, Math.min(1, (p / rMax - 1) / el.e))) : Math.PI;
  for (let k = 0; k < n; k++) {
    const nu = el.e > 1 ? -nuLim + (k / (n - 1)) * 2 * nuLim : (k / n) * 2 * Math.PI;
    const r = p / (1 + el.e * Math.cos(nu));
    const u = el.w + nu;
    const q = planeToEcliptic(r * Math.cos(u), r * Math.sin(u), el.i, el.raan);
    out[k * 3] = q.x;
    out[k * 3 + 1] = q.y;
    out[k * 3 + 2] = q.z;
  }
  return out;
}
