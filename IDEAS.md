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
   Status 2026-10-18: DONE for PERIMETER (thirds steer and fire, two-finger tap pulses, a tap starts or resumes),
   gamepad everywhere (7). Touch in the main game still pans and pinches.
3. **PERIMETER sound (S).** WebAudio square-wave bleeps for fire, hit, pulse and hull damage, sharing the
   `render`-free audio module the main game will need in M8.
   Recommendation: DONE (v2.1 kits, v3.2 bass voices, v3.3 SOUND LAB; `src/audio/synth.ts` is the shared module).
4. **PERIMETER replay export (S).** The sim is already deterministic in (seed, inputs); store the input
   stream and offer "watch best run". Doubles as a regression fixture for the minigame.
   Recommendation: DO. Cheap, and the balance probe in `tests/minigame.test.ts` gets a real human run to replay.
   Status 2026-10-18: DONE (src/minigame/replay.ts; the best unassisted fresh game is saved; 7 WATCH BEST).
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
   Status 2026-10-18: DONE (src/ui/gamepad.ts; standard mapping: A fire/pause/commit, B back, X planner, Y lore,
   LB/RB warp or seeker/swarm, LT pulse, RT planet view, VIEW tab, MENU Learning Center, d-pad and left stick arrows).
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
    Status 2026-10-18: DONE (the DART code starts a five-step guided replay on DIMORPHOS with the measured beta 3.6).
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
    Status 2026-10-18: quizzes DONE (Q in the Learning Center, 21 questions in config/quiz.json).

19. **AUTOPLAY: watch and learn (M).** Owner 2026-10-18. A mode (title item and the AUTOPLAY key, A) where the
    game plays itself: picks plans, funds programs, warps, and explains each choice in pop-up info panes held long
    enough to read (about 0.25 s per word, minimum 4 s). Status 2026-10-18: DONE (game/autoplay.ts drives the real screens with injected keys; tech and program
    purchases are not automated yet).

20. **SUPER-DUPER-DEMO (M).** Owner 2026-10-18. AUTOPLAY that keeps accelerating; after 100 games it turns into
    blinking-light montage screens (data centres, global maps of super-intelligence activations, all power routed
    to the simulation, off-world compute, a time portal pushing nanobots back through a wormhole, hints of tech
    that is not in the game), faster and faster, then a pause and a green teletype window: "STRANGE GAME. THE ONLY
    OPTION IS TO KEEP WORKING TO PROTECT YOUR PLANET. SHALL WE PLAY A GAME OF CHESS, OR WILL YOU HELP US SAVE THE
    WORLD?" Every montage line FICTION in character. Status 2026-10-18: DONE (render/views/demo.ts, DEMO_* knobs).

21. **Robot voice-overs and game sounds (M).** Owner 2026-10-18. Canned lo-fi voice lines ("LAUNCHING", "BUILDING",
    "IMPACT IMMINENT", outcomes) rendered offline with Kokoro (Apache-2.0) British voices bf_emma and bm_fable,
    vocoded through a synth chain, compressed small; OPTIONS VOICE OFF / FEMALE / MALE. PERIMETER's lo-fi cues in
    the main game and the menus, with their own OPTIONS switch. Status 2026-10-18: DONE (voice + SOUND STYLE).
    Status 2026-10-18: voice-overs DONE (22 lines x 2 voices, 196 KB of Opus, `scripts/gen_voice.py`,
    `src/audio/voice.ts`, OPTIONS > VOICE). AUTOPLAY and FINALE lines are rendered but wait for items 19 / 20 to
    call them. PERIMETER cues in the main game with their own switch: still open.

22. **PERIMETER self-play demo, difficulty levels, level skip (M).** Owner 2026-10-18. A self-playing PERIMETER at
    75 % speed used to tune the minigame; its findings go to `docs/MINIGAME_BACKLOG.md` for review. Difficulty
    levels and a menu start at level 10 / 20 / 30 / 40. Challenging but not too hard. Status: in progress.

23. **X.509 compliance enhancements (S-M).** Owner 2026-10-18, for the github.io release. Scope to be set at the
    security assessment: HTTPS-only with GitHub Pages' certificate (enforce HTTPS, HSTS behaviour of github.io),
    no mixed content, a custom domain only with a valid certificate and CAA record, signed release tags/commits,
    and checksums for downloadable builds. Status: backlog.

24. **Research backlog and claim registry (M).** Owner 2026-10-18. Every real-world number that is not yet checked
    against a source shows as UNVERIFIED in game text and lives in `docs/RESEARCH.md` with a method to check it;
    findings feed the Learning Center; ideas found unfeasible get their own Learning Center section. Status: next.

25. **Pre-public checklist: licence, attribution, support (M).** Owner 2026-10-18. AGPL-3.0 as the licence model
    (network use must offer source; credit kept), adopted 2026-10-18; a
    NOTICE/AUTHORS file; an AGPL section 7 term preserving "Created by SPACED" on the credits screen; an ABOUT page
    with "Created by Ridley DiSiena aka SPACED"; FUNDING.yml and a voluntary "Support this project" line once the
    owner's Patreon is set up; CLA only if dual licensing is wanted; third-party attribution refined. Not legal
    advice; the owner decides. Status: licence, NOTICE, attribution and support DONE 2026-10-18; CLA and the repository URL
    in the credits remain.

