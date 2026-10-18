// WHAT: Tiny SVG line-art helpers for the SIMPLE-level pictures (EDUCATION.md Section 8).
// WHY:  55 diagrams drawn as strokes in the current palette so they match the game; a helper set keeps each
//       generator a few lines and bans fills by construction (only `glowDot` fills, and only for glow).
// HOW:  Every helper returns an SVG fragment string; `picture()` wraps fragments in a 480 x 320 viewBox
//       with the palette's ink as the default stroke. Text uses the stroke font's look by using a mono
//       sans at small size (the SVG is rasterised by the browser, so a system font is acceptable here
//       and documented in STATUS.md as the one place a raster font appears).
// LORE: G8 (the look)

export interface PicPalette {
  bg: string;
  ink: string;
  dim: string;
  hot: string;
}

export const PIC_W = 480;
export const PIC_H = 320;

export type Frag = string;

export function picture(p: PicPalette, body: Frag[], opts: { width?: number } = {}): string {
  const w = opts.width ?? 1.5;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PIC_W} ${PIC_H}" width="${PIC_W}" height="${PIC_H}"><rect width="${PIC_W}" height="${PIC_H}" fill="${p.bg}"/><g fill="none" stroke="${p.ink}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${body.join('')}</g></svg>`;
}

const attrs = (o: Record<string, string | number | undefined>): string =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ` ${k}="${v}"`)
    .join('');

export function line(x1: number, y1: number, x2: number, y2: number, o: { color?: string; dash?: string; width?: number } = {}): Frag {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${attrs({ stroke: o.color, 'stroke-dasharray': o.dash, 'stroke-width': o.width })}/>`;
}

export function poly(points: readonly (readonly [number, number])[], o: { closed?: boolean; color?: string; dash?: string; width?: number } = {}): Frag {
  const d = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' ') + (o.closed ? ' Z' : '');
  return `<path d="${d}"${attrs({ stroke: o.color, 'stroke-dasharray': o.dash, 'stroke-width': o.width })}/>`;
}

export function circle(cx: number, cy: number, r: number, o: { color?: string; dash?: string; width?: number } = {}): Frag {
  return `<circle cx="${cx}" cy="${cy}" r="${r}"${attrs({ stroke: o.color, 'stroke-dasharray': o.dash, 'stroke-width': o.width })}/>`;
}

export function ellipse(cx: number, cy: number, rx: number, ry: number, o: { color?: string; dash?: string; rotate?: number; width?: number } = {}): Frag {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"${attrs({ stroke: o.color, 'stroke-dasharray': o.dash, 'stroke-width': o.width, transform: o.rotate ? `rotate(${o.rotate} ${cx} ${cy})` : undefined })}/>`;
}

export function rect(x: number, y: number, w: number, h: number, o: { color?: string; dash?: string } = {}): Frag {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}"${attrs({ stroke: o.color, 'stroke-dasharray': o.dash })}/>`;
}

/** An arrow from (x1, y1) to (x2, y2) with a small open head. */
export function arrow(x1: number, y1: number, x2: number, y2: number, o: { color?: string; head?: number; dash?: string } = {}): Frag {
  const h = o.head ?? 7;
  const a = Math.atan2(y2 - y1, x2 - x1);
  const l = (x: number, y: number, ang: number): [number, number] => [x - h * Math.cos(ang), y - h * Math.sin(ang)];
  const [ax, ay] = l(x2, y2, a - 0.45);
  const [bx, by] = l(x2, y2, a + 0.45);
  return line(x1, y1, x2, y2, { ...(o.color ? { color: o.color } : {}), ...(o.dash ? { dash: o.dash } : {}) }) + poly([[ax, ay], [x2, y2], [bx, by]], o.color ? { color: o.color } : {});
}

/** A label: the browser's monospace font at a small size, stroked not filled so it reads as line art. */
export function label(x: number, y: number, text: string, o: { color?: string; size?: number; anchor?: 'start' | 'middle' | 'end' } = {}): Frag {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<text x="${x}" y="${y}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="${o.size ?? 11}" text-anchor="${o.anchor ?? 'start'}" fill="${o.color ?? 'currentColor'}" stroke="none" style="fill:${o.color ?? '#888'}">${esc}</text>`;
}

