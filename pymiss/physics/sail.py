"""Solar sail force model and SPIRAL arcs. Mirror of src/physics/sail.ts (TARGET_STEER is TypeScript-only)."""
from __future__ import annotations

import math

from .constants import AU, P_RAD_1AU, SUN_ACCEL_1AU
from .integrate import integrate, rk4_step

SAIL_DT = 6 * 3600
SAIL_ALPHA_OPT = math.atan(1 / math.sqrt(2))


def characteristic_accel(sigma: float, eta: float = 0.9) -> float:
    return 2 * eta * P_RAD_1AU / sigma


def lightness(a_c: float) -> float:
    return a_c / SUN_ACCEL_1AU


def sail_accel(x: float, y: float, alpha: float, a_c: float) -> tuple[float, float]:
    rm = math.hypot(x, y)
    if rm == 0 or abs(alpha) >= math.pi / 2:
        return 0.0, 0.0
    rx, ry = x / rm, y / rm
    nx = rx * math.cos(alpha) - ry * math.sin(alpha)
    ny = rx * math.sin(alpha) + ry * math.cos(alpha)
    mag = a_c * (AU / rm) ** 2 * math.cos(alpha) ** 2
    return mag * nx, mag * ny


def integrate_sail(s0, t0: float, t1: float, a_c: float, mu: float, law: str, h: float = SAIL_DT):
    """Return (state, dv_equiv) for SPIRAL_OUT / SPIRAL_IN / COAST."""
    alpha = SAIL_ALPHA_OPT if law == "SPIRAL_OUT" else -SAIL_ALPHA_OPT if law == "SPIRAL_IN" else math.pi / 2

    def f(_t, s):
        r2 = s[0] * s[0] + s[1] * s[1]
        r3 = r2 * math.sqrt(r2)
        ax, ay = sail_accel(s[0], s[1], alpha, a_c)
        return (s[2], s[3], -mu * s[0] / r3 + ax, -mu * s[1] / r3 + ay)

    dv = [0.0]
    last = [t0]

    def on_step(t, s):
        ax, ay = sail_accel(s[0], s[1], alpha, a_c)
        vm = math.hypot(s[2], s[3])
        if vm > 0:
            dv[0] += abs((ax * s[2] + ay * s[3]) / vm) * (t - last[0])
        last[0] = t

    s = integrate(f, tuple(s0), t0, t1, h, rk4_step, on_step)
    return s, dv[0]

SAIL_TIERS = [
    {"tier": 1, "sigma": 0.1, "eta": 0.9},
    {"tier": 2, "sigma": 0.025, "eta": 0.9},
    {"tier": 3, "sigma": 0.01, "eta": 0.9},
    {"tier": 4, "sigma": 0.003, "eta": 0.9},
]


def sail_tier(tier: int) -> dict:
    """Sail spec by tier (loading sigma kg/m^2, efficiency eta). Mirror of sailTier; values from knobs.ts SAIL_TIERS."""
    for t in SAIL_TIERS:
        if t["tier"] == tier:
            return dict(t)
    raise ValueError(f"no sail tier {tier}")
