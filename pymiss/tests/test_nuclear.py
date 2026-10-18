import unittest

from pymiss.physics.nuclear import intercepted_fraction, nuclear_burst, warhead_mass


class TestNuclear(unittest.TestCase):
    def test_calibration(self):
        # GAME_PLAN 16 NUCLEAR: 1 Mt standoff, H = R/2, D = 1 km stony -> 2..6 cm/s
        M = 4 / 3 * 3.141592653589793 * 500 ** 3 * 2700
        _, _, dv, Q, f = nuclear_burst(1.0, "STANDOFF", M, 500.0, 250.0)
        self.assertTrue(0.02 < dv < 0.06, dv)
        self.assertAlmostEqual(f, 0.1273, places=3)
        self.assertLess(Q, 400)  # no disruption of a 1 km stony body from a standoff burst

    def test_modes_and_mass(self):
        self.assertAlmostEqual(intercepted_fraction(500, 0.0), 0.5)
        self.assertLess(intercepted_fraction(500, 5000), 0.01)
        _, _, dv_s, _, _ = nuclear_burst(1.0, "SURFACE", 1e12, 500.0, 0.0)
        _, _, dv_b, _, _ = nuclear_burst(1.0, "SUBSURFACE", 1e12, 500.0, 0.0)
        self.assertGreater(dv_b, dv_s)
        self.assertEqual(warhead_mass(1), 2000)


if __name__ == "__main__":
    unittest.main()
