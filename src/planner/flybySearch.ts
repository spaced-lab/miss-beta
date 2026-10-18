// WHAT: Two-leg gravity-assist search (GAME_PLAN 6.7 "multi-leg planning, v1 approach, simple and honest").
// WHY:  A flyby plan is two Lambert arcs joined at a planet: HOME -> planet -> threat. The planet rotates
//       the excess velocity for free; onboard dv covers the mismatch in magnitude. The search finds the
//       cells where that mismatch fits the DSM budget and the turn fits the planet.
// HOW:  Three coarse axes (launch tL, flyby tF, arrival tA) with step the larger of FLYBY_STEP and
//       lead / FLYBY_MAX_AXIS. Leg 1 is a table over (tL, tF), leg 2 a table over (tF, tA); combining
//       them is arithmetic. For each (tL, tA) the cheapest feasible tF is kept. Payload comes from the
//       departure C3 of leg 1; U from leg 2's arrival. Output is a sparse list of FlybyCells plus the
//       FLYBY WINDOWS summary (feasible tF per planet).
// LORE: O11 (gravity assists), O10 (A to B), G3 (the planner)

import { KNOBS } from '../config/knobs';
import { c3FromVinf, payloadForC3, type LauncherTier } from '../physics/estimates';
import { signedAngle, turnAngleMax } from '../physics/flyby';
import { propagate, type Elements } from '../physics/kepler';
import { lambert } from '../physics/lambert';
import type { Vec2 } from '../util/vec';

export interface FlybyPlanet {
  id: string;
  mu: number;
  radius: number;
  elements: Elements;
}

export interface FlybyRequest {
  home: Elements;
  threat: Elements;
  planets: FlybyPlanet[];
  muSun: number;
  tMin: number;
  tImpact: number;
  tier: LauncherTier;
  /** Free departure energy from programs (ORBITAL_DEPOT, LUNAR_MASS_DRIVER), km^2/s^2: payload is read at C3 - bonus. */
  c3Bonus?: number;
  /** Onboard dv available for the mismatch, m/s. */
  dsmBudget: number;
}

export interface FlybyCell {
  planetId: string;
  tL: number;
  tF: number;
  tA: number;
  c3: number;
  payload: number;
  /** Mismatch covered by onboard dv, m/s. */
  dsm: number;
  delta: number;
  side: 1 | -1;
  rP: number;
  dvHelio: number;
  U: number;
  v1: Vec2;
  /** Heliocentric velocity leaving the planet (leg 2 departure). */
  vOut: Vec2;
  v2: Vec2;
  rThreat: Vec2;
  rPlanet: Vec2;
}

export interface FlybyResult {
  cells: FlybyCell[];
  /** Per planet: feasible flyby times (s) for the windows display. */
  windows: Record<string, number[]>;
  step: number;
}

