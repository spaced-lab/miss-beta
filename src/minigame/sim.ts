// WHAT: The PERIMETER minigame simulation: pure state + step function, no DOM, no Canvas.
// WHY:  Same rule as the real sim (GAME_PLAN 14): logic that can be unit-tested never touches rendering.
//       A game of PERIMETER is fully determined by (seed, input sequence), so a replay is a list of inputs
//       and the tests can assert exact outcomes. The renderer only reads this state.
// HOW:  `createState(seed)` builds the world; `step(state, input, dt)` advances it one fixed tick.
//       Entities live in plain arrays and are removed with swap-pop to avoid per-frame allocation.
//       Progression is by level (one per LEVEL_SECONDS) read from the tables in config.ts, then scaled
//       by an adaptive `pressure` that rises while the player is healthy and falls on every hull hit.
//       Nothing plateaus: past the early tables the spawn floor keeps shrinking (spawnFloor), the speed cap
//       keeps rising (speedCap), rock hit points scale with level (hpMult) and so do the pressure ceiling and
//       the hull damage cap; all are slow linear or geometric growths with their knobs in config.ts.
//       Rocks have a hardness tier 0..5 (hit points, mass, score); bullets carry a damage 1..3 decided by
//       their stream position (centre strongest), and every hit also pushes the rock (impulse / mass),
//       so passing rocks can be nudged and heavy rocks barely move. A moon orbits the planet from
//       MOON_LEVEL: rocks inside its influence are bent toward it, anything touching it is absorbed.
//       Heat: each trigger pull adds heat; at 1.0 fire locks until it cools below HEAT_UNLOCK.
//       Laser: from 3 streams the first pull after a break fires a beam down the centre stream (sim.fireLaser);
//       the step emits SimEvents (shots, hits, breaks, ...) that the host turns into sound; the sim never
//       imports audio. Sentries (Turret) come in four archetypes (SentryKind) with their own motion,
//       targeting and fire schedule, all in stepTurret; the kind is drawn from the Rng at deploy.
//       Earned weapons: pulses (kills), seeker missiles (direct hits, `<`, lead pursuit + area blast in
//       stepSeekers / detonate) and swarms of sentinel drones (kills, `>`, stepDrones); each has a stock and a
//       0..1 charge toward the next one.
// LORE: G1 (how to play), G5 (scoring), O14 (randomness), D3 (kinetic push, toy version)

import { Rng } from '../sim/rng';
import { clamp, wrapAngle } from '../util/vec';
import { findHits, type CollisionStrategy } from './collision';
import { byLevel, MG } from './config';
import { generateAsteroidShape, generateContinents, generateCraters, type Continent } from './planet';

export interface Input {
  left: boolean;
  right: boolean;
  fire: boolean;
  /** Edge-triggered by the caller: true only on the frame the key went down. */
  pulse: boolean;
  /** Edge-triggered: launch a seeker missile (`<`). */
  seeker: boolean;
  /** Edge-triggered: release a swarm of sentinels (`>`). */
  swarm: boolean;
}

export const NO_INPUT: Readonly<Input> = Object.freeze({ left: false, right: false, fire: false, pulse: false, seeker: false, swarm: false });

export interface Asteroid {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** Hardness tier 0..MAX_TIER (5). */
  tier: number;
  hp: number;
  maxHp: number;
  /** A small, dense shard one tier above its parent. Worth extra. */
  core: boolean;
  /** Aimed to miss the planet at spawn; only a deflection or the moon can change that. */
  passing: boolean;
  shape: Float64Array;
  rot: number;
  spin: number;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  r: number;
  /** 1..3, from stream position. */
  damage: number;
  /** True for turret shots (they do not count toward turret earning). */
  auto: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  /** Colour hint: tier of the rock that produced it, or -1 for hull impacts. */
  tier: number;
}

/**
 * Sentry behaviour archetypes, one drawn per deploy (knobs SENTRY_* in config.ts):
 *   orbiter  rides the ring at TURRET_ANGULAR_SPEED and shoots the most threatening rock (the classic);
 *   sweeper  oscillates along an arc around its home angle, faces outward, fires in short bursts;
 *   picket   parks at the angle of the densest incoming sector and holds there, re-reading the field;
 *   chaser   leaves the ring and drifts toward the most threatening rock within a leash of its home.
 */
export type SentryKind = 'orbiter' | 'sweeper' | 'picket' | 'chaser';
export const SENTRY_KINDS: readonly SentryKind[] = ['orbiter', 'sweeper', 'picket', 'chaser'];

export interface Turret {
  kind: SentryKind;
  /** Polar position: angle (rad) and radius (planet radii). Ring riders stay at TURRET_ORBIT_R. */
  angle: number;
  radius: number;
  /** Home angle: the sweeper's arc centre, the chaser's leash anchor (on the ring). */
  home: number;
  /** Kind-specific clock: sweeper oscillation phase, picket retarget timer. */
  phase: number;
  /** Shots fired in the current burst (sweeper). */
  burst: number;
  life: number;
  maxLife: number;
  cooldown: number;
  /** Id of the rock it is aiming at, or -1. */
  targetId: number;
  /** 0..2 from level: damage and fire rate. */
  tier: number;
  /** SUPER sentry: 3-way spread, double rate, longer life, hue-cycling. */
  superb: boolean;
}

/** A seeker missile: lead pursuit toward `targetId`, area blast on contact. */
export interface Seeker {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  targetId: number;
  /** Recent positions, flat [x0, y0, x1, y1, ...], newest last; the renderer's exhaust trail. */
  trail: number[];
  /** Steps since the trail was last sampled. */
  trailTick: number;
}

/** A sentinel drone: hunts the nearest rock with weak fast bullets, burns out after SWARM_LIFE. */
export interface Drone {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  cooldown: number;
  targetId: number;
  /** Fixed angle around its target this drone prefers, so a swarm spreads instead of stacking. */
  slot: number;
}

export interface Flash {
  text: string;
  t: number;
}

/** A fading laser beam for the renderer. */
export interface Beam {
  angle: number;
  t: number;
}

/** Events the step emits for sound and effects; the host drains them each frame. */
export type SimEvent =
  | { type: 'shot'; strength: number }
  | { type: 'laser' }
  | { type: 'hit'; tier: number }
  | { type: 'break'; tier: number; r: number }
  | { type: 'impact' }
  | { type: 'overheat' }
  | { type: 'cooled' }
  | { type: 'pulse' }
  | { type: 'levelup' }
  | { type: 'turret' }
  | { type: 'moon' }
  | { type: 'moonhit' }
  | { type: 'moonlost' }
  | { type: 'crash'; speed: number }
  | { type: 'seeker' }
  | { type: 'blast' }
  | { type: 'swarm'; count: number }
  | { type: 'burnout' }
  | { type: 'over' };

export type Status = 'ready' | 'playing' | 'over';

export interface Cheats {
  god: boolean;
  launchers?: number;
  streams?: number;
  timeScale: number;
  assisted: boolean;
  noHeat: boolean;
}

export interface MinigameState {
  seed: number;
  rng: Rng;
  status: Status;
  t: number;
  level: number;
  hp: number;
  score: number;
  kills: number;
  /** Direct bullet hits (player bullets only). */
  hits: number;
  shots: number;
  continents: Continent[];
  launcherAngle: number;
  launcherCount: number;
  streamCount: number;
  fireCooldown: number;
  heat: number;
  overheated: boolean;
  spawnTimer: number;
  pressure: number;
  /** Seconds since the hull was last hit. */
  sinceHit: number;
  nextId: number;
  asteroids: Asteroid[];
  bullets: Bullet[];
  particles: Particle[];
  turrets: Turret[];
  /** Direct hits counted toward the next turret. */
  turretProgress: number;
  moonAngle: number;
  moonHp: number;
  craters: Array<[number, number, number]>;
  pulses: number;
  pulseCharge: number;
  pulseR: number;
  seekers: Seeker[];
  seekerStock: number;
  /** Direct hits counted toward the next seeker (0..SEEKER_HITS-1). Integers, so the meter fills exactly. */
  seekerProgress: number;
  drones: Drone[];
  swarmStock: number;
  /** Kills counted toward the next swarm (0..SWARM_KILLS-1). */
  swarmProgress: number;
  flashes: Flash[];
  beams: Beam[];
  events: SimEvent[];
  /** Seconds since the player's last trigger pull; arms the laser. */
  sinceShot: number;
  shake: number;
  secAccum: number;
  cheats: Cheats;
  collision: CollisionStrategy;
  stats: { collisionChecksLastStep: number };
}

// --- progression ---------------------------------------------------------------------------------------

export const levelAt = (t: number): number => 1 + Math.floor(t / MG.LEVEL_SECONDS);
/** Levels past `from`, never negative: the argument of every slow late-game growth below. */
const past = (level: number, from: number): number => Math.max(0, level - from);
/**
 * Spawn floor: SPAWN_MIN until SPAWN_FLOOR_FROM_LEVEL, then shrinking SPAWN_FLOOR_FACTOR per level toward
 * SPAWN_FLOOR_ABS. Defaults: 0.3 s at level 9, 0.218 s at level 30, 0.174 s at level 45.
 */
