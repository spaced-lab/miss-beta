"""Close approach, gravitational focusing, impact energy. Mirror of src/physics/closeApproach.ts (GAME_PLAN 6.4)."""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Callable

from .constants import DAY, MT_TNT
from .kepler import Elements, propagate


def escape_speed(mu: float, R: float) -> float:
    return math.sqrt(2 * mu / R)


def b_crit(mu: float, R: float, v_inf: float) -> float:
    v_esc = escape_speed(mu, R)
    return R * math.sqrt(1 + (v_esc * v_esc) / (v_inf * v_inf))


def golden_min(f: Callable[[float], float], a: float, b: float, tol: float) -> float:
    gr = (math.sqrt(5) - 1) / 2
    lo, hi = a, b
    c = hi - gr * (hi - lo)
    d = lo + gr * (hi - lo)
    fc, fd = f(c), f(d)
    while hi - lo > tol:
        if fc < fd:
            hi, d, fd = d, c, fc
            c = hi - gr * (hi - lo)
            fc = f(c)
        else:
            lo, c, fc = c, d, fd
            d = lo + gr * (hi - lo)
            fd = f(d)
    return (lo + hi) / 2


@dataclass(frozen=True)
class CloseApproach:
    t_ca: float
    d_min: float
    v_inf: float
    b_crit: float
    impact: bool
    margin_radii: float
    v_impact: float


def close_approach(threat: Elements, home: Elements, mu_sun: float, mu_home: float, r_home: float, t_nominal: float,
                   window: float = 90 * DAY, coarse: float = 3600.0, tol: float = 1.0) -> CloseApproach:
    def dist(t: float) -> float:
        ax, ay, _, _ = propagate(threat, mu_sun, t)
        bx, by, _, _ = propagate(home, mu_sun, t)
        return math.hypot(ax - bx, ay - by)

    best_t, best_d = t_nominal, math.inf
    t = t_nominal - window
    while t <= t_nominal + window:
        d = dist(t)
        if d < best_d:
            best_d, best_t = d, t
        t += coarse
    t_ca = golden_min(dist, best_t - coarse, best_t + coarse, tol)
    ax, ay, avx, avy = propagate(threat, mu_sun, t_ca)
    bx, by, bvx, bvy = propagate(home, mu_sun, t_ca)
    d_min = math.hypot(ax - bx, ay - by)
    v_inf = math.hypot(avx - bvx, avy - bvy)
    bc = b_crit(mu_home, r_home, v_inf)
    v_esc = escape_speed(mu_home, r_home)
    return CloseApproach(t_ca, d_min, v_inf, bc, d_min < bc, (d_min - bc) / r_home, math.sqrt(v_inf * v_inf + v_esc * v_esc))


def sphere_mass(D: float, rho: float) -> float:
    return 4 / 3 * math.pi * (D / 2) ** 3 * rho


def impact_energy(D: float, rho: float, v_impact: float) -> tuple[float, float, float]:
    """(mass, energy_J, energy_Mt)."""
    m = sphere_mass(D, rho)
    e = 0.5 * m * v_impact * v_impact
    return m, e, e / MT_TNT


def impact_category(D: float, iron: bool = False) -> str:
    if D < (10 if iron else 25):
        return "AIRBURST"
    if D < 140:
        return "CITY"
    if D < 1000:
        return "REGIONAL"
    return "GLOBAL"
