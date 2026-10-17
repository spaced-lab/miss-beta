// WHAT: The planner's quick estimates (GAME_PLAN 6.15) and the launcher payload tables (6.6).
// WHY:  The planner must rank hundreds of candidates per second; these closed forms do that, and every
//       committed plan is then verified by real propagation. The 3 dv T rule is also the game's title.
// HOW:  miss ≈ 3 dv_along T  (from da = 2 a^2 v dv / mu and dn/n = -1.5 da/a, near-circular orbits)
//       push:  miss ≈ 3 a tau (T_rem + tau/2)
//       payload(C3): linear interpolation of log(mass) between the tier's table points; 0 past the end.
//       Python mirror: pymiss/physics/estimates.py.
// LORE: D2 (early beats big), D8 (rockets), G3 (the planner)

import launchersJson from '../config/launchers.json';

export interface LauncherTier {
  tier: number;
  name: string;
  cost: number;
  /** [C3 km^2/s^2, payload kg] points, C3 ascending. */
  points: [number, number][];
}

export const LAUNCHERS = (launchersJson as unknown as { tiers: LauncherTier[] }).tiers;

/** Along-track displacement at close approach from an impulse dv (m/s) applied T seconds before. */
export function missFromImpulse(dvAlong: number, T: number): number {
  return 3 * dvAlong * T;
}

/** Displacement from a continuous acceleration a (m/s^2) for tau seconds followed by a coast of tRem. */
export function missFromPush(a: number, tau: number, tRem: number): number {
  return 3 * a * tau * (tRem + tau / 2);
}

/** Rough fragment-cloud footprint along track: 3 v_ej T. */
export function cloudFootprint(vEj: number, T: number): number {
  return 3 * vEj * T;
}

/** Departure C3 (km^2/s^2) from a hyperbolic excess speed (m/s). Example: 2940 m/s -> 8.64. */
export function c3FromVinf(vInf: number): number {
  return (vInf * vInf) / 1e6;
}

/**
 * Payload mass (kg) a launcher tier can send to a given C3 (km^2/s^2).
 * Example: Tier 1 at C3 = 10 -> between 4000 and 2000 on a log scale: 2828 kg.
 */
export function payloadForC3(tier: LauncherTier, c3: number): number {
  const pts = tier.points;
  const first = pts[0];
  if (!first) return 0;
  if (c3 <= first[0]) return first[1];
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    if (!p0 || !p1) break;
    if (c3 <= p1[0]) {
      if (p1[1] <= 0) {
        // Linear fade to zero on the last segment (log of zero is undefined).
        return p0[1] * (1 - (c3 - p0[0]) / (p1[0] - p0[0]));
      }
      const t = (c3 - p0[0]) / (p1[0] - p0[0]);
      return Math.exp(Math.log(p0[1]) + t * (Math.log(p1[1]) - Math.log(p0[1])));
    }
  }
  return 0;
}

export function launcherTier(tier: number): LauncherTier {
  const t = LAUNCHERS.find((l) => l.tier === tier);
  if (!t) throw new Error(`no launcher tier ${tier}`);
  return t;
}
