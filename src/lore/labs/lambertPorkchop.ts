// WHAT: LAB_LAMBERT_PORKCHOP: the planner's real porkchop grid (launch day x arrival day) as C3 or U contour
//       lines, a picked cell, and that cell's Lambert arc flown live by a craft dot from HOME to the target.
// WHY:  EDUCATION O10 and G3: every kinetic plan is one cell of this map. Seeing the contours and the arc
//       together shows why some launch dates are cheap and others impossible.
// HOW:  computePorkchop (src/planner/porkchop.ts, which calls lambert for every cell) on the slider scenario,
//       cached by the rounded slider values (about 40 to 70 cells a side, 20 to 60 ms once, then free).
//       Contours by marching squares (kit.ts). The picked cell's departure state goes through stateToElements
//       to a transfer orbit; the craft, HOME and the target are propagated to an animated time between launch
//       and arrival, so the three dots meet at the end of each loop.
// LORE: O10 (A to B), G3 (the planner)

import { AU, DAY, MU_SUN } from '../../physics/constants';
import { stateToElements } from '../../physics/elements';
import { launcherTier } from '../../physics/estimates';
import { orbitPoints, propagate, type Elements } from '../../physics/kepler';
import { computePorkchop, type PorkchopGrid } from '../../planner/porkchop';
import { fmt, type Box, type Lab } from './lab';
import { arrow, contourSegments, fitLabel, keyOf, loop, Memo, roleDash, segments } from './kit';

/** NOTE: lab scenario constants (not game balance): HOME circular at 1 AU, target periapsis direction and phase. */
const HOME: Elements = { a: AU, e: 0, w: 0, M0: 0, t0: 0 };
const TARGET_W = 1.0;
const TARGET_M0 = 2.0;
const LAUNCHER = 2;
const C3_LEVELS = [10, 20, 40, 60, 100];
const U_LEVELS = [5, 10, 15, 20, 30];

interface Scene {
  target: Elements;
  grid: PorkchopGrid;
  /** Contours per level in grid coordinates (iL, iA), C3 and U, plus the payload > 0 boundary. */
  c3Lines: number[][];
  uLines: number[][];
  feasLine: number[];
  best: number;
}

const scenes = new Memo<Scene>(10);

function scene(v: Record<string, number>): Scene {
  const open = v.open ?? 0;
  const span = v.span ?? 500;
  const a = v.a ?? 1.4;
  const e = v.e ?? 0.2;
  return scenes.get(keyOf(open, span, a, e), () => {
    const target: Elements = { a: a * AU, e, w: TARGET_W, M0: TARGET_M0, t0: 0 };
    const grid = computePorkchop({ home: HOME, threat: target, muSun: MU_SUN, tMin: open * DAY, tImpact: (open + span) * DAY, tier: launcherTier(LAUNCHER) });
    const pay = new Float64Array(grid.payload.length);
    let best = -1;
    for (let i = 0; i < pay.length; i++) {
      const p = grid.payload[i] ?? NaN;
      pay[i] = Number.isFinite(p) ? p : 0;
      const c = grid.c3[i] ?? NaN;
      if (Number.isFinite(c) && (best < 0 || c < (grid.c3[best] ?? Infinity))) best = i;
    }
    return {
      target,
      grid,
      c3Lines: C3_LEVELS.map((L) => contourSegments(grid.c3, grid.nL, grid.nA, L)),
      uLines: U_LEVELS.map((L) => contourSegments(grid.U, grid.nL, grid.nA, L * 1000)),
      feasLine: contourSegments(pay, grid.nL, grid.nA, 0.5),
      best,
    };
  });
}

interface Pick {
  i: number;
  iL: number;
  iA: number;
  tL: number;
  tA: number;
  ok: boolean;
}

function pick(sc: Scene, v: Record<string, number>): Pick {
  const g = sc.grid;
  const iL = Math.max(0, Math.min(g.nL - 1, Math.round(((v.pickL ?? 50) / 100) * (g.nL - 1))));
  const iA = Math.max(0, Math.min(g.nA - 1, Math.round(((v.pickA ?? 50) / 100) * (g.nA - 1))));
  const i = iL * g.nA + iA;
  return { i, iL, iA, tL: g.tL0 + iL * g.step, tA: g.tA0 + iA * g.step, ok: Number.isFinite(g.c3[i] ?? NaN) };
}

/** Transfer orbit of the picked cell (cached with the scene key plus the cell). */
const arcs = new Memo<{ el: Elements | null; pts: Float64Array }>(16);
function transfer(sc: Scene, p: Pick, key: string): { el: Elements | null; pts: Float64Array } {
  return arcs.get(`${key}#${p.i}`, () => {
    if (!p.ok) return { el: null, pts: new Float64Array(0) };
    const g = sc.grid;
    const hs = propagate(HOME, MU_SUN, p.tL);
    try {
      const el = stateToElements(hs.r, { x: g.v1x[p.i] ?? 0, y: g.v1y[p.i] ?? 0 }, MU_SUN, p.tL, true);
      const n = 48;
      const pts = new Float64Array(n * 2);
      for (let k = 0; k < n; k++) {
        const st = propagate(el, MU_SUN, p.tL + ((p.tA - p.tL) * k) / (n - 1));
        pts[2 * k] = st.r.x;
        pts[2 * k + 1] = st.r.y;
      }
      return { el, pts };
    } catch {
      return { el: null, pts: new Float64Array(0) };
    }
  });
}

