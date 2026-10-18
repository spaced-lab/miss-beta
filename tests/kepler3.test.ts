// WHAT: Tests for the 3-D Kepler layer (M14 phase 1): planar equivalence, round trips, conservation, hand-checked
//       orbits and the shared pymiss vectors.
// WHY:  Phase 2 swaps the game onto these functions; the i = 0 tests are the promise that no planar round changes.
// HOW:  Seeded Rng states, exact (toBe) comparisons where the code path is meant to be bit-identical.
// LORE: O7 (elements), O12 (close approach)

import { describe, expect, it } from 'vitest';
import kepVec from './vectors/kepler3.json';
import elVec from './vectors/elements3.json';
import caVec from './vectors/closeApproach3.json';
import ca2Vec from './vectors/closeApproach.json';
import { closeApproach } from '../src/physics/closeApproach';
import { closeApproach3 } from '../src/physics/closeApproach3';
import { AU, DAY, MU_HOME, MU_SUN, R_HOME, YEAR } from '../src/physics/constants';
import { OrbitError, stateToElements } from '../src/physics/elements';
import { stateToElements3 } from '../src/physics/elements3';
import { period, propagate, type Elements } from '../src/physics/kepler';
import { angularMomentum3, liftElements, orbitPoints3, planeToEcliptic, propagate3, type Elements3, type Vec3 } from '../src/physics/kepler3';
import { Rng } from '../src/sim/rng';

const MU_EARTH = 3.986004418e14;
const DEG = Math.PI / 180;
const HOME: Elements = { a: AU, e: 0.017, w: 0.3, M0: 1.1, t0: 0 };
const norm = (v: Vec3): number => Math.hypot(v.x, v.y, v.z);
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

function randomEl3(rng: Rng, hyperbolic: boolean): Elements3 {
  return hyperbolic
    ? { a: -rng.float(0.2, 4) * AU, e: rng.float(1.05, 6), w: rng.float(0, 2 * Math.PI), M0: rng.float(-3, 3), t0: rng.float(0, 1e9), i: rng.float(0, Math.PI), raan: rng.float(0, 2 * Math.PI) }
    : { a: rng.float(0.3, 6) * AU, e: rng.float(0, 0.95), w: rng.float(0, 2 * Math.PI), M0: rng.float(0, 2 * Math.PI), t0: rng.float(0, 1e9), i: rng.float(0, Math.PI), raan: rng.float(0, 2 * Math.PI) };
}

