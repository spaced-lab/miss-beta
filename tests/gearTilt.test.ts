import { describe, expect, it } from 'vitest';
import { menuLayout, type BarItem } from '../src/ui/actionBar';
import { GearMenu, gearPoints, onGearTab, type GearSpec } from '../src/ui/gearMenu';
import { screenRoll, tiltAmount, tiltReadout } from '../src/minigame/tilt';
import { createState, NO_INPUT, start, step } from '../src/minigame/sim';
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

  it('turns nothing inside the dead zone, then rises to a full turn at the chosen range', () => {
    const full = 24;
    const mid = (MG.TILT_DEAD_DEG + full) / 2;
    expect(tiltAmount(MG.TILT_DEAD_DEG - 1, 0, false, full)).toBe(0);
    expect(tiltAmount(mid, 0, false, full)).toBeCloseTo(0.5, 9);
    expect(tiltAmount(-90, 0, false, full)).toBe(-1);
    expect(tiltAmount(mid, 0, true, full)).toBeCloseTo(-0.5, 9);
    expect(tiltAmount(mid + 10, 10, false, full)).toBeCloseTo(0.5, 9);
    // A shorter range reaches the full turn sooner: 12 degrees is a full turn at 12, half at 24.
    expect(tiltAmount(12, 0, false, 12)).toBe(1);
    expect(tiltAmount(12, 0, false, 24)).toBeCloseTo((12 - MG.TILT_DEAD_DEG) / (24 - MG.TILT_DEAD_DEG), 9);
    for (const r of MG.TILT_RANGES_DEG) expect(r).toBeGreaterThan(MG.TILT_DEAD_DEG);
    expect(MG.TILT_RANGES_DEG[MG.TILT_RANGE_DEFAULT]).toBeDefined();
  });

  it('the readout quotes the roll, the turn and how the phone is held', () => {
    expect(tiltReadout(14.2, 0, 0.42, 24, 90)).toBe('TILT +14  R 0.42  /24  SIDE');
    expect(tiltReadout(-3, 5, -0.5, 18, 0)).toBe('TILT -8  L 0.50  /18  UP');
    expect(tiltReadout(2, 0, 0, 24, 0)).toBe('TILT +2  - 0.00  /24  UP');
  });
});

describe('analog turn in the sim (Input.turn)', () => {
  it('a half turn moves the launcher half as far as a held key, and a keyboard-only step is unchanged', () => {
    const a = createState(7);
    const b = createState(7);
    const c = createState(7);
    start(a); start(b); start(c);
    const a0 = a.launcherAngle;
    for (let i = 0; i < 10; i++) {
      step(a, { ...NO_INPUT, right: true }, MG.DT);
      step(b, { ...NO_INPUT, turn: 0.5 }, MG.DT);
      step(c, { ...NO_INPUT, right: true, turn: 0 }, MG.DT);
    }
    expect(a0 - a.launcherAngle).toBeCloseTo(10 * MG.LAUNCHER_SPEED * MG.DT, 9);
    expect(a0 - b.launcherAngle).toBeCloseTo(5 * MG.LAUNCHER_SPEED * MG.DT, 9);
    expect(c.launcherAngle).toBe(a.launcherAngle);
    // A negative turn goes left, and the amount is clamped to a full rate.
    const d = createState(7);
    start(d);
    const d0 = d.launcherAngle;
    step(d, { ...NO_INPUT, turn: -3 }, MG.DT);
    expect(d.launcherAngle - d0).toBeCloseTo(MG.LAUNCHER_SPEED * MG.DT, 9);
  });
});
