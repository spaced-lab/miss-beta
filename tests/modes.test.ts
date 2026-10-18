import { describe, expect, it } from 'vitest';
import { COMMANDS, hawkingLifetime, runCommand, tokenize, type GameContext } from '../src/game/console';
import { allowsTag, boardFor, budgetScale, civilizationLevel, enterMode } from '../src/game/modes';
import { branchSurvives, earliestEnd, forkMultiverse, resolveBranch, survivalFraction, wormhole } from '../src/game/multiverse';
import { createRun } from '../src/game/run';
import { KNOBS } from '../src/config/knobs';
import { YEAR } from '../src/physics/constants';
import { resolveRound } from '../src/sim/resolver';
import { roundRng } from '../src/sim/rng';
import { generateThreat } from '../src/sim/roundGen';
import { SCENARIOS, scenarioById, spawnScenario } from '../src/sim/scenarios';
import { createWorld } from '../src/sim/world';

function ctx(mode: 'REALISTIC' | 'SCIFI' | 'SIMULATION' | 'MULTIVERSE' = 'REALISTIC'): GameContext {
  const run = createRun('CTX');
  if (mode !== 'REALISTIC') enterMode(run, 'SCIFI');
  if (mode === 'SIMULATION' || mode === 'MULTIVERSE') enterMode(run, 'SIMULATION');
  if (mode === 'MULTIVERSE') enterMode(run, 'MULTIVERSE');
  const say = (s: string) => () => s;
  return { run, round: { hasThreat: true, teleport: say('TP'), observe: say('OB'), rewind: () => 'RW', editG: () => 'EG', deleteThreat: say('DL'), tractorBeam: say('TB'), singularity: say('SG'), planetThrusters: () => 'PT', shrink: say('SH'), multiverse: (n) => `MV${n}`, wormhole: say('WH'), revealNow: say('RV'), impulse: () => 'IMPULSE', timefold: () => 'FOLD', detour: () => 'DETOUR', hollow: () => 'HOLLOW', ticket: () => 'TICKET', nibiru: () => 'X', mandela: () => 'M', peel: () => 'P', bootstrap: () => 'B', retrocausal: () => 'R', borrow: () => 'W', completeAllPrograms: () => 'CP' } };
}

