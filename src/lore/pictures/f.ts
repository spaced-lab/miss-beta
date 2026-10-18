// WHAT: SIMPLE pictures for section F (finding and warning: EDUCATION.md F1-F12).
// WHY:  See index.ts.
// HOW:  One generator per picture id using ./svg helpers. Ink is the subject, dim the scaffolding, hot the
//       one thing the eye should land on.
// LORE: G8

import { arc, arrow, circle, earth, ellipse, glowDot, label, labelBox, line, picture, poly, rect, rock, spacecraft, sun, telescope, type PicPalette } from './svg';

type Gen = (p: PicPalette) => string;

// Rough continent outlines as (lon, lat) polygons for the survey map.
const CONTINENTS: readonly (readonly [number, number])[][] = [
  [[-165, 70], [-130, 72], [-95, 75], [-75, 62], [-55, 48], [-80, 30], [-98, 20], [-85, 10], [-110, 22], [-125, 40], [-150, 60]],
  [[-80, 10], [-62, 8], [-35, -8], [-40, -22], [-60, -40], [-70, -55], [-75, -35], [-82, -10]],
  [[-10, 35], [0, 45], [10, 55], [30, 70], [70, 75], [110, 75], [140, 65], [160, 60], [145, 45], [120, 35], [105, 20], [80, 10], [70, 22], [55, 25], [50, 12], [40, -5], [35, -33], [20, -35], [10, -10], [-15, 10], [-17, 20]],
  [[115, -20], [130, -12], [145, -15], [152, -30], [140, -38], [117, -35]],
];
const mapX = (lon: number): number => Math.round(40 + ((lon + 180) / 360) * 400);
const mapY = (lat: number): number => Math.round(50 + ((90 - lat) / 180) * 200);

