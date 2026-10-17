import math
import unittest

from pymiss.physics.fragment import disrupt, fragment_masses, largest_remnant_fraction, q_star, specific_energy
from pymiss.sim.rng import Rng


class TestFragment(unittest.TestCase):
    def test_qstar_sanity(self):
        # GAME_PLAN 6.10 sanity values (basalt, rho 2.7): R=100 m ~360, R=500 m ~510, R=5 km ~7600 J/kg
        self.assertTrue(300 < q_star(100, 2700) < 400)
        self.assertTrue(400 < q_star(500, 2700) < 650)
        self.assertTrue(5000 < q_star(5000, 2700) < 10000)

    def test_largest_remnant(self):
        self.assertEqual(largest_remnant_fraction(100, 400), 0.5)
        self.assertAlmostEqual(largest_remnant_fraction(800, 400), 0.02)
        self.assertAlmostEqual(largest_remnant_fraction(600, 400), 0.25)

    def test_masses_sum(self):
        ms = fragment_masses(Rng(3), 1e9, 20)
        self.assertEqual(len(ms), 20)
        self.assertLess(abs(sum(ms) - 1e9) / 1e9, 1e-12)
        self.assertEqual(ms, sorted(ms, reverse=True))

    def test_disrupt_conserves_mass_and_momentum(self):
        M, R, rho, m = 1.4e9, 50.0, 2700.0, 20000.0
        ux, uy = 12000.0, 0.0
        Q = specific_energy(m, M, math.hypot(ux, uy))
        Qs = q_star(R, rho)
        self.assertGreater(Q, Qs)
        frags = disrupt(Rng(9), M, R, rho, Q, Qs, m, ux, uy, 30000.0, 0.0, 15)
        self.assertEqual(len(frags), 16)
        self.assertLess(abs(sum(f.mass for f in frags) - M) / M, 1e-9)
        px = sum(f.mass * f.vx for f in frags)
        py = sum(f.mass * f.vy for f in frags)
        # Total momentum = M v_threat + m U (beta = 1)
        self.assertLess(abs(px - (M * 30000.0 + m * ux)) / (M * 30000.0), 1e-6)
        self.assertLess(abs(py - (0.0 + m * uy)) / (M * 30000.0), 1e-6)
        self.assertTrue(frags[0].largest_remnant)


if __name__ == "__main__":
    unittest.main()
