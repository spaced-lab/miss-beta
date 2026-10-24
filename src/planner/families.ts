// WHAT: The planner's method families: one tab per kind of plan (KINETIC, SWARM, SPLIT BUS, FLYBY, SAIL, NUKE, SLOW
//       PUSH, PI), each with its archetypes, its unlock (a tech node), the catalog entry that describes it, the
//       wireframe that shows it, and a one-line blurb on what it is good for.
// WHY:  Owner 2026-10-24: "it is not obvious what the selection is or how to select different packages ... if
//       unlocked all I should be seeing more options but not seeing menus of different types". The ranked list alone
//       hid the families: six KINETIC plans in a row said nothing about what else exists or how to get it. GAME_PLAN
//       13.4 always called for archetype tabs on the planner's left.
// HOW:  Pure data and small functions: `familyOf(archetype)`, `unlocked(family, tiers)` from the run's tiers,
//       `lockHint(family)` naming the tech node, `filterFamily(cands, family)` and `familyCounts(cands)` for the tab
//       badges. The overlay (render/views/planner.ts) draws the tabs and the device pane from these.
// LORE: G3 (the planner), D3 D5 D6 D7 D4 O11 (the methods)

import methodsJson from '../config/methods.json';
import { techById } from '../game/tech';
import type { Candidate } from './candidates';

export type Archetype = Candidate['archetype'];
export type FamilyId = 'KINETIC' | 'SWARM' | 'SPLIT' | 'FLYBY' | 'SAIL' | 'NUKE' | 'PUSH' | 'PI';

/** The run's tiers that gate families (the planner session carries them). */
export interface FamilyTiers {
  navTier: number;
  sailTier: number;
  warheadTier: number;
  slowPushTier: number;
  swarmTier: number;
  pi: boolean;
}

export interface Family {
  id: FamilyId;
  /** Tab text and a three-letter form for a phone's tab row. */
  label: string;
  short: string;
  archetypes: readonly Archetype[];
  /** config/methods.json id whose name, tag and equation the pane shows. */
  method: string;
  /** lore/models/catalog.ts model id drawn in the pane. */
  model: string;
  /** Tech node that unlocks the family, or null when it is there from the start. */
  tech: string | null;
  /** Learning Center topic for [?]. */
  topic: string;
  /** What it is good for, in one line (the pane's own words; the method's tag and equation stay the catalog's). */
  blurb: string;
  unlocked(t: FamilyTiers): boolean;
}

