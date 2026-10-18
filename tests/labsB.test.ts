// WHAT: Tests for the second batch of labs (porkchop, flyby, sail spiral, sunward, interstellar, Monte Carlo, RK4).
// WHY:  Labs run inside the Learning Center every frame: they must load lazily, print finite numbers at every
//       slider extreme, draw without throwing at any time, and stay cheap once their cache is warm.
// HOW:  loadLab for each id; lines() at min, default and max of all sliders together; draw() against a stub
//       Surface whose methods are no-ops (the cinematics test uses the same idea); one timing check per lab.
//       Plus a few physics spot checks that the labs show what the game's functions compute.
// LORE: C3 (tests and the two-language trick), C2 (reading the code)

import { describe, expect, it } from 'vitest';
import { loadLab } from '../src/lore/labs/index';
import { contourSegments, keyOf, loop, Memo } from '../src/lore/labs/kit';
import type { Lab } from '../src/lore/labs/lab';
import { values } from '../src/lore/labs/lab';
import type { Surface } from '../src/render/canvas';
import { PALETTES } from '../src/render/palettes';

const IDS = ['LAB_LAMBERT_PORKCHOP', 'LAB_FLYBY', 'LAB_SAIL_SPIRAL', 'LAB_SUNWARD', 'LAB_INTERSTELLAR', 'LAB_MONTECARLO', 'LAB_RK4'];

function stubSurface(): Surface & { strokes: number } {
  const noop = (): void => {};
  const ctx = new Proxy({}, { get: () => noop, set: () => true }) as unknown as CanvasRenderingContext2D;
  const s = {
    canvas: {} as HTMLCanvasElement,
    ctx,
    width: 900,
    height: 600,
    dpr: 1,
    palette: PALETTES.PHOSPHOR,
    glowMode: 'none',
    spectrum: false,
    holoDrift: 0,
    strokes: 0,
    role: () => '#33FF33',
    resize: noop,
    clear: noop,
    stroke(pts: ArrayLike<number>) {
      for (let i = 0; i < pts.length; i++) if (!Number.isFinite(pts[i] as number)) throw new Error(`non-finite stroke point at ${i}`);
      s.strokes++;
    },
    circle(x: number, y: number, r: number) {
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(r)) throw new Error('non-finite circle');
      s.strokes++;
    },
    dot: noop,
  };
  return s as unknown as Surface & { strokes: number };
}

const BOX = { x: 20, y: 20, w: 420, h: 260 };

function at(lab: Lab, which: 'min' | 'default' | 'max'): Record<string, number> {
  const v = values(lab.sliders);
  if (which === 'default') return v;
  for (const sl of lab.sliders) v[sl.key] = which === 'min' ? sl.min : sl.max;
  return v;
}

