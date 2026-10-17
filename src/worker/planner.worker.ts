// WHAT: The planner worker: porkchop grids (and, from M3, Monte Carlo and discovery searches) off the UI thread.
// WHY:  GAME_PLAN 14: "The worker receives plain JSON (world snapshot + missions) and returns plain JSON."
//       A 110 x 110 Lambert grid takes tens of milliseconds to a second; the screen must not stall.
// HOW:  One message type per job with an incrementing id. Typed arrays are transferred, not copied.
//       The request shape is validated before use (it crosses a trust boundary in principle).
// LORE: C1 (how the game is built)

import { launcherTier } from '../physics/estimates';
import type { Elements } from '../physics/kepler';
import { flybySearch, type FlybyPlanet, type FlybyResult } from '../planner/flybySearch';
import { monteCarlo, type MonteCarloResult } from '../planner/monteCarlo';
import { computePorkchop, type PorkchopGrid } from '../planner/porkchop';
import { sailSearch, type SailResult } from '../planner/sailSearch';
import type { Mission } from '../sim/mission';
import type { World } from '../sim/world';

export interface PorkchopJob {
  id: number;
  type: 'porkchop';
  home: Elements;
  threat: Elements;
  muSun: number;
  tMin: number;
  tImpact: number;
  tier: number;
}

export interface MonteCarloJob {
  id: number;
  type: 'montecarlo';
  world: World;
  missions: Mission[];
  n: number;
}

export interface FlybyJob {
  id: number;
  type: 'flyby';
  home: Elements;
  threat: Elements;
  planets: FlybyPlanet[];
  muSun: number;
  tMin: number;
  tImpact: number;
  tier: number;
  dsmBudget: number;
}

export interface SailJob {
  id: number;
  type: 'sail';
  home: Elements;
  threat: Elements;
  muSun: number;
  tMin: number;
  tImpact: number;
  tier: number;
  sailTier: number;
  dsmBudget: number;
}

export type WorkerJob = PorkchopJob | MonteCarloJob | FlybyJob | SailJob;

export interface PorkchopReply {
  id: number;
  type: 'porkchop';
  grid: PorkchopGrid;
}

export interface MonteCarloReply {
  id: number;
  type: 'montecarlo';
  result: MonteCarloResult;
}

export interface FlybyReply {
  id: number;
  type: 'flyby';
  result: FlybyResult;
}

export interface SailReply {
  id: number;
  type: 'sail';
  result: SailResult;
}

export type WorkerReply = PorkchopReply | MonteCarloReply | FlybyReply | SailReply | { id: number; type: 'error'; message: string };

function isElements(v: unknown): v is Elements {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return ['a', 'e', 'w', 'M0', 't0'].every((k) => typeof o[k] === 'number' && Number.isFinite(o[k]));
}

function isPorkchopJob(v: unknown): v is PorkchopJob {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return o['type'] === 'porkchop' && Number.isInteger(o['id']) && isElements(o['home']) && isElements(o['threat']) &&
    typeof o['muSun'] === 'number' && typeof o['tMin'] === 'number' && typeof o['tImpact'] === 'number' && Number.isInteger(o['tier']);
}

function isMonteCarloJob(v: unknown): v is MonteCarloJob {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  const w = o['world'] as Record<string, unknown> | undefined;
  return o['type'] === 'montecarlo' && Number.isInteger(o['id']) && Array.isArray(o['missions']) && Number.isInteger(o['n']) && (o['n'] as number) >= 0 && (o['n'] as number) <= 5000 &&
    typeof w === 'object' && w !== null && typeof w['runSeed'] === 'string' && Array.isArray(w['planets']) && typeof w['threat'] === 'object' && w['threat'] !== null;
}

function isFlybyJob(v: unknown): v is FlybyJob {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return o['type'] === 'flyby' && Number.isInteger(o['id']) && isElements(o['home']) && isElements(o['threat']) && Array.isArray(o['planets']) &&
    typeof o['muSun'] === 'number' && typeof o['tMin'] === 'number' && typeof o['tImpact'] === 'number' && Number.isInteger(o['tier']) && typeof o['dsmBudget'] === 'number';
}

function isSailJob(v: unknown): v is SailJob {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return o['type'] === 'sail' && Number.isInteger(o['id']) && isElements(o['home']) && isElements(o['threat']) &&
    typeof o['muSun'] === 'number' && typeof o['tMin'] === 'number' && typeof o['tImpact'] === 'number' && Number.isInteger(o['tier']) && Number.isInteger(o['sailTier']) && typeof o['dsmBudget'] === 'number';
}

/** Runs a job synchronously; exported so the main thread can fall back to it when Workers are unavailable. */
export function runJob(job: WorkerJob): WorkerReply {
  if (isFlybyJob(job)) {
    return { id: job.id, type: 'flyby', result: flybySearch({ home: job.home, threat: job.threat, planets: job.planets, muSun: job.muSun, tMin: job.tMin, tImpact: job.tImpact, tier: launcherTier(job.tier), dsmBudget: job.dsmBudget }) };
  }
  if (isSailJob(job)) {
    return { id: job.id, type: 'sail', result: sailSearch({ home: job.home, threat: job.threat, muSun: job.muSun, tMin: job.tMin, tImpact: job.tImpact, tier: launcherTier(job.tier), sailTier: job.sailTier, dsmBudget: job.dsmBudget }) };
  }
  if (isPorkchopJob(job)) {
    const grid = computePorkchop({ home: job.home, threat: job.threat, muSun: job.muSun, tMin: job.tMin, tImpact: job.tImpact, tier: launcherTier(job.tier) });
    return { id: job.id, type: 'porkchop', grid };
  }
  if (isMonteCarloJob(job)) {
    // NOTE: the world crosses postMessage by structured clone; Float64Array shapes and plain records survive.
    return { id: job.id, type: 'montecarlo', result: monteCarlo(job.world, job.missions, job.n) };
  }
  return { id: (job as { id?: number }).id ?? -1, type: 'error', message: 'bad job' };
}

// Worker entry (ignored when this module is imported on the main thread for the fallback).
const scope = globalThis as unknown as { onmessage?: ((e: MessageEvent) => void) | null; postMessage?: (m: unknown, t?: Transferable[]) => void; document?: unknown };
if (typeof scope.document === 'undefined' && typeof scope.postMessage === 'function') {
  scope.onmessage = (e: MessageEvent): void => {
    const reply = runJob(e.data as WorkerJob);
    if (reply.type === 'porkchop') {
      const g = reply.grid;
      scope.postMessage?.(reply, [g.c3.buffer, g.payload.buffer, g.U.buffer, g.v1x.buffer, g.v1y.buffer, g.v2x.buffer, g.v2y.buffer, g.rx.buffer, g.ry.buffer]);
    } else {
      scope.postMessage?.(reply);
    }
  };
}
