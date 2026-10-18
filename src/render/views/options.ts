// WHAT: OPTIONS screen (GAME_PLAN 13.1): color mode, CRT, glow, sound, units, reduce motion, text size, learning level.
// WHY:  The look and the accessibility knobs are the player's; everything here applies live and persists.
// HOW:  A row list; Up/Down select, Left/Right cycle the value and apply it at once; Esc returns. The
//       settings record is owned by main.ts and passed in so the CRT pass and screens share it.
// LORE: G8 (the look), G2 (screens and HUD)

import type { Router, Screen } from '../../game/screen';
import { topicForOption } from '../../game/loreLinks';
import { applySettings, AUTO_SPEED_LEVELS, INTERSTELLAR_RATES, COLOR_MODES, DEMO_LENGTH_LEVELS, cycle, GLOW_MODES, LEARNING_LEVELS, saveSettings, SOUND_STYLES, TEXT_SIZES, UNITS, VOICES, type Settings } from '../../game/settings';
import { voiceText, type VoiceId } from '../../audio/voice';
import type { Input } from '../../ui/input';
import type { Surface } from '../canvas';
import { uiColors } from '../palettes';
import { bind, bindableCode, codeLabel, defaultBindings, KEY_ACTIONS, loadBindings, remapFor, saveBindings, setBindings, type KeyBindings } from '../../game/keybinds';
import { drawText, drawTextFit, wrapText } from '../vectorFont';

interface Row {
  /** Section heading drawn beside the first row of each group (LOOK, SOUND, PLAY, RUNS, AUTOPLAY). */
  group: string;
  label: string;
  value: () => string;
  change: (dir: 1 | -1) => void;
  note: string;
}

