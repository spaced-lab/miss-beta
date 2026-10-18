// WHAT: M14 phase 2 tests: visitors from other stars fly in three dimensions through the whole round. Generation
//       (an exact hit at the node), resolution (HIT alone, a kinetic plan moves the 3-D miss, fragments and pushes
//       stay 3-D), the planner grid (lambert3 cells reach the 3-D target), detection (the 3-D orbit and the 3-D lite
//       tilt see the same sky), close approach to a moon, and SAVE.md carrying i and raan.
// WHY:  The planar replay gate (tests/planarReplay.test.ts) proves nothing planar moved; these prove the new path
//       is honest physics rather than a planar answer with a z painted on.
// HOW:  Seeded rounds; tolerances only where two different formulas meet.
// LORE: F12 (visitors from other stars), O12 (close approach), D3 (kinetic and beta), O10 (A to B)

import { describe, expect, it } from 'vitest';
import { KNOBS } from '../src/config/knobs';
import { MU_SUN, YEAR } from '../src/physics/constants';
import { launcherTier } from '../src/physics/estimates';
import { propagate, type Elements } from '../src/physics/kepler';
import { liftElements, propagate3, type Elements3 } from '../src/physics/kepler3';
import { missionFromCell, type CandidateContext } from '../src/planner/candidates';
import { computePorkchop, type PorkchopGrid } from '../src/planner/porkchop';
import { parseSave, writeSave, type SaveFile } from '../src/game/saveMd';
import { discover } from '../src/sim/detection';
import type { Mission } from '../src/sim/mission';
import { is3D, pushArc, stateAt, toElements, vlen, vsub } from '../src/sim/orbit3';
import { resolveRound } from '../src/sim/resolver';
import { roundRng, Rng, hashSeed } from '../src/sim/rng';
import { generateThreat } from '../src/sim/roundGen';
import { nodeLine, tiltAboutNode } from '../src/sim/sky';
import { targetCloseApproach, targetOf } from '../src/sim/targets';
import { createWorld, planetById, planetState, type World } from '../src/sim/world';

/** A SCI-FI INTERSTELLAR round (ISO-9 is one of the few reachable from HOME, see tests/scifi.test.ts). */
function visitorWorld(seed = 'ISO-9'): World {
  const w = createWorld(seed, 3);
  w.threat = generateThreat(roundRng(seed, 3), w, 3, 0, { flavor: 'INTERSTELLAR' });
  return w;
}

function grid(w: World, tMin = 0): PorkchopGrid {
  const th = w.threat!;
  return computePorkchop({ home: planetById(w, 'HOME').elements, threat: th.elements, muSun: w.star.mu, tMin, tImpact: th.tImpact, tier: launcherTier(3) });
}

/** The feasible cell with the largest payload x U, as a mission through the planner's own builder. */
function bestMission(w: World, g: PorkchopGrid, kg: number): Mission | null {
  let best = -1;
  for (let i = 0; i < g.payload.length; i++) {
    if (!((g.payload[i] as number) > 0)) continue;
    if (best < 0 || (g.payload[i] as number) * (g.U[i] as number) > (g.payload[best] as number) * (g.U[best] as number)) best = i;
  }
  if (best < 0) return null;
  const ctx = { launcherTier: 3, impactorTier: 4, committedAt: 0, targetId: 'THREAT' } as unknown as CandidateContext;
  const m = missionFromCell(g, Math.floor(best / g.nA), best % g.nA, ctx, 'K3');
  return m ? { ...m, impactorKg: kg } : null;
}

describe('3-D visitors: generation', () => {
  it('REALISTIC and SCI-FI visitors carry i and raan, sit on HOME at impact, and hit when ignored', () => {
    for (const seed of ['V1', 'V2', 'V3', 'V4']) {
      const w = createWorld(seed, 2);
      const th = generateThreat(roundRng(seed, 2), w, 2, 0, { interstellarRate: 1, runSeed: seed });
      w.threat = th;
      expect(is3D(th.elements)).toBe(true);
      const a = stateAt(th.elements, w.star.mu, th.tImpact);
      const h = planetState(w, planetById(w, 'HOME'), th.tImpact);
      expect(vlen(vsub(a.r, h.r))).toBeLessThan(1e3);
      expect(resolveRound(w, []).outcome).toBe('HIT');
    }
    let retro = 0;
    for (let j = 1; j <= 12; j++) {
      const w = visitorWorld(`ISO-${j}`);
      const el = w.threat!.elements as Elements3;
      if (el.i > Math.PI / 2) retro++;
      const r = resolveRound(w, []);
      expect(r.outcome).toBe('HIT');
      expect(Math.abs(r.ca.tCa - w.threat!.tImpact)).toBeLessThan(10);
    }
    // Isotropic arrival: retrograde visitors (i > 90 deg) exist; a planar world could not make them.
    expect(retro).toBeGreaterThan(0);
  });
  it('the same seed builds the same 3-D visitor (a reload regenerates it exactly)', () => {
    const a = visitorWorld('ISO-24').threat!;
    const b = visitorWorld('ISO-24').threat!;
    expect(b.elements).toEqual(a.elements);
  });
});

