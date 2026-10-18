import { describe, expect, it } from 'vitest';
import { KNOBS } from '../src/config/knobs';
import { Cinematics } from '../src/render/cinematics/index';
import { approachPos, bodyRadiusPx, buildScene, CINE_KINDS, groupEvents, launchArc, notch, outline, type CineContext } from '../src/render/cinematics/scene';
import type { Surface } from '../src/render/canvas';
import { DAY } from '../src/physics/constants';
import type { SimEventRecord } from '../src/sim/eventLog';
import type { ThreatTypeId } from '../src/sim/threat';

const shape = new Float64Array([1, 1.1, 0.9, 1.05, 0.95, 1, 1.08, 0.92]);
const ctx = (typeId: ThreatTypeId = 'STONY', betaHidden = false): CineContext => ({ name: 'T1', typeId, D: 140, shape, betaHidden, energyMt: 67 });
const t = 200 * DAY;
const EVENTS: Record<string, SimEventRecord> = {
  LAUNCH: { t, kind: 'LAUNCH', missionId: 'M-1', c3: 12, massKg: 1500, tier: 3 },
  IMPACT: { t, kind: 'IMPACT', missionId: 'M-1', U: 9800, beta: 2.4, dvAlong: 0.002, dvTotal: 0.0025, massKg: 1500, targetId: 'THREAT', qRatio: 0.3 },
  FRAGMENTATION: { t, kind: 'FRAGMENTATION', missionId: 'M-1', targetId: 'THREAT', qRatio: 1.8, count: 23, largestD: 61, vEj: 0.8, escaped: 0 },
  NUKE: { t, kind: 'NUKE', missionId: 'M-2', targetId: 'THREAT', mode: 'STANDOFF', yieldMt: 1, dv: 0.012, qRatio: 0.4, fuzed: true, pulses: 3 },
  PI: { t, kind: 'PI', missionId: 'M-3', targetId: 'THREAT', D: 60, damageMt: 0.4, ok: true, reason: '' },
  CLOSE_APPROACH: { t, kind: 'CLOSE_APPROACH', dMin: 2.1e7, bCrit: 8.4e6, marginRadii: 2.0, impact: false },
};

