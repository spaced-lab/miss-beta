---
name: Add a color mode
about: good first issue; a new entry in src/config/palettes.json
labels: good first issue, palette
---

Add a color mode. Everything is data: one entry in `src/config/palettes.json` (`bg`, `ink`, `dim`, `hot`,
optional `alt`, `glow`, `lineWidth`), its name in `ColorMode` (`src/render/palettes.ts`) and in
`COLOR_MODES` (`src/game/settings.ts`). `npm test` runs the contrast rule: ink and hot need 4.5:1 on bg
(`tests/palettes.test.ts`). Post a screenshot of the title and the system view.
