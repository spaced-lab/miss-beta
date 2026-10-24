// WHAT: PERIMETER's saved run options (difficulty, start level, the LEVEL TURN switch): the type, its guard, the
//       storage key and the load / save / step helpers.
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
  /** LEVEL TURN (config LASER_AUTO_*): automatic laser pulses and a full turn at every level-up from level 25. Owner's
   *  switch (2026-10-24). Absent in settings saved before it: on. */
  levelTurn?: boolean;
}

export const SETTINGS_KEY = 'minigame.settings';

export const DEFAULT_SETTINGS: Readonly<MinigameSettings> = Object.freeze({ difficulty: MG.DIFFICULTY_DEFAULT, startLevel: 1, levelTurn: true });

/** Type guard for the stored settings: a known difficulty, a start level from MG.START_LEVELS and, if present, a boolean
 *  LEVEL TURN switch; nothing else trusted. */
export const isMinigameSettings = (v: unknown): v is MinigameSettings => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return (
    (MG.DIFFICULTY_ORDER as readonly unknown[]).includes(o.difficulty) &&
    typeof o.startLevel === 'number' &&
    MG.START_LEVELS.includes(o.startLevel) &&
    (o.levelTurn === undefined || typeof o.levelTurn === 'boolean')
  );
};

/** The LEVEL TURN switch of a settings record: on unless it says false. */
export const levelTurnOf = (s: Readonly<MinigameSettings>): boolean => s.levelTurn !== false;

/** The entry `dir` steps from `cur` in a list, wrapping; the first entry when `cur` is not in it. */
function stepOf<T>(list: readonly T[], cur: T, dir: number): T {
  const i = list.indexOf(cur);
  if (i < 0) return list[0] ?? cur;
  return list[(((i + dir) % list.length) + list.length) % list.length] ?? cur;
}

/** Example: stepDifficulty('hard', 1) = 'easy'; stepDifficulty('normal', -1) = 'easy'. */
export const stepDifficulty = (d: Difficulty, dir: number): Difficulty => stepOf(MG.DIFFICULTY_ORDER, d, dir);
/** Example: stepStartLevel(60, 1) = 1; stepStartLevel(1, -1) = 60. */
export const stepStartLevel = (level: number, dir: number): number => stepOf(MG.START_LEVELS, level, dir);
export const nextDifficulty = (d: Difficulty): Difficulty => stepDifficulty(d, 1);
export const nextStartLevel = (level: number): number => stepStartLevel(level, 1);

export const loadMinigameSettings = (): MinigameSettings => ({ ...DEFAULT_SETTINGS, ...loadJson(SETTINGS_KEY, isMinigameSettings, { ...DEFAULT_SETTINGS }) });
export const saveMinigameSettings = (s: MinigameSettings): boolean => saveJson(SETTINGS_KEY, s);
