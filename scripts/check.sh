#!/usr/bin/env bash
# Quality gate: typecheck, tests, dependency audit, and a few static security greps.
# Mirrors what CI will run (M11). Exit non-zero on any failure.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== typecheck"; npx tsc --noEmit
echo "== tests";     npx vitest run --reporter=dot
echo "== python";   python3 -m unittest discover -s pymiss/tests -t . -q 2>&1 | tail -3
echo "== vectors";  python3 scripts/gen_vectors.py > /dev/null && git diff --quiet -- tests/vectors || { echo "FAIL: tests/vectors changed; regenerate and commit"; exit 1; }
echo "== audit";     npm audit --audit-level=moderate
echo "== static security checks"
# No dynamic code execution and no HTML injection from strings in game code.
# Comment lines are excluded (the rules are allowed to mention what they forbid).
if grep -rnE "\beval\(|new Function\(|innerHTML\s*=|document\.write\(" src/ | grep -vE '^[^:]+:[0-9]+:\s*(//|\*)' ; then
  echo "FAIL: dynamic code or HTML injection pattern found"; exit 1
fi
# Sim and physics must stay free of DOM / Canvas imports and Math.random.
if grep -rnE "document\.|window\.|HTMLCanvasElement|CanvasRenderingContext2D|Math\.random" src/physics src/sim 2>/dev/null | grep -vE '^[^:]+:[0-9]+:\s*(//|\*)' ; then
  echo "FAIL: DOM, Canvas or Math.random inside src/physics or src/sim"; exit 1
fi
echo "== ok"