/** A small glowing dot: the one fill allowed (star, bright body). */
export function glowDot(cx: number, cy: number, r: number, color: string): Frag {
  return `<circle cx="${cx}" cy="${cy}" r="${r * 2.2}" fill="${color}" fill-opacity="0.15" stroke="none"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" stroke="none"/>`;
}

/** A lumpy rock outline around (cx, cy) with mean radius r; `seed` picks the shape deterministically. */
export function rock(cx: number, cy: number, r: number, seed = 1, o: { color?: string } = {}): Frag {
  const pts: [number, number][] = [];
  let h = seed * 2654435761;
  const n = 9;
  for (let i = 0; i < n; i++) {
    h = (h ^ (h >>> 13)) * 1274126177;
    const k = 0.75 + ((h >>> 0) % 1000) / 2000;
    const a = (i / n) * Math.PI * 2;
    pts.push([cx + r * k * Math.cos(a), cy + r * k * Math.sin(a)]);
  }
  return poly(pts, { closed: true, ...(o.color ? { color: o.color } : {}) });
}

// ---- Shared shapes used by several pictures (all pure; coordinates rounded to 0.1 px to keep strings short).

const r1 = (v: number): number => Math.round(v * 10) / 10;

/** Points along a parametric curve f(t) for t in [t0, t1], n segments. */
export function curve(f: (t: number) => readonly [number, number], t0: number, t1: number, n = 32): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const [x, y] = f(t0 + ((t1 - t0) * i) / n);
    pts.push([r1(x), r1(y)]);
  }
  return pts;
}

/** A circular arc; angles in radians, measured clockwise on screen (y points down). */
export function arc(cx: number, cy: number, r: number, a0: number, a1: number, o: { color?: string; dash?: string; width?: number } = {}): Frag {
  return poly(curve((t) => [cx + r * Math.cos(t), cy + r * Math.sin(t)], a0, a1, 24), o);
}

/** A horizontal wavy line from x1 to x2 at height y with n waves of amplitude amp. */
export function wave(x1: number, y: number, x2: number, amp: number, n = 3, o: { color?: string; dash?: string; width?: number } = {}): Frag {
  return poly(curve((t) => [x1 + (x2 - x1) * t, y + amp * Math.sin(t * Math.PI * 2 * n)], 0, 1, n * 8), o);
}

/** Many disjoint segments in one path element (much shorter than one <line> each for scatter pictures). */
export function segments(segs: readonly (readonly [number, number, number, number])[], o: { color?: string; dash?: string; width?: number } = {}): Frag {
  const d = segs.map(([x1, y1, x2, y2]) => `M${r1(x1)} ${r1(y1)}L${r1(x2)} ${r1(y2)}`).join('');
  return `<path d="${d}"${attrs({ stroke: o.color, 'stroke-dasharray': o.dash, 'stroke-width': o.width })}/>`;
}

/** Vertical hatch lines inside a box, spaced `step` px: our stand-in for a fill. */
export function hatch(x: number, y: number, w: number, h: number, step: number, o: { color?: string } = {}): Frag {
  let s = '';
  for (let dx = step; dx < w; dx += step) s += line(r1(x + dx), y, r1(x + dx), y + h, o);
  return s;
}

/** The Sun: a glow dot with eight short rays. */
export function sun(cx: number, cy: number, r: number, color: string): Frag {
  let rays = '';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    rays += line(r1(cx + r * 1.6 * Math.cos(a)), r1(cy + r * 1.6 * Math.sin(a)), r1(cx + r * 2.2 * Math.cos(a)), r1(cy + r * 2.2 * Math.sin(a)), { color });
  }
  return glowDot(cx, cy, r, color) + rays;
}

