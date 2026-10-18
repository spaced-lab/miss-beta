// WHAT: Title / menu screen: the MISS ∝ β logo, a slow attract orbit sketch, and the menu.
// WHY:  GAME_PLAN 13.1. For now the menu offers the minigame and marks the rest BUILDING; the real
//       attract mode (a round resolving itself) arrives with M1.
// HOW:  Menu navigation by arrows + Enter, or the first letter of an item. The orbit sketch is a cheap
//       four-ring drawing with fake periods; it is replaced by kepler.ts output in M0.
// LORE: G2 (screens and HUD), G8 (the look)

import { hasSavedRun, loadRun } from '../../game/savegame';
import { createRun, type RunState } from '../../game/run';
import { ConsoleOverlay } from './console';
import { loadJson } from '../../game/persistence';
import { TUTORIAL_SEEN_KEY } from '../../game/tutorial';
import { buildAttract, dailySeed, tickAttract, type AttractRound } from '../../game/attract';
import { drawMiniSystem } from '../miniSystem';
import type { UiSfx } from '../../audio/ui';
import type { Router, Screen } from '../../game/screen';
import type { SystemScreen } from './system';
import type { Input } from '../../ui/input';
import type { Surface } from '../canvas';
import { uiColors } from '../palettes';
import { drawText, measureText, wrapText } from '../vectorFont';
import { saveSettings, type Settings } from '../../game/settings';

interface Item {
  label: string;
  hotkey: string;
  action: (() => void) | null;
}

export class TitleScreen implements Screen {
  private sel = 0;
  private t = 0;
  private note = '';
  private noteT = 0;
  private readonly items: Item[];
  private readonly console: ConsoleOverlay;
  /** Codes typed on the title apply to the next NEW RUN (GAME_PLAN 22.2). */
  pendingRun: RunState | null = null;

  private attract: AttractRound | null = null;
  private attractN = 0;

  constructor(private readonly s: Surface, private readonly keys: Input, private readonly router: Router, private readonly getSystem: () => SystemScreen | null = () => null, private readonly sfx: UiSfx | null = null, private readonly settings: Settings | null = null) {
    this.console = new ConsoleOverlay(s, keys);
    this.items = [
      {
        label: 'NEW RUN',
        hotkey: 'KeyN',
        action: () => {
          const sys = this.getSystem();
          if (sys && this.pendingRun) {
            sys.pendingRun = this.pendingRun;
            this.pendingRun = null;
          }
          router.go('system');
        },
      },
      {
        label: 'SANDBOX RUN  (LEARN: UNLIMITED BUDGET, ALL TECH)',
        hotkey: 'KeyS',
        action: () => {
          const sys = this.getSystem();
          if (sys) sys.sandboxNext = true;
          router.go('system');
        },
      },
      {
        label: 'DAILY RUN  (TODAY\'S SEED, SAME FOR EVERYONE)',
        hotkey: 'KeyD',
        action: () => {
          const sys = this.getSystem();
          if (!sys) return;
          sys.pendingRun = createRun(dailySeed());
          router.go('system');
        },
      },
      {
        label: 'AUTOPLAY  (WATCH AND LEARN)',
        hotkey: 'KeyA',
        action: () => {
          const sys = this.getSystem();
          if (sys) sys.autoplayNext = true;
          router.go('system');
        },
      },
      {
        label: 'SUPER-DUPER-DEMO  (FASTER AND FASTER)',
        hotkey: 'KeyU',
        action: () => {
          const sys = this.getSystem();
          if (sys) sys.demoNext = true;
          router.go('system');
        },
      },
      {
        label: 'TUTORIAL  (GUIDED FIRST ROUND)',
        hotkey: 'KeyT',
        action: () => this.startTutorial(),
      },
      {
        label: 'CONTINUE',
        hotkey: 'KeyC',
        action: () => {
          const run = loadRun();
          const sys = this.getSystem();
          if (!run || !sys) {
            this.note = run ? 'CONTINUE UNAVAILABLE' : 'NO SAVED RUN. START A NEW RUN OR DROP A SAVE.MD HERE.';
            this.noteT = 2.5;
            return;
          }
          router.go('system');
          sys.resume(run);
        },
      },
      { label: 'PERIMETER  (ARCADE MINIGAME)', hotkey: 'KeyP', action: () => router.go('minigame') },
      { label: 'CODEX', hotkey: 'KeyX', action: () => router.go('codex') },
      { label: 'LEADERBOARD', hotkey: 'KeyB', action: () => router.go('leaderboard') },
      { label: 'HOW TO PLAY', hotkey: 'KeyH', action: () => router.go('help') },
      { label: 'LEARN  (LEARNING CENTER: 57 TOPICS, 5 LEVELS, 21 LABS)', hotkey: 'KeyL', action: () => router.go('center') },
      { label: 'OPTIONS', hotkey: 'KeyO', action: () => router.go('options') },
    ];
  }

