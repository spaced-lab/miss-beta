// IDEAS 26: protected sites. Targets, aimed rounds, and HOME rounds unchanged.
import { describe, expect, it } from 'vitest';
import { resolveRound } from '../src/sim/resolver';
import { generateThreat, pickTarget } from '../src/sim/roundGen';
import { roundRng } from '../src/sim/rng';
import { targetCloseApproach, targetOf } from '../src/sim/targets';
import { createWorld } from '../src/sim/world';

describe('TARGETS', () => {
  it('HOME rounds are unchanged when no site is built', () => {
    const a = generateThreat(roundRng('T1', 2), createWorld('T1', 2), 2, 0, { runSeed: 'T1' });
    const b = generateThreat(roundRng('T1', 2), createWorld('T1', 2), 2, 0, { runSeed: 'T1', sites: [] });
    expect(b).toEqual(a);
    expect(a.targetId).toBeUndefined();
  });
  it('the Moon circles HOME at 384,400 km with a 27-day period', () => {
    const w = createWorld('MOONW', 1);
    const moon = targetOf(w, 'MOON');
    const home = targetOf(w, 'HOME');
    for (const t of [0, 5e5, 2e6]) {
      const d = Math.hypot(moon.state(t).r.x - home.state(t).r.x, moon.state(t).r.y - home.state(t).r.y);
      expect(d / 3.844e8).toBeCloseTo(1, 9);
    }
    const P = 2 * Math.PI * Math.sqrt(3.844e8 ** 3 / 3.986004418e14) / 86400;
    expect(P).toBeGreaterThan(27);
    expect(P).toBeLessThan(28);
  });
  it('a round aimed at each site hits that site and misses HOME', () => {
    for (const site of ['MOON', 'OUTER', 'GIANT_MOON'] as const) {
      let found = false;
      for (let i = 0; i < 40 && !found; i++) {
        const seed = `AIM${site}${i}`;
        if (pickTarget(seed, 3, [site]) !== site) continue;
        found = true;
        const w = createWorld(seed, 3);
        const th = generateThreat(roundRng(seed, 3), w, 3, 0, { runSeed: seed, sites: [site] });
        w.threat = th;
        expect(th.targetId).toBe(site);
        const r = resolveRound(w, []);
        expect(r.outcome, site).toBe('HIT');
        const toHome = targetCloseApproach(th.elements, targetOf(w, 'HOME'), w.star.mu, th.tImpact);
        expect(toHome.impact, site).toBe(false);
      }
      expect(found, site).toBe(true);
    }
  }, 60000);
});
