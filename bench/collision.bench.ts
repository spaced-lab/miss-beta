// WHAT: Micro-benchmark of the two bullet/asteroid collision strategies at late-game entity counts.
// WHY:  "Consider multiple options for doing the same thing and measure" is a habit this repo teaches.
//       Both strategies must agree (tests/minigame.test.ts); this file says which one to ship.
// HOW:  Plain timing loop under vitest (vitest 5 has no bench export, so this is a test that prints a
//       table). Run with `npm run bench`; MISS_BENCH=1 switches the include pattern in vite.config.ts.
// LORE: O1 (orders of magnitude), C3 (tests and the two-language trick)
import { describe, expect, it } from 'vitest';
import { findHitsGrid, findHitsNaive, type Circle } from '../src/minigame/collision';
import { Rng } from '../src/sim/rng';

function field(nb: number, na: number, seed: number): { bullets: Circle[]; asteroids: Circle[] } {
  const rng = new Rng(seed);
  const bullets: Circle[] = [];
  const asteroids: Circle[] = [];
  for (let i = 0; i < nb; i++) bullets.push({ x: rng.float(-7, 7), y: rng.float(-7, 7), r: 0.05 });
  for (let i = 0; i < na; i++) asteroids.push({ x: rng.float(-7, 7), y: rng.float(-7, 7), r: rng.float(0.1, 0.45) });
  return { bullets, asteroids };
}

function time(fn: () => void, minMs = 300): { usPerCall: number; calls: number } {
  for (let i = 0; i < 20; i++) fn(); // warm up the JIT
  const t0 = performance.now();
  let calls = 0;
  while (performance.now() - t0 < minMs) {
    fn();
    calls++;
  }
  return { usPerCall: ((performance.now() - t0) * 1000) / calls, calls };
}

describe('collision strategy benchmark', () => {
  it('reports microseconds per call for naive vs grid', () => {
    const rows: Record<string, string | number>[] = [];
    for (const [nb, na] of [[100, 20], [400, 60], [800, 120]] as const) {
      const f = field(nb, na, 1);
      const naive = time(() => findHitsNaive(f.bullets, f.asteroids));
      const grid = time(() => findHitsGrid(f.bullets, f.asteroids));
      rows.push({
        'bullets x asteroids': `${nb} x ${na}`,
        'naive us/call': naive.usPerCall.toFixed(1),
        'grid us/call': grid.usPerCall.toFixed(1),
        'grid speedup': (naive.usPerCall / grid.usPerCall).toFixed(2) + 'x',
      });
    }
    console.log(`\n${rows.map((r) => Object.entries(r).map(([k, v]) => `${k}: ${v}`).join("  ")).join("\n")}\n\n`);
    expect(rows.length).toBe(3);
  });
});
