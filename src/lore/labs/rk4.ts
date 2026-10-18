// WHAT: LAB_RK4: Euler and RK4 integrate the same orbit with the same step; Euler spirals off the Kepler
//       ellipse while RK4 holds it, three dots racing around; an inset plots energy error against step size.
// WHY:  EDUCATION O13: the game integrates thrust arcs numerically. The method matters more than the step:
//       Euler's error shrinks like h, RK4's like h^4, so RK4 at a 6 h step beats Euler at one minute.
// HOW:  integrate with eulerStep or rk4Step (src/physics/integrate.ts) on gravityDeriv, or on gravity plus a
//       constant tangential push when thrust is on. Reference: the exact Kepler solution (propagate) without
//       thrust, RK4 at REF_STEP with it. Paths are recorded at about PATH_POINTS evenly spaced times and
//       cached by the rounded sliders; the energy-error sweep (specificEnergy after one orbit for steps of
//       1 h .. 256 h) is cached per eccentricity. A frame only interpolates the cached paths.
// LORE: O13 (integration), O6 (Kepler)

import { AU, DAY, MU_SUN, YEAR } from '../../physics/constants';
import { eulerStep, gravityDeriv, integrate, rk4Step, type Deriv, type State4, type Stepper } from '../../physics/integrate';
import { orbitPoints, period, propagate, specificEnergy, type Elements } from '../../physics/kepler';
import { fmt, type Box, type Lab } from './lab';
import { along, fitLabel, keyOf, loop, Memo } from './kit';

/** NOTE: lab constants: orbit size, how many orbits, the thrust level, the reference step, path resolution. */
const A = AU;
const ORBITS = 3;
const THRUST = 2e-5;
const REF_STEP = 1800;
const PATH_POINTS = 600;
const SWEEP_H = [1, 2, 4, 8, 16, 32, 64, 128, 256];

function start(e: number): State4 {
  const rp = A * (1 - e);
  return [rp, 0, 0, Math.sqrt((MU_SUN * (1 + e)) / rp)];
}

function deriv(thrust: boolean): Deriv {
  const g = gravityDeriv(MU_SUN);
  if (!thrust) return g;
  return (t, s) => {
    const d = g(t, s);
    const vm = Math.hypot(s[2], s[3]) || 1;
    return [d[0], d[1], d[2] + (THRUST * s[2]) / vm, d[3] + (THRUST * s[3]) / vm];
  };
}

interface Path {
  pts: Float64Array;
  end: State4;
}

function run(stepper: Stepper, h: number, e: number, thrust: boolean): Path {
  const T = ORBITS * period(MU_SUN, A);
  const every = Math.max(1, Math.round(T / h / PATH_POINTS));
  const out: number[] = [];
  let i = 0;
  const end = integrate(deriv(thrust), start(e), 0, T, h, stepper, (_t, s) => {
    if (i++ % every === 0) out.push(s[0], s[1]);
  });
  out.push(end[0], end[1]);
  return { pts: Float64Array.from(out), end };
}

interface Scene {
  euler: Path;
  rk4: Path;
  ref: Path | null;
  el: Elements;
}

const scenes = new Memo<Scene>(10);
const sweeps = new Memo<{ euler: number[]; rk4: number[] }>(8);

function scene(v: Record<string, number>): Scene {
  const h = (v.h ?? 24) * 3600;
  const e = v.e ?? 0.5;
  const thrust = (v.thrust ?? 0) >= 0.5;
  return scenes.get(keyOf(h, e, thrust ? 1 : 0), () => ({
    euler: run(eulerStep, h, e, thrust),
    rk4: run(rk4Step, h, e, thrust),
    ref: thrust ? run(rk4Step, REF_STEP, e, true) : null,
    el: { a: A, e, w: 0, M0: 0, t0: 0 },
  }));
}

/** |E_end - E_0| / |E_0| after one orbit, thrust off, for each sweep step: Euler and RK4. */
function sweep(e: number): { euler: number[]; rk4: number[] } {
  return sweeps.get(keyOf(e), () => {
    const T = period(MU_SUN, A);
    const s0 = start(e);
    const E0 = specificEnergy(MU_SUN, Math.hypot(s0[0], s0[1]), Math.hypot(s0[2], s0[3]));
    const err = (st: Stepper, hh: number): number => {
      const s = integrate(gravityDeriv(MU_SUN), s0, 0, T, hh * 3600, st);
      const E = specificEnergy(MU_SUN, Math.hypot(s[0], s[1]), Math.hypot(s[2], s[3]));
      return Number.isFinite(E) ? Math.abs((E - E0) / E0) : 10;
    };
    return { euler: SWEEP_H.map((hh) => err(eulerStep, hh)), rk4: SWEEP_H.map((hh) => err(rk4Step, hh)) };
  });
}

