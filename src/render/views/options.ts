// WHAT: OPTIONS screen (GAME_PLAN 13.1): color mode, CRT, glow, sound, units, reduce motion, text size, learning level.
// WHY:  The look and the accessibility knobs are the player's; everything here applies live and persists.
// HOW:  A row list; Up/Down select, Left/Right cycle the value and apply it at once; Esc returns. The
//       settings record is owned by main.ts and passed in so the CRT pass and screens share it.
// LORE: G8 (the look), G2 (screens and HUD)

import type { Router, Screen } from '../../game/screen';
import { topicForOption } from '../../game/loreLinks';
import { applySettings, COLOR_MODES, cycle, GLOW_MODES, LEARNING_LEVELS, saveSettings, TEXT_SIZES, UNITS, type Settings } from '../../game/settings';
import type { Input } from '../../ui/input';
import type { Surface } from '../canvas';
import { drawText, drawTextFit } from '../vectorFont';

interface Row {
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
  private readonly rows: Row[];
  constructor(private readonly s: Surface, private readonly keys: Input, private readonly router: Router, private readonly settings: Settings) {
    const st = settings;
    this.rows = [
      { label: 'COLOR MODE', value: () => st.colorMode, change: (d) => (st.colorMode = cycle(COLOR_MODES, st.colorMode, d)), note: 'PHOSPHOR IS THE DEFAULT TERMINAL GREEN. DAYLIGHT IS DARK INK ON PAPER, NO GLOW.' },
      { label: 'COLOUR', value: () => (st.spectrum ? 'NEON' : 'MONO'), change: () => (st.spectrum = !st.spectrum), note: 'MONO: ONE PHOSPHOR COLOUR, THE CLASSIC LOOK. NEON: ORBITS BLUE, THREAT AMBER, CRAFT CYAN, FRAGMENTS PINK, PROGRAMS PURPLE, SAILS ACID. EACH ALSO KEEPS ITS OWN LINE STYLE.' },
      { label: 'TIPS', value: () => (st.tips === false ? 'OFF' : 'ON'), change: () => (st.tips = st.tips === false), note: 'A SHORT TIP UNDER THE HUD WHILE YOU PLAN, MATCHED TO WHAT IS HAPPENING. NEVER DURING A CINEMATIC.' },
      { label: 'CRT EFFECTS', value: () => (st.crt ? 'ON' : 'OFF'), change: () => (st.crt = !st.crt), note: 'SCANLINES, VIGNETTE AND A FAINT FLICKER OVER THE WHOLE FRAME.' },
      { label: 'GLOW', value: () => st.glow.toUpperCase(), change: (d) => (st.glow = cycle(GLOW_MODES, st.glow, d)), note: 'UNDERSTROKE IS A WIDE FAINT LINE UNDER EVERY STROKE (CHEAP). SHADOW USES CANVAS BLUR (SOFTER, SLOWER).' },
      { label: 'SOUND', value: () => (st.sound ? 'ON' : 'OFF'), change: () => (st.sound = !st.sound), note: 'INTERFACE BLEEPS AND EVENT SOUNDS IN THE MAIN GAME. THE ARCADE MODE HAS ITS OWN SWITCH (KEY 4).' },
      { label: 'UNITS', value: () => st.units, change: (d) => (st.units = cycle(UNITS, st.units, d)), note: 'DISPLAY ONLY. THE SIMULATION IS SI INSIDE. IMPERIAL SHOWS MILES AND MPH WHERE A READOUT SUPPORTS IT.' },
      { label: 'REDUCE MOTION', value: () => (st.reduceMotion ? 'ON' : 'OFF'), change: () => (st.reduceMotion = !st.reduceMotion), note: 'NO FLICKER, NO GLITCH TEARS, NO SWEEPS.' },
      { label: 'TEXT SIZE', value: () => st.textSize, change: (d) => (st.textSize = cycle(TEXT_SIZES, st.textSize, d)), note: 'SCALES EVERY LABEL. LARGE MAY WRAP LONG READOUTS OFF SCREEN ON NARROW WINDOWS.' },
      { label: 'LEARNING LEVEL', value: () => st.learningLevel, change: (d) => (st.learningLevel = cycle(LEARNING_LEVELS, st.learningLevel, d)), note: 'HOW THE LORE PANEL EXPLAINS THINGS (LEARNING CENTER, M9): PICTURES, PLAIN WORDS, SOME MATH, FORMULAS, EVERYTHING.' },
    ];
  }
  enter(): void {}
  exit(): void {
    saveSettings(this.settings);
  }
  update(): void {
    const k = this.keys;
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
    const s = this.s;
    const p = s.palette;
    s.clear();
    const m = 24;
    drawText(s, 'OPTIONS', s.width / 2, m + 6, 20, { align: 'center', color: p.hot, glow: 1.5 });
    let y = m + 60;
    const x = Math.max(m, s.width / 2 - 320);
    this.rowYs = [];
    this.valueX = x + 300;
    this.rows.forEach((r, i) => {
      this.rowYs.push(y);
      const sel = i === this.sel;
      if (sel) drawText(s, '>', x - 24, y, 14, { color: p.hot, glow: 1.5 });
      drawText(s, r.label, x, y, 14, { color: sel ? p.hot : p.ink, glow: sel ? 1.2 : 0.8 });
      drawText(s, `<  ${r.value()}  >`, x + 300, y, 14, { color: sel ? p.hot : p.ink, glow: sel ? 1.2 : 0.8 });
      y += 34;
    });
    const row = this.rows[this.sel];
    if (row) drawText(s, row.note, s.width / 2, y + 20, 10, { align: 'center', color: p.dim, glow: 0 });
    drawTextFit(s, 'UP / DOWN SELECT    LEFT / RIGHT OR CLICK CHANGE    <L> LEARN ABOUT THIS    <ESC> BACK    SAVED AUTOMATICALLY', s.width / 2, s.height - m - 12, 11, s.width - 32, { align: 'center', color: p.dim, glow: 0 });
  }
}
