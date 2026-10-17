// WHAT: SAIL_KINETIC search: launch, sail for a while, drop the sail, Lambert-match the intercept.
// WHY:  GAME_PLAN 7.2: "sail arc to build U, drop sail, hit". The sail does the work a big launcher would.
// HOW:  Grid over launch date (SAIL_SEARCH_LAUNCH_STEPS) and arc duration (SAIL_ARC_YEARS). Departure is
//       HOME's state plus a small v_inf along its velocity (SAIL_DEPARTURE_VINF, so C3 is cheap). The arc
//       is integrated with the control law (SPIRAL_OUT, or TARGET_STEER toward the best intercept point
//       for sail tier >= 2). From the arc's end state every arrival date is tried with a Lambert; the
//       departure mismatch |v1 - v_end| must fit the DSM budget. Impactor mass = payload (1 - sail fraction).
// LORE: D7 (sails), O10 (A to B), G3 (the planner)

import { KNOBS } from '../config/knobs';
import { YEAR } from '../physics/constants';
import { c3FromVinf, payloadForC3, type LauncherTier } from '../physics/estimates';
import { propagate, type Elements } from '../physics/kepler';
import { lambert } from '../physics/lambert';
import { characteristicAccel, integrateSail, sailTier, type SailLaw } from '../physics/sail';
import type { Vec2 } from '../util/vec';

export interface SailRequest {
  home: Elements;
  threat: Elements;
  muSun: number;
  tMin: number;
  tImpact: number;
  tier: LauncherTier;
  sailTier: number;
  dsmBudget: number;
}

export interface SailCell {
  tL: number;
  tS: number;
  tA: number;
  law: SailLaw;
  c3: number;
  payload: number;
  /** Impactor (bus) mass after the sail is dropped. */
  impactorKg: number;
  dvEquiv: number;
  dsm: number;
  U: number;
  v1: Vec2;
  v2: Vec2;
  rThreat: Vec2;
  samples: Float64Array;
}

export interface SailResult {
  cells: SailCell[];
  arcsTried: number;
}

export function sailSearch(req: SailRequest): SailResult {
  const spec = sailTier(req.sailTier);
  const aC = characteristicAccel(spec.sigma, spec.eta);
  const frac = KNOBS.SAIL_TIERS.find((t) => t.tier === req.sailTier)?.massFraction ?? 0.3;
  const law: SailLaw = req.sailTier >= 2 ? 'TARGET_STEER' : 'SPIRAL_OUT';
  const c3 = c3FromVinf(KNOBS.SAIL_DEPARTURE_VINF);
  const payload = payloadForC3(req.tier, c3);
  const cells: SailCell[] = [];
  let arcs = 0;
  if (!(payload > 0)) return { cells, arcsTried: 0 };
  const lead = req.tImpact - req.tMin;
  const launchStep = Math.max(30 * 86400, lead / KNOBS.SAIL_SEARCH_LAUNCH_STEPS);
  const arrivalStep = Math.max(KNOBS.PORKCHOP_STEP, lead / KNOBS.PORKCHOP_MAX_AXIS);
  const tAmax = req.tImpact - KNOBS.PORKCHOP_RESOLVE_MARGIN;

  for (let tL = req.tMin; tL < tAmax - YEAR; tL += launchStep) {
    const hs = propagate(req.home, req.muSun, tL);
    const vm = Math.hypot(hs.v.x, hs.v.y);
    const v0 = { x: hs.v.x + (hs.v.x / vm) * KNOBS.SAIL_DEPARTURE_VINF, y: hs.v.y + (hs.v.y / vm) * KNOBS.SAIL_DEPARTURE_VINF };
    for (const years of KNOBS.SAIL_ARC_YEARS) {
      const tS = tL + years * YEAR;
      if (tS + KNOBS.PORKCHOP_MIN_FLIGHT > tAmax) continue;
      // Target for steering: the threat where it will be after a typical post-sail coast.
      const tGuess = Math.min(tAmax, tS + 0.5 * YEAR);
      const target = { r: propagate(req.threat, req.muSun, tGuess).r, t: tGuess };
      const arc = integrateSail([hs.r.x, hs.r.y, v0.x, v0.y], tL, tS, aC, req.muSun, law, target);
      arcs++;
      const rEnd = { x: arc.state[0], y: arc.state[1] };
      const vEnd = { x: arc.state[2], y: arc.state[3] };
      let best: SailCell | null = null;
      for (let tA = tS + KNOBS.PORKCHOP_MIN_FLIGHT; tA <= tAmax; tA += arrivalStep) {
        const ts = propagate(req.threat, req.muSun, tA);
        const sol = lambert(rEnd, ts.r, tA - tS, req.muSun);
        if (!sol) continue;
        const dsm = Math.hypot(sol.v1.x - vEnd.x, sol.v1.y - vEnd.y);
        if (dsm > req.dsmBudget) continue;
        const U = Math.hypot(sol.v2.x - ts.v.x, sol.v2.y - ts.v.y);
        // Prefer the fastest closing speed that still fits the budget.
        if (!best || U > best.U) {
          best = { tL, tS, tA, law, c3, payload, impactorKg: payload * (1 - frac), dvEquiv: arc.dvEquiv, dsm, U, v1: sol.v1, v2: sol.v2, rThreat: ts.r, samples: arc.samples };
        }
      }
      if (best) cells.push(best);
    }
  }
  return { cells, arcsTried: arcs };
}
