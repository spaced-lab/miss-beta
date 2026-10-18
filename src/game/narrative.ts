// WHAT: Canned narratives: the round-start brief, one paragraph per event, the debrief, as coloured lines.
// WHY:  GAME_PLAN 29: the log line says what happened; the narrative says what it means, in a sentence a
//       first-time player can read. Templates live in config/narratives.json, written by a person; no
//       language model runs at play time. Lines carry a SPECTRUM role so the screen is not only green.
// HOW:  `fill(template, vars)` replaces {slots} and throws on a slot without a value, so a template can
//       never print "undefined". Every number is formatted here (units, precision) before it meets a
//       template. The functions are pure: they read the threat, the result and the event and return text.
// LORE: G2 (screens and HUD), T5 (what they are made of), D3 (kinetic and beta), D4 (fragmentation)

import narrativesJson from '../config/narratives.json';
import { AU, DAY, YEAR } from '../physics/constants';
import { propagate } from '../physics/kepler';
import { absoluteMagnitude, apparentMagnitude, viewGeometry } from '../physics/photometry';
import type { Role } from '../render/palettes';
import { NETWORKS } from '../sim/detection';
import { is3D, lift, stateAt } from '../sim/orbit3';
import { viewGeometry3 } from '../sim/sky';
import type { SimEventRecord } from '../sim/eventLog';
import type { RoundResult } from '../sim/resolver';
import type { Threat, ThreatTypeId } from '../sim/threat';
import { planetById, planetState, type World } from '../sim/world';
import { formatCountdown } from '../ui/hud';

export interface NarrativeLine {
  text: string;
  role: Role;
}

export interface Narrative {
  header: NarrativeLine;
  lines: NarrativeLine[];
}

interface Template {
  header: string;
  lines: string[];
}

const T = narrativesJson as unknown as {
  TYPE_CLAUSE: Record<ThreatTypeId, string>;
  BREAKUP_VERB: Record<ThreatTypeId, string>;
  FLAVOR_LABEL: Record<string, string>;
  ROUND_START: Record<'DISCOVERED' | 'NO_WARNING' | 'ASSUMED', Template>;
  HINT: Record<string, string>;
  LESSON: Record<string, string>;
  LAUNCH: Template;
  IMPACT: Record<'KNOWN' | 'HIDDEN', Template>;
  IMPACT_MISS: Template;
  RETARGET: Template;
  SPLIT: Template;
  BETA_ASSESSED: Template;
  FRAGMENTATION: Template;
  NUKE: Record<'FUZED' | 'FAILED', Template>;
  PI: Record<'OK' | 'FAILED', Template>;
  PUSH: Record<'VIABLE' | 'NOT_VIABLE', Template>;
  CLOSE_APPROACH: Record<'MISS' | 'IMPACT' | 'CLOUD', Template>;
  EVACUATE: Template;
  DEBRIEF: Record<'MISS' | 'PARTIAL' | 'HIT', Template>;
};

const ROLES: readonly Role[] = ['threat', 'danger', 'craft', 'fragment', 'program', 'sail', 'nuclear', 'planet', 'text'];

/** Replace every {slot} in `tpl`. Throws when a slot has no value, so a brief can never say "undefined". */
export function fill(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{([a-zA-Z0-9_]+)\}/g, (_m, key: string) => {
    const v = vars[key];
    if (v === undefined || v === null || (typeof v === 'number' && !Number.isFinite(v))) throw new Error(`narrative slot {${key}} has no value`);
    return String(v);
  });
}

/** "@role TEXT" -> a coloured line; a line without a tag is plain text. */
export function parseLine(raw: string): NarrativeLine {
  const m = /^@([a-z]+)\s+([\s\S]*)$/.exec(raw);
  if (m && ROLES.includes(m[1] as Role)) return { text: m[2] ?? '', role: m[1] as Role };
  return { text: raw, role: 'text' };
}

function render(tpl: Template, vars: Record<string, string | number>): Narrative {
  const header = parseLine(fill(tpl.header, vars));
  const lines = tpl.lines.map((l) => parseLine(fill(l, vars))).filter((l) => l.text.trim().length > 0);
  return { header, lines };
}

/** "4.2 Y", "26 D" or "11 H" from seconds. */
export function fmtLead(seconds: number): string {
  if (seconds >= YEAR) return `${(seconds / YEAR).toFixed(1)} Y`;
  if (seconds >= DAY) return `${Math.round(seconds / DAY)} D`;
  return `${Math.max(1, Math.round(seconds / 3600))} H`;
}

function fmtMt(mt: number): string {
  return mt < 10 ? mt.toFixed(1) : mt.toFixed(0);
}

function networkName(id: string): string {
  return NETWORKS.find((n) => n.id === id)?.name ?? id;
}

