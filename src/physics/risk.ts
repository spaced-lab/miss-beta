// WHAT: Impact-risk scales (EDUCATION.md F9): the Palermo technical scale and the Torino scale.
// WHY:  The threat brief and LAB_TORINO need one number a public can read (Torino 0..10) and one an analyst
//       can compare (Palermo, logarithmic, relative to the background rate). Both are pure functions of the
//       impact probability, the energy and the time to the event.
// HOW:  Palermo (Chesley et al. 2002):  PS = log10( P / (f_B T) ),  f_B = 0.03 E_Mt^-0.8 per year.
//       Torino (Binzel 1999, revised 2005) is a chart in the (E, P) plane. The game reads it as straight
//       lines in log space (a linearised reading of the published chart; [unverified] against the exact
//       IAU boundary curves, see STATUS.md):
//         E < 1 Mt or P <= 0                                   -> 0
//         P >= 0.99:  E < 1e2 Mt -> 8,  E < 1e5 -> 9,  else 10  (certain: local, regional, global)
//         P >= 0.01:  E < 1e2 -> 3;  E < 1e5 -> 4 (P < 0.1) or 5;  else 6 (P < 0.1) or 7
//         P < 0.01:   2 if P >= 1e-2 / sqrt(E);  1 if P >= 1e-2 / E;  else 0
//       Python mirror: pymiss/physics/risk.py.
// LORE: F9 (Torino and Palermo), T2 (impact energy), T3 (how often)

/** Torino colour bands: 0 white, 1 green, 2-4 yellow, 5-7 orange, 8-10 red. */
export type TorinoBand = 'WHITE' | 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

/**
 * Annual background frequency of impacts with energy >= E (Mt): f_B = 0.03 E^-0.8 per year.
 * Example: E = 8 Mt -> 0.03 x 8^-0.8 = 5.68e-3 per year (one every ~176 years).
 */
export function backgroundFrequency(eMt: number): number {
  return 0.03 * Math.pow(eMt, -0.8);
}

/**
 * Palermo scale: PS = log10(P / (f_B T)), P impact probability, E in Mt, T years until the event.
 * Example: P = 0.03, E = 8 Mt, T = 7 yr -> f_B T = 0.0398, PS = log10(0.754) = -0.12 (2024 YR4 peaked there).
 */
export function palermo(P: number, eMt: number, years: number): number {
  return Math.log10(P / (backgroundFrequency(eMt) * years));
}

/**
 * Torino scale 0..10 from impact probability P (0..1) and kinetic energy E (Mt), by the linearised chart in
 * the header. Example: P = 0.03, E = 8 Mt -> 3 (2024 YR4, February 2025); P = 0.027, E = 500 Mt -> 4
 * (Apophis, December 2004); P = 1.7e-3, E = 9 Mt -> 1 (2023 DW).
 */
export function torino(P: number, eMt: number): number {
  if (!(P > 0) || !(eMt >= 1)) return 0;
  if (P >= 0.99) return eMt < 1e2 ? 8 : eMt < 1e5 ? 9 : 10;
  if (P >= 0.01) {
    if (eMt < 1e2) return 3;
    if (eMt < 1e5) return P < 0.1 ? 4 : 5;
    return P < 0.1 ? 6 : 7;
  }
  if (P >= 1e-2 / Math.sqrt(eMt)) return 2;
  if (P >= 1e-2 / eMt) return 1;
  return 0;
}

/** Colour band of a Torino level. Example: 3 -> YELLOW, 8 -> RED. */
export function torinoBand(level: number): TorinoBand {
  if (level <= 0) return 'WHITE';
  if (level === 1) return 'GREEN';
  if (level <= 4) return 'YELLOW';
  if (level <= 7) return 'ORANGE';
  return 'RED';
}
