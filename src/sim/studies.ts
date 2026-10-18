// WHAT: Feasibility studies (owner backlog 6): research lines that turn PROPOSED, SPECULATIVE and EXPERIMENTAL
//       technology into game capabilities, with honest odds: a study can take longer than planned or fail.
// WHY:  Programs (sim/programs.ts) are things we know how to build. Studies are things we do not yet know how to
//       build; the lesson is that real research is a portfolio of bets measured in human decades.
// HOW:  Each card (config/studies.json) has a readiness level today and the one a flight unit needs, a median
//       duration in human years with a log-normal spread, a cost in billions of US dollars and a chance the line
//       works at all. One attempt's fate is drawn once from Rng(hash(runSeed:STUDY:id:attempt)) in a fixed order:
//       z (gaussian), success (chance), failStep (int): duration_h = median * exp(sigma z); the game runs it in
//       STUDY_TIME_COMPRESSION of that. Progress crosses one milestone per readiness level; a doomed attempt fails
//       at its failStep milestone, so bad news arrives early and stops the spending. Cost per game year is
//       cost / (median human years x compression) x STUDY_BUDGET_PER_BUSD, at least STUDY_COST_MIN. On success the
//       card's effects go through the program effect code. In SCI-FI and above every attempt succeeds at the median.
//       Only the attempt number, progress, funding and status are saved: the draw is recomputed from the seed.
// LORE: D14 (feasibility studies and human years), G9 (how we know), D13 (wild ideas)

import studiesJson from '../config/studies.json';
import { KNOBS } from '../config/knobs';
import { YEAR } from '../physics/constants';
import { applyEffects, type Effect, type ProgramDef, type ProgramsContext } from './programs';
import { hashSeed, Rng } from './rng';

export type StudyTag = 'PROPOSED' | 'SPECULATIVE' | 'EXPERIMENTAL';

export interface StudyCard {
  id: string;
  name: string;
  tag: StudyTag;
  group: string;
  trlNow: number;
  trlNeeded: number;
  humanYears: number;
  sigma: number;
  costBUSD: number;
  pSuccess: number;
  requires: string[];
  effects: Effect[];
  breakthroughs: string[];
  note: string;
}

export const STUDIES = (studiesJson as { studies: StudyCard[] }).studies;

export function studyById(id: string): StudyCard {
  const c = STUDIES.find((x) => x.id === id);
  if (!c) throw new Error(`no study ${id}`);
  return c;
}

export type StudyStatus = 'IDLE' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';

export interface StudyState {
  id: string;
  /** 0 before the first attempt; each new attempt draws a fresh fate. */
  attempt: number;
  /** Fraction of this attempt's drawn duration done, 0..1. */
  progress: number;
  funding: number;
  status: StudyStatus;
  /** Round time it succeeded or failed (the program clock convention: 0 once a later round starts). */
  endedAt: number | null;
}

export function createStudies(): StudyState[] {
  return STUDIES.map((c) => ({ id: c.id, attempt: 0, progress: 0, funding: 0, status: 'IDLE', endedAt: null }));
}

/** Milestones of a card: one per readiness level to climb (at least one). Example: TRL 5 -> 7 gives 2. */
export function milestones(c: StudyCard): number {
  return Math.max(1, c.trlNeeded - c.trlNow);
}

export interface StudyFate {
  /** Drawn duration in human years (the readout); the game runs it in gameYears. */
  humanYears: number;
  gameYears: number;
  success: boolean;
  /** Milestone (1..milestones) at which a doomed attempt fails. */
  failStep: number;
}

/**
 * The fate of one attempt. Same seed, id and attempt -> same fate. In SCI-FI (`assured`) it is the median and works.
 * Example: median 6 y, sigma 0.3, z = 0 -> 6 human years, 6 x 0.3 = 1.8 game years.
 */
export function studyFate(runSeed: string, c: StudyCard, attempt: number, assured = false): StudyFate {
  const rng = new Rng(hashSeed(`${runSeed}:STUDY:${c.id}:${attempt}`));
  const z = rng.gaussian();
  const success = rng.chance(c.pSuccess);
  const failStep = rng.int(1, milestones(c));
  const humanYears = assured ? c.humanYears : c.humanYears * Math.exp(c.sigma * z);
  return { humanYears, gameYears: humanYears * KNOBS.STUDY_TIME_COMPRESSION, success: assured || success, failStep };
}

