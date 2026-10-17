// WHAT: Round and run scoring (GAME_PLAN 12).
// WHY:  Score is the leaderboard currency and research is the tech-tree currency; both come from here.
// HOW:  round_base = log10(E_Mt + 1) * 100 * (1 + 0.15 k)
//       outcome    = clean miss (margin >= 1 R) 1.0 | marginal 0.8 | partial 0.35 (M3) | HIT: run over
//       efficiency = 0.5 * unspent / available;  timing = 0.3 * clamp(years_of_margin / T_lead, 0, 1)
//       style      = +0.2 no warhead, +0.2 no fragments, +0.3 net capture
//       round_score = base * outcome * (1 + efficiency + timing + style);  research = floor(score / 50)
// LORE: G5 (scoring)

import { YEAR } from '../physics/constants';

export interface ScoreInput {
  round: number;
  energyMt: number;
  outcome: 'HIT' | 'MISS';
  marginRadii: number;
  budgetUnspent: number;
  budgetAvailable: number;
  /** Seconds between the last action and impact: resolved-early bonus. */
  marginSeconds: number;
  leadSeconds: number;
  usedWarhead: boolean;
  producedFragments: boolean;
  netCapture: boolean;
}

export interface ScoreBreakdown {
  base: number;
  outcome: number;
  efficiency: number;
  timing: number;
  style: number;
  roundScore: number;
  research: number;
}

export function scoreRound(s: ScoreInput): ScoreBreakdown {
  const base = Math.log10(s.energyMt + 1) * 100 * (1 + 0.15 * s.round);
  const outcome = s.outcome === 'HIT' ? 0 : s.marginRadii >= 1 ? 1.0 : 0.8;
  const efficiency = s.budgetAvailable > 0 ? 0.5 * Math.max(0, Math.min(1, s.budgetUnspent / s.budgetAvailable)) : 0;
  const timing = 0.3 * Math.max(0, Math.min(1, s.marginSeconds / Math.max(1, s.leadSeconds)));
  const style = (s.usedWarhead ? 0 : 0.2) + (s.producedFragments ? 0 : 0.2) + (s.netCapture ? 0.3 : 0);
  const roundScore = Math.round(base * outcome * (1 + efficiency + timing + style));
  return { base, outcome, efficiency, timing, style, roundScore, research: Math.floor(roundScore / 50) };
}

export const yearsOf = (s: number): number => s / YEAR;
