import { describe, expect, it } from 'vitest';
import { backgroundFrequency, palermo, torino, torinoBand } from '../src/physics/risk';
import { massRatioFor, rocketDv, stagedDv } from '../src/physics/rocket';
import { gravityTractorForce, laserForce, pushForce } from '../src/physics/slowPush';
import { G } from '../src/physics/constants';
import vectors from './vectors/risk.json';

describe('risk scales (EDUCATION F9)', () => {
  it('matches the hand-checked examples', () => {
    expect(backgroundFrequency(8)).toBeCloseTo(5.684e-3, 6);
    expect(palermo(0.03, 8, 7)).toBeCloseTo(-0.1226, 3);
    expect(torino(0.03, 8)).toBe(3);
    expect(torino(0.027, 500)).toBe(4);
    expect(torino(1.7e-3, 9)).toBe(1);
    expect(torino(1e-9, 1e3)).toBe(0);
    expect(torino(0.5, 0.5)).toBe(0);
    expect(torino(1, 50)).toBe(8);
    expect(torino(1, 1e4)).toBe(9);
    expect(torino(1, 1e7)).toBe(10);
    expect(torino(0.5, 1e6)).toBe(7);
    expect([0, 1, 3, 6, 9].map(torinoBand)).toEqual(['WHITE', 'GREEN', 'YELLOW', 'ORANGE', 'RED']);
  });

  it('never decreases as the probability rises', () => {
    for (const E of [2, 50, 3e3, 1e6]) {
      let last = 0;
      for (let k = 0; k <= 80; k++) {
        const lvl = torino(10 ** (-8 + k / 10), E);
        expect(lvl).toBeGreaterThanOrEqual(last);
        last = lvl;
      }
    }
  });

  it('reproduces the Python vectors', () => {
    const v = vectors as { risk: { P: number; E: number; T: number; torino: number; palermo: number }[]; rocket: { isp: number; f: number; n: number; dv: number; dv1: number; ratio: number }[] };
    for (const c of v.risk) {
      expect(torino(c.P, c.E)).toBe(c.torino);
      expect(palermo(c.P, c.E, c.T)).toBeCloseTo(c.palermo, 12);
    }
    for (const c of v.rocket) {
      expect(stagedDv(c.isp, c.f, c.n) / c.dv).toBeCloseTo(1, 12);
      expect(rocketDv(c.isp, 1 / (1 - c.f)) / c.dv1).toBeCloseTo(1, 12);
      expect(massRatioFor(c.dv, c.isp) / c.ratio).toBeCloseTo(1, 10);
    }
  });
});

describe('rocket equation (EDUCATION D8) and the slow-push helpers', () => {
  it('Tsiolkovsky examples', () => {
    expect(rocketDv(320, 5)).toBeCloseTo(5050.62, 1);
    expect(stagedDv(320, 0.8, 2)).toBeCloseTo(2 * rocketDv(320, 5), 9);
    expect(massRatioFor(rocketDv(320, 5), 320)).toBeCloseTo(5, 12);
  });
  it('gravityTractorForce and laserForce agree with pushForce', () => {
    const M = 1.41e9;
    expect(gravityTractorForce(1000, M, 50)).toBeCloseTo((G * 1000 * M) / 75 ** 2, 12);
    expect(gravityTractorForce(1000, M, 50, 3)).toBeCloseTo(gravityTractorForce(1000, M, 50) / 4, 12);
    expect(pushForce({ method: 'GRAVITY_TRACTOR', tier: 0 }, M, 50, 1.5e11).force).toBe(gravityTractorForce(1000, M, 50));
    expect(laserForce(1e6)).toBeCloseTo(30, 12);
    expect(pushForce({ method: 'LASER', tier: 2 }, M, 50, 1.5e11).force).toBeCloseTo(30, 12);
  });
});