  enter(): void {
    this.sel = 0;
    if (!this.attract) this.nextAttract();
    // First launch opens the tutorial (GAME_PLAN 25); it can be skipped with Tab and replayed from the menu.
    if (!loadJson(TUTORIAL_SEEN_KEY, (v): v is boolean => typeof v === 'boolean', false) && !hasSavedRun()) this.startTutorial();
  }

  /** A new self-playing round for the background; the seed walks so each visit differs. */
  private nextAttract(): void {
    try {
      this.attract = buildAttract(`ATTRACT-${dailySeed()}-${this.attractN++}`);
    } catch {
      this.attract = null;
    }
  }

  private startTutorial(): void {
    const sys = this.getSystem();
    if (!sys) return;
    sys.tutorialNext = true;
    this.router.go('system');
  }
  exit(): void {}

  update(dtMs: number): void {
    this.t += dtMs / 1000;
    this.noteT = Math.max(0, this.noteT - dtMs / 1000);
    const k = this.keys;
    // Photosensitivity notice: shown until a key acknowledges it once; the choice is saved with the settings.
    if (this.settings && !this.settings.photoAck) {
      if (k.anyKeyPressed() || k.takeClick()) {
        this.settings.photoAck = true;
        saveSettings(this.settings);
      }
      return;
    }
    if (this.console.isOpen) {
      if (!this.pendingRun) this.pendingRun = createRun(Date.now().toString(36).toUpperCase());
      this.console.update({ run: this.pendingRun, round: null });
      return;
    }
    if (k.pressed('Backquote')) {
      if (!this.pendingRun) this.pendingRun = createRun(Date.now().toString(36).toUpperCase());
      this.console.show();
      return;
    }
    if (this.attract && tickAttract(this.attract, dtMs / 1000)) this.nextAttract();
    if (k.pressed('ArrowUp') || k.pressed('KeyW')) {
      this.sel = (this.sel + this.items.length - 1) % this.items.length;
      this.sfx?.move();
    }
    if (k.pressed('ArrowDown') || k.pressed('KeyS')) {
      this.sel = (this.sel + 1) % this.items.length;
      this.sfx?.move();
    }
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      if (it && k.pressed(it.hotkey)) {
        this.sel = i;
        this.activate();
      }
    }
    if (k.pressed('Enter') || k.pressed('Space')) this.activate();
    // Mouse: hovering moves the cursor, a click chooses.
    const mp = k.mouse;
    const hovered = mp ? this.itemRows.findIndex((r) => mp.x > r.x0 && mp.x < r.x1 && mp.y >= r.y - 4 && mp.y < r.y + 22) : -1;
    if (hovered >= 0 && hovered !== this.sel && (mp?.x !== this.lastHover.x || mp?.y !== this.lastHover.y)) {
      this.sel = hovered;
      this.sfx?.move();
    }
    if (mp) this.lastHover = { x: mp.x, y: mp.y };
    const click = k.takeClick();
    if (click) {
      const i = this.itemRows.findIndex((r) => click.x > r.x0 && click.x < r.x1 && click.y >= r.y - 4 && click.y < r.y + 22);
      if (i >= 0) {
        this.sel = i;
        this.activate();
      }
    }
  }
  private itemRows: { x0: number; x1: number; y: number }[] = [];
  private lastHover = { x: -1, y: -1 };

  private activate(): void {
    const it = this.items[this.sel];
    if (!it) return;
    this.sfx?.select();
    if (it.action) it.action();
    else {
      this.note = `${it.label} IS STILL BUILDING. SEE STATUS.MD`;
      this.noteT = 2.5;
    }
  }

  /** First-boot photosensitivity notice (docs/WARNINGS.md 7). Steady text only: nothing on this page flashes. */
  private drawPhotoNotice(): void {
    const s = this.s;
    const p = s.palette;
    const ui = uiColors(p, s.spectrum);
    const w = Math.min(760, s.width - 32);
    const x = (s.width - w) / 2;
    const size = 12;
    const body = [
      'THIS GAME CONTAINS FLASHING AND FAST-CHANGING IMAGES: IMPACT AND NUCLEAR FLASHES, THE SUPER-DUPER-DEMO MONTAGE, THE SIMULATION-MODE GLITCH EFFECT, THE OPTIONAL CRT FLICKER, AND SCREEN SHAKE AND BRIGHT LASER BEAMS IN THE PERIMETER ARCADE MODE.',
      '',
      'A SMALL NUMBER OF PEOPLE MAY HAVE A SEIZURE WHEN EXPOSED TO FLASHING LIGHTS OR PATTERNS, EVEN WITH NO HISTORY OF EPILEPSY. IF YOU FEEL DIZZY, SEE ALTERED VISION, TWITCHING OR DISORIENTATION, STOP PLAYING AND REST.',
      '',
      'OPTIONS > REDUCE MOTION TURNS THE FLASHES, THE GLITCH AND THE FLICKER OFF AND SLOWS THE MONTAGE TO ONE CUT A SECOND. EVEN WITHOUT IT THE MONTAGE NEVER CUTS MORE THAN THREE TIMES A SECOND. PLAY IN A LIT ROOM, AT A DISTANCE, AND TAKE BREAKS.',
    ];
    const lines = body.flatMap((l) => (l ? wrapText(l, w - 40, 11) : ['']));
    const h = 70 + lines.length * 17 + 40;
    const y = Math.max(16, (s.height - h) / 2);
    s.stroke([x, y, x + w, y, x + w, y + h, x, y + h], { closed: true, color: ui.title, glow: 1 });
    drawText(s, 'PHOTOSENSITIVITY WARNING', s.width / 2, y + 18, 18, { align: 'center', color: ui.title, glow: 1.2 });
    let ly = y + 58;
    for (const l of lines) {
      drawText(s, l, x + 20, ly, 11, { color: ui.text, glow: 0.3 });
      ly += 17;
    }
    drawText(s, 'PRESS ANY KEY OR CLICK TO CONTINUE', s.width / 2, y + h - 26, size, { align: 'center', color: ui.sel, glow: 0.8 });
  }

  render(): void {
    const s = this.s;
    const p = s.palette;
    s.clear();
    const cx = s.width / 2;
    const cy = s.height / 2;
    if (this.settings && !this.settings.photoAck) {
      this.drawPhotoNotice();
      return;
    }

    // Attract mode: a seeded round planning and resolving itself, dim, behind the menu.
    const R = Math.min(s.width, s.height) * 0.42;
    if (this.attract) {
      drawMiniSystem(s, this.attract.world, this.attract.result, cx, cy, R, { alpha: 0.55, threatPath: true });
      const a = this.attract;
      const th = a.world.threat;
      if (th) {
        const left = th.tImpact - a.world.t;
        const line = left > 0 ? `ATTRACT  ${th.name}  D ${th.D.toFixed(0)} M  T-${(left / 31557600).toFixed(1)} Y  ${a.missions.length} MISSION${a.missions.length === 1 ? '' : 'S'}  PREDICTED ${a.result.outcome}` : `ATTRACT  ${th.name}  ${a.result.outcome === 'MISS' ? `MISSED BY ${a.result.ca.marginRadii.toFixed(1)} R` : a.result.outcome}`;
        drawText(s, line, cx, 14, 10, { align: 'center', color: p.dim, glow: 0 });
      }
    } else {
      s.circle(cx, cy, 6, { glow: 1.5, color: p.hot });
    }

    const big = Math.min(72, s.width / 9);
    drawText(s, 'MISS ∝ β', cx, cy - big * 1.9, big, { align: 'center', glow: 2.2, color: uiColors(p, s.spectrum).title, width: 2 });
    // The acronyms spelled out (owner 2026-10-18): the label in purple, the words in green, centred as one line.
    const spell = (tag: string, words: string, y: number): void => {
      const wTag = measureText(tag, 12);
      const x0 = cx - (wTag + measureText(words, 12)) / 2;
      drawText(s, tag, x0, y, 12, { color: uiColors(p, s.spectrum).sub, glow: 1 });
      drawText(s, words, x0 + wTag, y, 12, { color: p.ink });
    };
    spell('MISS:  ', 'MOMENTUM  IMPULSE  SAILS  SLINGSHOTS', cy - big * 0.55 + 5);
    spell('BETA:  ', 'BALLISTIC ENGAGEMENT OF THREATENING ASTEROIDS', cy - big * 0.55 + 24);

    let y = cy + 4;
    const ui = uiColors(p, s.spectrum);
    this.itemRows.length = 0;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      if (!it) continue;
      const selected = i === this.sel;
      const label = it.label + (it.action ? '' : '   [BUILDING]') + (it.label === 'CONTINUE' ? (hasSavedRun() ? '   (SAVED RUN FOUND)' : '   (NO SAVE)') : '');
      if (selected) drawText(s, '>', cx - 190, y, 16, { color: ui.sel, glow: 1.6 });
      const wdt = drawText(s, label, cx - 160, y, 15, { color: selected ? ui.sel : it.action ? ui.text : ui.dim, glow: selected ? 1.5 : it.action ? 1 : 0 });
      this.itemRows.push({ x0: cx - 200, x1: cx - 160 + wdt + 10, y });
      y += 26;
    }

    if (this.noteT > 0) drawText(s, this.note, cx, s.height - 90, 12, { align: 'center', color: p.hot, alpha: Math.min(1, this.noteT) });
    if (this.pendingRun && this.pendingRun.cheatsUsed.length > 0) drawText(s, `CODES FOR THE NEXT RUN: ${this.pendingRun.cheatsUsed.join(' ')}   MODE ${this.pendingRun.mode}`, cx, s.height - 64, 11, { align: 'center', color: p.hot, glow: 0.8 });
    drawText(s, 'MISS β v0.1   ARROWS OR MOUSE SELECT   ENTER OR CLICK START   BACKQUOTE KEY: CONSOLE (CHEAT CODES)', cx, s.height - 40, 11, { align: 'center', color: p.dim, glow: 0 });
    this.console.render({ run: this.pendingRun ?? createRun('PENDING'), round: null });
  }
}
