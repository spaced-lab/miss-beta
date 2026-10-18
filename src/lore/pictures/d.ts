// WHAT: SIMPLE pictures for section D (deflection and defence: EDUCATION.md D1-D12).
// WHY:  See index.ts.
// HOW:  One generator per picture id using ./svg helpers. Ink is the subject, dim the scaffolding, hot the
//       one thing the eye should land on (usually the push).
// LORE: G8

import { arc, arrow, burst, circle, earth, ellipse, glowDot, label, line, person, picture, poly, rect, rock, spacecraft, sun, wave, type PicPalette } from './svg';

type Gen = (p: PicPalette) => string;

/** A simple rocket standing on `base` with height h: nose, body, two fins. */
const rocket = (x: number, base: number, h: number, color?: string): string => {
  const w = h * 0.22, o = color ? { color } : {};
  return poly([[x - w, base], [x - w, base - h * 0.7], [x, base - h], [x + w, base - h * 0.7], [x + w, base]], { closed: true, ...o })
    + poly([[x - w, base - h * 0.25], [x - w * 1.9, base], [x - w, base]], { closed: true, ...o })
    + poly([[x + w, base - h * 0.25], [x + w * 1.9, base], [x + w, base]], { closed: true, ...o });
};

export const PICTURES_D: Readonly<Record<string, Gen>> = {
  // An orbit before (dashed) and after (solid) a small push; the two ovals nearly overlap but one is slightly bigger.
  'pic-impulse': (p) => picture(p, [
    ellipse(240, 165, 150, 90, { color: p.dim, dash: '5 4' }), label(200, 140, 'BEFORE: DASHED', { color: p.dim, anchor: 'middle' }),
    ellipse(232, 165, 160, 96), label(200, 200, 'AFTER: SOLID, A LITTLE BIGGER', { color: p.dim, anchor: 'middle' }),
    rock(391, 165, 6, 2), arrow(393, 180, 393, 220, { color: p.hot }), label(405, 205, 'SMALL PUSH', { color: p.hot }),
    sun(360, 165, 9, p.hot),
  ]),

  // A see-saw: a small push on a long arm (years) lifts the same weight as a huge push on a short arm (months).
  'pic-lever': (p) => picture(p, [
    poly([[290, 118], [300, 102], [310, 118]], { color: p.dim }), line(60, 102, 380, 102), rect(362, 72, 30, 30),
    arrow(60, 60, 60, 94, { color: p.hot }), label(60, 50, 'SMALL PUSH, YEARS EARLY', { color: p.hot }),
    label(60, 130, 'LONG ARM', { color: p.dim }),
    poly([[290, 248], [300, 232], [310, 248]], { color: p.dim }), line(230, 232, 380, 232), rect(362, 202, 30, 30),
    arrow(230, 160, 230, 224, { color: p.hot }), arrow(222, 160, 222, 224, { color: p.hot }), arrow(238, 160, 238, 224, { color: p.hot }),
    label(230, 150, 'HUGE PUSH, MONTHS BEFORE', { color: p.hot, anchor: 'middle' }), label(265, 260, 'SHORT ARM', { color: p.dim, anchor: 'middle' }),
    label(377, 290, 'SAME WEIGHT', { color: p.dim, anchor: 'middle' }),
  ]),

  // A spacecraft slams into a rock; a spray of debris flies backward; the rock drifts forward a little.
  'pic-kinetic': (p) => picture(p, [
    arrow(100, 160, 170, 160), spacecraft(222, 160, 14), label(135, 145, 'FAST', { color: p.dim, anchor: 'middle' }),
    rock(300, 160, 50, 7),
    ...[-0.5, -0.3, -0.15, 0, 0.15, 0.3, 0.5].map((da, i) => { const a = Math.PI + da, L = 45 + 14 * (i % 3); return line(250 + 14 * Math.cos(a), 160 + 14 * Math.sin(a), 250 + L * Math.cos(a), 160 + L * Math.sin(a), { color: p.dim, dash: '3 3' }); }),
    label(200, 245, 'DEBRIS FLIES BACK', { color: p.dim, anchor: 'middle' }),
    arrow(355, 160, 390, 160, { color: p.hot }), label(395, 164, 'A LITTLE', { color: p.hot }),
  ]),

  // One big rock aimed at Earth; after a blast, a cloud of small rocks still aimed at Earth.
  'pic-shotgun': (p) => picture(p, [
    rock(60, 150, 32, 4), arrow(100, 150, 150, 150, { color: p.dim }),
    burst(165, 150, 6, 22, 9, { color: p.hot }), label(165, 100, 'BLAST', { color: p.hot, anchor: 'middle' }),
    ...([[230, 120, 9, 1], [255, 150, 12, 2], [240, 185, 8, 3], [285, 110, 7, 4], [300, 165, 10, 5], [275, 205, 9, 6], [320, 135, 6, 7]] as const).map(([x, y, r, s]) => rock(x, y, r, s) + arrow(x + r + 4, y, x + r + 24, y, { color: p.dim })),
    earth(430, 160, 32),
    label(270, 260, 'STILL ALL COMING', { color: p.dim, anchor: 'middle' }),
  ]),

  // A burst of light beside a rock (not touching it); one face boils off as vapor, pushing it the other way.
  'pic-standoff': (p) => picture(p, [
    glowDot(130, 150, 10, p.hot), burst(130, 150, 18, 36, 12, { color: p.hot }),
    rock(300, 150, 55, 9),
    ...[115, 138, 162, 185].map((y) => wave(248, y, 195, 3, 3, { color: p.dim })), label(205, 215, 'VAPOR', { color: p.dim, anchor: 'middle' }),
    arrow(362, 150, 412, 150, { color: p.hot }), label(387, 135, 'PUSHED', { color: p.hot, anchor: 'middle' }),
    label(240, 270, 'THE FLASH NEVER TOUCHES THE ROCK', { color: p.dim, anchor: 'middle' }),
  ]),

  // Four tiny spacecraft near a rock: hovering (gravity), blowing a beam, shining a laser, throwing stones.
  'pic-slowpush': (p) => picture(p, [
    rock(240, 160, 45, 4),
    spacecraft(140, 80, 8), line(150, 86, 210, 135, { color: p.dim, dash: '2 4' }), label(140, 60, 'GRAVITY', { color: p.dim, anchor: 'middle' }),
    spacecraft(340, 80, 8), ...[-0.15, 0, 0.15].map((da) => { const a = Math.atan2(55, -70) + da; return line(330, 88, 330 + 60 * Math.cos(a), 88 + 60 * Math.sin(a), { color: p.dim }); }), label(340, 60, 'BEAM', { color: p.dim, anchor: 'middle' }),
    spacecraft(340, 240, 8), line(331, 233, 272, 185, { color: p.hot, width: 1 }), label(340, 270, 'LASER', { color: p.dim, anchor: 'middle' }),
    spacecraft(140, 240, 8), ...[[150, 230], [168, 221], [186, 213]].map(([x, y]) => circle(x ?? 0, y ?? 0, 2, { color: p.dim })), label(140, 270, 'STONES', { color: p.dim, anchor: 'middle' }),
  ]),

  // A big square mirror sail tilted to the Sun; light arrows bounce off; a tiny thrust arrow results.
  'pic-sail': (p) => picture(p, [
    sun(50, 160, 16, p.hot),
    poly([[250, 70], [300, 90], [300, 250], [250, 230]], { closed: true }),
    ...([[110, 262.5], [160, 278], [210, 293.7]] as const).map(([y, hx]) => arrow(90, y, hx, y, { color: p.dim }) + arrow(hx, y, hx - 50, y + 35, { color: p.dim, dash: '3 3' })),
    label(150, 95, 'LIGHT', { color: p.dim }),
    arrow(275, 160, 320, 146, { color: p.hot }), label(330, 140, 'TINY THRUST', { color: p.hot }),
    label(240, 300, 'SUNLIGHT PUSHES, VERY GENTLY', { color: p.dim, anchor: 'middle' }),
  ]),

  // A rocket shrinking as it burns fuel; a staircase of speed gained with each stage.
  'pic-rocket-eq': (p) => picture(p, [
    line(20, 270, 460, 270, { color: p.dim }),
    rocket(70, 270, 120), rocket(160, 270, 85), rocket(230, 270, 55),
    arrow(100, 200, 125, 200, { color: p.dim }), arrow(185, 220, 205, 220, { color: p.dim }),
    label(150, 290, 'FUEL BURNS, ROCKET SHRINKS', { color: p.dim, anchor: 'middle' }),
    poly([[300, 270], [340, 270], [340, 220], [380, 220], [380, 185], [420, 185], [420, 160], [460, 160]], { color: p.hot }),
    label(380, 140, 'SPEED GAINED', { color: p.hot, anchor: 'middle' }),
    label(360, 290, '1', { color: p.dim, anchor: 'middle' }), label(400, 290, '2', { color: p.dim, anchor: 'middle' }), label(440, 290, '3', { color: p.dim, anchor: 'middle' }),
  ]),

  // A spinning rock with a warm afternoon side glowing; a tiny arrow of thrust from the glow.
  'pic-yarkovsky': (p) => picture(p, [
    sun(50, 160, 14, p.hot), ...[130, 160, 190].map((y) => line(90, y, 215, y, { color: p.dim, dash: '6 4' })),
    rock(280, 160, 55, 6),
    arc(280, 160, 72, -2.1, -0.9), arrow(280 + 72 * Math.cos(-0.95), 160 + 72 * Math.sin(-0.95), 280 + 72 * Math.cos(-0.7), 160 + 72 * Math.sin(-0.7), {}), label(330, 70, 'SPIN', { color: p.dim }),
    ...[-2.3, -2.0, -1.7, -1.4].map((a) => line(280 + 60 * Math.cos(a), 160 + 60 * Math.sin(a), 280 + 80 * Math.cos(a), 160 + 80 * Math.sin(a), { color: p.hot })),
    label(190, 75, 'WARM AFTERNOON SIDE', { color: p.hot, anchor: 'middle' }),
    arrow(290, 225, 300, 260, { color: p.hot }), label(330, 262, 'TINY THRUST', { color: p.hot }),
  ]),

  // A map with a shaded stripe (where it could land) and arrows of people leaving it.
  'pic-evacuate': (p) => picture(p, [
    rect(40, 40, 400, 240, { color: p.dim }), poly([[40, 230], [90, 215], [150, 240], [230, 225], [310, 250], [380, 235], [440, 250]], { color: p.dim }),
    poly([[80, 280], [180, 40], [260, 40], [160, 280]], { closed: true, color: p.hot }),
    ...[1, 2, 3, 4, 5, 6].map((i) => line(80 + 11.4 * i, 280, 180 + 11.4 * i, 40, { color: p.dim })),
    label(330, 70, 'WHERE IT COULD LAND', { color: p.hot, anchor: 'middle' }),
    ...[[110, 110], [100, 170]].map(([x, y]) => arrow(x ?? 0, y ?? 0, (x ?? 0) - 45, y ?? 0, { color: p.dim }) + person((x ?? 0) - 55, (y ?? 0) - 10, 3)),
    ...[[220, 120], [210, 180], [195, 230]].map(([x, y]) => arrow(x ?? 0, y ?? 0, (x ?? 0) + 45, y ?? 0, { color: p.dim }) + person((x ?? 0) + 58, (y ?? 0) - 10, 3)),
  ]),

  // D13: a rock covered in tiny machines with a dust jet off one side; a small captured rock steered toward it.
  'pic-wild-ideas': (p) => picture(p, [
    rock(250, 165, 70, 3),
    ...Array.from({ length: 26 }, (_, i) => { const a = (i / 26) * Math.PI * 2; const r = 55 + (i % 3) * 6; return glowDot(250 + Math.cos(a) * r, 165 + Math.sin(a) * r, 2, p.hot); }),
    ...[0, 1, 2, 3, 4, 5].map((i) => line(180 - i * 22, 165 + (i % 2 ? 6 : -6), 166 - i * 22, 165 + (i % 2 ? -4 : 4), { color: p.ink })),
    label(70, 140, 'ITS OWN DUST', { color: p.ink }), label(70, 154, 'THROWN BACK', { color: p.dim }),
    arrow(330, 165, 400, 165, { color: p.hot }), label(365, 150, 'PUSH', { color: p.hot, anchor: 'middle' }),
    rock(395, 60, 10, 2, { color: p.dim }), spacecraft(415, 45, 6), arrow(385, 70, 320, 110, { color: p.dim, dash: '4 3' }),
    label(410, 95, 'A PARKED ROCK', { color: p.dim, anchor: 'middle' }), label(250, 275, 'TINY MACHINES', { color: p.hot, anchor: 'middle' }),
  ]),

  // A grid: rock size up the side, years of warning along the bottom; zones labeled nudge, hit, nuke, run.
  'pic-decision-chart': (p) => picture(p, [
    arrow(80, 270, 450, 270, { color: p.dim }), arrow(80, 270, 80, 40, { color: p.dim }),
    label(265, 295, 'YEARS OF WARNING', { color: p.dim, anchor: 'middle' }), label(70, 36, 'ROCK SIZE', { color: p.dim, anchor: 'end', size: 9 }),
    rock(60, 250, 4, 1, { color: p.dim }), rock(60, 70, 14, 2, { color: p.dim }),
    line(260, 50, 260, 270, { color: p.dim, dash: '4 4' }), line(80, 160, 440, 160, { color: p.dim, dash: '4 4' }),
    label(170, 220, 'HIT: SMALL, LATE', { color: p.ink, anchor: 'middle' }), label(170, 236, 'DUCK AND COVER', { color: p.dim, anchor: 'middle', size: 9 }),
    label(350, 220, 'NUDGE', { color: p.ink, anchor: 'middle' }), label(350, 236, 'A SMALL EARLY PUSH', { color: p.dim, anchor: 'middle', size: 9 }),
    label(350, 105, 'NUKE', { color: p.ink, anchor: 'middle' }), label(350, 121, 'BIG, STILL TIME', { color: p.dim, anchor: 'middle', size: 9 }),
    label(170, 105, 'RUN', { color: p.hot, anchor: 'middle', size: 14 }), label(170, 121, 'BIG, NO TIME', { color: p.hot, anchor: 'middle', size: 9 }),
  ]),

  // Three in-flight probes; the rock has just split; dashed lines re-aim each probe at a different piece.
  'pic-autonomy': (p) => picture(p, [
    spacecraft(60, 90, 9), spacecraft(60, 160, 9), spacecraft(60, 230, 9),
    circle(330, 150, 28, { color: p.dim, dash: '3 4' }), burst(330, 150, 32, 44, 8, { color: p.dim }),
    ...[90, 160, 230].map((y) => line(80, y, 300, 150, { color: p.dim })),
    rock(380, 95, 14, 1), rock(400, 160, 18, 2), rock(370, 220, 12, 3),
    arrow(80, 90, 366, 95, { color: p.hot, dash: '5 4' }), arrow(80, 160, 382, 160, { color: p.hot, dash: '5 4' }), arrow(80, 230, 358, 220, { color: p.hot, dash: '5 4' }),
    label(240, 290, 'EACH PROBE PICKS ITS OWN PIECE', { color: p.hot, anchor: 'middle' }),
  ]),
};
