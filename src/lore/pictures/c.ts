// WHAT: SIMPLE pictures for section C (the code as a course: EDUCATION.md C1-C5).
// WHY:  See index.ts.
// HOW:  One generator per picture id using ./svg helpers. Ink is the subject, dim the scaffolding, hot the
//       one thing the eye should land on.
// LORE: G8

import { arrow, circle, label, labelBox, line, picture, poly, rect, type PicPalette } from './svg';

type Gen = (p: PicPalette) => string;

export const PICTURES_C: Readonly<Record<string, Gen>> = {
  // Boxes: physics -> sim -> planner -> game -> render; a worker box beside; a Python box mirroring physics.
  'pic-architecture': (p) => picture(p, [
    ...['PHYSICS', 'SIM', 'PLANNER', 'GAME', 'RENDER'].map((t, i) => labelBox(20 + 92 * i, 90, 72, 34, t, i === 0 ? p.hot : p.ink, { size: 9 }) + (i < 4 ? arrow(92 + 92 * i, 107, 110 + 92 * i, 107, { color: p.dim }) : '')),
    labelBox(204, 190, 72, 34, 'WORKER', p.dim, { size: 9, dash: '4 3' }), line(240, 190, 240, 124, { color: p.dim, dash: '4 3' }), label(250, 160, 'OFF THE MAIN THREAD', { color: p.dim, size: 8 }),
    labelBox(20, 190, 72, 34, 'PYTHON', p.hot, { size: 9 }), arrow(56, 190, 56, 126, { color: p.hot }), arrow(56, 126, 56, 190, { color: p.hot }), label(66, 160, 'MIRROR', { color: p.hot, size: 9 }),
    label(240, 280, 'ONE FUNCTION IN TYPESCRIPT, THE SAME ONE IN PYTHON', { color: p.dim, anchor: 'middle', size: 9 }),
  ]),

  // A trail with numbered stops: constants, Kepler, elements, close approach, Lambert, kinetic.
  'pic-code-path': (p) => {
    const stops: readonly (readonly [number, number, string])[] = [[50, 250, 'CONSTANTS'], [125, 180, 'KEPLER'], [200, 235, 'ELEMENTS'], [280, 150, 'CLOSE APPROACH'], [360, 205, 'LAMBERT'], [430, 100, 'KINETIC']];
    return picture(p, [
      poly(stops.map(([x, y]) => [x, y] as [number, number]), { color: p.dim, dash: '5 4' }),
      ...stops.map(([x, y, t], i) => { const col = i === 5 ? p.hot : p.ink; return circle(x, y, 12, { color: col }) + label(x, y + 4, `${i + 1}`, { color: col, anchor: 'middle', size: 10 }) + label(x, y + (i % 2 === 0 ? 30 : -20), t, { color: i === 5 ? p.hot : p.dim, anchor: 'middle', size: 9 }); }),
      label(240, 40, 'READ THE CODE IN THIS ORDER', { color: p.dim, anchor: 'middle' }),
    ]);
  },

  // Two boxes, TypeScript and Python, both pointing at one sheet of numbers with a checkmark.
  'pic-tests': (p) => picture(p, [
    labelBox(40, 70, 130, 40, 'TYPESCRIPT', p.ink), labelBox(40, 210, 130, 40, 'PYTHON', p.ink),
    arrow(170, 90, 248, 130, { color: p.dim }), arrow(170, 230, 248, 190, { color: p.dim }),
    rect(250, 60, 160, 200), line(250, 84, 410, 84, { color: p.dim }), label(330, 78, 'VECTORS.JSON', { color: p.dim, anchor: 'middle', size: 9 }),
    ...[0, 1, 2, 3, 4, 5].map((i) => label(262, 108 + 20 * i, ['0.99620 1.00000', '2.71828 0.00137', '1.52366 0.09341', '0.72333 0.00677', '5.20260 0.04839', '0.38710 0.20563'][i] ?? '', { color: p.dim, size: 9 })),
    poly([[330, 232], [348, 250], [392, 200]], { color: p.hot, width: 3 }),
    label(240, 295, 'SAME NUMBERS FROM BOTH, OR THE BUILD FAILS', { color: p.dim, anchor: 'middle', size: 9 }),
  ]),

  // A control panel of sliders labeled with physics names; a new card being added to a deck of methods.
  'pic-modding': (p) => picture(p, [
    rect(30, 50, 240, 220), label(150, 70, 'KNOBS', { color: p.dim, anchor: 'middle' }),
    ...([['G', 0.3], ['AU', 0.5], ['DENSITY', 0.65], ['BETA', 0.4], ['DELTA-V', 0.8]] as const).map(([t, k], i) => { const y = 100 + 34 * i; return label(50, y - 8, t, { color: p.dim, size: 8 }) + line(50, y, 250, y, { color: p.dim }) + circle(50 + 200 * k, y, 5); }),
    rect(290, 150, 80, 110, { color: p.dim }), rect(300, 140, 80, 110, { color: p.dim }), rect(310, 130, 80, 110), label(350, 278, 'THE DECK OF METHODS', { color: p.dim, anchor: 'middle', size: 9 }),
    rect(390, 45, 80, 95, { color: p.hot }), label(430, 88, 'NEW', { color: p.hot, anchor: 'middle', size: 12 }), label(430, 104, 'METHOD', { color: p.hot, anchor: 'middle', size: 12 }),
    arrow(420, 145, 385, 175, { color: p.hot }),
  ]),

  // A shelf: NASA, ESA, three textbooks, a stack of papers.
  'pic-library': (p) => picture(p, [
    line(30, 240, 450, 240), line(30, 246, 450, 246, { color: p.dim }), line(40, 246, 40, 290, { color: p.dim }), line(440, 246, 440, 290, { color: p.dim }),
    rect(60, 160, 30, 80, { color: p.hot }), line(66, 160, 66, 240, { color: p.hot }), label(75, 262, 'NASA', { color: p.dim, anchor: 'middle', size: 9 }),
    rect(96, 172, 26, 68), line(102, 172, 102, 240), label(109, 262, 'ESA', { color: p.dim, anchor: 'middle', size: 9 }),
    rect(140, 150, 32, 90), rect(176, 165, 26, 75), rect(206, 158, 30, 82), line(146, 150, 146, 240, { color: p.dim }), line(182, 165, 182, 240, { color: p.dim }), line(212, 158, 212, 240, { color: p.dim }),
    label(188, 262, 'TEXTBOOKS', { color: p.dim, anchor: 'middle', size: 9 }),
    ...[0, 1, 2, 3, 4, 5].map((i) => rect(270 + (i % 2) * 3, 234 - 7 * i, 110, 7, { color: p.dim })),
    label(325, 262, 'PAPERS', { color: p.dim, anchor: 'middle', size: 9 }),
    label(240, 60, 'WHERE THE NUMBERS COME FROM', { color: p.dim, anchor: 'middle' }),
  ]),
};
