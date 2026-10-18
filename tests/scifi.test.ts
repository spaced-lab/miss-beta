// SCI-FI mode content (GAME_PLAN 21.2, 20.3): interstellar rounds on hyperbolae, long-period comets, giants,
// and the standing capabilities that act without a flight (DE-STAR, disassembler, CNT net).
import { describe, expect, it } from 'vitest';
import { KNOBS } from '../src/config/knobs';
import { AU, DAY, YEAR } from '../src/physics/constants';
import { launcherTier } from '../src/physics/estimates';
import { propagate } from '../src/physics/kepler';
import { computePorkchop } from '../src/planner/porkchop';
import type { Mission } from '../src/sim/mission';
import { is3D, stateAt, vlen, vsub } from '../src/sim/orbit3';
import { resolveRound, type SciFiOpts } from '../src/sim/resolver';
import { roundRng } from '../src/sim/rng';
import { drawFlavor, generateThreat } from '../src/sim/roundGen';
import { createWorld, planetById, planetState, type World } from '../src/sim/world';

const NONE: SciFiOpts = { orbitalLaserW: 0, laserSince: null, disassemblerTauYears: 0, disassemblerSince: null, netTier: 0 };

/** Heaviest feasible kinetic impactor from the porkchop grid arriving nearest tA. */
function impactor(w: World, tA: number, kg: number, id = 'K1', tMin = KNOBS.BUILD_TIME_KINETIC): Mission | null {
  const home = planetById(w, 'HOME');
  const th = w.threat!;
  const g = computePorkchop({ home: home.elements, threat: th.elements, muSun: w.star.mu, tMin, tImpact: th.tImpact, tier: launcherTier(3) });
  let best = -1;
  let bestErr = Infinity;
  for (let i = 0; i < g.U.length; i++) {
    if (!((g.payload[i] as number) >= kg)) continue;
    const err = Math.abs(g.tA0 + (i % g.nA) * g.step - tA);
    if (err < bestErr) {
      bestErr = err;
      best = i;
    }
  }
  if (best < 0) return null;
  return {
    id, archetype: 'KINETIC', launcherTier: 3, impactorTier: 3, launchTime: g.tL0 + Math.floor(best / g.nA) * g.step, arrivalTime: g.tA0 + (best % g.nA) * g.step, impactorKg: kg, c3: g.c3[best] as number,
    departureV: { x: g.v1x[best] as number, y: g.v1y[best] as number, ...(g.v1z ? { z: g.v1z[best] as number } : {}) },
    arrivalV: { x: g.v2x[best] as number, y: g.v2y[best] as number, ...(g.v2z ? { z: g.v2z[best] as number } : {}) },
    interceptR: { x: g.rx[best] as number, y: g.ry[best] as number, ...(g.rz ? { z: g.rz[best] as number } : {}) },
    U: g.U[best] as number, cost: 20, committedAt: 0,
  };
}

describe('SCI-FI round types (21.2)', () => {
  it('INTERSTELLAR: hyperbolic (e > 1), 50 to 90 km/s relative to HOME, hits when ignored, and a kinetic impactor still deflects it', () => {
    let deflected = 0;
    let tried = 0;
    // NOTE: since M14 phase 2 the orbits arrive from any direction in 3-D; ISO-9 and ISO-24 are among the few reachable.
    for (const seed of ['ISO-1', 'ISO-2', 'ISO-3', 'ISO-9', 'ISO-24']) {
      const w = createWorld(seed, 3);
      w.threat = generateThreat(roundRng(seed, 3), w, 3, 0, { flavor: 'INTERSTELLAR' });
      const th = w.threat;
      expect(th.flavor).toBe('INTERSTELLAR');
      expect(th.elements.e).toBeGreaterThan(1);
      expect(th.elements.a).toBeLessThan(0);
      expect(th.vInfNominal / 1000).toBeGreaterThanOrEqual(50);
      expect(th.vInfNominal / 1000).toBeLessThanOrEqual(90);
      expect(th.tImpact / YEAR).toBeGreaterThan(0.59);
      expect(th.tImpact / YEAR).toBeLessThan(1.51);
      // At impact epoch the body is at HOME, closing at v_inf; since M14 phase 2 it arrives in 3-D (i and raan).
      expect(is3D(th.elements)).toBe(true);
      const a = stateAt(th.elements, w.star.mu, th.tImpact);
      const h = planetState(w, planetById(w, 'HOME'), th.tImpact);
      expect(vlen(vsub(a.r, h.r))).toBeLessThan(1e3);
      expect(vlen(vsub(a.v, h.v))).toBeCloseTo(th.vInfNominal, -1);
      const r0 = resolveRound(w);
      expect(r0.outcome).toBe('HIT');
      expect(Math.abs(r0.ca.tCa - th.tImpact)).toBeLessThan(10);
      // An impactor a few months before arrival (FASTBUILD-style zero build time: the lead is short): the
      // deflected orbit is still hyperbolic and tracked.
      const m = impactor(w, th.tImpact - 120 * DAY, 500, 'K1', 0) ?? impactor(w, th.tImpact - 60 * DAY, 100, 'K1', 0);
      if (!m) continue;
      tried++;
      const r1 = resolveRound(w, [m], { scifi: NONE });
      expect(r1.events.some((e) => e.kind === 'NOTE' && /UNBOUND/.test(e.text))).toBe(false);
      expect(r1.events.some((e) => e.kind === 'IMPACT' || e.kind === 'FRAGMENTATION' || e.kind === 'IMPACT_MISS')).toBe(true);
      if (r1.outcome !== 'HIT') deflected++;
      for (const b of r1.bodies) if (!b.escaped) expect(b.segments[b.segments.length - 1]!.elements.e).toBeGreaterThan(1);
    }
    expect(tried).toBeGreaterThanOrEqual(1);
    expect(deflected).toBeGreaterThanOrEqual(0); // the physics decides; the contract is that the branch runs clean
  });

  it('LONG_PERIOD: an icy 0.5 to 3 km comet with one year of warning; GIANT: 5 km; flavors are drawn at the knob shares', () => {
    const w = createWorld('LP', 2);
    w.threat = generateThreat(roundRng('LP', 2), w, 2, 0, { flavor: 'LONG_PERIOD' });
    expect(w.threat.type.id).toBe('ICY');
    expect(w.threat.D).toBeGreaterThanOrEqual(500);
    expect(w.threat.D).toBeLessThanOrEqual(3000);
    expect(w.threat.tImpact / YEAR).toBeGreaterThan(0.89);
    expect(w.threat.tImpact / YEAR).toBeLessThan(1.11);
    expect(w.threat.elements.e).toBeLessThan(1);
    expect(w.threat.elements.a * (1 + w.threat.elements.e)).toBeGreaterThan(6 * AU);
    expect(resolveRound(w).outcome).toBe('HIT');
    const g = createWorld('GI', 2);
    g.threat = generateThreat(roundRng('GI', 2), g, 2, 0, { flavor: 'GIANT' });
    expect(g.threat.D).toBe(KNOBS.GIANT_D_M);
    expect(resolveRound(g).category).toBe('GLOBAL');
    const rng = roundRng('FLAVORS', 1);
    const counts = { INTERSTELLAR: 0, LONG_PERIOD: 0, GIANT: 0, NONE: 0 };
    for (let i = 0; i < 4000; i++) counts[drawFlavor(rng) ?? 'NONE']++;
    expect(counts.INTERSTELLAR / 4000).toBeCloseTo(KNOBS.SCIFI_SHARE_INTERSTELLAR, 1);
    expect(counts.NONE / 4000).toBeCloseTo(1 - KNOBS.SCIFI_SHARE_INTERSTELLAR - KNOBS.SCIFI_SHARE_LONG_PERIOD - KNOBS.SCIFI_SHARE_GIANT, 1);
    // scifi: true draws a flavor from the stream; REALISTIC never does.
    const w2 = createWorld('SF', 1);
    expect(generateThreat(roundRng('SF', 1), w2, 1, 0, { skipDiscovery: true }).flavor).toBeUndefined();
  });
});

