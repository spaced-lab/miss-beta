// WHAT: SIMPLE pictures for section G (the game itself: EDUCATION.md G1-G8).
// WHY:  See index.ts.
// HOW:  One generator per picture id using ./svg helpers. Ink is the subject, dim the scaffolding, hot the
//       one thing the eye should land on.
// LORE: G8

import { arc, circle, curve, earth, ellipse, glowDot, hatch, label, labelBox, line, picture, poly, rect, rock, star, sun, telescope, wave, type PicPalette } from './svg';

type Gen = (p: PicPalette) => string;

// The six colour modes as (frame colour, accent colour): the one picture that carries literal colours.
const MODES: readonly (readonly [string, string, string])[] = [
  ['#3cff5c', '#1a7a2b', 'GREEN ON BLACK'], ['#ffb000', '#8a5a00', 'AMBER'], ['#9fdcff', '#4a86a8', 'ICE BLUE'],
  ['#ff6ad5', '#5ff2ff', 'PINK AND CYAN'], ['#b36bff', '#ccff33', 'VIOLET AND ACID'], ['#2b2b2b', '#8a8a8a', 'INK ON PAPER'],
];

export const PICTURES_G: Readonly<Record<string, Gen>> = {
  // Four panels: see the rock, pick a plan, press go, watch it miss.
  'pic-howto': (p) => {
    const px = (i: number): number => 15 + 117 * i;
    return picture(p, [
      ...['1 SEE', '2 PLAN', '3 GO', '4 WATCH'].map((t, i) => rect(px(i), 70, 105, 170, { color: p.dim }) + label(px(i) + 52, 58, t, { color: p.dim, anchor: 'middle' })),
      telescope(px(0) + 35, 195, 10), line(px(0) + 42, 180, px(0) + 85, 115, { color: p.dim, dash: '2 4' }), rock(px(0) + 88, 110, 8, 2, { color: p.hot }),
      rect(px(1) + 15, 110, 75, 18, { color: p.dim }), rect(px(1) + 15, 140, 75, 18, { color: p.hot }), rect(px(1) + 15, 170, 75, 18, { color: p.dim }),
      labelBox(px(2) + 22, 140, 60, 32, 'GO', p.hot, { size: 14 }),
      earth(px(3) + 52, 165, 20), poly(curve((t) => [px(3) + 10 + 85 * t, 165 - 42 * Math.sin(Math.PI * t) - 10], 0, 1, 16)), rock(px(3) + 52, 113, 5, 3),
    ]);
  },

  // The system view with callouts: clock, budget, round, warp buttons, brain button.
  'pic-hud': (p) => picture(p, [
    rect(20, 20, 440, 280, { color: p.dim }),
    circle(240, 170, 35, { color: p.dim }), circle(240, 170, 60, { color: p.dim }), circle(240, 170, 90, { color: p.dim }),
    circle(275, 170, 3), earth(192, 136, 5), circle(330, 170, 4),
    poly([[120, 60], [200, 110], [290, 180], [400, 230]], { dash: '3 3' }), rock(205, 113, 6, 2, { color: p.hot }),
    sun(240, 170, 7, p.hot),
    labelBox(28, 28, 70, 16, 'CLOCK', p.ink, { size: 9 }), labelBox(382, 28, 70, 16, 'BUDGET', p.ink, { size: 9 }), labelBox(382, 50, 70, 16, 'ROUND', p.ink, { size: 9 }),
    labelBox(28, 276, 36, 16, '1X', p.ink, { size: 9 }), labelBox(70, 276, 36, 16, '10X', p.ink, { size: 9 }), labelBox(112, 276, 36, 16, '100X', p.ink, { size: 9 }), label(170, 288, 'WARP', { color: p.dim, size: 9 }),
    circle(430, 276, 12), wave(422, 276, 438, 3, 2), label(430, 258, 'BRAIN', { color: p.dim, anchor: 'middle', size: 9 }),
  ]),

  // A list of plans with bars; one highlighted; a map of launch days beside it.
  'pic-planner': (p) => picture(p, [
    ...([['KINETIC', 120], ['NUKE', 70], ['TUG', 150], ['WAIT', 40]] as const).map(([t, w], i) => rect(30, 70 + 40 * i, 210, 28, { color: i === 2 ? p.hot : p.dim }) + label(36, 81 + 40 * i, t, { color: i === 2 ? p.hot : p.dim, size: 8 }) + rect(90, 78 + 40 * i, w, 12, i === 2 ? { color: p.hot } : {})),
    label(135, 250, 'PLANS, RANKED', { color: p.dim, anchor: 'middle' }),
    ...[0, 1, 2, 3, 4, 5, 6].map((i) => line(280 + 25 * i, 70, 280 + 25 * i, 195, { color: p.dim })),
    ...[0, 1, 2, 3, 4, 5].map((i) => line(280, 70 + 25 * i, 430, 70 + 25 * i, { color: p.dim })),
    rect(334, 124, 17, 17, { color: p.hot }), hatch(334, 124, 17, 17, 4, { color: p.hot }),
    label(355, 250, 'LAUNCH DAYS', { color: p.dim, anchor: 'middle' }),
  ]),

  // Progress bars for telescopes and radar filling up over years while rounds go by.
  'pic-programs': (p) => picture(p, [
    label(110, 94, 'TELESCOPES', { color: p.dim, anchor: 'end' }), rect(120, 80, 300, 22), hatch(120, 80, 220, 22, 6, { color: p.dim }), line(340, 76, 340, 106, { color: p.hot }),
    label(110, 164, 'RADAR', { color: p.dim, anchor: 'end' }), rect(120, 150, 300, 22), hatch(120, 150, 110, 22, 6, { color: p.dim }), line(230, 146, 230, 176, { color: p.hot }),
    line(120, 230, 440, 230, { color: p.dim }), ...[0, 1, 2, 3, 4, 5].map((i) => line(120 + 50 * i + 25, 224, 120 + 50 * i + 25, 236, { color: p.dim }) + label(120 + 50 * i + 25, 252, `R${i + 1}`, { color: p.dim, anchor: 'middle', size: 9 })),
    label(280, 275, 'ROUNDS GO BY, PROGRAMS FILL UP', { color: p.dim, anchor: 'middle' }),
  ]),

  // A scoreboard: rounds survived, score, a star for no fragments, a little nuke icon crossed out.
  'pic-score': (p) => picture(p, [
    rect(80, 50, 320, 220), line(80, 80, 400, 80), label(240, 72, 'SCOREBOARD', { color: p.dim, anchor: 'middle' }),
    label(100, 115, 'ROUNDS SURVIVED', { color: p.dim }), label(380, 115, '12', { color: p.ink, anchor: 'end', size: 14 }),
    label(100, 150, 'SCORE', { color: p.dim }), label(380, 150, '48,200', { color: p.ink, anchor: 'end', size: 14 }),
    star(150, 215, 20, { color: p.hot }), label(150, 255, 'NO FRAGMENTS', { color: p.dim, anchor: 'middle', size: 9 }),
    circle(330, 215, 20), circle(330, 215, 4), ...[0, 1, 2].map((i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3; return arc(330, 215, 13, a - 0.5, a + 0.5) + line(330 + 6 * Math.cos(a - 0.5), 215 + 6 * Math.sin(a - 0.5), 330 + 13 * Math.cos(a - 0.5), 215 + 13 * Math.sin(a - 0.5)) + line(330 + 6 * Math.cos(a + 0.5), 215 + 6 * Math.sin(a + 0.5), 330 + 13 * Math.cos(a + 0.5), 215 + 13 * Math.sin(a + 0.5)); }),
    line(312, 197, 348, 233, { color: p.hot, width: 3 }), label(330, 255, 'NO NUKES', { color: p.dim, anchor: 'middle', size: 9 }),
  ]),

  // Four nested boxes: REALISTIC inside SCI-FI inside SIMULATION inside MULTIVERSE.
  'pic-modes': (p) => picture(p, [
    rect(40, 30, 400, 260, { color: p.dim }), label(60, 50, 'MULTIVERSE', { color: p.dim }),
    rect(80, 70, 320, 180, { color: p.dim }), label(100, 90, 'SIMULATION', { color: p.dim }),
    rect(120, 110, 240, 100), label(140, 130, 'SCI-FI', { color: p.ink }),
    labelBox(160, 150, 160, 36, 'REALISTIC', p.hot, { size: 12 }),
  ]),

  // A flat solar system drawn as a disk; a small note "flat, Sun-only gravity, real formulas".
  'pic-under-hood': (p) => picture(p, [
    ellipse(240, 160, 210, 75, { color: p.dim }),
    ...[50, 90, 130, 170].map((r) => ellipse(240, 160, r, r * 0.36, { color: p.dim, dash: '3 4' })),
    glowDot(290, 160, 2.5, p.ink), glowDot(160, 140, 3, p.ink), glowDot(360, 185, 3.5, p.ink), glowDot(100, 130, 4, p.ink),
    ellipse(300, 160, 120, 45, { rotate: 15 }), rock(410, 185, 5, 2, { color: p.hot }),
    sun(240, 160, 8, p.hot),
    label(240, 290, 'FLAT. SUN-ONLY GRAVITY. REAL FORMULAS.', { color: p.dim, anchor: 'middle' }),
  ]),

  // Six small swatches: green on black, amber, ice blue, pink and cyan, violet and acid, dark ink on paper.
  // NOTE: strokes only (no filled backgrounds), so each swatch shows its two colours as a frame and a trace.
  'pic-color-modes': (p) => picture(p, [
    ...MODES.map(([frame, accent, name], i) => {
      const x = 45 + 135 * (i % 3), y = 50 + 120 * Math.floor(i / 3);
      return rect(x, y, 120, 80, { color: frame }) + wave(x + 12, y + 40, x + 108, 12, 2, { color: accent }) + circle(x + 100, y + 18, 5, { color: frame }) + label(x + 60, y + 98, name, { color: p.dim, anchor: 'middle', size: 9 });
    }),
  ]),
};
