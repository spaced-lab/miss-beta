import { describe, expect, it } from 'vitest';
import { KNOBS } from '../src/config/knobs';
import { budgetAt, canAfford, createEconomy, spend } from '../src/game/economy';
import { loadBoard, recordRun } from '../src/game/leaderboard';
import { createRun, nextRound } from '../src/game/run';
import { scoreRound } from '../src/game/scoring';
import { AU, DAY, MU_SUN, R_HOME, YEAR } from '../src/physics/constants';
import { launcherTier } from '../src/physics/estimates';
import { propagate } from '../src/physics/kepler';
import { missionFromCell, rankCandidates, type CandidateContext } from '../src/planner/candidates';
import { cellTimes, computePorkchop, type PorkchopGrid } from '../src/planner/porkchop';
import { formatEvent } from '../src/sim/eventLog';
import type { Mission } from '../src/sim/mission';
import { drawBeta, elementsAt, resolveRound } from '../src/sim/resolver';
import { roundRng } from '../src/sim/rng';
import { generateThreat } from '../src/sim/roundGen';
import { createWorld, planetById, type World } from '../src/sim/world';
import { runJob } from '../src/worker/planner.worker';

/** A Round-1 style world with a fixed 100 m stony threat ten years out (GAME_PLAN 17 balance target). */
function balanceWorld(seed = 'BAL-1'): World {
  const w = createWorld(seed, 1);
  const th = generateThreat(roundRng(seed, 1), w, 1, 0, { skipDiscovery: true });
  // Force the balance-target numbers while keeping the generated (colliding) orbit.
  const stony = th.type.id === 'STONY' ? th.type : { ...th.type, id: 'STONY' as const, label: 'STONY (S)', density: 2700 };
  const D = 100;
  const mass = (4 / 3) * Math.PI * 50 ** 3 * 2700;
  w.threat = { ...th, type: stony, D, mass };
  return w;
}

function gridFor(w: World, tier = 1): PorkchopGrid {
  const home = planetById(w, 'HOME');
  const th = w.threat;
  if (!th) throw new Error('no threat');
  return computePorkchop({ home: home.elements, threat: th.elements, muSun: w.star.mu, tMin: w.t + KNOBS.BUILD_TIME_KINETIC, tImpact: th.tImpact, tier: launcherTier(tier) });
}

function ctxFor(w: World, g: PorkchopGrid, budget = 100): CandidateContext {
  const th = w.threat;
  if (!th) throw new Error('no threat');
  void g;
  return {
    targetId: 'THREAT',
    targetMass: th.mass,
    targetD: th.D,
    threatType: th.type.id,
    threatDensity: th.type.density,
    threatStrength: th.type.strengthMult,
    threatMaterial: 'basalt',
    threatEnergyMt: 100,
    tImpact: th.tImpact,
    rHome: R_HOME,
    launcherTier: 1,
    impactorTier: 1,
    budget,
    committedAt: w.t,
    targetVelocity: (t) => propagate(th.elements, w.star.mu, t).v,
    resolve: (ms) => {
      const r = resolveRound(w, ms, { betaOverride: 3 });
      return { outcome: r.outcome, marginRadii: r.ca.marginRadii, hitEnergyMt: r.hitEnergyMt, producedFragments: r.producedFragments };
    },
  };
}

describe('porkchop', () => {
  it('builds a bounded grid with feasible cells and sane numbers', () => {
    const w = balanceWorld();
    const g = gridFor(w);
    expect(g.nL).toBeLessThanOrEqual(KNOBS.PORKCHOP_MAX_AXIS + 1);
    expect(g.nA).toBeLessThanOrEqual(KNOBS.PORKCHOP_MAX_AXIS + 1);
    expect(g.feasible).toBeGreaterThan(50);
    let minC3 = Infinity;
    for (let i = 0; i < g.c3.length; i++) {
      const c = g.c3[i] as number;
      if (Number.isFinite(c)) {
        expect(c).toBeGreaterThanOrEqual(0);
        minC3 = Math.min(minC3, c);
        expect(g.U[i] as number).toBeGreaterThan(0);
      }
    }
    expect(minC3).toBeLessThan(40);
    const { tL, tA } = cellTimes(g, 0, 0);
    expect(tL).toBe(w.t + KNOBS.BUILD_TIME_KINETIC);
    expect(tA - tL).toBe(KNOBS.PORKCHOP_MIN_FLIGHT);
  });

  it('the worker job runs inline and validates its input', () => {
    const w = balanceWorld();
    const home = planetById(w, 'HOME');
    const th = w.threat;
    if (!th) throw new Error('no threat');
    const r = runJob({ id: 7, type: 'porkchop', home: home.elements, threat: th.elements, muSun: w.star.mu, tMin: 0.5 * YEAR, tImpact: th.tImpact, tier: 1 });
    expect(r.type).toBe('porkchop');
    if (r.type === 'porkchop') expect(r.grid.feasible).toBeGreaterThan(0);
    const bad = runJob({ id: 8, type: 'porkchop', home: { a: NaN } as never, threat: th.elements, muSun: 1, tMin: 0, tImpact: 1, tier: 1 });
    expect(bad.type).toBe('error');
  });
});

