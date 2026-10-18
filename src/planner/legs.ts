// WHAT: Turn search cells (flyby, sail) into Missions with flight legs.
// WHY:  The resolver only needs the arrival state, but the renderer and the log want the story: which
//       planet was passed, how far the sail spiralled, where the DSM was spent. Legs carry that.
// HOW:  Pure helpers. Coast legs store Kepler elements from the leg's departure state; sail legs store the
//       integrated samples; flyby legs the turn and the onboard dv spent on the mismatch.
// LORE: O11 (gravity assists), D7 (sails), G3 (the planner)

import { KNOBS } from '../config/knobs';
import { OrbitError, stateToElements } from '../physics/elements';
import { propagate, type Elements } from '../physics/kepler';
import type { Leg, Mission } from '../sim/mission';
import { stateAt, type V } from '../sim/orbit3';
import type { Vec2 } from '../util/vec';
import { missionCost } from './candidates';
import type { FlybyCell } from './flybySearch';
import type { SailCell } from './sailSearch';

export interface LegContext {
  home: Elements;
  muSun: number;
  launcherTier: number;
  impactorTier: number;
  committedAt: number;
  targetId: string;
}

function coast(r: Vec2, v: Vec2, mu: number, tFrom: number, tTo: number): Leg | null {
  try {
    return { kind: 'COAST', tFrom, tTo, elements: stateToElements(r, v, mu, tFrom) };
  } catch (e) {
    if (e instanceof OrbitError) return null;
    throw e;
  }
}

export function missionFromFlyby(c: FlybyCell, ctx: LegContext, id: string): Mission | null {
  const hs = propagate(ctx.home, ctx.muSun, c.tL);
  const leg1 = coast(hs.r, c.v1, ctx.muSun, c.tL, c.tF);
  const leg2 = coast(c.rPlanet, c.vOut, ctx.muSun, c.tF, c.tA);
  if (!leg1 || !leg2) return null;
  const cap = KNOBS.IMPACTOR_KG[ctx.impactorTier - 1] ?? 1000;
  return {
    id,
    archetype: 'KINETIC_FLYBY',
    launcherTier: ctx.launcherTier,
    impactorTier: ctx.impactorTier,
    launchTime: c.tL,
    arrivalTime: c.tA,
    impactorKg: Math.min(c.payload, cap),
    c3: c.c3,
    departureV: c.v1,
    arrivalV: c.v2,
    interceptR: c.rThreat,
    U: c.U,
    cost: missionCost(ctx.launcherTier, ctx.impactorTier) + 1, // NOTE: +1 for the kick stage (GAME_PLAN 9: chem stage 1)
    committedAt: ctx.committedAt,
    targetId: ctx.targetId,
    legs: [leg1, { kind: 'FLYBY', t: c.tF, planetId: c.planetId, delta: c.delta, dvHelio: c.dvHelio, dsm: c.dsm, rP: c.rP, side: c.side }, leg2],
    dsmUsed: c.dsm,
  };
}

export function missionFromSail(c: SailCell, ctx: LegContext, id: string, sailTier: number): Mission | null {
  const n = c.samples.length / 2;
  const endR = { x: c.samples[(n - 1) * 2] as number, y: c.samples[(n - 1) * 2 + 1] as number };
  const leg2 = coast(endR, c.v1, ctx.muSun, c.tS, c.tA);
  if (!leg2) return null;
  const cap = KNOBS.IMPACTOR_KG[ctx.impactorTier - 1] ?? 1000;
  const sailCost = [2, 3, 5, 9][sailTier - 1] ?? 2;
  return {
    id,
    archetype: 'SAIL_KINETIC',
    launcherTier: ctx.launcherTier,
    impactorTier: ctx.impactorTier,
    launchTime: c.tL,
    arrivalTime: c.tA,
    impactorKg: Math.min(c.impactorKg, cap),
    c3: c.c3,
    departureV: { x: 0, y: 0 },
    arrivalV: c.v2,
    interceptR: c.rThreat,
    U: c.U,
    cost: missionCost(ctx.launcherTier, ctx.impactorTier) + sailCost,
    committedAt: ctx.committedAt,
    targetId: ctx.targetId,
    legs: [{ kind: 'SAIL', tFrom: c.tL, tTo: c.tS, law: c.law, dvEquiv: c.dvEquiv, samples: c.samples }, { kind: 'DSM', t: c.tS, dv: c.dsm }, leg2],
    dsmUsed: c.dsm,
  };
}

/** Full state (r, v) of a craft at time t from its legs, or null when not in flight. */
export function craftState(m: Mission, mu: number, t: number): { r: V; v: V } | null {
  if (!m.legs) return null;
  for (const leg of m.legs) {
    if (leg.kind === 'COAST' && t >= leg.tFrom && t < leg.tTo) {
      // NOTE: a coast retargeted onto a body off the ecliptic carries 3-D elements (stateAt handles both).
      const s = stateAt(leg.elements, mu, t);
      return { r: s.r, v: s.v };
    }
    if (leg.kind === 'SAIL' && t >= leg.tFrom && t < leg.tTo) {
      const p0 = craftPosition(m, mu, t);
      const dt = Math.min(3600, leg.tTo - t);
      const p1 = craftPosition(m, mu, t + dt);
      if (!p0 || !p1 || dt <= 0) return null;
      return { r: p0, v: { x: (p1.x - p0.x) / dt, y: (p1.y - p0.y) / dt } };
    }
  }
  return null;
}

/** Position of a craft with legs at time t, or null when not in flight. */
export function craftPosition(m: Mission, mu: number, t: number): V | null {
  if (!m.legs) return null;
  for (const leg of m.legs) {
    if (leg.kind === 'COAST' && t >= leg.tFrom && t < leg.tTo) return stateAt(leg.elements, mu, t).r;
    if (leg.kind === 'SAIL' && t >= leg.tFrom && t < leg.tTo) {
      const n = leg.samples.length / 2;
      const f = ((t - leg.tFrom) / (leg.tTo - leg.tFrom)) * (n - 1);
      const i = Math.min(n - 2, Math.floor(f));
      const u = f - i;
      const x0 = leg.samples[i * 2] as number;
      const y0 = leg.samples[i * 2 + 1] as number;
      const x1 = leg.samples[(i + 1) * 2] as number;
      const y1 = leg.samples[(i + 1) * 2 + 1] as number;
      return { x: x0 + (x1 - x0) * u, y: y0 + (y1 - y0) * u };
    }
  }
  return null;
}
