import { describe, expect, it } from 'vitest';
import { KNOBS } from '../src/config/knobs';
import { createRun, nextRound } from '../src/game/run';
import { resolveRound, type SciFiOpts } from '../src/sim/resolver';
import { roundRng } from '../src/sim/rng';
import { generateThreat } from '../src/sim/roundGen';
import { createWorld } from '../src/sim/world';

function round(seed: string) {
  const world = createWorld(seed, 3);
  world.threat = generateThreat(roundRng(seed, 3), world, 3, 0, { skipDiscovery: true });
  return world;
}
const base: SciFiOpts = { orbitalLaserW: 0, laserSince: null, disassemblerTauYears: 0, disassemblerSince: null, netTier: 0 };

describe('speculative standing capabilities (GAME_PLAN 30)', () => {
  it('each capability pushes the threat and moves the close approach', () => {
    const world = round('SPEC');
    const none = resolveRound(world, [], { scifi: base });
    for (const [key, method] of [['nanoforgeSince', 'NANOFORGE'], ['thrusterSwarmSince', 'THRUSTER_SWARM'], ['shepherdSince', 'SHEPHERD']] as const) {
      const r = resolveRound(world, [], { scifi: { ...base, [key]: 0 } });
      const push = r.events.find((e) => e.kind === 'PUSH' && e.method === method);
      expect(push, method).toBeDefined();
      expect(Math.abs(r.ca.dMin - none.ca.dMin), method).toBeGreaterThan(1e3);
    }
    const tug = resolveRound(world, [], { scifi: { ...base, fusionTugN: 50000, fusionTugSince: 0 } });
    expect(tug.events.some((e) => e.kind === 'PUSH' && e.method === 'FUSION_TUG')).toBe(true);
  });
  it('the shepherd delivers dv = beta m U / M', () => {
    const world = round('SPEC2');
    const r = resolveRound(world, [], { scifi: { ...base, shepherdSince: 0 } });
    const push = r.events.find((e) => e.kind === 'PUSH' && e.method === 'SHEPHERD');
    expect(push && push.kind === 'PUSH').toBe(true);
    if (push && push.kind === 'PUSH') {
      const expected = (KNOBS.SHEPHERD_BETA * KNOBS.SHEPHERD_KG * KNOBS.SHEPHERD_U) / world.threat!.mass;
      expect(push.dv / expected).toBeGreaterThan(0.95);
      expect(push.dv / expected).toBeLessThan(1.05);
    }
  });
  it('programs finished in an earlier round act from the next round start', () => {
    const run = createRun('X');
    const p = run.programs[0]!;
    p.completedAt = 9e8;
    nextRound(run, 10);
    expect(p.completedAt).toBe(0);
  });
});

describe('IDEAS 13: program effects that act', () => {
  it('the sail depot and the ground laser push; the C3 bonus raises payload', async () => {
    const world = round('SPEC3');
    const none = resolveRound(world, [], { scifi: base });
    const dep = resolveRound(world, [], { scifi: { ...base, sailDepot: 6, sailDepotSince: 0 } });
    expect(dep.events.some((e) => e.kind === 'PUSH' && e.method === 'SAIL_DEPOT')).toBe(true);
    expect(Math.abs(dep.ca.dMin - none.ca.dMin)).toBeGreaterThan(1e3);
    const gl = resolveRound(world, [], { scifi: { ...base, groundLaserSince: 0 } });
    const push = gl.events.find((e) => e.kind === 'PUSH' && e.method === 'GROUND_LASER');
    expect(push).toBeDefined();
    const { computePorkchop } = await import('../src/planner/porkchop');
    const { launcherTier } = await import('../src/physics/estimates');
    const home = world.planets.find((p) => p.id === 'HOME')!;
    const req = { home: home.elements, threat: world.threat!.elements, muSun: world.star.mu, tMin: 0, tImpact: world.threat!.tImpact, tier: launcherTier(1) };
    const a = computePorkchop(req);
    const b = computePorkchop({ ...req, c3Bonus: 15 });
    const best = (g: { payload: ArrayLike<number> }) => Math.max(...Array.from(g.payload).filter((v) => Number.isFinite(v)));
    expect(best(b)).toBeGreaterThan(best(a));
  });
});
