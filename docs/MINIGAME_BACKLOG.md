# PERIMETER feature backlog and fixes (for review)

This is a review list for the PERIMETER arcade mode (`src/minigame/`). The items come from headless bot runs (the bot in
`src/minigame/bot.ts`, which also drives the SUPER DEMO) and from reading the code. Nothing below is built. Each item
gets one paragraph, a size (S = under an hour, M = an afternoon, L = more) and a status. The owner moves items to
ACCEPTED or REJECTED, and accepted ones go into `docs/BUILD_PLAN.md` the usual way.

## How to use the demo for tuning

To watch the game: press `8` on the PERIMETER ready panel. The bot plays NORMAL from level 1 at 0.75x speed
(`MG.DEMO_SPEED`) and starts a new game 4 s after each game over. `1` (debug HUD), `2` (glow) and `4` (sound) keep the
demo running; any other key ends it, and Escape goes to the title. To measure: the same bot runs headlessly in vitest.
`tests/minigameModes.test.ts` has a cheap EASY-against-HARD check. To redo the full table, run
`npm run probe -- bench/minigameEasy.probe.ts bench/minigameNormal.probe.ts bench/minigameHard.probe.ts` (bench/mgProbe.ts;
the three run in parallel, about 6 minutes; results in `.dev/mg-<difficulty>.txt`).

## Measured difficulty table (2026-10-18)

Bot on seeds 1..4, god mode off, 900 s cap. Each cell gives the seconds survived from the start, then the level
reached; "+" means the bot was still alive at the cap. The multipliers are spawn rate / rock hit points / rock speed /
hull damage (`MG.DIFFICULTY` in `src/minigame/config.ts`).

| Start level | EASY (0.8 / 0.85 / 0.9 / 0.7) | NORMAL (1 / 1 / 1 / 1) | HARD (1.3 / 1.7 / 1.15 / 1.4) |
|---|---|---|---|
| 1  | 821-900+ s, L49-53+ | 480-584 s, L29-35 | 367-472 s, L22-28 |
| 10 | 580-708 s, L44-51   | 478-606 s, L38-45 | 169-259 s, L19-25 |
| 20 | 347-636 s, L40-57   | 243-438 s, L34-45 | 47-149 s, L22-28  |
| 30 | 311-520 s, L48-60   | 167-358 s, L39-51 | 37-124 s, L32-37  |
| 40 | 197-335 s, L51-59   | 50-266 s, L42-55  | 14-18 s, L40-41   |

NORMAL is today's balance and was not changed. EASY gives about 14 minutes from level 1. HARD dies roughly 20 %
sooner from level 1, and much sooner from a skipped start.

### The laser pass (2026-10-24, later): power by level, the sentinel split, LEVEL TURN; hit points back to +30 %/level

Owner: lasers "more power as levels go up", a beam that crosses a sentinel "splits the beam to spray from that point on",
LEVEL TURN from level 25 (5 s of automatic pulses, then a full turn of double-rate shots, heat-free, switchable), and
"this should make game easier so adjust slightly". The bot pauses for the laser every 3 s, so it gets the power and the
sprays; LEVEL TURN fires for it too. Bot NORMAL from level 1, seeds 1..4, 900 s cap (seconds survived / level):

| `HP_MULT_PER_LEVEL` | lasers | seeds 1..4 |
|---|---|---|
| 0.28 | old | 652 716 637 733 s, L39 43 38 44 |
| 0.28 | new | 643 577 627 900+ s, L38 34 37 53+ (seed 4 alive at the cap: the 600 s guard in tests/minigame.test.ts failed on it, no hull lost after level 10) |
| 0.30 | new | 714 730 850 456 s, L42 43 50 27 |
| 0.32 | new | 694 605 656 849 s, L41 36 39 50 |

Chosen 0.30: the median (722 s) sits a touch above the old 684 s, so the game reads slightly easier for a player who
uses the beam, and no seed is immortal. From level 25 the new lasers at 0.28 gave 180-485 s against 152-439 s before.
The probe is chaotic per seed (seed 4 goes from immortal to the shortest run between 0.28 and 0.30), so this is the
smallest step that closes the cap, not a smooth optimum. LEVEL TURN's pulses do not charge the seeker counter: the
first build let them, and a level-up then filled two seekers at once.

