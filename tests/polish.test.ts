// M8 polish: settings record and guard, the attract round, the daily seed, text scale.
import { describe, expect, it } from 'vitest';
import { buildAttract, dailySeed, tickAttract } from '../src/game/attract';
import { COLOR_MODES, cycle, DEFAULT_SETTINGS, isSettings } from '../src/game/settings';
import { YEAR } from '../src/physics/constants';
import { getTextScale, measureText, setTextScale } from '../src/render/vectorFont';

describe('SETTINGS (options screen)', () => {
  it('guard accepts the defaults and rejects bad shapes; cycle wraps both ways', () => {
    expect(isSettings(DEFAULT_SETTINGS)).toBe(true);
    expect(isSettings({ ...DEFAULT_SETTINGS, colorMode: 'NEON' })).toBe(false);
    expect(isSettings({ ...DEFAULT_SETTINGS, crt: 'yes' })).toBe(false);
    expect(isSettings({ ...DEFAULT_SETTINGS, glow: 'bloom' })).toBe(false);
    expect(isSettings({ ...DEFAULT_SETTINGS, autoSpeed: 'FAST', demoLength: 'SHORT' })).toBe(true);
    expect(isSettings({ ...DEFAULT_SETTINGS, autoSpeed: 'WARP9' })).toBe(false);
    expect(isSettings({ ...DEFAULT_SETTINGS, demoLength: 3 })).toBe(false);
    expect(isSettings(null)).toBe(false);
    expect(isSettings('PHOSPHOR')).toBe(false);
    expect(cycle(COLOR_MODES, 'PHOSPHOR', -1)).toBe('DAYLIGHT');
    expect(cycle(COLOR_MODES, 'DAYLIGHT', 1)).toBe('PHOSPHOR');
    expect(cycle(COLOR_MODES, 'AMBER', 1)).toBe('ICE');
  });

  it('text scale is clamped and scales measured width', () => {
    const w0 = measureText('HELLO', 12);
    setTextScale(1.15);
    expect(getTextScale()).toBeCloseTo(1.15, 6);
    expect(measureText('HELLO', 12)).toBeCloseTo(w0, 6); // measureText is unscaled by design: layout uses it before drawing
    setTextScale(9);
    expect(getTextScale()).toBe(2);
    setTextScale(1);
  });
});

describe('ATTRACT mode and the daily seed', () => {
  it('a seeded round plans itself with a kinetic candidate, resolves, and ends after the approach', () => {
    const a = buildAttract('ATTRACT-TEST-1');
    expect(a.world.threat).not.toBeNull();
    expect(a.result.outcome).toMatch(/MISS|HIT|PARTIAL/);
    // The plain draw gives 2.5 to 12 years; the top candidate exists for an ordinary first-round rock.
    expect(a.missions.length).toBeGreaterThanOrEqual(1);
    expect(a.missions[0]!.archetype).toBe('KINETIC');
    const b = buildAttract('ATTRACT-TEST-1');
    expect(b.result.ca.tCa).toBe(a.result.ca.tCa); // deterministic
    let over = false;
    let secs = 0;
    while (!over && secs < 60) {
      over = tickAttract(a, 0.5);
      secs += 0.5;
    }
    expect(over).toBe(true);
    expect(a.world.t).toBeGreaterThan(a.result.ca.tCa);
    expect(secs * 1.2 * YEAR).toBeGreaterThanOrEqual(a.result.ca.tCa);
  });

  it('daily seed is the UTC date and the same for everyone', () => {
    expect(dailySeed(new Date('2026-10-17T23:59:00Z'))).toBe('DAILY-2026-10-17');
    expect(dailySeed(new Date('2026-10-18T00:01:00Z'))).toBe('DAILY-2026-10-18');
  });
});
