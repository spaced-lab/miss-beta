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
