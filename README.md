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
clears the field (earned per 14 kills), `<` launches a seeker missile that homes on the nearest threat and
blasts an area (earned per 35 direct hits), `>` releases a swarm of 5-8 sentinel drones that hunt rocks for
ten seconds (earned per 22 kills). Launchers and bullet streams multiply as time goes on. Keep the hull above
zero. In play: `1` debug HUD, `2` cycle glow strategy, `3` cycle collision strategy, `4` sound, `5` sound kit,
`Esc` title. Firing builds heat; an overheated launcher locks until it cools. Levels add streams (centre stream
strongest), launchers, rock hardness tiers (colour steps down as a rock weakens), passing rocks you can nudge,
a moon that bends paths and absorbs hits, and sentries earned per 60 direct hits from level 6, each of a random
archetype: ORBITER rides the ring, SWEEPER patrols an arc and fires in bursts, PICKET parks at the densest
incoming sector, CHASER drifts toward the biggest threat on a leash. Cheat codes are listed in
`src/minigame/cheats.ts`; they flag the run ASSISTED.

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

Read `docs/WARNINGS.md` before exposing the dev server to a network. Design: `GAME_PLAN.md`. Lore and Learning Center content: `EDUCATION.md`. Work order: `docs/BUILD_PLAN.md`.
Ideas not in the plan: `IDEAS.md`. License: AGPL-3.0.
