"""Planner quick estimates and launcher payload interpolation. Mirror of src/physics/estimates.ts."""
from __future__ import annotations

import json
import math
import os

_HERE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(_HERE, "..", "..", "src", "config", "launchers.json"), encoding="utf-8") as _f:
    LAUNCHERS = json.load(_f)["tiers"]


def miss_from_impulse(dv_along: float, T: float) -> float:
    return 3 * dv_along * T


def miss_from_push(a: float, tau: float, t_rem: float) -> float:
    return 3 * a * tau * (t_rem + tau / 2)


def cloud_footprint(v_ej: float, T: float) -> float:
    return 3 * v_ej * T


def c3_from_vinf(v_inf: float) -> float:
    return v_inf * v_inf / 1e6


def payload_for_c3(tier: dict, c3: float) -> float:
    pts = tier["points"]
    if not pts:
        return 0.0
    if c3 <= pts[0][0]:
        return float(pts[0][1])
    for i in range(1, len(pts)):
        p0, p1 = pts[i - 1], pts[i]
        if c3 <= p1[0]:
            if p1[1] <= 0:
                return p0[1] * (1 - (c3 - p0[0]) / (p1[0] - p0[0]))
            t = (c3 - p0[0]) / (p1[0] - p0[0])
            return math.exp(math.log(p0[1]) + t * (math.log(p1[1]) - math.log(p0[1])))
    return 0.0


def launcher_tier(tier: int) -> dict:
    for t in LAUNCHERS:
        if t["tier"] == tier:
            return t
    raise KeyError(tier)
