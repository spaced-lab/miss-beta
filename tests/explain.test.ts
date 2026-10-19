import { describe, expect, it } from 'vitest';
import { KNOBS } from '../src/config/knobs';
import { launcherTier, LAUNCHERS } from '../src/physics/estimates';
import { explainNoPlan, launcherCeiling } from '../src/planner/explain';
import { computePorkchop } from '../src/planner/porkchop';
import { roundRng } from '../src/sim/rng';
import { generateThreat } from '../src/sim/roundGen';
import { createWorld, planetById } from '../src/sim/world';

const YEAR = 31557600;

describe('why the planner has no plan (IDEAS 27)', () => {
  it('launcher ceilings come from the payload curves', () => {
    expect(launcherCeiling(launcherTier(1))).toBe(80);
    expect(launcherCeiling(launcherTier(2))).toBe(110);
    expect(launcherCeiling(launcherTier(3))).toBe(130);
    expect(LAUNCHERS.length).toBe(3);
  });

  it('a visitor too close for a new build is TIME; with a craft on standby the wall becomes energy, out of the plane', () => {
    // VIS-6 arrives in about 0.74 years: after a half-year build no window is left at all.
    const w = createWorld('VIS-6', 3);
    const th = generateThreat(roundRng('VIS-6', 3), w, 3, 0, { flavor: 'INTERSTELLAR', skipDiscovery: true, scifi: true });
    const home = planetById(w, 'HOME').elements;
    const ctx = { lead: th.tImpact - w.t, minFlight: KNOBS.PORKCHOP_MIN_FLIGHT, tier: launcherTier(3), c3Bonus: 0 };
    const built = computePorkchop({ home, threat: th.elements, muSun: w.star.mu, tMin: w.t + KNOBS.BUILD_TIME_KINETIC, tImpact: th.tImpact, tier: launcherTier(3) });
    const why1 = explainNoPlan(built, { ...ctx, buildTime: KNOBS.BUILD_TIME_KINETIC, standby: false });
    expect(why1?.kind).toBe('TIME');
    expect(why1?.lines.join(' ')).toContain('INTERCEPTOR ON STANDBY');
    const ready = computePorkchop({ home, threat: th.elements, muSun: w.star.mu, tMin: w.t, tImpact: th.tImpact, tier: launcherTier(3) });
    const why2 = explainNoPlan(ready, { ...ctx, buildTime: 0, standby: true });
    expect(why2?.kind).toBe('ENERGY');
    expect(why2?.lines[0]).toMatch(/BEST WINDOW NEEDS C3 \d+ KM2\/S2; L3 SUPERHEAVY REACHES 130\./);
    expect(why2?.lines[0]).toContain('OUT OF THE PLANE');
    expect(why2?.lines.join(' ')).not.toContain('INTERCEPTOR ON STANDBY');
    expect(why2?.lines.join(' ')).not.toContain('DE-STAR');
    expect(explainNoPlan(ready, { ...ctx, buildTime: 0, standby: true, scifi: true })?.lines.join(' ')).toContain('DE-STAR ACTS BY RANGE, NOT PLANE');
  });

  it('a feasible grid needs no explanation', () => {
    const w = createWorld('EXPLAIN-OK', 1);
    const th = generateThreat(roundRng('EXPLAIN-OK', 1), w, 1, 0, { skipDiscovery: true });
    const g = computePorkchop({ home: planetById(w, 'HOME').elements, threat: th.elements, muSun: w.star.mu, tMin: w.t + KNOBS.BUILD_TIME_KINETIC, tImpact: th.tImpact, tier: launcherTier(3) });
    expect(g.feasible).toBeGreaterThan(0);
    expect(explainNoPlan(g, { lead: th.tImpact, buildTime: 0.5 * YEAR, minFlight: KNOBS.PORKCHOP_MIN_FLIGHT, tier: launcherTier(3), c3Bonus: 0, standby: false })).toBeNull();
  });
});
