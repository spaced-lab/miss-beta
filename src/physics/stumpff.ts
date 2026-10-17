// WHAT: Stumpff functions S(z) and C(z) for the universal-variable Lambert solver.
// WHY:  GAME_PLAN 6.5. They let one formula cover elliptic (z > 0), parabolic (z = 0) and hyperbolic
//       (z < 0) transfers, so the porkchop grid never has to branch on orbit type.
// HOW:  z > 0: S = (sqrt z - sin sqrt z) / z^1.5,  C = (1 - cos sqrt z) / z
//       z < 0: S = (sinh sqrt(-z) - sqrt(-z)) / (-z)^1.5,  C = (cosh sqrt(-z) - 1) / (-z)
//       z = 0: S = 1/6, C = 1/2.  Near zero the closed forms lose digits, so a short series is used.
//       Python mirror: pymiss/physics/stumpff.py.
// LORE: O10 (A to B)

/** Stumpff S(z). Example: S(0) = 1/6, S(1) ≈ 0.1585. */
export function stumpffS(z: number): number {
  // NOTE: |z| < 1e-3 uses the series: the closed form cancels catastrophically (s - sin s) there.
  if (Math.abs(z) < 1e-3) return 1 / 6 - z / 120 + (z * z) / 5040 - (z * z * z) / 362880;
  if (z > 0) {
    const s = Math.sqrt(z);
    return (s - Math.sin(s)) / (s * s * s);
  }
  const s = Math.sqrt(-z);
  return (Math.sinh(s) - s) / (s * s * s);
}

/** Stumpff C(z). Example: C(0) = 1/2, C(1) ≈ 0.4597. */
export function stumpffC(z: number): number {
  if (Math.abs(z) < 1e-3) return 1 / 2 - z / 24 + (z * z) / 720 - (z * z * z) / 40320;
  if (z > 0) return (1 - Math.cos(Math.sqrt(z))) / z;
  return (Math.cosh(Math.sqrt(-z)) - 1) / -z;
}
