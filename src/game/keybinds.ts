// WHAT: Assignable keys (owner 2026-10-18): the main game's actions, their default keys and the player's choices.
// WHY:  Function keys are awkward on Mac keyboards, so MANUAL moved from F1 to M; anyone who prefers F keys (or
//       any other key) rebinds in OPTIONS > KEYS. Screens keep asking for the default code; Input translates.
// HOW:  A binding is action -> KeyboardEvent.code. `remapFor` turns the bindings into a physical -> logical
//       table that is always a permutation (a rebinding is a swap; a chain of them a rotation), so no key is
//       ever lost. Saved as one validated localStorage record.
// LORE: G2 (screens and HUD)

import { loadJson, saveJson } from './persistence';

export interface KeyAction {
  readonly id: string;
  readonly label: string;
  /** The code the screens test for (logical code). */
  readonly def: string;
}

export const KEY_ACTIONS: readonly KeyAction[] = [
  { id: 'MANUAL', label: 'MANUAL', def: 'KeyM' },
  { id: 'LORE', label: 'LORE PANEL', def: 'Slash' },
  { id: 'LEARN', label: 'LEARNING CENTER', def: 'KeyL' },
  { id: 'PLANNER', label: 'PLANNER', def: 'KeyP' },
  { id: 'TECH', label: 'TECH TREE', def: 'KeyT' },
  { id: 'PROGRAMS', label: 'PROGRAMS', def: 'KeyG' },
  { id: 'PLANET', label: 'PLANET VIEW', def: 'KeyV' },
  { id: 'EVACUATE', label: 'EVACUATE', def: 'KeyE' },
  { id: 'PAUSE', label: 'PAUSE', def: 'Space' },
  { id: 'WARP_UP', label: 'WARP FASTER', def: 'BracketRight' },
  { id: 'WARP_DOWN', label: 'WARP SLOWER', def: 'BracketLeft' },
  { id: 'RESOLVE', label: 'RESOLVE NOW', def: 'KeyR' },
  { id: 'SCALE', label: 'SCALE', def: 'KeyS' },
  { id: 'TILT', label: 'TILT', def: 'KeyI' },
  { id: 'CONSOLE', label: 'CONSOLE', def: 'Backquote' },
  { id: 'AUTOPLAY', label: 'AUTOPLAY (WATCH)', def: 'KeyA' },
  { id: 'AUTO_SLOWER', label: 'AUTOPLAY SLOWER', def: 'Minus' },
  { id: 'AUTO_FASTER', label: 'AUTOPLAY FASTER', def: 'Equal' },
];

export type KeyBindings = Record<string, string>;

const KEY = 'keys';
const CODE_RE = /^(Key[A-Z]|Digit[0-9]|F([1-9]|1[0-2])|Numpad[0-9]|Space|Slash|Backquote|Bracket(Left|Right)|Minus|Equal|Semicolon|Quote|Comma|Period|Backslash)$/;

/** A key the player may bind (letters, digits, F1-F12 and the plain punctuation keys; never Escape or arrows). */
export function bindableCode(code: string): boolean {
  return CODE_RE.test(code);
}

export function isKeyBindings(v: unknown): v is KeyBindings {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  return Object.entries(v as Record<string, unknown>).every(([k, c]) => KEY_ACTIONS.some((a) => a.id === k) && typeof c === 'string' && bindableCode(c));
}

export function defaultBindings(): KeyBindings {
  return Object.fromEntries(KEY_ACTIONS.map((a) => [a.id, a.def]));
}

export function loadBindings(): KeyBindings {
  return { ...defaultBindings(), ...loadJson(KEY, isKeyBindings, {}) };
}

export function saveBindings(b: KeyBindings): void {
  saveJson(KEY, b);
}

/**
 * Bind `id` to `code`. Another action already on `code` takes this action's old key (a swap), so two actions
 * never share a key. Example: bind(MANUAL -> F1) on defaults leaves every other action where it was.
 */
export function bind(b: KeyBindings, id: string, code: string): KeyBindings {
  const out = { ...b };
  const old = out[id];
  const other = Object.keys(out).find((k) => k !== id && out[k] === code);
  if (other && old) out[other] = old;
  out[id] = code;
  return out;
}

/**
 * Physical -> logical code table, always a permutation. Each moved action's bound key reports its default code.
 * Each default key left free reports the code at the end of its chain of rebinds (the key whose own meaning was
 * taken), so every logical code keeps exactly one physical key. NOTE: the old rule paired a default key only
 * with its own action's new key, so after MANUAL -> X then PLANNER -> M nothing reported X and EXPORT was lost
 * (code review 2026-10-18). Example: MANUAL on F1 gives { F1: 'KeyM', KeyM: 'F1' }; then PLANNER on M gives
 * { F1: 'KeyM', KeyM: 'KeyP', KeyP: 'F1' }.
 */
export function remapFor(b: KeyBindings): Map<string, string> {
  const map = new Map<string, string>();
  /** default code -> the key its action is bound to now, for moved actions only */
  const movedTo = new Map<string, string>();
  for (const a of KEY_ACTIONS) {
    const code = b[a.id] ?? a.def;
    if (code === a.def) continue;
    map.set(code, a.def);
    movedTo.set(a.def, code);
  }
  for (const a of KEY_ACTIONS) {
    const start = movedTo.get(a.def);
    if (start === undefined || map.has(a.def)) continue;
    // a.def is a free physical key: walk the chain def -> bound key -> (that key's action's) bound key ... to the
    // first key that is no moved action's default; its meaning is the one with no key left.
    let c = start;
    for (let guard = 0; guard < KEY_ACTIONS.length; guard++) {
      const next = movedTo.get(c);
      if (next === undefined) break;
      c = next;
    }
    map.set(a.def, c);
  }
  return map;
}

/** Short on-screen name of a code: KeyM -> M, Digit3 -> 3, Slash -> ?, BracketRight -> ]. */
export function codeLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `NUM${code.slice(6)}`;
  const named: Record<string, string> = { Space: 'SPACE', Slash: '?', Backquote: '`', BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Backslash: '\\' };
  return named[code] ?? code.toUpperCase();
}

let current: KeyBindings = defaultBindings();
/** The live bindings (set at boot and by OPTIONS > KEYS); views read key names from here. */
export function setBindings(b: KeyBindings): void {
  current = b;
}
export function keyName(id: string): string {
  const a = KEY_ACTIONS.find((x) => x.id === id);
  return codeLabel(current[id] ?? a?.def ?? '');
}
