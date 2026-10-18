// WHAT: Frame cost of the cinematics renderer: pixels drawn per frame and JS time per frame, by scene.
// WHY:  Owner 2026-10-18 asked for finer launch pixels; finer means more fillRects. This says how many and what
//       the JS side costs, so the knob CINE_LAUNCH_CELL_PX is set with data (CLAUDE.md: measure, then pick).
// HOW:  A recording-free mock Surface counts dot calls; each scene is rendered at 60 evenly spaced moments and
//       timed. Canvas fill cost is not measurable in node: in the browser, read window.__miss.cpuMs during a
//       cinematic. Printed table; the assertion is a loose ceiling on the JS side.
// LORE: C3 (tests), G8 (the look)
import { describe, expect, it } from 'vitest';
import { renderScene } from '../src/render/cinematics/draw';
import { buildScene, type CineContext } from '../src/render/cinematics/scene';
import { PALETTES } from '../src/render/palettes';
import type { SimEventRecord } from '../src/sim/eventLog';
import { mockSurface } from '../tests/helpers/mockSurface';

const shape = new Float64Array([1, 1.1, 0.9, 1.05, 0.95, 1, 1.08, 0.92, 1.02, 0.97]);
const ctx: CineContext = { name: 'T1', typeId: 'RUBBLE', D: 140, shape, betaHidden: false, energyMt: 67 };
const t = 1e7;

describe('cinematics frame cost', () => {
  it('launch and breakup frames stay cheap on the JS side', () => {
    const cases: [string, SimEventRecord, SimEventRecord | null][] = [
      ['LAUNCH L1', { t, kind: 'LAUNCH', missionId: 'M-1', c3: 12, massKg: 900, tier: 1 }, null],
      ['LAUNCH L3', { t, kind: 'LAUNCH', missionId: 'M-1', c3: 12, massKg: 9000, tier: 3 }, null],
      ['BREAKUP (RUBBLE)', { t, kind: 'FRAGMENTATION', missionId: 'M-1', targetId: 'THREAT', qRatio: 1.8, count: 48, largestD: 61, vEj: 0.8, escaped: 0 }, { t, kind: 'IMPACT', missionId: 'M-1', U: 9800, beta: 2.4, dvAlong: 0.002, dvTotal: 0.0025, massKg: 1500, targetId: 'THREAT', qRatio: 1.8 }],
    ];
    const rows: Record<string, string | number>[] = [];
    for (const [name, e, comp] of cases) {
      const sc = buildScene(e, comp, ctx);
      if (!sc) continue;
      const m = mockSurface(PALETTES.PHOSPHOR, true, 1400, 900, false);
      const frames = 60;
      for (let i = 0; i < frames; i++) renderScene(m.s, sc, (i / frames) * sc.duration, 'T-0', false);
      m.dots = 0;
      let peak = 0;
      const t0 = performance.now();
      for (let rep = 0; rep < 5; rep++) {
        for (let i = 0; i < frames; i++) {
          const before = m.dots;
          renderScene(m.s, sc, (i / frames) * sc.duration, 'T-0', false);
          peak = Math.max(peak, m.dots - before);
        }
      }
      const ms = (performance.now() - t0) / (5 * frames);
      rows.push({ scene: name, 'dots/frame (mean)': Math.round(m.dots / (5 * frames)), 'dots/frame (peak)': peak, 'JS ms/frame': ms.toFixed(3) });
      expect(ms).toBeLessThan(4);
    }
    console.table(rows);
  });
});
