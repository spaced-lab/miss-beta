// WHAT: PLAY IT OUT (F): the schedule that plays the rest of a round in a fixed number of real seconds.
// WHY:  Owner 2026-10-24: once a plan is committed the player wants to watch the outcome, not warp by hand: the flight
//       from launch to impact in about 20 s with a short slow-down at the launch and at the hit, then about 20 s to
//       the close approach with the last seconds slow and a pause on the result. A schedule, not a warp level: the
//       wall time is what the knobs say whatever the lead time is.
// HOW:  planPlayOut cuts the remaining sim time into spans (BUILD to the first launch, FLIGHT to the last arrival,
//       COAST to the close approach), each with the real seconds it gets. The cinematics that will play inside a
//       span stop the clock, so their scene seconds come off that span's budget. playOutRate(plan, t) is the sim
//       rate at clock time t; the screen advances the clock by it. Pure: no DOM, no world mutation.
// LORE: G2 (screens and HUD), G1 (how to play)

export interface PlayOutKnobs {
  /** Real seconds from now to the first launch (the build). */
  BUILD_S: number;
  /** Real seconds from the first launch to the last arrival, scenes included. */
  FLIGHT_S: number;
  /** Scene seconds for a launch, and for a hit (impact, burst, PI, push, breakup) in that flight budget. */
  LAUNCH_SCENE_S: number;
  HIT_SCENE_S: number;
  /** Real seconds from the last arrival to the close approach, the final approach, the end scene and the result
   *  hold included. */
  COAST_S: number;
  /** The last FINAL_DAYS before the close approach run slowly, over FINAL_S real seconds (the suspense). */
  FINAL_S: number;
  FINAL_DAYS: number;
  END_SCENE_S: number;
  RESULT_HOLD_S: number;
  /** The clock holds this long on each event brief so it can be read (added to the total, not taken from a span). */
  BRIEF_S: number;
  /** No span's clock portion goes under this, however many scenes it holds. */
  MIN_SPAN_S: number;
}

export type PlayOutStage = 'BUILD' | 'FLIGHT' | 'COAST' | 'FINAL';

export interface PlayOutSpan {
  stage: PlayOutStage;
  /** Sim time, s. */
  from: number;
  to: number;
  /** Real seconds the clock runs through this span (scenes not included). */
  real: number;
}

export interface PlayOutPlan {
  spans: PlayOutSpan[];
  tCa: number;
  /** Real seconds from now to the debrief: spans, scenes, brief holds, the end scene and the hold. */
  totalRealS: number;
  /** Event briefs the clock will hold on. */
  briefs: number;
}

export interface FlightLike {
  launchTime: number;
  arrivalTime: number;
}

export interface EventLike {
  t: number;
  kind: string;
  missionId?: string;
}

const HIT_KINDS: ReadonlySet<string> = new Set(['IMPACT', 'NUKE', 'PI', 'PUSH']);
/** Events with no brief of their own (the close approach has the debrief; the rest are bookkeeping). */
const NO_BRIEF: ReadonlySet<string> = new Set(['CLOSE_APPROACH', 'ROUND_START', 'NOTE']);

/** Events in (from, to] that will post a brief the clock holds on. */
export function briefCount(events: readonly EventLike[], from: number, to: number): number {
  let n = 0;
  for (const e of events) if (e.t > from && e.t <= to && !NO_BRIEF.has(e.kind)) n++;
  return n;
}

/**
 * Scene seconds the cinematics will take for the events in (from, to]: one launch scene per LAUNCH, one hit scene per
 * impact, burst, PI or push, and per breakup that no impact or burst of the same mission caused in the same instant
 * (the cinematics fold those into one scene). Example: LAUNCH at 10, IMPACT and FRAGMENTATION at 20 for M-1, knobs 1
 * and 2 -> 3.
 */
export function sceneSeconds(events: readonly EventLike[], from: number, to: number, k: PlayOutKnobs): number {
  let s = 0;
  for (const e of events) {
    if (e.t <= from || e.t > to) continue;
    if (e.kind === 'LAUNCH') s += k.LAUNCH_SCENE_S;
    else if (HIT_KINDS.has(e.kind)) s += k.HIT_SCENE_S;
    else if (e.kind === 'FRAGMENTATION' && !events.some((c) => c !== e && c.t === e.t && c.missionId === e.missionId && (c.kind === 'IMPACT' || c.kind === 'NUKE'))) s += k.HIT_SCENE_S;
  }
  return s;
}