export class OptionsScreen implements Screen {
  private sel = 0;
  /** Mouse targets from the last frame: each row's y and where the values start. */
  private rowYs: number[] = [];
  private valueX = 0;
  /** Set by main: open the Learning Center on a topic (Esc there returns here). */
  openCenter: ((id: string) => void) | null = null;
  /** Set by main: speak a voice line (the VOICE row plays a sample on change). */
  sayVoice: ((id: VoiceId) => void) | null = null;
  private readonly rows: Row[];
  /** OPTIONS > KEYS: open, the selected action, and whether the next key press binds it. */
  private keysOpen = false;
  private keySel = 0;
  private waiting = false;
  private bindings: KeyBindings = loadBindings();
  constructor(private readonly s: Surface, private readonly keys: Input, private readonly router: Router, private readonly settings: Settings) {
    const st = settings;
    this.rows = [
      { group: 'LOOK', label: 'COLOR MODE', value: () => st.colorMode, change: (d) => (st.colorMode = cycle(COLOR_MODES, st.colorMode, d)), note: 'PHOSPHOR IS THE DEFAULT TERMINAL GREEN. DAYLIGHT IS DARK INK ON PAPER, NO GLOW.' },
      { group: 'LOOK', label: 'COLOUR ACCENTS', value: () => (st.spectrum ? 'NEON' : 'MONO'), change: () => (st.spectrum = !st.spectrum), note: 'MONO: ONE PHOSPHOR COLOUR, THE CLASSIC LOOK. NEON: ORBITS BLUE, THREAT AMBER, CRAFT CYAN, FRAGMENTS PINK, PROGRAMS PURPLE, SAILS ACID. EACH ALSO KEEPS ITS OWN LINE STYLE.' },
      { group: 'LOOK', label: 'GLOW', value: () => st.glow.toUpperCase(), change: (d) => (st.glow = cycle(GLOW_MODES, st.glow, d)), note: 'UNDERSTROKE IS A WIDE FAINT LINE UNDER EVERY STROKE (CHEAP). SHADOW USES CANVAS BLUR (SOFTER, SLOWER).' },
      { group: 'LOOK', label: 'CRT EFFECTS', value: () => (st.crt ? 'ON' : 'OFF'), change: () => (st.crt = !st.crt), note: 'SCANLINES, VIGNETTE AND A FAINT FLICKER OVER THE WHOLE FRAME.' },
      { group: 'LOOK', label: 'TEXT SIZE', value: () => st.textSize, change: (d) => (st.textSize = cycle(TEXT_SIZES, st.textSize, d)), note: 'SCALES EVERY LABEL. LARGE MAY WRAP LONG READOUTS OFF SCREEN ON NARROW WINDOWS.' },
      { group: 'LOOK', label: 'REDUCE MOTION', value: () => (st.reduceMotion ? 'ON' : 'OFF'), change: () => (st.reduceMotion = !st.reduceMotion), note: 'NO FLICKER, NO GLITCH TEARS, NO SWEEPS.' },
      { group: 'SOUND', label: 'SOUND', value: () => (st.sound ? 'ON' : 'OFF'), change: () => (st.sound = !st.sound), note: 'INTERFACE BLEEPS AND EVENT SOUNDS IN THE MAIN GAME. THE ARCADE MODE HAS ITS OWN SWITCH (KEY 4).' },
      { group: 'SOUND', label: 'SOUND STYLE', value: () => st.soundStyle ?? 'ARCADE', change: (d) => (st.soundStyle = cycle(SOUND_STYLES, st.soundStyle ?? 'ARCADE', d)), note: 'ARCADE: THE LOW LO-FI VOICES BORROWED FROM PERIMETER FOR MENUS, LAUNCHES AND IMPACTS. CLASSIC: THE ORIGINAL SOFT BLEEPS.' },
      { group: 'SOUND', label: 'VOICE', value: () => st.voice ?? 'FEMALE', change: (d) => { st.voice = cycle(VOICES, st.voice ?? 'FEMALE', d); this.sayVoice?.('PLAY_A_GAME'); }, note: 'A LO-FI ROBOT MISSION VOICE FOR BIG MOMENTS: FEMALE, MALE, TERMINAL (HEAVY VOCODER), COMPUTER (CLEAN), MAINFRAME (DEEP, SLOW), TOY (8-BIT). KOKORO TTS (APACHE-2.0) THROUGH A VOCODER.' },
      { group: 'SOUND', label: 'VOICE TEST', value: () => 'PLAY', change: () => this.sayVoice?.('PLAY_A_GAME'), note: `ENTER TO HEAR THE VOICE SAY: "${voiceText('PLAY_A_GAME').toUpperCase()}"  (SILENT WHEN VOICE IS OFF)` },
      { group: 'PLAY', label: 'TIPS', value: () => (st.tips === false ? 'OFF' : 'ON'), change: () => (st.tips = st.tips === false), note: 'A SHORT TIP UNDER THE HUD WHILE YOU PLAN, MATCHED TO WHAT IS HAPPENING. NEVER DURING A CINEMATIC.' },
      { group: 'PLAY', label: 'LEARNING LEVEL', value: () => st.learningLevel, change: (d) => (st.learningLevel = cycle(LEARNING_LEVELS, st.learningLevel, d)), note: 'HOW THE LORE PANEL EXPLAINS THINGS (LEARNING CENTER, M9): PICTURES, PLAIN WORDS, SOME MATH, FORMULAS, EVERYTHING.' },
      { group: 'PLAY', label: 'UNITS', value: () => st.units, change: (d) => (st.units = cycle(UNITS, st.units, d)), note: 'DISPLAY ONLY. THE SIMULATION IS SI INSIDE. IMPERIAL SHOWS MILES AND MPH WHERE A READOUT SUPPORTS IT.' },
      { group: 'PLAY', label: 'KEYS', value: () => 'ASSIGN', change: () => (this.keysOpen = true), note: 'REBIND THE GAME KEYS. MANUAL IS M BY DEFAULT (FUNCTION KEYS ARE AWKWARD ON MAC KEYBOARDS); BIND IT TO F1 IF YOU LIKE.' },
      { group: 'RUNS', label: 'INTERSTELLAR RATE', value: () => st.interstellarRate ?? 'REAL', change: (d) => (st.interstellarRate = cycle(INTERSTELLAR_RATES, st.interstellarRate ?? 'REAL', d)), note: 'VISITORS FROM OTHER STARS IN REALISTIC RUNS. REAL: THE TRUE RATE, EFFECTIVELY NEVER. ELEVATED 2 %, FREQUENT 10 %, STORM 30 % OF ROUNDS: THE GAME EXAGGERATES ON PURPOSE AND STAMPS THE RUN EXAGGERATED.' },
      { group: 'RUNS', label: 'SCI-FI VISITORS', value: () => st.scifiVisitors ?? 'RARE', change: () => (st.scifiVisitors = (st.scifiVisitors ?? 'RARE') === 'RARE' ? 'COMMON' : 'RARE'), note: 'HOW OFTEN A SCI-FI ROUND IS A VISITOR FROM ANOTHER STAR. RARE (3 %) WHILE THE DEFENCES AGAINST STEEP ARRIVALS ARE BUILT; COMMON (30 %) FOR A HARD RUN: MOST OF THEM CANNOT BE REACHED YET.' },
      { group: 'RUNS', label: 'EXPERIMENTAL TECH', value: () => (st.experimental ? 'ON' : 'OFF'), change: () => (st.experimental = !st.experimental), note: 'OFFERS THE EXPERIMENTAL FEASIBILITY STUDIES (FUSION LINES) IN REALISTIC RUNS: PHYSICS SEEN IN A LAB, NO PATH TO A FLIGHT UNIT YET. LONG, COSTLY, LIKELY TO FAIL. ALWAYS ON IN SCI-FI.' },
      { group: 'AUTOPLAY', label: 'AUTOPLAY SPEED', value: () => st.autoSpeed ?? 'NORMAL', change: (d) => (st.autoSpeed = cycle(AUTO_SPEED_LEVELS, st.autoSpeed ?? 'NORMAL', d)), note: 'HOW FAST AUTOPLAY READS ITS PANES AND RUNS THE CLOCK. SLOW IS THE FIRST PACE, NORMAL 1.5X, FAST 2.25X. - AND = CHANGE IT WHILE IT PLAYS.' },
      { group: 'AUTOPLAY', label: 'DEMO LENGTH', value: () => ({ SHORT: 'SHORT (2-3 MIN)', MEDIUM: 'MEDIUM (5 MIN)', LONG: 'LONG (10 MIN)' })[st.demoLength ?? 'MEDIUM'], change: (d) => (st.demoLength = cycle(DEMO_LENGTH_LEVELS, st.demoLength ?? 'MEDIUM', d)), note: 'SUPER-DUPER-DEMO: HOW LONG THE FASTER-AND-FASTER GAMES RUN BEFORE THE FINALE (TIMED BY THE CLOCK).' },
    ];
  }
  enter(): void {}
  exit(): void {
    saveSettings(this.settings);
  }
  private applyBindings(b: KeyBindings): void {
    this.bindings = b;
    saveBindings(b);
    setBindings(b);
    this.keys.remap = remapFor(b);
  }

