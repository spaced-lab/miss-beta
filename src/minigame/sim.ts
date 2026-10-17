// WHAT: The PERIMETER minigame simulation: pure state + step function, no DOM, no Canvas.
// WHY:  Same rule as the real sim (GAME_PLAN 14): logic that can be unit-tested never touches rendering.
//       A game of PERIMETER is fully determined by (seed, input sequence), so a replay is a list of inputs
//       and the tests can assert exact outcomes. The renderer only reads this state.
// HOW:  `createState(seed)` builds the world; `step(state, input, dt)` advances it one fixed tick.
//       Entities live in plain arrays and are removed with swap-pop to avoid per-frame allocation.
//       Progression is by level (one per LEVEL_SECONDS) read from the tables in config.ts, then scaled
//       by an adaptive `pressure` that rises while the player is healthy and falls on every hull hit.
//       Rocks have a hardness tier 0..3 (hit points, mass, score); bullets carry a damage 1..3 decided by
//       their stream position (centre strongest), and every hit also pushes the rock (impulse / mass),
//       so passing rocks can be nudged and heavy rocks barely move. A moon orbits the planet from
//       MOON_LEVEL: rocks inside its influence are bent toward it, anything touching it is absorbed.
//       Heat: each trigger pull adds heat; at 1.0 fire locks until it cools below HEAT_UNLOCK.
//       Laser: from 3 streams the first pull after a break fires a beam down the centre stream (sim.fireLaser);
//       the step emits SimEvents (shots, hits, breaks, ...) that the host turns into sound; the sim never
//       imports audio.
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
}

export const NO_INPUT: Readonly<Input> = Object.freeze({ left: false, right: false, fire: false, pulse: false });

