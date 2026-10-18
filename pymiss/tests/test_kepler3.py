"""M14 phase 1: 3-D Kepler mirror. Same checks as tests/kepler3.test.ts, plus the shared vectors."""
import json
import math
import os
import unittest

from pymiss.physics.close_approach import close_approach
from pymiss.physics.close_approach3 import close_approach3
from pymiss.physics.constants import AU, MU_HOME, MU_SUN, R_HOME, YEAR
from pymiss.physics.elements import OrbitError, state_to_elements
from pymiss.physics.elements3 import state_to_elements3
from pymiss.physics.kepler import Elements, period, propagate
from pymiss.physics.kepler3 import Elements3, angular_momentum3, lift_elements, propagate3
from pymiss.sim.rng import Rng

VEC = os.path.join(os.path.dirname(__file__), "..", "..", "tests", "vectors")
MU_EARTH = 3.986004418e14
DEG = math.pi / 180


def _load(name):
    with open(os.path.join(VEC, name), encoding="utf-8") as f:
        return json.load(f)


def _rand_el3(rng, hyp):
    if hyp:
        return Elements3(-rng.float(0.2, 4) * AU, rng.float(1.05, 6), rng.float(0, 2 * math.pi), rng.float(-3, 3), rng.float(0, 1e9), rng.float(0, math.pi), rng.float(0, 2 * math.pi))
    return Elements3(rng.float(0.3, 6) * AU, rng.float(0, 0.95), rng.float(0, 2 * math.pi), rng.float(0, 2 * math.pi), rng.float(0, 1e9), rng.float(0, math.pi), rng.float(0, 2 * math.pi))


class TestPlanarEquivalence(unittest.TestCase):
    def test_propagate3_lift_is_planar(self):
        rng = Rng(1401)
        for k in range(200):
            hyp = k % 4 == 0
            e3 = _rand_el3(rng, hyp)
            el = Elements(e3.a, e3.e, e3.w, e3.M0, e3.t0)
            t = el.t0 + (rng.float(-3e7, 3e7) if hyp else rng.float(0, 1e9))
            x, y, vx, vy = propagate(el, MU_SUN, t)
            X, Y, Z, VX, VY, VZ = propagate3(lift_elements(el), MU_SUN, t)
            self.assertEqual((X, Y, VX, VY), (x, y, vx, vy))
            self.assertEqual(abs(Z), 0.0)
            self.assertEqual(abs(VZ), 0.0)

    def test_state_to_elements3_planar(self):
        rng = Rng(1402)
        for k in range(200):
            hyp = k % 4 == 0
            e3 = _rand_el3(rng, hyp)
            el = Elements(e3.a, e3.e, e3.w, e3.M0, e3.t0)
            t = el.t0 + (rng.float(-3e7, 3e7) if hyp else rng.float(0, 1e9))
            x, y, vx, vy = propagate(el, MU_SUN, t)
            b2 = state_to_elements(x, y, vx, vy, MU_SUN, t, True)
            b3 = state_to_elements3(x, y, 0.0, vx, vy, 0.0, MU_SUN, t, True)
            self.assertEqual((b3.i, b3.raan), (0.0, 0.0))
            self.assertEqual((b3.a, b3.e, b3.w, b3.M0, b3.t0), (b2.a, b2.e, b2.w, b2.M0, b2.t0))

    def test_close_approach3_lifted(self):
        for c in _load("closeApproach.json")["closeApproach"][:6]:
            th, ho = Elements(**c["threat"]), Elements(**c["home"])
            a = close_approach(th, ho, MU_SUN, MU_HOME, R_HOME, c["tNominal"])
            b = close_approach3(lift_elements(th), lift_elements(ho), MU_SUN, MU_HOME, R_HOME, c["tNominal"])
            self.assertLess(abs(a.t_ca - b.t_ca), 1e-3)
            self.assertLess(abs(a.d_min - b.d_min), 1e-3)
            self.assertEqual(a.impact, b.impact)


