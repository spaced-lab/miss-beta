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
  /** OPTIONS SCI-FI VISITORS (owner 2026-10-18): RARE by default while the defences against out-of-plane visitors
   *  are built (IDEAS 27); COMMON is the old 30 % share. */
  SCIFI_VISITOR_SHARES: { RARE: 0.03, COMMON: 0.3 },
  SCIFI_SHARE_LONG_PERIOD: 0.25,
  SCIFI_SHARE_GIANT: 0.2,
  INTERSTELLAR_VINF_KMS: [50, 90] as readonly [number, number],
  /** OPTIONS INTERSTELLAR RATE (owner backlog 12): chance per REALISTIC round of a visitor from another star.
   *  REAL is the true rate (a dangerous one is effectively never seen in a human lifetime; CHECKED, claim
   *  F12-2); anything above stamps the run EXAGGERATED. Drawn from its own seeded stream, so seeds keep their rounds. */
  INTERSTELLAR_RATES: { REAL: 1e-6, ELEVATED: 0.02, FREQUENT: 0.1, STORM: 0.3 },
  /** A REALISTIC visitor: excess speed range km/s (the known three came in at about 26 to 58), size range m,
   *  albedo (dark nucleus), and the years searched before impact. */
  REAL_INTERSTELLAR_VINF_KMS: [25, 60] as readonly [number, number],
  REAL_INTERSTELLAR_D_M: [80, 1000] as readonly [number, number],
  REAL_INTERSTELLAR_ALBEDO: 0.04,
  REAL_INTERSTELLAR_WINDOW_YEARS: 3,
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
  // NOTE: 2026-10-24: 6 -> 10 with the method tabs; the ALL tab leads with the best plan of each family, so six
  // slots would have left no room for a second plan of any kind. The list scrolls.
  PLANNER_SHOW_TOP: 10,

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
  /** IDEAS 26: protected sites besides HOME. Moon (mass, radius, orbit radius), a Ganymede-like moon of GIANT, and
   *  the chance per round, once a site is built, that the threat is aimed at a site instead of HOME (one site drawn
   *  uniformly from those built). Losing a site costs SITE_LOSS_SCORE and the site must be rebuilt; the run goes on. */
  MOON_MU: 4.9048695e12,
  MOON_RADIUS: 1.7374e6,
  MOON_A: 3.844e8,
  GIANT_MOON_MU: 9.8878e12,
  GIANT_MOON_RADIUS: 2.6341e6,
  GIANT_MOON_A: 1.0704e9,
  SITE_TARGET_SHARE: 0.3,
  SITE_LOSS_SCORE: 400,
  /** L4/L5 PICKET (30, owner idea): impactors parked at HOME's L4 and L5, fuelled and waiting. Each new threat
   *  gets one from each point PICKET_DELAY after the round starts: dv = 2 beta m U / M (one-hour impulse each). */
  PICKET_KG: 5000,
  PICKET_U: 15000,
  PICKET_BETA: 2.5,
  PICKET_DELAY: 120 * DAY,
  /** ATTACHABLE SAIL KITS (30): KIT_COUNT sails of KIT_AREA m^2 tethered to the rock after KIT_TRANSIT, pulling at
   *  F = KIT_EFF x 2 P0 A per kit, P0 = 4.56e-6 N/m^2 (sunlight pressure at 1 AU, full reflection gives 2 P0).
   *  Example: one 1 km^2 kit at efficiency 0.5 -> 0.5 x 2 x 4.56e-6 x 1e6 = 4.6 N. */
  KIT_AREA: 1e6,
  KIT_EFF: 0.5,
  KIT_COUNT: 2,
  KIT_TRANSIT: 300 * DAY,
  SEED_FLEET_DELAY: 365 * DAY,
  SEED_FLEET_DOUBLING: 1.5 * 365 * DAY,
  SEED_FLEET_MAX: 16,

  /** 13 / IDEAS 21: robot voice-overs. Clip gain into the shared master bus (the master sits at 0.5). */
  // NOTE: owner 2026-10-20 "bring the voice volume down a touch" so the impact bass leads: 1.6 -> 1.25.
  VOICE_GAIN: 1.25,
  /** A line whose clip finishes loading later than this after it was asked for is dropped (it would be stale), s. */
  VOICE_STALE_S: 1.5,
  /** The same line is not repeated within this many real seconds (no spam during warp). */
  VOICE_REPEAT_S: 8,
  /** The SUPER-DUPER-DEMO's repeat guard for the game's event and round-result lines, s (owner 2026-10-21: the same
   *  "Partial deflection" clip every few seconds). */
  DEMO_VOICE_REPEAT_S: 30,
  /** "IMPACT IMMINENT" once per round when the plan still hits and the impact is this close on the sim clock, s. */
  VOICE_IMMINENT_S: 90 * DAY,
  /** Fade applied when a newer line cuts a playing one off, s. */
  VOICE_CUT_S: 0.06,
  /** Feasibility studies (owner backlog 6, src/sim/studies.ts): game years per human year of research, budget
   *  units per billion US dollars, and the smallest yearly cost of a running study. */
  STUDY_TIME_COMPRESSION: 0.3,
  STUDY_BUDGET_PER_BUSD: 2,
  STUDY_COST_MIN: 0.4,
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
  /** Ground surveys revisit high ecliptic latitudes less: nightly coverage x (1 - this x |sin(latitude)|). Only
   *  tilted (3-D lite) targets have a latitude; flat rounds are unchanged. */
  SKY_LAT_PENALTY: 0.4,
  /** Fireball sensors (the AIRBURST network) see metre-class rocks, but only as they hit, m. */
  GAUGE_AFTERMATH_M: 1,
  /** The danger band drawn red on the gauge: damage begins near 20 m, the catalog is fairly complete from 140 m. */
  GAUGE_DANGER_M: [20, 140] as readonly [number, number],
  /** IDEAS 27: SCI-FI visitors' warning (0.6 to 1.5 years, drawn) is multiplied by the best deep-space survey active:
   *  nodes above and below the plane (HIVE_2) and infrared nodes on Venus and L4/L5 legs (HIVE_3) see a steep visitor
   *  sooner. Balance values, not claims. Measured (bench/visitors.probe.ts): warning x1.5 lifts SCI-FI visitors with
   *  any feasible launch from 0 to 4 of 30 (5 with a craft on standby), x2 to 5 (7). */
  SCIFI_VISITOR_WARNING_MULT: { HIVE_2: 1.5, HIVE_3: 2 } as Readonly<Record<string, number>>,
  /** [knob] Planner no-plan explanation (planner/explain.ts): name the climb out of the plane once its share of the best
   *  window's C3 reaches PLANE_MENTION; suggest INCLINED PICKETS from PICKETS_SHARE. Teaching thresholds, not physics. */
  EXPLAIN_PLANE_SHARE: { PLANE_MENTION: 0.05, PICKETS_SHARE: 0.3 },
  /** SUPER-DUPER-DEMO (IDEAS 20): timed by the clock, not by games (owner 2026-10-18: about 5 minutes by default,
   *  also 2-3 or 10). Speed = START x (END / START)^(elapsed / length), capped at DEMO_SPEED_MAX, then the
   *  montage. NOTE: a game-count rule (100 games at 2 x 1.15^n) was dropped after a measurement: one game takes
   *  10-12 minutes of real time at speed 1, so the counted MEDIUM run was heading for 15 minutes, not 5. */
  // NOTE: owner 2026-10-18 (after shipping): "reduce the super-duper-demo by 50 % time" and "look fast and faster":
  // lengths halved from 150 / 300 / 600 and the ramp starts and ends higher (was 4 to 120).
  // NOTE: owner 2026-10-20 "too long and takes too long to speed up ... start a bit slower, then ramp up", "cut length
  // by 55 %": lengths 75 / 150 / 300 -> 34 / 68 / 135 s; START 8 -> 4 held for DEMO_SPEED_HOLD_S, then the ramp runs on
  // f^DEMO_SPEED_SHAPE (under 1 climbs sooner) to END 200 -> 260.
  DEMO_LENGTHS: { SHORT: { seconds: 34 }, MEDIUM: { seconds: 68 }, LONG: { seconds: 135 } },
  DEMO_SPEED_START: 4,
  DEMO_SPEED_END: 260,
  DEMO_SPEED_HOLD_S: 6,
  DEMO_SPEED_SHAPE: 0.7,
  /** Real seconds a launch or strike cinematic plays in the demo before it is cut (was 3 demo seconds, under 0.3 s
   *  of real time once the demo sped up, so the animations were barely seen). */
  DEMO_CINE_S: 1.8,
  /** The cinematic cut shrinks to this many real seconds by the finale (owner 2026-10-20: nothing holds still). */
  DEMO_CINE_END_S: 0.6,
  /** Real seconds an AUTOPLAY explanation pane holds the demo's games at most (they are read in full elsewhere). */
  DEMO_PANE_S: 0.7,
  /** Demo cutaways (render/views/demoCut.ts): real seconds between cuts and per cut, start -> finale, and the
   *  chance a cut speaks a line. A cut never lasts under DEMO_MONTAGE.SAFE_MIN_S (photosensitive safety). */
  // NOTE: owner 2026-10-20 "briefly show things as it speeds up and sooner the better": gaps 4.5 / 1.1 -> 2 / 0.5 s,
  // the first cut at FIRST_S, and the planner's thinking time is always covered by cuts (no still planner).
  // 2026-10-20 (second pass, "reuses scenes and toggles back and forth"): cuts come in bursts of 1 to BURST_MAX scenes
  // dealt from a deck (no repeat until the pool is used up), gaps 2 / 0.5 -> 3 / 0.8 s, cuts 1.1 / 0.4 -> 1.5 / 0.45 s.
  DEMO_CUT: { GAP0_S: 3, GAP1_S: 0.8, LEN0_S: 1.5, LEN1_S: 0.45, VOICE_P: 0.45, FIRST_S: 1.5, BURST_MAX: 4 },
  /** AUTOPLAY pace multipliers on panes, step waits and the sim clock (owner 2026-10-18: old pace = SLOW). */
  AUTO_SPEEDS: { SLOW: 1, NORMAL: 1.5, FAST: 2.25 },
  // NOTE: moved here from autoplay.ts, attract.ts, tips.ts and demo.ts so every tunable is in one file and the
  // KNOB console command can reach the numeric ones; callers read KNOBS.<name> at use, so live edits apply.
  /** Programs AUTOPLAY funds, in teaching order: coordination first, then finding rocks, then reacting [knob]. */
  AUTO_PROGRAMS: ['INTL_COORDINATION', 'GROUND_SURVEY_EXPANSION', 'SPACE_IR_SURVEYOR', 'SUNWARD_SENTINEL', 'PRECURSOR_FLEET', 'INTERCEPTOR_STOCKPILE', 'CIVIL_DEFENSE_READY', 'RADAR_NET'] as readonly string[],
  /** Fund a program only while the budget stays above this and all funded programs cost under half the income [knob]. */
  AUTO_PROGRAM_RESERVE: 6,
  /** Reading time for a pane [knob]: 2.5 s plus 0.32 s a word, between 4 and 14 s (slow readers get the long end). */
  AUTO_READ: { base: 2.5, perWord: 0.32, min: 4, max: 14 },
  /** Seconds between injected selection steps and warp steps, so the viewer sees each move [knob]. */
  AUTO_STEP_S: 0.45,
  /** Warp index the autopilot flies at once plans are in (1 MONTH/S) [knob]. */
  AUTO_CRUISE_WARP: 3,
  /** Warp index once every craft has arrived and the rock will miss (1 YEAR/S): nothing left to watch [knob]. */
  AUTO_COAST_WARP: 4,
  /** Re-plans allowed per round after the craft have arrived and the rock still hits [knob]. */
  AUTO_REPLANS: 2,
  /** Partial plans stacked per planning pass when no single plan makes the rock miss [knob]. */
  AUTO_STACK: 4,
  /** With no useful plan: wait this long for the budget to grow before planning again [knob, s]. */
  AUTO_RETRY_S: 31557600,
  /** Order the evacuation once the impact is this close and the rock still hits [knob, s]. */
  AUTO_EVAC_LEAD_S: 120 * 86400,
  /** Years of round time per real second on the title. [knob] */
  ATTRACT_RATE: 1.2,
  /** Seconds a tip stays before the next one. [knob] */
  TIP_SECONDS: 12,
  /** Montage pacing [knob]: the blur floor, cuts at the floor before the pause, the pause, typing speed. NOTE: owner
   *  2026-10-18 "faster, the ending is perfect": the blur is counted in cuts (BLUR_CUTS 12), PAUSE_S and TYPE_CPS
   *  unchanged. 2026-10-20: SCENE_S0 / SHRINK replaced by per-scene lengths in views/demo.ts and DEMO_REEL.
   *  2026-10-20 (third pass, "a little longer rumble part and mayhem"): BLUR_CUTS 12 -> 18. */
  DEMO_MONTAGE: { MIN_S: 0.09, BLUR_CUTS: 18, PAUSE_S: 2.4, TYPE_CPS: 16, SAFE_MIN_S: 0.34, CALM_MIN_S: 1 },
  /** Owner 2026-10-20 ("go to town on this demo"): the finale is a reel of scenes played twice, the second time at
   *  REPEAT_X of each scene's length, then the blur. Hits pile up over it all (DEMO_STORM_MAX_HZ at full heat) and
   *  the bass rumbles every RUMBLE_S through the blur until the silent pause. */
  // 2026-10-20 (second pass, "warping and heavy bass rumble start earlier and get more and more intense"): the
  // rumble bed starts at heat RUMBLE_FROM (the hit bursts, before the warp) every RUMBLE_S0 s, tightening to RUMBLE_S
  // in the blur; BASS_X scales every demo bass hit ("make them louder").
  DEMO_REEL: { REPEAT_X: 0.45, RUMBLE_S: 0.2, RUMBLE_S0: 0.5, RUMBLE_FROM: 0.3, BASS_X: 1.35 },
  /** Hits a second in the demo's hit storm at full heat (render/pixelDust.ts stormRate) [knob]. */
  DEMO_STORM_MAX_HZ: 16,
  /** Pixel-dust colours for the demo (owner 2026-10-20: "way more colorful pixel dust"), used on glowing modes. */
  DEMO_DUST_COLORS: ['#FF3B6B', '#FF8A1F', '#FFE14D', '#7CFF4F', '#2EF2FF', '#3D7BFF', '#B04DFF', '#FF4FD8', '#FFFFFF'] as readonly string[],
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
  /** The launch pixel cell never grows past this under the dolly (owner 2026-10-24: no huge pixels); the plume and
   *  smoke get denser instead. */
  CINE_LAUNCH_CELL_MAX_PX: 2,
  /** The launch camera starts this much closer on the pad and dollies out over the first 1.5 s (0 = fixed). */
  CINE_LAUNCH_DOLLY: 1.3,
  /** The 3-D launch vehicle's length relative to the old sprite's. */
  CINE_VEHICLE_SCALE: 1.25,
  /** Pad smoke grains at liftoff (owner 2026-10-24: tiny pixels, never blocks). */
  CINE_PAD_SMOKE: 460,
  /** Ember sparks: tiny false-colour pixels shed from each nozzle, count per nozzle and lifetime, s. */
  CINE_EMBERS: 40,
  CINE_EMBER_LIFE_S: 0.55,
  /** The system map's planets grow from dots into globes (render/globe.ts) past zoom MAP_GLOBE_ZOOM, from
   *  MAP_GLOBE_MIN_PX up to MAP_GLOBE_MAX_PX radius; the wheel zooms 0.2x to 40x [knob]. */
  MAP_GLOBE_ZOOM: 2.5,
  MAP_GLOBE_MIN_PX: 12,
  MAP_GLOBE_MAX_PX: 80,
  /** PLAY IT OUT (F, game/playOut.ts; owner 2026-10-24): the rest of the round in fixed real seconds. BUILD_S from now
   *  to the first launch, FLIGHT_S from launch to the last arrival (the launch scene cut to LAUNCH_SCENE_S and each hit
   *  scene to HIT_SCENE_S inside it), COAST_S to the close approach (the end scene at END_SCENE_S, then RESULT_HOLD_S
   *  on the result before the debrief). No span's clock part goes under MIN_SPAN_S [knob]. */
  PLAY_OUT: { BUILD_S: 3, FLIGHT_S: 20, LAUNCH_SCENE_S: 1, HIT_SCENE_S: 2, COAST_S: 20, END_SCENE_S: 3, RESULT_HOLD_S: 2, MIN_SPAN_S: 2 },
  /** Impact, breakup and trail debris pixel size relative to the old chunky size (1 = old). */
  CINE_DEBRIS_PX_SCALE: 0.6,
  /** Spray is never a block (owner 2026-10-24): the largest debris pixel in an impact or breakup scene, px. */
  CINE_SPRAY_MAX_PX: 2,
  /** Spray counts per scene kind: an impact's ejecta cone (scaled by beta), a breakup's cloud, a burst's ablation. */
  CINE_SPRAY: { IMPACT: 420, BREAKUP: 900, ABLATION: 220 },
  /** Most solid pieces a breakup draws (solid.ts; each is a 20-face wireframe, so this bounds the frame cost). */
  CINE_CHUNKS_MAX: 64,
  /** A fresh impact or breakup particle burns in false colour for this fraction of its life. */
  CINE_HOT_EJECTA_FRAC: 0.35,
  /** The pull-back camera keeps the debris cloud inside this fraction of the short side of the screen. */
  CINE_CAMERA_FIT: 0.42,
  /** A debris pixel is drawn in false colour for this long after it is born (hot ejecta), s. */
  CINE_HOT_EJECTA_S: 0.14,
} as const;
