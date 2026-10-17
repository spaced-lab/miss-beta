// WHAT: Boot: canvas, input, screens, and the requestAnimationFrame loop.
// WHY:  GAME_PLAN 14: main.ts is boot plus the state machine, nothing else.
// HOW:  One Surface shared by all screens; one Input; a Router that swaps the active screen. The loop
//       passes real elapsed ms to the screen, which decides how to step its own simulation.
// LORE: C1 (how the game is built)

import type { Router, Screen, ScreenId } from './game/screen';
import { MinigameScreen } from './minigame/index';
import { createSurface } from './render/canvas';
import { PALETTES } from './render/palettes';
import { TitleScreen } from './render/views/title';
import { Input } from './ui/input';

function boot(): void {
  const canvas = document.getElementById('game');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('#game canvas missing');

  const surface = createSurface(canvas, PALETTES.PHOSPHOR, 'understroke');
  const keys = new Input(window);

  let current: Screen | null = null;
  const screens = new Map<ScreenId, Screen>();
  const router: Router = {
    go(id) {
      const next = screens.get(id);
      if (!next) throw new Error(`unknown screen ${id}`);
      current?.exit();
      current = next;
      current.enter();
    },
  };
  screens.set('title', new TitleScreen(surface, keys, router));
  screens.set('minigame', new MinigameScreen(surface, keys, router));

  const onResize = (): void => surface.resize();
  window.addEventListener('resize', onResize);

  // Deep link for quick testing: index.html#minigame
  router.go(location.hash === '#minigame' ? 'minigame' : 'title');

  // Dev diagnostics: CPU time per frame (update + render), smoothed, readable from the console as
  // window.__miss.cpuMs. The rAF interval is vsync-bound and says nothing about our cost; this does.
  const stats = { cpuMs: 0, frameMs: 0 };
  if (import.meta.env.DEV) (window as unknown as { __miss: typeof stats }).__miss = stats;

  let last = performance.now();
  const frame = (now: number): void => {
    const dt = now - last;
    last = now;
    const t0 = performance.now();
    current?.update(dt);
    keys.endFrame();
    current?.render();
    const cpu = performance.now() - t0;
    stats.cpuMs = stats.cpuMs * 0.9 + cpu * 0.1;
    stats.frameMs = stats.frameMs * 0.9 + dt * 0.1;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

boot();
