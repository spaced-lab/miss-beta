# STATUS.md

One line per milestone, the knobs changed from GAME_PLAN defaults and why, decisions where the plan was silent,
and any formula tagged `[unverified]`. Detailed checklists live in `docs/BUILD_PLAN.md`.

## Milestones

| Milestone | State | Notes |
|---|---|---|
| Pre-M0 scaffold | done | Vite 8 / TS 5.9 / vitest 5, render foundation, RNG, font, title screen |
| PERIMETER minigame (side mode) | v3.4 done, tuning | levels, adaptive pressure, hardness tiers, stream strength, heat, moon, impulse, turrets; knobs in `src/minigame/config.ts`; 2026-10-17 retune: easier open, steeper ramp, guarded by the balance probe in `tests/minigame.test.ts`; sessionStorage autosave + RESUME across dev reloads (`serialize`/`deserialize` in sim.ts, `Rng.fromState`); v2.4 sound: master compressor + sub layer under hits (not audible in tests: by ear only); v2.4 sentry archetypes ORBITER / SWEEPER / PICKET / CHASER (`SENTRY_*` knobs); seekers (`<`, `SEEKER_*`) and swarms (`>`, `SWARM_*`), save v3; ready panel: Space/R RESUME, Backspace NEW GAME; swarm grows with level (`SWARM_GROWTH_PER_LEVEL`, `SWARM_COUNT_CAP`), drones and seekers avoid the moon (`*_MOON_MARGIN`); v3.2 no plateau: `spawnFloor`, `speedCap`, `hpMult`, `pressureMax`, `damageMax`, `maxAsteroids` grow slowly past levels 9-15, tiers 4-5; weapons scale (`seekerMax`/`seekerVolley`/`seekerHitsNeeded`, `swarmMax`, `turretMax`/`turretHitsNeeded`, `laserRange`, MESH laser stages 3-4); v3.2 sound: hull hit = deep rumble (`synth.rumble`), breakups on the thud voice, bass-pop hits, activity layer, mesh cluster, soft level-up pulse (by ear only); v3.2 balance probe: weapons-using bot, 600 s, seeds 1..4; v3.3 SOUND LAB (`L` on the ready / game-over panel, `soundLab.ts`): 3-4 named variants + OFF per event in `sfx.ts`, review mode, volume and ambient rows, one guarded localStorage key; least-clicky defaults for shot / hit / sentry; swarm charge `SWARM_KILLS_PER_LEVEL` 30 -> 20 and `SWARM_KILLS_CAP` 400 (bot charges every 11-15 s from level 8; gentler settings let it plateau); v3.4 (owner follow-up 2026-10-18): swarm price eases past level 20 (`SWARM_KILLS_EASE_*`, floor 160 from level 40), drone tiers (`SWARM_TIER_*`: speed, damage, colour; two colours per swarm, 1 at level 12, 2 at 18, 3 at 24), bigger swarms (growth 0.7, cap 40), sentry lasers from level 14 in the sentry's tier colour (`SENTRY_LASER_*`), the BEAM ARRAY from level 25 (`SENTRY_ARRAY_*`: three or more sentries eliminate the most threatening rock outright, no fragments, every 9 s), a faster ramp (`LEVEL_SECONDS` 20 -> 17, `SPAWN_LEVEL_FACTOR` 0.78 -> 0.75, `AST_SPEED_PER_LEVEL` 0.12 -> 0.14, `HP_MULT_PER_LEVEL` 0.15 -> 0.30, `SPAWN_FLOOR_FACTOR` 0.95 -> 0.93 with `SPAWN_FLOOR_ABS` 0.08 -> 0.05 so the floor still falls past level 27, `PRESSURE_MAX_PER_LEVEL` 0.02 -> 0.03), and every high cue lowered (SENTRY variants 72-165 Hz, game over 110 -> 24 Hz under a 700 Hz filter plus a rumble, swarm chirps, cooled, burnout, chime, ping, bell). Balance probe 2026-10-18 (armed bot, seeds 1..4, 600 s, god off): with the new weapons the bot kept 48-84 hull at level 36 until rock hit points went to +30 %/level; at 0.30 every seed dies between 526 and 588 s (levels 31-35), hull lost before level 10 is 0-16, one swarm every 8 s and ten to fifteen arrays per run. Hit points were again the only axis that bit (0.22 with a higher damage cap, speed cap or spawn floor left one seed at 75); sentry and array beams no longer charge the seeker counter (that loop made seed 1 untouchable); v3.5 ready panel: `9` difficulty EASY / NORMAL / HARD (`MG.DIFFICULTY` multipliers on spawn rate, rock HP, speed, hull damage; NORMAL = base balance; EASY 0.8/0.85/0.9/0.7, HARD 1.3/1.7/1.15/1.4; bot table in config.ts and `docs/MINIGAME_BACKLOG.md`: from level 1 EASY 821-900+ s, NORMAL 480-584 s, HARD 367-472 s), `0` start level 1/10/20/30/40 (`modes.setupStart`: level-derived upgrades plus a kit, `START_*`; not ranked), `8` SUPER DEMO (bot.ts at `DEMO_SPEED` 0.75, any key exits), best per difficulty, shake off under REDUCE MOTION |
| M0 Skeleton and orbits | done | constants/kepler/elements (TS + pymiss, shared vectors), world with seeded phases and variety knobs, system view with warp ladder, LINEAR/COMPRESSED scale, pan/zoom. Hershey font deferred to M8 by decision |
| M1 A threat, and losing | done | closeApproach.ts (+ pymiss mirror, vectors), roundGen.ts with guaranteed collision (1000 seeds sane, 200 seeds impact), threat orbit + ghost + brief in the system view, RESOLVE NOW, RUN OVER with Mt and category |
| M2 First playable: direct kinetic | done | Lambert (+ mirror, vectors, Hohmann check), kinetic (DART), launcher tables, porkchop grid in a worker, KINETIC candidates ranked and resolved, resolver v1 with per-mission beta and terminal guidance, economy per year, Section 12 scoring, validated leaderboard, PLANNER overlay, craft in flight, play-by-play, DEBRIEF, next round |
| M3 Breaking things | done | fragment.ts (+ mirror, vectors): Q*, largest remnant, Pareto shards, Rayleigh ejection with exact momentum; resolver v2 tracks bodies, disrupts above Q*, per-body close approach with the 3-D correction draw, PARTIAL outcome; Monte Carlo in the worker; planner targets any live body (Tab), SWARM bundles, DISRUPT flag, P(MISS) per plan; PLANET VIEW (V) |
| M4 Going faster | done | integrate.ts (RK4 + Euler for the lab), sail.ts (force model, SPIRAL/COAST/TARGET_STEER, arcs), flyby.ts (patched conic), two-leg flyby search and sail search in the worker, KINETIC_FLYBY and SAIL_KINETIC plans with legs drawn, FLYBY WINDOWS; all mirrored in pymiss with vectors |
| M5 Seeing it coming | done | photometry (+ mirror, vectors), detection model with today's and the proposed networks (activation years), discovery search, round generation on discovery-derived lead with NO WARNING rounds, civil defense (E), PROGRAMS panel (G) with effects on completion, SAVE.md writer/parser with CONTINUE, export (X) and drag-drop import, CODEX from config |
| M6 The full tree | done | tech tree (T), autonomy tiers 1..3 with the rules DSL and presets, split carriers, nuclear (standoff/surface/subsurface/HAIV/pulse train), the slow-push family with NOT VIABLE numbers, PI, tracking tiers with uncertainty and the beta reveal delay, debrief scrubber, leaderboard tabs; fuzz test over every plan family; Section 17 balance checks. Capture bag deferred to M7 with the net (NET1 is SCI-FI) |
| M11 Teaching repo | done | pymiss mirrors complete + test_m11, seven notebooks, CODE_TOUR, ASSUMPTIONS A1..A16, LESSONS generator, README, CONTRIBUTING, issue templates, CI workflow with Pages deploy (unrun: no GitHub remote yet), scripts/smoke.mjs (node, no browser). Playwright deliberately skipped (IDEAS 12) |
| M10 Visual system | done | palettes.json, SPECTRUM (unlock + toggle + ROLE_STYLE line styles), HOLO gradient strokes (no WebGL bloom yet), camera3d tilt on I with the wireframe polyhedron, wireSphere in the planet view, StarField parallax, Materialize frames on the system panels, PALETTES contrast test. Materialize on the planner/programs/tech overlays deferred |
| M9 Learning Center | done | build_lore.py (parse + validate + chunks; `--check` in the gate), LoreStore with 2 MB LRU and zero fetches at boot, lore panel on `?` with a context topic (brief, plan, fragments, planet view, debrief), Learning Center with tree/progress/search/bookmarks/LABS, seven labs (of 20) as dynamic imports, 55 SIMPLE pictures (agent), lowercase glyphs. Labels inside SVG pictures use the browser's monospace font (the one raster font on screen; documented) |
| M8 Polish | done | TUTORIAL round 0 (GAME_PLAN 25) with eight step predicates, OPTIONS + settings record, CRT pass (scanlines, vignette, flicker), attract mode via game/attract.ts, DAILY RUN seed, UI sound cues, touch input, frame bench (state cost per frame printed by `npm run bench`). Hershey font not adopted (see BUILD_PLAN M8). Units IMPERIAL is stored but readouts still show SI |
| M7 Modes, cheats, fiction | done | modes nesting (REALISTIC > SCIFI > SIMULATION > MULTIVERSE) with per-mode leaderboards, console (`) on the title and in a run with the public cheat-code table (REVEAL, FASTBUILD, GODTRACK, LEADTIME, SPAWN scenarios, DART, KARDASHEV1/2), FICTION commands with their forbidding quantities, SUMMONDEVS knobs editor, SCI-FI programs and methods (CNT net capture, DE-STAR in-range firing, fusion/Orion tugs, disassembler decay), hyperbolic Kepler branch (TS + Python, shared vectors) for INTERSTELLAR rounds plus LONG_PERIOD and GIANT flavors, MULTIVERSE tiles with COLLAPSE and WORMHOLE, glitch pass. Civilization-level auto-unlock of SCI-FI is computed (civilizationLevel) but only the codes move the mode so far |
| M12 Exhaustion check | done | walked GAME_PLAN 19, 20, 22.2 and the EDUCATION topic map and LAB registry against the code (findings below); IDEAS.md numbered with a recommendation each |
| M13 Cinematics and narratives | done | GAME_PLAN 29: `render/cinematics/*` (scene data built deterministically from the event, drawn as a pure function of elapsed time; launch, impact, breakup by body type, nuclear, PI, close approach; any key skips; reduce-motion = still frame), `config/narratives.json` + `game/narrative.ts` (templated briefs, slot check, SPECTRUM roles) rendered by `views/teletype.ts`, `game/warpDown.ts` once-per-arrival warp drop with the HUD line |
| Performance pass (2026-10-18) | done | docs/DECISIONS.md D1-D7: PERIMETER, Learning Center, demo finale and lore pictures load on first use (LazyScreen); boot JS 546.5 -> 387.6 KiB (198.8 -> 140.4 KiB gzip); attract round planned in the shared planner worker, first frame median 251 -> 48 ms; one planner worker per page; source maps kept (MISS_SOURCEMAP=0 drops them); `window.__miss.screens` is now `{ get }` and unwraps lazy screens |
| Cinematics: finer launch pixels (2026-10-18) | done | `render/cinematics/launch.ts`: procedural rocket sprites at about 2x resolution (porthole, livery, interstage bands, roll marks, fins, L3 boosters with their own plumes), 5-cell lattice tower, plated pad with flame trench; plume head in a thermal false-colour ramp (`CINE_FALSE_RAMP` under NEON, hot/ink/alt/dim in mono) with a dithered hand-off to fire, shock diamonds, false-colour ember pixels; impact/breakup debris at `CINE_DEBRIS_PX_SCALE` 0.6 with hot false-colour ejecta and one-pixel motion tails. New `CINE_*` knobs at the end of KNOBS. Cost: launch L3 about 2.6k dots and 0.9 ms/frame in Chrome at DPR 2 (bench/cinematics.bench.ts: 0.19 ms JS) |
| F12 visitors from other stars + LAB_INTERSTELLAR (2026-10-18) | done | topic F12 (the warning sum, tech levels, rate dial and EXAGGERATED, 3-D lite), `lore/labs/interstellar.ts` (orbit built backwards from impact, tilted about the node, discover() per network with `tilt`, about 12 ms per recompute, memoised), `pic-interstellar`; claims F12-3..5 added UNVERIFIED; defence thresholds in the lab (KINETIC 548 d, NUKE STANDBY 90 d, EVACUATE 21 d) are rules of thumb, not claims |
| M14 phase 1: 3-D Kepler (2026-10-18) | done | physics only, game untouched: `physics/kepler3.ts` (Elements3 = Elements + i, raan; `propagate3`, `planeToEcliptic`, `angularMomentum3`, `orbitPoints3`, `liftElements`), `elements3.ts` (`stateToElements3`, equatorial and circular conventions), `closeApproach3.ts`; pymiss mirrors `kepler3.py`, `elements3.py`, `close_approach3.py`; vectors `kepler3.json`, `elements3.json`, `closeApproach3.json`; i = 0 gives the planar r, v and elements bit for bit (tests/kepler3.test.ts, pymiss/tests/test_kepler3.py). Phase 2 plan under Decisions |
| M14 phase 2, first slice: 3-D visitors (2026-10-18) | done | visitors from other stars (REALISTIC dial and SCI-FI INTERSTELLAR) are generated in 3-D (`roundGen.ts drawCollidingOrbit3`: HOME's state plus an isotropic v_inf, stateToElements3; Threat.elements holds the Elements3) and stay 3-D through discovery (`detection.ts` reads i, raan), resolver (`sim/orbit3.ts`: kinetic dv via `kineticImpact3`, nuclear and DSM retargets via `lambert3`, along-track pushes in the orbit's plane, fragments 3-D, `targets.ts` closeApproach3 and a 3-D moon scan), planner (`porkchop.ts porkchop3` with v1z/v2z/rz, missions carry z), SAVE.md (`i_rad`, `raan_rad`), system/SKY/planet/mini views. New physics `lambert3`, `kineticImpact3`, `alongTrack3` mirrored in pymiss, vectors `lambert3.json`. Planar rounds bit-for-bit (`tests/planarReplay.test.ts`, fixture captured before the change); `tests/visitor3d.test.ts`. Remaining under Decisions |

## M12 walk (2026-10-17): plan versus code

- **Programs (GAME_PLAN 19)**: 20 of 20 defined in `config/programs.json`, fundable, completable, saved. Ten effect
  fields are written by `applyEffects` and read by nothing: `precursor` (PRECURSOR_FLEET), `launchCap` and
  `launcherTierUnlock` (HEAVY_LAUNCH_CADENCE), `c3Bonus` (ORBITAL_DEPOT), `warheadBuildYears` (NUCLEAR_READINESS),
  `groundLaser` (GROUND_LASER), `damageMult` (half of CIVIL_DEFENSE_READY), `sailDepot`, `lunarDriverC3`, `fusionTugN`
  (SCI-FI depots). Live and tested: budget, research, warhead penalty, evacuation threshold, network activation and
  coverage, tracking tier, build time, sigma_v, orbital laser, disassembler. The PROGRAMS panel promises all twenty,
  so the inert ten are IDEAS 13 with a "do first" recommendation.
- **Methods (GAME_PLAN 20)**: 56 entries in `config/methods.json`, every row of 20.1 to 20.4 present with its tag and
  unlock; every FICTION command exists in the console with its forbidding line. HAMMER_SWEEP is the player re-planning
  against fragments (documented above). The GROUND_LASER method force exists but is not auto-applied inside 0.05 AU.
- **Cheats (GAME_PLAN 22.2)**: all 13 codes and the 7 SPAWN scenarios exist; DART prints the real mission numbers
  instead of running a second guided round (IDEAS 15). 22.3 civilization level is computed but does not move the mode
  by itself (IDEAS 14).
- **EDUCATION topic map**: 55 of 55 topics at five levels, 55 SIMPLE pictures, `build_lore.py --check` green.
  LAB registry: 7 of 20 built (ELLIPSE, VISVIVA, KEPLER_SOLVER, BETA, FOCUSING, 3DVT, MAGNITUDE). Missing: LAMBERT_PORKCHOP,
  FLYBY, QSTAR, FRAGMENT_CLOUD, SAIL_SPIRAL, NUKE_STANDOFF, TRACTOR, ROCKET_EQ, SUNWARD, MONTECARLO, RK4, IMPACT_ENERGY,
  TORINO; the lore panel marks them BUILDING (IDEAS 9).

## Knobs changed from GAME_PLAN defaults

Kepler solver tolerance 1e-14 instead of the plan's 1e-12 (one extra Newton step; lets the energy test hold at 1e-12 relative). Everything else at default. Minigame knobs are not in GAME_PLAN; their defaults
are the values in `src/minigame/config.ts` and the 2026-10-17 tuning (FIELD_R 5.6, VIEW_R 6.2 so the planet
reads larger on wide screens). Balance retune the same day (owner: "a tiny bit too hard, accelerate more
quickly"): SPAWN_0 1.8 -> 2.2, SPAWN_LEVEL_FACTOR 0.84 -> 0.78, AST_SPEED_0 0.55 -> 0.45, AST_SPEED_PER_LEVEL
0.08 -> 0.12, LEVEL_SECONDS 24 -> 20, PRESSURE_GAIN 0.012 -> 0.015, new PRESSURE_START 0.85, DAMAGE_MAX 25 ->
DAMAGE_MAX_BY_LEVEL [12, 16, 25]. Anti-plateau retune (same day, owner: "it seemed to plateau around 30"), all
levels 1-5 untouched: SPAWN_MIN is now a floor that shrinks 5 % per level from level 9 to 0.08 (`SPAWN_FLOOR_*`),
AST_SPEED_MAX becomes a cap rising 0.06 per level past 10 with a second speed slope of 0.1 per level past 10
(`AST_SPEED_LATE_*`, `AST_SPEED_CAP_*`), rock hit points x(1 + 0.15 per level past 10) (`HP_MULT_*`), pressure
ceiling +0.02 and hull damage cap +0.4 per level past 10, rock budget 140 -> 220 by level; tiers 4-5. Weapons
scale up (seeker cap 3 -> 6 and volleys to 4, swarm cap 2 -> 5 and drones to 32, sentries 3 -> 6, laser reach to
8.6 and the MESH stages) while swarm and pulse charges grow with level (SWARM_KILLS +30 per level past 6,
PULSE_KILLS +2): the probe showed permanent drone cover made the planet untouchable from level 3 on. Hit points
were the only rock axis that produced impacts against a full arsenal; speed and density were killed as spawned.

## Decisions

- 3-D lite (2026-10-18): visitors from other stars carry an inclination about their impact node; only detection
  (3-D view geometry, trailing loss, latitude-dependent coverage) and drawing use it; the resolver stays flat,
  which is exact at the node where the encounter happens. The visitor draw uses its own seeded stream, so every
  seed keeps its ordinary rounds at any rate. The gauge now uses the same latitude-dependent coverage.

- Studies (2026-10-18): EXPERIMENTAL is a tag on feasibility-study cards only (owner backlog 6 asked for it); no
  existing method entry gained, lost or moved a tag. A study's fate (duration, success, failing milestone) is
  drawn from the run seed, card id and attempt number, so saves store only attempt, progress, funding, status.
  Durations shown are medians; the drawn duration stays hidden, as in real research. Fusion successes grant a
  REALISTIC fusion tug at 10-20 kN (the SCI-FI fleet is 50 kN).

- Gauge (2026-10-18): the rounds fly a flat system; the gauge alone tilts each reference orbit about its impact
  node (GAUGE_INCL_DEG) and charges ground surveys a trailing loss, because a flat model read the DEFLECT needle
  at about 8 m (every earlier pass an exact crossing). Each network counts from its start year with the reference
  rocks hitting 1-3 years ahead, so Rubin moves the needle over the years (2026: 85 m, 2036: 45 m, 2046: 30 m).
  SUNWARD uses the 3-week warning (with 1 year it matched DEFLECT: sunward rocks are found on earlier passes).
  The needles are the game model; real completeness figures are claims (docs/RESEARCH.md). `[unverified]` where the plan was silent

- AUTOPLAY (2026-10-18): the autopilot presses the same logical keys a player would (Input.inject), reads a
  narrow AutoView, and waits while a pane is up (2.5 s + 0.32 s/word, 4-14 s). No single MISS plan: stack the
  plan that improves the margin most (up to 4), else wait a year if lead > 1.5 y, else evacuate 120 d out.
- Voice (2026-10-18, IDEAS 21): newest line wins (a new line cuts the old one with a 60 ms fade) instead of a
  queue, except one explicit follow-up (HIT then GAME OVER, COMMITTED then BUILDING); the same line is not
  repeated within 8 real seconds, and a batch of events speaks only its most important line (`voiceForEvents`),
  so high warp cannot spam. Program completion says "Research complete." (no dedicated line). The vocoder mix
  keeps 45 % dry voice: a Whisper transcription check scored the pure vocoder 8/24 lines, this mix 17/24.
  Ogg Opus decodes in Chromium and Firefox and in Safari 18.4+; older Safari stays silent (logged, no error).

- Keys (2026-10-18): rebinding is a swap at the Input layer (physical -> logical code), so screens keep testing
  default codes and no key is ever lost; Escape and arrows are not bindable. MANUAL defaults to M.

- Labs batch A (2026-10-18): LAB_QSTAR adds impactor m and U sliders (the registry's "Q from an impactor
  overlay" needs them) and LAB_TRACTOR adds body D and a tier slider for the beam / laser / driver (the
  tractor's m_sc and d/R go through the new `gravityTractorForce`); EDUCATION.md Section 7 updated. The nuclear
  lab's C_m slider rescales `nuclearBurst`'s dv linearly from KNOBS.NUKE_CM; the fragment-cloud lab derives
  the body radius from its v_esc slider at stony density and leaves the impactor momentum out (m = 0).

- Tech costs in research [knob]: N1 / SL1 / P1 cost 2 so a first-round win (about 6 research) buys the first
  flyby, sail or kick stage; the chains climb to 10-15. Runs start at the plan's basics.
- Autonomy: retargets keep the arrival time (a Lambert re-solve from the craft's state at the event), need at
  least AUTONOMY_MIN_LEAD (10 d) before arrival, and never apply to warheads or pushers. Split carriers without a
  trigger deploy 30 days before arrival. BETA_ASSESSED and MISS_PREDICTED fire at impact + the tracking delay.
- Rules editing: three validated presets cycled with R in the planner; free-form JSON editing arrives with the
  console (M7).
- Slow push arcs: the body is drawn on its pre-push orbit during the arc and jumps to the pushed orbit at the
  arc's end (a sampled table for the arc is a polish item).
- Ground laser (program effect) is modelled as a method force but not yet auto-applied within 0.05 AU (M8); the SCI-FI DE-STAR array is auto-applied in range (resolver post-pass).
- SCI-FI flavored rounds skip the discovery model (lead fixed by flavor, discoveredBy ASSUMED). Long-period comets are drawn at 25 to 45 km/s because a 2-D prograde world has no retrograde comets [documented simplification].
- Tutorial steps advance on predicates (warp reached, planner opened, mission committed, launch, impact, debrief); the lore ids on each step are waiting for the M9 panel.
- Multiverse branches share the run's economy; a commit in one branch spends the common budget (the plan's "commit different missions in different tiles" works, the money is one pool).
- PI: the shredded body is removed and PI_DAMAGE_FRACTION (5%) of its energy is credited as damage, which
  resolves as PARTIAL under the 10% rule.

- Networks carry an activation year (`since`); the game's now is EPOCH_YEAR 2026. The discovery search runs
  20 years before impact in round time (t = 0 is now), so pre-2026 surveys can find old rocks and planned networks
  only count from the year their program completes.
- Discovery-derived rounds re-base the clock so t = 0 is the discovery: planet and threat epochs are shifted
  together (roundGen.shiftEpoch). The discovery search runs synchronously at round start (tens of ms per
  candidate); moving it to the worker is a BUILD_PLAN note.
- NO WARNING rounds get NO_WARNING_LEAD (3 days) so the brief and EVACUATE are reachable.
- SAVE.md is mirrored in localStorage as text and saved at round boundaries; missions in flight are not
  persisted (CONTINUE restarts the current round). File System Access API folder saving is deferred.

- Sail dv: GAME_PLAN 16 expects a Tier 3 sail to build 8..11 km/s in a year of SPIRAL OUT. That figure holds the
  sail at 1 AU (0.385 a_c x 1 yr = 9.97 km/s). The honest integral of tangential acceleration along the spiral is
  6.7 km/s because flux falls as (AU/r)^2 while it climbs past 1.2 AU. The test window is 6..11 km/s and the
  1 AU figure is asserted separately; constants unchanged (within 2x, physically explained).
- Until the tech tree (M6), a run starts with NAV 1 (single flyby), SL1 sail and P1 chemical kick (1 km/s DSM
  budget) so every M4 plan type is reachable. The tech tree will gate them.
- The flyby search uses coarse axes (step max(15 d, lead/40)) with leg tables so the three-axis combination is
  arithmetic; the best cell per (launch, arrival) is kept. SAIL_KINETIC: 12 launch dates x 4 arc lengths, TARGET
  STEER from SL2, departure v_inf 1.5 km/s, the best closing speed per arc that fits the DSM budget.

- Fragment close approaches use a +/-10 day window (FRAG_CA_WINDOW): the cloud spreads hours to days along track, and
  the full +/-90 day scan per fragment would make Monte Carlo too slow. The 3-D correction f3D is applied as a
  seeded Bernoulli per fragment in the deterministic resolve (so ground truth does not over-count 2-D hits).
- MC_SAMPLES 120 per plan, run in the worker, debounced 250 ms behind the selection.

- IMPACTOR_KG tier 1 is 1500 kg (plan table says 1 t) so the Section 17 Round-1 worked example (1500 kg at U 10 km/s) is the actual I1 capability. [knob]
- Terminal guidance: an impactor still hits a threat displaced up to 5e7 m from its planned intercept by an earlier impact (TERMINAL_GUIDANCE_RANGE); beyond that it misses. Autonomy (M6) will re-target.
- Planner P(miss) is 1/0 from a mid-beta resolve until Monte Carlo lands in M3.
- No launch-cadence cap yet (HEAVY_LAUNCH_CADENCE in Section 19 implies one); two impactors may share a window. Added to BUILD_PLAN M6.

- Sound is fully synthesized (src/audio/synth.ts: tick, 303 sweep, S&H LFO tone, 8-bit crunch, grains, thud);
  no audio assets in the repo. The sim emits SimEvents; only the screen touches audio.
- Glow under-stroke reduced from 0.18 alpha / +5 px to 0.11 / +3.5 px (user: less halo).

- Vitest 5 has no `bench` export; benchmarks are timing tests under `bench/` selected with `MISS_BENCH=1`.
- CSP is injected at build time only (dev tooling needs an open page). The policy string is `CSP` in `vite.config.ts`.
- A dev-only `/__dev/shot` endpoint saves the canvas as PNG for automated visual checks (never in the build).
- Cheat codes are committed and documented in source (user decision 2026-10-17).
- The minigame's collision default is `auto` (naive under 20k pairs, grid above), from `bench/collision.bench.ts`
  on Apple Silicon / node 26: 100x20 naive 4.5 us vs grid 10.5 us; 800x120 naive 221 us vs grid 121 us.
- Stroke font: hand-built arcade face now; Hershey evaluated in M8 behind the same interface.

- M13 (29): the teletype is non-modal in a run (the key that clears it also does its normal job, the brief
  clears itself after TELETYPE_HOLD_S) and modal at the debrief (the panel waits for a key). No separate
  CINEMATICS option: REDUCE MOTION turns scenes into a half-second still. An IMPACT or NUKE and the
  FRAGMENTATION it causes in the same frame play as one breakup scene. Sound cues fire at each scene's hit
  moment instead of when the event passes; the close-approach cue is not doubled by the debrief. The
  MULTIVERSE tiles keep the old cue-only behaviour. Body radius on screen is logarithmic in D (10 m -> 60 px,
  10 km -> 150 px): the scene is about shape and type, not scale.

- Text layout rule (owner, 2026-10-18): prose is never wider than a reading column (`CenterScreen.READ_COLS`, 72
  characters) and is word-wrapped at draw time to the column's current width; panels lay themselves out from their
  content; a line that cannot wrap (key tables, code, readouts) shrinks to its box with `drawTextFit`; columns cut
  titles at a word boundary with `..`. The Learning Center is three panes at every level: tree, reading column,
  right pane for the lab (max 460 px) or blank, which SIMPLE pictures and wide code may use.

- Labs batch B (2026-10-18): LAMBERT_PORKCHOP, FLYBY, SAIL_SPIRAL, SUNWARD, MONTECARLO, RK4 are built. Heavy work is
  cached by the rounded slider values (`Memo` in `src/lore/labs/kit.ts`; a porkchop grid costs 20-70 ms once, every
  other lab under 10 ms once; a warm frame under 2 ms). LAB_MONTECARLO runs its own sampling loop on a lab-sized
  kinetic scenario (kineticImpact + closeApproach, Rng(2026): beta then the velocity error per sample) rather than
  resolveRound, which is too slow for 500 samples in a frame and has no sigma_v input; its Gaussian estimate
  (sigmaB, impactProbability) agrees with the propagated histogram (0.946 vs 0.945 at the defaults). LAB_SUNWARD
  evaluates `detects` night by night with one fixed-seed Rng per network, like `discover`. Lab scenario constants
  live at the top of each lab file (they teach, they do not balance the game).

- M14 phase 1 (2026-10-18): stateToElements3 rotates the state into the node frame and calls the planar
  stateToElements, instead of a second copy of the eccentricity-vector method. One code path for both, and the
  i = 0 case is the planar function itself (exact unit vectors in the equatorial branch, so a z = 0 state reaches
  it with x and y untouched). propagate3 likewise wraps propagate. Conventions: equatorial when |h_xy| <= 1e-12 |h|
  (raan = 0, i = 0 or pi exactly; at i = pi, w runs clockwise in the ecliptic); circular keeps the planar w = 0, so
  M0 is the argument of latitude; radial throws OrbitError RETROGRADE (the planar kind for h <= 0). Retrograde is
  i > 90 deg, not an error. No measured choice, so nothing in docs/DECISIONS.md.

- M14 phase 2, first slice (2026-10-18): the tilt lives in the element set itself (Threat.elements is an
  Elements3 for a visitor) rather than a separate `elements3` field, so every spread copy ({ ...elements, M0 })
  in cheats, MULTIVERSE and epoch shifts keeps it and the resolver's segments carry it with no new field. The
  price is that planar code fed an Elements3 silently reads the in-plane orbit; every consumer of threat or
  segment elements was audited and routed through `sim/orbit3.ts` (stateAt, toElements, topDownOutline).
  orbit3 branches on the data (a vector with no `z` takes the exact 2-D arithmetic: Math.hypot(x, y, 0) can differ
  from Math.hypot(x, y) in the last bit), which is what keeps the planar replay bit for bit. Along-track pushes
  run the planar integrator on the in-plane elements and re-attach i and raan (the thrust never leaves the
  plane), so no 3-D integrator was needed. Fragments of a 3-D body: ejecta stay flat in x-y, every piece gets
  the parent's v_z plus the impactor's share of U_z; the f3D draw still applies. lambert3's prograde sense is
  the sign of (r1 x r2)_z (Curtis 5.2), so the transfer always has h_z >= 0; porkchop3 costs the same as the
  planar grid (about 40 ms for 107 x 107 cells, measured once, no choice made, so nothing in DECISIONS). Isotropic
  arrival makes most SCI-FI visitors unreachable from HOME (4 of ISO-1..30 have feasible cells at tier 3 versus
  9 for the same orbits flattened): physics, not a bug; tests/scifi.test.ts uses reachable seeds. The gauge keeps
  its 3-D lite practice rocks: the tilt about the impact node is a rigid rotation, i.e. the same 3-D orbit
  (checked in tests/visitor3d.test.ts, including identical discovery). Old saves never stored orbits (rounds
  regenerate from the seed); SAVE.md now records i_rad and raan_rad for a 3-D threat, optional on read.
- M14 phase 2, what remains: (1) ordinary NEAs still planar (draw real inclinations, then the planar replay gate
  is retired on purpose with a new fixture); (2) flyby (`flybySearch`) and sail (`sailSearch`) searches return no
  plans for a 3-D target, and `legs.ts missionFromFlyby/Sail` are planar; (3) fragment ejection cone in 3-D and
  dropping f3D (A8); (4) retrograde comets for LONG_PERIOD (needs 3-D draw for that flavor); (5) the brief's orbit
  card and the debrief scrubber read a, e, w only (compare states, not angles, near i = 0: risk (a) below);
  (6) camera3d draws other bodies at z = 0 and the planet view shows a 3-D miss in the b-plane without the
  approach corridor; (7) cheats TELEPORT/TIMEFOLD act on the in-plane elements (correct for along-track moves).
  Risks kept from the plan: (a) the near-equatorial node is ill-conditioned: a tiny dv near i = 0 can swing
  raan and w by large amounts while the orbit barely moves, so anything that compares or animates elements
  (debrief scrubber, autoplay heuristics, the brief's orbit card) must compare states, not angles;
  (c) porkchop cost if Lambert gains a plane search; (e) Python mirrors of fragment and flyby must grow in step.

## Unverified

- `[unverified]` Torino scale (`src/physics/risk.ts torino`): the published (E, P) chart is read as straight lines
  in log space (E bands 1 / 1e2 / 1e5 Mt, P rows 0.01 / 0.1 / 0.99, the 0/1 and 1/2 boundaries P = 1e-2/E and
  1e-2/sqrt(E)). It reproduces 2024 YR4 (3), Apophis 2004 (4) and 2023 DW (1) but is not the exact IAU curve.

- `[verify]` Detection network parameters (V_lim, p_cover, D_ref, since years) are the plan's approximations.
- NEOMIR (SUNWARD_SENTINEL) ring eps 10..45 deg `[knob]`: an approach inside the 10 deg blind cone is not seen by it;
  the plan's "25 m sunward object, >= 3 weeks lead in 90% of seeds" holds for approaches inside the ring and is
  tested that way. The plan's "18 m sunward never discovered" holds for the final approach (no detection in the
  last 90 days); the honest model sometimes catches such a rock on an earlier apparition years before.
- The plan's "140 m Apollo-type found 5..15 years out": with Pan-STARRS (2010) and Catalina (1998) active before
  2026 many such rocks are found earlier (longer lead); the test asserts >= 5 years of lead, and the round
  generator's rejection sampling keeps rounds inside their window.

- `[unverified]` Benz and Asphaug (1999) Q* coefficients (KNOBS.QSTAR_BASALT / QSTAR_ICE): the GAME_PLAN 6.10 sanity ladder
  (R = 100 m -> ~360 J/kg, 500 m -> ~510, 5 km -> ~7600) reproduces to within the stated tolerances (364 / 433 / 7.6k),
  but the coefficients have not been checked against the paper to three digits.
- HAMMER_SWEEP is not a separate archetype: any plan with Q/Q* >= 1 is flagged DISRUPT, and the sweep is the player
  re-planning against fragment bodies (Tab in the planner) after the breakup. Autonomy (M6) will automate the sweep.

## Resume here (for a fresh session after a context clear)

**NEXT: code review, then the first public publish as v26.4.0 (owner 2026-10-18).** The tree is committed and
the gate is green. The owner runs the code review (planned in Fable) and the full security review
(docs/SAFETY.md checklist) before publishing; after the review: fix findings, follow docs/RELEASING.md, push from
the owner's account (IDEAS 28: consider a project organization for its own origin), CI deploys to Pages.
Owner answers 2026-10-18: version YY.Q.N (v26.4.0); CI deploy on; source maps ship; framing accepted for now
(IDEAS 29); no CLA (AGPL inbound = outbound); coffee-fund support line without naming the platform; MIT history
and every backup copy scrubbed; SOUND on by default; FEMALE voice default (voice work IDEAS 36); AUTOPLAY NORMAL,
DEMO MEDIUM; visitors REAL rate in REALISTIC, SCI-FI VISITORS RARE by default (toggle to COMMON as defences grow,
IDEAS 27); NEON default. First updates after review: IDEAS 30 (NEAs in 3-D), then 27, 31-36.

0. FIRST on resume: read every file in `ideas/` (gitignored, never committed or quoted), starting with
   `ideas/FUTURE_TECH_BACKLOG.md`. Owner answer 2026-10-18: do not ask, build in order: detection gauge (backlog 9),
   feasibility studies (6), interstellar dial + sky coverage (10-12, 3-D orbits first), then item 5's queue; then
   refine cinematics toward detailed wireframes. Done: AUTOPLAY pace SLOW/NORMAL/FAST (`AUTO_SPEEDS`, - and =),
   DEMO LENGTH SHORT/MEDIUM/LONG (`DEMO_LENGTHS`, MEDIUM default). NEON shades approved for now (owner reviews later).
   Done: detection gauge (backlog 9): src/sim/gauge.ts in the worker, PROGRAMS + debrief, F11, LAB_GAUGE.
   Done: feasibility studies (backlog 6): src/sim/studies.ts, config/studies.json (12 cards), PROGRAMS > STUDIES
   tab (Tab), OPTIONS EXPERIMENTAL TECH, HIVE_1..3 networks, D14 topic.
   Done: interstellar dial + sky coverage (3-D lite sky.ts, INTERSTELLAR RATE, SKY view K, F12, LAB_INTERSTELLAR);
   full 3-D orbits remain milestone M14.
   Queue added 2026-10-18 (owner "enhancement" notes go here and are built in turn, no asking):
   - DONE research backlog + claim registry (docs/RESEARCH.md, src/config/claims.json, G9). Keep adding: every
     new real-world number enters the registry as UNVERIFIED before game text uses it.
   - DONE title screen: "MISS:" before the acronym's spelled-out line and "BETA:" before the other, labels purple,
     spelled-out words green.
   - DONE PERIMETER: a self-playing demo at 75 % speed; use it to tune the minigame and log suggestions/fixes in a
     minigame feature backlog (docs/MINIGAME_BACKLOG.md) for review; difficulty levels; start at level 10/20/30/40
     from the menu. Challenging but not too hard.
   - GitHub Pages hosting (github.io): keep the code browser-safe; every hosting caveat in docs/WARNINGS.md;
     photosensitive (flashing lights) warning in game and docs (CRT flicker, glitch, montage, impact flashes).
     Owner runs a full security assessment before going live; docs/SAFETY.md holds the automated baseline, six
     findings to decide and the checklist (DONE: notice, WARNINGS 8-10, SAFETY baseline).
   - backlog: X.509 compliance enhancements (IDEAS.md).
   - owner 2026-10-18: after the backlog, usability and visual enhancement passes; browser efficiency (bloat,
     smallest footprint without losing quality) with every change recorded in docs/DECISIONS.md (analysis, type).
   - DONE more bodies to defend (IDEAS 26): MOON_BASE, MARS_CITIES, GIANT_MOON_OUTPOSTS sites (src/sim/targets.ts,
     SITE_* / MOON_* knobs, T7). Saturn-like moons wait for a Saturn-like planet in bodies.json.
   - PRE-PUBLIC CHECKLIST (owner 2026-10-18): DONE licence AGPL-3.0-or-later everywhere, history rewritten so no
     commit ever said MIT (owner's call: nothing was public); NOTICE with copyright "Ridley DiSiena (SPACED)" and an
     AGPL section 7(b) term keeping "Created by SPACED" on the credits screen (tested); CREATED BY SPACED on the
     title footer; ABOUT line "Created by Ridley DiSiena aka SPACED" on the credits page; .github/FUNDING.yml
     (patreon: spacedlab) and a voluntary support line in README, NOTICE and credits; CONTRIBUTING inbound =
     outbound. Still open: a CLA only if dual licensing is ever wanted; the repository URL in the credits once
     the GitHub remote exists (AGPL section 13 source offer); refine third-party attribution.
   - DONE finer launch-cinematic pixels, false-colour thrust head and spark pixels; detailed wireframe rock.
   - DONE efficiency pass (docs/DECISIONS.md D1-D9); usability passes ongoing (OPTIONS groups, TECH states, CODEX).
   Done 2026-10-18 (item 5 queue): AUTOPLAY buys tech and funds programs (chooseTech / chooseProgram), L4_L5_PICKET
   and SAIL_KITS programs (PICKET_*, KIT_* knobs), planner [?] and program-row click-to-learn. Item 5 closed:
   materialize frames on overlays and the tilt grid done; discovery stays on the main thread (DECISIONS D8).
   DONE M14 phases 1-2 (2026-10-18): 3-D Kepler physics + pymiss + vectors; visitors from other stars fly in 3-D
   through generation, discovery, resolver, planner (lambert3 porkchop) and drawing; planar rounds replay bit for
   bit (tests/planarReplay.test.ts). OWNER DECISION PENDING: moving ordinary NEAs to 3-D changes every seed's
   rounds (the planar replay fixture would be retired on purpose); flyby/sail plans against 3-D targets, 3-D
   fragment cones and retrograde long-period comets follow that choice.
   - QUEUED (owner 2026-10-18, IDEAS 27): new defensive methods against out-of-plane visitors (3-D flyby and sail
     plans, plane-change kick stages, out-of-plane standby interceptors, NEP interceptors, earlier warning, lasers
     on 3-D bodies, terminal defense) plus a planner explanation when no plan reaches a 3-D visitor.
   Older questions (kept for the record):
   a. Voice: listen to OPTIONS > VOICE (FEMALE / MALE / TERMINAL / COMPUTER / MAINFRAME / TOY, VOICE TEST). Clear enough? A speech-recognition check got 17 of 24
      lines right; clarity settings are at the top of `scripts/gen_voice.py` (DRY, ENV_HZ, RING, QUANT, BAND).
   b. SOUND STYLE: ARCADE (PERIMETER's lo-fi sounds) is the new default. Keep it? The owner's saved SOUND is OFF.
   c. SUPER-DUPER-DEMO runs about 10 minutes before the finale (DEMO_SPEED_START 2, GROWTH 1.15, 100 games in
      `src/config/knobs.ts`). Shorter? Fewer games?
   d. AUTOPLAY pane pacing (4-14 s by word count, bottom left): readable, too slow, too fast?
   e. NEON colours: cyan text, pink titles, purple levels. Right shades? Apply to more screens (HUD, debrief)?
   f. Next pick: autoplay buying tech and programs, attachable kits, L4/L5 picket line, planner/program-row
      click-to-learn (item 5's queue), or the enhancements document first.

1. Read `CLAUDE.md`, then this file, then GAME_PLAN Section 30 (2026-10-18: unproven tech, deadpan fiction,
   "Earth must be protected by all means") and IDEAS.md. M0-M13 are done; work since then is owner-directed.
2. Play URL for the user is http://localhost:4173 (`npx vite build` after a commit). The dev server on 5173 is
   for the agent; `window.__miss.screens.get(id)` reaches any screen's state in dev.
3. Commit only with `bash scripts/gate.sh && git add -A && git commit -q -m "..."`. The gate runs every
   notebook too (pymiss/tests/test_notebooks.py).
4. Owner's standing direction (2026-10-18): keep improving by playing in the browser; COLOUR MONO default with
   NEON option; Learning Center three panes with readable width; 20 labs, 9 rotating models, real JPL data
   panels; pixel-art cinematics; SCI-FI speculative capabilities (nanoforge, thruster swarm, shepherd network,
   fusion tugs); SIMULATION/MULTIVERSE fiction stays in character (REALITY ON shows the physics); PEEL and
   ambient peels. Reference images: local only in temp/refs (docs/ASSET_REQUESTS.md rules), never committed.
5. Done since: seed fleet, push cinematics, D13 topic + 14 rotating models, IDEAS 2/4/6/7/8/13/14/15/18
   (touch, replays, daily seed, gamepad, click-to-learn, program effects, civilization unlock, DART guided
   replay, quiz on Q), mouse everywhere, F1 MANUAL box, debrief counterfactual, paradox commands (BOOTSTRAP,
   RETROCAUSAL, BORROW), operator bulletins, SIMULATION anomalies, coastlines, credits page, pushed bodies
   blend onto their new orbit. Still queued: attachable kits, an L4/L5 picket line, planner/program-row
   click-to-learn, materialize frames on overlays, orbit-plane grid fade under tilt, discovery in the worker;
   inert program effects warheadBuildYears and damageMult; more labs polish.
5b. Owner queue 2026-10-18 (in order): NEXT colours (NEON default, cyan text, pink/purple headers), assignable
   keys with MANUAL on M, planner overlap fix, IDEAS 19 AUTOPLAY, 20 SUPER-DUPER-DEMO, 21 voice, SOUND STYLE ARCADE/CLASSIC (all done);
   next: item 5's queue.
   21 voice-overs DONE 2026-10-18: `scripts/gen_voice.py` (venv `.venv-voice`, py3.12) bakes 22 lines x 2 voices
   to `public/audio/voice/` (196 KB Opus 20 kbit/s), `src/audio/voice.ts` lazy-loads and plays them through the
   synth's master bus, OPTIONS > VOICE OFF/FEMALE/MALE (default FEMALE). New knobs `VOICE_*`. AUTOPLAY and
   FINALE clips exist; items 19/20 call `sfx.voice.say('AUTOPLAY')` / `say('FINALE')`. Game-sound half open.
   2026-10-18 more voices: TERMINAL (af_heart, heavy vocoder), COMPUTER (am_michael, mostly dry), MAINFRAME (am_onyx,
   pitched down 16 %), TOY (af_bella, 8 kHz sample-and-hold), 23 lines incl. PLAY_A_GAME ("Would you like to play a
   game?", the OPTIONS sample and the new VOICE TEST row); 6 voices 612 KB; per-voice styles in `gen_voice.py`.
6. The repo has no GitHub remote yet; the user decides when to push (`miss-beta`, AGPL-3.0-or-later). CI is written but unrun.