### NORMAL eased a notch (2026-10-24): hit points +28 %/level

Owner: "adjust to make it a little easier, in between the last adjustment and this latest one. If someone wants harder
they can go up a level, I just want normal to be not as hard; we are not computers." `HP_MULT_PER_LEVEL` 0.30 -> 0.28,
nothing else (level 30 rocks: x3.8 instead of x4; levels 1-9 unchanged). EASY and HARD scale from NORMAL by their
multipliers, so they ease by the same notch and were not re-measured. Bot NORMAL, seeds 1..4, 900 s cap:

| Start level | NORMAL at 0.28 |
|---|---|
| 1 | 637-733 s, L38-44 |
| 5 | 363-595 s, L26-40 |
| 10 | 326-662 s, L29-48 |
| 15 | 262-489 s, L30-43 |
| 20 | 176-483 s, L30-48 |
| 25 | 152-439 s, L33-50 |
| 30 | 145-370 s, L38-51 |
| 40 | 119-209 s, L46-52 |
| 50 | 16-101 s, L50-55 |
| 60 | 24-117 s, L61-66 |

From level 1 the slope reads 0.26 + first MIRV cut 599-900+ s, 0.30 464-624 s, 0.28 637-733 s: the ease lands where
the owner asked, and the late starts (40+) stay short, as item 7 below describes.

### After the MIRV rounds (2026-10-23): a seeker that divides, and the counterweight

Owner: "make the seekers split and divide into multiple warheads, more as the game progresses ... we'll have to retest
difficulty". The split moved out to 2.4 from the rock (it was 1.3, inside the blast and easy to miss), warheads grow
one per 5 levels to 9, and from level `SEEKER_MIRV_STAGE2_LEVEL` each warhead divides again into 2-4 sub-warheads.
First measurement (sub-warheads 2 damage from level 12, nothing else changed): NORMAL from level 1 ran 599-900+ s,
L36-53, one seed never dying; the gate's own guard (seed 2 lost no hull in 600 s) failed. Variants probed (NORMAL,
seeds 1..4): seeker price alone did not bite (`SEEKER_HITS` 50: 367-842 s; 60: 780-820 s, the bot just hoards); sub-warheads
at 1 damage in 0.35 helped late (554-857 s); that plus `HP_MULT_PER_LEVEL` back at 0.30 gave 554-693 s with the division
from 12 and 464-624 s with it from 16, which is the 2026-10-21 curve (480-584 s). Chosen: 1 damage, 0.35, level 16, 0.30.
The full table with those knobs (seeds 1..4, 900 s cap; the 2026-10-21 table is above for the old values):

| Start level | EASY | NORMAL | HARD |
|---|---|---|---|
| 1  | 816-900+ s, L49-53+ | 464-624 s, L28-37 | 344-460 s, L21-28 |
| 5  | 729-900+ s, L47-57+ | 468-754 s, L32-49 | 228-386 s, L18-27 |
| 10 | 558-819 s, L42-58   | 281-636 s, L26-47 | 130-333 s, L17-29 |
| 15 | 596-734 s, L50-58   | 327-526 s, L34-45 | 116-166 s, L21-24 |
| 20 | 431-695 s, L45-60   | 116-384 s, L26-42 | 56-128 s, L23-27  |
| 25 | 403-498 s, L48-54   | 225-340 s, L38-44 | 31-138 s, L26-33  |
| 30 | 331-492 s, L49-58   | 232-348 s, L43-50 | 39-111 s, L32-36  |
| 40 | 251-333 s, L54-59   | 95-298 s, L45-57  | 55-128 s, L43-47  |
| 50 | 145-227 s, L58-63   | 51-96 s, L52-55   | 16-108 s, L50-56  |
| 60 | 17-35 s, L61-62     | 22-68 s, L61-64   | 7-25 s, L60-61    |

