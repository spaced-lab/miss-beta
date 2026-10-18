import unittest

from pymiss.physics.constants import AU, MU_SUN, YEAR
from pymiss.physics.kepler import Elements
from pymiss.physics.slow_push import gravity_tractor_force, integrate_push, tractor_propellant, yarkovsky_drift


class TestSlowPush(unittest.TestCase):
    def test_tractor_numbers(self):
        # 1 t tractor on a 100 m stony body (1.4e9 kg): a ~ G m / d^2 with d = 75 m -> 1.2e-11 m/s^2, ~0.4 mm/s per year
        F = gravity_tractor_force(1000, 1.4e9, 50)
        a = F / 1.4e9
        self.assertTrue(1e-11 < a < 2e-11, a)
        self.assertTrue(0.3e-3 < a * YEAR < 0.5e-3)
        self.assertGreater(tractor_propellant(1000, 1.4e9, 50, YEAR), 0)

    def test_push_arc_moves_energy(self):
        el = Elements(1.2 * AU, 0.3, 0.7, 2.0, 0.0)
        out, dv = integrate_push(el, MU_SUN, 0.0, YEAR, 1e-7)
        self.assertAlmostEqual(dv, 1e-7 * YEAR)
        self.assertGreater(out.a, el.a)  # along-track push raises the orbit

    def test_yarkovsky_not_viable(self):
        self.assertLess(yarkovsky_drift(10 * YEAR), 1000)  # ~300 m


if __name__ == "__main__":
    unittest.main()
