# C. THE CODE

Generated from EDUCATION.md by `scripts/build_lore.py --lessons`; edit the source, not this file.

## C1 How the game is built

*Math at the bottom, pictures at the top. The same math also lives in Python.*

### Beginner

The game runs in your browser, so its code is TypeScript (JavaScript with types). It is split into layers: physics (pure formulas), sim (the world and events), planner (ranking plans), game (rules, saves, modes), and render (drawing). A separate "worker" thread does the heavy math so the screen never stutters. Beside it sits a Python package with the same physics, used for teaching notebooks and for checking that the two agree.

### Intermediate

Why two languages: the browser needs JavaScript, and Python is the language most people learn first and the one scientists use. Every physics function exists in both (`src/physics/kepler.ts` and `pymiss/physics/kepler.py`) with the same name and the same test vectors, so a learner can read either. The Python side generates `tests/vectors/*.json`; the TypeScript tests must reproduce them. No frameworks: Vite builds it, vitest and pytest test it, GitHub Actions runs both and publishes the game to GitHub Pages.

Related: C2, C3, G7. In the game: codex, README.

## C2 Reading the code: a guided path

*Start with the smallest file. Each one builds on the last.*

### Beginner

Read in this order, each file is short and commented: `constants.ts` (numbers), `vec.ts` (arrows), `kepler.ts` (where is it now), `elements.ts` (describe an orbit), `closeApproach.ts` (does it hit), `kinetic.ts` (what a hit does), `lambert.ts` (how to get there). Each file starts with a plain-language header and names the lore topic that explains the math. Every EXPERT lab has a SHOW CODE button that opens the real function next to the formula.

### Intermediate

Each function is written the same way: a doc comment with the formula and units, the inputs validated, the math in the same order as the lore entry, and a test next door with a number you can check by hand. Try this exercise: open `kepler.ts`, change the Newton iteration's stopping tolerance from 1e-12 to 1e-3, run the tests, and watch which ones fail and by how much. Then put it back.

Related: C1, O9, O10. In the game: Learning Center LABS tab, "SHOW CODE".

## C3 Tests and the two-language trick

*The same math in two languages must give the same numbers. The computer checks every change.*

### Beginner

A test is a tiny program that runs a function with known inputs and complains if the output is wrong. The game has hundreds: Earth's year must come out to 365.25 days; DART's push must come out near 3 mm/s; the same seed must produce the same game twice. Because the physics exists in Python too, the Python version produces the expected answers and the TypeScript version must match them, and vice versa. Every change on GitHub runs all of them automatically.

### Intermediate

Calibration tests pin the sim to reality: Hohmann Earth-Mars departure 2.94 km/s; Jupiter-class flyby turn 80.2 degrees at 10 planet radii and 10 km/s; Q* about 360 J/kg for a 100 m basalt body; a 10 g/m² sail building 8 to 11 km/s in a year. Property tests check invariants: fragment masses sum to the parent; |v_inf| is conserved through a flyby; energy is constant along a Kepler orbit to 1e-12. Fuzz tests run a thousand random rounds and fail on any NaN.

Related: C1, C2, O14. In the game: CI badge in README.

## C4 Build your own: knobs, methods, scenarios

*Every number has a dial. Every method is a card. Add your own.*

### Beginner

All the tunable numbers live in one file, and SIMULATION mode shows them as sliders. Adding a deflection method means adding one card to `methods.json` (name, tag, which formula, which knobs) and, if it needs new physics, one function with a test. Adding a real asteroid as a scenario means copying its orbit from NASA's database into `scenarios.json`. The codex and the Learning Center pick up new entries automatically.

### Intermediate

Walkthrough: add "ELECTROSTATIC_TRACTOR_V2". 1) `src/physics/slowPush.ts`: add a function returning acceleration from charge, distance and Debye screening. 2) `tests/`: one vector where screening kills the force. 3) `config/methods.json`: a card with tag PROPOSED, mode REALISTIC, unlock G1, and the lore id. 4) `EDUCATION.md`: a five-level entry (SIMPLE can be two sentences). 5) Run `scripts/build_lore.py` and the tests. The planner enumerates the new method the next time it runs.

Related: C2, D11, G6. In the game: console knobs editor, codex.

## C5 Sources and where to learn more

*Everything here comes from real missions, real papers, and free textbooks. Here they are.*

### Beginner

Free, reliable starting points: NASA's Planetary Defense pages and CNEOS (live risk tables, close approaches, fireballs); ESA's NEO Coordination Centre; the Planetary Society's explainers; JPL's "Basics of Space Flight"; the National Academies' 2010 report "Defending Planet Earth", free as a PDF. For the math, Feynman's lectures are free online and Curtis's "Orbital Mechanics for Engineering Students" is the standard textbook.

### Intermediate

Mission papers worth reading in full: the DART results (Nature, March 2023, several papers); the NEO Surveyor overview (Planetary Science Journal, 2023); ESA's NEOMIR study (NEOSST2 conference, 2023); OSIRIS-REx on Bennu's structure and Yarkovsky drift (Science and Icarus, 2019-2021). For impact physics: Benz and Asphaug 1999 (disruption), Holsapple and Housen 2012 (cratering momentum), Popova et al. 2013 (Chelyabinsk), Collins et al. 2005 (impact effects calculator).

Related: C1, T1, D11. In the game: codex footer, every EXPERT entry.
