# MISS β: How to play

You run BETA, the Ballistic Engagement of Threatening Asteroids office, for a planet called HOME. Each round an
object is found on a collision course. You have a budget, launchers and a growing tech tree. Change its orbit
enough that it misses, or lose the planet. The title equation says how: miss ≈ 3 · β · (m/M) · U · T. Early and
fast beats late and big.

## Your first round in six steps

1. Read the top line: how big the rock is and how many years you have.
2. Press `P`. Plan 1 is usually the best. Its RESULT line says MISS (good) or HIT (not enough).
3. Enter commits plan 1. Commit again if the result still says HIT and the budget allows.
4. Close the planner, press `]` a few times to speed up the clock.
5. Watch the craft fly and the log; `R` jumps to the end.
6. A miss opens the debrief; Space starts the next round. Between rounds `T` spends research, `G` funds programs.

Stuck? Wait a year or two: budget grows on the clock. Or press `E` to evacuate a small rock.

**Want to experiment first?** Start a SANDBOX RUN from the title: unlimited budget and research, every tech
unlocked, full tracking. Nothing from a sandbox is recorded on the leaderboard. The in-game manual (`?`) has
BASIC, STRATEGY and ADVANCED sections; Tab switches between them.

## The round loop

1. **Threat brief** (top of the screen): name, type, size, energy in megatons, class, closing speed, who found it
   and how much lead time you have. The margin says how far inside the focusing ring it will pass (negative = hit).
2. **Plan**: press `P`. The planner computes every launch window and lists the best plans with their numbers. The
   method tabs on the left (`<` / `>`, or a click) show each kind of plan: KINETIC, SWARM, SPLIT BUS, FLYBY, SAIL,
   NUKE, SLOW PUSH and PI, with how many plans each has for this target; a locked tab names the research that opens
   it (`T` jumps to the tech tree), and an empty one says why (launch cadence, no propulsion stage, too fast for a
   fuze, body too big). The pane under the tabs turns a wireframe of the selected craft with the method's tag and
   equation. ALL leads with the best plan of each method. Hover a cell of the porkchop to read its window and click
   it to plan your own launch: it joins the list as KINETIC (YOUR WINDOW), scored like the others.
   Pick one with Up/Down, commit with Enter. Commit several if one is not enough; the margin shown is the total.
3. **Run the clock**: `]` and `[` change warp (1 day/s up to 1 year/s), Space pauses. Craft fly their arcs,
   impacts land, the log at the bottom left prints what happened. Pause and press `P` again any time to add
   missions; budget keeps accruing on the clock.
4. **Resolve**: `R` jumps to the close approach. A miss opens the debrief (score, research earned, a replay you can
   scrub with Left/Right). Space starts the next round, harder. A hit ends the run and records it on the leaderboard.

## Keys in a run

| Key | What |
|---|---|
| `P` | Planner |
| `T` | Tech tree (spend research) |
| `G` | Programs (fund long-term infrastructure) |
| `V` | Planet view: HOME, the focusing ring, every body at closest approach |
| `E` | Order an evacuation (cost 2 budget) |
| `Space`, `[`, `]` | Pause, warp down, warp up |
| `R` | Resolve now |
| `S`, `Z`, wheel, drag | Scale toggle, reset camera, zoom, pan |
| `X` | Export SAVE.md |
| `I` | Tilt the camera (3-D view; a faint grid marks the plane of the planets) |
| `K` | SKY view: how often each direction of the sky is watched, and where the rock is |
| `A` | AUTOPLAY on / off; `-` and `=` change its pace (SLOW / NORMAL / FAST) |
| `L`, `?` | Learning Center, lore panel for what is on screen (click `[?]` marks and rows to learn too) |
| `M` | This manual |
| `Esc` | Close the open overlay; from the bare map, back to the title |

## Events, cinematics and briefs

When a launch, impact, breakup, nuclear burst, PI shredding or the close approach passes on the clock, the clock
waits while a two to five second vector scene plays, drawn from the resolved numbers: the launcher tier scales the
ascent, beta scales the ejecta (only once beta has been assessed), the body type picks how it breaks (a rubble pile
crumbles, a stony body cracks, an iron body rings and sheds, a comet puffs). Any key skips the scene; the warp that
was running resumes. With REDUCE MOTION on in OPTIONS the scene is a still frame for half a second.

