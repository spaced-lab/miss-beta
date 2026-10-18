// WHAT: Builds attract rounds for the title screen: in the planner worker when there is one, else inline.
// WHY:  Two reasonable implementations, one interface (CLAUDE.md). Measured 2026-10-18 (Chrome, Apple-silicon
//       laptop; `npm run bench` bench/attract.bench.ts in node: 250-335 ms, median 283): buildAttract costs
//       200-300 ms per round. INLINE ran it inside TitleScreen.enter(), before the first frame (boot to first
//       frame median 341 ms over 10 loads), and froze the menu again each time a round ended. WORKER: the main
//       thread only receives a structured clone (under 1 ms) and the first frame lands at a median 48 ms.
//       Picked: WORKER (the shared planner worker, no second thread and no duplicate worker bundle), with
//       INLINE as the fallback for node tests and browsers without module workers. docs/DECISIONS.md D4.
// HOW:  `build(seed)` returns a Promise. INLINE defers to a macrotask so the caller's frame is drawn first.
//       A failing worker is handled by PlannerClient, which re-runs the job inline.
// LORE: C1 (how the game is built)

import { sharedPlanner } from '../planner/workerClient';
import { buildAttract, type AttractRound } from './attract';

export type AttractMode = 'WORKER' | 'INLINE';

export class AttractBuilder {
  readonly mode: AttractMode;

  constructor(mode: AttractMode = typeof Worker !== 'undefined' ? 'WORKER' : 'INLINE') {
    this.mode = mode;
  }

  build(seed: string): Promise<AttractRound> {
    if (this.mode === 'WORKER') return sharedPlanner().attract(seed);
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          resolve(buildAttract(seed));
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      }, 0);
    });
  }
}
