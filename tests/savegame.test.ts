import { describe, expect, it } from 'vitest';
import { createEconomy } from '../src/game/economy';
import { createRun } from '../src/game/run';
import { loadRun, renderAfterRound, storeSave } from '../src/game/savegame';

function fakeStorage(): { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void; removeItem: (k: string) => void } {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k) };
}
const g = globalThis as { localStorage?: unknown };

describe('the debrief autosave (code review 2026-10-18 finding 19)', () => {
  it('saves the start of the next round, so CONTINUE cannot replay a scored round', () => {
    g.localStorage = fakeStorage();
    try {
      const run = createRun('DEBRIEF-1');
      run.round = 4;
      run.roundsSurvived = 3;
      run.score = 1500; // round 4's score already banked, as at the debrief
      run.economy = createEconomy(10, 8);
      expect(storeSave(renderAfterRound(run, 22.5))).toBe(true);
      // The live run is untouched; the save is round 5 with the same score and the budget banked.
      expect(run.round).toBe(4);
      expect(run.roundsSurvived).toBe(3);
      const back = loadRun();
      expect(back?.round).toBe(5);
      expect(back?.roundsSurvived).toBe(4);
      expect(back?.score).toBe(1500);
      expect(back?.economy.start).toBe(22.5);
    } finally {
      delete g.localStorage;
    }
  });
});
