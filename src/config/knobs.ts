// WHAT: Every [knob] of the simulator with its GAME_PLAN default, in one object.
// WHY:  GAME_PLAN 0: balance is data work. Section 17 says fix constants, not targets; this is where the
//       constants live. STATUS.md records every value changed from the plan's default and why.
// HOW:  Grouped by the plan section that defines them. Values are SI unless the name says otherwise.
//       Grows milestone by milestone; do not pre-fill knobs for features that do not exist yet.
// LORE: G7 (under the hood)

import { DAY, YEAR } from '../physics/constants';

export const KNOBS = {
  /** 5.2: optional variety per run; 1 disables. Semi-major axes scaled by Uniform(1-x, 1+x). */
  SYSTEM_A_SCALE_SPREAD: 0.1,
  /** 5.2: star mass scaled by Uniform(1-x, 1+x). */
  SYSTEM_MU_SPREAD: 0.05,

  /** 11: warp ladder, sim seconds per real second. Index 0 is PAUSE. */
  WARP_LEVELS: [0, DAY, 7 * DAY, 30 * DAY, YEAR] as readonly number[],
  WARP_LABELS: ['PAUSE', '1 DAY/S', '1 WEEK/S', '1 MONTH/S', '1 YEAR/S'] as readonly string[],
  /** Default warp index at round start. */
  WARP_DEFAULT: 1,

  /** 9: economy. Budget units per year, accrued continuously; starting balance. */
  BUDGET_PER_YEAR: 6,
  BUDGET_START: 8,
  /** 9: costs in budget units. */
  COST_LAUNCHER: [2, 5, 12] as readonly number[],
  COST_IMPACTOR: [1, 3, 8] as readonly number[],
  /** 9: impactor mass caps by tier, kg. I1 is 1.5 t so the Round 1 balance target of Section 17 holds. */
  IMPACTOR_KG: [1500, 5000, 20000] as readonly number[],
  /** 9: build time for a small kinetic mission, s. */
  BUILD_TIME_KINETIC: 0.5 * YEAR,

  /** 6.6: porkchop grid. Step is the larger of PORKCHOP_STEP and lead / PORKCHOP_MAX_AXIS. */
  PORKCHOP_STEP: 10 * DAY,
  PORKCHOP_MAX_AXIS: 110,
  PORKCHOP_MIN_FLIGHT: 30 * DAY,
  /** Arrivals must leave this much time before impact for the deflection to act (and for the debrief). */
  PORKCHOP_RESOLVE_MARGIN: 60 * DAY,

  /** 6.9: beta ranges per threat type, drawn per impact. */
  BETA_RANGE: { RUBBLE: [2.5, 5.0], STONY: [2.0, 4.0], IRON: [1.2, 2.0], ICY: [1.5, 3.5] } as Readonly<Record<string, readonly [number, number]>>,

  /** Resolver: an impactor still finds a threat that has drifted this far from its planned intercept point, m. */
  TERMINAL_GUIDANCE_RANGE: 5e7,

  /** 7.3: ranking weights. */
  W_MISS: 1.0,
  W_RES: 0.6,
  W_COST: 0.25,
  W_MARGIN: 0.15,
  W_NUKE: 0.1,
  /** How many estimate-ranked candidates get a full deterministic resolve before the final ranking. */
  PLANNER_RESOLVE_TOP: 12,
  PLANNER_SHOW_TOP: 6,
} as const;
