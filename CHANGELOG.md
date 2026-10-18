# Changelog

All notable changes. Format: date, milestone tag when one applies, one line per feature.

## 0.1.0 (2026-10-17)

- PERIMETER v3.2 sound: rock breakups are a bigger, lower hull thud (45-60 Hz sine, tail and weight scale with
  size and tier, crunch lowpassed to 480/900 Hz), hits are bass pops with almost no grain, shots have a softer
  attack and a lower blip, the ambient static gains an 80-120 Hz activity voice above chaos 0.5, a laser MESH
  pull is a cluster of layered zaps, and the level-up is two gentle 55 Hz sine pulses (no square tone).
- PERIMETER hull hit is a deep rumble again (`synth.rumble`: 40 Hz sub sliding to 28 Hz over 0.7 s over a 120 Hz
  lowpassed noise bed, the loudest voice, no mid or high content).

- PERIMETER v3.2 weapons that scale: seeker stock cap, volley (1 -> 4 by level 30, `SEEKER_VOLLEY_LEVELS`) and
  charge easing (`seekerHitsNeeded`), swarm stock cap and drone cap 16 -> 32, sentry cap 3 -> 6 with easing hits
  (`turretMax`, `turretHitsNeeded`), laser reach +0.5 radii per 5 levels to 8.6, and LASER MESH: from level 12
  (5 streams) every launcher fans 3 beams after the same pause, 5 beams from level 20 (`laserStage` 3 and 4,
  `LASER_FAN_SPREAD`, one `mesh` sound event per pull).

- PERIMETER v3.2 no plateau: the spawn floor shrinks per level from level 9 (`SPAWN_FLOOR_FACTOR`, `SPAWN_FLOOR_ABS`),
  the speed cap rises past level 15 (`AST_SPEED_CAP_PER_LEVEL`), rock hit points scale from level 10 (`hpMult`,
  `HP_MULT_PER_LEVEL`), the pressure ceiling and hull damage cap keep rising, hardness tiers 4 (violet, level 14)
  and 5 (white-hot, level 22); level 45 is tested strictly harder than level 30, levels 1-5 unchanged.

- M6: tech tree (T), autonomy tiers with the rules DSL and presets, split impactor carriers, nuclear
  standoff / surface / subsurface / HAIV / pulse trains, the slow-push family with honest NOT VIABLE numbers,
  PI, tracking tiers with impact probability and the beta reveal delay, debrief timeline scrubber,
  leaderboard mode tabs, a fuzz test over every plan family and the Section 17 balance checks.

- M5: photometry and the detection model (ground optical, space IR, radar; today's networks with their
  activation years and the proposed ones), the discovery search, rounds whose lead time comes from discovery
  (with NO WARNING rounds), civil defense (E), the PROGRAMS panel (G) with completion effects, SAVE.md
  (CONTINUE, X to export, drag-drop import), and the CODEX generated from config.

- PERIMETER v3.1: Space resumes a saved game (Backspace starts new), swarms grow with level and avoid the
  moon, bullet hits are a slighter hull-thud (70 Hz pop + tiny crunch), shots are a soft low blip over a sub pop.

- PERIMETER swarm growth and moon avoidance: a release fields more drones per level (`SWARM_GROWTH_PER_LEVEL`,
  capped by `SWARM_COUNT_CAP` 16) with a longer burn (`SWARM_LIFE_PER_LEVEL`, `SWARM_LIFE_MAX`); drones and
  seekers keep out of the moon's zone (`SWARM_MOON_MARGIN`, `SEEKER_MOON_MARGIN`) and prefer rocks the moon
  is not about to take (`MOON_AVOID_PENALTY`).

- PERIMETER resume keys: with a save on the ready panel, <SPACE> (or R) RESUMES and only <BACKSPACE> starts a
  NEW GAME, so a hand still on the fire key after a reload cannot wipe a run; screen-level test in node.

- M4: RK4 integration, solar sail arcs (SPIRAL OUT/IN, COAST, TARGET STEER), patched-conic flybys, the
  two-leg flyby search and the sail search in the worker, KINETIC_FLYBY and SAIL_KINETIC plans with their
  legs drawn on the system view, FLYBY WINDOWS in the planner; Python mirrors and shared vectors. The dev
  server no longer reloads the page on a source save (hot updates are accepted; a notice asks for a refresh).

- M3: fragmentation (Benz-Asphaug Q*, largest remnant, Pareto shards, Rayleigh ejection, exact momentum; TS +
  Python, shared vectors); resolver tracks remnant and fragments with per-body close approaches, the 3-D
  correction and the PARTIAL outcome; Monte Carlo P(MISS) in the worker; planner targets fragments (Tab),
  SWARM bundles, DISRUPT flags; PLANET VIEW (V) with the cloud cross-section and the focusing ring.

- M2: first playable round. Lambert targeting (universal variables, TS + Python), DART-calibrated kinetic
  deflection, launcher payload tables, porkchop grid in a Web Worker, KINETIC plan ranking with printed
  readouts, resolver with per-mission beta and terminal guidance, budget per year, Section 12 scoring,
  local leaderboard, PLANNER overlay (P), spacecraft on their arcs, play-by-play log, DEBRIEF and NEXT
  ROUND, RUN OVER with leaderboard rank, LEADERBOARD screen. `npm run play` serves a stable build on 4173.

