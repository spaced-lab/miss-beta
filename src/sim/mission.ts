// WHAT: Mission records (GAME_PLAN 7.1), KINETIC archetype for M2.
// WHY:  A committed plan is data: when it launches, what it carries, the Lambert arc it flies and what it
//       costs. The resolver reads missions and the renderer draws them; neither needs the planner.
// HOW:  M2 flattens the leg list to one Lambert coast. Later archetypes add legs; the common fields stay.
// LORE: G3 (the planner), D3 (kinetic and beta)

import type { Rule } from '../planner/rules';
import type { Elements } from '../physics/kepler';
import type { Vec2 } from '../util/vec';

export type Archetype = 'KINETIC' | 'KINETIC_FLYBY' | 'SAIL_KINETIC' | 'NUKE_STANDOFF' | 'NUKE_DISRUPT' | 'SLOW_PUSH';

export interface PushSpecRef {
  method: string;
  tier: number;
  /** +1 speeds the body up (raises the orbit), -1 slows it. */
  sign: 1 | -1;
  /** Maximum push duration, s (ends earlier at PUSH_END_MARGIN before impact). */
  tauMax: number;
}

export interface WarheadSpec {
  yieldMt: number;
  mode: 'STANDOFF' | 'SURFACE' | 'SUBSURFACE' | 'HAIV';
  /** Warhead tier at commit (fuze limits). */
  tier: number;
  /** Bursts in a pulse train (W3), else 1. */
  pulses: number;
}

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
  /** Present for NUKE_* missions: the payload is a warhead, not an impactor. */
  warhead?: WarheadSpec;
  /** Present for SLOW_PUSH missions: rendezvous, then push. */
  push?: PushSpecRef;
  /** Autonomy (GAME_PLAN 8): tier 0 fixed, 1 rules, 2 onboard retargeting, 3 swarm assignment. */
  autonomyTier?: number;
  /** Onboard dv available for retargeting after launch, m/s (propulsion tier). */
  dvBudget?: number;
  /** Tier 1 rules. */
  rules?: Rule[];
  /** A carrier bus with sub-impactors (swarm tiers 2 and 3). */
  split?: { count: number; dvEach: number; deployed: boolean };
  /** Set on missions created by the resolver (sub-impactors, retargets) for the renderer. */
  parentId?: string;
}
