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
  it('the L4/L5 picket delivers dv = 2 beta m U / M; sail kits pull with KIT_COUNT x KIT_EFF x 2 P0 A', () => {
    const world = round('SPEC3');
    const none = resolveRound(world, [], { scifi: base });
    const r = resolveRound(world, [], { scifi: { ...base, picketSince: 0 } });
    const push = r.events.find((e) => e.kind === 'PUSH' && e.method === 'PICKET');
    expect(push && push.kind === 'PUSH').toBe(true);
    if (push && push.kind === 'PUSH') {
      const expected = (2 * KNOBS.PICKET_BETA * KNOBS.PICKET_KG * KNOBS.PICKET_U) / (world.threat?.mass ?? 1);
      expect(push.dv / expected).toBeGreaterThan(0.95);
      expect(push.dv / expected).toBeLessThan(1.05);
    }
    const k = resolveRound(world, [], { scifi: { ...base, kitsSince: 0 } });
    const kit = k.events.find((e) => e.kind === 'PUSH' && e.method === 'SAIL_KIT');
    expect(kit && kit.kind === 'PUSH' && kit.force).toBeCloseTo(KNOBS.KIT_COUNT * KNOBS.KIT_EFF * 2 * 4.56e-6 * KNOBS.KIT_AREA, 9);
    expect(Math.abs(k.ca.dMin - none.ca.dMin)).toBeGreaterThan(0);
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

describe('civilization level (IDEAS 14)', () => {
  it('completing every REALISTIC program enters SCI-FI and adds its programs; every SPECULATIVE one enters SIMULATION', async () => {
    const { advanceCivilization } = await import('../src/game/civ');
    const { PROGRAMS } = await import('../src/sim/programs');
    const run = createRun('CIV');
    expect(advanceCivilization(run)).toBeNull();
    for (const p of run.programs) p.completedAt = 0;
    expect(advanceCivilization(run)).toContain('LEVEL 1');
    expect(run.mode).toBe('SCIFI');
    const scifiIds = PROGRAMS.filter((p) => p.mode === 'SCIFI').map((p) => p.id);
    for (const id of scifiIds) expect(run.programs.some((s) => s.id === id)).toBe(true);
    for (const p of run.programs) p.completedAt = 0;
    expect(advanceCivilization(run)).toContain('LEVEL 2');
    expect(run.mode).toBe('SIMULATION');
    expect(advanceCivilization(run)).toBeNull();
  });
});

describe('seed fleet', () => {
  it('strikes once per doubling with 1, 2, 4 ... rocks; more lead buys more strikes', () => {
    const world = round('SEEDS');
    const r = resolveRound(world, [], { scifi: { ...base, seedFleetSince: 0 } });
    const strikes = r.events.filter((e) => e.kind === 'PUSH' && e.method === 'SEED_FLEET');
    const leadYears = world.threat!.tImpact / (365.25 * 86400);
    expect(strikes.length).toBeGreaterThan(0);
    expect(strikes.length).toBeLessThanOrEqual(Math.ceil((leadYears - 1) / 1.5) + 1);
    if (strikes.length >= 2 && strikes[0]!.kind === 'PUSH' && strikes[1]!.kind === 'PUSH') expect(strikes[1]!.dv / strikes[0]!.dv).toBeGreaterThan(1.8);
  });
});

describe('KARDASHEV on the title', () => {
  it('completes the programs on the pending run even without a round', async () => {
    const { runCommand } = await import('../src/game/console');
    const run = createRun('TITLE');
    runCommand('KARDASHEV2', { run, round: null });
    expect(run.programs.some((p) => p.id === 'NANOFORGE_SEEDS' && p.completedAt !== null)).toBe(true);
    expect(run.effects.nanoforge).toBe(1);
  });
});
