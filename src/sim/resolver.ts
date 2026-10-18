// WHAT: The resolver: from the world and the committed missions, the deterministic outcome of the round.
// WHY:  GAME_PLAN 11. Everything the player sees after COMMIT is a replay of this function's output: the
//       event log, each body's element segments, the close approach of every body. It is pure, so the
//       planner scores candidates with it, Monte Carlo samples it (sampleSeed), MULTIVERSE forks it (M7).
// HOW:  Bodies: the threat, and after a disruptive impact its largest remnant and fragments. Missions are
//       applied in arrival order to the body they target (the threat by default, a fragment by id after
//       a breakup); an impactor that finds its target within TERMINAL_GUIDANCE_RANGE of the planned
//       intercept delivers either a crater (dv = beta (m/M) U, GAME_PLAN 6.9) or, when Q >= Q*, a
//       disruption (6.10) that replaces the body. At the end every live body gets a close-approach test;
//       fragments use a short window and a 3-D correction Bernoulli (f3D) drawn from the sample stream so
//       the flat model does not over-count hits. Outcome: MISS (nothing damaging hits), PARTIAL (hits carry
//       less than PARTIAL_ENERGY_FRACTION of the original energy), else HIT. Betas and fragment draws come
//       from per-(seed, round, mission, sample) streams: order independent and exactly replayable.
// LORE: O12 (close approach), D3 (kinetic and beta), D4 (fragmentation), G7 (under the hood)

import { KNOBS } from '../config/knobs';
import { bCrit as bCritOf, closeApproach, impactCategory, impactEnergy, sphereMass, type CloseApproach, type ImpactCategory, type ImpactEnergy } from '../physics/closeApproach';
import { OrbitError, stateToElements } from '../physics/elements';
import { disrupt, f3D, harmlessDiameter, qStar, specificEnergy } from '../physics/fragment';
import { propagate, type Elements } from '../physics/kepler';
import { alongTrack, kineticImpact } from '../physics/kinetic';
import { fuzeOk, nuclearBurst } from '../physics/nuclear';
import { integratePush, pushForce, type PushMethod } from '../physics/slowPush';
import type { EventLog } from './eventLog';
import type { Mission } from './mission';
import { hashSeed, Rng } from './rng';
import { planetById, type World } from './world';

export type Outcome = 'HIT' | 'MISS' | 'PARTIAL';

export interface ElementSegment {
  tFrom: number;
  tTo: number;
  elements: Elements;
}

/** A tracked body: the threat, its largest remnant, or a fragment. */
export interface Body {
  id: string;
  /** 'THREAT' for the original, 'REMNANT' for the largest piece, 'FRAGMENT' otherwise. */
  role: 'THREAT' | 'REMNANT' | 'FRAGMENT';
  mass: number;
  D: number;
  /** Born at this time (round start for the threat). */
  tBirth: number;
  /** Removed at this time (disruption) or Infinity. */
  tDeath: number;
  segments: ElementSegment[];
  /** Below the airburst threshold: cannot do damage. */
  harmless: boolean;
  /** Escaped to an unbound orbit; no close approach computed. */
  escaped: boolean;
  /** Mean ejection speed relative to the parent at birth, m/s (0 for the threat). */
  vEj: number;
}

export interface BodyOutcome {
  body: Body;
  ca: CloseApproach | null;
  /** Deterministic verdict after the 3-D correction draw. */
  hits: boolean;
  energyMt: number;
}

export interface RoundResult {
  outcome: Outcome;
  /** Close approach of the primary body (threat or largest remnant). */
  ca: CloseApproach;
  /** Energy of the original threat at the primary's impact speed (the brief's number). */
  energy: ImpactEnergy;
  category: ImpactCategory;
  events: EventLog;
  bodies: Body[];
  outcomes: BodyOutcome[];
  /** Energy actually delivered by bodies that hit, Mt. */
  hitEnergyMt: number;
  /** Threat element segments (the primary body's). */
  segments: ElementSegment[];
  tLastAction: number;
  producedFragments: boolean;
  usedWarhead: boolean;
}

export interface ResolveOpts {
  betaOverride?: number;
  /** Monte Carlo sample index; 0 is the canonical ground truth. */
  sampleSeed?: number;
}

function streamFor(world: World, tag: string, sample: number): Rng {
  return new Rng(hashSeed(`${world.runSeed}#${world.round}#${tag}#${sample}`));
}

/** Beta for a mission: deterministic per (run seed, round, mission id, sample). */
export function drawBeta(world: World, missionId: string, type: string, sample = 0): number {
  const range = KNOBS.BETA_RANGE[type] ?? ([2, 4] as const);
  return streamFor(world, `beta#${missionId}`, sample).float(range[0], range[1]);
}

