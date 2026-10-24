# DECISIONS.md: why the code is the way it is

A record of engineering decisions made for improvements: what was measured, what was chosen, what was rejected,
and how to measure it again. Design decisions about the game itself live in `GAME_PLAN.md` and in `STATUS.md`
under Decisions; this file is about cost (bytes, milliseconds, memory) and the trade-offs around it.

Each entry has: **date**, **TYPE** (bundle size / boot time / runtime CPU / memory / network / quality
trade-off / security), the **analysis** with its numbers, the **decision**, the **alternatives rejected**, and
**re-measure** (the commands that reproduce the numbers). When a number changes, add a line under the entry;
do not rewrite history.

## How to measure (shared recipe)

- **Bundle:** `npx vite build` prints every chunk with raw and gzip size. Boot JS is the entry chunk plus the
  chunks it imports statically (what the browser must fetch and parse before `boot()` runs); dynamic `import()`
  chunks are fetched on first use. Per-module sizes inside a chunk: a throwaway vite config with a plugin whose
  `generateBundle(_, bundle)` prints `chunk.modules[id].renderedLength` (rolldown fills it in).
- **Boot time:** `src/main.ts` sets `performance.mark('miss:first-frame')` at the end of the first drawn frame,
  in dev and production. On a `npm run build && npx vite preview --port <yours>` page, in the console:
  `performance.getEntriesByName('miss:first-frame')[0].startTime` (ms from navigation). Take the median of
  10+ loads (an iframe loop on the same origin works and keeps the cache warm, so the number is parse and run
  cost, not network).
- **Frame cost:** `window.__miss.cpuMs` in dev (update + render, smoothed). `npm run bench` for node timings
  of pure code (frame state, cinematics, collision, attract).
- Machine for the 2026-10-18 numbers: Apple-silicon laptop, Chrome, local preview server (no network latency).
  Phones are slower by 3x to 10x on parse and run, which is why the boot-path numbers matter more than they
  look here.

## Index of decision notes elsewhere in the repo

| Where | TYPE | What was decided |
|---|---|---|
| `src/minigame/collision.ts` + `bench/collision.bench.ts` | runtime CPU | Naive O(B*A) and uniform-grid collision kept behind one interface, chosen per frame by measured crossover (`'auto'`); both must agree exactly (tests/minigame.test.ts). The model for the "keep both, measure, pick with data" rule. |
| `src/render/canvas.ts` header | runtime CPU / quality | Three glow strategies (`shadow`, `understroke`, `none`); `understroke` is the default because shadowBlur is an offscreen blur per path. Toggle in the minigame to measure on real hardware. |
| `src/render/crt.ts` header | runtime CPU | Scanlines as a cached 1x2 pattern (0.4 ms), vignette gradient (0.3 ms) at 2x DPR 1600x900; true barrel distortion rejected for 2-D (costs more than the whole frame). |
| `src/planner/workerClient.ts`, `src/worker/planner.worker.ts` | boot time / runtime CPU | Porkchop grids, Monte Carlo, flyby and sail searches, the detection gauge and the attract round run in a worker; plain JSON in and out, typed arrays transferred; inline fallback when Workers are absent. |
| `src/lore/labs/gauge.ts`, STATUS.md Decisions "Gauge" | runtime CPU | The detection gauge's first reading (about 2 s of night tables) runs in the planner worker, never on the UI thread; the tables stay cached in the worker. |
| `src/lore/store.ts`, `src/lore/index.ts` | network / memory | Lore is fetched per topic and level on demand (zero fetches at boot, asserted by a test) into a 2 MB LRU. |
| `src/lore/labs/index.ts`, `src/render/views/center.ts` (`panels()`), `src/render/globe.ts` | bundle size | Labs and the real-data panels (realdata.json, coastline.json) are dynamic imports, out of the boot chunk; the globe loads coastline.json the same way and draws its graticule until the chunk lands. |
| STATUS.md, cinematics line; `bench/cinematics.bench.ts` | runtime CPU | Launch cinematic cost (about 2.6k dots, 0.9 ms/frame in Chrome, 0.19 ms JS) recorded before raising pixel density. |
| `src/minigame/index.ts` + sim.ts `serialize` | quality trade-off | PERIMETER autosaves to sessionStorage so a dev reload resumes; validated on read (persistence.ts). |
| `docs/WARNINGS.md` | security | Every convenience that trades safety (dev screenshot sink, public cheats, voice generator download). |

