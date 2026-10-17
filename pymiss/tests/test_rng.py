import json
import os
import unittest

from pymiss.sim.rng import Rng, hash_seed, round_rng

VEC = os.path.join(os.path.dirname(__file__), "..", "..", "tests", "vectors", "rng.json")


class TestRng(unittest.TestCase):
    def test_reference_stream_seed_0(self):
        # Same constants as tests/rng.test.ts: the streams must match bit for bit.
        r = Rng(0)
        self.assertEqual([r.next() for _ in range(3)], [0.26642920868471265, 0.0003297457005828619, 0.2232720274478197])

    def test_deterministic(self):
        a, b = Rng(12345), Rng(12345)
        self.assertEqual([a.next() for _ in range(100)], [b.next() for _ in range(100)])

    def test_int_inclusive(self):
        r = Rng(7)
        self.assertEqual(sorted({r.int(1, 3) for _ in range(2000)}), [1, 2, 3])

    def test_hash_seed(self):
        self.assertEqual(hash_seed(""), 0x811C9DC5)
        self.assertNotEqual(hash_seed("TUTORIAL-1"), hash_seed("TUTORIAL-2"))
        self.assertEqual(round_rng("ABC", 1).next(), round_rng("ABC", 1).next())

    def test_vectors_file_matches(self):
        with open(VEC, encoding="utf-8") as f:
            vec = json.load(f)
        for s in vec["streams"]:
            r = Rng(s["seed"])
            self.assertEqual([r.next() for _ in range(8)], s["first"])
        for text, h in vec["hashSeed"].items():
            self.assertEqual(hash_seed(text), h)


if __name__ == "__main__":
    unittest.main()