export function elementsAt(segments: readonly ElementSegment[], t: number): Elements {
  for (const s of segments) if (t >= s.tFrom && t < s.tTo) return s.elements;
  const last = segments[segments.length - 1];
  if (!last) throw new Error('elementsAt: no segments');
  return last.elements;
}

export function bodyAlive(b: Body, t: number): boolean {
  return t >= b.tBirth && t < b.tDeath && !b.escaped;
}

export function resolveRound(world: World, missions: readonly Mission[] = [], opts: ResolveOpts = {}): RoundResult {
  const threat = world.threat;
  if (!threat) throw new Error('resolveRound: no threat');
  const home = planetById(world, 'HOME');
  const mu = world.star.mu;
  const sample = opts.sampleSeed ?? 0;
  const iron = threat.type.id === 'IRON';
  const material = threat.type.kind === 'comet' ? 'ice' : 'basalt';
  const events: EventLog = [];
  const bodies: Body[] = [
    { id: 'THREAT', role: 'THREAT', mass: threat.mass, D: threat.D, tBirth: -Infinity, tDeath: Infinity, segments: [{ tFrom: -Infinity, tTo: Infinity, elements: threat.elements }], harmless: false, escaped: false, vEj: 0 },
  ];
  let tLast = 0;
  let producedFragments = false;
  let usedWarhead = false;
  let fragCounter = 0;

  /** Replace `target` by a remnant and fragments at time t given the delivered Q and impactor momentum. */
  const disruptBody = (target: Body, current: Elements, st: { r: { x: number; y: number }; v: { x: number; y: number } }, m: Mission, Q: number, Qs: number, Uvec: { x: number; y: number }, mImp: number, t: number): void => {
    const rng = streamFor(world, `frag#${m.id}`, sample);
    const nFrag = rng.int(KNOBS.FRAG_N_MIN, KNOBS.FRAG_N_MAX);
    const R = target.D / 2;
    const pieces = disrupt(rng, { M: target.mass, R, rho: threat.type.density, Q, Qstar: Qs, m: mImp, Uvec, vThreat: st.v, nFrag });
    target.tDeath = t;
    const last = target.segments[target.segments.length - 1];
    if (last) last.tTo = t;
    producedFragments = true;
    tLast = t;
    let escaped = 0;
    let meanEj = 0;
    for (const f of pieces) meanEj += Math.hypot(f.v.x - st.v.x, f.v.y - st.v.y);
    meanEj /= Math.max(1, pieces.length);
    for (const f of pieces) {
      const id = f.largestRemnant ? `${target.id === 'THREAT' ? 'REMNANT' : target.id + 'R'}` : `F${++fragCounter}`;
      let el: Elements | null = null;
      try {
        el = stateToElements(st.r, f.v, mu, t);
      } catch (e) {
        if (!(e instanceof OrbitError)) throw e;
      }
      const body: Body = {
        id,
        role: f.largestRemnant ? 'REMNANT' : 'FRAGMENT',
        mass: f.mass,
        D: f.D,
        tBirth: t,
        tDeath: Infinity,
        segments: [{ tFrom: t, tTo: Infinity, elements: el ?? current }],
        harmless: f.D < harmlessDiameter(iron),
        escaped: el === null,
        vEj: Math.hypot(f.v.x - st.v.x, f.v.y - st.v.y),
      };
      if (body.escaped) escaped++;
      bodies.push(body);
    }
    events.push({ t, kind: 'FRAGMENTATION', missionId: m.id, targetId: target.id, qRatio: Q / Qs, count: pieces.length, largestD: pieces[0]?.D ?? 0, vEj: meanEj, escaped });
  };

  const sorted = [...missions].sort((a, b) => a.arrivalTime - b.arrivalTime);
  for (const m of sorted) {
    events.push({ t: m.launchTime, kind: 'LAUNCH', missionId: m.id, c3: m.c3, massKg: m.impactorKg, tier: m.launcherTier });
    const targetId = m.targetId ?? 'THREAT';
    const target = bodies.find((b) => b.id === targetId && bodyAlive(b, m.arrivalTime));
    if (!target) {
      events.push({ t: m.arrivalTime, kind: 'IMPACT_MISS', missionId: m.id, offset: Infinity });
      continue;
    }
    const current = elementsAt(target.segments, m.arrivalTime);
    const st = propagate(current, mu, m.arrivalTime);
    const offset = Math.hypot(st.r.x - m.interceptR.x, st.r.y - m.interceptR.y);
    if (offset > KNOBS.TERMINAL_GUIDANCE_RANGE) {
      events.push({ t: m.arrivalTime, kind: 'IMPACT_MISS', missionId: m.id, offset });
      continue;
    }
    const R = target.D / 2;
    const Qs = qStar(R, threat.type.density, threat.type.strengthMult, material);

    if (m.push) {
      // Slow push (6.12): the craft has rendezvoused (the planner paid the mismatch); push along track for tau.
      const tEnd = Math.min(m.arrivalTime + m.push.tauMax, threat.tImpact - KNOBS.PUSH_END_MARGIN);
      const rNow = Math.hypot(st.r.x, st.r.y);
      const pf = pushForce({ method: m.push.method as PushMethod, tier: m.push.tier }, target.mass, target.D / 2, rNow, iron);
      if (!pf.viable || pf.force <= 0 || tEnd <= m.arrivalTime) {
        events.push({ t: m.arrivalTime, kind: 'PUSH', missionId: m.id, targetId: target.id, method: m.push.method, force: pf.force, dv: 0, duration: 0, viable: false, note: pf.note });
        continue;
      }
      const a = (m.push.sign * pf.force) / target.mass;
      let arc;
      try {
        arc = integratePush(current, mu, m.arrivalTime, tEnd, a);
      } catch (e) {
        if (!(e instanceof OrbitError)) throw e;
        events.push({ t: m.arrivalTime, kind: 'NOTE', text: `${m.id} PUSHED ${target.id} ONTO AN UNBOUND ORBIT; IGNORED` });
        continue;
      }
      const lastSeg = target.segments[target.segments.length - 1];
      if (lastSeg) lastSeg.tTo = m.arrivalTime;
      // NOTE: during the arc the body is drawn on its pre-push orbit; the arc's end state becomes the new
      // segment from tEnd. A sampled table for the arc is a BUILD_PLAN polish item.
      target.segments.push({ tFrom: m.arrivalTime, tTo: tEnd, elements: current });
      target.segments.push({ tFrom: tEnd, tTo: Infinity, elements: arc.elements });
      tLast = tEnd;
      events.push({ t: m.arrivalTime, kind: 'PUSH', missionId: m.id, targetId: target.id, method: m.push.method, force: pf.force, dv: arc.dv, duration: tEnd - m.arrivalTime, viable: true, note: pf.note });
      continue;
    }

    if (m.warhead) {
      // Nuclear (6.11): standoff pushes along the burst-to-centre line (the approach direction); surface and
      // subsurface disrupt when Q_nuc >= Q*. A pulse train sums bursts with a disruption check after each.
      usedWarhead = true;
      const U = Math.hypot(m.arrivalV.x - st.v.x, m.arrivalV.y - st.v.y);
      const fuzed = m.warhead.mode !== 'STANDOFF' || fuzeOk(U, m.warhead.tier);
      if (!fuzed) {
        events.push({ t: m.arrivalTime, kind: 'NUKE', missionId: m.id, targetId: target.id, mode: m.warhead.mode, yieldMt: m.warhead.yieldMt, dv: 0, qRatio: 0, fuzed: false, pulses: m.warhead.pulses });
        continue;
      }
      const ux = (m.arrivalV.x - st.v.x) / (U || 1);
      const uy = (m.arrivalV.y - st.v.y) / (U || 1);
      let v = { x: st.v.x, y: st.v.y };
      let dvSum = 0;
      let qSum = 0;
      let disrupted = false;
      for (let pulse = 0; pulse < Math.max(1, m.warhead.pulses); pulse++) {
        const nb = nuclearBurst(m.warhead.yieldMt, m.warhead.mode, target.mass, R, KNOBS.NUKE_STANDOFF_H_FRAC * R);
        dvSum += nb.dv;
        qSum += nb.Q;
        v = { x: v.x + nb.dv * ux, y: v.y + nb.dv * uy };
        if (qSum >= Qs) {
          disrupted = true;
          break;
        }
      }
      events.push({ t: m.arrivalTime, kind: 'NUKE', missionId: m.id, targetId: target.id, mode: m.warhead.mode, yieldMt: m.warhead.yieldMt, dv: dvSum, qRatio: qSum / Qs, fuzed: true, pulses: m.warhead.pulses });
      if (disrupted) {
        // The burst's momentum enters through the ejecta; the fragments carry the standoff push too.
        disruptBody(target, current, { r: st.r, v }, m, qSum, Qs, { x: ux * dvSum * 1, y: uy * dvSum * 1 }, 0, m.arrivalTime);
        continue;
      }
      let next: Elements;
      try {
        next = stateToElements(st.r, v, mu, m.arrivalTime);
      } catch (e) {
        if (!(e instanceof OrbitError)) throw e;
        events.push({ t: m.arrivalTime, kind: 'NOTE', text: `${m.id} PUSHED ${target.id} ONTO AN UNBOUND ORBIT; IGNORED` });
        continue;
      }
      const lastSeg = target.segments[target.segments.length - 1];
      if (lastSeg) lastSeg.tTo = m.arrivalTime;
      target.segments.push({ tFrom: m.arrivalTime, tTo: Infinity, elements: next });
      tLast = m.arrivalTime;
      continue;
    }

    const beta = opts.betaOverride ?? drawBeta(world, m.id, threat.type.id, sample);
    const k = kineticImpact(m.impactorKg, target.mass, m.arrivalV, st.v, beta);
    const Q = specificEnergy(m.impactorKg, target.mass, k.U);

    if (Q < Qs) {
      // Cratering: an impulse, new elements, same body.
      const v2 = { x: st.v.x + k.dv.x, y: st.v.y + k.dv.y };
      let next: Elements;
      try {
        next = stateToElements(st.r, v2, mu, m.arrivalTime);
      } catch (e) {
        if (!(e instanceof OrbitError)) throw e;
        events.push({ t: m.arrivalTime, kind: 'NOTE', text: `${m.id} PUSHED ${target.id} ONTO AN UNBOUND ORBIT; IGNORED` });
        continue;
      }
      const last = target.segments[target.segments.length - 1];
      if (last) last.tTo = m.arrivalTime;
      target.segments.push({ tFrom: m.arrivalTime, tTo: Infinity, elements: next });
      tLast = m.arrivalTime;
      events.push({ t: m.arrivalTime, kind: 'IMPACT', missionId: m.id, U: k.U, beta, dvAlong: alongTrack(k.dv, st.v), dvTotal: Math.hypot(k.dv.x, k.dv.y), massKg: m.impactorKg, targetId: target.id, qRatio: Q / Qs });
      continue;
    }

    // Disruption: the body dies; a remnant and fragments are born.
    disruptBody(target, current, st, m, Q, Qs, { x: m.arrivalV.x - st.v.x, y: m.arrivalV.y - st.v.y }, m.impactorKg, m.arrivalTime);
  }

  // Close approach of every live body.
  const outcomes: BodyOutcome[] = [];
  const draw = streamFor(world, 'f3d', sample);
  let hitEnergyMt = 0;
  let primary: BodyOutcome | null = null;
  for (const b of bodies) {
    if (b.escaped || b.tDeath !== Infinity) continue;
    const el = elementsAt(b.segments, Infinity);
    const isFrag = b.role !== 'THREAT';
    const ca = closeApproach(el, home.elements, mu, home.mu, home.radius, threat.tImpact, isFrag ? { window: KNOBS.FRAG_CA_WINDOW } : {});
    let hits = ca.impact && !b.harmless;
    if (hits && isFrag && b.vEj > 0) {
      const p = f3D(bCritOf(home.mu, home.radius, ca.vInf), b.vEj, Math.max(0, threat.tImpact - b.tBirth));
      hits = draw.chance(p);
    }
    const energyMt = hits ? impactEnergy(b.D, threat.type.density, ca.vImpact).energyMt : 0;
    hitEnergyMt += energyMt;
    const bo = { body: b, ca, hits, energyMt };
    outcomes.push(bo);
    if (b.role === 'THREAT' || b.role === 'REMNANT') primary = bo;
    events.push({ t: ca.tCa, kind: 'CLOSE_APPROACH', bodyId: b.id, dMin: ca.dMin, bCrit: ca.bCrit, marginRadii: ca.marginRadii, impact: hits });
  }
  if (!primary || !primary.ca) throw new Error('resolveRound: no primary body');
  events.sort((a, b) => a.t - b.t);

  const threatEnergy = impactEnergy(threat.D, threat.type.density, primary.ca.vImpact);
  const outcome: Outcome = hitEnergyMt <= 0 ? 'MISS' : hitEnergyMt < KNOBS.PARTIAL_ENERGY_FRACTION * threatEnergy.energyMt ? 'PARTIAL' : 'HIT';
  return {
    outcome,
    ca: primary.ca,
    energy: threatEnergy,
    category: impactCategory(threat.D, iron),
    events,
    bodies,
    outcomes,
    hitEnergyMt,
    segments: (bodies[0] as Body).segments,
    tLastAction: tLast,
    producedFragments,
    usedWarhead,
  };
}

/** Mass of a body from its diameter and the threat's density (helper for the planner). */
export function bodyMass(D: number, rho: number): number {
  return sphereMass(D, rho);
}
