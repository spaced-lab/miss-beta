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
from pymiss.physics.flyby import flyby, soi_radius, turn_angle  # noqa: E402
from pymiss.physics.integrate import gravity_deriv, integrate  # noqa: E402
from pymiss.physics.sail import characteristic_accel, integrate_sail, sail_accel  # noqa: E402
from pymiss.physics.slow_push import gravity_tractor_force, integrate_push, tractor_propellant, yarkovsky_drift  # noqa: E402
from pymiss.physics.uncertainty import impact_probability, phi, sigma_v_with_arc  # noqa: E402
from pymiss.physics.nuclear import intercepted_fraction, nuclear_burst, warhead_mass  # noqa: E402
from pymiss.physics.photometry import absolute_magnitude, apparent_magnitude, view_geometry  # noqa: E402
from pymiss.physics.fragment import disrupt, f_3d, fragment_masses, largest_remnant_fraction, q_star, specific_energy  # noqa: E402
from pymiss.physics.estimates import LAUNCHERS, miss_from_impulse, miss_from_push, payload_for_c3  # noqa: E402
from pymiss.physics.kinetic import kinetic_impact  # noqa: E402
from pymiss.physics.lambert import lambert  # noqa: E402
from pymiss.physics.stumpff import stumpff_c, stumpff_s  # noqa: E402
from pymiss.physics.elements import OrbitError, state_to_elements  # noqa: E402
from pymiss.physics.kepler import Elements, propagate, solve_kepler, solve_kepler_hyperbolic  # noqa: E402
from pymiss.physics.risk import palermo, torino  # noqa: E402
from pymiss.physics.rocket import mass_ratio_for, rocket_dv, staged_dv  # noqa: E402
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
    hyp = []
    for _ in range(40):
        # Interstellar-class hyperbolae: a in [-4, -0.2] AU, e in [1.05, 6]; M spans both branches.
        el = Elements(a=-rng.float(0.2, 4) * AU, e=rng.float(1.05, 6), w=rng.float(0, 2 * math.pi), M0=rng.float(-3, 3), t0=rng.float(0, 1e9))
        t = el.t0 + rng.float(-3e7, 3e7)
        x, y, vx, vy = propagate(el, MU_SUN, t)
        back = state_to_elements(x, y, vx, vy, MU_SUN, t, allow_unbound=True)
        H = solve_kepler_hyperbolic(el.M0, el.e)
        hyp.append({"a": el.a, "e": el.e, "w": el.w, "M0": el.M0, "t0": el.t0, "mu": MU_SUN, "t": t, "x": x, "y": y, "vx": vx, "vy": vy, "H0": H, "backA": back.a, "backE": back.e, "backW": back.w, "backM0": back.M0})
    return {"solveKepler": solve, "propagate": prop, "stateToElements": s2e, "hyperbolic": hyp}


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


def fragment_vectors() -> dict:
    qs = [{"R": R, "rho": rho, "mult": mult, "material": mat, "Qstar": q_star(R, rho, mult, mat)}
          for R, rho, mult, mat in ((100, 2700, 1.0, "basalt"), (500, 2700, 1.0, "basalt"), (5000, 2700, 1.0, "basalt"), (50, 1300, 0.5, "basalt"), (300, 600, 0.3, "ice"), (1000, 5300, 5.0, "basalt"))]
    lr = [{"Q": Q, "Qs": Qs, "f": largest_remnant_fraction(Q, Qs)} for Q, Qs in ((100, 400), (400, 400), (800, 400), (2000, 400), (0, 400))]
    rng = Rng(hash_seed("vectors:fragment:masses"))
    masses = {"seed": rng.get_state(), "total": 1e9, "n": 12, "masses": fragment_masses(Rng(rng.get_state()), 1e9, 12)}
    seed = hash_seed("vectors:fragment:disrupt")
    M = 1.4e9
    R = 50.0
    rho = 2700.0
    m = 1500.0
    ux, uy = 9000.0, -3000.0
    U = math.hypot(ux, uy)
    Q = specific_energy(m, M, U)
    Qs = q_star(R, rho)
    frags = disrupt(Rng(seed), M, R, rho, Q, Qs, m, ux, uy, 20000.0, 15000.0, 10)
    d = {"seed": seed, "M": M, "R": R, "rho": rho, "Q": Q, "Qstar": Qs, "m": m, "ux": ux, "uy": uy, "vtx": 20000.0, "vty": 15000.0, "n": 10,
         "fragments": [{"mass": f.mass, "D": f.D, "vx": f.vx, "vy": f.vy, "lr": f.largest_remnant} for f in frags]}
    f3 = [{"bCrit": b, "vEj": v, "T": T, "f": f_3d(b, v, T)} for b, v, T in ((9.5e6, 1.0, 3e8), (9.5e6, 0.01, 3e8), (9.5e6, 5.0, 6e7))]
    return {"qStar": qs, "largestRemnant": lr, "masses": masses, "disrupt": d, "f3D": f3}