export const PICTURES_F: Readonly<Record<string, Gen>> = {
  // Four frames of the same star field; one dot moves a little each frame; a line joins the four.
  'pic-tracklet': (p) => {
    const stars: [number, number][] = [[20, 30], [60, 20], [80, 70], [30, 110], [70, 130], [45, 80], [15, 60]];
    const f: string[] = [label(240, 50, 'THE SAME SKY, FOUR TIMES', { color: p.dim, anchor: 'middle' })];
    const path: [number, number][] = [];
    for (let i = 0; i < 4; i++) {
      const x = 20 + 115 * i;
      f.push(rect(x, 80, 100, 150, { color: p.dim }), label(x + 50, 250, `${i + 1}`, { color: p.dim, anchor: 'middle' }));
      for (const [sx, sy] of stars) f.push(glowDot(x + sx, 80 + sy, 1.4, p.dim));
      const mx = x + 25 + 15 * i, my = 80 + 60 + 6 * i;
      f.push(glowDot(mx, my, 2.6, p.hot));
      path.push([mx, my]);
    }
    f.push(poly(path, { color: p.dim, dash: '3 4' }));
    return picture(p, f);
  },

  // Two rocks lit by the Sun: a small white one and a big charcoal one shining equally bright to a telescope.
  'pic-albedo': (p) => picture(p, [
    sun(50, 160, 14, p.hot),
    rock(210, 105, 10, 3), label(210, 80, 'SMALL AND WHITE', { color: p.dim, anchor: 'middle' }),
    rock(210, 230, 30, 5), ...[-24, -18, -12, -6, 0, 6, 12, 18, 24].map((dx) => { const h = Math.sqrt(28 * 28 - dx * dx); return line(210 + dx, 230 - h, 210 + dx, 230 + h, { color: p.dim }); }),
    label(210, 285, 'BIG AND CHARCOAL', { color: p.dim, anchor: 'middle' }),
    arrow(226, 112, 385, 160, { color: p.dim }), arrow(244, 222, 385, 170, { color: p.dim }),
    telescope(410, 185, 14),
    label(400, 130, 'SAME BRIGHTNESS', { color: p.hot, anchor: 'middle' }),
  ]),

  // Earth, the Sun, a telescope on Earth's night side looking away from the Sun; a rock sneaking in from the Sun's side.
  'pic-sunward': (p) => picture(p, [
    sun(60, 160, 16, p.hot),
    earth(380, 160, 30), line(380, 130, 380, 190, { color: p.dim, dash: '2 3' }),
    label(350, 215, 'DAY', { color: p.dim, anchor: 'middle' }), label(410, 215, 'NIGHT', { color: p.dim, anchor: 'middle' }),
    telescope(422, 150, 7), arrow(430, 140, 465, 120, { color: p.dim }), label(440, 105, 'LOOKING', { color: p.dim, anchor: 'middle' }),
    arrow(150, 190, 340, 168, { dash: '5 4' }), rock(250, 178, 8, 4, { color: p.hot }),
    label(250, 230, 'UNSEEN: IT COMES OUT OF THE GLARE', { color: p.dim, anchor: 'middle' }),
  ]),

  // The same dark rock twice: dim in visible light, glowing in heat-vision.
  'pic-infrared': (p) => picture(p, [
    line(240, 50, 240, 270, { color: p.dim, dash: '4 4' }),
    rock(130, 150, 45, 3, { color: p.dim }), label(130, 240, 'VISIBLE LIGHT: DIM', { color: p.dim, anchor: 'middle' }),
    rock(350, 150, 45, 3, { color: p.hot }), ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => { const a = (i / 10) * Math.PI * 2; return line(350 + 56 * Math.cos(a), 150 + 56 * Math.sin(a), 350 + 72 * Math.cos(a), 150 + 72 * Math.sin(a), { color: p.hot }); }),
    label(350, 240, 'HEAT: BRIGHT', { color: p.hot, anchor: 'middle' }),
  ]),

  // A world map with telescope icons; a dashed ring for "space: empty".
  'pic-survey-map': (p) => picture(p, [
    ellipse(240, 150, 228, 135, { color: p.dim, dash: '4 4' }), label(240, 300, 'SPACE: EMPTY', { color: p.dim, anchor: 'middle' }),
    rect(40, 50, 400, 200, { color: p.dim }),
    ...CONTINENTS.map((c) => poly(c.map(([lon, lat]) => [mapX(lon), mapY(lat)] as [number, number]), { closed: true, color: p.dim })),
    ...([[-111, 33], [-155, 20], [-70, -30], [20, -32], [12, 42], [105, 30]] as const).map(([lon, lat]) => telescope(mapX(lon), mapY(lat), 4, { color: p.hot })),
    label(240, 36, 'WHERE THE TELESCOPES ARE', { color: p.dim, anchor: 'middle' }),
  ]),

  // A big dish sending a wave to a potato-shaped rock; the echo comes back drawn as a shape and a distance.
  'pic-radar': (p) => picture(p, [
    arc(110, 150, 45, 2.3, 3.98), line(70, 155, 70, 215), line(55, 215, 85, 215), line(70, 150, 100, 150), circle(100, 150, 3),
    ...[70, 100, 130].map((r) => arc(100, 150, r, -0.4, 0.4, { color: p.hot })),
    rock(360, 150, 32, 5),
    ...[60, 90].map((r) => arc(360, 150, r, 2.75, 3.55, { color: p.dim, dash: '3 3' })),
    line(40, 255, 440, 255, { color: p.dim, dash: '2 4' }),
    rock(400, 285, 14, 5), label(400, 310, 'SHAPE', { color: p.dim, anchor: 'middle' }),
    arrow(100, 285, 330, 285, { color: p.dim }), arrow(330, 285, 100, 285, { color: p.dim }), label(215, 310, 'DISTANCE TO THE METRE', { color: p.dim, anchor: 'middle' }),
    label(240, 110, 'PING', { color: p.hot, anchor: 'middle' }), label(240, 200, 'ECHO', { color: p.dim, anchor: 'middle' }),
  ]),

  // Earth, L1 with two satellites looking sunward, a telescope on the Moon, two dots at L4 and L5.
  'pic-future-telescopes': (p) => picture(p, [
    arc(40, 160, 260, -0.56, 0.56, { color: p.dim, dash: '4 4' }),
    sun(40, 160, 14, p.hot),
    earth(300, 160, 14),
    spacecraft(250, 148, 6), spacecraft(258, 172, 6), arrow(238, 160, 215, 160, { color: p.dim }), label(255, 200, 'L1', { color: p.dim, anchor: 'middle' }),
    circle(335, 135, 5), telescope(338, 124, 4), label(360, 130, 'MOON', { color: p.dim }),
    glowDot(260, 22, 3, p.dim), label(275, 26, 'L4', { color: p.dim }),
    glowDot(260, 298, 3, p.dim), label(275, 302, 'L5', { color: p.dim }),
    label(130, 300, 'TELESCOPES THAT LOOK TOWARD THE SUN', { color: p.dim, anchor: 'middle' }),
  ]),

  // A fuzzy cigar-shaped cloud of possible positions crossing Earth; days later the cloud is a thin line that misses.
  'pic-uncertainty-cloud': (p) => picture(p, [
    label(120, 60, 'TODAY', { color: p.dim, anchor: 'middle' }),
    earth(120, 160, 22), ellipse(130, 150, 110, 28, { rotate: -25, color: p.hot, dash: '3 3' }), ellipse(130, 150, 70, 16, { rotate: -25, color: p.dim, dash: '2 3' }),
    arrow(215, 160, 262, 160, { color: p.dim }), label(240, 180, 'DAYS', { color: p.dim, anchor: 'middle' }), label(240, 192, 'LATER', { color: p.dim, anchor: 'middle' }),
    label(360, 60, 'MORE OBSERVATIONS', { color: p.dim, anchor: 'middle' }),
    earth(360, 160, 22), arrow(260, 250, 460, 140, { color: p.hot }), label(420, 230, 'MISS', { color: p.hot, anchor: 'middle' }),
  ]),

  // A 0 to 10 color ladder from white (nothing) through green, yellow, orange, to red.
  // NOTE: the game is monochrome line art, so hatch density stands in for colour; the band names are the labels.
  'pic-torino': (p) => {
    const f: string[] = [label(240, 60, 'TORINO SCALE', { color: p.dim, anchor: 'middle' })];
    for (let i = 0; i <= 10; i++) {
      const x = 20 + 40 * i, col = i >= 8 ? p.hot : i === 0 ? p.dim : p.ink;
      f.push(rect(x, 130, 36, 60, { color: col }), label(x + 18, 120, `${i}`, { color: p.dim, anchor: 'middle' }));
      for (let k = 1; k <= i; k++) f.push(line(x + (36 * k) / (i + 1), 130, x + (36 * k) / (i + 1), 190, { color: col }));
    }
    const bands: [number, string][] = [[38, 'WHITE'], [78, 'GREEN'], [158, 'YELLOW'], [278, 'ORANGE'], [398, 'RED']];
    for (const [x, t] of bands) f.push(label(x, 215, t, { color: p.dim, anchor: 'middle' }));
    f.push(label(38, 240, 'NOTHING', { color: p.dim, anchor: 'middle' }), label(398, 240, 'CERTAIN HIT', { color: p.dim, anchor: 'middle' }));
    return picture(p, f);
  },

  // Telescope -> clearing house -> orbit computers -> warning network -> space agencies -> governments.
  'pic-chain': (p) => picture(p, [
    labelBox(30, 70, 120, 40, 'TELESCOPE', p.hot), arrow(150, 90, 178, 90, { color: p.dim }),
    labelBox(180, 70, 120, 40, 'CLEARING HOUSE', p.ink), arrow(300, 90, 328, 90, { color: p.dim }),
    labelBox(330, 70, 120, 40, 'ORBIT COMPUTERS', p.ink), arrow(390, 110, 390, 198, { color: p.dim }),
    labelBox(330, 200, 120, 40, 'WARNING NETWORK', p.ink), arrow(330, 220, 302, 220, { color: p.dim }),
    labelBox(180, 200, 120, 40, 'SPACE AGENCIES', p.ink), arrow(180, 220, 152, 220, { color: p.dim }),
    labelBox(30, 200, 120, 40, 'GOVERNMENTS', p.ink),
    label(240, 290, 'WHO TELLS WHOM', { color: p.dim, anchor: 'middle' }),
  ]),
  // A size ruler from 1 m to 10 km: rocks drawn small to large, a red danger stretch, and "seen in time" arrows.
  'pic-gauge': (p) => {
    const X = (D: number): number => Math.round(40 + (Math.log10(D) / 4) * 400);
    const f: string[] = [label(240, 40, 'ROCK SIZE', { color: p.dim, anchor: 'middle' })];
    f.push(line(40, 200, 440, 200, { color: p.dim }));
    const ticks: [number, string][] = [[1, '1 M'], [10, '10 M'], [100, '100 M'], [1000, '1 KM'], [10000, '10 KM']];
    for (const [D, t] of ticks) f.push(line(X(D), 196, X(D), 206, { color: p.dim }), label(X(D), 222, t, { color: p.dim, anchor: 'middle', size: 10 }));
    f.push(rect(X(20), 70, X(140) - X(20), 125, { color: p.hot, dash: '4 3' }), label((X(20) + X(140)) / 2, 64, 'MOSTLY UNSEEN', { color: p.hot, anchor: 'middle', size: 10 }));
    f.push(rock(X(1.5), 180, 3, 2, { color: p.ink }), rock(X(30), 176, 7, 3, { color: p.ink }), rock(X(400), 170, 13, 5, { color: p.ink }), rock(X(4000), 160, 22, 7, { color: p.ink }));
    f.push(arrow(X(80), 110, 440, 110, { color: p.ink }), label(X(80) - 4, 104, 'IN TIME TO DEFLECT', { color: p.ink, size: 9 }));
    f.push(arrow(X(35), 140, 440, 140, { color: p.ink }), label(X(35) - 4, 134, 'IN TIME TO EVACUATE', { color: p.ink, size: 9 }));
    f.push(arrow(X(1), 90, X(4), 90, { color: p.dim }), label(X(1), 84, 'FIREBALLS', { color: p.dim, size: 9 }));
    f.push(label(240, 270, 'FUND TELESCOPES: THE ARROWS GROW LEFT', { color: p.dim, anchor: 'middle' }));
    return picture(p, f);
  },

  // The planets' flat disc seen edge-on; a fast dark rock dives steeply from far above toward the Earth while the
  // telescopes' band of sky looks along the disc; a clock with only a sliver of time left.
  'pic-interstellar': (p) => picture(p, [
    ellipse(220, 210, 190, 22, { color: p.dim, dash: '4 4' }), label(60, 250, 'WHERE THE PLANETS ARE', { color: p.dim }),
    sun(220, 210, 10, p.hot), earth(330, 214, 9),
    line(340, 204, 440, 186, { color: p.dim, dash: '2 3' }), line(340, 220, 440, 236, { color: p.dim, dash: '2 3' }), label(400, 262, 'TELESCOPES', { color: p.dim, anchor: 'middle' }),
    rock(130, 50, 8, 6, { color: p.ink }), arrow(140, 60, 318, 200, { color: p.hot }), label(150, 36, 'FROM ANOTHER STAR: FAST AND DARK', { color: p.ink }),
    circle(430, 70, 26, { color: p.dim }), line(430, 70, 430, 50, { color: p.ink }), line(430, 70, 445, 76, { color: p.ink }),
    arc(430, 70, 22, -1.57, -1.05, { color: p.hot }), label(430, 116, 'WEEKS', { color: p.hot, anchor: 'middle' }),
  ]),
};
