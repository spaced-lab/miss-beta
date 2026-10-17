// WHAT: Bullet-vs-asteroid circle collision, with two interchangeable strategies.
// WHY:  Late in a run there are hundreds of bullets and dozens of rocks per frame. The naive O(B*A) test
//       is the obvious implementation; a uniform grid is O(B + A) in practice. Both are kept, both are
//       benchmarked (bench/collision.bench.ts) and both must agree exactly (tests/minigame.test.ts),
//       which is the "consider multiple options and measure" habit this repo teaches.
// HOW:  Input is any array of circle-like objects. Output is an Int32Array: for each bullet, the index of
//       the asteroid it hits (nearest by penetration depth when several overlap) or -1. The grid cell
//       size is the largest asteroid diameter plus the bullet diameter, so any overlapping asteroid's
//       centre is in the bullet's cell or one of its 8 neighbours.
// LORE: C2 (reading the code), O1 (orders of magnitude)

export interface Circle {
  x: number;
  y: number;
  r: number;
}

export type CollisionStrategy = 'naive' | 'grid' | 'auto';

/**
 * Measured crossover (bench/collision.bench.ts, Apple Silicon, node 26): naive wins below roughly
 * 20k bullet-asteroid pairs because the grid's bucketing has a fixed cost; grid wins above it.
 * `[knob]` Re-run the bench on a slow machine before trusting this to a factor of two.
 */
export const AUTO_CROSSOVER_PAIRS = 20000;

export function findHits(bullets: readonly Circle[], asteroids: readonly Circle[], strategy: CollisionStrategy): Int32Array {
  const useGrid = strategy === 'grid' || (strategy === 'auto' && bullets.length * asteroids.length >= AUTO_CROSSOVER_PAIRS);
  return useGrid ? findHitsGrid(bullets, asteroids) : findHitsNaive(bullets, asteroids);
}

export function findHitsNaive(bullets: readonly Circle[], asteroids: readonly Circle[]): Int32Array {
  const out = new Int32Array(bullets.length).fill(-1);
  for (let i = 0; i < bullets.length; i++) {
    const b = bullets[i];
    if (!b) continue;
    let best = -1;
    let bestDepth = 0;
    for (let j = 0; j < asteroids.length; j++) {
      const a = asteroids[j];
      if (!a) continue;
      const rr = a.r + b.r;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < rr * rr) {
        const depth = rr - Math.sqrt(d2);
        if (depth > bestDepth) {
          bestDepth = depth;
          best = j;
        }
      }
    }
    out[i] = best;
  }
  return out;
}

export function findHitsGrid(bullets: readonly Circle[], asteroids: readonly Circle[]): Int32Array {
  const out = new Int32Array(bullets.length).fill(-1);
  if (asteroids.length === 0 || bullets.length === 0) return out;

  let maxAr = 0;
  let maxBr = 0;
  for (const a of asteroids) if (a.r > maxAr) maxAr = a.r;
  for (const b of bullets) if (b.r > maxBr) maxBr = b.r;
  const cell = 2 * (maxAr + maxBr) || 1;
  const inv = 1 / cell;

  // Bucket asteroids. Keys are packed integer cell coords; buckets are plain arrays of indices.
  const buckets = new Map<number, number[]>();
  const key = (cx: number, cy: number): number => (cx + 32768) * 65536 + (cy + 32768);
  for (let j = 0; j < asteroids.length; j++) {
    const a = asteroids[j];
    if (!a) continue;
    const k = key(Math.floor(a.x * inv), Math.floor(a.y * inv));
    const list = buckets.get(k);
    if (list) list.push(j);
    else buckets.set(k, [j]);
  }

  for (let i = 0; i < bullets.length; i++) {
    const b = bullets[i];
    if (!b) continue;
    const cx = Math.floor(b.x * inv);
    const cy = Math.floor(b.y * inv);
    let best = -1;
    let bestDepth = 0;
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const list = buckets.get(key(cx + ox, cy + oy));
        if (!list) continue;
        for (const j of list) {
          const a = asteroids[j];
          if (!a) continue;
          const rr = a.r + b.r;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < rr * rr) {
            const depth = rr - Math.sqrt(d2);
            // NOTE: tie-break on lower index so naive and grid agree bit for bit.
            if (depth > bestDepth || (depth === bestDepth && best !== -1 && j < best)) {
              bestDepth = depth;
              best = j;
            }
          }
        }
      }
    }
    out[i] = best;
  }
  return out;
}
