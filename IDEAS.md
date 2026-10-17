# IDEAS.md

Features not in GAME_PLAN.md, one paragraph each with a size estimate. Nothing here is built before M12
presents the list (GAME_PLAN Section 0). Sizes: S (hours), M (a day), L (days).

1. **PERIMETER power-ups (S).** Rare drifting pickups the launcher must shoot: temporary coolant (no heat),
   a hull repair, a homing stream. Auto turrets exist since v2; pickups would be the other reward channel.
2. **PERIMETER touch and gamepad controls (S).** Left/right thirds of the screen move, tap-and-hold fires,
   two-finger tap pulses; Gamepad API for sticks. Needed before the minigame is phone-playable.
3. **PERIMETER sound (S).** WebAudio square-wave bleeps for fire, hit, pulse and hull damage, sharing the
   `render`-free audio module the main game will need in M8.
4. **PERIMETER replay export (S).** The sim is already deterministic in (seed, inputs); store the input
   stream and offer "watch best run". Doubles as a regression fixture for the minigame.
5. **PERIMETER as an in-universe terminal screen (M).** Reach it from the BETA office console in the main
   game ("TRAINING SIM"), with the real planet's continents and the current round's threat type as flavor.
6. **Daily seed for PERIMETER (S).** Same seed for everyone per calendar day, separate best score, mirrors
   the main game's daily seed mode (GAME_PLAN 12).
