// WHAT: SIMPLE pictures for section T (the threat: EDUCATION.md T1-T6).
// WHY:  See index.ts.
// HOW:  One generator per picture id using ./svg helpers. Ink is the subject, dim the scaffolding, hot the
//       one thing the eye should land on.
// LORE: G8

import { arrow, burst, circle, earth, ellipse, label, line, picture, poly, rect, rock, spacecraft, sun, type PicPalette } from './svg';

type Gen = (p: PicPalette) => string;

const stamp = (x: number, y: number, p: PicPalette, caption: string): string =>
  rect(x, y, 80, 80, { color: p.dim, dash: '3 3' }) + label(x + 40, y + 96, caption, { color: p.dim, anchor: 'middle' });

export const PICTURES_T: Readonly<Record<string, Gen>> = {
  // Sun in the middle, Earth's circle, three lopsided asteroid ovals crossing it.
  'pic-neo-orbits': (p) => picture(p, [
    circle(240, 160, 80, { color: p.dim }),
    earth(320, 160, 7, { color: p.dim }),
    ellipse(318.5, 188.6, 100, 55, { rotate: 20 }),
    ellipse(178, 108, 95, 50, { rotate: -140 }),
    ellipse(235, 216, 75, 50, { rotate: 95 }),
    rock(403, 215, 6, 2),
    sun(240, 160, 9, p.hot),
    label(240, 305, "THREE ROCKS WHOSE PATHS CROSS EARTH'S", { color: p.dim, anchor: 'middle' }),
  ]),

  // Five rocks drawn to scale next to a house, a stadium, a city block, a mountain; captions.
  'pic-size-ladder': (p) => picture(p, [
    line(20, 250, 460, 250, { color: p.dim }),
    // house, stadium, city block, mountain
    rect(60, 234, 20, 16, { color: p.dim }), poly([[58, 234], [70, 222], [82, 234]], { color: p.dim }),
    ellipse(150, 246, 30, 7, { color: p.dim }), ellipse(150, 240, 30, 7, { color: p.dim }),
    rect(225, 210, 14, 40, { color: p.dim }), rect(241, 190, 18, 60, { color: p.dim }), rect(261, 220, 12, 30, { color: p.dim }),
    poly([[320, 250], [380, 160], [440, 250]], { color: p.dim }),
    // rocks, smallest to largest
    rock(30, 244, 3, 1), rock(70, 200, 8, 2), rock(150, 188, 16, 3), rock(250, 160, 26, 4), rock(380, 92, 42, 5, { color: p.hot }),
    label(70, 275, 'FIREBALL', { color: p.dim, anchor: 'middle' }), label(150, 275, 'CITY', { color: p.dim, anchor: 'middle' }),
    label(250, 275, 'REGION', { color: p.dim, anchor: 'middle' }), label(380, 275, 'WORLD', { color: p.dim, anchor: 'middle' }),
    label(240, 40, 'HOW BIG IS DANGEROUS', { color: p.dim, anchor: 'middle' }),
  ]),

  // A timeline bar: car-size every year ... mountain every million years.
  'pic-frequency-bars': (p) => {
    const rows: [number, number, number, string][] = [[70, 3, 40, 'CAR-SIZE: EVERY YEAR'], [130, 6, 120, 'HOUSE-SIZE: EVERY LIFETIME'], [190, 10, 220, 'STADIUM-SIZE: EVERY 20,000 YEARS'], [250, 14, 320, 'MOUNTAIN-SIZE: EVERY MILLION YEARS']];
    const f: string[] = [label(240, 36, 'TIME BETWEEN HITS', { color: p.dim, anchor: 'middle' }), line(130, 50, 130, 275, { color: p.dim, dash: '3 3' })];
    rows.forEach(([y, r, len, text], i) => {
      f.push(rock(90, y, r, i + 1), rect(130, y - 6, len, 12, i === 3 ? { color: p.hot } : {}), label(134, y - 12, text, { color: p.dim }));
    });
    return picture(p, f);
  },

  // Five stamps: a shattered window (2013), fallen trees (1908), a crater, a dinosaur, DART hitting a moon (2022).
  'pic-case-files': (p) => {
    const y = 110, x0 = 20, x1 = 110, x2 = 200, x3 = 290, x4 = 380;
    return picture(p, [
      stamp(x0, y, p, '2013'), rect(x0 + 15, y + 15, 50, 50), line(x0 + 40, y + 15, x0 + 40, y + 65), line(x0 + 15, y + 40, x0 + 65, y + 40),
      ...[[x0 + 16, y + 18], [x0 + 38, y + 16], [x0 + 15, y + 38], [x0 + 52, y + 50], [x0 + 24, y + 60]].map(([ex, ey]) => line(x0 + 31, y + 31, ex ?? 0, ey ?? 0, { color: p.hot })),
      stamp(x1, y, p, '1908'), ...[0, 1, 2, 3, 4, 5].map((i) => line(x1 + 40, y + 45, x1 + 40 + 32 * Math.cos(i * 1.05 + 0.3), y + 45 + 20 * Math.sin(i * 1.05 + 0.3))), circle(x1 + 40, y + 45, 4),
      stamp(x2, y, p, 'CRATER'), ellipse(x2 + 40, y + 45, 30, 14), ellipse(x2 + 40, y + 47, 20, 8, { color: p.dim }), poly([[x2 + 8, y + 50], [x2 + 12, y + 44], [x2 + 68, y + 44], [x2 + 72, y + 50]]),
      stamp(x3, y, p, '66 MILLION YEARS'),
      poly(([[10, 60], [20, 45], [30, 38], [45, 36], [55, 30], [62, 22], [70, 20], [74, 26], [68, 30], [60, 34], [56, 44], [50, 50], [46, 62], [40, 62], [42, 52], [34, 54], [30, 62], [24, 62], [26, 50], [18, 54]] as const).map(([a, b]) => [x3 + a, y + b] as [number, number]), { closed: true }),
      stamp(x4, y, p, '2022'), circle(x4 + 52, y + 48, 16), spacecraft(x4 + 20, y + 30, 8), line(x4 + 28, y + 33, x4 + 38, y + 38), burst(x4 + 40, y + 40, 4, 10, 7, { color: p.hot }),
    ]);
  },

  // Three cutaways: rubble pile, solid rock, metal lump; an icy dirty snowball beside them.
  'pic-asteroid-types': (p) => picture(p, [
    circle(70, 150, 40), ...[[-14, -12, 11], [10, -16, 9], [16, 8, 12], [-10, 14, 10], [-22, 4, 7], [2, 0, 7], [4, 24, 6]].map(([dx, dy, r]) => circle(70 + (dx ?? 0), 150 + (dy ?? 0), r ?? 6)),
    circle(180, 150, 40), poly([[155, 135], [175, 150], [170, 175]], { color: p.dim }), poly([[185, 118], [192, 140], [210, 150]], { color: p.dim }),
    circle(290, 150, 40, { color: p.hot }), ...[-30, -22, -14, -6, 2, 10, 18, 26, 34].map((dx) => { const h = Math.sqrt(40 * 40 - dx * dx); return line(290 + dx, 150 - h, 290 + dx, 150 + h, { color: p.hot }); }),
    rock(400, 150, 22, 8), circle(400, 150, 30, { color: p.dim, dash: '2 5' }), line(422, 130, 440, 118, { color: p.dim }), line(426, 150, 446, 150, { color: p.dim }),
    label(70, 215, 'RUBBLE PILE', { color: p.dim, anchor: 'middle' }), label(180, 215, 'SOLID ROCK', { color: p.dim, anchor: 'middle' }),
    label(290, 215, 'METAL', { color: p.dim, anchor: 'middle' }), label(400, 215, 'ICY SNOWBALL', { color: p.dim, anchor: 'middle' }),
  ]),

  // A long thin oval reaching far from the Sun, a comet with a tail near the Sun; a straight-ish line for a visitor.
  'pic-comet-orbit': (p) => picture(p, [
    ellipse(284, 160, 170, 45, { color: p.dim }),
    poly([[40, 40], [120, 100], [200, 170], [330, 240], [440, 290]], { color: p.dim, dash: '6 4' }),
    arrow(330, 240, 440, 290, { color: p.dim }),
    label(300, 275, 'VISITOR: PASSES ONCE', { color: p.dim, anchor: 'end' }),
    circle(135, 185, 5, { color: p.hot }), ...[-0.35, 0, 0.35].map((da) => { const a = Math.atan2(25, 15) + da; return line(135 + 6 * Math.cos(a), 185 + 6 * Math.sin(a), 135 + 45 * Math.cos(a), 185 + 45 * Math.sin(a), { color: p.hot }); }),
    label(165, 235, 'COMET', { color: p.dim }),
    sun(120, 160, 10, p.hot),
    label(400, 100, 'FAR AND COLD', { color: p.dim, anchor: 'middle' }),
  ]),
};
