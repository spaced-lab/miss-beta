import { describe, expect, it } from 'vitest';
import { CheatRegistry } from '../src/game/cheats';
import { MINIGAME_CHEATS } from '../src/minigame/cheats';
import { findHitsGrid, findHitsNaive, type Circle } from '../src/minigame/collision';
import { MG } from '../src/minigame/config';
import { generateContinents } from '../src/minigame/planet';
import {
  baseSpawnInterval, baseSpeed, createState, displayTier, launcherCount, levelAt, maxTier, moonPosition, NO_INPUT,
  laserArmed, laserStage, rockMass, snapshot, spectrumStage, start, step, streamCount, streamDamage, strengthLevel, type Asteroid, type Input, type MinigameState,
} from '../src/minigame/sim';
import { Rng } from '../src/sim/rng';

const FIRE: Input = { left: false, right: false, fire: true, pulse: false };

function run(seed: number, seconds: number, input: Input = NO_INPUT, collision: 'grid' | 'naive' | 'auto' = 'auto', setup?: (st: MinigameState) => void) {
  const st = createState(seed, collision);
  start(st);
  setup?.(st);
  const n = Math.round(seconds / MG.DT);
  for (let i = 0; i < n && st.status === 'playing'; i++) step(st, input, MG.DT);
  return st;
}

function rock(st: MinigameState, x: number, y: number, vx: number, vy: number, r = 0.3, tier = 0): Asteroid {
  const hp = Math.max(1, Math.round(r / MG.AST_HP_UNIT)) * (MG.TIER_HP_MULT[tier] ?? 1);
  const a: Asteroid = { id: st.nextId++, x, y, vx, vy, r, tier, hp, maxHp: hp, core: false, passing: false, shape: new Float64Array(8).fill(1), rot: 0, spin: 0 };
  st.asteroids.push(a);
  return a;
}

describe('progression tables', () => {
  it('levels advance every LEVEL_SECONDS and curves are monotone', () => {
    expect(levelAt(0)).toBe(1);
    expect(levelAt(MG.LEVEL_SECONDS)).toBe(2);
    expect(levelAt(MG.LEVEL_SECONDS * 20)).toBe(21);
    let prev = Infinity;
    for (let l = 1; l < 40; l++) {
      expect(baseSpawnInterval(l)).toBeLessThanOrEqual(prev);
      expect(baseSpawnInterval(l)).toBeGreaterThanOrEqual(MG.SPAWN_MIN);
      prev = baseSpawnInterval(l);
    }
    expect(baseSpeed(1)).toBe(MG.AST_SPEED_0);
    expect(baseSpeed(1000)).toBe(MG.AST_SPEED_MAX);
    expect(launcherCount(1)).toBe(1);
    expect(launcherCount(1000)).toBe(8);
    expect(streamCount(1)).toBe(1);
    expect(streamCount(1000)).toBe(5);
    expect(maxTier(1)).toBe(0);
    expect(maxTier(1000)).toBe(3);
    expect(spectrumStage(1)).toBe(0);
    expect(spectrumStage(1000)).toBe(3);
  });

  it('stream strength follows the centre-strongest rule', () => {
    expect([1, 2].map(strengthLevel)).toEqual([1, 1]);
    expect([3, 4].map(strengthLevel)).toEqual([2, 2]);
    expect(strengthLevel(5)).toBe(3);
    const row = (n: number) => Array.from({ length: n }, (_, j) => streamDamage(n, j));
    expect(row(1)).toEqual([1]);
    expect(row(2)).toEqual([1, 1]);
    expect(row(3)).toEqual([1, 2, 1]);
    expect(row(4)).toEqual([1, 2, 2, 1]);
    expect(row(5)).toEqual([1, 2, 3, 2, 1]);
  });

  it('display tier steps down the ladder as a rock weakens', () => {
    const st = createState(1);
    const a = rock(st, 3, 0, 0, 0, 0.42, 3);
    expect(displayTier(a)).toBe(3);
    a.hp = Math.floor(a.maxHp * 0.6);
    expect(displayTier(a)).toBe(2);
    a.hp = 1;
    expect(displayTier(a)).toBe(1);
    const z = rock(st, 3, 0, 0, 0, 0.42, 0);
    z.hp = 1;
    expect(displayTier(z)).toBe(0);
  });
});

