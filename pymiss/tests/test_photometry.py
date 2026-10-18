import unittest

from pymiss.physics.constants import AU
from pymiss.physics.photometry import absolute_magnitude, apparent_magnitude, diameter_from_h, view_geometry


class TestPhotometry(unittest.TestCase):
    def test_h(self):
        self.assertAlmostEqual(absolute_magnitude(140, 0.14), 22.0, places=1)
        self.assertAlmostEqual(absolute_magnitude(1000, 0.14), 17.75, places=1)
        self.assertAlmostEqual(absolute_magnitude(20, 0.14), 26.2, places=1)
        self.assertAlmostEqual(diameter_from_h(22.0, 0.14), 140, delta=1)

    def test_v(self):
        self.assertAlmostEqual(apparent_magnitude(22, 1.1, 0.1, 20), 17.9, places=1)
        self.assertAlmostEqual(apparent_magnitude(22, 1.1, 1.0, 20), 22.9, places=1)

    def test_geometry(self):
        r, d, a, e = view_geometry(1.5 * AU, 0.0, AU, 0.0)
        self.assertAlmostEqual(e, 180, places=6)
        self.assertAlmostEqual(a, 0, places=6)
        self.assertAlmostEqual(d, 0.5, places=9)


if __name__ == "__main__":
    unittest.main()
