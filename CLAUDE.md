# CLAUDE.md: working rules for this repo

Read this first, then `docs/BUILD_PLAN.md` (the step-by-step path), then the section of `GAME_PLAN.md` you are
implementing. `GAME_PLAN.md` is the single source of truth for design; `EDUCATION.md` is the lore content and
its contract. Do not restate either here; this file is only about how to work.

## What this is

MISS β: a browser planetary-defense sim with real orbital mechanics under an Asteroids-era vector look. Also a
public teaching repo (the code is a course). Also, as a side mode, PERIMETER: a small arcade minigame
(`src/minigame/`) that was built first so there is always something to play while the sim grows.

## Commands

```
npm run dev        # Vite dev server, http://localhost:5173  (#minigame deep-links into the arcade mode)
npm test           # vitest, tests/**/*.test.ts (pure modules only, node environment)
npm run bench      # timing tests in bench/ (MISS_BENCH=1)
npm run probe      # long balance probes in bench/*.probe.ts (MISS_BENCH=probe), kept off the timing run
npm run check      # the quality gate: tsc, tests, npm audit, static security greps. Run before every commit.
npm run build      # production build with the strict CSP injected into index.html
```

Python side (M11 onward, but the mirror rule applies from the first physics file): `pymiss/` mirrors
`src/physics` one function to one function, `scripts/gen_vectors.py` writes `tests/vectors/*.json`, both test
suites consume them. Run with `python3 -m pytest pymiss` once it exists.

## Conventions (enforced by review and by scripts/check.sh)

- Every source file opens with a `WHAT / WHY / HOW / LORE:` header. Every physics function's doc comment carries
  its formula, its units and one hand-checkable example. `// NOTE:` explains a decision, never mechanics.
- SI units internally; convert for display only. Float64 everywhere.
- `src/physics` and `src/sim` import nothing from the DOM or Canvas and never call `Math.random`; all randomness
  is a seeded `Rng` (`src/sim/rng.ts`) drawn in a fixed, documented order.
- Rendering reads state and never mutates it. Pure logic goes in a module with tests before any view uses it.
- Every tunable is a `[knob]` in one config file (`src/config/knobs.ts` for the sim, `src/minigame/config.ts`
  for the arcade mode). Balance by changing knobs, never targets (GAME_PLAN 17).
- Method tags REAL / PROPOSED / SPECULATIVE / FICTION are content. Never add, remove or move one.
- No `eval`, no `new Function`, no `innerHTML` with strings, no remote scripts. Anything read from
  localStorage or a save file is validated with a type guard (`src/game/persistence.ts`).
- When two reasonable implementations exist (collision, glow, integrator, font), keep both behind one interface,
  add a timing test in `bench/`, write the measured result in a comment at the switch, and pick with data.
  Example: `src/minigame/collision.ts`.
- TypeScript strict with `noUncheckedIndexedAccess`; indexed reads are `T | undefined`, handle it, do not `!`.
- Cheat codes are in the open source on purpose (they teach how state is wired). Any code flags ASSISTED.
- New ideas go to `IDEAS.md` as one paragraph with a size; do not build them (GAME_PLAN 0).

## Process

- Work `docs/BUILD_PLAN.md` top to bottom. Tick boxes there as you go; update `STATUS.md` (one line per
  milestone, changed knobs, `[unverified]` formulas) and `CHANGELOG.md` at every commit.
- One commit per feature, never a red `npm run check`. Message: `feat(scope): what it does` plus a paragraph
  on how it works and which lore topic explains it. Milestone commits carry the milestone id (`M2`).
- Do not stop to ask questions in auto mode; where GAME_PLAN says "(Plan: ...)" that is the decision; where it is
  silent pick the simpler option and note it in STATUS.md under Decisions.
- The user tests in the browser as features land. Keep the game runnable at every commit; the title menu marks
  unfinished screens `[BUILDING]`.
- Visual self-check without a screenshot tool: with `npm run dev` running, page JavaScript can
  `fetch('/__dev/shot', { method: 'POST', body: <canvas PNG blob> })` and the image lands at `.dev/shot.png`
  (dev server only, same-origin localhost only, see `vite.config.ts` and `docs/WARNINGS.md`). The main loop
  exposes `window.__miss` with CPU ms per frame in dev.
- Any convenience that trades away safety gets an entry in `docs/WARNINGS.md` in the same commit.

## Layout (today)

```
src/main.ts            boot + screen router          src/game/        screen.ts cheats.ts persistence.ts
src/render/            canvas.ts vectorFont.ts palettes.ts views/title.ts
src/minigame/          config.ts sim.ts render.ts collision.ts planet.ts cheats.ts index.ts
src/sim/rng.ts         seeded RNG (mirror: pymiss/sim/rng.py)
src/util/vec.ts        2-D vectors
tests/  bench/  scripts/check.sh  docs/BUILD_PLAN.md  STATUS.md  CHANGELOG.md  IDEAS.md
```
The full target layout is GAME_PLAN Section 14; grow into it, do not pre-create empty files.
