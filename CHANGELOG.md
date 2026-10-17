# Changelog

All notable changes. Format: date, milestone tag when one applies, one line per feature.

## 0.1.0 (2026-10-17)

- Scaffold: Vite 8, TypeScript 5.9, vitest 5; zero audit findings; `scripts/check.sh` quality gate.
- Render foundation: DPR-aware Canvas 2D surface with three glow strategies, hand-built stroke font
  (A-Z, 0-9, punctuation, β, ∝), color-mode table from GAME_PLAN 24.1 as data.
- Seeded RNG (mulberry32 + FNV-1a seed hashing) and 2-D vector helpers, with tests.
- PERIMETER arcade minigame: pure sim, renderer, cheats, best score, adaptive collision with benchmark.
- Title screen with the MISS ∝ β logo and the menu (NEW RUN, LEARN, OPTIONS marked BUILDING).
- Dev tooling: production-only CSP injection, dev-only `/__dev/shot` canvas capture endpoint.
