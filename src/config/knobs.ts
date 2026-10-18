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

  /** 6.8: sail tiers: loading sigma (kg/m^2), reflectivity eta; a_c follows. Sail mass fraction of the payload. */
  SAIL_TIERS: [
    { tier: 1, sigma: 0.1, eta: 0.9, massFraction: 0.4, name: 'SL1 NEA-SCOUT CLASS' },
    { tier: 2, sigma: 0.025, eta: 0.9, massFraction: 0.35, name: 'SL2' },
    { tier: 3, sigma: 0.01, eta: 0.9, massFraction: 0.3, name: 'SL3' },
    { tier: 4, sigma: 0.003, eta: 0.9, massFraction: 0.2, name: 'SL4 GRAPHENE' },
  ] as readonly { tier: number; sigma: number; eta: number; massFraction: number; name: string }[],
  /** RK4 step for thrust arcs, s. */
  SAIL_DT: 6 * 3600,
  /** Optimal cone angle for tangential thrust, rad (35.26 deg). */
  SAIL_ALPHA_OPT: Math.atan(1 / Math.SQRT2),
  /** TARGET STEER: candidate cone angles evaluated each step, rad. */
  SAIL_STEER_ANGLES: [-70, -45, -20, 0, 20, 45, 70].map((d) => (d * Math.PI) / 180) as readonly number[],
  /** Sail search grid: launch steps and arc durations (years), plus the departure v_inf used, m/s. */
  SAIL_SEARCH_LAUNCH_STEPS: 12,
  SAIL_ARC_YEARS: [0.5, 1, 1.5, 2] as readonly number[],
  SAIL_DEPARTURE_VINF: 1500,
  /** Max flight mismatch a sail plan may leave for the onboard dv at the arc's end, m/s (dsm budget applies). */

  /** 6.7: flyby minimum periapsis altitude above the surface, m: rocky planets 300 km; GIANT 2 radii. */
  FLYBY_HMIN_ROCKY: 3e5,
  FLYBY_HMIN_GIANT_RADII: 2,
  /** Flyby search: axis step is the larger of this and lead / FLYBY_MAX_AXIS. */
  FLYBY_STEP: 15 * DAY,
  FLYBY_MAX_AXIS: 40,
  /** Onboard dv (DSM / powered flyby / sail-end match) by propulsion tier, m/s: P1 chemical kick, P2 ion, P3 NEP. */
  DSM_BUDGET: [1000, 5000, 15000] as readonly number[],

  /** The calendar year of round time t = 0 (today). Network activation years are compared against it. */
  EPOCH_YEAR: 2026,
  /** 18.1: detection. Moon penalty: within MOON_PENALTY_DAYS of full moon ground V_lim drops by MOON_PENALTY_MAG. */
  MOON_PENALTY_DAYS: 3,
  MOON_PENALTY_MAG: 1.5,
  SYNODIC_MONTH: 29.53 * DAY,
  /** A survey discovers on the Nth consecutive detection night. */
  DISCOVERY_NIGHTS: 3,
  /** 18.2: search window before impact, years, and the sample step. */
  DISCOVERY_YEARS: 20,
  DISCOVERY_STEP: DAY,
  /** Section 10 note: accept a candidate whose discovery-derived lead is within [LO, HI] x T_lead(k). */
  LEAD_WINDOW: [0.6, 1.4] as readonly [number, number],
  /** Probability of allowing a NO WARNING round at round k: p = SURPRISE_BASE + SURPRISE_PER_ROUND (k - 1), capped. */
  SURPRISE_BASE: 0.03,
  SURPRISE_PER_ROUND: 0.02,
  SURPRISE_MAX: 0.2,
  /** Lead time given to a NO WARNING round (airburst sensing, hours to days), s. */
  NO_WARNING_LEAD: 3 * DAY,
  /** Albedo by threat type (18.1). */
  ALBEDO: { RUBBLE: 0.06, STONY: 0.2, IRON: 0.15, ICY: 0.04 } as Readonly<Record<string, number>>,

  /** 18.6: civil defense. */
  EVACUATE_COST: 2,
  EVACUATE_MIN_DAYS: 7,
  DAMAGE_MULT: { AIRBURST: 0.3, CITY: 0.4, REGIONAL: 0.7, GLOBAL: 1.0 } as Readonly<Record<string, number>>,
  EVACUATED_HIT_SCORE_MULT: 0.25,

  /** 6.11: nuclear. Coupling eps and momentum coupling C_m (N s/J) by burst mode; yields and masses; fuze limits. */
  NUKE_EPS: { STANDOFF: 0.3, SURFACE: 0.5, SUBSURFACE: 0.9, HAIV: 0.9 } as Readonly<Record<string, number>>,
  NUKE_CM: 3e-4,
  NUKE_YIELDS_MT: [0.1, 0.3, 1, 5] as readonly number[],
  /** Which yields each warhead tier unlocks (indices into NUKE_YIELDS_MT). */
  NUKE_YIELDS_BY_TIER: [[], [0, 1], [0, 1, 2], [0, 1, 2, 3]] as readonly (readonly number[])[],
  NUKE_MASS_BASE_KG: 1500,
  NUKE_MASS_PER_MT_KG: 500,
  /** Standoff fuzing needs a closing speed at or below this, m/s, by warhead tier (tier 1: 5 km/s; tier 2+: 20 km/s). */
  NUKE_FUZE_U: [0, 5000, 20000, 20000] as readonly number[],
  /** Standoff height as a fraction of the body radius [knob]. */
  NUKE_STANDOFF_H_FRAC: 0.5,
  /** HAIV accuracy factor (leader crater, follower warhead). */
  HAIV_ACCURACY: 0.7,
  /** Pulse train: bursts per train and spacing, s. */
  NUKE_PULSE_COUNT: 3,
  NUKE_PULSE_SPACING: 600,
  /** Costs: warhead by tier index (100/300 kt share tier 1), plus the launcher. */
  COST_WARHEAD: [6, 12, 25] as readonly number[],

  /** 6.12 and 20.2: slow push. Hover distance factor, beam/laser tiers, coupling, propellant Isp. */
  TRACTOR_HOVER_FACTOR: 1.5,
  TRACTOR_THRUST_FACTOR: 1.3,
  TRACTOR_SC_MASS_KG: [1000, 5000, 20000] as readonly number[],
  ION_BEAM_N: [0.1, 0.5, 2] as readonly number[],
  LASER_CM_N_PER_W: 3e-5,
  LASER_POWER_W: [5e4, 2e5, 1e6] as readonly number[],
  ION_ISP_S: 3000,
  /** Other 20.2 pushers (honest numbers, mostly tiny). */
  MIRROR_AREA_M2: [1e3, 1e4, 1e5] as readonly number[],
  MIRROR_CM_N_PER_W: 1e-4,
  MIRROR_FOULING_PER_MONTH: 0.1,
  MASS_DRIVER_MDOT: [0.1, 1, 10] as readonly number[],
  MASS_DRIVER_VE: 500,
  TUGBOAT_F_CHEM_N: 2000,
  TUGBOAT_F_ION_N: 5,
  TUGBOAT_ETA_SPIN: 0.3,
  MAGNETIC_ETA_SPIN: 0.5,
  TETHER_L_M: 1e6,
  TETHER_MASS_KG: 2e4,
  ESAIL_N_PER_KM: 5e-4,
  ESAIL_TETHER_KM: 100,
  GROUND_LASER_ATM_EFF: 0.3,
  GROUND_LASER_RANGE_AU: 0.05,
  GROUND_LASER_POWER_W: 1e6,
  /** 6.13 and 20.3 (SCI-FI): net tug thrust by net tier, Q* multiplier for a netted body, capture size; fusion tug;
   *  Orion pulse unit and period; DE-STAR array power and range. */
  NET_TUG_N: [10, 50, 200] as readonly number[],
  NET_QSTAR_MULT: 3,
  NET_CAPTURE_D: 60,
  FUSION_TUG_N: 50000,
  ORION_PULSE_NS: 1e7,
  ORION_PULSE_PERIOD_S: 10,
  DE_STAR_POWER_W: 1e9,
  DE_STAR_RANGE_AU: 0.3,
  /** DE-STAR fires until this long before impact, s (the push-mission margin is far too early for a 0.3 AU reach). */
  DE_STAR_END_MARGIN: 1 * DAY,
  /** 21.2 SCI-FI round types: flavor shares per round, interstellar v_inf range (km/s), long-period comet
   *  apoapsis cap (AU), giant body diameter (m). */
  SCIFI_SHARE_INTERSTELLAR: 0.3,
  SCIFI_SHARE_LONG_PERIOD: 0.25,
  SCIFI_SHARE_GIANT: 0.2,
  INTERSTELLAR_VINF_KMS: [50, 90] as readonly [number, number],
  LONG_PERIOD_MAX_APO_AU: 500,
  GIANT_D_M: 5000,
  /** Cost of a slow-push package by tier. */
  COST_SLOW_PUSH: [4, 6, 12] as readonly number[],
  /** Push arcs end this long before impact so the debrief can see the result, s. */
  PUSH_END_MARGIN: 30 * DAY,
  /** RK4 step for push arcs, s. */
  PUSH_DT: 6 * 3600,

  /** 6.14: tracking. sigma_v (m/s) by tier; assessment delay (s) before a kinetic beta is revealed; arc model. */
  SIGMA_V_BY_TIER: [0.005, 0.001, 0.0002] as readonly number[],
  BETA_ASSESS_DELAY: [60 * DAY, 20 * DAY, 5 * DAY] as readonly number[],
  SIGMA_V_INITIAL: 0.02,
  SIGMA_V_ARC_REF_DAYS: 30,

  /** 8: autonomy. A retarget needs at least this long before arrival; sub-impactor dv by swarm tier (m/s); default
   *  deploy lead before arrival when nothing triggered a deployment. */
  AUTONOMY_MIN_LEAD: 10 * DAY,
  SPLIT_DV: [0, 0, 150, 600] as readonly number[],
  SPLIT_COUNT: [1, 1, 3, 8] as readonly number[],
  SPLIT_DEFAULT_LEAD: 30 * DAY,

  /** 20.2 PI (Pulverize It): penetrator array for bodies under PI_MAX_D, usable down to PI_MIN_LEAD before impact;
   *  the shredded cloud airbursts high and does PI_DAMAGE_FRACTION of the threat's energy in damage. */
  PI_MAX_D: 100,
  PI_MIN_LEAD: 12 * 3600,
  PI_DAMAGE_FRACTION: 0.05,
  PI_COST: 6,

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

  /** 29: event cinematics, seconds per scene by event kind; any key skips. */
  CINEMATIC_SECONDS: { LAUNCH: 2.5, IMPACT: 3, FRAGMENTATION: 4, NUKE: 3.5, PI: 3, CLOSE_APPROACH: 4, PUSH: 4 } as Readonly<Record<string, number>>,
  /** 29: under reduce-motion a scene is a still frame of this length plus the brief. */
  CINEMATIC_FLASH_S: 0.5,
  /** 29: teletype speed: the whole brief in at most this many seconds, never slower than MIN chars per second. */
  TELETYPE_MAX_S: 0.9,
  TELETYPE_MIN_CPS: 600,
  /** 29: a non-modal brief clears itself after this many seconds. */
  TELETYPE_HOLD_S: 10,
  /** 29: warp index the clock drops to when the last craft has arrived (1 = 1 DAY/S). */
  WARP_DOWN_INDEX: 1,

  /** 30 (owner, 2026-10-18): speculative standing capabilities, SCI-FI only. "Unproven, might work someday."
   *  NANOFORGE: self-replicating seeds land, double every NANOFORGE_DOUBLING_DAYS until they cover the body
   *  (NANOFORGE_GROW_DAYS in all), then run a mass driver out of the regolith: F = mdot v_e. */
  NANOFORGE_GROW_DAYS: 240 * DAY,
  NANOFORGE_MDOT: 8,
  /** The forge may consume at most this fraction of the body (it is also the propellant). */
  NANOFORGE_MAX_EAT: 0.5,
  NANOFORGE_VE: 900,
  /** THRUSTER SWARM: N self-assembling units, F_unit each, arrive after the transit, push at eta_spin (despun). */
  THRUSTER_SWARM_N: 120,
  THRUSTER_UNIT_N: 25,
  THRUSTER_ETA: 0.6,
  THRUSTER_TRANSIT: 200 * DAY,
  /** SHEPHERD NETWORK: a parked captured rock of SHEPHERD_KG fired into each new threat at SHEPHERD_U, beta
   *  SHEPHERD_BETA, SHEPHERD_DELAY after the round starts (dv = beta m U / M). */
  SHEPHERD_KG: 2e6,
  SHEPHERD_U: 12000,
  SHEPHERD_BETA: 2,
  SHEPHERD_DELAY: 150 * DAY,
  /** FUSION_TUG_FLEET (20.3): the tug reaches the threat after this transit, then pushes at fusionTugN. */
  FUSION_TUG_TRANSIT: 365 * DAY,
  /** SAIL_SWARM_DEPOT (19/20.3): each parked sail impactor's mass, closing speed (15 km/s pre-accelerated), beta, and the delay. */
  SAIL_DEPOT_KG: 1500,
  SAIL_DEPOT_U: 15000,
  SAIL_DEPOT_BETA: 2,
  SAIL_DEPOT_DELAY: 60 * DAY,
  /** SEED FLEET (30, owner idea): seeds reach the threat's neighbourhood after SEED_FLEET_DELAY, then the fleet
   *  doubles every SEED_FLEET_DOUBLING, mining small bodies for copies, and at each doubling throws all its rocks
   *  (shepherd-sized) at the threat: 1, 2, 4 ... up to SEED_FLEET_MAX rocks a strike. Lead time buys doublings. */
  SEED_FLEET_DELAY: 365 * DAY,
  SEED_FLEET_DOUBLING: 1.5 * 365 * DAY,
  SEED_FLEET_MAX: 16,

  /** 13 / IDEAS 21: robot voice-overs. Clip gain into the shared master bus (the master sits at 0.5). */
  VOICE_GAIN: 1.6,
  /** A line whose clip finishes loading later than this after it was asked for is dropped (it would be stale), s. */
  VOICE_STALE_S: 1.5,
  /** The same line is not repeated within this many real seconds (no spam during warp). */
  VOICE_REPEAT_S: 8,
  /** "IMPACT IMMINENT" once per round when the plan still hits and the impact is this close on the sim clock, s. */
  VOICE_IMMINENT_S: 90 * DAY,
  /** Fade applied when a newer line cuts a playing one off, s. */
  VOICE_CUT_S: 0.06,
  /** Detection gauge (owner backlog 9, src/sim/gauge.ts): log size bar from GAUGE_MIN_M to GAUGE_MAX_M sampled
   *  GAUGE_GRID_PER_DECADE times a decade. A needle is the smallest size where GAUGE_CATCH_SHARE of the reference
   *  impactors are found with its warning (DEFLECT and SUNWARD 1 year, EVACUATE and INTERSTELLAR 3 weeks). */
  GAUGE_MIN_M: 1,
  GAUGE_MAX_M: 10000,
  GAUGE_GRID_PER_DECADE: 6,
  GAUGE_CATCH_SHARE: 0.5,
  GAUGE_DEFLECT_WARNING: YEAR,
  GAUGE_EVACUATE_WARNING: 21 * DAY,
  /** Reference population: GAUGE_ANGLES approach directions at each speed, impact dates spread over a year. */
  GAUGE_ANGLES: 24,
  GAUGE_VINF_KMS: [8, 15, 22] as readonly number[],
  GAUGE_INTERSTELLAR_VINF_KMS: [30, 50] as readonly number[],
  /** Years searched before impact: ordinary rocks, then hyperbolic visitors (they are far and faint earlier). */
  GAUGE_WINDOW_YEARS: 25,
  /** The reference rocks hit this many years after the gauge's year (spread between the two), years. */
  GAUGE_AHEAD_YEARS: [1, 3] as readonly [number, number],
  GAUGE_HYPERBOLIC_YEARS: 3,
  /** Albedo of the reference rocks (H 22 at 140 m) and of the dark interstellar nuclei. */
  GAUGE_ALBEDO: 0.14,
  GAUGE_INTERSTELLAR_ALBEDO: 0.04,
  /** A rock arriving from within this angle of the Sun (seen from HOME) counts toward the SUNWARD needle, deg. */
  GAUGE_SUNWARD_DEG: 75,
  /** The rounds still fly a flat 2-D system; the gauge tilts each reference orbit about its impact node so earlier
   *  passes are not all exact crossings (NEA inclinations are mostly 0-30 deg; visitors arrive from anywhere). */
  GAUGE_INCL_DEG: [4, 10, 18, 30] as readonly number[],
  GAUGE_INTERSTELLAR_INCL_DEG: [20, 45, 70, 90] as readonly number[],
  /** Trailing loss for ground surveys: exposure, s, and seeing, arcsec (Rubin 30 s, about 1 arcsec; others worse). */
  GAUGE_EXPOSURE_S: 30,
  GAUGE_SEEING_ARCSEC: 1.5,
  /** Fireball sensors (the AIRBURST network) see metre-class rocks, but only as they hit, m. */
  GAUGE_AFTERMATH_M: 1,
  /** The danger band drawn red on the gauge: damage begins near 20 m, the catalog is fairly complete from 140 m. */
  GAUGE_DANGER_M: [20, 140] as readonly [number, number],
  /** SUPER-DUPER-DEMO (IDEAS 20): games watched before the montage, the starting speed and the growth per
   *  game (speed = START x GROWTH^games, capped). 2 x 1.15^n puts the whole run near ten minutes (LONG); the
   *  OPTIONS DEMO LENGTH row picks a row of DEMO_LENGTHS, which replaces games and start. */
  DEMO_GAMES: 100,
  DEMO_SPEED_START: 2,
  /** Owner 2026-10-18: default about 5 minutes, also about 2-3 or 10. Run time scales roughly as 1/START. */
  DEMO_LENGTHS: { SHORT: { games: 50, start: 8 }, MEDIUM: { games: 70, start: 4 }, LONG: { games: 100, start: 2 } },
  /** AUTOPLAY pace multipliers on panes, step waits and the sim clock (owner 2026-10-18: old pace = SLOW). */
  AUTO_SPEEDS: { SLOW: 1, NORMAL: 1.5, FAST: 2.25 },
  DEMO_SPEED_GROWTH: 1.15,
  DEMO_SPEED_MAX: 400,
  /** Owner 2026-10-18: "finer pixels" in the LAUNCH cinematic. Cell size of the launch pixel art in px at scale 1
   *  (was 3 for the pad and 2.5 + 0.5 x tier for the rocket); the sprites are drawn at about twice the old
   *  resolution so the rocket keeps its size on screen. Never below 1 device px. */
  CINE_LAUNCH_CELL_PX: 1.5,
  /** False-colour thrust head (owner 2026-10-18): the hottest part of the plume, at the nozzle, is drawn in a
   *  thermal false-colour ramp instead of the fire palette. Off draws the plain fire ramp all the way down. */
  CINE_FALSE_COLOUR: true,
  /** Fraction of the plume length drawn in false colour, then a dithered hand-off to the fire palette. */
  CINE_FALSE_HEAD_FRAC: 0.42,
  /** Width of the dithered hand-off band, as a fraction of the plume length. */
  CINE_FALSE_DITHER_FRAC: 0.16,
  /** The ramp under NEON, hottest first: white, ice, cyan, magenta, violet, deep violet (a thermal-camera look).
   *  Mono palettes step hot -> ink -> alt -> dim instead (falseRamp in render/cinematics/pixel.ts). */
  CINE_FALSE_RAMP: ['#FFFFFF', '#C8FFFF', '#00E5FF', '#FF3DF0', '#A43CFF', '#5A1FA8'] as readonly string[],
  /** Ember sparks: tiny false-colour pixels shed from each nozzle, count per nozzle and lifetime, s. */
  CINE_EMBERS: 40,
  CINE_EMBER_LIFE_S: 0.55,
  /** Impact, breakup and trail debris pixel size relative to the old chunky size (1 = old). */
  CINE_DEBRIS_PX_SCALE: 0.6,
  /** A debris pixel is drawn in false colour for this long after it is born (hot ejecta), s. */
  CINE_HOT_EJECTA_S: 0.14,
} as const;
