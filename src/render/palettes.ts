// WHAT: Color modes (GAME_PLAN Section 24.1) as data, plus the semantic color layer (SPECTRUM).
// WHY:  Lines, glow, no fills, always. Within that rule the game grows from a monochrome terminal into a
//       holographic instrument. Keeping palettes as data means a new mode is a `good first issue`.
// HOW:  Every mode defines bg / ink / dim / hot. SPECTRUM is a layer: when enabled, semantic roles
//       (threat, craft, fragment, ...) get their own hue; otherwise they all resolve to `ink`.
//       HOLO is listed but its iridescent strokes are a renderer feature (M10), not a palette entry.
// LORE: G8 (the look)

export type ColorMode = 'PHOSPHOR' | 'AMBER' | 'ICE' | 'VAPOR' | 'BLACKLIGHT' | 'HOLO' | 'DAYLIGHT';

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

export const PALETTES: Readonly<Record<ColorMode, Palette>> = {
  PHOSPHOR:   { name: 'PHOSPHOR',   bg: '#000000', ink: '#33FF33', dim: '#0B4D0B', hot: '#B6FFB6', glow: true,  lineWidth: 1.25 },
  AMBER:      { name: 'AMBER',      bg: '#0A0600', ink: '#FFB000', dim: '#4A3000', hot: '#FFE2A0', glow: true,  lineWidth: 1.25 },
  ICE:        { name: 'ICE',        bg: '#00060C', ink: '#7DF9FF', dim: '#0A3A44', hot: '#E0FFFF', glow: true,  lineWidth: 1.25 },
  VAPOR:      { name: 'VAPOR',      bg: '#05000A', ink: '#FF71CE', dim: '#3A0A3A', hot: '#FFFFFF', alt: '#01CDFE', glow: true, lineWidth: 1.25 },
  BLACKLIGHT: { name: 'BLACKLIGHT', bg: '#050008', ink: '#BF5FFF', dim: '#2A0A40', hot: '#F0E0FF', alt: '#CCFF00', glow: true, lineWidth: 1.25 },
  HOLO:       { name: 'HOLO',       bg: '#02030A', ink: '#5FF5D0', dim: '#0E2A3A', hot: '#FFFFFF', glow: true,  lineWidth: 1.25 },
  DAYLIGHT:   { name: 'DAYLIGHT',   bg: '#F2F5F3', ink: '#0B3D0B', dim: '#B8CCB8', hot: '#000000', glow: false, lineWidth: 1.5 },
};

/** Semantic roles. With SPECTRUM off every role maps to the mode's ink. */
export type Role = 'threat' | 'danger' | 'craft' | 'fragment' | 'program' | 'sail' | 'nuclear' | 'planet' | 'text';

export const SPECTRUM: Readonly<Record<Role, string>> = {
  threat: '#FFB000',
  danger: '#FF3B3B',
  craft: '#00F0FF',
  fragment: '#FF2BD6',
  program: '#9D4EDD',
  sail: '#CCFF00',
  nuclear: '#FF6A00',
  planet: '#33FF33',
  text: '#E6FFE6',
};

export function roleColor(p: Palette, role: Role, spectrum: boolean): string {
  return spectrum ? SPECTRUM[role] : p.ink;
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
