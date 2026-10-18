// WHAT: Dimension-agnostic orbit helpers for the sim (M14 phase 2): one call site works on a planar body and on a
//       body off the ecliptic, and a planar body takes exactly the planar code path.
// WHY:  Visitors from other stars fly tilted orbits through the whole round (resolver, planner, drawing), while
//       every planar round must replay bit for bit. Writing each formula twice invites drift; writing it once in
//       3-D would change planar rounds in the last bit (Math.hypot(x, y, 0) is not always Math.hypot(x, y)).
//       So the helpers branch on the data: a vector without `z` is planar and gets the 2-D arithmetic.
// HOW:  An orbit is 3-D when its element set carries `i` and `raan` (Elements3 extends Elements, so the
//       threat's `elements` field holds either and every spread copy keeps the tilt). Vectors are {x, y} or
//       {x, y, z}; vsub/vadd/vlen use the 3-D form only when a z is present. toElements picks stateToElements3
//       when the state has a z. pushArc runs the planar along-track integrator in the orbit's own plane: an
//       along-track thrust never leaves the plane, so the tilt (i, raan) is carried over unchanged and the
//       push needs no 3-D integrator. lambertAny calls lambert3 when either end is off the plane.
//       Sim layer: built from mirrored physics (kepler3, elements3, lambert3, kinetic), so no Python mirror.
// LORE: O7 (elements), F12 (visitors from other stars), D6 (slow push)

import { KNOBS } from '../config/knobs';
import { stateToElements } from '../physics/elements';
import { stateToElements3 } from '../physics/elements3';
import { alongTrack, alongTrack3, kineticImpact, kineticImpact3 } from '../physics/kinetic';
import { orbitPoints, propagate, type Elements } from '../physics/kepler';
import { orbitPoints3, propagate3, type Elements3, type Vec3 } from '../physics/kepler3';
import { lambert, lambert3 } from '../physics/lambert';
import { integratePush, type PushArc } from '../physics/slowPush';

/** A planar ({x, y}) or spatial ({x, y, z}) vector. */
export interface V {
  readonly x: number;
  readonly y: number;
  readonly z?: number;
}

/** True when the element set describes a tilted (3-D) orbit. Example: liftElements(HOME) -> true; HOME -> false. */
export function is3D(el: Elements): el is Elements3 {
  const o = el as Partial<Elements3>;
  return typeof o.i === 'number' && typeof o.raan === 'number';
}

/** True when a vector carries a z part. */
export const hasZ = (v: V): boolean => v.z !== undefined;

/** {x, y, z} with z = 0 for a planar vector. */
export const lift = (v: V): Vec3 => ({ x: v.x, y: v.y, z: v.z ?? 0 });

export const vsub = (a: V, b: V): V => (hasZ(a) || hasZ(b) ? { x: a.x - b.x, y: a.y - b.y, z: (a.z ?? 0) - (b.z ?? 0) } : { x: a.x - b.x, y: a.y - b.y });
export const vadd = (a: V, b: V): V => (hasZ(a) || hasZ(b) ? { x: a.x + b.x, y: a.y + b.y, z: (a.z ?? 0) + (b.z ?? 0) } : { x: a.x + b.x, y: a.y + b.y });
export const vscale = (a: V, k: number): V => (hasZ(a) ? { x: a.x * k, y: a.y * k, z: (a.z ?? 0) * k } : { x: a.x * k, y: a.y * k });
export const vdiv = (a: V, k: number): V => (hasZ(a) ? { x: a.x / k, y: a.y / k, z: (a.z ?? 0) / k } : { x: a.x / k, y: a.y / k });
export const vlen = (a: V): number => (hasZ(a) ? Math.hypot(a.x, a.y, a.z ?? 0) : Math.hypot(a.x, a.y));

/**
 * Position and velocity at time t: propagate3 for a tilted orbit (r and v carry z), else propagate (no z).
 * Units: m, m/s. Example: HOME elements -> the planar propagate result, identical object fields.
 */
