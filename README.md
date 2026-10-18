# MISS β

**MISS**: Momentum, Impulse, Sails, Slingshots. **BETA**: Ballistic Engagement of Threatening Asteroids.

A planetary-defense simulator that runs in the browser. Vector lines, green on black, Asteroids-era look.
Underneath: real two-body orbital mechanics, Lambert targeting, patched-conic flybys, DART-calibrated kinetic
deflection, a published disruption scaling law, and the real detection networks. The title is the equation the
whole game runs on: `miss ≈ 3 · β · (m/M) · U · T`, so **MISS ∝ β**.

Status: milestones M0 to M13 built (see `STATUS.md` and `docs/BUILD_PLAN.md`): the full round loop, the
planner with porkchops and Monte Carlo, fragmentation, sails and flybys, detection networks and programs,
the tech tree, autonomy, nuclear and slow-push methods, modes with a console of public cheat codes, the
tutorial, the Learning Center with 61 topics at five levels, 22 live labs, rotating 3-D models and real NASA/JPL data, and the arcade side mode
**PERIMETER**. Since then: a detection gauge computed from the survey model, feasibility studies with honest
odds in human years, visitors from other stars (an optional rate dial), a sky-coverage view, a Moon base and
other worlds to defend, AUTOPLAY and a timed SUPER-DUPER-DEMO, robot voices, and a research method in which
every real-world number carries a status (`docs/RESEARCH.md`; unchecked ones say UNVERIFIED in the game).

Engineering decisions and their measurements: `docs/DECISIONS.md`. Security and player safety: `docs/SAFETY.md`
and `docs/WARNINGS.md` (this game contains flashing images; see the first-boot notice and REDUCE MOTION).

## Play

In the browser: https://spaced-lab.github.io/miss-beta/ (source: https://github.com/spaced-lab/miss-beta).

Locally:

```
npm install
python3 scripts/build_lore.py   # builds the Learning Center chunks into public/lore (needed once)
npm run play                    # build + stable preview on http://localhost:4173
npm run dev                     # or the dev server on http://localhost:5173 (#minigame deep-links the arcade)
```

The title menu: NEW RUN, SANDBOX RUN (learn with unlimited budget), DAILY RUN, TUTORIAL (a guided round 0),
CONTINUE, PERIMETER, LEARN, CODEX, LEADERBOARD, HOW TO PLAY, OPTIONS. In a run: `?` opens the lore panel on
what you are looking at, `L` the Learning Center, `M` the manual (keys are assignable in OPTIONS > KEYS), backquote the console.

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

Read `docs/HOW_TO_PLAY.md`, or press F1 in a run (HOW TO PLAY on the title menu) for the same text in the game.
The TUTORIAL walks the first round; the Learning Center (LEARN) explains every number at five levels.

## Learn to code with this repo

Every file opens with a WHAT / WHY / HOW / LORE header and every physics function carries its formula, units
and a hand-checkable example. Start at `docs/CODE_TOUR.md` (eight stops, following `EDUCATION.md` C1 to C4),
then `docs/ASSUMPTIONS.md` (every simplification and the test that pins it). The Python mirror in `pymiss/`
must pass the same test vectors as `src/physics/`; `pymiss/notebooks/` has one notebook per built lab, and
`docs/LESSONS/` one page per lore group (generated by `python3 scripts/build_lore.py --lessons`).
Contributing: `CONTRIBUTING.md` and the issue templates (a color mode, a scenario, a picture, a quiz).

## Develop

```
npm test             # unit tests (pure modules, node)
npm run bench        # timing tests (collision strategies today)
npm run check        # typecheck + tests + Python tests + lore validation + vectors + audit + security greps
npm run build        # production build (strict CSP injected)
node scripts/smoke.mjs   # serve dist and check the page, bundle, CSP and lore chunks (CI runs it)
```

CI (`.github/workflows/ci.yml`) runs the same gate on every push and deploys `main` to GitHub Pages.

Read `docs/WARNINGS.md` before exposing the dev server to a network. Design: `GAME_PLAN.md`. Lore and Learning Center content: `EDUCATION.md`. Work order: `docs/BUILD_PLAN.md`.
Ideas not in the plan: `IDEAS.md`.

## License and credit

Created by Ridley DiSiena aka SPACED. Licensed under the GNU Affero General Public License, version 3 or (at your
option) any later version (`AGPL-3.0-or-later`; full text in `LICENSE`, notices and the attribution term in
`NOTICE`). You may use, study, change and share it, including in classrooms; if you distribute a changed version
or run one for people over a network, you must offer its source under the same licence and keep the
"Created by SPACED" credit.

## Support this project

MISS β is self-funded and runs on coffee. Donations for coffee are welcome and help keep it free and open source:
[the coffee fund](https://www.patreon.com/cw/spacedlab). Support is always voluntary; the game and the code stay
free for everyone either way.

Voice lines (`public/audio/voice/`) were rendered with [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M)
by hexgrad (Apache-2.0), voices `bf_emma` and `bm_fable`, then vocoded by `scripts/gen_voice.py`.
