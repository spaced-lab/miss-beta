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

  /** Hull. Each rock hit removes DAMAGE_PER_R * r * (1 + 0.5 * tier), clamped between DAMAGE_MIN and the
   *  level's entry in DAMAGE_MAX_BY_LEVEL (a gentler cap while the player learns). From DAMAGE_MAX_FROM_LEVEL
   *  the cap keeps rising DAMAGE_MAX_PER_LEVEL per level (sim.damageMax), so late rocks keep their bite.
   *  Game over at 0. */
  MAX_HP: 100,
  DAMAGE_PER_R: 30,
  DAMAGE_MIN: 3,
  DAMAGE_MAX_BY_LEVEL: [12, 16, 25] as readonly number[],
  DAMAGE_MAX_FROM_LEVEL: 10,
  DAMAGE_MAX_PER_LEVEL: 0.4,

  /** Levels. */
  LEVEL_SECONDS: 20,
  /** Index = level - 1; the last entry repeats. */
  STREAMS_BY_LEVEL: [1, 1, 2, 2, 3, 3, 4, 4, 5] as readonly number[],
  LAUNCHERS_BY_LEVEL: [1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 8] as readonly number[],
  /** Tier 3 from level 9, tier 4 from level 14, tier 5 from level 22 (anti-plateau retune, 2026-10-17). */
  MAX_TIER_BY_LEVEL: [0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 5] as readonly number[],
  /** Rock hit points scale with level from HP_MULT_FROM_LEVEL: x(1 + HP_MULT_PER_LEVEL * levels past it), applied
   *  on spawn (sim.hpMult). Level 10: x1, level 30: x2, level 45: x2.75. */
  HP_MULT_FROM_LEVEL: 10,
  HP_MULT_PER_LEVEL: 0.05,
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

  /** Spawning: base interval per level decays geometrically to a floor; speed ramps linearly to a cap.
   *  Tuned 2026-10-17: a gentler level 1-2 (longer first interval, slower first rocks) and a steeper ramp
   *  after (faster interval decay, more speed per level, 20 s levels).
   *  No plateau (same day, owner: "it seemed to plateau around 30"): neither cap is hard any more. The spawn
   *  floor itself shrinks SPAWN_FLOOR_FACTOR per level from SPAWN_FLOOR_FROM_LEVEL (the level where the
   *  geometric curve first meets SPAWN_MIN) down to SPAWN_FLOOR_ABS; the speed cap rises AST_SPEED_CAP_PER_LEVEL
   *  per level past AST_SPEED_CAP_FROM_LEVEL (where the linear ramp meets AST_SPEED_MAX). Levels 1-5 are untouched. */
  SPAWN_0: 2.2,
  SPAWN_LEVEL_FACTOR: 0.78,
  SPAWN_MIN: 0.3,
  SPAWN_FLOOR_FROM_LEVEL: 9,
  SPAWN_FLOOR_FACTOR: 0.985,
  SPAWN_FLOOR_ABS: 0.12,
  AST_SPEED_0: 0.45,
  AST_SPEED_PER_LEVEL: 0.12,
  AST_SPEED_MAX: 2.2,
  AST_SPEED_CAP_FROM_LEVEL: 15,
  AST_SPEED_CAP_PER_LEVEL: 0.025,
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

  /** Rock-on-rock dynamics: mutual gravity within AST_GRAV_RANGE (toy G = AST_G on rockMass units),
   *  elastic bounces with restitution AST_RESTITUTION, both rocks chipped when the closing speed exceeds
   *  AST_CRASH_SPEED. From BINARY_LEVEL some spawns are pairs with circular orbital velocity. */
  AST_G: 0.16,
  AST_GRAV_RANGE: 1.3,
  AST_RESTITUTION: 0.6,
  AST_CRASH_SPEED: 1.1,
  BINARY_LEVEL: 4,
  BINARY_PROB: 0.18,

  /** Hardness tiers 0..5: hit-point, mass (for impulse) and score multipliers. Tiers 4 and 5 arrive at the
   *  levels in MAX_TIER_BY_LEVEL; the three tables must stay the same length (sim.MAX_TIER is derived). */
  TIER_HP_MULT: [1, 2, 3, 4, 5.5, 7] as readonly number[],
  TIER_MASS_MULT: [1, 1.6, 2.5, 4, 6, 9] as readonly number[],
  TIER_SCORE_MULT: [1, 2, 3, 5, 8, 12] as readonly number[],
  /** Spawn weight of a tier relative to the next lower tier (so higher tiers stay rarer). */
  TIER_WEIGHT_DECAY: 0.6,
  /** When a tier >= 1 rock splits, chance that one shard is a small hard core one tier up. */
  HARD_CORE_PROB: 0.18,
  HARD_CORE_SCALE: 0.42,
  HARD_CORE_SCORE_MULT: 3,

  /** Adaptive pressure multiplies spawn rate and speed. Starts a little below 1 so the opening is calm.
   *  The ceiling rises PRESSURE_MAX_PER_LEVEL per level past PRESSURE_MAX_FROM_LEVEL (sim.pressureMax). */
  PRESSURE_START: 0.85,
  PRESSURE_MIN: 0.6,
  PRESSURE_MAX: 1.6,
  PRESSURE_MAX_FROM_LEVEL: 10,
  PRESSURE_MAX_PER_LEVEL: 0.02,
  PRESSURE_GAIN: 0.015,
  PRESSURE_HIT_DROP: 0.08,
  PRESSURE_CALM_SECONDS: 6,
  PRESSURE_LOW_HP: 0.35,
  PRESSURE_LOW_TARGET: 0.7,
  PRESSURE_LOW_RATE: 0.05,

  /** Moon: orbits the planet, bends nearby rocks, absorbs whatever hits it. */
  MOON_ORBIT_R: 3.4,
  MOON_ANGULAR_SPEED: 0.3,
  MOON_R: 0.26,
  MOON_MU: 1.1,
  MOON_INFLUENCE: 1.6,
  /** The moon is super solid: rocks chip it by their hull damage; bullets do nothing. At 0 it is lost. */
  MOON_HP: 600,

  /** Auto turrets: earned every TURRET_HITS direct hits from TURRET_LEVEL on; orbit and fire on their own. */
  TURRET_HITS: 60,
  TURRET_MAX: 3,
  TURRET_LIFE: 12,
  TURRET_ORBIT_R: 2.0,
  TURRET_ANGULAR_SPEED: 0.9,
  TURRET_COOLDOWN: 0.28,
  /** Sentry tier rises one step every TURRET_TIER_LEVELS levels after TURRET_LEVEL (max 2): more damage, faster. */
  TURRET_TIER_LEVELS: 3,
  /** SUPER sentries: random share of earned ones, and a level-up gift with this chance; 3-way, double rate, longer. */
  TURRET_SUPER_PROB: 0.25,
  TURRET_GIFT_PROB: 0.35,
  TURRET_SUPER_LIFE_MULT: 1.5,

  /** Sentry archetypes (sim.SentryKind), one drawn per deploy. ORBITER is the classic ring rider.
   *  SWEEPER oscillates +-SENTRY_SWEEP_ARC around its home angle (phase advances SENTRY_SWEEP_RATE rad/s),
   *  faces outward and fires SENTRY_BURST shots SENTRY_BURST_GAP apart, then rests SENTRY_BURST_REST. */
  SENTRY_SWEEP_ARC: 0.85,
  SENTRY_SWEEP_RATE: 1.3,
  SENTRY_BURST: 4,
  SENTRY_BURST_GAP: 0.07,
  SENTRY_BURST_REST: 1.0,
  /** PICKET re-reads the field every SENTRY_PICKET_RETARGET s, splits it into SENTRY_PICKET_SECTORS sectors
   *  weighted by 1 / distance of the incoming rocks, and turns toward the densest at SENTRY_PICKET_TURN rad/s. */
  SENTRY_PICKET_RETARGET: 1.5,
  SENTRY_PICKET_SECTORS: 12,
  SENTRY_PICKET_TURN: 2.2,
  /** CHASER leaves the ring and drifts toward the most threatening rock at SENTRY_CHASE_SPEED (radii/s),
   *  stopping SENTRY_CHASE_STANDOFF short of it, never further than SENTRY_CHASE_LEASH from its home point
   *  and never inside SENTRY_CHASE_R_MIN of the planet's centre. With nothing to chase it drifts home. */
  SENTRY_CHASE_SPEED: 1.6,
  SENTRY_CHASE_LEASH: 1.7,
  SENTRY_CHASE_STANDOFF: 0.9,
  SENTRY_CHASE_R_MIN: 1.45,

  /** Laser pulse: from 3 streams, the first shot after a break fires a beam down the centre stream of the
   *  player's launcher instead of that stream's projectile; from 5 streams every launcher does, and the
   *  break needed is shorter. Damage is the strength level plus LASER_DAMAGE_BONUS; impulse is multiplied. */
  LASER_BREAK_1: 1.2,
  LASER_BREAK_2: 0.6,
  LASER_DAMAGE_BONUS: 1,
  LASER_HEAT: 0.1,
  LASER_IMPULSE_MULT: 3,
  LASER_RANGE: 7.2,
  BEAM_FADE: 0.18,

  /** Pulses: a shockwave that clears the field. Earned every PULSE_KILLS kills, stock capped. */
  PULSE_KILLS: 14,
  PULSE_MAX: 3,
  PULSE_SPEED: 9,
  PULSE_SCORE_MULT: 0.5,

  /** Seeker missiles (`<`): earned every SEEKER_HITS direct hits, stock capped at SEEKER_MAX. Launched from
   *  the player's launcher at SEEKER_SPEED, a seeker turns toward the closest threatening rock (lead pursuit,
   *  turn rate capped at SEEKER_TURN rad/s), detonates on contact with a blast of radius SEEKER_BLAST_R that
   *  deals SEEKER_BLAST_DAMAGE and pushes rocks outward (SEEKER_BLAST_IMPULSE / mass), or fizzles after
   *  SEEKER_LIFE seconds. */
  SEEKER_HITS: 35,
  SEEKER_MAX: 3,
  SEEKER_SPEED: 4.2,
  SEEKER_TURN: 4.5,
  SEEKER_LIFE: 4.5,
  SEEKER_R: 0.06,
  SEEKER_BLAST_R: 0.9,
  SEEKER_BLAST_DAMAGE: 4,
  SEEKER_BLAST_IMPULSE: 1.4,
  SEEKER_TRAIL: 6,

  /** Swarm of sentinels (`>`): earned every SWARM_KILLS kills, stock capped at SWARM_MAX. Releases
   *  SWARM_COUNT_MIN..MAX drones from the player's launcher fanned over SWARM_FAN rad; each hunts the nearest
   *  rock at SWARM_SPEED (turn rate SWARM_TURN), orbits it at SWARM_STANDOFF, keeps SWARM_SEPARATION from its
   *  siblings, fires 1-damage bullets at BULLET_SPEED * SWARM_BULLET_SPEED every SWARM_COOLDOWN when within
   *  SWARM_RANGE, and burns out after SWARM_LIFE seconds. Count and life grow with level (below). */
  SWARM_KILLS: 22,
  SWARM_MAX: 2,
  SWARM_COUNT_MIN: 5,
  SWARM_COUNT_MAX: 8,
  SWARM_FAN: 2.0,
  SWARM_SPEED: 2.4,
  SWARM_TURN: 6,
  SWARM_STANDOFF: 0.7,
  SWARM_SEPARATION: 0.3,
  SWARM_RANGE: 2.2,
  SWARM_COOLDOWN: 0.2,
  SWARM_BULLET_SPEED: 1.3,
  SWARM_BULLET_LIFE: 0.6,
  SWARM_DAMAGE: 1,
  SWARM_LIFE: 10,
  SWARM_R_MIN: 1.35,
  /** Growth with level: a release at level L adds floor(SWARM_GROWTH_PER_LEVEL * (L - 1)) drones to both ends
   *  of the count range, capped at SWARM_COUNT_CAP (level 1: 5-8, level 9: 9-12, level 17+: 16 flat); the
   *  burn-out life grows SWARM_LIFE_PER_LEVEL seconds per level up to SWARM_LIFE_MAX. */
  SWARM_GROWTH_PER_LEVEL: 0.5,
  SWARM_COUNT_CAP: 16,
  SWARM_LIFE_PER_LEVEL: 0.25,
  SWARM_LIFE_MAX: 14,
  /** The moon's no-fly zone: MOON_R + margin. Drones are steered away from it and never cross it (one that
   *  ends a step inside is slid back to the edge, so none parks where the moon eats its bullets); seekers
   *  blend an away term into their pursuit within 1.5 zone radii. A rock inside the zone counts
   *  MOON_AVOID_PENALTY radii farther when a drone or seeker picks a target: the moon will take it anyway. */
  SWARM_MOON_MARGIN: 0.6,
  SEEKER_MOON_MARGIN: 0.5,
  MOON_AVOID_PENALTY: 2.5,

  /** Score: per planet-radius destroyed times tier multiplier, plus one per second survived. */
  SCORE_PER_R: 100,
  SCORE_PER_SEC: 1,

  /** Effects budget. */
  PARTICLES_PER_HIT: 10,
  PARTICLES_PER_IMPACT: 24,
  PARTICLE_LIFE: 0.7,
  MAX_BULLETS: 900,
  MAX_PARTICLES: 1500,
  /** Rock budget grows MAX_ASTEROIDS_PER_LEVEL per level up to MAX_ASTEROIDS_CAP (sim.maxAsteroids), so the
   *  shrinking spawn floor is not quietly undone by the budget. */
  MAX_ASTEROIDS: 140,
  MAX_ASTEROIDS_PER_LEVEL: 2,
  MAX_ASTEROIDS_CAP: 220,
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