export const FAMILIES: readonly Family[] = [
  { id: 'KINETIC', label: 'KINETIC', short: 'KIN', archetypes: ['KINETIC'], method: 'KINETIC', model: 'DART', tech: null, topic: 'D3', blurb: 'ONE IMPACTOR, ONE HIT. THE WORKHORSE: CHEAP, PROVEN BY DART, NEEDS YEARS OF LEAD.', unlocked: () => true },
  { id: 'SWARM', label: 'SWARM', short: 'SWM', archetypes: ['SWARM'], method: 'SWARM', model: 'SWARM_BUS', tech: null, topic: 'D3', blurb: 'SEVERAL IMPACTORS ON STAGGERED WINDOWS. PUSHES ADD UP, AND ONE MISS IS NOT THE END.', unlocked: () => true },
  { id: 'SPLIT', label: 'SPLIT BUS', short: 'SPL', archetypes: ['SPLIT'], method: 'SWARM', model: 'SPLIT_BUS', tech: 'S2', topic: 'D3', blurb: 'ONE LAUNCH: A CARRIER RELEASES 3 (OR 8) IMPACTORS NEAR THE TARGET, EACH WITH ITS OWN AIM.', unlocked: (t) => t.swarmTier >= 2 },
  { id: 'FLYBY', label: 'FLYBY', short: 'FLY', archetypes: ['KINETIC_FLYBY'], method: 'KINETIC_FLYBY', model: 'FLYBY_ARC', tech: 'N1', topic: 'O11', blurb: 'A PLANET\'S GRAVITY BENDS THE PATH: A HARDER HIT, OR A GEOMETRY NO DIRECT LAUNCH REACHES.', unlocked: (t) => t.navTier >= 1 },
  { id: 'SAIL', label: 'SAIL', short: 'SAL', archetypes: ['SAIL_KINETIC'], method: 'SAIL_KINETIC', model: 'SOLAR_SAIL', tech: 'SL1', topic: 'D7', blurb: 'SUNLIGHT BUILDS SPEED FOR MONTHS; THEN THE SAIL DROPS AND THE IMPACTOR HITS HARD.', unlocked: (t) => t.sailTier >= 1 },
  { id: 'NUKE', label: 'NUKE', short: 'NUK', archetypes: ['NUKE_STANDOFF', 'NUKE_DISRUPT'], method: 'NUKE_STANDOFF', model: 'HAMMER', tech: 'W1', topic: 'D5', blurb: 'A STANDOFF BURST BOILS OFF A SKIN AND PUSHES; SUBSURFACE SHATTERS. SCORE PENALTY. WATCH Q/Q*.', unlocked: (t) => t.warheadTier >= 1 },
  { id: 'PUSH', label: 'SLOW PUSH', short: 'PSH', archetypes: ['SLOW_PUSH'], method: 'GRAVITY_TRACTOR', model: 'TRACTOR', tech: 'G1', topic: 'D6', blurb: 'RENDEZVOUS, THEN PUSH FOR MONTHS: TRACTOR, ION BEAM OR LASER. GENTLE AND PRECISE, BUT SLOW.', unlocked: (t) => t.slowPushTier >= 1 },
  { id: 'PI', label: 'PI ARRAY', short: 'PI', archetypes: ['PI'], method: 'PI', model: 'PI_ARRAY', tech: 'PI', topic: 'D4', blurb: 'PENETRATOR RODS SHRED THE BODY INTO PIECES SMALL ENOUGH TO AIRBURST. A LAST-WEEKS OPTION.', unlocked: (t) => t.pi },
];

const byArchetype = new Map<Archetype, Family>();
for (const f of FAMILIES) for (const a of f.archetypes) byArchetype.set(a, f);

/** The family a candidate belongs to. Example: familyOf('NUKE_DISRUPT').id = 'NUKE'. */
export function familyOf(a: Archetype): Family {
  const f = byArchetype.get(a);
  if (!f) throw new Error(`no family for ${a}`);
  return f;
}

export const familyById = (id: FamilyId): Family => {
  const f = FAMILIES.find((x) => x.id === id);
  if (!f) throw new Error(`no family ${id}`);
  return f;
};

/** Candidates of one family, in the order given. */
export const filterFamily = (cands: readonly Candidate[], f: Family): Candidate[] => cands.filter((c) => f.archetypes.includes(c.archetype));

/** Plans per family id. Example: counts of [KINETIC, KINETIC, SWARM] = { KINETIC: 2, SWARM: 1 } (absent ids are 0). */
export function familyCounts(cands: readonly Candidate[]): Map<FamilyId, number> {
  const m = new Map<FamilyId, number>();
  for (const c of cands) {
    const id = familyOf(c.archetype).id;
    m.set(id, (m.get(id) ?? 0) + 1);
  }
  return m;
}

/** "RESEARCH N1 SINGLE FLYBY (2 RP) IN THE TECH TREE (T)", or null when the family needs no research. */
export function lockHint(f: Family): string | null {
  if (!f.tech) return null;
  const n = techById(f.tech);
  return `RESEARCH ${n.id} ${n.name} (${n.cost} RP) IN THE TECH TREE (T)`;
}

interface MethodRow { id: string; name: string; tag: string; equation: string; unlock: string; note?: string }
const METHODS = (methodsJson as { methods: MethodRow[] }).methods;

/** The catalog row behind a family: its name, method tag, equation and note. */
export function familyMethod(f: Family): MethodRow {
  const m = METHODS.find((r) => r.id === f.method);
  if (!m) throw new Error(`no method ${f.method}`);
  return m;
}
