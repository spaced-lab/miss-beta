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
- [x] `src/physics/constants.ts`: every constant of GAME_PLAN 6.1 with units in comments. Mirror: `pymiss/physics/constants.py`.
- [x] `src/physics/kepler.ts`: `solveKepler(M, e)`, `propagate(elements, mu, t)` returning `{r, v}` (6.2). Vis-viva helper `speedAt(mu, r, a)`. Mirror + vectors.
- [x] `src/physics/elements.ts`: `stateToElements(r, v, mu, t)` (6.3) with the e≈0 guard and the prograde check. Mirror + vectors.
- [x] `src/config/bodies.json` + `src/config/knobs.ts`: the Sol-like table of 5.2, optional scale knobs.
- [x] `src/sim/world.ts`, `src/sim/body.ts`: World = star + planets with elements + sim clock `t`.
- [x] `src/render/views/system.ts`: star with radial ticks, dim orbit ellipses (sampled from elements), planets as circles with detail lines, LINEAR / COMPRESSED (sqrt radial) scale toggle, pan/zoom.
- [x] `src/ui/hud.ts`: T+ clock, warp level, keyboard `space`, `[`, `]`.
- [x] Title menu: NEW RUN opens the system view (threat comes in M1); attract sketch replaced by real propagation.
- [x] Tests (GAME_PLAN 16): KEPLER period 365.25 d within 0.01 d; ROUNDTRIP |dr| < 1 m, |dv| < 1e-6 m/s; energy constant to 1e-12 relative over one orbit; `tests/vectors/kepler.json` from pymiss.
- Accept: planets complete one orbit in their correct periods; energy constant to 1e-12; state->elements->state to 1e-9.

## M1: A threat, and losing

- [x] `src/physics/closeApproach.ts` (6.4): coarse 1 h scan over ±90 d, golden-section refine to 1 s, `bCrit`, `MARGIN`, `vImpact`, energy and category. Mirror + vectors.
- [x] `src/sim/roundGen.ts` (Section 10): the collision construction, acceptance tests, name generator, type table from `src/config/threats.json`. Fallback lead-time draw (the detection model arrives in M5).
- [x] Threat in the system view: predicted path drawn as the dashed orbit loop (a ten-year time polyline aliases), ghost crosshair at `t_i`, seeded 8-12 vertex outline.
- [x] THREAT BRIEF panel (type, D, energy Mt, years to impact, P(impact) placeholder 1.0).
- [x] RESOLVE NOW (`R`) and the warp ladder up to 1 yr/s.
- [x] RUN OVER screen with energy in Mt and the category line.
- [x] Tests: FOCUSING b_crit ≈ 1.50 R at v_inf 10 km/s; ROUNDGEN 1000 seeds all bound, prograde, impacting; 100/100 seeds `d_min < b_crit` unperturbed.
- Accept: every generated threat impacts when unperturbed.

## M2: First playable: direct kinetic

- [x] `src/physics/stumpff.ts`, `src/physics/lambert.ts` (6.5). Mirror + vectors. Test: Hohmann 1.0 -> 1.524 AU, dt 259 d: dep v_inf ≈ 2.94 km/s, arr ≈ 2.65 km/s within 2%.
- [x] `src/config/launchers.json` + `src/physics/estimates.ts`: payload-vs-C3 interpolation in log(mass); the 3 dv T rule; miss estimate.
- [x] `src/physics/kinetic.ts` (6.9): `impulseFromImpact(m, M, U_vec, beta)`. Mirror + vectors. Test DART: 580 kg, 6.14 km/s, 4.3e9 kg, beta 3.6 -> ≈ 3.0 mm/s.
- [x] `src/worker/planner.worker.ts` + `src/planner/porkchop.ts`: the grid of 6.6 as a worker job with progress messages; vector contour render.
- [x] `src/sim/mission.ts` (7.1), `src/planner/candidates.ts` and `ranking.ts` for the KINETIC archetype only; `src/sim/resolver.ts` v1: launches, Lambert coast, impact impulse, close-approach re-run; `src/sim/eventLog.ts`.
- [x] PLANNER screen (13.4) with COMMIT / CLEAR; missions committable whenever paused.
- [x] `src/game/economy.ts` (budget per year), `scoring.ts` (Section 12), leaderboard in localStorage (validated), next round.
- [x] DEBRIEF v1: event list + score breakdown + NEXT ROUND.
- [x] Tests: RESOLVER determinism (byte-equal event logs); 3DV RULE within 25%; a 100 m stony, 10 yr threat beaten by one Tier 1 launch (balance target Round 1).
- Accept: round loop works end to end.

## M3: Breaking things

