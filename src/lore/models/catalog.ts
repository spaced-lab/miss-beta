// WHAT: The 3-D model catalog: real spacecraft, telescopes, antennas and launchers as wireframes.
// WHY:  Owner, 2026-10-18: devices and mechanisms turning in 3-D next to the lore. Each model is built at its
//       real size from public fact sheets (NASA, JPL, ESA, Rubin Observatory: public domain or free to cite),
//       so a scale bar next to it is honest. Shapes are simplified to what a line drawing can carry.
// HOW:  A Model is data plus `build(t)`: the parts at time t (t animates a mechanism: a dish slewing, arrays
//       unrolling, a sail billowing). Dimensions are in metres and marked [approx] where the public figure
//       is a round number. `topics` attaches a model to Learning Center topics; the first match is shown.
//       IMAGE REQUESTS for sharper wireframes are listed in docs/ASSET_REQUESTS.md.
// LORE: D3 (DART), F5 (Rubin), F6 (radar), F4 (NEO Surveyor), D7 (sails), D6 (tractor), D8 (rockets), D5 (HAMMER)

import { box, cylinder, dish, move, panel, recolor, ring, rotX, rotY, rotZ, sphere, strut, type Part, type V3 } from './mesh';

export interface Model {
  id: string;
  title: string;
  /** Learning Center topic ids this model illustrates (first listed wins when several models match). */
  topics: string[];
  /** Two to four short facts with numbers. */
  facts: string[];
  /** Where the dimensions come from (public sources). */
  source: string;
  /** Size of the scale bar, metres. */
  scaleBar: number;
  build(t: number): Part[];
}

const flat = (...groups: Part[][]): Part[] => groups.flat();

/** DART (2021-2022): 1.2 x 1.3 x 1.3 m bus, two 8.5 m ROSA roll-out arrays, DRACO camera, RLSA antenna. */
const DART: Model = {
  id: 'DART',
  title: 'DART  (DOUBLE ASTEROID REDIRECTION TEST)',
  topics: ['D3', 'D1', 'T4', 'D11'],
  facts: [
    '580 KG AT IMPACT, 6.14 KM/S INTO DIMORPHOS (160 M), 26 SEP 2022.',
    'ORBIT PERIOD OF DIMORPHOS CUT BY 33 MIN: BETA ABOUT 3.6.',
    'TWO ROLL-OUT SOLAR ARRAYS (ROSA), 8.5 M EACH; DRACO CAMERA LOOKS FORWARD.',
  ],
  source: 'NASA / JHU-APL DART MISSION FACT SHEET (PUBLIC DOMAIN). SIZES [APPROX].',
  scaleBar: 5,
  build: (t) => {
    // Arrays unroll over the first 3 s of each 12 s cycle, then stay out.
    const u = Math.min(1, (t % 12) / 3);
    const L = 0.6 + 7.9 * u;
    const arrays = flat(
      move(panel(L, 1.2, Math.max(1, Math.round(6 * u)), 'program'), [0.65 + L / 2, 0, 0]),
      move(panel(L, 1.2, Math.max(1, Math.round(6 * u)), 'program'), [-0.65 - L / 2, 0, 0]),
    );
    return flat(
      [box(1.2, 1.3, 1.3, 'craft')],
      arrays,
      move(cylinder(0.11, 0.11, 0, 0.5, 6, 'craft'), [0, 0.65, 0.3]).map((p) => p),
      // RLSA high-gain antenna: a flat disc on the side.
      rotX(move([ring(0.5, 0, 16, 'craft')], [0, 0, 0]), Math.PI / 2).map((p) => ({ ...p, seg: p.seg.map((v, i) => (i % 3 === 2 ? v - 0.7 : v)) })),
      // DRACO looks along +y (the flight direction in this view).
      move(cylinder(0.1, 0.18, 0, 0.35, 6, 'sail'), [0, 0.65, -0.2]),
    );
  },
};

