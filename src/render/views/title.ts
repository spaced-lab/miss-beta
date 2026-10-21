// WHAT: Title / menu screen: the MISS ∝ β logo, a slow attract orbit sketch, and the menu.
// WHY:  GAME_PLAN 13.1. For now the menu offers the minigame and marks the rest BUILDING; the real
//       attract mode (a round resolving itself) arrives with M1.
// HOW:  Menu navigation by arrows + Enter, or the first letter of an item. The orbit sketch is a cheap
//       four-ring drawing with fake periods; it is replaced by kepler.ts output in M0.
// LORE: G2 (screens and HUD), G8 (the look)

import { VERSION } from '../../game/version';
import { hasSavedRun, loadRun } from '../../game/savegame';
import { createRun, type RunState } from '../../game/run';
import { ConsoleOverlay } from './console';
import { loadJson } from '../../game/persistence';
import { TUTORIAL_SEEN_KEY } from '../../game/tutorial';
import { dailySeed, tickAttract, type AttractRound } from '../../game/attract';
import { AttractBuilder } from '../../game/attractClient';
import { drawMiniSystem } from '../miniSystem';
import type { UiSfx } from '../../audio/ui';
import type { Router, Screen } from '../../game/screen';
import type { SystemScreen } from './system';
import type { Input } from '../../ui/input';
import type { Surface } from '../canvas';
import { uiColors } from '../palettes';
import { drawText, getTextScale, measureText, wrapText } from '../vectorFont';
import { saveSettings, type Settings } from '../../game/settings';
import { YEAR } from '../../physics/constants';

interface Item {
  label: string;
  hotkey: string;
  action: (() => void) | null;
}

