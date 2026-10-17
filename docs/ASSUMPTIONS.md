# ASSUMPTIONS.md

Every simplification the simulator makes, with the test that would break if it were removed. Grows with each
milestone; GAME_PLAN Section 5 and EDUCATION.md G7 are the narrative versions.

| Id | Assumption | Where | Test that pins it | Would change if removed |
|---|---|---|---|---|
| A1 | Coplanar 2-D heliocentric frame, all bodies prograde | physics/elements.ts (M0) | ROUNDTRIP, h > 0 check | 3-D elements, out-of-plane dv, fragment cloud 3-D correction goes away |
| A2 | Two-body about the star between events; planet gravity only at flybys and the final focusing test | sim/resolver.ts (M2) | RESOLVER determinism; FOCUSING | N-body integration, keyholes, resonant returns |
| A3 | Impulsive chemical stages; continuous ion/sail arcs integrated with fixed-step RK4 at 6 h | physics/integrate.ts (M4) | SAIL dv_equiv 8..11 km/s | adaptive stepping, finite burns |
| A4 | Along-track 1-D Gaussian for orbit uncertainty | physics/uncertainty.ts (M6) | P_impact matches Phi formula | full covariance, B-plane ellipse |
| A5 | Minigame: no gravity, straight-line rocks, circle collisions | minigame/sim.ts | determinism, parity | it is an arcade game; nothing in the sim depends on it |
