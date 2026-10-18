"""Compare shared test vectors across machines: numbers to a relative tolerance, everything else exactly.

WHAT: near_diff(a, b) walks two JSON-shaped values and returns the first path where they differ, or None.
WHY:  tests/vectors/*.json are written on the owner's Mac; CI (linux x64) recomputes them with a different libm.
      Measured 2026-10-18 (Python 3.12, darwin arm64 vs linux amd64 in Docker): element sets differ by ulps
      (<= 9e-13), close-approach distances up to 8e-10, because the golden-section search stops on a 1 s bracket
      and one flipped comparison moves the point inside it. REL_TOL = 1e-8 is the same bound the TypeScript
      planar replay uses (tests/planarReplay.test.ts) and is far below any real physics change.
HOW:  numbers (not bools) pass when a == b or |a - b| <= REL_TOL * max(|a|, |b|); lists by length and element;
      dicts by key set and value; anything else with ==.
LORE: C3 (tests and the two-language trick)
"""
from __future__ import annotations

REL_TOL = 1e-8


def near_diff(a: object, b: object, path: str = "$") -> str | None:
    """First path where a and b differ beyond REL_TOL, else None. near_diff([1.0], [1.0 + 1e-12]) -> None."""
    if isinstance(a, (int, float)) and isinstance(b, (int, float)) and not isinstance(a, bool) and not isinstance(b, bool):
        return None if a == b or abs(a - b) <= REL_TOL * max(abs(a), abs(b)) else f"{path}: {a!r} vs {b!r}"
    if isinstance(a, (list, tuple)) and isinstance(b, (list, tuple)):
        if len(a) != len(b):
            return f"{path}: length {len(a)} vs {len(b)}"
        for i, (x, y) in enumerate(zip(a, b)):
            d = near_diff(x, y, f"{path}[{i}]")
            if d:
                return d
        return None
    if isinstance(a, dict) and isinstance(b, dict):
        if sorted(a) != sorted(b):
            return f"{path}: keys {sorted(a)} vs {sorted(b)}"
        for k in sorted(a):
            d = near_diff(a[k], b[k], f"{path}.{k}")
            if d:
                return d
        return None
    return None if a == b else f"{path}: {a!r} vs {b!r}"
