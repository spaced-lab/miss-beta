"""Asteroid photometry. Mirror of src/physics/photometry.ts (GAME_PLAN 18.1)."""
import math

from .constants import AU


def absolute_magnitude(D_m: float, albedo: float) -> float:
    return 5 * math.log10(1329 / ((D_m / 1000) * math.sqrt(albedo)))


def diameter_from_h(H: float, albedo: float) -> float:
    return 1000 * 1329 / (math.sqrt(albedo) * 10 ** (H / 5))


def apparent_magnitude(H: float, r_au: float, delta_au: float, alpha_deg: float) -> float:
    return H + 5 * math.log10(r_au * delta_au) + 0.035 * alpha_deg


def view_geometry(tx: float, ty: float, ox: float, oy: float) -> tuple[float, float, float, float]:
    """(r_au, delta_au, alpha_deg, eps_deg)."""
    r = math.hypot(tx, ty)
    dx, dy = tx - ox, ty - oy
    delta = math.hypot(dx, dy)
    ro = math.hypot(ox, oy)
    cos_alpha = ((-tx) * (-dx) + (-ty) * (-dy)) / (r * delta or 1)
    cos_eps = ((-ox) * dx + (-oy) * dy) / (ro * delta or 1)
    clamp = lambda v: max(-1.0, min(1.0, v))  # noqa: E731
    return r / AU, delta / AU, math.degrees(math.acos(clamp(cos_alpha))), math.degrees(math.acos(clamp(cos_eps)))
