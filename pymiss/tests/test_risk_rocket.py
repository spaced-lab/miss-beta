import json
import math
import os
import unittest

from pymiss.physics.risk import background_frequency, palermo, torino, torino_band
from pymiss.physics.rocket import mass_ratio_for, rocket_dv, staged_dv
from pymiss.physics.slow_push import gravity_tractor_force, laser_force

_VEC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "tests", "vectors", "risk.json")


class TestRisk(unittest.TestCase):
    def test_hand_checked(self):
        self.assertAlmostEqual(background_frequency(8), 5.684e-3, places=6)
        self.assertAlmostEqual(palermo(0.03, 8, 7), -0.1226, places=3)
        self.assertEqual(torino(0.03, 8), 3)  # 2024 YR4
        self.assertEqual(torino(0.027, 500), 4)  # Apophis 2004
        self.assertEqual(torino(1.7e-3, 9), 1)  # 2023 DW
        self.assertEqual(torino(1e-9, 1e3), 0)
        self.assertEqual(torino(0.5, 0.5), 0)  # under 1 Mt
        self.assertEqual(torino(1.0, 50), 8)
        self.assertEqual(torino(1.0, 1e4), 9)
        self.assertEqual(torino(1.0, 1e7), 10)
        self.assertEqual(torino(0.5, 1e6), 7)
        self.assertEqual([torino_band(i) for i in (0, 1, 3, 6, 9)], ["WHITE", "GREEN", "YELLOW", "ORANGE", "RED"])

    def test_monotone_in_probability(self):
        for E in (2.0, 50.0, 3e3, 1e6):
            last = 0
            for k in range(81):
                lvl = torino(10 ** (-8 + k / 10), E)
                self.assertGreaterEqual(lvl, last)
                last = lvl

    def test_vectors(self):
        with open(_VEC, encoding="utf-8") as f:
            v = json.load(f)
        for c in v["risk"]:
            self.assertEqual(torino(c["P"], c["E"]), c["torino"])
            self.assertAlmostEqual(palermo(c["P"], c["E"], c["T"]), c["palermo"], places=12)


class TestRocket(unittest.TestCase):
    def test_hand_checked(self):
        self.assertAlmostEqual(rocket_dv(320, 5), 5050.62, places=1)
        self.assertAlmostEqual(staged_dv(320, 0.8, 2), 2 * rocket_dv(320, 5), places=9)
        self.assertAlmostEqual(mass_ratio_for(rocket_dv(320, 5), 320), 5.0, places=12)
        self.assertAlmostEqual(gravity_tractor_force(1000, 1.41e9, 50), 6.6743e-11 * 1000 * 1.41e9 / 75 ** 2)
        self.assertAlmostEqual(gravity_tractor_force(1000, 1.41e9, 50, 3.0), gravity_tractor_force(1000, 1.41e9, 50) / 4)
        self.assertAlmostEqual(laser_force(1e6), 30.0)
        self.assertTrue(math.isfinite(staged_dv(4000, 0.95, 4)))


if __name__ == "__main__":
    unittest.main()
