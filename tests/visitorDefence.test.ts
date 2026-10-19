import { describe, expect, it } from 'vitest';
import { is3D } from '../src/sim/orbit3';
import { resolveRound, type SciFiOpts } from '../src/sim/resolver';
import { roundRng } from '../src/sim/rng';
import { generateThreat } from '../src/sim/roundGen';
import { createWorld } from '../src/sim/world';

const NONE: SciFiOpts = { orbitalLaserW: 0, laserSince: null, disassemblerTauYears: 0, disassemblerSince: null, netTier: 0 };
const visitor = (seed: string): ReturnType<typeof createWorld> => {
  const w = createWorld(seed, 3);
  w.threat = generateThreat(roundRng(seed, 3), w, 3, 0, { flavor: 'INTERSTELLAR', skipDiscovery: true, scifi: true });
  return w;
};

describe('lasers on visitors from out of the plane (IDEAS 27)', () => {
  it('DE-STAR fires on a 3-D visitor by range, not plane, and moves its close approach', () => {
    for (const seed of ['VIS-1', 'VIS-2', 'VIS-4', 'VIS-7']) {
      const w = visitor(seed);
      expect(is3D(w.threat?.elements ?? { a: 1, e: 0, w: 0, M0: 0, t0: 0 })).toBe(true);
      const none = resolveRound(w, [], { scifi: NONE });
      const r = resolveRound(w, [], { scifi: { ...NONE, orbitalLaserW: 1e10, laserSince: 0 } });
      expect(r.events.some((e) => e.kind === 'PUSH' && e.method === 'DE_STAR'), seed).toBe(true);
      expect(Math.abs(r.ca.dMin - none.ca.dMin), seed).toBeGreaterThan(0);
      for (let i = 0; i + 1 < r.segments.length; i++) expect(r.segments[i + 1]?.tFrom).toBe(r.segments[i]?.tTo);
    }
  });

  it('the ground laser gets no window: a fast visitor crosses its 0.05 AU in about a day, the reserved last day', () => {
    const w = visitor('VIS-1');
    const r = resolveRound(w, [], { scifi: { ...NONE, groundLaserSince: 0 } });
    expect(r.events.some((e) => e.kind === 'PUSH')).toBe(false);
  });
});

describe('deep-space surveys warn of a SCI-FI visitor sooner (IDEAS 27)', () => {
  it('HIVE_2 multiplies the warning by 1.5 and HIVE_3 by 2; a run without them draws exactly as before', async () => {
    const { visitorWarningMult } = await import('../src/sim/roundGen');
    expect(visitorWarningMult([])).toBe(1);
    expect(visitorWarningMult(['ATLAS', 'HIVE_2'])).toBe(1.5);
    expect(visitorWarningMult(['HIVE_2', 'HIVE_3'])).toBe(2);
    const lead = (active: string[]): number => {
      const w = createWorld('VIS-3', 3);
      w.networks = { active, since: {} };
      return (generateThreat(roundRng('VIS-3', 3), w, 3, 0, { flavor: 'INTERSTELLAR', skipDiscovery: true, scifi: true }).tImpact - w.t);
    };
    const base = lead([]);
    expect(lead(['ATLAS'])).toBe(base);
    expect(lead(['HIVE_2']) / base).toBeCloseTo(1.5, 12);
    expect(lead(['HIVE_3']) / base).toBeCloseTo(2, 12);
  });
});
