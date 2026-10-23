// WHAT: The Screen interface and the minimal state machine that swaps screens.
// WHY:  GAME_PLAN 13 lists twelve screens. Each is a module with the same four hooks, so main.ts stays a
//       few lines and screens never know about each other except through `go()`.
// HOW:  `update` runs with real elapsed milliseconds; screens with fixed-step sims accumulate internally.
// LORE: C1 (how the game is built)

import type { GearSpec } from '../ui/gearMenu';

export interface Screen {
  enter(): void;
  exit(): void;
  update(dtMs: number): void;
  render(): void;
  /** Every action of the screen for the GEAR menu (ui/gearMenu.ts), or null for no gear this frame. */
  gear?(): GearSpec | null;
}

export type ScreenId = 'title' | 'minigame' | 'system' | 'leaderboard' | 'codex' | 'help' | 'options' | 'center' | 'demo';

export interface Router {
  go(id: ScreenId): void;
}

const DEEP_LINKS: readonly ScreenId[] = ['minigame', 'system', 'leaderboard', 'codex', 'help', 'options', 'center'];

/**
 * The first screen for a URL hash. Until the photosensitivity notice is acknowledged every boot lands on the
 * title, which shows it (docs/WARNINGS.md 8). bootScreen('minigame', true) -> 'minigame';
 * bootScreen('minigame', false) -> 'title'; bootScreen('evil', true) -> 'title'.
 */
export function bootScreen(hash: string, photoAck: boolean): ScreenId {
  if (!photoAck) return 'title';
  return (DEEP_LINKS as readonly string[]).includes(hash) ? (hash as ScreenId) : 'title';
}