/** Rubin Observatory (Simonyi Survey Telescope): 8.4 m primary, compact alt-az mount, 3.2 gigapixel camera. */
const RUBIN: Model = {
  id: 'RUBIN',
  title: 'RUBIN OBSERVATORY  (SIMONYI SURVEY TELESCOPE)',
  topics: ['F5', 'F1', 'F2', 'F8'],
  facts: [
    '8.4 M PRIMARY MIRROR, 3.2 GIGAPIXEL CAMERA, 9.6 SQUARE DEGREE FIELD.',
    'SWEEPS THE WHOLE VISIBLE SOUTHERN SKY ABOUT EVERY 3 NIGHTS TO V ~24.5.',
    'EXPECTED TO FIND MOST NEAR-EARTH OBJECTS LARGER THAN 140 M WITHIN A DECADE.',
  ],
  source: 'RUBIN OBSERVATORY / NSF-DOE PUBLIC FACT SHEETS. SIZES [APPROX].',
  scaleBar: 5,
  build: (t) => {
    // The tube slews in elevation and azimuth slowly, as a survey telescope steps field to field.
    const el = 0.9 + 0.25 * Math.sin(t * 0.4);
    const tube = flat(
      [ring(4.2, 0, 32, 'craft')],
      [ring(4.2, 0.4, 32, 'craft', true)],
      [ring(1.8, 6.2, 24, 'craft')],
      [ring(1.8, 6.6, 24, 'craft', true)],
      // Serrurier truss: eight struts from the mirror cell ring to the top-end ring.
      Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        const b = a + Math.PI / 8;
        return strut([4.2 * Math.cos(a), 0.4, 4.2 * Math.sin(a)], [1.8 * Math.cos(b), 6.2, 1.8 * Math.sin(b)], 'craft');
      }),
      // The camera at the top end.
      move(cylinder(0.8, 0.8, 0, 1.6, 8, 'sail'), [0, 6.2, 0]),
    );
    const tilted = rotY(rotX(move(tube, [0, -2.5, 0]), -(Math.PI / 2 - el)), t * 0.15);
    const mount = flat(cylinder(5.5, 5.5, -6, -5.2, 12, 'planet'), [box(9, 3, 3, 'planet')].map((p) => ({ ...p, seg: p.seg.map((v, i) => (i % 3 === 1 ? v - 3.8 : v)) })));
    return flat(move(tilted, [0, 0.8, 0]), mount);
  },
};

/** Goldstone DSS-14: the 70 m Mars antenna, used with Green Bank for planetary radar. */
const GOLDSTONE: Model = {
  id: 'GOLDSTONE',
  title: 'GOLDSTONE DSS-14  (70 M PLANETARY RADAR)',
  topics: ['F6', 'F8', 'F9'],
  facts: [
    '70 M DISH, 450 KW X-BAND TRANSMITTER; ECHOES COME BACK DAYS OR SECONDS LATER.',
    'RADAR PINS AN ORBIT TO METRES AND MM/S: A FEW NIGHTS CAN SAVE DECADES OF OPTICAL ARCS.',
    'SIGNAL FALLS AS 1 / DISTANCE^4: ONLY OBJECTS WITHIN ABOUT 0.1 AU ARE GOOD TARGETS.',
  ],
  source: 'NASA JPL DEEP SPACE NETWORK FACT SHEETS (PUBLIC DOMAIN). SIZES [APPROX].',
  scaleBar: 20,
  build: (t) => {
    const el = 0.55 + 0.35 * Math.sin(t * 0.3);
    const reflector = flat(
      dish(35, 9, 6, 16, 'craft'),
      // Quadripod to the subreflector and the feed cone at the vertex.
      Array.from({ length: 4 }, (_, i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return strut([30 * Math.cos(a), 9 * (30 / 35) ** 2, 30 * Math.sin(a)], [0, 26, 0], 'craft');
      }),
      [ring(3, 26, 12, 'sail')],
      cylinder(2.5, 1.2, 0, 6, 6, 'sail'),
    );
    const aimed = rotY(rotX(reflector, -(Math.PI / 2 - el)), t * 0.12);
    const pedestal = flat([box(24, 16, 16, 'planet')].map((p) => ({ ...p, seg: p.seg.map((v, i) => (i % 3 === 1 ? v - 20 : v)) })), cylinder(18, 18, -28, -27, 16, 'planet'));
    return flat(move(aimed, [0, 2, 0]), pedestal);
  },
};

