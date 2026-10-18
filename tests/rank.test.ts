import { describe, expect, it } from 'vitest';
import { KNOBS } from '../src/config/knobs';
import { launcherTier } from '../src/physics/estimates';
import { computePorkchop } from '../src/planner/porkchop';
import { rankGrid, type RankInput } from '../src/planner/rank';
import { resolveRound } from '../src/sim/resolver';
import { roundRng } from '../src/sim/rng';
import { generateThreat } from '../src/sim/roundGen';
import { createWorld, planetById } from '../src/sim/world';
import { runJob, type WorkerJob } from '../src/worker/planner.worker';

function setup(seed = 'RANK-1'): { inp: RankInput; grid: ReturnType<typeof computePorkchop> } {
  const w = createWorld(seed, 1);
  w.threat = generateThreat(roundRng(seed, 1), w, 1, 0, { skipDiscovery: true });
  const res = resolveRound(w, []);
  const target = res.bodies[0];
  if (!target || !w.threat) throw new Error('no target');
  const home = planetById(w, 'HOME');
  const grid = computePorkchop({ home: home.elements, threat: w.threat.elements, muSun: w.star.mu, tMin: w.t + KNOBS.BUILD_TIME_KINETIC, tImpact: w.threat.tImpact, tier: launcherTier(1) });
  const inp: RankInput = { world: w, missions: [], target, threatEnergyMt: res.energy.energyMt, launcherTier: 1, impactorTier: 1, warheadTier: 0, slowPushTier: 0, sailTier: 0, swarmTier: 0, autonomyTier: 0, pi: false, dsmBudget: 0, budget: 100 };
  return { inp, grid };
}

describe('planner ranking in the worker (D11)', () => {
  it('ranks the same plans through the worker boundary as inline', () => {
    const { inp, grid } = setup();
    const inline = rankGrid(grid, inp);
    expect(inline.length).toBeGreaterThan(0);
    expect(inline.some((c) => c.verdict !== null)).toBe(true);
    // structuredClone stands in for postMessage: the job must survive it with no callbacks attached.
    const job = structuredClone({ id: 1, type: 'rank', input: inp, grid, flyby: null, sail: null }) as WorkerJob;
    const r = runJob(job);
    expect(r.type).toBe('rank');
    if (r.type !== 'rank') return;
    expect(r.cands).toEqual(inline);
  });

  it('rejects a malformed rank job', () => {
    const { inp, grid } = setup();
    const bad = runJob({ id: 2, type: 'rank', input: { ...inp, budget: 'lots' }, grid, flyby: null, sail: null } as unknown as WorkerJob);
    expect(bad.type).toBe('error');
  });
});

describe('worker job errors (code review 2026-10-18 finding 24)', () => {
  it('a job that throws comes back as an error reply for that job, not an uncaught throw', async () => {
    const { safeRunJob } = await import('../src/worker/planner.worker');
    const { inp } = setup();
    // Passes the shape guard but has no grid arrays: ranking throws inside the job.
    const job = { id: 9, type: 'rank', input: inp, grid: { nL: 2, nA: 2 }, flyby: null, sail: null } as unknown as WorkerJob;
    expect(() => runJob(job)).toThrow();
    const r = safeRunJob(job);
    expect(r).toMatchObject({ id: 9, type: 'error' });
  });
});
