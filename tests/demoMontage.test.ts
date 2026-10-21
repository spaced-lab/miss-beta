import { describe, expect, it } from 'vitest';
import { KNOBS } from '../src/config/knobs';
import type { Router } from '../src/game/screen';
import type { Surface } from '../src/render/canvas';
import { DemoScreen } from '../src/render/views/demo';
import type { Input } from '../src/ui/input';

/** Step the finale montage at 60 fps; return when it reached the pause and how many cuts it made at the floor. */
function montage(reduceMotion = false): { toPause: number; cuts: number[] } {
  const keys = { pressed: () => false, anyKeyPressed: () => false } as unknown as Input;
  const d = new DemoScreen({} as Surface, keys, { go: () => undefined } as unknown as Router, null, { reduceMotion });
  d.enter();
  const st = d as unknown as { stage: string; sceneIdx: number };
  const cuts: number[] = [];
  let last = 0;
  let idx = st.sceneIdx;
  let t = 0;
  while (st.stage === 'montage' && t < 600) {
    d.update(1000 / 60);
    t += 1 / 60;
    if (st.sceneIdx !== idx) {
      cuts.push(t - last);
      last = t;
      idx = st.sceneIdx;
    }
  }
  return { toPause: t, cuts };
}

describe('SUPER-DUPER-DEMO finale montage', () => {
  it('never holds a scene over two seconds, reaches the pause in under 36 s and keeps the old blur', () => {
    const { toPause, cuts } = montage();
    // Owner 2026-10-20: a longer reel of stranger scenes, but "nothing should pause for more than a couple seconds".
    expect(toPause).toBeLessThan(36);
    expect(toPause).toBeGreaterThan(15);
    for (const c of cuts) expect(c).toBeLessThanOrEqual(2);
    // Never more than three cuts a second.
    for (const c of cuts) expect(c).toBeGreaterThanOrEqual(KNOBS.DEMO_MONTAGE.SAFE_MIN_S - 1 / 60);
    // The blur at the end: BLUR_CUTS cuts at the floor, as before (12 x 0.34 s).
    const tail = cuts.slice(-(KNOBS.DEMO_MONTAGE.BLUR_CUTS - 1));
    for (const c of tail) expect(c).toBeCloseTo(KNOBS.DEMO_MONTAGE.SAFE_MIN_S, 1);
  });

  it('keeps the pause and the typing speed', () => {
    expect(KNOBS.DEMO_MONTAGE.PAUSE_S).toBe(2.4);
    expect(KNOBS.DEMO_MONTAGE.TYPE_CPS).toBe(16);
  });

  it('REDUCE MOTION still cuts at most once a second', () => {
    for (const c of montage(true).cuts) expect(c).toBeGreaterThanOrEqual(KNOBS.DEMO_MONTAGE.CALM_MIN_S - 1 / 60);
  });
});
