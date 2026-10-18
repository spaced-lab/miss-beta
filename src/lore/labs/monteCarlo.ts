// WHAT: LAB_MONTECARLO: N runs of one kinetic deflection with beta drawn from a range and the orbit known
//       only to sigma_v; each run's propagated miss distance drops into a histogram one by one, against the
//       b_crit line, with P(MISS) and its error bar, and the Gaussian estimate the brief would quote.
// WHY:  EDUCATION O14: beta is unknown until the impact and the orbit is never known exactly, so the only
//       honest number is a distribution. The error bar sqrt(p (1 - p) / N) shows why more samples help slowly.
// HOW:  The same sampling loop as src/planner/monteCarlo.ts, on a lab-sized scenario so it fits a frame:
//       a rock on an orbit that hits HOME at T_HIT (built backwards with stateToElements) is struck LEAD before
//       impact. Sample i draws, in this order from one Rng(SEED): beta ~ U(lo, hi), then a velocity error
//       ~ N(0, sigma_v) along track. kineticImpact gives dv; the new orbit is propagated and closeApproach
//       finds the miss. Samples are cached per slider set (about 20 us each), so a frame only bins them.
//       sigma_v spans the game's tracking tiers (SIGMA_V_BY_TIER: 5, 1, 0.2 mm/s; 20 mm/s untracked).
//       The estimate line is impactProbability with the mean 3 dv T miss and sigmaB (src/physics/uncertainty.ts).
// LORE: O14 (randomness and probability), D3 (kinetic and beta), F8 (uncertainty)

import { AU, DAY, MU_HOME, MU_SUN, R_HOME, YEAR } from '../../physics/constants';
import { bCrit, closeApproach, sphereMass } from '../../physics/closeApproach';
import { stateToElements } from '../../physics/elements';
import { missFromImpulse } from '../../physics/estimates';
import { propagate, type Elements } from '../../physics/kepler';
import { alongTrack, kineticImpact } from '../../physics/kinetic';
import { impactProbability, sigmaB } from '../../physics/uncertainty';
import { Rng } from '../../sim/rng';
import { fmt, type Box, type Lab } from './lab';
import { fitLabel, keyOf, loop, Memo } from './kit';

/** NOTE: lab scenario constants: an 80 m stony rock, a 600 kg impactor at 10 km/s, five years of lead time. */
const HOME: Elements = { a: AU, e: 0, w: 0, M0: 0, t0: 0 };
const D_ROCK = 80;
const RHO = 2000;
const M_ROCK = sphereMass(D_ROCK, RHO);
const M_IMP = 600;
const U_IMP = 10000;
const LEAD = 5 * YEAR;
const T_HIT = 6 * YEAR;
const V_INF = 10000;
const SEED = 2026;
const BINS = 24;

const THREAT: Elements = (() => {
  const hs = propagate(HOME, MU_SUN, T_HIT);
  const rm = Math.hypot(hs.r.x, hs.r.y);
  // v_inf at 60 deg from HOME's velocity, outward: an Apollo-type crosser.
  const ux = hs.v.x / Math.hypot(hs.v.x, hs.v.y);
  const uy = hs.v.y / Math.hypot(hs.v.x, hs.v.y);
  const c = Math.cos(Math.PI / 3);
  const sn = Math.sin(Math.PI / 3);
  const rx = hs.r.x / rm;
  const ry = hs.r.y / rm;
  return stateToElements(hs.r, { x: hs.v.x + V_INF * (c * ux + sn * rx), y: hs.v.y + V_INF * (c * uy + sn * ry) }, MU_SUN, T_HIT);
})();

interface Samples {
  /** Miss distance of each sample, Earth radii (centre to centre). */
  miss: Float64Array;
  beta: Float64Array;
  bCritR: number;
  pMiss: number;
  /** Mean along-track dv, m/s. */
  dvMean: number;
}

const cache = new Memo<Samples>(10);

function range(v: Record<string, number>): [number, number] {
  const a = v.bLo ?? 1;
  const b = v.bHi ?? 5;
  return a <= b ? [a, b] : [b, a];
}

