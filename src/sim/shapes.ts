// WHAT: Seeded outline generators shared by the sim views and the minigame: asteroid polygons, continents.
// WHY:  GAME_PLAN 4: "Asteroid: irregular closed polyline (8 to 12 vertices, seeded)" and "procedural
//       continents". Both the real PLANET VIEW and PERIMETER draw them, so they live in sim (pure, Rng only).
// HOW:  Moved here from minigame/planet.ts, which re-exports them so the arcade mode is unchanged.
// LORE: G8 (the look)

import type { Rng } from './rng';

/** Vertex radius multipliers for an asteroid outline: 8 to 12 vertices, 0.65..1.2 of nominal radius. */
export function generateAsteroidShape(rng: Rng): Float64Array {
  const n = rng.int(8, 12);
  const s = new Float64Array(n);
  for (let i = 0; i < n; i++) s[i] = rng.float(0.65, 1.2);
  return s;
}