/** Earth: a circle with one wavy continent outline inside it. */
export function earth(cx: number, cy: number, r: number, o: { color?: string } = {}): Frag {
  const land = curve((t) => [cx - r * 0.2 + r * 0.42 * (1 + 0.3 * Math.sin(3 * t)) * Math.cos(t), cy + r * 0.36 * (1 + 0.25 * Math.cos(2 * t)) * Math.sin(t)], 0, Math.PI * 2, 18);
  return circle(cx, cy, r, o) + poly(land, { closed: true, ...o });
}

/** A telescope: a tilted tube on a tripod, `s` is the scale (tube length ~ 2.2 s). */
export function telescope(x: number, y: number, s: number, o: { color?: string } = {}): Frag {
  const a = -0.6, c = Math.cos(a), si = Math.sin(a), L = 1.1 * s, W = 0.3 * s;
  const cx = x, cy = y - 0.4 * s;
  const corner = (u: number, v: number): [number, number] => [r1(cx + u * c - v * si), r1(cy + u * si + v * c)];
  return poly([corner(-L, -W), corner(L, -W), corner(L, W), corner(-L, W)], { closed: true, ...o })
    + line(x, y, r1(x - 0.8 * s), r1(y + 1.6 * s), o) + line(x, y, r1(x + 0.8 * s), r1(y + 1.6 * s), o) + line(x, y, x, r1(y + 1.7 * s), o);
}

/** A spacecraft: a small box with two solar panels, `s` is the side of the box. */
export function spacecraft(x: number, y: number, s: number, o: { color?: string } = {}): Frag {
  return rect(r1(x - 0.5 * s), r1(y - 0.5 * s), s, s, o)
    + line(r1(x - 0.5 * s), y, r1(x - 0.8 * s), y, o) + rect(r1(x - 2.2 * s), r1(y - 0.3 * s), r1(1.4 * s), r1(0.6 * s), o)
    + line(r1(x + 0.5 * s), y, r1(x + 0.8 * s), y, o) + rect(r1(x + 0.8 * s), r1(y - 0.3 * s), r1(1.4 * s), r1(0.6 * s), o);
}

/** A person: a circle over a line with two legs; `s` is the head radius, total height ~ 6 s. */
export function person(x: number, y: number, s: number, o: { color?: string } = {}): Frag {
  return circle(x, y, s, o) + line(x, r1(y + s), x, r1(y + 3.6 * s), o) + line(x, r1(y + 3.6 * s), r1(x - 1.2 * s), r1(y + 6 * s), o) + line(x, r1(y + 3.6 * s), r1(x + 1.2 * s), r1(y + 6 * s), o);
}

/** A box with a centred capital label; `color` strokes the box and the text. */
export function labelBox(x: number, y: number, w: number, h: number, text: string, color: string, o: { size?: number; dash?: string } = {}): Frag {
  return rect(x, y, w, h, { color, ...(o.dash ? { dash: o.dash } : {}) }) + label(r1(x + w / 2), r1(y + h / 2 + (o.size ?? 10) * 0.35), text, { color, anchor: 'middle', size: o.size ?? 10 });
}

/** A five-pointed star outline. */
export function star(cx: number, cy: number, r: number, o: { color?: string; width?: number } = {}): Frag {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, k = i % 2 === 0 ? r : r * 0.42;
    pts.push([r1(cx + k * Math.cos(a)), r1(cy + k * Math.sin(a))]);
  }
  return poly(pts, { closed: true, ...o });
}

/** A burst: `n` short rays between radii r0 and rOut around a point (an explosion, a flash). */
export function burst(cx: number, cy: number, r0: number, rOut: number, n: number, o: { color?: string } = {}): Frag {
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.2;
    s += line(r1(cx + r0 * Math.cos(a)), r1(cy + r0 * Math.sin(a)), r1(cx + rOut * Math.cos(a)), r1(cy + rOut * Math.sin(a)), o);
  }
  return s;
}

/** A tiny deterministic generator for scatter pictures (not the sim Rng: pictures may not import outside this folder). */
export function picRng(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
