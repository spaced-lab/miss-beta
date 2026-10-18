"""Slow-push forces and the push arc. Mirror of src/physics/slowPush.ts (GAME_PLAN 6.12)."""
from __future__ import annotations

from .constants import AU, G, G0
from .elements import state_to_elements
from .integrate import integrate
from .kepler import Elements, propagate

TRACTOR_HOVER_FACTOR = 1.5
TRACTOR_THRUST_FACTOR = 1.3
ION_ISP_S = 3000
LASER_CM = 3e-5
PUSH_DT = 6 * 3600


def gravity_tractor_force(m_sc: float, M: float, R: float) -> float:
    d = TRACTOR_HOVER_FACTOR * R
    return G * m_sc * M / (d * d)


def laser_force(power_w: float, cm: float = LASER_CM) -> float:
    return cm * power_w


def yarkovsky_drift(seconds: float) -> float:
    return 2e-4 * AU * seconds / (1e6 * 3.15576e7)


def tractor_propellant(m_sc: float, M: float, R: float, tau: float, isp: float = ION_ISP_S) -> float:
    d = TRACTOR_HOVER_FACTOR * R
    F = TRACTOR_THRUST_FACTOR * m_sc * G * M / (d * d)
    return F / (isp * G0) * tau


def integrate_push(el: Elements, mu: float, t0: float, t1: float, a: float, h: float = PUSH_DT) -> tuple[Elements, float]:
    x, y, vx, vy = propagate(el, mu, t0)

    def f(_t, s):
        r2 = s[0] * s[0] + s[1] * s[1]
        r3 = r2 * (r2 ** 0.5)
        vm = (s[2] * s[2] + s[3] * s[3]) ** 0.5 or 1.0
        return (s[2], s[3], -mu * s[0] / r3 + a * s[2] / vm, -mu * s[1] / r3 + a * s[3] / vm)

    e = integrate(f, (x, y, vx, vy), t0, t1, h)
    return state_to_elements(e[0], e[1], e[2], e[3], mu, t1), a * (t1 - t0)

G = 6.67430e-11
TRACTOR_SC_MASS_KG = [1000.0, 5000.0, 20000.0]
ION_BEAM_N = [0.1, 0.5, 2.0]
LASER_POWER_W = [5e4, 2e5, 1e6]
MASS_DRIVER_MDOT = [0.1, 1.0, 10.0]
MASS_DRIVER_VE = 500.0


def push_force(method: str, tier: int, M: float, R: float) -> float:
    """Force (N) for the main slow-push methods by tier. Mirror of the pushForce cases the vectors cover
    (GRAVITY_TRACTOR, ION_BEAM, LASER, MASS_DRIVER); other methods live in TypeScript only."""
    if method == "GRAVITY_TRACTOR":
        m_sc = TRACTOR_SC_MASS_KG[tier]
        d = TRACTOR_HOVER_FACTOR * R
        return G * m_sc * M / (d * d)
    if method == "ION_BEAM":
        return ION_BEAM_N[tier]
    if method == "LASER":
        return LASER_CM * LASER_POWER_W[tier]
    if method == "MASS_DRIVER":
        return MASS_DRIVER_MDOT[tier] * MASS_DRIVER_VE
    raise ValueError(f"push_force: unsupported method {method}")
