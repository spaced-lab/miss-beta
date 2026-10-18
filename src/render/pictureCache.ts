// WHAT: Rasterise a picture SVG into an Image once per (id, palette) so the canvas can drawImage it.
// WHY:  SIMPLE pictures are SVG strings (lore/pictures); Canvas 2D needs an Image. Data URLs are allowed
//       by the CSP (img-src 'self' data:).
// HOW:  A small Map (bounded by picture ids x palettes, about 60 x 8); the image is drawn once decoded.
//       Never throws: a failed decode leaves a dim box. The SVG generators (about 50 kB) load on the first
//       picture request through a same-origin dynamic import; until then, as while an image decodes, the
//       frame is drawn empty (docs/DECISIONS.md, D3).
// LORE: G8

import type { Surface } from './canvas';

const cache = new Map<string, HTMLImageElement | null>();

let pictures: typeof import('../lore/pictures/index') | null = null;
let picturesLoading = false;
function picturesModule(): typeof import('../lore/pictures/index') | null {
  if (!pictures && !picturesLoading) {
    picturesLoading = true;
    import('../lore/pictures/index').then(
      (m) => (pictures = m),
      // A failed fetch is not retried every frame: the frames stay empty boxes until the page reloads.
      () => undefined,
    );
  }
  return pictures;
}

export function pictureImage(id: string, s: Surface): HTMLImageElement | null {
  const key = `${id}#${s.palette.name}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const mod = picturesModule();
  if (!mod) return null;
  const svg = mod.renderPicture(id, { bg: s.palette.bg, ink: s.palette.ink, dim: s.palette.dim, hot: s.palette.hot });
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
