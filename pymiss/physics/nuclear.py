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

NUKE_FUZE_U = [0.0, 5000.0, 20000.0, 20000.0]
NUKE_YIELDS_MT = [0.1, 0.3, 1.0, 5.0]
NUKE_YIELDS_BY_TIER = [[], [0, 1], [0, 1, 2], [0, 1, 2, 3]]


def fuze_ok(U: float, warhead_tier: int) -> bool:
    """Can a standoff burst be fuzed at closing speed U (m/s) with this warhead tier? Mirror of fuzeOk."""
    return U <= (NUKE_FUZE_U[warhead_tier] if 0 <= warhead_tier < len(NUKE_FUZE_U) else 0.0)


def yields_for_tier(tier: int) -> list[float]:
    """Yields (Mt) available at a warhead tier. Mirror of yieldsForTier."""
    idx = NUKE_YIELDS_BY_TIER[tier] if 0 <= tier < len(NUKE_YIELDS_BY_TIER) else []
    return [NUKE_YIELDS_MT[i] for i in idx]
