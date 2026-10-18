# RESEARCH.md: the research backlog and how a claim earns its place

MISS β is "learning for everyone". Every real-world number it states is either backed by a source, reproduced
by our own calculation, or labelled UNVERIFIED where the player reads it. This file is the method; the registry
of claims is `src/config/claims.json`; `tests/claims.test.ts` keeps the two honest. The Learning Center teaches
the method itself in topic G9 ("How we know").

Game knobs (`src/config/knobs.ts`) are balance values, not claims. FICTION and SCI-FI content is made up on
purpose and labelled; it needs no source (a later pass may note where fiction and reality come close).

## 1. Statuses

| Status | Meaning | What game text must do |
|---|---|---|
| UNVERIFIED | Nobody on the project has checked it against a source yet. A best guess. | Say UNVERIFIED next to it, with the claim id. |
| SOURCED | A primary source is named in the registry. | State it plainly. |
| CHECKED | Sourced, and reproduced by our own calculation, lab or unit test. | State it plainly; the lab or test is the receipt. |
| CONTESTED | Sources disagree. | Give the range and say that it is contested. |
| REFUTED | Shown wrong. Kept so the correction stays visible. | Teach the correction. |
| OPEN | A research question with no answer yet. | Say it is an open question. |
| UNFEASIBLE | An idea that was checked and does not work. | Teach it in G9's dead ends, with the reason. |

A claim moves only with evidence, and the move gets a dated line in the review log (section 5).

## 2. Proposing an item (the scientific method, small)

1. **Claim.** One sentence, one number, its units, and the date it was true ("as of 2026").
2. **Tag.** The game's method tag (REAL, PROPOSED, SPECULATIVE, FICTION; never added, removed or moved without
   the owner) and a registry status, UNVERIFIED to begin with.
3. **Source.** A primary source: a peer-reviewed paper, a mission or agency document, a law, a standard. A news
   story points at a source; it is not one.
4. **Check.** Reproduce it: an order-of-magnitude calculation, a Learning Center lab, a unit test. Write the
   arithmetic into the registry's `check` field.
5. **Decide.** Adopt (SOURCED or CHECKED), refine (stays UNVERIFIED with a better `check`), or reject (REFUTED or
   UNFEASIBLE).
6. **Teach.** Put it in EDUCATION.md at the right level with its status. Text that cites a claim uses the form
   `(UNVERIFIED, claim F5-2)` so the test can find it.
7. **Review.** Anything that changes with time (counts, "as of" dates, mission schedules) gets re-checked at each
   release.

For a proposed technology, the feasibility questions come before any game card:

- Does physics allow it? Energy, momentum, thermodynamics (the radiator problem), materials.
- How ready is it? A technology readiness level (NASA NPR 7123.1) today and the level a flight unit needs.
- What would it cost, how long would it take, and how likely is it to work at all?
- What has to be invented first? Name the open problems.

An idea that fails the first question is UNFEASIBLE in REALISTIC mode and may still live in SCI-FI or FICTION,
labelled.

## 3. Where proposals come from

- The owner's private idea folder (`ideas/`, gitignored). Nothing from it is published until it has been through
  steps 1 to 5 in our own words.
- The owner's messages ("enhancement: ...").
- Anything a model or contributor notices while building. Add the claim to the registry as UNVERIFIED first, then
  write the game text.

## 4. The research backlog (open work)

Each line: claim id, what to do, size. The registry holds the details.

- F11-1: find the current found share of 140 m NEAs from CNEOS statistics and a population model. S.
- F5-1: per-survey limiting magnitudes and nightly sky area, turned into the game's coverage chances. M.
- F5-2: ATLAS warning times for 10 m and 100 m impactors; reproduce with LAB_MAGNITUDE. S.
- F5-3: count of pre-impact discoveries, dated. S.
- G8-1: measure our flashes against the WCAG general-flash and red-flash thresholds (luminance and area), not
  only the three-per-second rule. M.
- O-1: molten-salt reactors in free fall: literature search; compare specific mass with liquid-metal designs. M.
- Gauge calibration (F11): compare the model's needles with a published NEO population model; the gauge tilts
  orbits and charges a trailing loss that the rounds do not yet (3-D orbits milestone). L.
- Future-tech backlog items (hive survey, mothership, radiators, fission and fusion tiers, feasibility studies,
  interstellar warning): each real-world figure enters the registry as UNVERIFIED before any card uses it. L.

## 5. Review log

Append, never delete. Date, who, claim, change, reason.

```
2026-10-18  Claude  registry created: F11-1..3, F5-1..3, D3-1..2, G8-1, U-1, U-2, O-1
2026-10-18  Claude  F5 text: "[verify]" marks replaced by UNVERIFIED with claim ids; F11 and G9 written
2026-10-18  Claude  SOURCED entries name sources from memory; each needs the quote re-read before it is CHECKED
```
