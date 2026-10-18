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
import { HelpScreen } from './render/views/help';
import { LeaderboardScreen } from './render/views/leaderboard';
import { SystemScreen } from './render/views/system';
import { TitleScreen } from './render/views/title';
import { importRun } from './game/savegame';
import { applySettings, loadSettings } from './game/settings';
import { loadBindings, remapFor, setBindings } from './game/keybinds';
import { crtPass } from './render/crt';
import { OptionsScreen } from './render/views/options';
import { UiSfx } from './audio/ui';
import { CenterScreen } from './render/views/center';
import { Input } from './ui/input';

function boot(): void {
  const canvas = document.getElementById('game');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('#game canvas missing');

  const surface = createSurface(canvas, PALETTES.PHOSPHOR, 'understroke');
  const keys = new Input(window);
  const bindings = loadBindings();
  setBindings(bindings);
  keys.remap = remapFor(bindings);
  const settings = loadSettings();
  applySettings(settings, surface);
  const sfx = new UiSfx();

  let current: Screen | null = null;
  const screens = new Map<ScreenId, Screen>();
  let currentId: ScreenId = 'title';
  const router: Router = {
    go(id) {
      const next = screens.get(id);
      if (!next) throw new Error(`unknown screen ${id}`);
      // The manual remembers where it was opened from.
      if (id === 'help' && currentId !== 'help') (next as HelpScreen).returnTo = currentId;
      if (id === 'center' && currentId !== 'center') (next as CenterScreen).returnTo = currentId;
      current?.exit();
      current = next;
      currentId = id;
      current.enter();
    },
  };
  screens.set('title', new TitleScreen(surface, keys, router, () => (screens.get('system') as SystemScreen | undefined) ?? null, sfx));
  screens.set('minigame', new MinigameScreen(surface, keys, router));
  screens.set('system', new SystemScreen(surface, keys, router, settings, sfx, (id, level) => {
    center.openTopic(id, level);
    router.go('center');
  }));
  const options = new OptionsScreen(surface, keys, router, settings);
  screens.set('options', options);
  const center = new CenterScreen(surface, keys, router, settings);
  screens.set('center', center);
  screens.set('leaderboard', new LeaderboardScreen(surface, keys, router));
  const codex = new CodexScreen(surface, keys, router);
  screens.set('codex', codex);
  codex.openCenter = (id) => {
    (screens.get('center') as CenterScreen).openTopic(id);
    router.go('center');
  };
  const help = new HelpScreen(surface, keys, router);
  screens.set('help', help);
  // Every screen with an L key opens the Learning Center on its topic; the center's Esc returns to the opener.
  const toCenter = (id: string): void => {
    center.openTopic(id);
    router.go('center');
  };
  help.openCenter = toCenter;
  options.openCenter = toCenter;

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
  router.go(hash === 'minigame' || hash === 'system' || hash === 'leaderboard' || hash === 'codex' || hash === 'help' || hash === 'options' || hash === 'center' ? hash : 'title');

  // Dev diagnostics: CPU time per frame (update + render), smoothed, readable from the console as
  // window.__miss.cpuMs. The rAF interval is vsync-bound and says nothing about our cost; this does.
  // `screens` is exposed too so an automated visual check can read a screen's state (dev only).
  const stats = { cpuMs: 0, frameMs: 0, stale: false, screens };
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
    sfx.enabled = settings.sound;
    if (!settings.reduceMotion) surface.holoDrift = (surface.holoDrift + dt * 0.01) % 360;
    keys.pollGamepads();
    if (keys.anyKeyPressed()) sfx.unlock();
    current?.update(dt);
    keys.endFrame();
    current?.render();
    if (settings.crt) crtPass(surface, { scanlines: true, vignette: true, flicker: !settings.reduceMotion }, now / 1000);
    if (stats.stale) drawText(surface, 'NEW BUILD AVAILABLE: REFRESH TO LOAD IT', surface.width / 2, 4, 11, { align: 'center', color: surface.palette.hot, glow: 1 });
    const cpu = performance.now() - t0;
    stats.cpuMs = stats.cpuMs * 0.9 + cpu * 0.1;
    stats.frameMs = stats.frameMs * 0.9 + dt * 0.1;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

boot();