export interface Asteroid {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** Hardness tier 0..3. */
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

export interface Turret {
  angle: number;
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
export const baseSpawnInterval = (level: number): number => Math.max(MG.SPAWN_MIN, MG.SPAWN_0 * Math.pow(MG.SPAWN_LEVEL_FACTOR, level - 1));
export const baseSpeed = (level: number): number => Math.min(MG.AST_SPEED_MAX, MG.AST_SPEED_0 + MG.AST_SPEED_PER_LEVEL * (level - 1));
export const launcherCount = (level: number): number => byLevel(MG.LAUNCHERS_BY_LEVEL, level);
export const streamCount = (level: number): number => byLevel(MG.STREAMS_BY_LEVEL, level);
export const maxTier = (level: number): number => byLevel(MG.MAX_TIER_BY_LEVEL, level);
/** Hull points one rock removes: DAMAGE_PER_R * r * (1 + 0.5 tier), clamped to the level's cap. */
export const hullDamage = (level: number, r: number, tier: number): number =>
  clamp(Math.round(r * MG.DAMAGE_PER_R * (1 + 0.5 * tier)), MG.DAMAGE_MIN, byLevel(MG.DAMAGE_MAX_BY_LEVEL, level));
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
  const hp = Math.max(1, Math.round(r / MG.AST_HP_UNIT)) * (MG.TIER_HP_MULT[tier] ?? 1);
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
  if (st.asteroids.length >= MG.MAX_ASTEROIDS) return;
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
  if (!passing && st.level >= MG.BINARY_LEVEL && st.asteroids.length + 2 <= MG.MAX_ASTEROIDS && st.rng.chance(MG.BINARY_PROB)) {
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
  if (st.pulseCharge >= 1) {
    st.pulseCharge -= 1;
    if (st.pulses < MG.PULSE_MAX) {
      st.pulses += 1;
      flash(st, 'PULSE READY', 1.2);
    }
  }
  spawnParticles(st, a.x, a.y, MG.PARTICLES_PER_HIT + a.tier * 4, 2.5, a.tier);
  emit(st, { type: 'break', tier: a.tier, r: a.r });
  swapRemove(st.asteroids, i);

  if (allowSplit && !a.core && a.r >= MG.AST_SPLIT_R && st.asteroids.length + 2 <= MG.MAX_ASTEROIDS) {
    const speed = Math.hypot(a.vx, a.vy);
    const hardCoreAt = a.tier >= 1 && st.rng.chance(MG.HARD_CORE_PROB) ? st.rng.int(0, 1) : -1;
    let k = 0;
    for (const side of [-1, 1]) {
      const ang = Math.atan2(a.vy, a.vx) + side * st.rng.float(0.35, 0.8);
      const isCore = k === hardCoreAt;
      const cr = a.r * (isCore ? MG.HARD_CORE_SCALE : MG.AST_CHILD_SCALE);
      const tier = isCore ? Math.min(3, a.tier + 1) : Math.max(0, a.tier - 1);
      st.asteroids.push(
        makeAsteroid(st, a.x + side * cr * 0.6 * -Math.sin(ang), a.y + side * cr * 0.6 * Math.cos(ang), Math.cos(ang) * speed * 1.1, Math.sin(ang) * speed * 1.1, cr, tier, isCore, false),
      );
      k++;
    }
  }
}

function pushBullet(st: MinigameState, x: number, y: number, angle: number, damage: number, auto: boolean): void {
  if (st.bullets.length >= MG.MAX_BULLETS) return;
  st.bullets.push({ x, y, vx: Math.cos(angle) * MG.BULLET_SPEED, vy: Math.sin(angle) * MG.BULLET_SPEED, life: MG.BULLET_LIFE, r: MG.BULLET_R, damage, auto });
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
    st.hits += 1;
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

export function deployTurret(st: MinigameState, forceSuper?: boolean): void {
  if (st.turrets.length >= MG.TURRET_MAX) return;
  const superb = forceSuper ?? st.rng.chance(MG.TURRET_SUPER_PROB);
  const life = MG.TURRET_LIFE * (superb ? MG.TURRET_SUPER_LIFE_MULT : 1);
  st.turrets.push({ angle: st.rng.float(0, Math.PI * 2), life, maxLife: life, cooldown: 0.5, targetId: -1, tier: turretTier(st.level), superb });
  flash(st, superb ? 'SUPER SENTRY' : 'SENTRY DEPLOYED', 1.6);
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
  st.pressure = clamp(st.pressure, MG.PRESSURE_MIN, MG.PRESSURE_MAX);

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

  // Moon.
  const moonOn = moonAlive(st);
  if (moonActive(st.level)) st.moonAngle = wrapAngle(st.moonAngle + MG.MOON_ANGULAR_SPEED * dt);
  const moon = moonPosition(st);

  // Turrets: orbit, pick a target, fire.
  for (let i = st.turrets.length - 1; i >= 0; i--) {
    const tr = st.turrets[i];
    if (!tr) continue;
    tr.life -= dt;
    if (tr.life <= 0) {
      swapRemove(st.turrets, i);
      continue;
    }
    tr.angle = wrapAngle(tr.angle + MG.TURRET_ANGULAR_SPEED * dt);
    tr.cooldown -= dt;
    const target = pickTarget(st);
    tr.targetId = target ? target.id : -1;
    if (target && tr.cooldown <= 0) {
      const tx = MG.TURRET_ORBIT_R * Math.cos(tr.angle);
      const ty = MG.TURRET_ORBIT_R * Math.sin(tr.angle);
      // Lead the target by its travel time at bullet speed.
      const lead = Math.hypot(target.x - tx, target.y - ty) / MG.BULLET_SPEED;
      const ang = Math.atan2(target.y + target.vy * lead - ty, target.x + target.vx * lead - tx);
      const dmg = strengthLevel(st.streamCount) + tr.tier;
      if (tr.superb) {
        for (const off of [-0.12, 0, 0.12]) pushBullet(st, tx, ty, ang + off, dmg, true);
      } else {
        pushBullet(st, tx, ty, ang, dmg, true);
      }
      tr.cooldown = (MG.TURRET_COOLDOWN / (1 + 0.35 * tr.tier)) * (tr.superb ? 0.5 : 1);
    }
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
      st.pressure = clamp(st.pressure - MG.PRESSURE_HIT_DROP, MG.PRESSURE_MIN, MG.PRESSURE_MAX);
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
        st.hits += 1;
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
    tr: st.turrets.length,
    p: st.pulses,
    status: st.status,
  });
}
