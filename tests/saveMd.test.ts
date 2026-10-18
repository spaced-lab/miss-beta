import { describe, expect, it } from 'vitest';
import { parseFrontMatter, parseSave, writeSave, type SaveFile } from '../src/game/saveMd';

const sample: SaveFile = {
  version: 1,
  seed: '8F3A21C9',
  started: '2026-10-17',
  round: 4,
  mode: 'REALISTIC',
  highest_mode: 'REALISTIC',
  civ_level: 0,
  cheats_used: [],
  budget: 14.5,
  budget_per_year: 8,
  research: 37,
  tech: ['L2', 'I2', 'SL1', 'N1', 'T1', 'A1'],
  programs: [
    { id: 'RADAR_NET', progress: 1.0, funding: 0 },
    { id: 'SPACE_IR_SURVEYOR', progress: 0.62, funding: 1.0 },
  ],
  networks_active: ['CATALINA', 'PANSTARRS', 'ATLAS', 'ZTF', 'RUBIN', 'FLYEYE1', 'GOLDSTONE', 'RADAR_NET'],
  run_score: 1180,
  rounds_survived: 3,
  current_threat: { name: '2041 KX-7', type: 'STONY', D_m: 310, t_impact_years: 6.1, p_impact: 0.97 },
  learning_level: 'INTERMEDIATE',
  lore_read: { T1: 'ADVANCED', D3: 'INTERMEDIATE', O6: 'BEGINNER' },
  color_mode: 'SPECTRUM',
};

describe('SAVE.md', () => {
  it('SAVE_MD: write -> parse -> deep-equal', () => {
    const text = writeSave(sample, [{ round: 1, threat: '2039 AB', type: 'STONY', D: 95, lead: 9.8, by: 'CATALINA', plan: 'KINETIC', outcome: 'MISS 4.1 R', score: 310 }]);
    expect(text.startsWith('---\nversion: 1\n')).toBe(true);
    expect(text).toContain('| 1 | 2039 AB | STONY | 95 | 9.8 | CATALINA | KINETIC | MISS 4.1 R | 310 |');
    const back = parseSave(text);
    expect(back).toEqual(sample);
  });

  it('a hand-edited front matter field survives a round trip; tables are regenerated', () => {
    const text = writeSave(sample).replace('research: 37', 'research: 99').replace('| RADAR_NET | 100% | done |', '| RADAR_NET | 50% | ??? |');
    const back = parseSave(text);
    expect(back?.research).toBe(99);
    expect(back?.programs[0]?.progress).toBe(1);
    expect(writeSave(back!)).toContain('| RADAR_NET | 100% | done |');
  });

  it('rejects malformed, oversized and mistyped input instead of throwing', () => {
    expect(parseSave('')).toBeNull();
    expect(parseSave('---\nversion: 2\n---\n')).toBeNull();
    expect(parseSave('---\nversion: 1\nseed: 1\n')).toBeNull(); // unterminated
    expect(parseSave(writeSave(sample).replace('round: 4', 'round: four'))).toBeNull();
    expect(parseSave(writeSave(sample).replace("mode: REALISTIC", "mode: FANTASY"))).toBeNull();
    expect(parseSave('---\n' + 'x: 1\n'.repeat(100000) + '---\n')).toBeNull();
    expect(() => parseFrontMatter('no front matter')).toThrow();
  });

  it('parses the small YAML subset: quoted strings with commas, empty lists, null threat', () => {
    const s: SaveFile = { ...sample, cheats_used: [], current_threat: null, tech: [], lore_read: {}, seed: 'A,B' };
    const text = writeSave(s);
    expect(text).toContain('seed: "A,B"');
    const back = parseSave(text);
    expect(back?.seed).toBe('A,B');
    expect(back?.current_threat).toBeNull();
    expect(back?.tech).toEqual([]);
    expect(back?.cheats_used).toEqual([]);
  });
});

describe('cheat-scale numbers (code review 2026-10-18)', () => {
  it('a SANDBOX run after three KARDASHEV2 and a KARDASHEV1 still saves and loads, budget clamped', async () => {
    const { createRun } = await import('../src/game/run');
    const { createEconomy } = await import('../src/game/economy');
    const { renderSave } = await import('../src/game/savegame');
    const { SAVE_MAX_ABS } = await import('../src/game/saveMd');
    const run = createRun('SANDBOX-1');
    // SANDBOX starts at createEconomy(1e6, 1e4); KARDASHEV2 multiplies both by 1000, KARDASHEV1 by 10.
    run.economy = createEconomy(1e6 * 1000 ** 3 * 10, 1e4 * 1000 ** 3 * 10);
    const sf = parseSave(renderSave(run, null));
    expect(sf).not.toBeNull();
    expect(sf?.budget).toBe(SAVE_MAX_ABS);
    expect(sf?.budget_per_year).toBe(1e14);
  });
});