describe('cinematic scenes (GAME_PLAN 29)', () => {
  it('every cinematic kind builds a scene with the knob duration and some motion', () => {
    for (const kind of CINE_KINDS) {
      const sc = buildScene(EVENTS[kind]!, null, ctx());
      expect(sc, kind).not.toBeNull();
      expect(sc!.duration).toBe(KNOBS.CINEMATIC_SECONDS[kind]);
      expect(sc!.particles.length + sc!.shards.length + sc!.rings.length + (sc!.approach ? 1 : 0)).toBeGreaterThan(0);
      expect(sc!.title.length).toBeGreaterThan(0);
      expect(sc!.hitAt).toBeLessThan(sc!.duration);
    }
    expect(buildScene({ t, kind: 'NOTE', text: 'x' }, null, ctx())).toBeNull();
  });

  it('is deterministic in (event, context) and changes with the event time', () => {
    const a = buildScene(EVENTS.FRAGMENTATION!, EVENTS.IMPACT!, ctx('RUBBLE'));
    const b = buildScene(EVENTS.FRAGMENTATION!, EVENTS.IMPACT!, ctx('RUBBLE'));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const c = buildScene({ ...EVENTS.FRAGMENTATION!, t: t + DAY } as SimEventRecord, EVENTS.IMPACT!, ctx('RUBBLE'));
    expect(c!.seed).not.toBe(a!.seed);
    expect(JSON.stringify(c!.particles)).not.toBe(JSON.stringify(a!.particles));
  });

  it('breakup style follows the body type', () => {
    const rubble = buildScene(EVENTS.FRAGMENTATION!, null, ctx('RUBBLE'))!;
    const stony = buildScene(EVENTS.FRAGMENTATION!, null, ctx('STONY'))!;
    const iron = buildScene(EVENTS.FRAGMENTATION!, null, ctx('IRON'))!;
    const icy = buildScene(EVENTS.FRAGMENTATION!, null, ctx('ICY'))!;
    expect(rubble.shards.length).toBeGreaterThan(stony.shards.length);
    expect(stony.cracks.length).toBeGreaterThan(0);
    expect(iron.rings.filter((r) => r.dash).length).toBe(3);
    expect(iron.bodyAfter).not.toBeNull();
    expect(rubble.bodyAfter).toBeNull();
    expect(icy.particles.length).toBeGreaterThan(rubble.particles.length);
    expect(rubble.title).toContain('CRUMBLES');
    expect(icy.title).toContain('PUFFS');
  });

  it('hidden beta does not leak into the ejecta count', () => {
    const shown = buildScene(EVENTS.IMPACT!, null, ctx('STONY', false))!;
    const hidden = buildScene(EVENTS.IMPACT!, null, ctx('STONY', true))!;
    const big = buildScene({ ...EVENTS.IMPACT!, beta: 4 } as SimEventRecord, null, ctx('STONY', true))!;
    expect(shown.particles.length).toBeGreaterThan(hidden.particles.length);
    expect(big.particles.length).toBe(hidden.particles.length);
    expect(hidden.subtitle).toContain('BETA ?');
  });

  it('groups an impact and the breakup it caused into one scene', () => {
    const g = groupEvents([EVENTS.IMPACT!, EVENTS.FRAGMENTATION!, EVENTS.LAUNCH!, { t, kind: 'NOTE', text: 'x' }]);
    expect(g.length).toBe(2);
    expect(g[0]!.main.kind).toBe('FRAGMENTATION');
    expect(g[0]!.companion?.kind).toBe('IMPACT');
    expect(g[1]!.main.kind).toBe('LAUNCH');
    const sc = buildScene(g[0]!.main, g[0]!.companion, ctx())!;
    expect(sc.streak).not.toBeNull();
  });

  it('geometry helpers: outline, notch, launch arc, approach path', () => {
    const o = outline(shape);
    expect(o.length).toBe(16);
    const n = notch(o, Math.PI, 0.5, 0.3);
    // The vertex facing the hit (angle pi, index 4) moves inward; the opposite one (index 0) does not.
    expect(Math.hypot(n[8]!, n[9]!)).toBeLessThan(Math.hypot(o[8]!, o[9]!));
    expect(n[0]).toBe(o[0]);
    const [x0, y0] = launchArc(0, 2);
    const [x1, y1] = launchArc(1, 2);
    expect(x0).toBeCloseTo(0, 9);
    expect(y0).toBeCloseTo(0, 9);
    expect(x1).toBeGreaterThan(100);
    expect(y1).toBeLessThan(-100);
    expect(bodyRadiusPx(10)).toBeCloseTo(60, 5);
    expect(bodyRadiusPx(1000)).toBeCloseTo(120, 5);
    const miss = buildScene(EVENTS.CLOSE_APPROACH!, null, ctx())!;
    const [mx, my] = approachPos(miss.approach!, 1.8);
    expect(Math.hypot(mx, my)).toBeCloseTo(miss.approach!.d, 6);
    expect(miss.approach!.d).toBeGreaterThan(miss.approach!.ringR);
    const hit = buildScene({ ...EVENTS.CLOSE_APPROACH!, dMin: 4e6, impact: true, marginRadii: -0.7 } as SimEventRecord, null, ctx())!;
    expect(hit.hitAt).toBeGreaterThan(0);
    expect(hit.hitAt).toBeLessThan(hit.duration);
    const [hx, hy] = approachPos(hit.approach!, hit.hitAt);
    expect(Math.hypot(hx, hy)).toBeCloseTo(hit.approach!.homeR, 3);
  });

  it('the player queues scenes, skips on a key, and fires the hit once per scene', () => {
    const hits: string[] = [];
    const cine = new Cinematics({} as Surface, () => false);
    cine.onHit = (sc) => hits.push(sc.kind);
    expect(cine.enqueue([EVENTS.IMPACT!, EVENTS.FRAGMENTATION!, EVENTS.LAUNCH!], ctx())).toBe(2);
    expect(cine.isOpen).toBe(true);
    expect(cine.current?.kind).toBe('FRAGMENTATION');
    cine.update(100, false);
    expect(hits).toEqual([]);
    cine.update(1000, false);
    expect(hits).toEqual(['FRAGMENTATION']);
    cine.update(100, true);
    expect(cine.current?.kind).toBe('LAUNCH');
    expect(hits).toEqual(['FRAGMENTATION', 'LAUNCH']);
    cine.update(5000, false);
    expect(cine.isOpen).toBe(false);
    expect(hits.length).toBe(2);
    const reduced = new Cinematics({} as Surface, () => true);
    reduced.enqueue([EVENTS.IMPACT!], ctx());
    reduced.update(KNOBS.CINEMATIC_FLASH_S * 1000 + 1, false);
    expect(reduced.isOpen).toBe(false);
  });
});
