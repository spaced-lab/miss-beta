"""M14 phase 2: lambert3 and kinetic_impact3 mirrors. Same checks as tests/lambert3.test.ts, plus the shared vectors."""
import json
import math
import os
import unittest

from pymiss.physics.constants import AU, DAY, MU_SUN
from pymiss.physics.elements3 import state_to_elements3
from pymiss.physics.kepler3 import propagate3
from pymiss.physics.kinetic import along_track3, kinetic_impact3
from pymiss.physics.lambert import lambert, lambert3

VEC = os.path.join(os.path.dirname(__file__), "..", "..", "tests", "vectors")


def _load(name):
    with open(os.path.join(VEC, name), encoding="utf-8") as f:
        return json.load(f)


class TestLambert3(unittest.TestCase):
    def test_planar_equivalence(self):
        for c in _load("lambert.json")["lambert"]:
            a = lambert(c["r1x"], c["r1y"], c["r2x"], c["r2y"], c["dt"], c["mu"])
            b = lambert3((c["r1x"], c["r1y"], 0.0), (c["r2x"], c["r2y"], 0.0), c["dt"], c["mu"])
            self.assertEqual((b.v1[0], b.v1[1], b.v2[0], b.v2[1], b.z), (a.v1x, a.v1y, a.v2x, a.v2y, a.z))

    def test_doc_example(self):
        s = lambert3((AU, 0.0, 0.0), (0.0, AU, 0.2 * AU), 100 * DAY, MU_SUN)
        self.assertAlmostEqual(s.dtheta, math.pi / 2, 12)
        self.assertAlmostEqual(s.v1[2] / 1000, 5.67, 2)

    def test_arc_reaches_r2(self):
        for c in _load("lambert3.json")["lambert3"]:
            s = lambert3(tuple(c["r1"]), tuple(c["r2"]), c["dt"], c["mu"], c["prograde"])
            el = state_to_elements3(*c["r1"], *s.v1, c["mu"], 0.0, True)
            x, y, z, *_ = propagate3(el, c["mu"], c["dt"])
            self.assertLess(math.dist((x, y, z), c["r2"]) / math.hypot(*c["r2"]), 1e-8)

    def test_vectors(self):
        for c in _load("lambert3.json")["lambert3"]:
            s = lambert3(tuple(c["r1"]), tuple(c["r2"]), c["dt"], c["mu"], c["prograde"])
            self.assertEqual((list(s.v1), list(s.v2), s.z), (c["v1"], c["v2"], c["z"]))

    def test_kinetic3(self):
        dvx, dvy, dvz, U, Q = kinetic_impact3(580, 4.3e9, (0.0, 0.0, 6140.0), (0.0, 0.0, 0.0), 3.6)
        self.assertAlmostEqual(dvz, 2.98e-3, 5)
        for c in _load("lambert3.json")["kinetic3"]:
            out = kinetic_impact3(c["m"], c["M"], tuple(c["vi"]), tuple(c["vt"]), c["beta"])
            self.assertEqual(list(out[:3]), c["dv"])
            self.assertEqual(along_track3(out[:3], tuple(c["vt"])), c["along"])


if __name__ == "__main__":
    unittest.main()