describe('labs batch B', () => {
  it('every lab loads, prints finite lines at min/default/max and draws at t = 0 and t = 5', async () => {
    for (const id of IDS) {
      const lab = await loadLab(id);
      expect(lab, id).not.toBeNull();
      if (!lab) continue;
      expect(lab.code.length).toBeGreaterThan(0);
      for (const which of ['min', 'default', 'max'] as const) {
        const v = at(lab, which);
        const lines = lab.lines(v);
        expect(lines.length, `${id} ${which}`).toBeGreaterThanOrEqual(2);
        expect(lines.length).toBeLessThanOrEqual(4);
        for (const l of lines) {
          expect(l, `${id} ${which}: ${l}`).not.toMatch(/NaN|undefined|Infinity/);
          expect(l.length, `${id}: ${l}`).toBeLessThanOrEqual(92);
        }
        for (const t of [0, 5, 13.7]) {
          const s = stubSurface();
          expect(() => lab.draw(s, v, BOX, t), `${id} ${which} t=${t}`).not.toThrow();
          expect(s.strokes).toBeGreaterThan(3);
        }
      }
    }
  });

  it('a warm-cache draw stays under 5 ms', async () => {
    for (const id of IDS) {
      const lab = await loadLab(id);
      if (!lab) throw new Error(id);
      const v = values(lab.sliders);
      const s = stubSurface();
      lab.draw(s, v, BOX, 1); // warm the cache
      lab.lines(v);
      let best = Infinity;
      for (let k = 0; k < 5; k++) {
        const t0 = performance.now();
        lab.draw(s, v, BOX, 2 + k * 0.37);
        best = Math.min(best, performance.now() - t0);
      }
      expect(best, id).toBeLessThan(5);
    }
  });

  it('the labs report what the physics computes', async () => {
    const fly = await loadLab('LAB_FLYBY');
    // GIANT, r_p = 10 R, 10 km/s: 80.2 deg (flyby.ts doc example), dv = 12.9 km/s.
    const fl = fly!.lines({ vinf: 10, rp: 10, side: 1, planet: 3, phi: 120 });
    expect(fl[0]).toMatch(/delta = 2 asin\(1\/e\) = 80\.[12]/);
    expect(fl[2]).toMatch(/12\.9 km\/s/);
    const sail = await loadLab('LAB_SAIL_SPIRAL');
    // Tier 3 (10 g/m2), one year of SPIRAL_OUT along the real spiral: about 6.7 km/s (tests/m4.test.ts NOTE).
    const sl = sail!.lines({ sigma: 10, law: 0, years: 1 });
    const dv = Number(/dv built ([0-9.]+) km\/s/.exec(sl[2] ?? '')?.[1]);
    expect(dv).toBeGreaterThan(6.5);
    expect(dv).toBeLessThan(7);
    const rk = await loadLab('LAB_RK4');
    const rl = rk!.lines({ h: 24, method: 2, thrust: 0, e: 0.5 });
    const eu = Number(/Euler ([0-9.e+-]+) AU/.exec(rl[1] ?? '')?.[1]);
    const r4 = Number(/RK4 ([0-9.e+-]+) AU/.exec(rl[1] ?? '')?.[1]);
    expect(r4).toBeLessThan(eu / 100);
    const mc = await loadLab('LAB_MONTECARLO');
    const sure = mc!.lines({ N: 100, sigma: 0, bLo: 4, bHi: 4 });
    expect(sure[1]).toMatch(/P\(MISS\) = (1|0) /);
    const sun = await loadLab('LAB_SUNWARD');
    // A big rock from the night side is found long before a small one out of the sun.
    const night = sun!.lines({ dir: 180, D: 500, sentinel: 0 });
    expect(night[1]).toMatch(/first discovery/);
    const vis = await loadLab('LAB_INTERSTELLAR');
    // A 2 km visitor is found by today's surveys months out, in time for a standby nuclear craft; an 80 m one
    // never gets more than a couple of weeks; the warning line is distance over mean closing speed.
    const big = vis!.lines({ D: 2000, p: 0.04, vinf: 40, incl: 0, dir: 90, surveyor: 0, hive: 0 });
    expect(Number(/, (\d+) days before impact/.exec(big[1] ?? '')?.[1])).toBeGreaterThan(90);
    expect(big[3]).toMatch(/NUKE STANDBY/);
    const ratio = /= ([0-9.]+) days$/.exec(big[2] ?? '');
    expect(Math.abs(Number(ratio?.[1]) - Number(/, (\d+) days/.exec(big[1] ?? '')?.[1]))).toBeLessThan(5);
    for (const incl of [0, 60, 120]) {
      const small = vis!.lines({ D: 80, p: 0.04, vinf: 40, incl, dir: 90, surveyor: 0, hive: 0 });
      const w = Number(/, (\d+) days before impact/.exec(small[1] ?? '')?.[1] ?? 0);
      expect(w).toBeLessThan(21);
    }
  });

  it('kit: memo, keys, loop and contours', () => {
    let made = 0;
    const m = new Memo<number>(2);
    m.get('a', () => ++made);
    m.get('a', () => ++made);
    m.get('b', () => ++made);
    m.get('c', () => ++made);
    m.get('a', () => ++made); // evicted, rebuilt
    expect(made).toBe(4);
    expect(keyOf(0.1 + 0.2, 3)).toBe(keyOf(0.3, 3));
    expect(loop(7, 4)).toBeCloseTo(0.75);
    const z = [0, 1, 2, 1, 2, 3, 2, 3, 4];
    expect(contourSegments(z, 3, 3, 1.5).length).toBe(12);
  });
});
