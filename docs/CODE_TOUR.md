# CODE TOUR

A guided path through the repo for people learning to code, following EDUCATION.md C1 to C4. Each stop is
one short file with a `WHAT / WHY / HOW / LORE` header; read the header, then the first function, then its
test. Nothing here needs a framework: `npm test` and `python3 -m unittest discover -s pymiss/tests -t .`
run everything.

## Stop 0: the rules (C1)

`CLAUDE.md` is how the repo is worked: headers, SI units, knobs in one file, no `Math.random` in physics,
two languages for every physics function, measured alternatives. `docs/ASSUMPTIONS.md` lists every
simplification and the test that pins it.

## Stop 1: numbers and arrows (O1, O3)

- `src/physics/constants.ts`: every constant, derived ones computed from base ones.
- `src/util/vec.ts`: 2-D vectors, the only geometry primitive the sim uses.
- `src/sim/rng.ts` and `pymiss/sim/rng.py`: the same seeded generator in both languages
  (`tests/vectors/rng.json` proves it bit for bit).

## Stop 2: where is it now (O6, O7, O9)

- `src/physics/kepler.ts`: Kepler's equation by Newton, position and velocity from elements, the hyperbolic
  branch. Test: `tests/kepler.test.ts`. Mirror: `pymiss/physics/kepler.py`.
- `src/physics/elements.ts`: a state vector back to elements, with the guards that make the resolver safe.
- `src/physics/kepler3.ts`, `elements3.ts`, `closeApproach3.ts` (M14 phase 1, not yet used by the game): the same
  orbits tilted by inclination and node; with i = 0 they return the planar answers exactly. Test:
  `tests/kepler3.test.ts`. Mirrors: `pymiss/physics/kepler3.py`, `elements3.py`, `close_approach3.py`.

## Stop 3: does it hit (O12)

- `src/physics/closeApproach.ts`: a coarse scan plus golden-section refinement, gravitational focusing
  (`bCrit`), impact energy and category. Lab: LAB_FOCUSING.

## Stop 4: what a hit does (D3, D4)

- `src/physics/kinetic.ts`: `dv = beta m U / M`, calibrated on DART. Lab: LAB_BETA.
- `src/physics/fragment.ts`: Benz and Asphaug Q*, Pareto fragment masses, the 3-D correction.
- `src/physics/estimates.ts`: the planner's closed forms (`3 dv T`). Lab: LAB_3DVT.

## Stop 5: how to get there (O10, O11)

- `src/physics/stumpff.ts` then `src/physics/lambert.ts`: universal-variable Lambert.
- `src/planner/porkchop.ts`: the launch-window grid; runs in a Web Worker (`src/worker/planner.worker.ts`).
- `src/physics/flyby.ts`: patched-conic gravity assist.

## Stop 6: the round as a pure function (G7, C1)

- `src/sim/roundGen.ts`: a colliding orbit built backward from the impact point.
- `src/sim/resolver.ts`: `(world, missions, options) -> RoundResult`, deterministic, no clock, no DOM.
  Replay, Monte Carlo (`src/planner/monteCarlo.ts`) and the multiverse all reuse it.
- `src/sim/eventLog.ts`: every event the resolver can emit, and how it is printed.

## Stop 7: the rest of the game (G2 to G6)

- `src/game/`: economy, scoring, tech, programs effects, saves (`saveMd.ts` is a tiny validated YAML
  subset), modes, the console (every cheat code in the open), multiverse.
- `src/render/`: a Canvas 2D `Surface` that only strokes lines, a hand-built stroke font, palettes as data,
  the camera tilt, and one view per screen under `views/`.
- `src/lore/`: the Learning Center loader, pictures and labs; `scripts/build_lore.py` turns `EDUCATION.md`
  into the chunks the browser fetches.

## Stop 8: build your own (C4)

Add a scenario (`src/config/scenarios.json`), a palette (`src/config/palettes.json`), a picture
(`src/lore/pictures/`), a lab (`src/lore/labs/`, follow `ellipse.ts`), or a knob tweak (`src/config/knobs.ts`,
then watch which test moves). Issue templates in `.github/ISSUE_TEMPLATE` walk each one.

## The two-language trick (C3)

`python3 scripts/gen_vectors.py` writes `tests/vectors/*.json` from the Python mirror; `npm test` reproduces
every vector in TypeScript to a stated tolerance. If you change a formula, the vector check (`npm run check`)
fails until both languages agree.
