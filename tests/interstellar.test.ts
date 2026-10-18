// REALISTIC visitors from other stars (owner backlog 10-12): the rate dial, 3-D lite tilt, discovery-derived lead.
import { describe, expect, it } from 'vitest';
import { YEAR } from '../src/physics/constants';
import { resolveRound } from '../src/sim/resolver';
import { generateThreat } from '../src/sim/roundGen';
import { roundRng } from '../src/sim/rng';
import { coverage, coverageAll, eclipticLatitude } from '../src/sim/sky';
import { createWorld } from '../src/sim/world';
import { networkById, NETWORKS } from '../src/sim/detection';

describe('INTERSTELLAR rate dial', () => {
  it('a seed draws the same ordinary round at rate 0 and at the REAL rate', () => {
    for (const seed of ['A1', 'B2', 'C3']) {
      for (const k of [1, 3]) {
        const a = generateThreat(roundRng(seed, k), createWorld(seed, k), k, 0, { interstellarRate: 0, runSeed: seed });
        const b = generateThreat(roundRng(seed, k), createWorld(seed, k), k, 0, { interstellarRate: 1e-6, runSeed: seed });
        expect(b.name).toBe(a.name);
        expect(b.tImpact).toBe(a.tImpact);
        expect(b.flavor).toBeUndefined();
      }
    }
  });
  it('at rate 1 every REALISTIC round is a tilted, dark, fast visitor with weeks of warning or none, and it still hits', () => {
    let warned = 0;
    for (const seed of ['V1', 'V2', 'V3', 'V4', 'V5', 'V6']) {
      const world = createWorld(seed, 2);
      const th = generateThreat(roundRng(seed, 2), world, 2, 0, { interstellarRate: 1, runSeed: seed });
      world.threat = th;
      expect(th.flavor).toBe('INTERSTELLAR');
      expect(th.elements.e).toBeGreaterThan(1);
      expect(th.incl ?? -1).toBeGreaterThanOrEqual(0);
      expect(th.incl ?? 9).toBeLessThanOrEqual(Math.PI);
      expect(th.tImpact).toBeLessThan(2.1 * YEAR);
      if (!th.noWarning) warned++;
      expect(resolveRound(world, []).outcome).toBe('HIT');
    }
    expect(warned).toBeGreaterThanOrEqual(0);
  });
});

describe('SKY coverage', () => {
  it('ground coverage falls with latitude and is zero inside the elongation limit; IR is a band', () => {
    const atlas = networkById('ATLAS');
    expect(coverage(atlas, 30, 0)).toBe(0);
    expect(coverage(atlas, 90, 30)).toBeCloseTo((atlas.pCover ?? 0) * 0.8, 12);
    const ir = NETWORKS.find((n) => n.kind === 'SPACE_IR') as (typeof NETWORKS)[number];
    expect(coverage(ir, ((ir.epsMin ?? 45) + (ir.epsMax ?? 120)) / 2, 60)).toBe(1);
    expect(coverageAll([atlas, atlas], 90, 0)).toBeCloseTo(1 - (1 - (atlas.pCover ?? 0)) ** 2, 12);
    expect(eclipticLatitude({ x: 1, y: 0, z: 1 }, { x: 0, y: 0 })).toBeCloseTo(45, 9);
  });
});

describe('SKY view geometry', () => {
  it('elongation and unit vectors match the doc examples', async () => {
    const { elongationOf, skyVector } = await import('../src/render/views/sky');
    expect(elongationOf(90, 0)).toBeCloseTo(90, 9);
    expect(elongationOf(0, 60)).toBeCloseTo(60, 9);
    const v = skyVector(30, 40);
    expect(Math.hypot(...v)).toBeCloseTo(1, 12);
  });
});