def photometry_vectors() -> dict:
    H = [{"D": D, "p": p, "H": absolute_magnitude(D, p)} for D, p in ((140, 0.14), (1000, 0.14), (20, 0.14), (50, 0.06), (300, 0.2))]
    V = [{"H": h, "r": r, "d": d, "a": a, "V": apparent_magnitude(h, r, d, a)} for h, r, d, a in ((22, 1.1, 0.1, 20), (22, 1.1, 1.0, 20), (17.7, 2.3, 1.4, 12))]
    G = []
    for tx, ty, ox, oy in ((1.5 * AU, 0.0, AU, 0.0), (0.9 * AU, 0.02 * AU, AU, 0.0), (0.3 * AU, 1.2 * AU, -0.5 * AU, 0.8 * AU)):
        r, d, a, e = view_geometry(tx, ty, ox, oy)
        G.append({"tx": tx, "ty": ty, "ox": ox, "oy": oy, "r": r, "d": d, "alpha": a, "eps": e})
    return {"H": H, "V": V, "geometry": G}


def nuclear_vectors() -> dict:
    cases = []
    for y, mode, M, R, H in ((1.0, "STANDOFF", 1.41e12, 500.0, 250.0), (0.3, "STANDOFF", 3.8e10, 150.0, 75.0), (1.0, "SURFACE", 1.41e12, 500.0, 0.0), (5.0, "SUBSURFACE", 1.4e13, 1000.0, 0.0), (1.0, "HAIV", 1.41e12, 500.0, 0.0)):
        e, dp, dv, Q, f = nuclear_burst(y, mode, M, R, H)
        cases.append({"yieldMt": y, "mode": mode, "M": M, "R": R, "H": H, "eAbs": e, "dp": dp, "dv": dv, "Q": Q, "fOmega": f})
    fo = [{"R": R, "H": H, "f": intercepted_fraction(R, H)} for R, H in ((500, 250), (500, 0.0), (500, 5000), (100, 50))]
    return {"burst": cases, "fOmega": fo, "mass": [{"Mt": y, "kg": warhead_mass(y)} for y in (0.1, 0.3, 1, 5)]}


def slow_push_vectors() -> dict:
    el = Elements(1.2 * AU, 0.3, 0.7, 2.0, 0.0)
    out_el, dv = integrate_push(el, MU_SUN, 0.0, YEAR, 1e-7)
    return {"push": {"a": 1.2 * AU, "e": 0.3, "w": 0.7, "M0": 2.0, "accel": 1e-7, "t1": YEAR, "outA": out_el.a, "outE": out_el.e, "outW": out_el.w, "outM0": out_el.M0, "dv": dv},
            "tractor": [{"mSc": m, "M": M, "R": R, "F": gravity_tractor_force(m, M, R), "prop1y": tractor_propellant(m, M, R, YEAR)} for m, M, R in ((1000, 1.4e9, 50), (20000, 3.8e10, 150))],
            "yarkovsky10y": yarkovsky_drift(10 * YEAR)}


def uncertainty_vectors() -> dict:
    return {"phi": [{"x": x, "p": phi(x)} for x in (-3, -1, -0.5, 0, 0.5, 1, 2, 3)],
            "pImpact": [{"d": d, "b": b, "s": s, "p": impact_probability(d, b, s)} for d, b, s in ((0, 9.5e6, 1e6), (0, 9.5e6, 2e7), (2e7, 9.5e6, 1e7), (5e6, 9.5e6, 0))],
            "arc": [{"tier": t, "days": d, "s": sigma_v_with_arc(t, d)} for t, d in ((0, 0), (0, 30), (0, 300), (1, 3000), (2, 3))]}


