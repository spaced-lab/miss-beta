import { describe, expect, it } from 'vitest';
import { Autopilot, choosePlan, readSeconds, stackPlan, type AutoCand, type AutoView } from '../src/game/autoplay';

const cand = (o: Partial<AutoCand>): AutoCand => ({ label: 'KINETIC', outcome: 'HIT', margin: -1, cost: 3, affordable: true, warhead: false, ...o });

function view(o: Partial<AutoView> = {}): AutoView {
  return {
    round: 1, phase: 'planning', threat: { name: 'X', D: 200, energyMt: 300, leadS: 10 * 31557600, kind: 'asteroid' },
    missions: 0, craftInFlight: false, predicted: 'HIT', margin: -1.5, budget: 8, warp: 1,
    planner: { open: false, ready: false, sel: 0, cands: [] }, overlayOpen: false, teleModal: false, teleComplete: false,
    cine: false, canEvacuate: true, debrief: null, ...o,
  };
}

describe('autoplay choices', () => {
  it('reading time grows with words and stays between 4 and 14 s', () => {
    expect(readSeconds('one two')).toBe(4);
    expect(readSeconds(Array(20).fill('w').join(' '))).toBeCloseTo(8.9);
    expect(readSeconds(Array(200).fill('w').join(' '))).toBe(14);
  });
  it('takes an affordable MISS, preferring no warhead', () => {
    expect(choosePlan([cand({ outcome: 'MISS', warhead: true }), cand({ outcome: 'MISS' })])).toBe(1);
    expect(choosePlan([cand({ outcome: 'MISS', affordable: false }), cand({})])).toBe(-1);
  });
  it('stacks the plan that improves the margin most, or none', () => {
    expect(stackPlan([cand({ margin: -1.4 }), cand({ margin: -1.2 })], -1.5)).toBe(1);
    expect(stackPlan([cand({ margin: -1.48 })], -1.5)).toBe(-1);
  });
});

describe('autopilot walk', () => {
  it('explains, opens the planner, selects the miss plan and commits it', () => {
    const a = new Autopilot();
    const keys: string[] = [];
    const panes: string[] = [];
    let v = view();
    const run = (n: number, f?: () => void): void => {
      for (let i = 0; i < n; i++) {
        const out = a.step(v, 0.5);
        keys.push(...out.keys);
        if (out.pane) panes.push(out.pane.title);
        f?.();
      }
    };
    run(200, () => {
      if (keys.at(-1) === 'KeyP') v = { ...v, planner: { open: true, ready: true, sel: 0, cands: [cand({}), cand({ outcome: 'MISS', margin: 1.2 })] } };
      if (keys.at(-1) === 'ArrowDown') v = { ...v, planner: { ...v.planner, sel: 1 } };
      if (keys.at(-1) === 'Enter') v = { ...v, missions: 1 };
      if (keys.at(-1) === 'Escape') v = { ...v, planner: { ...v.planner, open: false } };
    });
    expect(panes[0]).toBe('AUTOPLAY');
    expect(panes).toContain('THE PORKCHOP PLOT');
    expect(keys.indexOf('KeyP')).toBeLessThan(keys.indexOf('ArrowDown'));
    expect(keys.indexOf('ArrowDown')).toBeLessThan(keys.indexOf('Enter'));
    expect(panes.some((p) => p.startsWith('PLAN 2'))).toBe(true);
    expect(keys).toContain('BracketRight');
  });
});

describe('AUTOPLAY investments', () => {
  it('chooseTech prefers launch and impactor nodes, then the cheapest; null when nothing is unlockable', async () => {
    const { chooseTech } = await import('../src/game/autoplay');
    expect(chooseTech([{ id: 'L2', name: 'L', track: 'LAUNCH', cost: 5, ok: true }, { id: 'I2', name: 'I', track: 'IMPACTOR', cost: 4, ok: true }, { id: 'T1', name: 'T', track: 'TRACKING', cost: 1, ok: true }])?.id).toBe('I2');
    expect(chooseTech([{ id: 'T1', name: 'T', track: 'TRACKING', cost: 1, ok: true }, { id: 'L2', name: 'L', track: 'LAUNCH', cost: 5, ok: false }])?.id).toBe('T1');
    expect(chooseTech([{ id: 'L2', name: 'L', track: 'LAUNCH', cost: 5, ok: false }])).toBeNull();
  });
  it('chooseProgram funds one at a time, in order, within the budget rules', async () => {
    const { chooseProgram } = await import('../src/game/autoplay');
    const { KNOBS } = await import('../src/config/knobs');
    const rows = [
      { id: 'INTL_COORDINATION', name: 'A', costPerYear: 1, funded: false, done: true },
      { id: 'GROUND_SURVEY_EXPANSION', name: 'B', costPerYear: 2, funded: false, done: false },
      { id: 'SPACE_IR_SURVEYOR', name: 'C', costPerYear: 3, funded: false, done: false },
    ];
    expect(chooseProgram(rows, 10, 6)?.id).toBe('GROUND_SURVEY_EXPANSION');
    expect(chooseProgram(rows, KNOBS.AUTO_PROGRAM_RESERVE - 1, 6)).toBeNull();
    expect(chooseProgram(rows.map((r) => (r.id === 'SPACE_IR_SURVEYOR' ? { ...r, funded: true } : r)), 10, 6)).toBeNull();
    expect(chooseProgram(rows, 10, 3)).toBeNull();
  });
});

describe('SUPER-DUPER-DEMO timing', () => {
  it('speed climbs from START to END over the chosen length', async () => {
    const { demoSpeed } = await import('../src/game/autoplay');
    const { KNOBS } = await import('../src/config/knobs');
    expect(demoSpeed(0, 300)).toBeCloseTo(KNOBS.DEMO_SPEED_START, 9);
    expect(demoSpeed(300, 300)).toBeCloseTo(KNOBS.DEMO_SPEED_END, 9);
    // Held at START for the first seconds, then climbing sooner than a plain exponential (owner 2026-10-20).
    expect(demoSpeed(KNOBS.DEMO_SPEED_HOLD_S, 300)).toBeCloseTo(KNOBS.DEMO_SPEED_START, 9);
    const mid = KNOBS.DEMO_SPEED_HOLD_S + (300 - KNOBS.DEMO_SPEED_HOLD_S) / 2;
    expect(demoSpeed(mid, 300)).toBeGreaterThan(KNOBS.DEMO_SPEED_START * Math.sqrt(KNOBS.DEMO_SPEED_END / KNOBS.DEMO_SPEED_START));
    expect(demoSpeed(mid, 300)).toBeLessThan(KNOBS.DEMO_SPEED_END);
    expect(demoSpeed(999, 300)).toBeCloseTo(KNOBS.DEMO_SPEED_END, 9);
  });
});
