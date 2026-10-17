#!/usr/bin/env python3
"""Generate the shared test vectors in tests/vectors/*.json from pymiss.

Both test suites consume these files: vitest (tests/*.test.ts) checks that the TypeScript physics
reproduces them, and pymiss/tests checks that the Python does (trivially, since it wrote them, but the
Python tests also hold hand-checked numbers). Inputs are drawn from the mirrored seeded RNG so this script
is deterministic; re-running it must not change a byte unless the physics changed.

Usage: python3 scripts/gen_vectors.py
"""
from __future__ import annotations

import json
import math
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from pymiss.physics.close_approach import b_crit, close_approach, impact_energy  # noqa: E402
from pymiss.physics.constants import AU, DAY, MU_HOME, MU_SUN, R_HOME, YEAR  # noqa: E402
from pymiss.physics.estimates import LAUNCHERS, miss_from_impulse, miss_from_push, payload_for_c3  # noqa: E402
from pymiss.physics.kinetic import kinetic_impact  # noqa: E402
from pymiss.physics.lambert import lambert  # noqa: E402
from pymiss.physics.stumpff import stumpff_c, stumpff_s  # noqa: E402
from pymiss.physics.elements import OrbitError, state_to_elements  # noqa: E402
from pymiss.physics.kepler import Elements, propagate, solve_kepler  # noqa: E402
from pymiss.sim.rng import Rng, hash_seed  # noqa: E402

OUT = os.path.join(ROOT, "tests", "vectors")


def write(name: str, data: object) -> None:
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=1, sort_keys=True)
        f.write("\n")
    print(f"wrote {os.path.relpath(path, ROOT)}")


def kepler_vectors() -> dict:
    rng = Rng(hash_seed("vectors:kepler"))
    solve = []
    for _ in range(40):
        e = rng.float(0, 0.99)
        M = rng.float(0, 2 * math.pi)
        solve.append({"M": M, "e": e, "E": solve_kepler(M, e)})
    prop = []
    s2e = []
    for _ in range(40):
        el = Elements(a=rng.float(0.3, 6) * AU, e=rng.float(0, 0.95), w=rng.float(0, 2 * math.pi), M0=rng.float(0, 2 * math.pi), t0=rng.float(0, 1e9))
        t = el.t0 + rng.float(0, 1e9)
        x, y, vx, vy = propagate(el, MU_SUN, t)
        prop.append({"a": el.a, "e": el.e, "w": el.w, "M0": el.M0, "t0": el.t0, "mu": MU_SUN, "t": t, "x": x, "y": y, "vx": vx, "vy": vy})
        back = state_to_elements(x, y, vx, vy, MU_SUN, t)
        s2e.append({"x": x, "y": y, "vx": vx, "vy": vy, "mu": MU_SUN, "t": t, "a": back.a, "e": back.e, "w": back.w, "M0": back.M0})
    return {"solveKepler": solve, "propagate": prop, "stateToElements": s2e}


def rng_vectors() -> dict:
    out = []
    for seed in [0, 1, 42, 123456789, 0xFFFFFFFF]:
        r = Rng(seed)
        out.append({"seed": seed, "first": [r.next() for _ in range(8)]})
    hashes = {s: hash_seed(s) for s in ["", "TUTORIAL-1", "8F3A21C9", "ABC#1", "MISS β"]}
    return {"streams": out, "hashSeed": hashes}


