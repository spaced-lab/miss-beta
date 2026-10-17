# STATUS.md

One line per milestone, the knobs changed from GAME_PLAN defaults and why, decisions where the plan was silent,
and any formula tagged `[unverified]`. Detailed checklists live in `docs/BUILD_PLAN.md`.

## Milestones

| Milestone | State | Notes |
|---|---|---|
| Pre-M0 scaffold | done | Vite 8 / TS 5.9 / vitest 5, render foundation, RNG, font, title screen |
| PERIMETER minigame (side mode) | v2.4 done, tuning | levels, adaptive pressure, hardness tiers, stream strength, heat, moon, impulse, turrets; knobs in `src/minigame/config.ts`; 2026-10-17 retune: easier open, steeper ramp, guarded by the balance probe in `tests/minigame.test.ts`; sessionStorage autosave + RESUME across dev reloads (`serialize`/`deserialize` in sim.ts, `Rng.fromState`); v2.4 sound: master compressor + sub layer under hits (not audible in tests: by ear only); v2.4 sentry archetypes ORBITER / SWEEPER / PICKET / CHASER (`SENTRY_*` knobs); seekers (`<`, `SEEKER_*`) and swarms (`>`, `SWARM_*`), save v3; ready panel: Space/R RESUME, Backspace NEW GAME |
| M0 Skeleton and orbits | done | constants/kepler/elements (TS + pymiss, shared vectors), world with seeded phases and variety knobs, system view with warp ladder, LINEAR/COMPRESSED scale, pan/zoom. Hershey font deferred to M8 by decision |
| M1 A threat, and losing | done | closeApproach.ts (+ pymiss mirror, vectors), roundGen.ts with guaranteed collision (1000 seeds sane, 200 seeds impact), threat orbit + ghost + brief in the system view, RESOLVE NOW, RUN OVER with Mt and category |
| M2 First playable: direct kinetic | done | Lambert (+ mirror, vectors, Hohmann check), kinetic (DART), launcher tables, porkchop grid in a worker, KINETIC candidates ranked and resolved, resolver v1 with per-mission beta and terminal guidance, economy per year, Section 12 scoring, validated leaderboard, PLANNER overlay, craft in flight, play-by-play, DEBRIEF, next round |
| M3 Breaking things | done | fragment.ts (+ mirror, vectors): Q*, largest remnant, Pareto shards, Rayleigh ejection with exact momentum; resolver v2 tracks bodies, disrupts above Q*, per-body close approach with the 3-D correction draw, PARTIAL outcome; Monte Carlo in the worker; planner targets any live body (Tab), SWARM bundles, DISRUPT flag, P(MISS) per plan; PLANET VIEW (V) |
| M4 Going faster | done | integrate.ts (RK4 + Euler for the lab), sail.ts (force model, SPIRAL/COAST/TARGET_STEER, arcs), flyby.ts (patched conic), two-leg flyby search and sail search in the worker, KINETIC_FLYBY and SAIL_KINETIC plans with legs drawn, FLYBY WINDOWS; all mirrored in pymiss with vectors |
| M5 Seeing it coming | todo | next: photometry.ts, detection.ts, networks.json, discovery search, civil defense, PROGRAMS, SAVE.md, codex |
| M6 .. M12 | todo | see docs/BUILD_PLAN.md |

## Knobs changed from GAME_PLAN defaults

Kepler solver tolerance 1e-14 instead of the plan's 1e-12 (one extra Newton step; lets the energy test hold at 1e-12 relative). Everything else at default. Minigame knobs are not in GAME_PLAN; their defaults
are the values in `src/minigame/config.ts` and the 2026-10-17 tuning (FIELD_R 5.6, VIEW_R 6.2 so the planet
reads larger on wide screens). Balance retune the same day (owner: "a tiny bit too hard, accelerate more
quickly"): SPAWN_0 1.8 -> 2.2, SPAWN_LEVEL_FACTOR 0.84 -> 0.78, AST_SPEED_0 0.55 -> 0.45, AST_SPEED_PER_LEVEL
0.08 -> 0.12, LEVEL_SECONDS 24 -> 20, PRESSURE_GAIN 0.012 -> 0.015, new PRESSURE_START 0.85, DAMAGE_MAX 25 ->
DAMAGE_MAX_BY_LEVEL [12, 16, 25].

## Decisions where the plan was silent

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

## Unverified

- `[unverified]` Benz and Asphaug (1999) Q* coefficients (KNOBS.QSTAR_BASALT / QSTAR_ICE): the GAME_PLAN 6.10 sanity ladder
  (R = 100 m -> ~360 J/kg, 500 m -> ~510, 5 km -> ~7600) reproduces to within the stated tolerances (364 / 433 / 7.6k),
  but the coefficients have not been checked against the paper to three digits.
- HAMMER_SWEEP is not a separate archetype: any plan with Q/Q* >= 1 is flagged DISRUPT, and the sweep is the player
  re-planning against fragment bodies (Tab in the planner) after the breakup. Autonomy (M6) will automate the sweep.
