# SAFETY.md: security and player-safety record

The record of security checks run on MISS β before each public release, and their results. `docs/WARNINGS.md`
lists every known convenience that trades safety; this file is the evidence that the release was checked. Add a
new dated section per assessment; never delete an old one.

## Scope of the public build

- Static files only (`npm run build` -> `dist/`), served by GitHub Pages over HTTPS. No server code, no accounts,
  no analytics, no cookies, no third-party scripts, styles or fonts, no network calls to other origins.
- Same-origin fetches only: lore chunks (`public/lore/*.json`, src/lore/index.ts), voice clips
  (`public/audio/voice/*.ogg`, src/audio/voice.ts), and code-split chunks (dynamic `import()`).
- Player data stays in the browser: settings, saves (SAVE.md text), leaderboard, lore progress in `localStorage`;
  PERIMETER's autosave in `sessionStorage`. Every read goes through a type guard (src/game/persistence.ts and the
  SAVE.md parser in src/game/saveMd.ts). A dropped or imported SAVE.md is parsed, validated and capped
  (SAVE_MAX_BYTES 256 KB), never executed.
- One dedicated Web Worker (src/worker/planner.worker.ts); every job type is checked by a guard before it runs.

## Automated baseline (2026-10-18, before the owner's assessment)

| Check | How | Result |
|---|---|---|
| Typecheck, 372 unit tests, Python mirror, lore build, test vectors | `bash scripts/gate.sh` | pass |
| Dependency audit (all, and runtime only) | `npm audit`, `npm audit --omit=dev` | 0 vulnerabilities; no runtime dependencies at all |
| No dynamic code or HTML injection (`eval`, `new Function`, `innerHTML =`, `document.write`) in `src/` | static grep in scripts/check.sh | none |
| No DOM, Canvas or `Math.random` in `src/physics`, `src/sim` | static grep in scripts/check.sh | none |
| Content-Security-Policy in the production HTML | `csp()` in vite.config.ts | `default-src 'self'; script-src 'self'; worker-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'` |
| Network calls in the shipped code | grep `fetch(` | two, both same-origin (lore, voice) |
| Licence and attribution | tests/help.test.ts | AGPL-3.0-or-later LICENSE, NOTICE, "Created by SPACED" on the credits page |
| Photosensitivity | first-boot notice; montage capped at 3 cuts/s (WCAG 2.3.1) | in place; luminance-area flash test not yet done (claim G8-1) |

Findings to look at during the assessment (not yet fixed, each a judgement call):

1. `frame-ancestors 'none'` is ignored in a `<meta>` CSP; GitHub Pages cannot send headers, so the game can be
   framed by other sites (low risk: no actions that spend money or send data). WARNINGS 9.
2. FIXED 2026-10-18: `style-src 'unsafe-inline'` dropped. The page's only inline `<style>` moved to
   `src/style.css` (a linked stylesheet); no CSP violations in the production build (title, run, planner worker,
   lore pictures, Learning Center).
