# Changelog

All notable changes. Format: date, milestone tag when one applies, one line per feature.

## 0.1.0 (2026-10-17)

- PERIMETER v2: open-ended levels (one per 28 s) driving streams, launchers and rock hardness; adaptive
  pressure; hardness tiers 0..3 with neon colours stepping down as a rock weakens; shards one tier down with
  a chance of a hard core one tier up; stream strength by position (centre strongest, 1/2/3 by stream count);
  bullet impulse scaled by rock mass; passing rocks that miss unless nudged; a moon that bends paths and
  absorbs hits; heat gauge with overheat lockout; auto turrets earned per 60 direct hits from level 6;
  spectrum colour stages unlocking by level. Debug toggles moved to digit keys.

- M0: physics core (constants, Kepler propagation, state to elements) in TypeScript and Python with shared
  test vectors; seeded World with per-round planet phases; SYSTEM VIEW with the warp ladder, COMPRESSED
  (sqrt) scale, wheel zoom and drag pan; NEW RUN opens it from the title.

- Scaffold: Vite 8, TypeScript 5.9, vitest 5; zero audit findings; `scripts/check.sh` quality gate.
- Render foundation: DPR-aware Canvas 2D surface with three glow strategies, hand-built stroke font
  (A-Z, 0-9, punctuation, β, ∝), color-mode table from GAME_PLAN 24.1 as data.
- Seeded RNG (mulberry32 + FNV-1a seed hashing) and 2-D vector helpers, with tests.
- PERIMETER arcade minigame: pure sim, renderer, cheats, best score, adaptive collision with benchmark.
- Title screen with the MISS ∝ β logo and the menu (NEW RUN, LEARN, OPTIONS marked BUILDING).
- Dev tooling: production-only CSP injection, dev-only `/__dev/shot` canvas capture endpoint.
