// WHAT: Analytic two-body propagation: Kepler's equation and position/velocity from orbital elements.
// WHY:  GAME_PLAN 6.2. Because every coasting body's state at any time is a closed-form evaluation,
//       time warp and "jump to the end" cost nothing, and a replay is exact. This is the keystone of the
//       simulator: everything else (Lambert, flybys, impacts) hands results back to these elements.
// HOW:  Elements for a 2-D prograde ellipse: a (m), e (0 <= e < 1), w (longitude of periapsis, rad from +x),
//       M0 (mean anomaly at epoch t0, rad), t0 (s). Newton's method on E - e sin E = M with the
//       e < 0.8 / pi start of GAME_PLAN 6.2, tolerance 1e-14 (the plan says 1e-12; tighter costs one
//       iteration and lets the energy test hold to 1e-12 relative). Python mirror: pymiss/physics/kepler.py.
//       Hyperbolic branch (M7, SCI-FI interstellar rounds, GAME_PLAN 21.2): a < 0 and e > 1; the mean
//       anomaly is unwrapped, M = e sinh H - H is solved for H by Newton, r = a (1 - e cosh H) (positive
//       because a < 0), and the velocity uses k = sqrt(-mu a) / r. Parabolic (e = 1) is not representable.
// LORE: O6 (Kepler), O7 (elements), O8 (vis-viva), O9 (anomalies)

import type { Vec2 } from '../util/vec';
import { wrapAngle } from '../util/vec';

export interface Elements {
  /** Semi-major axis, m; negative for a hyperbola. */
  readonly a: number;
  /** Eccentricity, 0 <= e < 1 bound, e > 1 hyperbolic (a < 0). */
  readonly e: number;
  /** Longitude of periapsis, rad, measured counter-clockwise from +x. */
  readonly w: number;
  /** Mean anomaly at epoch, rad in [0, 2pi). */
  readonly M0: number;
  /** Epoch, s. */
  readonly t0: number;
}

export interface State {
  readonly r: Vec2;
  readonly v: Vec2;
}

export interface PropagatedState extends State {
  /** Eccentric anomaly, rad (the hyperbolic anomaly H when e > 1). */
  readonly E: number;
  /** True anomaly, rad. */
  readonly nu: number;
  /** Mean anomaly used, rad in [0, 2pi). */
  readonly M: number;
}

/**
 * Mean motion n = sqrt(mu / a^3), rad/s.
 * Example: a = 1 AU, mu = MU_SUN -> 1.991e-7 rad/s (one turn in 365.25 d).
 */
export function meanMotion(mu: number, a: number): number {
  const aa = Math.abs(a);
  return Math.sqrt(mu / (aa * aa * aa));
}

/** Orbital period T = 2 pi sqrt(a^3 / mu), s (Infinity for a hyperbola). Example: a = 1 AU -> 3.1558e7 s. */
export function period(mu: number, a: number): number {
  return a > 0 ? (2 * Math.PI) / meanMotion(mu, a) : Infinity;
}

/**
 * Solve the hyperbolic Kepler equation e sinh H - H = M for H by Newton's method.
 * Start: H0 = asinh(M / e) (exact for e sinh H >> H). Example: M = 1, e = 1.5 -> H = 1.16164 (check: 1.5 sinh H - H = 1).
 */
export function solveKeplerHyperbolic(M: number, e: number, tol = 1e-14, maxIter = 50): number {
  let H = Math.asinh(M / e);
  for (let i = 0; i < maxIter; i++) {
    const f = e * Math.sinh(H) - H - M;
    const fp = e * Math.cosh(H) - 1;
    const dH = f / fp;
    H -= dH;
    if (Math.abs(dH) < tol * Math.max(1, Math.abs(H))) break;
  }
  return H;
}

/** True anomaly from hyperbolic anomaly: nu = 2 atan(sqrt((e+1)/(e-1)) tanh(H/2)). */
export function trueAnomalyFromH(H: number, e: number): number {
  return 2 * Math.atan(Math.sqrt((e + 1) / (e - 1)) * Math.tanh(H / 2));
}

/** Hyperbolic anomaly from true anomaly: H = 2 atanh(sqrt((e-1)/(e+1)) tan(nu/2)); |nu| must be below acos(-1/e). */
export function hyperbolicFromTrue(nu: number, e: number): number {
  return 2 * Math.atanh(Math.sqrt((e - 1) / (e + 1)) * Math.tan(nu / 2));
}

/**
 * Solve Kepler's equation E - e sin E = M for E (rad) by Newton's method.
 * Start: E0 = M if e < 0.8 else pi. Stops when |dE| < tol or after maxIter steps.
 * Example: M = 1, e = 0.5 -> E = 1.49870113351785 (Danby's classic check value).
 */
export function solveKepler(M: number, e: number, tol = 1e-14, maxIter = 30): number {
  const Mw = wrapAngle(M);
  let E = e < 0.8 ? Mw : Math.PI;
  for (let i = 0; i < maxIter; i++) {
    const f = E - e * Math.sin(E) - Mw;
    const fp = 1 - e * Math.cos(E);
    const dE = f / fp;
    E -= dE;
    if (Math.abs(dE) < tol) break;
  }
  return E;
}

