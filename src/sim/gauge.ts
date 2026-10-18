// WHAT: The detection capability gauge (owner backlog 9): on a log size bar from 1 m to 10 km, the smallest rock
//       the player's networks would catch with enough warning to DEFLECT (1 year), to EVACUATE (3 weeks), from
//       the SUNWARD side (1 year), as an INTERSTELLAR visitor (3 weeks), and AFTERMATH (seen only on impact).
// WHY:  Players, and most people, do not see the gap between "what we can detect" and "what can hurt us": from
//       about 20 m (damage begins) to about 140 m (the catalog is reasonably complete) most rocks are unknown.
//       The needles are computed by the same discovery model the rounds use, so funding a network moves them.
// HOW:  A fixed reference population of colliding orbits (GAUGE_* knobs: approach angles x speeds x impact dates,
//       plus a hyperbolic set) is built once on a reference world. For each impactor and each discovering
//       network, one pass over the nights before impact turns the geometry into a per-night magnitude ceiling
//       Hmax (the faintest H that network sees that night; -Infinity when out of the sky or not covered). Three
//       consecutive nights make a discovery, so a body of magnitude H is found on the first night k where
//       min(Hmax[k-2..k]) >= H; sweeping k once with a running max resolves every size on the grid (bigger is
//       brighter, so the earliest night only gets earlier with size). Coverage draws use a per (impactor,
//       network) Rng, the same draws for every size (common random numbers keep the curve monotone). Those
//       per-network results are cached, so a change of networks only takes a minimum over cached arrays.
//       A needle is the smallest size where at least GAUGE_CATCH_SHARE of its impactors are caught with that
//       much warning, log-interpolated between grid sizes; null if none on the grid is. The reference rocks hit
//       1 to 3 years after the gauge's year and each network searches only from its start year, so a survey
//       that just opened (Rubin in 2026) moves the needles over the following years, as the real catalog fills.
//       The rounds still fly a flat system; the gauge tilts each orbit about its impact node (inclination) and
//       charges ground surveys a trailing loss for fast movers. Without those, every earlier pass of a rock in a
//       flat system is an exact orbit crossing and the needles read about five times too small.
// LORE: F11 (the detection gauge), F3 (the sunward blind spot), F5 (today's surveys), T6 (visitors)

import { KNOBS } from '../config/knobs';
import { AU, YEAR } from '../physics/constants';
import { OrbitError, stateToElements } from '../physics/elements';
import { periapsis, propagate, type Elements } from '../physics/kepler';
import { absoluteMagnitude } from '../physics/photometry';
import { NETWORKS, nearFullMoon, observerPosition, type Network } from './detection';
import { hashSeed, Rng } from './rng';
import { coverage, eclipticLatitude, tiltAboutNode, trailingLoss, viewGeometry3 } from './sky';

export { tiltAboutNode, trailingLoss, viewGeometry3, type Vec3 } from './sky';
import { createWorld, planetById, planetState, type World } from './world';

export type NeedleId = 'DEFLECT' | 'EVACUATE' | 'AFTERMATH' | 'SUNWARD' | 'INTERSTELLAR';
export const NEEDLES: readonly NeedleId[] = ['DEFLECT', 'EVACUATE', 'AFTERMATH', 'SUNWARD', 'INTERSTELLAR'];

/** Size grid, m: GAUGE_GRID_PER_DECADE points a decade from GAUGE_MIN_M to GAUGE_MAX_M. Example: 6 a decade -> 25 points. */
export function sizeGrid(): number[] {
  const n = Math.round(Math.log10(KNOBS.GAUGE_MAX_M / KNOBS.GAUGE_MIN_M) * KNOBS.GAUGE_GRID_PER_DECADE);
  return Array.from({ length: n + 1 }, (_, i) => KNOBS.GAUGE_MIN_M * Math.pow(10, i / KNOBS.GAUGE_GRID_PER_DECADE));
}

