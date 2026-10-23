// WHAT: LazyScreen: a Screen that stands in for one whose code is fetched on first use (dynamic import).
// WHY:  Boot cost. PERIMETER, the Learning Center and the SUPER-DUPER-DEMO are a large share of the bundle
//       and are not needed to draw the title; splitting them off shrinks the chunk every visitor parses
//       before the first frame (docs/DECISIONS.md, D1). The router and the callbacks keep working unchanged.
// HOW:  `load()` is a thunk around `import('./x')` (a same-origin chunk, CSP script-src 'self'). The first
//       enter() starts the load; `with(fn)` runs fn on the real screen now if it is loaded, or queues it to
//       run in call order the moment it arrives (so `with(c => c.openTopic(id))` then `router.go(...)` acts
//       exactly as before). Until then render() draws a one-line LOADING notice; if the fetch fails (an old
//       tab after a redeploy, offline) it says so and Esc returns to the title. `target` is the loaded screen
//       or null; the dev hook window.__miss.screens.get(id) unwraps to it.
// LORE: C1 (how the game is built)

import type { Router, Screen, ScreenId } from './screen';
import type { Surface } from '../render/canvas';
import { drawText } from '../render/vectorFont';
import type { GearSpec } from '../ui/gearMenu';
import type { Input } from '../ui/input';

export class LazyScreen<T extends Screen> implements Screen {
  /** The real screen once loaded, else null. */
  target: T | null = null;
  private loading: Promise<T> | null = null;
  private queue: ((t: T) => void)[] = [];
  private active = false;
  private failed = false;

  constructor(
    private readonly label: string,
    private readonly load: () => Promise<T>,
    private readonly s: Surface,
    private readonly keys: Input,
    private readonly router: Router,
    private readonly fallback: ScreenId = 'title',
  ) {}

  /** Start fetching (idempotent while in flight or done; retried after a failure). Resolves with the real screen. */
  ready(): Promise<T> {
    if (!this.loading) {
      this.failed = false;
      const p = this.load().then(
        (t) => {
          this.target = t;
          const q = this.queue;
          this.queue = [];
          for (const fn of q) fn(t);
          return t;
        },
        (err: unknown) => {
          this.failed = true;
          this.loading = null;
          console.warn(`[lazy] ${this.label} failed to load`, err);
          throw err;
        },
      );
      // The failure is shown on screen; never leave an unhandled rejection behind.
      p.catch(() => undefined);
      this.loading = p;
    }
    return this.loading;
  }

  /** Run fn on the real screen: now if loaded, else in call order as soon as it loads. */
  with(fn: (t: T) => void): void {
    if (this.target) fn(this.target);
    else {
      this.queue.push(fn);
      this.ready().catch(() => undefined);
    }
  }

  enter(): void {
    this.active = true;
    // Queued after any with() the opener issued before go(), so state set by the opener lands first.
    this.with((t) => {
      if (this.active) t.enter();
    });
  }

  exit(): void {
    if (this.active && this.target) this.target.exit();
    this.active = false;
  }

  update(dtMs: number): void {
    if (this.target) this.target.update(dtMs);
    else if (this.failed && this.keys.pressed('Escape')) this.router.go(this.fallback);
  }

  gear(): GearSpec | null {
    return this.target?.gear?.() ?? null;
  }

  render(): void {
    if (this.target) {
      this.target.render();
      return;
    }
    const s = this.s;
    s.clear();
    const msg = this.failed ? `${this.label} FAILED TO LOAD: REFRESH THE PAGE   (ESC: BACK)` : `LOADING ${this.label}`;
    drawText(s, msg, s.width / 2, s.height / 2, 11, { align: 'center', color: this.failed ? s.palette.hot : s.palette.dim, glow: 1 });
  }
}
