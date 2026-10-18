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
blasts an area (earned per 35 direct hits, easing to 22; volleys of 2, 3 and 4 from levels 10, 20 and 30; stock
cap 3 growing to 6), `>` releases a swarm of 5-8 sentinel drones that hunt rocks for ten seconds (earned per 22
kills, more per level past 6; more drones and a longer burn at higher levels, up to 32; stock cap 2 growing to 5; drones and seekers
keep clear of the moon). Launchers and bullet streams multiply as time goes on. Keep the hull above
zero. In play: `1` debug HUD, `2` cycle glow strategy, `3` cycle collision strategy, `4` sound, `5` sound kit,
`Esc` title. Firing builds heat; an overheated launcher locks until it cools. Levels add streams (centre stream
strongest), launchers, rock hardness tiers 0-5 (colour steps down as a rock weakens; past level 10 every rock also
gains hit points, speed and spawn rate keep climbing slowly and nothing plateaus), passing rocks you can nudge,
a moon that bends paths and absorbs hits, and sentries earned per 60 direct hits from level 6 (easing to 36,
up to six standing at once), each of a random archetype: ORBITER rides the ring, SWEEPER patrols an arc and fires in bursts, PICKET parks at the densest
incoming sector, CHASER drifts toward the biggest threat on a leash. From 3 streams the first shot after a pause is
a laser beam; from level 12 every launcher fans three beams (five from level 20) so they cross into a mesh, and
the reach grows with level. A game in progress is autosaved in the
tab; after a reload the ready panel offers `Space` (or `R`) to RESUME it and `Backspace` to start a NEW GAME,
so a hand still on the fire key cannot wipe a run. Cheat codes are listed in `src/minigame/cheats.ts`; they
flag the run ASSISTED.

## How to play

Read `docs/HOW_TO_PLAY.md`, or press `?` in a run (HOW TO PLAY on the title menu) for the same text in the game.

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
