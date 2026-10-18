"""Fragmentation. Mirror of src/physics/fragment.ts (GAME_PLAN 6.10). Same draw order from the same Rng."""
from __future__ import annotations

import math
from dataclasses import dataclass

from ..sim.rng import Rng
from .constants import G

QSTAR_BASALT = {"Q0": 9.0e7, "a": -0.36, "B": 0.5, "b": 1.36}
QSTAR_ICE = {"Q0": 1.6e7, "a": -0.39, "B": 1.2, "b": 1.26}
FRAG_PARETO_ALPHA = 2.5
K_EJ = 1.0
F3D_K = 0.6


def q_star(R: float, rho: float, strength_mult: float = 1.0, material: str = "basalt") -> float:
    c = QSTAR_ICE if material == "ice" else QSTAR_BASALT
    r_cm = R * 100
    rho_cgs = rho / 1000
    q_cgs = c["Q0"] * r_cm ** c["a"] + c["B"] * rho_cgs * r_cm ** c["b"]
    return q_cgs * 1e-4 * strength_mult


def specific_energy(m: float, M: float, U: float) -> float:
    return 0.5 * m * U * U / M


def largest_remnant_fraction(Q: float, Qs: float) -> float:
    return max(0.02, min(0.5, 1 - 0.5 * (Q / Qs)))


def diameter_from_mass(mass: float, rho: float) -> float:
    return 2 * (3 * mass / (4 * math.pi * rho)) ** (1 / 3)


def escape_speed_body(M: float, R: float) -> float:
    return math.sqrt(2 * G * M / R)


def fragment_masses(rng: Rng, total: float, n: int, alpha: float = FRAG_PARETO_ALPHA) -> list[float]:
    sizes = []
    for _ in range(n):
        u = 0.0
        while u == 0.0:
            u = rng.next()
        sizes.append(u ** (-1 / alpha))
    weights = [d * d * d for d in sizes]
    s = sum(weights)
    masses = [w / s * total for w in weights]
    masses.sort(reverse=True)
    drift = total - sum(masses)
    if masses:
        masses[0] += drift
    return masses


@dataclass(frozen=True)
class Fragment:
    mass: float
    D: float
    vx: float
    vy: float
    largest_remnant: bool


def disrupt(rng: Rng, M: float, R: float, rho: float, Q: float, Qstar: float, m: float, ux: float, uy: float,
            vtx: float, vty: float, n_frag: int, k_ej: float = K_EJ) -> list[Fragment]:
    f_lr = largest_remnant_fraction(Q, Qstar)
    m_lr = f_lr * M
    remainder = M - m_lr
    pieces = fragment_masses(rng, remainder, max(1, n_frag))
    masses = [m_lr] + pieces
    kcom = m / (M + m)
    dv_com = (kcom * ux, kcom * uy)
    v_esc = escape_speed_body(M, R)
    scale = k_ej * v_esc * math.sqrt(Q / Qstar)
    ej = []
    for _ in masses:
        speed = rng.rayleigh(scale)
        ang = rng.float(0, 2 * math.pi)
        ej.append((speed * math.cos(ang), speed * math.sin(ang)))
    px = sum(mi * e[0] for mi, e in zip(masses, ej))
    py = sum(mi * e[1] for mi, e in zip(masses, ej))
    mx, my = px / M, py / M
    out = []
    for i, (mass, e) in enumerate(zip(masses, ej)):
        out.append(Fragment(mass, diameter_from_mass(mass, rho), vtx + dv_com[0] + e[0] - mx, vty + dv_com[1] + e[1] - my, i == 0))
    return out


def f_3d(b_crit: float, v_ej: float, T: float) -> float:
    denom = F3D_K * v_ej * T
    return min(1.0, b_crit / denom) if denom > 0 else 1.0

FRAG_HARMLESS_D = 25.0
FRAG_HARMLESS_D_IRON = 10.0


def harmless_diameter(iron: bool) -> float:
    """Below this diameter (m) a fragment airbursts harmlessly (GAME_PLAN 6.4). Mirror of harmlessDiameter."""
    return FRAG_HARMLESS_D_IRON if iron else FRAG_HARMLESS_D
