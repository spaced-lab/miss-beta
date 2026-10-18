"""Patched-conic flyby. Mirror of src/physics/flyby.ts (GAME_PLAN 6.7)."""
import math


def soi_radius(a_planet: float, mu_planet: float, mu_sun: float) -> float:
    return a_planet * (mu_planet / mu_sun) ** (2 / 5)


def turn_angle(r_p: float, v_inf: float, mu_planet: float) -> float:
    return 2 * math.asin(1 / (1 + r_p * v_inf * v_inf / mu_planet))


def turn_angle_max(R: float, h_min: float, v_inf: float, mu_planet: float) -> float:
    return turn_angle(R + h_min, v_inf, mu_planet)


def periapsis_for_turn(delta: float, v_inf: float, mu_planet: float) -> float:
    return mu_planet / (v_inf * v_inf) * (1 / math.sin(delta / 2) - 1)


def flyby(vsx: float, vsy: float, vpx: float, vpy: float, delta: float, side: int, mu_planet: float):
    """Return (vinf_out_x, vinf_out_y, vout_x, vout_y, dv_helio, r_p)."""
    ix, iy = vsx - vpx, vsy - vpy
    v_inf = math.hypot(ix, iy)
    c, s = math.cos(side * delta), math.sin(side * delta)
    ox, oy = ix * c - iy * s, ix * s + iy * c
    return ox, oy, vpx + ox, vpy + oy, 2 * v_inf * math.sin(delta / 2), periapsis_for_turn(delta, v_inf, mu_planet)

def signed_angle(ax: float, ay: float, bx: float, by: float) -> float:
    """Signed angle from a to b, rad in (-pi, pi]. Mirror of signedAngle."""
    return math.atan2(ax * by - ay * bx, ax * bx + ay * by)
