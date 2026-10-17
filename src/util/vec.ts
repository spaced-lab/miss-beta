// WHAT: Minimal 2-D vector helpers used by physics, sim and the minigame.
// WHY:  The whole game is coplanar (GAME_PLAN 5.1), so two numbers are enough. Keeping the helpers tiny
//       and allocation-light matters: the planner's Monte Carlo and the minigame's particle field call
//       these thousands of times per frame.
// HOW:  Plain {x, y} objects, pure functions, no classes. Functions never mutate their inputs.
// LORE: O3 (vectors)

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export const vec = (x: number, y: number): Vec2 => ({ x, y });
export const ZERO: Vec2 = Object.freeze({ x: 0, y: 0 });

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;

/** 2-D cross product (z component of the 3-D cross). Positive when b is counter-clockwise of a. */
export const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;

export const len = (a: Vec2): number => Math.hypot(a.x, a.y);
export const len2 = (a: Vec2): number => a.x * a.x + a.y * a.y;
export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Unit vector. Returns ZERO for a zero-length input instead of NaN. */
export const normalize = (a: Vec2): Vec2 => {
  const l = len(a);
  return l > 0 ? { x: a.x / l, y: a.y / l } : ZERO;
};

/** Rotate counter-clockwise by `theta` radians. */
export const rotate = (a: Vec2, theta: number): Vec2 => {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
};

/** Unit vector at polar angle `theta` (radians, counter-clockwise from +x). */
export const fromAngle = (theta: number, r = 1): Vec2 => ({ x: r * Math.cos(theta), y: r * Math.sin(theta) });

/** Polar angle in [0, 2pi). */
export const angleOf = (a: Vec2): number => {
  const t = Math.atan2(a.y, a.x);
  return t < 0 ? t + 2 * Math.PI : t;
};

/** Wrap any angle into [0, 2pi). */
export const wrapAngle = (t: number): number => {
  const TWO_PI = 2 * Math.PI;
  const r = t % TWO_PI;
  return r < 0 ? r + TWO_PI : r;
};

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
