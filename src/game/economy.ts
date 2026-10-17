// WHAT: Budget accrual and spending (GAME_PLAN 9, 28: per year, accrued on the clock).
// WHY:  Time warp is also a resource decision: waiting earns budget but burns lead time.
// HOW:  budget(t) = start + rate * t - spent. Spending is checked against the balance at the commit time.
// LORE: G4 (programs), G5 (scoring)

import { KNOBS } from '../config/knobs';
import { YEAR } from '../physics/constants';

export interface Economy {
  start: number;
  perYear: number;
  spent: number;
}

export function createEconomy(start: number = KNOBS.BUDGET_START, perYear: number = KNOBS.BUDGET_PER_YEAR): Economy {
  return { start, perYear, spent: 0 };
}

export function budgetAt(e: Economy, t: number): number {
  return e.start + (e.perYear * t) / YEAR - e.spent;
}

export function canAfford(e: Economy, t: number, cost: number): boolean {
  return budgetAt(e, t) >= cost - 1e-9;
}

/** Spend; returns false (and changes nothing) if unaffordable. */
export function spend(e: Economy, t: number, cost: number): boolean {
  if (!canAfford(e, t, cost)) return false;
  e.spent += cost;
  return true;
}
