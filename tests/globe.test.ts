import { describe, expect, it } from 'vitest';
import { globeFeatures, globeKindFor, orthographic, projectRuns, smallCircle, wavyParallel } from '../src/render/globe';

describe('globe projection', () => {
  it('puts the pole on the top limb untilted and at the centre when tipped a quarter turn', () => {
    const [x, y, z] = orthographic(0, 90, 100, 0, 0);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(-100);
    expect(z).toBeCloseTo(0);
    const [x2, y2, z2] = orthographic(0, 90, 100, 0, Math.PI / 2);
    expect(x2).toBeCloseTo(0);
    expect(y2).toBeCloseTo(0);
    expect(z2).toBeCloseTo(100);
  });
  it('the sub-viewer point faces the viewer and turning the globe moves it to the limb', () => {
    expect(orthographic(0, 0, 50, 0, 0)[2]).toBeCloseTo(50);
    const [x, , z] = orthographic(0, 0, 50, Math.PI / 2, 0);
    expect(x).toBeCloseTo(50);
    expect(z).toBeCloseTo(0);
  });
  it('a full parallel splits into a front run and a back run', () => {
    const runs = projectRuns(wavyParallel(20, 0, 1, 0, 36), 80, 0.3, 0.2);
    expect(runs.length).toBeGreaterThanOrEqual(2);
    expect(runs.some((r) => r.front)).toBe(true);
    expect(runs.some((r) => !r.front)).toBe(true);
    for (const r of runs) for (let i = 0; i < r.pts.length; i += 2) expect(Math.hypot(r.pts[i] ?? 0, r.pts[i + 1] ?? 0)).toBeLessThanOrEqual(80.001);
  });
  it('a small circle stays at its angular radius from its centre', () => {
    const c = smallCircle(40, 10, 8, 12);
    expect(c.length).toBe(26);
    const [cx, cy, cz] = orthographic(40, 10, 1, 0, 0);
    for (let i = 0; i < c.length; i += 2) {
      const [x, y, z] = orthographic(c[i] ?? 0, c[i + 1] ?? 0, 1, 0, 0);
      const dot = x * cx + y * cy + z * cz;
      expect(Math.acos(Math.min(1, dot))).toBeCloseTo((8 * Math.PI) / 180, 5);
    }
  });
  it('features are seeded and sized per kind', () => {
    const a = globeFeatures('ROCKY', 7);
    const b = globeFeatures('ROCKY', 7);
    expect(a).toEqual(b);
    expect(a.lines.length).toBeGreaterThanOrEqual(14);
    expect(globeFeatures('BANDED', 3).faint.length).toBeGreaterThanOrEqual(7);
    expect(globeFeatures('ICY', 3).faint.length).toBe(2);
    expect(globeFeatures('ROCKY', 8)).not.toEqual(a);
  });
  it('maps the system planets to kinds', () => {
    expect(globeKindFor('HOME')).toBe('EARTH');
    expect(globeKindFor('GIANT')).toBe('BANDED');
    expect(globeKindFor('OUTER')).toBe('ROCKY');
  });
});
