// WHAT: Small, validated wrappers over localStorage (lasting) and sessionStorage (one tab, survives reloads).
// WHY:  Anything read back from storage is untrusted input (another tab, an extension, a hand edit).
//       Every read is parsed defensively and falls back to a default; every write is wrapped so a full
//       or disabled storage (private mode) never crashes the game.
// HOW:  Keys are namespaced with `missb.`. Values are JSON. Readers pass a type guard. The session
//       variants exist for in-progress games: the dev server reloads the page on every source change and
//       sessionStorage is exactly the scope that survives that and nothing else.
// LORE: G5 (scoring), C2 (reading the code)

const PREFIX = 'missb.';

export function loadJson<T>(key: string, guard: (v: unknown) => v is T, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(PREFIX + key);
    if (raw === null || raw === undefined) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return guard(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown): boolean {
  try {
    globalThis.localStorage?.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function loadNumber(key: string, fallback = 0): number {
  return loadJson(key, isFiniteNumber, fallback);
}

/** Like loadJson but from sessionStorage. A guard failure or a parse error both return the fallback. */
export function loadSessionJson<T>(key: string, guard: (v: unknown) => v is T, fallback: T): T {
  try {
    const raw = globalThis.sessionStorage?.getItem(PREFIX + key);
    if (raw === null || raw === undefined) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return guard(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function saveSessionJson(key: string, value: unknown): boolean {
  try {
    globalThis.sessionStorage?.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeSessionJson(key: string): void {
  try {
    globalThis.sessionStorage?.removeItem(PREFIX + key);
  } catch {
    // storage disabled: nothing to remove
  }
}
