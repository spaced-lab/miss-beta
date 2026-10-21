import { describe, expect, it } from 'vitest';
import { barHit, barLayout, barHeight, menuLayout, MIN_W, type BarItem } from '../src/ui/actionBar';

const items = (n: number): BarItem[] => Array.from({ length: n }, (_, i) => ({ label: `B${i}`, code: `Key${String.fromCharCode(65 + i)}` }));

describe('action bar', () => {
  it('places five buttons in one touch row inside a 390 x 740 phone', () => {
    const boxes = barLayout(390, 740, items(5), true);
    expect(boxes).toHaveLength(5);
    for (const b of boxes) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(390 + 1e-9);
      expect(b.h).toBe(38);
      expect(b.y + b.h).toBeLessThanOrEqual(740 - 6 + 1e-9);
    }
    expect(barHeight(boxes, 740)).toBe(38 + 12);
  });

  it('wraps to two rows when a single row would make buttons narrower than MIN_W', () => {
    const boxes = barLayout(390, 740, items(9), true);
    const rows = new Set(boxes.map((b) => b.y));
    expect(rows.size).toBe(2);
    for (const b of boxes) expect(b.w).toBeGreaterThanOrEqual(MIN_W);
    expect(barHeight(boxes, 740)).toBe(2 * 38 + 5 + 12);
  });

  it('finds the tapped button and ignores an off one', () => {
    const list = items(4);
    (list[1] as BarItem).off = true;
    const boxes = barLayout(780, 360, list, true);
    const b0 = boxes[0] as (typeof boxes)[number];
    const b1 = boxes[1] as (typeof boxes)[number];
    expect(barHit(b0.x + 5, b0.y + 5, boxes)?.code).toBe('KeyA');
    expect(barHit(b1.x + 5, b1.y + 5, boxes)).toBeNull();
    expect(barHit(10, 10, boxes)).toBeNull();
  });

  it('lays the MORE menu out as a 2-column grid on a phone and 3 on a wider window, inside the window', () => {
    for (const [W, H, cols] of [[390, 740, 2], [780, 360, 3], [1440, 900, 3]] as const) {
      const boxes = menuLayout(W, H, items(12), true);
      expect(new Set(boxes.map((b) => Math.round(b.x))).size).toBe(cols);
      for (const b of boxes) {
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.x + b.w).toBeLessThanOrEqual(W + 1e-9);
        expect(b.y).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
