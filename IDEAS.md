# IDEAS.md

Features not in GAME_PLAN.md, one paragraph each with a size estimate and, since the M12 harvest (2026-10-17), a
recommendation. Nothing here is built before the owner picks it (GAME_PLAN Section 0). Sizes: S (hours), M (a day),
L (days). Recommendations: DO (worth it now), LATER (worth it, not yet), SKIP (not worth the weight), DONE.

1. **PERIMETER power-ups (S).** Rare drifting pickups the launcher must shoot: temporary coolant (no heat),
   a hull repair, a homing stream. Auto turrets exist since v2; pickups would be the other reward channel.
   Recommendation: SKIP. Turrets, seekers and swarms already scale as the reward channel; a third one dilutes the
   "one launcher, one planet" reading of the screen.
2. **PERIMETER touch and gamepad controls (S).** Left/right thirds of the screen move, tap-and-hold fires,
   two-finger tap pulses; Gamepad API for sticks. Needed before the minigame is phone-playable.
   Recommendation: LATER, together with 7, when a phone or a controller is on the test desk.
3. **PERIMETER sound (S).** WebAudio square-wave bleeps for fire, hit, pulse and hull damage, sharing the
   `render`-free audio module the main game will need in M8.
   Recommendation: DONE (v2.1 kits, v3.2 bass voices, v3.3 SOUND LAB; `src/audio/synth.ts` is the shared module).
4. **PERIMETER replay export (S).** The sim is already deterministic in (seed, inputs); store the input
   stream and offer "watch best run". Doubles as a regression fixture for the minigame.
   Recommendation: DO. Cheap, and the balance probe in `tests/minigame.test.ts` gets a real human run to replay.
5. **PERIMETER as an in-universe terminal screen (M).** Reach it from the BETA office console in the main
   game ("TRAINING SIM"), with the real planet's continents and the current round's threat type as flavor.
   Recommendation: LATER. Flavor only; the deep link already exists.