## D1. Code-split the screens that are not needed at boot (2026-10-18)

- **TYPE:** bundle size, network, boot time.
- **Analysis:** the production entry chunk was 540.2 kB raw / 197.7 kB gzip (vite's warning threshold is 500
  kB), and every visitor parsed all of it before the title appeared. Per-module rendered sizes showed four
  screens that the title never needs: PERIMETER (`src/minigame/*` except `sfx.ts` and `planet.ts`, which the UI
  sound and the planet view share), the Learning Center (`center.ts`, the 3-D model catalog and viewer, the
  quiz), the SUPER-DUPER-DEMO finale (`demo.ts`, which also pulled `coastline.json` into the boot chunk), and
  the SIMPLE picture generators (`lore/pictures/*`, about 50 kB of SVG builders, used only when a lore panel
  opens).
- **Decision:** `src/game/lazyScreen.ts` (LazyScreen) stands in for a screen and loads it with a same-origin
  dynamic `import()` on first `enter()`. Callers that configured the screen before showing it (`returnTo`,
  `openTopic`) go through `lazy.with(fn)`, which runs now if loaded or queues in call order, always before the
  queued `enter()`, so the router and the openers behave exactly as before. While loading it draws one dim
  LOADING line; a failed fetch (stale tab after a redeploy, offline) says so and Esc returns to the title.
  `src/render/pictureCache.ts` loads the picture generators the same way; until they arrive the frame is an
  empty box, which is what it already drew while an SVG image decoded.
- **Numbers (vite build, KiB from file sizes, gzip -9):**

  | | before | after D1 + D3 |
  |---|---|---|
  | entry chunk (vite report) | 540.2 kB / 197.7 kB gz | 377.4 kB / 136.7 kB gz |
  | boot JS, entry + static imports | 8 files, 546.5 KiB / 198.8 KiB gz | 9 files, 387.6 KiB / 140.4 KiB gz (-29 %) |
  | on demand, new chunks | | minigame 62.7 kB, center 33.7, pictures 36.1, coastline 26.8, demo 6.7 |
  | all JS shipped | 686.4 KiB | 702.2 KiB (+16: chunk glue, and the attract job in the worker, D4) |
  | >500 kB warning | yes | no |

  On this laptop the split alone did not move first frame measurably (median 268 ms vs 251 ms, inside the
  noise): the boot cost was elsewhere (D4). The split's value is 159 KiB less to download and parse on the
  boot path, which on a phone over a slow link is the difference that shows.
- **Dev hook change:** `window.__miss.screens.get(id)` now unwraps a lazy screen: it returns the real screen
  once loaded and `null` before (it was a Map; it is now an object with `get` only).
- **Alternatives rejected:** (a) code-splitting the system view too: measured, it would take the entry chunk
  to 219 kB / 81 kB gz, but the title reads and writes the system screen synchronously (`pendingRun`,
  `sandboxNext`, `resume` right after `go`), the drop-to-import handler does too, and the system view is under
  active development by other work; deferred until the title talks to it through `with()`. (b) A
  `manualChunks` vendor split: there are no runtime dependencies to split. (c) Prefetching the lazy chunks on
  idle: costs every visitor the bytes for screens most never open; a local chunk loads in milliseconds anyway.
  (d) Splitting the cinematics (about 43 kB): `Cinematics.enqueue` must open a scene in the same frame the
  event passes (the clock pauses on `isOpen`), so a lazy load would change behaviour; kept static.
