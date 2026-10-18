import { describe, expect, it } from 'vitest';
import { KNOBS } from '../src/config/knobs';
import { hitsBy } from '../src/render/demoScenes';
import { DemoCutaways } from '../src/render/views/demoCut';

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
