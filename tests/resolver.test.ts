import { describe, expect, it } from 'vitest';
import { KNOBS } from '../src/config/knobs';
import { DAY, MU_SUN, R_HOME, YEAR } from '../src/physics/constants';
import { launcherTier } from '../src/physics/estimates';
import { qStar, specificEnergy } from '../src/physics/fragment';
import { propagate } from '../src/physics/kepler';
import { monteCarlo } from '../src/planner/monteCarlo';
import { computePorkchop } from '../src/planner/porkchop';
import type { Mission } from '../src/sim/mission';
import { bodyAlive, resolveRound } from '../src/sim/resolver';
import { roundRng } from '../src/sim/rng';
import { generateThreat } from '../src/sim/roundGen';
import { createWorld, planetById, type World } from '../src/sim/world';

/** A world whose threat is a 120 m rubble pile (easy to disrupt) ten years out. */
function rubbleWorld(seed: string): World {
  const w = createWorld(seed, 1);
  const th = generateThreat(roundRng(seed, 1), w, 1, 0, { skipDiscovery: true });
  const type = { ...th.type, id: 'RUBBLE' as const, label: 'RUBBLE PILE', density: 1300, strengthMult: 0.5, kind: 'asteroid' as const };
  const D = 120;
  w.threat = { ...th, type, D, mass: (4 / 3) * Math.PI * 60 ** 3 * 1300 };
  return w;
}

/** A heavy, fast impactor mission arriving at `tA` built from the porkchop grid (closest feasible cell). */
function hammer(w: World, tA: number, kg: number): Mission {
  const home = planetById(w, 'HOME');
  const th = w.threat!;
  const g = computePorkchop({ home: home.elements, threat: th.elements, muSun: w.star.mu, tMin: KNOBS.BUILD_TIME_KINETIC, tImpact: th.tImpact, tier: launcherTier(3) });
  let best = -1;
  let bestErr = Infinity;
  for (let iL = 0; iL < g.nL; iL++) {
    for (let iA = 0; iA < g.nA; iA++) {
      const i = iL * g.nA + iA;
      if (!((g.payload[i] as number) > 0)) continue;
      const err = Math.abs(g.tA0 + iA * g.step - tA);
      if (err < bestErr) {
        bestErr = err;
        best = i;
      }
    }
  }
  if (best < 0) throw new Error('no cell');
  const iL = Math.floor(best / g.nA);
  const iA = best % g.nA;
  return {
    id: 'HAMMER', archetype: 'KINETIC', launcherTier: 3, impactorTier: 3, launchTime: g.tL0 + iL * g.step, arrivalTime: g.tA0 + iA * g.step, impactorKg: kg, c3: g.c3[best] as number,
    departureV: { x: g.v1x[best] as number, y: g.v1y[best] as number }, arrivalV: { x: g.v2x[best] as number, y: g.v2y[best] as number }, interceptR: { x: g.rx[best] as number, y: g.ry[best] as number },
    U: g.U[best] as number, cost: 20, committedAt: 0,
  };
}

