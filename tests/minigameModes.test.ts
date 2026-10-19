// WHAT: Tests for PERIMETER run options: difficulty multipliers, the start-level kit, the settings guard, the SUPER
//       DEMO wiring on the screen, and the REDUCE MOTION shake switch.
// WHY:  modes.ts and the difficulty reads in sim.ts are pure; the screen glue is DOM-free until render().
// HOW:  Short headless runs (seeded, fixed step) and a fake key tracker / storage for the screen.
// LORE: G1 (how to play), G6 (modes and cheat codes)

import { describe, expect, it } from 'vitest';
import { botInput } from '../src/minigame/bot';
import { MG, type Difficulty } from '../src/minigame/config';
import { bestKey, MinigameScreen, SETTINGS_KEY } from '../src/minigame/index';
import { loadMinigameSettings, saveMinigameSettings, stepDifficulty, stepStartLevel } from '../src/minigame/prefs';
import { DEFAULT_SETTINGS, isMinigameSettings, isRanked, newGame, nextDifficulty, nextStartLevel, setupStart, startMoonFrac } from '../src/minigame/modes';
import { shakePx } from '../src/minigame/render';
import { isSavedReplay } from '../src/minigame/replay';
import {
  createState, deserialize, difficultyOf, hullDamage, launcherCount, NO_INPUT, pressureMax, scaledHullDamage, serialize, snapshot, start, step, streamCount, toSaved, turretMax,
} from '../src/minigame/sim';
import type { Surface } from '../src/render/canvas';
import type { Input as Keys } from '../src/ui/input';

const DIFFS: readonly Difficulty[] = ['easy', 'normal', 'hard'];

describe('difficulty multipliers', () => {
  it('NORMAL is 1 everywhere; EASY is never harder and HARD never easier on any axis', () => {
    const n = MG.DIFFICULTY.normal;
    expect([n.spawn, n.hp, n.speed, n.damage]).toEqual([1, 1, 1, 1]);
    for (const k of ['spawn', 'hp', 'speed', 'damage'] as const) {
      expect(MG.DIFFICULTY.easy[k]).toBeLessThanOrEqual(1);
      expect(MG.DIFFICULTY.hard[k]).toBeGreaterThanOrEqual(1);
    }
    expect(MG.DIFFICULTY_ORDER).toEqual(DIFFS);
    expect(MG.DIFFICULTY_DEFAULT).toBe('normal');
  });
  it('NORMAL reproduces the default game exactly (same seed, same inputs, same snapshot)', () => {
    const a = createState(5);
    const b = createState(5, 'auto', 'normal');
    start(a);
    start(b);
    for (let i = 0; i < Math.round(30 / MG.DT); i++) {
      step(a, botInput(a), MG.DT);
      step(b, botInput(b), MG.DT);
    }
    expect(snapshot(b)).toBe(snapshot(a));
  });
  it('hull damage scales and never drops below 1', () => {
    const e = createState(1, 'auto', 'easy');
    const n = createState(1, 'auto', 'normal');
    const h = createState(1, 'auto', 'hard');
    expect(scaledHullDamage(n, 0.4, 1)).toBe(hullDamage(1, 0.4, 1));
    expect(scaledHullDamage(e, 0.4, 1)).toBeLessThan(scaledHullDamage(n, 0.4, 1));
    expect(scaledHullDamage(h, 0.4, 1)).toBeGreaterThan(scaledHullDamage(n, 0.4, 1));
    expect(scaledHullDamage(e, 0.01, 0)).toBeGreaterThanOrEqual(1);
    expect(difficultyOf(h)).toBe(MG.DIFFICULTY.hard);
  });
  it('spawn rate, speed and hit points order EASY < NORMAL < HARD on the same seed', () => {
    // No firing for 60 s at level 20: count the rocks spawned (ids handed out), their mean speed and hit points at spawn.
    const measure = (d: Difficulty) => {
      const st = newGame(9, 'auto', { difficulty: d, startLevel: 20 });
      st.turrets.length = 0;
      st.cheats.god = true;
      // A full moon soaks up the hits: a level-20 start now has almost none (MG.START_MOON_FRAC), and hits on the
      // planet lower the pressure, a feedback that would blur the multipliers this test isolates.
      st.moonHp = MG.MOON_HP;
      let speed = 0;
      let hp = 0;
      let n = 0;
      const seen = new Set<number>();
      for (let i = 0; i < Math.round(60 / MG.DT); i++) {
        step(st, NO_INPUT, MG.DT);
        for (const a of st.asteroids) {
          if (seen.has(a.id) || a.core) continue;
          seen.add(a.id);
          speed += Math.hypot(a.vx, a.vy);
          hp += a.maxHp / a.r;
          n++;
        }
      }
      return { spawned: st.nextId, speed: speed / n, hp: hp / n };
    };
    const [e, nm, h] = DIFFS.map(measure) as [ReturnType<typeof measure>, ReturnType<typeof measure>, ReturnType<typeof measure>];
    expect(e.spawned).toBeLessThan(nm.spawned);
    expect(nm.spawned).toBeLessThan(h.spawned);
    expect(e.speed).toBeLessThan(nm.speed);
    expect(nm.speed).toBeLessThan(h.speed);
    expect(e.hp).toBeLessThan(nm.hp);
    expect(nm.hp).toBeLessThan(h.hp);
  });
  it('the bot does better on EASY than on HARD from level 30 (seeds 1, 2, 120 s)', { timeout: 60000 }, () => {
    // The full table (seeds 1..4, every start level) is in config.ts next to MG.DIFFICULTY and in docs/MINIGAME_BACKLOG.md.
    const score = (d: Difficulty): number => {
      let total = 0;
      for (const seed of [1, 2]) {
        const st = newGame(seed, 'auto', { difficulty: d, startLevel: 30 });
        const t0 = st.t;
        for (let i = 0; i < Math.round(120 / MG.DT) && st.status === 'playing'; i++) {
          step(st, botInput(st), MG.DT);
          st.events.length = 0;
        }
        total += st.t - t0 + st.hp;
      }
      return total;
    };
    expect(score('easy')).toBeGreaterThan(score('hard'));
  });
});

