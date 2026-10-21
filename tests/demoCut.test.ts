import { describe, expect, it } from 'vitest';
import { KNOBS } from '../src/config/knobs';
import { hitsBy } from '../src/render/demoScenes';
import { DemoCutaways } from '../src/render/views/demoCut';
import { stormHits, stormRate } from '../src/render/pixelDust';

/** Run the cutaways for `seconds` at 60 fps and collect each cut's on-screen length and the gaps between them. */
function run(seconds: number, f: (t: number) => number, reduce = false): { lens: number[]; gaps: number[] } {
  const c = new DemoCutaways(null, () => reduce);
  const dt = 1 / 60;
  const lens: number[] = [];
  const gaps: number[] = [];
  let on = false;
  let since = 0;
  for (let t = 0; t < seconds; t += dt) {
    c.update(dt, f(t), false);
    since += dt;
    if (c.isOn !== on) {
      (on ? lens : gaps).push(since);
      since = 0;
      on = c.isOn;
    }
  }
  return { lens, gaps };
}

describe('SUPER-DUPER-DEMO cutaways', () => {
  it('cut more often and shorter as the demo runs, never faster than three changes a second', () => {
    const { lens, gaps } = run(150, (t) => t / 150);
    expect(lens.length).toBeGreaterThan(20);
    for (const x of [...lens, ...gaps.slice(1)]) expect(x).toBeGreaterThanOrEqual(KNOBS.DEMO_MONTAGE.SAFE_MIN_S - 1 / 60);
    const early = gaps.slice(1, 4).reduce((a, b) => a + b, 0) / 3;
    const late = gaps.slice(-3).reduce((a, b) => a + b, 0) / 3;
    expect(late).toBeLessThan(early);
    expect(lens[lens.length - 1] ?? 9).toBeLessThan(lens[0] ?? 0);
  });

  it('covers the planner while it thinks: cuts at once and back to back, still never under the floor', () => {
    const c = new DemoCutaways(null, () => false);
    const dt = 1 / 60;
    let off = 0;
    let changes = 0;
    let on = false;
    for (let t = 0; t < 10; t += dt) {
      c.update(dt, 0.2, false, true);
      if (!c.isOn) off++;
      if (c.isOn !== on) changes++;
      on = c.isOn;
    }
    // At most one frame between chained cuts.
    expect(off).toBeLessThanOrEqual(1);
    expect(changes).toBeLessThanOrEqual(1);
  });

  it('the first cut comes early', () => {
    const { gaps } = run(10, () => 0);
    expect(gaps[0] ?? 99).toBeLessThanOrEqual(KNOBS.DEMO_CUT.FIRST_S + 1 / 30);
  });

  it('the hit storm starts late and peaks at DEMO_STORM_MAX_HZ', () => {
    expect(stormRate(0.2)).toBe(0);
    expect(stormRate(0.6)).toBeGreaterThan(0);
    expect(stormRate(0.6)).toBeLessThan(stormRate(0.9));
    expect(stormRate(1)).toBeCloseTo(KNOBS.DEMO_STORM_MAX_HZ, 9);
    expect(stormHits(2, 1)).toBe(Math.floor(2 * KNOBS.DEMO_STORM_MAX_HZ));
  });

  it('REDUCE MOTION turns cutaways off', () => {
    expect(run(60, () => 0.5, true).lens.length).toBe(0);
  });

  it('hit after hit: the gap shrinks to a floor', () => {
    expect(hitsBy(0, 0)).toBe(0);
    expect(hitsBy(1, 0)).toBe(2);
    expect(hitsBy(4, 1)).toBeGreaterThan(hitsBy(4, 0));
    // Floor of 0.09 s between hits: at most about 11 a second once it is reached.
    expect(hitsBy(20, 1) - hitsBy(19, 1)).toBeLessThanOrEqual(12);
  });
});
