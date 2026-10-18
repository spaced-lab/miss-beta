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
