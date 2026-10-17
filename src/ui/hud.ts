// WHAT: HUD text helpers shared by the sim views: clock formatting and the warp readout.
// WHY:  GAME_PLAN 4: "all caps, monospace feel, terminal cadence". One formatter keeps every screen's
//       clock identical (T+ before a threat exists, T-MINUS once one does).
// HOW:  Pure string functions; drawing goes through render/vectorFont.
// LORE: G2 (screens and HUD)

import { DAY, YEAR } from '../physics/constants';

/** "T+ 02Y 113D" from seconds since round start. */
export function formatElapsed(t: number): string {
  const years = Math.floor(t / YEAR);
  const days = Math.floor((t - years * YEAR) / DAY);
  return `T+ ${String(years).padStart(2, '0')}Y ${String(days).padStart(3, '0')}D`;
}

/** "T-04Y 112D" for a countdown to an epoch; negative remaining prints T+. */
export function formatCountdown(remaining: number): string {
  if (remaining < 0) return formatElapsed(-remaining);
  const years = Math.floor(remaining / YEAR);
  const days = Math.floor((remaining - years * YEAR) / DAY);
  return `T-${String(years).padStart(2, '0')}Y ${String(days).padStart(3, '0')}D`;
}