/** Apparent V of the threat from HOME at round time `t` (t = 0 is the discovery for discovered rounds). */
export function apparentVAt(th: Threat, world: World, t: number): number {
  const H = absoluteMagnitude(th.D, th.type.albedo);
  const rO = planetState(world, planetById(world, 'HOME'), t).r;
  // A visitor off the ecliptic (M14 phase 2) is seen at its 3-D distance and phase angle.
  const g = is3D(th.elements) ? viewGeometry3(lift(stateAt(th.elements, world.star.mu, t).r), { x: 0, y: 0, z: 0 }, rO, { x: 0, y: 0 }) : viewGeometry(propagate(th.elements, world.star.mu, t).r, rO);
  // NOTE: viewGeometry returns AU already; AU is imported only to keep the unit explicit for readers.
  void AU;
  return apparentMagnitude(H, g.rAu, g.deltaAu, g.alphaDeg);
}

function hintFor(th: Threat, res: RoundResult): string {
  if (res.category === 'GLOBAL') return T.HINT.GLOBAL ?? '';
  if (th.tImpact < 60 * DAY) return T.HINT.SHORT_LEAD ?? '';
  if (th.type.id === 'RUBBLE' || th.type.id === 'ICY') return T.HINT.FRAGILE ?? '';
  return T.HINT.DEFAULT ?? '';
}

/** The lesson line of GAME_PLAN 19's design note: short lead without a sunward sentinel, or just short lead. */
export function lessonFor(th: Threat, sunwardActive: boolean): string {
  const lead = fmtLead(th.tImpact);
  if (th.tImpact < 90 * DAY && !sunwardActive) return fill(T.LESSON.SUNWARD ?? '', { lead });
  if (th.tImpact < YEAR) return fill(T.LESSON.LEAD ?? '', { lead });
  return T.LESSON.NONE ?? '';
}

/** Round-start brief. `sunwardActive`: SUNWARD_SENTINEL is in the run's networks. */
export function roundStartNarrative(th: Threat, res: RoundResult, world: World, sunwardActive: boolean): Narrative {
  const base = {
    name: th.name,
    D: th.D.toFixed(0),
    typeClause: T.TYPE_CLAUSE[th.type.id],
    lead: fmtLead(th.tImpact),
    vinf: (res.ca.vInf / 1000).toFixed(1),
    energy: fmtMt(res.energy.energyMt),
    category: res.category,
    hint: hintFor(th, res),
    lesson: lessonFor(th, sunwardActive),
  };
  if (th.noWarning) return render(T.ROUND_START.NO_WARNING, base);
  if (th.discoveredBy && th.discoveredBy !== 'ASSUMED') {
    const mag = apparentVAt(th, world, 0);
    return render(T.ROUND_START.DISCOVERED, { ...base, network: networkName(th.discoveredBy), mag: Number.isFinite(mag) ? mag.toFixed(1) : '?' });
  }
  return render(T.ROUND_START.ASSUMED, { ...base, flavorLabel: T.FLAVOR_LABEL[th.flavor ?? 'NONE'] ?? T.FLAVOR_LABEL.NONE ?? 'TARGET' });
}

export interface EventNarrativeContext {
  threat: Threat;
  /** Round time now; when given, a beta not yet assessed is hidden (as formatEvent does). Omit to reveal. */
  now?: number | undefined;
}