/** NEO Surveyor: a 50 cm infrared telescope at Sun-Earth L1, launch planned for 2027. */
const NEO_SURVEYOR: Model = {
  id: 'NEO_SURVEYOR',
  title: 'NEO SURVEYOR  (INFRARED, SUN-EARTH L1)',
  topics: ['F4', 'F3', 'F7'],
  facts: [
    '50 CM TELESCOPE, TWO THERMAL-INFRARED CHANNELS (4-5 AND 6-10 MICRONS).',
    'AT L1 IT LOOKS AWAY FROM THE SUN BUT CLOSE TO IT: IT SEES THE DAYTIME-SKY ROCKS GROUND SURVEYS MISS.',
    'HEAT GIVES SIZE: AN INFRARED FLUX CONSTRAINS DIAMETER WITHOUT KNOWING THE ALBEDO.',
  ],
  source: 'NASA JPL NEO SURVEYOR MISSION OVERVIEW (PUBLIC DOMAIN). SIZES [APPROX].',
  scaleBar: 1,
  build: (t) => {
    const scope = flat(cylinder(0.32, 0.32, 0, 1.8, 10, 'craft'), [ring(0.25, 1.8, 16, 'craft', true)]);
    // Sunshade: a stepped V of panels between the Sun (to -x) and the telescope.
    const shade = flat(
      rotZ(move(panel(2.4, 2.0, 3, 'program'), [0, 0, 0]), Math.PI / 2).map((p) => ({ ...p, seg: p.seg.map((v, i) => (i % 3 === 0 ? v - 0.75 : v)) })),
      rotZ(move(panel(2.0, 1.8, 3, 'program'), [0, 0, 0]), Math.PI / 2).map((p) => ({ ...p, seg: p.seg.map((v, i) => (i % 3 === 0 ? v - 0.95 : i % 3 === 1 ? v + 0.1 : v)) })),
    );
    const bus = [box(1.1, 0.6, 1.1, 'craft')].map((p) => ({ ...p, seg: p.seg.map((v, i) => (i % 3 === 1 ? v - 0.3 : v)) }));
    const array = move(panel(1.4, 1.0, 3, 'program'), [0, -0.62, 0]);
    void t;
    return flat(scope, shade, bus, array);
  },
};

/** A square solar sail on four booms (NEA Scout's sail was 86 m^2; Solar Cruiser tested 1,650 m^2). */
const SOLAR_SAIL: Model = {
  id: 'SOLAR_SAIL',
  title: 'SOLAR SAIL  (SQUARE SAIL ON FOUR BOOMS)',
  topics: ['D7'],
  facts: [
    'SUNLIGHT PUSHES 9 MICRONEWTONS PER SQUARE METRE AT 1 AU ON A PERFECT MIRROR.',
    'NO FUEL: THE PUSH NEVER STOPS, SO SPEED BUILDS FOR MONTHS.',
    'TILT IT AND THE PUSH TILTS: SPIRAL OUT OR IN BY STEERING THE ANGLE.',
  ],
  source: 'NASA NEA SCOUT AND SOLAR CRUISER FACT SHEETS (PUBLIC DOMAIN). SHOWN AT 10 M.',
  scaleBar: 2,
  build: (t) => {
    const S = 5;
    const billow = 0.35 + 0.1 * Math.sin(t * 1.3);
    const seg: number[] = [];
    // A quilted membrane: grid lines sag toward the centre (y down = away from the Sun).
    const n = 8;
    const yAt = (x: number, z: number): number => -billow * (1 - (x * x + z * z) / (2 * S * S));
    for (let i = 0; i <= n; i++) {
      const a = -S + (2 * S * i) / n;
      for (let j = 0; j < n; j++) {
        const b0 = -S + (2 * S * j) / n;
        const b1 = -S + (2 * S * (j + 1)) / n;
        seg.push(a, yAt(a, b0), b0, a, yAt(a, b1), b1);
        seg.push(b0, yAt(b0, a), a, b1, yAt(b1, a), a);
      }
    }
    const booms = [strut([-S, 0, -S], [S, 0, S], 'craft', false), strut([-S, 0, S], [S, 0, -S], 'craft', false)];
    return flat([{ role: 'sail', seg, fine: true }], booms, [box(0.3, 0.3, 0.6, 'craft')]);
  },
};

