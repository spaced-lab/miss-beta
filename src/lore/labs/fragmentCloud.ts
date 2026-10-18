// WHAT: LAB_FRAGMENT_CLOUD: a disrupted body's fragments spreading along track until close approach, the
//       b_crit disc of the planet at the centre, and the fraction of the mass that still hits.
// WHY:  The cloud stretches along track three times faster than across it (the 3 dv T rule applied to every
//       piece). Years of spreading scatter the pieces past the planet; weeks of spreading aim a shotgun at it.
// HOW:  The body's radius follows from the v_esc slider for a stony density (R = v_esc / sqrt(8 pi G rho / 3)).
//       fragment.ts disrupt() breaks it with a fixed-seed Rng (same draw order as the game) at Q = (Q/Q*) Q*;
//       the impactor momentum is left out (m = 0) so the picture is the cloud around its own centre of mass.
//       Each piece's along-track offset at time tau is 3 v_x tau (estimates.ts missFromImpulse), its cross-
//       track offset v_y tau. A piece "hits" if its along-track offset at T is inside b_crit (closeApproach.ts
//       bCrit, v_inf 15 km/s), weighted by the 3-D correction f3D. The animation runs tau from 0 to T in 5 s.
// LORE: D4 (fragmentation), D2 (early beats big), O12 (gravitational focusing)

import { bCrit, sphereMass } from '../../physics/closeApproach';
import { DAY, G, MU_HOME, R_HOME } from '../../physics/constants';
import { cloudFootprint, missFromImpulse } from '../../physics/estimates';
import { disrupt, escapeSpeedBody, f3D, harmlessDiameter, largestRemnantFraction, qStar, type Fragment } from '../../physics/fragment';
import { KNOBS } from '../../config/knobs';
import { Rng } from '../../sim/rng';
import { fmt, type Lab } from './lab';
import { ease, frame, label, phase } from './labKit';

const RHO = 2700;
const V_INF = 15000;
const SEED = 0x5eed;

interface Cloud {
  R: number;
  M: number;
  Qs: number;
  vEsc: number;
  scale: number;
  T: number;
  bc: number;
  frags: Fragment[];
  hitMass: number;
  hits: boolean[];
  dangerousHits: number;
}

function cloud(v: Record<string, number>): Cloud {
  const q = v.q ?? 2;
  const vEscIn = v.vesc ?? 0.1;
  const R = vEscIn / Math.sqrt((8 * Math.PI * G * RHO) / 3);
  const M = sphereMass(2 * R, RHO);
  const vEsc = escapeSpeedBody(M, R);
  const Qs = qStar(R, RHO);
  const N = Math.round(v.N ?? 20);
  const frags = disrupt(new Rng(SEED), { M, R, rho: RHO, Q: q * Qs, Qstar: Qs, m: 0, Uvec: { x: 0, y: 0 }, vThreat: { x: 0, y: 0 }, nFrag: N });
  const T = (v.T ?? 365) * DAY;
  const bc = bCrit(MU_HOME, R_HOME, V_INF);
  let hitMass = 0;
  let dangerousHits = 0;
  const hits = frags.map((f) => {
    const along = missFromImpulse(f.v.x, T);
    const hit = Math.abs(along) < bc;
    if (hit) {
      hitMass += f.mass * f3D(bc, Math.hypot(f.v.x, f.v.y), T);
      if (f.D >= harmlessDiameter(false)) dangerousHits++;
    }
    return hit;
  });
  return { R, M, Qs, vEsc, scale: KNOBS.K_EJ * vEsc * Math.sqrt(q), T, bc, frags, hitMass: hitMass / M, hits, dangerousHits };
}