/** Position error at the end, m: against Kepler (thrust off) or the fine RK4 reference (thrust on). */
function endError(sc: Scene, p: Path): number {
  const T = ORBITS * period(MU_SUN, A);
  const r = sc.ref ? { x: sc.ref.end[0], y: sc.ref.end[1] } : propagate(sc.el, MU_SUN, T).r;
  const d = Math.hypot(p.end[0] - r.x, p.end[1] - r.y);
  return Number.isFinite(d) ? d : Infinity;
}

export const lab: Lab = {
  id: 'LAB_RK4',
  title: 'EULER VS RK4: WHY THE METHOD MATTERS',
  code: ['src/physics/integrate.ts: eulerStep, rk4Step, integrate, gravityDeriv', 'src/physics/kepler.ts: propagate, specificEnergy'],
  sliders: [
    { key: 'h', label: 'step h (hours)', min: 1, max: 240, step: 1, value: 48, log: true },
    { key: 'method', label: '0 Euler 1 RK4 2 both', min: 0, max: 2, step: 1, value: 2 },
    { key: 'thrust', label: 'thrust on', min: 0, max: 1, step: 1, value: 0 },
    { key: 'e', label: 'orbit e', min: 0, max: 0.8, step: 0.05, value: 0.5 },
  ],
  lines: (v) => {
    const sc = scene(v);
    const sw = sweep(v.e ?? 0.5);
    const h = v.h ?? 24;
    // Nearest sweep step for the energy line.
    let j = 0;
    for (let i = 0; i < SWEEP_H.length; i++) if (Math.abs(Math.log((SWEEP_H[i] ?? 1) / h)) < Math.abs(Math.log((SWEEP_H[j] ?? 1) / h))) j = i;
    const eu = endError(sc, sc.euler);
    const rk = endError(sc, sc.rk4);
    const ref = sc.ref ? `RK4 at ${REF_STEP / 3600} h (thrust ${THRUST * 1000} mm/s2)` : 'Kepler';
    return [
      `Euler: s += h f(s)    RK4: s += h/6 (k1 + 2 k2 + 2 k3 + k4)    h = ${fmt(h)} h`,
      `after ${ORBITS} orbits vs ${ref}: Euler ${Number.isFinite(eu) ? fmt(eu / AU) : 'lost'} AU, RK4 ${fmt(rk / AU)} AU`,
      `energy error, 1 orbit at h = ${SWEEP_H[j] ?? 1} h: Euler ${fmt(sw.euler[j] ?? 0, 2)}, RK4 ${fmt(sw.rk4[j] ?? 0, 2)}`,
      'halve h: Euler error about halves (order 1), RK4 drops 16 x or more (order 4)',
    ];
  },
  draw: (s, v, box, t = 0) => {
    const sc = scene(v);
    const pal = s.palette;
    const method = Math.round(v.method ?? 2);
    s.stroke([box.x, box.y, box.x + box.w, box.y, box.x + box.w, box.y + box.h, box.x, box.y + box.h], { closed: true, color: pal.dim, glow: 0 });
    const lw = Math.min(box.h, box.w * 0.6);
    const ob: Box = { x: box.x, y: box.y, w: lw, h: box.h };
    const e = v.e ?? 0.5;
    const R = (1.1 + ((v.thrust ?? 0) >= 0.5 ? 0.5 : 0)) * AU;
    const k = (lw - 12) / (2 * R);
    // Kepler ellipse has its centre at -a e: shift so the orbit is centred in the panel.
    const cx = ob.x + lw / 2 + A * e * k;
    const cy = ob.y + box.h / 2;
    const SX = (x: number): number => cx + x * k;
    const SY = (y: number): number => cy - y * k;
    const inside = (x: number, y: number): boolean => x >= ob.x && x <= ob.x + ob.w && y >= ob.y && y <= ob.y + ob.h;
    const path = (pts: Float64Array, color: string, upto: number, dash?: readonly number[]): void => {
      const buf: number[] = [];
      const n = Math.min(pts.length / 2, upto);
      for (let i = 0; i < n; i++) {
        const x = SX(pts[2 * i] ?? NaN);
        const y = SY(pts[2 * i + 1] ?? NaN);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !inside(x, y)) {
          if (buf.length >= 4) s.stroke(buf, { color, glow: 0.4, ...(dash ? { dash } : {}) });
          buf.length = 0;
          continue;
        }
        buf.push(x, y);
      }
      if (buf.length >= 4) s.stroke(buf, { color, glow: 0.4, ...(dash ? { dash } : {}) });
    };
    s.circle(cx, cy, 3, { color: s.role('star'), glow: 1 });
    const kp = orbitPoints(sc.el, 120);
    const kb: number[] = [];
    for (let i = 0; i < kp.length; i += 2) kb.push(SX(kp[i] ?? 0), SY(kp[i + 1] ?? 0));
    s.stroke(kb, { color: s.role('orbit'), glow: 0.2, closed: true, dash: [1, 3] });
    const f = Math.min(1, loop(t, 9) * 1.1);
    const T = ORBITS * period(MU_SUN, A);
    if (sc.ref) path(sc.ref.pts, pal.dim, Infinity);
    const nE = sc.euler.pts.length / 2;
    const nR = sc.rk4.pts.length / 2;
    const dot = (p: Float64Array, color: string, r: number): void => {
      const [x, y] = along(p, f);
      const X = SX(x);
      const Y = SY(y);
      if (Number.isFinite(X) && Number.isFinite(Y) && inside(X, Y)) s.circle(X, Y, r, { color, glow: 1 });
    };
    if (method !== 1) {
      path(sc.euler.pts, s.role('danger'), Math.ceil(f * (nE - 1)) + 1, [3, 3]);
      dot(sc.euler.pts, s.role('danger'), 3);
    }
    if (method !== 0) {
      path(sc.rk4.pts, s.role('craft'), Math.ceil(f * (nR - 1)) + 1);
      dot(sc.rk4.pts, s.role('craft'), 2.5);
    }
    // The exact answer (Kepler or the fine reference) as a ring marker.
    if (sc.ref) {
      const [x, y] = along(sc.ref.pts, f);
      s.circle(SX(x), SY(y), 5, { color: pal.ink, glow: 0.2 });
    } else {
      const st = propagate(sc.el, MU_SUN, f * T);
      s.circle(SX(st.r.x), SY(st.r.y), 5, { color: pal.ink, glow: 0.2 });
    }
    fitLabel(s, ob, `DAY ${Math.round((f * T) / DAY)}   RING: ${sc.ref ? 'FINE RK4' : 'KEPLER'}`, ob.x + 4, ob.y + 4, pal.dim, 7);
    fitLabel(s, ob, 'DASH EULER  SOLID RK4', ob.x + 4, ob.y + ob.h - 12, pal.dim, 7);

    // Right: log-log energy error against step.
    const sw = sweep(e);
    const ib: Box = { x: box.x + lw + 8, y: box.y + 18, w: box.w - lw - 14, h: box.h - 40 };
    const lo = -15;
    const hi = 1;
    const IX = (hh: number): number => ib.x + (Math.log10(hh) / Math.log10(256)) * ib.w;
    const IY = (err: number): number => ib.y + ib.h - ((Math.max(lo, Math.min(hi, Math.log10(Math.max(1e-16, err)))) - lo) / (hi - lo)) * ib.h;
    s.stroke([ib.x, ib.y, ib.x, ib.y + ib.h, ib.x + ib.w, ib.y + ib.h], { color: pal.dim, glow: 0 });
    const curve = (vals: number[], color: string, dash?: readonly number[]): void => {
      const b: number[] = [];
      SWEEP_H.forEach((hh, i) => b.push(IX(hh), IY(vals[i] ?? 1)));
      s.stroke(b, { color, glow: 0.4, ...(dash ? { dash } : {}) });
    };
    curve(sw.euler, s.role('danger'), [3, 3]);
    curve(sw.rk4, s.role('craft'));
    const hx = IX(Math.max(1, Math.min(256, v.h ?? 24)));
    s.stroke([hx, ib.y, hx, ib.y + ib.h], { color: pal.hot, glow: 0.5, dash: [2, 2] });
    fitLabel(s, box, 'ENERGY ERROR, 1 ORBIT', ib.x, box.y + 4, pal.dim, 7);
    fitLabel(s, box, '1', ib.x + 2, IY(1) + 2, pal.dim, 6);
    fitLabel(s, box, '1E-15', ib.x + 2, IY(1e-15) - 9, pal.dim, 6);
    fitLabel(s, box, 'H 1 .. 256 HOURS', ib.x, ib.y + ib.h + 6, pal.dim, 7);
  },
};
