"""Close approach on 3-D orbits with the same focusing test. Mirror of src/physics/closeApproach3.ts (M14 phase 1)."""
from __future__ import annotations

import math

from .close_approach import CloseApproach, b_crit, escape_speed, golden_min
from .constants import DAY
from .kepler3 import Elements3, propagate3


def close_approach3(threat: Elements3, home: Elements3, mu_sun: float, mu_home: float, r_home: float, t_nominal: float,
                    window: float = 90 * DAY, coarse: float = 3600.0, tol: float = 1.0) -> CloseApproach:
    """d(t) = |r_T(t) - r_H(t)| in 3-D; hourly scan then golden section; impact if d_min < b_crit."""
    def dist(t: float) -> float:
        ax, ay, az, _, _, _ = propagate3(threat, mu_sun, t)
        bx, by, bz, _, _, _ = propagate3(home, mu_sun, t)
        return math.hypot(ax - bx, ay - by, az - bz)

    best_t, best_d = t_nominal, math.inf
    t = t_nominal - window
    while t <= t_nominal + window:
        d = dist(t)
        if d < best_d:
            best_d, best_t = d, t
        t += coarse
    t_ca = golden_min(dist, best_t - coarse, best_t + coarse, tol)
    ax, ay, az, avx, avy, avz = propagate3(threat, mu_sun, t_ca)
    bx, by, bz, bvx, bvy, bvz = propagate3(home, mu_sun, t_ca)
    d_min = math.hypot(ax - bx, ay - by, az - bz)
    v_inf = math.hypot(avx - bvx, avy - bvy, avz - bvz)
    bc = b_crit(mu_home, r_home, v_inf)
    v_esc = escape_speed(mu_home, r_home)
    return CloseApproach(t_ca, d_min, v_inf, bc, d_min < bc, (d_min - bc) / r_home, math.sqrt(v_inf * v_inf + v_esc * v_esc))