export const spawnFloor = (level: number): number => Math.max(MG.SPAWN_FLOOR_ABS, MG.SPAWN_MIN * Math.pow(MG.SPAWN_FLOOR_FACTOR, past(level, MG.SPAWN_FLOOR_FROM_LEVEL)));
/** Seconds between spawns at pressure 1: the geometric curve from SPAWN_0, never below the level's floor. */
export const baseSpawnInterval = (level: number): number => Math.max(spawnFloor(level), MG.SPAWN_0 * Math.pow(MG.SPAWN_LEVEL_FACTOR, level - 1));
/** Speed cap: AST_SPEED_MAX, then +AST_SPEED_CAP_PER_LEVEL per level past AST_SPEED_CAP_FROM_LEVEL (2.2 at 15, 2.575 at 30, 2.95 at 45). */
export const speedCap = (level: number): number => MG.AST_SPEED_MAX + MG.AST_SPEED_CAP_PER_LEVEL * past(level, MG.AST_SPEED_CAP_FROM_LEVEL);
/** Rock speed at pressure 1: the linear ramp from AST_SPEED_0, never above the level's cap. */
export const baseSpeed = (level: number): number => Math.min(speedCap(level), MG.AST_SPEED_0 + MG.AST_SPEED_PER_LEVEL * (level - 1));
/** Hit-point multiplier applied on spawn: 1 up to HP_MULT_FROM_LEVEL, then +HP_MULT_PER_LEVEL per level (x2 at 30, x2.75 at 45). */
export const hpMult = (level: number): number => 1 + MG.HP_MULT_PER_LEVEL * past(level, MG.HP_MULT_FROM_LEVEL);
/** Pressure ceiling: PRESSURE_MAX, then +PRESSURE_MAX_PER_LEVEL per level past PRESSURE_MAX_FROM_LEVEL (1.6 at 10, 2.0 at 30, 2.3 at 45). */
export const pressureMax = (level: number): number => MG.PRESSURE_MAX + MG.PRESSURE_MAX_PER_LEVEL * past(level, MG.PRESSURE_MAX_FROM_LEVEL);
/** Rock budget: MAX_ASTEROIDS + MAX_ASTEROIDS_PER_LEVEL per level, capped at MAX_ASTEROIDS_CAP. */
export const maxAsteroids = (level: number): number => Math.min(MG.MAX_ASTEROIDS_CAP, MG.MAX_ASTEROIDS + MG.MAX_ASTEROIDS_PER_LEVEL * past(level, 1));
export const launcherCount = (level: number): number => byLevel(MG.LAUNCHERS_BY_LEVEL, level);
export const streamCount = (level: number): number => byLevel(MG.STREAMS_BY_LEVEL, level);
export const maxTier = (level: number): number => byLevel(MG.MAX_TIER_BY_LEVEL, level);
/** The hardest tier that exists (the tier tables' last index). Hard-core shards never exceed it. */
export const MAX_TIER = MG.TIER_HP_MULT.length - 1;
/** Hull damage cap for a level: the table's entry, then +DAMAGE_MAX_PER_LEVEL per level past DAMAGE_MAX_FROM_LEVEL (25 at 10, 33 at 30, 39 at 45). */
export const damageMax = (level: number): number => byLevel(MG.DAMAGE_MAX_BY_LEVEL, level) + MG.DAMAGE_MAX_PER_LEVEL * past(level, MG.DAMAGE_MAX_FROM_LEVEL);
/** Hull points one rock removes: DAMAGE_PER_R * r * (1 + 0.5 tier), clamped to the level's cap. */
export const hullDamage = (level: number, r: number, tier: number): number =>
  clamp(Math.round(r * MG.DAMAGE_PER_R * (1 + 0.5 * tier)), MG.DAMAGE_MIN, Math.round(damageMax(level)));
export const moonActive = (level: number): boolean => level >= MG.MOON_LEVEL;
export const moonAlive = (st: MinigameState): boolean => moonActive(st.level) && st.moonHp > 0;
/** Sentry tier from level: one step per TURRET_TIER_LEVELS after TURRET_LEVEL, capped at 2. */
export const turretTier = (level: number): number => Math.max(0, Math.min(2, Math.floor((level - MG.TURRET_LEVEL) / MG.TURRET_TIER_LEVELS)));
/** 0..1 how busy the field is; drives the ambient bass-static layer. */
export const chaosLevel = (st: MinigameState): number => clamp(st.asteroids.length / 45 + st.bullets.length / 400 + (st.level - 1) / 20, 0, 1);
/** 0..3: how much of the neon spectrum is unlocked at this level. */
export const spectrumStage = (level: number): number => MG.SPECTRUM_LEVELS.filter((l) => level >= l).length;

/** Strength level of the strongest stream: 1 at 1-2 streams, 2 at 3-4, 3 at 5. */
export const strengthLevel = (streams: number): number => (streams <= 2 ? 1 : streams <= 4 ? 2 : 3);

/**
 * Damage of stream j of n: the centre stream carries the strength level, each step outward is one less,
 * never below 1. With 5 streams: 1, 2, 3, 2, 1. With 3 streams: 1, 2, 1. With 4: 1, 2, 2, 1.
 */
export function streamDamage(streams: number, j: number): number {
  const d = Math.abs(j - (streams - 1) / 2);
  return Math.max(1, strengthLevel(streams) - Math.floor(d));
}

/** Laser stage: 0 none, 1 player's launcher only (needs LASER_BREAK_1), 2 every launcher (LASER_BREAK_2). */
export const laserStage = (streams: number): number => (streams >= 5 ? 2 : streams >= 3 ? 1 : 0);

export function laserArmed(st: MinigameState): boolean {
  const stage = laserStage(st.streamCount);
  if (stage === 0) return false;
  return st.sinceShot >= (stage === 2 ? MG.LASER_BREAK_2 : MG.LASER_BREAK_1);
}

export function emit(st: MinigameState, e: SimEvent): void {
  if (st.events.length < 256) st.events.push(e);
}

/** Tier colour to display: steps down the ladder as hit points fall (a tier-3 rock reads 3, 2, 1 as it weakens). */
export function displayTier(a: Asteroid): number {
  if (a.tier === 0) return 0;
  return Math.max(1, Math.ceil((a.tier * a.hp) / a.maxHp));
}

export function moonPosition(st: MinigameState): { x: number; y: number } {
  return { x: MG.MOON_ORBIT_R * Math.cos(st.moonAngle), y: MG.MOON_ORBIT_R * Math.sin(st.moonAngle) };
}

export function turretPosition(tr: Turret): { x: number; y: number } {
  return { x: tr.radius * Math.cos(tr.angle), y: tr.radius * Math.sin(tr.angle) };
}

/** Signed angle difference wrapped into (-pi, pi]. */
const signedAngle = (t: number): number => {
  const w = wrapAngle(t);
  return w > Math.PI ? w - 2 * Math.PI : w;
};

// --- construction ----------------------------------------------------------------------------------------

export function createState(seed: number, collision: CollisionStrategy = 'auto'): MinigameState {
  const rng = new Rng(seed);
  return {
    seed,
    rng,
    status: 'ready',
    t: 0,
    level: 1,
    hp: MG.MAX_HP,
    score: 0,
    kills: 0,
    hits: 0,
    shots: 0,
    continents: generateContinents(rng, MG.PLANET_R),
    launcherAngle: Math.PI / 2,
    launcherCount: 1,
    streamCount: 1,
    fireCooldown: 0,
    heat: 0,
    overheated: false,
    spawnTimer: 1.2,
    pressure: MG.PRESSURE_START,
    sinceHit: 0,
    nextId: 1,
    asteroids: [],
    bullets: [],
    particles: [],
    turrets: [],
    turretProgress: 0,
    moonAngle: rng.float(0, Math.PI * 2),
    moonHp: MG.MOON_HP,
    craters: generateCraters(rng),
    pulses: 0,
    pulseCharge: 0,
    pulseR: -1,
    seekers: [],
    seekerStock: 0,
    seekerProgress: 0,
    drones: [],
    swarmStock: 0,
    swarmProgress: 0,
    flashes: [],
    beams: [],
    events: [],
    sinceShot: 99,
    shake: 0,
    secAccum: 0,
    cheats: { god: false, timeScale: 1, assisted: false, noHeat: false },
    collision,
    stats: { collisionChecksLastStep: 0 },
  };
}

export function start(st: MinigameState): void {
  st.status = 'playing';
  flash(st, 'DEFEND HOME', 1.5);
}

export function flash(st: MinigameState, text: string, seconds = 2): void {
  st.flashes.push({ text, t: seconds });
  if (st.flashes.length > 3) st.flashes.shift();
}

export function launcherAngleAt(st: MinigameState, i: number): number {
  return wrapAngle(st.launcherAngle + (i * Math.PI * 2) / st.launcherCount);
}

// --- helpers -----------------------------------------------------------------------------------------------

function swapRemove<T>(arr: T[], i: number): void {
  const last = arr.pop();
  if (last !== undefined && i < arr.length) arr[i] = last;
}

