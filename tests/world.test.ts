import { describe, expect, it } from 'vitest';
import { KNOBS } from '../src/config/knobs';
import { AU, DAY, YEAR } from '../src/physics/constants';
import { period } from '../src/physics/kepler';
import { advance, createWorld, planetById, planetState, setWarp } from '../src/sim/world';
import { formatCountdown, formatElapsed } from '../src/ui/hud';

describe('world', () => {
  it('is seeded: same run seed and round give the same planets', () => {
    const a = createWorld('SEED-A', 3);
    const b = createWorld('SEED-A', 3);
    expect(a.planets.map((p) => p.elements)).toEqual(b.planets.map((p) => p.elements));
    const c = createWorld('SEED-A', 4);
    expect(c.planets[0]?.elements.M0).not.toBe(a.planets[0]?.elements.M0);
  });

  it('keeps the table ratios: HOME period near one year, GIANT near 11.9 years, within the variety knobs', () => {
    for (let i = 0; i < 20; i++) {
      const w = createWorld(`S${i}`, 1);
      const home = planetById(w, 'HOME');
      const giant = planetById(w, 'GIANT');
      const Th = period(w.star.mu, home.elements.a) / YEAR;
      // a scaled by up to ±10% and mu by ±5%: T ∝ a^1.5 / sqrt(mu) -> about ±18%.
      expect(Th).toBeGreaterThan(0.8);
      expect(Th).toBeLessThan(1.2);
      expect(period(w.star.mu, giant.elements.a) / period(w.star.mu, home.elements.a)).toBeCloseTo(5.203 ** 1.5, 2);
      expect(home.elements.a / AU).toBeGreaterThan(1 - KNOBS.SYSTEM_A_SCALE_SPREAD - 1e-9);
      expect(home.elements.a / AU).toBeLessThan(1 + KNOBS.SYSTEM_A_SCALE_SPREAD + 1e-9);
    }
  });

  it('planets return to their start after one period', () => {
    const w = createWorld('ORBITS', 1);
    for (const p of w.planets) {
      const T = period(w.star.mu, p.elements.a);
      const s0 = planetState(w, p, 0);
      const s1 = planetState(w, p, T);
      expect(Math.hypot(s1.r.x - s0.r.x, s1.r.y - s0.r.y) / p.elements.a).toBeLessThan(1e-9);
    }
  });

  it('advances the clock by the warp level and clamps warp', () => {
    const w = createWorld('CLOCK', 1);
    setWarp(w, 1);
    advance(w, 2);
    expect(w.t).toBe(2 * DAY);
    setWarp(w, 0);
    advance(w, 5);
    expect(w.t).toBe(2 * DAY);
    setWarp(w, 99);
    expect(w.warp).toBe(KNOBS.WARP_LEVELS.length - 1);
    setWarp(w, -5);
    expect(w.warp).toBe(0);
  });
});

describe('hud formatting', () => {
  it('formats elapsed and countdown', () => {
    expect(formatElapsed(0)).toBe('T+ 00Y 000D');
    expect(formatElapsed(2 * YEAR + 113 * DAY + 5)).toBe('T+ 02Y 113D');
    expect(formatCountdown(4 * YEAR + 112 * DAY)).toBe('T-04Y 112D');
    expect(formatCountdown(-DAY)).toBe('T+ 00Y 001D');
  });
});