- [x] `src/physics/fragment.ts` (6.10): Q, Q* (Benz-Asphaug, `[knob]` coefficients, `[unverified]` until checked against the paper), largest remnant, Pareto fragment masses, Rayleigh ejection, COM momentum conservation, 3-D correction factor. Mirror + vectors. Tests Q_STAR 300..400 J/kg at R = 100 m; FRAGMENT masses sum to 1e-9, momentum to 1e-6.
- [x] Resolver: fragment bodies as `ElementSegment[]`, per-fragment close approach, residual energy.
- [x] `src/planner/monteCarlo.ts` in the worker (N = 200): P(miss), E_res.
- [x] HAMMER_SWEEP and SWARM archetypes; the 4.1 R / 2.2 R style readouts.
- [x] PLANET VIEW (13.3): disc with procedural continents (reuse `minigame/planet.ts` generator, moved to `render/continents.ts`), b_crit ring, corridor, cloud cross-section.
- [x] Tests: seeded A/B: disrupting at T-2 months produces more hits than at T-2 years.

## M4: Going faster

- [x] `src/physics/integrate.ts` (RK4, plus Euler for the lab), `src/physics/sail.ts` (6.8 force model, control laws, tiers), drop-sail. Mirror + vectors. Test SAIL: Tier 3 builds 8..11 km/s in one year of SPIRAL OUT.
- [x] `src/physics/flyby.ts` (6.7) and the two-leg search over t_F. Mirror + vectors. Test FLYBY: GIANT, r_p = 10 R, v_inf 10 km/s -> delta ≈ 80.2 deg; |v_inf| preserved to 1e-9.
- [x] KINETIC_FLYBY and SAIL_KINETIC archetypes; FLYBY WINDOWS panel; sail arcs rendered from sampled tables.
- Accept: a GIANT flyby raises U by > 10 km/s in at least one seeded configuration.

## M5: Seeing it coming

- [x] `src/physics/photometry.ts` (18.1: H, V, phase), `src/sim/detection.ts` (ground optical, space IR, radar rules), `src/config/networks.json` (18.3, 18.4) with tags. Mirror + vectors. Tests PHOTOMETRY and DETECTION numbers of Section 16.
- [x] Discovery search (18.2; runs synchronously at round start for now, worker move noted); round generation switched to detection-derived lead with rejection sampling and `p_surprise(k)`.
- [x] Civil defense action (18.6). PROGRAMS panel + `src/sim/programs.ts` + `src/config/programs.json` (REALISTIC rows of 19).
- [x] `src/game/saveMd.ts`: SAVE.md writer and front-matter parser (minimal YAML subset, size-capped, type-guarded); `history/` export; File System Access API when available; drag-and-drop import.
- [x] CODEX screen generated from `config/*.json`.
- [x] Tests DISCOVERY (three cases), PROGRAMS progress, SAVE_MD round trip.

## M6: The full tree

- [x] `src/config/tech.json` + TECH TREE screen; `src/game/tech.ts`. Launch cadence cap (2/yr, HEAVY_LAUNCH_CADENCE raises it) enforced at commit.
- [x] Autonomy tiers and the rules DSL (`src/planner/rules.ts`: JSON validated against a schema in code, no eval) and `autonomy.ts`; split impactors.
- [x] `src/physics/nuclear.ts` (6.11 incl. HAIV, pulse train) with C_m calibration test (1 Mt standoff on 1 km stony -> 2..6 cm/s). Mirror + vectors.
- [x] `src/physics/slowPush.ts`: tractor, enhanced tractor, ion beam, laser, mirrors, mass driver, tugboat, tether, electrostatic (NOT VIABLE), e-sail, Yarkovsky readout. Mirror + vectors.
- [x] PI penetrator terminal method, capture bag, tracking tiers and beta reveal delay (6.14), uncertainty P(impact).
- [x] DEBRIEF scrubber and play-by-play; leaderboard tabs.
- [x] `src/config/methods.json` complete for 20.1 and 20.2; fuzz test: 1000 random rounds, every archetype, no NaN.
- [x] Balance pass against Section 17 (fix constants, not targets).

## M7: Modes, cheats, fiction