describe('MODES (GAME_PLAN 21)', () => {
  it('nests: MULTIVERSE requires SIMULATION requires SCIFI; tags gate by mode', () => {
    const run = createRun('M');
    expect(enterMode(run, 'SIMULATION')).toBe('REQUIRES_SCIFI');
    expect(enterMode(run, 'MULTIVERSE')).toBe('REQUIRES_SIMULATION');
    expect(enterMode(run, 'SCIFI')).toBe('OK');
    expect(enterMode(run, 'MULTIVERSE')).toBe('REQUIRES_SIMULATION');
    expect(enterMode(run, 'SIMULATION')).toBe('OK');
    expect(enterMode(run, 'MULTIVERSE')).toBe('OK');
    expect(run.highestMode).toBe('MULTIVERSE');
    expect(enterMode(run, 'SCIFI')).toBe('ALREADY');
    expect(allowsTag('REALISTIC', 'SPECULATIVE')).toBe(false);
    expect(allowsTag('SCIFI', 'SPECULATIVE')).toBe(true);
    expect(allowsTag('SCIFI', 'FICTION')).toBe(false);
    expect(allowsTag('SIMULATION', 'FICTION')).toBe(true);
    expect(boardFor('SIMULATION')).toBe('FICTION');
    expect(boardFor('SCIFI')).toBe('SCIFI');
    expect(budgetScale('SCIFI')).toBe(10);
    expect(civilizationLevel(15, 15, 0, 5)).toBe(1);
    expect(civilizationLevel(15, 15, 5, 5)).toBe(2);
    expect(civilizationLevel(3, 15, 0, 5)).toBe(0);
  });

  it('a FICTION command in REALISTIC is rejected with the mode-gating message; it runs in SIMULATION', () => {
    const r = runCommand('TELEPORT', ctx('REALISTIC'));
    expect(r[0]).toMatch(/FICTION: SIMULATION MODE ONLY/);
    const s = runCommand('teleport', ctx('SIMULATION'));
    // GAME_PLAN 30: in character by default; REALITY ON states the forbidding physics first.
    expect(s[0]).not.toContain('NO-CLONING');
    const sim = ctx('SIMULATION');
    runCommand('REALITY ON', sim);
    expect(runCommand('TELEPORT', sim)[0]).toBe('REALITY: NO-CLONING THEOREM FORBIDS COPYING ITS STATE. ALSO NOBODY BUILT A RECEIVER.');
    runCommand('REALITY OFF', sim);
    expect(s[1]).toBe('TP');
    expect(runCommand('WORMHOLE', ctx('SIMULATION'))[0]).toMatch(/MULTIVERSE MODE ONLY/);
    expect(runCommand('WORMHOLE', ctx('MULTIVERSE'))[1]).toBe('WH');
    expect(runCommand('BOGUS', ctx())[0]).toMatch(/UNKNOWN COMMAND/);
    expect(runCommand('', ctx())).toEqual([]);
  });

  it('cheat codes flag the run ASSISTED and the mode codes move the run; every FICTION entry prints its quantity', () => {
    const c = ctx();
    runCommand('scifi', c);
    expect(c.run.mode).toBe('SCIFI');
    expect(c.run.cheatsUsed).toContain('SCIFI');
    expect(c.run.assisted).toBe(true);
    runCommand('SIMULATION', c);
    expect(c.run.mode).toBe('SIMULATION');
    expect(runCommand('MULTIVERSE 9', c)[1]).toBe('MV9');
    expect(c.run.mode).toBe('MULTIVERSE');
    expect(runCommand('LEADTIME 3', c)[0]).toMatch(/3 YEARS/);
    expect(c.run.leadTimeNext).toBe(3);
    expect(runCommand('SPAWN apophis', c)[0]).toMatch(/APOPHIS/);
    expect(c.run.spawnNext).toBe('APOPHIS');
    expect(runCommand('SPAWN nope', c)[0]).toMatch(/USAGE/);
    runCommand('FASTBUILD', c);
    expect(c.run.effects.buildTimeYears).toBe(0);
    runCommand('GODTRACK', c);
    expect(c.run.effects.sigmaVMult).toBe(0);
    expect(runCommand('KNOB PORKCHOP_STEP 5', c)[0]).toMatch(/SUMMONDEVS/);
    for (const cmd of COMMANDS.filter((x) => x.tag === 'FICTION')) {
      const out = runCommand(cmd.usage, c);
      expect(out.length).toBeGreaterThan(0);
      expect(out[0]).toMatch(/[A-Z]/);
    }
    expect(runCommand('KNOBS PORK', c).length).toBeGreaterThan(0);
    expect(runCommand('KNOB NOPE 1', c)[0]).toMatch(/NO NUMERIC KNOB/);
    const before = KNOBS.PORKCHOP_STEP;
    expect(runCommand('KNOB PORKCHOP_STEP 5', c)[0]).toMatch(/-> 5/);
    runCommand(`KNOB PORKCHOP_STEP ${before}`, c);
    expect(KNOBS.PORKCHOP_STEP).toBe(before);
    expect(tokenize('EDIT G 2; rm -rf /')).toEqual(['EDIT', 'G', '2', 'rm', '-rf']);
  });

  it('SINGULARITY: t_evap(1e4 kg) ≈ 8.4e-5 s and t_evap(1e9 kg) ≈ 2.7e3 yr', () => {
    expect(hawkingLifetime(1e4) / 8.4e-5).toBeCloseTo(1, 1);
    expect(hawkingLifetime(1e9) / YEAR / 2.7e3).toBeCloseTo(1, 1);
  });

  it('KARDASHEV1 owns every REALISTIC tech and multiplies the budget; KARDASHEV2 enters SCI-FI with everything', () => {
    const c = ctx();
    runCommand('KARDASHEV1', c);
    expect(c.run.launcherTier).toBe(3);
    expect(c.run.tech).not.toContain('SL4');
    expect(c.run.economy.perYear).toBe(60);
    expect(c.run.civLevel).toBe(1);
    const d = ctx();
    runCommand('KARDASHEV2', d);
    expect(d.run.mode).toBe('SCIFI');
    expect(d.run.tech).toContain('NET2');
    expect(d.run.civLevel).toBe(2);
  });
});

describe('SPAWN scenarios', () => {
  it('every scenario builds a threat that impacts when ignored; sunward ones are NO WARNING', () => {
    expect(SCENARIOS.map((s) => s.id)).toEqual(['TUTORIAL', 'CHELYABINSK', 'TUNGUSKA', 'YR4', 'APOPHIS', 'BENNU', 'DIDYMOS', 'CHICXULUB']);
    for (const sc of SCENARIOS) {
      const w = createWorld(`SC-${sc.id}`, 1);
      w.threat = spawnScenario(sc, w, roundRng(`SC-${sc.id}`, 1));
      expect(w.threat.D).toBe(sc.D);
      expect(w.threat.noWarning).toBe(sc.leadYears <= 0);
      const r = resolveRound(w);
      expect(r.outcome).toBe('HIT');
      expect(Math.abs(r.ca.tCa - w.threat.tImpact)).toBeLessThan(10);
    }
    expect(scenarioById('bennu')?.D).toBe(490);
    expect(scenarioById('nope')).toBeNull();
  });
});