/** One brief per event, or null for kinds that have none (COAST, NOTE, ROUND_START). */
export function eventNarrative(e: SimEventRecord, ctx: EventNarrativeContext): Narrative | null {
  const th = ctx.threat;
  switch (e.kind) {
    case 'LAUNCH':
      return render(T.LAUNCH, { missionId: e.missionId, tier: e.tier, mass: e.massKg.toFixed(0), c3: e.c3.toFixed(1) });
    case 'IMPACT': {
      const hidden = ctx.now !== undefined && e.betaKnownAt !== undefined && ctx.now < e.betaKnownAt;
      const qLine = e.qRatio !== undefined ? `Q/Q* ${e.qRatio.toFixed(2)}: ${e.qRatio >= 1 ? 'DISRUPTED' : 'INTACT'}.` : 'BODY INTACT.';
      const common = { missionId: e.missionId, target: e.targetId ?? 'THREAT', U: (e.U / 1000).toFixed(1), qLine };
      if (hidden) return render(T.IMPACT.HIDDEN, { ...common, assess: fmtLead(Math.max(0, (e.betaKnownAt ?? e.t) - e.t)) });
      return render(T.IMPACT.KNOWN, {
        ...common,
        beta: e.beta.toFixed(2),
        ejectaPct: Math.max(0, (e.beta - 1) * 100).toFixed(0),
        dv: (e.dvTotal * 1000).toFixed(2),
        along: (e.dvAlong * 1000).toFixed(2),
      });
    }
    case 'IMPACT_MISS':
      return render(T.IMPACT_MISS, { missionId: e.missionId, target: 'THE TARGET', reason: e.reason ? e.reason.toUpperCase() + '.' : `OFF BY ${(e.offset / 1000).toFixed(0)} KM.` });
    case 'RETARGET':
      return render(T.RETARGET, { missionId: e.missionId, target: e.targetId, dv: e.dv.toFixed(0), remaining: e.remaining.toFixed(0) });
    case 'SPLIT':
      return render(T.SPLIT, { missionId: e.missionId, count: e.count, targets: [...new Set(e.targets)].join(' ') || 'THE THREAT' });
    case 'BETA_ASSESSED':
      return render(T.BETA_ASSESSED, { missionId: e.missionId, beta: e.beta.toFixed(2), margin: `${e.marginRadii >= 0 ? '+' : ''}${e.marginRadii.toFixed(2)}` });
    case 'FRAGMENTATION':
      return render(T.FRAGMENTATION, {
        target: e.targetId,
        verb: T.BREAKUP_VERB[th.type.id],
        q: e.qRatio.toFixed(2),
        count: e.count,
        largestD: e.largestD.toFixed(0),
        vEj: e.vEj.toFixed(2),
        escaped: e.escaped > 0 ? ` ${e.escaped} ESCAPED THE SYSTEM.` : '',
      });
    case 'NUKE':
      if (!e.fuzed) return render(T.NUKE.FAILED, { missionId: e.missionId, target: e.targetId });
      return render(T.NUKE.FUZED, {
        missionId: e.missionId,
        mode: e.mode,
        target: e.targetId,
        yield: e.yieldMt,
        pulses: e.pulses > 1 ? ` X ${e.pulses} PULSES` : '',
        dv: (e.dv * 1000).toFixed(2),
        q: e.qRatio.toFixed(2),
        intact: e.qRatio >= 1 ? 'DISRUPTED' : 'INTACT',
      });
    case 'PI':
      if (!e.ok) return render(T.PI.FAILED, { missionId: e.missionId, target: e.targetId, reason: e.reason.toUpperCase() + '.' });
      return render(T.PI.OK, { missionId: e.missionId, target: e.targetId, D: e.D.toFixed(0), damage: e.damageMt.toFixed(2) });
    case 'PUSH':
      if (!e.viable) return render(T.PUSH.NOT_VIABLE, { missionId: e.missionId, method: e.method, note: e.note.toUpperCase() + '.' });
      return render(T.PUSH.VIABLE, {
        missionId: e.missionId,
        method: e.method,
        target: e.targetId,
        force: e.force < 1 ? `${(e.force * 1000).toFixed(2)} MN` : `${e.force.toFixed(1)} N`,
        days: (e.duration / DAY).toFixed(0),
        dv: (e.dv * 1000).toFixed(3),
      });
    case 'CLOSE_APPROACH': {
      const vars = { body: e.bodyId ?? th.name, dMin: (e.dMin / 1000).toFixed(0), bCrit: (e.bCrit / 1000).toFixed(0), margin: `${e.marginRadii >= 0 ? '+' : ''}${e.marginRadii.toFixed(2)}` };
      return render(e.impact ? T.CLOSE_APPROACH.IMPACT : T.CLOSE_APPROACH.MISS, vars);
    }
    case 'ROUND_START':
    case 'NOTE':
      return null;
    default:
      return null;
  }
}

/** One brief for several close approaches in one frame (a fragment cloud). */
export function cloudNarrative(cas: readonly Extract<SimEventRecord, { kind: 'CLOSE_APPROACH' }>[], th: Threat): Narrative | null {
  if (cas.length === 0) return null;
  const hits = cas.filter((c) => c.impact).length;
  const closest = [...cas].sort((a, b) => a.dMin - b.dMin)[0];
  if (!closest) return null;
  return render(T.CLOSE_APPROACH.CLOUD, {
    n: cas.length,
    hits,
    misses: cas.length - hits,
    body: closest.bodyId ?? th.name,
    dMin: (closest.dMin / 1000).toFixed(0),
    margin: `${closest.marginRadii >= 0 ? '+' : ''}${closest.marginRadii.toFixed(2)}`,
    hitLine: hits === 0 ? 'THE WHOLE CLOUD MISSED.' : 'PIECES BELOW THE AIRBURST SIZE BURN UP HIGH; THE REST COUNT AS DAMAGE.',
  });
}

export function evacuateNarrative(remainingSeconds: number, minDays: number): Narrative {
  return render(T.EVACUATE, { countdown: formatCountdown(remainingSeconds), minDays });
}

export interface DebriefFacts {
  round: number;
  outcome: 'MISS' | 'PARTIAL' | 'HIT';
  marginRadii: number;
  throughMt: number;
  energyMt: number;
  category: string;
  plan: string;
  nEvents: number;
  score: number;
  research: number;
  lesson: string;
}

export function debriefNarrative(f: DebriefFacts): Narrative {
  const vars = {
    round: f.round,
    margin: `${f.marginRadii >= 0 ? '+' : ''}${f.marginRadii.toFixed(2)}`,
    through: fmtMt(f.throughMt),
    energy: fmtMt(f.energyMt),
    category: f.category,
    plan: f.plan,
    nEvents: f.nEvents,
    score: f.score,
    research: f.research,
    lesson: f.lesson,
  };
  return render(T.DEBRIEF[f.outcome], vars);
}

/** Every character count of a narrative (for the teletype's speed). */
export function narrativeLength(n: Narrative): number {
  return n.header.text.length + n.lines.reduce((a, l) => a + l.text.length, 0);
}
