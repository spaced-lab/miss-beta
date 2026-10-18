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

describe('leaderboard (code review 2026-10-18 finding 23)', () => {
  it('one malformed entry is dropped; the valid ones survive the next recorded run', async () => {
    const { loadBoard, recordRun } = await import('../src/game/leaderboard');
    const local = fakeStorage();
    g.localStorage = local;
    try {
      const ok = (score: number): Record<string, unknown> => ({ handle: 'P', rounds: 3, score, seed: 'S', date: '2026-10-18', tech: 'L1 I1', assisted: false });
      local.setItem('missb.leaderboard.REALISTIC', JSON.stringify([ok(900), { ...ok(800), handle: 'X'.repeat(40) }, ok(700), 'junk']));
      expect(loadBoard().map((e) => e.score)).toEqual([900, 700]);
      recordRun({ handle: 'NEW', rounds: 1, score: 100, seed: 'T', date: '2026-10-18', tech: 'L1 I1', assisted: false });
      expect(loadBoard().map((e) => e.score)).toEqual([900, 700, 100]);
      // Not an array at all: an empty board, as before.
      local.setItem('missb.leaderboard.REALISTIC', '{"a":1}');
      expect(loadBoard()).toEqual([]);
    } finally {
      delete g.localStorage;
    }
  });
});
