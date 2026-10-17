// WHAT: The porkchop grid: Lambert transfers from HOME over a launch x arrival grid (GAME_PLAN 6.6).
// WHY:  Every kinetic plan is a cell of this grid: launch date, arrival date, departure energy (what the
//       launcher must do), payload mass (what it can carry) and closing speed (what the impact delivers).
//       Computed in the worker so the screen never stalls; this module is pure so tests run it directly.
// HOW:  Steps are the larger of PORKCHOP_STEP and lead / PORKCHOP_MAX_AXIS so a 12-year lead still fits in
//       about 110 x 110 cells. Results are flat typed arrays indexed [iL * nA + iA] for cheap postMessage.
// LORE: O10 (A to B), G3 (the planner)

import { KNOBS } from '../config/knobs';
import { c3FromVinf, payloadForC3, type LauncherTier } from '../physics/estimates';
import { propagate, type Elements } from '../physics/kepler';
import { lambert } from '../physics/lambert';

export interface PorkchopRequest {
  home: Elements;
  threat: Elements;
  muSun: number;
  /** Earliest launch, s (now + build time). */
  tMin: number;
  /** Nominal impact epoch, s. */
  tImpact: number;
  tier: LauncherTier;
}

export interface PorkchopGrid {
  nL: number;
  nA: number;
  tL0: number;
  tA0: number;
  step: number;
  /** Per cell; NaN where infeasible or degenerate. */
  c3: Float64Array;
  payload: Float64Array;
  U: Float64Array;
  v1x: Float64Array;
  v1y: Float64Array;
  v2x: Float64Array;
  v2y: Float64Array;
  /** Threat position at arrival, m. */
  rx: Float64Array;
  ry: Float64Array;
  feasible: number;
}

export function cellIndex(g: PorkchopGrid, iL: number, iA: number): number {
  return iL * g.nA + iA;
}

export function cellTimes(g: PorkchopGrid, iL: number, iA: number): { tL: number; tA: number } {
  return { tL: g.tL0 + iL * g.step, tA: g.tA0 + iA * g.step };
}

export function computePorkchop(req: PorkchopRequest): PorkchopGrid {
  const lead = req.tImpact - req.tMin;
  const step = Math.max(KNOBS.PORKCHOP_STEP, lead / KNOBS.PORKCHOP_MAX_AXIS);
  const tL0 = req.tMin;
  const tLmax = req.tImpact - KNOBS.PORKCHOP_MIN_FLIGHT - KNOBS.PORKCHOP_RESOLVE_MARGIN;
  const tA0 = tL0 + KNOBS.PORKCHOP_MIN_FLIGHT;
  const tAmax = req.tImpact - KNOBS.PORKCHOP_RESOLVE_MARGIN;
  const nL = Math.max(0, Math.floor((tLmax - tL0) / step) + 1);
  const nA = Math.max(0, Math.floor((tAmax - tA0) / step) + 1);
  const n = nL * nA;
  const g: PorkchopGrid = {
    nL, nA, tL0, tA0, step,
    c3: new Float64Array(n).fill(NaN),
    payload: new Float64Array(n).fill(NaN),
    U: new Float64Array(n).fill(NaN),
    v1x: new Float64Array(n), v1y: new Float64Array(n), v2x: new Float64Array(n), v2y: new Float64Array(n),
    rx: new Float64Array(n), ry: new Float64Array(n),
    feasible: 0,
  };
  const homeStates = [];
  for (let iL = 0; iL < nL; iL++) homeStates.push(propagate(req.home, req.muSun, tL0 + iL * step));
  const threatStates = [];
  for (let iA = 0; iA < nA; iA++) threatStates.push(propagate(req.threat, req.muSun, tA0 + iA * step));

  for (let iL = 0; iL < nL; iL++) {
    const hs = homeStates[iL];
    if (!hs) continue;
    const tL = tL0 + iL * step;
    for (let iA = 0; iA < nA; iA++) {
      const tA = tA0 + iA * step;
      const dt = tA - tL;
      if (dt < KNOBS.PORKCHOP_MIN_FLIGHT) continue;
      const ts = threatStates[iA];
      if (!ts) continue;
      const sol = lambert(hs.r, ts.r, dt, req.muSun);
      if (!sol) continue;
      const i = iL * nA + iA;
      const vinf = Math.hypot(sol.v1.x - hs.v.x, sol.v1.y - hs.v.y);
      const c3 = c3FromVinf(vinf);
      const payload = payloadForC3(req.tier, c3);
      g.c3[i] = c3;
      g.payload[i] = payload;
      g.U[i] = Math.hypot(sol.v2.x - ts.v.x, sol.v2.y - ts.v.y);
      g.v1x[i] = sol.v1.x;
      g.v1y[i] = sol.v1.y;
      g.v2x[i] = sol.v2.x;
      g.v2y[i] = sol.v2.y;
      g.rx[i] = ts.r.x;
      g.ry[i] = ts.r.y;
      if (payload > 0) g.feasible++;
    }
  }
  return g;
}
