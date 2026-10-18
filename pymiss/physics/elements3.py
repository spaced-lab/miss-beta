"""3-D state vector to elements. Mirror of src/physics/elements3.ts (M14 phase 1).

h = r x v; i = atan2(|h_xy|, h_z); node n = (-h_y, h_x, 0); raan = atan2(n_y, n_x); rotate the state into the node
frame and hand it to the planar state_to_elements. Equatorial (|h_xy| <= 1e-12 |h|): raan = 0, i = 0 or pi, node
frame (x, +-y). Circular: w = 0 (M0 is the argument of latitude). Radial: OrbitError kind RETROGRADE.
"""
from __future__ import annotations

import math

from .elements import OrbitError, state_to_elements
from .kepler import wrap_angle
from .kepler3 import Elements3, angular_momentum3

SIN_I_EQUATORIAL = 1e-12


def state_to_elements3(x: float, y: float, z: float, vx: float, vy: float, vz: float, mu: float, t: float,
                       allow_unbound: bool = False) -> Elements3:
    """Example: r = (7000 km, 0, 0), v = (0, 0, 7546.05 m/s), mu = MU_EARTH -> i = 90 deg, raan = 0, e ~ 0."""
    hx, hy, hz = angular_momentum3(x, y, z, vx, vy, vz)
    hxy = math.hypot(hx, hy)
    hm = math.hypot(hxy, hz)
    if not hm > 0:
        raise OrbitError(f"radial orbit (|h| = {hm})", "RETROGRADE")
    if hxy <= SIN_I_EQUATORIAL * hm:
        pro = hz > 0
        i = 0.0 if pro else math.pi
        raan = 0.0
        px, py = 1.0, 0.0
        qx, qy, qz = 0.0, (1.0 if pro else -1.0), 0.0
    else:
        i = math.atan2(hxy, hz)
        raan = wrap_angle(math.atan2(hx, -hy))
        px = -hy / hxy
        py = hx / hxy
        ux, uy, uz = hx / hm, hy / hm, hz / hm
        qx = -uz * py
        qy = uz * px
        qz = ux * py - uy * px
    X = x * px + y * py
    Y = x * qx + y * qy + z * qz
    VX = vx * px + vy * py
    VY = vx * qx + vy * qy + vz * qz
    el = state_to_elements(X, Y, VX, VY, mu, t, allow_unbound)
    return Elements3(el.a, el.e, el.w, el.M0, el.t0, i, raan)
