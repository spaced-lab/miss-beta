// WHAT: LAB_TRACTOR: the slow-push family (gravity tractor, ion beam, laser ablation, mass driver) on one body;
//       force, acceleration, dv and the miss after a push of tau years plus a coast of T_rem years.
// WHY:  Slow pushes give millimetres per second per year: fine for a 100 m body with decades of warning,
//       hopeless for a kilometre rock in three years. The bars put all four methods side by side on a log
//       scale against the one number that matters, one Earth radius of miss.
// HOW:  slowPush.ts gravityTractorForce(m_sc, M, R, d/R) for the tractor (the sliders replace the knob tier),
//       pushForce({ method, tier }, M, R, 1 AU) for the others; a = F / M; dv = a tau;
//       estimates.ts missFromPush(a, tau, T_rem) = 3 a tau (T_rem + tau/2). M from sphereMass(D, 2700).
//       The scene animates the selected method: the tractor bobs on its hover point with canted plumes, the
//       ion beam and the ablation plume stream as moving dots, the mass driver flings rubble; the body creeps
//       along its push direction on a 10 s loop. Pure function of (values, t).
// LORE: D6 (the slow push family), D2 (early beats big)

import { sphereMass } from '../../physics/closeApproach';
import { AU, R_HOME, YEAR } from '../../physics/constants';
import { missFromPush } from '../../physics/estimates';
import { gravityTractorForce, pushForce, type PushMethod } from '../../physics/slowPush';
import { fmt, type Lab } from './lab';
import { arrow, frame, label, logFrac, phase, rect } from './labKit';

const METHODS: readonly (readonly [PushMethod, string])[] = [
  ['GRAVITY_TRACTOR', 'GRAVITY TRACTOR'],
  ['ION_BEAM', 'ION BEAM'],
  ['LASER', 'LASER'],
  ['MASS_DRIVER', 'MASS DRIVER'],
];
const RHO = 2700;

interface Push {
  name: string;
  F: number;
  a: number;
  dv: number;
  miss: number;
  note: string;
}

function push(v: Record<string, number>, idx: number): Push {
  const D = v.D ?? 100;
  const R = D / 2;
  const M = sphereMass(D, RHO);
  const tau = (v.tau ?? 5) * YEAR;
  const tRem = (v.Trem ?? 5) * YEAR;
  const m = METHODS[idx] ?? METHODS[0];
  const method: PushMethod = m ? m[0] : 'GRAVITY_TRACTOR';
  let F: number;
  let note: string;
  if (method === 'GRAVITY_TRACTOR') {
    const mSc = (v.msc ?? 20) * 1000;
    F = gravityTractorForce(mSc, M, R, v.dR ?? 1.5);
    note = `F = G m_sc M / d^2 = G x ${fmt(mSc)} kg x ${M.toExponential(2)} kg / (${fmt((v.dR ?? 1.5) * R)} m)^2`;
  } else {
    const pf = pushForce({ method, tier: Math.round(v.tier ?? 1) }, M, R, AU);
    F = pf.force;
    note = pf.note;
  }
  const a = F / M;
  return { name: m ? m[1] : 'GRAVITY TRACTOR', F, a, dv: a * tau, miss: missFromPush(a, tau, tRem), note };
}

