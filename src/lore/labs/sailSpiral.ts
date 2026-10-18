// WHAT: LAB_SAIL_SPIRAL: a solar sail spirals out (or in) from 1 AU under light pressure; the sail rides
//       the path with its force arrow, and an inset plots the dv it has built against time.
// WHY:  EDUCATION D7: a sail never runs out of propellant; it trades time for dv. Loading sigma sets the
//       characteristic acceleration and so how fast the spiral opens.
// HOW:  characteristicAccel and lightness (src/physics/sail.ts), then integrateSail (RK4 from
//       src/physics/integrate.ts at SAIL_DT) in CHUNKS equal pieces chained end to start, so the cumulative
//       dvEquiv is known at every chunk boundary for the inset. Cached by the rounded slider values (a
//       three-year arc is about 4400 RK4 steps, a few ms once). The arc stops if it falls inside R_STOP.
// LORE: D7 (sails), O13 (integration)

import { KNOBS } from '../../config/knobs';
import { AU, DAY, MU_SUN, P_RAD_1AU, YEAR } from '../../physics/constants';
import type { State4 } from '../../physics/integrate';
import { characteristicAccel, integrateSail, lightness, type SailLaw } from '../../physics/sail';
import { fmt, type Box, type Lab } from './lab';
import { along, arrow, fitLabel, keyOf, loop, Memo, roleDash } from './kit';

const LAWS: readonly SailLaw[] = ['SPIRAL_OUT', 'SPIRAL_IN', 'COAST'];
/** NOTE: lab constants: chunks for the dv curve, the reflectivity used, the stop radius near the Sun. */
const CHUNKS = 24;
const ETA = 0.9;
const R_STOP = 0.15 * AU;

interface Arc {
  aC: number;
  /** Positions, flat, evenly spaced in time (one per RK4 step). */
  pts: Float64Array;
  /** Cumulative dvEquiv at each chunk boundary (CHUNKS + 1 values, m/s) and the time of each, s. */
  dv: number[];
  tk: number[];
  rEnd: number;
  stopped: boolean;
}

const arcs = new Memo<Arc>(10);

function arc(v: Record<string, number>): Arc {
  const sigma = (v.sigma ?? 10) / 1000;
  const law = LAWS[Math.max(0, Math.min(LAWS.length - 1, Math.round(v.law ?? 0)))] ?? 'SPIRAL_OUT';
  const T = (v.years ?? 1) * YEAR;
  return arcs.get(keyOf(sigma, LAWS.indexOf(law), T), () => {
    const aC = characteristicAccel(sigma, ETA);
    let s: State4 = [AU, 0, 0, Math.sqrt(MU_SUN / AU)];
    const all: number[] = [];
    const dv = [0];
    const tk = [0];
    let stopped = false;
    for (let k = 0; k < CHUNKS; k++) {
      const t0 = (T * k) / CHUNKS;
      const t1 = (T * (k + 1)) / CHUNKS;
      const res = integrateSail(s, t0, t1, aC, MU_SUN, law);
      for (let i = 0; i + 1 < res.samples.length; i += 2) {
        const x = res.samples[i] ?? NaN;
        const y = res.samples[i + 1] ?? NaN;
        if (!Number.isFinite(x) || !Number.isFinite(y) || Math.hypot(x, y) < R_STOP) {
          stopped = true;
          break;
        }
        all.push(x, y);
      }
      if (stopped) break;
      s = res.state;
      dv.push((dv[dv.length - 1] ?? 0) + res.dvEquiv);
      tk.push(t1);
    }
    const n = all.length;
    return { aC, pts: Float64Array.from(all), dv, tk, rEnd: n >= 2 ? Math.hypot(all[n - 2] ?? 0, all[n - 1] ?? 0) : AU, stopped };
  });
}