describe('resolver v2: fragmentation', () => {
  it('a hard enough hit disrupts: fragments are born, the threat dies, masses sum to the parent', () => {
    const w = rubbleWorld('FRAG-1');
    const th = w.threat!;
    const m = hammer(w, th.tImpact - 3 * YEAR, 20000);
    const Q = specificEnergy(m.impactorKg, th.mass, m.U);
    const Qs = qStar(th.D / 2, th.type.density, th.type.strengthMult);
    expect(Q).toBeGreaterThan(Qs);
    const res = resolveRound(w, [m]);
    expect(res.producedFragments).toBe(true);
    expect(res.events.some((e) => e.kind === 'FRAGMENTATION')).toBe(true);
    const threatBody = res.bodies[0]!;
    expect(threatBody.tDeath).toBe(m.arrivalTime);
    expect(bodyAlive(threatBody, m.arrivalTime + 1)).toBe(false);
    const total = res.bodies.slice(1).reduce((a, b) => a + b.mass, 0);
    expect(Math.abs(total - th.mass) / th.mass).toBeLessThan(1e-9);
    expect(res.bodies.some((b) => b.role === 'REMNANT')).toBe(true);
    expect(res.outcomes.length).toBeGreaterThan(1);
    expect(['MISS', 'PARTIAL', 'HIT']).toContain(res.outcome);
  });

  it('A/B: disrupting late produces more hits than disrupting early (seeded, 12 seeds)', () => {
    let earlyHits = 0;
    let lateHits = 0;
    for (let i = 0; i < 12; i++) {
      const w = rubbleWorld(`AB-${i}`);
      const th = w.threat!;
      const early = resolveRound(w, [hammer(w, th.tImpact - 4 * YEAR, 20000)]);
      const late = resolveRound(w, [hammer(w, th.tImpact - 70 * DAY, 20000)]);
      if (!early.producedFragments || !late.producedFragments) continue;
      earlyHits += early.outcomes.filter((o) => o.hits).length;
      lateHits += late.outcomes.filter((o) => o.hits).length;
    }
    // Early: the cloud spreads ~3 v_ej T along track (tens of planet radii), so most pieces miss.
    // Late: the spread is under a planet radius, so nearly every piece hits. Expect at least a 3x ratio.
    expect(lateHits).toBeGreaterThan(3 * earlyHits);
  });

  it('is deterministic per sample seed and differs between samples', () => {
    const w = rubbleWorld('MC-1');
    const th = w.threat!;
    const m = hammer(w, th.tImpact - 2 * YEAR, 20000);
    const a = JSON.stringify(resolveRound(w, [m], { sampleSeed: 3 }).events);
    const b = JSON.stringify(resolveRound(w, [m], { sampleSeed: 3 }).events);
    const c = JSON.stringify(resolveRound(w, [m], { sampleSeed: 4 }).events);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('a mission targeting a fragment that does not exist misses cleanly', () => {
    const w = rubbleWorld('TGT');
    const th = w.threat!;
    const m = { ...hammer(w, th.tImpact - 2 * YEAR, 1500), targetId: 'F99' };
    const res = resolveRound(w, [m]);
    expect(res.events.some((e) => e.kind === 'IMPACT_MISS')).toBe(true);
    expect(res.outcome).toBe('HIT');
  });

  it('Monte Carlo returns probabilities that sum to one and a margin spread', () => {
    const w = rubbleWorld('MC-2');
    const th = w.threat!;
    const m = hammer(w, th.tImpact - 2 * YEAR, 1500);
    const mc = monteCarlo(w, [m], 20);
    expect(mc.n).toBe(20);
    expect(mc.pMiss + mc.pPartial + mc.pHit).toBeCloseTo(1, 12);
    expect(mc.marginSigma).toBeGreaterThanOrEqual(0);
    const none = monteCarlo(w, [], 5);
    expect(none.pHit).toBe(1);
    expect(none.marginSigma).toBe(0);
  });

  it('a cratering hit still reports Q/Q* and leaves one body', () => {
    const w = createWorld('CR', 1);
    w.threat = generateThreat(roundRng('CR', 1), w, 1, 0, { skipDiscovery: true });
    const th = w.threat;
    const stony = { ...th.type, id: 'IRON' as const, strengthMult: 5, density: 5300 };
    w.threat = { ...th, type: stony, D: 300, mass: (4 / 3) * Math.PI * 150 ** 3 * 5300 };
    const m = hammer(w, th.tImpact - 2 * YEAR, 1500);
    const res = resolveRound(w, [m]);
    expect(res.producedFragments).toBe(false);
    expect(res.bodies.length).toBe(1);
    const imp = res.events.find((e) => e.kind === 'IMPACT');
    expect(imp && imp.kind === 'IMPACT' && (imp.qRatio ?? 1) < 1).toBe(true);
    expect(propagate(res.segments[1]!.elements, MU_SUN, m.arrivalTime).r.x).toBeCloseTo(m.interceptR.x, -4);
    expect(R_HOME).toBeGreaterThan(0);
  });
});