- [x] `src/game/modes.ts` nesting (21), the codes of 22.2 in `src/game/console.ts` incl. SPAWN scenarios (`config/scenarios.json`, `sim/scenarios.ts`) and DART; `civilizationLevel`.
- [x] SCI-FI methods/programs (20.3, 19): net capture, DE-STAR and disassembler as resolver standing capabilities (`ResolveOpts.scifi`); hyperbolic Kepler branch for INTERSTELLAR rounds (`roundGen` flavors). No separate `physics/net.ts`: the net is a push method plus the capture rule.
- [x] CONSOLE overlay (`): command table with the FICTION commands and their forbidding lines (in `console.ts`, no separate fiction.ts), knobs editor; `multiverse.ts` with tiled render, COLLAPSE and WORMHOLE; `render/glitch.ts`.
- [x] Tests MODES, SINGULARITY numbers, MULTIVERSE x9 timing, SCI-FI flavors and capabilities, hyperbolic vectors shared with Python.
- [ ] Follow-ups: civilization level auto-entering SCI-FI (22.3) at the end of a run; DART tutorial code is a stub (prints the mission numbers); multiverse branch variants beyond beta/fragment draws (different threats) are only via WORMHOLE.

## M8: Polish

- [x] `render/crt.ts` (scanlines, vignette instead of barrel, flicker; reduce-motion), `audio/ui.ts` bleeps, attract mode (`game/attract.ts` + `render/miniSystem.ts`), DAILY RUN seed, COMPRESSED scale (S, since M1), touch pan/pinch, `bench/frame.bench.ts` performance pass, TUTORIAL round 0 (`game/tutorial.ts`, GAME_PLAN 25), OPTIONS screen (`game/settings.ts`).
- [x] Hershey font evaluation: not adopted. The hand-built stroke font is 1.9 KB of glyph data and already matches the look; Hershey Simplex would add about 30 KB and lower-case glyphs the UI does not use. Revisit if the Learning Center (M9) needs lower case for prose.
- [ ] Deferred: gamepad (IDEAS.md), the DART code as a full second tutorial (today it prints the mission numbers), units IMPERIAL in readouts, a WebGL barrel pass (M10).

## M9: Learning Center and lore

- [x] `scripts/build_lore.py` with the validation list of EDUCATION.md 0.2 (gate runs `--check`); `src/lore/index.ts` loader + LRU (2 MB cap); `render/views/lorePanel.ts` (`?`), `render/views/center.ts` (L / LEARN); 55 SIMPLE pictures as SVG generators (`src/lore/pictures/*`); seven LABs (ELLIPSE, VISVIVA, KEPLER_SOLVER, BETA, FOCUSING, 3DVT, MAGNITUDE) code-split; `lore_read` in SAVE.md merged on load; codex `?` and `L`; lowercase stroke glyphs for prose (opt-in `lower`).
- [x] Tests LORE (TS loader/markdown/labs/built index; Python parser and validation) and the runtime no-fetch-at-boot test.
- [ ] Deferred: click-to-open on entities and HUD numbers (keyboard `?` with a context topic instead), the remaining 13 labs, RUN IN PYTHON (Pyodide), quizzes (BACKLOG in EDUCATION.md).
  - 2026-10-18 labs batch A built: IMPACT_ENERGY, QSTAR, FRAGMENT_CLOUD, NUKE_STANDOFF, TRACTOR, ROCKET_EQ, TORINO (new `src/physics/risk.ts`, `rocket.ts`; notebooks for each).
  - [x] Labs batch B (2026-10-18): LAMBERT_PORKCHOP, FLYBY, SAIL_SPIRAL, SUNWARD, MONTECARLO, RK4, animated on the lab clock, memo-cached (`src/lore/labs/kit.ts`), one notebook each in `pymiss/notebooks/`, tests in `tests/labsB.test.ts`.

## M10: Visual system

- [x] `config/palettes.json` (the table moved out of `render/palettes.ts`), SPECTRUM unlock (first clean miss) + OPTIONS toggle with `Surface.role()`, all seven modes selectable, HOLO iridescent gradient strokes with a 1 px chromatic offset and slow hue drift (Canvas 2D; WebGL2 bloom deferred to IDEAS 11), `camera3d.ts` tilt (I key: 0 / 30 / 60 deg) with the tumbling wireframe polyhedron, wireframe sphere in the planet view, parallax star field, panel materialize (system panels), colorblind role line styles (`ROLE_STYLE`), contrast test (PALETTES: ink/hot/alt >= 4.5:1 in every mode, SPECTRUM roles >= 3:1 on dark modes).
- [ ] Deferred: materialize on the planner/programs/tech overlays (they draw their own frames), orbit-plane grid fading with distance, the remaining 13 labs (IDEAS 9).

## M11: Teaching repo and Python companion

- [x] `pymiss/` complete (every `src/physics` export has a snake_case twin; `pushForce` mirrored for the four vector-covered methods), `gen_vectors.py` (since M0), notebooks per built LAB (`pymiss/notebooks/*.ipynb`, seven), `docs/CODE_TOUR.md` (eight stops), `docs/ASSUMPTIONS.md` A1..A16, README play and learn paths, `CONTRIBUTING.md`, four issue templates, `docs/LESSONS/` (`build_lore.py --lessons`), GitHub Actions (`.github/workflows/ci.yml`: typecheck, vitest, pytest, lore check, vectors, audit, build, smoke, Pages deploy from main).
- [x] Smoke test: `scripts/smoke.mjs` serves `dist` and checks the page, CSP, bundle, lore index and a chunk from node. Playwright (browser download) deliberately not added as a dependency; IDEAS.md 12.
- [ ] Deferred: Pyodide RUN IN PYTHON (IDEAS 9); CI is green on the private spaced-lab/miss-beta since 2026-10-18 (run 39161675146); the Pages deploy waits for the repository to go public (docs/RELEASING.md first-publish checklist).

## M13: Event cinematics and narratives (user request, 2026-10-17; after M12)

Design addition from the user (recorded in GAME_PLAN.md Section 29). Build after the planned milestones.

- [x] **Event cinematics**: when a LAUNCH, IMPACT, FRAGMENTATION, NUKE, PI or CLOSE_APPROACH event passes on the clock, pause the clock and play a few-second (2 to 5 s) vector animation in the PERIMETER style (pixel debris, shards, bass thud), then return to the warp that was running. Launch: a planet-level mock-up (HOME's limb, the pad, the ascent arc, staging) scaled by launcher tier and payload. Impact: the impactor streak, crater or breakup drawn from the real numbers (U, beta, Q/Q*, fragment count and sizes, body type: rubble pile crumbles, stony cracks, iron rings, comet puffs). Skippable with any key; off under reduce-motion (a 0.5 s flash and the brief instead). Module: `src/render/cinematics/*` fed by the resolver's event records only (no new physics).
- [x] **Auto warp-down**: when the last in-flight mission has arrived (or none are committed) the clock drops to 1 day/s so the player notices there is room to act; a HUD line says why ("NO MORE CRAFT IN FLIGHT: PLAN OR LET IT PLAY OUT").
- [x] **Canned narratives**: `src/config/narratives.json`: templated briefs (no LLM at play time) for round start ("SPOTTED BY <network> AT V <mag>, <D> M, <type>, <lead> ..."), after each event (post-impact summary with beta reveal timer, breakup summary with the fragment picture, NUKE fuze, PI, civil defense), and the debrief. Rendered by a `Teletype` overlay: header types in first, then the body, fast (whole text in under a second) with the retro typing look; any key renders the rest at once; another key clears it. Narratives use SPECTRUM role colours when the layer is on (threat amber, craft cyan, fragments magenta) so the screen is not only green.
- [x] Tests: narrative templating covers every event kind and every body type with no `undefined`; cinematics are deterministic in (event, seed); the warp-down fires exactly once per arrival. (2026-10-17: `tests/narrative.test.ts`, `tests/cinematics.test.ts`, `tests/warpDown.test.ts`; verified in the browser: launch, impact, close-approach impact, modal debrief brief, warp-down note.)
- [ ] Follow-ups: FRAGMENTATION / NUKE / PI scenes exist and are unit-tested but were not yet watched in the browser (needs a disrupting plan); a CINEMATICS on/off option separate from REDUCE MOTION; scenes for PUSH arcs (today: brief only).

## M12: Exhaustion check and idea harvest

- [x] Walk 19, 20, 22.2 and the EDUCATION topic map and LAB registry; final STATUS.md; print IDEAS.md numbered with a recommendation each; stop. (2026-10-17: findings in STATUS.md "M12 walk"; ten inert program effects are IDEAS 13.)

---

## PERIMETER minigame (side mode, done 2026-10-17; tweaks tracked here)

- [x] Pure sim, renderer, loop, cheats, best score, benchmark, tests, title-menu entry, `#minigame` deep link.
- [x] v2 (2026-10-17): levels, adaptive pressure, hardness tiers + colours, stream strength ladder, heat, moon, bullet impulse, passing rocks, auto turrets, spectrum stages.
- [x] v2.1: synthesized sound kits, laser pulse, difficulty ramp, shorter turrets, less halo.
- [x] v2.2: rock gravity/bounces/binaries, continents v2, moon hit points and craters, sentry tiers and SUPER, bass voices, chaos static.
- [x] v3.4 (2026-10-18): swarm price eases past level 20, drone tiers and colours, sentry lasers (level 14) and the BEAM ARRAY (level 25), faster ramp, every high cue lowered. Tests in `tests/minigame34.test.ts`.
- [ ] Tuning pass with the user (knobs in `src/minigame/config.ts`, kits in `src/minigame/sfx.ts`).
- [x] Moves to IDEAS.md for anything beyond tuning (power-ups, touch, sound, replay, daily seed): IDEAS 1 to 6 and 10.
