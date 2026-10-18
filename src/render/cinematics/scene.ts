// WHAT: Cinematic scenes as data: what the few-second animation of an event contains, built once.
// WHY:  GAME_PLAN 29: every clock-passing event (launch, impact, breakup, nuclear, PI, close approach)
//       gets a 2 to 5 second vector animation in the PERIMETER style, drawn from the resolved numbers.
//       Building the scene here, with no Surface in sight, makes it testable and deterministic: the same
//       event with the same context gives the same shards and particles every time.
// HOW:  `buildScene(event, companion, ctx)` seeds an Rng from (kind, t, mission id) and emits particles,
//       shards, rings and cracks whose positions are closed-form functions of elapsed time (x0 + v t +
//       0.5 a t^2), so rendering never mutates and skipping is free. Scene space is px around an origin
//       the drawer picks; the drawer (draw.ts) scales for the window. Body types pick the breakup style:
//       RUBBLE crumbles, STONY cracks, IRON rings and sheds, ICY puffs.
// LORE: D3 (kinetic and beta), D4 (fragmentation), D5 (nuclear), D10 (last resorts), O12 (close approach)

import { KNOBS } from '../../config/knobs';
import type { SimEventRecord } from '../../sim/eventLog';
import { hashSeed, Rng } from '../../sim/rng';
import type { ThreatTypeId } from '../../sim/threat';
import type { Role } from '../palettes';

export type CineKind = 'LAUNCH' | 'IMPACT' | 'FRAGMENTATION' | 'NUKE' | 'PI' | 'CLOSE_APPROACH';
export const CINE_KINDS: readonly CineKind[] = ['LAUNCH', 'IMPACT', 'FRAGMENTATION', 'NUKE', 'PI', 'CLOSE_APPROACH'];

export interface CineContext {
  name: string;
  typeId: ThreatTypeId;
  /** Threat diameter, m. */
  D: number;
  /** Seeded outline: vertex radius multipliers. */
  shape: ArrayLike<number>;
  /** Beta of a fresh impact is hidden until assessed: ejecta then do not encode it. */
  betaHidden: boolean;
  energyMt: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Downward acceleration (launch debris), px/s^2. */
  ay: number;
  t0: number;
  life: number;
  size: number;
  role: Role;
}

export interface Shard {
  /** Local polygon, flat [x0, y0, x1, y1, ...]. */
  pts: number[];
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot0: number;
  spin: number;
  t0: number;
  role: Role;
  width: number;
}

export interface Ring {
  x: number;
  y: number;
  t0: number;
  dur: number;
  r0: number;
  r1: number;
  role: Role;
  dash?: readonly number[];
}

export interface Crack {
  pts: number[];
  t0: number;
  dur: number;
}

export interface Streak {
  from: [number, number];
  to: [number, number];
  /** Scene seconds when it reaches `to`. */
  tArrive: number;
  /** Continue past `to` along the same line (a fuze failure, PI rods passing). */
  passThrough: boolean;
  role: Role;
  tail: number;
}

export interface Scene {
  kind: CineKind;
  seed: number;
  duration: number;
  /** Scene seconds of the hit (sound cue, body swap). 0 for a launch. */
  hitAt: number;
  title: string;
  subtitle: string;
  titleRole: Role;
  /** Unit-radius outline [x, y, ...] of the body, or empty (LAUNCH). */
  body: number[];
  bodyR: number;
  /** Outline after the hit (crater notch, remnant) or null when the body is gone. */
  bodyAfter: number[] | null;
  bodyDrift: { vx: number; vy: number };
  streak: Streak | null;
  rods: number;
  rings: Ring[];
  cracks: Crack[];
  particles: Particle[];
  shards: Shard[];
  launch: { tier: number; stages: number[] } | null;
  approach: { homeR: number; ringR: number; d: number; impact: boolean; angle: number; sHit: number } | null;
}

/** Screen radius of a body from its diameter: 10 m -> 60 px, 100 m -> 90, 1 km -> 120, 10 km -> 150. */
export function bodyRadiusPx(D: number): number {
  return Math.max(50, Math.min(170, 60 + 30 * Math.log10(Math.max(1, D) / 10)));
}

