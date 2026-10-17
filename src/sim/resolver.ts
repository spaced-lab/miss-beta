// WHAT: The resolver: from the world and the committed missions, the deterministic outcome of the round.
// WHY:  GAME_PLAN 11. Everything the player sees after COMMIT is a replay of this function's output:
//       the event log, the threat's element segments, the final close approach. It is pure, so the planner
//       can call it to score candidates, Monte Carlo can call it with sampled betas (M3), and MULTIVERSE
//       can fork it (M7).
// HOW:  Missions are applied in arrival order. At each arrival the threat's current elements give its
//       state; if it has drifted more than TERMINAL_GUIDANCE_RANGE from the planned intercept point (an
//       earlier impact moved it) the impactor misses. Otherwise kineticImpact gives dv with a beta drawn
//       from a per-mission stream (hashSeed of seed, round, mission id: order-independent and exact), the
//       new state becomes new elements, and the close approach is re-run at the end.
// LORE: O12 (close approach), D3 (kinetic and beta), G7 (under the hood)

import { KNOBS } from '../config/knobs';
import { closeApproach, impactCategory, impactEnergy, type CloseApproach, type ImpactCategory, type ImpactEnergy } from '../physics/closeApproach';
import { OrbitError, stateToElements } from '../physics/elements';
import { propagate, type Elements } from '../physics/kepler';
import { alongTrack, kineticImpact } from '../physics/kinetic';
import type { EventLog } from './eventLog';
import type { Mission } from './mission';
import { hashSeed, Rng } from './rng';
import { planetById, type World } from './world';

export type Outcome = 'HIT' | 'MISS';

export interface ElementSegment {
  tFrom: number;
  tTo: number;
  elements: Elements;
}

export interface RoundResult {
  outcome: Outcome;
  ca: CloseApproach;
  energy: ImpactEnergy;
  category: ImpactCategory;
  events: EventLog;
  /** Threat elements over time; the last segment runs to +Infinity. */
  segments: ElementSegment[];
  /** Time of the last applied impulse, or the round start if none. */
  tLastAction: number;
}

export interface ResolveOpts {
  /** Override the drawn beta for every impact (planner estimates, Monte Carlo). */
  betaOverride?: number;
}

/** Beta for a mission: deterministic per (run seed, round, mission id). */
export function drawBeta(world: World, missionId: string, type: string): number {
  const range = KNOBS.BETA_RANGE[type] ?? ([2, 4] as const);
  const rng = new Rng(hashSeed(`${world.runSeed}#${world.round}#beta#${missionId}`));
  return rng.float(range[0], range[1]);
}

/** Threat elements valid at time t from a segment list. */
export function elementsAt(segments: readonly ElementSegment[], t: number): Elements {
  for (const s of segments) if (t >= s.tFrom && t < s.tTo) return s.elements;
  const last = segments[segments.length - 1];
  if (!last) throw new Error('elementsAt: no segments');
  return last.elements;
}

export function resolveRound(world: World, missions: readonly Mission[] = [], opts: ResolveOpts = {}): RoundResult {
  const threat = world.threat;
  if (!threat) throw new Error('resolveRound: no threat');
  const home = planetById(world, 'HOME');
  const events: EventLog = [];
  const segments: ElementSegment[] = [{ tFrom: -Infinity, tTo: Infinity, elements: threat.elements }];
  let current = threat.elements;
  let tLast = 0;

  const sorted = [...missions].sort((a, b) => a.arrivalTime - b.arrivalTime);
  for (const m of sorted) {
    events.push({ t: m.launchTime, kind: 'LAUNCH', missionId: m.id, c3: m.c3, massKg: m.impactorKg, tier: m.launcherTier });
    const st = propagate(current, world.star.mu, m.arrivalTime);
    const offset = Math.hypot(st.r.x - m.interceptR.x, st.r.y - m.interceptR.y);
    if (offset > KNOBS.TERMINAL_GUIDANCE_RANGE) {
      events.push({ t: m.arrivalTime, kind: 'IMPACT_MISS', missionId: m.id, offset });
      continue;
    }
    const beta = opts.betaOverride ?? drawBeta(world, m.id, threat.type.id);
    const k = kineticImpact(m.impactorKg, threat.mass, m.arrivalV, st.v, beta);
    const v2 = { x: st.v.x + k.dv.x, y: st.v.y + k.dv.y };
    let next: Elements;
    try {
      next = stateToElements(st.r, v2, world.star.mu, m.arrivalTime);
    } catch (e) {
      if (e instanceof OrbitError) {
        events.push({ t: m.arrivalTime, kind: 'NOTE', text: `${m.id} PUSHED THE TARGET ONTO AN UNBOUND ORBIT (${e.kind}); IGNORED` });
        continue;
      }
      throw e;
    }
    const last = segments[segments.length - 1];
    if (last) last.tTo = m.arrivalTime;
    segments.push({ tFrom: m.arrivalTime, tTo: Infinity, elements: next });
    current = next;
    tLast = m.arrivalTime;
    events.push({ t: m.arrivalTime, kind: 'IMPACT', missionId: m.id, U: k.U, beta, dvAlong: alongTrack(k.dv, st.v), dvTotal: Math.hypot(k.dv.x, k.dv.y), massKg: m.impactorKg });
  }

  const ca = closeApproach(current, home.elements, world.star.mu, home.mu, home.radius, threat.tImpact);
  events.push({ t: ca.tCa, kind: 'CLOSE_APPROACH', dMin: ca.dMin, bCrit: ca.bCrit, marginRadii: ca.marginRadii, impact: ca.impact });
  events.sort((a, b) => a.t - b.t);
  const energy = impactEnergy(threat.D, threat.type.density, ca.vImpact);
  return { outcome: ca.impact ? 'HIT' : 'MISS', ca, energy, category: impactCategory(threat.D, threat.type.id === 'IRON'), events, segments, tLastAction: tLast };
}
