// WHAT: Boot: canvas, input, screens, and the requestAnimationFrame loop.
// WHY:  GAME_PLAN 14: main.ts is boot plus the state machine, nothing else.
// HOW:  One Surface shared by all screens; one Input; a Router that swaps the active screen. The loop
//       passes real elapsed ms to the screen, which decides how to step its own simulation.
// LORE: C1 (how the game is built)

import type { Router, Screen, ScreenId } from './game/screen';
import { MinigameScreen } from './minigame/index';
import { createSurface } from './render/canvas';
import { PALETTES } from './render/palettes';
import { drawText } from './render/vectorFont';
import { CodexScreen } from './render/views/codex';
import { LeaderboardScreen } from './render/views/leaderboard';
import { SystemScreen } from './render/views/system';
import { TitleScreen } from './render/views/title';
import { importRun } from './game/savegame';
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
  screens.set('title', new TitleScreen(surface, keys, router, () => (screens.get('system') as SystemScreen | undefined) ?? null));
  screens.set('minigame', new MinigameScreen(surface, keys, router));
  screens.set('system', new SystemScreen(surface, keys, router));
  screens.set('leaderboard', new LeaderboardScreen(surface, keys, router));
  screens.set('codex', new CodexScreen(surface, keys, router));

  const onResize = (): void => surface.resize();
  window.addEventListener('resize', onResize);

  // IMPORT by drag and drop (GAME_PLAN 22.1): a dropped SAVE.md is parsed (front matter only, validated) and,
  // if valid, becomes the current save and CONTINUEs. Anything else is ignored with a console line.
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (!file || file.size > 300000) return;
    void file.text().then((text) => {
      const run = importRun(text);
      if (!run) {
        console.warn('[save] dropped file is not a valid SAVE.md');
        return;
      }
      const sys = screens.get('system');
      if (sys instanceof SystemScreen) {
        current?.exit();
        current = sys;
        sys.resume(run);
      }
    });
  });

  // Deep link for quick testing: index.html#minigame
  const hash = location.hash.slice(1);
  router.go(hash === 'minigame' || hash === 'system' || hash === 'leaderboard' || hash === 'codex' ? hash : 'title');

  // Dev diagnostics: CPU time per frame (update + render), smoothed, readable from the console as
  // window.__miss.cpuMs. The rAF interval is vsync-bound and says nothing about our cost; this does.
  const stats = { cpuMs: 0, frameMs: 0, stale: false };
  if (import.meta.env.DEV) (window as unknown as { __miss: typeof stats }).__miss = stats;
  // NOTE: accept hot updates here without re-booting, so a source save on the dev server never reloads
  // the page under a running game. The running code is simply stale until the player refreshes; a notice
  // is drawn over every screen so nobody tests old code by accident.
  if (import.meta.hot) {
    import.meta.hot.accept(() => {
      stats.stale = true;
    });
  }

  let last = performance.now();
  const frame = (now: number): void => {
    const dt = now - last;
    last = now;
    const t0 = performance.now();
    current?.update(dt);
    keys.endFrame();
    current?.render();
    if (stats.stale) drawText(surface, 'NEW BUILD AVAILABLE: REFRESH TO LOAD IT', surface.width / 2, 4, 11, { align: 'center', color: surface.palette.hot, glow: 1 });
    const cpu = performance.now() - t0;
    stats.cpuMs = stats.cpuMs * 0.9 + cpu * 0.1;
    stats.frameMs = stats.frameMs * 0.9 + dt * 0.1;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

boot();