  private updateKeys(): void {
    const k = this.keys;
    const n = KEY_ACTIONS.length;
    if (this.waiting) {
      if (k.pressed('Escape')) this.waiting = false;
      else if (k.anyKeyPressed() && bindableCode(k.lastRaw)) {
        const a = KEY_ACTIONS[this.keySel];
        if (a) this.applyBindings(bind(this.bindings, a.id, k.lastRaw));
        this.waiting = false;
      }
      return;
    }
    if (k.pressed('Escape')) {
      this.keysOpen = false;
      return;
    }
    if (k.pressed('ArrowUp')) this.keySel = (this.keySel + n - 1) % n;
    if (k.pressed('ArrowDown')) this.keySel = (this.keySel + 1) % n;
    const click = k.takeClick();
    if (click) {
      const i = this.rowYs.findIndex((y) => click.y >= y - 4 && click.y < y + 18);
      if (i >= 0) {
        if (i === this.keySel) this.waiting = true;
        this.keySel = i;
      }
    }
    if (k.pressed('Enter')) this.waiting = true;
    if (k.pressed('Backspace')) {
      const a = KEY_ACTIONS[this.keySel];
      if (a) this.applyBindings(bind(this.bindings, a.id, a.def));
    }
    if (k.pressed('Delete')) this.applyBindings(defaultBindings());
  }

  private renderKeys(): void {
    const s = this.s;
    const ui = uiColors(s.palette, s.spectrum);
    const m = 24;
    s.clear();
    drawText(s, 'OPTIONS  KEYS', s.width / 2, m + 6, 20, { align: 'center', color: ui.title, glow: 1.5 });
    const x = Math.max(m, s.width / 2 - 260);
    const step = Math.max(18, Math.min(26, (s.height - 170) / KEY_ACTIONS.length));
    let y = m + 50;
    this.rowYs = [];
    KEY_ACTIONS.forEach((a, i) => {
      this.rowYs.push(y);
      const sel = i === this.keySel;
      const code = this.bindings[a.id] ?? a.def;
      if (sel) drawText(s, '>', x - 22, y, 12, { color: ui.sel, glow: 1.6 });
      drawText(s, a.label, x, y, 12, { color: sel ? ui.sel : ui.text, glow: sel ? 1.6 : 0.6 });
      const val = sel && this.waiting ? 'PRESS A KEY...' : codeLabel(code) + (code === a.def ? '' : `   (DEFAULT ${codeLabel(a.def)})`);
      drawText(s, val, x + 300, y, 12, { color: sel ? ui.sel : ui.sub, glow: sel ? 1.6 : 0.6 });
      y += step;
    });
    drawTextFit(s, 'UP / DOWN SELECT    ENTER OR CLICK THEN PRESS A KEY    BACKSPACE DEFAULT    DELETE RESET ALL    ESC BACK    A KEY ALREADY IN USE SWAPS', s.width / 2, s.height - m - 12, 11, s.width - 32, { align: 'center', color: ui.dim, glow: 0 });
  }

