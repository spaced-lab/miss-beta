// WHAT: Physical and astronomical constants (GAME_PLAN 6.1), SI units.
// WHY:  One place for every number the physics uses, so a unit slip is a one-line fix and the Python mirror
//       (pymiss/physics/constants.py) can be diffed against this file by eye.
// HOW:  Plain exported numbers. Derived constants are computed, not typed, so they cannot drift.
// LORE: O1 (numbers, units), O4 (Newton)

/** Gravitational constant, m^3 kg^-1 s^-2 (CODATA 2018). */
export const G = 6.6743e-11;
/** Heliocentric gravitational parameter G*M_sun, m^3/s^2 (DE440). */
export const MU_SUN = 1.32712440018e20;
/** Astronomical unit, m (IAU 2012 exact). */
export const AU = 1.495978707e11;
/** Julian year, s. */
export const YEAR = 3.15576e7;
/** Day, s. */
export const DAY = 86400;
/** Speed of light, m/s (exact). */
export const C_LIGHT = 299792458;
/** Solar constant at 1 AU, W/m^2. */
export const SOLAR_CONST_1AU = 1361;
/** Radiation pressure at 1 AU for a perfectly absorbing surface, N/m^2; x2 for perfect reflection. */
export const P_RAD_1AU = SOLAR_CONST_1AU / C_LIGHT;
/** Standard gravity, m/s^2 (for Isp conversions). */
export const G0 = 9.80665;
/** One megaton of TNT, J. */
export const MT_TNT = 4.184e15;
/** Solar gravitational acceleration at 1 AU, m/s^2 (≈ 5.93e-3). */
export const SUN_ACCEL_1AU = MU_SUN / (AU * AU);

/** Home planet defaults (GAME_PLAN 5.2), used by tests and by bodies.json's HOME row. */
export const MU_HOME = 3.986004418e14;
export const R_HOME = 6.371e6;

export const TWO_PI = 2 * Math.PI;
