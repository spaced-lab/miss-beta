// WHAT: Local leaderboard (GAME_PLAN 12): top 20 runs per mode in localStorage, validated on read.
// WHY:  Runs are comparable because they are seeded; the board stores the seed so a run can be replayed.
// HOW:  One JSON array per mode under `missb.leaderboard.<MODE>`. Every entry is checked by a type guard;
//       anything malformed is dropped rather than crashing (docs/WARNINGS.md item 3).
// LORE: G5 (scoring), G6 (modes)

import { loadJson, saveJson } from './persistence';

export type Mode = 'REALISTIC' | 'SCIFI' | 'FICTION';

export interface LeaderboardEntry {
  handle: string;
  rounds: number;
  score: number;
  seed: string;
  date: string;
  tech: string;
  assisted: boolean;
  /** Played with OPTIONS INTERSTELLAR RATE above REAL (optional: older entries have none). */
  exaggerated?: boolean;
}

const MAX = 20;

function isEntry(v: unknown): v is LeaderboardEntry {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o['handle'] === 'string' && o['handle'].length <= 24 && Number.isInteger(o['rounds']) && Number.isFinite(o['score']) &&
    typeof o['seed'] === 'string' && o['seed'].length <= 32 && typeof o['date'] === 'string' && typeof o['tech'] === 'string' && typeof o['assisted'] === 'boolean' && (o['exaggerated'] === undefined || typeof o['exaggerated'] === 'boolean');
}

/**
 * The stored board with each malformed entry dropped. NOTE: one bad entry used to reject the whole board, and the
 * next recordRun then saved only the new run over it, deleting every valid entry (code review 2026-10-18).
 */
export function loadBoard(mode: Mode = 'REALISTIC'): LeaderboardEntry[] {
  return loadJson<unknown[]>(`leaderboard.${mode}`, (v): v is unknown[] => Array.isArray(v), []).filter(isEntry);
}

/** Insert, sort by score desc, trim to MAX, save. Returns the entry's rank (1-based) or -1 if it fell off. */
export function recordRun(entry: LeaderboardEntry, mode: Mode = 'REALISTIC'): number {
  const board = loadBoard(mode);
  board.push(entry);
  board.sort((a, b) => b.score - a.score || b.rounds - a.rounds);
  const trimmed = board.slice(0, MAX);
  saveJson(`leaderboard.${mode}`, trimmed);
  const rank = trimmed.indexOf(entry);
  return rank < 0 ? -1 : rank + 1;
}
