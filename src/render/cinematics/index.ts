// WHAT: The cinematics player: a queue of scenes, one playing, any key skips, a hit callback for sound.
// WHY:  GAME_PLAN 29: when an event passes on the clock the clock pauses and the event is shown, then
//       the warp that was running resumes. The system view owns one of these and stops advancing time
//       while `isOpen`.
// HOW:  `enqueue` groups the frame's events (scene.ts) and builds their scenes; `update` advances the
//       current scene, fires `onHit` once when the hit moment passes (the thud), and moves on at the end
//       or on a key. Under reduce-motion every scene lasts CINEMATIC_FLASH_S as a still frame.
// LORE: G2 (screens and HUD), G8 (the look)

import { KNOBS } from '../../config/knobs';
import type { SimEventRecord } from '../../sim/eventLog';
import type { Surface } from '../canvas';
import { renderScene } from './draw';
import { buildScene, groupEvents, type CineContext, type Scene } from './scene';

export class Cinematics {
  private queue: Scene[] = [];
  private cur: Scene | null = null;
  private elapsed = 0;
  private hitFired = false;
  /** Push methods already shown this round: a DE-STAR firing eight windows plays its scene once. */
  private shownPush = new Set<string>();
  /** Fired once per scene at its hit moment (or at the start for a launch). */
  onHit: ((scene: Scene) => void) | null = null;

  constructor(
    private readonly s: Surface,
    private readonly reduceMotion: () => boolean,
  ) {}

  get isOpen(): boolean {
    return this.cur !== null;
  }

  get current(): Scene | null {
    return this.cur;
  }

  clear(): void {
    this.queue = [];
    this.cur = null;
    this.shownPush.clear();
  }

  /** Queue scenes for the events that passed this frame. Returns how many scenes were added. */
  enqueue(events: readonly SimEventRecord[], ctx: CineContext): number {
    let n = 0;
    for (const g of groupEvents(events)) {
      if (g.main.kind === 'PUSH') {
        if (this.shownPush.has(g.main.method)) continue;
        this.shownPush.add(g.main.method);
      }
      const sc = buildScene(g.main, g.companion, ctx, g.crowd ?? []);
      if (!sc) continue;
      this.queue.push(sc);
      n++;
    }
    if (!this.cur && n > 0) this.next();
    return n;
  }

  private next(): void {
    this.cur = this.queue.shift() ?? null;
    this.elapsed = 0;
    this.hitFired = false;
    if (this.cur && (this.cur.hitAt <= 0 || this.reduceMotion())) this.fire();
  }

  private fire(): void {
    if (this.hitFired || !this.cur) return;
    this.hitFired = true;
    this.onHit?.(this.cur);
  }

  private get duration(): number {
    return this.reduceMotion() ? KNOBS.CINEMATIC_FLASH_S : (this.cur?.duration ?? 0);
  }

  update(dtMs: number, skip: boolean): void {
    if (!this.cur) return;
    this.elapsed += dtMs / 1000;
    if (this.elapsed >= this.cur.hitAt) this.fire();
    if (skip || this.elapsed >= this.duration) {
      this.fire();
      this.next();
    }
  }

  render(countdown: string): void {
    if (this.cur) renderScene(this.s, this.cur, this.elapsed, countdown, this.reduceMotion());
  }
}
