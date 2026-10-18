// WHAT: SIMPLE pictures for section O (orbits and the maths: EDUCATION.md O1-O14).
// WHY:  See index.ts.
// HOW:  One generator per picture id using ./svg helpers. Ink is the subject, dim the scaffolding, hot the
//       one thing the eye should land on. Ellipses are placed so the Sun sits at a focus (c = sqrt(a^2 - b^2)).
// LORE: G8

import { arc, arrow, circle, curve, earth, ellipse, glowDot, label, line, picRng, picture, poly, rect, rock, segments, sun, type PicPalette } from './svg';

type Gen = (p: PicPalette) => string;

/** A point on an axis-aligned ellipse at parameter t and the unit tangent there. */
const onEllipse = (cx: number, cy: number, a: number, b: number, t: number): { x: number; y: number; tx: number; ty: number } => {
  const dx = -a * Math.sin(t), dy = b * Math.cos(t), n = Math.hypot(dx, dy);
  return { x: cx + a * Math.cos(t), y: cy + b * Math.sin(t), tx: dx / n, ty: dy / n };
};
const velArrow = (cx: number, cy: number, a: number, b: number, t: number, len: number, color: string): string => {
  const q = onEllipse(cx, cy, a, b, t);
  return arrow(q.x, q.y, q.x + q.tx * len, q.y + q.ty * len, { color });
};

