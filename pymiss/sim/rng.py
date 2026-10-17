"""Seeded PRNG: mulberry32 + FNV-1a hashing. Bit-for-bit mirror of src/sim/rng.ts.

JavaScript's 32-bit integer semantics (Math.imul, >>>, ^ on int32) are reproduced by masking every
intermediate to 32 bits. Streams must match exactly so that a round generated in TypeScript can be
regenerated in Python for the notebooks (EDUCATION.md C3).
"""
from __future__ import annotations

import math

MASK = 0xFFFFFFFF


def _imul(a: int, b: int) -> int:
    return (a * b) & MASK


class Rng:
    def __init__(self, seed: int):
        self.state = seed & MASK

    def next(self) -> float:
        """Uniform float in [0, 1)."""
        self.state = (self.state + 0x6D2B79F5) & MASK
        z = self.state
        z = _imul(z ^ (z >> 15), z | 1)
        z ^= (z + _imul(z ^ (z >> 7), z | 61)) & MASK
        z &= MASK
        return ((z ^ (z >> 14)) & MASK) / 4294967296

    def float(self, lo: float, hi: float) -> float:
        return lo + (hi - lo) * self.next()

    def int(self, lo: int, hi: int) -> int:
        return lo + math.floor(self.next() * (hi - lo + 1))

    def log_uniform(self, lo: float, hi: float) -> float:
        return math.exp(self.float(math.log(lo), math.log(hi)))

    def gaussian(self, mean: float = 0.0, sigma: float = 1.0) -> float:
        u = 0.0
        while u == 0.0:
            u = self.next()
        v = self.next()
        return mean + sigma * math.sqrt(-2 * math.log(u)) * math.cos(2 * math.pi * v)

    def rayleigh(self, scale: float) -> float:
        u = 0.0
        while u == 0.0:
            u = self.next()
        return scale * math.sqrt(-2 * math.log(u))

    def chance(self, p: float) -> bool:
        return self.next() < p

    def get_state(self) -> int:
        return self.state

    def fork(self) -> "Rng":
        return Rng(math.floor(self.next() * 4294967296))


def hash_seed(text: str) -> int:
    """FNV-1a 32-bit over UTF-16 code units (JavaScript charCodeAt semantics)."""
    h = 0x811C9DC5
    data = text.encode("utf-16-le")
    for i in range(0, len(data), 2):
        code = data[i] | (data[i + 1] << 8)
        h ^= code
        h = _imul(h, 0x01000193)
    return h & MASK


def round_rng(run_seed: str, round_index: int) -> Rng:
    return Rng(hash_seed(f"{run_seed}#{round_index}"))
