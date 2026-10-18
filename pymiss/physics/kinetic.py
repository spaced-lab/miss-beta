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


def kinetic_impact3(m: float, M: float, vi: tuple[float, float, float], vt: tuple[float, float, float], beta: float) -> tuple[float, float, float, float, float]:
    """3-D kinetic impact: return (dvx, dvy, dvz, U, Q). Mirror of kineticImpact3."""
    ux, uy, uz = vi[0] - vt[0], vi[1] - vt[1], vi[2] - vt[2]
    U = math.hypot(ux, uy, uz)
    k = beta * m / M
    return k * ux, k * uy, k * uz, U, 0.5 * m * U * U / M


def along_track3(dv: tuple[float, float, float], vt: tuple[float, float, float]) -> float:
    """Along-track part of a 3-D dv. Mirror of alongTrack3."""
    v = math.hypot(*vt)
    return (dv[0] * vt[0] + dv[1] * vt[1] + dv[2] * vt[2]) / v if v > 0 else 0.0
