// WHAT: PERIMETER's saved run options (difficulty and start level): the type, its guard, the storage key and the
//       load / save / step helpers.
// WHY:  Owner 2026-10-18: the skip-to-level menu was hard to find. The options now show on the ready panel, the
//       game-over panel and the main OPTIONS screen, which must not pull the arcade simulation into the main bundle,
//       so this module depends only on config.ts and persistence.
// HOW:  One small object under one localStorage key, read through a type guard; steps wrap in both directions.
// LORE: G1 (how to play), G6 (modes and cheat codes)

import { loadJson, saveJson } from '../game/persistence';
import { MG, type Difficulty } from './config';

/** What the ready panel remembers between sessions. */
export interface MinigameSettings {
  difficulty: Difficulty;
  startLevel: number;
}

export const SETTINGS_KEY = 'minigame.settings';

export const DEFAULT_SETTINGS: Readonly<MinigameSettings> = Object.freeze({ difficulty: MG.DIFFICULTY_DEFAULT, startLevel: 1 });

/** Type guard for the stored settings: a known difficulty and a start level from MG.START_LEVELS, nothing else trusted. */
export const isMinigameSettings = (v: unknown): v is MinigameSettings => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return (MG.DIFFICULTY_ORDER as readonly unknown[]).includes(o.difficulty) && typeof o.startLevel === 'number' && MG.START_LEVELS.includes(o.startLevel);
};

/** The entry `dir` steps from `cur` in a list, wrapping; the first entry when `cur` is not in it. */
function stepOf<T>(list: readonly T[], cur: T, dir: number): T {
  const i = list.indexOf(cur);
  if (i < 0) return list[0] ?? cur;
  return list[(((i + dir) % list.length) + list.length) % list.length] ?? cur;
}

/** Example: stepDifficulty('hard', 1) = 'easy'; stepDifficulty('normal', -1) = 'easy'. */
export const stepDifficulty = (d: Difficulty, dir: number): Difficulty => stepOf(MG.DIFFICULTY_ORDER, d, dir);
/** Example: stepStartLevel(40, 1) = 1; stepStartLevel(1, -1) = 40. */
export const stepStartLevel = (level: number, dir: number): number => stepOf(MG.START_LEVELS, level, dir);
export const nextDifficulty = (d: Difficulty): Difficulty => stepDifficulty(d, 1);
export const nextStartLevel = (level: number): number => stepStartLevel(level, 1);

export const loadMinigameSettings = (): MinigameSettings => loadJson(SETTINGS_KEY, isMinigameSettings, { ...DEFAULT_SETTINGS });
export const saveMinigameSettings = (s: MinigameSettings): boolean => saveJson(SETTINGS_KEY, s);