def close_approach_vectors() -> dict:
    rng = Rng(hash_seed("vectors:closeApproach"))
    home = Elements(a=AU, e=0.017, w=0.3, M0=1.1, t0=0.0)
    cases = []
    for _ in range(20):
        # Build a colliding threat the way roundGen does, then offset its periapsis longitude a little so
        # d_min is a real number, not zero.
        t_i = rng.float(2, 8) * YEAR
        hx, hy, hvx, hvy = propagate(home, MU_SUN, t_i)
        u = rng.float(8e3, 25e3)
        phi = rng.float(0, 2 * math.pi)
        try:
            el = state_to_elements(hx, hy, hvx + u * math.cos(phi), hvy + u * math.sin(phi), MU_SUN, t_i)
        except OrbitError:
            continue
        if el.e >= 0.98 or el.a * (1 - el.e) < 0.25 * AU:
            continue
        nudged = Elements(el.a, el.e, el.w + rng.float(-2e-6, 2e-6), el.M0, el.t0)
        ca = close_approach(nudged, home, MU_SUN, MU_HOME, R_HOME, t_i)
        cases.append({"threat": nudged.__dict__, "home": home.__dict__, "tNominal": t_i, "tCa": ca.t_ca, "dMin": ca.d_min, "vInf": ca.v_inf, "bCrit": ca.b_crit, "impact": ca.impact})
    bc = [{"vInf": v, "bCrit": b_crit(MU_HOME, R_HOME, v)} for v in (5e3, 1e4, 2e4, 5e4)]
    en = [{"D": D, "rho": rho, "v": v, "Mt": impact_energy(D, rho, v)[2]} for D, rho, v in ((100, 2700, 20e3), (1000, 2700, 20e3), (20, 2700, 20e3), (500, 1300, 15e3))]
    return {"closeApproach": cases, "bCrit": bc, "energy": en}


def lambert_vectors() -> dict:
    rng = Rng(hash_seed("vectors:lambert"))
    st = [{"z": z, "S": stumpff_s(z), "C": stumpff_c(z)} for z in (-30.0, -2.5, -1e-7, 0.0, 1e-7, 0.5, 4.0, 20.0, 38.0)]
    cases = []
    tries = 0
    while len(cases) < 30 and tries < 400:
        tries += 1
        r1 = rng.float(0.7, 1.5) * AU
        t1 = rng.float(0, 2 * math.pi)
        r2 = rng.float(0.5, 5.5) * AU
        t2 = t1 + rng.float(0.1, 2 * math.pi - 0.1)
        dt = rng.float(30, 900) * DAY
        res = lambert(r1 * math.cos(t1), r1 * math.sin(t1), r2 * math.cos(t2), r2 * math.sin(t2), dt, MU_SUN)
        if res is None:
            continue
        cases.append({"r1x": r1 * math.cos(t1), "r1y": r1 * math.sin(t1), "r2x": r2 * math.cos(t2), "r2y": r2 * math.sin(t2), "dt": dt, "mu": MU_SUN,
                      "v1x": res.v1x, "v1y": res.v1y, "v2x": res.v2x, "v2y": res.v2y, "z": res.z, "dtheta": res.dtheta})
    kin = []
    for _ in range(10):
        m = rng.float(300, 20000)
        M = rng.float(1e8, 1e12)
        vix, viy, vtx, vty = rng.float(-4e4, 4e4), rng.float(-4e4, 4e4), rng.float(-3e4, 3e4), rng.float(-3e4, 3e4)
        beta = rng.float(1, 5)
        dvx, dvy, U, Q = kinetic_impact(m, M, vix, viy, vtx, vty, beta)
        kin.append({"m": m, "M": M, "vix": vix, "viy": viy, "vtx": vtx, "vty": vty, "beta": beta, "dvx": dvx, "dvy": dvy, "U": U, "Q": Q})
    est = {"impulse": [{"dv": dv, "T": T, "miss": miss_from_impulse(dv, T)} for dv, T in ((0.01, 10 * YEAR), (0.0019, 6 * YEAR), (1.0, DAY))],
           "push": [{"a": a, "tau": tau, "tRem": tr, "miss": miss_from_push(a, tau, tr)} for a, tau, tr in ((1e-9, YEAR, 2 * YEAR), (5e-10, 0.5 * YEAR, 0.0))],
           "payload": [{"tier": t["tier"], "c3": c3, "kg": payload_for_c3(t, c3)} for t in LAUNCHERS for c3 in (0, 10, 25, 55, 85, 120, 200)]}
    return {"stumpff": st, "lambert": cases, "kinetic": kin, "estimates": est}


if __name__ == "__main__":
    write("kepler.json", kepler_vectors())
    write("closeApproach.json", close_approach_vectors())
    write("lambert.json", lambert_vectors())
    write("rng.json", rng_vectors())
