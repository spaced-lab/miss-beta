"""Kinetic impactor deflection with beta. Mirror of src/physics/kinetic.ts (GAME_PLAN 6.9)."""
import math


def kinetic_impact(m: float, M: float, vix: float, viy: float, vtx: float, vty: float, beta: float) -> tuple[float, float, float, float]:
    """Return (dvx, dvy, U, Q)."""
    ux = vix - vtx
    uy = viy - vty
    U = math.hypot(ux, uy)
    k = beta * m / M
    return k * ux, k * uy, U, 0.5 * m * U * U / M


def kinetic_dv(m: float, M: float, U: float, beta: float) -> float:
    return beta * m * U / M

def along_track(dvx: float, dvy: float, vtx: float, vty: float) -> float:
    """Along-track component of dv given the threat velocity direction. Mirror of alongTrack."""
    v = math.hypot(vtx, vty)
    return (dvx * vtx + dvy * vty) / v if v > 0 else 0.0