interface Impactor {
  el: Elements;
  tImpact: number;
  albedo: number;
  sunward: boolean;
  hyperbolic: boolean;
  /** Inclination, rad: the orbit is tilted about the line from the Sun to the impact point (the node). */
  incl: number;
  /** Unit vector from the Sun to the impact point (the node line). */
  node: { x: number; y: number };
  /** Nights searched before impact. */
  nights: number;
  /** Years from the gauge's "now" to this impact (spread over GAUGE_AHEAD_YEARS). */
  ahead: number;
}

let reference: { world: World; impactors: Impactor[] } | null = null;

/** Angle in degrees between the direction a rock arrives from and the Sun, as seen from HOME at impact. */
export function approachSunAngle(home: { x: number; y: number }, vRel: { x: number; y: number }): number {
  // The rock was at home - vRel * dt before impact, so it arrives from -vRel; the Sun is at -home.
  const c = (vRel.x * home.x + vRel.y * home.y) / (Math.hypot(vRel.x, vRel.y) * Math.hypot(home.x, home.y) || 1);
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
}

function buildReference(): { world: World; impactors: Impactor[] } {
  const world = createWorld('GAUGE-REFERENCE', 1);
  const home = planetById(world, 'HOME');
  const out: Impactor[] = [];
  const add = (vInf: number, phi: number, tImpact: number, hyperbolic: boolean, inclDeg: number, ahead: number): void => {
    const hs = planetState(world, home, tImpact);
    const v = { x: hs.v.x + vInf * Math.cos(phi), y: hs.v.y + vInf * Math.sin(phi) };
    let el: Elements;
    try {
      el = stateToElements(hs.r, v, world.star.mu, tImpact, hyperbolic);
    } catch (e) {
      if (e instanceof OrbitError) return;
      throw e;
    }
    if (hyperbolic !== el.e >= 1) return;
    if (periapsis(el) <= 0.25 * AU) return;
    const sunward = approachSunAngle(hs.r, { x: vInf * Math.cos(phi), y: vInf * Math.sin(phi) }) < KNOBS.GAUGE_SUNWARD_DEG;
    const years = hyperbolic ? KNOBS.GAUGE_HYPERBOLIC_YEARS : KNOBS.GAUGE_WINDOW_YEARS;
    const rn = Math.hypot(hs.r.x, hs.r.y);
    out.push({ el, tImpact, albedo: hyperbolic ? KNOBS.GAUGE_INTERSTELLAR_ALBEDO : KNOBS.GAUGE_ALBEDO, sunward, hyperbolic, incl: (inclDeg * Math.PI) / 180, node: { x: hs.r.x / rn, y: hs.r.y / rn }, ahead, nights: Math.round((years * YEAR) / KNOBS.DISCOVERY_STEP) });
  };
  const nPhi = KNOBS.GAUGE_ANGLES;
  let j = 0;
  for (const vKms of KNOBS.GAUGE_VINF_KMS) {
    for (let i = 0; i < nPhi; i++) {
      // Impact dates spread over a year (moon phase and planet positions vary) and offset per speed.
      const f = (j++ * 0.618034) % 1;
      const ahead = KNOBS.GAUGE_AHEAD_YEARS[0] + f * (KNOBS.GAUGE_AHEAD_YEARS[1] - KNOBS.GAUGE_AHEAD_YEARS[0]);
      add(vKms * 1000, ((i + 0.5) / nPhi) * 2 * Math.PI, (KNOBS.GAUGE_WINDOW_YEARS + ahead) * YEAR, false, KNOBS.GAUGE_INCL_DEG[j % KNOBS.GAUGE_INCL_DEG.length] ?? 0, ahead);
    }
  }
  for (const vKms of KNOBS.GAUGE_INTERSTELLAR_VINF_KMS) {
    for (let i = 0; i < nPhi; i++) {
      const f = (j++ * 0.618034) % 1;
      const ahead = KNOBS.GAUGE_AHEAD_YEARS[0] + f * (KNOBS.GAUGE_AHEAD_YEARS[1] - KNOBS.GAUGE_AHEAD_YEARS[0]);
      add(vKms * 1000, ((i + 0.25) / nPhi) * 2 * Math.PI, (KNOBS.GAUGE_HYPERBOLIC_YEARS + ahead) * YEAR, true, KNOBS.GAUGE_INTERSTELLAR_INCL_DEG[j % KNOBS.GAUGE_INTERSTELLAR_INCL_DEG.length] ?? 0, ahead);
    }
  }
  return { world, impactors: out };
}