- **Re-measure:** `npx vite build` and compare the `index-*.js` line; first frame as in the recipe.

## D2. Source maps: keep them, full (2026-10-18)

- **TYPE:** quality trade-off, network, security.
- **Analysis:** `.map` files are 2.47 MB of the 3.78 MB `dist/` (without the 1.2 MB generated lore). Browsers
  fetch a source map only when devtools are open, so players download 0 bytes of it; the cost is deploy size
  and upload time only (GitHub Pages allows 1 GB). Exposure: the maps contain the TypeScript sources, which are
  already public in this repo. Benefit: this is a teaching repo; a learner who opens devtools on the live site
  sees the real TypeScript with its WHAT / WHY / HOW headers and can set breakpoints in it.
- **Decision:** `sourcemap: true` stays the default. `MISS_SOURCEMAP=0 npm run build` builds without maps
  (dist 1.6 MB without lore) for a host where deploy size matters.
- **Alternatives rejected:** `'hidden'` (maps written, no `sourceMappingURL` comment): same deploy size and
  devtools no longer find them, so it keeps the cost and drops the benefit. `false`: saves 2.5 MB of deploy
  but loses the course-in-devtools; available through the env switch. Maps without `sourcesContent`: devtools
  would then request `src/*.ts` paths that do not exist in `dist/`.
- **Re-measure:** `npx vite build` (the `map:` column) and `du -sk dist`; `MISS_SOURCEMAP=0 npx vite build`.

## D3. Picture generators load with the first picture (2026-10-18)

- **TYPE:** bundle size, boot time. Part of the D1 numbers (36.1 kB / 12.5 kB gz moved out of the entry chunk).
- **Decision and fallback:** see D1. A failed fetch is not retried every frame; the panel shows its empty frame
  until reload. The cache is bounded by picture ids times palettes (about 60 x 8 entries).

## D4. Attract round in the planner worker (2026-10-18)

- **TYPE:** boot time, runtime CPU.
- **Analysis:** with D1 in place first frame was still about 250 ms after navigation, and navigation timing
  showed the scripts arrived by 9 ms and DOMContentLoaded fired at 254 ms: the time was spent running
  `boot()`. Timing candidates in the dev console found it: `buildAttract` (the title screen's self-playing
  round: porkchop grid, candidate ranking, several resolves) costs 200 to 300 ms per round, and
  `TitleScreen.enter()` ran it synchronously before the first frame. It ran again, freezing the menu for the
  same time, every time an attract round ended. `bench/attract.bench.ts` in node: 250-335 ms, median 283.
- **Decision:** `src/game/attractClient.ts` (AttractBuilder) keeps two implementations behind one interface:
  WORKER sends `{ type: 'attract', seed }` to the planner worker and gets the round back by structured clone
  (under 1 ms on the main thread); INLINE runs `buildAttract` in a macrotask (node tests, browsers without
  module workers; PlannerClient also falls back inline if the worker fails). The title draws without the
  background orbit until the round arrives, and while a new round is on its way the old one holds still (it
  used to hold still too, because the thread was blocked). The seed and the code are the same, so the rounds
  are identical (tests/lazyScreen.test.ts checks worker job against inline build).
- **Numbers:** first frame, 12 warm loads each: before median 251 ms (247-268); after median 48 ms (25-83).
  Planner worker bundle 58.5 KiB to 70.1 KiB (it now also contains the attract code).
- **Alternatives rejected:** (a) a dedicated attract worker: built and measured, it duplicated 58 KiB of sim
  code in a second worker bundle and a second thread and heap; folded into the planner worker instead. A round
  queued behind the gauge's 2 s first job is possible only if the player returns to the title while that job
  runs, and then the background appears late, nothing else. (b) Deferring the inline build past the first
  frame: fixes the first-frame number but keeps a 250 ms freeze on the title right after boot and at every
  round change. (c) A cheaper attract plan (smaller grid): changes what the title shows.
