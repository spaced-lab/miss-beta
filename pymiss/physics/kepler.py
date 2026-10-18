"""Analytic two-body propagation. Mirror of src/physics/kepler.ts (GAME_PLAN 6.2).

Elements: a (m), e, w (rad), M0 (rad), t0 (s). Pure Python floats; numpy is not needed here.
"""
from __future__ import annotations

import math
from dataclasses import dataclass


def wrap_angle(t: float) -> float:
    """Wrap any angle into [0, 2pi)."""
    r = math.fmod(t, 2 * math.pi)
    return r + 2 * math.pi if r < 0 else r


@dataclass(frozen=True)
class Elements:
    a: float
    e: float
    w: float
    M0: float
    t0: float


def mean_motion(mu: float, a: float) -> float:
    """n = sqrt(mu / |a|^3), rad/s (|a| so the hyperbolic branch shares it)."""
    aa = abs(a)
    return math.sqrt(mu / (aa * aa * aa))


def period(mu: float, a: float) -> float:
    """T = 2 pi sqrt(a^3 / mu), s; inf for a hyperbola."""
    return 2 * math.pi / mean_motion(mu, a) if a > 0 else math.inf


def solve_kepler_hyperbolic(M: float, e: float, tol: float = 1e-14, max_iter: int = 50) -> float:
    """Newton's method on e sinh H - H = M, start H0 = asinh(M / e)."""
    H = math.asinh(M / e)
    for _ in range(max_iter):
        f = e * math.sinh(H) - H - M
        fp = e * math.cosh(H) - 1
        dH = f / fp
        H -= dH
        if abs(dH) < tol * max(1.0, abs(H)):
            break
    return H


def true_anomaly_from_h(H: float, e: float) -> float:
    return 2 * math.atan(math.sqrt((e + 1) / (e - 1)) * math.tanh(H / 2))


def hyperbolic_from_true(nu: float, e: float) -> float:
    return 2 * math.atanh(math.sqrt((e - 1) / (e + 1)) * math.tan(nu / 2))


def solve_kepler(M: float, e: float, tol: float = 1e-14, max_iter: int = 30) -> float:
    """Newton's method on E - e sin E = M. Start E0 = M (e < 0.8) else pi."""
    Mw = wrap_angle(M)
    E = Mw if e < 0.8 else math.pi
    for _ in range(max_iter):
        f = E - e * math.sin(E) - Mw
        fp = 1 - e * math.cos(E)
        dE = f / fp
        E -= dE
        if abs(dE) < tol:
            break
    return E


def true_anomaly_from_e(E: float, e: float) -> float:
    return 2 * math.atan2(math.sqrt(1 + e) * math.sin(E / 2), math.sqrt(1 - e) * math.cos(E / 2))


def eccentric_from_true(nu: float, e: float) -> float:
    return 2 * math.atan2(math.sqrt(1 - e) * math.sin(nu / 2), math.sqrt(1 + e) * math.cos(nu / 2))


def propagate(el: Elements, mu: float, t: float) -> tuple[float, float, float, float]:
    """Return (x, y, vx, vy) at time t. Same steps as the TypeScript version."""
    n = mean_motion(mu, el.a)
    if el.e > 1:
        return _propagate_hyperbolic(el, mu, t, n)
    M = wrap_angle(el.M0 + n * (t - el.t0))
    E = solve_kepler(M, el.e)
    nu = true_anomaly_from_e(E, el.e)
    r = el.a * (1 - el.e * math.cos(E))
    xp = r * math.cos(nu)
    yp = r * math.sin(nu)
    k = math.sqrt(mu * el.a) / r
    vxp = -k * math.sin(E)
    vyp = k * math.sqrt(1 - el.e * el.e) * math.cos(E)
    cw = math.cos(el.w)
    sw = math.sin(el.w)
    return (xp * cw - yp * sw, xp * sw + yp * cw, vxp * cw - vyp * sw, vxp * sw + vyp * cw)


def _propagate_hyperbolic(el: Elements, mu: float, t: float, n: float) -> tuple[float, float, float, float]:
    M = el.M0 + n * (t - el.t0)
    H = solve_kepler_hyperbolic(M, el.e)
    nu = true_anomaly_from_h(H, el.e)
    r = el.a * (1 - el.e * math.cosh(H))
    xp = r * math.cos(nu)
    yp = r * math.sin(nu)
    k = math.sqrt(-mu * el.a) / r
    vxp = -k * math.sinh(H)
    vyp = k * math.sqrt(el.e * el.e - 1) * math.cosh(H)
    cw = math.cos(el.w)
    sw = math.sin(el.w)
    return (xp * cw - yp * sw, xp * sw + yp * cw, vxp * cw - vyp * sw, vxp * sw + vyp * cw)


def vis_viva(mu: float, r: float, a: float) -> float:
    """v = sqrt(mu (2/r - 1/a))."""
    return math.sqrt(mu * (2 / r - 1 / a))


def specific_energy(mu: float, r: float, v: float) -> float:
    """eps = v^2/2 - mu/r."""
    return v * v / 2 - mu / r


def periapsis(el: Elements) -> float:
    return el.a * (1 - el.e)


def apoapsis(el: Elements) -> float:
    return el.a * (1 + el.e) if el.e < 1 else math.inf

def orbit_points(el: Elements, n: int = 128, r_max: float = 12 * 1.495978707e11) -> list[tuple[float, float]]:
    """Sampled outline in the system frame, evenly spaced in true anomaly; a hyperbola is an open arc inside r_max.
    Mirror of orbitPoints."""
    p = el.a * (1 - el.e * el.e)
    cw = math.cos(el.w)
    sw = math.sin(el.w)
    if el.e > 1:
        nu_lim = math.acos(max(-1.0, min(1.0, (p / r_max - 1) / el.e)))
    else:
        nu_lim = math.pi
    out = []
    for i in range(n):
        nu = -nu_lim + (i / (n - 1)) * 2 * nu_lim if el.e > 1 else (i / n) * 2 * math.pi
        r = p / (1 + el.e * math.cos(nu))
        xp = r * math.cos(nu)
        yp = r * math.sin(nu)
        out.append((xp * cw - yp * sw, xp * sw + yp * cw))
    return out