describe('start level', () => {
  it('level 1 is a plain new game', () => {
    const st = newGame(3, 'auto', DEFAULT_SETTINGS);
    expect(st.status).toBe('playing');
    expect(st.level).toBe(1);
    expect(st.t).toBe(0);
    expect(st.startLevel).toBe(1);
    expect(st.pulses).toBe(0);
    expect(isRanked(st)).toBe(true);
  });
  it.each([10, 20, 30, 40])('level %i: clock, counts, kit, no level-up on the first step, not ranked', (level) => {
    const st = newGame(4, 'auto', { difficulty: 'normal', startLevel: level });
    expect(st.level).toBe(level);
    expect(st.t).toBeCloseTo((level - 1) * MG.LEVEL_SECONDS, 9);
    expect(st.launcherCount).toBe(launcherCount(level));
    expect(st.streamCount).toBe(streamCount(level));
    expect(st.pulses).toBe(MG.PULSE_MAX);
    expect(st.seekerStock).toBe(MG.START_SEEKERS);
    expect(st.swarmStock).toBe(MG.START_SWARMS);
    expect(st.turrets.length).toBe(turretMax(level) - MG.START_SENTRIES_SHORT);
    expect(st.hp).toBe(MG.MAX_HP);
    expect(isRanked(st)).toBe(false);
    step(st, NO_INPUT, MG.DT);
    expect(st.level).toBe(level);
    expect(st.events.some((e) => e.type === 'levelup')).toBe(false);
  });
  it('a start below the sentry level gets no sentries', () => {
    const st = createState(1);
    start(st);
    setupStart(st, MG.TURRET_LEVEL - 1);
    expect(st.turrets.length).toBe(0);
  });
  it('difficulty and start level survive a save round-trip; an older save loads as NORMAL from level 1', () => {
    const st = newGame(6, 'auto', { difficulty: 'hard', startLevel: 20 });
    const back = deserialize(serialize(st));
    expect(back?.difficulty).toBe('hard');
    expect(back?.startLevel).toBe(20);
    const old: Record<string, unknown> = { ...toSaved(createState(6)) };
    delete old.difficulty;
    delete old.startLevel;
    const legacy = deserialize(JSON.stringify(old));
    expect(legacy?.difficulty).toBe('normal');
    expect(legacy?.startLevel).toBe(1);
    expect(deserialize(JSON.stringify({ ...old, difficulty: 'nightmare' }))).toBeNull();
  });
});

