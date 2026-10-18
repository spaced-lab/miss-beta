#!/usr/bin/env bash
# Runs the quality gate and prints only its summary lines, but EXITS WITH THE GATE'S STATUS.
# Use `bash scripts/gate.sh && git commit ...` so a pipe into grep can never hide a failure.
set -o pipefail
cd "$(dirname "$0")/.."
bash scripts/check.sh 2>&1 | grep -E "FAIL|== ok|passed|failed|OK$|Error" | head -20