/** Gravity tractor: a spacecraft hovering beside an asteroid, thrusters canted so the plume misses it. */
const TRACTOR: Model = {
  id: 'TRACTOR',
  title: 'GRAVITY TRACTOR  (HOVER AND PULL)',
  topics: ['D6', 'D9', 'D12'],
  facts: [
    'THE CRAFT\'S OWN GRAVITY PULLS THE ROCK; ITS THRUSTERS HOLD THE GAP AGAINST THAT PULL.',
    'A 20 T CRAFT HOVERING 200 M FROM A 200 M ROCK PULLS WITH ABOUT 0.1 N.',
    'TINY BUT TIDE-PROOF: NO CONTACT, WORKS ON RUBBLE PILES AND SPINNING BODIES.',
  ],
  source: 'LU AND LOVE, NATURE 438 (2005); NASA ARM STUDIES. GENERIC CRAFT.',
  scaleBar: 50,
  build: (t) => {
    const bob = 4 * Math.sin(t * 0.8);
    const rock = sphere(100, 6, 10, 'threat', (u, v) => 1 + 0.12 * Math.sin(7 * u + 3 * v) + 0.08 * Math.cos(11 * v));
    const craft = flat([box(8, 5, 5, 'craft')], move(panel(18, 4, 4, 'program'), [0, 0, 0]));
    // Two plumes canted 20 degrees out so they clear the rock below.
    const plumes = [strut([2, -2.5, 0], [2 + 30 * Math.sin(0.35), -2.5 - 30 * Math.cos(0.35), 0], 'nuclear'), strut([-2, -2.5, 0], [-2 - 30 * Math.sin(0.35), -2.5 - 30 * Math.cos(0.35), 0], 'nuclear')];
    return flat(rotY(rock, t * 0.2), move(flat(craft, plumes), [0, 200 + bob, 0]));
  },
};

/** A two-stage medium launcher (Falcon 9 class): 70 m, 3.7 m wide, payload fairing 5.2 m. */
const LAUNCHER: Model = {
  id: 'LAUNCHER',
  title: 'MEDIUM LAUNCHER  (TWO STAGES, FAIRING)',
  topics: ['D8', 'O10', 'G3'],
  facts: [
    'ABOUT 70 M TALL, 3.7 M WIDE; THE FIRST STAGE IS MOSTLY PROPELLANT BY MASS.',
    'C3 IS DEPARTURE ENERGY: EVERY KM2/S2 MORE COSTS PAYLOAD (THE PLANNER\'S LAUNCHER TABLES).',
    'STAGING DROPS DEAD WEIGHT: THE ROCKET EQUATION SAYS WHY.',
  ],
  source: 'PUBLIC LAUNCH-VEHICLE USER GUIDES AND NASA LSP DATA. GENERIC SHAPE [APPROX].',
  scaleBar: 10,
  build: (t) => {
    // Every 10 s the stages separate for 3 s and come back (an exploded view of staging).
    const ph = t % 10;
    const gap = ph > 6 ? Math.min(1, (ph - 6) / 1.2) * Math.max(0, 1 - Math.max(0, ph - 9)) * 8 : 0;
    const first = flat(cylinder(1.85, 1.85, 0, 42, 8, 'craft'), cylinder(1.85, 1.85, 42, 43, 8, 'craft'));
    const fins = Array.from({ length: 4 }, (_, i) => {
      const a = (i / 4) * Math.PI * 2;
      return strut([1.85 * Math.cos(a), 2, 1.85 * Math.sin(a)], [3.2 * Math.cos(a), 0, 3.2 * Math.sin(a)], 'craft', false);
    });
    const engines = Array.from({ length: 9 }, (_, i) => (i === 0 ? [0, 0] : [1.2 * Math.cos((i / 8) * Math.PI * 2), 1.2 * Math.sin((i / 8) * Math.PI * 2)])).map(([x, z]) => move(cylinder(0.25, 0.4, -1.2, 0, 4, 'nuclear'), [x ?? 0, 0, z ?? 0])).flat();
    const second = move(flat(cylinder(1.85, 1.85, 0, 13, 8, 'craft'), move(cylinder(0.3, 0.9, -2, 0, 6, 'nuclear'), [0, 0, 0])), [0, 43 + gap, 0]);
    const fairing = move(flat(cylinder(2.6, 2.6, 0, 7, 8, 'sail'), cylinder(2.6, 0.4, 7, 13, 8, 'sail')), [0, 56 + gap * 1.6, 0]);
    return move(flat(first, fins, engines, second, fairing), [0, -35, 0]);
  },
};