describe('skipped starts are the same game, later (IDEAS 31)', () => {
  it('pressure near the level ceiling, the moon worn down, and a short grace before the first rock', () => {
    const one = newGame(5, 'auto', { difficulty: 'normal', startLevel: 1 });
    expect(one.pressure).toBe(MG.PRESSURE_START);
    expect(one.moonHp).toBe(MG.MOON_HP);
    for (const level of [10, 20, 30, 40]) {
      const st = newGame(5, 'auto', { difficulty: 'normal', startLevel: level });
      expect(st.pressure).toBeCloseTo(MG.START_PRESSURE_FRAC * pressureMax(level), 9);
      expect(st.moonHp).toBe(MG.MOON_HP * (MG.START_MOON_FRAC[level] ?? 0));
      expect(st.spawnTimer).toBeGreaterThanOrEqual(MG.START_GRACE_S);
    }
  });
  it('a start level missing from START_MOON_FRAC interpolates instead of starting with no moon', () => {
    expect(startMoonFrac(1)).toBe(1);
    expect(startMoonFrac(10)).toBe(MG.START_MOON_FRAC[10]);
    const t10 = MG.START_MOON_FRAC[10] ?? 1;
    const t20 = MG.START_MOON_FRAC[20] ?? 0;
    expect(startMoonFrac(5)).toBeCloseTo(1 + ((t10 - 1) * 4) / 9, 9);
    expect(startMoonFrac(15)).toBeCloseTo((t10 + t20) / 2, 9);
    expect(startMoonFrac(5)).toBeGreaterThan(0.9);
    expect(startMoonFrac(99)).toBe(MG.START_MOON_FRAC[40]);
  });
});

describe('settings guard', () => {
  it('accepts every difficulty and start level the panel offers', () => {
    for (const difficulty of MG.DIFFICULTY_ORDER) for (const startLevel of MG.START_LEVELS) expect(isMinigameSettings({ difficulty, startLevel })).toBe(true);
    expect(isMinigameSettings(DEFAULT_SETTINGS)).toBe(true);
  });
  it('rejects anything else', () => {
    for (const bad of [null, undefined, 'normal', 3, [], {}, { difficulty: 'normal' }, { startLevel: 1 }, { difficulty: 'NORMAL', startLevel: 1 }, { difficulty: 'normal', startLevel: 15 }, { difficulty: 'normal', startLevel: '10' }, { difficulty: 'normal', startLevel: Number.NaN }]) {
      expect(isMinigameSettings(bad), JSON.stringify(bad)).toBe(false);
    }
  });
  it('cycling wraps and recovers from an unknown value', () => {
    expect(nextDifficulty('easy')).toBe('normal');
    expect(nextDifficulty('hard')).toBe('easy');
    expect(MG.START_LEVELS.map(nextStartLevel)).toEqual([10, 20, 30, 40, 1]);
    expect(nextStartLevel(7)).toBe(1);
  });
  it('replays carry an optional, guarded difficulty', () => {
    const r = { seed: 1, collision: 'auto', score: 5, rle: [4, 10] };
    expect(isSavedReplay(r)).toBe(true);
    expect(isSavedReplay({ ...r, difficulty: 'easy' })).toBe(true);
    expect(isSavedReplay({ ...r, difficulty: 'nope' })).toBe(false);
  });
});

describe('reduce motion', () => {
  it('turns the screen shake off', () => {
    expect(shakePx(0.1, 50, false)).toBeCloseTo(5, 12);
    expect(shakePx(0.1, 50, true)).toBe(0);
  });
});

