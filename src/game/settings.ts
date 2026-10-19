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
import type { SoundStyle } from '../audio/ui';

export type TextSize = 'SMALL' | 'NORMAL' | 'LARGE';
export type Units = 'SI' | 'IMPERIAL';
/** Robot voices: each is one baked clip folder, public/audio/voice/<lower case name>/ (scripts/gen_voice.py). */
export type VoiceSetting = 'OFF' | 'FEMALE' | 'MALE' | 'TERMINAL' | 'COMPUTER' | 'MAINFRAME' | 'TOY' | 'NARRATOR' | 'RADIO';
/** AUTOPLAY pace (owner 2026-10-18): SLOW is the first pace, NORMAL 1.5x, FAST 2.25x (knobs AUTO_SPEEDS). */
export type AutoSpeed = 'SLOW' | 'NORMAL' | 'FAST';
/** SUPER-DUPER-DEMO length before the finale: about 1, 2.5 or 5 minutes (knobs DEMO_LENGTHS). */
export type DemoLength = 'SHORT' | 'MEDIUM' | 'LONG';
/** Visitors from other stars per REALISTIC round (KNOBS.INTERSTELLAR_RATES); above REAL marks the run EXAGGERATED. */
export type InterstellarRate = 'REAL' | 'ELEVATED' | 'FREQUENT' | 'STORM';
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
  /** SPECTRUM layer (24.1): unlocked by the first clean miss, then a toggle. */
  spectrum: boolean;
  /** In-game tips line in the HUD (2026-10-18). Optional so older saved settings stay valid. */
  tips?: boolean;
  /** 2 once the NEON-default migration ran (2026-10-18); older records get NEON once, then keep the choice. */
  colourV?: number;
  /** Robot voice-overs (IDEAS 21, 2026-10-18). Optional so older saved settings stay valid; missing means FEMALE. */
  voice?: VoiceSetting;
  /** Interface sounds: PERIMETER's lo-fi voices (ARCADE, default) or the original bleeps. Optional for old records. */
  soundStyle?: SoundStyle;
  /** AUTOPLAY pace; optional for old records, missing means NORMAL. */
  autoSpeed?: AutoSpeed;
  /** SUPER-DUPER-DEMO length; optional for old records, missing means MEDIUM (2.5 minutes). */
  demoLength?: DemoLength;
  /** True once the photosensitivity notice on the title screen was acknowledged (optional for old records). */
  photoAck?: boolean;
  /** EXPERIMENTAL feasibility studies (fusion lines) offered in REALISTIC runs; off by default. */
  experimental?: boolean;
  /** OPTIONS INTERSTELLAR RATE; missing means REAL. */
  interstellarRate?: InterstellarRate;
  /** SCI-FI share of visitors from other stars (KNOBS.SCIFI_VISITOR_SHARES); missing means RARE. */
  scifiVisitors?: 'RARE' | 'COMMON';
}

export const AUTO_SPEED_LEVELS: readonly AutoSpeed[] = ['SLOW', 'NORMAL', 'FAST'];
export const DEMO_LENGTH_LEVELS: readonly DemoLength[] = ['SHORT', 'MEDIUM', 'LONG'];
export const INTERSTELLAR_RATES: readonly InterstellarRate[] = ['REAL', 'ELEVATED', 'FREQUENT', 'STORM'];
export const SOUND_STYLES: readonly SoundStyle[] = ['ARCADE', 'CLASSIC'];
export const COLOR_MODES: readonly ColorMode[] = ['PHOSPHOR', 'AMBER', 'ICE', 'VAPOR', 'BLACKLIGHT', 'HOLO', 'DAYLIGHT'];
export const GLOW_MODES: readonly GlowMode[] = ['understroke', 'shadow', 'none'];
export const TEXT_SIZES: readonly TextSize[] = ['SMALL', 'NORMAL', 'LARGE'];
export const UNITS: readonly Units[] = ['SI', 'IMPERIAL'];
export const VOICES: readonly VoiceSetting[] = ['OFF', 'FEMALE', 'MALE', 'TERMINAL', 'COMPUTER', 'MAINFRAME', 'TOY', 'NARRATOR', 'RADIO'];
export const LEARNING_LEVELS: readonly LearningLevel[] = ['SIMPLE', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];
const TEXT_SCALE: Record<TextSize, number> = { SMALL: 0.9, NORMAL: 1, LARGE: 1.15 };

export const DEFAULT_SETTINGS: Settings = { colorMode: 'PHOSPHOR', crt: false, glow: 'understroke', sound: true, units: 'SI', reduceMotion: false, textSize: 'NORMAL', learningLevel: 'BEGINNER', spectrum: true, colourV: 2, voice: 'FEMALE', soundStyle: 'ARCADE' };

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
    LEARNING_LEVELS.includes(o.learningLevel as LearningLevel) &&
    (o.spectrum === undefined || typeof o.spectrum === 'boolean') &&
    (o.tips === undefined || typeof o.tips === 'boolean') &&
    (o.colourV === undefined || typeof o.colourV === 'number') &&
    (o.voice === undefined || VOICES.includes(o.voice as VoiceSetting)) &&
    (o.soundStyle === undefined || SOUND_STYLES.includes(o.soundStyle as SoundStyle)) &&
    (o.autoSpeed === undefined || AUTO_SPEED_LEVELS.includes(o.autoSpeed as AutoSpeed)) &&
    (o.demoLength === undefined || DEMO_LENGTH_LEVELS.includes(o.demoLength as DemoLength)) &&
    (o.photoAck === undefined || typeof o.photoAck === 'boolean') &&
    (o.experimental === undefined || typeof o.experimental === 'boolean') &&
    (o.interstellarRate === undefined || INTERSTELLAR_RATES.includes(o.interstellarRate as InterstellarRate)) &&
    (o.scifiVisitors === undefined || o.scifiVisitors === 'RARE' || o.scifiVisitors === 'COMMON')
  );
}

export function loadSettings(): Settings {
  const saved = loadJson(KEY, isSettings, DEFAULT_SETTINGS);
  const st = { ...DEFAULT_SETTINGS, ...saved };
  // NOTE: NEON became the default on 2026-10-18; a record saved before that switches to NEON once.
  if (saved.colourV !== 2) {
    st.spectrum = true;
    st.colourV = 2;
  }
  return st;
}

export const SPECTRUM_UNLOCK_KEY = 'spectrum.unlocked';
export function spectrumUnlocked(): boolean {
  return loadJson(SPECTRUM_UNLOCK_KEY, (v): v is boolean => typeof v === 'boolean', false);
}
export function unlockSpectrum(): boolean {
  if (spectrumUnlocked()) return false;
  saveJson(SPECTRUM_UNLOCK_KEY, true);
  return true;
}

export function saveSettings(st: Settings): void {
  saveJson(KEY, st);
}

/** Push the settings into the renderer: palette, glow mode, text scale. */
export function applySettings(st: Settings, s: Surface): void {
  s.palette = PALETTES[st.colorMode];
  s.glowMode = st.glow;
  // NEON colours are a plain choice since 2026-10-18 (owner): no unlock, and NEON is the default.
  s.spectrum = st.spectrum;
  setTextScale(TEXT_SCALE[st.textSize]);
}

/** Cycle a list value forward or back (the options screen's Left/Right). */
export function cycle<T>(list: readonly T[], cur: T, dir: 1 | -1): T {
  const i = list.indexOf(cur);
  return list[(i + dir + list.length) % list.length] as T;
}
