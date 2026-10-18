import math
import unittest

from pymiss.physics.constants import AU, MU_SUN
from pymiss.physics.flyby import signed_angle
from pymiss.physics.fragment import harmless_diameter
from pymiss.physics.kepler import Elements, orbit_points
from pymiss.physics.kinetic import along_track
from pymiss.physics.nuclear import fuze_ok, yields_for_tier
from pymiss.physics.sail import sail_tier
from pymiss.physics.slow_push import push_force
from pymiss.physics.uncertainty import beta_assess_delay


class TestM11Mirrors(unittest.TestCase):
    """The functions added in M11 so every TypeScript physics export has a Python twin (GAME_PLAN 26.2)."""

    def test_small_mirrors(self):
        self.assertAlmostEqual(signed_angle(1, 0, 0, 1), math.pi / 2)
        self.assertAlmostEqual(signed_angle(1, 0, 0, -1), -math.pi / 2)
        self.assertEqual(harmless_diameter(False), 25.0)
        self.assertEqual(harmless_diameter(True), 10.0)
        self.assertAlmostEqual(along_track(1.0, 1.0, 1.0, 0.0), 1.0)
        self.assertEqual(along_track(1.0, 1.0, 0.0, 0.0), 0.0)
        self.assertTrue(fuze_ok(4000, 1))
        self.assertFalse(fuze_ok(6000, 1))
        self.assertFalse(fuze_ok(1, 0))
        self.assertEqual(yields_for_tier(2), [0.1, 0.3, 1.0])
        self.assertEqual(yields_for_tier(0), [])
        self.assertEqual(sail_tier(3)["sigma"], 0.01)
        with self.assertRaises(ValueError):
            sail_tier(9)
        self.assertEqual(beta_assess_delay(0), 60 * 86400.0)
        self.assertEqual(beta_assess_delay(99), 5 * 86400.0)

    def test_orbit_points_shapes(self):
        pts = orbit_points(Elements(AU, 0.0, 0.0, 0.0, 0.0), 64)
        self.assertEqual(len(pts), 64)
        for x, y in pts:
            self.assertAlmostEqual(math.hypot(x, y) / AU, 1.0, places=9)
        hyp = orbit_points(Elements(-0.5 * AU, 2.0, 0.0, 0.0, 0.0), 32, 5 * AU)
        self.assertEqual(len(hyp), 32)
        for x, y in hyp:
            self.assertLessEqual(math.hypot(x, y), 5.001 * AU)

    def test_push_force(self):
        self.assertAlmostEqual(push_force("ION_BEAM", 1, 1e9, 50), 0.5)
        self.assertAlmostEqual(push_force("LASER", 2, 1e9, 50), 3e-5 * 1e6)
        self.assertAlmostEqual(push_force("MASS_DRIVER", 0, 1e9, 50), 50.0)
        self.assertGreater(push_force("GRAVITY_TRACTOR", 2, 1.4e9, 50), 0)
        with self.assertRaises(ValueError):
            push_force("TETHER", 0, 1, 1)


if __name__ == "__main__":
    unittest.main()
