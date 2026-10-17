# STATUS.md

One line per milestone, the knobs changed from GAME_PLAN defaults and why, decisions where the plan was silent,
and any formula tagged `[unverified]`. Detailed checklists live in `docs/BUILD_PLAN.md`.

## Milestones

| Milestone | State | Notes |
|---|---|---|
| Pre-M0 scaffold | done | Vite 8 / TS 5.9 / vitest 5, render foundation, RNG, font, title screen |
| PERIMETER minigame (side mode) | v2.1 done, tuning | levels, adaptive pressure, hardness tiers, stream strength, heat, moon, impulse, turrets; knobs in `src/minigame/config.ts` |
| M0 Skeleton and orbits | done | constants/kepler/elements (TS + pymiss, shared vectors), world with seeded phases and variety knobs, system view with warp ladder, LINEAR/COMPRESSED scale, pan/zoom. Hershey font deferred to M8 by decision |
| M1 A threat, and losing | todo | next: closeApproach.ts, roundGen.ts, threat path, RESOLVE NOW, RUN OVER |
| M2 .. M12 | todo | see docs/BUILD_PLAN.md |

## Knobs changed from GAME_PLAN defaults

Kepler solver tolerance 1e-14 instead of the plan's 1e-12 (one extra Newton step; lets the energy test hold at 1e-12 relative). Everything else at default. Minigame knobs are not in GAME_PLAN; their defaults
are the values in `src/minigame/config.ts` and the 2026-10-17 tuning (FIELD_R 5.6, VIEW_R 6.2 so the planet
reads larger on wide screens).

## Decisions where the plan was silent

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

None yet. (Benz-Asphaug Q* coefficients and the detection network parameters will be tagged here in M3/M5
until checked against the sources in GAME_PLAN Appendix B.)
