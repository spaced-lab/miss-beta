// WHAT: Canvas 2D surface management and the `Stroke` drawing primitive every view uses.
// WHY:  GAME_PLAN 4 and 24.4: crisp 1 to 1.25 px strokes at device pixel ratio, phosphor glow, no fills.
//       Views draw through one small interface so a later WebGL2 bloom backend can replace this file
//       without touching any view.
// HOW:  The backing store is sized to CSS pixels x devicePixelRatio and the context is scaled, so views
//       draw in CSS pixels and get retina lines for free. Glow has three strategies that trade quality
//       for speed; the minigame exposes a toggle so the cost can be measured on real hardware:
//         'shadow'      ctx.shadowBlur on every stroke. Prettiest; expensive (an offscreen blur per path).
//         'understroke' a wide low-alpha stroke under the crisp one. Cheap; close enough at 1 to 2 px.
//         'none'        crisp line only (what DAYLIGHT uses).
// LORE: G8 (the look), C2 (reading the code)

import { holoHue, roleColor, withAlpha, type Palette, type Role } from './palettes';

export type GlowMode = 'shadow' | 'understroke' | 'none';

export interface StrokeStyle {
  color?: string;
  /** Line width in CSS px. Defaults to the palette's lineWidth. */
  width?: number;
  /** Glow strength multiplier, 0 disables for this stroke. */
  glow?: number;
  closed?: boolean;
  dash?: readonly number[];
  alpha?: number;
}

export interface Surface {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  /** CSS pixel size (not backing-store size). */
  width: number;
  height: number;
  dpr: number;
  palette: Palette;
  glowMode: GlowMode;
  /** SPECTRUM layer on (24.1): semantic roles get their own hue. */
  spectrum: boolean;
  /** HOLO hue drift, degrees; the loop advances it unless reduce-motion is on. */
  holoDrift: number;
  /** Colour for a semantic role under the current palette and SPECTRUM setting. */
  role(role: Role): string;
  /** Re-read the element size and DPR; call on resize. */
  resize(): void;
  clear(): void;
  /** Draw an open or closed polyline from a flat [x0,y0,x1,y1,...] array or an array of points. */
  stroke(points: ArrayLike<number>, style?: StrokeStyle): void;
  circle(cx: number, cy: number, r: number, style?: StrokeStyle): void;
  /** A "pixel": a tiny filled square, the one place fills are allowed (bullets, particles, stars). */
  dot(x: number, y: number, size?: number, color?: string, alpha?: number): void;
}

/** setLineDash copies its argument, so one shared empty array replaces a fresh `[]` per stroke (D6). */
const NO_DASH: number[] = [];

export function createSurface(canvas: HTMLCanvasElement, palette: Palette, glowMode: GlowMode = 'understroke'): Surface {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  const s: Surface = {
    canvas,
    ctx,
    width: 0,
    height: 0,
    dpr: 1,
    palette,
    glowMode,
    spectrum: false,
    holoDrift: 0,

    role(role) {
      return roleColor(s.palette, role, s.spectrum);
    },

    resize() {
      const rect = canvas.getBoundingClientRect();
      // NOTE: cap DPR at 2; beyond that the glow under-strokes cost more than the eye can see.
      s.dpr = Math.min(window.devicePixelRatio || 1, 2);
      s.width = Math.max(1, Math.round(rect.width));
      s.height = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(s.width * s.dpr);
      canvas.height = Math.round(s.height * s.dpr);
      ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    },

    clear() {
      ctx.fillStyle = s.palette.bg;
      ctx.fillRect(0, 0, s.width, s.height);
    },

    stroke(points, style = {}) {
      const n = points.length;
      if (n < 4) return;
      const color = style.color ?? s.palette.ink;
      const width = style.width ?? s.palette.lineWidth;
      const glow = (style.glow ?? 1) * (s.palette.glow ? 1 : 0);
      const alpha = style.alpha ?? 1;

      ctx.beginPath();
      ctx.moveTo(points[0] as number, points[1] as number);
      for (let i = 2; i < n; i += 2) ctx.lineTo(points[i] as number, points[i + 1] as number);
      if (style.closed) ctx.closePath();
      ctx.setLineDash(style.dash ? (style.dash as number[]) : NO_DASH);

      // HOLO (24.1): iridescent strokes, hue cycling along the path's extent, plus a 1 px chromatic offset.
      let paint: string | CanvasGradient = color;
      if (s.palette.name === 'HOLO' && style.color === undefined) {
        let x0 = Infinity;
        let x1 = -Infinity;
        let y0 = Infinity;
        let y1 = -Infinity;
        for (let i = 0; i < n; i += 2) {
          const px = points[i] as number;
          const py = points[i + 1] as number;
          if (px < x0) x0 = px;
          if (px > x1) x1 = px;
          if (py < y0) y0 = py;
          if (py > y1) y1 = py;
        }
        if (x1 - x0 > 2 || y1 - y0 > 2) {
          const g = ctx.createLinearGradient(x0, y0, x1, y1);
          for (let k = 0; k <= 4; k++) g.addColorStop(k / 4, holoHue(k / 4, s.holoDrift));
          paint = g;
          ctx.save();
          ctx.translate(1, 0);
          ctx.globalAlpha = alpha * 0.35;
          ctx.strokeStyle = 'rgba(0,240,255,1)';
          ctx.lineWidth = width;
          ctx.stroke();
          ctx.restore();
        }
      }
      if (glow > 0 && s.glowMode === 'understroke') {
        ctx.globalAlpha = alpha * 0.11 * glow;
        ctx.strokeStyle = paint;
        ctx.lineWidth = width + 3.5 * glow;
        ctx.stroke();
      }
      if (glow > 0 && s.glowMode === 'shadow') {
        ctx.shadowColor = withAlpha(color, 0.9);
        ctx.shadowBlur = 6 * glow;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = paint;
      ctx.lineWidth = width;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    },

    circle(cx, cy, r, style = {}) {
      // NOTE: polygonal circles keep every primitive on the same stroke path (needed for the WebGL backend later).
      const segs = Math.max(12, Math.min(96, Math.round(r * 0.9)));
      const pts = new Float64Array(segs * 2);
      for (let i = 0; i < segs; i++) {
        const t = (i / segs) * Math.PI * 2;
        pts[i * 2] = cx + r * Math.cos(t);
        pts[i * 2 + 1] = cy + r * Math.sin(t);
      }
      s.stroke(pts, { ...style, closed: true });
    },

    dot(x, y, size = 2, color, alpha = 1) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color ?? s.palette.ink;
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
      ctx.globalAlpha = 1;
    },
  };

  s.resize();
  return s;
}