export function flybySearch(req: FlybyRequest): FlybyResult {
  const lead = req.tImpact - req.tMin;
  const step = Math.max(KNOBS.FLYBY_STEP, lead / KNOBS.FLYBY_MAX_AXIS);
  const tL0 = req.tMin;
  const tAmax = req.tImpact - KNOBS.PORKCHOP_RESOLVE_MARGIN;
  const n = Math.max(0, Math.floor((tAmax - tL0) / step) + 1);
  const times: number[] = [];
  for (let i = 0; i < n; i++) times.push(tL0 + i * step);
  const homeStates = times.map((t) => propagate(req.home, req.muSun, t));
  const threatStates = times.map((t) => propagate(req.threat, req.muSun, t));
  const cells: FlybyCell[] = [];
  const windows: Record<string, number[]> = {};
  const minLeg = KNOBS.PORKCHOP_MIN_FLIGHT;

  for (const pl of req.planets) {
    const planetStates = times.map((t) => propagate(pl.elements, req.muSun, t));
    const hMin = pl.id === 'GIANT' ? KNOBS.FLYBY_HMIN_GIANT_RADII * pl.radius : KNOBS.FLYBY_HMIN_ROCKY;
    // Leg 1 table: (iL, iF) -> arrival velocity at the planet and departure C3.
    const leg1 = new Map<number, { vArr: Vec2; c3: number; payload: number; v1: Vec2 }>();
    for (let iL = 0; iL < n; iL++) {
      for (let iF = iL + 1; iF < n; iF++) {
        const dt = (iF - iL) * step;
        if (dt < minLeg) continue;
        const hs = homeStates[iL]!;
        const ps = planetStates[iF]!;
        const sol = lambert(hs.r, ps.r, dt, req.muSun);
        if (!sol) continue;
        const c3 = c3FromVinf(Math.hypot(sol.v1.x - hs.v.x, sol.v1.y - hs.v.y));
        const payload = payloadForC3(req.tier, Math.max(0, c3 - (req.c3Bonus ?? 0)));
        if (!(payload > 0)) continue;
        leg1.set(iL * n + iF, { vArr: sol.v2, c3, payload, v1: sol.v1 });
      }
    }
    // Leg 2 table: (iF, iA) -> departure velocity from the planet and arrival at the threat.
    const leg2 = new Map<number, { vDep: Vec2; v2: Vec2 }>();
    for (let iF = 0; iF < n; iF++) {
      for (let iA = iF + 1; iA < n; iA++) {
        const dt = (iA - iF) * step;
        if (dt < minLeg) continue;
        const ps = planetStates[iF]!;
        const ts = threatStates[iA]!;
        const sol = lambert(ps.r, ts.r, dt, req.muSun);
        if (!sol) continue;
        leg2.set(iF * n + iA, { vDep: sol.v1, v2: sol.v2 });
      }
    }
    const feasibleF = new Set<number>();
    const bestByLA = new Map<number, FlybyCell>();
    for (let iF = 1; iF < n - 1; iF++) {
      const ps = planetStates[iF]!;
      for (let iL = 0; iL < iF; iL++) {
        const a = leg1.get(iL * n + iF);
        if (!a) continue;
        const vinIn = { x: a.vArr.x - ps.v.x, y: a.vArr.y - ps.v.y };
        const vin = Math.hypot(vinIn.x, vinIn.y);
        if (vin <= 0) continue;
        const dMax = turnAngleMax(pl.radius, hMin, vin, pl.mu);
        for (let iA = iF + 1; iA < n; iA++) {
          const b = leg2.get(iF * n + iA);
          if (!b) continue;
          const vinOut = { x: b.vDep.x - ps.v.x, y: b.vDep.y - ps.v.y };
          const vout = Math.hypot(vinOut.x, vinOut.y);
          const mismatch = Math.abs(vout - vin);
          if (mismatch > req.dsmBudget) continue;
          const turn = signedAngle(vinIn, vinOut);
          if (Math.abs(turn) > dMax) continue;
          const ts = threatStates[iA]!;
          const U = Math.hypot(b.v2.x - ts.v.x, b.v2.y - ts.v.y);
          const key = iL * n + iA;
          const prev = bestByLA.get(key);
          if (prev && prev.dsm <= mismatch) continue;
          const vinf = vin;
          bestByLA.set(key, {
            planetId: pl.id,
            tL: times[iL]!,
            tF: times[iF]!,
            tA: times[iA]!,
            c3: a.c3,
            payload: a.payload,
            dsm: mismatch,
            delta: Math.abs(turn),
            side: turn >= 0 ? 1 : -1,
            rP: (pl.mu / (vinf * vinf)) * (1 / Math.sin(Math.max(1e-9, Math.abs(turn)) / 2) - 1),
            dvHelio: 2 * vinf * Math.sin(Math.abs(turn) / 2),
            U,
            v1: a.v1,
            vOut: b.vDep,
            v2: b.v2,
            rThreat: ts.r,
            rPlanet: ps.r,
          });
          feasibleF.add(iF);
        }
      }
    }
    windows[pl.id] = [...feasibleF].sort((x, y) => x - y).map((iF) => times[iF]!);
    for (const c of bestByLA.values()) cells.push(c);
  }
  return { cells, windows, step };
}
