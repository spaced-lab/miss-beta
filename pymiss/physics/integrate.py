"""Fixed-step integrators. Mirror of src/physics/integrate.ts."""
from __future__ import annotations

from typing import Callable

State = tuple[float, float, float, float]
Deriv = Callable[[float, State], State]


def rk4_step(f: Deriv, t: float, s: State, h: float) -> State:
    k1 = f(t, s)
    s2 = tuple(s[i] + 0.5 * h * k1[i] for i in range(4))
    k2 = f(t + 0.5 * h, s2)  # type: ignore[arg-type]
    s3 = tuple(s[i] + 0.5 * h * k2[i] for i in range(4))
    k3 = f(t + 0.5 * h, s3)  # type: ignore[arg-type]
    s4 = tuple(s[i] + h * k3[i] for i in range(4))
    k4 = f(t + h, s4)  # type: ignore[arg-type]
    return tuple(s[i] + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]) for i in range(4))  # type: ignore[return-value]


def euler_step(f: Deriv, t: float, s: State, h: float) -> State:
    k = f(t, s)
    return tuple(s[i] + h * k[i] for i in range(4))  # type: ignore[return-value]


def integrate(f: Deriv, s0: State, t0: float, t1: float, h: float, step=rk4_step, on_step=None) -> State:
    s, t = s0, t0
    if on_step:
        on_step(t, s)
    while t < t1 - 1e-9:
        dt = min(h, t1 - t)
        s = step(f, t, s, dt)
        t += dt
        if on_step:
            on_step(t, s)
    return s


def gravity_deriv(mu: float) -> Deriv:
    def f(_t: float, s: State) -> State:
        r2 = s[0] * s[0] + s[1] * s[1]
        r3 = r2 * (r2 ** 0.5)
        return (s[2], s[3], -mu * s[0] / r3, -mu * s[1] / r3)
    return f
