// WHAT: The M8 performance pass: per-frame simulation cost of a busy round (40 fragments, 12 spacecraft).
// WHY:  GAME_PLAN 13 asks for 60 fps with 40 fragments and 12 spacecraft at 1 yr/s. Rendering is not
//       measurable in node; this times what the frame does in JS: propagate every live body and craft once.
// HOW:  Build a disrupted round (a heavy fast impactor shatters a rubble pile), then time one "frame" of
//       state evaluation at 1200 random times. Printed table; the assertion is a loose ceiling.
// LORE: O13 (integration), C3 (tests)
import { describe, expect, it } from 'vitest';
import { KNOBS } from '../src/config/knobs';
import { launcherTier } from '../src/physics/estimates';
import { propagate } from '../src/physics/kepler';
import { craftPosition } from '../src/planner/legs';
import { computePorkchop } from '../src/planner/porkchop';
import type { Mission } from '../src/sim/mission';
import { bodyAlive, elementsAt, resolveRound } from '../src/sim/resolver';
import { roundRng } from '../src/sim/rng';
import { generateThreat } from '../src/sim/roundGen';
import { createWorld, planetById, planetState } from '../src/sim/world';

describe('frame cost benchmark', () => {
  it('propagating 40 fragments and 12 craft per frame stays far under 16 ms', () => {
    const w = createWorld('BENCH-FRAME', 3);
    const th0 = generateThreat(roundRng('BENCH-FRAME', 3), w, 3, 0, { skipDiscovery: true });
    w.threat = { ...th0, D: 120, mass: (4 / 3) * Math.PI * 60 ** 3 * 1300, type: { ...th0.type, id: 'RUBBLE', density: 1300, strengthMult: 0.5, kind: 'asteroid' } };
    const home = planetById(w, 'HOME');
    const g = computePorkchop({ home: home.elements, threat: w.threat.elements, muSun: w.star.mu, tMin: KNOBS.BUILD_TIME_KINETIC, tImpact: w.threat.tImpact, tier: launcherTier(3) });
    const missions: Mission[] = [];
    let n = 0;
    for (let i = 0; i < g.U.length && n < 12; i += 7) {
      if (!((g.payload[i] as number) >= 2000)) continue;
      missions.push({ id: `K${n++}`, archetype: 'KINETIC', launcherTier: 3, impactorTier: 3, launchTime: g.tL0 + Math.floor(i / g.nA) * g.step, arrivalTime: g.tA0 + (i % g.nA) * g.step, impactorKg: 20000, c3: g.c3[i] as number, departureV: { x: g.v1x[i] as number, y: g.v1y[i] as number }, arrivalV: { x: g.v2x[i] as number, y: g.v2y[i] as number }, interceptR: { x: g.rx[i] as number, y: g.ry[i] as number }, U: g.U[i] as number, cost: 20, committedAt: 0 });
    }
    const r = resolveRound(w, missions);
    const nBodies = r.bodies.length;
    const times: number[] = [];
    for (let i = 0; i < 1200; i++) times.push((i / 1200) * w.threat.tImpact);
    const frame = (t: number): number => {
      let acc = 0;
      for (const p of w.planets) acc += planetState(w, p, t).r.x;
      for (const b of r.bodies) if (bodyAlive(b, t)) acc += propagate(elementsAt(b.segments, t), w.star.mu, t).r.x;
      for (const m of r.missionsResolved) if (t >= m.launchTime && t < m.arrivalTime) acc += craftPosition(m, w.star.mu, t)?.x ?? 0;
      return acc;
    };
    for (let i = 0; i < 100; i++) frame(times[i] as number);
    const t0 = performance.now();
    let sink = 0;
    for (const t of times) sink += frame(t);
    const perFrame = (performance.now() - t0) / times.length;
    console.table([{ bodies: nBodies, craft: r.missionsResolved.length, 'ms per frame (state only)': perFrame.toFixed(3), fragments: r.producedFragments }]);
    expect(Number.isFinite(sink)).toBe(true);
    expect(perFrame).toBeLessThan(4);
  });
});
