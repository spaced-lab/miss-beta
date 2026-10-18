// WHAT: Three-dimensional state vector (r, v) to orbital elements {a, e, i, raan, w, M0, t0} (M14 phase 1).
// WHY:  The inverse of propagate3: after an impulse with an out-of-plane part, the new state must become new
//       elements again. For a state with z = 0 and vz = 0 it must give exactly the planar elements, so that the
//       2-D game can switch to these functions without a single round changing.
// HOW:  h = r x v gives the plane: i = atan2(|h_xy|, h_z), node vector n = z x h = (-h_y, h_x, 0),
//       raan = atan2(n_y, n_x). The state is then rotated into the node frame (x along n, y = h_hat x n_hat) and
//       the planar stateToElements does the rest (eccentricity vector, w measured from the node, anomalies, both
//       branches, the circular guard). Because that call is the 2-D function itself, every 2-D convention
//       carries over unchanged.
//       Singular cases (documented convention):
//         EQUATORIAL (|h_xy| <= 1e-12 |h|): the node is undefined; raan = 0 and the node frame is (x, +-y) with
//           the sign of h_z. i = 0 exactly (prograde, w = longitude of periapsis as in 2-D) or i = pi exactly
//           (retrograde, w measured clockwise in the ecliptic, i.e. in the flipped plane).
//         CIRCULAR (e < E_CIRCULAR): w = 0 so M0 is the argument of latitude (angle from the node); for a circular
//           equatorial orbit that is the true longitude, as in 2-D.
//         RADIAL (h = 0): throws OrbitError kind RETROGRADE, the same kind the 2-D code uses for h <= 0.
//       Retrograde is not an error in 3-D: it is i > 90 deg. Unbound throws unless allowUnbound (hyperbola).
//       Python mirror: pymiss/physics/elements3.py.
// LORE: O7 (elements), O5 (energy and momentum)

import { OrbitError, stateToElements } from './elements';
import { angularMomentum3, type Elements3, type Vec3 } from './kepler3';
import { wrapAngle } from '../util/vec';

/** Below this |h_xy| / |h| (sin i) the orbit is treated as lying in the ecliptic: raan = 0, i = 0 or pi. */
export const SIN_I_EQUATORIAL = 1e-12;

/**
 * Elements from an ecliptic-frame state at time t.
 *   h = r x v;  i = atan2(sqrt(h_x^2 + h_y^2), h_z);  n = (-h_y, h_x, 0);  raan = atan2(n_y, n_x)
 *   node frame: p_hat = n / |n|, q_hat = h_hat x p_hat;  X = r . p_hat, Y = r . q_hat (and the same for v)
 *   then the planar method on (X, Y, VX, VY): eps = v^2/2 - mu/r, a = -mu/(2 eps),
 *   e_vec = ((v^2 - mu/r) r - (r . v) v) / mu, w = atan2(e_Y, e_X), nu = atan2(Y, X) - w, M0 from E (or H).
 * Units: m, m/s, m^3/s^2, s; angles rad.
 * Example: r = (7000 km, 0, 0), v = (0, 0, 7546.05 m/s), mu = 3.986004418e14 -> a ≈ 7000 km, e ≈ 0, i = 90 deg,
 * raan = 0, w = 0, M0 = 0 (a polar circular orbit starting at its ascending node).
 */
export function stateToElements3(r: Vec3, v: Vec3, mu: number, t: number, allowUnbound = false): Elements3 {
  const h = angularMomentum3(r, v);
  const hxy = Math.hypot(h.x, h.y);
  const hm = Math.hypot(hxy, h.z);
  if (!(hm > 0)) throw new OrbitError(`radial orbit (|h| = ${hm})`, 'RETROGRADE');

  let i: number;
  let raan: number;
  let px: number;
  let py: number;
  let qx: number;
  let qy: number;
  let qz: number;
  if (hxy <= SIN_I_EQUATORIAL * hm) {
    // NOTE: exact unit vectors here, not normalised h, so a z = 0 state reaches stateToElements with its own
    //       x and y untouched and the 2-D answer comes back bit for bit.
    const pro = h.z > 0;
    i = pro ? 0 : Math.PI;
    raan = 0;
    px = 1;
    py = 0;
    qx = 0;
    qy = pro ? 1 : -1;
    qz = 0;
  } else {
    i = Math.atan2(hxy, h.z);
    raan = wrapAngle(Math.atan2(h.x, -h.y));
    px = -h.y / hxy;
    py = h.x / hxy;
    // q_hat = h_hat x p_hat with p_hat = (px, py, 0).
    const hx = h.x / hm;
    const hy = h.y / hm;
    const hz = h.z / hm;
    qx = -hz * py;
    qy = hz * px;
    qz = hx * py - hy * px;
  }
  const X = r.x * px + r.y * py;
  const Y = r.x * qx + r.y * qy + r.z * qz;
  const VX = v.x * px + v.y * py;
  const VY = v.x * qx + v.y * qy + v.z * qz;
  const el = stateToElements({ x: X, y: Y }, { x: VX, y: VY }, mu, t, allowUnbound);
  return { a: el.a, e: el.e, w: el.w, M0: el.M0, t0: el.t0, i, raan };
}