describe('simulation', () => {
  it('is deterministic for the same seed and inputs', () => {
    expect(snapshot(run(123, 70, FIRE))).toBe(snapshot(run(123, 70, FIRE)));
  });
  it('differs for different seeds', () => {
    expect(snapshot(run(1, 20))).not.toBe(snapshot(run(2, 20)));
  });
  it('an idle planet eventually loses', () => {
    const st = run(7, 600);
    expect(st.status).toBe('over');
    expect(st.hp).toBe(0);
  });
  it('fire into rocks ahead of the launcher destroys them, scores and counts hits', () => {
    // The launcher starts at +y; park slow rocks in that lane so the test does not depend on spawn luck.
    const st = run(42, 6, FIRE, 'auto', (s) => {
      s.spawnTimer = 1e9;
      for (let i = 0; i < 5; i++) rock(s, 0, 3 + i * 0.5, 0, -0.1, 0.3, 0);
    });
    expect(st.hits).toBeGreaterThan(0);
    expect(st.kills).toBeGreaterThan(0);
    expect(st.score).toBeGreaterThan(0);
    // Idle time also scores one point per second.
    expect(run(42, 3.05).score).toBe(3);
  });
  it('godmode never loses hull and reaches later levels with the moon active', () => {
    const st = run(5, 100, NO_INPUT, 'auto', (s) => { s.cheats.god = true; });
    expect(st.hp).toBe(MG.MAX_HP);
    expect(st.status).toBe('playing');
    expect(st.level).toBe(levelAt(st.t));
    expect(st.level).toBeGreaterThanOrEqual(MG.MOON_LEVEL);
  });
  it('naive and grid collision produce identical games', () => {
    expect(snapshot(run(77, 60, FIRE, 'grid'))).toBe(snapshot(run(77, 60, FIRE, 'naive')));
  });
  it('entity counts stay within budget at full power', () => {
    const st = createState(3);
    start(st);
    st.cheats.launchers = 8;
    st.cheats.streams = 5;
    st.cheats.god = true;
    st.cheats.noHeat = true;
    st.t = 10 * MG.LEVEL_SECONDS;
    for (let i = 0; i < 60 / MG.DT; i++) {
      step(st, FIRE, MG.DT);
      expect(st.bullets.length).toBeLessThanOrEqual(MG.MAX_BULLETS);
      expect(st.particles.length).toBeLessThanOrEqual(MG.MAX_PARTICLES);
      expect(st.asteroids.length).toBeLessThanOrEqual(MG.MAX_ASTEROIDS);
    }
  });
});

describe('heat', () => {
  it('continuous fire overheats, locks fire, then cools and unlocks', () => {
    const st = createState(11);
    start(st);
    st.cheats.god = true;
    let overheatedAt = -1;
    for (let i = 0; i < 20 / MG.DT; i++) {
      step(st, FIRE, MG.DT);
      if (st.overheated && overheatedAt < 0) overheatedAt = st.t;
    }
    expect(overheatedAt).toBeGreaterThan(3);
    expect(overheatedAt).toBeLessThan(10);
    // While overheated, firing adds no bullets.
    const st2 = createState(11);
    start(st2);
    st2.heat = 1;
    st2.overheated = true;
    st2.fireCooldown = 0;
    step(st2, FIRE, MG.DT);
    expect(st2.bullets.length).toBe(0);
    for (let i = 0; i < 5 / MG.DT; i++) step(st2, NO_INPUT, MG.DT);
    expect(st2.overheated).toBe(false);
    expect(st2.heat).toBeLessThanOrEqual(MG.HEAT_UNLOCK);
  });
});

