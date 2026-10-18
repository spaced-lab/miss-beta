// WHAT: Picks the in-game tip for the HUD from the round's situation.
// WHY:  Owner, 2026-10-18: in-game tips. A tip that matches what the player is doing teaches more than a
//       random one; rotating keeps it from becoming wallpaper.
// HOW:  `tipFacts` summarises the round into flags; `pickTip(facts, slot)` returns the tip for a rotation slot
//       (the HUD advances the slot every TIP_SECONDS). Matching tips come first, ANY tips fill in. Pure.
// LORE: G1 (how to play)

import tipsJson from '../config/tips.json';

export type TipWhen = 'NO_MISSIONS' | 'IN_FLIGHT' | 'RICH' | 'SHORT' | 'PREDICTED_MISS' | 'ANY';
export interface Tip {
  when: TipWhen;
  text: string;
}
export const TIPS: readonly Tip[] = (tipsJson as { tips: Tip[] }).tips;
/** Seconds a tip stays before the next one. [knob] */
export const TIP_SECONDS = 12;

export interface TipFacts {
  missions: number;
  inFlight: boolean;
  budget: number;
  leadLeftYears: number;
  predictedMiss: boolean;
}

export function activeWhens(f: TipFacts): TipWhen[] {
  const w: TipWhen[] = [];
  if (f.missions === 0) w.push('NO_MISSIONS');
  if (f.inFlight) w.push('IN_FLIGHT');
  if (f.budget >= 20) w.push('RICH');
  if (f.leadLeftYears < 1) w.push('SHORT');
  if (f.predictedMiss) w.push('PREDICTED_MISS');
  return w;
}

/** The tip for rotation slot `slot`: the situation's tips first, then the general ones. */
export function pickTip(f: TipFacts, slot: number): Tip | null {
  const w = activeWhens(f);
  const pool = [...TIPS.filter((t) => w.includes(t.when)), ...TIPS.filter((t) => t.when === 'ANY')];
  if (pool.length === 0) return null;
  return pool[((slot % pool.length) + pool.length) % pool.length] ?? null;
}
