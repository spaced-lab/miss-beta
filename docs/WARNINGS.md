# WARNINGS.md

Things in this repo that deserve a second look before you run or deploy it. Each entry says what it is, where
it lives, what it can do, and what to do about it. Add an entry whenever a convenience trades away safety.

## 1. Dev server screenshot sink (`/__dev/shot`)

- **What:** while `npm run dev` runs, a page served by the dev server can `POST` an image to `/__dev/shot`
  and it is written to `.dev/shot.png` (or `MISS_SHOT_PATH`). Used for automated visual checks when no
  screenshot tool is available.
- **Where:** `devShot()` in `vite.config.ts`. `apply: 'serve'`, so it is never in `npm run build` output.
- **Limits:** localhost `Host` only; same-origin `Origin` only (other pages on the machine are refused with
  403); body capped at 8 MB; the output path is fixed and cannot be chosen by the request.
- **Do:** keep the dev server bound to localhost. **Do not run `npm run dev -- --host`** (or any other way of
  exposing the dev server to a network) unless you accept that any device on that network could write that
  one file. If you do not need the sink, delete the plugin from the `plugins` array.

## 2. Dev server is not a production server

- Vite's dev server serves source files, source maps and the HMR socket, and has no Content Security Policy
  (the strict CSP is injected only into the production build by `csp()` in `vite.config.ts`).
- **Do:** ship `npm run build` output only; never expose the dev server.

## 3. Browser storage is untrusted input

- Best scores (and from M2, the leaderboard and SAVE.md mirror) live in `localStorage`. Another tab, an
  extension or a hand edit can change them.
- **Where:** `src/game/persistence.ts` validates every read with a type guard and falls back to a default.
- **Do:** when adding a stored value, add a guard; never `JSON.parse` storage without one.

## 4. Cheat codes are public

- Every code is in `src/minigame/cheats.ts` (and from M7, `src/game/cheats.ts`). They flag a run ASSISTED
  and the score is not saved as a best, but nothing stops a player editing storage by hand (see 3).
- **Do:** treat local best scores as personal, not competitive. A shared leaderboard would need a server.

## 5. Window-level key handling

- `src/ui/input.ts` listens on `window` and calls `preventDefault` for Space and the arrow keys so the page
  does not scroll. If the game is ever embedded in another page, scope the listener to the canvas.

## 6. Dependencies

- Three dev dependencies (vite, typescript, vitest), zero at runtime. `npm run check` fails on any audit
  finding of moderate severity or higher. Adding a dependency needs a line in STATUS.md explaining why.

## 7. The offline voice generator downloads and loads a model

- **What:** `scripts/gen_voice.py` (run by hand, never by the game, the gate or CI) installs Kokoro, PyTorch and
  spaCy into `.venv-voice/` and downloads the Kokoro-82M weights from Hugging Face into `~/.cache/huggingface`.
  PyTorch weight files can carry pickled code, so loading them is trusting the publisher (hexgrad/Kokoro-82M).
- **Where:** only on the developer's machine. The venv and the cache are outside version control (`.gitignore`);
  the game ships only the rendered `.ogg` clips and loads them from its own origin (`connect-src 'self'`).
- **Do:** run it in the venv, from the official repo id, and listen to the clips before committing. Never commit
  weights, caches or the venv.

## 8. Photosensitivity: flashing and fast-changing images

- **What:** impact and nuclear flashes in the cinematics, the SUPER-DUPER-DEMO montage (scene cuts that speed
  up), the SIMULATION-mode glitch pass, the optional CRT flicker, and PERIMETER's screen shake and laser beams.
- **Where:** `src/render/cinematics/draw.ts` (the 0.12 s hit flash), `src/render/views/demo.ts` (`sceneLen`),
  `src/render/glitch.ts`, `src/render/crt.ts`, `src/minigame/render.ts`.
- **Limits:** a first-boot notice on the title screen (`drawPhotoNotice` in `src/render/views/title.ts`) must be
  acknowledged once (`photoAck` in the settings record). OPTIONS > REDUCE MOTION turns off the hit flash, the
  glitch and the CRT flicker, shows cinematics as a still frame and slows the montage to one cut a second.
  Without it the montage is still capped at three cuts a second (WCAG 2.3.1, "three flashes or below threshold";
  `DEMO_MONTAGE.SAFE_MIN_S`). Not yet measured: the luminance area of each flash against the WCAG general-flash
  threshold, and red-flash content. `[unverified]`
- **Do:** keep any new full-screen change at or under three per second, route it through `reduceMotion`, and
  list it here and in the notice.

## 9. Hosting on GitHub Pages (github.io)

- **What:** the production build is static files; GitHub Pages serves them over HTTPS with GitHub's certificate.
- **Shared origin:** every project page of one account lives on the same origin, `https://<user>.github.io`.
  `localStorage` and `sessionStorage` are per origin, so **any other project page under the same account can read
  and write this game's saved settings, runs and leaderboard**, and this game can read theirs. Our reads are all
  type-guarded (entry 3), so tampering cannot run code, but treat the data as public. A custom domain or a
  dedicated account gives the game its own origin.
- **Headers:** Pages does not let us set response headers. The CSP is a `<meta>` tag (`csp()` in
  `vite.config.ts`), which cannot carry `frame-ancestors`, so other sites can frame the game (clickjacking is low
  risk: there is nothing to click that spends money or sends data). No `Permissions-Policy` or
  `X-Content-Type-Options` either.
- **Do:** deploy only `npm run build` output (entry 2); keep "Enforce HTTPS" on in the Pages settings; never put
  secrets in the repo or the build (everything shipped is public); review the security assessment in
  `docs/SAFETY.md` before each release. X.509 / certificate items are IDEAS 23.
