// WHAT: Main-thread client for the planner worker, with a synchronous fallback.
// WHY:  Screens ask for a grid and get a Promise; they never touch postMessage. When Workers are
//       unavailable (tests, very old browsers) the same job runs inline.
// HOW:  Vite builds the worker from the `new URL(..., import.meta.url)` form. Replies are matched by id.
// LORE: C1 (how the game is built)

import type { Mission } from '../sim/mission';
import type { World } from '../sim/world';
import { runJob, type MonteCarloJob, type PorkchopJob, type WorkerReply } from '../worker/planner.worker';
import type { MonteCarloResult } from './monteCarlo';
import type { PorkchopGrid } from './porkchop';

export class PlannerClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, (r: WorkerReply) => void>();

  constructor() {
    if (typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(new URL('../worker/planner.worker.ts', import.meta.url), { type: 'module' });
        this.worker.onmessage = (e: MessageEvent<WorkerReply>): void => {
          const p = this.pending.get(e.data.id);
          if (p) {
            this.pending.delete(e.data.id);
            p(e.data);
          }
        };
        this.worker.onerror = (): void => {
          // NOTE: fall back for the rest of the session; pending jobs are re-run inline by their handlers.
          this.worker = null;
          for (const [id, p] of this.pending) {
            this.pending.delete(id);
            p({ id, type: 'error', message: 'worker failed' });
          }
        };
      } catch {
        this.worker = null;
      }
    }
  }

  private submit<T>(full: PorkchopJob | MonteCarloJob, unwrap: (r: WorkerReply) => T): Promise<T> {
    if (!this.worker) return Promise.resolve(unwrap(runJob(full)));
    return new Promise((resolve, reject) => {
      this.pending.set(full.id, (r) => {
        try {
          resolve(r.type === 'error' ? unwrap(runJob(full)) : unwrap(r));
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      });
      this.worker?.postMessage(full);
    });
  }

  porkchop(job: Omit<PorkchopJob, 'id' | 'type'>): Promise<PorkchopGrid> {
    const full: PorkchopJob = { id: this.nextId++, type: 'porkchop', ...job };
    return this.submit(full, (r) => {
      if (r.type !== 'porkchop') throw new Error(r.type === 'error' ? r.message : 'wrong reply');
      return r.grid;
    });
  }

  monteCarlo(world: World, missions: readonly Mission[], n: number): Promise<MonteCarloResult> {
    const full: MonteCarloJob = { id: this.nextId++, type: 'montecarlo', world, missions: [...missions], n };
    return this.submit(full, (r) => {
      if (r.type !== 'montecarlo') throw new Error(r.type === 'error' ? r.message : 'wrong reply');
      return r.result;
    });
  }
}
