// WHAT: The PERIMETER minigame screen: fixed-step loop, input mapping, cheats, best score.
// WHY:  Glue between the pure sim (sim.ts), the renderer (render.ts) and the browser. Everything that
//       touches the DOM or the clock lives here so the other two files stay testable.
// HOW:  Real time is accumulated and consumed in MG.DT steps (capped per frame so a background tab does
//       not spiral). The pulse key is edge-triggered here and passed as a boolean; a replay could feed
//       the same Input records back into `step` and reproduce the game exactly.
// LORE: G1 (how to play), C1 (how the game is built)

import { CheatRegistry } from '../game/cheats';
import { loadNumber, saveJson } from '../game/persistence';
import type { Router, Screen } from '../game/screen';
import type { GlowMode, Surface } from '../render/canvas';
import type { Input as Keys } from '../ui/input';
import { MINIGAME_CHEATS } from './cheats';
import { MG } from './config';
import { renderMinigame } from './render';
import { createState, start, step, type Input, type MinigameState } from './sim';

const BEST_KEY = 'minigame.best';
const GLOW_CYCLE: readonly GlowMode[] = ['understroke', 'shadow', 'none'];

export class MinigameScreen implements Screen {
  private st: MinigameState;
  private acc = 0;
  private debug = false;
  private best = loadNumber(BEST_KEY, 0);
  private frameMs = 0;
  private lastFrame = 0;
  private readonly cheats = new CheatRegistry<MinigameState>(MINIGAME_CHEATS);

  constructor(private readonly s: Surface, private readonly keys: Keys, private readonly router: Router) {
    this.st = createState(this.newSeed());
  }

  private newSeed(): number {
    // NOTE: the seed is the only non-deterministic input; it is shown in the debug HUD so a run can be replayed.
    return (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
  }

  enter(): void {
    this.st = createState(this.newSeed(), this.st.collision);
    this.acc = 0;
    this.keys.clearTyped();
  }

  exit(): void {
    // nothing to tear down: the surface and listeners are shared
  }

  update(dtMs: number): void {
    const k = this.keys;
    const st = this.st;

    if (k.pressed('Escape')) {
      this.router.go('title');
      return;
    }
    if (k.pressed('KeyB')) this.debug = !this.debug;
    if (k.pressed('KeyG')) this.s.glowMode = GLOW_CYCLE[(GLOW_CYCLE.indexOf(this.s.glowMode) + 1) % GLOW_CYCLE.length] ?? 'understroke';
    if (k.pressed('KeyC')) st.collision = st.collision === 'auto' ? 'naive' : st.collision === 'naive' ? 'grid' : 'auto';

    if (st.status === 'ready' && k.pressed('Space')) start(st);
    if (st.status === 'over' && k.pressed('Space')) {
      this.st = createState(this.newSeed(), st.collision);
      start(this.st);
      return;
    }

    // Cheats: match the typed tail, then clear so a code fires once.
    if (st.status === 'playing') {
      const fired = this.cheats.match(k.typed(), st);
      if (fired) {
        k.clearTyped();
        console.info(`[cheat] ${fired.code}: ${fired.message}`);
      }
    }

    const input: Input = {
      left: k.anyHeld('ArrowLeft', 'KeyA'),
      right: k.anyHeld('ArrowRight', 'KeyD'),
      fire: k.held('Space'),
      pulse: k.anyPressed('Enter', 'ShiftLeft', 'ShiftRight'),
    };

    this.acc += Math.min(dtMs, 250) / 1000 * st.cheats.timeScale;
    let steps = 0;
    let pulse = input.pulse;
    while (this.acc >= MG.DT && steps < MG.MAX_STEPS_PER_FRAME) {
      step(st, { ...input, pulse }, MG.DT);
      pulse = false; // an edge is consumed by the first step
      this.acc -= MG.DT;
      steps++;
    }
    if (steps === MG.MAX_STEPS_PER_FRAME) this.acc = 0;

    if (st.status === 'over' && !st.cheats.assisted && st.score > this.best) {
      this.best = st.score;
      saveJson(BEST_KEY, this.best);
    }
  }

  render(): void {
    const now = performance.now();
    if (this.lastFrame) this.frameMs = this.frameMs * 0.9 + (now - this.lastFrame) * 0.1;
    this.lastFrame = now;
    renderMinigame(this.s, this.st, { debug: this.debug, frameMs: this.frameMs, best: this.best });
  }
}
