# TILT STEER experiments (PERIMETER motion controls)

A log of the rounds of motion-control changes in PERIMETER, what the owner found on a real phone, and what the next
round changed because of it. One round per section, newest last. The code is `src/minigame/tilt.ts`, the knobs are
`TILT_*` in `src/minigame/config.ts`, and the gear menu (top-right tab) holds the player-facing switches. Each round
is one commit on main and reaches https://spaced-lab.github.io/miss-beta/#minigame about two minutes after the push
(the Pages cache can hold an old build for ten minutes: reload once more if the round number on the readout is
wrong).

Method: a round changes as little as possible and adds a way to measure it. The owner plays, reports, and the next
round records the report under **Owner feedback** before anything is changed. Nothing here is built from a guess
twice: a second round on the same question waits for the first report.

## How to test a round on the phone

1. Open the site on the phone (https only: phones report tilt only over https), go to PERIMETER, tap the gear.
2. TILT STEER: ON. On an iPhone the next tap on the screen shows the motion prompt; allow it.
3. Start a game. Hold the phone the way you like (upright or sideways). The angle it has when the game starts counts
   as level (TILT AUTO LEVEL: ON). The bottom line of the screen is the readout, for example
   `TILT +14  R 0.42  /24  SIDE`: the roll from level in degrees, the turn direction and amount (0 to 1 of the full
   turn rate), the range in use, and how the phone is held.
4. Report in a line or two: which way the phone was held, whether tipping right turned the launchers right, whether
   the turn felt too slow, too fast or twitchy, and the readout numbers if anything looked off.

## Round 1 (2026-10-23): proportional turn, a range to pick, a readout, auto level

**Question.** Does tilt steer at all on a real phone, in the right direction, at a usable rate?

**Before this round.** The first build (commit 14828ad) turned the launcher with the sim's on/off turn input: a part
tilt was spread over frames (turning on four frames in ten for a 0.4 tilt). Only synthetic events had been tested.

**Changed.**
- The sim takes an analog turn (`Input.turn`, -1 to 1) beside the keys, so a part tilt is a slower turn rather than a
  stuttering full-rate one. Keyboard games step bit for bit as before.
- TILT RANGE in the gear: the roll that gives a full-rate turn, 12 / 18 / 24 / 36 degrees (`TILT_RANGES_DEG`,
  default 24, the old `TILT_FULL_DEG`). The dead zone stays at 6 degrees (`TILT_DEAD_DEG`).
- TILT AUTO LEVEL (default ON): the phone's angle as a game starts or resumes is level. TILT: LEVEL IS HERE still
  re-levels at any time.
- A readout on the bottom line while tilt is on (see above), so a report can carry numbers.
- A game the tilt has turned is not recorded for WATCH BEST (the replay stream holds key bits only). Scores still count.

**Expected.** Tipping the right edge down turns right in both grips (the sign in `screenRoll` was derived from the
W3C orientation spec, not measured). Twitchiness, if any, comes from sensor noise inside the 6 degree dead zone and
is the first thing a later round would smooth.

**Owner feedback.** (pending)

**Next.** Decided after the report. Candidates, in the order they would be tried: a sign fix per grip if the direction
is wrong; a low-pass on the roll (`TILT_SMOOTH`) if it is twitchy; a curve (squared, finer near level) if the full
rate arrives too soon; pitch (tip forward / back) for nothing, by design: FIRE stays a button because tipping the
phone forward loses the view.