describe('ready panel options and the SUPER DEMO (screen)', () => {
  class FakeKeys {
    private readonly edges = new Set<string>();
    private readonly down = new Set<string>();
    press(code: string): void {
      this.edges.add(code);
      this.down.add(code);
    }
    endFrame(): void {
      this.edges.clear();
      this.down.clear();
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
  function fakeStorage() {
    const m = new Map<string, string>();
    return {
      m,
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, String(v)),
      removeItem: (k: string) => void m.delete(k),
    };
  }
  const g = globalThis as { sessionStorage?: unknown; localStorage?: unknown };
  const tap = (keys: FakeKeys, screen: MinigameScreen, code: string): void => {
    keys.press(code);
    screen.update(16);
    keys.endFrame();
  };

  it('9 and 0 cycle the options, persist them, and the next game starts with them', () => {
    const local = fakeStorage();
    g.localStorage = local;
    g.sessionStorage = fakeStorage();
    try {
      const keys = new FakeKeys();
      const screen = new MinigameScreen({} as Surface, keys as unknown as Keys, { go() {} });
      screen.enter();
      expect(screen.options).toEqual(DEFAULT_SETTINGS);
      tap(keys, screen, 'Digit9'); // normal -> hard
      tap(keys, screen, 'Digit0'); // 1 -> 10
      expect(screen.options).toEqual({ difficulty: 'hard', startLevel: 10 });
      expect(JSON.parse(local.getItem(`missb.${SETTINGS_KEY}`) ?? 'null')).toEqual({ difficulty: 'hard', startLevel: 10 });
      tap(keys, screen, 'Space');
      expect(screen.state.status).toBe('playing');
      expect(screen.state.difficulty).toBe('hard');
      expect(screen.state.level).toBe(10);
      // A new screen reads the stored options back through the guard; a corrupt value falls back to the default.
      const again = new MinigameScreen({} as Surface, keys as unknown as Keys, { go() {} });
      expect(again.options).toEqual({ difficulty: 'hard', startLevel: 10 });
      local.setItem(`missb.${SETTINGS_KEY}`, JSON.stringify({ difficulty: 'hard', startLevel: 99 }));
      expect(new MinigameScreen({} as Surface, keys as unknown as Keys, { go() {} }).options).toEqual(DEFAULT_SETTINGS);
      expect(bestKey('normal')).toBe('minigame.best');
      expect(bestKey('hard')).toBe('minigame.best.hard');
    } finally {
      delete g.localStorage;
      delete g.sessionStorage;
    }
  });

  it('the game-over panel sets up the retry, and OPTIONS changes are picked up on entry', () => {
    const local = fakeStorage();
    g.localStorage = local;
    g.sessionStorage = fakeStorage();
    try {
      const keys = new FakeKeys();
      const screen = new MinigameScreen({} as Surface, keys as unknown as Keys, { go() {} });
      screen.enter();
      tap(keys, screen, 'Space');
      (screen.state as { status: string }).status = 'over';
      tap(keys, screen, 'Digit0'); // 1 -> 10, for the retry
      expect(screen.state.status).toBe('over');
      tap(keys, screen, 'Space');
      expect(screen.state.status).toBe('playing');
      expect(screen.state.level).toBe(10);
      // OPTIONS > PERIMETER writes the same key; the screen reads it again when it is entered.
      saveMinigameSettings({ difficulty: 'easy', startLevel: 20 });
      screen.enter();
      expect(screen.options).toEqual({ difficulty: 'easy', startLevel: 20 });
      expect(loadMinigameSettings()).toEqual({ difficulty: 'easy', startLevel: 20 });
    } finally {
      delete g.localStorage;
      delete g.sessionStorage;
    }
  });

  it('OPTIONS steps wrap both ways', () => {
    expect(stepStartLevel(1, -1)).toBe(40);
    expect(stepStartLevel(40, 1)).toBe(1);
    expect(stepDifficulty('easy', -1)).toBe('hard');
    expect(stepDifficulty('normal', 1)).toBe('hard');
  });

  it('8 starts the demo at DEMO_SPEED on NORMAL from level 1; it is not autosaved; any key ends it', () => {
    const session = fakeStorage();
    g.sessionStorage = session;
    g.localStorage = fakeStorage();
    try {
      const keys = new FakeKeys();
      const screen = new MinigameScreen({} as Surface, keys as unknown as Keys, { go() {} });
      screen.enter();
      tap(keys, screen, 'Digit9'); // the player's HARD choice does not apply to the demo
      tap(keys, screen, 'Digit8');
      expect(screen.demoOn).toBe(true);
      expect(screen.state.status).toBe('playing');
      expect(screen.state.difficulty).toBe('normal');
      expect(screen.state.startLevel).toBe(1);
      for (let i = 0; i < 600; i++) screen.update(16); // 9.6 s of real time
      expect(screen.state.t).toBeGreaterThan(9.6 * MG.DEMO_SPEED - 0.05);
      expect(screen.state.t).toBeLessThan(9.6 * MG.DEMO_SPEED + 0.05);
      expect(screen.state.shots).toBeGreaterThan(0); // the bot is firing through the normal step
      screen.exit();
      expect(session.m.size).toBe(0); // demo games are never autosaved
      tap(keys, screen, 'Digit1'); // the debug toggle keeps it running
      expect(screen.demoOn).toBe(true);
      tap(keys, screen, 'KeyQ');
      expect(screen.demoOn).toBe(false);
      expect(screen.state.status).toBe('ready');
    } finally {
      delete g.localStorage;
      delete g.sessionStorage;
    }
  });
});
