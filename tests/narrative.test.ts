import { describe, expect, it } from 'vitest';
import { debriefNarrative, evacuateNarrative, eventNarrative, fill, fmtLead, lessonFor, parseLine, roundStartNarrative, type Narrative } from '../src/game/narrative';
import { DAY, YEAR } from '../src/physics/constants';
import type { SimEventRecord } from '../src/sim/eventLog';
import { resolveRound } from '../src/sim/resolver';
import { roundRng } from '../src/sim/rng';
import { generateThreat } from '../src/sim/roundGen';
import type { Threat, ThreatTypeId } from '../src/sim/threat';
import { createWorld } from '../src/sim/world';

const TYPES: ThreatTypeId[] = ['RUBBLE', 'STONY', 'IRON', 'ICY'];

function clean(n: Narrative | null): string {
  expect(n).not.toBeNull();
  const text = JSON.stringify(n);
  expect(text).not.toContain('undefined');
  expect(text).not.toContain('NaN');
  expect(text).not.toMatch(/\{[a-zA-Z0-9_]+\}/);
  expect(n!.header.text.length).toBeGreaterThan(0);
  expect(n!.lines.length).toBeGreaterThan(0);
  return text;
}

function sampleEvents(): SimEventRecord[] {
  const t = 100 * DAY;
  return [
    { t, kind: 'LAUNCH', missionId: 'M-1', c3: 12.3, massKg: 1500, tier: 2 },
    { t, kind: 'IMPACT', missionId: 'M-1', U: 9800, beta: 2.4, dvAlong: 0.0021, dvTotal: 0.0025, massKg: 1500, targetId: 'THREAT', qRatio: 0.3, betaKnownAt: t + 30 * DAY },
    { t, kind: 'IMPACT', missionId: 'M-2', U: 9800, beta: 2.4, dvAlong: 0.0021, dvTotal: 0.0025, massKg: 1500 },
    { t, kind: 'IMPACT_MISS', missionId: 'M-3', offset: 7.2e7 },
    { t, kind: 'IMPACT_MISS', missionId: 'M-3', offset: 0, reason: 'target disrupted' },
    { t, kind: 'RETARGET', missionId: 'M-4', targetId: 'F2', dv: 210, remaining: 790 },
    { t, kind: 'SPLIT', missionId: 'M-5', count: 3, targets: ['F1', 'F2', 'F2'] },
    { t, kind: 'BETA_ASSESSED', missionId: 'M-1', beta: 2.4, marginRadii: 1.7 },
    { t, kind: 'PI', missionId: 'M-6', targetId: 'THREAT', D: 60, damageMt: 0.41, ok: true, reason: '' },
    { t, kind: 'PI', missionId: 'M-6', targetId: 'THREAT', D: 160, damageMt: 0, ok: false, reason: 'body too large for PI' },
    { t, kind: 'PUSH', missionId: 'M-7', targetId: 'THREAT', method: 'GRAVITY_TRACTOR', force: 0.02, dv: 0.0004, duration: 400 * DAY, viable: true, note: '' },
    { t, kind: 'PUSH', missionId: 'M-7', targetId: 'THREAT', method: 'YARKOVSKY', force: 0, dv: 0, duration: 0, viable: false, note: 'drift of 300 m in 10 years' },
    { t, kind: 'NUKE', missionId: 'M-8', targetId: 'THREAT', mode: 'STANDOFF', yieldMt: 1, dv: 0.012, qRatio: 0.4, fuzed: true, pulses: 1 },
    { t, kind: 'NUKE', missionId: 'M-8', targetId: 'THREAT', mode: 'PULSE_TRAIN', yieldMt: 0.3, dv: 0.02, qRatio: 1.2, fuzed: true, pulses: 4 },
    { t, kind: 'NUKE', missionId: 'M-8', targetId: 'THREAT', mode: 'SURFACE', yieldMt: 1, dv: 0, qRatio: 0, fuzed: false, pulses: 1 },
    { t, kind: 'FRAGMENTATION', missionId: 'M-1', targetId: 'THREAT', qRatio: 1.8, count: 23, largestD: 61, vEj: 0.8, escaped: 0 },
    { t, kind: 'FRAGMENTATION', missionId: 'M-1', targetId: 'THREAT', qRatio: 3.1, count: 40, largestD: 30, vEj: 2.1, escaped: 2 },
    { t, kind: 'CLOSE_APPROACH', dMin: 2.1e7, bCrit: 8.4e6, marginRadii: 2.0, impact: false },
    { t, kind: 'CLOSE_APPROACH', dMin: 4.0e6, bCrit: 8.4e6, marginRadii: -0.7, impact: true, bodyId: 'F1' },
    { t, kind: 'ROUND_START', name: 'X', lead: YEAR },
    { t, kind: 'NOTE', text: 'hello' },
  ];
}