- PERIMETER instructions: ready panel lists `<` SEEKER and `>` SWARM with how they are earned; the in-play
  key hint is one line with all five controls; README's PERIMETER paragraph covers the weapons and sentry kinds.

- PERIMETER earned weapons: SEEKER MISSILE (`<`, one per 35 direct hits, stock 3: lead pursuit with a
  turn-rate cap, area blast with outward impulse, exhaust trail) and SWARM OF SENTINELS (`>`, one per 22
  kills, stock 2: 5-8 drones hunt the nearest rock with 1 px bullets for 10 s, then burn out); HUD meters
  beside PULSE, cheats SEEKER / SWARM, new sfx voices (bass whoosh, blast, blip cluster), save v3; pulse
  charge compare gets an epsilon (14 x 1/14 < 1 in floats, the first pulse arrived one kill late).

- PERIMETER sentry archetypes: each deploy draws ORBITER (ring rider), SWEEPER (arc oscillation, outward,
  bursts), PICKET (parks at the densest incoming sector) or CHASER (drifts toward the biggest threat on a
  leash), each with its own vector shape (hexagon, chevron, bar + dish, triangle pair); cheats ORBITER /
  SWEEPER / PICKET / CHASER; save format v2 (sentry kind, radius, home, phase, burst).

- PERIMETER finer detail: sentry bullets 1 px, player bullets 1.3-1.9 px by damage, dust 1 px, rock width
  ladder 0.55 + 0.22 per tier, thinner moon, sentry and continent outlines; sizes in the `PX` table in render.ts.

- PERIMETER sound, bassier: a DynamicsCompressor on the synth master bus caps stacked hits; `bass()` adds a
  30-45 Hz sub layer with a longer tail; hits, breakups and crashes lean on it; crunches lowpassed lower;
  ticks stay bright blips, a notch quieter; chaos bass-static a touch fuller.

- PERIMETER resume: a game in progress is autosaved to sessionStorage (every level-up, every 5 s, on leaving
  the screen) and offered on the ready panel after a reload as <R> RESUME / <SPACE> NEW; the save is a
  validated JSON snapshot of the whole sim including the Rng state (`Rng.fromState`), so play continues
  exactly; cleared on game over or new game.

- PERIMETER v2.3 tuning: gentler levels 1-2 (first rocks slower, first spawns sparser, pressure starts at
  0.85, hull damage capped at 12 then 16 before 25) and a steeper ramp after (20 s levels, spawn interval
  decays 0.78 per level, +0.12 speed per level); a headless scripted-player balance probe guards the curve.

- M1: close approach with gravitational focusing (TS + Python, shared vectors), impact energy and
  category; seeded round generation with a guaranteed collision and the Section 10 ramp; the threat on the
  system view with its dashed orbit, impact ghost and THREAT BRIEF; T-MINUS clock; RESOLVE NOW (R); RUN
  OVER panel with megatons, category, closest approach and b_crit.

- PERIMETER v2.2: rock-on-rock gravity, bounces and crash chips, binary pairs that orbit each other;
  continents from layered sines with islands; moon further out with craters, 600 hit points chipped only by
  rocks, cracks, and loss; sentries with tiers by level, SUPER sentries (3-way, double rate, hue-cycling)
  including level-up gifts; thinner rocks and bullets, 1 px dust; sub-bass pops under ticks and hits,
  deeper impacts, soft laser zap, chaos-driven bass static; <SHIFT> pulse in the key hints; 24 s levels.

- PERIMETER v2.1: lo-fi synthesized sound (WebAudio, no samples) with three kits (key 5) and a toggle
  (key 4); laser pulse on the first shot after a break from 3 streams (every launcher at 5 streams); sim
  emits events for sound; difficulty ramps a little faster; turret life 12 s; less glow halo everywhere.

- PERIMETER v2: open-ended levels (one per 28 s) driving streams, launchers and rock hardness; adaptive
  pressure; hardness tiers 0..3 with neon colours stepping down as a rock weakens; shards one tier down with
  a chance of a hard core one tier up; stream strength by position (centre strongest, 1/2/3 by stream count);
  bullet impulse scaled by rock mass; passing rocks that miss unless nudged; a moon that bends paths and
  absorbs hits; heat gauge with overheat lockout; auto turrets earned per 60 direct hits from level 6;
  spectrum colour stages unlocking by level. Debug toggles moved to digit keys.

- M0: physics core (constants, Kepler propagation, state to elements) in TypeScript and Python with shared
  test vectors; seeded World with per-round planet phases; SYSTEM VIEW with the warp ladder, COMPRESSED
  (sqrt) scale, wheel zoom and drag pan; NEW RUN opens it from the title.

- Scaffold: Vite 8, TypeScript 5.9, vitest 5; zero audit findings; `scripts/check.sh` quality gate.
- Render foundation: DPR-aware Canvas 2D surface with three glow strategies, hand-built stroke font
  (A-Z, 0-9, punctuation, β, ∝), color-mode table from GAME_PLAN 24.1 as data.
- Seeded RNG (mulberry32 + FNV-1a seed hashing) and 2-D vector helpers, with tests.
- PERIMETER arcade minigame: pure sim, renderer, cheats, best score, adaptive collision with benchmark.
- Title screen with the MISS ∝ β logo and the menu (NEW RUN, LEARN, OPTIONS marked BUILDING).
- Dev tooling: production-only CSP injection, dev-only `/__dev/shot` canvas capture endpoint.