describe('MULTIVERSE', () => {
  it('forks into branches with distinct draws, tracks survival, collapses and wormholes', () => {
    const w = createWorld('MV', 1);
    w.threat = generateThreat(roundRng('MV', 1), w, 1, 0, { skipDiscovery: true });
    const mv = forkMultiverse(w, [], 4);
    expect(mv.branches.length).toBe(4);
    expect(mv.branches.every((b) => b.result.outcome === 'HIT')).toBe(true);
    expect(survivalFraction(mv)).toBe(0);
    expect(earliestEnd(mv)).toBeCloseTo(w.threat.tImpact, -2);
    expect(mv.branches[1]!.world).not.toBe(w);
    expect(mv.branches[1]!.world.threat).not.toBe(w.threat);
    const msg = wormhole(mv);
    expect(msg).toMatch(/BRANCH 1'S THREAT NOW FALLS ON BRANCH 2/);
    expect(branchSurvives(mv.branches[0]!)).toBe(true); // its own threat was deleted
    expect(mv.branches[1]!.extraResult?.outcome).toBe('HIT');
    expect(survivalFraction(mv)).toBe(0.25);
    resolveBranch(mv.branches[2]!);
    expect(mv.branches[2]!.result.outcome).toBe('HIT');
  });

  it('x9 branches: per-frame state work for nine worlds stays well under a frame', () => {
    const w = createWorld('MV9', 1);
    w.threat = generateThreat(roundRng('MV9', 1), w, 1, 0, { skipDiscovery: true });
    const mv = forkMultiverse(w, [], 9);
    const t0 = performance.now();
    for (let f = 0; f < 60; f++) {
      for (const b of mv.branches) {
        b.world.t += 86400;
        for (const p of b.world.planets) void p.elements;
      }
    }
    expect(performance.now() - t0).toBeLessThan(200);
  });
});

describe('GAME_PLAN 30 fiction', () => {
  it('every new command runs in SIMULATION, stays in character, and is gated in REALISTIC', async () => {
    const { flybyDeflection, DEADPAN } = await import('../src/game/fiction');
    expect(flybyDeflection(1e15, 100, 20000)).toBeCloseTo(0.0667, 3);
    for (const verb of ['MICROHOLE', 'TIMEFOLD 2', 'DETOUR', 'LUNA', 'HOLLOW', 'TICKET', 'NIBIRU', 'MANDELA', 'BOOTSTRAP', 'RETROCAUSAL']) {
      const v = verb.split(' ')[0]!;
      expect(runCommand(verb, ctx('REALISTIC'))[0]).toMatch(/SIMULATION MODE ONLY/);
      const out = runCommand(verb, ctx('SIMULATION'));
      expect(out.length).toBeGreaterThanOrEqual(2);
      expect(DEADPAN[v]).toContain(out[0]);
    }
  });
});

describe('the peel', () => {
  it('ambient peel is mostly off, peels in a 4 s window every 23 s, and PEEL runs in character', async () => {
    const { ambientPeel } = await import('../src/render/glitch');
    expect(ambientPeel(10).amount).toBe(0);
    expect(ambientPeel(23 + 2).amount).toBeGreaterThan(0);
    expect(ambientPeel(23 + 2).corner).toBeGreaterThanOrEqual(0);
    const c = ctx('SIMULATION');
    expect(runCommand('PEEL', c)[1]).toBe('P');
    runCommand('REALITY ON', c);
    expect(runCommand('PEEL', c)[0]).toContain('ORBITAL ELEMENTS');
    runCommand('REALITY OFF', c);
  });
});

describe('SIMULATION anomalies', () => {
  it('about one round in three from round 2, stable per (seed, round)', async () => {
    const { anomalyFor } = await import('../src/game/fiction');
    expect(anomalyFor('S', 1)).toBeNull();
    let n = 0;
    for (let r = 2; r < 302; r++) if (anomalyFor('SEED', r)) n++;
    expect(n).toBeGreaterThan(60);
    expect(n).toBeLessThan(140);
    expect(anomalyFor('SEED', 7)).toBe(anomalyFor('SEED', 7));
  });
});
