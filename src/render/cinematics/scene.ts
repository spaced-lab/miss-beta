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
import { cratered, fracture, makeBody, restingChunk, type Chunk } from './solid';

export type CineKind = 'LAUNCH' | 'IMPACT' | 'FRAGMENTATION' | 'NUKE' | 'PI' | 'CLOSE_APPROACH' | 'PUSH';
export const CINE_KINDS: readonly CineKind[] = ['LAUNCH', 'IMPACT', 'FRAGMENTATION', 'NUKE', 'PI', 'CLOSE_APPROACH', 'PUSH'];

/** Push methods with their own scene; any other viable push gets the generic hover-and-pull scene. */
export const PUSH_SCENES: readonly string[] = ['NANOFORGE', 'THRUSTER_SWARM', 'SHEPHERD', 'FUSION_TUG', 'DE_STAR'];

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
  /** PUSH scenes: the method and how many actors (seeds, thruster units). */
  push: { method: string; n: number } | null;
  approach: { homeR: number; ringR: number; d: number; impact: boolean; angle: number; sHit: number } | null;
  /** Other bodies passing in the same frame (a fragment cloud): their offsets from the main path, px. */
  crowd: { d: number; lag: number; hit: boolean }[];
  /** 3-D bodies (solid.ts): the body before the hit, the remnant after (null: gone), the pieces; `camera` backs away
   *  as the cloud grows. Null for a launch. */
  solid: { body: Chunk | null; remnant: Chunk | null; chunks: Chunk[]; camera: boolean } | null;
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
    push: null,
    approach: null,
    crowd: [],
    solid: null,
  };
}

/**
 * The remnant of a hit from the left: the body cratered to `depth` of its radius and scaled by `frac`, recoiling
 * at `vx` px/s and spun up by `kick` rad/s (an off-centre hit). Example: frac 1, depth 0, vx 0, kick 0 is the body.
 */
function remnantOf(body: Chunk, frac: number, depth: number, vx: number, kick: number, t0: number, hot: number): Chunk {
  return { ...body, poly: cratered(body.poly, frac, -1, 0, depth), ax: body.ax + body.wx * t0, ay: body.ay + body.wy * t0, az: body.az + body.wz * t0, vx, vy: 0, vz: 0, wz: body.wz + kick, t0, hot };
}