function ref(): { world: World; impactors: Impactor[] } {
  reference ??= buildReference();
  return reference;
}

/** The reference impactors (for the tests and the lab): count, sunward count, hyperbolic count. */
export function referenceStats(): { total: number; sunward: number; hyperbolic: number } {
  const im = ref().impactors;
  return { total: im.length, sunward: im.filter((x) => x.sunward && !x.hyperbolic).length, hyperbolic: im.filter((x) => x.hyperbolic).length };
}

/** Faintest absolute magnitude network `n` sees on one night, given geometry; -Infinity if it sees nothing. */
export function nightCeiling(n: Network, g: { rAu: number; deltaAu: number; alphaDeg: number; epsDeg: number; rate?: number }, moon: boolean, covered: boolean, albedo: number): number {
  if (n.kind === 'GROUND_OPTICAL') {
    if (g.epsDeg < (n.epsMin ?? 60) || !covered) return -Infinity;
    const vLim = (n.vLim ?? 20) - (moon ? KNOBS.MOON_PENALTY_MAG : 0) - trailingLoss(g.rate ?? 0);
    // V = H + 5 log10(r delta) + 0.035 alpha <= vLim  <=>  H <= vLim - 5 log10(r delta) - 0.035 alpha
    return vLim - 5 * Math.log10(g.rAu * g.deltaAu) - 0.035 * g.alphaDeg;
  }
  if (n.kind === 'SPACE_IR') {
    if (g.epsDeg < (n.epsMin ?? 45) || g.epsDeg > (n.epsMax ?? 120)) return -Infinity;
    const need = (n.dRef ?? 140) * ((g.rAu * g.deltaAu) / (n.rDeltaRef ?? 0.5));
    return absoluteMagnitude(need, albedo);
  }
  return -Infinity;
}

/**
 * Per night, the faintest H a network would have found by then on DISCOVERY_NIGHTS consecutive nights ending
 * that night (min of the night ceilings), for one impactor; cached per (impactor, network) as Float32.
 */
const cache = new Map<string, Float32Array>();

