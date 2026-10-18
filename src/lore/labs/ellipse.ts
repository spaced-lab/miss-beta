// WHAT: LAB_ELLIPSE: a, e, w sliders; the ellipse, its foci, q and Q, the period; the body at mean anomaly M.
// WHY:  EDUCATION O6/O7: see what each element does.  HOW: orbitPoints + propagate from kepler.ts.
// LORE: O6, O7
import { AU, DAY, MU_SUN } from '../../physics/constants';
import { orbitPoints, period, periapsis, apoapsis, propagate } from '../../physics/kepler';
import { fmt, type Lab } from './lab';
import { Plot } from './plot';

export const lab: Lab = {
  id: 'LAB_ELLIPSE',
  title: 'THE ELLIPSE: a, e, w',
  code: ['src/physics/kepler.ts: orbitPoints, propagate, period', 'src/physics/elements.ts: stateToElements'],
  sliders: [
    { key: 'a', label: 'a (AU)', min: 0.3, max: 4, step: 0.05, value: 1.3 },
    { key: 'e', label: 'e', min: 0, max: 0.95, step: 0.01, value: 0.4 },
    { key: 'w', label: 'w (deg)', min: 0, max: 360, step: 5, value: 30 },
    { key: 'M', label: 'M (deg)', min: 0, max: 360, step: 5, value: 60 },
  ],
  lines: (v) => {
    const a = (v.a ?? 1) * AU;
    const el = { a, e: v.e ?? 0, w: ((v.w ?? 0) * Math.PI) / 180, M0: ((v.M ?? 0) * Math.PI) / 180, t0: 0 };
    const st = propagate(el, MU_SUN, 0);
    return [
      `q = a (1 - e) = ${fmt(periapsis(el) / AU)} AU     Q = a (1 + e) = ${fmt(apoapsis(el) / AU)} AU`,
      `T = 2 pi sqrt(a^3 / mu) = ${fmt(period(MU_SUN, a) / DAY)} d = ${fmt(period(MU_SUN, a) / DAY / 365.25)} yr`,
      `r now = ${fmt(Math.hypot(st.r.x, st.r.y) / AU)} AU   v now = ${fmt(Math.hypot(st.v.x, st.v.y) / 1000)} km/s   E = ${fmt(st.E)} rad   nu = ${fmt(st.nu)} rad`,
    ];
  },
  draw: (s, v, box) => {
    const a = (v.a ?? 1) * AU;
    const el = { a, e: v.e ?? 0, w: ((v.w ?? 0) * Math.PI) / 180, M0: ((v.M ?? 0) * Math.PI) / 180, t0: 0 };
    const R = Math.max(1.2, (apoapsis(el) / AU) * 1.1);
    const aspect = box.w / box.h;
    const pl = new Plot(s, box, -R * aspect, R * aspect, -R, R);
    pl.frame();
    const pts = orbitPoints(el, 180);
    const c: [number, number][] = [];
    for (let i = 0; i < pts.length; i += 2) c.push([(pts[i] as number) / AU, (pts[i + 1] as number) / AU]);
    pl.curve(c, undefined, undefined, true);
    // Earth's orbit for scale, the Sun at the focus, the empty focus.
    const e1: [number, number][] = [];
    for (let i = 0; i <= 64; i++) e1.push([Math.cos((i / 64) * 2 * Math.PI), Math.sin((i / 64) * 2 * Math.PI)]);
    pl.curve(e1, s.palette.dim, [2, 4], true);
    pl.mark(0, 0, 3);
    const f2 = (-2 * el.a * el.e) / AU;
    pl.mark(f2 * Math.cos(el.w), f2 * Math.sin(el.w), 2, s.palette.dim);
    const st = propagate(el, MU_SUN, 0);
    pl.mark(st.r.x / AU, st.r.y / AU, 4);
    pl.label(st.r.x / AU, st.r.y / AU, 'BODY');
  },
};
