import { describe, expect, it } from 'vitest';
import { createEconomy } from '../src/game/economy';
import { YEAR } from '../src/physics/constants';
import { advancePrograms, applyEffects, createPrograms, defaultEffects, programBurn, programById, PROGRAMS } from '../src/sim/programs';

function ctx() {
  return { economy: createEconomy(10, 6), effects: defaultEffects(), networks: { active: ['RUBIN'], since: {} as Record<string, number> } };
}

describe('programs (GAME_PLAN 19)', () => {
  it('PROGRAMS: funding 1.0 for `years` years gives progress 1 within 1e-9; funding 0.5 gives 0.5', () => {
    const def = programById('SPACE_IR_SURVEYOR');
    const states = createPrograms();
    const st = states.find((s) => s.id === def.id)!;
    const c = ctx();
    st.funding = 1;
    const steps = 400;
    for (let i = 0; i < steps; i++) advancePrograms(states, c, (i * def.years * YEAR) / steps, (def.years * YEAR) / steps);
    expect(Math.abs(st.progress - 1)).toBeLessThan(1e-9);
    expect(st.completedAt).not.toBeNull();
    const half = createPrograms();
    const h = half.find((s) => s.id === def.id)!;
    const c2 = ctx();
    h.funding = 0.5;
    for (let i = 0; i < steps; i++) advancePrograms(half, c2, 0, (def.years * YEAR) / steps);
    expect(h.progress).toBeCloseTo(0.5, 9);
    expect(h.completedAt).toBeNull();
  });

  it('drains the budget at costPerYear x funding and burns only while active', () => {
    const states = createPrograms();
    const st = states.find((s) => s.id === 'RADAR_NET')!;
    const c = ctx();
    st.funding = 1;
    expect(programBurn(states)).toBe(2);
    advancePrograms(states, c, 0, YEAR);
    expect(c.economy.spent).toBeCloseTo(2, 9);
    for (let i = 0; i < 3; i++) advancePrograms(states, c, i * YEAR, YEAR);
    expect(st.completedAt).not.toBeNull();
    expect(programBurn(states)).toBe(0);
    expect(c.economy.spent).toBeCloseTo(6, 6); // 3 years x 2, not more after completion
  });

  it('applies effects on completion: networks activate with the completion year, budget rises', () => {
    const c = ctx();
    applyEffects(programById('SUNWARD_SENTINEL'), c, 5 * YEAR);
    expect(c.networks.active).toContain('SUNWARD_SENTINEL');
    expect(c.networks.since['SUNWARD_SENTINEL']).toBeCloseTo(2031, 6);
    applyEffects(programById('INTL_COORDINATION'), c, 0);
    expect(c.economy.perYear).toBe(8);
    expect(c.effects.researchMult).toBeCloseTo(1.1, 9);
    applyEffects(programById('CIVIL_DEFENSE_READY'), c, 0);
    expect(c.effects.evacMinDays).toBe(2);
    applyEffects(programById('INTERCEPTOR_STOCKPILE'), c, 0);
    expect(c.effects.buildTimeYears).toBe(0.1);
    applyEffects(programById('ORBITAL_DEPOT'), c, 0);
    expect(c.effects.c3Bonus).toBe(15);
  });

  it('every program has a tag, positive years and cost, and known effect kinds', () => {
    expect(PROGRAMS.length).toBeGreaterThanOrEqual(15);
    for (const p of PROGRAMS) {
      expect(['REAL', 'PROPOSED', 'SPECULATIVE']).toContain(p.tag);
      expect(p.years).toBeGreaterThan(0);
      expect(p.costPerYear).toBeGreaterThan(0);
      expect(p.effects.length).toBeGreaterThan(0);
    }
    expect(() => programById('NOPE')).toThrow();
  });
});
