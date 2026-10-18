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
4. One origin per GitHub account: other project pages on `<user>.github.io` share this game's localStorage.
   Data is validated on read, but a custom domain or a dedicated account isolates it. WARNINGS 9.
5. Source maps ship with the build (a teaching repo; DECISIONS D2, WARNINGS 10). Confirm that is still wanted.
6. CHECKED 2026-10-18: the dev server's screenshot sink and the dev hooks are absent from the production build
   (`grep -rl "__dev\|__miss\|localhost" dist` finds nothing; the voice generator is a script, never shipped).

## Assessment checklist (owner, before going live)

- [ ] `npm ci && bash scripts/gate.sh && npm run build && node scripts/smoke.mjs` on a clean checkout
- [ ] `grep -r "__dev\|localhost" dist` finds nothing that matters
- [ ] Open the Pages URL: HTTPS only, "Enforce HTTPS" on, no mixed content (devtools console clean)
- [ ] Devtools Network tab during play: every request is to the Pages origin
- [ ] Import a hand-edited and an oversized SAVE.md: rejected cleanly, nothing breaks
- [ ] Clear site data, reload: the photosensitivity notice shows; REDUCE MOTION calms every listed effect
- [ ] Review findings 1-6 above and record the decision for each
- [ ] Review docs/WARNINGS.md end to end
- [ ] X.509 / certificate items (IDEAS 23) decided for the chosen domain
- [ ] Record the result below with the commit hash

## Assessment log

| Date | Who | Commit | Result | Notes |
|---|---|---|---|---|
| 2026-10-18 | Claude (automated baseline) | see git log | baseline above | manual assessment pending |
