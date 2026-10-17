# MISS β

**MISS**: Momentum, Impulse, Sails, Slingshots. **BETA**: Ballistic Engagement of Threatening Asteroids.

A planetary-defense simulator that runs in the browser. Vector lines, green on black, Asteroids-era look.
Underneath: real two-body orbital mechanics, Lambert targeting, patched-conic flybys, DART-calibrated kinetic
deflection, a published disruption scaling law, and the real detection networks. The title is the equation the
whole game runs on: `miss ≈ 3 · β · (m/M) · U · T`, so **MISS ∝ β**.

Status: early build. The arcade side mode **PERIMETER** is playable; the sim is being built milestone by
milestone (see `STATUS.md` and `docs/BUILD_PLAN.md`).

## Play

```
npm install
npm run dev          # open http://localhost:5173  (or http://localhost:5173/#minigame)
```

PERIMETER: arrows or A/D move the launcher around the planet, Space fires, Enter or Shift fires a pulse that
clears the field. Launchers and bullet streams multiply as time goes on. Keep the hull above zero.
In play: `B` debug HUD, `G` cycle glow strategy, `C` cycle collision strategy, `Esc` title. Cheat codes are
listed in `src/minigame/cheats.ts`; they flag the run ASSISTED.

## Learn to code with this repo

Every file opens with a WHAT / WHY / HOW / LORE header and every physics function carries its formula, units
and a hand-checkable example. Start with `CLAUDE.md` (the working rules), then `src/sim/rng.ts`, then
`src/minigame/sim.ts`. The physics path (`src/physics/`) follows `EDUCATION.md` topics C1 to C4 once M0 lands,
with a Python mirror in `pymiss/` that must pass the same test vectors.

## Develop

```
npm test             # unit tests (pure modules, node)
npm run bench        # timing tests (collision strategies today)
npm run check        # typecheck + tests + audit + static security greps; run before committing
npm run build        # production build (strict CSP injected)
```

Design: `GAME_PLAN.md`. Lore and Learning Center content: `EDUCATION.md`. Work order: `docs/BUILD_PLAN.md`.
Ideas not in the plan: `IDEAS.md`. License: AGPL-3.0.
