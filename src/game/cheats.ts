// WHAT: Cheat-code matcher: typed letters are checked against registered codes.
// WHY:  GAME_PLAN 22.2: codes are typed on the title screen or console, case-insensitive, and any code
//       flags the run ASSISTED. The codes are deliberately in the open source; reading how a cheat
//       changes one state field is a good first look at how the game is wired.
// HOW:  `CheatRegistry` holds (code, handler) pairs. Feed it the typed buffer every frame; when the
//       buffer ends with a code the handler fires once and the buffer is cleared so it cannot re-fire.
//       No eval, no string-to-function: a code is only ever a key into this table.
// LORE: G6 (modes, civilization levels and cheat codes)

export interface Cheat<T> {
  code: string;
  /** One line shown in the console / debug HUD when it fires. */
  message: string;
  apply: (target: T) => void;
}

export class CheatRegistry<T> {
  private readonly cheats: Cheat<T>[] = [];

  constructor(cheats: readonly Cheat<T>[] = []) {
    for (const c of cheats) this.register(c);
  }

  register(c: Cheat<T>): void {
    if (!/^[A-Z0-9]{3,16}$/.test(c.code)) throw new Error(`cheat code must be 3-16 upper-case alphanumerics: ${c.code}`);
    this.cheats.push(c);
  }

  list(): readonly Cheat<T>[] {
    return this.cheats;
  }

  /**
   * Check `typed` (upper-case tail of what the player typed) and apply the first matching code.
   * Returns the cheat that fired, or null. Longest codes are checked first so PULSE does not shadow PULSEX.
   */
  match(typed: string, target: T): Cheat<T> | null {
    const sorted = [...this.cheats].sort((a, b) => b.code.length - a.code.length);
    for (const c of sorted) {
      if (typed.endsWith(c.code)) {
        c.apply(target);
        return c;
      }
    }
    return null;
  }
}
