// WHAT: Planar replay gate for M14 phase 2: a fixed set of seeds must give the same threats, porkchop grids and
//       resolver results, number for number, as before visitors became three-dimensional.
// WHY:  Phase 2 routes threats that carry an inclination through 3-D code; every other round must not move by a
//       single bit (STATUS.md M14 risks (b)). The fixture was captured on the commit before the change.
// HOW:  digest() builds rounds (discovery, plain, SCI-FI LONG_PERIOD and GIANT, the visitor dial at rates where
//       the round stays ordinary, site targets), resolves them with no missions, a kinetic hammer, a disrupting
//       hit on a rubble pile, a standoff warhead, a slow push and a standing SCI-FI push, and compares exactly
//       (toEqual on numbers from JSON, which round-trips doubles). MISS_CAPTURE=1 rewrites the fixture.
//       Exact only on the runtime that captured the fixture (planarReplay.env.json: platform, arch, Node major):
//       V8's Math rounds a few results differently in the last bit across Node majors and CPUs. Elsewhere (CI is
//       linux x64) numbers must agree to REL_TOL (1e-8); strings, counts and event lists stay exact.
// LORE: C3 (tests and the two-language trick), O7 (elements)

// @ts-expect-error node built-in without @types/node (same pattern as tests/help.test.ts)
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { KNOBS } from '../src/config/knobs';
import { YEAR } from '../src/physics/constants';
import { launcherTier } from '../src/physics/estimates';
import { computePorkchop, type PorkchopGrid } from '../src/planner/porkchop';
import type { Mission } from '../src/sim/mission';
import { resolveRound, type ResolveOpts, type RoundResult } from '../src/sim/resolver';
import { roundRng } from '../src/sim/rng';
import { generateThreat, type GenerateOpts } from '../src/sim/roundGen';
import { createWorld, planetById, type World } from '../src/sim/world';

const FIXTURE = new URL('./fixtures/planarReplay.json', import.meta.url);
const FIXTURE_ENV = new URL('./fixtures/planarReplay.env.json', import.meta.url);
// NOTE: measured 2026-10-18, darwin arm64 fixture vs x64 (linux CI and darwin x64 under Rosetta agree), Node 26:
// 112 of the numbers differ. Element sets drift by ulps (<= 2e-13 after long slow pushes); close-approach outputs
// drift up to 1.9e-10, because golden-section stops on a 1 s bracket and one flipped comparison moves the point
// inside it. 1e-8 leaves a 50x margin and is far below any real physics change; the exact gate stays on the
// capture runtime.
const REL_TOL = 1e-8;

interface NodeProcess { env: Record<string, string | undefined>; platform: string; arch: string; versions: { node: string } }
const proc = (globalThis as { process?: NodeProcess }).process;

function runtimeEnv(): string {
  return JSON.stringify({ platform: proc?.platform ?? '?', arch: proc?.arch ?? '?', node: (proc?.versions.node ?? '?').split('.')[0] });
}