describe('resolver v1 and the Round-1 balance target', () => {
  it('a 100 m stony threat with ~10 years warning is beaten by one Tier 1 launch', () => {
    // Try a few seeds: the generated geometry varies; at least most should be beatable with one I1 impactor.
    let wins = 0;
    let swarms = 0;
    const seeds = ['BAL-1', 'BAL-2', 'BAL-3', 'BAL-4', 'BAL-5'];
    for (const seed of seeds) {
      const w = balanceWorld(seed);
      const g = gridFor(w);
      const cands = rankCandidates(g, ctxFor(w, g));
      expect(cands.length).toBeGreaterThan(0);
      // The single-impactor plans only (SWARM bundles also rank; the target is a single Tier 1 launch).
      const best = cands.find((c) => c.archetype === 'KINETIC');
      if (!best) continue;
      const mission = best.missions[0]!;
      const res = resolveRound(w, [mission]);
      if (res.outcome === 'MISS') wins++;
      expect(res.events.some((e) => e.kind === 'IMPACT')).toBe(true);
      expect(res.segments.length).toBe(2);
      expect(elementsAt(res.segments, 0)).toBe(w.threat?.elements);
      expect(elementsAt(res.segments, mission.arrivalTime + 1)).not.toBe(w.threat?.elements);
      swarms += cands.filter((c) => c.archetype === 'SWARM').length;
    }
    expect(wins).toBeGreaterThanOrEqual(4);
    // SWARM bundles (2-3 staggered launches) are offered on at least some seeds.
    expect(swarms).toBeGreaterThan(0);
  });

  it('is deterministic (byte-equal logs) and beta is per mission, order independent', () => {
    const w = balanceWorld('DET');
    const g = gridFor(w);
    const cands = rankCandidates(g, ctxFor(w, g));
    const ms = cands.slice(0, 2).flatMap((c) => c.missions);
    const a = JSON.stringify(resolveRound(w, ms).events);
    const b = JSON.stringify(resolveRound(w, ms).events);
    expect(a).toBe(b);
    expect(drawBeta(w, 'IMPACTOR-1', 'STONY')).toBe(drawBeta(w, 'IMPACTOR-1', 'STONY'));
    const [lo, hi] = KNOBS.BETA_RANGE['IRON'] as readonly [number, number];
    for (let i = 0; i < 50; i++) {
      const bb = drawBeta(w, `X${i}`, 'IRON');
      expect(bb).toBeGreaterThanOrEqual(lo);
      expect(bb).toBeLessThan(hi);
    }
  });

  it('a second impactor misses when the first one moved the target beyond terminal guidance range', () => {
    const w = balanceWorld('TG');
    const g = gridFor(w);
    const cands = rankCandidates(g, ctxFor(w, g));
    const first = cands.find((c) => c.archetype === 'KINETIC')?.missions[0];
    if (!first) throw new Error('no candidate');
    // A huge beta on the first impact moves the threat a lot; a second mission to the same cell arriving later misses.
    const later: Mission = { ...first, id: 'IMPACTOR-LATE', arrivalTime: first.arrivalTime + 300 * DAY, interceptR: propagate(w.threat!.elements, w.star.mu, first.arrivalTime + 300 * DAY).r };
    const res = resolveRound(w, [first, later], { betaOverride: 400 });
    expect(res.events.some((e) => e.kind === 'IMPACT_MISS')).toBe(true);
  });

  it('formats play-by-play lines', () => {
    const line = formatEvent({ t: 0, kind: 'LAUNCH', missionId: 'IMPACTOR-1', c3: 12.34, massKg: 1500, tier: 1 }, 4 * YEAR);
    expect(line).toMatch(/^T-04Y 000D  IMPACTOR-1 LAUNCH  L1  C3 12.3  1500 KG$/);
    const ca = formatEvent({ t: 4 * YEAR, kind: 'CLOSE_APPROACH', dMin: 2e7, bCrit: 1e7, marginRadii: 1.57, impact: false }, 4 * YEAR);
    expect(ca).toContain('MISS BY 1.57 R');
  });

  it('missionFromCell returns null for infeasible cells', () => {
    const w = balanceWorld();
    const g = gridFor(w);
    g.payload[0] = 0;
    expect(missionFromCell(g, 0, 0, ctxFor(w, g), 'X')).toBeNull();
  });
});