def risk_vectors() -> dict:
    """Torino / Palermo over a log grid of (P, E, T), and rocket-equation samples (LAB_TORINO, LAB_ROCKET_EQ)."""
    rng = Rng(hash_seed("vectors:risk"))
    risk = []
    for _ in range(60):
        P = 10 ** rng.float(-8, 0)
        E = 10 ** rng.float(-1, 8)
        T = rng.float(1, 100)
        risk.append({"P": P, "E": E, "T": T, "torino": torino(P, E), "palermo": palermo(P, E, T)})
    rocket = []
    for _ in range(20):
        isp = rng.float(200, 4000)
        f = rng.float(0.5, 0.95)
        n = rng.int(1, 4)
        dv = staged_dv(isp, f, n)
        rocket.append({"isp": isp, "f": f, "n": n, "dv": dv, "dv1": rocket_dv(isp, 1 / (1 - f)), "ratio": mass_ratio_for(dv, isp)})
    return {"risk": risk, "rocket": rocket}


def m4_vectors() -> dict:
    # RK4 two-body: one quarter orbit at 1 AU with 6 h steps, compare against Kepler in the TS test.
    from pymiss.physics.kepler import vis_viva
    vc = vis_viva(MU_SUN, AU, AU)
    s = integrate(gravity_deriv(MU_SUN), (AU, 0.0, 0.0, vc), 0.0, 0.25 * YEAR, 6 * 3600)
    rk4 = {"t1": 0.25 * YEAR, "h": 6 * 3600, "x": s[0], "y": s[1], "vx": s[2], "vy": s[3]}
    # Sail: tier 3 SPIRAL_OUT for one year from 1 AU circular.
    a_c = characteristic_accel(0.01, 0.9)
    st, dv = integrate_sail((AU, 0.0, 0.0, vc), 0.0, YEAR, a_c, MU_SUN, "SPIRAL_OUT")
    sail = {"aC": a_c, "law": "SPIRAL_OUT", "t1": YEAR, "x": st[0], "y": st[1], "vx": st[2], "vy": st[3], "dvEquiv": dv,
            "accel": [{"x": x, "y": y, "alpha": al, "ax": sail_accel(x, y, al, a_c)[0], "ay": sail_accel(x, y, al, a_c)[1]} for x, y, al in ((AU, 0.0, 0.6155), (0.0, 1.5 * AU, -0.3), (AU, AU, 0.0), (AU, 0.0, 1.6))]}
    mu_giant = 1.26686534e17
    R_giant = 6.9911e7
    cases = [{"rP": 10 * R_giant, "vInf": 1e4, "mu": mu_giant, "delta": turn_angle(10 * R_giant, 1e4, mu_giant)},
             {"rP": 3 * R_giant, "vInf": 2e4, "mu": mu_giant, "delta": turn_angle(3 * R_giant, 2e4, mu_giant)},
             {"rP": 6.0518e6 + 3e5, "vInf": 8e3, "mu": 3.24859e14, "delta": turn_angle(6.0518e6 + 3e5, 8e3, 3.24859e14)}]
    fb = flyby(1e4, 2e3, 0.0, 13000.0, cases[0]["delta"], 1, mu_giant)
    fly = {"turn": cases, "soi": soi_radius(5.203 * AU, mu_giant, MU_SUN), "flyby": {"vsx": 1e4, "vsy": 2e3, "vpx": 0.0, "vpy": 13000.0, "delta": cases[0]["delta"], "side": 1, "mu": mu_giant, "outx": fb[0], "outy": fb[1], "voutx": fb[2], "vouty": fb[3], "dvHelio": fb[4], "rP": fb[5]}}
    return {"rk4": rk4, "sail": sail, "flyby": fly}


if __name__ == "__main__":
    write("kepler.json", kepler_vectors())
    write("closeApproach.json", close_approach_vectors())
    write("lambert.json", lambert_vectors())
    write("fragment.json", fragment_vectors())
    write("m4.json", m4_vectors())
    write("photometry.json", photometry_vectors())
    write("nuclear.json", nuclear_vectors())
    write("slowPush.json", slow_push_vectors())
    write("uncertainty.json", uncertainty_vectors())
    write("rng.json", rng_vectors())
    write("risk.json", risk_vectors())
