// WHAT: The detection model and the discovery search (GAME_PLAN 18.1, 18.2).
// WHY:  "How many years of warning do I get" is computed from physics and from what the player has built,
//       not drawn from a hat. Ground surveys need the rock bright and away from the sun; infrared
//       surveyors in space see heat and can look closer to the sun; radar only tracks what is already found.
// HOW:  For each night from t_i - DISCOVERY_YEARS to t_i every active network evaluates `detects`. A network
//       discovers on its DISCOVERY_NIGHTS-th consecutive detection; the earliest discovery across networks
//       sets the lead. Observers: HOME for ground, L1 and lunar sites (close enough at this scale), INNER
//       for a Venus-orbit surveyor, L4/L5 at HOME +/- 60 deg on HOME's orbit. Sky coverage is a per-night
//       Bernoulli from the round's Rng, so the search is deterministic per seed.
// LORE: F1 (moving dots), F3 (sunward blind spot), F4 (seeing heat), F5 (today's surveys), F6 (radar)

import networksJson from '../config/networks.json';
import { KNOBS } from '../config/knobs';
import { propagate, type Elements } from '../physics/kepler';
import { propagate3 } from '../physics/kepler3';
import { absoluteMagnitude, apparentMagnitude, viewGeometry } from '../physics/photometry';
import type { Vec2 } from '../util/vec';
import type { Rng } from './rng';
import { is3D } from './orbit3';
import { coverage, eclipticLatitude, nodeLine, tiltAboutNode, trailingLoss, viewGeometry3, type Vec3 } from './sky';

export type NetworkKind = 'GROUND_OPTICAL' | 'SPACE_IR' | 'RADAR' | 'COORDINATION' | 'AIRBURST';
export type Tag = 'REAL' | 'PROPOSED' | 'SPECULATIVE' | 'FICTION';

export interface Network {
  id: string;
  name: string;
  tag: Tag;
  kind: NetworkKind;
  observer: 'HOME' | 'INNER' | 'L4' | 'L5';
  active: boolean;
  note: string;
  vLim?: number;
  epsMin?: number;
  epsMax?: number;
  pCover?: number;
  dRef?: number;
  rDeltaRef?: number;
  rangeMaxAu?: number;
  sigmaVTier?: number;
  /** Calendar year the network began (planned ones: set when their program completes). */
  since: number;
}

export const NETWORKS = (networksJson as { networks: Network[] }).networks;

export function networkById(id: string): Network {
  const n = NETWORKS.find((x) => x.id === id);
  if (!n) throw new Error(`no network ${id}`);
  return n;
}

/** The set active today (2026). */
export function defaultActiveNetworks(): string[] {
  return NETWORKS.filter((n) => n.active).map((n) => n.id);
}

/** Observer position for a network given HOME's and INNER's heliocentric positions. */
export function observerPosition(n: Network, home: Vec2, inner: Vec2): Vec2 {
  switch (n.observer) {
    case 'INNER':
      return inner;
    case 'L4': {
      const c = Math.cos(Math.PI / 3);
      const s = Math.sin(Math.PI / 3);
      return { x: home.x * c - home.y * s, y: home.x * s + home.y * c };
    }
    case 'L5': {
      const c = Math.cos(-Math.PI / 3);
      const s = Math.sin(-Math.PI / 3);
      return { x: home.x * c - home.y * s, y: home.x * s + home.y * c };
    }
    default:
      return home;
  }
}

/** True within MOON_PENALTY_DAYS of full moon (full at t = 0 mod the synodic month). */
export function nearFullMoon(t: number): boolean {
  const phase = ((t % KNOBS.SYNODIC_MONTH) + KNOBS.SYNODIC_MONTH) % KNOBS.SYNODIC_MONTH;
  const d = Math.min(phase, KNOBS.SYNODIC_MONTH - phase);
  return d <= KNOBS.MOON_PENALTY_DAYS * 86400;
}

export interface DetectInput {
  t: number;
  /** Threat heliocentric position, m. */
  rT: Vec2;
  home: Vec2;
  inner: Vec2;
  D: number;
  albedo: number;
}

/** One network, one night: does it detect? Coverage draws from `rng` only for ground surveys. */
export function detects(n: Network, inp: DetectInput, rng: Rng): boolean {
  const obs = observerPosition(n, inp.home, inp.inner);
  const g = viewGeometry(inp.rT, obs);
  if (n.kind === 'GROUND_OPTICAL') {
    if (g.epsDeg < (n.epsMin ?? 60)) return false;
    const H = absoluteMagnitude(inp.D, inp.albedo);
    const V = apparentMagnitude(H, g.rAu, g.deltaAu, g.alphaDeg);
    let vLim = n.vLim ?? 20;
    if (nearFullMoon(inp.t)) vLim -= KNOBS.MOON_PENALTY_MAG;
    if (V > vLim) return false;
    return rng.chance(n.pCover ?? 0.5);
  }
  if (n.kind === 'SPACE_IR') {
    if (g.epsDeg < (n.epsMin ?? 45) || g.epsDeg > (n.epsMax ?? 120)) return false;
    const need = (n.dRef ?? 140) * ((g.rAu * g.deltaAu) / (n.rDeltaRef ?? 0.5));
    return inp.D >= need;
  }
  return false; // RADAR, COORDINATION, AIRBURST never discover
}