describe('3-D visitors: resolver', () => {
  it('a kinetic plan from the 3-D grid finds the body (no IMPACT_MISS) and changes its 3-D miss distance', () => {
    const w = visitorWorld();
    const g = grid(w);
    expect(g.rz).toBeDefined();
    const m = bestMission(w, g, 2e4);
    expect(m).not.toBeNull();
    if (!m) return;
    expect(m.interceptR.z).toBeDefined();
    const r0 = resolveRound(w, []);
    const r1 = resolveRound(w, [m], { betaOverride: 3 });
    expect(r1.events.some((e) => e.kind === 'IMPACT' || e.kind === 'FRAGMENTATION')).toBe(true);
    expect(r1.events.some((e) => e.kind === 'IMPACT_MISS')).toBe(false);
    expect(Math.abs(r1.ca.dMin - r0.ca.dMin)).toBeGreaterThan(1);
    for (const b of r1.bodies) for (const s of b.segments) expect(is3D(s.elements)).toBe(true);
  });
  it('the same plan with its z parts dropped (aimed at the planar point) misses the body by its height', () => {
    const w = visitorWorld();
    const m = bestMission(w, grid(w), 2e4);
    if (!m) throw new Error('no cell');
    const flat: Mission = { ...m, departureV: { x: m.departureV.x, y: m.departureV.y }, arrivalV: { x: m.arrivalV.x, y: m.arrivalV.y }, interceptR: { x: m.interceptR.x, y: m.interceptR.y } };
    const r = resolveRound(w, [flat]);
    const miss = r.events.find((e) => e.kind === 'IMPACT_MISS');
    expect(miss).toBeDefined();
    if (Math.abs(m.interceptR.z ?? 0) > KNOBS.TERMINAL_GUIDANCE_RANGE) expect(miss && miss.kind === 'IMPACT_MISS' ? miss.offset : 0).toBeGreaterThan(KNOBS.TERMINAL_GUIDANCE_RANGE);
  });
  it('a disrupting hit leaves 3-D fragments; a standoff burst and a slow push keep the body 3-D', () => {
    const w = visitorWorld();
    const th = w.threat!;
    w.threat = { ...th, D: 120, mass: (4 / 3) * Math.PI * 60 ** 3 * 1300, type: { ...th.type, id: 'RUBBLE', density: 1300, strengthMult: 0.5, kind: 'asteroid' } };
    const m = bestMission(w, grid(w), 5e6);
    if (!m) throw new Error('no cell');
    const r = resolveRound(w, [m]);
    expect(r.producedFragments).toBe(true);
    const frags = r.bodies.filter((b) => b.role !== 'THREAT' && !b.escaped);
    expect(frags.length).toBeGreaterThan(0);
    for (const b of frags) expect(is3D(b.segments[0]!.elements)).toBe(true);
    const nuke = resolveRound(w, [{ ...m, impactorKg: 2000, archetype: 'NUKE_STANDOFF', warhead: { yieldMt: 1, mode: 'STANDOFF', tier: 3, pulses: 1 } }]);
    expect(nuke.events.some((e) => e.kind === 'NUKE')).toBe(true);
    for (const b of nuke.bodies) for (const s of b.segments) expect(is3D(s.elements)).toBe(true);
  });
  it('pushArc pushes a tilted orbit in its own plane: i and raan unchanged, a and e as the planar arc', () => {
    const el: Elements3 = { a: 1.4e11, e: 0.3, w: 0.7, M0: 1.1, t0: 0, i: 0.9, raan: 2.2 };
    const arc = pushArc(el, MU_SUN, 0, YEAR, 1e-6);
    const e3 = arc.elements as Elements3;
    expect(e3.i).toBe(el.i);
    expect(e3.raan).toBe(el.raan);
    expect(e3.a).toBeGreaterThan(el.a);
    // The pushed orbit really is in the old plane: its state is normal to the old plane's pole.
    const s = propagate3(e3, MU_SUN, YEAR);
    const pole = { x: Math.sin(el.i) * Math.sin(el.raan), y: -Math.sin(el.i) * Math.cos(el.raan), z: Math.cos(el.i) };
    expect(Math.abs(s.r.x * pole.x + s.r.y * pole.y + s.r.z * pole.z) / Math.hypot(s.r.x, s.r.y, s.r.z)).toBeLessThan(1e-12);
  });
});