function streakCeilings(idx: number, n: Network): Float32Array {
  const key = `${idx}:${n.id}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const { world, impactors } = ref();
  const im = impactors[idx] as Impactor;
  const out = new Float32Array(im.nights);
  const rng = new Rng(hashSeed(`GAUGE:${idx}:${n.id}`));
  const home = planetById(world, 'HOME');
  const inner = planetById(world, 'INNER');
  const t0 = im.tImpact - im.nights * KNOBS.DISCOVERY_STEP;
  const nightsNeeded: number = KNOBS.DISCOVERY_NIGHTS;
  const last: number[] = [-Infinity, -Infinity];
  for (let k = 0; k < im.nights; k++) {
    const t = t0 + k * KNOBS.DISCOVERY_STEP;
    const st = propagate(im.el, world.star.mu, t);
    const hs = planetState(world, home, t);
    const obs = observerPosition(n, hs.r, n.observer === 'INNER' ? planetState(world, inner, t).r : { x: 1, y: 0 });
    // NOTE: the observer's own velocity is taken as HOME's for every site (L4/L5 and INNER move at similar speeds).
    const r3 = tiltAboutNode(st.r, im.node, im.incl);
    const g = viewGeometry3(r3, tiltAboutNode(st.v, im.node, im.incl), obs, hs.v);
    // One coverage draw per night; high ecliptic latitudes are revisited less (sim/sky.ts coverage).
    const u = rng.next();
    const covered = n.kind === 'GROUND_OPTICAL' ? u < coverage(n, g.epsDeg, eclipticLatitude(r3, obs)) : true;
    const h = nightCeiling(n, g, nearFullMoon(t), covered, im.albedo);
    // DISCOVERY_NIGHTS consecutive nights: the body must be under the ceiling on each of them.
    out[k] = nightsNeeded >= 3 ? Math.min(h, last[0] as number, last[1] as number) : nightsNeeded === 2 ? Math.min(h, last[1] as number) : h;
    last[0] = last[1] as number;
    last[1] = h;
  }
  cache.set(key, out);
  return out;
}

/**
 * Earliest discovery night per grid size (-1 = never) for one impactor across networks, each counting only from
 * its first night `from`. Sizes are sorted by H (largest rock first) and resolved as soon as the running max of
 * the streak ceilings reaches them, so one pass per network covers the whole grid.
 */
function earliestNights(idx: number, nets: readonly { n: Network; from: number }[], H: readonly number[], order: readonly number[]): Int32Array {
  const best = new Int32Array(H.length).fill(-1);
  for (const { n, from } of nets) {
    const c = streakCeilings(idx, n);
    let p = 0;
    let runMax = -Infinity;
    // The first nights of a network's life cannot complete a streak with nights before it existed.
    for (let k = Math.max(0, from + KNOBS.DISCOVERY_NIGHTS - 1); k < c.length && p < order.length; k++) {
      const v = c[k] as number;
      if (v > runMax) runMax = v;
      while (p < order.length && (H[order[p] as number] as number) <= runMax) {
        const i = order[p++] as number;
        if (best[i] === -1 || k < (best[i] as number)) best[i] = k;
      }
    }
  }
  return best;
}

export interface GaugeReading {
  /** Smallest size per needle, m, or null when no size on the grid reaches the catch share. */
  needles: Record<NeedleId, number | null>;
  /** Share of each needle's impactors caught with its warning, per grid size (for the lab's curves). */
  curves: Record<NeedleId, number[]>;
  grid: number[];
}

/** Warning each needle asks for, s. */
export function needleWarning(id: NeedleId): number {
  switch (id) {
    case 'DEFLECT':
      return KNOBS.GAUGE_DEFLECT_WARNING;
    case 'SUNWARD':
    case 'EVACUATE':
    case 'INTERSTELLAR':
      return KNOBS.GAUGE_EVACUATE_WARNING;
    case 'AFTERMATH':
      return 0;
  }
}

/**
 * Smallest grid size where `share` first reaches `need`, log-interpolated with the previous grid point.
 * Example: grid [10, 100], share [0.2, 0.8], need 0.5 -> 10^(1 + 0.5) = 31.6 m.
 */
export function thresholdSize(grid: readonly number[], share: readonly number[], need: number): number | null {
  for (let i = 0; i < grid.length; i++) {
    const s = share[i] ?? 0;
    if (s < need) continue;
    if (i === 0) return grid[0] ?? null;
    const s0 = share[i - 1] ?? 0;
    const f = s > s0 ? (need - s0) / (s - s0) : 1;
    const l0 = Math.log10(grid[i - 1] as number);
    const l1 = Math.log10(grid[i] as number);
    return Math.pow(10, l0 + f * (l1 - l0));
  }
  return null;
}

/** Networks that count for the gauge: active, discovering, and built by `year`. */
export function gaugeNetworks(active: readonly string[], since: Readonly<Record<string, number>>, year: number): Network[] {
  return NETWORKS.filter((n) => active.includes(n.id) && (n.kind === 'GROUND_OPTICAL' || n.kind === 'SPACE_IR') && (since[n.id] ?? n.since) <= year);
}

/**
 * The gauge for a set of networks in calendar year `year`: the reference rocks hit GAUGE_AHEAD_YEARS after it, and
 * each network searches only from its start year (so a new survey moves the needles as its years add up). The
 * first call builds the reference and the night tables (about a second); later calls reuse them.
 */
export function readGauge(active: readonly string[], since: Readonly<Record<string, number>> = {}, year: number = KNOBS.EPOCH_YEAR): GaugeReading {
  const nets = gaugeNetworks(active, since, Infinity);
  const { impactors } = ref();
  const grid = sizeGrid();
  const caught = (idx: number, warning: number): boolean[] => {
    const im = impactors[idx] as Impactor;
    const H = grid.map((D) => absoluteMagnitude(D, im.albedo));
    const order = grid.map((_, i) => i).sort((a, b) => (H[a] as number) - (H[b] as number));
    const yearsPerNight = KNOBS.DISCOVERY_STEP / YEAR;
    const startYear = year + im.ahead - im.nights * yearsPerNight;
    const withFrom = nets.map((n) => ({ n, from: Math.ceil(((since[n.id] ?? n.since) - startYear) / yearsPerNight) })).filter((x) => x.from < im.nights);
    const best = earliestNights(idx, withFrom, H, order);
    return Array.from(best, (k) => k >= 0 && (im.nights - k) * KNOBS.DISCOVERY_STEP >= warning);
  };
  const setOf = (id: NeedleId): number[] => impactors.map((im, i) => ({ im, i })).filter(({ im }) => (id === 'INTERSTELLAR' ? im.hyperbolic : !im.hyperbolic && (id !== 'SUNWARD' || im.sunward))).map(({ i }) => i);
  const needles = {} as Record<NeedleId, number | null>;
  const curves = {} as Record<NeedleId, number[]>;
  for (const id of NEEDLES) {
    if (id === 'AFTERMATH') {
      // Fireball sensors see a metre-class rock as it burns up; the model does not simulate them.
      const on = active.includes('AIRBURST');
      needles[id] = on ? KNOBS.GAUGE_AFTERMATH_M : null;
      curves[id] = grid.map((D) => (on && D >= KNOBS.GAUGE_AFTERMATH_M ? 1 : 0));
      continue;
    }
    const set = setOf(id);
    const w = needleWarning(id);
    const counts = new Array<number>(grid.length).fill(0);
    for (const idx of set) caught(idx, w).forEach((c, i) => (counts[i] = (counts[i] ?? 0) + (c ? 1 : 0)));
    curves[id] = counts.map((c) => (set.length ? c / set.length : 0));
    needles[id] = thresholdSize(grid, curves[id], KNOBS.GAUGE_CATCH_SHARE);
  }
  return { needles, curves, grid };
}

/** Readout of a size: 85 M, 1.4 KM, or > 10 KM for null. */
export function sizeLabel(D: number | null): string {
  if (D === null) return `> ${KNOBS.GAUGE_MAX_M / 1000} KM`;
  if (D >= 1000) return `${(D / 1000).toFixed(D >= 10000 ? 0 : 1)} KM`;
  return `${D >= 10 ? D.toFixed(0) : D.toFixed(1)} M`;
}

/**
 * The debrief line placing this round's rock on the gauge. Example: D 85 m found 3 years out with the DEFLECT
 * needle at 140 m -> "THIS ROCK: 85 M. YOUR DEFLECT NEEDLE: 140 M. YOU SAW IT BY LUCK."
 */
export function gaugeVerdict(D: number, leadS: number, noWarning: boolean, needle: number | null): string {
  const head = `THIS ROCK: ${sizeLabel(D)}. YOUR DEFLECT NEEDLE: ${sizeLabel(needle)}.`;
  if (noWarning) return `${head} NOBODY SAW IT COMING.`;
  const big = needle !== null && D >= needle;
  if (leadS >= KNOBS.GAUGE_DEFLECT_WARNING) return `${head} ${big ? 'YOUR NETWORKS WOULD USUALLY CATCH THIS ONE.' : 'YOU SAW IT BY LUCK.'}`;
  return `${head} ${big ? 'FOUND LATE: AN UNLUCKY GEOMETRY.' : 'FOUND LATE, AS MOST ROCKS THIS SIZE ARE.'}`;
}
