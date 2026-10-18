# Contributing

MISS β is a game and a course. Read `CLAUDE.md` (the working rules), then `docs/CODE_TOUR.md`.

- Every source file opens with a `WHAT / WHY / HOW / LORE:` header. Every physics function carries its formula,
  units and one hand-checkable example. `// NOTE:` explains a decision.
- A physics function is done when it exists in TypeScript (`src/physics`) and Python (`pymiss/physics`) with
  the same name (snake_case in Python) and both pass the shared vectors (`python3 scripts/gen_vectors.py`,
  committed under `tests/vectors/`).
- Tunables are `[knob]` constants in `src/config/knobs.ts` (sim) or `src/minigame/config.ts` (arcade).
  Balance by changing knobs, never by changing targets. Method tags (REAL / PROPOSED / SPECULATIVE / FICTION)
  are content; do not move one.
- No `eval`, no `innerHTML` with strings, no remote scripts, no runtime dependencies. Anything read from
  localStorage or a save file goes through a type guard.
- Before a commit: `npm run check` (typecheck, tests, Python tests, lore validation, vectors, audit, security
  greps). Commit messages: `feat(scope): what it does` plus a paragraph on how and which lore topic explains it.
- New ideas go to `IDEAS.md` as one paragraph with a size; do not build them unasked.
- Good first issues: a color mode, a SPAWN scenario from the JPL Small-Body Database, a SIMPLE picture, a
  lore quiz (templates in `.github/ISSUE_TEMPLATE`).

## Licence of contributions

MISS β is licensed AGPL-3.0-or-later (see `LICENSE` and `NOTICE`). Contributions come in under the same terms
("inbound = outbound"): by opening a pull request you agree your change is licensed AGPL-3.0-or-later. Keep the
"Created by SPACED" credit on the credits screen (NOTICE, section 7(b) term).
