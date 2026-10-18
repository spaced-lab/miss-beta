# ASSET_REQUESTS.md

Action items for the owner (or another assistant with web and image access).

## Rules (owner, 2026-10-18)

- **Raw images are never committed**, even when free to use. They are local references only, in `temp/refs/`
  (the whole `temp/` folder is gitignored). The repo ships only line art the agent draws from them, plus facts
  and numbers (dimensions, dates, masses), which are not copyrightable.
- **Record the source URL and the exact credit line** shown on the image's page in `temp/refs/SOURCES.txt`, one
  line per file, even for public domain. Likeness: a wireframe of a real spacecraft carries the credit of the
  reference it was drawn from in the model's `source` line.
- **Skip logos and insignia entirely** (NASA meatball and worm, ESA, JAXA, observatory logos): never drawn, never
  referenced.
- **Public domain** (most NASA and JPL imagery credited "NASA" or "NASA/JPL-Caltech"): fine to use as reference.
  **Not public domain** (credited to a university, a company or a partner agency, including many JHU-APL, ESA,
  JAXA and Rubin images): do not use; list it under BACKLOG below and the owner decides.

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

## BACKLOG: needs the owner (credit or licence questions)

- ESA FlyEye and NEOMIR imagery (CC BY-SA IGO or credit required): used for no model yet.
- Rubin Observatory photographs (credit "RubinObs/NOIRLab/SLAC/NSF/DOE/AURA" style lines): the RUBIN wireframe
  was drawn from public dimensions only; a photo reference needs the owner's call.
- JHU-APL DART renderings (APL holds copyright on some): use only images credited "NASA/Johns Hopkins APL" on
  NASA pages, and record the credit line.
