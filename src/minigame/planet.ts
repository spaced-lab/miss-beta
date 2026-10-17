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

export function generateContinents(rng: Rng, planetR = 1, count?: number): Continent[] {
  const n = count ?? rng.int(2, 5);
  const out: Continent[] = [];
  for (let k = 0; k < n; k++) {
    const theta = rng.float(0, Math.PI * 2);
    const rc = rng.float(0.15, 0.6) * planetR;
    const cx = rc * Math.cos(theta);
    const cy = rc * Math.sin(theta);
    const size = rng.float(0.22, 0.5) * planetR;
    const m = rng.int(10, 16);
    const pts = new Float64Array(m * 2);
    const limit = 0.9 * planetR;
    for (let i = 0; i < m; i++) {
      const phi = (i / m) * Math.PI * 2;
      // NOTE: lumpy radius; the 0.55..1.15 band gives bays and peninsulas without self-intersection.
      const r = size * rng.float(0.55, 1.15);
      let x = cx + r * Math.cos(phi);
      let y = cy + r * Math.sin(phi);
      const d = Math.hypot(x, y);
      if (d > limit) {
        x *= limit / d;
        y *= limit / d;
      }
      pts[i * 2] = x;
      pts[i * 2 + 1] = y;
    }
    out.push(pts);
  }
  return out;
}

/** Vertex radius multipliers for an asteroid outline: 8 to 12 vertices, 0.65..1.2 of nominal radius. */
export function generateAsteroidShape(rng: Rng): Float64Array {
  const n = rng.int(8, 12);
  const s = new Float64Array(n);
  for (let i = 0; i < n; i++) s[i] = rng.float(0.65, 1.2);
  return s;
}
