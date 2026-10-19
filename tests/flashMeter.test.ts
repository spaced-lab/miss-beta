import { describe, expect, it } from 'vitest';
import { maxPerSecond, measureFlashes, type FlashFrame } from '../src/render/flashMeter';

/** A W x H frame: background grey level `bg`, and an optional square [x, y, size] filled with `fg` (r, g, b). */
function frame(t: number, bg: number, sq?: [number, number, number, [number, number, number]]): FlashFrame {
  const W = 128;
  const H = 96;
  const rgba = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    rgba[i * 4] = bg;
    rgba[i * 4 + 1] = bg;
    rgba[i * 4 + 2] = bg;
    rgba[i * 4 + 3] = 255;
  }
  if (sq) {
    const [x0, y0, n, [r, g, b]] = sq;
    for (let y = y0; y < y0 + n; y++) for (let x = x0; x < x0 + n; x++) {
      const i = y * W + x;
      rgba[i * 4] = r;
      rgba[i * 4 + 1] = g;
      rgba[i * 4 + 2] = b;
    }
  }
  return { t, width: W, height: H, rgba };
}
/** The 10-degree field at this 128-wide capture of a 1024-wide reference: 341 x 256 scaled by 1/8. */
const FIELD = { w: 341 / 8, h: 256 / 8 };
const toggle = (ms: number, n: number, a: (t: number) => FlashFrame, b: (t: number) => FlashFrame): FlashFrame[] =>
  Array.from({ length: n }, (_, k) => (k % 2 === 0 ? a(k * ms) : b(k * ms)));

describe('flash meter (WCAG 2.x thresholds, IDEAS 34)', () => {
  it('counts the busiest second', () => {
    expect(maxPerSecond([0, 300, 600, 900, 1400])).toBe(4);
    expect(maxPerSecond([])).toBe(0);
  });
  it('a full-screen black-white toggle every 100 ms fails (5 flashes a second)', () => {
    const r = measureFlashes(toggle(100, 30, (t) => frame(t, 0), (t) => frame(t, 255)), FIELD);
    expect(r.generalPerSecond).toBe(5);
    expect(r.fails).toBe(true);
  });
  it('the same toggle every 400 ms passes (about one flash a second)', () => {
    const r = measureFlashes(toggle(400, 12, (t) => frame(t, 0), (t) => frame(t, 255)), FIELD);
    expect(r.generalPerSecond).toBeLessThanOrEqual(2);
    expect(r.fails).toBe(false);
  });
  it('a small blinking square is no flash (under 25 % of a field)', () => {
    const r = measureFlashes(toggle(50, 40, (t) => frame(t, 0), (t) => frame(t, 0, [10, 10, 8, [255, 255, 255]])), FIELD);
    expect(r.generalPerSecond).toBe(0);
  });
  it('a dim change under 0.1 relative luminance is no flash', () => {
    const r = measureFlashes(toggle(50, 40, (t) => frame(t, 0), (t) => frame(t, 60)), FIELD);
    expect(r.generalPerSecond).toBe(0);
  });
  it('a saturated red square over a field, toggled fast, is a red flash', () => {
    const r = measureFlashes(toggle(100, 30, (t) => frame(t, 0), (t) => frame(t, 0, [0, 0, 64, [255, 0, 0]])), FIELD);
    expect(r.redPerSecond).toBeGreaterThan(3);
    expect(r.fails).toBe(true);
  });
});