export const lab: Lab = {
  id: 'LAB_FRAGMENT_CLOUD',
  title: 'FRAGMENT CLOUD AT CLOSE APPROACH',
  code: ['src/physics/fragment.ts: disrupt, qStar, largestRemnantFraction, f3D, escapeSpeedBody', 'src/physics/estimates.ts: cloudFootprint, missFromImpulse', 'src/physics/closeApproach.ts: bCrit'],
  sliders: [
    { key: 'q', label: 'Q / Q*', min: 1, max: 10, step: 0.1, value: 2 },
    { key: 'vesc', label: 'v_esc body (m/s)', min: 0.01, max: 1, step: 0.01, value: 0.1, log: true },
    { key: 'T', label: 'T breakup to CA (days)', min: 1, max: 3650, step: 20, value: 365, log: true },
    { key: 'N', label: 'N fragments', min: 8, max: 40, step: 1, value: 20 },
  ],
  lines: (v) => {
    const c = cloud(v);
    const q = v.q ?? 2;
    const fp = cloudFootprint(c.scale, c.T);
    return [
      `body D ${fmt(2 * c.R)} m (v_esc ${fmt(c.vEsc)} m/s); Q* ${fmt(c.Qs)} J/kg; f_LR = clamp(1 - 0.5 x ${fmt(q)}) = ${fmt(largestRemnantFraction(q * c.Qs, c.Qs))}`,
      `v_ej ~ Rayleigh(k v_esc sqrt(Q/Q*)) = Rayleigh(${fmt(c.scale)} m/s), ${c.frags.length} pieces`,
      `footprint 3 v_ej T = 3 x ${fmt(c.scale)} x ${fmt(c.T)} s = ${fmt(fp / 1000)} km vs b_crit ${fmt(c.bc / 1000)} km`,
      `mass still hitting (x f3D): ${fmt(100 * c.hitMass)}%; pieces over ${fmt(harmlessDiameter(false))} m on target: ${c.dangerousHits}`,
    ];
  },
  draw: (s, v, box, t = 0) => {
    const p = s.palette;
    const c = cloud(v);
    frame(s, box);
    const tau = c.T * ease((phase(t, 6) * 6) / 5);
    let maxAlong = 0;
    for (const f of c.frags) maxAlong = Math.max(maxAlong, Math.abs(missFromImpulse(f.v.x, c.T)));
    const half = Math.max(maxAlong * 1.15, 2.5 * c.bc);
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2 + 6;
    const k = (box.w / 2 - 10) / half;
    // Planet and its b_crit disc.
    s.circle(cx, cy, Math.max(2, R_HOME * k), { color: s.role('planet'), glow: 0.6 });
    s.circle(cx, cy, Math.max(4, c.bc * k), { color: s.role('planet'), glow: 0.3, dash: [3, 3] });
    // Along-track axis and the 3 v_ej tau footprint bracket.
    s.stroke([box.x + 6, cy, box.x + box.w - 6, cy], { color: p.dim, glow: 0, dash: [1, 4] });
    const fp = Math.min(box.w / 2 - 8, cloudFootprint(c.scale, tau) * k);
    s.stroke([cx - fp, cy - 30, cx - fp, cy - 36, cx + fp, cy - 36, cx + fp, cy - 30], { color: p.dim, glow: 0 });
    label(s, box, '3 V_EJ T', cx - 18, cy - 46, 7, p.dim);
    const done = tau >= c.T * 0.999;
    c.frags.forEach((f, i) => {
      const x = cx + missFromImpulse(f.v.x, tau) * k;
      const y = cy - f.v.y * tau * k;
      if (x < box.x + 2 || x > box.x + box.w - 2 || y < box.y + 2 || y > box.y + box.h - 2) return;
      const big = f.D >= harmlessDiameter(false);
      if (f.largestRemnant) s.circle(x, y, 4, { color: s.role('threat'), glow: 0.8 });
      else s.dot(x, y, big ? 3 : 1.6, s.role('fragment'));
      if (done && c.hits[i]) s.circle(x, y, 6, { color: s.role('danger'), glow: 0.8, dash: [2, 2] });
    });
    label(s, box, `T = ${fmt(tau / DAY)} D OF ${fmt(c.T / DAY)}`, box.x + 8, box.y + 6, 8, p.hot, 0.5);
    label(s, box, 'ALONG TRACK ->', box.x + box.w - 90, cy + 6, 7, p.dim);
    label(s, box, done ? `HIT ${fmt(100 * c.hitMass)}% OF MASS` : 'SPREADING', box.x + 8, box.y + box.h - 14, 8, done && c.hitMass > 0 ? s.role('danger') : p.dim);
    label(s, box, 'DASHED RING: B_CRIT', box.x + box.w - 120, box.y + box.h - 14, 7, p.dim);
  },
};