export function stateAt(el: Elements, mu: number, t: number): { r: V; v: V } {
  if (is3D(el)) {
    const s = propagate3(el, mu, t);
    return { r: s.r, v: s.v };
  }
  const s = propagate(el, mu, t);
  return { r: s.r, v: s.v };
}

/**
 * Elements from a state: stateToElements3 when r or v has a z part (the result is an Elements3 even for a
 * state in the plane), else the planar stateToElements. Throws OrbitError like both.
 */
export function toElements(r: V, v: V, mu: number, t: number, allowUnbound = false): Elements {
  if (hasZ(r) || hasZ(v)) return stateToElements3(lift(r), lift(v), mu, t, allowUnbound);
  return stateToElements(r, v, mu, t, allowUnbound);
}

/** The in-plane part of a tilted orbit (node-frame planar elements): propagate gives the state in its own plane. */
export function inPlane(el: Elements3): Elements {
  return { a: el.a, e: el.e, w: el.w, M0: el.M0, t0: el.t0 };
}

/** Put planar elements on the plane of `like` when `like` is tilted (keeps i and raan), else return them as is. */
export function onPlaneOf(el: Elements, like: Elements): Elements {
  if (!is3D(like)) return el;
  const out: Elements3 = { a: el.a, e: el.e, w: el.w, M0: el.M0, t0: el.t0, i: like.i, raan: like.raan };
  return out;
}

/**
 * Constant along-track push from t0 to t1 (slowPush.integratePush). A tilted orbit is pushed in its own plane
 * (the thrust is along v, so it never leaves the plane) and keeps its i and raan. Planar: integratePush itself.
 * Example: a 1e-9 m/s^2 push for a year on a tilted orbit returns the same i and raan and the planar arc's a, e.
 */
export function pushArc(el: Elements, mu: number, t0: number, t1: number, a: number): PushArc {
  if (!is3D(el)) return integratePush(el, mu, t0, t1, a);
  const arc = integratePush(inPlane(el), mu, t0, t1, a, KNOBS.PUSH_DT, el.e > 1);
  return { ...arc, elements: onPlaneOf(arc.elements, el) };
}

/**
 * Orbit outline seen from above the ecliptic, flat [x0, y0, ...]: orbitPoints for a planar orbit, orbitPoints3
 * with z dropped for a tilted one (for top-down mini maps). Example: a polar orbit draws as a straight segment.
 */
export function topDownOutline(el: Elements, n = 128): Float64Array {
  if (!is3D(el)) return orbitPoints(el, n);
  const p3 = orbitPoints3(el, n);
  const out = new Float64Array(n * 2);
  for (let k = 0; k < n; k++) {
    out[k * 2] = p3[k * 3] as number;
    out[k * 2 + 1] = p3[k * 3 + 1] as number;
  }
  return out;
}

/** Prograde single-revolution Lambert: lambert3 when either end is off the plane, else the planar lambert. */
export function lambertAny(r1: V, r2: V, dt: number, mu: number): { v1: V; v2: V } | null {
  if (hasZ(r1) || hasZ(r2)) return lambert3(lift(r1), lift(r2), dt, mu);
  return lambert(r1, r2, dt, mu);
}

/** Kinetic impulse beta (m/M) U in 2-D or 3-D (kinetic.ts), with the along-track part of dv. */
export function kineticAny(m: number, M: number, vImpactor: V, vThreat: V, beta: number): { dv: V; U: number; Q: number; along: number } {
  if (hasZ(vImpactor) || hasZ(vThreat)) {
    const k = kineticImpact3(m, M, lift(vImpactor), lift(vThreat), beta);
    return { dv: k.dv, U: k.U, Q: k.Q, along: alongTrack3(k.dv, lift(vThreat)) };
  }
  const k = kineticImpact(m, M, vImpactor, vThreat, beta);
  return { dv: k.dv, U: k.U, Q: k.Q, along: alongTrack(k.dv, vThreat) };
}
