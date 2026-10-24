// WHAT: PERIMETER run options: difficulty level, start level and the LEVEL TURN switch, their saved settings and the start-level kit.
// WHY:  The owner asked for difficulty levels and "skip to round 10, 20, 30 or 40" from the menu. Both are pure
//       state setup, so they live here with tests (tests/minigameModes.test.ts) and index.ts only wires keys to them.
// HOW:  Difficulty is a key into MG.DIFFICULTY; sim.ts reads its multipliers at spawn and on impact. A start level N
//       moves the clock to the start of level N (levelAt(t) = N, so no level-up fires), sets the level-derived counts
//       directly (no LAUNCHERS / STREAMS flashes on the first step) and grants the kit a typical run carries there
//       (config.ts START_*). The settings are one small object under one localStorage key, read through a type guard.
// LORE: G1 (how to play), G6 (modes and cheat codes)

import type { CollisionStrategy } from './collision';
import { MG, type Difficulty } from './config';
import { createState, deployTurret, flash, launcherCount, pressureMax, seekerMax, start, streamCount, swarmMax, turretMax, type MinigameState } from './sim';

export { DEFAULT_SETTINGS, isMinigameSettings, levelTurnOf, nextDifficulty, nextStartLevel, type MinigameSettings } from './prefs';
import { levelTurnOf, type MinigameSettings } from './prefs';

/**
 * Moon health at the start of `level` as a fraction of MOON_HP: MG.START_MOON_FRAC, linear between its levels, full at
 * level 1 and the last entry's value past it, so a start level added to MG.START_LEVELS without a table entry never
 * begins with the moon already gone. Example: with { 10: 0.9, 20: 0.1 }, level 15 gives 0.5 and level 5 gives 0.96.
 */
export function startMoonFrac(level: number): number {
  if (level <= 1) return 1;
  const pts: [number, number][] = [[1, 1], ...Object.entries(MG.START_MOON_FRAC).map(([k, v]): [number, number] => [Number(k), v])];
  pts.sort((a, b) => a[0] - b[0]);
  let prev = pts[0] ?? [1, 1];
  for (const p of pts) {
    if (level === p[0]) return p[1];
    if (level < p[0]) return prev[1] + ((p[1] - prev[1]) * (level - prev[0])) / (p[0] - prev[0]);
    prev = p;
  }
  return prev[1];
}

/**
 * Put a fresh 'playing' state at the start of `level` with a typical run's kit. Example: level 20 gives t = 323 s
 * (19 x 17), 4 launchers, 5 streams, 3 pulses, 1 seeker, 1 swarm and turretMax(20) - 1 = 4 sentries. Level 1 is a no-op.
 */
export function setupStart(st: MinigameState, level: number): void {
  if (level <= 1) return;
  st.t = (level - 1) * MG.LEVEL_SECONDS;
  st.level = level;
  st.startLevel = level;
  st.launcherCount = launcherCount(level);
  st.streamCount = streamCount(level);
  st.pulses = MG.PULSE_MAX;
  st.seekerStock = Math.min(seekerMax(level), MG.START_SEEKERS);
  st.swarmStock = Math.min(swarmMax(level), MG.START_SWARMS);
  if (level >= MG.TURRET_LEVEL) {
    const n = Math.max(0, turretMax(level) - MG.START_SENTRIES_SHORT);
    for (let k = 0; k < n; k++) deployTurret(st, false);
  }
  st.pressure = Math.max(MG.PRESSURE_START, MG.START_PRESSURE_FRAC * pressureMax(level));
  st.moonHp = MG.MOON_HP * startMoonFrac(level);
  st.spawnTimer = Math.max(st.spawnTimer, MG.START_GRACE_S);
  st.flashes.length = 0;
  flash(st, `LEVEL ${level} START`, 2);
}

/** A new game, started, at a difficulty and start level. Draw order: createState's draws, then setupStart's sentries. */
export function newGame(seed: number, collision: CollisionStrategy, settings: Readonly<MinigameSettings>): MinigameState {
  const st = createState(seed, collision, settings.difficulty, levelTurnOf(settings));
  start(st);
  setupStart(st, settings.startLevel);
  return st;
}

/** A run that may go on the best-score table: unassisted, from level 1. Difficulty has its own table (index.ts). */
export const isRanked = (st: Readonly<MinigameState>): boolean => !st.cheats.assisted && st.startLevel <= 1;
