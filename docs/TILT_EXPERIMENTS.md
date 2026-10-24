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

**Owner feedback (2026-10-24).** "tilt works". No direction, range or twitchiness complaint, so the sign in `screenRoll`,
the 24 degree default and the 6 degree dead zone stand. Asked: "can a shake activate pulse?"

**Next.** Round 2 below: shake to pulse. Held back until asked for: a low-pass on the roll (`TILT_SMOOTH`) if it ever
reads twitchy; a squared curve if the full rate arrives too soon; pitch (tip forward / back) for nothing, by design:
FIRE stays a button because tipping the phone forward loses the view.

## Round 2 (2026-10-24): shake to pulse

**Question.** Can a shake of the phone fire the PULSE, reliably and without firing by itself while turning?

**Changed.**
- SHAKE TO PULSE in the gear (default ON while TILT STEER is on). The phone's devicemotion stream gives an
  acceleration with gravity removed; a reading over `SHAKE_ACCEL` (14 m/s^2) fires one pulse, then nothing for
  `SHAKE_COOLDOWN_S` (0.8 s), so one shake is one pulse and a long rattle is not several. Pulse stock applies as
  for the button.
- The readout gains `A <n>`: the last second's peak acceleration in m/s^2. Walking reads about 2 to 4; a brisk flick
  should read 15 to 30. If a shake does nothing, the number says whether the threshold or the sensor is the reason.
- On an iPhone the motion permission is asked right after the orientation one (one prompt covers both on current
  iOS; the second request is harmless where the first already granted it).

**Expected.** A deliberate flick fires; sharp turns of the phone during tilt steering stay under 14 and do not.
If turning the phone hard fires pulses, raise `SHAKE_ACCEL`; if flicks need to be violent, lower it. A second
candidate design, two peaks within 0.4 s, waits for a report that one peak misfires.

**Owner feedback.** (pending)

**Next.** Decided after the report.
