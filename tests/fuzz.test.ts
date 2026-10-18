import { describe, expect, it } from 'vitest';
import { KNOBS } from '../src/config/knobs';
import { kineticDv, } from '../src/physics/kinetic';
import { missFromImpulse } from '../src/physics/estimates';
import { nuclearBurst } from '../src/physics/nuclear';
import { launcherTier } from '../src/physics/estimates';
import { R_HOME, YEAR } from '../src/physics/constants';
import { propagate } from '../src/physics/kepler';
import { rankCandidates, rankNukes, rankPI, rankSlowPush, type CandidateContext } from '../src/planner/candidates';
import { computePorkchop } from '../src/planner/porkchop';
import { monteCarlo } from '../src/planner/monteCarlo';
import { RULE_PRESETS } from '../src/planner/rules';
import type { Mission } from '../src/sim/mission';
import { elementsAt, resolveRound } from '../src/sim/resolver';
import { Rng, roundRng } from '../src/sim/rng';
import { generateThreat } from '../src/sim/roundGen';
import { createWorld, planetById, type World } from '../src/sim/world';

function isFiniteDeep(v: unknown, path = ''): string | null {
  if (typeof v === 'number') return Number.isFinite(v) ? null : `${path} = ${v}`;
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      const r = isFiniteDeep(v[i], `${path}[${i}]`);
      if (r) return r;
    }
    return null;
  }
  if (v instanceof Float64Array) {
    for (let i = 0; i < v.length; i++) if (!Number.isFinite(v[i] as number)) return `${path}[${i}]`;
    return null;
  }
  if (typeof v === 'object' && v !== null) {
    for (const [k, x] of Object.entries(v)) {
      if (k === 'rng') continue;
      const r = isFiniteDeep(x, `${path}.${k}`);
      if (r) return r;
    }
  }
  return null;
}

function ctxFor(w: World, extra: Partial<CandidateContext> = {}): CandidateContext {
  const th = w.threat!;
  const home = planetById(w, 'HOME');
  return {
    targetId: 'THREAT', targetMass: th.mass, targetD: th.D, threatType: th.type.id, threatDensity: th.type.density, threatStrength: th.type.strengthMult,
    threatMaterial: th.type.kind === 'comet' ? 'ice' : 'basalt', threatEnergyMt: 100, tImpact: th.tImpact, rHome: home.radius, launcherTier: 3, impactorTier: 3, budget: 1000, committedAt: 0,
    targetVelocity: (t) => propagate(th.elements, w.star.mu, t).v,
    resolve: (ms) => {
      const r = resolveRound(w, ms, { betaOverride: 3 });
      return { outcome: r.outcome, marginRadii: r.ca.marginRadii, hitEnergyMt: r.hitEnergyMt, producedFragments: r.producedFragments };
    },
    swarmTier: 3, autonomyTier: 3, dvBudget: 5000, ...extra,
  };
}

describe('FUZZ: every archetype resolves without NaN across random rounds', () => {
  it('runs 40 random rounds with random mission mixes from every candidate family', () => {
    const rng = new Rng(777);
    let resolves = 0;
    for (let i = 0; i < 40; i++) {
      const k = 1 + (i % 8);
      const w = createWorld(`FUZZ-${i}`, k);
      w.threat = generateThreat(roundRng(`FUZZ-${i}`, k), w, k, 0, { skipDiscovery: true });
      const th = w.threat;
      const home = planetById(w, 'HOME');
      const g = computePorkchop({ home: home.elements, threat: th.elements, muSun: w.star.mu, tMin: KNOBS.BUILD_TIME_KINETIC, tImpact: th.tImpact, tier: launcherTier(3) });
      const ctx = ctxFor(w);
      const pool: Mission[][] = [
        ...rankCandidates(g, ctx).map((c) => c.missions),
        ...rankNukes(g, ctx, 3).map((c) => c.missions),
        ...rankSlowPush(g, ctx, 3, 2, 15000, th.type.id === 'IRON').map((c) => c.missions),
        ...rankPI(g, { ...ctx, targetD: Math.min(th.D, 90) }, true).map((c) => c.missions),
      ];
      if (pool.length === 0) continue;
      // A random subset of plans, each with random autonomy and rules.
      const chosen: Mission[] = [];
      for (const ms of pool) if (rng.chance(0.4)) for (const m of ms) chosen.push({ ...m, id: `${m.id}-${chosen.length}`, autonomyTier: rng.int(0, 3), rules: RULE_PRESETS[rng.pick(['DEFAULT', 'AGGRESSIVE', 'CONSERVATIVE'])] ?? [] });
      for (const tier of [0, 2]) {
        const r = resolveRound(w, chosen, { trackingTier: tier, sampleSeed: rng.int(0, 5) });
        resolves++;
        expect(['HIT', 'MISS', 'PARTIAL']).toContain(r.outcome);
        const bad = isFiniteDeep({ ca: r.ca, energy: r.energy, hit: r.hitEnergyMt, outcomes: r.outcomes.map((o) => o.ca), events: r.events, bodies: r.bodies.map((b) => b.segments.map((s) => s.elements)) }, 'result');
        expect(bad).toBeNull();
        for (const b of r.bodies) expect(Number.isFinite(elementsAt(b.segments, Infinity).a)).toBe(true);
      }
      if (i % 10 === 0) {
        const mc = monteCarlo(w, chosen, 6);
        expect(mc.pMiss + mc.pPartial + mc.pHit).toBeCloseTo(1, 9);
      }
    }
    expect(resolves).toBeGreaterThan(40);
  }, 180000);
});

describe('BALANCE (GAME_PLAN 17 worked numbers)', () => {
  it('Round 1: 100 m stony, one 1500 kg impactor at 10 km/s, beta 3 -> dv ≈ 0.032 m/s, 8 yr left -> ≈ 3.8 R', () => {
    const M = (4 / 3) * Math.PI * 50 ** 3 * 2700;
    const dv = kineticDv(1500, M, 10e3, 3);
    expect(dv).toBeCloseTo(0.032, 3);
    expect(missFromImpulse(dv, 8 * YEAR) / R_HOME).toBeCloseTo(3.8, 0);
  });
  it('Round 3: 300 m stony, one 2 t impactor at 12 km/s, beta 3 -> 1.9 mm/s, 6 yr left -> 0.17 R: NOT ENOUGH; 20 t at 30 km/s -> 4.2 R', () => {
    const M = (4 / 3) * Math.PI * 150 ** 3 * 2700;
    const dv = kineticDv(2000, M, 12e3, 3);
    expect(dv * 1000).toBeCloseTo(1.9, 1);
    expect(missFromImpulse(dv, 6 * YEAR) / R_HOME).toBeCloseTo(0.17, 1);
    const big = kineticDv(20000, M, 30e3, 3);
    expect(missFromImpulse(big, 6 * YEAR) / R_HOME).toBeCloseTo(4.2, 0);
  });
  it('Round 6: 800 m iron, a 1 Mt standoff gives a few cm/s -> about 1 R with 3 yr left: marginal', () => {
    const M = (4 / 3) * Math.PI * 400 ** 3 * 5300;
    const nb = nuclearBurst(1, 'STANDOFF', M, 400, 200);
    expect(nb.dv).toBeGreaterThan(0.01);
    expect(nb.dv).toBeLessThan(0.06);
    const miss = missFromImpulse(nb.dv, 3 * YEAR) / R_HOME;
    expect(miss).toBeGreaterThan(0.3);
    expect(miss).toBeLessThan(3);
  });
});