/** Unit polygon from the seeded outline multipliers. */
export function outline(shape: ArrayLike<number>): number[] {
  const n = shape.length;
  const pts: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = shape[i] ?? 1;
    pts.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  return pts;
}

/** Push the vertices within `halfWidth` rad of `angle` inward by `depth` (a crater). */
export function notch(pts: number[], angle: number, halfWidth: number, depth: number): number[] {
  const out = pts.slice();
  for (let i = 0; i + 1 < out.length; i += 2) {
    const x = out[i] ?? 0;
    const y = out[i + 1] ?? 0;
    let da = Math.atan2(y, x) - angle;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    if (Math.abs(da) <= halfWidth) {
      const f = 1 - depth * (1 - Math.abs(da) / halfWidth);
      out[i] = x * f;
      out[i + 1] = y * f;
    }
  }
  return out;
}

/** The launch ascent arc: pad at (0, 0), rising to the right. u in [0, 1]. Tier stretches it. */
export function launchArc(u: number, tier: number): [number, number, number, number] {
  const f = 0.8 + 0.2 * tier;
  const p1x = 50 * f;
  const p1y = -380 * f;
  const p2x = 380 * f;
  const p2y = -300 * f;
  const v = 1 - u;
  const x = 2 * v * u * p1x + u * u * p2x;
  const y = 2 * v * u * p1y + u * u * p2y;
  // Tangent of the quadratic Bezier.
  const tx = 2 * v * p1x + 2 * u * (p2x - p1x);
  const ty = 2 * v * p1y + 2 * u * (p2y - p1y);
  const len = Math.hypot(tx, ty) || 1;
  return [x, y, tx / len, ty / len];
}

/** Launch progress: ease-in so the first second lingers on the pad. */
export function launchProgress(elapsed: number, duration: number): number {
  const u = Math.max(0, Math.min(1, elapsed / (duration * 0.92)));
  return Math.pow(u, 1.5);
}

/** Position of the approaching body along its straight path at scene time t. */
export function approachPos(a: NonNullable<Scene['approach']>, t: number): [number, number] {
  const s = -520 + ((t - 0.3) / 3.0) * 1040;
  const sc = a.impact ? Math.min(s, a.sHit) : s;
  const ux = Math.cos(a.angle);
  const uy = Math.sin(a.angle);
  // Perpendicular offset puts the path a distance d above the planet's centre.
  return [sc * ux - uy * a.d, sc * uy + ux * a.d];
}

function burst(rng: Rng, out: Particle[], x: number, y: number, count: number, lo: number, hi: number, lifeLo: number, lifeHi: number, t0: number, role: Role, size: number, dir?: number, spread = Math.PI): void {
  for (let i = 0; i < count; i++) {
    const a = dir === undefined ? rng.float(0, Math.PI * 2) : dir + rng.float(-spread, spread);
    const v = rng.float(lo, hi);
    out.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, ay: 0, t0, life: rng.float(lifeLo, lifeHi), size, role });
  }
}

