// WHAT: Every tunable constant of the PERIMETER minigame in one place.
// WHY:  GAME_PLAN 0: every [knob] lives in a config file with its default, so balancing is data work, not
//       a code hunt. The minigame is the arcade side-mode: a 2-D planet, launchers riding the limb,
//       pixels against incoming rocks. It shares the look and the seeded RNG with the real sim but none
//       of its physics; its job is to be fun in thirty seconds.
// HOW:  Units are "planet radii" for length and seconds for time. Difficulty curves are plain functions
//       of elapsed time (see sim.ts) so they can be unit-tested and plotted.
// LORE: G1 (how to play), G5 (scoring)

export const MG = {
  /** World geometry, in planet radii. */
  PLANET_R: 1,
  /** Asteroids spawn on this circle. */
  FIELD_R: 5.6,
  /** The renderer fits this radius on the shorter screen axis. */
  VIEW_R: 6.2,

  /** Planet hull points. Each asteroid hit removes DAMAGE_PER_R * r, clamped. Game over at 0. */
  MAX_HP: 100,
  DAMAGE_PER_R: 30,
  DAMAGE_MIN: 3,
  DAMAGE_MAX: 22,

  /** Launcher motion along the limb (rad/s) and firing. */
  LAUNCHER_SPEED: 2.6,
  FIRE_COOLDOWN: 0.12,
  BULLET_SPEED: 7.5,
  BULLET_LIFE: 1.25,
  /** Bullet collision radius; small, they are pixels. */
  BULLET_R: 0.05,
  /** Angular gap between neighbouring streams (rad). */
  STREAM_SPREAD: 0.085,

  /** Launchers double at these times: 1 -> 2 -> 4 -> 8. */
  LAUNCHER_DOUBLE_TIMES: [40, 110, 220] as readonly number[],
  /** Bullet streams per launcher step up at these times: 1 -> 2 -> 3 -> 4 -> 5. */
  STREAM_TIMES: [25, 80, 160, 280] as readonly number[],

  /** Spawn interval decays exponentially from SPAWN_0 with time constant SPAWN_TAU, floored at SPAWN_MIN. */
  SPAWN_0: 1.9,
  SPAWN_TAU: 120,
  SPAWN_MIN: 0.28,
  /** Asteroid speed (radii/s): linear ramp with a cap. */
  AST_SPEED_0: 0.55,
  AST_SPEED_RAMP: 1 / 220,
  AST_SPEED_MAX: 2.4,
  /** Asteroid radius range at spawn; big ones split into two children when destroyed. */
  AST_R_MIN: 0.14,
  AST_R_MAX: 0.42,
  AST_SPLIT_R: 0.26,
  AST_CHILD_SCALE: 0.58,
  /** Hit points: one per AST_HP_UNIT of radius, at least 1. */
  AST_HP_UNIT: 0.14,
  /** Aim jitter: asteroids aim at a random point within this radius of the planet centre. */
  AST_AIM_SCATTER: 0.7,

  /** Pulses: a shockwave that clears the field. Earned every PULSE_KILLS kills, stock capped. */
  PULSE_KILLS: 12,
  PULSE_MAX: 3,
  PULSE_SPEED: 9,
  /** Score multiplier for pulse kills (they are free). */
  PULSE_SCORE_MULT: 0.5,

  /** Points per planet-radius of asteroid destroyed, plus one per second survived. */
  SCORE_PER_R: 100,
  SCORE_PER_SEC: 1,

  /** Effects budget. */
  PARTICLES_PER_HIT: 10,
  PARTICLES_PER_IMPACT: 24,
  PARTICLE_LIFE: 0.7,
  MAX_BULLETS: 800,
  MAX_PARTICLES: 1500,
  MAX_ASTEROIDS: 120,
  /** Camera shake impulse per hull point lost, in planet radii. */
  SHAKE_PER_HP: 0.004,

  /** Fixed simulation step (s) and the cap on steps per rendered frame. */
  DT: 1 / 120,
  MAX_STEPS_PER_FRAME: 8,
} as const;
