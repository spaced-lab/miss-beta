// WHAT: The tech tree (GAME_PLAN 9): nodes, costs in research, prerequisites, and the effects on the run.
// WHY:  Research is earned per round from score; tech is where it goes. Every planner archetype is gated
//       by a node here, so the tree is also the map of what the game can do.
// HOW:  `canUnlock` checks research, prerequisites and mode; `unlock` spends and applies the effect to the
//       RunState's tier fields. Data lives in config/tech.json. The tree screen is render/views/tech.ts.
// LORE: G1 (how to play), D11 (the catalog and the chart)

import techJson from '../config/tech.json';
import type { RunState } from './run';

export interface TechEffect {
  launcherTier?: number;
  impactorTier?: number;
  softImpactor?: boolean;
  hammer?: boolean;
  swarmTier?: number;
  navTier?: number;
  sailTier?: number;
  propulsionTier?: number;
  trackingTier?: number;
  autonomyTier?: number;
  warheadTier?: number;
  slowPushTier?: number;
  pi?: boolean;
  netTier?: number;
}

export interface TechNode {
  id: string;
  track: string;
  name: string;
  cost: number;
  requires: string[];
  effect: TechEffect;
  note?: string;
  mode?: 'SCIFI';
}

export const TECH = (techJson as { nodes: TechNode[] }).nodes;
export const TRACKS = [...new Set(TECH.map((n) => n.track))];

export function techById(id: string): TechNode {
  const n = TECH.find((x) => x.id === id);
  if (!n) throw new Error(`no tech ${id}`);
  return n;
}

export function hasTech(run: RunState, id: string): boolean {
  return run.tech.includes(id);
}

export type UnlockVerdict = 'OK' | 'OWNED' | 'RESEARCH' | 'REQUIRES' | 'MODE';

export function canUnlock(run: RunState, id: string, mode: 'REALISTIC' | 'SCIFI' = 'REALISTIC'): UnlockVerdict {
  const n = techById(id);
  if (hasTech(run, id)) return 'OWNED';
  if (n.mode === 'SCIFI' && mode !== 'SCIFI') return 'MODE';
  if (!n.requires.every((r) => hasTech(run, r))) return 'REQUIRES';
  if (run.research < n.cost) return 'RESEARCH';
  return 'OK';
}

/** Apply a node's effect to the run (idempotent: tiers only ever go up). */
export function applyTech(run: RunState, n: TechNode): void {
  const e = n.effect;
  if (e.launcherTier) run.launcherTier = Math.max(run.launcherTier, e.launcherTier);
  if (e.impactorTier) run.impactorTier = Math.max(run.impactorTier, e.impactorTier);
  if (e.softImpactor) run.softImpactor = true;
  if (e.hammer) run.hammer = true;
  if (e.swarmTier) run.swarmTier = Math.max(run.swarmTier, e.swarmTier);
  if (e.navTier) run.navTier = Math.max(run.navTier, e.navTier);
  if (e.sailTier) run.sailTier = Math.max(run.sailTier, e.sailTier);
  if (e.propulsionTier) run.propulsionTier = Math.max(run.propulsionTier, e.propulsionTier);
  if (e.trackingTier) run.trackingTier = Math.max(run.trackingTier, e.trackingTier);
  if (e.autonomyTier) run.autonomyTier = Math.max(run.autonomyTier, e.autonomyTier);
  if (e.warheadTier) run.warheadTier = Math.max(run.warheadTier, e.warheadTier);
  if (e.slowPushTier) run.slowPushTier = Math.max(run.slowPushTier, e.slowPushTier);
  if (e.pi) run.pi = true;
  if (e.netTier) run.netTier = Math.max(run.netTier, e.netTier);
}

/** Spend research and unlock. Returns the verdict; 'OK' means it happened. */
export function unlock(run: RunState, id: string, mode: 'REALISTIC' | 'SCIFI' = 'REALISTIC'): UnlockVerdict {
  const v = canUnlock(run, id, mode);
  if (v !== 'OK') return v;
  const n = techById(id);
  run.research -= n.cost;
  run.tech.push(id);
  applyTech(run, n);
  return 'OK';
}

/** Re-apply every owned node's effect (after loading a save). */
export function reapplyTech(run: RunState): void {
  for (const id of run.tech) {
    try {
      applyTech(run, techById(id));
    } catch {
      // unknown id in an edited save: ignore
    }
  }
}
