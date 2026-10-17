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

from pymiss.physics.constants import AU, MU_SUN  # noqa: E402
from pymiss.physics.elements import state_to_elements  # noqa: E402
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


if __name__ == "__main__":
    write("kepler.json", kepler_vectors())
    write("rng.json", rng_vectors())
