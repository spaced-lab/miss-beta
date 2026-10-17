import { describe, expect, it } from 'vitest';
import { AU, YEAR } from '../src/physics/constants';
import { apoapsis, periapsis } from '../src/physics/kepler';
import { resolveRound } from '../src/sim/resolver';
import { drawDiameter, drawLeadTime, drawName, drawType, generateThreat, THREAT_TYPES } from '../src/sim/roundGen';
import { roundRng } from '../src/sim/rng';
import { createWorld } from '../src/sim/world';

describe('roundGen', () => {
  it('ROUNDGEN: 1000 seeds are bound, prograde, sane orbits with the ramp of Section 10', () => {
    for (let i = 0; i < 1000; i++) {
      const k = 1 + (i % 8);
      const rng = roundRng(`RG${i}`, k);
      const world = createWorld(`RG${i}`, k);
      const th = generateThreat(rng, world, k);
      expect(th.elements.e).toBeGreaterThanOrEqual(0);
      expect(th.elements.e).toBeLessThan(0.98);
      expect(periapsis(th.elements)).toBeGreaterThan(0.25 * AU);
      expect(apoapsis(th.elements)).toBeLessThan((th.type.kind === 'comet' ? 40 : 6) * AU);
      expect(th.D).toBeGreaterThanOrEqual(50 * 1.15 ** k - 1e-6);
      expect(th.D).toBeLessThanOrEqual(2000);
      expect(th.tImpact / YEAR).toBeGreaterThan(2.5 * 0.7 - 1e-9);
      expect(th.tImpact / YEAR).toBeLessThan(12 * 1.3 + 1e-9);
      expect(th.mass).toBeGreaterThan(0);
      expect(th.name).toMatch(/^\d{4} [A-Z]{2}-\d{1,2}$/);
      if (k < 4) expect(th.type.kind).toBe('asteroid');
    }
  });

  it('every generated threat impacts when unperturbed (200 seeds)', () => {
    for (let i = 0; i < 200; i++) {
      const k = 1 + (i % 6);
      const world = createWorld(`IMP${i}`, k);
      world.threat = generateThreat(roundRng(`IMP${i}`, k), world, k);
      const res = resolveRound(world);
      expect(res.outcome).toBe('HIT');
      expect(res.ca.dMin).toBeLessThan(res.ca.bCrit);
      expect(Math.abs(res.ca.tCa - world.threat.tImpact)).toBeLessThan(10);
      expect(res.ca.vInf / world.threat.vInfNominal).toBeCloseTo(1, 5);
      expect(res.energy.energyMt).toBeGreaterThan(0);
    }
  });

  it('is seeded and the draws ramp with round index', () => {
    const w = createWorld('S', 2);
    const a = generateThreat(roundRng('S', 2), w, 2);
    const b = generateThreat(roundRng('S', 2), w, 2);
    expect(a.elements).toEqual(b.elements);
    expect(a.name).toBe(b.name);
    const leads = [1, 5, 10].map((k) => drawLeadTime(roundRng('L', 0), k));
    expect(leads[0]).toBeGreaterThan(leads[1] as number);
    expect(leads[1]).toBeGreaterThan(leads[2] as number);
    const ds = [1, 5, 10].map((k) => drawDiameter(roundRng('D', 0), k));
    expect(ds[0]).toBeLessThan(ds[1] as number);
    expect(drawName(roundRng('N', 0))).toMatch(/^\d{4} [A-Z]{2}-\d{1,2}$/);
    expect(THREAT_TYPES.map((t) => t.id)).toEqual(['RUBBLE', 'STONY', 'IRON', 'ICY']);
    const seen = new Set<string>();
    const rng = roundRng('T', 0);
    for (let i = 0; i < 200; i++) seen.add(drawType(rng, 6).id);
    expect(seen.has('ICY')).toBe(true);
  });
});