Then a cap of `MAX_SEEKERS` 200 (uncapped, 969 were in flight at level 30 on EASY): NORMAL from 1: 410-635 s, L25-38;
from 10: 440-664 s, L35-49; from 30: 138-283 s, L38-46 (the late start loses some sub-warheads to the cap; the 2026-10-18
row was 167-358 s). Level-1 rows against the 2026-10-18 table: EASY 821-900+ -> 816-900+, NORMAL 480-584 -> 464-624, HARD 367-472 ->
344-460. The late starts (50, 60) are short on every difficulty: a skip lands in a field whose rocks carry the level's
hit points before the kit's seekers have been earned back, which is item 7 below, unchanged by this. Note for the next
re-measure: three probes in parallel take about 38 minutes on this machine and overrun vitest's 900 s timeout (the
tables are still written, the run just reports failed); run them one at a time or raise the timeout.

### After IDEAS 31 (2026-10-18): a skip is "the same game, later"

How the measurement drove the fix, as a worked example. First the probe (`bench/mgProbe.ts`, `npm run probe --
bench/minigameNormal.probe.ts`, results in `.dev/mg-*.txt`) reproduced the table above exactly, so it measures the same
thing. Then a snapshot of level-1 NORMAL runs at the levels a skip lands on showed what a skip was missing: at level 10
pressure already sits at its ceiling (1.60) and the moon has 530-580 of 600 HP; by level 20 the moon is gone on three
seeds of four and pressure is near 1.87 of 1.90. A skip started at pressure 0.85 with a full moon. So the skip now
copies the run it replaces: pressure at `START_PRESSURE_FRAC` (0.95) of the level's ceiling and the moon at
`START_MOON_FRAC` (10: 0.9, 20: 0.1, 30 and 40: none). For the HARD-from-40 wall a `START_GRACE_S` of 3 s holds the
first spawn. Rows that changed (seeds 1..4, 900 s cap):

| Start level | EASY | NORMAL | HARD |
|---|---|---|---|
| 10 | 580-709 s, L44-51 | 326-611 s, L29-45 | 171-288 s, L20-26 |
| 20 | 484-653 s, L48-58 | 290-403 s, L37-43 | 27-194 s, L21-31 |
| 30 | 242-468 s, L44-57 | 155-274 s, L39-46 | 66-170 s, L33-40 |
| 40 | 231-322 s, L53-58 | 118-256 s, L46-55 | 43-131 s, L42-47 |

Four seeds were too few for item 1: NORMAL from 10 still read L29-45. Over seeds 1..12 a level-1 run ends at a median
level of 33.5 and a level-10 start at 34.5, so the first four seeds were the lucky ones and the skip now matches the
game it stands in for. HARD from 40 lasts 43-131 s instead of 14-18 s. Lesson: measure the state you are replacing
before tuning, and check a surprising row with more seeds before changing a second knob.

## Items

### 1. Start-level runs outlast level-1 runs on NORMAL (S, DONE 2026-10-18, IDEAS 31)
From level 10, the bot reaches level 38-45. From level 1 it reaches only 29-35. A skipped start comes with a fresh hull,
a full moon (a level-1 run has lost its moon by level 20-25 on every seed) and pressure reset to `PRESSURE_START`
(a level-1 run sits at the ceiling by then). One fix: start the pressure at `0.8 * pressureMax(level)` and the moon at
a share of `MOON_HP` that falls with the level. Both would be new `START_*` knobs in config.ts, so the skip feels like
"the same game, later".

### 2. HARD from level 40 is a wall (S, DONE 2026-10-18, IDEAS 31: START_GRACE_S)
The bot lasts 14-18 s on every seed. One option is a short grace at a skipped start: no spawns for 3 s and pressure at
`PRESSURE_MIN`. Another is to offer HARD only up to start level 30. A human with lead aim may do better than the bot.
Still, a menu choice that ends in 15 s reads as a bug.

### 3. HARD only bites late (S, PROPOSED)
On HARD from level 1, the bot still has 83-100 hull at the 60 s mark (NORMAL: 84-100); the gap opens only past level 15. The multipliers scale rocks that the
early arsenal already kills at the rate they spawn. HARD could also shift the level tables: reach tier 1 a level
sooner, or keep the gentler `DAMAGE_MAX_BY_LEVEL` cap one level shorter. That way the first two minutes feel
different too.

### 4. Levels 1-9 are idle for a weapons-using player (M, PROPOSED)
On NORMAL, three of four seeds lose no hull before level 10 (the first 153 s). The existing balance probe already
notes that levels 10-15 are a "fortress". Two options: a shorter `LEVEL_SECONDS` for the first levels (a
`LEVEL_SECONDS_BY_LEVEL` table), or one early threat type (a fast small rock from level 4) so the opening teaches
something.

