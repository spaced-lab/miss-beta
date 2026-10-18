"""Lambert's problem, universal variables, prograde single revolution. Mirror of src/physics/lambert.ts."""
from __future__ import annotations

import math
from dataclasses import dataclass

from .stumpff import stumpff_c, stumpff_s

LAMBERT_DEGENERATE = 1e-3


@dataclass(frozen=True)
class LambertResult:
    v1x: float
    v1y: float
    v2x: float
    v2y: float
    z: float
    dtheta: float
    a: float


def lambert(r1x: float, r1y: float, r2x: float, r2y: float, dt: float, mu: float) -> LambertResult | None:
    if not dt > 0:
        return None
    r1 = math.hypot(r1x, r1y)
    r2 = math.hypot(r2x, r2y)
    cross = r1x * r2y - r1y * r2x
    cosd = max(-1.0, min(1.0, (r1x * r2x + r1y * r2y) / (r1 * r2)))
    dtheta = math.acos(cosd)
    if cross < 0:
        dtheta = 2 * math.pi - dtheta
    if dtheta < LAMBERT_DEGENERATE or abs(dtheta - math.pi) < LAMBERT_DEGENERATE or 2 * math.pi - dtheta < LAMBERT_DEGENERATE:
        return None

    A = math.sin(dtheta) * math.sqrt(r1 * r2 / (1 - math.cos(dtheta)))
    root = _solve_universal(r1, r2, A, dt, mu)
    if root is None:
        return None
    z, yy, C = root
    f = 1 - yy / r1
    g = A * math.sqrt(yy / mu)
    gd = 1 - yy / r2
    v1x = (r2x - f * r1x) / g
    v1y = (r2y - f * r1y) / g
    v2x = (gd * r2x - r1x) / g
    v2y = (gd * r2y - r1y) / g
    a = yy / (C * z) if abs(z) > 1e-12 else math.inf
    return LambertResult(v1x, v1y, v2x, v2y, z, dtheta, a)


def _solve_universal(r1: float, r2: float, A: float, dt: float, mu: float) -> tuple[float, float, float] | None:
    """The universal-variable root shared by lambert and lambert3: (z, y(z), C(z)) or None. Mirror of solveUniversal."""
    sqrt_mu_dt = math.sqrt(mu) * dt

    def y(z: float) -> float:
        return r1 + r2 + A * (z * stumpff_s(z) - 1) / math.sqrt(stumpff_c(z))

    def F(z: float) -> float:
        yy = y(z)
        return (yy / stumpff_c(z)) ** 1.5 * stumpff_s(z) + A * math.sqrt(yy) - sqrt_mu_dt

    z_max = 4 * math.pi * math.pi * 0.999
    lo = -4 * math.pi * math.pi
    steps = 0
    while not (y(lo) > 0) and lo < z_max and steps < 400:
        lo += 0.1
        steps += 1
    if not y(lo) > 0:
        return None
    hi = z_max
    flo, fhi = F(lo), F(hi)
    if not (math.isfinite(flo) and math.isfinite(fhi)) or flo > 0 or fhi < 0:
        return None
    for _ in range(200):
        if hi - lo <= 1e-13:
            break
        mid = 0.5 * (lo + hi)
        fm = F(mid)
        if fm > 0:
            hi, fhi = mid, fm
        else:
            lo, flo = mid, fm
    z = 0.5 * (lo + hi)
    for _ in range(3):
        S = stumpff_s(z)
        C = stumpff_c(z)
        yy = y(z)
        if not yy > 0:
            break
        if abs(z) > 1e-6:
            dF = (yy / C) ** 1.5 * ((1 / (2 * z)) * (C - 1.5 * S / C) + 0.75 * S * S / C) + (A / 8) * (3 * S * math.sqrt(yy) / C + A * math.sqrt(C / yy))
        else:
            dF = (math.sqrt(2) / 40) * yy ** 1.5 + (A / 8) * (math.sqrt(yy) + A * math.sqrt(1 / (2 * yy)))
        zn = z - F(z) / dF
        if not math.isfinite(zn) or zn < lo - 1e-6 or zn > hi + 1e-6:
            break
        z = zn

    yy = y(z)
    return z, yy, stumpff_c(z)


@dataclass(frozen=True)
class Lambert3Result:
    v1: tuple[float, float, float]
    v2: tuple[float, float, float]
    z: float
    dtheta: float
    a: float


def lambert3(r1v: tuple[float, float, float], r2v: tuple[float, float, float], dt: float, mu: float, prograde: bool = True) -> Lambert3Result | None:
    """Lambert in 3-D, in the plane of r1 and r2; prograde sense from (r1 x r2)_z. Mirror of lambert3."""
    if not dt > 0:
        return None
    r1 = math.hypot(*r1v)
    r2 = math.hypot(*r2v)
    cz = r1v[0] * r2v[1] - r1v[1] * r2v[0]
    cosd = max(-1.0, min(1.0, (r1v[0] * r2v[0] + r1v[1] * r2v[1] + r1v[2] * r2v[2]) / (r1 * r2)))
    dtheta = math.acos(cosd)
    if (cz < 0) if prograde else (cz >= 0):
        dtheta = 2 * math.pi - dtheta
    if dtheta < LAMBERT_DEGENERATE or abs(dtheta - math.pi) < LAMBERT_DEGENERATE or 2 * math.pi - dtheta < LAMBERT_DEGENERATE:
        return None
    A = math.sin(dtheta) * math.sqrt(r1 * r2 / (1 - math.cos(dtheta)))
    root = _solve_universal(r1, r2, A, dt, mu)
    if root is None:
        return None
    z, yy, C = root
    f = 1 - yy / r1
    g = A * math.sqrt(yy / mu)
    gd = 1 - yy / r2
    v1 = tuple((r2v[k] - f * r1v[k]) / g for k in range(3))
    v2 = tuple((gd * r2v[k] - r1v[k]) / g for k in range(3))
    a = yy / (C * z) if abs(z) > 1e-12 else math.inf
    return Lambert3Result(v1, v2, z, dtheta, a)  # type: ignore[arg-type]
