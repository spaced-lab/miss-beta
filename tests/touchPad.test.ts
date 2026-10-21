import { describe, expect, it } from 'vitest';
import { BACK_BOX, padHeld, padLayout } from '../src/minigame/touchPad';

describe('PERIMETER touch pad', () => {
  for (const [W, H] of [[390, 740], [740, 360], [1024, 768]] as const) {
    it(`fits a ${W} x ${H} screen with no two buttons overlapping`, () => {
      const pad = padLayout(W, H);
      for (const b of pad) {
        expect(b.x - b.r).toBeGreaterThanOrEqual(0);
        expect(b.x + b.r).toBeLessThanOrEqual(W);
        expect(b.y - b.r).toBeGreaterThan(BACK_BOX.y + BACK_BOX.h);
        expect(b.y + b.r).toBeLessThanOrEqual(H);
        for (const o of pad) if (o !== b) expect(Math.hypot(o.x - b.x, o.y - b.y)).toBeGreaterThan(o.r + b.r);
      }
    });
  }

  it('holds the button under each finger, BACK by its box, and nothing elsewhere', () => {
    const pad = padLayout(390, 740);
    const at = (id: string): { x: number; y: number } => {
      const b = pad.find((p) => p.id === id);
      if (!b) throw new Error(id);
      return { x: b.x, y: b.y };
    };
    expect([...padHeld([at('left'), at('fire')], pad)].sort()).toEqual(['fire', 'left']);
    expect([...padHeld([{ x: 30, y: 20 }], pad)]).toEqual(['back']);
    expect(padHeld([{ x: 195, y: 300 }], pad).size).toBe(0);
  });
});