Each event also gets a brief that types itself in at the lower right: what happened and what it means, in the
SPECTRUM role colours when that layer is on (threat amber, craft cyan, fragments magenta). Any key renders the rest
of the text at once; another key clears it; it clears itself after ten seconds. The round-start brief says who
spotted the body, how bright it was, how big it is and how long you have. The debrief brief is modal: read it, then
press any key for the numbers.

When the last craft in flight has arrived the warp drops to 1 DAY/S once and the HUD says NO CRAFT IN FLIGHT: PLAN
OR LET IT PLAY OUT, so a round never races past the moment you could still act.

## Reading a plan

```
PLAN 1  DEFLECT (Q/Q* 0.11)  KINETIC   SCORE 0.96
 LAUNCH  T-06Y 150D   C3 11.3   PAYLOAD 1500 KG
 IMPACT  T-05Y 258D   U 26.5 KM/S   TARGET THREAT
 PUSH    dV 9.17 MM/S (BETA 2.0..4.0)   EST 0.54 R
 RESULT  MISS  MARGIN +1.03 R   P(MISS) 100%  N 120
 COST    3 / 8.2
```

- **C3** is the launch energy the rocket must provide; payload falls as C3 rises.
- **U** is the closing speed at impact: the push is β (m/M) U, so faster and heavier is better.
- **Q/Q\*** says whether the hit shatters the body. Under 1 it craters (DEFLECT); over 1 it breaks (DISRUPT).
  Breaking it early scatters the pieces past the planet; breaking it late aims a shotgun at yourself.
- **β** is the momentum enhancement from ejecta. It is drawn when the impact happens and revealed only after
  the tracking delay; until then the planner shows the range.
- **EST** is the quick 3·dv·T estimate; **RESULT** is the real propagation; **P(MISS)** comes from 120 Monte Carlo
  samples of β and fragment draws for the selected plan.
- **MARGIN** is the distance outside the gravitational-focusing ring in planet radii. Positive misses.

## Plan types (what the tech tree unlocks)

- **KINETIC**: one impactor on a direct intercept. Always available.
- **SWARM**: 2 to 3 launches on staggered windows. **SPLIT BUS** (swarm tiers 2, 3): one carrier that releases
  3 or 8 sub-impactors late, each able to re-aim at its own fragment.
- **KINETIC-FLYBY** (NAV): a planet rotates the craft's velocity for free; the line shows the planet, the turn
  and the onboard dv that covers the mismatch. The FLYBY WINDOWS box lists the dates that work.
- **SAIL-KINETIC** (SAIL): a sail spirals for months to build speed, drops, then intercepts.
- **NUKE STANDOFF / SUBSURFACE** (WARHEADS): a standoff burst pushes without breaking if the approach is slow
  enough to fuze; subsurface bursts shatter. Warheads cost extra and carry a score penalty.
- **SLOW PUSH** (SLOW PUSH): rendezvous, then push for years: gravity tractor, ion beam, laser and the rest.
  Tiny forces; good for small bodies, fine-tuning and sweeping fragments. The planner also lists the methods that
  do not work (tether, electrostatic) with their honest numbers.
- **PI** (TERMINAL): a penetrator array shreds a body under 100 m hours before impact into pieces that airburst.

After a breakup, press Tab in the planner to cycle the target over the surviving pieces.

## Autonomy

Assets already in flight can react. Tier 1 follows rules (press `R` in the planner to cycle the preset:
DEFAULT, AGGRESSIVE, CONSERVATIVE). Tier 2 re-aims itself at the best fragment within its onboard dv. Tier 3
assigns a whole fleet to fragments jointly. The log prints every retarget and deployment.

## Programs (G)

Long-term projects that take years and drain budget per year: more budget, civil-defense readiness, new survey
networks (a space infrared surveyor, a sunward sentinel), radar, pre-built interceptors, launch cadence, an
orbital depot. Networks change how early later threats are found. Lead time is the strongest multiplier in
the game.

The DETECTION GAUGE beside the networks shows, on a size bar from 1 m to 10 km, the smallest rock your networks
would find in time to deflect (a year), to evacuate (three weeks), from the Sun's side, or as a visitor from
another star. Funding surveys moves its bars left; the debrief places each round's rock on it.