### 5. Pulse stock sits at the cap from level 5 (S, PROPOSED)
In every run the bot holds 3/3 pulses from level 5 to the end, so charge earned past the cap is lost. Two options: a
cap that grows with level (like `seekerMax`), or overflow charge converted into score or seeker progress. Either one
would make holding a pulse a choice.

### 6. The moon is gone for good by level 20 (S, PROPOSED)
`MOON_HP` 600 is spent by level 20 on three seeds and by level 25 on the fourth, and nothing brings the moon back. A small regen per level-up
(for example +60 HP, as a `MOON_REGEN_PER_LEVEL` knob), or a "NEW MOON" rebuild at every tenth level, would keep its
path-bending mechanic in the late game, where it matters most.

### 7. Late game is a hit-point sponge (L, PROPOSED)
Every tuning pass so far (STATUS.md, the v3.2 and v3.4 notes) found that only rock hit points get rocks past the full
arsenal. Past level 30 the game is "the same rocks, tougher". Rock archetypes (splitters into many small rocks,
fast darts, rocks shielded on one side, rocks the moon cannot bend) would add variety without another hit-point
ramp. This is a design pass, not a knob change.

### 8. Demo takeover (M, PROPOSED)
Today any key ends the demo. A "press SPACE to take over" option would hand the bot's game to the player at 1x speed,
flagged ASSISTED (not ranked). That is useful for practising a late level the bot reached. It needs input-edge
handling at the switch so the key that takes over does not also fire or pulse.

### 9. Attract mode (S, PROPOSED)
Start the SUPER DEMO by itself after 30 s idle on the ready panel, the way arcade cabinets do. Any key returns to the
panel. This would be one knob, `DEMO_IDLE_SECONDS`.

### 10. A more human bot (M, PROPOSED)
The bot never leads its shots, ignores passing rocks entirely, fires until the overheat lockout and spends every
seeker and swarm the moment it has one. A second profile with lead aim, heat discipline and held stock would give a
ceiling to set against today's floor. Then "NORMAL is challenging" could be checked against both.

### 11. EASY could also cheapen earned weapons (S, PROPOSED)
Difficulty only scales the rocks. EASY could also multiply `seekerHitsNeeded`, `swarmKillsNeeded` and
`pulseKillsNeeded` by about 0.8, which would show new players the arsenal sooner. This would be a fifth multiplier,
`earn`, in `MG.DIFFICULTY`.

### 12. ARCADE difficulty with continues (M, PROPOSED)
A fourth level: NORMAL rocks, three hulls (continues) that restore 100 HP at the cost of half the score. It suits
casual sessions and the touch layout. It would be ranked on its own best table, like the others.

### 13. Best per start level, and replays of skipped starts (S, PROPOSED)
Skipped starts are never ranked today, and replays exist only for unassisted level-1 runs. A best per (difficulty,
start level) is a small key change. A replay would need `startLevel` in `SavedReplay`, which is the same optional-field
pattern this change used for `difficulty`.

### 14. Touch players cannot change the options (S, PROPOSED)
`9`, `0` and `8` are keyboard only. A tap on the options line of the ready panel could cycle them. This needs a
hit-test helper for the panel layout in render.ts.

### 15. REDUCE MOTION could also calm particles and the HOME LOST burst (S, PROPOSED)
The shake is now off under REDUCE MOTION. The impact particle bursts and the blinking panel prompts still move. Halving
`PARTICLES_PER_IMPACT` and holding the blink steady under the setting would finish the job.

### 16. Fix: STATUS.md says the beam array fires "every 9 s" (S, PROPOSED)
`SENTRY_ARRAY_PERIOD` is 12 in config.ts. One of the two is stale. The knob is the truth, so the note should change.

### 17. Fix: ready-panel key handling wants a pure function (M, PROPOSED)
`MinigameScreen.update` now decides resume, new game, daily, replay, demo, options and the sound lab in one long
branch. Moving that into a pure `panelAction(status, keys, hasSave)` would make the panel testable without the fake
storage the tests use today.