- **Re-measure:** `npm run bench` (attract table); first frame as in the recipe; in dev
  `__miss.screens.get('title').attractBuilder.mode` says which path ran.

## D5. One planner worker per page (2026-10-18)

- **TYPE:** memory, runtime CPU.
- **Analysis:** the system view and the gauge lab each created their own PlannerClient, so opening the gauge
  lab started a second worker thread with its own heap and built the 2 s gauge night tables a second time.
- **Decision:** `sharedPlanner()` in `src/planner/workerClient.ts` returns the page's one client; the system
  view, the gauge lab and the title (D4) use it. Jobs are matched by id, so sharing needs no other change.
- **Alternatives rejected:** a pool of workers: nothing in the game runs two heavy jobs at once.
- **Re-measure:** Chrome task manager or `performance.getEntriesByType('resource')` filtered on `worker` after
  visiting the title, a round and the gauge lab: one worker script, one thread.

## D6. Per-frame allocations: only the clear, behaviour-free wins (2026-10-18)

- **TYPE:** runtime CPU, memory (GC pressure).
- **Analysis:** frame cost is already small (dev, unminified: title about 0.7 ms, PERIMETER about 3.7 ms,
  autoplay round 2 to 3 ms CPU per frame; the 16.7 ms budget is far away), so this pass looked only for
  allocations repeated every frame in shared drawing code, where a fix cannot change a pixel:
  `canvas.ts` allocated a fresh `[]` for `setLineDash` on every stroke (now one shared empty array; the call
  copies its argument); `wire.ts` `wireSphere` built two `number[]` per ring per frame (now one scratch
  `Float64Array`, which `stroke` reads synchronously) and `StarField.draw` a factors array per frame (now a
  module constant); `crt.ts` built the vignette gradient every frame (now cached per canvas size).
- **Not changed, on purpose:** `drawText` issues one path per glyph stroke. Batching a whole string into one
  path would be fewer canvas calls, but overlapping strokes would no longer double their low-alpha glow, a
  visible change. Unbounded-looking caches were checked: `pictureCache` (ids x palettes), the gauge lab's
  readings (slider grid, at most a few hundred), the system view's orbit and craft caches (cleared per round).
- **Re-measure:** `__miss.cpuMs` in dev; Chrome Performance panel, "JS heap" line and minor GC count.

## D7. Dependencies and dead code (2026-10-18)

- **TYPE:** bundle size.
- **Analysis:** zero runtime dependencies (`package.json` has only vite, typescript, vitest as dev
  dependencies), so nothing third-party ships. Every source file under `src/` is imported by something
  (`src/config/claims.json` is read by `tests/claims.test.ts` only and is not shipped). Eight exports are never
  imported anywhere (`vec.len2`, `vec.lerp`, `porkchop.cellIndex`, `vectorFont.drawLines`,
  `settings.unlockSpectrum`, `modes.kardashevWatts`, `scoring.yearsOf`, `resolver.bodyMass`); rolldown
  tree-shakes them, so they cost 0 shipped bytes.
- **Decision:** leave them: small documented helpers in a teaching repo, free at runtime.
- **Re-measure:** grep each `export` name across `src/`, `tests/`, `bench/`; the per-module size plugin in the
  recipe lists what actually ships.

## D8. Round generation stays on the main thread (2026-10-18)

- **TYPE:** runtime CPU.
- **Analysis:** the queued idea was "discovery in the worker". Measured in node (vitest, 30 seeds, rounds 1-8):
  `generateThreat` with the discovery search takes a median 11.7 ms, p90 33.5 ms, max 89.8 ms. It runs once per
  round, at round start, while the round-start teletype brief covers the screen.
- **Decision:** keep it synchronous. A worker round trip would make round start asynchronous for every caller
  (round start, LEADTIME, SPAWN, the tests) to save at most one long frame per round.
- **Alternatives rejected:** move `discover` into the planner worker (queued behind porkchop and gauge jobs, the
  round would start later, not sooner).
