// WHAT: LAB_FOCUSING: b_crit = R sqrt(1 + v_esc^2 / v_inf^2) versus the planet radius; sample trajectories bend in.
// LORE: O12
import { bCrit, escapeSpeed } from '../../physics/closeApproach';
import { MU_HOME, R_HOME } from '../../physics/constants';
import { fmt, type Lab } from './lab';
import { Plot } from './plot';

export const lab: Lab = {
  id: 'LAB_FOCUSING',
  title: 'GRAVITATIONAL FOCUSING: THE B-CRIT RING',
  code: ['src/physics/closeApproach.ts: bCrit, escapeSpeed, closeApproach'],
  sliders: [
    { key: 'vinf', label: 'v_inf (km/s)', min: 1, max: 40, step: 0.5, value: 8 },
    { key: 'mass', label: 'planet mass (Earths)', min: 0.1, max: 10, step: 0.1, value: 1 },
  ],
  lines: (v) => {
    const mu = MU_HOME * (v.mass ?? 1);
    const vi = (v.vinf ?? 1) * 1000;
    const ve = escapeSpeed(mu, R_HOME);
    const b = bCrit(mu, R_HOME, vi);
    return [
      `v_esc = sqrt(2 mu / R) = ${fmt(ve / 1000)} km/s`,
      `b_crit = R sqrt(1 + v_esc^2 / v_inf^2) = ${fmt(b / R_HOME)} R = ${fmt(b / 1000)} km`,
      `impact speed = sqrt(v_inf^2 + v_esc^2) = ${fmt(Math.sqrt(vi * vi + ve * ve) / 1000)} km/s`,
    ];
  },
  draw: (s, v, box) => {
    const mu = MU_HOME * (v.mass ?? 1);
    const vi = (v.vinf ?? 1) * 1000;
    const b = bCrit(mu, R_HOME, vi) / R_HOME;
    const span = Math.max(4, b * 1.6);
    const aspect = box.w / box.h;
    const pl = new Plot(s, box, -span * aspect, span * aspect, -span, span);
    pl.frame();
    const circ = (r: number, n = 64): [number, number][] => Array.from({ length: n + 1 }, (_, i) => [r * Math.cos((i / n) * 2 * Math.PI), r * Math.sin((i / n) * 2 * Math.PI)]);
    pl.curve(circ(1), s.palette.ink, undefined, true);
    pl.curve(circ(b), s.palette.hot, [3, 4], true);
    pl.label(b * 0.7, b * 0.7, `B-CRIT ${fmt(b)} R`, s.palette.hot);
    // Hyperbolic sample paths: incoming from the left at impact parameters 0.5 b .. 2 b.
    for (const f of [0.4, 0.8, 1.0, 1.3, 1.8]) {
      const bb = f * b * R_HOME;
      const pts: [number, number][] = [];
      // Trajectory via energy and angular momentum: r(theta) for a hyperbola with v_inf, b.
      const h = bb * vi;
      const ecc = Math.sqrt(1 + (bb * bb * vi ** 4) / (mu * mu));
      const pLat = (h * h) / mu;
      const thMax = Math.acos(-1 / ecc);
      for (let i = -60; i <= 60; i++) {
        const th = (i / 60) * (thMax - 0.02);
        const r = pLat / (1 + ecc * Math.cos(th));
        if (r / R_HOME > span * aspect * 1.5) continue;
        pts.push([(-r * Math.cos(th)) / R_HOME, (r * Math.sin(th)) / R_HOME]);
      }
      const hits = bb < b * R_HOME;
      pl.curve(pts, hits ? s.palette.hot : s.palette.dim);
    }
  },
};
