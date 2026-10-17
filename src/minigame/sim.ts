// WHAT: The PERIMETER minigame simulation: pure state + step function, no DOM, no Canvas.
// WHY:  Same rule as the real sim (GAME_PLAN 14): logic that can be unit-tested never touches rendering.
//       A game of PERIMETER is fully determined by (seed, input sequence), so a replay is a list of inputs
//       and the tests can assert exact outcomes. The renderer only reads this state.
// HOW:  `createState(seed)` builds the world; `step(state, input, dt)` advances it one fixed tick.
//       Entities live in plain arrays and are removed with swap-pop to avoid per-frame allocation.
//       Difficulty is a set of small functions of elapsed time, exported so they can be tested and plotted:
//         spawnInterval(t) = max(SPAWN_MIN, SPAWN_0 * exp(-t / SPAWN_TAU))
//         asteroidSpeed(t) = min(AST_SPEED_MAX, AST_SPEED_0 + AST_SPEED_RAMP * t)
//         launcherCount(t) = 2^(number of LAUNCHER_DOUBLE_TIMES passed)      1, 2, 4, 8
//         streamCount(t)   = 1 + number of STREAM_TIMES passed              1 .. 5
// LORE: G1 (how to play), G5 (scoring), O14 (randomness)

import { Rng } from '../sim/rng';
import { clamp, wrapAngle } from '../util/vec';
import { findHits, type CollisionStrategy } from './collision';
import { MG } from './config';
import { generateAsteroidShape, generateContinents, type Continent } from './planet';

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
  hp: number;
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
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
}

export interface Flash {
  text: string;
  /** Seconds remaining. */
  t: number;
}

export type Status = 'ready' | 'playing' | 'over';

export interface Cheats {
  god: boolean;
  /** Overrides from cheat codes; undefined means "follow the difficulty curve". */
  launchers?: number;
  streams?: number;
  /** Time scale multiplier applied by the host loop (SLOWMO). */
  timeScale: number;
  /** Any code used this game: the score is shown but not saved as a best. */
  assisted: boolean;
}

export interface MinigameState {
  seed: number;
  rng: Rng;
  status: Status;
  t: number;
  hp: number;
  score: number;
  kills: number;
  continents: Continent[];
  launcherAngle: number;
  launcherCount: number;
  streamCount: number;
  fireCooldown: number;
  spawnTimer: number;
  nextId: number;
  asteroids: Asteroid[];
  bullets: Bullet[];
  particles: Particle[];
  pulses: number;
  pulseCharge: number;
  /** Expanding shockwave radius, or -1 when none is active. */
  pulseR: number;
  flashes: Flash[];
  shake: number;
  /** Fractional seconds accumulated toward the next SCORE_PER_SEC award. */
  secAccum: number;
  cheats: Cheats;
  collision: CollisionStrategy;
  /** Diagnostics for the debug HUD. */
  stats: { collisionChecksLastStep: number };
}

// --- difficulty curves ------------------------------------------------------------------------------

export const spawnInterval = (t: number): number => Math.max(MG.SPAWN_MIN, MG.SPAWN_0 * Math.exp(-t / MG.SPAWN_TAU));
export const asteroidSpeed = (t: number): number => Math.min(MG.AST_SPEED_MAX, MG.AST_SPEED_0 + MG.AST_SPEED_RAMP * t);
export const launcherCount = (t: number): number => {
  let n = 1;
  for (const tt of MG.LAUNCHER_DOUBLE_TIMES) if (t >= tt) n *= 2;
  return n;
};
export const streamCount = (t: number): number => {
  let n = 1;
  for (const tt of MG.STREAM_TIMES) if (t >= tt) n += 1;
  return n;
};

// --- construction ------------------------------------------------------------------------------------

export function createState(seed: number, collision: CollisionStrategy = 'auto'): MinigameState {
  const rng = new Rng(seed);
  return {
    seed,
    rng,
    status: 'ready',
    t: 0,
    hp: MG.MAX_HP,
    score: 0,
    kills: 0,
    continents: generateContinents(rng, MG.PLANET_R),
    launcherAngle: Math.PI / 2,
    launcherCount: 1,
    streamCount: 1,
    fireCooldown: 0,
    spawnTimer: 1.2,
    nextId: 1,
    asteroids: [],
    bullets: [],
    particles: [],
    pulses: 0,
    pulseCharge: 0,
    pulseR: -1,
    flashes: [],
    shake: 0,
    secAccum: 0,
    cheats: { god: false, timeScale: 1, assisted: false },
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

/** Angle of launcher `i` of `n`, evenly spaced around the limb from the player-controlled one. */
export function launcherAngleAt(st: MinigameState, i: number): number {
  return wrapAngle(st.launcherAngle + (i * Math.PI * 2) / st.launcherCount);
}

// --- helpers -------------------------------------------------------------------------------------------

function swapRemove<T>(arr: T[], i: number): void {
  const last = arr.pop();
  if (last !== undefined && i < arr.length) arr[i] = last;
}

function spawnParticles(st: MinigameState, x: number, y: number, count: number, speed: number): void {
  for (let k = 0; k < count; k++) {
    if (st.particles.length >= MG.MAX_PARTICLES) return;
    const a = st.rng.float(0, Math.PI * 2);
    const v = speed * st.rng.float(0.3, 1.0);
    const life = MG.PARTICLE_LIFE * st.rng.float(0.5, 1.0);
    st.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life });
  }
}

