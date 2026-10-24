import { describe, expect, it } from 'vitest';
import { CheatRegistry } from '../src/game/cheats';
import { MINIGAME_CHEATS } from '../src/minigame/cheats';
import { findHitsGrid, findHitsNaive, type Circle } from '../src/minigame/collision';
import { byLevel, MG } from '../src/minigame/config';
import { botInput } from '../src/minigame/bot';
import { MinigameScreen } from '../src/minigame/index';
import { generateContinents } from '../src/minigame/planet';
import { AUDITION_CUE, choicesFor, clickiness, DEFAULT_INDEX, isSfxPrefs, OFF, SfxPlayer, SOUND_EVENTS, VARIANTS, variantIndex, type SoundEvent } from '../src/minigame/sfx';
import { createLab, LAB_KEY, LAB_ROWS, reviewSequence, updateLab } from '../src/minigame/soundLab';
import type { Surface } from '../src/render/canvas';
import type { Input as Keys } from '../src/ui/input';
import {
  baseSpawnInterval, baseSpeed, createState, displayTier, launcherCount, levelAt, maxTier, moonPosition, NO_INPUT,
  chaosLevel, damageMax, densestSector, deployTurret, deserialize, hpMult, hullDamage, isSavedGame, laserArmed, laserBeamCount, laserFanOffsets, laserRange, laserStage, MAX_TIER, maxAsteroids, moonAlive, pressureMax, pulseKillsNeeded, rockMass, seekerHitsNeeded, seekerMax, seekerVolley, SENTRY_KINDS, serialize, snapshot, spawnBinary, spawnFloor, spectrumStage, speedCap, start, step, streamCount, streamDamage, strengthLevel, swarmCountRange, swarmKillsNeeded, swarmLife, swarmMax, toSaved, turretHitsNeeded, turretMax, turretPosition, turretTier, type Asteroid, type Input, type MinigameState,
  mirvSubWarheads,
  mirvWarheads,
  seekerSpeed,
} from '../src/minigame/sim';
import { Rng } from '../src/sim/rng';
import { wrapAngle } from '../src/util/vec';

