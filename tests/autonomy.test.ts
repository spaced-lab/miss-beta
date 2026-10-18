import { describe, expect, it } from 'vitest';
import { KNOBS } from '../src/config/knobs';
import { DAY, YEAR } from '../src/physics/constants';
import { launcherTier } from '../src/physics/estimates';
import { computePorkchop } from '../src/planner/porkchop';
import { conditionHolds, matchingRules, PRESET_NAMES, RULE_PRESETS, validateRules } from '../src/planner/rules';
import type { Mission } from '../src/sim/mission';
import { resolveRound } from '../src/sim/resolver';
import { roundRng } from '../src/sim/rng';
import { generateThreat } from '../src/sim/roundGen';
import { createWorld, planetById, type World } from '../src/sim/world';

describe('rules DSL (GAME_PLAN 8)', () => {
  it('validates the presets and rejects bad rules without eval', () => {
    expect(PRESET_NAMES).toContain('DEFAULT');
    expect(RULE_PRESETS['DEFAULT']?.length).toBe(2);
    expect(() => validateRules('x')).toThrow(/list/);
    expect(() => validateRules([{ when: 'LUNCH', do: 'RETARGET' }])).toThrow(/when/);
    expect(() => validateRules([{ when: 'FRAGMENTATION', do: 'EXPLODE' }])).toThrow(/do/);
    expect(() => validateRules([{ when: 'FRAGMENTATION', do: 'RETARGET', if: { 'process.env': { '>': 1 } } }])).toThrow(/unknown fact/);
    expect(() => validateRules([{ when: 'FRAGMENTATION', do: 'RETARGET', if: { 'fragments.count': { '~': 1 } } }])).toThrow(/operator/);
    expect(() => validateRules([{ when: 'FRAGMENTATION', do: 'RETARGET', if: { 'fragments.count': { '>': 'many' } } }])).toThrow(/number/);
    expect(() => validateRules([{ when: 'BETA_ASSESSED', do: 'DEPLOY_SUBIMPACTORS', count: 99 }])).toThrow(/count/);
    expect(() => validateRules([{ when: 'FRAGMENTATION', do: 'RETARGET', target: 'eval(x)' }])).toThrow(/target/);
  });
  it('evaluates conditions and matches rules', () => {
    const rules = validateRules([{ when: 'FRAGMENTATION', if: { 'fragments.count': { '>': 1, '<=': 40 } }, do: 'RETARGET' }, { when: 'BETA_ASSESSED', if: { 'predicted.miss_radii': { '<': 1.5 } }, do: 'DEPLOY_SUBIMPACTORS', count: 3 }]);
    expect(conditionHolds(rules[0]!, { 'fragments.count': 5 })).toBe(true);
    expect(conditionHolds(rules[0]!, { 'fragments.count': 1 })).toBe(false);
    expect(conditionHolds(rules[0]!, {})).toBe(false);
    expect(matchingRules(rules, 'BETA_ASSESSED', { 'predicted.miss_radii': 0.5 }).map((r) => r.do)).toEqual(['DEPLOY_SUBIMPACTORS']);
    expect(matchingRules(rules, 'BETA_ASSESSED', { 'predicted.miss_radii': 2 })).toEqual([]);
  });
});

/** A 120 m rubble pile (easy to disrupt) ten years out. */
function rubbleWorld(seed: string): World {
  const w = createWorld(seed, 1);
  const th = generateThreat(roundRng(seed, 1), w, 1, 0, { skipDiscovery: true });
  const type = { ...th.type, id: 'RUBBLE' as const, label: 'RUBBLE PILE', density: 1300, strengthMult: 0.5, kind: 'asteroid' as const };
  w.threat = { ...th, type, D: 120, mass: (4 / 3) * Math.PI * 60 ** 3 * 1300 };
  return w;
}

function cellMission(w: World, tA: number, kg: number, id: string, tier = 3): Mission {
  const home = planetById(w, 'HOME');
  const th = w.threat!;
  const g = computePorkchop({ home: home.elements, threat: th.elements, muSun: w.star.mu, tMin: KNOBS.BUILD_TIME_KINETIC, tImpact: th.tImpact, tier: launcherTier(tier) });
  let best = -1;
  let bestErr = Infinity;
  for (let iL = 0; iL < g.nL; iL++) for (let iA = 0; iA < g.nA; iA++) {
    const i = iL * g.nA + iA;
    if (!((g.payload[i] as number) >= kg)) continue;
    const err = Math.abs(g.tA0 + iA * g.step - tA);
    if (err < bestErr) {
      bestErr = err;
      best = i;
    }
  }
  if (best < 0) throw new Error('no cell');
  const iL = Math.floor(best / g.nA);
  const iA = best % g.nA;
  return {
    id, archetype: 'KINETIC', launcherTier: tier, impactorTier: 3, launchTime: g.tL0 + iL * g.step, arrivalTime: g.tA0 + iA * g.step, impactorKg: kg, c3: g.c3[best] as number,
    departureV: { x: g.v1x[best] as number, y: g.v1y[best] as number }, arrivalV: { x: g.v2x[best] as number, y: g.v2y[best] as number }, interceptR: { x: g.rx[best] as number, y: g.ry[best] as number },
    U: g.U[best] as number, cost: 20, committedAt: 0,
  };
}

