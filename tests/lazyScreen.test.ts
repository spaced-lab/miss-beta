// WHAT: LazyScreen (code-split screens) and the planner worker's attract job, run inline in node.
// WHY:  D1 and D4 in docs/DECISIONS.md: splitting screens and moving the attract round must not change
//       behaviour. The opener's state (returnTo, openTopic) must land before enter(), in call order.
// HOW:  A fake screen records calls; the loader is a promise we resolve by hand.
// LORE: C1 (how the game is built), C3 (tests)
import { describe, expect, it } from 'vitest';
import { LazyScreen } from '../src/game/lazyScreen';
import type { Router, Screen } from '../src/game/screen';
import type { Surface } from '../src/render/canvas';
import type { Input } from '../src/ui/input';
import { buildAttract } from '../src/game/attract';
import { runJob } from '../src/worker/planner.worker';

class Fake implements Screen {
  log: string[] = [];
  topic = '';
  enter(): void {
    this.log.push(`enter:${this.topic}`);
  }
  exit(): void {
    this.log.push('exit');
  }
  update(): void {
    this.log.push('update');
  }
  render(): void {
    this.log.push('render');
  }
}

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
const keys = { pressed: () => false } as unknown as Input;
const router: Router = { go() {} };

describe('LazyScreen', () => {
  it('queues opener state before enter and forwards once loaded', async () => {
    let resolve: (f: Fake) => void = () => undefined;
    const lazy = new LazyScreen<Fake>('X', () => new Promise<Fake>((r) => (resolve = r)), {} as Surface, keys, router);
    lazy.with((f) => (f.topic = 'O10'));
    lazy.enter();
    lazy.update(16);
    expect(lazy.target).toBeNull();
    const real = new Fake();
    resolve(real);
    await tick();
    expect(lazy.target).toBe(real);
    expect(real.log).toEqual(['enter:O10']);
    lazy.update(16);
    lazy.render();
    lazy.with((f) => (f.topic = 'now'));
    expect(real.topic).toBe('now');
    lazy.exit();
    expect(real.log).toEqual(['enter:O10', 'update', 'render', 'exit']);
  });

  it('does not enter a screen the player already left while it loaded', async () => {
    const real = new Fake();
    const lazy = new LazyScreen<Fake>('X', () => Promise.resolve(real), {} as Surface, keys, router);
    lazy.enter();
    lazy.exit();
    await tick();
    expect(real.log).toEqual([]);
  });

  it('a failed load can be retried', async () => {
    let n = 0;
    const real = new Fake();
    const lazy = new LazyScreen<Fake>('X', () => (n++ === 0 ? Promise.reject(new Error('offline')) : Promise.resolve(real)), {} as Surface, keys, router);
    await expect(lazy.ready()).rejects.toThrow('offline');
    await expect(lazy.ready()).resolves.toBe(real);
  });
});

describe('planner worker attract job', () => {
  it('returns the same round as the inline builder, and refuses a bad job', () => {
    const r = runJob({ id: 3, type: 'attract', seed: 'ATTRACT-TEST-0' });
    expect(r.type).toBe('attract');
    if (r.type !== 'attract') return;
    const inline = buildAttract('ATTRACT-TEST-0');
    expect(r.round.result.outcome).toBe(inline.result.outcome);
    expect(r.round.result.ca.tCa).toBe(inline.result.ca.tCa);
    expect(JSON.stringify(structuredClone(r.round).missions)).toBe(JSON.stringify(inline.missions));
    expect(runJob({ id: 4, type: 'attract', seed: 42 } as unknown as Parameters<typeof runJob>[0]).type).toBe('error');
  });
});