`Tab` switches to STUDIES: research into technology nobody has built yet (a CubeSat hive survey, deep-space
fission power, fusion lines with OPTIONS > EXPERIMENTAL TECH). A study climbs readiness levels, can take longer
than planned or fail at a milestone, and shows human years beside game years. MOON_BASE (and in SCI-FI, cities on
OUTER and outposts on a moon of GIANT) adds a world to defend: some rocks then aim at it, and losing it costs score
but not the run.

## Civil defense (E)

When nothing can be flown in time, evacuate. An evacuated airburst- or city-class hit, ordered early enough,
scores as PARTIAL at a quarter value and the run continues. NO WARNING rounds (found only at atmospheric
entry) are civil defense only.

## Budget, research, score

Budget accrues per year on the clock, so waiting buys launches but burns lead time. Research comes from round
score and buys tech. Score: log10(megatons + 1) · 100 · (1 + 0.15 · round) · outcome · (1 + efficiency +
timing + style); a clean miss is 1.0, a marginal miss 0.8, a partial 0.35; no warhead and no fragments earn
style.

## Saving

The run saves at round boundaries. CONTINUE on the title resumes it. `X` downloads SAVE.md, a readable file
whose front matter the game reads back; drop a SAVE.md onto the window to import it.

## The look: color modes, SPECTRUM, tilt

OPTIONS has seven color modes (PHOSPHOR green, AMBER, ICE, VAPOR, BLACKLIGHT, HOLO with iridescent strokes,
DAYLIGHT for bright rooms). SPECTRUM unlocks after your first clean miss: the threat turns amber, craft cyan,
fragments magenta, sails acid, warheads orange, and each role also keeps its own line style so colour is never
the only cue. `I` in the system view tilts the camera (top-down, 30, 60 degrees): orbits become rings and the
threat a tumbling wireframe. The planet view draws a slowly turning wireframe globe.

## Learning: the lore panel and the Learning Center

