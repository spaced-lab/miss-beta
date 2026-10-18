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
//       M14 phase 2: a threat whose elements carry i and raan (a visitor from another star) is resolved in 3-D
//       through sim/orbit3.ts: the same code, with z parts in the states, kinetic dv, nuclear pushes and
//       Lambert retargets, 3-D close approaches, and along-track pushes run in the orbit's own plane. A planar
//       threat takes exactly the old arithmetic (tests/planarReplay.test.ts).
// LORE: O12 (close approach), D3 (kinetic and beta), D4 (fragmentation), G7 (under the hood)

import { targetCloseApproach, targetOf } from './targets';
import { KNOBS } from '../config/knobs';
import { AU, DAY, YEAR } from '../physics/constants';
import { bCrit as bCritOf, impactCategory, impactEnergy, sphereMass, type CloseApproach, type ImpactCategory, type ImpactEnergy } from '../physics/closeApproach';
import { OrbitError } from '../physics/elements';
import { disrupt, f3D, harmlessDiameter, qStar, specificEnergy } from '../physics/fragment';
import { propagate, type Elements } from '../physics/kepler';
import { fuzeOk, nuclearBurst } from '../physics/nuclear';
import { pushForce, type PushMethod } from '../physics/slowPush';
import { betaAssessDelay } from '../physics/uncertainty';
import { craftState } from '../planner/legs';
import { hasZ, kineticAny, lambertAny, pushArc, stateAt, toElements, vadd, vdiv, vlen, vscale, vsub, type V } from './orbit3';
import { matchingRules, RULE_PRESETS, type Facts, type RuleEvent } from '../planner/rules';
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
  /** Damage energy credited by PI shredding (airbursts), Mt; counts toward the PARTIAL rule. */
  piDamageMt: number;
  /** Bodies bagged by the SCI-FI net (20.3). */
  captured: number;
  /** Threat element segments (the primary body's). */
  segments: ElementSegment[];
  tLastAction: number;
  producedFragments: boolean;
  usedWarhead: boolean;
  /** The missions as actually flown: retargets and deployed sub-impactors included (for drawing and the log). */
  missionsResolved: Mission[];
}

export interface ResolveOpts {
  betaOverride?: number;
  /** Monte Carlo sample index; 0 is the canonical ground truth. */
  sampleSeed?: number;
  /** Tracking tier (6.14): sets how long after an impact its beta is revealed. */
  trackingTier?: number;
  /** SCI-FI standing capabilities (20.3) that act without a flight. */
  scifi?: SciFiOpts;
}