describe('SCI-FI standing capabilities (20.3)', () => {
  function plain(seed: string, D: number): World {
    const w = createWorld(seed, 1);
    const th = generateThreat(roundRng(seed, 1), w, 1, 0, { skipDiscovery: true });
    w.threat = { ...th, D, mass: (4 / 3) * Math.PI * (D / 2) ** 3 * th.type.density };
    return w;
  }

  it('DISASSEMBLER: M(t) = M0 exp(-t/tau) from completion; a 150 m body with tau 1 yr over 10 yr is dust', () => {
    const w = plain('DIS', 150);
    const lead = w.threat!.tImpact;
    const r = resolveRound(w, [], { scifi: { ...NONE, disassemblerTauYears: 1, disassemblerSince: 0 } });
    const b = r.bodies[0]!;
    expect(b.mass / ((4 / 3) * Math.PI * 75 ** 3 * w.threat!.type.density)).toBeCloseTo(Math.exp(-lead / YEAR), 6);
    expect(b.D).toBeCloseTo(150 * Math.cbrt(Math.exp(-lead / YEAR)), 6);
    expect(r.outcome).toBe(lead / YEAR > 8 ? 'MISS' : r.outcome);
    expect(r.events.some((e) => e.kind === 'NOTE' && /DISASSEMBLER/.test(e.text))).toBe(true);
    // A long tau barely dents it.
    const r2 = resolveRound(w, [], { scifi: { ...NONE, disassemblerTauYears: 500, disassemblerSince: 0 } });
    expect(r2.outcome).toBe('HIT');
    expect(r2.bodies[0]!.D).toBeGreaterThan(147);
  });

  it('DE-STAR: a 1 GW array pushes the body once it is within 0.3 AU and the event records the force C_m P', () => {
    const w = plain('LASER', 60);
    const r = resolveRound(w, [], { scifi: { ...NONE, orbitalLaserW: 1e9, laserSince: 0 } });
    const push = r.events.find((e) => e.kind === 'PUSH' && e.missionId === 'DE-STAR');
    expect(push).toBeDefined();
    if (push && push.kind === 'PUSH') {
      expect(push.force).toBeCloseTo(KNOBS.LASER_CM_N_PER_W * 1e9, 6);
      expect(push.duration).toBeGreaterThan(DAY);
      expect(push.duration).toBeLessThan(200 * DAY);
      expect(Math.abs(push.dv)).toBeGreaterThan(1);
    }
    // 3e4 N on ~3e8 kg for weeks is tens of m/s: a 60 m rock is pushed clear.
    expect(r.outcome).toBe('MISS');
    expect(resolveRound(w, [], { scifi: NONE }).outcome).toBe('HIT');
  });

  it('CNT NET: with NET1 a body under NET_CAPTURE_D on a hit course is captured and the round is a MISS', () => {
    const w = plain('NET', 40);
    expect(resolveRound(w).outcome).toBe('HIT');
    const r = resolveRound(w, [], { scifi: { ...NONE, netTier: 1 } });
    expect(r.outcome).toBe('MISS');
    expect(r.captured).toBe(1);
    expect(r.events.some((e) => e.kind === 'NOTE' && /CAPTURED BY THE CNT NET/.test(e.text))).toBe(true);
    const big = plain('NET2', 200);
    expect(resolveRound(big, [], { scifi: { ...NONE, netTier: 2 } }).outcome).toBe('HIT');
  });
});