Press `?` in a run (or in the codex) to open the lore panel on whatever you are looking at: the threat brief,
a committed plan, fragments, the planet view, the debrief. Every topic is written at five levels, SIMPLE
(a picture and a sentence), BEGINNER, INTERMEDIATE (one worked number), ADVANCED (the game's equations) and
EXPERT (a lab, the code path, sources); keys 1 to 5 or Tab switch level, F1 to F4 jump to related topics, and
`L` opens the full Learning Center (also LEARN on the title). The center has the topic tree with your reading
progress, the content, search (`/`), bookmarks (`B`), a LABS view (`V`) and, on EXPERT topics with a built
lab, live sliders and a plot that call the game's real physics functions, with the formula and the current
numbers substituted and the source path under SHOW CODE. The learning level default is in OPTIONS. All of this
text lives in EDUCATION.md and is built into small chunks by `scripts/build_lore.py`; the game fetches them
only when a panel opens.

## Tutorial, daily run, options

TUTORIAL on the title (also the first launch) plays a guided round 0 on a fixed 100 m stony rock with ten
years of warning: eight steps (brief, clock, planner, commit, flight, impact, approach, debrief) that each wait
for you to do the thing; Tab skips, and Space at the debrief starts round 1 for real on a fresh seed. The
tutorial is never recorded or saved. DAILY RUN uses the seed of today's UTC date so everyone gets the same
rounds. OPTIONS: color mode (seven palettes), CRT effects, glow style, sound, voice (a vocoded robot mission
voice: OFF, FEMALE or MALE), units, reduce motion, text size and the learning level for the Learning Center. Touch: one finger pans, two fingers pinch to zoom.

## Gamepad

Any standard-mapping controller works everywhere: A fires, pauses and commits; B goes back; X opens the planner;
Y the lore panel; LB and RB step the warp (seeker and swarm in PERIMETER); LT pulses; RT the planet view; VIEW is
Tab; MENU opens the Learning Center; the d-pad and left stick are the arrows.

## Console, cheat codes and modes

Press backquote (`` ` ``) on the title or in a run to open the console. `HELP` lists the commands. Cheat codes
are public (they are in `src/game/console.ts`) and flag the run ASSISTED, which has its own leaderboard. Codes
typed on the title apply to the next NEW RUN.

- Cheats: `REVEAL` (betas shown at once), `FASTBUILD`, `GODTRACK`, `LEADTIME n`, `SPAWN <scenario>` with
  CHELYABINSK, TUNGUSKA, YR4, APOPHIS, BENNU, DIDYMOS or CHICXULUB, `DART`, `KARDASHEV1` (every REALISTIC tech,
  budget x3), `KARDASHEV2` (SCI-FI with everything).
- Modes nest: REALISTIC > `SCIFI` > `SIMULATION` > `MULTIVERSE n`. Building every REALISTIC program opens SCI-FI
  without a code, and every SPECULATIVE program opens SIMULATION (civilization levels 1 and 2).
- SCI-FI multiplies the budget by ten and adds the SPECULATIVE tier, "unproven, might work someday": CNT net
  capture, the DE-STAR orbital laser (fires at anything inside 0.3 AU), fusion tugs, the disassembler swarm, parked
  sail impactors, and programs that act on every threat without a flight: NANOFORGE SEEDS (the rock becomes its
  own mass-driver rocket), a SELF-ASSEMBLING THRUSTER SWARM, the SHEPHERD NETWORK of parked impactor rocks, and a
  SELF-REPLICATING SEED FLEET that doubles every 18 months and throws its rocks each time. New round types too:
  interstellar objects on hyperbolic orbits at 50 to 90 km/s, long-period comets with a year of warning, 5 km bodies.
- SIMULATION turns on the glitch render, the peeling corners, the operators' bulletins, round anomalies (a LOOPED
  round repeats the last rock, a MIRRORED one arrives from the other side, UNSTABLE G drifts the planets) and the FICTION commands.
  They are played straight, as ordinary procedure; type `REALITY ON` to have each one state the physics that
  forbids it first (the CODEX lists those lines too). The commands: `TELEPORT`, `OBSERVE`, `REWIND n`, `EDIT G x`,
  `DELETE`, `NOCLIP`, `TRACTORBEAM`, `SINGULARITY`, `PLANETTHRUSTERS dv`, `SHIELD`, `SHRINK`, `MICROHOLE [b]`
  (a primordial black hole fly-by), `TIMEFOLD n`, `DETOUR`, `LUNA`, `HOLLOW`, `TICKET`, `NIBIRU`, `MANDELA`, `PEEL`
  (see the raw state under the render), `BOOTSTRAP`, `RETROCAUSAL`, `SUMMONDEVS` then `KNOB name value`.
- MULTIVERSE forks the round into n tiles on a shared clock: digits select a branch, `P` plans in the selected
  branch, `C` collapses it into the main timeline, `WORMHOLE` drops the selected branch's threat on its neighbour,
  `BORROW n` copies branch n's plan into the selected one.

## PERIMETER (arcade minigame)

Arrows move the launcher, Space fires (watch the heat), Shift fires a pulse, `<` a seeker missile, `>` a swarm
of sentinels. Levels raise streams, launchers and rock hardness; the moon arrives at level 3 and sentries are
earned from level 6. Keys 1 to 5: debug, glow, collision, sound, sound kit. Cheat codes are listed in
`src/minigame/cheats.ts`; they flag the run ASSISTED.

**GAME SETUP** (the box on the start panel): `9` steps the difficulty EASY / NORMAL / HARD (each keeps its own best
score), `0` skips ahead to start level 1, 10, 20, 30 or 40 with the kit a run usually has by then (a later start is
not ranked), `8` starts the SUPER DEMO. The same `9` and `0` work on the game-over panel and set up the retry; the
main OPTIONS screen has both settings under PERIMETER.

**SOUND LAB** (`L` on the ready or game-over panel): every sound in the game has three or four synthesized
voices plus OFF, and you choose by ear. Up/Down picks a row (shot, hit, breakup, hull impact, laser, mesh,
pulse, seeker, swarm, sentry, moon hit, level-up, the ambient layer, then master volume and ambient level),
Left/Right changes the variant and plays it, Enter or Space replays it, `A` plays the whole backlog in order
with a 0.6 s gap so you can listen through and note what grates, `0` restores the defaults, Esc returns to the
game without resetting it. Choices are saved in this browser (`missb.minigame.sfx`). The defaults for the
frequent sounds (shot, hit, sentry) are the least clicky voices; the rest default to the v3.2 sound.
