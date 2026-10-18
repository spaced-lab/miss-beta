// WHAT: The Screen interface and the minimal state machine that swaps screens.
// WHY:  GAME_PLAN 13 lists twelve screens. Each is a module with the same four hooks, so main.ts stays a
//       few lines and screens never know about each other except through `go()`.
// HOW:  `update` runs with real elapsed milliseconds; screens with fixed-step sims accumulate internally.
// LORE: C1 (how the game is built)

export interface Screen {
  enter(): void;
  exit(): void;
  update(dtMs: number): void;
  render(): void;
}

export type ScreenId = 'title' | 'minigame' | 'system' | 'leaderboard' | 'codex';

export interface Router {
  go(id: ScreenId): void;
}
