// WHAT: Tests for the 3-D Lambert wrapper and the 3-D kinetic impulse (M14 phase 2): planar equivalence, the
//       transfer really reaches r2 (propagated with the 3-D Kepler layer), the retrograde sense, and pymiss vectors.
// WHY:  Kinetic intercepts of visitors off the ecliptic fly these arcs; a planar target must get the old numbers.
// HOW:  Exact (toBe) comparisons where the code path is meant to be identical, relative tolerances against Python.
// LORE: O10 (A to B), D3 (kinetic and beta)

import { describe, expect, it } from 'vitest';
import { AU, DAY, MU_SUN } from '../src/physics/constants';
import { stateToElements3 } from '../src/physics/elements3';
import { alongTrack3, kineticImpact, kineticImpact3 } from '../src/physics/kinetic';
import { angularMomentum3, propagate3, type Vec3 } from '../src/physics/kepler3';
import { lambert, lambert3 } from '../src/physics/lambert';
import lamVec from './vectors/lambert.json';
import l3Vec from './vectors/lambert3.json';

const v3 = (a: number[]): Vec3 => ({ x: a[0] as number, y: a[1] as number, z: a[2] as number });

describe('lambert3', () => {
  it('in the plane it is the planar lambert, bit for bit', () => {
    const cases = (lamVec as { lambert: { r1x: number; r1y: number; r2x: number; r2y: number; dt: number; mu: number }[] }).lambert;
    for (const c of cases) {
      const a = lambert({ x: c.r1x, y: c.r1y }, { x: c.r2x, y: c.r2y }, c.dt, c.mu);
      const b = lambert3({ x: c.r1x, y: c.r1y, z: 0 }, { x: c.r2x, y: c.r2y, z: 0 }, c.dt, c.mu);
      expect(a && b).toBeTruthy();
      if (!a || !b) continue;
      expect(b.v1.x).toBe(a.v1.x);
      expect(b.v1.y).toBe(a.v1.y);
      expect(b.v2.y).toBe(a.v2.y);
      expect(b.v1.z === 0).toBe(true);
      expect(b.z).toBe(a.z);
    }
  });
  it('the doc example: a quarter turn up to 0.2 AU above the plane', () => {
    const s = lambert3({ x: AU, y: 0, z: 0 }, { x: 0, y: AU, z: 0.2 * AU }, 100 * DAY, MU_SUN);
    expect(s).not.toBeNull();
    if (!s) return;
    expect(s.dtheta).toBeCloseTo(Math.PI / 2, 12);
    expect(s.v1.x / 1000).toBeCloseTo(2.38, 2);
    expect(s.v1.y / 1000).toBeCloseTo(28.33, 2);
    expect(s.v1.z / 1000).toBeCloseTo(5.67, 2);
  });
  it('the arc flown from r1 with v1 reaches r2 after dt, and arrives with v2; prograde has h_z > 0', () => {
    const cases = (l3Vec as { lambert3: { r1: number[]; r2: number[]; dt: number; mu: number; prograde: boolean }[] }).lambert3;
    for (const c of cases) {
      const r1 = v3(c.r1);
      const r2 = v3(c.r2);
      const s = lambert3(r1, r2, c.dt, c.mu, c.prograde);
      expect(s).not.toBeNull();
      if (!s) continue;
      const el = stateToElements3(r1, s.v1, c.mu, 0, true);
      const end = propagate3(el, c.mu, c.dt);
      const d = Math.hypot(end.r.x - r2.x, end.r.y - r2.y, end.r.z - r2.z);
      expect(d / Math.hypot(r2.x, r2.y, r2.z)).toBeLessThan(1e-8);
      expect(Math.hypot(end.v.x - s.v2.x, end.v.y - s.v2.y, end.v.z - s.v2.z) / Math.hypot(s.v2.x, s.v2.y, s.v2.z)).toBeLessThan(1e-7);
      const h = angularMomentum3(r1, s.v1);
      if (c.prograde) expect(h.z).toBeGreaterThan(0);
      else expect(h.z).toBeLessThan(0);
    }
  });
  it('agrees with the pymiss vectors', () => {
    type C = { r1: number[]; r2: number[]; dt: number; mu: number; prograde: boolean; v1: number[]; v2: number[]; z: number; dtheta: number };
    const cases = (l3Vec as { lambert3: C[] }).lambert3;
    expect(cases.length).toBe(30);
    for (const c of cases) {
      const s = lambert3(v3(c.r1), v3(c.r2), c.dt, c.mu, c.prograde);
      if (!s) throw new Error('null');
      const e1 = v3(c.v1);
      const e2 = v3(c.v2);
      expect(Math.hypot(s.v1.x - e1.x, s.v1.y - e1.y, s.v1.z - e1.z) / Math.hypot(e1.x, e1.y, e1.z)).toBeLessThan(1e-9);
      expect(Math.hypot(s.v2.x - e2.x, s.v2.y - e2.y, s.v2.z - e2.z) / Math.hypot(e2.x, e2.y, e2.z)).toBeLessThan(1e-9);
      expect(s.dtheta).toBeCloseTo(c.dtheta, 12);
    }
  });
  it('null for a degenerate geometry and a bad flight time', () => {
    expect(lambert3({ x: AU, y: 0, z: 0 }, { x: 2 * AU, y: 0, z: 0 }, 100 * DAY, MU_SUN)).toBeNull();
    expect(lambert3({ x: AU, y: 0, z: 0 }, { x: 0, y: AU, z: 0 }, 0, MU_SUN)).toBeNull();
  });
});

describe('kineticImpact3', () => {
  it('DART pointed out of the plane, and the planar case', () => {
    const k = kineticImpact3(580, 4.3e9, { x: 0, y: 0, z: 6140 }, { x: 0, y: 0, z: 0 }, 3.6);
    expect(k.dv.z).toBeCloseTo(2.98e-3, 5);
    expect(k.dv.x).toBe(0);
    const p = kineticImpact(580, 4.3e9, { x: 6140, y: 10 }, { x: 0, y: 5 }, 3.6);
    const q = kineticImpact3(580, 4.3e9, { x: 6140, y: 10, z: 0 }, { x: 0, y: 5, z: 0 }, 3.6);
    expect(q.dv.x).toBe(p.dv.x);
    expect(q.Q).toBeCloseTo(p.Q, 6);
    expect(alongTrack3({ x: 1, y: 0, z: 1 }, { x: 0, y: 0, z: 5 })).toBe(1);
  });
  it('agrees with the pymiss vectors', () => {
    type K = { m: number; M: number; vi: number[]; vt: number[]; beta: number; dv: number[]; U: number; Q: number; along: number };
    for (const c of (l3Vec as { kinetic3: K[] }).kinetic3) {
      const k = kineticImpact3(c.m, c.M, v3(c.vi), v3(c.vt), c.beta);
      expect(k.U / c.U).toBeCloseTo(1, 12);
      expect(k.Q / c.Q).toBeCloseTo(1, 11);
      expect(k.dv.z / (c.dv[2] as number)).toBeCloseTo(1, 12);
      expect(alongTrack3(k.dv, v3(c.vt)) - c.along).toBeCloseTo(0, 9);
    }
  });
});
