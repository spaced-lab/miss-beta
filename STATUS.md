# STATUS.md

One line per milestone, the knobs changed from GAME_PLAN defaults and why, decisions where the plan was silent,
and any formula tagged `[unverified]`. Detailed checklists live in `docs/BUILD_PLAN.md`.

## Milestones

| Milestone | State | Notes |
|---|---|---|
| Pre-M0 scaffold | done | Vite 8 / TS 5.9 / vitest 5, render foundation, RNG, font, title screen |
| PERIMETER minigame (side mode) | v2.3 done, tuning | levels, adaptive pressure, hardness tiers, stream strength, heat, moon, impulse, turrets; knobs in `src/minigame/config.ts`; 2026-10-17 retune: easier open, steeper ramp, guarded by the balance probe in `tests/minigame.test.ts`; sessionStorage autosave + RESUME across dev reloads (`serialize`/`deserialize` in sim.ts, `Rng.fromState`) |
| M0 Skeleton and orbits | done | constants/kepler/elements (TS + pymiss, shared vectors), world with seeded phases and variety knobs, system view with warp ladder, LINEAR/COMPRESSED scale, pan/zoom. Hershey font deferred to M8 by decision |
| M1 A threat, and losing | done | closeApproach.ts (+ pymiss mirror, vectors), roundGen.ts with guaranteed collision (1000 seeds sane, 200 seeds impact), threat orbit + ghost + brief in the system view, RESOLVE NOW, RUN OVER with Mt and category |
| M2 First playable: direct kinetic | done | Lambert (+ mirror, vectors, Hohmann check), kinetic (DART), launcher tables, porkchop grid in a worker, KINETIC candidates ranked and resolved, resolver v1 with per-mission beta and terminal guidance, economy per year, Section 12 scoring, validated leaderboard, PLANNER overlay, craft in flight, play-by-play, DEBRIEF, next round |
| M3 Breaking things | done | fragment.ts (+ mirror, vectors): Q*, largest remnant, Pareto shards, Rayleigh ejection with exact momentum; resolver v2 tracks bodies, disrupts above Q*, per-body close approach with the 3-D correction draw, PARTIAL outcome; Monte Carlo in the worker; planner targets any live body (Tab), SWARM bundles, DISRUPT flag, P(MISS) per plan; PLANET VIEW (V) |
| M4 Going faster | todo | next: integrate.ts (RK4), sail.ts, flyby.ts, KINETIC_FLYBY and SAIL_KINETIC, flyby windows |
| M5 .. M12 | todo | see docs/BUILD_PLAN.md |

## Knobs changed from GAME_PLAN defaults

Kepler solver tolerance 1e-14 instead of the plan's 1e-12 (one extra Newton step; lets the energy test hold at 1e-12 relative). Everything else at default. Minigame knobs are not in GAME_PLAN; their defaults
are the values in `src/minigame/config.ts` and the 2026-10-17 tuning (FIELD_R 5.6, VIEW_R 6.2 so the planet
reads larger on wide screens). Balance retune the same day (owner: "a tiny bit too hard, accelerate more
quickly"): SPAWN_0 1.8 -> 2.2, SPAWN_LEVEL_FACTOR 0.84 -> 0.78, AST_SPEED_0 0.55 -> 0.45, AST_SPEED_PER_LEVEL
0.08 -> 0.12, LEVEL_SECONDS 24 -> 20, PRESSURE_GAIN 0.012 -> 0.015, new PRESSURE_START 0.85, DAMAGE_MAX 25 ->
DAMAGE_MAX_BY_LEVEL [12, 16, 25].

## Decisions where the plan was silent

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