export class TitleScreen implements Screen {
  /** CONTINUE's label: whether a save that parses exists. NOTE: read on enter(), not every frame: the save only
   *  changes away from the title, and the check reads and parses up to 256 KiB (code review 2026-10-18). */
  private savedRun = false;
  /** What the console shows before a run exists (built once, not every frame). */
  private readonly placeholderRun = createRun('PENDING');
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
  /** Rounds are planned in a worker (D4 in docs/DECISIONS.md); while one is on its way the old one holds still. */
  private readonly attractBuilder = new AttractBuilder();
  private attractBusy = false;

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
      { label: 'LEARN  (LEARNING CENTER: 61 TOPICS, 5 LEVELS, 22 LABS)', hotkey: 'KeyL', action: () => router.go('center') },
      { label: 'OPTIONS', hotkey: 'KeyO', action: () => router.go('options') },
    ];
  }

  enter(): void {
    this.sel = 0;
    this.savedRun = hasSavedRun();
    if (!this.attract) this.nextAttract();
    // NOTE: the photosensitivity notice comes first; the first-launch tutorial waits for its acknowledgement
    // (update() calls firstLaunch() on that keypress), so a new player always sees the notice (WARNINGS 8).
    if (!this.settings || this.settings.photoAck) this.firstLaunch();
  }

  /** First launch opens the tutorial (GAME_PLAN 25); it can be skipped with Tab and replayed from the menu. */
  private firstLaunch(): void {
    if (!loadJson(TUTORIAL_SEEN_KEY, (v): v is boolean => typeof v === 'boolean', false) && !hasSavedRun()) this.startTutorial();
  }

  /** A new self-playing round for the background; the seed walks so each visit differs. */
  private nextAttract(): void {
    if (this.attractBusy) return;
    this.attractBusy = true;
    this.attractBuilder.build(`ATTRACT-${dailySeed()}-${this.attractN++}`).then(
      (a) => {
        this.attract = a;
        this.attractBusy = false;
      },
      () => {
        this.attract = null;
        this.attractBusy = false;
      },
    );
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
        this.firstLaunch();
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
    if (this.attract && !this.attractBusy && tickAttract(this.attract, dtMs / 1000)) this.nextAttract();
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
    const hovered = mp ? this.itemRows.findIndex((r) => mp.x > r.x0 && mp.x < r.x1 && mp.y >= r.y - r.pad && mp.y < r.y + r.h - r.pad) : -1;
    if (hovered >= 0 && hovered !== this.sel && (mp?.x !== this.lastHover.x || mp?.y !== this.lastHover.y)) {
      this.sel = hovered;
      this.sfx?.move();
    }
    if (mp) this.lastHover = { x: mp.x, y: mp.y };
    const click = k.takeClick();
    if (click) {
      const i = this.itemRows.findIndex((r) => click.x > r.x0 && click.x < r.x1 && click.y >= r.y - r.pad && click.y < r.y + r.h - r.pad);
      if (i >= 0) {
        this.sel = i;
        this.activate();
      }
    }
  }
  /** Each menu row's hit box: x0..x1, from y - pad, h tall (rows are taller on a touch screen). */
  private itemRows: { x0: number; x1: number; y: number; h: number; pad: number }[] = [];
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

  /**
   * First-boot photosensitivity notice (docs/WARNINGS.md 8). Steady text only: nothing on this page flashes.
   * NOTE: owner 2026-10-20 (on a phone the notice could not be passed): the OK button sits at the top, where it is
   * always on screen, and the body text shrinks (11 px down to 6 px) until the whole box fits the window. Any key, a
   * click or a tap anywhere still acknowledges it.
   */
  private drawPhotoNotice(): void {
    const s = this.s;
    const p = s.palette;
    const ui = uiColors(p, s.spectrum);
    const w = Math.min(760, s.width - 16);
    const x = (s.width - w) / 2;
    const pad = Math.min(20, w * 0.04);
    const body = [
      'THIS GAME CONTAINS FLASHING AND FAST-CHANGING IMAGES: IMPACT AND NUCLEAR FLASHES, THE SUPER-DUPER-DEMO MONTAGE, THE SIMULATION-MODE GLITCH EFFECT, THE OPTIONAL CRT FLICKER, AND SCREEN SHAKE AND BRIGHT LASER BEAMS IN THE PERIMETER ARCADE MODE.',
      '',
      'A SMALL NUMBER OF PEOPLE MAY HAVE A SEIZURE WHEN EXPOSED TO FLASHING LIGHTS OR PATTERNS, EVEN WITH NO HISTORY OF EPILEPSY. IF YOU FEEL DIZZY, SEE ALTERED VISION, TWITCHING OR DISORIENTATION, STOP PLAYING AND REST.',
      '',
      'OPTIONS > REDUCE MOTION TURNS THE FLASHES, THE GLITCH AND THE FLICKER OFF AND SLOWS THE MONTAGE TO ONE CUT A SECOND. EVEN WITHOUT IT THE MONTAGE NEVER CUTS MORE THAN THREE TIMES A SECOND. PLAY IN A LIT ROOM, AT A DISTANCE, AND TAKE BREAKS.',
    ];
    const head = Math.min(18, (18 * (w - 2 * pad)) / (measureText('PHOTOSENSITIVITY WARNING', 18) * getTextScale()));
    const btnH = 44;
    const top = 16 + btnH + 14 + head + 18;
    let fs = 11;
    let lines: string[] = [];
    for (; fs >= 6; fs -= 0.5) {
      lines = body.flatMap((l) => (l ? wrapText(l, w - 2 * pad, fs) : ['']));
      if (top + lines.length * fs * 1.55 + 20 <= s.height - 16) break;
    }
    const lh = fs * 1.55;
    const h = top + lines.length * lh + 16;
    const y = Math.max(8, (s.height - h) / 2);
    s.stroke([x, y, x + w, y, x + w, y + h, x, y + h], { closed: true, color: ui.title, glow: 1 });
    // The OK button, first thing in the box.
    const label = 'OK, I UNDERSTAND';
    const bw = Math.min(w - 2 * pad, measureText(label, 14) * getTextScale() + 48);
    const bx = s.width / 2 - bw / 2;
    const by = y + 14;
    s.stroke([bx, by, bx + bw, by, bx + bw, by + btnH, bx, by + btnH], { closed: true, color: ui.sel, glow: 1.4, width: 2 });
    drawText(s, label, s.width / 2, by + btnH / 2 - 7, 14, { align: 'center', color: ui.sel, glow: 1 });
    drawText(s, 'PHOTOSENSITIVITY WARNING', s.width / 2, by + btnH + 14, head, { align: 'center', color: ui.title, glow: 1.2 });
    let ly = y + top;
    for (const l of lines) {
      drawText(s, l, x + pad, ly, fs, { color: ui.text, glow: 0.3 });
      ly += lh;
    }
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
        const line = left > 0 ? `ATTRACT  ${th.name}  D ${th.D.toFixed(0)} M  T-${(left / YEAR).toFixed(1)} Y  ${a.missions.length} MISSION${a.missions.length === 1 ? '' : 'S'}  PREDICTED ${a.result.outcome}` : `ATTRACT  ${th.name}  ${a.result.outcome === 'MISS' ? `MISSED BY ${a.result.ca.marginRadii.toFixed(1)} R` : a.result.outcome}`;
        // NOTE: on a narrow or short window the logo moves to the top, where this line would run through it.
        if (s.width >= 560 && cy + 4 + this.items.length * 26 < s.height - 60) drawText(s, line, cx, 14, 10, { align: 'center', color: p.dim, glow: 0 });
      }
    } else {
      s.circle(cx, cy, 6, { glow: 1.5, color: p.hot });
    }

    // NOTE: owner 2026-10-20 ("make sure the menu works on mobile"): the desktop layout (logo above the centre, the
    // menu below it at 15 px, 26 px rows) is kept wherever it fits. On a narrow or short window the page is laid out
    // top-down instead: the logo and the spelled-out names shrink to the width, the menu's text shrinks until the
    // longest item fits, and rows are at least 36 px tall on a touch screen (a finger-sized target) when there is room.
    const ui = uiColors(p, s.spectrum);
    const n = this.items.length;
    const labelOf = (it: Item): string => it.label + (it.action ? '' : '   [BUILDING]') + (it.label === 'CONTINUE' ? (this.savedRun ? '   (SAVED RUN FOUND)' : '   (NO SAVE)') : '');
    // Widths as drawn: measureText is at scale 1, drawText applies OPTIONS > TEXT SIZE.
    const tsc = getTextScale();
    const widest = Math.max(...this.items.map((it) => measureText(labelOf(it), 15))) * tsc;
    const roomy = s.width >= 560 && cy + 4 + n * 26 < s.height - 60;
    let big = Math.min(72, s.width / 9);
    let fs = 15;
    let rowH = 26;
    let menuX = cx - 160;
    let logoY = cy - big * 1.9;
    let spellY = cy - big * 0.55 + 5;
    let spellFs = 12;
    let y = cy + 4;
    /** Menu columns (2 on a short, wide window such as a phone held sideways) and the second column's x. */
    let cols = 1;
    let colW = 0;
    if (!roomy) {
      const m = 12;
      spellFs = Math.max(6 / tsc, Math.min(12, (12 * (s.width - 2 * m)) / (measureText('BETA:  BALLISTIC ENGAGEMENT OF THREATENING ASTEROIDS', 12) * tsc)));
      const footH = 46;
      const want = this.keys.touchUsed ? 36 : 26;
      big = Math.min(big, s.height * 0.08);
      const block = big * 1.2 + spellFs * 4;
      const avail = s.height - 12 - block - footH;
      cols = avail / n < 18 && s.width >= 600 ? 2 : 1;
      const rows = Math.ceil(n / cols);
      colW = (s.width - 2 * m) / cols;
      rowH = Math.min(want, avail / rows);
      // The text fits the column's width and the row's height.
      fs = Math.max(6 / tsc, Math.min(15, (15 * (colW - 34)) / widest, (rowH - 3) / tsc));
      rowH = Math.max(rowH, fs * tsc + 3);
      menuX = cols === 1 ? Math.max(m + 22, cx - (widest * (fs / 15)) / 2) : m + 22;
      const total = block + rows * rowH + footH;
      logoY = Math.max(6, (s.height - total) / 2);
      spellY = logoY + big * 1.25;
      y = logoY + block + Math.max(0, (rowH - fs * tsc) / 2);
    }
    drawText(s, 'MISS ∝ β', cx, logoY, big, { align: 'center', glow: 2.2, color: ui.title, width: 2 });
    // The acronyms spelled out (owner 2026-10-18): the label in purple, the words in green, centred as one line.
    const spell = (tag: string, words: string, y: number): void => {
      const wTag = measureText(tag, spellFs) * tsc;
      const x0 = cx - (wTag + measureText(words, spellFs) * tsc) / 2;
      drawText(s, tag, x0, y, spellFs, { color: ui.sub, glow: 1 });
      drawText(s, words, x0 + wTag, y, spellFs, { color: p.ink });
    };
    spell('MISS:  ', 'MOMENTUM  IMPULSE  SAILS  SLINGSHOTS', spellY);
    spell('BETA:  ', 'BALLISTIC ENGAGEMENT OF THREATENING ASTEROIDS', spellY + spellFs * 1.6);

    this.itemRows.length = 0;
    const padTop = Math.max(4, (rowH - fs * tsc) / 2);
    const perCol = Math.ceil(n / cols);
    for (let i = 0; i < n; i++) {
      const it = this.items[i];
      if (!it) continue;
      const col = Math.floor(i / perCol);
      const ix = menuX + col * colW;
      const iy = y + (i % perCol) * rowH;
      const selected = i === this.sel;
      if (selected) drawText(s, '>', ix - 30 * (fs / 15), iy, fs + 1, { color: ui.sel, glow: 1.6 });
      const wdt = drawText(s, labelOf(it), ix, iy, fs, { color: selected ? ui.sel : it.action ? ui.text : ui.dim, glow: selected ? 1.5 : it.action ? 1 : 0 });
      this.itemRows.push({ x0: roomy ? ix - 40 : ix - 22, x1: roomy ? ix + wdt + 10 : cols === 1 ? s.width : ix - 22 + colW, y: iy, h: rowH, pad: padTop });
    }

    if (this.noteT > 0) drawText(s, this.note, cx, s.height - 90, 12, { align: 'center', color: p.hot, alpha: Math.min(1, this.noteT) });
    if (this.pendingRun && this.pendingRun.cheatsUsed.length > 0) drawText(s, `CODES FOR THE NEXT RUN: ${this.pendingRun.cheatsUsed.join(' ')}   MODE ${this.pendingRun.mode}`, cx, s.height - 64, 11, { align: 'center', color: p.hot, glow: 0.8 });
    const foot = this.keys.touchUsed ? `MISS β V${VERSION}   CREATED BY SPACED   TAP AN ITEM TO START` : `MISS β V${VERSION}   CREATED BY SPACED   ARROWS OR MOUSE SELECT   ENTER OR CLICK START   BACKQUOTE KEY: CONSOLE (CHEAT CODES)`;
    const coffee = 'SELF-FUNDED AND RUNS ON COFFEE: DONATIONS FOR COFFEE ARE WELCOME (HOW TO PLAY > CREDITS)';
    const fit = (t: string, size: number): number => Math.max(5 / tsc, Math.min(size, (size * (s.width - 16)) / (measureText(t, size) * tsc)));
    drawText(s, foot, cx, s.height - 40, fit(foot, 11), { align: 'center', color: p.dim, glow: 0 });
    drawText(s, coffee, cx, s.height - 22, fit(coffee, 9), { align: 'center', color: ui.sub, glow: 0 });
    this.console.render({ run: this.pendingRun ?? this.placeholderRun, round: null });
  }
}
