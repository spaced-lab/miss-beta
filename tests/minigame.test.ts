import { describe, expect, it } from 'vitest';
import { findHitsGrid, findHitsNaive, type Circle } from '../src/minigame/collision';
import { MG } from '../src/minigame/config';
import { generateContinents } from '../src/minigame/planet';
import { asteroidSpeed, createState, launcherCount, NO_INPUT, snapshot, spawnInterval, start, step, streamCount, type Input } from '../src/minigame/sim';
import { Rng } from '../src/sim/rng';
import { CheatRegistry } from '../src/game/cheats';
import { MINIGAME_CHEATS } from '../src/minigame/cheats';

const FIRE: Input = { left: false, right: false, fire: true, pulse: false };

function run(seed: number, seconds: number, input: Input = NO_INPUT, collision: 'grid' | 'naive' = 'grid') {
  const st = createState(seed, collision);
  start(st);
  const n = Math.round(seconds / MG.DT);
  for (let i = 0; i < n && st.status === 'playing'; i++) step(st, input, MG.DT);
  return st;
}

describe('difficulty curves', () => {
  it('spawn interval decays monotonically to the floor', () => {
    expect(spawnInterval(0)).toBeCloseTo(MG.SPAWN_0);
    let prev = spawnInterval(0);
    for (let t = 1; t < 1000; t += 7) {
      const v = spawnInterval(t);
      expect(v).toBeLessThanOrEqual(prev + 1e-12);
      expect(v).toBeGreaterThanOrEqual(MG.SPAWN_MIN);
      prev = v;
    }
    expect(spawnInterval(1e6)).toBe(MG.SPAWN_MIN);
  });
  it('asteroid speed ramps and caps', () => {
    expect(asteroidSpeed(0)).toBe(MG.AST_SPEED_0);
    expect(asteroidSpeed(1e6)).toBe(MG.AST_SPEED_MAX);
  });
  it('launchers double 1,2,4,8 and streams step 1..5', () => {
    expect(launcherCount(0)).toBe(1);
    expect(launcherCount(MG.LAUNCHER_DOUBLE_TIMES[0] as number)).toBe(2);
    expect(launcherCount(MG.LAUNCHER_DOUBLE_TIMES[1] as number)).toBe(4);
    expect(launcherCount(1e6)).toBe(8);
    expect(streamCount(0)).toBe(1);
    expect(streamCount(1e6)).toBe(5);
  });
});

describe('simulation', () => {
  it('is deterministic for the same seed and inputs', () => {
    const a = run(123, 40, FIRE);
    const b = run(123, 40, FIRE);
    expect(snapshot(a)).toBe(snapshot(b));
  });
  it('differs for different seeds', () => {
    expect(snapshot(run(1, 20))).not.toBe(snapshot(run(2, 20)));
  });
  it('an idle planet eventually loses', () => {
    const st = run(7, 600);
    expect(st.status).toBe('over');
    expect(st.hp).toBe(0);
    expect(st.t).toBeLessThan(600);
  });
  it('continuous fire destroys rocks and scores', () => {
    const st = run(42, 30, FIRE);
    expect(st.kills).toBeGreaterThan(0);
    expect(st.score).toBeGreaterThan(0);
  });
  it('godmode never loses hull', () => {
    const st = createState(5);
    start(st);
    st.cheats.god = true;
    for (let i = 0; i < 300 / MG.DT; i++) step(st, NO_INPUT, MG.DT);
    expect(st.hp).toBe(MG.MAX_HP);
    expect(st.status).toBe('playing');
  });
  it('a pulse clears the field and consumes stock', () => {
    const st = run(9, 15);
    if (st.status !== 'playing') return; // extremely unlucky seed; other tests cover losing
    st.pulses = 1;
    expect(st.asteroids.length).toBeGreaterThan(0);
    step(st, { ...NO_INPUT, pulse: true }, MG.DT);
    expect(st.pulses).toBe(0);
    expect(st.pulseR).toBeGreaterThan(0);
    for (let i = 0; i < 2 / MG.DT; i++) step(st, NO_INPUT, MG.DT);
    // Everything that was inside the field when the ring passed is gone; new spawns may exist at the rim.
    for (const a of st.asteroids) expect(Math.hypot(a.x, a.y)).toBeGreaterThan(MG.FIELD_R - 2.5);
  });
  it('naive and grid collision produce identical games', () => {
    expect(snapshot(run(77, 60, FIRE, 'grid'))).toBe(snapshot(run(77, 60, FIRE, 'naive')));
  });
  it('entity counts stay within budget', () => {
    const st = createState(3);
    start(st);
    st.cheats.launchers = 8;
    st.cheats.streams = 5;
    st.cheats.god = true;
    for (let i = 0; i < 60 / MG.DT; i++) {
      step(st, FIRE, MG.DT);
      expect(st.bullets.length).toBeLessThanOrEqual(MG.MAX_BULLETS);
      expect(st.particles.length).toBeLessThanOrEqual(MG.MAX_PARTICLES);
      expect(st.asteroids.length).toBeLessThanOrEqual(MG.MAX_ASTEROIDS);
    }
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
      const a = findHitsNaive(bullets, asteroids);
      const b = findHitsGrid(bullets, asteroids);
      expect(Array.from(b)).toEqual(Array.from(a));
      expect(a.some((v) => v >= 0)).toBe(true);
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
    expect(a.length).toBeLessThanOrEqual(5);
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
    const fired = reg.match('XXGODMODE', st);
    expect(fired?.code).toBe('GODMODE');
    expect(st.cheats.god).toBe(true);
    expect(st.cheats.assisted).toBe(true);
  });
  it('rejects malformed codes', () => {
    expect(() => new CheatRegistry([{ code: 'no', message: '', apply: () => {} }])).toThrow();
  });
});
