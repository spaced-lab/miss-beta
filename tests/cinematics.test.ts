import { describe, expect, it } from 'vitest';
import { KNOBS } from '../src/config/knobs';
import { Cinematics } from '../src/render/cinematics/index';
import { approachPos, bodyRadiusPx, buildScene, CINE_KINDS, groupEvents, launchArc, notch, outline, type CineContext } from '../src/render/cinematics/scene';
import type { Surface } from '../src/render/canvas';
import { DAY } from '../src/physics/constants';
import type { SimEventRecord } from '../src/sim/eventLog';
import type { ThreatTypeId } from '../src/sim/threat';
import { PALETTES, type ColorMode } from '../src/render/palettes';
import { falseRamp, falseStep, nozzles, rocketSprite, ROCKETS, SPENT_STAGE, towerSprite } from '../src/render/cinematics/pixel';
import { renderScene } from '../src/render/cinematics/draw';
import { mockSurface } from './helpers/mockSurface';

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
  PUSH: { t, kind: 'PUSH', missionId: 'NANOFORGE', targetId: 'THREAT', method: 'NANOFORGE', force: 36000, dv: 0.01, duration: 400 * DAY, viable: true, note: '' },
};

describe('cinematic scenes (GAME_PLAN 29)', () => {
  it('every cinematic kind builds a scene with the knob duration and some motion', () => {
    for (const kind of CINE_KINDS) {
      const sc = buildScene(EVENTS[kind]!, null, ctx());
      expect(sc, kind).not.toBeNull();
      expect(sc!.duration).toBe(KNOBS.CINEMATIC_SECONDS[kind]);
      expect(sc!.particles.length + sc!.shards.length + sc!.rings.length + (sc!.approach ? 1 : 0) + (sc!.push ? 1 : 0)).toBeGreaterThan(0);
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

describe('fragment clouds (playtest 2026-10-18)', () => {
  it('many close approaches in one frame are one scene led by the most dangerous body', () => {
    const cas = Array.from({ length: 32 }, (_, i) => ({ t, kind: 'CLOSE_APPROACH' as const, dMin: 2e7 + i * 1e6, bCrit: 8.4e6, marginRadii: 2 + i * 0.1, impact: i === 7, bodyId: `F${i}` }));
    const g = groupEvents(cas);
    expect(g.length).toBe(1);
    expect((g[0]!.main as { bodyId?: string }).bodyId).toBe('F7');
    const sc = buildScene(g[0]!.main, null, ctx(), g[0]!.crowd ?? [])!;
    expect(sc.crowd.length).toBe(31);
    expect(sc.title).toContain('32 BODIES');
    const cine = new Cinematics({} as Surface, () => false);
    expect(cine.enqueue(cas, ctx())).toBe(1);
  });
});

describe('push scenes', () => {
  it('every push method builds a scene; a non-viable push has none; each method plays once per round', () => {
    for (const method of ['NANOFORGE', 'THRUSTER_SWARM', 'SHEPHERD', 'FUSION_TUG', 'DE_STAR', 'GRAVITY_TRACTOR']) {
      const sc = buildScene({ ...EVENTS.PUSH!, method } as SimEventRecord, null, ctx());
      expect(sc?.push?.method, method).toBe(method === 'GRAVITY_TRACTOR' ? 'GENERIC' : method);
    }
    expect(buildScene({ ...EVENTS.PUSH!, viable: false } as SimEventRecord, null, ctx())).toBeNull();
    const cine = new Cinematics({} as Surface, () => false);
    expect(cine.enqueue([EVENTS.PUSH!], ctx())).toBe(1);
    expect(cine.enqueue([{ ...EVENTS.PUSH!, t: t + DAY } as SimEventRecord], ctx())).toBe(0);
    cine.clear();
    expect(cine.enqueue([EVENTS.PUSH!], ctx())).toBe(1);
  });
});

const HEX = /^#[0-9A-Fa-f]{6}$/;
const KEYS = new Set(['.', 'W', 'w', 'g', 'c', 'b', 'y', 'o', 'r', 'a', 'm', 'k', 'G']);

describe('launch pixel art (owner 2026-10-18: finer cells, false-colour thrust head)', () => {
  it('rocket, stage and tower sprites are rectangular, use known colour keys and are finer than before', () => {
    const oldRows: Record<number, number> = { 1: 11, 2: 14, 3: 15 };
    for (const tier of [1, 2, 3]) {
      const sp = rocketSprite(tier);
      expect(ROCKETS[tier]).toEqual(sp);
      expect(sp.length).toBeGreaterThanOrEqual(2 * (oldRows[tier] ?? 0) - 2);
      const w = sp[0]!.length;
      for (const row of sp) {
        expect(row.length).toBe(w);
        for (const ch of row) expect(KEYS.has(ch), `${tier}:${ch}`).toBe(true);
      }
      // Every nozzle sits on a drawn cell of the sprite.
      for (const [nx, ny] of nozzles(tier)) {
        const col = nx + (w - 1) / 2;
        const row = ny + (sp.length - 1) / 2;
        expect(sp[row]?.[col], `tier ${tier} nozzle ${nx},${ny}`).not.toBe('.');
      }
    }
    expect(nozzles(3).length).toBe(3);
    for (const sp of [SPENT_STAGE, towerSprite(30)]) for (const row of sp) expect(row.length).toBe(sp[0]!.length);
  });

  it('the false-colour ramp gives valid colours, hottest first, in every palette, NEON or mono', () => {
    for (const mode of Object.keys(PALETTES) as ColorMode[]) {
      for (const spectrum of [false, true]) {
        const ramp = falseRamp(PALETTES[mode], spectrum);
        expect(ramp.length).toBeGreaterThanOrEqual(3);
        for (const c of ramp) expect(c, `${mode} ${spectrum}`).toMatch(HEX);
        expect(falseStep(ramp, 1)).toBe(ramp[0]);
        expect(falseStep(ramp, 0)).toBe(ramp[ramp.length - 1]);
        expect(falseStep(ramp, 7)).toBe(ramp[0]);
        expect(falseStep(ramp, -3)).toBe(ramp[ramp.length - 1]);
        expect(falseStep(ramp, NaN)).toBe(ramp[ramp.length - 1]);
      }
    }
    // NEON gets the knob ramp; a mono mode stays in its own hue; DAYLIGHT (no glow) stays mono even with spectrum.
    expect(falseRamp(PALETTES.PHOSPHOR, true)).toEqual(KNOBS.CINE_FALSE_RAMP);
    expect(falseRamp(PALETTES.PHOSPHOR, false)[0]).toBe(PALETTES.PHOSPHOR.hot);
    expect(falseRamp(PALETTES.DAYLIGHT, true)[0]).toBe(PALETTES.DAYLIGHT.hot);
  });

  it('rendering a launch is a pure function of (scene, elapsed): same draw calls, scene untouched, valid colours', () => {
    for (const tier of [1, 2, 3]) {
      const sc = buildScene({ ...EVENTS.LAUNCH!, tier } as SimEventRecord, null, ctx())!;
      const before = JSON.stringify(sc);
      for (const spectrum of [true, false]) {
        const a = mockSurface(PALETTES.PHOSPHOR, spectrum);
        const b = mockSurface(PALETTES.PHOSPHOR, spectrum);
        for (const el of [0.1, 0.9, 1.7, 2.4]) {
          renderScene(a.s, sc, el, 'T-0', false);
          renderScene(b.s, sc, el, 'T-0', false);
        }
        expect(a.log.join('|')).toBe(b.log.join('|'));
        expect(a.dots).toBeGreaterThan(500);
        for (const c of a.colours) expect(c).toMatch(/^(#[0-9A-Fa-f]{6}|rgba\()/);
        if (spectrum) expect(a.colours.has(KNOBS.CINE_FALSE_RAMP[2]!)).toBe(true);
      }
      expect(JSON.stringify(sc)).toBe(before);
    }
  });

  it('impact and breakup bursts render deterministically with hot false-colour ejecta', () => {
    const sc = buildScene(EVENTS.FRAGMENTATION!, EVENTS.IMPACT!, ctx('RUBBLE'))!;
    const a = mockSurface(PALETTES.PHOSPHOR, true);
    const b = mockSurface(PALETTES.PHOSPHOR, true);
    for (const el of [sc.hitAt + 0.01, sc.hitAt + 0.5, sc.hitAt + 1.5]) {
      renderScene(a.s, sc, el, 'T-0', false);
      renderScene(b.s, sc, el, 'T-0', false);
    }
    expect(a.log.join('|')).toBe(b.log.join('|'));
    expect(a.colours.has(KNOBS.CINE_FALSE_RAMP[0]!)).toBe(true);
  });
});
