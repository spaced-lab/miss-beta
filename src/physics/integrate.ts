// WHAT: Fixed-step integrators for thrust arcs: RK4 (the one the game uses) and Euler (for LAB_RK4).
// WHY:  GAME_PLAN 5.1: continuous thrust (sails, tugs, beams) is numerically integrated only during thrust
//       arcs; the result is re-expressed as Kepler elements for coasting. RK4 at 6 h keeps the energy error
//       of a one-year arc below 1e-8 relative for the accelerations in play; Euler is kept so the lab can
//       show why that matters.
// HOW:  State is [x, y, vx, vy]; `deriv(t, state)` returns [vx, vy, ax, ay]. `integrate` steps from t0 to
//       t1 with step h (the last step is shortened to land exactly on t1) and calls `onStep` after each.
//       Python mirror: pymiss/physics/integrate.py.
// LORE: O13 (integration)

export type State4 = [number, number, number, number];
export type Deriv = (t: number, s: State4) => State4;

export function rk4Step(f: Deriv, t: number, s: State4, h: number): State4 {
  const k1 = f(t, s);
  const s2: State4 = [s[0] + 0.5 * h * k1[0], s[1] + 0.5 * h * k1[1], s[2] + 0.5 * h * k1[2], s[3] + 0.5 * h * k1[3]];
  const k2 = f(t + 0.5 * h, s2);
  const s3: State4 = [s[0] + 0.5 * h * k2[0], s[1] + 0.5 * h * k2[1], s[2] + 0.5 * h * k2[2], s[3] + 0.5 * h * k2[3]];
  const k3 = f(t + 0.5 * h, s3);
  const s4: State4 = [s[0] + h * k3[0], s[1] + h * k3[1], s[2] + h * k3[2], s[3] + h * k3[3]];
  const k4 = f(t + h, s4);
  return [
    s[0] + (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
    s[1] + (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
    s[2] + (h / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]),
    s[3] + (h / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]),
  ];
}

export function eulerStep(f: Deriv, t: number, s: State4, h: number): State4 {
  const k = f(t, s);
  return [s[0] + h * k[0], s[1] + h * k[1], s[2] + h * k[2], s[3] + h * k[3]];
}

export type Stepper = (f: Deriv, t: number, s: State4, h: number) => State4;

/** Integrate from t0 to t1 with step h. Returns the final state; `onStep(t, state)` sees every step. */
export function integrate(f: Deriv, s0: State4, t0: number, t1: number, h: number, step: Stepper = rk4Step, onStep?: (t: number, s: State4) => void): State4 {
  let s = s0;
  let t = t0;
  onStep?.(t, s);
  while (t < t1 - 1e-9) {
    const dt = Math.min(h, t1 - t);
    s = step(f, t, s, dt);
    t += dt;
    onStep?.(t, s);
  }
  return s;
}

/** Two-body gravity derivative for a given mu. */
export function gravityDeriv(mu: number): Deriv {
  return (_t, s) => {
    const r2 = s[0] * s[0] + s[1] * s[1];
    const r3 = r2 * Math.sqrt(r2);
    return [s[2], s[3], (-mu * s[0]) / r3, (-mu * s[1]) / r3];
  };
}
