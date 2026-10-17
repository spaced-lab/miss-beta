# BUILD_PLAN.md: the step-by-step path through GAME_PLAN.md

This is the work order. GAME_PLAN.md says what and why; this file says in which order, file by file, with
the test that proves each step, and records the decisions already made so later sessions do not re-decide
them. Tick boxes as work lands. Keep STATUS.md's one-line-per-milestone summary in sync.

Legend: `[ ]` todo, `[x]` done, `[~]` partial. Sizes S/M/L as in IDEAS.md. "Mirror" means the pymiss
Python twin with shared vectors (GAME_PLAN 26.2); it is part of the definition of done for every physics
function, not a later chore.

---

## Decisions already made (do not re-open)

| Topic | Decision | Where |
|---|---|---|
| Toolchain | Vite + TypeScript + vitest only; Python 3 stdlib + numpy for pymiss | GAME_PLAN 0 |
| Font | Hand-built stroke font first (`render/vectorFont.ts`); Hershey simplex behind the same `glyph()` interface in M8 if the look needs it | GAME_PLAN 28 |
| Glow | `understroke` default; `shadow` and `none` kept and switchable; measured in-game (B key, debug HUD) | `render/canvas.ts` |
| Collision (minigame) | `auto`: naive under 20k pairs, uniform grid above; both kept, both tested for parity, benched | `minigame/collision.ts` |
| Cheat codes | In the open, committed, flag ASSISTED | user decision 2026-10-17 |
| CSP | Injected into the production html only by a Vite plugin; dev stays open for HMR and tooling | `vite.config.ts` |
| Missions committable | Any time the clock is paused (re-plan from now) | GAME_PLAN 28 |
| Budget | Per year, accrued on the clock | GAME_PLAN 28 |
| Porkchop selection | Auto by default, manual cell pick as an expert toggle | GAME_PLAN 28 |
| 2-D only | Yes for v1; inclination is the headline v2 feature | GAME_PLAN 28 |
| Kepler solver | Newton with the e < 0.8 / pi start, 1e-12 tolerance, 30 iterations; hyperbolic branch added in SCI-FI (interstellar) rounds only | GAME_PLAN 6.2 |
| Lambert solver | Universal variables, bisection to 1e-6 then 3 Newton polish steps; skip |dtheta| within 1e-3 of 0 or pi | GAME_PLAN 6.5 |
| Integrator | Fixed-step RK4 at 6 h for thrust arcs; a tested Euler kept only for LAB_RK4's comparison | GAME_PLAN 6.8 |
| Worker protocol | Plain JSON request/response with an incrementing id; no SharedArrayBuffer (avoids COOP/COEP headers on Pages) | GAME_PLAN 14 |
| Save format | Markdown with YAML front matter; a hand-written minimal YAML subset parser (scalars, lists, flow maps) rather than a dependency | GAME_PLAN 22.1 |

## Options to compare with measurements (each gets a bench or an in-game toggle)

1. Glow: understroke vs shadowBlur vs WebGL2 bloom (M10). Metric: CPU ms per frame with 40 fragments + 12 craft.
2. Collision: naive vs grid vs sort-and-sweep (minigame; also fragment-vs-planet tests in M3). Done for two.
3. Kepler solver start value: M vs pi vs Danby's cubic start. Metric: mean iterations over 1e5 random (e, M).
4. Lambert root finding: bisection vs bisection+Newton vs Brent. Metric: mean evaluations, worst-case failure count over the porkchop grid.
5. Porkchop grid: full grid vs coarse-to-fine refinement. Metric: wall time in the worker for a 10-day step grid.
6. Monte Carlo: 200 samples sequential vs batched typed arrays. Metric: ms per plan.
7. Text: stroke font per glyph each frame vs cached Path2D per glyph. Metric: ms for 2000 characters.
8. Python: pure-Python loops vs numpy vectorization in `gen_vectors.py`. Metric: seconds for the full vector set.

## Security and quality gates (every commit)

