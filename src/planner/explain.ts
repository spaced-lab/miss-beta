// WHAT: Why the planner has no plan (IDEAS 27): read an empty porkchop grid and say which wall the player hit (not
//       enough time, not enough launch energy, and how much of that energy is climbing out of the planet's plane)
//       and what would help.
// WHY:  A visitor from another star usually leaves the planner blank. Measured over 30 SCI-FI visitors (bench/
//       visitors.bench.ts): with the half-year build none has a feasible launch; a craft already on standby reaches
//       1, plus 150 km^2/s^2 of free C3 3, plus 400 km^2/s^2 8. Time is the first wall, energy the second, so the
//       player should learn that, not stare at an empty list.
// HOW:  Pure: (grid, context) -> lines. TIME when the grid has no cell with a solved transfer and the lead is shorter
//       than build + shortest flight + the planner's resolve margin (no window at all); NO_TRANSFER when that window
//       exists but no Lambert solve succeeded. ENERGY when cells exist but none lifts any payload: the lowest C3 any
//       window needs against the launcher's ceiling (the first C3 at which the tier's payload curve reaches zero,
//       physics/estimates.ts) plus free C3; for a target off the plane, the share of that window's C3 in the out-of-
//       plane part of the departure (v_inf,z^2 / v_inf^2, the climb out of the ecliptic). Example: a visitor whose
//       best window needs C3 210 against a SUPERHEAVY ceiling of 130 with 60 % of it out of the plane reads
//       "BEST WINDOW NEEDS C3 210 KM2/S2; L3 REACHES 130. 60 % OF IT IS CLIMBING OUT OF THE PLANE."
// LORE: G3 (the planner), O10 (A to B), F12 (visitors from other stars)

import { KNOBS } from '../config/knobs';
import { DAY, YEAR } from '../physics/constants';
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
  /** The target is a visitor from another star: only then can standby or pickets help (sim/programs launchReadiness). */
  visitor?: boolean;
  /** SCI-FI or beyond: name the orbital laser array, which acts by range and ignores the plane (tests/visitorDefence). */
  scifi?: boolean;
  /** Out-of-plane speed a parked standby craft already has, m/s (INCLINED_PICKETS); already taken off the grid's C3. */
  vzPark?: number;
}

/** SCI-FI levers that do not launch from HOME. The ground laser's 0.05 AU is crossed in about a day by a fast visitor,
 *  inside the last-day margin, so it never fires on one (tests/visitorDefence.test.ts); DE-STAR's 0.3 AU gives days. */
const SCIFI_HELP = 'AN ORBITAL LASER ARRAY (DE-STAR ACTS BY RANGE, NOT PLANE; A GROUND LASER IS TOO SLOW FOR A FAST VISITOR)';

export interface NoPlanWhy {
  kind: 'TIME' | 'NO_TRANSFER' | 'ENERGY';
  lines: string[];
}

/** The C3 where the tier's payload first reaches zero, km^2/s^2. Example: BASIC (last point [80, 0]) gives 80. */
export function launcherCeiling(tier: LauncherTier): number {
  const pts = tier.points;
  for (const p of pts) if (p[1] <= 0) return p[0];
  return pts[pts.length - 1]?.[0] ?? 0;
}

const days = (s: number): string => (s >= 2 * YEAR ? `${(s / YEAR).toFixed(1)} YEARS` : `${Math.round(s / DAY)} DAYS`);

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
  // Ways to start sooner: standby serves only a visitor; against anything else a stockpile shortens the build.
  const sooner = ctx.standby ? [] : ctx.visitor ? ['A CRAFT ALREADY WAITING IN SPACE (INTERCEPTOR ON STANDBY: NO BUILD TIME)'] : ['A SHORTER BUILD (INTERCEPTOR STOCKPILE)'];
  if (best < 0) {
    const margin = KNOBS.PORKCHOP_RESOLVE_MARGIN;
    const build = ctx.standby ? 'A CRAFT IS ON STANDBY (NO BUILD)' : `A NEW CRAFT TAKES ${days(ctx.buildTime)} TO BUILD`;
    if (ctx.lead >= ctx.buildTime + ctx.minFlight + margin) {
      return {
        kind: 'NO_TRANSFER',
        lines: [
          `NO TRANSFER FOUND: EVERY WINDOW BEFORE IMPACT FAILED TO SOLVE (THE ROCK'S PATH IS TOO STEEP OR TOO FAST FOR A DIRECT ARC).`,
          help(['EARLIER WARNING', ...(ctx.scifi ? [SCIFI_HELP] : [])]),
        ],
      };
    }
    return {
      kind: 'TIME',
      lines: [
        `NO LAUNCH WINDOW: IMPACT IN ${days(ctx.lead)}; ${build}, AT LEAST ${days(ctx.minFlight)} TO FLY AND ${days(margin)} TO CONFIRM THE RESULT BEFORE IMPACT.`,
        help([...sooner, 'EARLIER WARNING (MORE SURVEYS, THE HIVE STUDIES)', ...(ctx.scifi ? [SCIFI_HELP] : [])]),
      ],
    };
  }
  const need = g.c3[best] ?? 0;
  const ceiling = launcherCeiling(ctx.tier) + ctx.c3Bonus;
  const lines = [`BEST WINDOW NEEDS C3 ${need.toFixed(0)} KM2/S2; L${ctx.tier.tier} ${ctx.tier.name}${ctx.c3Bonus > 0 ? ` WITH ${ctx.c3Bonus.toFixed(0)} FREE` : ''} REACHES ${ceiling.toFixed(0)}.`];
  if (g.v1z) {
    // HOME moves in the plane, so the whole z part of the departure velocity is excess speed: v_inf,z = v1z.
    const vz = Math.max(0, Math.abs(g.v1z[best] ?? 0) - (ctx.vzPark ?? 0)) / 1000;
    const share = need > 0 ? Math.min(1, (vz * vz) / need) : 0;
    if (share >= KNOBS.EXPLAIN_PLANE_SHARE.PLANE_MENTION) lines[0] += ` ${(share * 100).toFixed(0)} % OF IT IS CLIMBING OUT OF THE PLANE: THE ROCK ARRIVES STEEPLY.`;
    if (share >= KNOBS.EXPLAIN_PLANE_SHARE.PICKETS_SHARE && ctx.visitor && !(ctx.vzPark ?? 0)) lines.push('A CRAFT PARKED OFF THE PLANE STARTS WITH PART OF THAT CLIMB PAID: INCLINED PICKETS (G).');
  }
  lines.push(help([
    ...(ctx.standby ? [] : ctx.visitor ? ['A CRAFT ALREADY WAITING (INTERCEPTOR ON STANDBY: NO BUILD TIME, MORE WINDOWS)'] : ['A SHORTER BUILD (INTERCEPTOR STOCKPILE: MORE WINDOWS)']),
    'A BIGGER LAUNCHER (T)',
    `FREE C3 (KICK STAGES, ORBITAL DEPOT${ctx.scifi ? ', LUNAR MASS DRIVER' : ''})`,
    'EARLIER WARNING',
    ...(ctx.scifi ? [SCIFI_HELP] : []),
  ]));
  return { kind: 'ENERGY', lines };
}
