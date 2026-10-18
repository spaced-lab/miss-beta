// WHAT: Player options (GAME_PLAN 13.1 OPTIONS): color mode, CRT, glow, sound, units, reduce motion, text size.
// WHY:  One validated record in localStorage; every renderer reads it through `applySettings` so a change
//       on the options screen takes effect without a reload.
// HOW:  Plain data with a type guard (persistence.ts). `applySettings` pushes the palette, glow mode and
//       text scale into the shared Surface and the font module. Units and the learning level are stored
//       here for M9 to use.
// LORE: G8 (the look), G2 (screens and HUD)

import { PALETTES, type ColorMode } from '../render/palettes';
import type { GlowMode, Surface } from '../render/canvas';
import { setTextScale } from '../render/vectorFont';
import { loadJson, saveJson } from './persistence';

export type TextSize = 'SMALL' | 'NORMAL' | 'LARGE';
export type Units = 'SI' | 'IMPERIAL';
export type LearningLevel = 'SIMPLE' | 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';

export interface Settings {
  colorMode: ColorMode;
  crt: boolean;
  glow: GlowMode;
  sound: boolean;
  units: Units;
  reduceMotion: boolean;
  textSize: TextSize;
  learningLevel: LearningLevel;
}

export const COLOR_MODES: readonly ColorMode[] = ['PHOSPHOR', 'AMBER', 'ICE', 'VAPOR', 'BLACKLIGHT', 'HOLO', 'DAYLIGHT'];
export const GLOW_MODES: readonly GlowMode[] = ['understroke', 'shadow', 'none'];
export const TEXT_SIZES: readonly TextSize[] = ['SMALL', 'NORMAL', 'LARGE'];
export const UNITS: readonly Units[] = ['SI', 'IMPERIAL'];
export const LEARNING_LEVELS: readonly LearningLevel[] = ['SIMPLE', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];
const TEXT_SCALE: Record<TextSize, number> = { SMALL: 0.9, NORMAL: 1, LARGE: 1.15 };

export const DEFAULT_SETTINGS: Settings = { colorMode: 'PHOSPHOR', crt: false, glow: 'understroke', sound: true, units: 'SI', reduceMotion: false, textSize: 'NORMAL', learningLevel: 'BEGINNER' };

const KEY = 'settings';

export function isSettings(v: unknown): v is Settings {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    COLOR_MODES.includes(o.colorMode as ColorMode) &&
    typeof o.crt === 'boolean' &&
    GLOW_MODES.includes(o.glow as GlowMode) &&
    typeof o.sound === 'boolean' &&
    UNITS.includes(o.units as Units) &&
    typeof o.reduceMotion === 'boolean' &&
    TEXT_SIZES.includes(o.textSize as TextSize) &&
    LEARNING_LEVELS.includes(o.learningLevel as LearningLevel)
  );
}

export function loadSettings(): Settings {
  return { ...loadJson(KEY, isSettings, DEFAULT_SETTINGS) };
}

export function saveSettings(st: Settings): void {
  saveJson(KEY, st);
}

/** Push the settings into the renderer: palette, glow mode, text scale. */
export function applySettings(st: Settings, s: Surface): void {
  s.palette = PALETTES[st.colorMode];
  s.glowMode = st.glow;
  setTextScale(TEXT_SCALE[st.textSize]);
}

/** Cycle a list value forward or back (the options screen's Left/Right). */
export function cycle<T>(list: readonly T[], cur: T, dir: 1 | -1): T {
  const i = list.indexOf(cur);
  return list[(i + dir + list.length) % list.length] as T;
}