6. **Daily seed for PERIMETER (S).** Same seed for everyone per calendar day, separate best score, mirrors
   the main game's daily seed mode (GAME_PLAN 12).
   Recommendation: DO with 4 (same code path: a fixed seed plus a stored input stream).
   Status 2026-10-18: DONE (key 6 on the ready panel: today's seed, its own best).
7. **Gamepad for the main game and PERIMETER (S).** Gamepad API polling in `ui/input.ts` mapped onto the same
   key codes (left stick = arrows, A = Space, B = Esc, bumpers = warp), so no screen changes. Touch pan and
   pinch landed in M8; this is the remaining half of GAME_PLAN 13's "controller/touch".
   Recommendation: LATER, with 2.
8. **Click-to-open lore on entities and HUD numbers (M).** Today `?` picks a context topic from the round's
   state. The plan wants a click on any body, readout, planner line, program or network to open its topic:
   needs hit regions registered by each draw call (a small `hitmap` in the Surface) and a pointer-up handler.
   Recommendation: DO after M13. It is GAME_PLAN 23's main entry point and the Learning Center's front door.
   Status 2026-10-18: DONE for the system view (star, planets, the ghost, the threat and fragments, craft, the
   clock, budget, brief and prediction lines); hovering names the topic. Planner lines and program rows: next.
9. **Remaining 13 labs and RUN IN PYTHON (L).** Seven labs exist (ELLIPSE, VISVIVA, KEPLER_SOLVER, BETA,
   FOCUSING, 3DVT, MAGNITUDE). The other 13 in EDUCATION.md Section 7 follow the same `Lab` interface;
   RUN IN PYTHON needs Pyodide loaded on click (about 10 MB) and the pymiss mirror shipped as a wheel.
   Recommendation: labs LATER in batches of three by demand (QSTAR, IMPACT_ENERGY and SUNWARD first: they are
   named by the most-read topics). Pyodide SKIP unless a class asks; the notebooks cover the Python path.
10. **PERIMETER drone speed vs late rock speed (S).** `SWARM_SPEED` is a flat 2.4 while the rock speed cap
    passes 2.4 at level 14 and reaches 3.4 at level 30, so late drones cannot catch rocks. Drone speed =
    max(2.4, 1.2 x speedCap(level)) was prototyped by the sound-lab agent and alone made the balance probe
    plateau; needs a matching rock-side change if the user's "swarm not keeping up" is about the drones.
    Recommendation: LATER, inside the next tuning pass with the owner at the keyboard.
11. **WebGL2 bloom pass for HOLO (L).** GAME_PLAN 24.2: a post-process bloom when WebGL2 exists, Canvas glow
    otherwise. HOLO today has iridescent gradient strokes and a 1 px chromatic offset in Canvas 2D only.
    Recommendation: SKIP unless HOLO reads flat on the owner's screen; two render paths double the visual tests.
12. **Playwright smoke test in CI (S).** GAME_PLAN 26.3 asks for title -> tutorial -> one committed mission ->
    debrief in a real browser. Not added because the browser download (hundreds of MB) is a heavy dependency
    for a course repo; `scripts/smoke.mjs` covers the served site from node. Add `@playwright/test` as a dev
    dependency with a single spec driving the game by key events when the repo lives on GitHub.
    Recommendation: DO when the repo is pushed; keep it out of `npm run check` so the gate stays fast.
13. **Wire the ten inert program effects (M).** `applyEffects` stores `precursor`, `launchCap`,
    `launcherTierUnlock`, `c3Bonus`, `warheadBuildYears`, `groundLaser`, `damageMult`, `sailDepot`,
    `lunarDriverC3` and `fusionTugN`, and nothing reads them (STATUS.md "M12 walk"). Each is a one-site change:
    precursor reveals the beta range at discovery (brief line), launch cap counts launches per year in the
    planner, launcher tier unlock raises `run.launcherTier`, C3 bonus shifts the launcher table lookup, warhead
    build years sets the NUKE build time, ground laser auto-fires inside 0.05 AU (resolver post-pass like
    DE-STAR), damage multiplier scales the hit energy in scoring, and the three SCI-FI depots become standing
    capabilities in `ResolveOpts.scifi`.
    Recommendation: DO FIRST after M13. The PROGRAMS panel promises these effects and the player pays for them.
    Status 2026-10-18: DONE for launcher tier unlock, launch cap (a real 365-day cadence rule now), C3 bonus
    (ORBITAL_DEPOT and LUNAR_MASS_DRIVER, read inside every search), ground laser (DE-STAR's windows inside
    0.05 AU at 30 % through the air), precursor (tracking tier 1), sail depot and fusion tugs (standing strikes
    and pushes). Still inert: warheadBuildYears (warheads have no separate build time to shorten) and damageMult
    (no damage model downstream of a hit yet).
14. **Civilization level auto-unlock (S).** GAME_PLAN 22.3: all REALISTIC programs complete unlocks SCI-FI
    without a code, all SPECULATIVE complete unlocks SIMULATION. `civilizationLevel` is computed; the title
    readout exists; only the codes move the mode today.
    Recommendation: DO with 13 (one check at round end, one note line).
    Status 2026-10-18: DONE (src/game/civ.ts). Also fixed: entering SCI-FI never added the SCI-FI programs to the run.
15. **DART as a full second tutorial (M).** The DART code prints the real mission numbers; the plan wants a
    guided replay round with the Didymos geometry and the measured beta.
    Recommendation: LATER. The TUTORIAL round covers onboarding; this is a history lesson for the Learning Center.
16. **IMPERIAL units in readouts (S).** The OPTIONS setting is stored and round-trips; every readout still prints SI.
    Recommendation: SKIP until a player asks; the lore and the code are SI by rule.
17. **Multiverse branch variants beyond beta and fragment draws (M).** Branches differ only by the seeded
    beta and fragment draws; a different threat in a branch is only reachable through WORMHOLE.
    Recommendation: SKIP. The point of the tiles is the same threat under different luck.
18. **Polish bucket (S each).** Quizzes from EDUCATION `quiz:` blocks; materialize frames on the planner,
    programs and tech overlays; the orbit-plane grid fading with distance under tilt; a sampled arc for slow-push
    bodies instead of the jump at the arc's end; the discovery search moved into the worker if round start
    ever stutters.
    Recommendation: LATER, one at a time when the owner notices the seam.