describe('3-D visitors: planner grid and detection', () => {
  it('3-D cells aim at the 3-D target position: v1 flown for the flight time reaches r at arrival', () => {
    const w = visitorWorld();
    const g = grid(w);
    const m = bestMission(w, g, 1000);
    if (!m) throw new Error('no cell');
    const hs = propagate(planetById(w, 'HOME').elements, w.star.mu, m.launchTime);
    // The resolver's transfer: HOME's state plus the cell's departure velocity (3-D because it has a z part).
    const craft = stateAt(toElements(hs.r, m.departureV, w.star.mu, m.launchTime), w.star.mu, m.arrivalTime);
    const tgt = stateAt(w.threat!.elements, w.star.mu, m.arrivalTime);
    expect(vlen(vsub(craft.r, tgt.r)) / vlen(tgt.r)).toBeLessThan(1e-7);
  });
  it('flyby and sail searches return nothing for a 3-D target (planar arcs; STATUS.md M14 remaining)', async () => {
    const { flybySearch } = await import('../src/planner/flybySearch');
    const { sailSearch } = await import('../src/planner/sailSearch');
    const w = visitorWorld();
    const th = w.threat!;
    const home = planetById(w, 'HOME').elements;
    expect(flybySearch({ home, threat: th.elements, planets: [], muSun: w.star.mu, tMin: 0, tImpact: th.tImpact, tier: launcherTier(3), dsmBudget: 500, c3Bonus: 0 }).cells.length).toBe(0);
    expect(sailSearch({ home, threat: th.elements, muSun: w.star.mu, tMin: 0, tImpact: th.tImpact, tier: launcherTier(3), sailTier: 1, dsmBudget: 500, c3Bonus: 0 }).cells.length).toBe(0);
  });
  it('detection: a 3-D lite tilt and the equivalent 3-D elements are the same orbit and see the same sky', () => {
    const w = createWorld('DET3', 2);
    const th = generateThreat(roundRng('DET3', 2), w, 2, 0, { skipDiscovery: true });
    const el: Elements = th.elements;
    const incl = 0.8;
    const node = 1.3;
    // tiltAboutNode about the line at `node` is R3(node) R1(incl) R3(-node): i = incl, raan = node, w' = w - node.
    const el3: Elements3 = { ...el, i: incl, raan: node, w: el.w - node };
    for (const t of [0, 0.3 * th.tImpact, 0.9 * th.tImpact]) {
      const a = tiltAboutNode(propagate(el, MU_SUN, t).r, nodeLine(node), incl);
      const b = propagate3(el3, MU_SUN, t).r;
      expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) / Math.hypot(a.x, a.y, a.z)).toBeLessThan(1e-12);
    }
    const home = planetById(w, 'HOME').elements;
    const inner = planetById(w, 'INNER').elements;
    const base = { home, inner, muSun: w.star.mu, tImpact: th.tImpact, D: 300, albedo: 0.1, activeIds: w.networks.active };
    const d1 = discover({ ...base, threat: el, tilt: { incl, node } }, new Rng(hashSeed('det')));
    const d2 = discover({ ...base, threat: el3 }, new Rng(hashSeed('det')));
    expect(d2.tDisc).toBe(d1.tDisc);
    expect(d2.networkId).toBe(d1.networkId);
  });
  it('close approach of a 3-D orbit to a moon: the lifted planar orbit gives the planar answer', () => {
    const w = createWorld('MOON3', 3);
    const th = generateThreat(roundRng('MOON3', 3), w, 3, 0, { skipDiscovery: true });
    const moon = targetOf(w, 'MOON');
    const a = targetCloseApproach(th.elements, moon, w.star.mu, th.tImpact);
    const b = targetCloseApproach(liftElements(th.elements), moon, w.star.mu, th.tImpact);
    expect(Math.abs(b.tCa - a.tCa)).toBeLessThan(2);
    expect(Math.abs(b.dMin - a.dMin)).toBeLessThan(1e3);
    expect(b.vInf / a.vInf).toBeCloseTo(1, 9);
  });
});

describe('3-D visitors: SAVE.md', () => {
  it('a 3-D threat round-trips its i and raan exactly; an old save without them reads as planar', () => {
    const w = visitorWorld();
    const el = w.threat!.elements as Elements3;
    const s: SaveFile = {
      version: 1, seed: 'ISO-9', started: '2026-10-18', round: 3, mode: 'REALISTIC', highest_mode: 'REALISTIC', civ_level: 0, cheats_used: [], budget: 10, budget_per_year: 5, research: 0, tech: [], programs: [],
      networks_active: ['ATLAS'], run_score: 0, rounds_survived: 2,
      current_threat: { name: w.threat!.name, type: w.threat!.type.id, D_m: Math.round(w.threat!.D), t_impact_years: 1.2, p_impact: 1, i_rad: el.i, raan_rad: el.raan },
      learning_level: 'BEGINNER', lore_read: {}, color_mode: 'SPECTRUM',
    };
    const back = parseSave(writeSave(s));
    expect(back).not.toBeNull();
    expect(back?.current_threat?.i_rad).toBe(el.i);
    expect(back?.current_threat?.raan_rad).toBe(el.raan);
    const { i_rad: _i, raan_rad: _r, ...planar } = s.current_threat!;
    void _i;
    void _r;
    const old = parseSave(writeSave({ ...s, current_threat: planar }));
    expect(old?.current_threat?.i_rad).toBeUndefined();
    const bad = writeSave(s).replace(/i_rad: [0-9.e-]+/, 'i_rad: 9');
    expect(parseSave(bad)).toBeNull();
  });
});