/** Budget units per game year while fully funded. Example: 0.5 B over 6 y x 0.3 x 2 per B -> max(0.4, 0.56) = 0.56. */
export function studyCostPerYear(c: StudyCard): number {
  return Math.max(KNOBS.STUDY_COST_MIN, (c.costBUSD / (c.humanYears * KNOBS.STUDY_TIME_COMPRESSION)) * KNOBS.STUDY_BUDGET_PER_BUSD);
}

/** Readiness level reached so far: trlNow plus one per milestone passed. */
export function trlReached(c: StudyCard, st: StudyState): number {
  if (st.status === 'SUCCEEDED') return c.trlNeeded;
  const passed = Math.min(milestones(c), Math.floor(st.progress * milestones(c) + 1e-9));
  // A failed attempt stopped AT its failing milestone: that level was not reached.
  return c.trlNow + (st.status === 'FAILED' ? Math.max(0, passed - 1) : passed);
}

/** Chance that at least one of several independent lines works: 1 - prod(1 - p). Example: 0.25, 0.2 -> 0.4. */
export function anyWorks(ps: readonly number[]): number {
  return 1 - ps.reduce((a, p) => a * (1 - p), 1);
}

/** Can this card be started: its prerequisites succeeded, and EXPERIMENTAL cards need the option or SCI-FI. */
export function studyAvailable(c: StudyCard, states: readonly StudyState[], experimental: boolean): boolean {
  if (c.tag === 'EXPERIMENTAL' && !experimental) return false;
  return c.requires.every((r) => states.find((s) => s.id === r)?.status === 'SUCCEEDED');
}

/** Start (or restart after a failure or cancel) an attempt at full funding. */
export function startStudy(st: StudyState): void {
  if (st.status === 'RUNNING' || st.status === 'SUCCEEDED') return;
  st.attempt += 1;
  st.progress = 0;
  st.funding = 1;
  st.status = 'RUNNING';
  st.endedAt = null;
}

export function cancelStudy(st: StudyState): void {
  if (st.status !== 'RUNNING') return;
  st.status = 'CANCELLED';
  st.funding = 0;
}

export interface StudyEvent {
  id: string;
  kind: 'MILESTONE' | 'SUCCEEDED' | 'FAILED';
  trl: number;
}

/**
 * Advance running studies by dt of sim time: cost drained at the funding fraction, progress toward the drawn
 * duration, one event per milestone crossed; a doomed attempt stops at its failStep, a lucky one applies its
 * effects through the program code. Returns the events in order.
 */
export function advanceStudies(states: StudyState[], runSeed: string, ctx: ProgramsContext, t: number, dt: number, assured = false): StudyEvent[] {
  const out: StudyEvent[] = [];
  for (const st of states) {
    if (st.status !== 'RUNNING' || st.funding <= 0) continue;
    const c = studyById(st.id);
    const fate = studyFate(runSeed, c, st.attempt, assured);
    const n = milestones(c);
    ctx.economy.spent += (st.funding * studyCostPerYear(c) * dt) / YEAR;
    const before = Math.floor(st.progress * n + 1e-9);
    st.progress = Math.min(1, st.progress + (st.funding * dt) / (fate.gameYears * YEAR));
    const after = Math.floor(st.progress * n + 1e-9);
    for (let m = before + 1; m <= after; m++) {
      if (!fate.success && m >= fate.failStep) {
        st.progress = m / n;
        st.status = 'FAILED';
        st.funding = 0;
        st.endedAt = t;
        out.push({ id: st.id, kind: 'FAILED', trl: c.trlNow + m });
        break;
      }
      if (m < n) out.push({ id: st.id, kind: 'MILESTONE', trl: c.trlNow + m });
    }
    if (st.status === 'RUNNING' && st.progress >= 1 - 1e-12) {
      st.progress = 1;
      st.status = 'SUCCEEDED';
      st.funding = 0;
      st.endedAt = t;
      applyEffects(asProgram(c), ctx, t);
      out.push({ id: st.id, kind: 'SUCCEEDED', trl: c.trlNeeded });
    }
  }
  return out;
}

/** A card as a program definition, so applyEffects can apply its effects. */
export function asProgram(c: StudyCard): ProgramDef {
  return { id: c.id, name: c.name, tag: c.tag === 'EXPERIMENTAL' ? 'SPECULATIVE' : c.tag, years: c.humanYears, costPerYear: 0, mode: 'REALISTIC', effects: c.effects, note: c.note };
}

/** Total funded study cost per year right now, budget units. */
export function studyBurn(states: readonly StudyState[]): number {
  return states.reduce((a, s) => (s.status === 'RUNNING' ? a + s.funding * studyCostPerYear(studyById(s.id)) : a), 0);
}
