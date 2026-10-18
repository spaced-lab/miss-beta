"""Impact-risk scales: Palermo and the game's linearised Torino chart. Mirror of src/physics/risk.ts (EDUCATION F9)."""
from __future__ import annotations

import math


def background_frequency(e_mt: float) -> float:
    """f_B = 0.03 E^-0.8 per year. Example: 8 Mt -> 5.68e-3."""
    return 0.03 * e_mt ** -0.8


def palermo(P: float, e_mt: float, years: float) -> float:
    """PS = log10(P / (f_B T)). Example: P 0.03, E 8 Mt, T 7 yr -> -0.12."""
    return math.log10(P / (background_frequency(e_mt) * years))


def torino(P: float, e_mt: float) -> int:
    """Torino level 0..10 (linearised chart, see risk.ts). Example: P 0.03, E 8 Mt -> 3."""
    if not (P > 0) or not (e_mt >= 1):
        return 0
    if P >= 0.99:
        return 8 if e_mt < 1e2 else 9 if e_mt < 1e5 else 10
    if P >= 0.01:
        if e_mt < 1e2:
            return 3
        if e_mt < 1e5:
            return 4 if P < 0.1 else 5
        return 6 if P < 0.1 else 7
    if P >= 1e-2 / math.sqrt(e_mt):
        return 2
    if P >= 1e-2 / e_mt:
        return 1
    return 0


def torino_band(level: int) -> str:
    """0 WHITE, 1 GREEN, 2-4 YELLOW, 5-7 ORANGE, 8-10 RED."""
    if level <= 0:
        return "WHITE"
    if level == 1:
        return "GREEN"
    if level <= 4:
        return "YELLOW"
    if level <= 7:
        return "ORANGE"
    return "RED"
