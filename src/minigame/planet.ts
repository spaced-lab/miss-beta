// WHAT: Procedural continents for the minigame's planet disc.
// WHY:  GAME_PLAN 4: "the planet disc with procedural continents (seeded noise around the circle, 2 to 5
//       landmasses, Asteroids-style jagged outlines)". The same generator will later serve the real
//       PLANET VIEW, so it lives apart from the arcade rules.
// HOW:  Each landmass is a jagged closed polygon around a centre inside the disc: 10 to 16 vertices at
//       random radii, then clamped inside 0.9 R so coastlines never cross the limb. Landmasses may
//       overlap; overlapping outlines read as one bigger continent, which is fine for line art.
// LORE: G8 (the look)

import type { Rng } from '../sim/rng';

/** A continent outline as a flat [x0, y0, x1, y1, ...] array in planet-radius units, closed implicitly. */
export type Continent = Float64Array;

/**
 * A landmass outline: layered sines around a centre (low harmonics give the overall shape, higher ones
 * give bays, peninsulas and a jagged coast), stretched along a random axis so continents are not blobs,
 * then clamped inside 0.9 R. `m` vertices.
 */
function landmass(rng: Rng, cx: number, cy: number, size: number, m: number, limit: number): Continent {
  const p1 = rng.float(0, Math.PI * 2);
  const p2 = rng.float(0, Math.PI * 2);
  const p3 = rng.float(0, Math.PI * 2);
  const p4 = rng.float(0, Math.PI * 2);
  const stretch = rng.float(0.7, 1.5);
  const tilt = rng.float(0, Math.PI);
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const pts = new Float64Array(m * 2);
  for (let i = 0; i < m; i++) {
    const phi = (i / m) * Math.PI * 2;
    const r = size * (1 + 0.32 * Math.sin(2 * phi + p1) + 0.2 * Math.sin(3 * phi + p2) + 0.12 * Math.sin(5 * phi + p3) + 0.07 * Math.sin(9 * phi + p4) + rng.float(-0.05, 0.05));
    const lx = r * Math.cos(phi) * stretch;
    const ly = (r * Math.sin(phi)) / stretch;
    let x = cx + lx * ct - ly * st;
    let y = cy + lx * st + ly * ct;
    const d = Math.hypot(x, y);
    if (d > limit) {
      x *= limit / d;
      y *= limit / d;
    }
    pts[i * 2] = x;
    pts[i * 2 + 1] = y;
  }
  return pts;
}

export function generateContinents(rng: Rng, planetR = 1, count?: number): Continent[] {
  const n = count ?? rng.int(2, 4);
  const out: Continent[] = [];
  const centres: Array<[number, number]> = [];
  const limit = 0.9 * planetR;
  for (let k = 0; k < n; k++) {
    // Keep centres apart so landmasses read as separate continents (a few tries, then accept overlap).
    let cx = 0;
    let cy = 0;
    for (let tries = 0; tries < 8; tries++) {
      const theta = rng.float(0, Math.PI * 2);
      const rc = rng.float(0.1, 0.62) * planetR;
      cx = rc * Math.cos(theta);
      cy = rc * Math.sin(theta);
      if (centres.every(([ox, oy]) => Math.hypot(cx - ox, cy - oy) > 0.5 * planetR)) break;
    }
    centres.push([cx, cy]);
    const size = (k === 0 ? rng.float(0.3, 0.42) : rng.float(0.16, 0.3)) * planetR;
    out.push(landmass(rng, cx, cy, size, rng.int(28, 40), limit));
  }
  // Islands.
  const islands = rng.int(1, 3);
  for (let k = 0; k < islands; k++) {
    const theta = rng.float(0, Math.PI * 2);
    const rc = rng.float(0.2, 0.8) * planetR;
    out.push(landmass(rng, rc * Math.cos(theta), rc * Math.sin(theta), rng.float(0.05, 0.1) * planetR, rng.int(8, 12), limit));
  }
  return out;
}

/** Crater layout for the moon: [dx, dy, r] in moon radii, fixed to the moon's face. */
export function generateCraters(rng: Rng, count = 5): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = [];
  for (let i = 0; i < count; i++) {
    const a = rng.float(0, Math.PI * 2);
    const d = rng.float(0, 0.6);
    out.push([d * Math.cos(a), d * Math.sin(a), rng.float(0.08, 0.22)]);
  }
  return out;
}

export { generateAsteroidShape } from '../sim/shapes';
