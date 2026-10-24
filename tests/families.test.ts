// WHAT: The planner's method families (planner/families.ts): every archetype has a family, locks follow the run's
//       tiers, each family's method, model and tech node exist, and the filter and counts are consistent.
// WHY:  The tabs are the player's map of what exists and how to get it; a dangling id would show as a crash in the
//       overlay or a blank pane.
// LORE: G3 (the planner)
import { describe, expect, it } from 'vitest';
import type { Candidate } from '../src/planner/candidates';
import { FAMILIES, familyCounts, familyMethod, familyOf, filterFamily, lockHint } from '../src/planner/families';
import { modelById } from '../src/lore/models/catalog';
import { techById } from '../src/game/tech';

const cand = (archetype: Candidate['archetype']): Candidate => ({ archetype, missions: [], iL: 0, iA: 0, missEstRadii: 0, verdict: null, pMiss: 0, score: 0, betaRange: [1, 2], qRatio: 0, cost: 1 });

describe('planner families', () => {
  it('every archetype maps to one family and every family resolves its model, method and tech node', () => {
    const archetypes: Candidate['archetype'][] = ['KINETIC', 'SWARM', 'SPLIT', 'KINETIC_FLYBY', 'SAIL_KINETIC', 'NUKE_STANDOFF', 'NUKE_DISRUPT', 'SLOW_PUSH', 'PI'];
    for (const a of archetypes) expect(familyOf(a).archetypes).toContain(a);
    for (const f of FAMILIES) {
      expect(modelById(f.model), f.model).not.toBeNull();
      expect(familyMethod(f).name.length).toBeGreaterThan(0);
      if (f.tech) expect(techById(f.tech).id).toBe(f.tech);
      expect(f.blurb.length).toBeLessThan(110);
    }
    expect(new Set(FAMILIES.map((f) => f.id)).size).toBe(FAMILIES.length);
  });

  it('locks follow the tiers: a fresh run has KINETIC and SWARM only; everything with the tiers up', () => {
    const fresh = { navTier: 0, sailTier: 0, warheadTier: 0, slowPushTier: 0, swarmTier: 1, pi: false };
    const all = { navTier: 1, sailTier: 1, warheadTier: 1, slowPushTier: 1, swarmTier: 2, pi: true };
    expect(FAMILIES.filter((f) => f.unlocked(fresh)).map((f) => f.id)).toEqual(['KINETIC', 'SWARM']);
    expect(FAMILIES.every((f) => f.unlocked(all))).toBe(true);
    expect(lockHint(familyOf('KINETIC_FLYBY'))).toBe('RESEARCH N1 SINGLE FLYBY (2 RP) IN THE TECH TREE (T)');
    expect(lockHint(familyOf('KINETIC'))).toBeNull();
  });

  it('filters and counts by family', () => {
    const list = [cand('KINETIC'), cand('NUKE_STANDOFF'), cand('KINETIC'), cand('NUKE_DISRUPT'), cand('PI')];
    expect(filterFamily(list, familyOf('NUKE_STANDOFF')).map((c) => c.archetype)).toEqual(['NUKE_STANDOFF', 'NUKE_DISRUPT']);
    const n = familyCounts(list);
    expect(n.get('KINETIC')).toBe(2);
    expect(n.get('NUKE')).toBe(2);
    expect(n.get('PI')).toBe(1);
    expect(n.get('SAIL')).toBeUndefined();
  });
});
