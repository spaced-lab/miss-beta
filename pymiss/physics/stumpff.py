"""Stumpff functions. Mirror of src/physics/stumpff.ts."""
import math


def stumpff_s(z: float) -> float:
    if abs(z) < 1e-3:
        return 1 / 6 - z / 120 + z * z / 5040 - z * z * z / 362880
    if z > 0:
        s = math.sqrt(z)
        return (s - math.sin(s)) / (s * s * s)
    s = math.sqrt(-z)
    return (math.sinh(s) - s) / (s * s * s)


def stumpff_c(z: float) -> float:
    if abs(z) < 1e-3:
        return 1 / 2 - z / 24 + z * z / 720 - z * z * z / 40320
    if z > 0:
        return (1 - math.cos(math.sqrt(z))) / z
    return (math.cosh(math.sqrt(-z)) - 1) / -z
