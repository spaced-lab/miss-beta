// WHAT: Mission records (GAME_PLAN 7.1), KINETIC archetype for M2.
// WHY:  A committed plan is data: when it launches, what it carries, the Lambert arc it flies and what it
//       costs. The resolver reads missions and the renderer draws them; neither needs the planner.
// HOW:  M2 flattens the leg list to one Lambert coast. Later archetypes add legs; the common fields stay.
// LORE: G3 (the planner), D3 (kinetic and beta)

import type { Elements } from '../physics/kepler';
import type { Vec2 } from '../util/vec';

export type Archetype = 'KINETIC' | 'KINETIC_FLYBY' | 'SAIL_KINETIC';

/** A leg of a mission's flight, for drawing and the log. The resolver only needs the arrival state. */
export type Leg =
  | { kind: 'COAST'; tFrom: number; tTo: number; elements: Elements }
  | { kind: 'FLYBY'; t: number; planetId: string; delta: number; dvHelio: number; dsm: number; rP: number; side: 1 | -1 }
  | { kind: 'SAIL'; tFrom: number; tTo: number; law: string; dvEquiv: number; samples: Float64Array }
  | { kind: 'DSM'; t: number; dv: number };

export interface Mission {
  id: string;
  archetype: Archetype;
  launcherTier: number;
  impactorTier: number;
  /** s, round time. */
  launchTime: number;
  arrivalTime: number;
  /** Impactor mass actually flown, kg (payload capped by the impactor tier). */
  impactorKg: number;
  /** Departure energy, km^2/s^2. */
  c3: number;
  /** Heliocentric velocities from the Lambert solution, m/s. */
  departureV: Vec2;
  arrivalV: Vec2;
  /** Planned intercept point (threat position at arrival when committed), m. */
  interceptR: Vec2;
  /** Planned closing speed, m/s. */
  U: number;
  cost: number;
  committedAt: number;
  /** Body id this mission targets ('THREAT' by default; a fragment id after a breakup). */
  targetId?: string;
  /** Flight legs for drawing; absent for a plain KINETIC (one Lambert coast). */
  legs?: Leg[];
  /** Onboard dv spent on this mission, m/s (DSM, powered flyby, sail-end match). */
  dsmUsed?: number;
}