/** Which events get a scene, and which later event in the same frame joins it (IMPACT + FRAGMENTATION). */
export function groupEvents(events: readonly SimEventRecord[]): { main: SimEventRecord; companion: SimEventRecord | null; crowd?: SimEventRecord[] }[] {
  const out: { main: SimEventRecord; companion: SimEventRecord | null; crowd?: SimEventRecord[] }[] = [];
  const used = new Set<SimEventRecord>();
  // All close approaches in one frame (a fragment cloud passing) are one scene: the most dangerous body leads.
  const cas = events.filter((e): e is Extract<SimEventRecord, { kind: 'CLOSE_APPROACH' }> => e.kind === 'CLOSE_APPROACH');
  if (cas.length > 1) {
    const lead = [...cas].sort((a, b) => Number(b.impact) - Number(a.impact) || a.marginRadii - b.marginRadii)[0];
    if (lead) {
      for (const e of cas) used.add(e);
      out.push({ main: lead, companion: null, crowd: cas.filter((e) => e !== lead) });
    }
  }
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

const DAY_S = 86400;

function kms(v: number): string {
  return `${(v / 1000).toFixed(1)} KM/S`;
}

export function buildScene(e: SimEventRecord, companion: SimEventRecord | null, ctx: CineContext, crowd: readonly SimEventRecord[] = []): Scene | null {
  if (!(CINE_KINDS as readonly string[]).includes(e.kind)) return null;
  const sc = base(e.kind as CineKind, e, ctx);
  const rng = new Rng(sc.seed);
  const R = sc.bodyR;
  // Every scene but a launch has the body as a solid (drawn in 3-D, tumbling slowly); the cases below decide what
  // becomes of it. NOTE: the body's mesh is drawn from the rng first, so the seeded draw order of each case holds.
  if (e.kind !== 'LAUNCH') sc.solid = { body: restingChunk(makeBody(rng), R, rng), remnant: null, chunks: [], camera: true };
  const body = sc.solid?.body ?? null;
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
        // The separation puff; the spent stage itself is a solid drawn by launch.ts (vehicle.ts spentStage).
        burst(rng, sc.particles, x, y, 18, 30, 80, 0.3, 0.6, t0, 'craft', 1.4);
        sc.particles.push({ x, y, vx: tx * 25, vy: ty * 25, ay: 90, t0, life: 1.4, size: 1.4, role: 'craft' });
      }
      break;
    }
    case 'IMPACT': {
      sc.hitAt = 1.0;
      sc.titleRole = 'craft';
      sc.streak = { from: STREAK_FROM, to: [-R, 0], tArrive: sc.hitAt, passThrough: false, role: 'craft', tail: 90 + 50 * Math.min(2, e.U / 20000) };
      sc.rings.push({ x: -R, y: 0, t0: sc.hitAt, dur: 0.35, r0: 2, r1: R * 0.8, role: 'craft' });
      const excess = ctx.betaHidden ? 1 : Math.min(3, Math.max(0, e.beta - 1));
      const count = Math.round(KNOBS.CINE_SPRAY.IMPACT * (0.5 + 0.5 * excess));
      // Ejecta: a cone back toward the impactor (that momentum is beta), fine and hot, plus slow dust that lingers.
      burst(rng, sc.particles, -R, 0, count, 80, 300, 0.6, 1.8, sc.hitAt, 'threat', 1.4, Math.PI, 0.9);
      burst(rng, sc.particles, -R, 0, Math.round(count * 0.4), 15, 70, 1.0, 2.4, sc.hitAt, 'fragment', 1, Math.PI, 1.2);
      sc.bodyAfter = notch(sc.body, Math.PI, 0.5, 0.22);
      sc.bodyDrift = { vx: 6, vy: 0 };
      if (sc.solid && body) {
        // The body recoils along the impactor's line (faster for a bigger beta) and picks up spin from the glancing
        // part of the hit; a handful of rock-sized pieces leave the crater in the ejecta cone.
        sc.solid.remnant = remnantOf(body, 1, 0.22, 6 + 6 * excess, 0.35, sc.hitAt, 0.5);
        sc.solid.chunks = fracture(rng, R, 6 + Math.round(6 * excess), 0.14, 50, 150, 3, sc.hitAt, 'fragment', 0.6, Math.PI, 0.8).map((c) => ({ ...c, x: c.x * 0.3 - R * 0.8, y: c.y * 0.3 }));
      }
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
          // A rubble pile comes apart gently into many pieces of every size and a long-lived dust cloud.
          if (sc.solid) sc.solid.chunks = fracture(rng, R, Math.min(Math.max(e.count, 24), KNOBS.CINE_CHUNKS_MAX), largestFrac, 12, 48, 1.2, hit, 'fragment', 0.25);
          burst(rng, sc.particles, 0, 0, KNOBS.CINE_SPRAY.BREAKUP, 10, 50, 1.5, 3.2, hit, 'fragment', 1.6);
          break;
        case 'STONY': {
          for (let i = 0; i < 6; i++) {
            const a = rng.float(-Math.PI, Math.PI);
            const r = R * rng.float(0.8, 1.05);
            sc.cracks.push({ pts: [-R, 0, Math.cos(a) * r * 0.4 - R * 0.3, Math.sin(a) * r * 0.4, Math.cos(a) * r, Math.sin(a) * r], t0: hit, dur: 0.3 });
          }
          // Cracks race across the face for 0.3 s, then the body goes in a few big pieces and a spray of small ones.
          if (sc.solid) sc.solid.chunks = fracture(rng, R, Math.min(Math.max(e.count, 10), 28), largestFrac, 30, 95, 2.2, hit + 0.3, 'fragment', 0.4);
          burst(rng, sc.particles, -R * 0.5, 0, Math.round(KNOBS.CINE_SPRAY.BREAKUP * 0.6), 40, 140, 0.4, 1.2, hit, 'threat', 1.4);
          burst(rng, sc.particles, 0, 0, Math.round(KNOBS.CINE_SPRAY.BREAKUP * 0.5), 20, 80, 0.8, 2.0, hit + 0.3, 'fragment', 1);
          break;
        }
        case 'IRON':
          for (let i = 0; i < 3; i++) sc.rings.push({ x: 0, y: 0, t0: hit + i * 0.12, dur: 0.8, r0: R, r1: R * 2.6, role: 'threat', dash: [4, 4] });
          // Iron rings and sheds: the core survives, dented and recoiling fast; the shed pieces are hot and quick.
          if (sc.solid && body) {
            sc.solid.remnant = remnantOf(body, 0.85, 0.3, 10, 0.5, hit, 0.6);
            sc.solid.chunks = fracture(rng, R, Math.min(Math.max(e.count, 6), 12), Math.min(0.3, largestFrac), 90, 170, 4, hit, 'fragment', 0.7);
          }
          burst(rng, sc.particles, -R, 0, Math.round(KNOBS.CINE_SPRAY.BREAKUP * 0.5), 80, 240, 0.2, 0.7, hit, 'danger', 1.4, Math.PI, 1.0);
          sc.bodyAfter = notch(sc.body.map((v) => v * 0.85), Math.PI, 0.6, 0.25);
          sc.bodyDrift = { vx: 10, vy: 0 };
          break;
        case 'ICY':
          // A comet puffs into dust: a huge fine spray, slow, and a few icy pieces.
          burst(rng, sc.particles, 0, 0, Math.round(KNOBS.CINE_SPRAY.BREAKUP * 1.5), 90, 240, 0.5, 1.6, hit, 'fragment', 1);
          burst(rng, sc.particles, 0, 0, Math.round(KNOBS.CINE_SPRAY.BREAKUP * 0.4), 20, 70, 1.5, 2.8, hit, 'text', 1);
          if (sc.solid) sc.solid.chunks = fracture(rng, R, Math.min(Math.max(e.count, 6), 14), largestFrac * 0.6, 20, 65, 1.5, hit, 'fragment', 0.3);
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
        for (let i = 0; i < KNOBS.CINE_SPRAY.ABLATION; i++) {
          const a = Math.PI + rng.float(-1.1, 1.1);
          const v = rng.float(40, 120);
          sc.particles.push({ x: Math.cos(a) * R, y: Math.sin(a) * R, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.3, ay: 0, t0: t0 + 0.05, life: rng.float(0.6, 1.5), size: 1, role: 'threat' });
        }
      }
      // A standoff burst ablates the near face but leaves the body whole; a contact burst gouges it.
      sc.bodyAfter = standoff ? sc.body.map((v) => v * 0.97) : notch(sc.body, Math.PI, 0.55, 0.3);
      sc.bodyDrift = { vx: 8, vy: 0 };
      if (sc.solid && body) {
        sc.solid.remnant = remnantOf(body, standoff ? 0.97 : 1, standoff ? 0.04 : 0.3, 8 + 4 * pulses, 0.25, sc.hitAt, 0.8);
        if (!standoff) sc.solid.chunks = fracture(rng, R, 10, 0.12, 60, 160, 3, sc.hitAt, 'fragment', 0.7, Math.PI, 0.9).map((c) => ({ ...c, x: c.x * 0.3 - R * 0.8, y: c.y * 0.3 }));
      }
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
        if (sc.solid) sc.solid.chunks = fracture(rng, R, Math.min(48, KNOBS.CINE_CHUNKS_MAX), 0.12, 80, 220, 5, sc.hitAt, 'fragment', 0.5);
        burst(rng, sc.particles, 0, 0, KNOBS.CINE_SPRAY.BREAKUP, 60, 200, 0.6, 1.8, sc.hitAt, 'fragment', 1);
        sc.title = `${e.missionId} PI ARRAY ON ${e.targetId}`;
        sc.subtitle = `${e.D.toFixed(0)} M SHREDDED   AIRBURSTS   ${e.damageMt.toFixed(2)} MT OF DAMAGE`;
      } else {
        sc.title = `${e.missionId} PI FAILED`;
        sc.subtitle = e.reason.toUpperCase();
        sc.titleRole = 'danger';
      }
      break;
    }
    case 'PUSH': {
      if (!e.viable) return null;
      // The ground laser looks like DE-STAR from the rock's side; the sail depot strikes like the shepherd.
      const alias: Record<string, string> = { GROUND_LASER: 'DE_STAR', SAIL_DEPOT: 'SHEPHERD', SEED_FLEET: 'SHEPHERD' };
      const m0 = alias[e.method] ?? e.method;
      const method = PUSH_SCENES.includes(m0) ? m0 : 'GENERIC';
      sc.push = { method, n: method === 'NANOFORGE' ? 36 : method === 'THRUSTER_SWARM' ? 28 : 1 };
      sc.titleRole = method === 'DE_STAR' ? 'nuclear' : method === 'SHEPHERD' ? 'threat' : 'sail';
      const NAME: Record<string, string> = { GROUND_LASER_: '', NANOFORGE: 'NANOFORGE SEEDS TAKE HOLD', THRUSTER_SWARM: 'THRUSTER SWARM LOCKS ON', SHEPHERD: 'SHEPHERD ROCK INBOUND', FUSION_TUG: 'FUSION TUG DOCKED', DE_STAR: 'DE-STAR ARRAY FIRING', GENERIC: `${e.method.replace(/_/g, ' ')} ON STATION` };
      sc.title = e.method === 'GROUND_LASER' ? 'GROUND LASER FIRING' : e.method === 'SAIL_DEPOT' ? 'PARKED SAILS STRIKE' : e.method === 'SEED_FLEET' ? 'THE SEED FLEET THROWS' : (NAME[method] ?? e.method);
      const f = e.force < 1 ? `${(e.force * 1000).toFixed(2)} MN` : e.force < 1e4 ? `${e.force.toFixed(1)} N` : `${(e.force / 1000).toFixed(1)} KN`;
      const dvTxt = e.dv >= 1 ? `${e.dv.toFixed(2)} M/S` : `${(e.dv * 1000).toFixed(2)} MM/S`;
      // A strike (shepherd, sail depot, seed fleet) is an impulse: no force, no duration, just what it gave.
      sc.subtitle = e.duration < DAY_S ? `${e.targetId}   ONE STRIKE${e.missionId.includes(' X') ? ` (${e.missionId.split(' ').pop()} ROCKS)` : ''}   DV ${dvTxt}` : `${e.targetId}   F ${f}   ${(e.duration / DAY_S).toFixed(0)} D   DV ${dvTxt}`;
      if (method === 'SHEPHERD') {
        sc.hitAt = 1.2;
        sc.streak = { from: STREAK_FROM, to: [-R, 0], tArrive: sc.hitAt, passThrough: false, role: 'threat', tail: 70 };
        sc.rings.push({ x: -R, y: 0, t0: sc.hitAt, dur: 0.5, r0: 4, r1: R * 1.2, role: 'threat' });
        burst(rng, sc.particles, -R, 0, Math.round(KNOBS.CINE_SPRAY.IMPACT * 0.7), 60, 220, 0.5, 1.6, sc.hitAt, 'fragment', 1.4, Math.PI, 0.9);
        sc.bodyAfter = notch(sc.body, Math.PI, 0.5, 0.18);
        sc.bodyDrift = { vx: 8, vy: 0 };
        if (sc.solid && body) {
          sc.solid.remnant = remnantOf(body, 1, 0.18, 8, 0.3, sc.hitAt, 0.4);
          sc.solid.chunks = fracture(rng, R, 6, 0.12, 50, 140, 3, sc.hitAt, 'fragment', 0.5, Math.PI, 0.8).map((c) => ({ ...c, x: c.x * 0.3 - R * 0.8, y: c.y * 0.3 }));
        }
      } else {
        sc.hitAt = method === 'NANOFORGE' ? 2.2 : method === 'THRUSTER_SWARM' ? 1.6 : 0.8;
        sc.bodyAfter = sc.body;
        sc.bodyDrift = { vx: 5, vy: 0 };
        if (sc.solid && body) sc.solid.remnant = remnantOf(body, 1, 0, 5, 0, sc.hitAt, 0);
        if (sc.solid) sc.solid.camera = false;
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
        burst(rng, sc.particles, hx, hy, KNOBS.CINE_SPRAY.IMPACT, 60, 240, 0.5, 1.6, sc.hitAt, 'danger', 1.4);
        if (sc.solid) {
          // The body shatters on the planet: the pieces start where it struck, thrown back up and out.
          sc.solid.chunks = fracture(rng, sc.bodyR, 14, 0.5, 40, 130, 4, sc.hitAt, 'threat', 0.8, Math.atan2(-hy, -hx), 1.1).map((c) => ({ ...c, x: c.x + hx, y: c.y + hy }));
          sc.solid.camera = false;
        }
        sc.title = `${e.bodyId ?? ctx.name} IMPACT`;
        sc.subtitle = `${ctx.energyMt < 10 ? ctx.energyMt.toFixed(1) : ctx.energyMt.toFixed(0)} MT   D ${(e.dMin / 1000).toFixed(0)} KM INSIDE B-CRIT ${(e.bCrit / 1000).toFixed(0)} KM`;
      } else {
        sc.hitAt = 1.8;
        sc.title = `${e.bodyId ?? ctx.name} CLOSE APPROACH: MISS`;
        sc.subtitle = `MISS BY ${e.marginRadii.toFixed(2)} R   D ${(e.dMin / 1000).toFixed(0)} KM   B-CRIT ${(e.bCrit / 1000).toFixed(0)} KM`;
      }
      if (crowd.length > 0) {
        // The rest of the cloud: each piece on a parallel path at its own miss distance, strung out in time.
        let hits = e.impact ? 1 : 0;
        for (const c of crowd) {
          if (c.kind !== 'CLOSE_APPROACH') continue;
          if (c.impact) hits++;
          const r = c.bCrit > 0 ? c.dMin / c.bCrit : 2;
          sc.crowd.push({ d: Math.min(320, homeR * 1.35 * Math.max(0.2, r)) * (rng.chance(0.5) ? 1 : -1), lag: rng.float(-0.8, 0.8), hit: c.impact });
        }
        const n = crowd.length + 1;
        sc.title = `${n} BODIES PASS: ${hits === 0 ? 'ALL MISS' : `${hits} HIT${hits > 1 ? '' : 'S'}`}`;
        sc.titleRole = hits > 0 ? 'danger' : 'planet';
      }
      break;
    }
    default:
      return null;
  }
  return sc;
}