describe('narratives (GAME_PLAN 29)', () => {
  const world = createWorld('NARR', 1);
  const th = generateThreat(roundRng('NARR', 1), world, 1);
  world.threat = th;
  const res = resolveRound(world, [], {});

  it('fill replaces slots and refuses a missing one', () => {
    expect(fill('A {x} B {y}', { x: 1, y: 'two' })).toBe('A 1 B two');
    expect(() => fill('A {x}', {})).toThrow(/slot/);
    expect(() => fill('A {x}', { x: NaN })).toThrow(/slot/);
    expect(parseLine('@threat HELLO')).toEqual({ text: 'HELLO', role: 'threat' });
    expect(parseLine('@bogus HELLO').role).toBe('text');
    expect(fmtLead(2.5 * YEAR)).toBe('2.5 Y');
    expect(fmtLead(26 * DAY)).toBe('26 D');
    expect(fmtLead(3600 * 11)).toBe('11 H');
  });

  it('round start covers discovered, no-warning and assumed rounds for every body type', () => {
    for (const id of TYPES) {
      const typed: Threat = { ...th, type: { ...th.type, id } };
      clean(roundStartNarrative(typed, res, world, false));
      clean(roundStartNarrative({ ...typed, discoveredBy: null, noWarning: true, tImpact: 3 * DAY } as Threat, res, world, false));
      clean(roundStartNarrative({ ...typed, discoveredBy: 'ASSUMED', flavor: 'INTERSTELLAR' } as Threat, res, world, true));
      clean(roundStartNarrative({ ...typed, discoveredBy: 'ASSUMED' } as Threat, res, world, true));
    }
    const text = clean(roundStartNarrative(th, res, world, false));
    if (th.discoveredBy && th.discoveredBy !== 'ASSUMED') expect(text).toContain('SPOTTED BY');
  });

  it('every event kind and body type templates without undefined; kinds without a brief return null', () => {
    for (const id of TYPES) {
      const typed: Threat = { ...th, type: { ...th.type, id } };
      for (const e of sampleEvents()) {
        const n = eventNarrative(e, { threat: typed, now: e.t });
        if (e.kind === 'ROUND_START' || e.kind === 'NOTE') expect(n).toBeNull();
        else clean(n);
        if (e.kind !== 'ROUND_START' && e.kind !== 'NOTE') clean(eventNarrative(e, { threat: typed }));
      }
    }
    const hidden = eventNarrative(sampleEvents()[1]!, { threat: th, now: 100 * DAY });
    expect(JSON.stringify(hidden)).toContain('UNKNOWN');
    const shown = eventNarrative(sampleEvents()[1]!, { threat: th });
    expect(JSON.stringify(shown)).toContain('BETA 2.40');
    const frag = eventNarrative(sampleEvents()[15]!, { threat: { ...th, type: { ...th.type, id: 'IRON' } } });
    expect(frag!.header.text).toContain('RINGS AND SHEDS');
    expect(frag!.header.role).toBe('fragment');
  });

  it('debrief, evacuation and lesson lines', () => {
    for (const outcome of ['MISS', 'PARTIAL', 'HIT'] as const) {
      clean(debriefNarrative({ round: 2, outcome, marginRadii: 1.2, throughMt: 3.4, energyMt: 67, category: 'CITY', plan: 'KINETIC', nEvents: 5, score: 310, research: 6, lesson: lessonFor(th, false) }));
    }
    clean(evacuateNarrative(20 * DAY, 7));
    expect(lessonFor({ ...th, tImpact: 20 * DAY } as Threat, false)).toContain('SUNWARD SENTINEL');
    expect(lessonFor({ ...th, tImpact: 20 * DAY } as Threat, true)).toContain('MORE LEAD');
    expect(lessonFor({ ...th, tImpact: 5 * YEAR } as Threat, false)).toBe('');
  });
});
