import math
import unittest

from pymiss.physics.constants import AU, DAY, MU_SUN
from pymiss.physics.elements import state_to_elements
from pymiss.physics.estimates import launcher_tier, miss_from_impulse, payload_for_c3
from pymiss.physics.kepler import propagate, vis_viva
from pymiss.physics.kinetic import kinetic_dv, kinetic_impact
from pymiss.physics.lambert import lambert
from pymiss.physics.stumpff import stumpff_c, stumpff_s


class TestLambert(unittest.TestCase):
    def test_stumpff_limits(self):
        self.assertAlmostEqual(stumpff_s(0), 1 / 6, places=15)
        self.assertAlmostEqual(stumpff_c(0), 1 / 2, places=15)
        z = 1.1e-3
        self.assertAlmostEqual(stumpff_s(z), 1 / 6 - z / 120 + z * z / 5040 - z ** 3 / 362880, places=12)
        self.assertAlmostEqual(stumpff_s(1.0), 0.1585290151921035, places=12)
        self.assertAlmostEqual(stumpff_c(1.0), 0.4596976941318602, places=12)

    def test_near_hohmann(self):
        # GAME_PLAN 16 LAMBERT: 1.0 -> 1.524 AU, dt = 259 d, dep v_inf ≈ 2.94 km/s, arr ≈ 2.65 km/s within 2%
        th = math.radians(177)
        res = lambert(AU, 0, 1.524 * AU * math.cos(th), 1.524 * AU * math.sin(th), 259 * DAY, MU_SUN)
        self.assertIsNotNone(res)
        vc1 = vis_viva(MU_SUN, AU, AU)
        vc2 = vis_viva(MU_SUN, 1.524 * AU, 1.524 * AU)
        self.assertLess(abs((math.hypot(res.v1x, res.v1y) - vc1) / 2940 - 1), 0.02)
        self.assertLess(abs((vc2 - math.hypot(res.v2x, res.v2y)) / 2650 - 1), 0.02)

    def test_transfer_lands_on_target(self):
        r1 = (AU, 0.0)
        r2 = (2.0 * AU * math.cos(2.0), 2.0 * AU * math.sin(2.0))
        dt = 300 * DAY
        res = lambert(r1[0], r1[1], r2[0], r2[1], dt, MU_SUN)
        el = state_to_elements(r1[0], r1[1], res.v1x, res.v1y, MU_SUN, 0.0)
        x, y, vx, vy = propagate(el, MU_SUN, dt)
        self.assertLess(math.hypot(x - r2[0], y - r2[1]), 1000.0)
        self.assertLess(math.hypot(vx - res.v2x, vy - res.v2y), 1e-3)

    def test_degenerate_returns_none(self):
        self.assertIsNone(lambert(AU, 0, -AU, 0, 100 * DAY, MU_SUN))
        self.assertIsNone(lambert(AU, 0, 2 * AU, 0, 100 * DAY, MU_SUN))

    def test_dart(self):
        self.assertAlmostEqual(kinetic_dv(580, 4.3e9, 6140, 3.6) / 2.98e-3, 1.0, places=2)
        dvx, dvy, U, Q = kinetic_impact(580, 4.3e9, 6140, 0, 0, 0, 3.6)
        self.assertAlmostEqual(U, 6140)
        self.assertAlmostEqual(dvx, kinetic_dv(580, 4.3e9, 6140, 3.6))

    def test_estimates(self):
        self.assertAlmostEqual(miss_from_impulse(0.01, 10 * 3.15576e7) / 9.47e6, 1.0, places=2)
        t1 = launcher_tier(1)
        self.assertEqual(payload_for_c3(t1, 0), 4000)
        self.assertAlmostEqual(payload_for_c3(t1, 10), math.sqrt(4000 * 2000), places=6)
        self.assertEqual(payload_for_c3(t1, 80), 0)
        self.assertEqual(payload_for_c3(t1, 200), 0)


if __name__ == "__main__":
    unittest.main()
