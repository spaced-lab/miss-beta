# RELEASING.md: version convention and the release steps

## Version convention: YY.Q.N

MISS β uses calendar versions `YY.Q.N`:

- `YY`: the two-digit year (26 for 2026).
- `Q`: the quarter, 1 to 4 (January-March is 1, October-December is 4).
- `N`: the release number within that quarter, starting at 0; it resets to 0 when a new quarter begins.

Examples: `26.4.0` is the first release of Q4 2026 (the first public publish); the next release in the same
quarter is `26.4.1`; the first release of January 2027 is `27.1.0`.

The version lives in `package.json` and `src/game/version.ts` (shown on the title screen); `tests/version.test.ts`
fails if they disagree or break the pattern. Each release gets a `## YY.Q.N (date)` section in `CHANGELOG.md` and a
git tag `vYY.Q.N`.

## Release steps

1. Code review done; `docs/SAFETY.md` assessment recorded for this commit.
2. Bump `package.json`, `package-lock.json` (root entry) and `src/game/version.ts`.
3. Move the CHANGELOG items under a new `## YY.Q.N (date)` heading.
4. `bash scripts/gate.sh && npm run build && node scripts/smoke.mjs`.
5. Commit `release: vYY.Q.N`, tag `vYY.Q.N`, push; CI deploys `main` to GitHub Pages.

## First public publish only (v26.4.0)

- [ ] Make the repository public, then enable Pages (Settings > Pages > Source: GitHub Actions; keep "Enforce
      HTTPS" on). The deploy job skips itself while the repository is private.
- [ ] Add a macOS arm64 runner to the CI matrix next to ubuntu-latest (free on a public repository, 10x minutes on a
      private one). On it `tests/planarReplay.test.ts` runs bit for bit, because the fixture was captured on
      darwin arm64 Node 26 (`tests/fixtures/planarReplay.env.json`); linux x64 keeps the 1e-8 tolerance path. Keep
      the Pages artifact upload and deploy on the linux job only.

## After the first publish (CI backlog, from run 39161675146 annotations)

- [ ] Node 20 actions are deprecated (GitHub forces them onto Node 24 today): move `actions/checkout`,
      `actions/setup-node`, `actions/setup-python`, `actions/upload-pages-artifact` and `actions/deploy-pages` to
      their current majors; confirm one green run.
- [ ] `ubuntu-latest` migrates to Ubuntu 26 from 2026-10-19: confirm CI stays green on it (the cross-platform
      tolerances should absorb libm changes); pin `ubuntu-24.04` only if a run breaks and the fix is not quick.
