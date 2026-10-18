---
name: Add a SPAWN scenario
about: good first issue; a real object from JPL's Small-Body Database as a console scenario
labels: good first issue, scenario
---

Add a scenario to `src/config/scenarios.json`: id, display name, diameter in m, threat type id (STONY,
RUBBLE, IRON, ICY), lead time in years (0 for a NO WARNING sunward entry), closing speed in km/s, and a one-line
note with the source (https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html). The round builder makes it hit if
ignored; `tests/modes.test.ts` checks every scenario resolves. Add the id to the SPAWN line in
`docs/HOW_TO_PLAY.md` and the help page (`src/render/views/help.ts`).
