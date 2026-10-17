"""State vector to elements, 2-D prograde. Mirror of src/physics/elements.ts (GAME_PLAN 6.3)."""
from __future__ import annotations

import math

from .kepler import Elements, eccentric_from_true, wrap_angle

E_CIRCULAR = 1e-9


class OrbitError(ValueError):
    def __init__(self, message: str, kind: str):
        super().__init__(message)
        self.kind = kind  # 'RETROGRADE' | 'UNBOUND'


def state_to_elements(x: float, y: float, vx: float, vy: float, mu: float, t: float) -> Elements:
    rm = math.hypot(x, y)
    vm = math.hypot(vx, vy)
    h = x * vy - y * vx
    if not h > 0:
        raise OrbitError(f"retrograde or radial orbit (h = {h})", "RETROGRADE")
    eps = vm * vm / 2 - mu / rm
    if not eps < 0:
        raise OrbitError(f"unbound orbit (eps = {eps})", "UNBOUND")
    a = -mu / (2 * eps)

    rv = x * vx + y * vy
    k = vm * vm - mu / rm
    ex = (k * x - rv * vx) / mu
    ey = (k * y - rv * vy) / mu
    e = math.hypot(ex, ey)

    L = math.atan2(y, x)
    if e < E_CIRCULAR:
        w = 0.0
        nu = L
    else:
        w = wrap_angle(math.atan2(ey, ex))
        nu = L - w
    E = eccentric_from_true(nu, e)
    M0 = wrap_angle(E - e * math.sin(E))
    return Elements(a=a, e=0.0 if e < E_CIRCULAR else e, w=w, M0=M0, t0=t)
