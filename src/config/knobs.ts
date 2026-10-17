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

  /** 6.10: disruption. Benz and Asphaug (1999) coefficients in cgs; [unverified] against the paper to three digits. */
  QSTAR_BASALT: { Q0: 9.0e7, a: -0.36, B: 0.5, b: 1.36 },
  QSTAR_ICE: { Q0: 1.6e7, a: -0.39, B: 1.2, b: 1.26 },
  /** Fragment count range and Pareto slope for the cumulative size distribution N(>D) ~ D^-PARETO_ALPHA. */
  FRAG_N_MIN: 8,
  FRAG_N_MAX: 40,
  FRAG_PARETO_ALPHA: 2.5,
  /** Ejection speed scale factor: |v_ej| ~ Rayleigh(K_EJ * v_esc * sqrt(Q/Q*)). */
  K_EJ: 1.0,
  /** Fragments below the airburst threshold are harmless (6.4): stony 25 m, iron 10 m. */
  FRAG_HARMLESS_D: 25,
  FRAG_HARMLESS_D_IRON: 10,
  /** Fragment close-approach search window, s (the cloud spreads hours to days, not months). */
  FRAG_CA_WINDOW: 10 * DAY,
  /** 6.10 3-D correction: each fragment's hit probability is multiplied by min(1, b_crit / (F3D_K v_ej T)). */
  F3D_K: 0.6,
  /** A hit that delivers less than this fraction of the original threat energy counts as PARTIAL (Section 12). */
  PARTIAL_ENERGY_FRACTION: 0.1,
  /** Monte Carlo samples per plan. */
  MC_SAMPLES: 120,

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
