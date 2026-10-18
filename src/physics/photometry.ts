// WHAT: Asteroid photometry: absolute magnitude from size and albedo, apparent magnitude from geometry,
//       and the sun-observer-threat angles the detection model needs (GAME_PLAN 18.1).
// WHY:  Lead time comes from surveys, and surveys see brightness, not size. A dark 140 m rock and a bright
//       50 m one look alike; a rock that approaches from the sunward side is in daylight and invisible to
//       ground telescopes. These few lines are why the "sunward sentinel" matters.
// HOW:  H = 5 log10(1329 / (D_km sqrt(p)))  (Harris and Harris 1997)
//       V = H + 5 log10(r_au delta_au) + 0.035 alpha_deg   (crude linear phase slope; the IAU H-G system with
//       G = 0.15 is the upgrade, see Section 27)
//       alpha = phase angle at the threat (sun-threat-observer); eps = elongation at the observer
//       (sun-observer-threat). Python mirror: pymiss/physics/photometry.py.
// LORE: F2 (brightness and size), F3 (the sunward blind spot), O2 (logs and magnitudes)

import type { Vec2 } from '../util/vec';
import { AU } from './constants';

/** Absolute magnitude. Example: D = 140 m, p = 0.14 -> H ≈ 22.0; D = 1 km -> 17.7; D = 20 m -> 26.2. */
export function absoluteMagnitude(Dm: number, albedo: number): number {
  return 5 * Math.log10(1329 / ((Dm / 1000) * Math.sqrt(albedo)));
}

/** Diameter (m) from H and albedo: the inverse of absoluteMagnitude. */
export function diameterFromH(H: number, albedo: number): number {
  return (1000 * 1329) / (Math.sqrt(albedo) * Math.pow(10, H / 5));
}

/** Apparent magnitude. Example: H = 22 at r = 1.1 AU, delta = 0.1 AU, alpha = 20 deg -> ≈ 17.9. */
export function apparentMagnitude(H: number, rAu: number, deltaAu: number, alphaDeg: number): number {
  return H + 5 * Math.log10(rAu * deltaAu) + 0.035 * alphaDeg;
}

export interface ViewGeometry {
  /** Sun-threat distance, AU. */
  rAu: number;
  /** Observer-threat distance, AU. */
  deltaAu: number;
  /** Phase angle at the threat, deg. */
  alphaDeg: number;
  /** Elongation at the observer, deg. */
  epsDeg: number;
}

/** Angles and distances for a threat at rT and an observer at rO (heliocentric, m). */
export function viewGeometry(rT: Vec2, rO: Vec2): ViewGeometry {
  const r = Math.hypot(rT.x, rT.y);
  const dx = rT.x - rO.x;
  const dy = rT.y - rO.y;
  const delta = Math.hypot(dx, dy);
  const ro = Math.hypot(rO.x, rO.y);
  // Phase angle at the threat: between (sun - threat) and (observer - threat).
  const cosAlpha = ((-rT.x) * (-dx) + (-rT.y) * (-dy)) / (r * delta || 1);
  // Elongation at the observer: between (sun - observer) and (threat - observer).
  const cosEps = ((-rO.x) * dx + (-rO.y) * dy) / (ro * delta || 1);
  const clamp = (v: number): number => Math.max(-1, Math.min(1, v));
  return {
    rAu: r / AU,
    deltaAu: delta / AU,
    alphaDeg: (Math.acos(clamp(cosAlpha)) * 180) / Math.PI,
    epsDeg: (Math.acos(clamp(cosEps)) * 180) / Math.PI,
  };
}