function irregular(rng: Rng, r: number): number[] {
  const n = rng.int(4, 7);
  const pts: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.float(-0.2, 0.2);
    const rr = r * rng.float(0.6, 1.1);
    pts.push(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  return pts;
}

/** Shards of a body of radius R: sizes fall as (1/(i+1))^0.6 from the largest remnant. */
function makeShards(rng: Rng, out: Shard[], R: number, count: number, largestFrac: number, lo: number, hi: number, spin: number, t0: number, role: Role, width = 1): void {
  for (let i = 0; i < count; i++) {
    const size = Math.max(3, R * largestFrac * Math.pow(1 / (i + 1), 0.6));
    const a = rng.float(0, Math.PI * 2);
    const rr = R * 0.7 * Math.sqrt(rng.next());
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr;
    const dir = Math.atan2(y, x) + rng.float(-0.5, 0.5);
    const v = rng.float(lo, hi);
    out.push({ pts: irregular(rng, size), x, y, vx: Math.cos(dir) * v, vy: Math.sin(dir) * v, rot0: rng.float(0, Math.PI * 2), spin: rng.float(-spin, spin), t0, role, width });
  }
}

function sceneSeed(e: SimEventRecord): number {
  const id = 'missionId' in e ? e.missionId : 'bodyId' in e ? e.bodyId ?? 'THREAT' : '';
  return hashSeed(`${e.kind}#${e.t}#${id}`);
}

function duration(kind: CineKind): number {
  return KNOBS.CINEMATIC_SECONDS[kind] ?? 3;
}

function base(kind: CineKind, e: SimEventRecord, ctx: CineContext): Scene {
  const R = bodyRadiusPx(ctx.D);
  return {
    kind,
    seed: sceneSeed(e),
    duration: duration(kind),
    hitAt: 0,
    title: '',
    subtitle: '',
    titleRole: 'threat',
    body: outline(ctx.shape),
    bodyR: R,
    bodyAfter: null,
    bodyDrift: { vx: 0, vy: 0 },
    streak: null,
    rods: 0,
    rings: [],
    cracks: [],
    particles: [],
    shards: [],
    launch: null,
    approach: null,
  };
}

/** Which events get a scene, and which later event in the same frame joins it (IMPACT + FRAGMENTATION). */
export function groupEvents(events: readonly SimEventRecord[]): { main: SimEventRecord; companion: SimEventRecord | null }[] {
  const out: { main: SimEventRecord; companion: SimEventRecord | null }[] = [];
  const used = new Set<SimEventRecord>();
  for (const e of events) {
    if (used.has(e)) continue;
    if (e.kind === 'FRAGMENTATION') {
      // A breakup caused by an impact or a burst in this frame absorbs that event's scene.
      const cause = events.find((c) => !used.has(c) && c !== e && (c.kind === 'IMPACT' || c.kind === 'NUKE') && c.missionId === e.missionId && c.t === e.t);
      if (cause) used.add(cause);
      used.add(e);
      out.push({ main: e, companion: cause ?? null });
      continue;
    }
    if (e.kind === 'IMPACT' || e.kind === 'NUKE') {
      const frag = events.find((c) => !used.has(c) && c.kind === 'FRAGMENTATION' && c.missionId === e.missionId && c.t === e.t);
      if (frag) {
        used.add(e);
        used.add(frag);
        out.push({ main: frag, companion: e });
        continue;
      }
    }
    if ((CINE_KINDS as readonly string[]).includes(e.kind)) {
      used.add(e);
      out.push({ main: e, companion: null });
    }
  }
  return out;
}

const STREAK_FROM: [number, number] = [-620, -70];

function kms(v: number): string {
  return `${(v / 1000).toFixed(1)} KM/S`;
}

export function buildScene(e: SimEventRecord, companion: SimEventRecord | null, ctx: CineContext): Scene | null {
  if (!(CINE_KINDS as readonly string[]).includes(e.kind)) return null;
  const sc = base(e.kind as CineKind, e, ctx);
  const rng = new Rng(sc.seed);
  const R = sc.bodyR;
  switch (e.kind) {
    case 'LAUNCH': {
      const tier = Math.max(1, Math.min(3, e.tier));
      sc.launch = { tier, stages: tier === 1 ? [] : tier === 2 ? [0.4] : [0.33, 0.66] };
      sc.titleRole = 'craft';
      sc.title = `${e.missionId} LAUNCH`;
      sc.subtitle = `L${tier} LAUNCHER   ${e.massKg.toFixed(0)} KG   C3 ${e.c3.toFixed(1)} KM2/S2`;
      const n = 140 * tier;
      for (let i = 0; i < n; i++) {
        const t0 = rng.float(0.05, sc.duration * 0.9);
        const [x, y, tx, ty] = launchArc(launchProgress(t0, sc.duration), tier);
        const v = rng.float(40, 100);
        sc.particles.push({ x: x + rng.float(-3, 3), y: y + rng.float(-3, 3), vx: -tx * v + rng.float(-25, 25), vy: -ty * v + rng.float(-25, 25), ay: 0, t0, life: rng.float(0.4, 0.9), size: 3, role: 'nuclear' });
      }
      for (const u of sc.launch.stages) {
        const t0 = Math.pow(u, 1 / 1.5) * sc.duration * 0.92;
        const [x, y, tx, ty] = launchArc(u, tier);
        burst(rng, sc.particles, x, y, 14, 30, 80, 0.3, 0.6, t0, 'craft', 2);
        sc.shards.push({ pts: [-7, 0, 7, 0], x, y, vx: tx * 25, vy: ty * 25 + 10, rot0: Math.atan2(ty, tx), spin: rng.float(-3, 3), t0, role: 'craft', width: 1 });
        const last = sc.shards[sc.shards.length - 1];
        if (last) sc.particles.push({ x, y, vx: tx * 25, vy: ty * 25, ay: 90, t0, life: 1.4, size: 2, role: 'craft' });
      }
      break;
    }
    case 'IMPACT': {
      sc.hitAt = 1.0;
      sc.titleRole = 'craft';
      sc.streak = { from: STREAK_FROM, to: [-R, 0], tArrive: sc.hitAt, passThrough: false, role: 'craft', tail: 90 + 50 * Math.min(2, e.U / 20000) };
      sc.rings.push({ x: -R, y: 0, t0: sc.hitAt, dur: 0.35, r0: 2, r1: R * 0.8, role: 'craft' });
      const count = ctx.betaHidden ? 60 : Math.round(40 + 80 * Math.min(3, Math.max(0, e.beta - 1)));
      burst(rng, sc.particles, -R, 0, count, 80, 260, 0.6, 1.8, sc.hitAt, 'threat', 3, Math.PI, 0.9);
      burst(rng, sc.particles, -R, 0, 30, 15, 60, 1.0, 2.4, sc.hitAt, 'fragment', 2, Math.PI, 1.2);
      sc.bodyAfter = notch(sc.body, Math.PI, 0.5, 0.22);
      sc.bodyDrift = { vx: 6, vy: 0 };
      sc.title = `${e.missionId} IMPACT  U ${kms(e.U)}`;
      sc.subtitle = ctx.betaHidden ? `BETA ?  (ASSESSMENT PENDING)` : `BETA ${e.beta.toFixed(2)}   dV ${(e.dvTotal * 1000).toFixed(2)} MM/S${e.qRatio !== undefined ? `   Q/Q* ${e.qRatio.toFixed(2)}` : ''}`;
      break;
    }
    case 'FRAGMENTATION': {
      const hit = companion ? 0.9 : 0.6;
      sc.hitAt = hit;
      sc.titleRole = 'fragment';
      if (companion?.kind === 'IMPACT') {
        sc.streak = { from: STREAK_FROM, to: [-R, 0], tArrive: hit, passThrough: false, role: 'craft', tail: 50 };
        sc.rings.push({ x: -R, y: 0, t0: hit, dur: 0.3, r0: 2, r1: R * 0.9, role: 'craft' });
      } else if (companion?.kind === 'NUKE') {
        const off = companion.mode === 'STANDOFF' ? R * 0.45 : 0;
        sc.streak = { from: STREAK_FROM, to: [-R - off, 0], tArrive: hit, passThrough: false, role: 'nuclear', tail: 50 };
        sc.rings.push({ x: -R - off, y: 0, t0: hit, dur: 0.5, r0: 4, r1: R * 2.4, role: 'nuclear' });
        burst(rng, sc.particles, -R - off, 0, 50, 100, 300, 0.2, 0.5, hit, 'nuclear', 2);
      }
      sc.rings.push({ x: 0, y: 0, t0: hit, dur: 0.4, r0: R * 0.5, r1: R * 1.6, role: 'fragment' });
      const largestFrac = Math.min(0.6, Math.max(0.08, e.largestD / Math.max(1, ctx.D)));
      const verb = ctx.typeId;
      switch (verb) {
        case 'RUBBLE':
          makeShards(rng, sc.shards, R, Math.min(e.count, 48), largestFrac, 12, 45, 1, hit, 'fragment');
          burst(rng, sc.particles, 0, 0, 140, 10, 45, 1.5, 3.0, hit, 'fragment', 1);
          break;
        case 'STONY': {
          for (let i = 0; i < 6; i++) {
            const a = rng.float(-Math.PI, Math.PI);
            const r = R * rng.float(0.8, 1.05);
            sc.cracks.push({ pts: [-R, 0, Math.cos(a) * r * 0.4 - R * 0.3, Math.sin(a) * r * 0.4, Math.cos(a) * r, Math.sin(a) * r], t0: hit, dur: 0.3 });
          }
          makeShards(rng, sc.shards, R, Math.min(e.count, 14), largestFrac, 30, 90, 2, hit + 0.3, 'fragment');
          burst(rng, sc.particles, -R * 0.5, 0, 50, 40, 120, 0.4, 1.0, hit, 'threat', 2);
          break;
        }
        case 'IRON':
          for (let i = 0; i < 3; i++) sc.rings.push({ x: 0, y: 0, t0: hit + i * 0.12, dur: 0.8, r0: R, r1: R * 2.6, role: 'threat', dash: [4, 4] });
          makeShards(rng, sc.shards, R, Math.min(e.count, 6), Math.min(0.3, largestFrac), 90, 160, 4, hit, 'fragment', 2);
          burst(rng, sc.particles, -R, 0, 60, 80, 220, 0.2, 0.6, hit, 'danger', 2, Math.PI, 1.0);
          sc.bodyAfter = notch(sc.body.map((v) => v * 0.85), Math.PI, 0.6, 0.25);
          sc.bodyDrift = { vx: 10, vy: 0 };
          break;
        case 'ICY':
          burst(rng, sc.particles, 0, 0, 220, 90, 220, 0.5, 1.4, hit, 'fragment', 1);
          burst(rng, sc.particles, 0, 0, 60, 20, 60, 1.5, 2.5, hit, 'text', 1);
          makeShards(rng, sc.shards, R, Math.min(e.count, 8), largestFrac * 0.6, 20, 60, 1.5, hit, 'fragment');
          break;
      }
      const VERB: Record<ThreatTypeId, string> = { RUBBLE: 'CRUMBLES', STONY: 'CRACKS', IRON: 'RINGS AND SHEDS', ICY: 'PUFFS INTO DUST' };
      sc.title = `${e.targetId} ${VERB[verb]}`;
      sc.subtitle = `Q/Q* ${e.qRatio.toFixed(2)}   ${e.count} PIECES   LARGEST ${e.largestD.toFixed(0)} M   V-EJ ${e.vEj.toFixed(2)} M/S${e.escaped ? `   ${e.escaped} ESCAPED` : ''}`;
      break;
    }
    case 'NUKE': {
      sc.hitAt = 0.9;
      sc.titleRole = 'nuclear';
      const standoff = e.mode === 'STANDOFF' || e.mode === 'PULSE_TRAIN';
      const off = standoff ? R * 0.45 : 0;
      if (!e.fuzed) {
        sc.streak = { from: STREAK_FROM, to: [-R - off, 0], tArrive: sc.hitAt, passThrough: true, role: 'nuclear', tail: 50 };
        sc.title = `${e.missionId} FUZE FAILED`;
        sc.subtitle = `CLOSING SPEED TOO HIGH FOR THE FUZE   ${e.yieldMt} MT UNFIRED`;
        sc.titleRole = 'danger';
        break;
      }
      sc.streak = { from: STREAK_FROM, to: [-R - off, 0], tArrive: sc.hitAt, passThrough: false, role: 'nuclear', tail: 50 };
      const pulses = Math.max(1, Math.min(5, e.pulses));
      for (let p = 0; p < pulses; p++) {
        const t0 = sc.hitAt + p * 0.45;
        sc.rings.push({ x: -R - off, y: 0, t0, dur: 0.5, r0: 4, r1: R * 2.2, role: 'nuclear' });
        sc.rings.push({ x: -R - off, y: 0, t0: t0 + 0.05, dur: 0.6, r0: 2, r1: R * 1.3, role: 'nuclear', dash: [2, 3] });
        burst(rng, sc.particles, -R - off, 0, 50, 100, 300, 0.2, 0.5, t0, 'nuclear', 2);
        // Ablation: the facing hemisphere boils off away from the burst.
        for (let i = 0; i < 60; i++) {
          const a = Math.PI + rng.float(-1.1, 1.1);
          const v = rng.float(40, 120);
          sc.particles.push({ x: Math.cos(a) * R, y: Math.sin(a) * R, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.3, ay: 0, t0: t0 + 0.05, life: rng.float(0.6, 1.5), size: 2, role: 'threat' });
        }
      }
      if (!standoff) sc.bodyAfter = notch(sc.body, Math.PI, 0.55, 0.3);
      sc.bodyDrift = { vx: 8, vy: 0 };
      sc.title = `${e.missionId} ${e.mode} BURST  ${e.yieldMt} MT${pulses > 1 ? ` X ${pulses}` : ''}`;
      sc.subtitle = `dV ${(e.dv * 1000).toFixed(2)} MM/S   Q/Q* ${e.qRatio.toFixed(2)}   ${e.qRatio >= 1 ? 'DISRUPTED' : 'INTACT'}`;
      break;
    }
    case 'PI': {
      sc.hitAt = 0.8;
      sc.rods = 9;
      sc.titleRole = 'fragment';
      sc.streak = { from: STREAK_FROM, to: [-R, 0], tArrive: sc.hitAt, passThrough: !e.ok, role: 'craft', tail: 120 };
      if (e.ok) {
        sc.rings.push({ x: 0, y: 0, t0: sc.hitAt, dur: 0.4, r0: R * 0.4, r1: R * 1.8, role: 'fragment' });
        makeShards(rng, sc.shards, R, 40, 0.12, 80, 200, 5, sc.hitAt, 'fragment');
        burst(rng, sc.particles, 0, 0, 160, 60, 180, 0.6, 1.6, sc.hitAt, 'fragment', 1);
        sc.title = `${e.missionId} PI ARRAY ON ${e.targetId}`;
        sc.subtitle = `${e.D.toFixed(0)} M SHREDDED   AIRBURSTS   ${e.damageMt.toFixed(2)} MT OF DAMAGE`;
      } else {
        sc.title = `${e.missionId} PI FAILED`;
        sc.subtitle = e.reason.toUpperCase();
        sc.titleRole = 'danger';
      }
      break;
    }
    case 'CLOSE_APPROACH': {
      const homeR = 70;
      const ringR = homeR * 1.35;
      const ratio = e.bCrit > 0 ? e.dMin / e.bCrit : 2;
      const d = e.impact ? homeR * Math.min(0.9, ratio) : Math.min(320, Math.max(ringR + 4, ringR * ratio));
      const angle = -0.35;
      const sHit = e.impact ? -Math.sqrt(Math.max(0, homeR * homeR - d * d)) : -Infinity;
      sc.approach = { homeR, ringR, d, impact: e.impact, angle, sHit };
      sc.bodyR = Math.max(8, Math.min(18, bodyRadiusPx(ctx.D) * 0.18));
      sc.titleRole = e.impact ? 'danger' : 'planet';
      if (e.impact) {
        // Time at which the body reaches sHit along its path.
        sc.hitAt = 0.3 + ((sHit + 520) / 1040) * 3.0;
        const [hx, hy] = approachPos(sc.approach, sc.hitAt);
        sc.rings.push({ x: hx, y: hy, t0: sc.hitAt, dur: 0.6, r0: 4, r1: homeR * 1.2, role: 'danger' });
        sc.rings.push({ x: hx, y: hy, t0: sc.hitAt + 0.1, dur: 0.9, r0: 2, r1: homeR * 2.0, role: 'danger', dash: [3, 3] });
        burst(rng, sc.particles, hx, hy, 120, 60, 220, 0.5, 1.5, sc.hitAt, 'danger', 2);
        makeShards(rng, sc.shards, sc.bodyR, 10, 0.5, 40, 120, 4, sc.hitAt, 'threat');
        sc.title = `${e.bodyId ?? ctx.name} IMPACT`;
        sc.subtitle = `${ctx.energyMt < 10 ? ctx.energyMt.toFixed(1) : ctx.energyMt.toFixed(0)} MT   D ${(e.dMin / 1000).toFixed(0)} KM INSIDE B-CRIT ${(e.bCrit / 1000).toFixed(0)} KM`;
      } else {
        sc.hitAt = 1.8;
        sc.title = `${e.bodyId ?? ctx.name} CLOSE APPROACH: MISS`;
        sc.subtitle = `MISS BY ${e.marginRadii.toFixed(2)} R   D ${(e.dMin / 1000).toFixed(0)} KM   B-CRIT ${(e.bCrit / 1000).toFixed(0)} KM`;
      }
      break;
    }
    default:
      return null;
  }
  return sc;
}
