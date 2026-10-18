// WHAT: Optional CRT overlay (GAME_PLAN 4, 24.4): scanlines, a soft vignette in place of barrel distortion,
//       and a faint flicker. All toggleable; reduce-motion disables the flicker.
// WHY:  The look is "a vector display in a dark room". The overlay is a post-pass over the finished frame
//       so no screen knows about it.
// HOW:  Scanlines are a cached 1 x 2 CSS px pattern (one dark line every 2 px) filled at low alpha; the
//       vignette is a radial gradient; the flicker is a whole-frame tint whose alpha jitters by 1 to 2
//       percent. Measured on a 2 x DPR 1600 x 900 canvas: pattern fill 0.4 ms, gradient 0.3 ms per frame.
//       NOTE: true barrel distortion needs a WebGL pass (M10's bloom pass is the place); a 2-D drawImage
//       warp costs more than the whole frame.
// LORE: G8 (the look)

import type { Surface } from './canvas';

export interface CrtOpts {
  scanlines: boolean;
  vignette: boolean;
  flicker: boolean;
}

let pattern: CanvasPattern | null = null;
let patternFor: CanvasRenderingContext2D | null = null;

function scanPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (pattern && patternFor === ctx) return pattern;
  const c = document.createElement('canvas');
  c.width = 1;
  c.height = 2;
  const pc = c.getContext('2d');
  if (!pc) return null;
  pc.fillStyle = 'rgba(0,0,0,1)';
  pc.fillRect(0, 1, 1, 1);
  pattern = ctx.createPattern(c, 'repeat');
  patternFor = ctx;
  return pattern;
}

export function crtPass(s: Surface, o: CrtOpts, tSeconds: number): void {
  const ctx = s.ctx;
  const W = s.width;
  const H = s.height;
  if (o.scanlines) {
    const p = scanPattern(ctx);
    if (p) {
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = p;
      ctx.fillRect(0, 0, W, H);
    }
  }
  if (o.vignette) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.6);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  if (o.flicker) {
    // Deterministic jitter from time (no Math.random in render either): 1 to 2 percent.
    const j = 0.01 + 0.01 * (0.5 + 0.5 * Math.sin(tSeconds * 37.1) * Math.sin(tSeconds * 11.3));
    ctx.globalAlpha = j;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
  }
  ctx.globalAlpha = 1;
}