- `npm run check`: tsc strict, vitest, `npm audit --audit-level=moderate`, static greps (no eval/Function/innerHTML/document.write; no DOM or Math.random in physics/sim).
- Inputs from outside the program are untrusted: localStorage, SAVE.md import, drag-and-drop files, URL hash, console commands. Each gets a parser with a type guard and a size cap; parse errors fall back to defaults and log one line.
- Console commands (M7) are a lookup table of names to handlers; the argument grammar is numbers and identifiers only.
- Worker messages are validated the same way as saves (they cross a trust boundary in principle, and it keeps the schema honest).
- Dependencies: three dev packages, zero runtime packages. Adding one requires a line in STATUS.md explaining why no alternative was acceptable.
- Performance budget (GAME_PLAN M8): 60 fps at 1080p with 40 fragments and 12 spacecraft at 1 yr/s. The debug HUD prints CPU ms per frame; a vitest timing test guards the resolver.

---

## M0: Skeleton and orbits

Goal: the four planets orbit the star with correct periods; the time-warp controls work.

- [x] Scaffold, render foundation, RNG, vec, stroke font, title screen (done 2026-10-17).
- [ ] `src/physics/constants.ts`: every constant of GAME_PLAN 6.1 with units in comments. Mirror: `pymiss/physics/constants.py`.
- [ ] `src/physics/kepler.ts`: `solveKepler(M, e)`, `propagate(elements, mu, t)` returning `{r, v}` (6.2). Vis-viva helper `speedAt(mu, r, a)`. Mirror + vectors.
- [ ] `src/physics/elements.ts`: `stateToElements(r, v, mu, t)` (6.3) with the e≈0 guard and the prograde check. Mirror + vectors.
- [ ] `src/config/bodies.json` + `src/config/knobs.ts`: the Sol-like table of 5.2, optional scale knobs.
- [ ] `src/sim/world.ts`, `src/sim/body.ts`: World = star + planets with elements + sim clock `t`.
- [ ] `src/render/views/system.ts`: star with radial ticks, dim orbit ellipses (sampled from elements), planets as circles with detail lines, LINEAR / COMPRESSED (sqrt radial) scale toggle, pan/zoom.
- [ ] `src/ui/hud.ts`: T+ clock, warp level, keyboard `space`, `[`, `]`.
- [ ] Title menu: NEW RUN opens the system view (threat comes in M1); attract sketch replaced by real propagation.
- [ ] Tests (GAME_PLAN 16): KEPLER period 365.25 d within 0.01 d; ROUNDTRIP |dr| < 1 m, |dv| < 1e-6 m/s; energy constant to 1e-12 relative over one orbit; `tests/vectors/kepler.json` from pymiss.
- Accept: planets complete one orbit in their correct periods; energy constant to 1e-12; state->elements->state to 1e-9.

## M1: A threat, and losing

- [ ] `src/physics/closeApproach.ts` (6.4): coarse 1 h scan over ±90 d, golden-section refine to 1 s, `bCrit`, `MARGIN`, `vImpact`, energy and category. Mirror + vectors.
- [ ] `src/sim/roundGen.ts` (Section 10): the collision construction, acceptance tests, name generator, type table from `src/config/threats.json`. Fallback lead-time draw (the detection model arrives in M5).
- [ ] Threat in the system view: polyline predicted path to `t_i`, ghost markers at `t_i`, seeded 8-12 vertex outline.
- [ ] THREAT BRIEF panel (type, D, energy Mt, years to impact, P(impact) placeholder 1.0).
- [ ] RESOLVE NOW (`R`) and the warp ladder up to 1 yr/s.
- [ ] RUN OVER screen with energy in Mt and the category line.
- [ ] Tests: FOCUSING b_crit ≈ 1.50 R at v_inf 10 km/s; ROUNDGEN 1000 seeds all bound, prograde, impacting; 100/100 seeds `d_min < b_crit` unperturbed.
- Accept: every generated threat impacts when unperturbed.

## M2: First playable: direct kinetic

