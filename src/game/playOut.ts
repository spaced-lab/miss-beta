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
  /** Real seconds from the last arrival to the close approach, the end scene and the result hold included. */
  COAST_S: number;
  END_SCENE_S: number;
  RESULT_HOLD_S: number;
  /** No span's clock portion goes under this, however many scenes it holds. */
  MIN_SPAN_S: number;
}

export type PlayOutStage = 'BUILD' | 'FLIGHT' | 'COAST';

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
  /** Real seconds from now to the debrief: spans, scenes, the end scene and the hold. */
  totalRealS: number;
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
 * The schedule from `now` to the close approach `tCa`. Example (days as seconds): now 0, one mission launching at 100
 * and arriving at 400, tCa 800, a LAUNCH and an IMPACT in the log, knobs 3 / 20 / 1 / 2 / 20 / 3 / 2 / 2: BUILD 0-100 in
 * 3 s, FLIGHT 100-400 in 17 s (20 less one launch and one hit scene), COAST 400-800 in 15 s (20 less the end scene and
 * the hold); total 3 + 17 + 3 + 15 + 3 + 2 = 43 s. With nothing committed: one COAST span now-tCa.
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
  if (tCa > t) {
    const sc = sceneSeconds(events, t, tCa - 1e-9, k);
    scenes += sc;
    spans.push({ stage: 'COAST', from: t, to: tCa, real: Math.max(k.MIN_SPAN_S, k.COAST_S - k.END_SCENE_S - k.RESULT_HOLD_S - sc) });
  }
  const totalRealS = spans.reduce((a, s) => a + s.real, 0) + scenes + k.END_SCENE_S + k.RESULT_HOLD_S;
  return { spans, tCa, totalRealS };
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