describe('adaptive pressure', () => {
  it('rises while healthy and un-hit, drops on a hull hit, stays within bounds', () => {
    const st = createState(21);
    start(st);
    st.cheats.god = true; // keep hp high; pressure still reacts to hits via sinceHit
    st.asteroids.length = 0;
    st.spawnTimer = 1e9; // no spawns
    for (let i = 0; i < 20 / MG.DT; i++) step(st, NO_INPUT, MG.DT);
    expect(st.pressure).toBeGreaterThan(1);
    const before = st.pressure;
    rock(st, 1.2, 0, -2, 0); // about to hit the planet
    for (let i = 0; i < 0.5 / MG.DT; i++) step(st, NO_INPUT, MG.DT);
    expect(st.pressure).toBeLessThan(before - MG.PRESSURE_HIT_DROP + 0.005);
    expect(st.pressure).toBeGreaterThan(before - MG.PRESSURE_HIT_DROP - 0.005);
    const st2 = run(9, 400, NO_INPUT, 'auto', (s) => { s.cheats.god = true; });
    expect(st2.pressure).toBeLessThanOrEqual(MG.PRESSURE_MAX);
    expect(st2.pressure).toBeGreaterThanOrEqual(MG.PRESSURE_MIN);
  });
  it('eases toward the low target when the hull is low', () => {
    const st = createState(22);
    start(st);
    st.hp = 10;
    st.pressure = 1.3;
    st.spawnTimer = 1e9;
    for (let i = 0; i < 30 / MG.DT; i++) step(st, NO_INPUT, MG.DT);
    expect(st.pressure).toBeCloseTo(MG.PRESSURE_LOW_TARGET, 2);
  });
});

describe('dynamics', () => {
  it('a bullet hit pushes a rock, heavier rocks move less', () => {
    for (const tier of [0, 3]) {
      const st = createState(31);
      start(st);
      st.spawnTimer = 1e9;
      const a = rock(st, 3, 0, 0, 0, 0.3, tier);
      st.bullets.push({ x: 2.9, y: 0, vx: MG.BULLET_SPEED, vy: 0, life: 1, r: MG.BULLET_R, damage: 1, auto: false });
      step(st, NO_INPUT, MG.DT);
      const expected = MG.BULLET_IMPULSE / rockMass(a);
      expect(a.vx).toBeCloseTo(expected, 9);
      if (tier === 3) expect(a.vx).toBeLessThan(MG.BULLET_IMPULSE / 2);
    }
  });
  it('the moon bends a passing rock and absorbs a direct hit', () => {
    const st = createState(32);
    start(st);
    st.t = MG.MOON_LEVEL * MG.LEVEL_SECONDS;
    st.spawnTimer = 1e9;
    st.moonAngle = 0;
    const m = moonPosition(st);
    const a = rock(st, m.x, m.y + 1.0, 1.0, 0); // passes 1 radius above the moon, moving +x
    const vy0 = a.vy;
    for (let i = 0; i < 0.5 / MG.DT; i++) step(st, NO_INPUT, MG.DT);
    expect(a.vy).toBeLessThan(vy0); // pulled toward the moon (which is below)
    const b = rock(st, m.x, m.y + 0.3, 0, -1); // heading into the moon
    const id = b.id;
    for (let i = 0; i < 1 / MG.DT; i++) step(st, NO_INPUT, MG.DT);
    expect(st.asteroids.some((q) => q.id === id)).toBe(false);
    expect(st.hp).toBe(MG.MAX_HP);
  });
  it('passing rocks appear from PASSING_LEVEL and are aimed to miss', () => {
    const st = run(33, MG.LEVEL_SECONDS * (MG.PASSING_LEVEL + 1), NO_INPUT, 'auto', (s) => { s.cheats.god = true; });
    const passing = st.asteroids.filter((a) => a.passing);
    expect(passing.length).toBeGreaterThan(0);
  });
  it('hard rocks split into lower-tier shards', () => {
    const st = createState(34);
    start(st);
    st.spawnTimer = 1e9;
    const a = rock(st, 3, 0, 0, 0, 0.4, 2);
    a.hp = 1;
    st.bullets.push({ x: 2.9, y: 0, vx: MG.BULLET_SPEED, vy: 0, life: 1, r: MG.BULLET_R, damage: 1, auto: false });
    step(st, NO_INPUT, MG.DT);
    expect(st.asteroids.length).toBe(2);
    for (const s of st.asteroids) expect(s.core ? s.tier === 3 : s.tier === 1).toBe(true);
  });
});

