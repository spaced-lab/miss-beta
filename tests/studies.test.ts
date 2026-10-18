// Feasibility studies (owner backlog 6): deterministic fates, milestones, failure early, effects on success, save.
import { describe, expect, it } from 'vitest';
import { createEconomy } from '../src/game/economy';
import { createRun } from '../src/game/run';
import { runFromSave, toSaveFile } from '../src/game/savegame';
import { parseSave, writeSave } from '../src/game/saveMd';
import { YEAR } from '../src/physics/constants';
import { defaultEffects } from '../src/sim/programs';
import { advanceStudies, anyWorks, createStudies, milestones, startStudy, STUDIES, studyAvailable, studyById, studyCostPerYear, studyFate, type StudyState } from '../src/sim/studies';
import { NETWORKS } from '../src/sim/detection';

const ctx = () => ({ economy: createEconomy(100, 6), effects: defaultEffects(), networks: { active: [] as string[], since: {} as Record<string, number> } });

function runOut(st: StudyState, seed: string, assured = false) {
  const c = ctx();
  const events = [];
  for (let i = 0; i < 400 && st.status === 'RUNNING'; i++) events.push(...advanceStudies([st], seed, c, i * 0.1 * YEAR, 0.1 * YEAR, assured));
  return { c, events };
}

describe('STUDIES', () => {
  it('cards are well formed and their networks exist', () => {
    for (const c of STUDIES) {
      expect(c.trlNeeded).toBeGreaterThan(c.trlNow);
      expect(c.pSuccess).toBeGreaterThan(0);
      expect(c.pSuccess).toBeLessThanOrEqual(1);
      for (const r of c.requires) expect(() => studyById(r)).not.toThrow();
      for (const e of c.effects) if (e.network) expect(NETWORKS.some((n) => n.id === e.network)).toBe(true);
    }
  });
  it('fate is deterministic per seed, card and attempt, and assured in SCI-FI', () => {
    const c = studyById('FUSION_FRC');
    expect(studyFate('S1', c, 1)).toEqual(studyFate('S1', c, 1));
    expect(studyFate('S1', c, 1)).not.toEqual(studyFate('S1', c, 2));
    const a = studyFate('S1', c, 1, true);
    expect(a.success).toBe(true);
    expect(a.humanYears).toBe(c.humanYears);
  });
  it('success rate over many attempts is near pSuccess', () => {
    const c = studyById('AI_MOTHERSHIP');
    let ok = 0;
    for (let i = 1; i <= 2000; i++) if (studyFate('RATE', c, i).success) ok++;
    expect(ok / 2000).toBeGreaterThan(c.pSuccess - 0.05);
    expect(ok / 2000).toBeLessThan(c.pSuccess + 0.05);
  });
  it('a lucky attempt passes every milestone and applies its effects; a doomed one stops early and costs less', () => {
    const c = studyById('HIVE_1');
    let good = 0;
    let bad = 0;
    for (let i = 0; i < 60 && (!good || !bad); i++) {
      const seed = `H${i}`;
      const fate = studyFate(seed, c, 1);
      const st = createStudies().find((x) => x.id === 'HIVE_1') as StudyState;
      startStudy(st);
      const { c: cx, events } = runOut(st, seed);
      if (fate.success) {
        good++;
        expect(st.status).toBe('SUCCEEDED');
        expect(events.filter((e) => e.kind === 'MILESTONE').length).toBe(milestones(c) - 1);
        expect(cx.networks.active).toContain('HIVE_1');
        expect(cx.economy.spent).toBeCloseTo(studyCostPerYear(c) * fate.gameYears, 0);
      } else {
        bad++;
        expect(st.status).toBe('FAILED');
        expect(st.progress).toBeCloseTo(fate.failStep / milestones(c), 9);
        expect(cx.networks.active).not.toContain('HIVE_1');
      }
    }
    expect(good).toBeGreaterThan(0);
    expect(bad).toBeGreaterThan(0);
  });
  it('prerequisites and the EXPERIMENTAL switch gate availability; parallel odds combine', () => {
    const states = createStudies();
    expect(studyAvailable(studyById('HIVE_2'), states, false)).toBe(false);
    (states.find((s) => s.id === 'HIVE_1') as StudyState).status = 'SUCCEEDED';
    expect(studyAvailable(studyById('HIVE_2'), states, false)).toBe(true);
    expect(studyAvailable(studyById('FUSION_FRC'), states, false)).toBe(false);
    expect(studyAvailable(studyById('FUSION_FRC'), states, true)).toBe(true);
    expect(anyWorks([0.25, 0.2])).toBeCloseTo(0.4, 12);
  });
  it('studies survive SAVE.md and a succeeded one re-applies its effects', () => {
    const run = createRun('SAVESTUDY');
    const st = run.studies.find((x) => x.id === 'HIVE_1') as StudyState;
    st.attempt = 2;
    st.progress = 1;
    st.status = 'SUCCEEDED';
    const run2 = run.studies.find((x) => x.id === 'FUSION_ICF') as StudyState;
    run2.attempt = 1;
    run2.progress = 0.4;
    run2.funding = 0.5;
    run2.status = 'RUNNING';
    const sf = parseSave(writeSave(toSaveFile(run, null)));
    expect(sf?.studies?.length).toBe(2);
    const back = runFromSave(sf as NonNullable<typeof sf>);
    expect(back.studies.find((x) => x.id === 'FUSION_ICF')).toMatchObject({ attempt: 1, progress: 0.4, funding: 0.5, status: 'RUNNING' });
    expect(back.networks.active).toContain('HIVE_1');
  });
});

describe('STUDIES readiness readout', () => {
  it('a failed attempt reports the level below the milestone it failed at', async () => {
    const { trlReached } = await import('../src/sim/studies');
    const c = studyById('FUSION_TOKAMAK');
    const st: StudyState = { id: c.id, attempt: 1, progress: 2 / 3, funding: 0, status: 'FAILED', endedAt: 0 };
    expect(trlReached(c, st)).toBe(c.trlNow + 1);
    expect(trlReached(c, { ...st, status: 'RUNNING' })).toBe(c.trlNow + 2);
  });
});