const FIRE: Input = { ...NO_INPUT, fire: true };
/** Fire and press both weapon keys every step: deploys whenever stock exists (the sim does the gating). */
const ALL_IN: Input = { ...NO_INPUT, fire: true, seeker: true, swarm: true };

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
    for (let l = 1; l < 80; l++) {
      expect(baseSpawnInterval(l)).toBeLessThanOrEqual(prev);
      expect(baseSpawnInterval(l)).toBeGreaterThanOrEqual(MG.SPAWN_FLOOR_ABS);
      prev = baseSpawnInterval(l);
    }
    expect(baseSpeed(1)).toBe(MG.AST_SPEED_0);
    expect(baseSpeed(MG.AST_SPEED_CAP_FROM_LEVEL)).toBeLessThanOrEqual(MG.AST_SPEED_MAX);
    expect(baseSpeed(1000)).toBeGreaterThan(MG.AST_SPEED_MAX);
    expect(launcherCount(1)).toBe(1);
    expect(launcherCount(1000)).toBe(8);
    expect(streamCount(1)).toBe(1);
    expect(streamCount(1000)).toBe(5);
    expect(maxTier(1)).toBe(0);
    expect(maxTier(9)).toBe(3);
    expect(maxTier(1000)).toBe(MAX_TIER);
    expect(MAX_TIER).toBe(5);
    expect(MG.TIER_MASS_MULT.length).toBe(MG.TIER_HP_MULT.length);
    expect(MG.TIER_SCORE_MULT.length).toBe(MG.TIER_HP_MULT.length);
    expect(spectrumStage(1)).toBe(0);
    expect(spectrumStage(1000)).toBe(3);
  });

  it('the first five levels are untouched by the late-game growths', () => {
    for (let l = 1; l <= 5; l++) {
      expect(baseSpawnInterval(l)).toBeCloseTo(MG.SPAWN_0 * Math.pow(MG.SPAWN_LEVEL_FACTOR, l - 1), 12);
      expect(baseSpeed(l)).toBeCloseTo(MG.AST_SPEED_0 + MG.AST_SPEED_PER_LEVEL * (l - 1), 12);
      expect(hpMult(l)).toBe(1);
      expect(pressureMax(l)).toBe(MG.PRESSURE_MAX);
      expect(damageMax(l)).toBe(byLevel(MG.DAMAGE_MAX_BY_LEVEL, l));
      expect(maxTier(l)).toBeLessThanOrEqual(1);
    }
  });

  it('no plateau: level 45 is strictly harder than level 30 on every axis', () => {
    expect(baseSpawnInterval(45)).toBeLessThan(baseSpawnInterval(30));
    expect(spawnFloor(45)).toBeLessThan(spawnFloor(30));
    expect(baseSpeed(45)).toBeGreaterThan(baseSpeed(30));
    expect(speedCap(45)).toBeGreaterThan(speedCap(30));
    expect(hpMult(45)).toBeGreaterThan(hpMult(30));
    expect(maxTier(45)).toBeGreaterThanOrEqual(maxTier(30));
    expect(maxTier(30)).toBeGreaterThan(maxTier(9)); // tiers 4 and 5 are reachable
    expect(maxTier(45)).toBe(MAX_TIER);
    expect(pressureMax(45)).toBeGreaterThan(pressureMax(30));
    expect(damageMax(45)).toBeGreaterThan(damageMax(30));
    expect(maxAsteroids(45)).toBeGreaterThanOrEqual(maxAsteroids(30));
    // The growths are slow: 15 levels change each axis by less than a factor of two.
    expect(baseSpawnInterval(30) / baseSpawnInterval(45)).toBeLessThan(2);
    expect(baseSpeed(45) / baseSpeed(30)).toBeLessThan(2);
    expect(hpMult(45) / hpMult(30)).toBeLessThan(2);
    // Rocks spawned at level 45 carry more hit points than the same rock at level 30.
    const hpAt = (level: number) => {
      const st = createState(1);
      start(st);
      st.t = (level - 1) * MG.LEVEL_SECONDS + 0.5;
      st.spawnTimer = 1e9;
      step(st, NO_INPUT, MG.DT);
      expect(st.level).toBe(level);
      st.asteroids.length = 0;
      st.spawnTimer = 0;
      step(st, NO_INPUT, MG.DT);
      const a = st.asteroids[0];
      if (!a) throw new Error('no spawn');
      return a.maxHp / Math.max(1, Math.round(a.r / MG.AST_HP_UNIT)) / (MG.TIER_HP_MULT[a.tier] ?? 1);
    };
    expect(hpAt(45)).toBeGreaterThan(hpAt(30));
    expect(hpAt(5)).toBe(1);
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
    // A tier-5 rock walks the whole ladder 5, 4, 3, 2, 1.
    const h = rock(st, 3, 0, 0, 0, 0.42, 5);
    const seen = new Set<number>();
    for (let hp = h.maxHp; hp >= 1; hp--) {
      h.hp = hp;
      seen.add(displayTier(h));
    }
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5]);
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
  it('stays deterministic and strategy-agnostic with seekers and swarms in play', () => {
    const arm = (s: MinigameState) => {
      s.cheats.god = true;
      s.cheats.noHeat = true;
      s.seekerStock = MG.SEEKER_MAX;
      s.swarmStock = MG.SWARM_MAX;
    };
    const a = run(78, 45, ALL_IN, 'grid', arm);
    const b = run(78, 45, ALL_IN, 'naive', arm);
    expect(snapshot(a)).toBe(snapshot(b));
    expect(snapshot(run(78, 45, ALL_IN, 'auto', arm))).toBe(snapshot(a));
    expect(a.events.length).toBeLessThanOrEqual(256);
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
      expect(st.asteroids.length).toBeLessThanOrEqual(maxAsteroids(st.level));
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
    expect(st.pressure).toBeGreaterThan(MG.PRESSURE_START);
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

describe('seeker missiles', () => {
  const lane = (st: MinigameState) => {
    st.spawnTimer = 1e9;
    st.cheats.god = true;
    st.cheats.noHeat = true;
  };
  it('charge comes from direct hits and the stock is capped', () => {
    const st = createState(101);
    start(st);
    lane(st);
    const a = rock(st, 0, 3, 0, 0, 0.42, 3);
    a.hp = a.maxHp = 1e9; // a wall to shoot at
    const pin = () => { a.x = 0; a.y = 3; a.vx = 0; a.vy = 0; }; // hits push it; keep the wall in the lane
    for (let i = 0; i < 10 / MG.DT && st.hits < MG.SEEKER_HITS; i++) { pin(); step(st, FIRE, MG.DT); }
    expect(st.hits).toBe(MG.SEEKER_HITS);
    expect(st.seekerStock).toBe(1);
    expect(st.seekerProgress).toBe(0);
    expect(st.flashes.some((f) => f.text.startsWith('SEEKER READY'))).toBe(true);
    for (let i = 0; i < 60 / MG.DT && st.hits < MG.SEEKER_HITS * (MG.SEEKER_MAX + 1); i++) { pin(); step(st, FIRE, MG.DT); }
    expect(st.seekerStock).toBe(MG.SEEKER_MAX);
    expect(st.seekerProgress).toBe(st.hits % MG.SEEKER_HITS);
  });
  it('the key consumes one of stock; nothing happens on empty', () => {
    const st = createState(102);
    start(st);
    lane(st);
    step(st, { ...NO_INPUT, seeker: true }, MG.DT);
    expect(st.seekers.length).toBe(0);
    st.seekerStock = 2;
    step(st, { ...NO_INPUT, seeker: true }, MG.DT);
    expect(st.seekerStock).toBe(1);
    expect(st.seekers.length).toBe(1);
    expect(st.events.some((e) => e.type === 'seeker')).toBe(true);
    // Launched from the player's launcher, flying outward along its radial.
    const sk = st.seekers[0];
    if (!sk) throw new Error('no seeker');
    expect(Math.atan2(sk.vy, sk.vx)).toBeCloseTo(st.launcherAngle, 5);
  });
  it('turns toward a rock off its axis, hits it and blasts the area', () => {
    const st = createState(103);
    start(st);
    lane(st);
    // Launcher points +y; the rock sits off-axis to the right. A bystander within the blast radius gets hit too.
    const a = rock(st, 1.6, 3.2, 0, 0, 0.3, 0);
    const bystander = rock(st, 1.6 + 0.9, 3.2, 0, 0, 0.3, 1);
    bystander.hp = bystander.maxHp = 1e9;
    const id = a.id;
    st.seekerStock = 1;
    step(st, { ...NO_INPUT, seeker: true }, MG.DT);
    const sk = st.seekers[0];
    if (!sk) throw new Error('no seeker');
    for (let i = 0; i < 0.3 / MG.DT; i++) step(st, NO_INPUT, MG.DT);
    expect(sk.vx).toBeGreaterThan(0.5); // turned right, toward the rock
    expect(sk.targetId).toBe(id);
    expect(sk.trail.length).toBeGreaterThan(0);
    for (let i = 0; i < 2 / MG.DT && st.seekers.length > 0; i++) step(st, NO_INPUT, MG.DT);
    expect(st.seekers.length).toBe(0);
    expect(st.asteroids.some((q) => q.id === id)).toBe(false);
    expect(st.events.some((e) => e.type === 'blast')).toBe(true);
    // The seeker split into a MIRV near the rock; the bystander is hit by a warhead or a blast and pushed away.
    expect(bystander.hp).toBeLessThan(1e9);
    expect(bystander.vx).toBeGreaterThan(0);
  });
  it('splits into a MIRV close to its target, one warhead per nearby rock', () => {
    const st = createState(105);
    start(st);
    lane(st);
    const a = rock(st, 0, 4, 0, 0, 0.3, 0);
    const b = rock(st, 1.2, 4.4, 0, 0, 0.3, 1);
    const c = rock(st, -1.2, 4.4, 0, 0, 0.3, 2);
    for (const r of [a, b, c]) r.hp = r.maxHp = 1e9;
    st.seekerStock = 1;
    step(st, { ...NO_INPUT, seeker: true }, MG.DT);
    let split = false;
    for (let i = 0; i < 2 / MG.DT && !split; i++) {
      step(st, NO_INPUT, MG.DT);
      split = st.seekers.some((k) => k.warhead === true);
    }
    expect(split).toBe(true);
    const heads = st.seekers.filter((k) => k.warhead === true);
    expect(heads.length).toBe(mirvWarheads(st.level));
    expect(new Set(heads.map((k) => k.targetId))).toEqual(new Set([a.id, b.id, c.id]));
    for (let i = 0; i < 2 / MG.DT && st.seekers.length > 0; i++) step(st, NO_INPUT, MG.DT);
    for (const r of [a, b, c]) expect(r.hp).toBeLessThan(1e9);
    // Below the second-stage level nothing divides twice.
    expect(mirvSubWarheads(st.level)).toBe(0);
    expect(mirvWarheads(1)).toBe(MG.SEEKER_MIRV_N);
    expect(mirvWarheads(1000)).toBe(MG.SEEKER_MIRV_CAP);
    expect(mirvWarheads(MG.SEEKER_MIRV_LEVELS)).toBe(MG.SEEKER_MIRV_N + 1);
  });
  it('from the second-stage level each warhead divides again near its target, into smaller, faster sub-warheads', () => {
    const st = createState(106);
    start(st);
    st.level = MG.SEEKER_MIRV_STAGE2_LEVEL;
    expect(mirvSubWarheads(st.level)).toBe(MG.SEEKER_MIRV_STAGE2_N);
    expect(mirvSubWarheads(st.level + MG.SEEKER_MIRV_STAGE2_LEVELS)).toBe(MG.SEEKER_MIRV_STAGE2_N + 1);
    expect(mirvSubWarheads(1000)).toBe(MG.SEEKER_MIRV_STAGE2_CAP);
    lane(st);
    const a = rock(st, 0, 4, 0, 0, 0.3, 0);
    const b = rock(st, 1.2, 4.4, 0, 0, 0.3, 1);
    for (const r of [a, b]) r.hp = r.maxHp = 1e9;
    st.seekerStock = 1;
    step(st, { ...NO_INPUT, seeker: true }, MG.DT);
    let warheads = 0;
    let subs = 0;
    for (let i = 0; i < 3 / MG.DT && st.seekers.length > 0; i++) {
      step(st, NO_INPUT, MG.DT);
      warheads = Math.max(warheads, st.seekers.filter((k) => k.stage === 1).length);
      subs = Math.max(subs, st.seekers.filter((k) => k.stage === 2).length);
      for (const k of st.seekers) {
        const v = Math.hypot(k.vx, k.vy);
        if (k.stage === 2) expect(v).toBeCloseTo(seekerSpeed(2), 6);
        else if (k.stage === 1) expect(v).toBeCloseTo(seekerSpeed(1), 6);
      }
    }
    expect(warheads).toBe(mirvWarheads(st.level));
    expect(subs).toBeGreaterThanOrEqual(mirvSubWarheads(st.level));
    expect(seekerSpeed(2)).toBeGreaterThan(seekerSpeed(1));
    for (const r of [a, b]) expect(r.hp).toBeLessThan(1e9);
  });
  it('splits fill up to MAX_SEEKERS and no further, and a full field still leaves the bus one warhead', () => {
    const st = createState(107);
    start(st);
    st.level = 30;
    lane(st);
    const a = rock(st, 0, 4, 0, 0, 0.3, 0);
    a.hp = a.maxHp = 1e9;
    // Fill the field with idle seekers parked far away (a target that never comes).
    for (let i = 0; i < MG.MAX_SEEKERS - 1; i++) st.seekers.push({ x: -5, y: -5, vx: 0, vy: 0, life: 100, targetId: -1, trail: [], trailTick: 0 });
    st.seekerStock = 1;
    step(st, { ...NO_INPUT, seeker: true }, MG.DT);
    let split = false;
    for (let i = 0; i < 2 / MG.DT && !split; i++) {
      step(st, NO_INPUT, MG.DT);
      split = st.seekers.some((k) => k.stage === 1);
    }
    expect(split).toBe(true);
    expect(st.seekers.length).toBeLessThanOrEqual(MG.MAX_SEEKERS);
    expect(st.seekers.filter((k) => k.stage === 1).length).toBeGreaterThanOrEqual(1);
  });
  it('fizzles at the end of its life when there is nothing to chase', () => {
    const st = createState(104);
    start(st);
    lane(st);
    st.seekerStock = 1;
    step(st, { ...NO_INPUT, seeker: true }, MG.DT);
    for (let i = 0; i < (MG.SEEKER_LIFE + 0.1) / MG.DT; i++) step(st, NO_INPUT, MG.DT);
    expect(st.seekers.length).toBe(0);
  });
});

describe('swarm of sentinels', () => {
  const lane = (st: MinigameState) => {
    st.spawnTimer = 1e9;
    st.cheats.god = true;
    st.cheats.noHeat = true;
  };
  it('charge comes from kills and the stock is capped', () => {
    const st = createState(111);
    start(st);
    lane(st);
    for (let k = 0; k < MG.SWARM_KILLS * (MG.SWARM_MAX + 1); k++) {
      const a = rock(st, 0, 2.5, 0, 0, 0.2, 0); // small: no split
      a.hp = 1;
      st.fireCooldown = 0;
      for (let i = 0; i < 0.4 / MG.DT && st.asteroids.length > 0; i++) step(st, FIRE, MG.DT);
      st.asteroids.length = 0;
      st.bullets.length = 0;
      if (k === MG.SWARM_KILLS - 1) expect(st.swarmStock).toBe(1);
    }
    expect(st.kills).toBeGreaterThanOrEqual(MG.SWARM_KILLS * MG.SWARM_MAX);
    expect(st.swarmStock).toBe(MG.SWARM_MAX);
  });
  it('the key releases 5 to 8 drones that hunt, shoot and burn out', () => {
    const st = createState(112);
    start(st);
    lane(st);
    step(st, { ...NO_INPUT, swarm: true }, MG.DT);
    expect(st.drones.length).toBe(0);
    st.swarmStock = 1;
    const wall = rock(st, 0.5, 3, 0, 0, 0.42, 3);
    wall.hp = wall.maxHp = 1e9;
    step(st, { ...NO_INPUT, swarm: true }, MG.DT);
    const n = st.drones.length;
    expect(n).toBeGreaterThanOrEqual(MG.SWARM_COUNT_MIN);
    expect(n).toBeLessThanOrEqual(MG.SWARM_COUNT_MAX);
    expect(st.swarmStock).toBe(0);
    expect(st.events.some((e) => e.type === 'swarm' && e.count === n)).toBe(true);
    let shots = 0;
    for (let i = 0; i < 3 / MG.DT; i++) {
      const before = st.bullets.length;
      step(st, NO_INPUT, MG.DT);
      if (st.bullets.length > before) shots += st.bullets.length - before;
      for (const d of st.drones) expect(Math.hypot(d.x, d.y)).toBeGreaterThan(MG.PLANET_R);
    }
    expect(shots).toBeGreaterThan(n * 5);
    expect(st.bullets.every((b) => b.auto)).toBe(true);
    expect(st.drones.length).toBe(n);
    for (const d of st.drones) expect(Math.hypot(d.x - wall.x, d.y - wall.y)).toBeLessThan(MG.SWARM_RANGE);
    st.events.length = 0; // the queue caps at 256; the host drains it every frame, tests must too
    for (let i = 0; i < (MG.SWARM_LIFE - 3 + 0.2) / MG.DT; i++) step(st, NO_INPUT, MG.DT);
    expect(st.drones.length).toBe(0);
    expect(st.events.filter((e) => e.type === 'burnout').length).toBe(n);
  });
  it('drone count and life grow with level and are capped', () => {
    expect(swarmCountRange(1)).toEqual({ min: MG.SWARM_COUNT_MIN, max: MG.SWARM_COUNT_MAX });
    const mid = swarmCountRange(9);
    expect(mid.min).toBeGreaterThan(MG.SWARM_COUNT_MIN);
    expect(mid.max).toBeGreaterThan(MG.SWARM_COUNT_MAX);
    expect(mid.max).toBeLessThanOrEqual(MG.SWARM_COUNT_CAP);
    expect(swarmCountRange(60)).toEqual({ min: MG.SWARM_COUNT_CAP, max: MG.SWARM_COUNT_CAP });
    expect(swarmLife(1)).toBe(MG.SWARM_LIFE);
    expect(swarmLife(9)).toBeGreaterThan(MG.SWARM_LIFE);
    expect(swarmLife(60)).toBe(MG.SWARM_LIFE_MAX);
    // A release deep in the game fields the cap, every drone with the long life.
    const st = createState(115);
    start(st);
    lane(st);
    st.t = 59 * MG.LEVEL_SECONDS + 1;
    step(st, NO_INPUT, MG.DT);
    expect(st.level).toBe(60);
    st.swarmStock = 1;
    step(st, { ...NO_INPUT, swarm: true }, MG.DT);
    expect(st.drones.length).toBe(MG.SWARM_COUNT_CAP);
    for (const d of st.drones) expect(d.maxLife).toBe(MG.SWARM_LIFE_MAX);
  });
  it('drones released at the moon stay outside MOON_R + SWARM_MOON_MARGIN and keep hunting', () => {
    const st = createState(116);
    start(st);
    lane(st);
    st.t = (MG.MOON_LEVEL - 1) * MG.LEVEL_SECONDS + 1;
    step(st, NO_INPUT, MG.DT);
    expect(moonAlive(st)).toBe(true);
    // Moon straight ahead of the launcher, a hard rock just behind it: the direct path runs through the moon.
    st.moonAngle = 0;
    st.launcherAngle = 0;
    const m = moonPosition(st);
    const wall = rock(st, m.x + MG.MOON_R + 0.9, 0, 0, 0, 0.4, 3);
    wall.hp = wall.maxHp = 1e9;
    st.swarmStock = 1;
    step(st, { ...NO_INPUT, swarm: true }, MG.DT);
    const n = st.drones.length;
    expect(n).toBeGreaterThan(0);
    const zone = MG.MOON_R + MG.SWARM_MOON_MARGIN;
    let shots = 0;
    for (let i = 0; i < 6 / MG.DT; i++) {
      wall.x = m.x + MG.MOON_R + 0.9; // hold the rock still behind the moon's starting point
      wall.y = 0;
      wall.vx = wall.vy = 0;
      const before = st.bullets.length;
      step(st, NO_INPUT, MG.DT);
      shots += Math.max(0, st.bullets.length - before);
      st.events.length = 0;
      const moon = moonPosition(st);
      expect(st.drones.length, `step ${i}: no drone lost to the moon`).toBe(n);
      for (const d of st.drones) expect(Math.hypot(d.x - moon.x, d.y - moon.y), `step ${i}`).toBeGreaterThanOrEqual(zone - 1e-6);
    }
    expect(shots).toBeGreaterThan(n * 3);
    expect(st.moonHp).toBe(MG.MOON_HP);
  });
  it('seekers and drones in flight survive a save and resume', () => {
    const st = createState(113);
    start(st);
    lane(st);
    for (let i = 0; i < 5; i++) {
      const a = rock(st, 3 * Math.cos(i * 1.3), 3 * Math.sin(i * 1.3), 0, 0, 0.4, 3);
      a.hp = a.maxHp = 50;
    }
    st.seekerStock = 2;
    st.swarmStock = 1;
    step(st, { ...NO_INPUT, seeker: true, swarm: true }, MG.DT);
    for (let i = 0; i < 0.5 / MG.DT; i++) step(st, NO_INPUT, MG.DT);
    step(st, { ...NO_INPUT, seeker: true }, MG.DT);
    expect(st.seekers.length).toBeGreaterThan(0);
    expect(st.drones.length).toBeGreaterThan(0);
    const json = serialize(st);
    expect(isSavedGame(JSON.parse(json))).toBe(true);
    const copy = deserialize(json);
    if (!copy) throw new Error('deserialize returned null');
    expect(snapshot(copy)).toBe(snapshot(st));
    expect(copy.seekers.map((s) => s.trail)).toEqual(st.seekers.map((s) => s.trail));
    for (let i = 0; i < 4 / MG.DT; i++) {
      step(st, NO_INPUT, MG.DT);
      step(copy, NO_INPUT, MG.DT);
    }
    expect(snapshot(copy)).toBe(snapshot(st));
  });
  it('cheats fill both stocks', () => {
    const reg = new CheatRegistry(MINIGAME_CHEATS);
    const st = createState(114);
    start(st);
    expect(reg.match('SEEKER', st)?.code).toBe('SEEKER');
    expect(st.seekerStock).toBe(MG.SEEKER_MAX);
    expect(reg.match('SWARM', st)?.code).toBe('SWARM');
    expect(st.swarmStock).toBe(MG.SWARM_MAX);
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

describe('weapons that scale with level', () => {
  /** Every value of f over levels 1..80 is >= (or <= when `down`) the one before, and the far end sits on the cap. */
  const monotone = (f: (l: number) => number, down = false) => {
    for (let l = 2; l <= 80; l++) {
      if (down) expect(f(l), `level ${l}`).toBeLessThanOrEqual(f(l - 1));
      else expect(f(l), `level ${l}`).toBeGreaterThanOrEqual(f(l - 1));
    }
  };
  it('seeker stock cap, volley and charge requirement', () => {
    monotone(seekerMax);
    expect(seekerMax(1)).toBe(MG.SEEKER_MAX);
    expect(seekerMax(9)).toBe(MG.SEEKER_MAX + 1);
    expect(seekerMax(1000)).toBe(MG.SEEKER_MAX_CAP);
    monotone(seekerVolley);
    expect([1, 9, 10, 19, 20, 29, 30, 99].map(seekerVolley)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
    monotone(seekerHitsNeeded, true);
    expect(seekerHitsNeeded(1)).toBe(MG.SEEKER_HITS);
    expect(seekerHitsNeeded(MG.SEEKER_HITS_EASE_FROM_LEVEL + 1)).toBe(MG.SEEKER_HITS - MG.SEEKER_HITS_EASE_PER_LEVEL);
    expect(seekerHitsNeeded(1000)).toBe(MG.SEEKER_HITS_MIN);
    // One stock at level 30 launches four, fanned around the launcher's radial, all flying outward.
    const st = createState(121);
    start(st);
    st.cheats.god = true;
    st.spawnTimer = 1e9;
    st.t = 29 * MG.LEVEL_SECONDS + 1;
    step(st, NO_INPUT, MG.DT);
    expect(st.level).toBe(30);
    st.seekerStock = 1;
    step(st, { ...NO_INPUT, seeker: true }, MG.DT);
    expect(st.seekers.length).toBe(4);
    expect(st.seekerStock).toBe(0);
    const headings = st.seekers.map((k) => Math.atan2(k.vy, k.vx) - st.launcherAngle).sort((p, q) => p - q);
    expect(headings[3] ?? 0).toBeCloseTo(1.5 * MG.SEEKER_VOLLEY_SPREAD, 6);
    expect(headings[0] ?? 0).toBeCloseTo(-1.5 * MG.SEEKER_VOLLEY_SPREAD, 6);
  });
  it('swarm and pulse charge requirements grow with level so neither becomes permanent cover', () => {
    // v3.4: the swarm price rises to SWARM_KILLS_EASE_FROM_LEVEL, then eases back (owner: "not so hard to acquire
    // past level 20"); the rocks' growths carry the late difficulty instead. Monotone up to the ease level only.
    monotone((l: number) => swarmKillsNeeded(Math.min(l, MG.SWARM_KILLS_EASE_FROM_LEVEL)));
    expect(swarmKillsNeeded(1)).toBe(MG.SWARM_KILLS);
    expect(swarmKillsNeeded(MG.SWARM_KILLS_FROM_LEVEL)).toBe(MG.SWARM_KILLS);
    expect(swarmKillsNeeded(MG.SWARM_KILLS_FROM_LEVEL + 1)).toBe(MG.SWARM_KILLS + MG.SWARM_KILLS_PER_LEVEL);
    // v3.3 (owner: "swarm not keeping up"): 102 at 10, 302 at 20, 400 from level 25 (v3.2: 142, 442, 742). The cap
    // is the knob that matters late; the slope is the biggest cut the balance probe below accepts.
    expect(swarmKillsNeeded(10)).toBe(102);
    // 2026-10-21 (owner: "still seems to take too long to earn in levels near 20 and up"): 278 at 20, 296 at 25.
    expect(swarmKillsNeeded(20)).toBe(302 - 2 * MG.SWARM_KILLS_EASE_PER_LEVEL);
    expect(swarmKillsNeeded(25)).toBe(MG.SWARM_KILLS_CAP - 7 * MG.SWARM_KILLS_EASE_PER_LEVEL);
    expect(swarmKillsNeeded(30)).toBe(MG.SWARM_KILLS_CAP - 12 * MG.SWARM_KILLS_EASE_PER_LEVEL);
    expect(swarmKillsNeeded(1000)).toBe(MG.SWARM_KILLS_LATE_MIN);
    expect(MG.SWARM_KILLS_CAP).toBeLessThanOrEqual(400);
    monotone(pulseKillsNeeded);
    expect(pulseKillsNeeded(1)).toBe(MG.PULSE_KILLS);
    expect(pulseKillsNeeded(MG.PULSE_KILLS_FROM_LEVEL + 5)).toBe(MG.PULSE_KILLS + 5 * MG.PULSE_KILLS_PER_LEVEL);
  });
  it('swarm stock cap and drone count keep growing, then cap', () => {
    monotone(swarmMax);
    expect(swarmMax(1)).toBe(MG.SWARM_MAX);
    expect(swarmMax(11)).toBe(MG.SWARM_MAX + 1);
    expect(swarmMax(1000)).toBe(MG.SWARM_MAX_CAP);
    monotone((l) => swarmCountRange(l).max);
    expect(swarmCountRange(30).max).toBeGreaterThan(16); // past the old cap
    expect(swarmCountRange(1000).max).toBe(MG.SWARM_COUNT_CAP);
  });
  it('sentry cap grows and the hits needed ease', () => {
    monotone(turretMax);
    expect(turretMax(MG.TURRET_LEVEL)).toBe(MG.TURRET_MAX);
    expect(turretMax(MG.TURRET_LEVEL + MG.TURRET_MAX_LEVELS)).toBe(MG.TURRET_MAX + 1);
    expect(turretMax(1000)).toBe(MG.TURRET_MAX_CAP);
    monotone(turretHitsNeeded, true);
    expect(turretHitsNeeded(1)).toBe(MG.TURRET_HITS);
    expect(turretHitsNeeded(1000)).toBe(MG.TURRET_HITS_MIN);
    // More than TURRET_MAX sentries can stand at a high level.
    const st = createState(122);
    start(st);
    st.spawnTimer = 1e9;
    st.t = 30 * MG.LEVEL_SECONDS + 1;
    step(st, NO_INPUT, MG.DT);
    st.turrets.length = 0;
    for (let i = 0; i < 10; i++) deployTurret(st, false, 'orbiter');
    expect(st.turrets.length).toBe(MG.TURRET_MAX_CAP);
  });
  it('laser reach grows in steps to the cap; stages and fan sizes follow streams and level', () => {
    monotone(laserRange);
    expect(laserRange(1)).toBe(MG.LASER_RANGE);
    expect(laserRange(5)).toBe(MG.LASER_RANGE);
    expect(laserRange(6)).toBeCloseTo(MG.LASER_RANGE + MG.LASER_RANGE_STEP, 9);
    expect(laserRange(1000)).toBe(MG.LASER_RANGE_CAP);
    expect(MG.LASER_RANGE_CAP).toBeGreaterThan(MG.FIELD_R);
    expect([1, 2].map((n) => laserStage(n, 50))).toEqual([0, 0]);
    expect([3, 4].map((n) => laserStage(n, 50))).toEqual([1, 1]);
    expect(laserStage(5, 1)).toBe(2);
    expect(laserStage(5, MG.LASER_MESH_LEVEL - 1)).toBe(2);
    expect(laserStage(5, MG.LASER_MESH_LEVEL)).toBe(3);
    expect(laserStage(5, MG.LASER_MESH2_LEVEL)).toBe(4);
    expect([0, 1, 2, 3, 4].map(laserBeamCount)).toEqual([1, 1, 1, 3, 5]);
    expect(laserFanOffsets(2)).toEqual([0]);
    expect(laserFanOffsets(3).map((o) => +o.toFixed(6))).toEqual([-MG.LASER_FAN_SPREAD, 0, MG.LASER_FAN_SPREAD].map((o) => +o.toFixed(6)));
    expect(laserFanOffsets(4).length).toBe(5);
    expect(laserFanOffsets(4).reduce((a, b) => a + b, 0)).toBeCloseTo(0, 9); // centred
  });
  it('a MESH pull fans beams from every launcher that cross their neighbours, with one mesh event', () => {
    const mesh = (level: number, launchers: number) => {
      const st = createState(123);
      start(st);
      st.cheats.god = true;
      st.cheats.noHeat = true;
      st.cheats.launchers = launchers;
      st.spawnTimer = 1e9;
      st.t = (level - 1) * MG.LEVEL_SECONDS + 1;
      step(st, NO_INPUT, MG.DT);
      expect(st.streamCount).toBe(5);
      st.sinceShot = MG.LASER_BREAK_2 + 0.01; // the break needed stays the stage-2 one
      st.fireCooldown = 0;
      st.events.length = 0;
      step(st, FIRE, MG.DT);
      return st;
    };
    const a = mesh(MG.LASER_MESH_LEVEL, 4);
    expect(a.beams.length).toBe(4 * 3);
    expect(a.events.filter((e) => e.type === 'mesh').length).toBe(1);
    expect(a.events.filter((e) => e.type === 'laser').length).toBe(0);
    expect(a.events.find((e) => e.type === 'mesh')).toEqual({ type: 'mesh', beams: 12 });
    // Neighbouring fans cross: launcher 0's +spread beam and launcher 1's -spread beam meet inside the reach.
    const b0 = a.beams.find((b) => Math.abs(wrapAngle(b.angle - (a.launcherAngle + MG.LASER_FAN_SPREAD))) < 1e-6);
    const b1 = a.beams.find((b) => Math.abs(wrapAngle(b.angle - (a.launcherAngle + Math.PI / 2 - MG.LASER_FAN_SPREAD))) < 1e-6);
    expect(b0 && b1).toBeTruthy();
    const b = mesh(MG.LASER_MESH2_LEVEL, 8);
    expect(b.beams.length).toBe(8 * 5);
    expect(b.events.find((e) => e.type === 'mesh')).toEqual({ type: 'mesh', beams: 40 });
    // Below the mesh level 5 streams still beam one per launcher with a plain laser event each.
    const c = mesh(MG.LASER_MESH_LEVEL - 1, 4);
    expect(c.beams.length).toBe(4);
    expect(c.events.filter((e) => e.type === 'laser').length).toBe(4);
    // Not armed: no beams at all.
    c.sinceShot = 0.1;
    c.fireCooldown = 0;
    c.beams.length = 0;
    step(c, FIRE, MG.DT);
    expect(c.beams.length).toBe(0);
  });
});

describe('rock-on-rock dynamics', () => {
  const quiet = (st: MinigameState) => {
    st.spawnTimer = 1e9;
    st.cheats.god = true;
    st.cheats.noHeat = true;
  };
  it('two rocks at rest within range attract each other', () => {
    const st = createState(61);
    start(st);
    quiet(st);
    const a = rock(st, 2, 0, 0, 0, 0.2, 0);
    const b = rock(st, 3, 0, 0, 0, 0.2, 0);
    const d0 = b.x - a.x;
    for (let i = 0; i < 1 / MG.DT; i++) step(st, NO_INPUT, MG.DT);
    expect(a.vx).toBeGreaterThan(0);
    expect(b.vx).toBeLessThan(0);
    expect(b.x - a.x).toBeLessThan(d0);
  });
  it('a fast head-on collision bounces both rocks and chips them', () => {
    const st = createState(62);
    start(st);
    quiet(st);
    const a = rock(st, 2, 0, 1.5, 0, 0.3, 1);
    const b = rock(st, 2.8, 0, -1.5, 0, 0.3, 1);
    const hpA = a.hp;
    for (let i = 0; i < 0.5 / MG.DT; i++) step(st, NO_INPUT, MG.DT);
    expect(a.vx).toBeLessThan(0);
    expect(b.vx).toBeGreaterThan(0);
    expect(a.hp).toBeLessThan(hpA);
    expect(st.events.some((e) => e.type === 'crash')).toBe(true);
  });
  it('a binary pair stays bound for several seconds in isolation', () => {
    const st = createState(63);
    start(st);
    quiet(st);
    spawnBinary(st, 0, 4, 0, 0, 1);
    const [a, b] = st.asteroids;
    if (!a || !b) throw new Error('pair missing');
    const sep0 = Math.hypot(a.x - b.x, a.y - b.y);
    let maxSep = 0;
    for (let i = 0; i < 6 / MG.DT; i++) {
      step(st, NO_INPUT, MG.DT);
      maxSep = Math.max(maxSep, Math.hypot(a.x - b.x, a.y - b.y));
    }
    expect(st.asteroids.length).toBe(2);
    expect(maxSep).toBeLessThan(sep0 * 2.2);
    expect(maxSep).toBeGreaterThan(sep0 * 0.5);
  });
});

describe('moon hit points', () => {
  it('is chipped by rocks, never by bullets, and can be lost', () => {
    const st = createState(71);
    start(st);
    st.spawnTimer = 1e9;
    st.cheats.god = true;
    st.t = MG.MOON_LEVEL * MG.LEVEL_SECONDS;
    st.moonAngle = 0;
    step(st, NO_INPUT, MG.DT);
    const m = moonPosition(st);
    st.bullets.push({ x: m.x - 0.4, y: m.y, vx: MG.BULLET_SPEED, vy: 0, life: 1, r: MG.BULLET_R, damage: 3, auto: false });
    for (let i = 0; i < 0.3 / MG.DT; i++) step(st, NO_INPUT, MG.DT);
    expect(st.moonHp).toBe(MG.MOON_HP);
    rock(st, m.x, m.y + 0.5, 0, -2, 0.4, 2);
    for (let i = 0; i < 0.5 / MG.DT; i++) step(st, NO_INPUT, MG.DT);
    expect(st.moonHp).toBeLessThan(MG.MOON_HP);
    expect(st.events.some((e) => e.type === 'moonhit')).toBe(true);
    st.moonHp = 1;
    const m2 = moonPosition(st);
    rock(st, m2.x, m2.y + 0.5, 0, -2, 0.4, 2);
    for (let i = 0; i < 0.5 / MG.DT; i++) step(st, NO_INPUT, MG.DT);
    expect(st.moonHp).toBe(0);
    expect(moonAlive(st)).toBe(false);
    expect(st.events.some((e) => e.type === 'moonlost')).toBe(true);
  });
});

describe('sentries', () => {
  it('tier rises with level and SUPER fires a 3-way spread at double rate', () => {
    expect(turretTier(MG.TURRET_LEVEL)).toBe(0);
    expect(turretTier(MG.TURRET_LEVEL + MG.TURRET_TIER_LEVELS)).toBe(1);
    expect(turretTier(100)).toBe(2);
    const st = createState(81);
    start(st);
    st.spawnTimer = 1e9;
    st.cheats.god = true;
    st.t = (MG.TURRET_LEVEL + 7) * MG.LEVEL_SECONDS;
    step(st, NO_INPUT, MG.DT);
    deployTurret(st, true, 'orbiter');
    const tr = st.turrets[0];
    if (!tr) throw new Error('no sentry');
    expect(tr.superb).toBe(true);
    expect(tr.tier).toBe(2);
    rock(st, 3, 0, 0, 0, 0.3, 0);
    tr.cooldown = 0;
    step(st, NO_INPUT, MG.DT);
    const auto = st.bullets.filter((b) => b.auto);
    expect(auto.length).toBe(3);
    expect(auto[0]?.damage).toBe(strengthLevel(st.streamCount) + 2);
    expect(tr.cooldown).toBeLessThan(MG.TURRET_COOLDOWN / 2);
  });
  const field = (seed: number) => {
    const st = createState(seed);
    start(st);
    st.spawnTimer = 1e9;
    st.cheats.god = true;
    st.t = MG.TURRET_LEVEL * MG.LEVEL_SECONDS;
    step(st, NO_INPUT, MG.DT);
    st.turrets.length = 0; // the level-up may have gifted a SUPER sentry; tests want a clean slate
    return st;
  };
  it('deploys draw an archetype from the Rng; all four exist and the draw is deterministic', () => {
    const kinds = (seed: number) => {
      const st = field(seed);
      const out: string[] = [];
      for (let i = 0; i < 40; i++) {
        deployTurret(st);
        out.push(st.turrets[0]?.kind ?? '?');
        st.turrets.length = 0;
      }
      return out;
    };
    const a = kinds(90);
    expect(a).toEqual(kinds(90));
    expect(new Set(a)).toEqual(new Set(SENTRY_KINDS));
  });
  it('SWEEPER oscillates within its arc about its home, faces outward and fires in bursts', () => {
    const st = field(91);
    deployTurret(st, false, 'sweeper');
    const tr = st.turrets[0];
    if (!tr) throw new Error('no sentry');
    const home = tr.home;
    // A rock outward of the sentry, at rest.
    rock(st, 3.2 * Math.cos(home), 3.2 * Math.sin(home), 0, 0, 0.3, 0);
    let lo = Infinity;
    let hi = -Infinity;
    const shotTimes: number[] = [];
    for (let i = 0; i < 5 / MG.DT; i++) {
      const before = st.bullets.filter((b) => b.auto).length;
      step(st, NO_INPUT, MG.DT);
      const after = st.bullets.filter((b) => b.auto).length;
      if (after > before) shotTimes.push(st.t);
      const d = wrapAngle(tr.angle - home);
      const sd = d > Math.PI ? d - 2 * Math.PI : d;
      lo = Math.min(lo, sd);
      hi = Math.max(hi, sd);
      expect(tr.radius).toBeCloseTo(MG.TURRET_ORBIT_R, 9);
    }
    expect(lo).toBeLessThan(-MG.SENTRY_SWEEP_ARC * 0.8);
    expect(hi).toBeGreaterThan(MG.SENTRY_SWEEP_ARC * 0.8);
    expect(Math.abs(lo)).toBeLessThanOrEqual(MG.SENTRY_SWEEP_ARC + 1e-9);
    // Bursts: gaps inside a burst are short, gaps between bursts are long.
    const gaps = shotTimes.slice(1).map((t, i) => t - (shotTimes[i] ?? 0));
    expect(gaps.some((g) => g < MG.SENTRY_BURST_GAP * 2)).toBe(true);
    expect(gaps.some((g) => g > MG.SENTRY_BURST_REST * 0.5)).toBe(true);
    // A rock inward of the sentry is not a target for it.
    st.asteroids.length = 0;
    rock(st, 1.3 * Math.cos(home), 1.3 * Math.sin(home), 0, 0, 0.2, 0);
    step(st, NO_INPUT, MG.DT);
    expect(tr.targetId).toBe(-1);
  });
  it('PICKET turns to the densest incoming sector and holds there', () => {
    const st = field(92);
    deployTurret(st, false, 'picket');
    const tr = st.turrets[0];
    if (!tr) throw new Error('no sentry');
    tr.angle = tr.home = Math.PI; // start on the far side
    // A cluster just above bearing 0 (east, inside the first sector), plus one lonely rock north: east must win.
    for (let i = 0; i < 4; i++) rock(st, 4 + i * 0.3, 0.1 + i * 0.2, 0, 0, 0.3, 0);
    rock(st, 0, 4.5, 0, 0, 0.3, 0);
    const want = densestSector(st);
    expect(want).not.toBeNull();
    expect(Math.abs((want ?? 0) - Math.PI / MG.SENTRY_PICKET_SECTORS)).toBeLessThan(1e-9);
    for (let i = 0; i < 4 / MG.DT; i++) step(st, NO_INPUT, MG.DT);
    const diff = wrapAngle(tr.angle - (want ?? 0));
    expect(Math.min(diff, 2 * Math.PI - diff)).toBeLessThan(0.02);
    expect(tr.radius).toBeCloseTo(MG.TURRET_ORBIT_R, 9);
    expect(st.bullets.filter((b) => b.auto).length).toBeGreaterThan(0);
  });
  it('CHASER drifts toward the most threatening rock and stays on its leash', () => {
    const st = field(93);
    deployTurret(st, false, 'chaser');
    const tr = st.turrets[0];
    if (!tr) throw new Error('no sentry');
    tr.angle = tr.home = 0;
    // Far up, well outside the leash; massive and unbreakable so the chaser's own shots barely move it.
    const a = rock(st, 0, 4.5, 0, 0, 0.42, 3);
    a.hp = a.maxHp = 1e6;
    const d0 = Math.hypot(turretPosition(tr).x - a.x, turretPosition(tr).y - a.y);
    const hx = MG.TURRET_ORBIT_R;
    for (let i = 0; i < 3 / MG.DT; i++) {
      step(st, NO_INPUT, MG.DT);
      const p = turretPosition(tr);
      expect(Math.hypot(p.x - hx, p.y)).toBeLessThanOrEqual(MG.SENTRY_CHASE_LEASH + 1e-6);
      expect(tr.radius).toBeGreaterThanOrEqual(MG.SENTRY_CHASE_R_MIN - 1e-9);
    }
    const p = turretPosition(tr);
    expect(Math.hypot(p.x - a.x, p.y - a.y)).toBeLessThan(d0 - 0.5);
    expect(Math.hypot(p.x - hx, p.y)).toBeCloseTo(MG.SENTRY_CHASE_LEASH, 2); // parked at the end of the leash
    expect(p.y).toBeGreaterThan(1);
    expect(st.bullets.filter((b) => b.auto).length).toBeGreaterThan(0);
    // With nothing left it returns home.
    st.asteroids.length = 0;
    st.bullets.length = 0;
    for (let i = 0; i < 3 / MG.DT; i++) step(st, NO_INPUT, MG.DT);
    const q = turretPosition(tr);
    expect(Math.hypot(q.x - hx, q.y)).toBeLessThan(0.05);
  });
  it('sentries of every kind survive a save and resume', () => {
    const st = field(94);
    for (const kind of SENTRY_KINDS) deployTurret(st, false, kind);
    expect(st.turrets.length).toBe(MG.TURRET_MAX);
    for (let i = 0; i < 6; i++) rock(st, 3.5 * Math.cos(i), 3.5 * Math.sin(i), -0.2 * Math.cos(i), -0.2 * Math.sin(i), 0.3, 1);
    for (let i = 0; i < 1 / MG.DT; i++) step(st, NO_INPUT, MG.DT);
    const copy = deserialize(serialize(st));
    if (!copy) throw new Error('deserialize returned null');
    expect(snapshot(copy)).toBe(snapshot(st));
    for (let i = 0; i < 3 / MG.DT; i++) {
      step(st, NO_INPUT, MG.DT);
      step(copy, NO_INPUT, MG.DT);
    }
    expect(snapshot(copy)).toBe(snapshot(st));
  });
  it('chaos level is bounded', () => {
    const st = createState(82);
    expect(chaosLevel(st)).toBeGreaterThanOrEqual(0);
    st.level = 99;
    for (let i = 0; i < 100; i++) rock(st, 3, 0, 0, 0);
    expect(chaosLevel(st)).toBe(1);
  });
});

describe('continents v2', () => {
  it('produce separated landmasses plus islands, all inside the disc', () => {
    const cs = generateContinents(new Rng(5));
    expect(cs.length).toBeGreaterThanOrEqual(3);
    for (const c of cs) {
      expect(c.length / 2).toBeGreaterThanOrEqual(8);
      for (let i = 0; i < c.length; i += 2) expect(Math.hypot(c[i] as number, c[i + 1] as number)).toBeLessThanOrEqual(0.9 + 1e-9);
    }
  });
});

describe('save and resume', () => {
  const TURN_FIRE: Input = { ...NO_INPUT, left: true, fire: true };
  it('serialize / deserialize round-trips: both copies step identically for 10 s', () => {
    const live = run(2026, 40, TURN_FIRE);
    expect(live.status).toBe('playing');
    expect(live.asteroids.length).toBeGreaterThan(0);
    const json = serialize(live);
    expect(isSavedGame(JSON.parse(json))).toBe(true);
    const copy = deserialize(json);
    if (!copy) throw new Error('deserialize returned null');
    expect(snapshot(copy)).toBe(snapshot(live));
    expect(copy.continents.map((c) => Array.from(c))).toEqual(live.continents.map((c) => Array.from(c)));
    expect(copy.asteroids.map((a) => Array.from(a.shape))).toEqual(live.asteroids.map((a) => Array.from(a.shape)));
    for (let i = 0; i < 10 / MG.DT; i++) {
      const input = i % 240 < 120 ? TURN_FIRE : FIRE;
      step(live, input, MG.DT);
      step(copy, input, MG.DT);
    }
    expect(snapshot(copy)).toBe(snapshot(live));
    expect(copy.particles.length).toBe(live.particles.length);
    expect(copy.rng.getState()).toBe(live.rng.getState());
  });
  it('rejects anything that is not a valid save', () => {
    expect(deserialize('not json')).toBeNull();
    expect(deserialize('{"v":1}')).toBeNull();
    expect(deserialize('[]')).toBeNull();
    const good = toSaved(run(3, 5, FIRE));
    expect(isSavedGame(good)).toBe(true);
    expect(isSavedGame({ ...good, hp: '100' })).toBe(false);
    expect(isSavedGame({ ...good, v: 2 })).toBe(false);
    expect(isSavedGame({ ...good, seekers: [{ x: 1 }] })).toBe(false);
    expect(isSavedGame({ ...good, swarmStock: 'two' })).toBe(false);
    expect(isSavedGame({ ...good, turrets: [{ ...good.turrets[0], kind: 'drone' }] })).toBe(false);
    expect(isSavedGame({ ...good, collision: 'fast' })).toBe(false);
    expect(isSavedGame({ ...good, asteroids: [{ x: 1 }] })).toBe(false);
    expect(isSavedGame({ ...good, rng: Number.NaN })).toBe(false);
    expect(isSavedGame({ ...good, cheats: { ...good.cheats, launchers: 'eight' } })).toBe(false);
    // Optional cheat fields may be absent.
    const { launchers: _l, streams: _s, ...rest } = good.cheats;
    expect(isSavedGame({ ...good, cheats: rest })).toBe(true);
  });
});

describe('ready panel keys (screen)', () => {
  // The screen is DOM-free until render(): a fake key tracker, a fake sessionStorage and a never-called
  // Surface are enough to drive update() in node. Only the ready-panel decision is under test here.
  class FakeKeys {
    private readonly edges = new Set<string>();
    private readonly down = new Set<string>();
    press(code: string): void {
      this.edges.add(code);
      this.down.add(code);
    }
    endFrame(): void {
      this.edges.clear();
    }
    anyKeyPressed(): boolean {
      return this.edges.size > 0;
    }
    pressed(code: string): boolean {
      return this.edges.has(code);
    }
    anyPressed(...codes: string[]): boolean {
      return codes.some((c) => this.edges.has(c));
    }
    held(code: string): boolean {
      return this.down.has(code);
    }
    anyHeld(...codes: string[]): boolean {
      return codes.some((c) => this.down.has(c));
    }
    typed(): string {
      return '';
    }
    clearTyped(): void {}
  }
  const SAVE_KEY = 'missb.minigame.save';
  function fakeStorage() {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, String(v)),
      removeItem: (k: string) => void m.delete(k),
    };
  }
  function screenWith(keys: FakeKeys): MinigameScreen {
    return new MinigameScreen({} as Surface, keys as unknown as Keys, { go() {} });
  }
  const g = globalThis as { sessionStorage?: unknown };

  it('with a save present, Space (even held from before the reload) resumes it unchanged', () => {
    const store = fakeStorage();
    g.sessionStorage = store;
    try {
      const saved = run(77, 45, FIRE, 'auto', (st) => void (st.cheats.god = true));
      expect(saved.status).toBe('playing');
      expect(saved.level).toBeGreaterThan(1);
      store.setItem(SAVE_KEY, serialize(saved));
      const keys = new FakeKeys();
      const screen = screenWith(keys);
      screen.enter();
      expect(screen.state.status).toBe('ready');
      keys.press('Space'); // the player was firing when the reload hit: Space is down and edges this frame
      screen.update(16);
      expect(screen.state.status).toBe('playing');
      expect(screen.state.score).toBe(saved.score);
      expect(screen.state.level).toBe(saved.level);
      expect(screen.state.t).toBe(saved.t);
      expect(store.getItem(SAVE_KEY)).not.toBeNull(); // resuming does not throw the save away
      // R stays an alias for resume.
      const keys2 = new FakeKeys();
      const screen2 = screenWith(keys2);
      screen2.enter();
      keys2.press('KeyR');
      screen2.update(16);
      expect(screen2.state.status).toBe('playing');
      expect(screen2.state.score).toBe(saved.score);
    } finally {
      delete g.sessionStorage;
    }
  });
  it('with a save present, Backspace starts a new game and clears the save; without one, Space starts', () => {
    const store = fakeStorage();
    g.sessionStorage = store;
    try {
      const saved = run(78, 45, FIRE, 'auto', (st) => void (st.cheats.god = true));
      expect(saved.status).toBe('playing');
      store.setItem(SAVE_KEY, serialize(saved));
      const keys = new FakeKeys();
      const screen = screenWith(keys);
      screen.enter();
      keys.press('Backspace');
      screen.update(16);
      expect(screen.state.status).toBe('playing');
      expect(screen.state.level).toBe(1);
      expect(screen.state.score).toBe(0);
      expect(screen.state.t).toBeLessThan(0.1);
      expect(store.getItem(SAVE_KEY)).toBeNull();
      // Backspace with no save does nothing; Space starts a fresh game.
      const keys2 = new FakeKeys();
      const screen2 = screenWith(keys2);
      screen2.enter();
      keys2.press('Backspace');
      screen2.update(16);
      expect(screen2.state.status).toBe('ready');
      keys2.endFrame();
      keys2.press('Space');
      screen2.update(16);
      expect(screen2.state.status).toBe('playing');
      expect(screen2.state.level).toBe(1);
    } finally {
      delete g.sessionStorage;
    }
  });
});

describe('balance probe', () => {
  // A scripted player: fires continuously and turns toward the rock nearest the planet that is not passing.
  // It is deliberately naive (overheats, no lead, never pulses), so it is a floor under a careful human.
  function scripted(st: MinigameState): Input {
    let best: Asteroid | null = null;
    let bestD = Infinity;
    for (const a of st.asteroids) {
      if (a.passing) continue;
      const d = Math.hypot(a.x, a.y);
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    if (!best) return FIRE;
    const diff = wrapAngle(Math.atan2(best.y, best.x) - st.launcherAngle);
    return { ...NO_INPUT, left: diff > 0.02, right: diff < -0.02, fire: true };
  }
  it('a naive scripted player survives the opening but is losing hull by 150 s (god off)', () => {
    // Guard rail for tuning: if the opening gets harder the first assertion fails; if the ramp gets softer
    // the second does. Measured 2026-10-17: seeds 1..4 lose at 149.6, 80.4, 105.9 and 132.1 s.
    for (const seed of [1, 2, 3, 4]) {
      const st = createState(seed);
      start(st);
      const n = Math.round(150 / MG.DT);
      for (let i = 0; i < n && st.status === 'playing'; i++) step(st, scripted(st), MG.DT);
      expect(st.t, `seed ${seed} survival`).toBeGreaterThanOrEqual(60);
      expect(st.hp, `seed ${seed} hull at 150 s`).toBeLessThan(MG.MAX_HP);
    }
  });
  // The weapons-using bot now lives in src/minigame/bot.ts (shared with the SUPER DEMO and the difficulty table).
  const armed = botInput;
  it.each([1, 2, 3, 4])('with every weapon in use the ramp still bites, after level 10 (seed %i, 600 s, god off)', { timeout: 120000 }, (seed) => {
    // Measured 2026-10-17 with the knobs of that day (HP_MULT_PER_LEVEL 0.15, SPAWN_FLOOR_FACTOR 0.95,
    // SWARM_KILLS_PER_LEVEL 30): seeds 1..4 reach levels 27, 30, 30, 30; hull lost before / after level 10:
    // 0/100, 45/55, 8/45, 0/91; two seeds die (530 s, 582 s), two end at 47 and 9 hull. Levels 10-15 are a
    // fortress for any weapons-using player (no knob set produced more than one impact there), so the window
    // runs to level 30, where the growths in config.ts (hit points, speed cap, spawn floor, pressure) take over.
    const st = createState(seed);
    start(st);
    const n = Math.round(600 / MG.DT);
    let lostBefore10 = 0;
    let lostAfter10 = 0;
    let hp = st.hp;
    for (let i = 0; i < n && st.status === 'playing'; i++) {
      step(st, armed(st), MG.DT);
      st.events.length = 0;
      if (st.hp < hp) {
        if (st.level < 10) lostBefore10 += hp - st.hp;
        else lostAfter10 += hp - st.hp;
      }
      hp = st.hp;
    }
    expect(st.level, 'reaches level 12 with every weapon in use').toBeGreaterThanOrEqual(12);
    expect(lostAfter10, 'hull loss comes mostly after level 10').toBeGreaterThan(lostBefore10);
    expect(lostBefore10, 'the opening is survivable').toBeLessThan(MG.MAX_HP / 2);
    expect(st.status === 'over' || st.hp < 60, 'no plateau: by level 30 the ramp has cost most of the hull').toBe(true);
  });
  it('the hull damage cap is gentler in the first levels', () => {
    expect(hullDamage(1, 0.42, 0)).toBe(byLevel(MG.DAMAGE_MAX_BY_LEVEL, 1));
    expect(hullDamage(1, 0.42, 3)).toBe(byLevel(MG.DAMAGE_MAX_BY_LEVEL, 1));
    expect(hullDamage(3, 0.42, 3)).toBe(byLevel(MG.DAMAGE_MAX_BY_LEVEL, 3));
    expect(hullDamage(3, 0.05, 0)).toBe(MG.DAMAGE_MIN);
    expect(byLevel(MG.DAMAGE_MAX_BY_LEVEL, 1)).toBeLessThan(byLevel(MG.DAMAGE_MAX_BY_LEVEL, 1000));
  });
});

describe('sound variants (sfx.ts)', () => {
  // Nothing here is audible: the tables, the defaults, the persisted-choice guard and the lab's review order are
  // what a test can hold. The owner picks the actual voices by ear in the SOUND LAB.
  it('every event has at least three variants plus OFF, with unique short names and complete metadata', () => {
    for (const ev of SOUND_EVENTS) {
      const table = VARIANTS[ev];
      expect(table.length, ev).toBeGreaterThanOrEqual(3);
      const all = choicesFor(ev);
      expect(all[all.length - 1]).toBe(OFF);
      expect(new Set(all.map((v) => v.name)).size).toBe(all.length);
      for (const v of table) {
        expect(v.name, `${ev} name`).toMatch(/^[A-Z][A-Z ]{2,8}$/);
        expect(v.about.length, `${ev} ${v.name} about`).toBeGreaterThan(8);
        expect(v.hz).toBeGreaterThan(0);
        expect(v.attackMs).toBeGreaterThanOrEqual(0);
        expect(v.dur).toBeGreaterThan(0);
        expect(typeof v.play).toBe('function');
      }
    }
  });
  it('the default of every event is a real voice, and for the bleepy events it is the least clicky one', () => {
    for (const ev of SOUND_EVENTS) expect(VARIANTS[ev][DEFAULT_INDEX]).not.toBe(OFF);
    // Proxy: spectral centre over (1 + attack ms); see sfx.ts HOW. Owner, v3.2: "some bleepy sounds are a little
    // annoying": shots, sentries and hits are the frequent ones, so their defaults must be the softest by the proxy.
    for (const ev of ['SHOT', 'HIT', 'SENTRY'] as const) {
      const table = VARIANTS[ev];
      const def = clickiness(table[DEFAULT_INDEX] ?? OFF);
      for (const v of table.slice(1)) expect(def, `${ev}: ${v.name} is softer than the default`).toBeLessThan(clickiness(v));
    }
    expect(clickiness({ hz: 60, attackMs: 4 })).toBe(12);
  });
  it('variants play without an audio context (node): no throw, no state', () => {
    const sfx = new SfxPlayer();
    for (const ev of SOUND_EVENTS) for (const v of choicesFor(ev)) expect(() => v.play(sfx.synth, AUDITION_CUE)).not.toThrow();
    expect(() => sfx.audition('SWARM')).not.toThrow();
    expect(() => sfx.play([{ type: 'shot', strength: 2 }, { type: 'hit', tier: 3 }, { type: 'impact' }, { type: 'over' }], 1)).not.toThrow();
    expect(() => sfx.ambient(0.9, 0.5)).not.toThrow();
  });
  it('choices cycle through OFF and back, and the persisted shape round-trips', () => {
    const sfx = new SfxPlayer();
    const n = choicesFor('SHOT').length;
    expect(sfx.variantOf('SHOT').name).toBe('THUMP');
    for (let i = 0; i < n - 1; i++) sfx.cycleChoice('SHOT', 1);
    expect(sfx.variantOf('SHOT')).toBe(OFF);
    sfx.cycleChoice('SHOT', 1);
    expect(sfx.choice.SHOT).toBe(DEFAULT_INDEX);
    sfx.cycleChoice('SHOT', -1);
    expect(sfx.variantOf('SHOT')).toBe(OFF);
    sfx.setChoice('HIT', 2);
    sfx.setVolume(0.8);
    sfx.ambientLevel = 0.3;
    const p = sfx.prefs();
    expect(isSfxPrefs(p)).toBe(true);
    expect(isSfxPrefs(JSON.parse(JSON.stringify(p)))).toBe(true);
    const other = new SfxPlayer();
    other.applyPrefs(p);
    expect(other.variantOf('SHOT')).toBe(OFF);
    expect(other.variantOf('HIT').name).toBe(VARIANTS.HIT[2]?.name);
    expect(other.volume).toBe(0.8);
    expect(other.ambientLevel).toBe(0.3);
    other.resetChoices();
    expect(other.variantOf('SHOT').name).toBe('THUMP');
    expect(other.volume).toBe(0.5);
    expect(other.ambientLevel).toBe(1);
  });
  it('the persisted-choice guard rejects bad shapes', () => {
    const good = new SfxPlayer().prefs();
    expect(isSfxPrefs(good)).toBe(true);
    expect(isSfxPrefs({ choices: {}, volume: 0.5, ambient: 1 })).toBe(true); // partial choices mean defaults
    expect(isSfxPrefs(null)).toBe(false);
    expect(isSfxPrefs([])).toBe(false);
    expect(isSfxPrefs({})).toBe(false);
    expect(isSfxPrefs('THUMP')).toBe(false);
    expect(isSfxPrefs({ ...good, volume: 2 })).toBe(false);
    expect(isSfxPrefs({ ...good, volume: '0.5' })).toBe(false);
    expect(isSfxPrefs({ ...good, ambient: -0.1 })).toBe(false);
    expect(isSfxPrefs({ ...good, ambient: Number.NaN })).toBe(false);
    expect(isSfxPrefs({ ...good, choices: [] })).toBe(false);
    expect(isSfxPrefs({ ...good, choices: { SHOT: 'NOT A VARIANT' } })).toBe(false);
    expect(isSfxPrefs({ ...good, choices: { SHOT: 1 } })).toBe(false);
    expect(isSfxPrefs({ ...good, choices: { BOGUS: 'THUMP' } })).toBe(false);
    expect(isSfxPrefs({ ...good, choices: { SHOT: 'OFF' } })).toBe(true);
    expect(variantIndex('SHOT', 'OFF')).toBe(VARIANTS.SHOT.length);
    expect(variantIndex('SHOT', 'nope')).toBe(-1);
  });
  it('the review sequence covers every event exactly once, in the lab, with a gap between', () => {
    const seq = reviewSequence();
    expect([...seq].sort()).toEqual([...SOUND_EVENTS].sort());
    expect(new Set(seq).size).toBe(seq.length);
    // Drive the lab's REVIEW mode with a silent player: the highlighted event must walk the whole sequence once.
    const sfx = new SfxPlayer();
    const lab = createLab();
    lab.open = true;
    const press = (code: string) => ({ pressed: (c: string) => c === code, anyPressed: (...cs: string[]) => cs.includes(code) });
    const idle = press('');
    updateLab(lab, press('KeyA'), sfx, 0);
    expect(lab.reviewAt).toBe(0);
    const played: SoundEvent[] = [];
    let last: SoundEvent | null = null;
    for (let i = 0; i < 400 && lab.reviewAt >= 0; i++) {
      updateLab(lab, idle, sfx, 0.05);
      if (lab.lastPlayed !== last && lab.lastPlayed) {
        played.push(lab.lastPlayed);
        expect(LAB_ROWS[lab.row]).toBe(lab.lastPlayed); // the row follows the event being played
      }
      last = lab.lastPlayed;
    }
    expect(played).toEqual([...seq]);
    expect(lab.reviewAt).toBe(-1);
    // Any navigation stops the review.
    updateLab(lab, press('KeyA'), sfx, 0);
    expect(lab.reviewAt).toBe(0);
    updateLab(lab, press('ArrowDown'), sfx, 0);
    expect(lab.reviewAt).toBe(-1);
  });
  it('the lab keys select rows, cycle variants, adjust levels, reset and close', () => {
    const sfx = new SfxPlayer();
    const lab = createLab();
    lab.open = true;
    const press = (code: string) => ({ pressed: (c: string) => c === code, anyPressed: (...cs: string[]) => cs.includes(code) });
    expect(updateLab(lab, press('ArrowDown'), sfx, 0.016)).toBe(false);
    expect(LAB_ROWS[lab.row]).toBe('HIT');
    expect(updateLab(lab, press('ArrowRight'), sfx, 0.016)).toBe(true);
    expect(sfx.variantOf('HIT').name).toBe(VARIANTS.HIT[1]?.name);
    expect(lab.lastPlayed).toBe('HIT');
    expect(updateLab(lab, press('ArrowUp'), sfx, 0.016)).toBe(false);
    expect(updateLab(lab, press('ArrowUp'), sfx, 0.016)).toBe(false); // wraps to the last row
    expect(LAB_ROWS[lab.row]).toBe('AMBIENT LEVEL');
    expect(updateLab(lab, press('ArrowLeft'), sfx, 0.016)).toBe(true);
    expect(sfx.ambientLevel).toBeCloseTo(0.9, 9);
    updateLab(lab, press('ArrowUp'), sfx, 0.016);
    expect(LAB_ROWS[lab.row]).toBe('VOLUME');
    expect(updateLab(lab, press('ArrowRight'), sfx, 0.016)).toBe(true);
    expect(sfx.volume).toBeCloseTo(0.55, 9);
    expect(updateLab(lab, press('Digit0'), sfx, 0.016)).toBe(true);
    expect(sfx.variantOf('HIT').name).toBe('SUB POP');
    expect(sfx.volume).toBe(0.5);
    expect(sfx.ambientLevel).toBe(1);
    expect(updateLab(lab, press('Escape'), sfx, 0.016)).toBe(false);
    expect(lab.open).toBe(false);
  });
});

describe('sound lab from the screen', () => {
  class FakeKeys {
    private readonly edges = new Set<string>();
    press(code: string): void {
      this.edges.add(code);
    }
    endFrame(): void {
      this.edges.clear();
    }
    anyKeyPressed(): boolean {
      return this.edges.size > 0;
    }
    pressed(code: string): boolean {
      return this.edges.has(code);
    }
    anyPressed(...codes: string[]): boolean {
      return codes.some((c) => this.edges.has(c));
    }
    held(): boolean {
      return false;
    }
    anyHeld(): boolean {
      return false;
    }
    typed(): string {
      return '';
    }
    clearTyped(): void {}
  }
  function fakeStorage() {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, String(v)),
      removeItem: (k: string) => void m.delete(k),
    };
  }
  const g = globalThis as { localStorage?: unknown };
  it('L on the ready panel opens the lab, the sim stays put, a change is saved under one guarded key, Esc returns', () => {
    const store = fakeStorage();
    g.localStorage = store;
    try {
      const keys = new FakeKeys();
      let went = '';
      const screen = new MinigameScreen({} as Surface, keys as unknown as Keys, { go: (s: string) => void (went = s) });
      expect(screen.state.status).toBe('ready');
      keys.press(LAB_KEY);
      screen.update(16);
      keys.endFrame();
      expect(screen.lab.open).toBe(true);
      expect(screen.state.status).toBe('ready');
      // Space inside the lab replays; it must not start the game.
      keys.press('Space');
      screen.update(16);
      keys.endFrame();
      expect(screen.state.status).toBe('ready');
      keys.press('ArrowRight');
      screen.update(16);
      keys.endFrame();
      expect(screen.sounds.variantOf('SHOT').name).toBe('BLIP');
      const raw = store.getItem('missb.minigame.sfx');
      expect(raw).not.toBeNull();
      const parsed: unknown = JSON.parse(raw ?? 'null');
      expect(isSfxPrefs(parsed)).toBe(true);
      keys.press('Escape');
      screen.update(16);
      keys.endFrame();
      expect(screen.lab.open).toBe(false);
      expect(went).toBe(''); // Esc closed the lab, it did not leave the screen
      expect(screen.state.status).toBe('ready');
      // A fresh screen reads the saved choice back.
      const screen2 = new MinigameScreen({} as Surface, new FakeKeys() as unknown as Keys, { go() {} });
      expect(screen2.sounds.variantOf('SHOT').name).toBe('BLIP');
      // A corrupt save falls back to the defaults.
      store.setItem('missb.minigame.sfx', JSON.stringify({ choices: { SHOT: 'NOPE' }, volume: 0.5, ambient: 1 }));
      const screen3 = new MinigameScreen({} as Surface, new FakeKeys() as unknown as Keys, { go() {} });
      expect(screen3.sounds.variantOf('SHOT').name).toBe('THUMP');
    } finally {
      delete g.localStorage;
    }
  });
});