/** HAMMER (NASA/NNSA 2018 study): an 8.8 t vehicle usable as a kinetic impactor or a standoff device. */
const HAMMER: Model = {
  id: 'HAMMER',
  title: 'HAMMER  (HYPERVELOCITY ASTEROID MITIGATION MISSION)',
  topics: ['D5', 'D10', 'D4'],
  facts: [
    'A 2018 NASA / NNSA STUDY: 8.8 T, ONE DESIGN THAT CAN HIT (KINETIC) OR BURST NEARBY (NUCLEAR STANDOFF).',
    'STANDOFF: X-RAYS HEAT A THIN SKIN OF THE FACING SIDE; THE BLOW-OFF IS THE PUSH.',
    'A BURST TOO STRONG BREAKS THE ROCK: WATCH Q/Q* IN THE PLANNER.',
  ],
  source: 'BARBEE ET AL., ACTA ASTRONAUTICA 143 (2018). SHAPE IS A SKETCH.',
  scaleBar: 2,
  build: (t) => flat(rotY(flat(cylinder(1.5, 1.5, 0, 6, 10, 'craft'), cylinder(1.5, 0.5, 6, 8.5, 10, 'nuclear'), move(panel(6, 1.5, 4, 'program'), [0, 3, 0])), t * 0.4)),
};

/** A rubble-pile asteroid like Bennu or Ryugu: a spinning top, boulders on the surface. */
const RUBBLE: Model = {
  id: 'RUBBLE',
  title: 'RUBBLE-PILE ASTEROID  (BENNU / RYUGU SHAPE)',
  topics: ['T5', 'T1', 'T2', 'T6', 'D4'],
  facts: [
    'BENNU: 490 M, A "SPINNING TOP" WITH AN EQUATORIAL RIDGE, BULK DENSITY ABOUT 1.2 G/CM3.',
    'HALF EMPTY SPACE INSIDE: BOULDERS HELD BY THEIR OWN WEAK GRAVITY.',
    'OSIRIS-REX\'S SAMPLER SANK IN LIKE A BALL PIT (2020).',
  ],
  source: 'NASA OSIRIS-REX AND JAXA HAYABUSA2 SHAPE MODELS (PUBLIC). SHAPE STYLISED.',
  scaleBar: 100,
  build: (t) => {
    // Spinning-top: radius bulges at the equator (u = 0.5).
    const top = sphere(245, 8, 14, 'threat', (u, v) => 0.82 + 0.22 * Math.sin(u * Math.PI) ** 6 + 0.05 * Math.sin(9 * v + 4 * u));
    const boulders = Array.from({ length: 7 }, (_, i) => {
      const a = i * 2.4;
      const u = 0.25 + 0.5 * ((i * 0.37) % 1);
      const r = 245 * (0.82 + 0.22 * Math.sin(u * Math.PI) ** 6);
      const c: V3 = [r * Math.sin(u * Math.PI) * Math.cos(a), r * Math.cos(u * Math.PI), r * Math.sin(u * Math.PI) * Math.sin(a)];
      return move([box(18 + i * 3, 14 + i * 2, 16, 'fragment')], c);
    }).flat();
    return rotY(flat(top, boulders), t * 0.35);
  },
};

export const MODELS: readonly Model[] = [DART, RUBIN, GOLDSTONE, NEO_SURVEYOR, SOLAR_SAIL, TRACTOR, LAUNCHER, HAMMER, RUBBLE];

/** The model for a topic, or null. */
export function modelForTopic(id: string): Model | null {
  return MODELS.find((m) => m.topics.includes(id)) ?? null;
}

void recolor;
