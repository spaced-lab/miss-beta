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
}

const MAX = 20;

function isEntry(v: unknown): v is LeaderboardEntry {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o['handle'] === 'string' && o['handle'].length <= 24 && Number.isInteger(o['rounds']) && Number.isFinite(o['score']) &&
    typeof o['seed'] === 'string' && o['seed'].length <= 32 && typeof o['date'] === 'string' && typeof o['tech'] === 'string' && typeof o['assisted'] === 'boolean';
}

function isBoard(v: unknown): v is LeaderboardEntry[] {
  return Array.isArray(v) && v.every(isEntry);
}

export function loadBoard(mode: Mode = 'REALISTIC'): LeaderboardEntry[] {
  return loadJson(`leaderboard.${mode}`, isBoard, []);
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
