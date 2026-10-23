import { describe, expect, it } from 'vitest';
import { menuLayout, type BarItem } from '../src/ui/actionBar';
import { GearMenu, gearPoints, onGearTab, type GearSpec } from '../src/ui/gearMenu';
import { screenRoll, tiltAmount, tiltPwm } from '../src/minigame/tilt';
import { MG } from '../src/minigame/config';
import type { Input } from '../src/ui/input';

const items = (n: number): BarItem[] => Array.from({ length: n }, (_, i) => ({ label: `B${i}`, code: `Key${String.fromCharCode(65 + i)}` }));

/** Just enough of Input for the gear menu: one pending click, the injected codes, Esc. */
function stubKeys(click: { x: number; y: number } | null, esc = false): Input & { injected: string[] } {
  let c = click;
  const injected: string[] = [];
  let escape = esc;
  return {
    injected,
    peekClick: () => c,
    takeClick: () => { const v = c; c = null; return v; },
    inject: (code: string) => { injected.push(code); },
    pressed: (code: string) => code === 'Escape' && escape,
    drop: () => { escape = false; },
  } as unknown as Input & { injected: string[] };
}

describe('gear menu', () => {
  it('keeps any menu grid inside the window, even 24 items on a phone held sideways', () => {
    for (const [W, H] of [[390, 740], [780, 360], [667, 375], [1440, 900]] as const) {
      for (const n of [6, 12, 24]) {
        const boxes = menuLayout(W, H, items(n), true);
        for (const b of boxes) {
          expect(b.x).toBeGreaterThanOrEqual(0);
          expect(b.x + b.w).toBeLessThanOrEqual(W + 1e-9);
          expect(b.y + b.h).toBeLessThanOrEqual(H + 1e-9);
          expect(b.h).toBeGreaterThanOrEqual(28);
        }
      }
    }
  });

  it('has its tab in the top-right corner, a finger wide', () => {
    expect(onGearTab(380, 10, 390)).toBe(true);
    expect(onGearTab(350, 38, 390)).toBe(true);
    expect(onGearTab(300, 10, 390)).toBe(false);
    expect(onGearTab(380, 60, 390)).toBe(false);
    expect(gearPoints(0, 0, 8, 8)).toHaveLength(64);
  });

  it('opens on the tab, holds the screen while open, presses a tapped item and closes', () => {
    const spec: GearSpec = { title: 'T', items: items(4) };
    const g = new GearMenu();
    expect(g.update(stubKeys({ x: 380, y: 10 }), spec, 390)).toBe(true);
    expect(g.open).toBe(true);
    expect(g.update(stubKeys(null), spec, 390)).toBe(true);
    g.boxes = menuLayout(390, 740, [...spec.items, { label: 'CLOSE MENU', code: 'GEAR_CLOSE' }], true);
    const b = g.boxes[2];
    if (!b) throw new Error('no box');
    const keys = stubKeys({ x: b.x + 2, y: b.y + 2 });
    expect(g.update(keys, spec, 390)).toBe(false);
    expect(keys.injected).toEqual(['KeyC']);
    expect(g.open).toBe(false);
  });

  it('stays open for a stepping item, runs act items directly, and Esc closes without reaching the screen', () => {
    let ran = 0;
    const spec: GearSpec = { title: 'T', items: [{ label: 'STEP', code: 'ArrowUp', stay: true }, { label: 'ACT', code: '', act: () => ran++ }] };
    const g = new GearMenu();
    g.open = true;
    g.boxes = menuLayout(390, 740, spec.items, true);
    const [s0, s1] = g.boxes;
    if (!s0 || !s1) throw new Error('no boxes');
    const k1 = stubKeys({ x: s0.x + 1, y: s0.y + 1 });
    g.update(k1, spec, 390);
    expect(k1.injected).toEqual(['ArrowUp']);
    expect(g.open).toBe(true);
    const k2 = stubKeys({ x: s1.x + 1, y: s1.y + 1 });
    expect(g.update(k2, spec, 390)).toBe(true);
    expect(ran).toBe(1);
    expect(k2.injected).toEqual([]);
    g.open = true;
    expect(g.update(stubKeys(null, true), spec, 390)).toBe(true);
    expect(g.open).toBe(false);
  });

  it('has no tab and holds nothing for a screen without a gear', () => {
    const g = new GearMenu();
    g.open = true;
    expect(g.update(stubKeys({ x: 380, y: 10 }), null, 390)).toBe(false);
    expect(g.open).toBe(false);
  });
});

describe('tilt steer', () => {
  it('reads the roll about the screen for each way the phone is held', () => {
    expect(screenRoll(0, 20, 0)).toBe(20);
    expect(screenRoll(20, 0, 90)).toBe(20);
    expect(screenRoll(20, 0, 270)).toBe(-20);
    expect(screenRoll(20, 0, -90)).toBe(-20);
    expect(screenRoll(0, 20, 180)).toBe(-20);
  });

  it('turns nothing inside the dead zone, then rises to a full turn', () => {
    const mid = (MG.TILT_DEAD_DEG + MG.TILT_FULL_DEG) / 2;
    expect(tiltAmount(MG.TILT_DEAD_DEG - 1, 0, false)).toBe(0);
    expect(tiltAmount(mid, 0, false)).toBeCloseTo(0.5, 9);
    expect(tiltAmount(-90, 0, false)).toBe(-1);
    expect(tiltAmount(mid, 0, true)).toBeCloseTo(-0.5, 9);
    expect(tiltAmount(mid + 10, 10, false)).toBeCloseTo(0.5, 9);
  });

  it('spreads a part turn over frames', () => {
    let acc = 0;
    let on = 0;
    for (let i = 0; i < 100; i++) {
      const r = tiltPwm(acc, 0.4);
      acc = r.acc;
      if (r.on) on++;
    }
    expect(on).toBe(40);
    expect(tiltPwm(0.7, 0)).toEqual({ on: false, acc: 0 });
    expect(tiltPwm(0, -1).on).toBe(true);
  });
});
