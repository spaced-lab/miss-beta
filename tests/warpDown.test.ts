import { describe, expect, it } from 'vitest';
import { craftRemaining, WarpDown } from '../src/game/warpDown';

describe('auto warp-down (GAME_PLAN 29)', () => {
  const missions = [
    { id: 'A', arrivalTime: 100 },
    { id: 'B', arrivalTime: 250 },
  ];

  it('fires once, only when the last craft has arrived', () => {
    const wd = new WarpDown();
    expect(wd.check(missions, 0, 50)).toEqual([]);
    // A arrives, B is still in flight: nothing fires.
    expect(wd.check(missions, 50, 120)).toEqual([]);
    expect(craftRemaining(missions, 120)).toBe(true);
    // B arrives: fire with B.
    expect(wd.check(missions, 120, 260)).toEqual(['B']);
    expect(craftRemaining(missions, 260)).toBe(false);
    // Same window again (a stepped clock): already handled.
    expect(wd.check(missions, 120, 260)).toEqual([]);
    expect(wd.check(missions, 260, 400)).toEqual([]);
  });

  it('fires for each arrival that is the last one at its time, and a new mission re-arms it', () => {
    const wd = new WarpDown();
    const list = [{ id: 'A', arrivalTime: 100 }];
    expect(wd.check(list, 90, 110)).toEqual(['A']);
    list.push({ id: 'C', arrivalTime: 300 });
    expect(wd.check(list, 110, 200)).toEqual([]);
    expect(wd.check(list, 200, 310)).toEqual(['C']);
    expect(wd.check(list, 200, 310)).toEqual([]);
  });

  it('two arrivals in one step fire together once', () => {
    const wd = new WarpDown();
    expect(wd.check(missions, 0, 1000)).toEqual(['A', 'B']);
    expect(wd.check(missions, 0, 1000)).toEqual([]);
  });
});