class TestThreeD(unittest.TestCase):
    def test_retrograde_is_i_pi(self):
        with self.assertRaises(OrbitError):
            state_to_elements(AU, 0.0, 3000.0, -29780.0, MU_SUN, 0.0)
        el = state_to_elements3(AU, 0.0, 0.0, 3000.0, -29780.0, 0.0, MU_SUN, 0.0)
        self.assertEqual(el.i, math.pi)
        x, y, z, vx, vy, vz = propagate3(el, MU_SUN, 0.0)
        self.assertLess(abs(x - AU), 1e-3)
        self.assertLess(abs(vy + 29780.0), 1e-9)

    def test_roundtrip_elliptic_and_hyperbolic(self):
        rng = Rng(1403)
        for k in range(200):
            hyp = k % 3 == 0
            el = _rand_el3(rng, hyp)
            t = el.t0 + (rng.float(-3e7, 3e7) if hyp else rng.float(0, 1e9))
            s = propagate3(el, MU_SUN, t)
            back = state_to_elements3(*s, MU_SUN, t, True)
            s2 = propagate3(back, MU_SUN, t)
            r = math.hypot(*s[:3])
            v = math.hypot(*s[3:])
            self.assertLess(math.hypot(*(p - q for p, q in zip(s2[:3], s[:3]))) / r, 1e-10)
            self.assertLess(math.hypot(*(p - q for p, q in zip(s2[3:], s[3:]))) / v, 1e-10)
            self.assertAlmostEqual(back.i, el.i, places=9)

    def test_energy_and_h_conserved(self):
        el = Elements3(1.3 * AU, 0.6, 2.0, 0.4, 0.0, 1.1, 4.0)
        eps0 = -MU_SUN / (2 * el.a)
        h0 = angular_momentum3(*propagate3(el, MU_SUN, 0.0))
        hm0 = math.hypot(*h0)
        self.assertAlmostEqual(h0[2] / hm0, math.cos(el.i), places=12)
        T = period(MU_SUN, el.a)
        for k in range(201):
            s = propagate3(el, MU_SUN, k / 200 * T)
            eps = math.hypot(*s[3:]) ** 2 / 2 - MU_SUN / math.hypot(*s[:3])
            self.assertLess(abs((eps - eps0) / eps0), 1e-12)
            h = angular_momentum3(*s)
            self.assertLess(math.hypot(*(p - q for p, q in zip(h, h0))) / hm0, 1e-12)

    def test_polar_circular(self):
        el = Elements3(7000e3, 0.0, 0.0, 0.0, 0.0, 90 * DEG, 0.0)
        x, y, z, vx, vy, vz = propagate3(el, MU_EARTH, 0.0)
        self.assertAlmostEqual(x, 7000e3, places=6)
        self.assertAlmostEqual(vz, 7546.05, places=2)
        q = propagate3(el, MU_EARTH, period(MU_EARTH, el.a) / 4)
        self.assertAlmostEqual(q[2] / 7000e3, 1.0, places=12)
        back = state_to_elements3(x, y, z, vx, vy, vz, MU_EARTH, 0.0)
        self.assertAlmostEqual(back.i, 90 * DEG, places=14)

    def test_iss_like(self):
        el = Elements3(6778.137e3, 0.0005, 1.0, 0.5, 0.0, 51.64 * DEG, 2.0)
        T = period(MU_EARTH, el.a)
        self.assertAlmostEqual(T / 60, 92.56, places=1)
        z_max = max(abs(propagate3(el, MU_EARTH, k / 2000 * T)[2]) for k in range(2000))
        self.assertAlmostEqual(z_max / (el.a * math.sin(el.i)), 1.0, places=3)

    def test_hyperbola(self):
        el = Elements3(-AU, 2.0, 0.5, 0.0, 0.0, 30 * DEG, 1.0)
        s = propagate3(el, MU_SUN, 0.0)
        self.assertAlmostEqual(math.hypot(*s[:3]) / AU, 1.0, places=12)
        self.assertAlmostEqual(math.hypot(*s[3:]) / math.sqrt(3 * MU_SUN / AU), 1.0, places=12)
        self.assertAlmostEqual(s[2] / AU, math.sin(0.5) * 0.5, places=12)
        back = state_to_elements3(*s, MU_SUN, 0.0, True)
        self.assertAlmostEqual(back.raan, 1.0, places=12)
        self.assertAlmostEqual(back.w, 0.5, places=10)

    def test_tilted_collision(self):
        home = lift_elements(Elements(AU, 0.017, 0.3, 1.1, 0.0))
        t_i = 5 * YEAR
        hx, hy, hz, hvx, hvy, hvz = propagate3(home, MU_SUN, t_i)
        c, s = math.cos(0.4), math.sin(0.4)
        el = state_to_elements3(hx, hy, hz, hvx + 12e3 * c * math.cos(1), hvy + 12e3 * c * math.sin(1), hvz + 12e3 * s, MU_SUN, t_i)
        ca = close_approach3(el, home, MU_SUN, MU_HOME, R_HOME, t_i)
        self.assertTrue(ca.impact)
        self.assertLess(ca.d_min, 1e5)


class TestVectors(unittest.TestCase):
    def test_kepler3(self):
        v = _load("kepler3.json")
        for c in v["propagate3"] + v["hyperbolic3"]:
            el = Elements3(c["a"], c["e"], c["w"], c["M0"], c["t0"], c["i"], c["raan"])
            self.assertEqual(propagate3(el, c["mu"], c["t"]), (c["x"], c["y"], c["z"], c["vx"], c["vy"], c["vz"]))

    def test_elements3(self):
        for c in _load("elements3.json")["stateToElements3"]:
            el = state_to_elements3(c["x"], c["y"], c["z"], c["vx"], c["vy"], c["vz"], c["mu"], c["t"], True)
            self.assertEqual((el.a, el.e, el.w, el.M0, el.i, el.raan), (c["out_a"], c["out_e"], c["out_w"], c["out_M0"], c["out_i"], c["out_raan"]))

    def test_close_approach3(self):
        for c in _load("closeApproach3.json")["closeApproach3"][:4]:
            ca = close_approach3(Elements3(**c["threat"]), Elements3(**c["home"]), MU_SUN, MU_HOME, R_HOME, c["tNominal"])
            self.assertEqual((ca.t_ca, ca.d_min, ca.impact), (c["tCa"], c["dMin"], c["impact"]))


if __name__ == "__main__":
    unittest.main()