export const lab: Lab = {
  id: 'LAB_LAMBERT_PORKCHOP',
  title: 'PORKCHOP: LAMBERT ARCS ON A GRID',
  code: ['src/planner/porkchop.ts: computePorkchop', 'src/physics/lambert.ts: lambert', 'src/physics/estimates.ts: c3FromVinf, payloadForC3', 'src/physics/elements.ts: stateToElements'],
  sliders: [
    { key: 'open', label: 'window opens (d)', min: 0, max: 720, step: 30, value: 0 },
    { key: 'span', label: 'window + flight (d)', min: 300, max: 720, step: 30, value: 480 },
    { key: 'a', label: 'target a (AU)', min: 0.7, max: 2.5, step: 0.05, value: 1.4 },
    { key: 'e', label: 'target e', min: 0, max: 0.6, step: 0.05, value: 0.25 },
    { key: 'pickL', label: 'pick launch (%)', min: 0, max: 100, step: 2, value: 38 },
    { key: 'pickA', label: 'pick arrival (%)', min: 0, max: 100, step: 2, value: 98 },
    { key: 'map', label: 'map: 0 C3, 1 U', min: 0, max: 1, step: 1, value: 0 },
  ],
  lines: (v) => {
    const sc = scene(v);
    const g = sc.grid;
    const p = pick(sc, v);
    const out: string[] = [];
    if (p.ok) {
      const c3 = g.c3[p.i] ?? 0;
      out.push(`cell: launch day ${fmt(p.tL / DAY)}, arrive day ${fmt(p.tA / DAY)}, flight ${fmt((p.tA - p.tL) / DAY)} d`);
      out.push(`C3 = |v1 - v_home|^2 = ${fmt(c3)} km2/s2   payload (tier ${LAUNCHER}) = ${fmt(g.payload[p.i] ?? 0)} kg`);
      out.push(`U = |v2 - v_target| = ${fmt((g.U[p.i] ?? 0) / 1000)} km/s at the target`);
    } else {
      out.push(`cell: launch day ${fmt(p.tL / DAY)}, arrive day ${fmt(p.tA / DAY)}: no transfer here`);
      out.push('lambert needs flight >= 30 d and a transfer angle away from 0 and 180 deg');
    }
    if (sc.best >= 0) {
      const bL = Math.floor(sc.best / g.nA);
      const bA = sc.best % g.nA;
      out.push(`grid ${g.nL} x ${g.nA}, ${g.feasible} flyable; min C3 ${fmt(g.c3[sc.best] ?? 0)} at day ${fmt((g.tL0 + bL * g.step) / DAY)}, ${fmt(((bA - bL) * g.step + g.tA0 - g.tL0) / DAY)} d`);
    } else out.push(`grid ${g.nL} x ${g.nA}: no transfer at all in this window`);
    return out;
  },
  draw: (s, v, box, t = 0) => {
    const sc = scene(v);
    const g = sc.grid;
    const p = pick(sc, v);
    const key = keyOf(v.open ?? 0, v.span ?? 0, v.a ?? 0, v.e ?? 0);
    const pal = s.palette;
    s.stroke([box.x, box.y, box.x + box.w, box.y, box.x + box.w, box.y + box.h, box.x, box.y + box.h], { closed: true, color: pal.dim, glow: 0 });

    // Left: the map. Launch day runs right, arrival day runs up.
    const side = Math.min(box.h - 30, box.w * 0.48);
    const mb: Box = { x: box.x + 8, y: box.y + 16, w: side, h: side };
    const X = (iL: number): number => mb.x + (g.nL > 1 ? iL / (g.nL - 1) : 0) * mb.w;
    const Y = (iA: number): number => mb.y + mb.h - (g.nA > 1 ? iA / (g.nA - 1) : 0) * mb.h;
    s.stroke([mb.x, mb.y, mb.x + mb.w, mb.y, mb.x + mb.w, mb.y + mb.h, mb.x, mb.y + mb.h], { closed: true, color: pal.dim, glow: 0 });
    const useU = (v.map ?? 0) >= 0.5;
    const levels = useU ? sc.uLines : sc.c3Lines;
    const toScreen = (gl: readonly number[]): number[] => {
      const o = new Array<number>(gl.length);
      for (let k = 0; k < gl.length; k += 2) {
        o[k] = X(gl[k] ?? 0);
        o[k + 1] = Y(gl[k + 1] ?? 0);
      }
      return o;
    };
    levels.forEach((gl, k) => segments(s, toScreen(gl), k === 0 ? pal.hot : useU ? s.role('danger') : s.role('craft'), k % 2 === 1 ? [3, 3] : undefined));
    segments(s, toScreen(sc.feasLine), s.role('program'), roleDash('program') ?? [4, 2]);
    fitLabel(s, box, `${useU ? 'U' : 'C3'} CONTOURS ${(useU ? U_LEVELS : C3_LEVELS).join(' ')}${useU ? ' KM/S' : ''}`, mb.x, box.y + 4, pal.dim, 7);
    fitLabel(s, mb, 'LAUNCH ->', mb.x + mb.w - 52, mb.y + mb.h - 11, pal.dim, 7);
    fitLabel(s, mb, 'ARRIVE ^', mb.x + 3, mb.y + 3, pal.dim, 7);
    // Best cell ring, picked cell cross (pulsing while the craft flies).
    if (sc.best >= 0) s.circle(X(Math.floor(sc.best / g.nA)), Y(sc.best % g.nA), 5, { color: pal.ink, glow: 0.3 });
    const px = X(p.iL);
    const py = Y(p.iA);
    const pulse = 4 + 2 * Math.sin(t * 6);
    s.stroke([px - pulse, py, px + pulse, py], { color: pal.hot, glow: 0.8 });
    s.stroke([px, py - pulse, px, py + pulse], { color: pal.hot, glow: 0.8 });
    fitLabel(s, box, 'RING: MIN C3   DASH: FLYABLE EDGE', mb.x, mb.y + mb.h + 4, pal.dim, 7);

    // Right: the orbits and the arc.
    const ob: Box = { x: mb.x + mb.w + 10, y: box.y + 6, w: box.x + box.w - (mb.x + mb.w + 10) - 6, h: box.h - 12 };
    const tq = (1 + sc.target.e) * sc.target.a;
    const R = Math.max(1.15 * AU, tq * 1.08);
    const sc2 = Math.min(ob.w, ob.h) / (2 * R);
    const cx = ob.x + ob.w / 2;
    const cy = ob.y + ob.h / 2;
    const SX = (x: number): number => cx + x * sc2;
    const SY = (y: number): number => cy - y * sc2;
    const ring = (pts: Float64Array, color: string, dash?: readonly number[], closed = true): void => {
      const buf = new Array<number>(pts.length);
      for (let k = 0; k < pts.length; k += 2) {
        buf[k] = SX(pts[k] ?? 0);
        buf[k + 1] = SY(pts[k + 1] ?? 0);
      }
      s.stroke(buf, { color, glow: 0.3, closed, ...(dash ? { dash } : {}) });
    };
    s.circle(cx, cy, 3, { color: s.role('star'), glow: 0.8 });
    ring(orbitPoints(HOME, 72), s.role('orbit'), [2, 4]);
    ring(orbitPoints(sc.target, 96), s.role('threat'));
    const tr = transfer(sc, p, key);
    const f = loop(t, 5);
    const tau = p.tL + f * (p.tA - p.tL);
    const hs = propagate(HOME, MU_SUN, p.ok ? tau : p.tL);
    const ts = propagate(sc.target, MU_SUN, p.ok ? tau : p.tA);
    s.circle(SX(hs.r.x), SY(hs.r.y), 4, { color: s.role('planet'), glow: 0.6 });
    s.circle(SX(ts.r.x), SY(ts.r.y), 3, { color: s.role('threat'), glow: 0.6 });
    if (tr.el && tr.pts.length >= 4) {
      ring(tr.pts, pal.dim, [2, 3], false);
      // The flown part, bright, up to the craft.
      const n = tr.pts.length / 2;
      const upto = Math.max(2, Math.ceil(f * (n - 1)) + 1);
      ring(tr.pts.subarray(0, upto * 2), s.role('craft'), undefined, false);
      const cs = propagate(tr.el, MU_SUN, tau);
      s.circle(SX(cs.r.x), SY(cs.r.y), 2.5, { color: s.role('craft'), glow: 1 });
      // Departure excess velocity arrow at HOME's launch position (direction only).
      const h0 = propagate(HOME, MU_SUN, p.tL);
      const dvx = (g.v1x[p.i] ?? 0) - h0.v.x;
      const dvy = (g.v1y[p.i] ?? 0) - h0.v.y;
      const dm = Math.hypot(dvx, dvy) || 1;
      arrow(s, SX(h0.r.x), SY(h0.r.y), SX(h0.r.x) + (18 * dvx) / dm, SY(h0.r.y) - (18 * dvy) / dm, s.role('craft'));
      fitLabel(s, ob, `DAY ${Math.round(tau / DAY)}`, ob.x + 2, ob.y + 2, pal.dim, 7);
    } else fitLabel(s, ob, 'NO TRANSFER IN THIS CELL', ob.x + 2, ob.y + 2, pal.hot, 7);
  },
};