function samples(v: Record<string, number>): Samples {
  const N = Math.max(1, Math.round(v.N ?? 200));
  const sv = (v.sigma ?? 5) / 1000;
  const [lo, hi] = range(v);
  return cache.get(keyOf(N, sv, lo, hi), () => {
    const rng = new Rng(SEED);
    const tD = T_HIT - LEAD;
    const st = propagate(THREAT, MU_SUN, tD);
    const vm = Math.hypot(st.v.x, st.v.y);
    // Impactor from behind along the track (speeds the rock up, so it arrives late and passes behind HOME).
    const vImp = { x: st.v.x * (1 + U_IMP / vm), y: st.v.y * (1 + U_IMP / vm) };
    const miss = new Float64Array(N);
    const beta = new Float64Array(N);
    let bc = 0;
    let nMiss = 0;
    let dvSum = 0;
    for (let i = 0; i < N; i++) {
      const b = rng.float(lo, hi);
      const err = rng.gaussian(0, sv);
      const k = kineticImpact(M_IMP, M_ROCK, vImp, st.v, b);
      dvSum += alongTrack(k.dv, st.v);
      const v2 = { x: st.v.x + k.dv.x + (err * st.v.x) / vm, y: st.v.y + k.dv.y + (err * st.v.y) / vm };
      const el = stateToElements(st.r, v2, MU_SUN, tD);
      const ca = closeApproach(el, HOME, MU_SUN, MU_HOME, R_HOME, T_HIT, { window: 2 * DAY, coarseStep: 4 * 3600, tol: 10 });
      miss[i] = ca.dMin / R_HOME;
      beta[i] = b;
      bc = ca.bCrit / R_HOME;
      if (!ca.impact) nMiss++;
    }
    return { miss, beta, bCritR: bc, pMiss: nMiss / N, dvMean: dvSum / N };
  });
}