/** A mission that is in flight at tEvent: launched at least 30 d before, arriving at least 60 d after. */
function inFlightAt(w: World, tEvent: number, kg: number, id: string): Mission | null {
  const home = planetById(w, 'HOME');
  const th = w.threat!;
  const g = computePorkchop({ home: home.elements, threat: th.elements, muSun: w.star.mu, tMin: KNOBS.BUILD_TIME_KINETIC, tImpact: th.tImpact, tier: launcherTier(3) });
  let best = -1;
  let bestPay = 0;
  for (let iL = 0; iL < g.nL; iL++) for (let iA = 0; iA < g.nA; iA++) {
    const i = iL * g.nA + iA;
    const tL = g.tL0 + iL * g.step;
    const tA = g.tA0 + iA * g.step;
    const pay = g.payload[i] as number;
    if (!(pay >= kg) || tL > tEvent - 30 * DAY || tA < tEvent + 60 * DAY) continue;
    if (pay > bestPay) {
      bestPay = pay;
      best = i;
    }
  }
  if (best < 0) return null;
  const iL = Math.floor(best / g.nA);
  const iA = best % g.nA;
  return {
    id, archetype: 'KINETIC', launcherTier: 3, impactorTier: 3, launchTime: g.tL0 + iL * g.step, arrivalTime: g.tA0 + iA * g.step, impactorKg: kg, c3: g.c3[best] as number,
    departureV: { x: g.v1x[best] as number, y: g.v1y[best] as number }, arrivalV: { x: g.v2x[best] as number, y: g.v2y[best] as number }, interceptR: { x: g.rx[best] as number, y: g.ry[best] as number },
    U: g.U[best] as number, cost: 20, committedAt: 0,
  };
}

describe('autonomy in the resolver', () => {
  it('tier 0: a follower aimed at a shattered threat misses; tier 2: it re-aims at a fragment with its dv', () => {
    let found = false;
    for (let i = 0; i < 6 && !found; i++) {
      const w = rubbleWorld(`AUTO-${i}`);
      const th = w.threat!;
      const hammer = cellMission(w, th.tImpact - 3 * YEAR, 20000, 'HAMMER');
      const follower = inFlightAt(w, hammer.arrivalTime, 1500, 'FOLLOWER');
      if (!follower) continue; // need the follower in flight at the breakup
      const r0 = resolveRound(w, [hammer, { ...follower, autonomyTier: 0 }]);
      if (!r0.producedFragments) continue;
      expect(r0.events.some((e) => e.kind === 'IMPACT_MISS' && e.missionId === 'FOLLOWER')).toBe(true);
      const r2 = resolveRound(w, [hammer, { ...follower, autonomyTier: 2, dvBudget: 5000 }]);
      const rt = r2.events.find((e) => e.kind === 'RETARGET' && e.missionId === 'FOLLOWER');
      if (!rt) continue;
      expect(rt.kind === 'RETARGET' && rt.dv <= 5000).toBe(true);
      expect(r2.events.some((e) => e.kind === 'IMPACT' && e.missionId === 'FOLLOWER' && e.targetId !== 'THREAT')).toBe(true);
      const flown = r2.missionsResolved.find((m) => m.id === 'FOLLOWER');
      expect(flown?.legs?.some((l) => l.kind === 'DSM')).toBe(true);
      found = true;
    }
    expect(found).toBe(true);
  }, 60000);

  it('a split carrier deploys sub-impactors at a breakup (tier 2) and by the rules (tier 1)', () => {
    let found = false;
    for (let i = 0; i < 6 && !found; i++) {
      const w = rubbleWorld(`SPLIT-${i}`);
      const th = w.threat!;
      const hammer = cellMission(w, th.tImpact - 3 * YEAR, 20000, 'HAMMER');
      const base = inFlightAt(w, hammer.arrivalTime, 3000, 'CARRIER');
      if (!base) continue;
      const carrier = { ...base, autonomyTier: 2, dvBudget: 0, split: { count: 3, dvEach: 600, deployed: false } };
      const r = resolveRound(w, [hammer, carrier]);
      if (!r.producedFragments) continue;
      const split = r.events.find((e) => e.kind === 'SPLIT');
      expect(split && split.kind === 'SPLIT' && split.count === 3).toBe(true);
      const subs = r.missionsResolved.filter((m) => m.parentId === 'CARRIER');
      expect(subs.length).toBe(3);
      expect(subs.reduce((a, m) => a + m.impactorKg, 0)).toBeCloseTo(3000, 6);
      // Tier 1 with the AGGRESSIVE preset deploys at FRAGMENTATION too; CONSERVATIVE holds unless > 3 fragments.
      const r1 = resolveRound(w, [hammer, { ...carrier, autonomyTier: 1, rules: RULE_PRESETS['AGGRESSIVE'] ?? [], split: { count: 3, dvEach: 600, deployed: false } }]);
      expect(r1.events.some((e) => e.kind === 'SPLIT')).toBe(true);
      found = true;
    }
    expect(found).toBe(true);
  }, 60000);

  it('beta assessment events appear after the tracking delay and the log stays deterministic', () => {
    const w = rubbleWorld('ASSESS');
    const th = w.threat!;
    const m = cellMission(w, th.tImpact - 3 * YEAR, 1500, 'IMP', 1);
    const r = resolveRound(w, [{ ...m, autonomyTier: 1 }], { trackingTier: 1 });
    const imp = r.events.find((e) => e.kind === 'IMPACT');
    const ass = r.events.find((e) => e.kind === 'BETA_ASSESSED');
    expect(imp && ass && ass.kind === 'BETA_ASSESSED' && ass.t - imp.t === 20 * DAY).toBe(true);
    expect(JSON.stringify(resolveRound(w, [{ ...m, autonomyTier: 1 }], { trackingTier: 1 }).events)).toBe(JSON.stringify(r.events));
  });
});