describe('turrets', () => {
  it('deploy after TURRET_HITS direct hits from TURRET_LEVEL, orbit, and fire', () => {
    const st = createState(41);
    start(st);
    st.cheats.god = true;
    st.cheats.noHeat = true;
    st.t = MG.TURRET_LEVEL * MG.LEVEL_SECONDS;
    st.level = levelAt(st.t);
    let seen = false;
    for (let i = 0; i < 120 / MG.DT; i++) {
      step(st, FIRE, MG.DT);
      if (st.turrets.length > 0) {
        seen = true;
        break;
      }
    }
    expect(seen).toBe(true);
    const autoShots = () => st.bullets.filter((b) => b.auto).length;
    for (let i = 0; i < 2 / MG.DT; i++) step(st, NO_INPUT, MG.DT);
    expect(autoShots()).toBeGreaterThan(0);
  });
  it('never deploys before TURRET_LEVEL', () => {
    const st = run(42, 40, FIRE, 'auto', (s) => { s.cheats.god = true; s.cheats.noHeat = true; });
    expect(st.level).toBeLessThan(MG.TURRET_LEVEL);
    expect(st.turrets.length).toBe(0);
  });
});

describe('pulse', () => {
  it('clears the field and consumes stock', () => {
    const st = run(9, 15, NO_INPUT, 'auto', (s) => { s.cheats.god = true; });
    st.pulses = 1;
    expect(st.asteroids.length).toBeGreaterThan(0);
    step(st, { ...NO_INPUT, pulse: true }, MG.DT);
    expect(st.pulses).toBe(0);
    for (let i = 0; i < 2 / MG.DT; i++) step(st, NO_INPUT, MG.DT);
    for (const a of st.asteroids) expect(Math.hypot(a.x, a.y)).toBeGreaterThan(MG.FIELD_R - 2.5);
  });
});

describe('collision strategies', () => {
  it('agree on random fields', () => {
    const rng = new Rng(2024);
    for (let trial = 0; trial < 20; trial++) {
      const bullets: Circle[] = [];
      const asteroids: Circle[] = [];
      for (let i = 0; i < 300; i++) bullets.push({ x: rng.float(-7, 7), y: rng.float(-7, 7), r: 0.05 });
      for (let i = 0; i < 80; i++) asteroids.push({ x: rng.float(-7, 7), y: rng.float(-7, 7), r: rng.float(0.1, 0.45) });
      expect(Array.from(findHitsGrid(bullets, asteroids))).toEqual(Array.from(findHitsNaive(bullets, asteroids)));
    }
  });
  it('handle empty inputs', () => {
    expect(findHitsGrid([], []).length).toBe(0);
    expect(Array.from(findHitsGrid([{ x: 0, y: 0, r: 1 }], []))).toEqual([-1]);
  });
});

describe('planet', () => {
  it('continents stay inside the disc and are seeded', () => {
    const a = generateContinents(new Rng(11));
    const b = generateContinents(new Rng(11));
    expect(a.length).toBeGreaterThanOrEqual(2);
    expect(a.map((c) => Array.from(c))).toEqual(b.map((c) => Array.from(c)));
    for (const c of a) for (let i = 0; i < c.length; i += 2) expect(Math.hypot(c[i] as number, c[i + 1] as number)).toBeLessThanOrEqual(0.9 + 1e-9);
  });
});