describe('kepler3: i = 0 is the planar code', () => {
  it('propagate3(lift(el)) equals propagate(el) bit for bit with z = 0, both branches', () => {
    const rng = new Rng(1401);
    for (let k = 0; k < 400; k++) {
      const hyp = k % 4 === 0;
      const el3 = randomEl3(rng, hyp);
      const el: Elements = { a: el3.a, e: el3.e, w: el3.w, M0: el3.M0, t0: el3.t0 };
      const t = el.t0 + (hyp ? rng.float(-3e7, 3e7) : rng.float(0, 1e9));
      const s2 = propagate(el, MU_SUN, t);
      const s3 = propagate3(liftElements(el), MU_SUN, t);
      expect(s3.r.x).toBe(s2.r.x);
      expect(s3.r.y).toBe(s2.r.y);
      expect(s3.v.x).toBe(s2.v.x);
      expect(s3.v.y).toBe(s2.v.y);
      expect(Math.abs(s3.r.z)).toBe(0);
      expect(Math.abs(s3.v.z)).toBe(0);
      expect(s3.E).toBe(s2.E);
    }
  });

  it('stateToElements3 on z = 0 prograde states equals stateToElements bit for bit, i = raan = 0', () => {
    const rng = new Rng(1402);
    for (let k = 0; k < 400; k++) {
      const hyp = k % 4 === 0;
      const el3 = randomEl3(rng, hyp);
      const el: Elements = { a: el3.a, e: el3.e, w: el3.w, M0: el3.M0, t0: el3.t0 };
      const t = el.t0 + (hyp ? rng.float(-3e7, 3e7) : rng.float(0, 1e9));
      const s = propagate(el, MU_SUN, t);
      const b2 = stateToElements(s.r, s.v, MU_SUN, t, true);
      const b3 = stateToElements3({ x: s.r.x, y: s.r.y, z: 0 }, { x: s.v.x, y: s.v.y, z: 0 }, MU_SUN, t, true);
      expect(b3.i).toBe(0);
      expect(b3.raan).toBe(0);
      expect(b3.a).toBe(b2.a);
      expect(b3.e).toBe(b2.e);
      expect(b3.w).toBe(b2.w);
      expect(b3.M0).toBe(b2.M0);
      expect(b3.t0).toBe(b2.t0);
    }
  });

  it('the circular planar guard carries over: circular at 1 AU gives e = 0, w = 0, M0 = 0', () => {
    const vc = Math.sqrt(MU_SUN / AU);
    const el = stateToElements3({ x: AU, y: 0, z: 0 }, { x: 0, y: vc, z: 0 }, MU_SUN, 0);
    expect(el.e).toBe(0);
    expect(el.w).toBe(0);
    expect(el.i).toBe(0);
    expect(el.M0).toBeCloseTo(0, 9);
  });

  it('closeApproach3 on lifted orbits reproduces closeApproach over the shared planar cases', () => {
    const cases = (ca2Vec as { closeApproach: { threat: Elements; home: Elements; tNominal: number }[] }).closeApproach;
    expect(cases.length).toBeGreaterThan(5);
    for (const c of cases) {
      const a = closeApproach(c.threat, c.home, MU_SUN, MU_HOME, R_HOME, c.tNominal);
      const b = closeApproach3(liftElements(c.threat), liftElements(c.home), MU_SUN, MU_HOME, R_HOME, c.tNominal);
      expect(Math.abs(b.tCa - a.tCa)).toBeLessThan(1e-3);
      expect(Math.abs(b.dMin - a.dMin)).toBeLessThan(1e-3);
      expect(b.vInf / a.vInf).toBeCloseTo(1, 12);
      expect(b.impact).toBe(a.impact);
    }
  });
});

describe('kepler3: geometry and conventions', () => {
  it('planeToEcliptic: node line stays, the in-plane normal tips up by i', () => {
    const p = planeToEcliptic(1, 0, 90 * DEG, 90 * DEG);
    expect(p.x).toBeCloseTo(0, 15);
    expect(p.y).toBeCloseTo(1, 15);
    expect(p.z).toBe(0);
    const q = planeToEcliptic(0, 1, 90 * DEG, 0);
    expect(q.x).toBeCloseTo(0, 15);
    expect(q.y).toBeCloseTo(0, 15);
    expect(q.z).toBe(1);
  });

  it('a planar retrograde state is not an error in 3-D: i = pi, and it round-trips', () => {
    const r = { x: AU, y: 0 };
    const v = { x: 3000, y: -29780 };
    expect(() => stateToElements(r, v, MU_SUN, 0)).toThrow(OrbitError);
    const el = stateToElements3({ ...r, z: 0 }, { ...v, z: 0 }, MU_SUN, 0);
    expect(el.i).toBe(Math.PI);
    expect(el.raan).toBe(0);
    const s = propagate3(el, MU_SUN, 0);
    expect(Math.abs(s.r.x - AU)).toBeLessThan(1e-3);
    expect(Math.abs(s.r.y)).toBeLessThan(1e-3);
    expect(Math.abs(s.v.y + 29780)).toBeLessThan(1e-9);
    expect(Math.abs(s.v.x - 3000)).toBeLessThan(1e-9);
  });

  it('a radial state throws', () => {
    expect(() => stateToElements3({ x: AU, y: 0, z: 0 }, { x: 1000, y: 0, z: 0 }, MU_SUN, 0)).toThrow(OrbitError);
  });

  it('orbitPoints3 lies in the orbit plane and on propagate3 positions at the sampled anomalies', () => {
    const el: Elements3 = { a: 1.4 * AU, e: 0.3, w: 1.1, M0: 0, t0: 0, i: 0.6, raan: 2.2 };
    const pts = orbitPoints3(el, 64);
    const s0 = propagate3(el, MU_SUN, 0); // M0 = 0: at periapsis, the first sample
    expect(Math.abs((pts[0] ?? NaN) - s0.r.x)).toBeLessThan(1e-3);
    expect(Math.abs((pts[2] ?? NaN) - s0.r.z)).toBeLessThan(1e-3);
    const h = angularMomentum3(s0.r, s0.v);
    const hm = norm(h);
    for (let k = 0; k < 64; k++) {
      const p = { x: pts[k * 3] ?? NaN, y: pts[k * 3 + 1] ?? NaN, z: pts[k * 3 + 2] ?? NaN };
      expect(Math.abs(dot(p, h) / hm)).toBeLessThan(1);
    }
  });
});

