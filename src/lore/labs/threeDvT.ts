// WHAT: LAB_3DVT: the miss estimate 3 dv T against a propagated miss on a real orbit.
// LORE: D2, D1
import { AU, MU_SUN, R_HOME, YEAR } from '../../physics/constants';
import { stateToElements } from '../../physics/elements';
import { missFromImpulse } from '../../physics/estimates';
import { propagate } from '../../physics/kepler';
import { fmt, type Lab } from './lab';
import { Plot } from './plot';

function propagatedMiss(dv: number, T: number, e: number): number {
  // A body at 1 AU on an orbit of eccentricity e; push along track at t = 0; compare positions at t = T.
  const a = AU / (1 - e);
  const el = { a, e, w: 0, M0: 0, t0: 0 };
  const st = propagate(el, MU_SUN, 0);
  const vm = Math.hypot(st.v.x, st.v.y);
  const v2 = { x: st.v.x * (1 + dv / vm), y: st.v.y * (1 + dv / vm) };
  const el2 = stateToElements(st.r, v2, MU_SUN, 0);
  const p1 = propagate(el, MU_SUN, T);
  const p2 = propagate(el2, MU_SUN, T);
  return Math.hypot(p2.r.x - p1.r.x, p2.r.y - p1.r.y);
}

export const lab: Lab = {
  id: 'LAB_3DVT',
  title: 'EARLY BEATS BIG: MISS = 3 dv T',
  code: ['src/physics/estimates.ts: missFromImpulse', 'src/physics/kepler.ts: propagate', 'src/physics/elements.ts: stateToElements'],
  sliders: [
    { key: 'dv', label: 'dv (mm/s)', min: 0.1, max: 100, step: 0.1, value: 3, log: true },
    { key: 'T', label: 'T (years)', min: 0.1, max: 15, step: 0.1, value: 5 },
    { key: 'e', label: 'e', min: 0, max: 0.6, step: 0.02, value: 0.2 },
  ],
  lines: (v) => {
    const dv = (v.dv ?? 1) / 1000;
    const T = (v.T ?? 1) * YEAR;
    const est = missFromImpulse(dv, T);
    const prop = propagatedMiss(dv, T, v.e ?? 0);
    return [
      `estimate: 3 dv T = 3 x ${fmt(dv)} m/s x ${fmt(T)} s = ${fmt(est / 1000)} km = ${fmt(est / R_HOME)} Earth radii`,
      `propagated on the orbit (e = ${fmt(v.e ?? 0)}): ${fmt(prop / 1000)} km = ${fmt(prop / R_HOME)} R    ratio ${fmt(prop / est)}`,
      'the 3 comes from the orbit period change: a faster body climbs to a bigger orbit and falls behind.',
    ];
  },
  draw: (s, v, box) => {
    const dv = (v.dv ?? 1) / 1000;
    const Tmax = 15;
    const pl = new Plot(s, box, 0, Tmax, 0, Math.max(1, (3 * dv * Tmax * YEAR) / R_HOME) * 1.2);
    pl.frame();
    pl.axes('T (years)', 'miss (R)');
    const est: [number, number][] = [];
    const prop: [number, number][] = [];
    for (let i = 1; i <= 60; i++) {
      const T = (i / 60) * Tmax;
      est.push([T, missFromImpulse(dv, T * YEAR) / R_HOME]);
      prop.push([T, propagatedMiss(dv, T * YEAR, v.e ?? 0) / R_HOME]);
    }
    pl.curve(est, s.palette.dim, [3, 4]);
    pl.curve(prop);
    const T = v.T ?? 1;
    pl.mark(T, propagatedMiss(dv, T * YEAR, v.e ?? 0) / R_HOME, 4);
    pl.label(Tmax * 0.55, (3 * dv * Tmax * YEAR) / R_HOME, 'DASHED: 3 dv T   SOLID: PROPAGATED');
  },
};
