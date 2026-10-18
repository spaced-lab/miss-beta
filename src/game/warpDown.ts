// WHAT: Auto warp-down: notice when the last craft in flight has arrived, once per arrival.
// WHY:  GAME_PLAN 29: at 1 YEAR/S a player misses that there is room to act after the last impact. When
//       nothing is in flight any more the clock drops to WARP_DOWN_INDEX and the HUD says why.
// HOW:  Pure bookkeeping over mission arrival times: an arrival in (before, now] fires if, after it, no
//       mission still has an arrival ahead. Each mission id fires at most once (a Set), so a stepped or
//       scrubbed clock cannot fire twice. No DOM, no world mutation: the screen sets the warp.
// LORE: G2 (screens and HUD), G1 (how to play)

export interface ArrivalLike {
  id: string;
  arrivalTime: number;
}

/** True when some mission is between launch and arrival at `t`, or still waiting to launch. */
export function craftRemaining(missions: readonly ArrivalLike[], t: number): boolean {
  return missions.some((m) => m.arrivalTime > t);
}

export class WarpDown {
  private readonly handled = new Set<string>();

  /**
   * Mission ids whose arrival passed in (before, now] and left nothing in flight. Empty when a craft is
   * still on its way or when these arrivals already fired. Example: one mission arriving at t = 100,
   * check(90, 110) -> ['M-1'], check(90, 110) again -> [].
   */
  check(missions: readonly ArrivalLike[], before: number, now: number): string[] {
    const arrived: string[] = [];
    for (const m of missions) {
      if (m.arrivalTime > before && m.arrivalTime <= now && !this.handled.has(m.id)) {
        this.handled.add(m.id);
        arrived.push(m.id);
      }
    }
    if (arrived.length === 0 || craftRemaining(missions, now)) return [];
    return arrived;
  }
}
