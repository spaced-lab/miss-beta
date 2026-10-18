import { describe, expect, it } from 'vitest';
import { createRun } from '../src/game/run';
import { advanceTutorial, createTutorial, TUTORIAL_SEED, TUTORIAL_STEPS, type TutorialFacts } from '../src/game/tutorial';
import { YEAR } from '../src/physics/constants';
import { resolveRound } from '../src/sim/resolver';
import { roundRng } from '../src/sim/rng';
import { scenarioById, spawnScenario } from '../src/sim/scenarios';
import { createWorld } from '../src/sim/world';
import { hasGlyph } from '../src/render/vectorFont';

const base: TutorialFacts = { warp: 0, maxWarp: 0, plannerOpen: false, plannerOpened: false, missions: 0, launched: false, impacted: false, planetOpened: false, debrief: false, programsOpened: false };

describe('TUTORIAL (GAME_PLAN 25)', () => {
  it('is eight steps that each name their lore entries and use only stroke-font glyphs', () => {
    expect(TUTORIAL_STEPS.length).toBe(8);
    for (const st of TUTORIAL_STEPS) {
      expect(st.lore.length).toBeGreaterThan(0);
      for (const line of st.lines) for (const ch of line) expect(hasGlyph(ch)).toBe(true);
    }
  });

  it('advances only when the player does the step: clock, warp, planner, commit, launch, impact, approach', () => {
    const t = createTutorial();
    expect(advanceTutorial(t, base, 0.5)).toBe(false);
    expect(t.step).toBe(0);
    expect(advanceTutorial(t, { ...base, warp: 1 })).toBe(true);
    expect(t.step).toBe(1);
    expect(advanceTutorial(t, { ...base, maxWarp: 2 })).toBe(false);
    expect(advanceTutorial(t, { ...base, maxWarp: 3 })).toBe(true);
    expect(advanceTutorial(t, { ...base, plannerOpened: true })).toBe(true);
    expect(t.step).toBe(3);
    expect(advanceTutorial(t, { ...base, plannerOpened: true })).toBe(false);
    expect(advanceTutorial(t, { ...base, missions: 1 })).toBe(true);
    expect(advanceTutorial(t, { ...base, launched: true })).toBe(true);
    expect(advanceTutorial(t, { ...base, impacted: true })).toBe(true);
    expect(advanceTutorial(t, { ...base, debrief: true })).toBe(true);
    expect(t.step).toBe(7);
    // The last step never auto-advances; Space starts round 1 for real.
    expect(advanceTutorial(t, { ...base, debrief: true, programsOpened: true })).toBe(false);
    expect(t.step).toBe(7);
    // Opening the planner early skips the clock steps.
    const u = createTutorial();
    expect(advanceTutorial(u, { ...base, plannerOpened: true })).toBe(true);
    expect(advanceTutorial(u, { ...base, plannerOpened: true })).toBe(true);
    expect(advanceTutorial(u, { ...base, plannerOpened: true })).toBe(true);
    expect(u.step).toBe(3);
  });

  it('the tutorial rock is 100 m stony with ten years, hits when ignored, and the run is flagged never-recorded', () => {
    const sc = scenarioById('TUTORIAL');
    expect(sc).not.toBeNull();
    const w = createWorld(TUTORIAL_SEED, 1);
    w.threat = spawnScenario(sc!, w, roundRng(TUTORIAL_SEED, 1));
    expect(w.threat.D).toBe(100);
    expect(w.threat.type.id).toBe('STONY');
    expect(w.threat.tImpact / YEAR).toBeCloseTo(10, 3);
    expect(resolveRound(w).outcome).toBe('HIT');
    const run = createRun(TUTORIAL_SEED, { tutorial: true });
    expect(run.tutorial).toBe(true);
    expect(createRun('X').tutorial).toBe(false);
  });
});

describe('DART replay script (IDEAS 15)', () => {
  it('has five steps that advance on the shared facts and never auto-finish', async () => {
    const { createTutorial, advanceTutorial, stepsOf, DART_STEPS } = await import('../src/game/tutorial');
    const t = createTutorial('DART');
    expect(stepsOf(t)).toBe(DART_STEPS);
    expect(DART_STEPS.length).toBe(5);
    const f = { warp: 0, maxWarp: 0, plannerOpen: false, plannerOpened: false, missions: 0, launched: false, impacted: false, planetOpened: false, debrief: false, programsOpened: false };
    expect(advanceTutorial(t, f)).toBe(false);
    expect(advanceTutorial(t, { ...f, warp: 1 })).toBe(true);
    expect(advanceTutorial(t, { ...f, missions: 1 })).toBe(true);
    expect(advanceTutorial(t, { ...f, launched: true })).toBe(true);
    expect(advanceTutorial(t, { ...f, impacted: true })).toBe(true);
    expect(advanceTutorial(t, { ...f, debrief: true })).toBe(false);
    expect(t.step).toBe(4);
  });
});
