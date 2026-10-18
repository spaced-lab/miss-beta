import unittest

from pymiss.physics.uncertainty import impact_probability, phi, sigma_b, sigma_v_with_arc


class TestUncertainty(unittest.TestCase):
    def test_phi(self):
        self.assertAlmostEqual(phi(0), 0.5, places=7)
        self.assertAlmostEqual(phi(1.96), 0.975, places=3)
        self.assertAlmostEqual(phi(-1.96), 0.025, places=3)

    def test_p_impact(self):
        self.assertGreater(impact_probability(0, 9.5e6, 1e6), 0.999)
        self.assertAlmostEqual(impact_probability(0, 9.5e6, 2e7), 0.3647, places=2)
        self.assertEqual(impact_probability(5e6, 9.5e6, 0), 1.0)
        self.assertEqual(impact_probability(2e7, 9.5e6, 0), 0.0)
        # GAME_PLAN 6.14 example: tier 0 with 10 years left spreads to 3 x 0.005 x 3.16e8 = 4.7e6 m ~ 0.5 R
        self.assertAlmostEqual(sigma_b(0.005, 3.15576e8) / 4.7e6, 1.0, places=1)

    def test_arc(self):
        self.assertEqual(sigma_v_with_arc(0, 0), 0.02)
        self.assertAlmostEqual(sigma_v_with_arc(0, 30), 0.02)
        self.assertEqual(sigma_v_with_arc(0, 1e6), 0.005)
        self.assertEqual(sigma_v_with_arc(2, 1e6), 0.0002)


if __name__ == "__main__":
    unittest.main()