- [ ] `src/physics/stumpff.ts`, `src/physics/lambert.ts` (6.5). Mirror + vectors. Test: Hohmann 1.0 -> 1.524 AU, dt 259 d: dep v_inf ≈ 2.94 km/s, arr ≈ 2.65 km/s within 2%.
- [ ] `src/config/launchers.json` + `src/physics/estimates.ts`: payload-vs-C3 interpolation in log(mass); the 3 dv T rule; miss estimate.
- [ ] `src/physics/kinetic.ts` (6.9): `impulseFromImpact(m, M, U_vec, beta)`. Mirror + vectors. Test DART: 580 kg, 6.14 km/s, 4.3e9 kg, beta 3.6 -> ≈ 3.0 mm/s.
- [ ] `src/worker/planner.worker.ts` + `src/planner/porkchop.ts`: the grid of 6.6 as a worker job with progress messages; vector contour render.
- [ ] `src/sim/mission.ts` (7.1), `src/planner/candidates.ts` and `ranking.ts` for the KINETIC archetype only; `src/sim/resolver.ts` v1: launches, Lambert coast, impact impulse, close-approach re-run; `src/sim/eventLog.ts`.
- [ ] PLANNER screen (13.4) with COMMIT / CLEAR; missions committable whenever paused.
- [ ] `src/game/economy.ts` (budget per year), `scoring.ts` (Section 12), leaderboard in localStorage (validated), next round.
- [ ] DEBRIEF v1: event list + score breakdown + NEXT ROUND.
- [ ] Tests: RESOLVER determinism (byte-equal event logs); 3DV RULE within 25%; a 100 m stony, 10 yr threat beaten by one Tier 1 launch (balance target Round 1).
- Accept: round loop works end to end.

## M3: Breaking things

- [ ] `src/physics/fragment.ts` (6.10): Q, Q* (Benz-Asphaug, `[knob]` coefficients, `[unverified]` until checked against the paper), largest remnant, Pareto fragment masses, Rayleigh ejection, COM momentum conservation, 3-D correction factor. Mirror + vectors. Tests Q_STAR 300..400 J/kg at R = 100 m; FRAGMENT masses sum to 1e-9, momentum to 1e-6.
- [ ] Resolver: fragment bodies as `ElementSegment[]`, per-fragment close approach, residual energy.
- [ ] `src/planner/monteCarlo.ts` in the worker (N = 200): P(miss), E_res.
- [ ] HAMMER_SWEEP and SWARM archetypes; the 4.1 R / 2.2 R style readouts.
- [ ] PLANET VIEW (13.3): disc with procedural continents (reuse `minigame/planet.ts` generator, moved to `render/continents.ts`), b_crit ring, corridor, cloud cross-section.
- [ ] Tests: seeded A/B: disrupting at T-2 months produces more hits than at T-2 years.

## M4: Going faster

- [ ] `src/physics/integrate.ts` (RK4, plus Euler for the lab), `src/physics/sail.ts` (6.8 force model, control laws, tiers), drop-sail. Mirror + vectors. Test SAIL: Tier 3 builds 8..11 km/s in one year of SPIRAL OUT.
- [ ] `src/physics/flyby.ts` (6.7) and the two-leg search over t_F. Mirror + vectors. Test FLYBY: GIANT, r_p = 10 R, v_inf 10 km/s -> delta ≈ 80.2 deg; |v_inf| preserved to 1e-9.
- [ ] KINETIC_FLYBY and SAIL_KINETIC archetypes; FLYBY WINDOWS panel; sail arcs rendered from sampled tables.
- Accept: a GIANT flyby raises U by > 10 km/s in at least one seeded configuration.

## M5: Seeing it coming

- [ ] `src/physics/photometry.ts` (18.1: H, V, phase), `src/sim/detection.ts` (ground optical, space IR, radar rules), `src/config/networks.json` (18.3, 18.4) with tags. Mirror + vectors. Tests PHOTOMETRY and DETECTION numbers of Section 16.
- [ ] Discovery search in the worker (18.2); round generation switched to detection-derived lead with rejection sampling and `p_surprise(k)`.
- [ ] Civil defense action (18.6). PROGRAMS panel + `src/sim/programs.ts` + `src/config/programs.json` (REALISTIC rows of 19).
- [ ] `src/game/saveMd.ts`: SAVE.md writer and front-matter parser (minimal YAML subset, size-capped, type-guarded); `history/` export; File System Access API when available; drag-and-drop import.
- [ ] CODEX screen generated from `config/*.json`.
- [ ] Tests DISCOVERY (three cases), PROGRAMS progress, SAVE_MD round trip.

