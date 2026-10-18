// WHAT: Rasterise a picture SVG into an Image once per (id, palette) so the canvas can drawImage it.
// WHY:  SIMPLE pictures are SVG strings (lore/pictures); Canvas 2D needs an Image. Data URLs are allowed
//       by the CSP (img-src 'self' data:).
// HOW:  A small Map; the image is drawn once decoded. Never throws: a failed decode leaves a dim box.
// LORE: G8

import { renderPicture } from '../lore/pictures/index';
import type { Surface } from './canvas';

const cache = new Map<string, HTMLImageElement | null>();

export function pictureImage(id: string, s: Surface): HTMLImageElement | null {
  const key = `${id}#${s.palette.name}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const svg = renderPicture(id, { bg: s.palette.bg, ink: s.palette.ink, dim: s.palette.dim, hot: s.palette.hot });
  if (!svg || typeof Image === 'undefined') {
    cache.set(key, null);
    return null;
  }
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  cache.set(key, img);
  return img;
}

/** Draw the picture into a box (letterboxed), or a placeholder frame while it decodes. */
export function drawPicture(s: Surface, id: string, x: number, y: number, w: number, h: number): void {
  const img = pictureImage(id, s);
  s.stroke([x, y, x + w, y, x + w, y + h, x, y + h], { closed: true, color: s.palette.dim, glow: 0 });
  if (!img || !img.complete || img.naturalWidth === 0) return;
  const k = Math.min(w / 480, h / 320);
  const dw = 480 * k;
  const dh = 320 * k;
  s.ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}
