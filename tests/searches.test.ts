import { describe, expect, it } from 'vitest';
import { KNOBS } from '../src/config/knobs';
import { launcherTier } from '../src/physics/estimates';
import { flybySearch } from '../src/planner/flybySearch';
import { computePorkchop } from '../src/planner/porkchop';
import { sailSearch } from '../src/planner/sailSearch';
import { roundRng } from '../src/sim/rng';
import { generateThreat } from '../src/sim/roundGen';
import { createWorld, planetById } from '../src/sim/world';
import { runJob } from '../src/worker/planner.worker';

function worldFor(seed: string) {
  const w = createWorld(seed, 1);
  w.threat = generateThreat(roundRng(seed, 1), w, 1, 0, { skipDiscovery: true });
  return w;
}

describe('flyby search', () => {
  it('a GIANT flyby raises U by more than 10 km/s in at least one seeded configuration', () => {
    let found = false;
    let anyCells = 0;
    for (let i = 0; i < 6 && !found; i++) {
      const w = worldFor(`FLY-${i}`);
      const th = w.threat!;
      const home = planetById(w, 'HOME');
      const tier = launcherTier(2);
      const direct = computePorkchop({ home: home.elements, threat: th.elements, muSun: w.star.mu, tMin: KNOBS.BUILD_TIME_KINETIC, tImpact: th.tImpact, tier });
      let bestDirectU = 0;
      for (let k = 0; k < direct.U.length; k++) if ((direct.payload[k] as number) > 500) bestDirectU = Math.max(bestDirectU, direct.U[k] as number);
      const res = flybySearch({ home: home.elements, threat: th.elements, planets: w.planets.filter((p) => p.id !== 'HOME').map((p) => ({ id: p.id, mu: p.mu, radius: p.radius, elements: p.elements })), muSun: w.star.mu, tMin: KNOBS.BUILD_TIME_KINETIC, tImpact: th.tImpact, tier, dsmBudget: 1000 });
      anyCells += res.cells.length;
      for (const c of res.cells) {
        expect(c.dsm).toBeLessThanOrEqual(1000);
        expect(c.payload).toBeGreaterThan(0);
        expect(Math.hypot(c.v2.x, c.v2.y)).toBeGreaterThan(0);
        if (c.planetId === 'GIANT' && c.payload > 500 && c.U > bestDirectU + 10e3) found = true;
      }
      expect(Object.keys(res.windows).length).toBe(3);
    }
    expect(anyCells).toBeGreaterThan(0);
    expect(found).toBe(true);
  }, 60000);
});

describe('sail search', () => {
  it('finds sail-then-coast intercepts with a built dv and a fitting end mismatch', () => {
    const w = worldFor('SAIL-1');
    const th = w.threat!;
    const home = planetById(w, 'HOME');
    const res = sailSearch({ home: home.elements, threat: th.elements, muSun: w.star.mu, tMin: KNOBS.BUILD_TIME_KINETIC, tImpact: th.tImpact, tier: launcherTier(1), sailTier: 3, dsmBudget: 5000 });
    expect(res.arcsTried).toBeGreaterThan(0);
    expect(res.cells.length).toBeGreaterThan(0);
    for (const c of res.cells) {
      expect(c.dsm).toBeLessThanOrEqual(5000);
      expect(c.dvEquiv).toBeGreaterThan(1000);
      expect(c.impactorKg).toBeLessThan(c.payload);
      expect(c.samples.length).toBeGreaterThan(100);
      expect(c.tS).toBeGreaterThan(c.tL);
      expect(c.tA).toBeGreaterThan(c.tS);
    }
    const viaWorker = runJob({ id: 1, type: 'sail', home: home.elements, threat: th.elements, muSun: w.star.mu, tMin: KNOBS.BUILD_TIME_KINETIC, tImpact: th.tImpact, tier: 1, sailTier: 1, dsmBudget: 1000 });
    expect(viaWorker.type).toBe('sail');
  }, 60000);
});
