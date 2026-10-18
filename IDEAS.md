# IDEAS.md

Features not in GAME_PLAN.md, one paragraph each with a size estimate. Nothing here is built before M12
presents the list (GAME_PLAN Section 0). Sizes: S (hours), M (a day), L (days).

1. **PERIMETER power-ups (S).** Rare drifting pickups the launcher must shoot: temporary coolant (no heat),
   a hull repair, a homing stream. Auto turrets exist since v2; pickups would be the other reward channel.
2. **PERIMETER touch and gamepad controls (S).** Left/right thirds of the screen move, tap-and-hold fires,
   two-finger tap pulses; Gamepad API for sticks. Needed before the minigame is phone-playable.
3. **PERIMETER sound (S).** WebAudio square-wave bleeps for fire, hit, pulse and hull damage, sharing the
   `render`-free audio module the main game will need in M8.
4. **PERIMETER replay export (S).** The sim is already deterministic in (seed, inputs); store the input
   stream and offer "watch best run". Doubles as a regression fixture for the minigame.
5. **PERIMETER as an in-universe terminal screen (M).** Reach it from the BETA office console in the main
   game ("TRAINING SIM"), with the real planet's continents and the current round's threat type as flavor.
6. **Daily seed for PERIMETER (S).** Same seed for everyone per calendar day, separate best score, mirrors
   the main game's daily seed mode (GAME_PLAN 12).
7. **Gamepad for the main game and PERIMETER (S).** Gamepad API polling in `ui/input.ts` mapped onto the same
   key codes (left stick = arrows, A = Space, B = Esc, bumpers = warp), so no screen changes. Touch pan and
   pinch landed in M8; this is the remaining half of GAME_PLAN 13's "controller/touch".
8. **Click-to-open lore on entities and HUD numbers (M).** Today `?` picks a context topic from the round's
   state. The plan wants a click on any body, readout, planner line, program or network to open its topic:
   needs hit regions registered by each draw call (a small `hitmap` in the Surface) and a pointer-up handler.
9. **Remaining 13 labs and RUN IN PYTHON (L).** Seven labs exist (ELLIPSE, VISVIVA, KEPLER_SOLVER, BETA,
   FOCUSING, 3DVT, MAGNITUDE). The other 13 in EDUCATION.md Section 7 follow the same `Lab` interface;
   RUN IN PYTHON needs Pyodide loaded on click (about 10 MB) and the pymiss mirror shipped as a wheel.
10. **PERIMETER drone speed vs late rock speed (S).** `SWARM_SPEED` is a flat 2.4 while the rock speed cap
    passes 2.4 at level 14 and reaches 3.4 at level 30, so late drones cannot catch rocks. Drone speed =
    max(2.4, 1.2 x speedCap(level)) was prototyped by the sound-lab agent and alone made the balance probe
    plateau; needs a matching rock-side change if the user's "swarm not keeping up" is about the drones.
11. **WebGL2 bloom pass for HOLO (L).** GAME_PLAN 24.2: a post-process bloom when WebGL2 exists, Canvas glow
    otherwise. HOLO today has iridescent gradient strokes and a 1 px chromatic offset in Canvas 2D only.
12. **Playwright smoke test in CI (S).** GAME_PLAN 26.3 asks for title -> tutorial -> one committed mission ->
    debrief in a real browser. Not added because the browser download (hundreds of MB) is a heavy dependency
    for a course repo; `scripts/smoke.mjs` covers the served site from node. Add `@playwright/test` as a dev
    dependency with a single spec driving the game by key events when the repo lives on GitHub.

