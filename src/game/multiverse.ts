// WHAT: MULTIVERSE (GAME_PLAN 21.4): the round forked into n branches that resolve on a shared clock.
// WHY:  The resolver is pure and deterministic, so a branch is just a World copy with its own sample stream
//       and mission list; render budget is the only cost. End of round: survival fraction, then COLLAPSE
//       picks the branch that becomes the main timeline.
// HOW:  Branch i uses sampleSeed i + 1 for its beta and fragment draws (variant: different draws) and starts
//       with a deep copy of the committed missions (variant: different plans, since each branch can commit
//       its own). A WORMHOLE moves the selected branch's threat into a sibling (the sibling now faces two
//       bodies; this one faces none).
// LORE: G6 (modes), O14 (randomness and probability)

import type { Mission } from '../sim/mission';
import { resolveRound, type ResolveOpts, type RoundResult } from '../sim/resolver';
import type { Threat } from '../sim/threat';
import type { World } from '../sim/world';

export interface Branch {
  index: number;
  world: World;
  missions: Mission[];
  result: RoundResult;
  sampleSeed: number;
  /** Second threat delivered by a wormhole, if any (resolved separately). */
  extraThreat: Threat | null;
  extraResult: RoundResult | null;
  /** True once this branch's own threat has left through a wormhole (its threat is then a stand-in). */
  routedAway?: boolean;
}

export interface Multiverse {
  branches: Branch[];
  selected: number;
}

function cloneWorld(w: World): World {
  return {
    ...w,
    planets: w.planets.map((p) => ({ ...p, elements: { ...p.elements } })),
    threat: w.threat ? { ...w.threat, elements: { ...w.threat.elements } } : null,
    networks: { active: [...w.networks.active], since: { ...w.networks.since } },
  };
}

export function forkMultiverse(world: World, missions: readonly Mission[], n: number, opts: ResolveOpts = {}): Multiverse {
  const branches: Branch[] = [];
  for (let i = 0; i < n; i++) {
    const w = cloneWorld(world);
    const ms = missions.map((m) => ({ ...m }));
    branches.push({ index: i, world: w, missions: ms, result: resolveRound(w, ms, { ...opts, sampleSeed: i + 1 }), sampleSeed: i + 1, extraThreat: null, extraResult: null });
  }
  return { branches, selected: 0 };
}

/** Re-resolve one branch (after a commit or a wormhole). */
export function resolveBranch(b: Branch, opts: ResolveOpts = {}): void {
  b.result = resolveRound(b.world, b.missions, { ...opts, sampleSeed: b.sampleSeed });
  if (b.extraThreat) {
    const w2 = { ...b.world, threat: b.extraThreat };
    b.extraResult = resolveRound(w2, [], { ...opts, sampleSeed: b.sampleSeed + 100 });
  } else b.extraResult = null;
}

/** Advance every branch's clock together. */
export function tickMultiverse(mv: Multiverse, dt: number): void {
  for (const b of mv.branches) b.world.t += dt;
}

/** A branch survives if neither its own threat nor a wormholed one hits. */
export function branchSurvives(b: Branch): boolean {
  const own = b.result.outcome !== 'HIT';
  const extra = !b.extraResult || b.extraResult.outcome !== 'HIT';
  return own && extra;
}

export function survivalFraction(mv: Multiverse): number {
  const n = mv.branches.length;
  return n === 0 ? 0 : mv.branches.filter(branchSurvives).length / n;
}

/** Earliest close-approach time across branches: the round ends when the shared clock reaches it. */
export function earliestEnd(mv: Multiverse): number {
  return Math.min(...mv.branches.map((b) => Math.min(b.result.ca.tCa, b.extraResult?.ca.tCa ?? Infinity)));
}

/** WORMHOLE: the selected branch's threat leaves for the next sibling; it is deleted here. */
export function wormhole(mv: Multiverse, opts: ResolveOpts = {}): string {
  const from = mv.branches[mv.selected];
  if (!from || mv.branches.length < 2 || !from.world.threat || from.routedAway) return 'NOTHING TO ROUTE.';
  const to = mv.branches[(mv.selected + 1) % mv.branches.length] as Branch;
  // NOTE: a branch carries at most one wormholed threat; a second would overwrite the first and erase it.
  if (to.extraThreat) return `BRANCH ${to.index + 1} ALREADY CARRIES A ROUTED THREAT.`;
  const th = from.world.threat;
  to.extraThreat = { ...th, elements: { ...th.elements } };
  from.world.threat = { ...th, D: 0.5, mass: 1 };
  from.routedAway = true;
  resolveBranch(from, opts);
  resolveBranch(to, opts);
  return `BRANCH ${from.index + 1}'S THREAT NOW FALLS ON BRANCH ${to.index + 1}.`;
}
