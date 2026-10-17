import math
import unittest

from pymiss.physics.constants import AU, MU_SUN, YEAR
from pymiss.physics.flyby import flyby, turn_angle, turn_angle_max
from pymiss.physics.integrate import euler_step, gravity_deriv, integrate
from pymiss.physics.kepler import Elements, propagate, vis_viva
from pymiss.physics.sail import characteristic_accel, integrate_sail, lightness


class TestM4(unittest.TestCase):
    def test_rk4_tracks_kepler(self):
        vc = vis_viva(MU_SUN, AU, AU)
        s = integrate(gravity_deriv(MU_SUN), (AU, 0.0, 0.0, vc), 0.0, YEAR, 6 * 3600)
        x, y, vx, vy = propagate(Elements(AU, 0.0, 0.0, 0.0, 0.0), MU_SUN, YEAR)
        self.assertLess(math.hypot(s[0] - x, s[1] - y), 1e3)  # under a kilometre after a year
        e = integrate(gravity_deriv(MU_SUN), (AU, 0.0, 0.0, vc), 0.0, YEAR, 6 * 3600, euler_step)
        self.assertGreater(math.hypot(e[0] - x, e[1] - y), 1e8)  # Euler drifts by far more

    def test_sail_tier3_one_year(self):
        a_c = characteristic_accel(0.01, 0.9)
        self.assertAlmostEqual(a_c * 1e3, 0.817, places=2)
        self.assertAlmostEqual(lightness(a_c), 0.138, places=2)
        vc = vis_viva(MU_SUN, AU, AU)
        s, dv = integrate_sail((AU, 0.0, 0.0, vc), 0.0, YEAR, a_c, MU_SUN, "SPIRAL_OUT")
        self.assertTrue(6e3 < dv < 11e3, dv)  # plan's 8..11 holds at 1 AU; the spiral climbs (see STATUS.md)
        self.assertGreater(math.hypot(s[0], s[1]), 1.2 * AU)  # it climbed

    def test_flyby(self):
        mu_giant, R = 1.26686534e17, 6.9911e7
        self.assertAlmostEqual(math.degrees(turn_angle(10 * R, 1e4, mu_giant)), 80.2, places=1)
        self.assertGreater(turn_angle_max(R, 2 * R, 1e4, mu_giant), turn_angle(10 * R, 1e4, mu_giant))
        ox, oy, _, _, dv, r_p = flyby(1e4, 0.0, 0.0, 0.0, 1.0, 1, mu_giant)
        self.assertAlmostEqual(math.hypot(ox, oy), 1e4, places=9)
        self.assertAlmostEqual(dv, 2e4 * math.sin(0.5), places=6)
        self.assertAlmostEqual(turn_angle(r_p, 1e4, mu_giant), 1.0, places=12)


if __name__ == "__main__":
    unittest.main()
