"""Three-dimensional two-body propagation. Mirror of src/physics/kepler3.ts (M14 phase 1).

Elements3 = Elements + i (inclination, rad) + raan (longitude of the ascending node, rad); w is the argument of
periapsis. r = R3(raan) R1(i) R3(w) r_perifocal; with i = raan = 0 this is exactly the planar propagate with z = 0.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

from .kepler import Elements, propagate


@dataclass(frozen=True)
class Elements3:
    a: float
    e: float
    w: float
    M0: float
    t0: float
    i: float
    raan: float

    def planar(self) -> Elements:
        """The in-plane elements (a, e, w, M0, t0) that propagate() understands."""
        return Elements(self.a, self.e, self.w, self.M0, self.t0)


def lift_elements(el: Elements) -> Elements3:
    """Planar elements on the ecliptic: i = 0, raan = 0. Mirror of liftElements."""
    return Elements3(el.a, el.e, el.w, el.M0, el.t0, 0.0, 0.0)


def plane_to_ecliptic(x: float, y: float, i: float, raan: float) -> tuple[float, float, float]:
    """R3(raan) R1(i) (x, y, 0): x' = x cos O - y cos i sin O, y' = x sin O + y cos i cos O, z' = y sin i.
    Example: (0, 1) at i = 90 deg, raan = 0 -> (0, 0, 1) to round-off."""
    ci = math.cos(i)
    si = math.sin(i)
    cO = math.cos(raan)
    sO = math.sin(raan)
    yc = y * ci
    return (x * cO - yc * sO, x * sO + yc * cO, y * si)


def propagate3(el: Elements3, mu: float, t: float) -> tuple[float, float, float, float, float, float]:
    """Return (x, y, z, vx, vy, vz) at time t: planar propagate, then plane_to_ecliptic on r and v.
    Example: Earth, a = 7000 km, e = 0, i = 90 deg, t = t0 -> r = (7000 km, 0, 0), v = (0, ~0, 7.546 km/s)."""
    x, y, vx, vy = propagate(el.planar(), mu, t)
    rx, ry, rz = plane_to_ecliptic(x, y, el.i, el.raan)
    ux, uy, uz = plane_to_ecliptic(vx, vy, el.i, el.raan)
    return (rx, ry, rz, ux, uy, uz)


def angular_momentum3(x: float, y: float, z: float, vx: float, vy: float, vz: float) -> tuple[float, float, float]:
    """h = r x v, m^2/s. Example: r = (1, 0, 0), v = (0, 1, 0) -> (0, 0, 1)."""
    return (y * vz - z * vy, z * vx - x * vz, x * vy - y * vx)


def orbit_points3(el: Elements3, n: int = 128, r_max: float = 12 * 1.495978707e11) -> list[tuple[float, float, float]]:
    """Sampled 3-D outline, same sampling as orbit_points. Mirror of orbitPoints3."""
    p = el.a * (1 - el.e * el.e)
    if el.e > 1:
        nu_lim = math.acos(max(-1.0, min(1.0, (p / r_max - 1) / el.e)))
    else:
        nu_lim = math.pi
    out = []
    for k in range(n):
        nu = -nu_lim + (k / (n - 1)) * 2 * nu_lim if el.e > 1 else (k / n) * 2 * math.pi
        r = p / (1 + el.e * math.cos(nu))
        u = el.w + nu
        out.append(plane_to_ecliptic(r * math.cos(u), r * math.sin(u), el.i, el.raan))
    return out
