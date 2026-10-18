import { describe, expect, it } from 'vitest';
import { createRun } from '../src/game/run';
import { runFromSave, toSaveFile } from '../src/game/savegame';
import { canUnlock, hasTech, reapplyTech, TECH, techById, TRACKS, unlock } from '../src/game/tech';

describe('tech tree (GAME_PLAN 9)', () => {
  it('loads every track with chains and costs', () => {
    expect(TRACKS).toContain('LAUNCH');
    expect(TECH.length).toBeGreaterThanOrEqual(28);
    for (const n of TECH) {
      expect(n.cost).toBeGreaterThan(0);
      for (const r of n.requires) expect(() => techById(r)).not.toThrow();
    }
  });

  it('unlocks need research and prerequisites; effects raise tiers', () => {
    const run = createRun('T');
    expect(canUnlock(run, 'L2')).toBe('RESEARCH');
    run.research = 20;
    expect(canUnlock(run, 'L3')).toBe('REQUIRES');
    expect(unlock(run, 'L2')).toBe('OK');
    expect(run.research).toBe(15);
    expect(run.launcherTier).toBe(2);
    expect(hasTech(run, 'L2')).toBe(true);
    expect(unlock(run, 'L2')).toBe('OWNED');
    expect(unlock(run, 'L3')).toBe('OK');
    expect(run.launcherTier).toBe(3);
    expect(run.research).toBe(3);
    expect(unlock(run, 'N1')).toBe('OK');
    expect(run.navTier).toBe(1);
    expect(canUnlock(run, 'SL4')).toBe('MODE');
    expect(canUnlock(run, 'SL4', 'SCIFI')).toBe('REQUIRES');
  });

  it('survives a save round trip: node ids are stored and re-applied', () => {
    const run = createRun('SAVE');
    run.research = 50;
    unlock(run, 'I2');
    unlock(run, 'A1');
    unlock(run, 'W1');
    const sf = toSaveFile(run, null);
    expect(sf.tech).toEqual(['I2', 'A1', 'W1']);
    const back = runFromSave(sf);
    expect(back.impactorTier).toBe(2);
    expect(back.autonomyTier).toBe(1);
    expect(back.warheadTier).toBe(1);
    const r2 = createRun('X');
    r2.tech = ['P2', 'NOPE'];
    reapplyTech(r2);
    expect(r2.propulsionTier).toBe(2);
  });
});

describe('sandbox run (learning mode)', () => {
  it('has unlimited means, every REALISTIC tech, and is flagged so it is never recorded', () => {
    const run = createRun('SB', { sandbox: true });
    expect(run.sandbox).toBe(true);
    expect(run.assisted).toBe(true);
    expect(run.cheatsUsed).toContain('SANDBOX');
    expect(run.research).toBeGreaterThan(1000);
    expect(run.economy.start).toBeGreaterThan(1e5);
    expect(run.launcherTier).toBe(3);
    expect(run.warheadTier).toBe(3);
    expect(run.autonomyTier).toBe(3);
    expect(run.sailTier).toBe(3); // SL4 is SCI-FI
    expect(run.tech).not.toContain('SL4');
    const back = runFromSave(toSaveFile(run, null));
    expect(back.sandbox).toBe(true);
    expect(createRun('N').sandbox).toBe(false);
  });
});