3. FIXED 2026-10-18: `worker-src blob:` dropped; the planner worker ships as a same-origin file.
4. DECIDED 2026-10-18: one origin per GitHub account means other project pages on `<user>.github.io` share
   localStorage (the owner's account already serves two Pages sites). The game is published from its own
   organization, `spaced-lab`, so its origin `spaced-lab.github.io` holds MISS beta only. WARNINGS 9.
5. Source maps ship with the build (a teaching repo; DECISIONS D2, WARNINGS 10). Confirm that is still wanted.
6. CHECKED 2026-10-18: the dev server's screenshot sink and the dev hooks are absent from the production build
   (`grep -rl "__dev\|__miss\|localhost" dist` finds nothing; the voice generator is a script, never shipped).
7. FIXED 2026-10-18 (security review, whole tree): CI granted `pages: write` and `id-token: write` to the whole
   workflow, so pull-request runs on same-repository branches held them (fork PRs never do). They now sit on the
   `deploy` job only, which runs on `main`; the workflow default is `contents: read`.
8. FIXED 2026-10-18 (browser check, fresh site data): the photosensitivity notice could be skipped. The title's
   enter() started the first-launch tutorial before the notice was acknowledged, the `#minigame` (and other) deep
   links went straight past the title, and a dropped SAVE.md jumped into the run. Now `bootScreen()` lands on the
   title until `photoAck`, the tutorial starts on the acknowledging keypress, and a pre-acknowledgement drop is
   only stored (CONTINUE after). tests/bootScreen.test.ts; checked in the browser (fresh boot, `#minigame`).
9. FIXED 2026-10-18 (not a security issue): a SAVE.md `lore_read` map could carry unknown keys (`constructor:
   ADVANCED` was stored in `missb.lore.progress`). toSaveFile now keeps topic-id-shaped keys only.
10. FIXED 2026-10-18 (fuzz, tests/saveFuzz.test.ts: 20 000 seeded cases per run, 200 000 once): no input made the
   parser throw, break an invariant or touch Object.prototype, and no case was slow. It found four save-loss bugs
   (a save that loads but whose next autosave no longer loads, or the writer's own output rejected): a string
   that looks like a number or keyword (`12E45`, `true`) written unquoted; ` #` inside a quoted string read as a
   comment; `\"` inside a quoted string splitting a flow map; `budget: 1e308` rounded to Infinity on write. Fixed
   in src/game/saveMd.ts (fmtScalar, stripComment, splitTop, SAVE_MAX_ABS = 1e15); regression cases kept.

## Assessment checklist (owner, before going live)

- [x] `npm ci && bash scripts/gate.sh && python3 scripts/build_lore.py && npm run build && node scripts/smoke.mjs` on a clean checkout
      (2026-10-18, clone of d4c71da: 0 vulnerabilities, 414 tests, python, lore, vectors, build, smoke ok. The first
      attempt without build_lore shipped no Learning Center; the command here and RELEASING step 4 now include it)
- [x] `grep -r "__dev\|localhost" dist` finds nothing that matters (2026-10-18: nothing outside source maps; the
      production page has no `window.__miss`)
- [ ] Open the Pages URL: HTTPS only, "Enforce HTTPS" on, no mixed content (devtools console clean)
- [ ] Devtools Network tab during play: every request is to the Pages origin
- [x] Import a hand-edited and an oversized SAVE.md: rejected cleanly, nothing breaks (2026-10-18, synthetic drops:
      hand-edited with `round: -9e999`, an `<img onerror>` research value and a `<script>` tail: rejected, nothing
      stored, nothing executed; 280 KB: rejected by the parser cap; 400 KB: ignored by the drop cap; a `__proto__` /
      `constructor` lore map: accepted, prototype untouched, see finding 9; then fuzzed, finding 10)
- [x] Clear site data, reload: the photosensitivity notice shows; REDUCE MOTION calms every listed effect
      (2026-10-18: failed first, finding 8, fixed; then shown on a fresh boot and on `#minigame`, tutorial after the
      keypress. REDUCE MOTION: cinematics still (runtime), hit flash, glitch, peel, CRT flicker off and montage 1 cut/s
      (code: draw.ts:221, system.ts:1231/1242, main.ts:166, demo.ts:71), PERIMETER shake 0 (unit test))
- [ ] Review findings 1-10 above and record the decision for each
- [x] Review docs/WARNINGS.md end to end (owner, 2026-10-18)
- [ ] X.509 / certificate items (IDEAS 23) decided for the chosen domain (owner 2026-10-18: GitHub's certificate on
      spaced-lab.github.io accepted as normal; still open: signed release tag, build checksums)
- [ ] Record the result below with the commit hash

## Assessment log

| Date | Who | Commit | Result | Notes |
|---|---|---|---|---|
| 2026-10-18 | Claude (automated baseline) | see git log | baseline above | manual assessment pending |
| 2026-10-18 | Claude (/security-review: one agent, ~1 min, a pattern sweep of 515 tracked files plus a trace of the entry points; not a line-by-line audit) | b64dc32 | no HIGH or MEDIUM findings from the sweep | checked DOM and code sinks, SAVE.md import and drag-drop, storage guards, lore and voice fetches, URL hash, worker and console, CSP and dev hooks in dist, CI triggers and tokens, Python scripts, secrets; one hardening applied (finding 7) |
