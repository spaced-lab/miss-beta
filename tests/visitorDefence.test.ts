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

describe('inclined pickets (IDEAS 27)', () => {
  it('a parked craft pays less C3 for a steep visitor and finds more windows; nothing changes for a planar rock', async () => {
    const { computePorkchop } = await import('../src/planner/porkchop');
    const { launcherTier } = await import('../src/physics/estimates');
    const { planetById } = await import('../src/sim/world');
    const w = visitor('VIS-6');
    const th = w.threat;
    if (!th) throw new Error('no threat');
    const req = { home: planetById(w, 'HOME').elements, threat: th.elements, muSun: w.star.mu, tMin: w.t, tImpact: th.tImpact, tier: launcherTier(3), c3Bonus: 55 };
    const plain = computePorkchop(req);
    const parked = computePorkchop({ ...req, vzPark: 5000 });
    let lower = 0;
    for (let i = 0; i < plain.c3.length; i++) {
      const a = plain.c3[i] ?? NaN;
      const b = parked.c3[i] ?? NaN;
      if (Number.isFinite(a)) {
        expect(b).toBeLessThanOrEqual(a);
        if (b < a) lower++;
      }
    }
    expect(lower).toBeGreaterThan(0);
    expect(parked.feasible).toBeGreaterThanOrEqual(plain.feasible);
    const flat = createWorld('PICKET-FLAT', 1);
    const ft = generateThreat(roundRng('PICKET-FLAT', 1), flat, 1, 0, { skipDiscovery: true });
    const fr = { home: planetById(flat, 'HOME').elements, threat: ft.elements, muSun: flat.star.mu, tMin: 0, tImpact: ft.tImpact, tier: launcherTier(3) };
    expect([...computePorkchop({ ...fr, vzPark: 5000 }).c3]).toEqual([...computePorkchop(fr).c3]);
  });

  it('the program gives a craft on standby and 5 km/s of parked out-of-plane speed', async () => {
    const { applyEffects, defaultEffects, programById } = await import('../src/sim/programs');
    const { createEconomy } = await import('../src/game/economy');
    const c = { economy: createEconomy(10, 8), effects: defaultEffects(), networks: { active: [] as string[], since: {} } };
    applyEffects(programById('INCLINED_PICKETS'), c, 0);
    expect(c.effects.standbyInterceptor).toBe(true);
    expect(c.effects.parkedVz).toBe(5000);
  });
});