26. **More bodies to defend (L).** Owner 2026-10-18. Two or more protected bodies: first a Moon base (the Moon as a
    second target with its own small b-crit and damage scale), then Mars cities (a second planet: the threat may be
    aimed at either; interceptors launch from Earth or later from Mars), then outposts on Jupiter or Saturn moons.
    Needs per-target close approach, targets in the round generator, and debrief and score per body. Status: queued.

27. **Fighting back against out-of-plane visitors (L).** Owner 2026-10-18. Since M14 phase 2, visitors from other
    stars arrive from any direction and most are out of reach of a launch from HOME (4 of 30 sampled SCI-FI
    visitors have any feasible launch, against 9 when flat; flyby and sail plans are not offered against 3-D
    targets). This is a real problem to solve with new defensive methods, not by making visitors easier. Candidates,
    each to go through docs/RESEARCH.md before it gets numbers:
    - 3-D flyby and sail planning (engineering, REAL physics): a GIANT or INNER gravity assist and a sail's
      out-of-plane force are the classic ways to change plane cheaply; restore both plan families in 3-D.
    - Plane-change kick stages (PROPOSED): a tech line raising the deep-space dv budget for out-of-plane intercepts.
    - Interceptors parked out of the plane (PROPOSED/SPECULATIVE): standby craft at high-inclination halo or
      distant retrograde orbits, or at L4/L5 and Sun-Earth L1/L2, so one of them is always closer to the arrival
      direction; extends INTERCEPTOR_ON_STANDBY and the L4/L5 picket.
    - Nuclear-electric fast interceptors (PROPOSED): high-dv, long-burn craft that can reach steep arrivals given
      months of warning, paired with earlier detection.
    - Earlier warning (PROPOSED): HIVE_2/HIVE_3 nodes above and below the plane already in the studies; tie their
      success to the interstellar needle and to more lead time for visitors.
    - Directed energy that ignores the plane (SPECULATIVE, SCI-FI): the orbital laser array and ground laser act by
      range, not plane; check they apply to 3-D bodies and say so in the planner.
    - Terminal defense for the last weeks (PROPOSED): PI penetrator arrays and civil defense tuned for visitors.
    Also: show in the planner WHY no plan exists for a 3-D visitor (plane too steep, dv shown), so the player learns
    what would help. Status: queued (owner: put in backlog; build in turn).

28. **Hosting origin (S).** Owner 2026-10-18: publish from the owner's GitHub account (in the keyring). Suggestion:
    a free GitHub organization for the project (for example `spacedlab`) keeps the owner's account but gives the
    game its own origin `<org>.github.io`, so no other project page shares its browser storage; a custom domain can
    come later (then the X.509 items, IDEAS 23). Status: DECIDED 2026-10-18: organization `spaced-lab` (the owner
    creates it on github.com), repository `spaced-lab/miss-beta`, site https://spaced-lab.github.io/miss-beta/.

29. **Framing and response headers (S-M).** Owner: fine for now, understand and adjust later. GitHub Pages cannot
    send `frame-ancestors` or other headers; options are a custom domain behind a CDN that sets headers, or a
    small frame-busting check. Study the options and record the choice in docs/DECISIONS.md. Status: backlog.

30. **Ordinary NEAs in 3-D (M).** Owner: one of the first updates after code review. Moving the ordinary rounds to
    3-D changes every seed's rounds, so the planar replay fixture is retired on purpose; also flyby and sail plans
    against 3-D targets, 3-D fragment cones, retrograde long-period comets (STATUS, M14 remains). Status: queued
    first after review.

31. **PERIMETER balance fixes as a learning item (S).** A start at level 10 outlasts a level-1 run (fresh hull,
    full moon, reset pressure); HARD from level 40 is a 15-second wall. Fix with the bot table in
    docs/MINIGAME_BACKLOG.md and write up how the measurement drove the fix. Status: backlog.

32. **Saturn-like planet and its moons (M).** Needs a new planet in bodies.json, which changes every seed's world;
    batch it with item 30's seed change. Status: backlog, skipped for v26.4.0.

33. **Claims review to keep us honest (M).** Re-read every SOURCED claim's source and promote it to CHECKED, or
    correct it; research the UNVERIFIED ones (docs/RESEARCH.md section 4). Status: backlog, recurring each release.

34. **Flash measurement (S).** Measure each flash against the WCAG general-flash and red-flash thresholds (area
    and luminance, claim G8-1); keep the notice and REDUCE MOTION for now, and add a dedicated REDUCE FLASHING
    option if testing finds any effect over the line. Status: backlog.

35. **Automated security steps (S).** Script the automatable parts of the docs/SAFETY.md checklist (clean
    checkout gate and build, dist greps, CSP check, oversized and malformed SAVE.md import); reviewed by the owner;
    the full manual security review still happens before every publish. Status: backlog.

36. **Robot voice work (M).** Owner: voice will be worked on; more options; FEMALE stays the default. Listen to all
    six voices, tune clarity (scripts/gen_voice.py), add options. Status: backlog.