describe('cheats', () => {
  it('match the typed tail once and flag the run', () => {
    const reg = new CheatRegistry(MINIGAME_CHEATS);
    const st = createState(1);
    start(st);
    expect(reg.match('XXGODMOD', st)).toBeNull();
    expect(reg.match('XXGODMODE', st)?.code).toBe('GODMODE');
    expect(st.cheats.god).toBe(true);
    expect(st.cheats.assisted).toBe(true);
  });
  it('rejects malformed codes', () => {
    expect(() => new CheatRegistry([{ code: 'no', message: '', apply: () => {} }])).toThrow();
  });
});

describe('laser pulse', () => {
  const lane = (st: MinigameState) => {
    st.spawnTimer = 1e9;
    st.cheats.god = true;
    st.cheats.noHeat = true;
  };
  it('is off below 3 streams and armed after a break from 3 streams', () => {
    const st = createState(51);
    start(st);
    lane(st);
    expect(laserArmed(st)).toBe(false);
    st.cheats.streams = 3;
    step(st, NO_INPUT, MG.DT);
    expect(laserStage(st.streamCount)).toBe(1);
    expect(laserArmed(st)).toBe(true); // sinceShot starts large
  });
  it('first shot after a break beams the centre lane, then projectiles follow', () => {
    const st = createState(52);
    start(st);
    lane(st);
    st.cheats.streams = 3;
    step(st, NO_INPUT, MG.DT);
    const a = rock(st, 0, 4, 0, 0, 0.3, 0); // launcher points +y
    const hp0 = a.hp;
    st.fireCooldown = 0;
    step(st, FIRE, MG.DT);
    expect(a.hp).toBe(hp0 - (strengthLevel(3) + MG.LASER_DAMAGE_BONUS));
    expect(a.vy).toBeGreaterThan(0); // pushed outward
    expect(st.beams.length).toBe(1);
    expect(st.events.some((e) => e.type === 'laser')).toBe(true);
    // Centre projectile was replaced by the beam: 2 side bullets only.
    expect(st.bullets.length).toBe(2);
    // Keep firing: no second beam while the break is short.
    for (let i = 0; i < 0.5 / MG.DT; i++) step(st, FIRE, MG.DT);
    expect(st.beams.filter((b) => b.t > 0).length).toBeLessThanOrEqual(1);
    expect(st.events.filter((e) => e.type === 'laser').length).toBe(1);
  });
  it('at 5 streams every launcher beams and the break needed is shorter', () => {
    const st = createState(53);
    start(st);
    lane(st);
    st.cheats.streams = 5;
    st.cheats.launchers = 2;
    step(st, NO_INPUT, MG.DT);
    st.sinceShot = MG.LASER_BREAK_2 + 0.01;
    st.fireCooldown = 0;
    step(st, FIRE, MG.DT);
    expect(st.beams.length).toBe(2);
    st.sinceShot = MG.LASER_BREAK_2 - 0.1;
    st.fireCooldown = 0;
    for (const b of st.beams) b.t = 0.001;
    step(st, FIRE, MG.DT);
    expect(st.beams.filter((b) => b.t > 0.01).length).toBe(0);
  });
  it('emits sound events for shots, breaks and hull impacts', () => {
    const st = createState(54);
    start(st);
    lane(st);
    const a = rock(st, 0, 3, 0, 0, 0.2, 0);
    a.hp = 1;
    for (let i = 0; i < 1 / MG.DT; i++) step(st, FIRE, MG.DT);
    const types = new Set(st.events.map((e) => e.type));
    expect(types.has('shot')).toBe(true);
    expect(types.has('hit')).toBe(true);
    expect(types.has('break')).toBe(true);
    rock(st, 1.1, 0, -3, 0);
    for (let i = 0; i < 0.3 / MG.DT; i++) step(st, NO_INPUT, MG.DT);
    expect(st.events.some((e) => e.type === 'impact')).toBe(true);
    expect(st.events.length).toBeLessThanOrEqual(256);
  });
});