describe('economy, scoring, run, leaderboard', () => {
  it('budget accrues per year and spending is checked', () => {
    const e = createEconomy(8, 6);
    expect(budgetAt(e, 0)).toBe(8);
    expect(budgetAt(e, YEAR)).toBeCloseTo(14, 9);
    expect(spend(e, 0, 3)).toBe(true);
    expect(spend(e, 0, 6)).toBe(false);
    expect(canAfford(e, YEAR, 11)).toBe(true);
    expect(budgetAt(e, 0)).toBe(5);
  });
  it('scores a clean miss per Section 12 and zero for a hit', () => {
    const s = scoreRound({ round: 1, energyMt: 99, outcome: 'MISS', marginRadii: 3.8, budgetUnspent: 5, budgetAvailable: 10, marginSeconds: 8 * YEAR, leadSeconds: 10 * YEAR, usedWarhead: false, producedFragments: false, netCapture: false });
    expect(s.base).toBeCloseTo(2 * 100 * 1.15, 6);
    expect(s.outcome).toBe(1);
    expect(s.efficiency).toBeCloseTo(0.25, 9);
    expect(s.timing).toBeCloseTo(0.24, 9);
    expect(s.style).toBeCloseTo(0.4, 9);
    expect(s.roundScore).toBe(Math.round(230 * 1.89));
    expect(s.research).toBe(Math.floor(s.roundScore / 50));
    expect(scoreRound({ round: 1, energyMt: 99, outcome: 'HIT', marginRadii: -1, budgetUnspent: 0, budgetAvailable: 1, marginSeconds: 0, leadSeconds: 1, usedWarhead: false, producedFragments: false, netCapture: false }).roundScore).toBe(0);
    expect(scoreRound({ round: 1, energyMt: 99, outcome: 'MISS', marginRadii: 0.5, budgetUnspent: 0, budgetAvailable: 1, marginSeconds: 0, leadSeconds: 1, usedWarhead: false, producedFragments: false, netCapture: false }).outcome).toBe(0.8);
  });
  it('run advances rounds carrying the budget balance', () => {
    const r = createRun('SEED');
    nextRound(r, 11.5);
    expect(r.round).toBe(2);
    expect(r.roundsSurvived).toBe(1);
    expect(budgetAt(r.economy, 0)).toBe(11.5);
  });
  it('leaderboard validates, sorts and trims', () => {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    store.set('missb.leaderboard.REALISTIC', JSON.stringify([{ handle: 'OK', rounds: 2, score: 500, seed: 'A', date: '2026-10-17', tech: 'L1', assisted: false }, { bad: true }]));
    expect(loadBoard().map((e) => e.handle)).toEqual(['OK']); // a malformed entry is dropped, the rest kept
    store.delete('missb.leaderboard.REALISTIC');
    for (let i = 0; i < 25; i++) recordRun({ handle: 'P', rounds: 1, score: i * 10, seed: `S${i}`, date: '2026-10-17', tech: 'L1', assisted: false });
    const board = loadBoard();
    expect(board.length).toBe(20);
    expect(board[0]?.score).toBe(240);
    expect(recordRun({ handle: 'P', rounds: 9, score: 1e6, seed: 'TOP', date: '2026-10-17', tech: 'L1', assisted: true })).toBe(1);
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });
});
