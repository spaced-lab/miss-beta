// WHAT: Color modes (GAME_PLAN Section 24.1) as data, plus the semantic color layer (SPECTRUM).
// WHY:  Lines, glow, no fills, always. Within that rule the game grows from a monochrome terminal into a
//       holographic instrument. Keeping palettes as data means a new mode is a `good first issue`.
// HOW:  Every mode defines bg / ink / dim / hot. SPECTRUM is a layer: when enabled, semantic roles
//       (threat, craft, fragment, ...) get their own hue; otherwise they all resolve to `ink`.
//       HOLO is listed but its iridescent strokes are a renderer feature (M10), not a palette entry.
// LORE: G8 (the look)

export type ColorMode = 'PHOSPHOR' | 'AMBER' | 'ICE' | 'VAPOR' | 'BLACKLIGHT' | 'HOLO' | 'DAYLIGHT';

/** Semantic roles. With SPECTRUM off every role maps to the mode's ink. */
export type Role = 'threat' | 'danger' | 'craft' | 'fragment' | 'program' | 'sail' | 'nuclear' | 'planet' | 'text';

export interface Palette {
  readonly name: ColorMode;
  readonly bg: string;
  readonly ink: string;
  readonly dim: string;
  readonly hot: string;
  /** Secondary ink for two-tone modes (VAPOR, BLACKLIGHT). Falls back to ink. */
  readonly alt?: string;
  /** DAYLIGHT draws no glow and slightly thicker lines. */
  readonly glow: boolean;
  readonly lineWidth: number;
}

import palettesJson from '../config/palettes.json';

const RAW = palettesJson as { modes: Record<string, { bg: string; ink: string; dim: string; hot: string; alt?: string; glow: boolean; lineWidth: number }>; spectrum: Record<Role, string>; roleStyle: Record<Role, { dash: number[]; marker: string }> };

/** Palettes are data (GAME_PLAN 24.4): config/palettes.json, typed here. */
export const PALETTES: Readonly<Record<ColorMode, Palette>> = Object.fromEntries(
  (Object.keys(RAW.modes) as ColorMode[]).map((name) => {
    const m = RAW.modes[name] as (typeof RAW.modes)[string];
    return [name, { name, bg: m.bg, ink: m.ink, dim: m.dim, hot: m.hot, ...(m.alt ? { alt: m.alt } : {}), glow: m.glow, lineWidth: m.lineWidth }];
  }),
) as Record<ColorMode, Palette>;

export const SPECTRUM: Readonly<Record<Role, string>> = RAW.spectrum;

/** Each semantic role is paired with a line style (dash pattern, marker) so colour is never the only cue. */
export const ROLE_STYLE: Readonly<Record<Role, { dash: readonly number[]; marker: string }>> = RAW.roleStyle;

export function roleColor(p: Palette, role: Role, spectrum: boolean): string {
  // DAYLIGHT keeps dark ink: the spectrum hues are tuned for dark backgrounds (24.1: "a layer on any dark mode").
  return spectrum && p.glow ? SPECTRUM[role] : p.ink;
}

/** Relative luminance (WCAG 2) of a #RRGGBB colour. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours (1 to 21). Example: #33FF33 on #000000 -> about 15.3. */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** HOLO: iridescent hue along a path (160 -> 300 deg) plus a slow drift, as an hsl string. */
export function holoHue(frac: number, drift: number): string {
  return `hsl(${(160 + 140 * frac + drift) % 360} 100% 70%)`;
}

/** Parse "#RRGGBB" into [r, g, b]. Used by the glow under-stroke to build rgba() variants. */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}
