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
  /** Seconds of play per turn of the planet globe (render only) [knob]. */
  PLANET_SPIN_S: 150,
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
  LEVEL_SECONDS: 17,
  /** Index = level - 1; the last entry repeats. */
  STREAMS_BY_LEVEL: [1, 1, 2, 2, 3, 3, 4, 4, 5] as readonly number[],
  LAUNCHERS_BY_LEVEL: [1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 8] as readonly number[],
  /** Tier 3 from level 9, tier 4 from level 14, tier 5 from level 22 (anti-plateau retune, 2026-10-17). */
  MAX_TIER_BY_LEVEL: [0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 5] as readonly number[],
  /** Rock hit points scale with level from HP_MULT_FROM_LEVEL: x(1 + HP_MULT_PER_LEVEL * levels past it), applied
   *  on spawn (sim.hpMult). Level 10: x1, level 15: x1.75, level 30: x4, level 45: x6.25. The balance probe
   *  (tests/minigame.test.ts) showed this is the one axis that gets rocks through a full arsenal: faster or
   *  denser rocks were simply killed at the rate they spawned; tougher ones arrive. */
  HP_MULT_FROM_LEVEL: 10,
  // NOTE: owner 2026-10-21 ("a little too difficult, ease up on that difficulty slope just a bit"): 0.3 -> 0.26
  // (level 30: x4 -> x3.6), with the late speed slope and the spawn floor below eased a notch; levels 1-9 untouched.
  // 2026-10-23: back to 0.30 as the counterweight to the bigger MIRV (SEEKER_MIRV_*): the bot's curve then matched the
  // 2026-10-21 table again. 2026-10-24 (owner: "a little easier, in between the last adjustment and this latest one...
  // if someone wants harder they can go up a level"): 0.28 (level 30: x3.8; bot NORMAL from level 1 637-733 s, L38-44); the speed
  // slope and spawn floor stay eased.
  HP_MULT_PER_LEVEL: 0.28,
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
  SPAWN_LEVEL_FACTOR: 0.75,
  SPAWN_MIN: 0.3,
  SPAWN_FLOOR_FROM_LEVEL: 9,
  SPAWN_FLOOR_FACTOR: 0.94,
  SPAWN_FLOOR_ABS: 0.05,
  AST_SPEED_0: 0.45,
  AST_SPEED_PER_LEVEL: 0.14,
  /** A second slope joins past AST_SPEED_LATE_FROM_LEVEL ("minigame needs to get faster"): the ramp steepens by
   *  AST_SPEED_LATE_PER_LEVEL per level there, under the cap below. */
  AST_SPEED_LATE_FROM_LEVEL: 10,
  AST_SPEED_LATE_PER_LEVEL: 0.085,
  AST_SPEED_MAX: 2.2,
  AST_SPEED_CAP_FROM_LEVEL: 10,
  AST_SPEED_CAP_PER_LEVEL: 0.06,
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
  PRESSURE_MAX_PER_LEVEL: 0.03,
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

  /** Auto turrets: earned every TURRET_HITS direct hits from TURRET_LEVEL on; orbit and fire on their own.
   *  Scaling (sim.turretHitsNeeded, sim.turretMax): the hits needed ease TURRET_HITS_EASE_PER_LEVEL per level past
   *  TURRET_HITS_EASE_FROM_LEVEL down to TURRET_HITS_MIN; the cap grows one per TURRET_MAX_LEVELS levels after
   *  TURRET_LEVEL up to TURRET_MAX_CAP (3 at level 6, 4 at 12, 5 at 18, 6 from 24). */
  TURRET_HITS: 60,
  TURRET_HITS_EASE_FROM_LEVEL: 10,
  TURRET_HITS_EASE_PER_LEVEL: 2,
  TURRET_HITS_MIN: 36,
  TURRET_MAX: 3,
  TURRET_MAX_LEVELS: 6,
  TURRET_MAX_CAP: 6,
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
  /** Sentry lasers (v3.4): from SENTRY_LASER_LEVEL every sentry also fires a beam along its aim every
   *  SENTRY_LASER_PERIOD s (divided by its fire-rate factor), reaching SENTRY_LASER_RANGE radii from the sentry, for
   *  strength + SENTRY_LASER_TIER_DAMAGE x tier (+1 for SUPER) damage with the laser's impulse. Drawn in the sentry's
   *  tier colour (lime, cyan, magenta; SUPER cycles): the beams get stronger and change colour as the sentries do. */
  SENTRY_LASER_LEVEL: 14,
  SENTRY_LASER_PERIOD: 2.4,
  SENTRY_LASER_RANGE: 3.6,
  SENTRY_LASER_TIER_DAMAGE: 2,
  /** Beam array (v3.4, owner: "sentinels coordinate around level 25"): from SENTRY_ARRAY_LEVEL, every SENTRY_ARRAY_PERIOD s
   *  with at least SENTRY_ARRAY_MIN sentries alive, all of them fire at the most threatening rock at once. That rock is
   *  eliminated outright (no fragments, score x SENTRY_ARRAY_SCORE_MULT) and every other rock a beam crosses takes
   *  SENTRY_ARRAY_DAMAGE. White-hot beams, a sub chord. */
  SENTRY_ARRAY_LEVEL: 25,
  SENTRY_ARRAY_PERIOD: 12,
  SENTRY_ARRAY_MIN: 3,
  SENTRY_ARRAY_DAMAGE: 6,
  SENTRY_ARRAY_SCORE_MULT: 1,

  /** Laser pulse: from 3 streams, the first shot after a break fires a beam down the centre stream of the
   *  player's launcher instead of that stream's projectile; from 5 streams every launcher does, and the
   *  break needed is shorter. Damage is the strength level plus LASER_DAMAGE_BONUS; impulse is multiplied.
   *  Reach grows LASER_RANGE_STEP radii every LASER_RANGE_STEP_LEVELS levels up to LASER_RANGE_CAP (the field
   *  edge plus margin; sim.laserRange). MESH (stage 3, from LASER_MESH_LEVEL with 5 streams): every launcher
   *  fires a fan of 3 beams at -LASER_FAN_SPREAD, 0, +LASER_FAN_SPREAD so neighbouring fans cross; stage 4
   *  (from LASER_MESH2_LEVEL) fans 5 beams. The break needed stays LASER_BREAK_2. */
  LASER_BREAK_1: 1.2,
  LASER_BREAK_2: 0.6,
  LASER_DAMAGE_BONUS: 1,
  LASER_HEAT: 0.1,
  LASER_IMPULSE_MULT: 3,
  LASER_RANGE: 7.2,
  LASER_RANGE_STEP: 0.5,
  LASER_RANGE_STEP_LEVELS: 5,
  LASER_RANGE_CAP: 8.6,
  LASER_MESH_LEVEL: 12,
  LASER_MESH2_LEVEL: 20,
  LASER_FAN_SPREAD: 0.32,
  BEAM_FADE: 0.18,

  /** Pulses: a shockwave that clears the field. Earned every PULSE_KILLS kills, stock capped. The kills needed grow
   *  PULSE_KILLS_PER_LEVEL per level past PULSE_KILLS_FROM_LEVEL (sim.pulseKillsNeeded): kill rates climb with the
   *  spawn rate, and a field-clear every few seconds would undo the difficulty curve. */
  PULSE_KILLS: 14,
  PULSE_KILLS_FROM_LEVEL: 6,
  PULSE_KILLS_PER_LEVEL: 2,
  PULSE_MAX: 3,
  PULSE_SPEED: 9,
  PULSE_SCORE_MULT: 0.5,

  /** Seeker missiles (`<`): earned every SEEKER_HITS direct hits, stock capped at SEEKER_MAX. Launched from
   *  the player's launcher at SEEKER_SPEED, a seeker turns toward the closest threatening rock (lead pursuit,
   *  turn rate capped at SEEKER_TURN rad/s), detonates on contact with a blast of radius SEEKER_BLAST_R that
   *  deals SEEKER_BLAST_DAMAGE and pushes rocks outward (SEEKER_BLAST_IMPULSE / mass), or fizzles after
   *  SEEKER_LIFE seconds.
   *  Scaling (sim.seekerHitsNeeded, sim.seekerMax, sim.seekerVolley): the hits needed ease
   *  SEEKER_HITS_EASE_PER_LEVEL per level past SEEKER_HITS_EASE_FROM_LEVEL down to SEEKER_HITS_MIN; the stock cap
   *  grows one per SEEKER_MAX_LEVELS levels up to SEEKER_MAX_CAP (3, then 4 at level 9, 5 at 17, 6 at 25); one
   *  stock launches a volley of 1 + (levels in SEEKER_VOLLEY_LEVELS reached) seekers fanned SEEKER_VOLLEY_SPREAD apart. */
  SEEKER_HITS: 35,
  SEEKER_HITS_EASE_FROM_LEVEL: 10,
  SEEKER_HITS_EASE_PER_LEVEL: 1,
  SEEKER_HITS_MIN: 22,
  SEEKER_MAX: 3,
  SEEKER_MAX_LEVELS: 8,
  SEEKER_MAX_CAP: 6,
  SEEKER_VOLLEY_LEVELS: [10, 20, 30] as readonly number[],
  SEEKER_VOLLEY_SPREAD: 0.3,
  SEEKER_SPEED: 4.2,
  SEEKER_TURN: 4.5,
  SEEKER_LIFE: 4.5,
  SEEKER_R: 0.06,
  SEEKER_BLAST_R: 0.9,
  SEEKER_BLAST_DAMAGE: 4,
  SEEKER_BLAST_IMPULSE: 1.4,
  SEEKER_TRAIL: 6,
  /** MIRV (owner 2026-10-21: seekers "were originally intended to split when they get close into a MIRV and hit, but
   *  never see that"; 2026-10-23: "split and divide into multiple warheads, more as the game progresses"): a seeker
   *  that closes within SEEKER_MIRV_R of its target's surface splits into SEEKER_MIRV_N + one per SEEKER_MIRV_LEVELS
   *  levels (capped at SEEKER_MIRV_CAP) warheads fanned SEEKER_MIRV_FAN rad apart (the whole fan no wider than
   *  SEEKER_MIRV_FAN_MAX): the first keeps the bus's target, the others take the nearest other rocks within
   *  SEEKER_MIRV_SEARCH of it. Warheads fly SEEKER_MIRV_SPEED_X faster, turn SEEKER_MIRV_TURN_X sharper, live
   *  SEEKER_MIRV_LIFE s and burst for SEEKER_MIRV_DAMAGE in SEEKER_MIRV_BLAST_R (the bus's own blast is 4 in 0.9).
   *  Second stage, from level SEEKER_MIRV_STAGE2_LEVEL: each warhead within SEEKER_MIRV_STAGE2_R of its target divides
   *  again into SEEKER_MIRV_STAGE2_N (+1 per SEEKER_MIRV_STAGE2_LEVELS levels past that, cap SEEKER_MIRV_STAGE2_CAP)
   *  sub-warheads, SEEKER_MIRV_STAGE2_SPEED_X faster again, that live SEEKER_MIRV_STAGE2_LIFE s and burst for
   *  SEEKER_MIRV_STAGE2_DAMAGE in SEEKER_MIRV_STAGE2_BLAST_R. Warheads per seeker: 3 (L1) 4 (L5) 5 (L10) 6 (L15) ...
   *  9 (L30+); sub-warheads per warhead: 2 (L16) 3 (L28) 4 (L40+). Balance 2026-10-23 (docs/MINIGAME_BACKLOG.md): with
   *  sub-warheads at 2 damage from level 12 the bot from level 1 lived 599-900+ s (one seed never died); sub-warheads
   *  at 1 damage in 0.35, the division from 16 and HP_MULT_PER_LEVEL back at 0.30 give 464-624 s, the curve of the
   *  2026-10-21 table (480-584 s). Seeker price alone (SEEKER_HITS 50 or 60) did not bite: 367-842 s. */
  SEEKER_MIRV_R: 2.4,
  SEEKER_MIRV_N: 3,
  SEEKER_MIRV_LEVELS: 5,
  SEEKER_MIRV_CAP: 9,
  SEEKER_MIRV_FAN: 0.55,
  SEEKER_MIRV_FAN_MAX: 2.2,
  SEEKER_MIRV_SEARCH: 2.6,
  SEEKER_MIRV_SPEED_X: 1.3,
  SEEKER_MIRV_TURN_X: 2,
  SEEKER_MIRV_LIFE: 1.6,
  SEEKER_MIRV_DAMAGE: 3,
  SEEKER_MIRV_BLAST_R: 0.6,
  SEEKER_MIRV_STAGE2_LEVEL: 16,
  SEEKER_MIRV_STAGE2_N: 2,
  SEEKER_MIRV_STAGE2_LEVELS: 12,
  SEEKER_MIRV_STAGE2_CAP: 4,
  SEEKER_MIRV_STAGE2_R: 1.0,
  SEEKER_MIRV_STAGE2_SEARCH: 1.6,
  SEEKER_MIRV_STAGE2_FAN: 0.6,
  SEEKER_MIRV_STAGE2_SPEED_X: 1.15,
  SEEKER_MIRV_STAGE2_LIFE: 0.9,
  SEEKER_MIRV_STAGE2_DAMAGE: 1,
  SEEKER_MIRV_STAGE2_BLAST_R: 0.35,
  /** Seekers of every stage in flight at once; a split makes only as many pieces as fit (never fewer than one).
   *  Measured 2026-10-23 without a cap: 969 at level 30 on EASY (four-bus volleys x 9 warheads x 3 sub-warheads), too
   *  many darts and trails for a phone to draw and the reason a CI run of tests/minigameModes.test.ts timed out. */
  MAX_SEEKERS: 200,

  /** Swarm of sentinels (`>`): earned every SWARM_KILLS kills, stock capped at SWARM_MAX. Releases
   *  SWARM_COUNT_MIN..MAX drones from the player's launcher fanned over SWARM_FAN rad; each hunts the nearest
   *  rock at SWARM_SPEED (turn rate SWARM_TURN), orbits it at SWARM_STANDOFF, keeps SWARM_SEPARATION from its
   *  siblings, fires 1-damage bullets at BULLET_SPEED * SWARM_BULLET_SPEED every SWARM_COOLDOWN when within
   *  SWARM_RANGE, and burns out after SWARM_LIFE seconds. Count and life grow with level (below). */
  SWARM_KILLS: 22,
  /** Kills per swarm grow SWARM_KILLS_PER_LEVEL per level past SWARM_KILLS_FROM_LEVEL, capped at SWARM_KILLS_CAP
   *  (sim.swarmKillsNeeded): 22 to level 6, 102 at 10, 202 at 15, 302 at 20, 400 from level 25 on. v3.2 used +30 and
   *  no cap (142 at 10, 442 at 20, 742 at 30); the owner found the swarm "not keeping up", so v3.3 cuts the slope and
   *  caps it. Measured 2026-10-17 with the armed balance-probe bot (god off, seeds 1..4): one charge every 11-15 s
   *  from level 8 on (per level: 7 s at 8, 8 s at 10, 12 s at 15, 13 s at 20-25, 11 s at 30; v3.2 gave 9 to 21 s).
   *  Gentler settings (15/300, 18/360) let the bot plateau above 60 hull at level 30 on one seed, so this is the
   *  biggest cut the probe accepts. Some growth has to stay: without it the swarm feeds itself (drones make kills,
   *  kills make swarms) and the probe took no hull damage at all from level 3 to 15 whatever the rocks did. */
  SWARM_KILLS_FROM_LEVEL: 6,
  SWARM_KILLS_PER_LEVEL: 20,
  SWARM_KILLS_CAP: 380,
  /** v3.4 (owner, 2026-10-18: swarms "not so hard to acquire past level 20"): past SWARM_KILLS_EASE_FROM_LEVEL the
   *  kills needed ease back SWARM_KILLS_EASE_PER_LEVEL per level, never below SWARM_KILLS_LATE_MIN (302 at 20, 340 at
   *  25 where the cap and the ease cross, 280 at 30, 220 at 35, 160 from 40). The late rocks pay for it: the ramp
   *  knobs above (LEVEL_SECONDS, SPAWN_LEVEL_FACTOR, AST_SPEED_PER_LEVEL, HP_MULT_PER_LEVEL) tightened the same day. */
  // 2026-10-21 (owner: swarm "still seems to take too long to earn in levels near 20 and up"): cap 400 -> 380, the
  // easing from level 18 instead of 20, floor 160 -> 150: 278 at 20, 296 at 25, 236 at 30, 176 at 35, 150 from 37
  // (was 302, 340, 280, 220, 160). Measured with the armed probe (seeds 1-4, 600 s, with the eased rock slope and
  // the MIRV): cap 320 from 15 left seed 4 untouched after level 10 (95 hull at level 36) and 360 from 17 seed 2 (73);
  // the swarm feeds itself (drones make kills, kills make swarms), so this is the biggest cut that keeps the ramp.
  SWARM_KILLS_EASE_FROM_LEVEL: 18,
  SWARM_KILLS_EASE_PER_LEVEL: 12,
  SWARM_KILLS_LATE_MIN: 150,
  /** v3.4 drone tiers: tier = min(SWARM_TIER_MAX, floor(past(level, SWARM_TIER_FROM_LEVEL) / SWARM_TIER_LEVELS)), so 1 at
   *  level 12, 2 at 18, 3 at 24; a release mixes the level's tier with the one below so a swarm shows two colours.
   *  Tier t drones fly SWARM_TIER_SPEED_MULT^t faster (IDEAS 10: late drones could not catch late rocks), hit for
   *  SWARM_DAMAGE + t, and shoot SWARM_TIER_BULLET_MULT^t faster bullets. Colours: render NEON.drone. */
  SWARM_TIER_FROM_LEVEL: 12,
  SWARM_TIER_LEVELS: 6,
  SWARM_TIER_MAX: 3,
  SWARM_TIER_SPEED_MULT: 1.22,
  SWARM_TIER_BULLET_MULT: 1.1,
  /** Stock cap grows one per SWARM_MAX_LEVELS levels up to SWARM_MAX_CAP (2, then 3 at level 11, 4 at 21, 5 at 31). */
  SWARM_MAX: 2,
  SWARM_MAX_LEVELS: 10,
  SWARM_MAX_CAP: 5,
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
   *  of the count range, capped at SWARM_COUNT_CAP (level 1: 5-8, level 9: 9-12, level 17: 13-16, level 30: 19-22,
   *  level 49+: 32 flat); the burn-out life grows SWARM_LIFE_PER_LEVEL seconds per level up to SWARM_LIFE_MAX. */
  SWARM_GROWTH_PER_LEVEL: 0.7,
  SWARM_COUNT_CAP: 40,
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

  /** Difficulty levels (ready panel, `9`): multipliers on the base balance above, never a change to it. NORMAL is
   *  1 everywhere and is today's game. `spawn` multiplies the spawn RATE (the interval is divided by it), `hp` the rock
   *  hit points at spawn, `speed` the rock speed at spawn, `damage` the hull damage per impact (the moon is not scaled).
   *  Measured 2026-10-18 with the bot (bot.ts; seeds 1..4, god off, 900 s cap; seconds survived from the start / level
   *  reached; "+" = alive at the cap). NORMAL is untouched base balance; EASY and HARD were tuned on these four numbers.
   *    start   EASY (0.8/0.85/0.9/0.7)        NORMAL (1/1/1/1)              HARD (1.3/1.7/1.15/1.4)
   *    1       821-900+ s, L49-53+            480-584 s, L29-35             367-472 s, L22-28
   *    10      580-708 s, L44-51              478-606 s, L38-45             169-259 s, L19-25
   *    20      347-636 s, L40-57              243-438 s, L34-45              47-149 s, L22-28
   *    30      311-520 s, L48-60              167-358 s, L39-51              37-124 s, L32-37
   *    40      197-335 s, L51-59               50-266 s, L42-55              14-18 s,  L40-41
   *  A first try (EASY 0.7/0.75/0.85/0.6, HARD 1.25/1.25/1.1/1.3) left EASY alive at 900 s on every seed and HARD within
   *  the NORMAL spread from level 1 (382-466 s); rock hit points are again the axis that separates them. Start-level
   *  runs outlast level-1 runs on NORMAL (fresh hull and moon, pressure reset): see docs/MINIGAME_BACKLOG.md. */
  DIFFICULTY: {
    easy: { spawn: 0.8, hp: 0.85, speed: 0.9, damage: 0.7 },
    normal: { spawn: 1, hp: 1, speed: 1, damage: 1 },
    hard: { spawn: 1.3, hp: 1.7, speed: 1.15, damage: 1.4 },
  },
  /** The order `9` cycles through and the default. */
  DIFFICULTY_ORDER: ['easy', 'normal', 'hard'] as readonly ('easy' | 'normal' | 'hard')[],
  DIFFICULTY_DEFAULT: 'normal' as 'easy' | 'normal' | 'hard',

  /** Start level (ready panel, `0`): a run may begin at any of these levels. Level-derived upgrades (streams, launchers,
   *  laser stage and mesh, drone and sentry tiers, stock caps) follow from the level by themselves; the earned stocks a
   *  typical run carries are granted as a kit (modes.setupStart). Measured with the bot (seeds 1..4, NORMAL): pulses sit
   *  at the cap from level 5 on, it spends seekers and swarms as they arrive, and it has 1-3 sentries at 10, 3-4 at 15,
   *  4-6 from 20. So: full pulses, START_SEEKERS and START_SWARMS in stock, and turretMax(level) - START_SENTRIES_SHORT
   *  sentries deployed (they burn out on their usual TURRET_LIFE, a cushion while the player settles). Pressure and
   *  the moon follow START_PRESSURE_FRAC and START_MOON_FRAC below. Such runs are flagged and never ranked. */
  // NOTE: owner 2026-10-23 ("start at higher minigame level"): 5, 15, 25, 50 and 60 added to the original 1-40 steps.
  START_LEVELS: [1, 5, 10, 15, 20, 25, 30, 40, 50, 60] as readonly number[],
  /** TILT STEER (tilt.ts, the gear menu): no turn inside TILT_DEAD_DEG of level, a full-rate turn from the range the
   *  player picks in TILT_RANGES_DEG (TILT RANGE in the gear; TILT_RANGE_DEFAULT indexes it), a proportionally slower
   *  turn between. Degrees of roll about the screen's vertical axis. Rounds of phone tests: docs/TILT_EXPERIMENTS.md. */
  TILT_DEAD_DEG: 6,
  TILT_RANGES_DEG: [12, 18, 24, 36] as readonly number[],
  TILT_RANGE_DEFAULT: 2,
  /** SHAKE TO PULSE (tilt.ts, round 2): a jerk whose acceleration without gravity exceeds SHAKE_ACCEL m/s^2 fires a
   *  pulse, then nothing for SHAKE_COOLDOWN_S so one shake is one pulse. A brisk flick reads about 15-30 m/s^2 on a
   *  phone; walking reads 2-4. The readout's A value shows the last second's peak, for tuning. */
  SHAKE_ACCEL: 14,
  SHAKE_COOLDOWN_S: 0.8,
  START_SEEKERS: 1,
  START_SWARMS: 1,
  START_SENTRIES_SHORT: 1,
  /** IDEAS 31: a skipped start is "the same game, later". Measured on level-1 NORMAL runs (bench/mgProbe.ts, seeds
   *  1..4): at level 10 pressure sits at its ceiling and the moon has 530-580 of 600 HP; by level 20 the moon is gone
   *  on three seeds of four. So a skip starts pressure at START_PRESSURE_FRAC x pressureMax(level) (was
   *  PRESSURE_START, 0.85) and the moon at START_MOON_FRAC of MOON_HP (was full). START_GRACE_S is a calm opening
   *  (the first spawn waits) so a hard skip does not end before the player has turned the launcher. Result (seeds
   *  1..12, NORMAL): a level-10 start ends at median level 34.5 against 33.5 from level 1; HARD from 40 lasts 43-131 s
   *  instead of 14-18 s (docs/MINIGAME_BACKLOG.md, "After IDEAS 31"). */
  START_PRESSURE_FRAC: 0.95,
  START_MOON_FRAC: { 10: 0.9, 20: 0.1, 30: 0, 40: 0 } as Readonly<Record<number, number>>,
  START_GRACE_S: 3,

  /** SUPER DEMO (ready panel, `8`): the bot (bot.ts) plays itself at DEMO_SPEED x real time, NORMAL, from level 1; after
   *  a game over the next demo starts in DEMO_RESTART_SECONDS. */
  DEMO_SPEED: 0.75,
  DEMO_RESTART_SECONDS: 4,

  /** Fixed simulation step (s) and the cap on steps per rendered frame. */
  DT: 1 / 120,
  MAX_STEPS_PER_FRAME: 8,
} as const;

/** Read a by-level table with the last entry repeating. */
export type Difficulty = keyof typeof MG.DIFFICULTY;

export function byLevel(table: readonly number[], level: number): number {
  const i = Math.max(0, Math.min(table.length - 1, level - 1));
  return table[i] ?? 1;
}