function spawnParticles(st: MinigameState, x: number, y: number, count: number, speed: number, tier: number): void {
  for (let k = 0; k < count; k++) {
    if (st.particles.length >= MG.MAX_PARTICLES) return;
    const a = st.rng.float(0, Math.PI * 2);
    const v = speed * st.rng.float(0.3, 1.0);
    const life = MG.PARTICLE_LIFE * st.rng.float(0.5, 1.0);
    st.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, tier });
  }
}

/** Mass for the impulse rule: (r / 0.3)^3 times the tier's mass multiplier. */
export function rockMass(a: Asteroid): number {
  const m = (a.r / 0.3) ** 3 * (MG.TIER_MASS_MULT[a.tier] ?? 1);
  return a.core ? m * 2 : m;
}

function makeAsteroid(st: MinigameState, x: number, y: number, vx: number, vy: number, r: number, tier: number, core: boolean, passing: boolean): Asteroid {
  // Hit points: size units times the tier multiplier times the level multiplier (hpMult), whole numbers so the
  // display-tier ladder steps cleanly.
  const hp = Math.max(1, Math.round(Math.max(1, Math.round(r / MG.AST_HP_UNIT)) * (MG.TIER_HP_MULT[tier] ?? 1) * hpMult(st.level)));
  return {
    id: st.nextId++,
    x, y, vx, vy, r,
    tier,
    hp,
    maxHp: hp,
    core,
    passing,
    shape: generateAsteroidShape(st.rng),
    rot: st.rng.float(0, Math.PI * 2),
    spin: st.rng.float(-1.5, 1.5) * (core ? 2 : 1),
  };
}

/** Pick a tier in 0..max with geometrically decaying weights. */
function drawTier(st: MinigameState, max: number): number {
  let total = 0;
  for (let t = 0; t <= max; t++) total += Math.pow(MG.TIER_WEIGHT_DECAY, t);
  let u = st.rng.next() * total;
  for (let t = 0; t <= max; t++) {
    u -= Math.pow(MG.TIER_WEIGHT_DECAY, t);
    if (u <= 0) return t;
  }
  return max;
}

/** Two rocks side by side with circular orbital velocity about their centre of mass, drifting together. */
export function spawnBinary(st: MinigameState, x: number, y: number, vx: number, vy: number, tier: number): void {
  const r1 = st.rng.float(MG.AST_R_MIN, MG.AST_R_MAX);
  const r2 = st.rng.float(MG.AST_R_MIN, MG.AST_R_MAX);
  const a = makeAsteroid(st, 0, 0, 0, 0, r1, tier, false, false);
  const b = makeAsteroid(st, 0, 0, 0, 0, r2, Math.max(0, tier - 1), false, false);
  const m1 = rockMass(a);
  const m2 = rockMass(b);
  const sep = r1 + r2 + st.rng.float(0.35, 0.6);
  const ang = st.rng.float(0, Math.PI * 2);
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  // Circular relative orbit: v_rel = sqrt(G (m1+m2) / sep), split by mass about the COM.
  const vRel = Math.sqrt((MG.AST_G * (m1 + m2)) / sep);
  const d1 = (sep * m2) / (m1 + m2);
  const d2 = (sep * m1) / (m1 + m2);
  a.x = x + ux * d1;
  a.y = y + uy * d1;
  b.x = x - ux * d2;
  b.y = y - uy * d2;
  const tx = -uy;
  const ty = ux;
  a.vx = vx + tx * vRel * (m2 / (m1 + m2));
  a.vy = vy + ty * vRel * (m2 / (m1 + m2));
  b.vx = vx - tx * vRel * (m1 / (m1 + m2));
  b.vy = vy - ty * vRel * (m1 / (m1 + m2));
  st.asteroids.push(a, b);
}

function spawnAsteroid(st: MinigameState): void {
  const budget = maxAsteroids(st.level);
  if (st.asteroids.length >= budget) return;
  const theta = st.rng.float(0, Math.PI * 2);
  const x = MG.FIELD_R * Math.cos(theta);
  const y = MG.FIELD_R * Math.sin(theta);
  const passing = st.level >= MG.PASSING_LEVEL && st.rng.chance(MG.PASS_PROB);
  const aimA = st.rng.float(0, Math.PI * 2);
  const aimR = passing ? st.rng.float(MG.PASS_AIM_MIN, MG.PASS_AIM_MAX) : st.rng.float(0, MG.AST_AIM_SCATTER);
  const dx = aimR * Math.cos(aimA) - x;
  const dy = aimR * Math.sin(aimA) - y;
  const d = Math.hypot(dx, dy);
  const v = baseSpeed(st.level) * (0.8 + 0.2 * st.pressure) * st.rng.float(0.8, 1.2);
  const tier = drawTier(st, maxTier(st.level));
  if (!passing && st.level >= MG.BINARY_LEVEL && st.asteroids.length + 2 <= budget && st.rng.chance(MG.BINARY_PROB)) {
    spawnBinary(st, x, y, (dx / d) * v * 0.9, (dy / d) * v * 0.9, tier);
    return;
  }
  const r = st.rng.float(MG.AST_R_MIN, MG.AST_R_MAX);
  st.asteroids.push(makeAsteroid(st, x, y, (dx / d) * v, (dy / d) * v, r, tier, false, passing));
}

/** Rock-on-rock: mutual gravity within range, then elastic bounces that chip both rocks when fast. */
function interact(st: MinigameState, dt: number): number[] {
  const rocks = st.asteroids;
  const n = rocks.length;
  const dead: number[] = [];
  const range2 = MG.AST_GRAV_RANGE * MG.AST_GRAV_RANGE;
  for (let i = 0; i < n; i++) {
    const a = rocks[i];
    if (!a) continue;
    for (let j = i + 1; j < n; j++) {
      const b = rocks[j];
      if (!b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > range2) continue;
      const d = Math.sqrt(d2);
      const ma = rockMass(a);
      const mb = rockMass(b);
      const rr = a.r + b.r;
      if (d >= rr) {
        // Gravity, softened so a near pass does not sling.
        const acc = MG.AST_G / Math.max(d2, 0.04);
        const ux = dx / d;
        const uy = dy / d;
        a.vx += ux * acc * mb * dt;
        a.vy += uy * acc * mb * dt;
        b.vx -= ux * acc * ma * dt;
        b.vy -= uy * acc * ma * dt;
        continue;
      }
      // Overlap: separate along the normal and apply a 1-D elastic impulse with restitution.
      const ux = d > 1e-9 ? dx / d : 1;
      const uy = d > 1e-9 ? dy / d : 0;
      const overlap = rr - d;
      const total = ma + mb;
      a.x -= (ux * overlap * mb) / total;
      a.y -= (uy * overlap * mb) / total;
      b.x += (ux * overlap * ma) / total;
      b.y += (uy * overlap * ma) / total;
      const rel = (b.vx - a.vx) * ux + (b.vy - a.vy) * uy; // closing if negative
      if (rel >= 0) continue;
      const jImp = (-(1 + MG.AST_RESTITUTION) * rel) / (1 / ma + 1 / mb);
      a.vx -= (ux * jImp) / ma;
      a.vy -= (uy * jImp) / ma;
      b.vx += (ux * jImp) / mb;
      b.vy += (uy * jImp) / mb;
      if (-rel > MG.AST_CRASH_SPEED) {
        a.hp -= 1;
        b.hp -= 1;
        spawnParticles(st, (a.x + b.x) / 2, (a.y + b.y) / 2, 6, 1.5, Math.max(a.tier, b.tier));
        emit(st, { type: 'crash', speed: -rel });
        if (a.hp <= 0 && !dead.includes(i)) dead.push(i);
        if (b.hp <= 0 && !dead.includes(j)) dead.push(j);
      }
    }
  }
  return dead;
}

/** Remove asteroid `i`, award score, split if large, and spawn debris. */
function destroyAsteroid(st: MinigameState, i: number, scoreMult: number, allowSplit: boolean): void {
  const a = st.asteroids[i];
  if (!a) return;
  const tierMult = MG.TIER_SCORE_MULT[a.tier] ?? 1;
  st.score += Math.floor(a.r * MG.SCORE_PER_R * tierMult * (a.core ? MG.HARD_CORE_SCORE_MULT : 1) * scoreMult);
  st.kills += 1;
  st.pulseCharge += 1 / MG.PULSE_KILLS;
  // NOTE: 14 * (1 / 14) is 0.9999999999999997 in floats; without the epsilon the pulse arrived one kill late.
  if (st.pulseCharge >= 1 - 1e-9) {
    st.pulseCharge -= 1;
    if (st.pulses < MG.PULSE_MAX) {
      st.pulses += 1;
      flash(st, 'PULSE READY', 1.2);
    }
  }
  if (++st.swarmProgress >= MG.SWARM_KILLS) {
    st.swarmProgress = 0;
    if (st.swarmStock < MG.SWARM_MAX) {
      st.swarmStock += 1;
      flash(st, 'SWARM READY  >', 1.2);
    }
  }
  spawnParticles(st, a.x, a.y, MG.PARTICLES_PER_HIT + a.tier * 4, 2.5, a.tier);
  emit(st, { type: 'break', tier: a.tier, r: a.r });
  swapRemove(st.asteroids, i);

  if (allowSplit && !a.core && a.r >= MG.AST_SPLIT_R && st.asteroids.length + 2 <= maxAsteroids(st.level)) {
    const speed = Math.hypot(a.vx, a.vy);
    const hardCoreAt = a.tier >= 1 && st.rng.chance(MG.HARD_CORE_PROB) ? st.rng.int(0, 1) : -1;
    let k = 0;
    for (const side of [-1, 1]) {
      const ang = Math.atan2(a.vy, a.vx) + side * st.rng.float(0.35, 0.8);
      const isCore = k === hardCoreAt;
      const cr = a.r * (isCore ? MG.HARD_CORE_SCALE : MG.AST_CHILD_SCALE);
      const tier = isCore ? Math.min(MAX_TIER, a.tier + 1) : Math.max(0, a.tier - 1);
      st.asteroids.push(
        makeAsteroid(st, a.x + side * cr * 0.6 * -Math.sin(ang), a.y + side * cr * 0.6 * Math.cos(ang), Math.cos(ang) * speed * 1.1, Math.sin(ang) * speed * 1.1, cr, tier, isCore, false),
      );
      k++;
    }
  }
}