export const lab: Lab = {
  id: 'LAB_MONTECARLO',
  title: 'MONTE CARLO: A MISS IS A PROBABILITY',
  code: ['src/planner/monteCarlo.ts: monteCarlo (the game loop over the resolver)', 'src/physics/kinetic.ts: kineticImpact', 'src/physics/closeApproach.ts: closeApproach, bCrit', 'src/physics/uncertainty.ts: sigmaB, impactProbability', 'src/sim/rng.ts: Rng.float, Rng.gaussian'],
  sliders: [
    { key: 'N', label: 'N samples', min: 20, max: 500, step: 10, value: 200 },
    { key: 'sigma', label: 'sigma_v (mm/s)', min: 0, max: 20, step: 0.5, value: 5 },
    { key: 'bLo', label: 'beta low', min: 1, max: 6, step: 0.1, value: 1 },
    { key: 'bHi', label: 'beta high', min: 1, max: 6, step: 0.1, value: 4 },
  ],
  lines: (v) => {
    const sm = samples(v);
    const N = sm.miss.length;
    const p = sm.pMiss;
    const err = Math.sqrt((p * (1 - p)) / N);
    const [lo, hi] = range(v);
    const sb = sigmaB((v.sigma ?? 0) / 1000, LEAD);
    const dMean = missFromImpulse(sm.dvMean, LEAD);
    const pHit = impactProbability(dMean, sm.bCritR * R_HOME, sb);
    return [
      `${N} runs: beta ~ U(${fmt(lo)}, ${fmt(hi)}), velocity error ~ N(0, ${fmt(v.sigma ?? 0)} mm/s), ${fmt(LEAD / YEAR)} yr before impact`,
      `P(MISS) = ${fmt(p)} +/- sqrt(p (1 - p) / N) = ${fmt(err)}   b_crit = ${fmt(sm.bCritR)} R`,
      `estimate: mean 3 dv T = ${fmt(dMean / R_HOME)} R, sigma_b = 3 sigma_v T = ${fmt(sb / R_HOME)} R, P(MISS) ~ ${fmt(1 - pHit)}`,
    ];
  },
  draw: (s, v, box, t = 0) => {
    const sm = samples(v);
    const pal = s.palette;
    const N = sm.miss.length;
    s.stroke([box.x, box.y, box.x + box.w, box.y, box.x + box.w, box.y + box.h, box.x, box.y + box.h], { closed: true, color: pal.dim, glow: 0 });
    // Samples land over 5 s, then the full histogram holds for 2 s.
    const ph = loop(t, 7) * (7 / 5);
    const shown = Math.min(N, Math.floor(ph * N) + 1);
    let xMax = sm.bCritR * 2;
    for (let i = 0; i < N; i++) xMax = Math.max(xMax, sm.miss[i] ?? 0);
    xMax *= 1.05;
    const hb: Box = { x: box.x + 10, y: box.y + 22, w: box.w - 20, h: box.h - 44 };
    const counts = new Array<number>(BINS).fill(0);
    let mShown = 0;
    for (let i = 0; i < shown; i++) {
      const m = sm.miss[i] ?? 0;
      const b = Math.min(BINS - 1, Math.max(0, Math.floor((m / xMax) * BINS)));
      counts[b] = (counts[b] ?? 0) + 1;
      if (m > sm.bCritR) mShown++;
    }
    // Fixed vertical scale from the final histogram, so bars grow instead of rescaling.
    const final = new Array<number>(BINS).fill(0);
    for (let i = 0; i < N; i++) {
      const b = Math.min(BINS - 1, Math.max(0, Math.floor(((sm.miss[i] ?? 0) / xMax) * BINS)));
      final[b] = (final[b] ?? 0) + 1;
    }
    const cMax = Math.max(1, ...final);
    const X = (m: number): number => hb.x + (m / xMax) * hb.w;
    const Y = (c: number): number => hb.y + hb.h - (c / cMax) * hb.h;
    s.stroke([hb.x, hb.y + hb.h, hb.x + hb.w, hb.y + hb.h], { color: pal.dim, glow: 0 });
    const bw = hb.w / BINS;
    for (let b = 0; b < BINS; b++) {
      const c = counts[b] ?? 0;
      if (c === 0) continue;
      const x0 = hb.x + b * bw + 1;
      const x1 = x0 + bw - 2;
      const hit = (b + 1) * (xMax / BINS) <= sm.bCritR;
      s.stroke([x0, hb.y + hb.h, x0, Y(c), x1, Y(c), x1, hb.y + hb.h], { color: hit ? s.role('danger') : s.role('craft'), glow: 0.4, ...(hit ? { dash: [2, 2] } : {}) });
    }
    // b_crit: left of it the rock still hits.
    const xb = X(sm.bCritR);
    s.stroke([xb, hb.y - 4, xb, hb.y + hb.h], { color: s.role('danger'), glow: 0.6, dash: [3, 3] });
    fitLabel(s, box, 'HIT', xb - 22, hb.y - 2, s.role('danger'), 7);
    fitLabel(s, box, 'MISS ->', xb + 4, hb.y - 2, s.role('craft'), 7);
    // The newest sample falls into its bin.
    if (shown < N || ph <= 1) {
      const i = shown - 1;
      const m = sm.miss[i] ?? 0;
      const frac = (ph * N) % 1;
      const b = Math.min(BINS - 1, Math.max(0, Math.floor((m / xMax) * BINS)));
      const yTop = Y(counts[b] ?? 0);
      const y = hb.y + (yTop - hb.y) * Math.min(1, frac * 1.5);
      s.circle(X(m), y, 2.5, { color: pal.hot, glow: 1 });
      fitLabel(s, box, `BETA ${fmt(sm.beta[i] ?? 0, 2)}  MISS ${fmt(m, 3)} R`, box.x + 6, box.y + 4, pal.hot, 7);
    } else fitLabel(s, box, `ALL ${N} RUNS`, box.x + 6, box.y + 4, pal.ink, 7);
    const p = mShown / shown;
    const err = Math.sqrt((p * (1 - p)) / shown);
    fitLabel(s, box, `P(MISS) ${fmt(p, 3)} +/- ${fmt(err, 2)}  (${shown})`, box.x + box.w * 0.52, box.y + 4, pal.ink, 7);
    fitLabel(s, box, `MISS DISTANCE (EARTH RADII) 0 .. ${fmt(xMax, 3)}`, hb.x, hb.y + hb.h + 6, pal.dim, 7);
  },
};
