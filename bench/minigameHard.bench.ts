// WHAT: PERIMETER balance probe, HARD (bench/mgProbe.ts): seeds 1..4 from every start level, 900 s cap.
// WHY:  IDEAS 31: the difficulty table in docs/MINIGAME_BACKLOG.md is re-measured after any balance knob change.
// HOW:  npm run bench -- bench/minigameHard.bench.ts (about 4 minutes; the three difficulties run in parallel).
// LORE: C3 (tests)
import { describe, expect, it } from 'vitest';
import { probe, report } from './mgProbe';

describe('PERIMETER balance probe', () => {
  it('hard', { timeout: 900_000 }, async () => {
    const cells = probe('hard');
    await report('hard', cells);
    expect(cells.length).toBe(5);
  });
});