export interface SciFiOpts {
  /** Orbital laser array power, W (0: none), and when it came online (round time). */
  orbitalLaserW: number;
  laserSince: number | null;
  /** Disassembler swarm: M(t) = M0 exp(-(t - since) / tau) on the threat and its remnant. */
  disassemblerTauYears: number;
  disassemblerSince: number | null;
  /** CNT net tier owned (tech NET1/NET2): bodies under NET_CAPTURE_D that would hit are captured instead. */
  netTier: number;
  /** 30: speculative standing capabilities: program completion times (round time) or null when not owned. */
  nanoforgeSince?: number | null;
  thrusterSwarmSince?: number | null;
  shepherdSince?: number | null;
  /** FUSION_TUG_FLEET thrust (N) and completion time. */
  fusionTugN?: number;
  fusionTugSince?: number | null;
  /** GROUND_LASER program completion (round time) or null. */
  groundLaserSince?: number | null;
  /** SAIL_SWARM_DEPOT: pre-accelerated sail impactors on hand (count) and completion time. */
  sailDepot?: number;
  sailDepotSince?: number | null;
  /** SEED_FLEET program completion (round time) or null. */
  seedFleetSince?: number | null;
  /** L4_L5_PICKET and SAIL_KITS program completions (round time) or null. */
  picketSince?: number | null;
  kitsSince?: number | null;
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

/** A standing push waiting to be integrated (resolveRound's applyPushes): along-track acceleration a, m/s^2. */
interface PushReq {
  b: Body;
  tIn: number;
  tOut: number;
  a: number;
  /** Credited as the pieces are integrated, m/s. */
  dv: number;
  missionId: string;
  method: string;
  force: number;
  note: string;
}

export function resolveRound(world: World, missions: readonly Mission[] = [], opts: ResolveOpts = {}): RoundResult {
  const threat = world.threat;
  if (!threat) throw new Error('resolveRound: no threat');
  const home = planetById(world, 'HOME');
  // IDEAS 26: the body this rock is aimed at (HOME unless a site was drawn); close approaches are measured to it.
  const tgt = targetOf(world, threat.targetId);
  const mu = world.star.mu;
  const sample = opts.sampleSeed ?? 0;
  const iron = threat.type.id === 'IRON';
  const material = threat.type.kind === 'comet' ? 'ice' : 'basalt';
  const events: EventLog = [];
  const bodies: Body[] = [
    // NOTE: a sub-metre threat (the DELETE fiction command) is harmless.
    { id: 'THREAT', role: 'THREAT', mass: threat.mass, D: threat.D, tBirth: -Infinity, tDeath: Infinity, segments: [{ tFrom: -Infinity, tTo: Infinity, elements: threat.elements }], harmless: threat.D < 1, escaped: false, vEj: 0 },
  ];
  let tLast = 0;
  let producedFragments = false;
  let usedWarhead = false;
  let fragCounter = 0;
  let piDamageMt = 0;

  /** Replace `target` by a remnant and fragments at time t given the delivered Q and impactor momentum. */
  const disruptBody = (target: Body, current: Elements, st: { r: V; v: V }, m: Mission, Q: number, Qs: number, Uvec: V, mImp: number, t: number): void => {
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
    // A body off the ecliptic (M14): the ejecta cloud stays flat in x-y (the f3D draw below still corrects for
    // the cloud's thickness), and every piece shares the parent's z velocity plus the impactor's share of U_z.
    const three = hasZ(st.v) || hasZ(Uvec);
    const vzAll = (st.v.z ?? 0) + (mImp / (target.mass + mImp)) * (Uvec.z ?? 0);
    const vOf = (f: { v: { x: number; y: number } }): V => (three ? { x: f.v.x, y: f.v.y, z: vzAll } : f.v);
    for (const f of pieces) meanEj += vlen(vsub(vOf(f), st.v));
    meanEj /= Math.max(1, pieces.length);
    for (const f of pieces) {
      const id = f.largestRemnant ? `${target.id === 'THREAT' ? 'REMNANT' : target.id + 'R'}` : `F${++fragCounter}`;
      let el: Elements | null = null;
      try {
        el = toElements(st.r, vOf(f), mu, t, current.e > 1);
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
        vEj: vlen(vsub(vOf(f), st.v)),
      };
      if (body.escaped) escaped++;
      bodies.push(body);
    }
    events.push({ t, kind: 'FRAGMENTATION', missionId: m.id, targetId: target.id, qRatio: Q / Qs, count: pieces.length, largestD: pieces[0]?.D ?? 0, vEj: meanEj, escaped });
  };

  // Working copies: autonomy rewrites targets and legs, and deploys sub-impactors.
  const queue: Mission[] = missions.map((m) => ({ ...m, legs: m.legs ? [...m.legs] : undefined, split: m.split ? { ...m.split } : undefined }) as Mission);
  queue.sort((a, b) => a.arrivalTime - b.arrivalTime);
  const flown: Mission[] = [...queue];
  /** Pending beta assessments: (time, impact details) processed in time order with the missions. */
  const assessments: { t: number; missionId: string; beta: number; targetId: string }[] = [];
  const transferCache = new Map<string, Elements>();

  /** Craft state at time t: legs when present, else the single Lambert coast from HOME. */
  const stateOf = (m: Mission, t: number): { r: V; v: V } | null => {
    if (m.legs) return craftState(m, mu, t);
    let el = transferCache.get(m.id);
    if (!el) {
      const hs = propagate(home.elements, mu, m.launchTime);
      try {
        // NOTE: a departure velocity with a z part (a 3-D target) gives a tilted transfer orbit.
        el = toElements(hs.r, m.departureV, mu, m.launchTime);
      } catch {
        return null;
      }
      transferCache.set(m.id, el);
    }
    const st = stateAt(el, mu, t);
    return { r: st.r, v: st.v };
  };

  /** Live, damaging bodies at time t, with a quick verdict on whether each would hit if left alone. */
  const liveBodies = (t: number): { body: Body; hits: boolean }[] =>
    bodies
      .filter((b) => bodyAlive(b, t) && !b.harmless)
      .map((b) => {
        const el = elementsAt(b.segments, t);
        const ca = targetCloseApproach(el, tgt, mu, threat.tImpact, b.role === 'THREAT' ? {} : { window: KNOBS.FRAG_CA_WINDOW });
        return { body: b, hits: ca.impact };
      });

  /** Re-aim mission m at body b from its state at time t, keeping the arrival time. Returns the dv or null. */
  const retarget = (m: Mission, b: Body, t: number): number | null => {
    const st = stateOf(m, t);
    if (!st) return null;
    const bEl = elementsAt(b.segments, m.arrivalTime);
    const target = stateAt(bEl, mu, m.arrivalTime);
    const sol = lambertAny(st.r, target.r, m.arrivalTime - t, mu);
    if (!sol) return null;
    const dv = vlen(vsub(sol.v1, st.v));
    if (dv > (m.dvBudget ?? 0) - (m.dsmUsed ?? 0) + 1e-9) return null;
    let coastEl: Elements;
    try {
      coastEl = toElements(st.r, sol.v1, mu, t);
    } catch {
      return null;
    }
    const kept = (m.legs ?? []).filter((l) => (l.kind === 'COAST' || l.kind === 'SAIL' ? l.tFrom < t : l.t < t)).map((l) => (l.kind === 'COAST' && l.tTo > t ? { ...l, tTo: t } : l.kind === 'SAIL' && l.tTo > t ? { ...l, tTo: t } : l));
    if (!m.legs) {
      const el0 = transferCache.get(m.id);
      if (el0) kept.push({ kind: 'COAST', tFrom: m.launchTime, tTo: t, elements: el0 });
    }
    m.legs = [...kept, { kind: 'DSM', t, dv }, { kind: 'COAST', tFrom: t, tTo: m.arrivalTime, elements: coastEl }];
    m.targetId = b.id;
    m.interceptR = target.r;
    m.arrivalV = sol.v2;
    m.U = vlen(vsub(sol.v2, target.v));
    m.dsmUsed = (m.dsmUsed ?? 0) + dv;
    return dv;
  };

  /** Desirability of a body for an impactor: hitting bodies first, then mass. */
  const desirability = (x: { body: Body; hits: boolean }): number => (x.hits ? 1 : 0.2) * x.body.mass;

  /** Deploy m's sub-impactors at time t: k new missions of mass m/k, assigned to bodies (distinct when possible). */
  const deploySubs = (m: Mission, t: number, live: { body: Body; hits: boolean }[]): void => {
    if (!m.split || m.split.deployed) return;
    m.split.deployed = true;
    const k = m.split.count;
    const ranked = [...live].sort((a, b) => desirability(b) - desirability(a));
    const subs: Mission[] = [];
    for (let i = 0; i < k; i++) {
      const sub: Mission = { ...m, id: `${m.id}-${String.fromCharCode(65 + i)}`, impactorKg: m.impactorKg / k, dvBudget: m.split.dvEach, dsmUsed: 0, parentId: m.id, autonomyTier: 0 };
      delete sub.split;
      if (m.legs) sub.legs = [...m.legs];
      else delete sub.legs;
      // Distinct targets first, then wrap around; a sub that cannot reach its pick keeps the carrier's aim.
      const pick = ranked.length > 0 ? ranked[i % ranked.length] : null;
      if (pick && pick.body.id !== sub.targetId) {
        const dv = retarget(sub, pick.body, t);
        if (dv === null) {
          const cur = ranked.find((x) => x.body.id === (m.targetId ?? 'THREAT'));
          if (cur) retarget(sub, cur.body, t);
        }
      } else if (!sub.legs) {
        const el0 = transferCache.get(m.id);
        if (el0) sub.legs = [{ kind: 'COAST', tFrom: m.launchTime, tTo: m.arrivalTime, elements: el0 }];
      }
      subs.push(sub);
    }
    // The carrier is spent; its subs join the queue in arrival order.
    const idx = queue.indexOf(m);
    if (idx >= 0) queue.splice(idx, 1);
    const fi = flown.indexOf(m);
    if (fi >= 0) flown.splice(fi, 1);
    for (const sub of subs) {
      queue.push(sub);
      flown.push(sub);
    }
    queue.sort((a, b) => a.arrivalTime - b.arrivalTime);
    events.push({ t, kind: 'SPLIT', missionId: m.id, count: k, targets: subs.map((x) => x.targetId ?? 'THREAT') });
  };

  /** Run autonomy for every in-flight mission after an event at time t. */
  const autonomy = (t: number, when: RuleEvent, facts: Facts): void => {
    const live = liveBodies(t);
    if (live.length === 0) return;
    const inFlight = queue.filter((m) => m.launchTime <= t && m.arrivalTime - t >= KNOBS.AUTONOMY_MIN_LEAD && !m.warhead && !m.push);
    // Tier 3: joint greedy assignment, one body per craft while bodies last, by desirability.
    const tier3 = inFlight.filter((m) => (m.autonomyTier ?? 0) >= 3);
    if (tier3.length > 0) {
      const ranked = [...live].sort((a, b) => desirability(b) - desirability(a));
      const free = new Set(tier3);
      for (const x of ranked) {
        if (free.size === 0) break;
        let best: Mission | null = null;
        let bestDv = Infinity;
        for (const m of free) {
          if (m.targetId === x.body.id) {
            best = m;
            bestDv = 0;
            break;
          }
          const st = stateOf(m, t);
          if (!st) continue;
          const tgt = stateAt(elementsAt(x.body.segments, m.arrivalTime), mu, m.arrivalTime);
          const sol = lambertAny(st.r, tgt.r, m.arrivalTime - t, mu);
          if (!sol) continue;
          const dv = vlen(vsub(sol.v1, st.v));
          if (dv <= (m.dvBudget ?? 0) - (m.dsmUsed ?? 0) && dv < bestDv) {
            best = m;
            bestDv = dv;
          }
        }
        if (best) {
          if (bestDv > 0) {
            const dv = retarget(best, x.body, t);
            if (dv !== null) events.push({ t, kind: 'RETARGET', missionId: best.id, targetId: x.body.id, dv, remaining: (best.dvBudget ?? 0) - (best.dsmUsed ?? 0) });
          }
          free.delete(best);
        }
      }
    }
    for (const m of inFlight) {
      const tier = m.autonomyTier ?? 0;
      if (tier >= 3) {
        if (m.split && !m.split.deployed && when === 'FRAGMENTATION') deploySubs(m, t, live);
        continue;
      }
      const targetAlive = live.some((x) => x.body.id === (m.targetId ?? 'THREAT'));
      let wantRetarget = false;
      let wantDeploy = false;
      let targetMode: 'MAX(P_HIT * MASS)' | 'MAX(MASS)' | 'PRIMARY' = 'MAX(P_HIT * MASS)';
      let deployCount = m.split?.count ?? 0;
      if (tier >= 2) {
        wantRetarget = !targetAlive || when === 'FRAGMENTATION';
        wantDeploy = when === 'FRAGMENTATION';
      } else if (tier === 1) {
        for (const r of matchingRules(m.rules ?? RULE_PRESETS['DEFAULT'] ?? [], when, { ...facts, remaining_dv: (m.dvBudget ?? 0) - (m.dsmUsed ?? 0) })) {
          if (r.do === 'RETARGET') {
            wantRetarget = true;
            targetMode = r.target ?? 'MAX(P_HIT * MASS)';
          }
          if (r.do === 'DEPLOY_SUBIMPACTORS') {
            wantDeploy = true;
            deployCount = Math.min(m.split?.count ?? 0, r.count ?? 3);
          }
          if (r.do === 'HOLD') {
            wantRetarget = false;
            wantDeploy = false;
            break;
          }
        }
      }
      if (wantDeploy && m.split && !m.split.deployed && deployCount > 0) {
        m.split.count = deployCount;
        deploySubs(m, t, live);
        continue;
      }
      if (!wantRetarget) continue;
      const ranked = [...live].sort((a, b) => (targetMode === 'MAX(MASS)' ? b.body.mass - a.body.mass : desirability(b) - desirability(a)));
      const pick = targetMode === 'PRIMARY' ? live.find((x) => x.body.role !== 'FRAGMENT') ?? ranked[0] : ranked[0];
      if (!pick || pick.body.id === (m.targetId ?? 'THREAT')) continue;
      const dv = retarget(m, pick.body, t);
      if (dv !== null) events.push({ t, kind: 'RETARGET', missionId: m.id, targetId: pick.body.id, dv, remaining: (m.dvBudget ?? 0) - (m.dsmUsed ?? 0) });
    }
  };

  /** Predicted miss of the primary at time t, planet radii (for rule facts). */
  const predictedMargin = (t: number): number => {
    const primary = bodies.find((b) => (b.role === 'THREAT' || b.role === 'REMNANT') && bodyAlive(b, t));
    if (!primary) return 0;
    return targetCloseApproach(elementsAt(primary.segments, t), tgt, mu, threat.tImpact).marginRadii;
  };

  /** Process pending assessments and default sub-impactor deployments up to time t. */
  const settleBefore = (t: number): void => {
    assessments.sort((a, b) => a.t - b.t);
    while (assessments.length > 0 && (assessments[0] as { t: number }).t <= t) {
      const a = assessments.shift()!;
      const margin = predictedMargin(a.t);
      events.push({ t: a.t, kind: 'BETA_ASSESSED', missionId: a.missionId, beta: a.beta, marginRadii: margin });
      autonomy(a.t, 'BETA_ASSESSED', { beta: a.beta, 'predicted.miss_radii': margin, 'fragments.count': liveBodies(a.t).length });
      autonomy(a.t, 'MISS_PREDICTED', { beta: a.beta, 'predicted.miss_radii': margin, 'fragments.count': liveBodies(a.t).length });
    }
    // Carriers that never deployed split at the default lead so their subs can spread over fragments.
    for (const m of [...queue]) {
      if (m.split && !m.split.deployed && (m.autonomyTier ?? 0) >= 2 && m.arrivalTime - KNOBS.SPLIT_DEFAULT_LEAD <= t && m.launchTime <= t) deploySubs(m, m.arrivalTime - KNOBS.SPLIT_DEFAULT_LEAD, liveBodies(m.arrivalTime - KNOBS.SPLIT_DEFAULT_LEAD));
    }
  };

  for (let qi = 0; qi < queue.length; qi++) {
    const m = queue[qi] as Mission;
    settleBefore(m.arrivalTime);
    // settleBefore may have re-ordered or replaced the queue (sub-impactors): re-fetch.
    const cur = queue[qi];
    if (cur !== m) {
      qi--;
      continue;
    }
    if (!m.parentId) events.push({ t: m.launchTime, kind: 'LAUNCH', missionId: m.id, c3: m.c3, massKg: m.impactorKg, tier: m.launcherTier });
    const targetId = m.targetId ?? 'THREAT';
    const target = bodies.find((b) => b.id === targetId && bodyAlive(b, m.arrivalTime));
    if (!target) {
      events.push({ t: m.arrivalTime, kind: 'IMPACT_MISS', missionId: m.id, offset: 0, reason: 'TARGET GONE' });
      continue;
    }
    const current = elementsAt(target.segments, m.arrivalTime);
    const st = stateAt(current, mu, m.arrivalTime);
    // NOTE: for a body off the ecliptic the offset is 3-D: a plan aimed at a planar point misses by the height.
    const offset = vlen(vsub(st.r, m.interceptR));
    if (offset > KNOBS.TERMINAL_GUIDANCE_RANGE) {
      events.push({ t: m.arrivalTime, kind: 'IMPACT_MISS', missionId: m.id, offset });
      continue;
    }
    const R = target.D / 2;
    const Qs = qStar(R, threat.type.density, threat.type.strengthMult, material);

    if (m.archetype === 'PI') {
      // PI (20.2): shred a small body into pieces that airburst high; damage is a fraction of its energy.
      const D = target.D;
      if (D > KNOBS.PI_MAX_D) {
        events.push({ t: m.arrivalTime, kind: 'PI', missionId: m.id, targetId: target.id, D, damageMt: 0, ok: false, reason: `BODY OVER ${KNOBS.PI_MAX_D} M` });
        continue;
      }
      const caNow = targetCloseApproach(current, tgt, mu, threat.tImpact, target.role === 'THREAT' ? {} : { window: KNOBS.FRAG_CA_WINDOW });
      const energy = impactEnergy(D, threat.type.density, caNow.vImpact).energyMt;
      const damage = caNow.impact ? KNOBS.PI_DAMAGE_FRACTION * energy : 0;
      piDamageMt += damage;
      target.tDeath = m.arrivalTime;
      const lastSeg = target.segments[target.segments.length - 1];
      if (lastSeg) lastSeg.tTo = m.arrivalTime;
      tLast = m.arrivalTime;
      producedFragments = true;
      events.push({ t: m.arrivalTime, kind: 'PI', missionId: m.id, targetId: target.id, D, damageMt: damage, ok: true, reason: '' });
      continue;
    }

    if (m.push) {
      // Slow push (6.12): the craft has rendezvoused (the planner paid the mismatch); push along track for tau.
      const tEnd = Math.min(m.arrivalTime + m.push.tauMax, threat.tImpact - KNOBS.PUSH_END_MARGIN);
      const rNow = vlen(st.r);
      const pf = pushForce({ method: m.push.method as PushMethod, tier: m.push.tier }, target.mass, target.D / 2, rNow, iron);
      if (!pf.viable || pf.force <= 0 || tEnd <= m.arrivalTime) {
        events.push({ t: m.arrivalTime, kind: 'PUSH', missionId: m.id, targetId: target.id, method: m.push.method, force: pf.force, dv: 0, duration: 0, viable: false, note: pf.note });
        continue;
      }
      const a = (m.push.sign * pf.force) / target.mass;
      let arc;
      try {
        arc = pushArc(current, mu, m.arrivalTime, tEnd, a);
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
      const rel = vsub(m.arrivalV, st.v);
      const U = vlen(rel);
      const fuzed = m.warhead.mode !== 'STANDOFF' || fuzeOk(U, m.warhead.tier);
      if (!fuzed) {
        events.push({ t: m.arrivalTime, kind: 'NUKE', missionId: m.id, targetId: target.id, mode: m.warhead.mode, yieldMt: m.warhead.yieldMt, dv: 0, qRatio: 0, fuzed: false, pulses: m.warhead.pulses });
        continue;
      }
      const u = vdiv(rel, U || 1);
      let v: V = st.v;
      let dvSum = 0;
      let qSum = 0;
      let disrupted = false;
      for (let pulse = 0; pulse < Math.max(1, m.warhead.pulses); pulse++) {
        const nb = nuclearBurst(m.warhead.yieldMt, m.warhead.mode, target.mass, R, KNOBS.NUKE_STANDOFF_H_FRAC * R);
        dvSum += nb.dv;
        qSum += nb.Q;
        v = vadd(v, vscale(u, nb.dv));
        if (qSum >= Qs) {
          disrupted = true;
          break;
        }
      }
      events.push({ t: m.arrivalTime, kind: 'NUKE', missionId: m.id, targetId: target.id, mode: m.warhead.mode, yieldMt: m.warhead.yieldMt, dv: dvSum, qRatio: qSum / Qs, fuzed: true, pulses: m.warhead.pulses });
      if (disrupted) {
        // The burst's momentum enters through the ejecta; the fragments carry the standoff push too.
        disruptBody(target, current, { r: st.r, v }, m, qSum, Qs, vscale(u, dvSum), 0, m.arrivalTime);
        autonomy(m.arrivalTime, 'FRAGMENTATION', { 'fragments.count': liveBodies(m.arrivalTime).length, 'predicted.miss_radii': predictedMargin(m.arrivalTime) });
        continue;
      }
      let next: Elements;
      try {
        next = toElements(st.r, v, mu, m.arrivalTime, current.e > 1);
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
    const k = kineticAny(m.impactorKg, target.mass, m.arrivalV, st.v, beta);
    const Q = specificEnergy(m.impactorKg, target.mass, k.U);

    if (Q < Qs) {
      // Cratering: an impulse, new elements, same body.
      const v2 = vadd(st.v, k.dv);
      let next: Elements;
      try {
        next = toElements(st.r, v2, mu, m.arrivalTime, current.e > 1);
      } catch (e) {
        if (!(e instanceof OrbitError)) throw e;
        events.push({ t: m.arrivalTime, kind: 'NOTE', text: `${m.id} PUSHED ${target.id} ONTO AN UNBOUND ORBIT; IGNORED` });
        continue;
      }
      const last = target.segments[target.segments.length - 1];
      if (last) last.tTo = m.arrivalTime;
      target.segments.push({ tFrom: m.arrivalTime, tTo: Infinity, elements: next });
      tLast = m.arrivalTime;
      const knownAt = m.arrivalTime + betaAssessDelay(opts.trackingTier ?? 0);
      events.push({ t: m.arrivalTime, kind: 'IMPACT', missionId: m.id, U: k.U, beta, dvAlong: k.along, dvTotal: vlen(k.dv), massKg: m.impactorKg, targetId: target.id, qRatio: Q / Qs, betaKnownAt: knownAt });
      assessments.push({ t: knownAt, missionId: m.id, beta, targetId: target.id });
      continue;
    }

    // Disruption: the body dies; a remnant and fragments are born; in-flight autonomy reacts.
    disruptBody(target, current, st, m, Q, Qs, vsub(m.arrivalV, st.v), m.impactorKg, m.arrivalTime);
    autonomy(m.arrivalTime, 'FRAGMENTATION', { 'fragments.count': liveBodies(m.arrivalTime).length, 'predicted.miss_radii': predictedMargin(m.arrivalTime) });
  }
  settleBefore(Infinity);

  // SCI-FI standing capabilities (20.3): they act on whatever is left, without a flight.
  const sf = opts.scifi;
  let captured = 0;
  if (sf && sf.disassemblerSince !== null && sf.disassemblerTauYears > 0) {
    const tau = sf.disassemblerTauYears * YEAR;
    for (const b of bodies) {
      if (b.escaped || b.tDeath !== Infinity || b.harmless || b.role === 'FRAGMENT') continue;
      const since = Math.max(sf.disassemblerSince, b.tBirth === -Infinity ? 0 : b.tBirth);
      const dt = threat.tImpact - since;
      if (dt <= 0) continue;
      const f = Math.exp(-dt / tau);
      const m0 = b.mass;
      b.mass *= f;
      b.D *= Math.cbrt(f);
      b.harmless = b.D < harmlessDiameter(iron);
      events.push({ t: since, kind: 'NOTE', text: `DISASSEMBLER SWARM ON ${b.id}: ${m0.toExponential(2)} KG -> ${b.mass.toExponential(2)} KG BY T-0 (TAU ${sf.disassemblerTauYears} YR)${b.harmless ? '; DUST' : ''}` });
    }
  }
  const laserWindows = (powerW: number, rangeAu: number, since: number, label: string, method: string, endMargin: number): void => {
    // DE-STAR: ablation thrust C_m P on every damaging body while it is within DE_STAR_RANGE_AU of HOME.
    const range = rangeAu * AU;
    // The array fires until the last day: at 20 km/s the body is only inside 0.3 AU for the final ~25 days.
    const tEnd = threat.tImpact - endMargin;
    for (const b of bodies) {
      if (b.escaped || b.tDeath !== Infinity || b.harmless) continue;
      let el = elementsAt(b.segments, Infinity);
      // NOTE: never before the body's open segment: a second array (GROUND after DE-STAR) used to start from `since`
      // again, rewrite a later segment's end to an earlier time and push from the wrong orbit (code review 2026-10-18).
      let t = Math.max(since, b.tBirth === -Infinity ? since : b.tBirth, tLast, b.segments[b.segments.length - 1]?.tFrom ?? -Infinity);
      const inRange = (tt: number): boolean => {
        const a = stateAt(el, mu, tt);
        const h = propagate(home.elements, mu, tt);
        return vlen(vsub(a.r, h.r)) < range;
      };
      // Each pass through the range is one firing window; the body coasts on the pushed orbit between them.
      for (let windows = 0; windows < 8 && t < tEnd; ) {
        while (t < tEnd && !inRange(t)) t += DAY;
        if (t >= tEnd) break;
        const tIn = t;
        while (t < tEnd && inRange(t)) t += DAY;
        const tOut = Math.min(t, tEnd);
        if (tOut - tIn < DAY) continue;
        const force = KNOBS.LASER_CM_N_PER_W * powerW;
        try {
          const arc = pushArc(el, mu, tIn, tOut, force / b.mass);
          const lastSeg = b.segments[b.segments.length - 1];
          if (lastSeg) lastSeg.tTo = tIn;
          b.segments.push({ tFrom: tIn, tTo: tOut, elements: el });
          b.segments.push({ tFrom: tOut, tTo: Infinity, elements: arc.elements });
          el = arc.elements;
          windows++;
          events.push({ t: tIn, kind: 'PUSH', missionId: label, targetId: b.id, method, force, dv: arc.dv, duration: tOut - tIn, viable: true, note: `${(powerW / 1e9).toFixed(1)} GW ARRAY, IN RANGE (${KNOBS.DE_STAR_RANGE_AU} AU)` });
        } catch (e) {
          if (!(e instanceof OrbitError)) throw e;
          events.push({ t: tIn, kind: 'NOTE', text: `${label} PUSHED ${b.id} ONTO AN UNBOUND ORBIT; IGNORED` });
          break;
        }
      }
    }
  };

  if (sf && sf.orbitalLaserW > 0 && sf.laserSince !== null) laserWindows(sf.orbitalLaserW, KNOBS.DE_STAR_RANGE_AU, sf.laserSince, 'DE-STAR', 'DE_STAR', KNOBS.DE_STAR_END_MARGIN);
  // GROUND_LASER (19, Phipps): the same windows from the ground, only inside 0.05 AU, through the atmosphere.
  if (sf && sf.groundLaserSince !== null && sf.groundLaserSince !== undefined) laserWindows(KNOBS.GROUND_LASER_POWER_W * KNOBS.GROUND_LASER_ATM_EFF, KNOBS.GROUND_LASER_RANGE_AU, sf.groundLaserSince, 'GROUND-LASER', 'GROUND_LASER', KNOBS.DE_STAR_END_MARGIN);

  /**
   * Integrate a body's standing pushes in time order. Between consecutive start and end times the active pushes'
   * along-track accelerations add (superposition, all along-track), so one pushArc per piece; each push is credited
   * its share of each piece's dv. Nothing starts before the body's open segment (laser windows may have written the
   * earlier ones): a push that would is moved to start there, keeping its length up to the end margin.
   * Example: one push alone is one piece, the same pushArc call as applying it directly.
   */
  const applyPushes = (b: Body, rs: PushReq[], tEnd: number): void => {
    if (rs.length === 0) return;
    const open = b.segments[b.segments.length - 1]?.tFrom ?? -Infinity;
    const live: PushReq[] = [];
    for (const r of rs) {
      if (r.tIn < open) {
        const len = r.tOut - r.tIn;
        r.tIn = open;
        r.tOut = Math.min(tEnd, open + len);
      }
      if (r.tOut - r.tIn < 3600) events.push({ t: r.tIn, kind: 'NOTE', text: `${r.missionId} FOUND NO TIME LEFT ON ${b.id}; NOT APPLIED` });
      else live.push(r);
    }
    const cuts = [...new Set(live.flatMap((r) => [r.tIn, r.tOut]))].sort((x, y) => x - y);
    let el = elementsAt(b.segments, Infinity);
    for (let i = 0; i + 1 < cuts.length; i++) {
      const p = cuts[i] as number;
      const q = cuts[i + 1] as number;
      const active = live.filter((r) => r.tIn <= p && r.tOut >= q);
      if (active.length === 0) continue;
      const aSum = active.reduce((acc, r) => acc + r.a, 0);
      try {
        const arc = pushArc(el, mu, p, q, aSum);
        const lastSeg = b.segments[b.segments.length - 1];
        if (lastSeg) lastSeg.tTo = p;
        b.segments.push({ tFrom: p, tTo: q, elements: el });
        b.segments.push({ tFrom: q, tTo: Infinity, elements: arc.elements });
        el = arc.elements;
        for (const r of active) r.dv += arc.dv * (r.a / aSum);
      } catch (e) {
        if (!(e instanceof OrbitError)) throw e;
        for (const r of live.filter((x) => x.tOut > p)) events.push({ t: Math.max(p, r.tIn), kind: 'NOTE', text: `${r.missionId} PUSHED ${b.id} ONTO AN UNBOUND ORBIT; IGNORED` });
        for (const r of live) if (r.tOut > p) r.tOut = -Infinity;
        break;
      }
    }
    for (const r of live) if (r.tOut !== -Infinity) events.push({ t: r.tIn, kind: 'PUSH', missionId: r.missionId, targetId: b.id, method: r.method, force: r.force, dv: r.dv, duration: r.tOut - r.tIn, viable: true, note: r.note });
  };

  // 30: speculative standing pushes (SCI-FI): each acts on the threat or its largest remnant from a start time
  // to the push end margin with a constant force, like DE-STAR's windows but without a range limit.
  // NOTE: the pushes are first collected, then integrated per body in time order: where they overlap their
  // along-track accelerations add, piece by piece between start and end times (applyPushes). Applying them one by
  // one in code order let a later-coded push start before an earlier one ended, so a segment ran backwards and the
  // push started from an orbit that only held later (code review 2026-10-18).
  if (sf) {
    const tEnd = threat.tImpact - KNOBS.PUSH_END_MARGIN;
    const reqs: PushReq[] = [];
    const standing = (label: string, method: string, since: number | null | undefined, delay: number, force: (b: Body) => number, duration?: number): void => {
      if (since === null || since === undefined) return;
      for (const b of bodies) {
        if (b.escaped || b.tDeath !== Infinity || b.harmless || b.role === 'FRAGMENT') continue;
        const tIn = Math.max(since, b.tBirth === -Infinity ? 0 : b.tBirth, tLast, 0) + delay;
        const tOut = Math.min(tEnd, duration !== undefined ? tIn + duration : tEnd);
        if (tOut - tIn < 3600) continue;
        const F = force(b);
        reqs.push({ b, tIn, tOut, a: F / b.mass, dv: 0, missionId: label, method, force: F, note: label });
      }
    };
    // NANOFORGE: the rock is its own propellant. It runs until NANOFORGE_MAX_EAT of the body is thrown away (or the
    // push window ends); the push is the rocket equation dv = v_e ln(M0 / M1), delivered as its average acceleration.
    if (sf.nanoforgeSince !== null && sf.nanoforgeSince !== undefined) {
      for (const b of bodies) {
        if (b.escaped || b.tDeath !== Infinity || b.harmless || b.role === 'FRAGMENT') continue;
        const tIn = Math.max(sf.nanoforgeSince, b.tBirth === -Infinity ? 0 : b.tBirth, tLast, 0) + KNOBS.NANOFORGE_GROW_DAYS;
        const tOut = Math.min(tEnd, tIn + (KNOBS.NANOFORGE_MAX_EAT * b.mass) / KNOBS.NANOFORGE_MDOT);
        if (tOut - tIn < 3600) continue;
        const m0 = b.mass;
        const m1 = m0 - KNOBS.NANOFORGE_MDOT * (tOut - tIn);
        const dv = KNOBS.NANOFORGE_VE * Math.log(m0 / m1);
        reqs.push({ b, tIn, tOut, a: dv / (tOut - tIn), dv: 0, missionId: 'NANOFORGE', method: 'NANOFORGE', force: KNOBS.NANOFORGE_MDOT * KNOBS.NANOFORGE_VE, note: `ATE ${((1 - m1 / m0) * 100).toFixed(0)}% OF THE BODY` });
        b.mass = m1;
        b.D *= Math.cbrt(m1 / m0);
        b.harmless = b.D < harmlessDiameter(iron);
      }
    }
    standing('THRUSTER-SWARM', 'THRUSTER_SWARM', sf.thrusterSwarmSince, KNOBS.THRUSTER_TRANSIT, () => KNOBS.THRUSTER_ETA * KNOBS.THRUSTER_SWARM_N * KNOBS.THRUSTER_UNIT_N);
    if ((sf.fusionTugN ?? 0) > 0) standing('FUSION-TUG', 'FUSION_TUG', sf.fusionTugSince, KNOBS.FUSION_TUG_TRANSIT, () => sf.fusionTugN ?? 0);
    // The shepherd rock: one kinetic hit, delivered as a one-hour push of the same impulse.
    // SAIL_SWARM_DEPOT: the parked sails strike together 60 days in, each SAIL_DEPOT_KG at SAIL_DEPOT_U, beta SAIL_DEPOT_BETA.
    if ((sf.sailDepot ?? 0) > 0) standing('SAIL-DEPOT', 'SAIL_DEPOT', sf.sailDepotSince, KNOBS.SAIL_DEPOT_DELAY, () => ((sf.sailDepot ?? 0) * KNOBS.SAIL_DEPOT_BETA * KNOBS.SAIL_DEPOT_KG * KNOBS.SAIL_DEPOT_U) / 3600, 3600);
    // SEED FLEET: one strike per doubling time after arrival; strike k throws 2^k shepherd rocks (capped).
    if (sf.seedFleetSince !== null && sf.seedFleetSince !== undefined) {
      for (let k = 0; k < 12; k++) {
        const delay = KNOBS.SEED_FLEET_DELAY + k * KNOBS.SEED_FLEET_DOUBLING;
        if (Math.max(sf.seedFleetSince, 0) + delay > tEnd) break;
        const rocks = Math.min(KNOBS.SEED_FLEET_MAX, 2 ** k);
        standing(`SEED-FLEET X${rocks}`, 'SEED_FLEET', sf.seedFleetSince, delay, () => (rocks * KNOBS.SHEPHERD_BETA * KNOBS.SHEPHERD_KG * KNOBS.SHEPHERD_U) / 3600, 3600);
      }
    }
    standing('SHEPHERD', 'SHEPHERD', sf.shepherdSince, KNOBS.SHEPHERD_DELAY, () => (KNOBS.SHEPHERD_BETA * KNOBS.SHEPHERD_KG * KNOBS.SHEPHERD_U) / 3600, 3600);
    // L4/L5 PICKET: two parked impactors, one from each point, delivered together as a one-hour impulse.
    standing('PICKET L4+L5', 'PICKET', sf.picketSince, KNOBS.PICKET_DELAY, () => (2 * KNOBS.PICKET_BETA * KNOBS.PICKET_KG * KNOBS.PICKET_U) / 3600, 3600);
    // SAIL KITS: sails tethered to the rock pull on sunlight for the rest of the round (force taken at 1 AU).
    standing(`SAIL KITS X${KNOBS.KIT_COUNT}`, 'SAIL_KIT', sf.kitsSince, KNOBS.KIT_TRANSIT, () => KNOBS.KIT_COUNT * KNOBS.KIT_EFF * 2 * 4.56e-6 * KNOBS.KIT_AREA);
    for (const b of bodies) applyPushes(b, reqs.filter((r) => r.b === b), tEnd);
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
    const ca = targetCloseApproach(el, tgt, mu, threat.tImpact, isFrag ? { window: KNOBS.FRAG_CA_WINDOW } : {});
    let hits = ca.impact && !b.harmless;
    if (hits && isFrag && b.vEj > 0) {
      const p = f3D(bCritOf(tgt.mu, tgt.radius, ca.vInf), b.vEj, Math.max(0, threat.tImpact - b.tBirth));
      hits = draw.chance(p);
    }
    if (hits && sf && sf.netTier >= 1 && b.D < KNOBS.NET_CAPTURE_D) {
      // CNT net capture (20.3): a small body on a hit course is bagged on the way in.
      hits = false;
      captured++;
      events.push({ t: ca.tCa - DAY, kind: 'NOTE', text: `${b.id} (${b.D.toFixed(0)} M) CAPTURED BY THE CNT NET TUG; COUNTS AS RESOLVED` });
    }
    const energyMt = hits ? impactEnergy(b.D, threat.type.density, ca.vImpact).energyMt : 0;
    hitEnergyMt += energyMt;
    const bo = { body: b, ca, hits, energyMt };
    outcomes.push(bo);
    if (b.role === 'THREAT' || b.role === 'REMNANT') primary = bo;
    events.push({ t: ca.tCa, kind: 'CLOSE_APPROACH', bodyId: b.id, dMin: ca.dMin, bCrit: ca.bCrit, marginRadii: ca.marginRadii, impact: hits });
  }
  events.sort((a, b) => a.t - b.t);
  if (!primary || !primary.ca) {
    // Every damaging body was shredded (PI) before the approach: the round resolves on the original orbit's numbers.
    const ca0 = targetCloseApproach(threat.elements, tgt, mu, threat.tImpact);
    const e0 = impactEnergy(threat.D, threat.type.density, ca0.vImpact);
    const total = hitEnergyMt + piDamageMt;
    const outcome0: Outcome = total <= 0 ? 'MISS' : total < KNOBS.PARTIAL_ENERGY_FRACTION * e0.energyMt ? 'PARTIAL' : 'HIT';
    return { outcome: outcome0, ca: ca0, energy: e0, category: impactCategory(threat.D, iron), events, bodies, outcomes, hitEnergyMt: total, piDamageMt, captured, segments: (bodies[0] as Body).segments, tLastAction: tLast, producedFragments, usedWarhead, missionsResolved: flown };
  }

  const pca = primary.ca;
  const threatEnergy = impactEnergy(threat.D, threat.type.density, pca.vImpact);
  const totalThrough = hitEnergyMt + piDamageMt;
  const outcome: Outcome = totalThrough <= 0 ? 'MISS' : totalThrough < KNOBS.PARTIAL_ENERGY_FRACTION * threatEnergy.energyMt ? 'PARTIAL' : 'HIT';
  return {
    outcome,
    ca: pca,
    energy: threatEnergy,
    category: impactCategory(threat.D, iron),
    events,
    bodies,
    outcomes,
    hitEnergyMt: totalThrough,
    piDamageMt,
    captured,
    segments: (bodies[0] as Body).segments,
    tLastAction: tLast,
    producedFragments,
    usedWarhead,
    missionsResolved: flown,
  };
}

/** Mass of a body from its diameter and the threat's density (helper for the planner). */
export function bodyMass(D: number, rho: number): number {
  return sphereMass(D, rho);
}
