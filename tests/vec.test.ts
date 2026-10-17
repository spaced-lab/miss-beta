import { describe, expect, it } from 'vitest';
import { add, angleOf, cross, dot, fromAngle, len, normalize, rotate, sub, vec, wrapAngle, ZERO } from '../src/util/vec';

describe('vec', () => {
  it('adds, subtracts, dots and crosses', () => {
    expect(add(vec(1, 2), vec(3, 4))).toEqual({ x: 4, y: 6 });
    expect(sub(vec(1, 2), vec(3, 4))).toEqual({ x: -2, y: -2 });
    expect(dot(vec(1, 2), vec(3, 4))).toBe(11);
    expect(cross(vec(1, 0), vec(0, 1))).toBe(1); // y is CCW of x
  });
  it('normalizes safely', () => {
    expect(len(normalize(vec(3, 4)))).toBeCloseTo(1, 12);
    expect(normalize(ZERO)).toEqual(ZERO);
  });
  it('rotates CCW', () => {
    const r = rotate(vec(1, 0), Math.PI / 2);
    expect(r.x).toBeCloseTo(0, 12);
    expect(r.y).toBeCloseTo(1, 12);
  });
  it('angles round-trip and wrap', () => {
    expect(angleOf(fromAngle(1.234))).toBeCloseTo(1.234, 12);
    expect(wrapAngle(-0.5)).toBeCloseTo(2 * Math.PI - 0.5, 12);
    expect(wrapAngle(7)).toBeCloseTo(7 - 2 * Math.PI, 12);
  });
});