function pushBullet(st: MinigameState, x: number, y: number, angle: number, damage: number, auto: boolean, speed: number = MG.BULLET_SPEED, life: number = MG.BULLET_LIFE): void {
  if (st.bullets.length >= MG.MAX_BULLETS) return;
  st.bullets.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, r: MG.BULLET_R, damage, auto });
}

/** A direct hit by the player (bullet or laser): counts for stats and charges the next seeker. */
function creditHit(st: MinigameState): void {
  st.hits += 1;
  if (++st.seekerProgress >= MG.SEEKER_HITS) {
    st.seekerProgress = 0;
    if (st.seekerStock < MG.SEEKER_MAX) {
      st.seekerStock += 1;
      flash(st, 'SEEKER READY  <', 1.2);
    }
  }
}

/** Aim angle from (x, y) at a rock, leading it by its travel time at `speed`. */
function leadAngle(x: number, y: number, a: Asteroid, speed: number): number {
  const lead = Math.hypot(a.x - x, a.y - y) / speed;
  return Math.atan2(a.y + a.vy * lead - y, a.x + a.vx * lead - x);
}

/** Turn a velocity of fixed speed toward `want` by at most `maxTurn` radians. */
function steer(v: { vx: number; vy: number }, want: number, maxTurn: number, speed: number): void {
  const heading = Math.atan2(v.vy, v.vx);
  const next = heading + clamp(signedAngle(want - heading), -maxTurn, maxTurn);
  v.vx = Math.cos(next) * speed;
  v.vy = Math.sin(next) * speed;
}

function findRock(st: MinigameState, id: number): Asteroid | null {
  if (id < 0) return null;
  for (const a of st.asteroids) if (a.id === id) return a;
  return null;
}

/** Launch a seeker from the player's launcher; `<` key. Returns false when the stock is empty. */
export function launchSeeker(st: MinigameState): boolean {
  if (st.seekerStock <= 0) return false;
  st.seekerStock -= 1;
  const a = launcherAngleAt(st, 0);
  const muzzle = MG.PLANET_R * 1.3;
  st.seekers.push({ x: Math.cos(a) * muzzle, y: Math.sin(a) * muzzle, vx: Math.cos(a) * MG.SEEKER_SPEED, vy: Math.sin(a) * MG.SEEKER_SPEED, life: MG.SEEKER_LIFE, targetId: -1, trail: [], trailTick: 0 });
  flash(st, 'SEEKER', 0.8);
  emit(st, { type: 'seeker' });
  return true;
}

/**
 * Drone count range for a swarm released at `level`: both ends grow by floor(SWARM_GROWTH_PER_LEVEL * (level - 1))
 * and are capped at SWARM_COUNT_CAP. Example: defaults give 5-8 at level 1, 9-12 at level 9, 16 flat from level 17.
 */
export function swarmCountRange(level: number): { min: number; max: number } {
  const g = Math.floor(MG.SWARM_GROWTH_PER_LEVEL * Math.max(0, level - 1));
  const max = Math.min(MG.SWARM_COUNT_CAP, MG.SWARM_COUNT_MAX + g);
  const min = Math.min(max, MG.SWARM_COUNT_MIN + g);
  return { min, max };
}

/** Burn-out life of a drone released at `level`: SWARM_LIFE + SWARM_LIFE_PER_LEVEL per level, capped. 10 s at level 1. */
export const swarmLife = (level: number): number => Math.min(MG.SWARM_LIFE_MAX, MG.SWARM_LIFE + MG.SWARM_LIFE_PER_LEVEL * Math.max(0, level - 1));

/** A circular zone to keep clear of (the moon plus a margin). */
interface Zone {
  x: number;
  y: number;
  r: number;
}

const inZone = (z: Zone | null, x: number, y: number): boolean => z !== null && Math.hypot(x - z.x, y - z.y) < z.r;

/** Release a swarm of sentinels from the player's launcher; `>` key. Draws the count and slots from the Rng. */
export function releaseSwarm(st: MinigameState): boolean {
  if (st.swarmStock <= 0) return false;
  st.swarmStock -= 1;
  const base = launcherAngleAt(st, 0);
  const muzzle = MG.PLANET_R * 1.3;
  const range = swarmCountRange(st.level);
  const n = st.rng.int(range.min, range.max);
  const life = swarmLife(st.level);
  for (let i = 0; i < n; i++) {
    const a = base + (n === 1 ? 0 : (i / (n - 1) - 0.5) * MG.SWARM_FAN);
    st.drones.push({
      x: Math.cos(base) * muzzle, y: Math.sin(base) * muzzle,
      vx: Math.cos(a) * MG.SWARM_SPEED, vy: Math.sin(a) * MG.SWARM_SPEED,
      life, maxLife: life, cooldown: st.rng.float(0.2, 0.5), targetId: -1,
      slot: (i / n) * Math.PI * 2,
    });
  }
  flash(st, `SWARM X${n}`, 1);
  emit(st, { type: 'swarm', count: n });
  return true;
}

/**
 * Closest rock to a point, non-passing rocks preferred (their distance counts as `passPenalty` longer) and
 * rocks inside `avoid` (the moon's zone) counted MOON_AVOID_PENALTY longer: the moon is about to take those.
 */