- **Re-measure:** a vitest loop over `generateThreat(roundRng(s, k), createWorld(s, k), k, 0, { runSeed: s })`.

## D9. SUPER-DUPER-DEMO is timed by the clock, not by games (2026-10-18)

- **TYPE:** quality trade-off.
- **Analysis:** the demo ran a fixed number of games with speed 2 x 1.15^n, meant to last about ten minutes.
  Watched in Chrome at MEDIUM (start 4, NORMAL pace 1.5x), three games took 300 s: one game is 10 to 12 minutes
  of real time at speed 1, so the run was heading for about 15 minutes, three times the owner's 5.
- **Decision:** the OPTIONS lengths are seconds (150 / 300 / 600); speed = START x (END / START)^(t / length),
  4 to 120; the montage starts when the time is up. The header shows FINALE IN m:ss.
- **Alternatives rejected:** re-tuning games and growth (the game length varies with lead time and plans, so a
  game count can never promise minutes).
- **Re-measure:** start the demo and read the header clock; `demoSpeed` is unit-tested.

## D10. A stricter CSP: no inline styles, no blob workers (2026-10-18)

- **TYPE:** security.
- **Analysis:** the production CSP allowed `style-src 'unsafe-inline'` and `worker-src blob:`. The only inline
  style was the page chrome in index.html (three rules); the planner worker is emitted as
  `assets/planner.worker-*.js`, so no blob worker exists. The SAVE.md export uses a blob URL only as a download
  link, which neither directive governs.
- **Decision:** the chrome moved to `src/style.css` (vite emits a 0.2 kB linked stylesheet); the CSP is now
  `style-src 'self'` and `worker-src 'self'`.
- **Alternatives rejected:** a hash of the inline style (`'sha256-...'`): it breaks whenever the minifier changes
  the text, and buys nothing over a linked file.
- **Re-measure:** `npm run build && npx vite preview`, then play with a `securitypolicyviolation` listener and the
  console open; `node scripts/smoke.mjs` checks the CSP tag.

## D11. Planner ranking in the worker (2026-10-18)

- **TYPE:** runtime CPU (UI-thread stalls).
- **Analysis:** the owner saw the SUPER-DUPER-DEMO "choke and catch up". Frame times logged in Chrome over 40 s of
  the demo (rAF deltas plus `__miss.cpuMs`) were steady at the vsync interval except at two moments per plan:
  150 to 210 ms when the porkchop grid arrived and 420 ms right after a commit. Wrapping every planner and system
  method found the cost: `PlannerOverlay.rank` 640 to 1030 ms and `rankExtra` 120 to 280 ms, run on the UI thread
  when the grid lands and again on every commit (`refresh`). Ranking resolves the best cells against the whole
  round; the grid itself was already computed in the worker. Every player paid this, not only the demo.
- **Decision:** `src/planner/rank.ts` makes the pass a pure function of plain data (world, committed missions,
  target body, tiers); `contextFor` rebuilds the resolve and velocity callbacks on whichever thread runs it. A
  `rank` worker job runs it, and `runJob` is the same code inline when there is no worker. The overlay shows
  RANKING PLANS while it waits, refuses a commit until the new list lands (its verdicts would predate the last
  commit), and AUTOPLAY waits for the ranked list. `tests/rank.test.ts` checks that a job sent through
  structuredClone ranks the same list as the inline call.
- **Numbers:** same 40 s demo window, same machine: worst frame 420 ms to 153 ms, p99 50 ms; the largest
  main-thread call is now `startRound` at 16 to 24 ms (D8). The remaining spikes carry no long JS call (garbage
  collection and structured-clone receive).
- **Alternatives rejected:** (a) caching the ranking across commits: the verdicts include the committed missions,
  so every commit changes them. (b) Fewer resolves (a smaller top-N): changes which plans the player sees.
- **Re-measure:** in dev, wrap `__miss.screens.get('system').planner` methods with a timer and run the demo.