/** True anomaly from eccentric anomaly: nu = 2 atan2(sqrt(1+e) sin(E/2), sqrt(1-e) cos(E/2)). */
export function trueAnomalyFromE(E: number, e: number): number {
  return 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
}

/** Eccentric anomaly from true anomaly: E = 2 atan2(sqrt(1-e) sin(nu/2), sqrt(1+e) cos(nu/2)). */
export function eccentricFromTrue(nu: number, e: number): number {
  return 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu / 2), Math.sqrt(1 + e) * Math.cos(nu / 2));
}

/**
 * Position and velocity at time t from elements (GAME_PLAN 6.2).
 *   M = M0 + n (t - t0);  solve E;  r = a (1 - e cos E)
 *   perifocal: xp = r cos nu, yp = r sin nu, vxp = -sqrt(mu a)/r sin E, vyp = sqrt(mu a)/r sqrt(1-e^2) cos E
 *   rotate by w into the system frame.
 * Example: a = 1 AU, e = 0, w = 0, M0 = 0, t = t0 -> r = (1 AU, 0), v = (0, 29.78 km/s).
 */
export function propagate(el: Elements, mu: number, t: number): PropagatedState {
  const n = meanMotion(mu, el.a);
  if (el.e > 1) return propagateHyperbolic(el, mu, t, n);
  const M = wrapAngle(el.M0 + n * (t - el.t0));
  const E = solveKepler(M, el.e);
  const nu = trueAnomalyFromE(E, el.e);
  const r = el.a * (1 - el.e * Math.cos(E));
  const xp = r * Math.cos(nu);
  const yp = r * Math.sin(nu);
  const k = Math.sqrt(mu * el.a) / r;
  const vxp = -k * Math.sin(E);
  const vyp = k * Math.sqrt(1 - el.e * el.e) * Math.cos(E);
  const cw = Math.cos(el.w);
  const sw = Math.sin(el.w);
  return {
    r: { x: xp * cw - yp * sw, y: xp * sw + yp * cw },
    v: { x: vxp * cw - vyp * sw, y: vxp * sw + vyp * cw },
    E,
    nu,
    M,
  };
}

/** The e > 1 branch of propagate: M unwrapped, H from the hyperbolic Kepler equation, r = a (1 - e cosh H). */
function propagateHyperbolic(el: Elements, mu: number, t: number, n: number): PropagatedState {
  const M = el.M0 + n * (t - el.t0);
  const H = solveKeplerHyperbolic(M, el.e);
  const nu = trueAnomalyFromH(H, el.e);
  const r = el.a * (1 - el.e * Math.cosh(H));
  const xp = r * Math.cos(nu);
  const yp = r * Math.sin(nu);
  const k = Math.sqrt(-mu * el.a) / r;
  const vxp = -k * Math.sinh(H);
  const vyp = k * Math.sqrt(el.e * el.e - 1) * Math.cosh(H);
  const cw = Math.cos(el.w);
  const sw = Math.sin(el.w);
  return {
    r: { x: xp * cw - yp * sw, y: xp * sw + yp * cw },
    v: { x: vxp * cw - vyp * sw, y: vxp * sw + vyp * cw },
    E: H,
    nu,
    M,
  };
}

/**
 * Vis-viva: v = sqrt(mu (2/r - 1/a)), m/s.
 * Example: circular at 1 AU -> 29.78 km/s.
 */
export function visViva(mu: number, r: number, a: number): number {
  return Math.sqrt(mu * (2 / r - 1 / a));
}

/** Specific orbital energy eps = v^2/2 - mu/r, J/kg. Negative when bound. */
export function specificEnergy(mu: number, r: number, v: number): number {
  return (v * v) / 2 - mu / r;
}

/** Periapsis and apoapsis distances, m (apoapsis is Infinity for a hyperbola). */
export const periapsis = (el: Elements): number => el.a * (1 - el.e);
export const apoapsis = (el: Elements): number => (el.e < 1 ? el.a * (1 + el.e) : Infinity);

/**
 * Sampled orbit outline for drawing: n points in the system frame as a flat [x0,y0,...] array, evenly
 * spaced in true anomaly. Pure geometry: r(nu) = a (1 - e^2) / (1 + e cos nu). A hyperbola is sampled
 * as an open arc between the true anomalies where r = rMax (default 12 AU); the caller strokes it open.
 */
export function orbitPoints(el: Elements, n = 128, rMax = 12 * 1.495978707e11): Float64Array {
  const out = new Float64Array(n * 2);
  const p = el.a * (1 - el.e * el.e);
  const cw = Math.cos(el.w);
  const sw = Math.sin(el.w);
  // Open arc for a hyperbola: cos(nuLim) = (p / rMax - 1) / e.
  const nuLim = el.e > 1 ? Math.acos(Math.max(-1, Math.min(1, (p / rMax - 1) / el.e))) : Math.PI;
  for (let i = 0; i < n; i++) {
    const nu = el.e > 1 ? -nuLim + (i / (n - 1)) * 2 * nuLim : (i / n) * 2 * Math.PI;
    const r = p / (1 + el.e * Math.cos(nu));
    const xp = r * Math.cos(nu);
    const yp = r * Math.sin(nu);
    out[i * 2] = xp * cw - yp * sw;
    out[i * 2 + 1] = xp * sw + yp * cw;
  }
  return out;
}
