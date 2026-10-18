"""Nuclear deflection and disruption. Mirror of src/physics/nuclear.ts (GAME_PLAN 6.11)."""
import math

from .constants import MT_TNT

NUKE_EPS = {"STANDOFF": 0.3, "SURFACE": 0.5, "SUBSURFACE": 0.9, "HAIV": 0.9}
NUKE_CM = 3e-4
HAIV_ACCURACY = 0.7


def intercepted_fraction(R: float, H: float) -> float:
    x = R / (R + H)
    return (1 - math.sqrt(max(0.0, 1 - x * x))) / 2


def nuclear_burst(yield_mt: float, mode: str, M: float, R: float, H: float) -> tuple[float, float, float, float, float]:
    """(e_abs, dp, dv, Q, f_omega)."""
    Y = yield_mt * MT_TNT
    eps = NUKE_EPS.get(mode, 0.3)
    if mode == "STANDOFF":
        f = intercepted_fraction(R, H)
    elif mode == "SURFACE":
        f = 0.5
    else:
        f = 1.0
    e_abs = eps * f * Y
    if mode == "HAIV":
        e_abs *= HAIV_ACCURACY
    dp = NUKE_CM * e_abs
    return e_abs, dp, dp / M, e_abs / M, f


def warhead_mass(yield_mt: float) -> float:
    return 1500 + 500 * yield_mt