## M6: The full tree

- [ ] `src/config/tech.json` + TECH TREE screen; `src/game/tech.ts`.
- [ ] Autonomy tiers and the rules DSL (`src/planner/rules.ts`: JSON validated against a schema in code, no eval) and `autonomy.ts`; split impactors.
- [ ] `src/physics/nuclear.ts` (6.11 incl. HAIV, pulse train) with C_m calibration test (1 Mt standoff on 1 km stony -> 2..6 cm/s). Mirror + vectors.
- [ ] `src/physics/slowPush.ts`: tractor, enhanced tractor, ion beam, laser, mirrors, mass driver, tugboat, tether, electrostatic (NOT VIABLE), e-sail, Yarkovsky readout. Mirror + vectors.
- [ ] PI penetrator terminal method, capture bag, tracking tiers and beta reveal delay (6.14), uncertainty P(impact).
- [ ] DEBRIEF scrubber and play-by-play; leaderboard tabs.
- [ ] `src/config/methods.json` complete for 20.1 and 20.2; fuzz test: 1000 random rounds, every archetype, no NaN.
- [ ] Balance pass against Section 17 (fix constants, not targets).

## M7: Modes, cheats, fiction

- [ ] `src/game/modes.ts` nesting (21), `cheats.ts` extended with the codes of 22.2 incl. SPAWN scenarios (`config/scenarios.json`) and DART; `civilization level`.
- [ ] SCI-FI methods/programs (20.3, 19); `src/physics/net.ts`.
- [ ] CONSOLE screen (`~`): command table, FICTION commands of 20.4 with their forbidding-quantity lines (`src/game/fiction.ts`), knobs editor; `multiverse.ts` with tiled render and COLLAPSE; `render/glitch.ts`.
- [ ] Tests MODES, SINGULARITY numbers, MULTIVERSE x9 >= 30 fps timing test.

## M8: Polish

- [ ] `render/crt.ts` (scanlines, barrel, flicker, all toggleable; reduce-motion), WebAudio bleeps, attract mode, daily seed, COMPRESSED scale, gamepad/touch, performance pass, DART tutorial round, Hershey font evaluation (option 7 above).

## M9: Learning Center and lore

- [ ] `scripts/build_lore.py` with the full validation list of EDUCATION.md 0.2; `src/lore/index.ts` loader + LRU (2 MB cap), `panel.ts`, `center.ts`; 55 SIMPLE pictures as SVG generators; first six LABs; SAVE.md fields; codex links.
- [ ] Tests LORE (build-time) and a runtime test that no lore is fetched before the first panel opens.

## M10: Visual system

- [ ] `config/palettes.json` (move the table out of `render/palettes.ts`), SPECTRUM unlock, all modes incl. DAYLIGHT, HOLO strokes + optional WebGL2 bloom with Canvas fallback, `camera3d.ts` tilt, wireframe planet, panel materialize transitions, colorblind line styles, contrast test (PALETTES). Remaining LABs.

## M11: Teaching repo and Python companion

- [ ] `pymiss/` complete, `gen_vectors.py`, notebooks per LAB, `docs/CODE_TOUR.md`, `docs/ASSUMPTIONS.md` complete, README learn path, CONTRIBUTING, issue templates, GitHub Actions (vitest, pytest, lore validation, Playwright smoke), Pages deploy, optional Pyodide.

## M12: Exhaustion check and idea harvest

- [ ] Walk 19, 20, 22.2 and the EDUCATION topic map and LAB registry; final STATUS.md; print IDEAS.md numbered with a recommendation each; stop.

---

## PERIMETER minigame (side mode, done 2026-10-17; tweaks tracked here)

- [x] Pure sim, renderer, loop, cheats, best score, benchmark, tests, title-menu entry, `#minigame` deep link.
- [ ] Tuning pass with the user (knobs in `src/minigame/config.ts`).
- [ ] Moves to IDEAS.md for anything beyond tuning (power-ups, touch, sound, replay, daily seed).
