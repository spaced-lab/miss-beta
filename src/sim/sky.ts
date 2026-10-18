// WHAT: Sky geometry shared by the gauge and the discovery search: an in-plane orbit tilted about its impact node
//       (3-D lite), the view geometry of a target off the plane with its sky rate, the trailing loss of a fast
//       mover, and the chance a set of networks covers a given direction on the sky.
// WHY:  The rounds fly a flat system, but visitors from other stars (and real NEAs) arrive from above and below
//       it. Tilting the orbit about the line through the impact point keeps the impact exact (the node is where
//       the rock meets HOME) while the earlier track rises off the plane, which is what makes them hard to see.
// HOW:  Pure functions. The resolver never sees the tilt: dynamics stay in the plane, only seeing does not.
//       Full 3-D orbits (inclination and node in the physics, the Python mirror and the resolver) are M14.
// LORE: F12 (visitors from other stars), F11 (the detection gauge), F3 (the sunward blind spot)

import { KNOBS } from '../config/knobs';
import { AU } from '../physics/constants';

import type { Network } from './detection';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Tilt an in-plane vector by `incl` about the unit node line `n` (in the plane): the part along n stays, the part
 * across it rotates out of the plane. Example: n = x, incl 90 deg: (0, 1) -> (0, 0, 1). Length is kept.
 */
export function tiltAboutNode(v: { x: number; y: number }, n: { x: number; y: number }, incl: number): Vec3 {
  const a = v.x * n.x + v.y * n.y;
  const b = -v.x * n.y + v.y * n.x;
  const bc = b * Math.cos(incl);
  return { x: a * n.x - bc * n.y, y: a * n.y + bc * n.x, z: b * Math.sin(incl) };
}

/**
 * View geometry in 3-D (observer in the plane) plus the sky rate of the target, rad/s:
 * omega = |v_rel x l| / delta with l the unit line of sight. Example: 8 km/s across the line of sight at
 * 0.05 AU -> 1.07e-6 rad/s (0.22 arcsec/s, about 13 deg a day).
 */
export function viewGeometry3(rT: Vec3, vT: Vec3, rO: { x: number; y: number }, vO: { x: number; y: number }): { rAu: number; deltaAu: number; alphaDeg: number; epsDeg: number; rate: number } {
  const dx = rT.x - rO.x;
  const dy = rT.y - rO.y;
  const dz = rT.z;
  const r = Math.hypot(rT.x, rT.y, rT.z);
  const delta = Math.hypot(dx, dy, dz) || 1;
  const ro = Math.hypot(rO.x, rO.y) || 1;
  const clamp = (v: number): number => Math.max(-1, Math.min(1, v));
  const cosAlpha = (rT.x * dx + rT.y * dy + rT.z * dz) / (r * delta || 1);
  const cosEps = (-rO.x * dx - rO.y * dy) / (ro * delta);
  const ux = vT.x - vO.x;
  const uy = vT.y - vO.y;
  const uz = vT.z;
  const lx = dx / delta;
  const ly = dy / delta;
  const lz = dz / delta;
  const cx = uy * lz - uz * ly;
  const cy = uz * lx - ux * lz;
  const cz = ux * ly - uy * lx;
  return { rAu: r / AU, deltaAu: delta / AU, alphaDeg: (Math.acos(clamp(cosAlpha)) * 180) / Math.PI, epsDeg: (Math.acos(clamp(cosEps)) * 180) / Math.PI, rate: Math.hypot(cx, cy, cz) / delta };
}

/**
 * Trailing loss of a ground survey, mag: a fast mover smears its light over a trail of length omega x t_exp,
 * so the peak drops by about 2.5 log10(1 + trail / seeing). Example: 0.22 arcsec/s, 30 s, 1.5 arcsec -> 1.8 mag.
 */
export function trailingLoss(rate: number): number {
  const trailArcsec = rate * (180 / Math.PI) * 3600 * KNOBS.GAUGE_EXPOSURE_S;
  return 2.5 * Math.log10(1 + trailArcsec / KNOBS.GAUGE_SEEING_ARCSEC);
}


/**
 * Chance that one network sees a target in direction (elongation eps, ecliptic latitude beta) on a given night,
 * ignoring brightness: 0 outside its elongation band, else pCover, with ground surveys revisiting high
 * latitudes less (x (1 - SKY_LAT_PENALTY |sin beta|)). Example: ATLAS (eps >= 60, p 0.95) at eps 90, beta 30 deg
 * with penalty 0.4 -> 0.95 x 0.8 = 0.76.
 */
export function coverage(n: Network, epsDeg: number, betaDeg: number): number {
  if (n.kind === 'GROUND_OPTICAL') {
    if (epsDeg < (n.epsMin ?? 60)) return 0;
    return (n.pCover ?? 0.5) * (1 - KNOBS.SKY_LAT_PENALTY * Math.abs(Math.sin((betaDeg * Math.PI) / 180)));
  }
  if (n.kind === 'SPACE_IR') return epsDeg >= (n.epsMin ?? 45) && epsDeg <= (n.epsMax ?? 120) ? 1 : 0;
  return 0;
}

/** Combined nightly coverage of several networks, 1 - prod(1 - c_i). */
export function coverageAll(nets: readonly Network[], epsDeg: number, betaDeg: number): number {
  return 1 - nets.reduce((a, n) => a * (1 - coverage(n, epsDeg, betaDeg)), 1);
}

/** Ecliptic latitude of a target seen from an in-plane observer, deg. */
export function eclipticLatitude(rT: Vec3, rO: { x: number; y: number }): number {
  const dx = rT.x - rO.x;
  const dy = rT.y - rO.y;
  return (Math.atan2(rT.z, Math.hypot(dx, dy)) * 180) / Math.PI;
}

/** Unit vector of an angle in the plane (the node line). */
export function nodeLine(angle: number): { x: number; y: number } {
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

