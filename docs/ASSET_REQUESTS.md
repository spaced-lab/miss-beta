# ASSET_REQUESTS.md

Action items for the owner (or another assistant with web and image access). The game draws everything as
vector line art and loads nothing remote at run time, so images are used only as **references** for sharper
wireframes and as data sources; they are not shipped unless marked "ship". Put fetched files in `temp/refs/`
(gitignored) with the source URL in the file name or a `SOURCES.txt` next to them, then tell the agent.

Only public-domain or clearly licensed material: NASA images are generally public domain (credit "NASA" or
"NASA/JPL-Caltech"); ESA, JAXA, NSF-DOE Rubin and JHU-APL images often carry their own terms, check each.

## Reference images for the 3-D wireframe models (src/lore/models/catalog.ts)

| Model | What to fetch | Why |
|---|---|---|
| DART | a dimensioned line drawing or side and top photo of the DART spacecraft (JHU-APL / NASA), ROSA arrays deployed | bus proportions, DRACO and RLSA placement |
| RUBIN | photo or cutaway of the Simonyi Survey Telescope on its mount (Rubin Observatory), ideally a side elevation | truss geometry, mount shape, camera position |
| GOLDSTONE | side elevation of DSS-14 (NASA JPL DSN), dish tipped toward the horizon | pedestal and alidade shape, quadripod angle |
| NEO_SURVEYOR | NASA JPL artist rendering, side view | sunshade steps and telescope placement |
| SOLAR_SAIL | NEA Scout or ACS3 deployed-sail diagram (NASA) | boom layout, quilt lines |
| LAUNCHER | any two-stage medium launcher profile drawing with dimensions | stage lengths and interstage |
| HAMMER | Barbee et al. 2018 figure of the HAMMER vehicle | the actual vehicle shape (current model is a sketch) |
| RUBBLE | Bennu and Ryugu shape-model renders (NASA OSIRIS-REx, JAXA Hayabusa2), or the shape files themselves (.obj from PDS) | a real vertex set could replace the stylised top (ship: decimated to a few hundred edges) |

## Data the agent baked or wants (src/config/*.json, all with a source field)

- [x] JPL close-approach data (cad.api), the Sentry risk table (sentry.api) and fireball data (fireball.api): baked by
  `scripts/fetch_realdata.py` into `src/config/realdata.json` (2026-10-18), drawn on topics T3, O12, F9.
- [ ] A low-resolution public-domain coastline (Natural Earth 110 m, public domain) as a polyline set, for the fireball map.
- [ ] NEO discovery statistics by survey and year (CNEOS discovery stats) for the F5 survey topic.
