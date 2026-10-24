import { describe, expect, it } from 'vitest';
import { planPlayOut, playOutRate, playOutStage, sceneSeconds, type PlayOutKnobs } from '../src/game/playOut';

const K: PlayOutKnobs = { BUILD_S: 3, FLIGHT_S: 20, LAUNCH_SCENE_S: 1, HIT_SCENE_S: 2, COAST_S: 20, FINAL_S: 4, FINAL_DAYS: 30, END_SCENE_S: 3, RESULT_HOLD_S: 2, BRIEF_S: 4, MIN_SPAN_S: 2 };
const D = 86400;

describe('PLAY IT OUT schedule', () => {
  const one = [{ launchTime: 100 * D, arrivalTime: 400 * D }];
  const log = [
    { t: 100 * D, kind: 'LAUNCH', missionId: 'M-1' },
    { t: 400 * D, kind: 'IMPACT', missionId: 'M-1' },
    { t: 400 * D, kind: 'FRAGMENTATION', missionId: 'M-1' },
    { t: 800 * D, kind: 'CLOSE_APPROACH' },
  ];
  it('build, flight and coast get the knob seconds less the scenes that play inside them', () => {
    const p = planPlayOut(0, one, 800 * D, log, K);
    expect(p.spans.map((s) => s.stage)).toEqual(['BUILD', 'FLIGHT', 'COAST', 'FINAL']);
    expect(p.spans.map((s) => s.real)).toEqual([3, 17, 11, 4]);
    // Three briefs: the launch, the impact and the breakup each hold the clock for BRIEF_S.
    expect(p.briefs).toBe(3);
    expect(p.totalRealS).toBe(3 + 17 + 11 + 4 + 1 + 2 + 3 * 4 + 3 + 2);
    expect(playOutRate(p, 0)).toBeCloseTo((100 * D) / 3);
    expect(playOutRate(p, 200 * D)).toBeCloseTo((300 * D) / 17);
    expect(playOutRate(p, 500 * D)).toBeCloseTo((370 * D) / 11);
    expect(playOutRate(p, 790 * D)).toBeCloseTo((30 * D) / 4);
    expect(playOutRate(p, 800 * D)).toBe(0);
    expect(playOutStage(p, 50 * D)).toBe('BUILD');
    expect(playOutStage(p, 760 * D)).toBe('COAST');
    expect(playOutStage(p, 799 * D)).toBe('FINAL');
    expect(playOutStage(p, 800 * D)).toBe('RESULT');
  });
  it('a breakup caused by the impact is one scene, not two', () => {
    expect(sceneSeconds(log, 0, 500 * D, K)).toBe(3);
    expect(sceneSeconds([{ t: 10, kind: 'FRAGMENTATION', missionId: 'M-1' }], 0, 20, K)).toBe(2);
  });
  it('pressed mid-flight there is no build span; with nothing committed only the coast', () => {
    const p = planPlayOut(200 * D, one, 800 * D, log, K);
    expect(p.spans.map((s) => s.stage)).toEqual(['FLIGHT', 'COAST', 'FINAL']);
    expect(p.spans[0]?.from).toBe(200 * D);
    const q = planPlayOut(0, [], 800 * D, [log[3] as { t: number; kind: string }], K);
    expect(q.spans.map((s) => s.stage)).toEqual(['COAST', 'FINAL']);
    expect(q.briefs).toBe(0);
    expect(q.totalRealS).toBe(11 + 4 + 3 + 2);
  });
  it('a swarm of many scenes never squeezes the clock under the minimum', () => {
    const ms = Array.from({ length: 8 }, (_, i) => ({ launchTime: (100 + i) * D, arrivalTime: (400 + i) * D }));
    const ev = ms.flatMap((m, i) => [{ t: m.launchTime, kind: 'LAUNCH', missionId: `S${i}` }, { t: m.arrivalTime, kind: 'IMPACT', missionId: `S${i}` }]);
    const p = planPlayOut(0, ms, 800 * D, ev, K);
    expect(p.spans[1]?.real).toBe(K.MIN_SPAN_S);
    expect(p.totalRealS).toBe(3 + 2 + 24 + 11 + 4 + 16 * 4 + 3 + 2);
  });
  it('an arrival after the close approach is cut at it', () => {
    const p = planPlayOut(0, [{ launchTime: 100 * D, arrivalTime: 900 * D }], 800 * D, [], K);
    expect(p.spans.map((s) => s.stage)).toEqual(['BUILD', 'FLIGHT']);
    expect(p.spans[1]?.to).toBe(800 * D);
  });
});