export const PICTURES_O: Readonly<Record<string, Gen>> = {
  // A row of boxes: 1, 10, 100, 1,000 ... each ten times bigger, with a pebble, a car, a building, a mountain.
  'pic-powers-of-ten': (p) => picture(p, [
    label(240, 40, 'EACH BOX TEN TIMES BIGGER', { color: p.dim, anchor: 'middle' }),
    line(20, 262, 460, 262, { color: p.dim }),
    rect(30, 254, 8, 8), circle(34, 258, 1.5), label(34, 282, '1', { color: p.dim, anchor: 'middle' }),
    rect(60, 238, 24, 24), rect(64, 250, 16, 6), circle(68, 257, 2), circle(76, 257, 2), label(72, 282, '10', { color: p.dim, anchor: 'middle' }),
    rect(110, 190, 72, 72), rect(132, 205, 28, 57), ...[212, 224, 236, 248].flatMap((y) => [rect(137, y, 6, 6, { color: p.dim }), rect(149, y, 6, 6, { color: p.dim })]), label(146, 282, '100', { color: p.dim, anchor: 'middle' }),
    label(220, 240, '...', { color: p.dim, anchor: 'middle', size: 16 }),
    rect(260, 92, 170, 170, { color: p.hot }), poly([[275, 262], [345, 110], [415, 262]]), poly([[330, 143], [345, 130], [360, 143]], { color: p.dim }), label(345, 282, '1,000', { color: p.dim, anchor: 'middle' }),
  ]),

  // Six dots of decreasing brightness labeled 1 to 6; the brightest has the smallest number.
  'pic-magnitude-ladder': (p) => picture(p, [
    label(240, 60, 'MAGNITUDE: SMALLER NUMBER, BRIGHTER STAR', { color: p.dim, anchor: 'middle' }),
    ...[11, 8.5, 6.5, 4.8, 3.4, 2.2].map((r, i) => glowDot(60 + 72 * i, 150, r, i === 0 ? p.hot : p.ink)),
    ...[1, 2, 3, 4, 5, 6].map((n, i) => label(60 + 72 * i, 205, `${n}`, { color: i === 0 ? p.hot : p.dim, anchor: 'middle', size: 13 })),
    arrow(60, 240, 420, 240, { color: p.dim }), label(240, 262, 'FAINTER', { color: p.dim, anchor: 'middle' }),
  ]),

  // A rock with two arrows: a long one from the Sun (where), a short one along its path (which way, how fast).
  'pic-vectors': (p) => picture(p, [
    arc(90, 240, 200, -1.35, -0.3, { color: p.dim, dash: '4 4' }),
    arrow(90, 240, 212, 92, { color: p.dim }), label(130, 150, 'WHERE', { color: p.dim }),
    rock(218.6, 86.8, 10, 2),
    arrow(226, 92, 268, 127, { color: p.hot }), label(285, 135, 'WHICH WAY, HOW FAST', { color: p.hot }),
    sun(90, 240, 12, p.hot),
  ]),

  // Sun pulling on a rock with an arrow; the rock's path bends into a curve instead of going straight.
  'pic-newton': (p) => picture(p, [
    line(170, 60, 420, 60, { color: p.dim, dash: '5 4' }), label(430, 64, 'NO PULL', { color: p.dim }),
    arc(170, 230, 170, -Math.PI / 2, 0), arrow(339.9, 211.6, 340, 230, {}), label(355, 240, 'WITH PULL', { color: p.dim }),
    rock(170, 60, 9, 6),
    arrow(170, 76, 170, 135, { color: p.hot }), label(180, 110, 'PULL', { color: p.hot }),
    sun(170, 230, 14, p.hot),
  ]),

  // A small fast ball hitting a big slow one; after, the big one moves a tiny bit.
  'pic-momentum': (p) => picture(p, [
    label(120, 70, 'BEFORE', { color: p.dim, anchor: 'middle' }), label(360, 70, 'AFTER', { color: p.dim, anchor: 'middle' }),
    line(240, 50, 240, 270, { color: p.dim, dash: '4 4' }),
    circle(60, 160, 8), arrow(72, 160, 140, 160, { color: p.hot }), circle(190, 160, 35),
    circle(331, 160, 8), circle(370, 160, 35), arrow(408, 160, 426, 160, { color: p.hot }),
    label(360, 230, 'A LITTLE', { color: p.dim, anchor: 'middle' }),
  ]),

  // An oval with the Sun at one focus; a rock fast near the Sun, slow far away; equal-area wedges.
  'pic-ellipse': (p) => picture(p, [
    ellipse(240, 165, 170, 100),
    line(234, 165, 246, 165, { color: p.dim }), line(240, 159, 240, 171, { color: p.dim }), label(240, 190, 'CENTER', { color: p.dim, anchor: 'middle' }),
    line(377.5, 165, 384.9, 112.7, { color: p.dim }), line(377.5, 165, 409.2, 155, { color: p.dim }),
    line(377.5, 165, 71.7, 179.1, { color: p.dim }), line(377.5, 165, 71.5, 154.2, { color: p.dim }),
    rock(399.7, 130.7, 7, 2), velArrow(240, 165, 170, 100, -0.35, 60, p.hot), label(420, 100, 'FAST', { color: p.hot }),
    rock(83.4, 126, 7, 2), velArrow(240, 165, 170, 100, Math.PI + 0.4, 22, p.ink), label(60, 100, 'SLOW', { color: p.dim }),
    sun(377.5, 165, 9, p.hot), label(377, 290, 'EQUAL AREAS IN EQUAL TIMES', { color: p.dim, anchor: 'middle' }),
  ]),

  // An oval with labels: how big (a), how squashed (e), which way it points, where the rock is now (M).
  'pic-elements': (p) => picture(p, [
    ellipse(240, 170, 160, 95, { rotate: -20 }),
    line(240, 170, 420, 170, { color: p.dim, dash: '4 4' }), label(425, 174, 'REFERENCE', { color: p.dim, size: 9 }),
    line(240, 170, 89.6, 224.7, { color: p.dim }), label(150, 250, 'a: HOW BIG', { color: p.dim, anchor: 'middle' }),
    arc(240, 170, 45, -0.349, 0, { color: p.dim }), label(300, 192, 'ϖ: WHICH WAY IT POINTS', { color: p.dim }),
    line(240, 164, 240, 176, { color: p.dim }), line(234, 170, 246, 170, { color: p.dim }),
    line(240, 170, 361, 126, { color: p.dim }), label(290, 118, 'e: HOW SQUASHED', { color: p.dim, anchor: 'end' }),
    rock(324.8, 233.4, 7, 3, { color: p.hot }), label(340, 255, 'M: WHERE NOW', { color: p.hot }),
    sun(361, 126, 8, p.hot),
  ]),

  // One ellipse with three speed arrows: long near the Sun, short far away.
  'pic-visviva': (p) => picture(p, [
    ellipse(240, 165, 175, 95),
    velArrow(240, 165, 175, 95, -0.5, 70, p.hot), label(430, 95, 'FAST', { color: p.hot }),
    velArrow(240, 165, 175, 95, 1.9, 40, p.ink), label(170, 285, 'SLOWER', { color: p.dim, anchor: 'middle' }),
    velArrow(240, 165, 175, 95, 3.3, 20, p.ink), label(40, 120, 'SLOW', { color: p.dim }),
    sun(387, 165, 9, p.hot),
    label(240, 40, 'CLOSER TO THE SUN, FASTER', { color: p.dim, anchor: 'middle' }),
  ]),

  // An ellipse inside a circle; one angle from the center (E), one from the Sun (ν), and a ticking clock (M).
  'pic-anomalies': (p) => picture(p, [
    circle(200, 165, 110, { color: p.dim }), ellipse(200, 165, 110, 75),
    line(200, 165, 330, 165, { color: p.dim }),
    line(259.4, 72.4, 259.4, 165, { color: p.dim, dash: '3 3' }),
    line(200, 165, 259.4, 72.4, { color: p.dim }), arc(200, 165, 30, -1, 0, { color: p.dim }), label(238, 155, 'E', { color: p.dim }),
    line(280.5, 165, 259.4, 101.9), arc(280.5, 165, 22, -1.894, 0, { color: p.hot }), label(284, 140, 'ν', { color: p.hot, size: 13 }),
    glowDot(259.4, 72.4, 3, p.dim), rock(259.4, 101.9, 6, 2), label(200, 182, 'C', { color: p.dim, anchor: 'middle' }),
    sun(280.5, 165, 7, p.hot),
    circle(420, 70, 24), line(420, 70, 420, 52), line(420, 70, 434, 76), ...[0, 1, 2, 3].map((i) => line(420 + 20 * Math.cos(i * Math.PI / 2), 70 + 20 * Math.sin(i * Math.PI / 2), 420 + 24 * Math.cos(i * Math.PI / 2), 70 + 24 * Math.sin(i * Math.PI / 2))),
    label(420, 112, 'M: THE CLOCK', { color: p.dim, anchor: 'middle' }),
  ]),

  // A grid of launch date vs arrival date colored like a weather map; a dark valley marked "cheap".
  'pic-porkchop': (p) => picture(p, [
    rect(80, 40, 340, 230, { color: p.dim }),
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => line(80 + 34 * i, 40, 80 + 34 * i, 270, { color: p.dim, dash: '1 5' })),
    ...[1, 2, 3, 4].map((i) => line(80, 40 + 46 * i, 420, 40 + 46 * i, { color: p.dim, dash: '1 5' })),
    ellipse(250, 150, 125, 72, { rotate: 30 }), ellipse(250, 150, 92, 52, { rotate: 30 }), ellipse(250, 150, 60, 34, { rotate: 30 }),
    ellipse(250, 150, 30, 16, { rotate: 30, color: p.hot }), label(250, 154, 'CHEAP', { color: p.hot, anchor: 'middle', size: 9 }),
    label(400, 60, 'COSTLY', { color: p.dim, anchor: 'middle', size: 9 }),
    label(250, 295, 'LAUNCH DATE', { color: p.dim, anchor: 'middle' }), arrow(320, 295 - 4, 360, 291, { color: p.dim }),
    label(72, 45, 'ARRIVAL', { color: p.dim, anchor: 'end', size: 9 }), label(72, 57, 'DATE', { color: p.dim, anchor: 'end', size: 9 }), arrow(60, 100, 60, 65, { color: p.dim }),
  ]),

  // A spacecraft curving around a planet; it leaves going a different direction and, in the Sun's frame, faster.
  'pic-flyby': (p) => picture(p, [
    circle(240, 150, 35),
    poly(curve((t) => [240 + 110 * Math.sinh(t), 150 + 50 * Math.cosh(t)], -1.3, 1.3, 40)),
    arrow(53.2, 248.5, 110.7, 227.2, { color: p.dim }), label(70, 275, 'IN', { color: p.dim }),
    arrow(369.3, 227.2, 426.8, 248.5, { color: p.hot }), label(400, 275, 'OUT: NEW DIRECTION', { color: p.hot, anchor: 'middle' }),
    label(400, 290, 'AND FASTER (SUN FRAME)', { color: p.hot, anchor: 'middle', size: 9 }),
    label(240, 80, 'PLANET', { color: p.dim, anchor: 'middle' }),
  ]),

  // Earth with a dashed ring bigger than itself; a rock aimed at the ring curves in and hits.
  'pic-focusing': (p) => picture(p, [
    earth(330, 160, 32), circle(330, 160, 60, { color: p.dim, dash: '4 4' }),
    line(40, 100, 330, 100, { color: p.dim, dash: '2 5' }), label(185, 90, 'AIMED AT THE RING', { color: p.dim, anchor: 'middle' }),
    poly(curve((t) => [(1 - t) * (1 - t) * 40 + 2 * (1 - t) * t * 250 + t * t * 312, (1 - t) * (1 - t) * 100 + 2 * (1 - t) * t * 100 + t * t * 133], 0, 1, 24)),
    rock(40, 100, 7, 4), glowDot(312, 133, 4, p.hot), label(250, 215, 'PULLED IN: HITS', { color: p.hot, anchor: 'middle' }),
    label(330, 250, 'GRAVITY MAKES EARTH A BIGGER TARGET', { color: p.dim, anchor: 'middle', size: 9 }),
  ]),

  // A curved true path and a chain of short straight steps that follow it closely.
  'pic-rk4': (p) => {
    const f = (t: number): [number, number] => [40 + 400 * t, 250 - 170 * Math.sin(Math.PI * t)];
    const nodes: [number, number][] = [];
    for (let i = 0; i <= 8; i++) { const [x, y] = f(i / 8); nodes.push([x, y + i * 0.6]); }
    return picture(p, [
      poly(curve(f, 0, 1, 48), { color: p.dim }), label(120, 60, 'TRUE PATH', { color: p.dim }),
      poly(nodes), ...nodes.map(([x, y]) => glowDot(x, y, 2.5, p.hot)),
      label(360, 240, 'SHORT STRAIGHT STEPS', { color: p.hot, anchor: 'middle' }),
    ]);
  },

  // A hundred faint ghost asteroids drawn around one bold one; most miss, a few hit; a counter.
  'pic-montecarlo': (p) => {
    const rnd = picRng(19); // NOTE: seed chosen so the counter reads the "7 of 100" the description names.
    const miss: [number, number, number, number][] = [], hit: [number, number, number, number][] = [], ghosts: [number, number, number, number][] = [];
    for (let i = 0; i < 100; i++) {
      const gx = Math.round(60 + rnd() * 60), gy = Math.round(140 + rnd() * 40), d = (rnd() - 0.5) * 420;
      (Math.abs(d) < 26 ? hit : miss).push([gx, gy, 470, Math.round(160 + d * 1.15)]);
      ghosts.push([gx - 1.5, gy, gx + 1.5, gy]);
    }
    return picture(p, [
      segments(miss, { color: p.dim, width: 0.4 }), segments(ghosts, { color: p.dim, width: 2 }),
      segments(hit, { color: p.hot, width: 1 }),
      rock(90, 160, 10, 3), earth(400, 160, 26), label(400, 215, `${hit.length} OF 100 HIT`, { color: p.hot, anchor: 'middle' }),
    ]);
  },
};