export interface DiscoveryResult {
  /** Discovery time, s (same clock as tImpact), or null if never discovered. */
  tDisc: number | null;
  lead: number;
  networkId: string | null;
}

export interface DiscoveryInput {
  threat: Elements;
  home: Elements;
  inner: Elements;
  muSun: number;
  tImpact: number;
  D: number;
  albedo: number;
  activeIds: readonly string[];
  /** Activation year overrides (programs completing in-game set these). */
  sinceOverride?: Readonly<Record<string, number>>;
  /** Search this many years before impact (default DISCOVERY_YEARS). */
  windowYears?: number;
  /**
   * 3-D lite (sim/sky.ts): the orbit tilted by `incl` about the node line at angle `node`. With it, detection uses
   * the 3-D view geometry, ground trailing loss and latitude-dependent coverage; without it, the flat model.
   * A threat whose elements carry i and raan (M14 phase 2) takes the same 3-D rules from its own orbit, no tilt.
   */
  tilt?: { incl: number; node: number };
}

/**
 * A night's detection test for a target off the plane: same rules as `detects`, in 3-D, with trailing loss. The
 * position is the 3-D orbit's own (elements with i and raan) or, for the 3-D lite tilt, the tilted planar one.
 */
function tiltedSeen(inp: DiscoveryInput, t: number, home: Vec2, inner: Vec2): (n: Network, rng: Rng) => boolean {
  const vHome = propagate(inp.home, inp.muSun, t).v;
  let r3: Vec3;
  let v3: Vec3;
  if (is3D(inp.threat)) {
    const s3 = propagate3(inp.threat, inp.muSun, t);
    r3 = { ...s3.r };
    v3 = { ...s3.v };
  } else {
    const tl = inp.tilt as { incl: number; node: number };
    const st = propagate(inp.threat, inp.muSun, t);
    const nl = nodeLine(tl.node);
    r3 = tiltAboutNode(st.r, nl, tl.incl);
    v3 = tiltAboutNode(st.v, nl, tl.incl);
  }
  const H = absoluteMagnitude(inp.D, inp.albedo);
  return (n, rng) => {
    const obs = observerPosition(n, home, inner);
    const g = viewGeometry3(r3, v3, obs, vHome);
    if (n.kind === 'GROUND_OPTICAL') {
      if (g.epsDeg < (n.epsMin ?? 60)) return false;
      const vLim = (n.vLim ?? 20) - (nearFullMoon(t) ? KNOBS.MOON_PENALTY_MAG : 0) - trailingLoss(g.rate);
      if (apparentMagnitude(H, g.rAu, g.deltaAu, g.alphaDeg) > vLim) return false;
      return rng.next() < coverage(n, g.epsDeg, eclipticLatitude(r3, obs));
    }
    if (n.kind === 'SPACE_IR') {
      if (g.epsDeg < (n.epsMin ?? 45) || g.epsDeg > (n.epsMax ?? 120)) return false;
      return inp.D >= (n.dRef ?? 140) * ((g.rAu * g.deltaAu) / (n.rDeltaRef ?? 0.5));
    }
    return false;
  };
}

/** Calendar year of round time t (t = 0 is EPOCH_YEAR). */
export const yearOf = (t: number): number => KNOBS.EPOCH_YEAR + t / 3.15576e7;

/**
 * Discovery search (18.2). Steps one day from tImpact - DISCOVERY_YEARS to tImpact; each active discovering
 * network keeps a consecutive-night counter. Returns the earliest discovery.
 */
export function discover(inp: DiscoveryInput, rng: Rng): DiscoveryResult {
  const nets = inp.activeIds.map(networkById).filter((n) => n.kind === 'GROUND_OPTICAL' || n.kind === 'SPACE_IR');
  const sinceOf = (n: Network): number => inp.sinceOverride?.[n.id] ?? n.since;
  const streak = new Map<string, number>();
  const t0 = inp.tImpact - (inp.windowYears ?? KNOBS.DISCOVERY_YEARS) * 3.15576e7;
  const three = is3D(inp.threat);
  for (let t = t0; t < inp.tImpact; t += KNOBS.DISCOVERY_STEP) {
    const year = yearOf(t);
    const home = propagate(inp.home, inp.muSun, t).r;
    const inner = propagate(inp.inner, inp.muSun, t).r;
    const tiltSeen = inp.tilt || three ? tiltedSeen(inp, t, home, inner) : null;
    const d: DetectInput | null = tiltSeen ? null : { t, rT: propagate(inp.threat, inp.muSun, t).r, home, inner, D: inp.D, albedo: inp.albedo };
    for (const n of nets) {
      if (year < sinceOf(n)) continue;
      if (tiltSeen ? tiltSeen(n, rng) : detects(n, d as DetectInput, rng)) {
        const k = (streak.get(n.id) ?? 0) + 1;
        if (k >= KNOBS.DISCOVERY_NIGHTS) return { tDisc: t, lead: inp.tImpact - t, networkId: n.id };
        streak.set(n.id, k);
      } else {
        streak.set(n.id, 0);
      }
    }
  }
  return { tDisc: null, lead: 0, networkId: null };
}
