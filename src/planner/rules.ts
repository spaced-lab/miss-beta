// WHAT: The autonomy rules DSL (GAME_PLAN 8): JSON rules, validated, evaluated at resolver events.
// WHY:  After a hit you learn how the body responded only after launch of the next wave would normally have
//       had to be decided. Tier 1 autonomy lets the player write "if this happens, do that" for assets
//       already in flight. The DSL is data: no eval, an allowlist of facts, operators and actions.
// HOW:  `validateRules` turns unknown JSON into Rule[] or throws with the reason; `conditionHolds` checks a
//       rule's `if` block against a facts record; presets live in config/rules.json.
// LORE: D12 (autonomy), G3 (the planner)

import rulesJson from '../config/rules.json';

export type RuleEvent = 'FRAGMENTATION' | 'BETA_ASSESSED' | 'MISS_PREDICTED';
export type RuleAction = 'RETARGET' | 'DEPLOY_SUBIMPACTORS' | 'HOLD';
export type RuleTarget = 'MAX(P_HIT * MASS)' | 'MAX(MASS)' | 'PRIMARY';
export type Op = '<' | '<=' | '>' | '>=' | '==';

export const FACTS = ['fragments.count', 'predicted.miss_radii', 'beta', 'remaining_dv'] as const;
export type Fact = (typeof FACTS)[number];
const EVENTS: readonly RuleEvent[] = ['FRAGMENTATION', 'BETA_ASSESSED', 'MISS_PREDICTED'];
const ACTIONS: readonly RuleAction[] = ['RETARGET', 'DEPLOY_SUBIMPACTORS', 'HOLD'];
const TARGETS: readonly RuleTarget[] = ['MAX(P_HIT * MASS)', 'MAX(MASS)', 'PRIMARY'];
const OPS: readonly Op[] = ['<', '<=', '>', '>=', '=='];

export interface Rule {
  when: RuleEvent;
  if?: Partial<Record<Fact, Partial<Record<Op, number>>>>;
  do: RuleAction;
  target?: RuleTarget;
  budget?: 'REMAINING_DV';
  count?: number;
}

export type Facts = Partial<Record<Fact, number>>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Validate a JSON value as a rule list. Throws an Error naming the first problem. */
export function validateRules(v: unknown): Rule[] {
  if (!Array.isArray(v)) throw new Error('rules must be a list');
  if (v.length > 32) throw new Error('too many rules (max 32)');
  return v.map((raw, i) => {
    if (!isRecord(raw)) throw new Error(`rule ${i}: not an object`);
    const when = raw['when'];
    if (typeof when !== 'string' || !EVENTS.includes(when as RuleEvent)) throw new Error(`rule ${i}: bad "when"`);
    const act = raw['do'];
    if (typeof act !== 'string' || !ACTIONS.includes(act as RuleAction)) throw new Error(`rule ${i}: bad "do"`);
    const rule: Rule = { when: when as RuleEvent, do: act as RuleAction };
    if (raw['if'] !== undefined) {
      if (!isRecord(raw['if'])) throw new Error(`rule ${i}: "if" must be an object`);
      const cond: Rule['if'] = {};
      for (const [k, ops] of Object.entries(raw['if'])) {
        if (!FACTS.includes(k as Fact)) throw new Error(`rule ${i}: unknown fact "${k}"`);
        if (!isRecord(ops)) throw new Error(`rule ${i}: "${k}" must map operators to numbers`);
        const o: Partial<Record<Op, number>> = {};
        for (const [op, val] of Object.entries(ops)) {
          if (!OPS.includes(op as Op)) throw new Error(`rule ${i}: unknown operator "${op}"`);
          if (typeof val !== 'number' || !Number.isFinite(val)) throw new Error(`rule ${i}: "${k} ${op}" needs a number`);
          o[op as Op] = val;
        }
        cond[k as Fact] = o;
      }
      rule.if = cond;
    }
    if (raw['target'] !== undefined) {
      if (typeof raw['target'] !== 'string' || !TARGETS.includes(raw['target'] as RuleTarget)) throw new Error(`rule ${i}: bad "target"`);
      rule.target = raw['target'] as RuleTarget;
    }
    if (raw['budget'] !== undefined) {
      if (raw['budget'] !== 'REMAINING_DV') throw new Error(`rule ${i}: bad "budget"`);
      rule.budget = 'REMAINING_DV';
    }
    if (raw['count'] !== undefined) {
      if (typeof raw['count'] !== 'number' || !Number.isInteger(raw['count']) || raw['count'] < 1 || raw['count'] > 16) throw new Error(`rule ${i}: "count" must be an integer 1..16`);
      rule.count = raw['count'];
    }
    return rule;
  });
}

/** Does the rule's condition hold for these facts? Missing facts fail the condition. */
export function conditionHolds(rule: Rule, facts: Facts): boolean {
  if (!rule.if) return true;
  for (const [k, ops] of Object.entries(rule.if) as [Fact, Partial<Record<Op, number>>][]) {
    const v = facts[k];
    if (v === undefined) return false;
    for (const [op, x] of Object.entries(ops) as [Op, number][]) {
      if (op === '<' && !(v < x)) return false;
      if (op === '<=' && !(v <= x)) return false;
      if (op === '>' && !(v > x)) return false;
      if (op === '>=' && !(v >= x)) return false;
      if (op === '==' && !(v === x)) return false;
    }
  }
  return true;
}

export const RULE_PRESETS: Readonly<Record<string, Rule[]>> = Object.fromEntries(Object.entries((rulesJson as { presets: Record<string, unknown> }).presets).map(([k, v]) => [k, validateRules(v)]));
export const PRESET_NAMES = Object.keys(RULE_PRESETS);

/** Rules that fire for an event given the facts, in order. */
export function matchingRules(rules: readonly Rule[], when: RuleEvent, facts: Facts): Rule[] {
  return rules.filter((r) => r.when === when && conditionHolds(r, facts));
}