export const lab: Lab = {
  id: 'LAB_TRACTOR',
  title: 'SLOW PUSH: TRACTOR, BEAM, LASER, DRIVER',
  code: ['src/physics/slowPush.ts: gravityTractorForce, pushForce', 'src/physics/estimates.ts: missFromPush', 'src/config/knobs.ts: ION_BEAM_N, LASER_POWER_W, MASS_DRIVER_MDOT'],
  sliders: [
    { key: 'method', label: 'method 0 GT 1 ION 2 LAS 3 MD', min: 0, max: 3, step: 1, value: 0 },
    { key: 'D', label: 'D body (m)', min: 20, max: 2000, step: 10, value: 100, log: true },
    { key: 'msc', label: 'm_sc tractor (t)', min: 0.5, max: 50, step: 0.5, value: 20, log: true },
    { key: 'dR', label: 'd / R hover', min: 1.2, max: 5, step: 0.1, value: 1.5 },
    { key: 'tier', label: 'tier beam/laser/driver', min: 0, max: 2, step: 1, value: 1 },
    { key: 'tau', label: 'tau push (years)', min: 0.5, max: 20, step: 0.5, value: 5 },
    { key: 'Trem', label: 'T_rem coast (years)', min: 0, max: 20, step: 0.5, value: 5 },
  ],
  lines: (v) => {
    const r = push(v, Math.round(v.method ?? 0));
    return [
      `${r.name}: ${r.note} -> F = ${fmt(r.F)} N`,
      `a = F / M = ${r.a.toExponential(2)} m/s^2;  dv = a tau = ${fmt(r.dv * 1000)} mm/s`,
      `miss = 3 a tau (T_rem + tau/2) = ${fmt(r.miss / 1000)} km = ${fmt(r.miss / R_HOME)} Earth radii`,
    ];
  },
  draw: (s, v, box, t = 0) => {
    const p = s.palette;
    frame(s, box);
    const sel = Math.round(v.method ?? 0);
    const sceneH = box.h * 0.5;
    const cy = box.y + sceneH / 2 + 8;
    const rp = Math.min(22, sceneH * 0.28);
    const drift = phase(t, 10) * 10;
    const tractor = sel === 0;
    // Body: the tractor pulls it toward the craft (left); the others push it away from the craft (right).
    const dir = tractor ? -1 : 1;
    const bodyX = box.x + box.w * 0.55 + dir * drift;
    const body: number[] = [];
    for (let i = 0; i < 20; i++) {
      const ang = (i / 20) * Math.PI * 2;
      const r = rp * (1 + 0.08 * Math.sin(4 * ang + 1) + 0.04 * Math.cos(7 * ang));
      body.push(bodyX + r * Math.cos(ang), cy + r * Math.sin(ang));
    }
    s.stroke(body, { color: s.role('threat'), glow: 0.7, closed: true });
    const craftCol = s.role('craft');
    const craft = (x: number, y: number): void => {
      rect(s, x - 5, y - 4, 10, 8, { color: craftCol, glow: 0.8 });
      s.stroke([x - 12, y, x - 5, y], { color: craftCol, glow: 0.4 });
      s.stroke([x + 5, y, x + 12, y], { color: craftCol, glow: 0.4 });
    };
    if (sel === 0) {
      const d = Math.min((v.dR ?? 1.5) * rp, box.w * 0.4);
      const cx = bodyX - d;
      const bob = 2 * Math.sin(t * 1.5);
      craft(cx, cy + bob);
      s.stroke([cx + 6, cy + bob, bodyX - rp, cy], { color: craftCol, glow: 0.2, dash: [1, 3] });
      // Canted plumes: thrust outward so the exhaust misses the rock.
      const fl = 6 + 2 * Math.sin(t * 9);
      for (const sg of [-1, 1]) s.stroke([cx - 4, cy + bob + sg * 4, cx - 4 - fl, cy + bob + sg * (4 + fl)], { color: p.hot, glow: 0.6 });
      label(s, box, 'GRAVITY ONLY: NO CONTACT', box.x + 8, box.y + 6, 7, p.dim);
    } else {
      const cx = box.x + 30;
      craft(cx, cy);
      if (sel === 1) {
        for (let i = 0; i < 8; i++) {
          const f = phase(t * 0.8 + i / 8, 1);
          const x = cx + 12 + f * (bodyX - rp - cx - 12);
          s.dot(x, cy + (i % 2 ? 2 : -2) * f, 1.6, craftCol);
        }
        label(s, box, 'EXHAUST BLOWS ON THE ROCK', box.x + 8, box.y + 6, 7, p.dim);
      } else if (sel === 2) {
        s.stroke([cx + 12, cy, bodyX - rp, cy], { color: p.hot, glow: 1.2 });
        for (let i = 0; i < 7; i++) {
          const f = phase(t * 0.9 + i / 7, 1);
          const ang = Math.PI + (i - 3) * 0.25;
          s.dot(bodyX - rp + Math.cos(ang) * f * 26, cy + Math.sin(ang) * f * 26, 1.4, p.hot);
        }
        label(s, box, 'VAPOUR PLUME PUSHES BACK', box.x + 8, box.y + 6, 7, p.dim);
      } else {
        // Mass driver on the rear face, throwing rubble back toward the left.
        const mx = bodyX - rp;
        rect(s, mx - 6, cy - 3, 6, 6, { color: craftCol, glow: 0.8 });
        for (let i = 0; i < 5; i++) {
          const f = phase(t * 0.7 + i / 5, 1);
          s.dot(mx - 6 - f * (mx - box.x - 20), cy - 6 * Math.sin(i * 2.1) * f, 2, s.role('fragment'));
        }
        label(s, box, 'THROWS ITS OWN ROCK AWAY', box.x + 8, box.y + 6, 7, p.dim);
      }
    }
    arrow(s, bodyX + dir * (rp + 4), cy + rp + 6, bodyX + dir * (rp + 22), cy + rp + 6, { color: p.hot, glow: 0.6 }, 4);
    // Bars: miss in Earth radii for all four methods (log scale), the 1 R line marked.
    const top = box.y + sceneH + 8;
    const labelW = Math.min(100, box.w * 0.27);
    const x0 = box.x + 8 + labelW;
    const bw = box.x + box.w - 10 - x0;
    const rowH = Math.max(10, (box.y + box.h - 18 - top) / 4);
    const LO = 1e-4;
    const HI = 1e4;
    METHODS.forEach((_, i) => {
      const r = push(v, i);
      const y = top + i * rowH;
      const on = i === sel;
      label(s, { ...box, w: labelW + 8 }, r.name, box.x + 8, y + 1, 7, on ? p.hot : p.dim);
      const w = Math.max(1, logFrac(r.miss / R_HOME, LO, HI) * bw);
      rect(s, x0, y, w, Math.max(4, rowH - 5), { color: on ? p.hot : p.ink, glow: on ? 1 : 0.2, ...(on ? {} : { dash: [3, 2] }) });
    });
    const oneR = x0 + logFrac(1, LO, HI) * bw;
    s.stroke([oneR, top - 3, oneR, top + 4 * rowH], { color: s.role('planet'), glow: 0.4, dash: [2, 2] });
    label(s, box, '1 EARTH RADIUS', oneR - 30, box.y + box.h - 12, 7, s.role('planet'));
  },
};
