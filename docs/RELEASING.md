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
4. `bash scripts/gate.sh && python3 scripts/build_lore.py && npm run build && node scripts/smoke.mjs` (public/lore is
   generated and gitignored; without build_lore the build ships no Learning Center).
5. Commit `release: vYY.Q.N`, push, then `git tag vYY.Q.N && git push origin vYY.Q.N`. The tag runs
   `.github/workflows/release.yml`: the full check, the build, `miss-beta-YY.Q.N.zip` with `SHA256SUMS`, a keyless
   build-provenance attestation (Sigstore, this run's OIDC identity; no personal key), a GitHub Release with the
   CHANGELOG section as notes, and a Pages deploy of that same build when the tag contains all of main (an older
   tag, or a re-run of an old release, publishes its release but leaves Pages on main's newer build). The tag must
   equal `package.json`'s version and CHANGELOG must have the `## YY.Q.N (date)` heading, or the run stops before
   anything is published.
6. Check the run is green and verify the download once:
   `gh release download vYY.Q.N -R spaced-lab/miss-beta && gh attestation verify miss-beta-YY.Q.N.zip -R spaced-lab/miss-beta`
   and `shasum -a 256 -c SHA256SUMS`.

## First public publish only (v26.4.0)

- [x] Make the repository public, then enable Pages (Settings > Pages > Source: GitHub Actions; keep "Enforce
      HTTPS" on). The deploy job skips itself while the repository is private.
- [x] Enable immutable releases (Settings > General > Releases): once published, a release's tag and assets
      cannot be moved or replaced, and GitHub adds its own signed release attestation. This stands in for a
      signed tag without a personal signing key. Confirm the setting's current name and behaviour when enabling.
- [x] Allow the release deploy: Settings > Environments > github-pages > deployment branches and tags: keep
      `main`, add the tag rule `v*`. Without it the release workflow's deploy job is refused.
- [x] The first `release.yml` run is the v26.4.0 tag (artifact attestations need a public repository on GitHub's
      free plans). Afterwards run step 6 and confirm `gh attestation verify` passes. (Done 2026-10-18: run 39166020556 green, release
      https://github.com/spaced-lab/miss-beta/releases/tag/v26.4.0 immutable, checksum and attestation verified.)
- [ ] Add a macOS arm64 runner to the CI matrix next to ubuntu-latest (free on a public repository, 10x minutes on a
      private one). On it `tests/planarReplay.test.ts` runs bit for bit, because the fixture was captured on
      darwin arm64 Node 26 (`tests/fixtures/planarReplay.env.json`); linux x64 keeps the 1e-8 tolerance path. Keep
      the Pages artifact upload and deploy on the linux job only.

## After the first publish (CI backlog, from run 39161675146 annotations)

- [ ] Node 20 actions are deprecated (GitHub forces them onto Node 24 today): move `actions/checkout`,
      `actions/setup-node`, `actions/setup-python`, `actions/upload-pages-artifact` and `actions/deploy-pages` to
      their current majors; confirm one green run. Actions are pinned by commit SHA (major in a comment): update
      each with `gh api repos/actions/<name>/commits/<tag> --jq .sha`.
- [ ] `ubuntu-latest` migrates to Ubuntu 26 from 2026-10-19: confirm CI stays green on it (the cross-platform
      tolerances should absorb libm changes); pin `ubuntu-24.04` only if a run breaks and the fix is not quick.
