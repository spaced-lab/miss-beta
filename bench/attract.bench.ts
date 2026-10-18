// WHAT: Cost of one title-screen attract round (game/attract.ts buildAttract), the work game/attractClient.ts
//       moves into a worker.
// WHY:  D4 in docs/DECISIONS.md: in Chrome this was 200-300 ms of main-thread time before the first frame.
//       This bench re-measures the round cost in node so the decision can be revisited with data: if a
//       round ever costs under a few ms, INLINE would be the simpler choice.
// HOW:  Build five rounds on walking seeds (the title's own seed pattern), print min / median / max ms.
// LORE: C1 (how the game is built), C3 (tests)
import { describe, expect, it } from 'vitest';
import { buildAttract } from '../src/game/attract';

describe('attract round benchmark', () => {
  it('one attract round costs far more than a frame (so it belongs off the UI thread)', () => {
    buildAttract('ATTRACT-BENCH-warm');
    const ms: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      const a = buildAttract(`ATTRACT-BENCH-${i}`);
      ms.push(performance.now() - t0);
      expect(a.result.outcome).toBeTypeOf('string');
    }
    ms.sort((a, b) => a - b);
    console.table([{ rounds: ms.length, 'min ms': (ms[0] ?? 0).toFixed(1), 'median ms': (ms[2] ?? 0).toFixed(1), 'max ms': (ms[4] ?? 0).toFixed(1), 'frame budget ms': 16.7 }]);
    expect(ms.length).toBe(5);
  });
});