function closestThreat(st: MinigameState, x: number, y: number, passPenalty: number, avoid: Zone | null = null): Asteroid | null {
  let best: Asteroid | null = null;
  let bestD = Infinity;
  for (const a of st.asteroids) {
    const d = Math.hypot(a.x - x, a.y - y) + (a.passing ? passPenalty : 0) + (inZone(avoid, a.x, a.y) ? MG.MOON_AVOID_PENALTY : 0);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

/** Area blast at (x, y): damage and an outward push on every rock within SEEKER_BLAST_R, then the kills. */
function detonate(st: MinigameState, x: number, y: number): void {
  const dead: number[] = [];
  for (let j = 0; j < st.asteroids.length; j++) {
    const a = st.asteroids[j];
    if (!a) continue;
    const dx = a.x - x;
    const dy = a.y - y;
    const d = Math.hypot(dx, dy);
    if (d - a.r > MG.SEEKER_BLAST_R) continue;
    a.hp -= MG.SEEKER_BLAST_DAMAGE;
    const k = MG.SEEKER_BLAST_IMPULSE / rockMass(a);
    const ux = d > 1e-9 ? dx / d : 1;
    const uy = d > 1e-9 ? dy / d : 0;
    a.vx += ux * k;
    a.vy += uy * k;
    emit(st, { type: 'hit', tier: a.tier });
    if (a.hp <= 0) dead.push(j);
  }
  spawnParticles(st, x, y, 18, 3, 2);
  emit(st, { type: 'blast' });
  dead.sort((p, q) => q - p);
  for (const j of dead) destroyAsteroid(st, j, 1, true);
}

/** Seekers: lead pursuit with a turn-rate cap, blast on contact, fizzle at end of life. */
function stepSeekers(st: MinigameState, dt: number, moonOn: boolean, moon: { x: number; y: number }): void {
  const zone: Zone | null = moonOn ? { x: moon.x, y: moon.y, r: MG.MOON_R + MG.SEEKER_MOON_MARGIN } : null;
  for (let i = st.seekers.length - 1; i >= 0; i--) {
    const s = st.seekers[i];
    if (!s) continue;
    s.life -= dt;
    if (s.life <= 0) {
      spawnParticles(st, s.x, s.y, 4, 1, -1);
      swapRemove(st.seekers, i);
      continue;
    }
    let target = findRock(st, s.targetId);
    if (!target) {
      target = closestThreat(st, s.x, s.y, 2.5, zone);
      s.targetId = target ? target.id : -1;
    }
    if (target) {
      let want = leadAngle(s.x, s.y, target, MG.SEEKER_SPEED);
      // Moon avoidance: within 1.5 zone radii, blend an "away from the moon" direction into the pursuit,
      // stronger the closer; skipped when the target itself sits in the zone (then the rock is worth it).
      if (zone && !inZone(zone, target.x, target.y)) {
        const ax = s.x - zone.x;
        const ay = s.y - zone.y;
        const ad = Math.hypot(ax, ay);
        const reach = zone.r * 1.5;
        if (ad < reach && ad > 1e-9) {
          const w = ((reach - ad) / reach) * 2;
          want = Math.atan2(Math.sin(want) + (ay / ad) * w, Math.cos(want) + (ax / ad) * w);
        }
      }
      steer(s, want, MG.SEEKER_TURN * dt, MG.SEEKER_SPEED);
    }
    if (++s.trailTick >= 2) {
      s.trailTick = 0;
      s.trail.push(s.x, s.y);
      if (s.trail.length > MG.SEEKER_TRAIL * 2) s.trail.splice(0, 2);
    }
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (moonOn && Math.hypot(s.x - moon.x, s.y - moon.y) <= MG.MOON_R) {
      swapRemove(st.seekers, i);
      continue;
    }
    if (Math.hypot(s.x, s.y) > MG.FIELD_R + 1) {
      swapRemove(st.seekers, i);
      continue;
    }
    let contact = false;
    for (const a of st.asteroids) {
      if (Math.hypot(a.x - s.x, a.y - s.y) <= a.r + MG.SEEKER_R) {
        contact = true;
        break;
      }
    }
    if (contact) {
      const x = s.x;
      const y = s.y;
      swapRemove(st.seekers, i);
      detonate(st, x, y);
    }
  }
}

/** Drones: hunt the nearest rock, hold a slot around it, keep apart, keep off the moon, fire weak fast bullets, burn out. */
function stepDrones(st: MinigameState, dt: number, moonOn: boolean, moon: { x: number; y: number }): void {
  const zone: Zone | null = moonOn ? { x: moon.x, y: moon.y, r: MG.MOON_R + MG.SWARM_MOON_MARGIN } : null;
  for (let i = st.drones.length - 1; i >= 0; i--) {
    const d = st.drones[i];
    if (!d) continue;
    d.life -= dt;
    if (d.life <= 0) {
      spawnParticles(st, d.x, d.y, 3, 0.8, -1);
      emit(st, { type: 'burnout' });
      swapRemove(st.drones, i);
      continue;
    }
    let target = findRock(st, d.targetId);
    if (!target || Math.hypot(target.x - d.x, target.y - d.y) > MG.SWARM_RANGE * 2 || inZone(zone, target.x, target.y)) {
      target = closestThreat(st, d.x, d.y, 0, zone);
      d.targetId = target ? target.id : -1;
    }
    // Where to go: a slot around the target at SWARM_STANDOFF, or outward when there is nothing to hunt.
    let gx: number;
    let gy: number;
    if (target) {
      gx = target.x + Math.cos(d.slot) * (target.r + MG.SWARM_STANDOFF);
      gy = target.y + Math.sin(d.slot) * (target.r + MG.SWARM_STANDOFF);
    } else {
      const r = Math.hypot(d.x, d.y) || 1;
      gx = (d.x / r) * (r + 1);
      gy = (d.y / r) * (r + 1);
    }
    // Separation from siblings and the planet.
    for (const o of st.drones) {
      if (o === d) continue;
      const ox = d.x - o.x;
      const oy = d.y - o.y;
      const od = Math.hypot(ox, oy);
      if (od < MG.SWARM_SEPARATION && od > 1e-9) {
        gx += (ox / od) * (MG.SWARM_SEPARATION - od) * 3;
        gy += (oy / od) * (MG.SWARM_SEPARATION - od) * 3;
      }
    }
    const rr = Math.hypot(d.x, d.y);
    if (rr < MG.SWARM_R_MIN && rr > 1e-9) {
      gx += (d.x / rr) * (MG.SWARM_R_MIN - rr) * 4;
      gy += (d.y / rr) * (MG.SWARM_R_MIN - rr) * 4;
    }
    if (zone) {
      // Moon avoidance, two parts. A goal inside the zone is slid to the zone's edge on the drone's side...
      let mx = gx - zone.x;
      let my = gy - zone.y;
      let md = Math.hypot(mx, my);
      if (md < zone.r) {
        if (md < 1e-9) {
          mx = d.x - zone.x;
          my = d.y - zone.y;
          md = Math.hypot(mx, my) || 1;
        }
        gx = zone.x + (mx / md) * zone.r;
        gy = zone.y + (my / md) * zone.r;
      }
      // ...and within 1.6 zone radii an away push grows until it dominates the goal.
      const ax = d.x - zone.x;
      const ay = d.y - zone.y;
      const ad = Math.hypot(ax, ay);
      const reach = zone.r * 1.6;
      if (ad < reach && ad > 1e-9) {
        const w = ((reach - ad) / reach) * 6;
        gx += (ax / ad) * w;
        gy += (ay / ad) * w;
      }
    }
    steer(d, Math.atan2(gy - d.y, gx - d.x), MG.SWARM_TURN * dt, MG.SWARM_SPEED);
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    if (zone) {
      // The zone is impassable: a drone that ended the step inside (its own turn radius, or the moon moving
      // into it) is slid back to the edge and loses its inward velocity. steer() restores the speed next step.
      const ax = d.x - zone.x;
      const ay = d.y - zone.y;
      const ad = Math.hypot(ax, ay);
      if (ad < zone.r) {
        const ux = ad > 1e-9 ? ax / ad : 1;
        const uy = ad > 1e-9 ? ay / ad : 0;
        d.x = zone.x + ux * zone.r;
        d.y = zone.y + uy * zone.r;
        const vin = d.vx * ux + d.vy * uy;
        if (vin < 0) {
          d.vx -= vin * ux;
          d.vy -= vin * uy;
        }
      }
    }
    if (moonOn && Math.hypot(d.x - moon.x, d.y - moon.y) <= MG.MOON_R) {
      // Unreachable while the zone holds; kept as the safety net the moon's absorption rule promises.
      swapRemove(st.drones, i);
      continue;
    }
    d.cooldown -= dt;
    if (target && d.cooldown <= 0 && Math.hypot(target.x - d.x, target.y - d.y) <= MG.SWARM_RANGE) {
      const speed = MG.BULLET_SPEED * MG.SWARM_BULLET_SPEED;
      pushBullet(st, d.x, d.y, leadAngle(d.x, d.y, target, speed), MG.SWARM_DAMAGE, true, speed, MG.SWARM_BULLET_LIFE);
      d.cooldown = MG.SWARM_COOLDOWN;
    }
  }
}

/** Instant beam along `angle` from the muzzle to LASER_RANGE: damages and pushes every rock it crosses. */
function fireLaser(st: MinigameState, angle: number): void {
  const damage = strengthLevel(st.streamCount) + MG.LASER_DAMAGE_BONUS;
  const muzzle = MG.PLANET_R * 1.28;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const dead: number[] = [];
  for (let j = 0; j < st.asteroids.length; j++) {
    const a = st.asteroids[j];
    if (!a) continue;
    const along = a.x * ca + a.y * sa;
    const perp = Math.abs(-a.x * sa + a.y * ca);
    if (along < muzzle || along > MG.LASER_RANGE || perp > a.r) continue;
    a.hp -= damage;
    const k = (MG.BULLET_IMPULSE * MG.LASER_IMPULSE_MULT * damage) / rockMass(a);
    a.vx += ca * k;
    a.vy += sa * k;
    creditHit(st);
    spawnParticles(st, a.x - ca * a.r, a.y - sa * a.r, 5, 2, a.tier);
    emit(st, { type: 'hit', tier: a.tier });
    if (a.hp <= 0) dead.push(j);
  }
  dead.sort((p, q) => q - p);
  for (const j of dead) destroyAsteroid(st, j, 1, true);
  st.beams.push({ angle, t: MG.BEAM_FADE });
  emit(st, { type: 'laser' });
}

function fire(st: MinigameState): void {
  st.shots += 1;
  const stage = laserStage(st.streamCount);
  const laser = laserArmed(st);
  const laserLaunchers = laser ? (stage === 2 ? st.launcherCount : 1) : 0;
  st.sinceShot = 0;
  const centre = (st.streamCount - 1) / 2;
  for (let i = 0; i < st.launcherCount; i++) {
    const base = launcherAngleAt(st, i);
    const muzzle = MG.PLANET_R * 1.28;
    const beamHere = i < laserLaunchers;
    if (beamHere) fireLaser(st, base);
    for (let j = 0; j < st.streamCount; j++) {
      // The laser replaces the centre stream's projectile on that pull (only exact centres: odd counts).
      if (beamHere && j === centre) continue;
      const a = base + (j - centre) * MG.STREAM_SPREAD;
      pushBullet(st, Math.cos(base) * muzzle, Math.sin(base) * muzzle, a, streamDamage(st.streamCount, j), false);
    }
  }
  if (laser && !st.cheats.noHeat) st.heat += MG.LASER_HEAT;
  emit(st, { type: 'shot', strength: strengthLevel(st.streamCount) });
}

/**
 * Deploy a sentry. Draw order from the Rng (fixed, so saves and replays agree): angle, then SUPER unless
 * forced, then kind unless forced.
 */
export function deployTurret(st: MinigameState, forceSuper?: boolean, forceKind?: SentryKind): void {
  if (st.turrets.length >= MG.TURRET_MAX) return;
  const angle = st.rng.float(0, Math.PI * 2);
  const superb = forceSuper ?? st.rng.chance(MG.TURRET_SUPER_PROB);
  const kind = forceKind ?? st.rng.pick(SENTRY_KINDS);
  const life = MG.TURRET_LIFE * (superb ? MG.TURRET_SUPER_LIFE_MULT : 1);
  st.turrets.push({ kind, angle, radius: MG.TURRET_ORBIT_R, home: angle, phase: 0, burst: 0, life, maxLife: life, cooldown: 0.5, targetId: -1, tier: turretTier(st.level), superb });
  flash(st, `${superb ? 'SUPER ' : ''}${kind.toUpperCase()} SENTRY`, 1.6);
  emit(st, { type: 'turret' });
}

/** Most threatening rock: closest to the planet, non-passing first. */
function pickTarget(st: MinigameState): Asteroid | null {
  let best: Asteroid | null = null;
  let bestScore = Infinity;
  for (const a of st.asteroids) {
    const d = Math.hypot(a.x, a.y) + (a.passing ? 3 : 0);
    if (d < bestScore) {
      bestScore = d;
      best = a;
    }
  }
  return best;
}

/** Nearest rock to a point, optionally only those on the outward side of it (dot with the radial > 0). */
function nearestRock(st: MinigameState, x: number, y: number, outwardOnly: boolean): Asteroid | null {
  let best: Asteroid | null = null;
  let bestD = Infinity;
  const len = Math.hypot(x, y) || 1;
  for (const a of st.asteroids) {
    const dx = a.x - x;
    const dy = a.y - y;
    if (outwardOnly && (dx * x + dy * y) / len < -a.r) continue;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

/** Angle of the densest incoming sector: rocks binned by bearing, weighted by 1 / distance, passers ignored. */
export function densestSector(st: MinigameState): number | null {
  const n = MG.SENTRY_PICKET_SECTORS;
  const bins = new Array<number>(n).fill(0);
  let any = false;
  for (const a of st.asteroids) {
    if (a.passing) continue;
    const d = Math.hypot(a.x, a.y);
    const i = Math.floor((wrapAngle(Math.atan2(a.y, a.x)) / (Math.PI * 2)) * n) % n;
    bins[i] = (bins[i] ?? 0) + (a.r + 0.1) / Math.max(1, d);
    any = true;
  }
  if (!any) return null;
  let best = 0;
  for (let i = 1; i < n; i++) if ((bins[i] ?? 0) > (bins[best] ?? 0)) best = i;
  return ((best + 0.5) / n) * Math.PI * 2;
}

/** Aim at a target from (tx, ty) with lead for the bullet's travel time, then push one or three bullets. */
function sentryFire(st: MinigameState, tr: Turret, tx: number, ty: number, target: Asteroid): void {
  const lead = Math.hypot(target.x - tx, target.y - ty) / MG.BULLET_SPEED;
  const ang = Math.atan2(target.y + target.vy * lead - ty, target.x + target.vx * lead - tx);
  const dmg = strengthLevel(st.streamCount) + tr.tier;
  if (tr.superb) {
    for (const off of [-0.12, 0, 0.12]) pushBullet(st, tx, ty, ang + off, dmg, true);
  } else {
    pushBullet(st, tx, ty, ang, dmg, true);
  }
}

/** One sentry's tick: move by archetype, choose a target, fire on its own schedule. */
function stepTurret(st: MinigameState, tr: Turret, dt: number): void {
  const rate = (1 + 0.35 * tr.tier) * (tr.superb ? 2 : 1);
  let target: Asteroid | null;
  switch (tr.kind) {
    case 'orbiter':
      tr.angle = wrapAngle(tr.angle + MG.TURRET_ANGULAR_SPEED * dt);
      tr.radius = MG.TURRET_ORBIT_R;
      target = pickTarget(st);
      break;
    case 'sweeper': {
      tr.phase += MG.SENTRY_SWEEP_RATE * dt;
      tr.angle = wrapAngle(tr.home + MG.SENTRY_SWEEP_ARC * Math.sin(tr.phase));
      tr.radius = MG.TURRET_ORBIT_R;
      const p = turretPosition(tr);
      target = nearestRock(st, p.x, p.y, true);
      break;
    }
    case 'picket': {
      tr.phase -= dt;
      if (tr.phase <= 0) {
        tr.phase = MG.SENTRY_PICKET_RETARGET;
        const want = densestSector(st);
        if (want !== null) tr.home = want;
      }
      const diff = signedAngle(tr.home - tr.angle);
      const turn = MG.SENTRY_PICKET_TURN * dt;
      tr.angle = wrapAngle(tr.angle + clamp(diff, -turn, turn));
      tr.radius = MG.TURRET_ORBIT_R;
      const p = turretPosition(tr);
      target = nearestRock(st, p.x, p.y, false);
      break;
    }
    case 'chaser': {
      target = pickTarget(st);
      const p = turretPosition(tr);
      const hx = MG.TURRET_ORBIT_R * Math.cos(tr.home);
      const hy = MG.TURRET_ORBIT_R * Math.sin(tr.home);
      // Goal: a standoff point short of the target, or home when there is nothing to chase.
      let gx = hx;
      let gy = hy;
      if (target) {
        const dx = target.x - p.x;
        const dy = target.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d > MG.SENTRY_CHASE_STANDOFF) {
          const f = (d - MG.SENTRY_CHASE_STANDOFF) / d;
          gx = p.x + dx * f;
          gy = p.y + dy * f;
        } else {
          gx = p.x;
          gy = p.y;
        }
      }
      // Leash: pull the goal back toward home if it strays too far.
      const lx = gx - hx;
      const ly = gy - hy;
      const ld = Math.hypot(lx, ly);
      if (ld > MG.SENTRY_CHASE_LEASH) {
        gx = hx + (lx / ld) * MG.SENTRY_CHASE_LEASH;
        gy = hy + (ly / ld) * MG.SENTRY_CHASE_LEASH;
      }
      const mx = gx - p.x;
      const my = gy - p.y;
      const md = Math.hypot(mx, my);
      const stepLen = Math.min(md, MG.SENTRY_CHASE_SPEED * dt);
      let nx = p.x;
      let ny = p.y;
      if (md > 1e-9) {
        nx += (mx / md) * stepLen;
        ny += (my / md) * stepLen;
      }
      const nr = Math.hypot(nx, ny);
      tr.radius = Math.max(MG.SENTRY_CHASE_R_MIN, nr);
      tr.angle = nr > 1e-9 ? wrapAngle(Math.atan2(ny, nx)) : tr.angle;
      break;
    }
  }
  tr.targetId = target ? target.id : -1;
  tr.cooldown -= dt;
  if (!target || tr.cooldown > 0) return;
  const p = turretPosition(tr);
  sentryFire(st, tr, p.x, p.y, target);
  if (tr.kind === 'sweeper') {
    // Bursts: a few quick shots, then a rest.
    tr.burst += 1;
    if (tr.burst < MG.SENTRY_BURST) {
      tr.cooldown = MG.SENTRY_BURST_GAP;
    } else {
      tr.burst = 0;
      tr.cooldown = MG.SENTRY_BURST_REST / rate;
    }
  } else {
    tr.cooldown = MG.TURRET_COOLDOWN / rate;
  }
}

// --- the step ----------------------------------------------------------------------------------------------

export function step(st: MinigameState, input: Readonly<Input>, dt: number): void {
  for (let i = st.flashes.length - 1; i >= 0; i--) {
    const f = st.flashes[i];
    if (f && (f.t -= dt) <= 0) st.flashes.splice(i, 1);
  }
  st.shake = Math.max(0, st.shake - dt * 0.6);
  for (let i = st.beams.length - 1; i >= 0; i--) {
    const b = st.beams[i];
    if (b && (b.t -= dt) <= 0) st.beams.splice(i, 1);
  }
  for (let i = st.particles.length - 1; i >= 0; i--) {
    const p = st.particles[i];
    if (!p) continue;
    p.life -= dt;
    if (p.life <= 0) {
      swapRemove(st.particles, i);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.985;
    p.vy *= 0.985;
  }
  if (st.status !== 'playing') return;

  st.t += dt;
  st.sinceHit += dt;
  st.sinceShot += dt;
  st.secAccum += dt;
  while (st.secAccum >= 1) {
    st.secAccum -= 1;
    st.score += MG.SCORE_PER_SEC;
  }

  // Level and the tables that hang off it.
  const lvl = levelAt(st.t);
  if (lvl !== st.level) {
    st.level = lvl;
    flash(st, `LEVEL ${lvl}`, 1.6);
    emit(st, { type: 'levelup' });
    if (lvl === MG.MOON_LEVEL) flash(st, 'MOON IN ORBIT', 2);
    if (lvl === MG.PASSING_LEVEL) flash(st, 'PASSING ROCKS: NUDGE THEM', 2);
    if (lvl === MG.TURRET_LEVEL) flash(st, 'SENTRIES EARNED PER 60 HITS', 2);
    // A random SUPER sentry now and then: a breather as the field gets busy.
    if (lvl > MG.TURRET_LEVEL && st.rng.chance(MG.TURRET_GIFT_PROB)) deployTurret(st, true);
  }
  const wantL = st.cheats.launchers ?? launcherCount(st.level);
  if (wantL !== st.launcherCount) {
    st.launcherCount = wantL;
    flash(st, `LAUNCHERS X${wantL}`);
  }
  const wantS = st.cheats.streams ?? streamCount(st.level);
  if (wantS !== st.streamCount) {
    st.streamCount = wantS;
    flash(st, `STREAMS X${wantS}  STRENGTH ${strengthLevel(wantS)}`);
  }

  // Adaptive pressure: creeps up while healthy and un-hit, eases off when the hull is low.
  if (st.hp / MG.MAX_HP > 0.6 && st.sinceHit > MG.PRESSURE_CALM_SECONDS) st.pressure += MG.PRESSURE_GAIN * dt;
  if (st.hp / MG.MAX_HP < MG.PRESSURE_LOW_HP && st.pressure > MG.PRESSURE_LOW_TARGET) st.pressure -= MG.PRESSURE_LOW_RATE * dt;
  st.pressure = clamp(st.pressure, MG.PRESSURE_MIN, pressureMax(st.level));

  // Player: left is counter-clockwise (angle increases), right is clockwise.
  if (input.left) st.launcherAngle = wrapAngle(st.launcherAngle + MG.LAUNCHER_SPEED * dt);
  if (input.right) st.launcherAngle = wrapAngle(st.launcherAngle - MG.LAUNCHER_SPEED * dt);

  // Heat.
  st.heat = Math.max(0, st.heat - MG.HEAT_COOL * dt);
  if (st.overheated && st.heat <= MG.HEAT_UNLOCK) {
    st.overheated = false;
    flash(st, 'COOLED', 0.8);
    emit(st, { type: 'cooled' });
  }
  st.fireCooldown -= dt;
  if (input.fire && st.fireCooldown <= 0 && !st.overheated) {
    fire(st);
    st.fireCooldown = MG.FIRE_COOLDOWN;
    if (!st.cheats.noHeat) st.heat += MG.HEAT_PER_SHOT;
    if (st.heat >= 1) {
      st.heat = 1;
      st.overheated = true;
      flash(st, 'OVERHEAT', 1.2);
      emit(st, { type: 'overheat' });
    }
  }
  if (input.pulse && st.pulses > 0 && st.pulseR < 0) {
    st.pulses -= 1;
    st.pulseR = MG.PLANET_R;
    flash(st, 'PULSE', 0.8);
    emit(st, { type: 'pulse' });
  }
  if (input.seeker) launchSeeker(st);
  if (input.swarm) releaseSwarm(st);

  // Moon.
  const moonOn = moonAlive(st);
  if (moonActive(st.level)) st.moonAngle = wrapAngle(st.moonAngle + MG.MOON_ANGULAR_SPEED * dt);
  const moon = moonPosition(st);

  // Earned weapons in flight.
  stepSeekers(st, dt, moonOn, moon);
  stepDrones(st, dt, moonOn, moon);

  // Sentries: each archetype moves, targets and fires its own way (stepTurret).
  for (let i = st.turrets.length - 1; i >= 0; i--) {
    const tr = st.turrets[i];
    if (!tr) continue;
    tr.life -= dt;
    if (tr.life <= 0) {
      swapRemove(st.turrets, i);
      continue;
    }
    stepTurret(st, tr, dt);
  }

  // Spawning.
  st.spawnTimer -= dt;
  while (st.spawnTimer <= 0) {
    spawnAsteroid(st);
    st.spawnTimer += baseSpawnInterval(st.level) / st.pressure;
  }

  // Bullets: fly, expire, or get absorbed by the moon.
  for (let i = st.bullets.length - 1; i >= 0; i--) {
    const b = st.bullets[i];
    if (!b) continue;
    b.life -= dt;
    if (b.life <= 0) {
      swapRemove(st.bullets, i);
      continue;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (moonOn && Math.hypot(b.x - moon.x, b.y - moon.y) <= MG.MOON_R) swapRemove(st.bullets, i);
  }

  // Rock-on-rock gravity and bounces; crashes can break rocks.
  const crashed = interact(st, dt);
  crashed.sort((p, q) => q - p);
  for (const j of crashed) destroyAsteroid(st, j, 0.5, true);

  // Asteroids: moon gravity, motion, planet and moon contact.
  for (let i = st.asteroids.length - 1; i >= 0; i--) {
    const a = st.asteroids[i];
    if (!a) continue;
    if (moonOn) {
      const dx = moon.x - a.x;
      const dy = moon.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d < MG.MOON_INFLUENCE && d > 1e-6) {
        const acc = MG.MOON_MU / Math.max(d * d, 0.09);
        a.vx += (dx / d) * acc * dt;
        a.vy += (dy / d) * acc * dt;
      }
      if (d <= MG.MOON_R + a.r) {
        spawnParticles(st, a.x, a.y, 8, 2, a.tier);
        st.score += Math.floor(a.r * MG.SCORE_PER_R * 0.25);
        st.moonHp -= hullDamage(st.level, a.r, a.tier);
        emit(st, { type: 'moonhit' });
        if (st.moonHp <= 0) {
          st.moonHp = 0;
          spawnParticles(st, moon.x, moon.y, 40, 2.5, 2);
          flash(st, 'MOON LOST', 2);
          emit(st, { type: 'moonlost' });
        }
        swapRemove(st.asteroids, i);
        continue;
      }
    }
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    a.rot += a.spin * dt;
    const d = Math.hypot(a.x, a.y);
    if (d - a.r <= MG.PLANET_R) {
      const dmg = hullDamage(st.level, a.r, a.tier);
      if (!st.cheats.god) st.hp -= dmg;
      st.shake += dmg * MG.SHAKE_PER_HP;
      st.sinceHit = 0;
      st.pressure = clamp(st.pressure - MG.PRESSURE_HIT_DROP, MG.PRESSURE_MIN, pressureMax(st.level));
      spawnParticles(st, a.x, a.y, MG.PARTICLES_PER_IMPACT, 3, -1);
      emit(st, { type: 'impact' });
      swapRemove(st.asteroids, i);
      if (st.hp <= 0) {
        st.hp = 0;
        st.status = 'over';
        emit(st, { type: 'over' });
        return;
      }
    } else if (d > MG.FIELD_R + 2) {
      swapRemove(st.asteroids, i);
    }
  }

  // Shockwave.
  if (st.pulseR >= 0) {
    st.pulseR += MG.PULSE_SPEED * dt;
    for (let i = st.asteroids.length - 1; i >= 0; i--) {
      const a = st.asteroids[i];
      if (a && Math.hypot(a.x, a.y) - a.r <= st.pulseR) destroyAsteroid(st, i, MG.PULSE_SCORE_MULT, false);
    }
    if (st.pulseR > MG.FIELD_R + 1) st.pulseR = -1;
  }

  // Bullet hits: damage, impulse, then removal in descending index order.
  st.stats.collisionChecksLastStep = st.bullets.length * st.asteroids.length;
  if (st.bullets.length > 0 && st.asteroids.length > 0) {
    const hits = findHits(st.bullets, st.asteroids, st.collision);
    const dead: number[] = [];
    const used: number[] = [];
    for (let i = 0; i < hits.length; i++) {
      const j = hits[i] as number;
      if (j < 0) continue;
      const a = st.asteroids[j];
      const b = st.bullets[i];
      if (!a || !b) continue;
      used.push(i);
      spawnParticles(st, b.x, b.y, 3, 1.5, a.tier);
      emit(st, { type: 'hit', tier: a.tier });
      a.hp -= b.damage;
      // Kinetic push: impulse along the bullet's direction, divided by the rock's mass.
      const sp = Math.hypot(b.vx, b.vy);
      const k = (MG.BULLET_IMPULSE * b.damage) / rockMass(a) / sp;
      a.vx += b.vx * k;
      a.vy += b.vy * k;
      if (!b.auto) {
        creditHit(st);
        if (st.level >= MG.TURRET_LEVEL) {
          st.turretProgress += 1;
          if (st.turretProgress >= MG.TURRET_HITS) {
            st.turretProgress = 0;
            deployTurret(st);
          }
        }
      }
      if (a.hp <= 0 && !dead.includes(j)) dead.push(j);
    }
    used.sort((p, q) => q - p);
    for (const i of used) swapRemove(st.bullets, i);
    dead.sort((p, q) => q - p);
    for (const j of dead) destroyAsteroid(st, j, 1, true);
  }
}

// --- save and resume ---------------------------------------------------------------------------------------
// NOTE: a game is (seed, inputs), but mid-game resume needs the whole state: the Rng's raw state stands in for
// the draw history, typed arrays become plain arrays, and transient queues (events, stats) are not saved.

/** JSON shape of a saved game. Everything `step` reads, in plain JSON types. v2: sentry archetypes; v3: seekers and swarms. */
export interface SavedGame {
  v: 3;
  seed: number;
  rng: number;
  status: Status;
  t: number;
  level: number;
  hp: number;
  score: number;
  kills: number;
  hits: number;
  shots: number;
  continents: number[][];
  launcherAngle: number;
  launcherCount: number;
  streamCount: number;
  fireCooldown: number;
  heat: number;
  overheated: boolean;
  spawnTimer: number;
  pressure: number;
  sinceHit: number;
  nextId: number;
  asteroids: Array<Omit<Asteroid, 'shape'> & { shape: number[] }>;
  bullets: Bullet[];
  particles: Particle[];
  turrets: Turret[];
  turretProgress: number;
  moonAngle: number;
  moonHp: number;
  craters: Array<[number, number, number]>;
  pulses: number;
  pulseCharge: number;
  pulseR: number;
  seekers: Seeker[];
  seekerStock: number;
  seekerProgress: number;
  drones: Drone[];
  swarmStock: number;
  swarmProgress: number;
  flashes: Flash[];
  beams: Beam[];
  sinceShot: number;
  shake: number;
  secAccum: number;
  cheats: Cheats;
  collision: CollisionStrategy;
}

type Pred = (v: unknown) => boolean;
const num: Pred = (v) => typeof v === 'number' && Number.isFinite(v);
const bool: Pred = (v) => typeof v === 'boolean';
const str: Pred = (v) => typeof v === 'string';
const numArr: Pred = (v) => Array.isArray(v) && v.every(num);
const opt = (p: Pred): Pred => (v) => v === undefined || p(v);
const oneOf = (...opts: readonly unknown[]): Pred => (v) => opts.includes(v);
const arrOf = (p: Pred): Pred => (v) => Array.isArray(v) && v.every(p);
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shaped = (spec: Record<string, Pred>): Pred => (v) => isRecord(v) && Object.entries(spec).every(([k, p]) => p(v[k]));

const ASTEROID = shaped({ id: num, x: num, y: num, vx: num, vy: num, r: num, tier: num, hp: num, maxHp: num, core: bool, passing: bool, shape: numArr, rot: num, spin: num });
const BULLET = shaped({ x: num, y: num, vx: num, vy: num, life: num, r: num, damage: num, auto: bool });
const PARTICLE = shaped({ x: num, y: num, vx: num, vy: num, life: num, max: num, tier: num });
const TURRET = shaped({ kind: oneOf(...SENTRY_KINDS), angle: num, radius: num, home: num, phase: num, burst: num, life: num, maxLife: num, cooldown: num, targetId: num, tier: num, superb: bool });
const SEEKER = shaped({ x: num, y: num, vx: num, vy: num, life: num, targetId: num, trail: numArr, trailTick: num });
const DRONE = shaped({ x: num, y: num, vx: num, vy: num, life: num, maxLife: num, cooldown: num, targetId: num, slot: num });
const FLASH = shaped({ text: str, t: num });
const BEAM = shaped({ angle: num, t: num });
const CRATER: Pred = (v) => numArr(v) && (v as number[]).length === 3;
const CHEATS = shaped({ god: bool, launchers: opt(num), streams: opt(num), timeScale: num, assisted: bool, noHeat: bool });
const SAVED = shaped({
  v: oneOf(3), seed: num, rng: num, status: oneOf('ready', 'playing', 'over'),
  t: num, level: num, hp: num, score: num, kills: num, hits: num, shots: num,
  continents: arrOf(numArr),
  launcherAngle: num, launcherCount: num, streamCount: num, fireCooldown: num,
  heat: num, overheated: bool, spawnTimer: num, pressure: num, sinceHit: num, nextId: num,
  asteroids: arrOf(ASTEROID), bullets: arrOf(BULLET), particles: arrOf(PARTICLE), turrets: arrOf(TURRET),
  turretProgress: num, moonAngle: num, moonHp: num, craters: arrOf(CRATER),
  pulses: num, pulseCharge: num, pulseR: num,
  seekers: arrOf(SEEKER), seekerStock: num, seekerProgress: num, drones: arrOf(DRONE), swarmStock: num, swarmProgress: num,
  flashes: arrOf(FLASH), beams: arrOf(BEAM),
  sinceShot: num, shake: num, secAccum: num, cheats: CHEATS, collision: oneOf('auto', 'naive', 'grid'),
});

/** Type guard for anything read back from storage (persistence.ts convention). */
export const isSavedGame = (v: unknown): v is SavedGame => SAVED(v);

export function toSaved(st: MinigameState): SavedGame {
  return {
    v: 3,
    seed: st.seed,
    rng: st.rng.getState(),
    status: st.status,
    t: st.t,
    level: st.level,
    hp: st.hp,
    score: st.score,
    kills: st.kills,
    hits: st.hits,
    shots: st.shots,
    continents: st.continents.map((c) => Array.from(c)),
    launcherAngle: st.launcherAngle,
    launcherCount: st.launcherCount,
    streamCount: st.streamCount,
    fireCooldown: st.fireCooldown,
    heat: st.heat,
    overheated: st.overheated,
    spawnTimer: st.spawnTimer,
    pressure: st.pressure,
    sinceHit: st.sinceHit,
    nextId: st.nextId,
    asteroids: st.asteroids.map((a) => ({ ...a, shape: Array.from(a.shape) })),
    bullets: st.bullets.map((b) => ({ ...b })),
    particles: st.particles.map((p) => ({ ...p })),
    turrets: st.turrets.map((t) => ({ ...t })),
    turretProgress: st.turretProgress,
    moonAngle: st.moonAngle,
    moonHp: st.moonHp,
    craters: st.craters.map((c) => [c[0], c[1], c[2]]),
    pulses: st.pulses,
    pulseCharge: st.pulseCharge,
    pulseR: st.pulseR,
    seekers: st.seekers.map((s) => ({ ...s, trail: [...s.trail] })),
    seekerStock: st.seekerStock,
    seekerProgress: st.seekerProgress,
    drones: st.drones.map((d) => ({ ...d })),
    swarmStock: st.swarmStock,
    swarmProgress: st.swarmProgress,
    flashes: st.flashes.map((f) => ({ ...f })),
    beams: st.beams.map((b) => ({ ...b })),
    sinceShot: st.sinceShot,
    shake: st.shake,
    secAccum: st.secAccum,
    cheats: { ...st.cheats },
    collision: st.collision,
  };
}

/** Rebuild a live state from a validated save. The Rng resumes mid-stream, so the game continues exactly. */
export function fromSaved(s: SavedGame): MinigameState {
  return {
    seed: s.seed,
    rng: Rng.fromState(s.rng),
    status: s.status,
    t: s.t,
    level: s.level,
    hp: s.hp,
    score: s.score,
    kills: s.kills,
    hits: s.hits,
    shots: s.shots,
    continents: s.continents.map((c) => Float64Array.from(c)),
    launcherAngle: s.launcherAngle,
    launcherCount: s.launcherCount,
    streamCount: s.streamCount,
    fireCooldown: s.fireCooldown,
    heat: s.heat,
    overheated: s.overheated,
    spawnTimer: s.spawnTimer,
    pressure: s.pressure,
    sinceHit: s.sinceHit,
    nextId: s.nextId,
    asteroids: s.asteroids.map((a) => ({ ...a, shape: Float64Array.from(a.shape) })),
    bullets: s.bullets.map((b) => ({ ...b })),
    particles: s.particles.map((p) => ({ ...p })),
    turrets: s.turrets.map((t) => ({ ...t })),
    turretProgress: s.turretProgress,
    moonAngle: s.moonAngle,
    moonHp: s.moonHp,
    craters: s.craters.map((c) => [c[0], c[1], c[2]]),
    pulses: s.pulses,
    pulseCharge: s.pulseCharge,
    pulseR: s.pulseR,
    seekers: s.seekers.map((k) => ({ ...k, trail: [...k.trail] })),
    seekerStock: s.seekerStock,
    seekerProgress: s.seekerProgress,
    drones: s.drones.map((d) => ({ ...d })),
    swarmStock: s.swarmStock,
    swarmProgress: s.swarmProgress,
    flashes: s.flashes.map((f) => ({ ...f })),
    beams: s.beams.map((b) => ({ ...b })),
    events: [],
    sinceShot: s.sinceShot,
    shake: s.shake,
    secAccum: s.secAccum,
    cheats: { ...s.cheats },
    collision: s.collision,
    stats: { collisionChecksLastStep: 0 },
  };
}

/** JSON text of a game, for storage. */
export const serialize = (st: MinigameState): string => JSON.stringify(toSaved(st));

/** Parse JSON text back into a live state, or null if it is not a valid save. */
export function deserialize(json: string): MinigameState | null {
  try {
    const parsed: unknown = JSON.parse(json);
    return isSavedGame(parsed) ? fromSaved(parsed) : null;
  } catch {
    return null;
  }
}

/** Serializable snapshot for determinism tests. */
export function snapshot(st: MinigameState): string {
  return JSON.stringify({
    t: st.t,
    level: st.level,
    hp: st.hp,
    score: st.score,
    kills: st.kills,
    hits: st.hits,
    heat: st.heat,
    pressure: st.pressure,
    rng: st.rng.getState(),
    a: st.asteroids.map((a) => [a.id, a.x, a.y, a.vx, a.vy, a.hp, a.tier]),
    b: st.bullets.length,
    tr: st.turrets.map((t) => [t.kind, t.angle, t.radius, t.life, t.targetId]),
    sk: st.seekers.map((s) => [s.x, s.y, s.vx, s.vy, s.targetId]),
    dr: st.drones.map((d) => [d.x, d.y, d.vx, d.vy, d.targetId, d.cooldown]),
    stock: [st.pulses, st.seekerStock, st.seekerProgress, st.swarmStock, st.swarmProgress],
    p: st.pulses,
    status: st.status,
  });
}