function spawnAsteroid(st: MinigameState): void {
  if (st.asteroids.length >= MG.MAX_ASTEROIDS) return;
  const theta = st.rng.float(0, Math.PI * 2);
  const x = MG.FIELD_R * Math.cos(theta);
  const y = MG.FIELD_R * Math.sin(theta);
  // Aim at a point near the centre so approaches are not all perfectly radial.
  const aimA = st.rng.float(0, Math.PI * 2);
  const aimR = st.rng.float(0, MG.AST_AIM_SCATTER);
  const dx = aimR * Math.cos(aimA) - x;
  const dy = aimR * Math.sin(aimA) - y;
  const d = Math.hypot(dx, dy);
  const v = asteroidSpeed(st.t) * st.rng.float(0.8, 1.2);
  const r = st.rng.float(MG.AST_R_MIN, MG.AST_R_MAX);
  st.asteroids.push({
    id: st.nextId++,
    x,
    y,
    vx: (dx / d) * v,
    vy: (dy / d) * v,
    r,
    hp: Math.max(1, Math.round(r / MG.AST_HP_UNIT)),
    shape: generateAsteroidShape(st.rng),
    rot: st.rng.float(0, Math.PI * 2),
    spin: st.rng.float(-1.5, 1.5),
  });
}

/** Remove asteroid `i`, award score, split if large, and spawn debris. */
function destroyAsteroid(st: MinigameState, i: number, scoreMult: number, allowSplit: boolean): void {
  const a = st.asteroids[i];
  if (!a) return;
  st.score += Math.floor(a.r * MG.SCORE_PER_R * scoreMult);
  st.kills += 1;
  st.pulseCharge += 1 / MG.PULSE_KILLS;
  if (st.pulseCharge >= 1) {
    st.pulseCharge -= 1;
    if (st.pulses < MG.PULSE_MAX) {
      st.pulses += 1;
      flash(st, 'PULSE READY', 1.2);
    }
  }
  spawnParticles(st, a.x, a.y, MG.PARTICLES_PER_HIT, 2.5);
  swapRemove(st.asteroids, i);

  if (allowSplit && a.r >= MG.AST_SPLIT_R && st.asteroids.length + 2 <= MG.MAX_ASTEROIDS) {
    const cr = a.r * MG.AST_CHILD_SCALE;
    const speed = Math.hypot(a.vx, a.vy);
    for (const side of [-1, 1]) {
      const ang = Math.atan2(a.vy, a.vx) + side * st.rng.float(0.35, 0.8);
      st.asteroids.push({
        id: st.nextId++,
        x: a.x + side * cr * 0.6 * -Math.sin(ang),
        y: a.y + side * cr * 0.6 * Math.cos(ang),
        vx: Math.cos(ang) * speed * 1.1,
        vy: Math.sin(ang) * speed * 1.1,
        r: cr,
        hp: Math.max(1, Math.round(cr / MG.AST_HP_UNIT)),
        shape: generateAsteroidShape(st.rng),
        rot: st.rng.float(0, Math.PI * 2),
        spin: st.rng.float(-2.5, 2.5),
      });
    }
  }
}

function fire(st: MinigameState): void {
  const spread = MG.STREAM_SPREAD;
  for (let i = 0; i < st.launcherCount; i++) {
    const base = launcherAngleAt(st, i);
    for (let j = 0; j < st.streamCount; j++) {
      if (st.bullets.length >= MG.MAX_BULLETS) return;
      const a = base + (j - (st.streamCount - 1) / 2) * spread;
      const muzzle = MG.PLANET_R * 1.28;
      st.bullets.push({
        x: Math.cos(base) * muzzle,
        y: Math.sin(base) * muzzle,
        vx: Math.cos(a) * MG.BULLET_SPEED,
        vy: Math.sin(a) * MG.BULLET_SPEED,
        life: MG.BULLET_LIFE,
        r: MG.BULLET_R,
      });
    }
  }
}

// --- the step ------------------------------------------------------------------------------------------

