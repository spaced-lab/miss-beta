---
name: Add or improve a SIMPLE picture
about: good first issue; one SVG generator in src/lore/pictures/
labels: good first issue, lore
---

Each SIMPLE-level topic has a `PICTURE:` line in `EDUCATION.md` and a generator in `src/lore/pictures/<group>.ts`
built from the helpers in `svg.ts` (lines, circles, arrows, a lumpy rock, labels; no fills). Pick a picture
whose drawing does not match its description, or add one for a new topic, and run `npm test`
(`tests/pictures.test.ts` checks every id has a generator and the output is deterministic).