describe('kepler3: round trips and conservation', () => {
  it('ROUNDTRIP elliptic: state -> elements3 -> state within 1 m and 1e-6 m/s over random tilts', () => {
    const rng = new Rng(1403);
    for (let k = 0; k < 300; k++) {
      const el = randomEl3(rng, false);
      const t = el.t0 + rng.float(0, 1e9);
      const s = propagate3(el, MU_SUN, t);
      const back = stateToElements3(s.r, s.v, MU_SUN, t);
      const s2 = propagate3(back, MU_SUN, t);
      expect(norm(sub(s2.r, s.r))).toBeLessThan(1);
      expect(norm(sub(s2.v, s.v))).toBeLessThan(1e-6);
      expect(back.a / el.a).toBeCloseTo(1, 9);
      expect(back.e).toBeCloseTo(el.e, 9);
      expect(back.i).toBeCloseTo(el.i, 9);
      // raan is meaningful away from i = 0 and i = pi.
      if (Math.sin(el.i) > 1e-3) expect(Math.cos(back.raan - el.raan)).toBeCloseTo(1, 9);
    }
  });

  it('ROUNDTRIP hyperbolic: relative 1e-10 in r and v', () => {
    const rng = new Rng(1404);
    for (let k = 0; k < 150; k++) {
      const el = randomEl3(rng, true);
      const t = el.t0 + rng.float(-3e7, 3e7);
      const s = propagate3(el, MU_SUN, t);
      const back = stateToElements3(s.r, s.v, MU_SUN, t, true);
      const s2 = propagate3(back, MU_SUN, t);
      expect(norm(sub(s2.r, s.r)) / norm(s.r)).toBeLessThan(1e-10);
      expect(norm(sub(s2.v, s.v)) / norm(s.v)).toBeLessThan(1e-10);
      expect(back.e / el.e).toBeCloseTo(1, 9);
    }
  });

  it('ENERGY and ANGULAR MOMENTUM: constant to 1e-12 relative over one tilted orbit', () => {
    const el: Elements3 = { a: 1.3 * AU, e: 0.6, w: 2.0, M0: 0.4, t0: 0, i: 1.1, raan: 4.0 };
    const eps0 = -MU_SUN / (2 * el.a);
    const s0 = propagate3(el, MU_SUN, 0);
    const h0 = angularMomentum3(s0.r, s0.v);
    const hm0 = norm(h0);
    expect(h0.z / hm0).toBeCloseTo(Math.cos(el.i), 12);
    const T = period(MU_SUN, el.a);
    for (let k = 0; k <= 400; k++) {
      const s = propagate3(el, MU_SUN, (k / 400) * T);
      const eps = (norm(s.v) ** 2) / 2 - MU_SUN / norm(s.r);
      expect(Math.abs((eps - eps0) / eps0)).toBeLessThan(1e-12);
      const h = angularMomentum3(s.r, s.v);
      expect(norm(sub(h, h0)) / hm0).toBeLessThan(1e-12);
    }
  });
});

