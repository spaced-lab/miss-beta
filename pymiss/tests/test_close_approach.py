import math
import unittest

from pymiss.physics.close_approach import b_crit, close_approach, impact_category, impact_energy
from pymiss.physics.constants import AU, MU_HOME, MU_SUN, R_HOME, YEAR
from pymiss.physics.elements import state_to_elements
from pymiss.physics.kepler import Elements, propagate


class TestCloseApproach(unittest.TestCase):
    def test_focusing(self):
        # GAME_PLAN 16: v_inf = 10 km/s -> b_crit ≈ 1.50 R_home
        self.assertAlmostEqual(b_crit(MU_HOME, R_HOME, 10e3) / R_HOME, 1.50, places=1)

    def test_constructed_collision_impacts(self):
        home = Elements(AU, 0.017, 0.3, 1.1, 0.0)
        t_i = 5 * YEAR
        hx, hy, hvx, hvy = propagate(home, MU_SUN, t_i)
        el = state_to_elements(hx, hy, hvx + 12e3 * math.cos(1.0), hvy + 12e3 * math.sin(1.0), MU_SUN, t_i)
        ca = close_approach(el, home, MU_SUN, MU_HOME, R_HOME, t_i)
        self.assertTrue(ca.impact)
        self.assertLess(ca.d_min, 1e5)
        self.assertLess(abs(ca.t_ca - t_i), 5)
        self.assertAlmostEqual(ca.v_inf / 12e3, 1.0, places=6)

    def test_energy_and_category(self):
        m, e, mt = impact_energy(100, 2700, 20e3)
        self.assertAlmostEqual(m / 1.41e9, 1.0, places=1)
        self.assertGreater(mt, 60)
        self.assertLess(mt, 75)
        self.assertEqual(impact_category(20), "AIRBURST")
        self.assertEqual(impact_category(20, iron=True), "CITY")
        self.assertEqual(impact_category(500), "REGIONAL")
        self.assertEqual(impact_category(1000), "GLOBAL")


if __name__ == "__main__":
    unittest.main()
