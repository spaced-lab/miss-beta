// WHAT: Every tunable constant of the PERIMETER minigame in one place.
// WHY:  GAME_PLAN 0: every [knob] lives in a config file with its default, so balancing is data work, not
//       a code hunt. PERIMETER is the arcade side-mode: a 2-D planet, launchers riding the limb, pixels
//       against incoming rocks, a moon that bends paths, heat that forces pauses, and difficulty that
//       adapts to how the player is doing.
// HOW:  Units are "planet radii" for length and seconds for time. Progression is by LEVEL (one every
//       LEVEL_SECONDS); the *_BY_LEVEL tables are read with the last entry repeating, so the game is open
//       ended. Difficulty curves are plain functions in sim.ts so they can be unit-tested and plotted.
// LORE: G1 (how to play), G5 (scoring), D3 (kinetic and beta: the bullet impulse is a toy version)

export const MG = {
  /** World geometry, in planet radii. */
  PLANET_R: 1,
  FIELD_R: 5.6,
  VIEW_R: 6.2,

  /** Hull. Each rock hit removes DAMAGE_PER_R * r * (1 + 0.5 * tier), clamped. Game over at 0. */
  MAX_HP: 100,
  DAMAGE_PER_R: 30,
  DAMAGE_MIN: 3,
  DAMAGE_MAX: 25,

  /** Levels. */
  LEVEL_SECONDS: 28,
  /** Index = level - 1; the last entry repeats. */
  STREAMS_BY_LEVEL: [1, 1, 2, 2, 3, 3, 4, 4, 5] as readonly number[],
  LAUNCHERS_BY_LEVEL: [1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 8] as readonly number[],
  MAX_TIER_BY_LEVEL: [0, 0, 1, 1, 1, 2, 2, 2, 3] as readonly number[],
  /** Features unlock at these levels. */
  PASSING_LEVEL: 2,
  MOON_LEVEL: 3,
  TURRET_LEVEL: 6,
  /** Neon colour stages: 0 all green; 1 tier colours; 2 bullet colours; 3 full spectrum accents. */
  SPECTRUM_LEVELS: [3, 4, 6] as readonly number[],

  /** Launcher motion along the limb (rad/s) and firing. */
  LAUNCHER_SPEED: 2.6,
  FIRE_COOLDOWN: 0.12,
  BULLET_SPEED: 7.5,
  BULLET_LIFE: 1.25,
  BULLET_R: 0.05,
  STREAM_SPREAD: 0.085,
  /** Impulse (planet radii/s) a damage-1 bullet gives a tier-0 rock of radius 0.3. Scales with damage / mass. */
  BULLET_IMPULSE: 0.22,

  /** Heat: each trigger pull adds HEAT_PER_SHOT; heat cools at HEAT_COOL per second; at 1.0 fire locks
   *  until heat falls below HEAT_UNLOCK. Continuous fire overheats in about 6 s. */
  HEAT_PER_SHOT: 0.05,
  HEAT_COOL: 0.25,
  HEAT_UNLOCK: 0.35,

  /** Spawning: base interval per level decays geometrically to a floor; speed ramps linearly to a cap. */
  SPAWN_0: 1.8,
  SPAWN_LEVEL_FACTOR: 0.88,
  SPAWN_MIN: 0.3,
  AST_SPEED_0: 0.55,
  AST_SPEED_PER_LEVEL: 0.06,
  AST_SPEED_MAX: 2.2,
  AST_R_MIN: 0.14,
  AST_R_MAX: 0.42,
  AST_SPLIT_R: 0.26,
  AST_CHILD_SCALE: 0.58,
  AST_HP_UNIT: 0.14,
  AST_AIM_SCATTER: 0.7,
  /** Passing rocks aim at a point this far from the centre: they miss unless deflected. */
  PASS_PROB: 0.3,
  PASS_AIM_MIN: 1.7,
  PASS_AIM_MAX: 3.2,

  /** Hardness tiers 0..3: hit-point, mass (for impulse) and score multipliers. */
  TIER_HP_MULT: [1, 2, 3, 4] as readonly number[],
  TIER_MASS_MULT: [1, 1.6, 2.5, 4] as readonly number[],
  TIER_SCORE_MULT: [1, 2, 3, 5] as readonly number[],
  /** Spawn weight of a tier relative to the next lower tier (so higher tiers stay rarer). */
  TIER_WEIGHT_DECAY: 0.55,
  /** When a tier >= 1 rock splits, chance that one shard is a small hard core one tier up. */
  HARD_CORE_PROB: 0.18,
  HARD_CORE_SCALE: 0.42,
  HARD_CORE_SCORE_MULT: 3,

  /** Adaptive pressure multiplies spawn rate and speed. */
  PRESSURE_MIN: 0.6,
  PRESSURE_MAX: 1.5,
  PRESSURE_GAIN: 0.012,
  PRESSURE_HIT_DROP: 0.08,
  PRESSURE_CALM_SECONDS: 6,
  PRESSURE_LOW_HP: 0.35,
  PRESSURE_LOW_TARGET: 0.7,
  PRESSURE_LOW_RATE: 0.05,

  /** Moon: orbits the planet, bends nearby rocks, absorbs whatever hits it. */
  MOON_ORBIT_R: 2.6,
  MOON_ANGULAR_SPEED: 0.35,
  MOON_R: 0.22,
  MOON_MU: 0.9,
  MOON_INFLUENCE: 1.4,

  /** Auto turrets: earned every TURRET_HITS direct hits from TURRET_LEVEL on; orbit and fire on their own. */
  TURRET_HITS: 60,
  TURRET_MAX: 2,
  TURRET_LIFE: 20,
  TURRET_ORBIT_R: 2.0,
  TURRET_ANGULAR_SPEED: 0.9,
  TURRET_COOLDOWN: 0.28,

  /** Pulses: a shockwave that clears the field. Earned every PULSE_KILLS kills, stock capped. */
  PULSE_KILLS: 14,
  PULSE_MAX: 3,
  PULSE_SPEED: 9,
  PULSE_SCORE_MULT: 0.5,

  /** Score: per planet-radius destroyed times tier multiplier, plus one per second survived. */
  SCORE_PER_R: 100,
  SCORE_PER_SEC: 1,

  /** Effects budget. */
  PARTICLES_PER_HIT: 10,
  PARTICLES_PER_IMPACT: 24,
  PARTICLE_LIFE: 0.7,
  MAX_BULLETS: 900,
  MAX_PARTICLES: 1500,
  MAX_ASTEROIDS: 140,
  SHAKE_PER_HP: 0.004,

  /** Fixed simulation step (s) and the cap on steps per rendered frame. */
  DT: 1 / 120,
  MAX_STEPS_PER_FRAME: 8,
} as const;

/** Read a by-level table with the last entry repeating. */
export function byLevel(table: readonly number[], level: number): number {
  const i = Math.max(0, Math.min(table.length - 1, level - 1));
  return table[i] ?? 1;
}
