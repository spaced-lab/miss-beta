"""The rocket equation and identical-stage staging. Mirror of src/physics/rocket.ts (EDUCATION D8)."""
from __future__ import annotations

import math

from .constants import G0


def rocket_dv(isp: float, mass_ratio: float) -> float:
    """dv = Isp g0 ln(m0/mf), m/s. Example: 320 s, 5 -> 5051 m/s."""
    return isp * G0 * math.log(mass_ratio)


def staged_dv(isp: float, prop_fraction: float, stages: int) -> float:
    """n identical stages each burning fraction f of their gross mass. Example: 320 s, 0.8, 2 -> 10101 m/s."""
    return stages * rocket_dv(isp, 1 / (1 - prop_fraction))


def mass_ratio_for(dv: float, isp: float) -> float:
    """m0/mf = exp(dv / (Isp g0)). Example: 5051 m/s at 320 s -> 5.0."""
    return math.exp(dv / (isp * G0))
