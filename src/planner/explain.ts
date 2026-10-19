// WHAT: Why the planner has no plan (IDEAS 27): read an empty porkchop grid and say which wall the player hit (not
//       enough time, not enough launch energy, and how much of that energy is climbing out of the planet's plane)
//       and what would help.
// WHY:  A visitor from another star usually leaves the planner blank. Measured over 30 SCI-FI visitors (bench/
//       visitors.bench.ts): with the half-year build none has a feasible launch; a craft already on standby reaches
//       1, plus 150 km^2/s^2 of free C3 3, plus 400 km^2/s^2 8. Time is the first wall, energy the second, so the
//       player should learn that, not stare at an empty list.
// HOW:  Pure: (grid, context) -> lines. TIME when the grid has no cell with a solved transfer (no window between the
//       end of the build and the impact). ENERGY when cells exist but none lifts any payload: the lowest C3 any
//       window needs against the launcher's ceiling (the first C3 at which the tier's payload curve reaches zero,
//       physics/estimates.ts) plus free C3; for a target off the plane, the share of that window's C3 in the out-of-
//       plane part of the departure (v_inf,z^2 / v_inf^2, the climb out of the ecliptic). Example: a visitor whose
//       best window needs C3 210 against a SUPERHEAVY ceiling of 130 with 60 % of it out of the plane reads
//       "BEST WINDOW NEEDS C3 210 KM2/S2; L3 REACHES 130. 60 % OF IT IS CLIMBING OUT OF THE PLANE."
// LORE: G3 (the planner), O10 (A to B), F12 (visitors from other stars)

import type { LauncherTier } from '../physics/estimates';
import type { PorkchopGrid } from './porkchop';

export interface NoPlanContext {
  /** Seconds from now to impact. */
  lead: number;
  /** Build time before the first launch, s (0 with a craft on standby). */
  buildTime: number;
  /** Shortest flight the planner considers, s (KNOBS.PORKCHOP_MIN_FLIGHT). */
  minFlight: number;
  tier: LauncherTier;
  c3Bonus: number;
  /** True when a craft on standby is available for this target (INTERCEPTOR_ON_STANDBY against a visitor). */
  standby: boolean;
}

export interface NoPlanWhy {
  kind: 'TIME' | 'ENERGY';
  lines: string[];
}

/** The C3 where the tier's payload first reaches zero, km^2/s^2. Example: BASIC (last point [80, 0]) gives 80. */
export function launcherCeiling(tier: LauncherTier): number {
  const pts = tier.points;
  for (const p of pts) if (p[1] <= 0) return p[0];
  return pts[pts.length - 1]?.[0] ?? 0;
}

const days = (s: number): string => (s >= 2 * 31557600 ? `${(s / 31557600).toFixed(1)} YEARS` : `${Math.round(s / 86400)} DAYS`);

/** Why `g` holds no feasible launch, or null when it does. */
export function explainNoPlan(g: PorkchopGrid, ctx: NoPlanContext): NoPlanWhy | null {
  if (g.feasible > 0) return null;
  // The solved cell needing the least C3 (the grid stores C3 for every solved transfer, payload or not).
  let best = -1;
  for (let i = 0; i < g.c3.length; i++) {
    const c = g.c3[i];
    if (c !== undefined && Number.isFinite(c) && (best < 0 || c < (g.c3[best] ?? Infinity))) best = i;
  }
  const help = (items: string[]): string => `WHAT WOULD HELP: ${items.join(', ')}.`;
  if (best < 0) {
    return {
      kind: 'TIME',
      lines: [
        `NO LAUNCH WINDOW: IMPACT IN ${days(ctx.lead)}; A NEW CRAFT TAKES ${days(ctx.buildTime)} TO BUILD AND AT LEAST ${days(ctx.minFlight)} TO FLY.`,
        help([...(ctx.standby ? [] : ['A CRAFT ALREADY WAITING IN SPACE (INTERCEPTOR ON STANDBY: NO BUILD TIME)']), 'EARLIER WARNING (MORE SURVEYS, THE HIVE STUDIES)']),
      ],
    };
  }
  const need = g.c3[best] ?? 0;
  const ceiling = launcherCeiling(ctx.tier) + ctx.c3Bonus;
  const lines = [`BEST WINDOW NEEDS C3 ${need.toFixed(0)} KM2/S2; L${ctx.tier.tier} ${ctx.tier.name}${ctx.c3Bonus > 0 ? ` WITH ${ctx.c3Bonus.toFixed(0)} FREE` : ''} REACHES ${ceiling.toFixed(0)}.`];
  if (g.v1z) {
    // HOME moves in the plane, so the whole z part of the departure velocity is excess speed: v_inf,z = v1z.
    const vz = (g.v1z[best] ?? 0) / 1000;
    const share = need > 0 ? Math.min(1, (vz * vz) / need) : 0;
    if (share >= 0.05) lines[0] += ` ${(share * 100).toFixed(0)} % OF IT IS CLIMBING OUT OF THE PLANE: THE ROCK ARRIVES STEEPLY.`;
  }
  lines.push(help([
    ...(ctx.standby ? [] : ['A CRAFT ALREADY WAITING (INTERCEPTOR ON STANDBY: NO BUILD TIME, MORE WINDOWS)']),
    'A BIGGER LAUNCHER (T)',
    'FREE C3 (ORBITAL DEPOT, LUNAR MASS DRIVER)',
    'EARLIER WARNING',
  ]));
  return { kind: 'ENERGY', lines };
}
