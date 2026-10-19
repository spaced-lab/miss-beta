#!/usr/bin/env bash
# WHAT: The automatable part of the docs/SAFETY.md assessment checklist in one command (IDEAS 35): a clean checkout
#       of a commit, the full gate, the production build and smoke test, greps of dist for dev hooks, local
#       addresses, plain-http URLs and dynamic code, the CSP meta tag, and the SAVE.md import tests.
# WHY:  The owner runs the full security review before every publish; the mechanical steps should be one command that
#       cannot be done half-way, so the manual review can spend its time on judgement. The manual steps (the live
#       Pages origin, devtools network tab, a fresh-profile boot, WARNINGS.md) stay manual and are listed at the end.
# HOW:  `npm run safety` (HEAD) or `bash scripts/safety.sh <ref>`. git archive into a temporary folder, npm ci, then
#       each step; the first failure stops with FAIL and a non-zero exit. Nothing in the working tree is touched.
# LORE: C1 (how the game is built), C3 (tests)
set -euo pipefail
cd "$(dirname "$0")/.."
ref="${1:-HEAD}"
sha="$(git rev-parse --short "$ref")"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
fail() { echo "safety: FAIL $1"; exit 1; }

echo "== clean checkout of ${sha}"
git archive "$ref" | tar -x -C "$tmp"
cd "$tmp"
npm ci --silent >/dev/null 2>&1 || fail "npm ci"

echo "== gate"
bash scripts/check.sh > gate.log 2>&1 || { tail -30 gate.log; fail "gate (scripts/check.sh)"; }

echo "== build and smoke"
python3 scripts/build_lore.py >/dev/null || fail "build_lore"
npm run build --silent >/dev/null 2>&1 || fail "build"
node scripts/smoke.mjs || fail "smoke"

echo "== dist greps (source maps excluded: they quote the source on purpose)"
if grep -rIl --exclude='*.map' -E '__dev/|localhost|127\.0\.0\.1|window\.__miss' dist; then fail "dev hook or local address in dist"; fi
# Plain-http URLs: only XML namespace identifiers (never fetched) are allowed.
if grep -rIoh --exclude='*.map' -E 'http://[^"'"'"' )<>]+' dist | grep -vE '^http://www\.w3\.org/' | sort -u | grep .; then fail "plain-http URL in dist"; fi
if grep -rIl --exclude='*.map' -E '\beval\(|new Function\(' dist; then fail "dynamic code in dist"; fi

echo "== CSP"
csp="$(grep -o '<meta http-equiv="Content-Security-Policy" content="[^"]*"' dist/index.html | sed 's/.*content="//; s/"$//')"
[ -n "$csp" ] || fail "no CSP meta tag in dist/index.html"
for need in "default-src 'self'" "script-src 'self'" "worker-src 'self'" "style-src 'self'" "connect-src 'self'" "object-src 'none'" "base-uri 'self'" "form-action 'none'" "frame-ancestors 'none'"; do
  case "$csp" in *"$need"*) ;; *) fail "CSP lacks: $need";; esac
done
for bad in "unsafe-inline" "unsafe-eval" "blob:" " *" "http:"; do
  case "$csp" in *"$bad"*) fail "CSP allows: $bad";; esac
done
echo "$csp"

echo "== SAVE.md import (hand-edited, hostile, oversized, fuzzed)"
npx vitest run tests/saveFuzz.test.ts tests/saveMd.test.ts tests/savegame.test.ts --reporter=dot > save.log 2>&1 || { tail -30 save.log; fail "SAVE.md tests"; }
grep -E 'Tests' save.log

echo "== safety ok (${sha})"
echo "Still manual (docs/SAFETY.md checklist): the live Pages URL over HTTPS with a clean console, the devtools"
echo "network tab during play (one origin), a fresh-profile boot (photosensitivity notice, REDUCE MOTION),"
echo "docs/WARNINGS.md end to end, and the decision on each open finding."