export const lab: Lab = {
  id: 'LAB_SAIL_SPIRAL',
  title: 'SOLAR SAIL: THE SLOW FREE PUSH',
  code: ['src/physics/sail.ts: characteristicAccel, sailAccel, integrateSail', 'src/physics/integrate.ts: integrate, rk4Step'],
  sliders: [
    { key: 'sigma', label: 'loading (g/m2)', min: 3, max: 100, step: 1, value: 10, log: true },
    { key: 'law', label: 'law: out, in, coast', min: 0, max: 2, step: 1, value: 0 },
    { key: 'years', label: 'duration (yr)', min: 0.25, max: 3, step: 0.25, value: 1.5 },
  ],
  lines: (v) => {
    const a = arc(v);
    const law = LAWS[Math.max(0, Math.min(2, Math.round(v.law ?? 0)))] ?? 'SPIRAL_OUT';
    const yrs = v.years ?? 1;
    const dvEnd = a.dv[a.dv.length - 1] ?? 0;
    const tEnd = a.tk[a.tk.length - 1] ?? 0;
    const cone = law === 'COAST' ? 'feathered, no push' : `alpha = ${law === 'SPIRAL_OUT' ? '+' : '-'}${fmt((KNOBS.SAIL_ALPHA_OPT * 180) / Math.PI)} deg, max tangential push`;
    return [
      `a_c = 2 eta P / sigma = 2 x ${ETA} x ${fmt(P_RAD_1AU)} / ${fmt((v.sigma ?? 10) / 1000)} = ${fmt(a.aC * 1000)} mm/s2`,
      `lightness beta_s = ${fmt(lightness(a.aC))}   ${law}: ${cone}`,
      `after ${fmt(a.stopped ? tEnd / YEAR : yrs)} yr: dv built ${fmt(dvEnd / 1000)} km/s, r = ${fmt(a.rEnd / AU)} AU${a.stopped ? ' (stopped near the sun)' : ''}`,
    ];
  },
  draw: (s, v, box, t = 0) => {
    const a = arc(v);
    const pal = s.palette;
    const law = LAWS[Math.max(0, Math.min(2, Math.round(v.law ?? 0)))] ?? 'SPIRAL_OUT';
    s.stroke([box.x, box.y, box.x + box.w, box.y, box.x + box.w, box.y + box.h, box.x, box.y + box.h], { closed: true, color: pal.dim, glow: 0 });
    const lw = Math.min(box.h, box.w * 0.6);
    let rMax = 1.15 * AU;
    for (let i = 0; i + 1 < a.pts.length; i += 2) rMax = Math.max(rMax, Math.hypot(a.pts[i] ?? 0, a.pts[i + 1] ?? 0));
    const k = (lw - 16) / (2 * rMax * 1.05);
    const cx = box.x + lw / 2;
    const cy = box.y + box.h / 2;
    const SX = (x: number): number => cx + x * k;
    const SY = (y: number): number => cy - y * k;
    s.circle(cx, cy, 4, { color: s.role('star'), glow: 1 });
    s.circle(cx, cy, AU * k, { color: s.role('orbit'), glow: 0, dash: [2, 4] });
    // The whole spiral dim, the travelled part bright, decimated to about 300 points.
    const n = a.pts.length / 2;
    const stride = Math.max(1, Math.floor(n / 300));
    const ph = Math.min(1, loop(t, 6) * 1.1);
    const full: number[] = [];
    const done: number[] = [];
    for (let i = 0; i < n; i += stride) {
      const x = SX(a.pts[2 * i] ?? 0);
      const y = SY(a.pts[2 * i + 1] ?? 0);
      full.push(x, y);
      if (i <= ph * (n - 1)) done.push(x, y);
    }
    s.stroke(full, { color: pal.dim, glow: 0, dash: [1, 3] });
    const dash = roleDash('sail');
    s.stroke(done, { color: s.role('sail'), glow: 0.5, ...(dash ? { dash } : {}) });
    // The sail: a short plate across its normal, and the light-pressure force along the normal.
    const [px, py] = along(a.pts, ph);
    const r = Math.hypot(px, py) || 1;
    const alpha = law === 'SPIRAL_OUT' ? KNOBS.SAIL_ALPHA_OPT : law === 'SPIRAL_IN' ? -KNOBS.SAIL_ALPHA_OPT : Math.PI / 2;
    const ux = px / r;
    const uy = py / r;
    const nx = ux * Math.cos(alpha) - uy * Math.sin(alpha);
    const ny = ux * Math.sin(alpha) + uy * Math.cos(alpha);
    const sx = SX(px);
    const sy = SY(py);
    s.stroke([sx - 6 * ny, sy - 6 * nx, sx + 6 * ny, sy + 6 * nx], { color: s.role('sail'), glow: 1, width: 2 });
    if (law !== 'COAST') arrow(s, sx, sy, sx + 18 * nx, sy - 18 * ny, s.role('sail'));
    s.stroke([cx, cy, sx, sy], { color: pal.dim, glow: 0, dash: [1, 5] });
    fitLabel(s, { x: box.x, y: box.y, w: lw, h: box.h }, `${law}  DAY ${Math.round((ph * (a.tk[a.tk.length - 1] ?? 0)) / DAY)}`, box.x + 4, box.y + 4, pal.dim, 7);

    // Right: dv built against time.
    const ib: Box = { x: box.x + lw + 8, y: box.y + 18, w: box.w - lw - 14, h: box.h - 40 };
    const tEnd = Math.max(1, a.tk[a.tk.length - 1] ?? 1);
    const dvMax = Math.max(100, a.dv[a.dv.length - 1] ?? 0);
    const IX = (tt: number): number => ib.x + (tt / tEnd) * ib.w;
    const IY = (d: number): number => ib.y + ib.h - (d / dvMax) * ib.h;
    s.stroke([ib.x, ib.y, ib.x, ib.y + ib.h, ib.x + ib.w, ib.y + ib.h], { color: pal.dim, glow: 0 });
    const curve: number[] = [];
    for (let i = 0; i < a.dv.length; i++) curve.push(IX(a.tk[i] ?? 0), IY(a.dv[i] ?? 0));
    s.stroke(curve, { color: s.role('sail'), glow: 0.4 });
    // Marker in step with the sail (interpolated between chunk boundaries).
    const u = ph * (a.dv.length - 1);
    const i0 = Math.min(a.dv.length - 2, Math.floor(u));
    const fr = u - i0;
    const dNow = i0 >= 0 ? (a.dv[i0] ?? 0) * (1 - fr) + (a.dv[i0 + 1] ?? 0) * fr : 0;
    s.circle(IX(ph * tEnd), IY(dNow), 3, { color: pal.hot, glow: 0.8 });
    fitLabel(s, box, 'DV BUILT (KM/S)', ib.x, box.y + 4, pal.dim, 7);
    fitLabel(s, box, `${fmt(dNow / 1000)}`, ib.x + 4, ib.y + 2, pal.hot, 8);
    fitLabel(s, box, `TIME -> ${fmt(tEnd / YEAR)} YR`, ib.x, ib.y + ib.h + 6, pal.dim, 7);
  },
};