/** First path where a and b differ, or null. Numbers may differ by REL_TOL relative; everything else exactly. */
function nearDiff(a: unknown, b: unknown, path = '$'): string | null {
  if (typeof a === 'number' && typeof b === 'number') {
    return a === b || Math.abs(a - b) <= REL_TOL * Math.max(Math.abs(a), Math.abs(b)) ? null : `${path}: ${a} vs ${b}`;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return `${path}: length ${a.length} vs ${b.length}`;
    for (let i = 0; i < a.length; i++) { const d = nearDiff(a[i], b[i], `${path}[${i}]`); if (d) return d; }
    return null;
  }
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    if (ka.join() !== kb.join()) return `${path}: keys ${ka.join()} vs ${kb.join()}`;
    for (const k of ka) { const d = nearDiff((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`); if (d) return d; }
    return null;
  }
  return a === b ? null : `${path}: ${String(a)} vs ${String(b)}`;
}

function cellMission(g: PorkchopGrid, i: number, id: string, kg: number): Mission {
  const iL = Math.floor(i / g.nA);
  const iA = i % g.nA;
  return {
    id, archetype: 'KINETIC', launcherTier: 3, impactorTier: 3, launchTime: g.tL0 + iL * g.step, arrivalTime: g.tA0 + iA * g.step, impactorKg: kg, c3: g.c3[i] as number,
    departureV: { x: g.v1x[i] as number, y: g.v1y[i] as number }, arrivalV: { x: g.v2x[i] as number, y: g.v2y[i] as number }, interceptR: { x: g.rx[i] as number, y: g.ry[i] as number },
    U: g.U[i] as number, cost: 20, committedAt: 0,
  };
}

function summary(r: RoundResult): unknown {
  return {
    outcome: r.outcome, dMin: r.ca.dMin, tCa: r.ca.tCa, vInf: r.ca.vInf, hit: r.hitEnergyMt, n: r.bodies.length,
    last: r.bodies.map((b) => { const s = b.segments[b.segments.length - 1]; return s ? [s.elements.a, s.elements.e, s.elements.w, s.elements.M0, s.elements.t0] : null; }),
    ev: r.events.map((e) => e.kind),
  };
}

function caseDigest(w: World, opts: ResolveOpts = {}): unknown {
  const th = w.threat;
  if (!th) return null;
  const home = planetById(w, 'HOME');
  const g = computePorkchop({ home: home.elements, threat: th.elements, muSun: w.star.mu, tMin: KNOBS.BUILD_TIME_KINETIC, tImpact: th.tImpact, tier: launcherTier(3) });
  let uSum = 0;
  let best = -1;
  let slow = -1;
  for (let i = 0; i < g.U.length; i++) {
    if (!((g.payload[i] as number) > 0)) continue;
    uSum += g.U[i] as number;
    if (best < 0 || (g.payload[i] as number) * (g.U[i] as number) > (g.payload[best] as number) * (g.U[best] as number)) best = i;
    if (slow < 0 || (g.U[i] as number) < (g.U[slow] as number)) slow = i;
  }
  const out: Record<string, unknown> = {
    threat: { name: th.name, tImpact: th.tImpact, D: th.D, el: [th.elements.a, th.elements.e, th.elements.w, th.elements.M0, th.elements.t0], by: th.discoveredBy, flavor: th.flavor ?? null, target: th.targetId ?? null },
    homeT0: home.elements.t0,
    grid: [g.nL, g.nA, g.feasible, uSum],
    none: summary(resolveRound(w, [], opts)),
  };
  if (best >= 0) {
    out['kinetic'] = summary(resolveRound(w, [cellMission(g, best, 'K', 5000)], opts));
    out['heavy'] = summary(resolveRound(w, [cellMission(g, best, 'H', 5e6)], opts));
  }
  if (slow >= 0) {
    const s = cellMission(g, slow, 'S', 2000);
    out['nuke'] = summary(resolveRound(w, [{ ...s, archetype: 'NUKE_STANDOFF', warhead: { yieldMt: 1, mode: 'STANDOFF', tier: 3, pulses: 2 } }], opts));
    out['push'] = summary(resolveRound(w, [{ ...s, archetype: 'SLOW_PUSH', push: { method: 'ION_BEAM', tier: 2, sign: 1, tauMax: 3 * YEAR } }], opts));
  }
  out['standing'] = summary(resolveRound(w, [], { ...opts, scifi: { orbitalLaserW: 0, laserSince: null, disassemblerTauYears: 0, disassemblerSince: null, netTier: 0, shepherdSince: 0, kitsSince: 0 } }));
  return out;
}

function digest(): unknown[] {
  const out: unknown[] = [];
  const cases: { seed: string; k: number; opts: GenerateOpts; rubble?: boolean }[] = [];
  for (const seed of ['P1', 'P2', 'P3']) for (const k of [1, 4]) cases.push({ seed, k, opts: { runSeed: seed } });
  for (const seed of ['Q1', 'Q2']) cases.push({ seed, k: 2, opts: { skipDiscovery: true } });
  cases.push({ seed: 'Q3', k: 2, opts: { skipDiscovery: true }, rubble: true });
  cases.push({ seed: 'L1', k: 3, opts: { flavor: 'LONG_PERIOD' } }, { seed: 'G1', k: 3, opts: { flavor: 'GIANT' } });
  for (const seed of ['R1', 'R2', 'R3']) cases.push({ seed, k: 2, opts: { interstellarRate: 0.3, runSeed: seed } });
  cases.push({ seed: 'M1', k: 3, opts: { runSeed: 'M1', sites: ['MOON', 'OUTER', 'GIANT_MOON'] } }, { seed: 'M2', k: 5, opts: { runSeed: 'M2', sites: ['MOON', 'OUTER'] } });
  for (const c of cases) {
    const w = createWorld(c.seed, c.k);
    const th = generateThreat(roundRng(c.seed, c.k), w, c.k, 0, c.opts);
    if (th.flavor === 'INTERSTELLAR') {
      out.push({ seed: c.seed, skipped: 'INTERSTELLAR' });
      continue;
    }
    w.threat = c.rubble ? { ...th, type: { ...th.type, id: 'RUBBLE', density: 1300, strengthMult: 0.5, kind: 'asteroid' }, D: 120, mass: (4 / 3) * Math.PI * 60 ** 3 * 1300 } : th;
    out.push({ seed: c.seed, k: c.k, d: caseDigest(w) });
  }
  return JSON.parse(JSON.stringify(out)) as unknown[];
}

describe('planar replay (M14 phase 2 gate)', () => {
  it('fixed seeds give the same threats, grids and resolver results as before 3-D visitors', () => {
    const d = digest();
    if (proc?.env['MISS_CAPTURE'] === '1' || !existsSync(FIXTURE)) {
      writeFileSync(FIXTURE, JSON.stringify(d) + '\n');
      writeFileSync(FIXTURE_ENV, runtimeEnv() + '\n');
      return;
    }
    const want = JSON.parse(readFileSync(FIXTURE, 'utf8')) as unknown;
    const capturedOn = existsSync(FIXTURE_ENV) ? (readFileSync(FIXTURE_ENV, 'utf8') as string).trim() : '';
    if (capturedOn === runtimeEnv()) expect(d).toEqual(want);
    else expect(nearDiff(d, want)).toBeNull();
  }, 120_000);
});