describe('kepler3: hand-checkable orbits', () => {
  it('POLAR: circular 7000 km around Earth at i = 90 deg starts at the node going straight up', () => {
    const el: Elements3 = { a: 7000e3, e: 0, w: 0, M0: 0, t0: 0, i: 90 * DEG, raan: 0 };
    const s = propagate3(el, MU_EARTH, 0);
    expect(s.r.x).toBeCloseTo(7000e3, 6);
    expect(s.r.z).toBe(0);
    expect(s.v.z).toBeCloseTo(7546.05, 2); // sqrt(mu / a) = sqrt(5.6943e7)
    expect(Math.abs(s.v.y)).toBeLessThan(1e-9);
    const q = propagate3(el, MU_EARTH, period(MU_EARTH, el.a) / 4); // a quarter turn later: over the pole
    expect(q.r.z / 7000e3).toBeCloseTo(1, 12);
    expect(Math.hypot(q.r.x, q.r.y)).toBeLessThan(1e-3);
    const back = stateToElements3(s.r, s.v, MU_EARTH, 0);
    expect(back.i).toBeCloseTo(90 * DEG, 14);
    expect(back.raan).toBe(0);
    expect(back.M0).toBeCloseTo(0, 9);
  });

  it('ISS-like: a = 6778 km, i = 51.64 deg: 92.6 min period, 7.67 km/s, max |z| = r sin i', () => {
    const el: Elements3 = { a: 6778.137e3, e: 0.0005, w: 1.0, M0: 0.5, t0: 0, i: 51.64 * DEG, raan: 2.0 };
    const T = period(MU_EARTH, el.a);
    expect(T / 60).toBeCloseTo(92.56, 1);
    let zMax = 0;
    for (let k = 0; k < 2000; k++) {
      const s = propagate3(el, MU_EARTH, (k / 2000) * T);
      zMax = Math.max(zMax, Math.abs(s.r.z));
      expect(norm(s.v) / 1000).toBeCloseTo(7.67, 1);
      expect(Math.abs(norm(s.r) - el.a)).toBeLessThan(el.a * el.e * 1.0001);
    }
    // Max latitude of the ground track is i: |z| peaks at r sin i, about 5310 km.
    expect(zMax / (el.a * Math.sin(el.i))).toBeCloseTo(1, 3);
  });

  it('HYPERBOLA: a = -1 AU, e = 2, i = 30 deg, at periapsis q = 1 AU, v = sqrt(3 mu / AU) = 51.6 km/s, z = q sin(w) sin(i)', () => {
    const el: Elements3 = { a: -AU, e: 2, w: 0.5, M0: 0, t0: 0, i: 30 * DEG, raan: 1.0 };
    const s = propagate3(el, MU_SUN, 0);
    expect(norm(s.r) / AU).toBeCloseTo(1, 12);
    expect(norm(s.v) / Math.sqrt((3 * MU_SUN) / AU)).toBeCloseTo(1, 12);
    expect(norm(s.v) / 1000).toBeCloseTo(51.58, 1);
    expect(s.r.z / AU).toBeCloseTo(Math.sin(0.5) * 0.5, 12);
    const back = stateToElements3(s.r, s.v, MU_SUN, 0, true);
    expect(back.e).toBeCloseTo(2, 10);
    expect(back.i).toBeCloseTo(30 * DEG, 12);
    expect(back.raan).toBeCloseTo(1.0, 12);
    expect(back.w).toBeCloseTo(0.5, 10);
    expect(() => stateToElements3(s.r, s.v, MU_SUN, 0)).toThrow(/unbound/);
  });

  it('TILTED COLLISION: HOME state + 12 km/s with an out-of-plane part hits; a 1 m/s along-track nudge misses', () => {
    const home = liftElements(HOME);
    const tI = 5 * YEAR;
    const hs = propagate3(home, MU_SUN, tI);
    const dv = { x: 12e3 * Math.cos(0.4) * Math.cos(1), y: 12e3 * Math.cos(0.4) * Math.sin(1), z: 12e3 * Math.sin(0.4) };
    const el = stateToElements3(hs.r, { x: hs.v.x + dv.x, y: hs.v.y + dv.y, z: hs.v.z + dv.z }, MU_SUN, tI);
    expect(el.i).toBeGreaterThan(0.1);
    const ca = closeApproach3(el, home, MU_SUN, MU_HOME, R_HOME, tI);
    expect(ca.impact).toBe(true);
    expect(ca.dMin).toBeLessThan(1e5);
    expect(Math.abs(ca.tCa - tI)).toBeLessThan(5);
    expect(ca.vInf / 12e3).toBeCloseTo(1, 6);
    const t0 = tI - 4 * YEAR;
    const s0 = propagate3(el, MU_SUN, t0);
    const vm = norm(s0.v);
    const el2 = stateToElements3(s0.r, { x: s0.v.x * (1 + 1 / vm), y: s0.v.y * (1 + 1 / vm), z: s0.v.z * (1 + 1 / vm) }, MU_SUN, t0);
    const ca2 = closeApproach3(el2, home, MU_SUN, MU_HOME, R_HOME, tI, { window: 120 * DAY });
    expect(ca2.impact).toBe(false);
    expect(ca2.dMin).toBeGreaterThan(1e8);
  });
});

