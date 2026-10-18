// WHAT: The release version shown on the title screen.
// WHY:  One place to bump; tests/version.test.ts checks it matches package.json.
// HOW:  Calendar versioning YY.Q.N (docs/RELEASING.md): two-digit year, quarter 1-4, then the release number
//       within that quarter, starting at 0 and resetting each quarter. 26.4.0 is the first release of Q4 2026.
// LORE: C1 (how the game is built)

export const VERSION = '26.4.0';
