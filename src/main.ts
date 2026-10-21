// WHAT: Boot: canvas, input, screens, and the requestAnimationFrame loop.
// WHY:  GAME_PLAN 14: main.ts is boot plus the state machine, nothing else.
// HOW:  One Surface shared by all screens; one Input; a Router that swaps the active screen. The loop
//       passes real elapsed ms to the screen, which decides how to step its own simulation.
// LORE: C1 (how the game is built)

import { bootScreen, type Router, type Screen, type ScreenId } from './game/screen';
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
import type { CenterScreen } from './render/views/center';
import { LazyScreen } from './game/lazyScreen';
import { Input } from './ui/input';
import { drawBackTab, onBackTab } from './ui/touchBack';

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
      if (id === 'center' && currentId !== 'center') {
        const from = currentId;
        center.with((c) => (c.returnTo = from));
      }
      current?.exit();
      current = next;
      currentId = id;
      current.enter();
    },
  };
  screens.set('title', new TitleScreen(surface, keys, router, () => (screens.get('system') as SystemScreen | undefined) ?? null, sfx, settings));
  // NOTE: PERIMETER, the Learning Center and the demo finale load on first use (D1 in docs/DECISIONS.md):
  // they are over half the code and none of it is needed to draw the title.
  screens.set('minigame', new LazyScreen('PERIMETER', () => import('./minigame/index').then((m) => new m.MinigameScreen(surface, keys, router, () => settings.reduceMotion)), surface, keys, router));
  screens.set('system', new SystemScreen(surface, keys, router, settings, sfx, (id, level) => {
    center.with((c) => c.openTopic(id, level));
    router.go('center');
  }));
  const options = new OptionsScreen(surface, keys, router, settings);
  screens.set('options', options);
  const center = new LazyScreen<CenterScreen>('LEARNING CENTER', () => import('./render/views/center').then((m) => new m.CenterScreen(surface, keys, router, settings)), surface, keys, router);
  screens.set('center', center);
  screens.set('leaderboard', new LeaderboardScreen(surface, keys, router));
  const codex = new CodexScreen(surface, keys, router);
  screens.set('codex', codex);
  codex.openCenter = (id) => {
    center.with((c) => c.openTopic(id));
    router.go('center');
  };
  const help = new HelpScreen(surface, keys, router);
  screens.set('help', help);
  screens.set('demo', new LazyScreen('DEMO', () => import('./render/views/demo').then((m) => new m.DemoScreen(surface, keys, router, sfx, settings)), surface, keys, router));
  // Every screen with an L key opens the Learning Center on its topic; the center's Esc returns to the opener.
  const toCenter = (id: string): void => {
    center.with((c) => c.openTopic(id));
    router.go('center');
  };
  help.openCenter = toCenter;
  options.openCenter = toCenter;
  options.sayVoice = (id) => {
    sfx.voice.mode = settings.voice ?? 'FEMALE';
    sfx.style = settings.soundStyle ?? 'ARCADE';
    sfx.unlock();
    sfx.voice.say(id, true);
  };

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
      // NOTE: before the photosensitivity notice is acknowledged the save is only stored; the title keeps the
      // notice up and CONTINUE resumes the run afterwards (docs/WARNINGS.md 8).
      if (settings.photoAck !== true) return;
      const sys = screens.get('system');
      if (sys instanceof SystemScreen) {
        // NOTE: through the router like CONTINUE on the title, so currentId follows and enter() clears any
        // AUTOPLAY or tutorial state before the imported run takes over.
        router.go('system');
        sys.resume(run);
      }
    });
  });

  // Deep link for quick testing: index.html#minigame
  router.go(bootScreen(location.hash.slice(1), settings.photoAck === true));

  // Dev diagnostics: CPU time per frame (update + render), smoothed, readable from the console as
  // window.__miss.cpuMs. The rAF interval is vsync-bound and says nothing about our cost; this does.
  // `screens` is exposed too so an automated visual check can read a screen's state (dev only).
  // A lazy screen unwraps to the real one once loaded (null until then), so console checks read the same state.
  const devScreens = { get: (id: ScreenId): Screen | null | undefined => { const sc = screens.get(id); return sc instanceof LazyScreen ? (sc.target as Screen | null) : sc; } };
  const stats = { cpuMs: 0, frameMs: 0, stale: false, screens: devScreens };
  if (import.meta.env.DEV) (window as unknown as { __miss: typeof stats }).__miss = stats;
  // NOTE: accept hot updates here without re-booting, so a source save on the dev server never reloads
  // the page under a running game. The running code is simply stale until the player refreshes; a notice
  // is drawn over every screen so nobody tests old code by accident.
  if (import.meta.hot) {
    import.meta.hot.accept(() => {
      stats.stale = true;
    });
  }

  // NOTE: a phone only lets audio start inside a touch handler (iOS Safari above all); the frame loop's key-press
  // unlock never sees a tap, so the sound and the voice stayed silent on phones.
  window.addEventListener('touchend', () => sfx.unlock(), { passive: true });
  window.addEventListener('pointerup', () => sfx.unlock(), { passive: true });

  let last = performance.now();
  let welcomed = false;
  let firstFrame = true;
  const frame = (now: number): void => {
    const dt = now - last;
    last = now;
    const t0 = performance.now();
    sfx.enabled = settings.sound;
    sfx.voice.mode = settings.voice ?? 'FEMALE';
    sfx.style = settings.soundStyle ?? 'ARCADE';
    if (!settings.reduceMotion) surface.holoDrift = (surface.holoDrift + dt * 0.01) % 360;
    keys.pollGamepads();
    if (keys.anyKeyPressed()) sfx.unlock();
    // IDEAS 21: the mission computer greets once, as soon as audio is allowed to start on the title.
    if (!welcomed && currentId === 'title' && sfx.synth.ready) {
      welcomed = true;
      sfx.voice.say('WELCOME');
    }
    // Menu sounds everywhere (owner 2026-10-18): a cursor move and a select; the arcade and the demo have their own.
    // NOTE: not for the SUPER-DUPER-DEMO's injected keys: they speed up with the demo and the blips became a midrange
    // clicking under the scenes (owner 2026-10-20).
    const demoKeys = currentId === 'system' && (screens.get('system') as SystemScreen | undefined)?.demoRunning === true;
    if (currentId !== 'minigame' && currentId !== 'demo' && currentId !== 'title' && !demoKeys) {
      if (keys.anyPressed('ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab')) sfx.move();
      if (keys.anyPressed('Enter')) sfx.select();
    }
    // Touch screens have no Esc key: a BACK tab in the top-left corner on every screen but the title presses it (each screen's
    // Escape goes back, closes a panel or pauses) (owner 2026-10-20, "make sure the menu works on mobile").
    const back = keys.touchUsed && currentId !== 'title' && currentId !== 'minigame';
    const tap = back ? keys.peekClick() : null;
    if (tap && onBackTab(tap.x, tap.y)) {
      keys.takeClick();
      keys.inject('Escape');
    }
    current?.update(dt);
    keys.endFrame();
    current?.render();
    if (back) drawBackTab(surface);
    if (settings.crt) crtPass(surface, { scanlines: true, vignette: true, flicker: !settings.reduceMotion }, now / 1000);
    if (stats.stale) drawText(surface, 'NEW BUILD AVAILABLE: REFRESH TO LOAD IT', surface.width / 2, 4, 11, { align: 'center', color: surface.palette.hot, glow: 1 });
    const cpu = performance.now() - t0;
    stats.cpuMs = stats.cpuMs * 0.9 + cpu * 0.1;
    stats.frameMs = stats.frameMs * 0.9 + dt * 0.1;
    // Boot cost, measurable in any build: performance.getEntriesByName('miss:first-frame')[0].startTime
    // is ms from navigation start to the end of the first drawn frame (docs/DECISIONS.md, how to re-measure).
    if (firstFrame) {
      firstFrame = false;
      performance.mark('miss:first-frame');
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

boot();