describe('shared vectors (generated by pymiss)', () => {
  type El3 = { a: number; e: number; w: number; M0: number; t0: number; i: number; raan: number };
  type P3 = El3 & { mu: number; t: number; x: number; y: number; z: number; vx: number; vy: number; vz: number };
  it('propagate3 agrees with Python, elliptic and hyperbolic', () => {
    const v = kepVec as { propagate3: P3[]; hyperbolic3: P3[] };
    for (const c of [...v.propagate3, ...v.hyperbolic3]) {
      const s = propagate3(c, c.mu, c.t);
      const r = Math.hypot(c.x, c.y, c.z);
      const u = Math.hypot(c.vx, c.vy, c.vz);
      expect(Math.hypot(s.r.x - c.x, s.r.y - c.y, s.r.z - c.z) / r).toBeLessThan(1e-11);
      expect(Math.hypot(s.v.x - c.vx, s.v.y - c.vy, s.v.z - c.vz) / u).toBeLessThan(1e-11);
    }
  });
  it('stateToElements3 agrees with Python', () => {
    type S = { x: number; y: number; z: number; vx: number; vy: number; vz: number; mu: number; t: number; out_a: number; out_e: number; out_w: number; out_M0: number; out_i: number; out_raan: number };
    const v = elVec as { stateToElements3: S[] };
    expect(v.stateToElements3.length).toBe(50);
    for (const c of v.stateToElements3) {
      const el = stateToElements3({ x: c.x, y: c.y, z: c.z }, { x: c.vx, y: c.vy, z: c.vz }, c.mu, c.t, true);
      expect(el.a / c.out_a).toBeCloseTo(1, 10);
      expect(el.e).toBeCloseTo(c.out_e, 10);
      expect(el.i).toBeCloseTo(c.out_i, 12);
      expect(Math.cos(el.raan - c.out_raan)).toBeCloseTo(1, 12);
      expect(Math.cos(el.w - c.out_w)).toBeCloseTo(1, 10);
      if (c.out_e < 1) expect(Math.cos(el.M0 - c.out_M0)).toBeCloseTo(1, 10);
      else expect(el.M0).toBeCloseTo(c.out_M0, 8);
    }
  });
  it('closeApproach3 agrees with Python', () => {
    type C = { threat: El3; home: El3; tNominal: number; tCa: number; dMin: number; vInf: number; bCrit: number; impact: boolean };
    const v = caVec as { closeApproach3: C[] };
    expect(v.closeApproach3.length).toBeGreaterThan(5);
    for (const c of v.closeApproach3) {
      const ca = closeApproach3(c.threat, c.home, MU_SUN, MU_HOME, R_HOME, c.tNominal);
      expect(Math.abs(ca.tCa - c.tCa)).toBeLessThan(3);
      expect(ca.dMin).toBeCloseTo(c.dMin, -1);
      expect(ca.vInf / c.vInf).toBeCloseTo(1, 9);
      expect(ca.bCrit / c.bCrit).toBeCloseTo(1, 9);
      expect(ca.impact).toBe(c.impact);
    }
  });
});
