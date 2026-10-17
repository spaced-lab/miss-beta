import math
import unittest

from pymiss.physics.constants import AU, DAY, MU_SUN
from pymiss.physics.elements import OrbitError, state_to_elements
from pymiss.physics.kepler import Elements, period, propagate, solve_kepler, specific_energy, vis_viva
from pymiss.sim.rng import Rng


class TestKepler(unittest.TestCase):
    def test_period_home(self):
        self.assertLess(abs(period(MU_SUN, AU) / DAY - 365.25), 0.01)

    def test_solve_kepler_classic(self):
        self.assertAlmostEqual(solve_kepler(1.0, 0.5), 1.49870113351785, places=11)
        for e in (0.0, 0.3, 0.8, 0.95, 0.99):
            M = 0.1
            while M < 2 * math.pi:
                E = solve_kepler(M, e)
                self.assertAlmostEqual(E - e * math.sin(E), M, places=10)
                M += 0.37

    def test_circular_speed(self):
        x, y, vx, vy = propagate(Elements(AU, 0.0, 0.0, 0.0, 0.0), MU_SUN, 0.0)
        self.assertAlmostEqual(x / AU, 1.0, places=12)
        self.assertAlmostEqual(vy / 1000, 29.78, places=1)
        self.assertAlmostEqual(vis_viva(MU_SUN, AU, AU) / 1000, 29.78, places=1)

    def test_energy_constant(self):
        el = Elements(1.3 * AU, 0.6, 2.0, 0.4, 0.0)
        eps0 = -MU_SUN / (2 * el.a)
        T = period(MU_SUN, el.a)
        for i in range(401):
            x, y, vx, vy = propagate(el, MU_SUN, i / 400 * T)
            eps = specific_energy(MU_SUN, math.hypot(x, y), math.hypot(vx, vy))
            self.assertLess(abs((eps - eps0) / eps0), 1e-12)

    def test_roundtrip(self):
        rng = Rng(2026)
        for _ in range(200):
            el = Elements(rng.float(0.3, 6) * AU, rng.float(0, 0.95), rng.float(0, 2 * math.pi), rng.float(0, 2 * math.pi), rng.float(0, 1e9))
            t = el.t0 + rng.float(0, 1e9)
            x, y, vx, vy = propagate(el, MU_SUN, t)
            back = state_to_elements(x, y, vx, vy, MU_SUN, t)
            x2, y2, vx2, vy2 = propagate(back, MU_SUN, t)
            self.assertLess(math.hypot(x2 - x, y2 - y), 1.0)
            self.assertLess(math.hypot(vx2 - vx, vy2 - vy), 1e-6)
            self.assertAlmostEqual(back.a / el.a, 1.0, places=9)
            self.assertAlmostEqual(back.e, el.e, places=9)

    def test_rejects_bad_orbits(self):
        with self.assertRaises(OrbitError):
            state_to_elements(AU, 0, 0, -29780, MU_SUN, 0)
        with self.assertRaises(OrbitError):
            state_to_elements(AU, 0, 0, 60000, MU_SUN, 0)
        el = state_to_elements(AU, 0, 0, vis_viva(MU_SUN, AU, AU), MU_SUN, 0)
        self.assertEqual(el.e, 0.0)
        self.assertEqual(el.w, 0.0)


if __name__ == "__main__":
    unittest.main()
