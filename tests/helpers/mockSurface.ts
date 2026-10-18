// WHAT: A canvas-free Surface for tests and benches: records every draw call instead of painting.
// WHY:  Renderers are pure functions of state; with a recording surface a test can assert that the same input
//       draws the same calls (determinism) and a bench can count pixels and time the JS side in node.
// HOW:  dot / stroke / circle append a compact line to `log` and count; colours land in a Set. ctx is a stub
//       with the two members the cinematics touch (fillStyle, fillRect). role() is the real roleColor.
// LORE: C3 (tests)

import type { Surface } from '../../src/render/canvas';
import { roleColor, type Palette } from '../../src/render/palettes';

export interface MockSurface {
  s: Surface;
  log: string[];
  colours: Set<string>;
  dots: number;
}

export function mockSurface(palette: Palette, spectrum: boolean, width = 1200, height = 800, record = true): MockSurface {
  const m: MockSurface = { s: undefined as unknown as Surface, log: [], colours: new Set(), dots: 0 };
  const ctx = { fillStyle: '', globalAlpha: 1, fillRect(): void {} };
  const s = {
    canvas: {} as HTMLCanvasElement,
    ctx: ctx as unknown as CanvasRenderingContext2D,
    width,
    height,
    dpr: 1,
    palette,
    glowMode: 'understroke',
    spectrum,
    holoDrift: 0,
    role: (r: Parameters<Surface['role']>[0]) => roleColor(palette, r, spectrum),
    resize(): void {},
    clear(): void {
      if (record) m.log.push('clear');
    },
    stroke(pts: ArrayLike<number>, style?: { color?: string }): void {
      if (record) m.log.push(`S${pts.length}:${style?.color ?? ''}:${(pts[0] ?? 0).toFixed(2)}`);
    },
    circle(x: number, y: number, r: number, style?: { color?: string }): void {
      if (record) m.log.push(`C${x.toFixed(2)},${y.toFixed(2)},${r.toFixed(2)}:${style?.color ?? ''}`);
    },
    dot(x: number, y: number, size = 2, color?: string, alpha = 1): void {
      m.dots++;
      if (!record) return;
      const c = color ?? palette.ink;
      m.colours.add(c);
      m.log.push(`D${x.toFixed(2)},${y.toFixed(2)},${size.toFixed(2)},${c},${alpha.toFixed(3)}`);
    },
  };
  m.s = s as unknown as Surface;
  return m;
}