/**
 * The schedule from `now` to the close approach `tCa`. Example (in days): now 0, one mission launching at 100 and
 * arriving at 400, tCa 800, a LAUNCH and an IMPACT in the log, knobs BUILD 3, FLIGHT 20, scenes 1 and 2, COAST 20,
 * FINAL 4 s over 30 days, END 3, HOLD 2, BRIEF 4: BUILD 0-100 in 3 s, FLIGHT 100-400 in 17 s (20 less the two
 * scenes), COAST 400-770 in 11 s (20 less the final, the end scene and the hold), FINAL 770-800 in 4 s; total
 * 3 + 17 + 11 + 4 + scenes 3 + briefs 8 + end 3 + hold 2 = 51 s. With nothing committed: COAST and FINAL only.
 */
export function planPlayOut(now: number, missions: readonly FlightLike[], tCa: number, events: readonly EventLike[], k: PlayOutKnobs): PlayOutPlan {
  const spans: PlayOutSpan[] = [];
  const launches = missions.filter((m) => m.launchTime > now && m.launchTime < tCa).map((m) => m.launchTime);
  const tLaunch = launches.length > 0 ? Math.min(...launches) : null;
  const arrivals = missions.filter((m) => m.arrivalTime > now).map((m) => Math.min(m.arrivalTime, tCa));
  const tArrive = arrivals.length > 0 ? Math.max(...arrivals) : null;
  let t = now;
  let scenes = 0;
  if (tLaunch !== null && tLaunch > t) {
    spans.push({ stage: 'BUILD', from: t, to: tLaunch, real: k.BUILD_S });
    t = tLaunch;
  }
  if (tArrive !== null && tArrive > t) {
    const sc = sceneSeconds(events, t - 1e-9, tArrive, k);
    scenes += sc;
    spans.push({ stage: 'FLIGHT', from: t, to: tArrive, real: Math.max(k.MIN_SPAN_S, k.FLIGHT_S - sc) });
    t = tArrive;
  }
  // The coast, then the final approach: the last FINAL_DAYS crawl so the close approach is watched, not skipped.
  const tFinal = Math.max(t, tCa - k.FINAL_DAYS * 86400);
  if (tFinal > t) {
    const sc = sceneSeconds(events, t, tFinal, k);
    scenes += sc;
    spans.push({ stage: 'COAST', from: t, to: tFinal, real: Math.max(k.MIN_SPAN_S, k.COAST_S - k.FINAL_S - k.END_SCENE_S - k.RESULT_HOLD_S - sc) });
    t = tFinal;
  }
  if (tCa > t) {
    const sc = sceneSeconds(events, t, tCa - 1e-9, k);
    scenes += sc;
    spans.push({ stage: 'FINAL', from: t, to: tCa, real: Math.max(k.MIN_SPAN_S, k.FINAL_S - sc) });
  }
  const briefs = briefCount(events, now, tCa - 1e-9);
  const totalRealS = spans.reduce((a, s) => a + s.real, 0) + scenes + briefs * k.BRIEF_S + k.END_SCENE_S + k.RESULT_HOLD_S;
  return { spans, tCa, totalRealS, briefs };
}

/** Sim seconds per real second at clock time t: the span holding t, 0 at or past the close approach. */
export function playOutRate(plan: PlayOutPlan, t: number): number {
  if (t >= plan.tCa) return 0;
  const span = plan.spans.find((s) => t >= s.from && t < s.to) ?? plan.spans[0];
  if (!span) return 0;
  return (span.to - span.from) / span.real;
}

/** The HUD word for clock time t: the span's stage, RESULT at or past the close approach. */
export function playOutStage(plan: PlayOutPlan, t: number): PlayOutStage | 'RESULT' {
  if (t >= plan.tCa) return 'RESULT';
  return (plan.spans.find((s) => t >= s.from && t < s.to) ?? plan.spans[0])?.stage ?? 'RESULT';
}