export function step(st: MinigameState, input: Readonly<Input>, dt: number): void {
  // Flashes and effects tick in every status so the overlays stay alive.
  for (let i = st.flashes.length - 1; i >= 0; i--) {
    const f = st.flashes[i];
    if (f && (f.t -= dt) <= 0) st.flashes.splice(i, 1);
  }
  st.shake = Math.max(0, st.shake - dt * 0.6);
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
  st.secAccum += dt;
  while (st.secAccum >= 1) {
    st.secAccum -= 1;
    st.score += MG.SCORE_PER_SEC;
  }

  // Difficulty milestones.
  const wantL = st.cheats.launchers ?? launcherCount(st.t);
  if (wantL !== st.launcherCount) {
    st.launcherCount = wantL;
    flash(st, `LAUNCHERS X${wantL}`);
  }
  const wantS = st.cheats.streams ?? streamCount(st.t);
  if (wantS !== st.streamCount) {
    st.streamCount = wantS;
    flash(st, `STREAMS X${wantS}`);
  }

  // Player: left is counter-clockwise (angle increases), right is clockwise.
  if (input.left) st.launcherAngle = wrapAngle(st.launcherAngle + MG.LAUNCHER_SPEED * dt);
  if (input.right) st.launcherAngle = wrapAngle(st.launcherAngle - MG.LAUNCHER_SPEED * dt);
  st.fireCooldown -= dt;
  if (input.fire && st.fireCooldown <= 0) {
    fire(st);
    st.fireCooldown = MG.FIRE_COOLDOWN;
  }
  if (input.pulse && st.pulses > 0 && st.pulseR < 0) {
    st.pulses -= 1;
    st.pulseR = MG.PLANET_R;
    flash(st, 'PULSE', 0.8);
  }

  // Spawning.
  st.spawnTimer -= dt;
  while (st.spawnTimer <= 0) {
    spawnAsteroid(st);
    st.spawnTimer += spawnInterval(st.t);
  }

  // Bullets.
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
  }

  // Asteroids move; those touching the planet do damage.
  for (let i = st.asteroids.length - 1; i >= 0; i--) {
    const a = st.asteroids[i];
    if (!a) continue;
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    a.rot += a.spin * dt;
    const d = Math.hypot(a.x, a.y);
    if (d - a.r <= MG.PLANET_R) {
      const dmg = clamp(Math.round(a.r * MG.DAMAGE_PER_R), MG.DAMAGE_MIN, MG.DAMAGE_MAX);
      if (!st.cheats.god) st.hp -= dmg;
      st.shake += dmg * MG.SHAKE_PER_HP;
      spawnParticles(st, a.x, a.y, MG.PARTICLES_PER_IMPACT, 3);
      swapRemove(st.asteroids, i);
      if (st.hp <= 0) {
        st.hp = 0;
        st.status = 'over';
        return;
      }
    } else if (d > MG.FIELD_R + 2) {
      // Escaped children fly off; cull them.
      swapRemove(st.asteroids, i);
    }
  }

  // Shockwave: destroys every rock the ring has passed, no splitting.
  if (st.pulseR >= 0) {
    st.pulseR += MG.PULSE_SPEED * dt;
    for (let i = st.asteroids.length - 1; i >= 0; i--) {
      const a = st.asteroids[i];
      if (a && Math.hypot(a.x, a.y) - a.r <= st.pulseR) destroyAsteroid(st, i, MG.PULSE_SCORE_MULT, false);
    }
    if (st.pulseR > MG.FIELD_R + 1) st.pulseR = -1;
  }

  // Bullet hits. One bullet damages at most one asteroid; several bullets may hit the same one.
  st.stats.collisionChecksLastStep = st.bullets.length * st.asteroids.length;
  if (st.bullets.length > 0 && st.asteroids.length > 0) {
    const hits = findHits(st.bullets, st.asteroids, st.collision);
    // Apply damage first so indices stay valid, then remove in descending index order.
    const dead: number[] = [];
    const usedBullets: number[] = [];
    for (let i = 0; i < hits.length; i++) {
      const j = hits[i] as number;
      if (j < 0) continue;
      const a = st.asteroids[j];
      const b = st.bullets[i];
      if (!a || !b) continue;
      usedBullets.push(i);
      spawnParticles(st, b.x, b.y, 3, 1.5);
      a.hp -= 1;
      if (a.hp <= 0 && !dead.includes(j)) dead.push(j);
    }
    usedBullets.sort((p, q) => q - p);
    for (const i of usedBullets) swapRemove(st.bullets, i);
    dead.sort((p, q) => q - p);
    for (const j of dead) destroyAsteroid(st, j, 1, true);
  }
}

/** Serializable snapshot for determinism tests: everything except the typed arrays' identity. */
export function snapshot(st: MinigameState): string {
  return JSON.stringify({
    t: st.t,
    hp: st.hp,
    score: st.score,
    kills: st.kills,
    rng: st.rng.getState(),
    a: st.asteroids.map((a) => [a.id, a.x, a.y, a.hp]),
    b: st.bullets.length,
    p: st.pulses,
    status: st.status,
  });
}
