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
| A6 | Threat generation builds the orbit backward from the impact point (MOID 0, timing matched) | sim/roundGen.ts (M1) | ROUNDGEN "hits when ignored" | a sampled population with keyholes and resonant returns |
| A7 | Kinetic deflection is an instantaneous impulse with beta drawn per impact from a per-type range | physics/kinetic.ts (M2) | KINETIC DART example; RESOLVER beta reveal | ejecta dynamics, spin, impact geometry on beta |
| A8 | Fragmentation: Benz and Asphaug Q*, Pareto masses, isotropic ejection in the orbit plane with a 3-D hit-probability correction | physics/fragment.ts (M3) | FRAGMENT Q*, f3D | SPH-derived fragment distributions, 3-D clouds |
| A9 | Gravity assists are patched conics: an instantaneous rotation of v_inf at the planet | physics/flyby.ts (M4) | FLYBY turn angle | integrated flybys, SOI transit time |
| A10 | Detection: ground optical needs V <= V_lim and elongation; space IR scales with D and r delta; coverage is a per-night chance | sim/detection.ts (M5) | DETECTION 140 m lead; sunward blind spot | survey cadence models, weather, galactic plane |
| A11 | Nuclear standoff couples a fixed fraction of the intercepted yield as momentum (C_m); surface and subsurface deliver Q directly | physics/nuclear.ts (M6) | NUCLEAR standoff dv, disruption flag | radiation-hydrodynamics coupling by material |
| A12 | Slow push: constant along-track force over the arc, no mass loss, no COM wander | physics/slowPush.ts (M6) | SLOW PUSH dv per year | thrust vectoring, propellant mass, plume impingement |
| A13 | Sails: flat, specular, cone-angle laws (SPIRAL, COAST, TARGET_STEER) | physics/sail.ts (M4) | SAIL dv_equiv 6..11 km/s | billowing, degradation, attitude dynamics |
| A14 | Interstellar rounds (SCI-FI) are hyperbolic two-body orbits; long-period comets are prograde only | physics/kepler.ts, sim/roundGen.ts (M7) | HYPERBOLIC vectors; SCIFI flavors | retrograde comets, non-gravitational forces |
| A15 | SPECTRUM colours and the 3-D tilt are camera-side only; the sim is always z = 0 | render/camera3d.ts (M10) | camera3d identity at pitch 0 | nothing in the sim |
| A16 | Lore pictures rasterise an SVG with the browser's monospace font for labels (the one raster font) | render/pictureCache.ts (M9) | pictures deterministic | a stroke-font label generator |