  update(): void {
    const k = this.keys;
    if (this.keysOpen) {
      this.updateKeys();
      return;
    }
    if (k.pressed('Escape') || k.pressed('KeyO')) {
      this.router.go('title');
      return;
    }
    if ((k.pressed('KeyL') || k.pressed('Slash')) && this.openCenter) {
      const r = this.rows[this.sel];
      this.openCenter(topicForOption(r?.label ?? ''));
      return;
    }
    if (k.pressed('ArrowUp')) this.sel = (this.sel + this.rows.length - 1) % this.rows.length;
    if (k.pressed('ArrowDown')) this.sel = (this.sel + 1) % this.rows.length;
    const row = this.rows[this.sel];
    if (!row) return;
    let changed = false;
    const click = k.takeClick();
    if (click) {
      const i = this.rowYs.findIndex((y) => click.y >= y - 6 && click.y < y + 24);
      const r = i >= 0 ? this.rows[i] : undefined;
      if (r) {
        this.sel = i;
        if (click.x >= this.valueX - 10) {
          r.change(click.x < this.valueX + 60 ? -1 : 1);
          changed = true;
        }
      }
    }
    if (k.pressed('ArrowLeft')) {
      row.change(-1);
      changed = true;
    }
    if (k.pressed('ArrowRight') || k.pressed('Enter') || k.pressed('Space')) {
      row.change(1);
      changed = true;
    }
    if (changed) {
      applySettings(this.settings, this.s);
      saveSettings(this.settings);
    }
  }
  render(): void {
    if (this.keysOpen) {
      this.renderKeys();
      return;
    }
    const s = this.s;
    const p = s.palette;
    s.clear();
    const m = 24;
    const ui = uiColors(p, s.spectrum);
    drawText(s, 'OPTIONS', s.width / 2, m + 6, 20, { align: 'center', color: ui.title, glow: 1.5 });
    let y = m + 60;
    const x = Math.max(m, s.width / 2 - 320);
    this.rowYs = [];
    this.valueX = x + 300;
    const groups = new Set(this.rows.map((r) => r.group)).size;
    const step = Math.max(22, Math.min(32, (s.height - 230 - groups * 8) / this.rows.length));
    this.rows.forEach((r, i) => {
      // A small gap and a dim heading where a new group starts.
      if (i > 0 && this.rows[i - 1]?.group !== r.group) y += 8;
      if (i === 0 || this.rows[i - 1]?.group !== r.group) drawText(s, r.group, x - 140, y + 2, 10, { color: ui.dim, glow: 0 });
      this.rowYs.push(y);
      const sel = i === this.sel;
      if (sel) drawText(s, '>', x - 24, y, 14, { color: ui.sel, glow: 1.6 });
      drawText(s, r.label, x, y, 14, { color: sel ? ui.sel : ui.text, glow: sel ? 1.6 : 0.8 });
      drawText(s, `<  ${r.value()}  >`, x + 300, y, 14, { color: sel ? ui.sel : ui.sub, glow: sel ? 1.6 : 0.8 });
      y += step;
    });
    const row = this.rows[this.sel];
    if (row) wrapText(row.note, Math.min(900, s.width - 64), 10).slice(0, 3).forEach((l, i) => drawText(s, l, s.width / 2, y + 16 + i * 14, 10, { align: 'center', color: ui.head, glow: 0 }));
    drawTextFit(s, 'UP / DOWN SELECT    LEFT / RIGHT OR CLICK CHANGE    <L> LEARN ABOUT THIS    <ESC> BACK    SAVED AUTOMATICALLY', s.width / 2, s.height - m - 12, 11, s.width - 32, { align: 'center', color: p.dim, glow: 0 });
  }
}
