// WHAT: The one LoreStore the screens share, plus reading progress and bookmarks in localStorage.
// WHY:  GAME_PLAN 23: progress is "highest level read per topic"; bookmarks are a small id list. The store
//       is created at boot but fetches nothing until a panel opens (a runtime test asserts it).
// HOW:  Validated records via persistence.ts; SAVE.md carries a copy of `lore_read` (savegame.ts).
// LORE: C1

import { loadJson, saveJson } from '../game/persistence';
import { isProgress, LEVELS, LoreStore, markRead, type Level } from './index';

export const lore = new LoreStore();

const PROGRESS_KEY = 'lore.progress';
const BOOKMARK_KEY = 'lore.bookmarks';

export const progress: Record<string, string> = loadJson(PROGRESS_KEY, isProgress, {});
export const bookmarks: string[] = loadJson(BOOKMARK_KEY, (v): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string'), []);

export function recordRead(id: string, level: Level): void {
  if (markRead(progress, id, level)) saveJson(PROGRESS_KEY, progress);
}

export function toggleBookmark(id: string): boolean {
  const i = bookmarks.indexOf(id);
  if (i >= 0) bookmarks.splice(i, 1);
  else bookmarks.push(id);
  saveJson(BOOKMARK_KEY, bookmarks);
  return i < 0;
}

/** Merge progress from a SAVE.md (never lowers a level). */
export function mergeProgress(from: Record<string, string>): void {
  let changed = false;
  // NOTE: SAVE.md is hand-editable; a level name that is not valid is skipped, or isProgress would reject the
  // whole record on the next boot and every topic's progress would be lost.
  for (const [id, lv] of Object.entries(from)) {
    if ((LEVELS as readonly string[]).includes(lv) && markRead(progress, id, lv as Level)) changed = true;
  }
  if (changed) saveJson(PROGRESS_KEY, progress);
}
