// WHAT: State vector (r, v) to orbital elements, 2-D prograde (GAME_PLAN 6.3).
// WHY:  Needed after every impulse (impact, flyby, warhead) and at the end of every thrust arc: the new
//       state becomes new elements and the body coasts analytically again.
// HOW:  Standard eccentricity-vector method. Guards: h <= 0 (retrograde or radial) and eps >= 0 (unbound)
//       throw typed errors so the resolver can decide what to do (v1: reject; fragments on hyperbolic
//       orbits are handled in M3). e within 1e-9 of zero makes w undefined: set w = 0 and nu = L.
//       Python mirror: pymiss/physics/elements.py.
// LORE: O7 (elements), O5 (energy and momentum)

import type { Vec2 } from '../util/vec';
import { wrapAngle } from '../util/vec';
import { hyperbolicFromTrue, eccentricFromTrue, type Elements } from './kepler';

export class OrbitError extends Error {
  constructor(message: string, readonly kind: 'RETROGRADE' | 'UNBOUND') {
    super(message);
    this.name = 'OrbitError';
  }
}

/** Below this eccentricity the periapsis direction is meaningless; w is set to 0. */
export const E_CIRCULAR = 1e-9;

/**
 * Elements from a heliocentric state at time t.
 *   h = x vy - y vx (> 0 prograde);  eps = v^2/2 - mu/r (< 0 bound);  a = -mu / (2 eps)
 *   e_vec = ((v^2 - mu/r) r_vec - (r_vec . v_vec) v_vec) / mu;  e = |e_vec|;  w = atan2(e_vec)
 *   L = atan2(y, x);  nu = L - w;  E = 2 atan2(sqrt(1-e) sin(nu/2), sqrt(1+e) cos(nu/2));  M0 = E - e sin E
 * Example: r = (1 AU, 0), v = (0, 29.78 km/s), mu = MU_SUN -> a ≈ 1 AU, e ≈ 0, M0 = 0.
 */
export function stateToElements(r: Vec2, v: Vec2, mu: number, t: number, allowUnbound = false): Elements {
  const rm = Math.hypot(r.x, r.y);
  const vm = Math.hypot(v.x, v.y);
  const h = r.x * v.y - r.y * v.x;
  if (!(h > 0)) throw new OrbitError(`retrograde or radial orbit (h = ${h})`, 'RETROGRADE');
  const eps = (vm * vm) / 2 - mu / rm;
  if (!(eps < 0) && !allowUnbound) throw new OrbitError(`unbound orbit (eps = ${eps})`, 'UNBOUND');
  if (Math.abs(eps) < 1e-9 * (mu / rm)) throw new OrbitError('parabolic orbit is not representable', 'UNBOUND');
  const a = -mu / (2 * eps);

  const rv = r.x * v.x + r.y * v.y;
  const k = vm * vm - mu / rm;
  const ex = (k * r.x - rv * v.x) / mu;
  const ey = (k * r.y - rv * v.y) / mu;
  const e = Math.hypot(ex, ey);

  const L = Math.atan2(r.y, r.x);
  let w: number;
  let nu: number;
  if (e < E_CIRCULAR) {
    w = 0;
    nu = L;
  } else {
    w = wrapAngle(Math.atan2(ey, ex));
    nu = L - w;
  }
  if (eps >= 0) {
    // Hyperbolic (M7): H from nu, M0 = e sinh H - H, unwrapped.
    const H = hyperbolicFromTrue(nu, e);
    return { a, e, w, M0: e * Math.sinh(H) - H, t0: t };
  }
  const E = eccentricFromTrue(nu, e);
  const M0 = wrapAngle(E - e * Math.sin(E));
  return { a, e: e < E_CIRCULAR ? 0 : e, w, M0, t0: t };
}
