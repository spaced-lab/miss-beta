// WHAT: LAB_ROCKET_EQ: the Tsiolkovsky equation with identical stages, a staging rocket and its speed
//       staircase, and the game's payload-vs-C3 curve for each launcher tier.
// WHY:  dv grows only with the logarithm of the mass ratio, so each extra km/s costs a multiple of the
//       rocket, and payload falls steeply with C3. Staging is the trick that makes orbit possible at all.
// HOW:  rocket.ts stagedDv / rocketDv / massRatioFor; estimates.ts payloadForC3 on LAUNCHERS (the same
//       tables the planner uses). The dv needed from a 300 km parking orbit to a given C3 is
//       sqrt(C3 + v_esc^2) - v_circ with v_esc from closeApproach.ts escapeSpeed; reaching that orbit costs
//       about 9.4 km/s including gravity and drag losses (NOTE: a display constant, textbook value).
//       The rocket burns one stage per 1.2 s and drops it, then the loop restarts: a pure function of t.
// LORE: D8 (rockets: delta-v, Isp, C3), O10 (launch windows)

import { escapeSpeed } from '../../physics/closeApproach';
import { MU_HOME, R_HOME } from '../../physics/constants';
import { LAUNCHERS, payloadForC3 } from '../../physics/estimates';
import { massRatioFor, rocketDv, stagedDv } from '../../physics/rocket';
import { fmt, type Lab } from './lab';
import { frame, label, phase, rect } from './labKit';

const LEO_R = R_HOME + 300e3;
/** NOTE: launch to low orbit including gravity and drag losses, m/s (textbook 9.3 to 9.5 km/s). */
const DV_TO_LEO = 9400;
const BURN_S = 1.2;
const DASHES: readonly (readonly number[])[] = [[], [5, 3], [1, 3]];

function needFromLeo(c3: number): number {
  const vEsc = escapeSpeed(MU_HOME, LEO_R);
  return Math.sqrt(c3 * 1e6 + vEsc * vEsc) - vEsc / Math.SQRT2;
}

export const lab: Lab = {
  id: 'LAB_ROCKET_EQ',
  title: 'ROCKET EQUATION: dv = Isp g0 ln(m0/mf)',
  code: ['src/physics/rocket.ts: rocketDv, stagedDv, massRatioFor', 'src/physics/estimates.ts: payloadForC3, LAUNCHERS', 'src/config/launchers.json'],
  sliders: [
    { key: 'isp', label: 'Isp (s)', min: 200, max: 4500, step: 20, value: 330, log: true },
    { key: 'f', label: 'propellant fraction', min: 0.5, max: 0.95, step: 0.01, value: 0.88 },
    { key: 'n', label: 'stages', min: 1, max: 4, step: 1, value: 2 },
    { key: 'c3', label: 'C3 (km^2/s^2)', min: 0, max: 130, step: 1, value: 20 },
  ],
  lines: (v) => {
    const isp = v.isp ?? 330;
    const f = v.f ?? 0.88;
    const n = Math.round(v.n ?? 2);
    const c3 = v.c3 ?? 20;
    const dv1 = rocketDv(isp, 1 / (1 - f));
    const dv = stagedDv(isp, f, n);
    const need = DV_TO_LEO + needFromLeo(c3);
    const pay = LAUNCHERS.map((l) => `${l.name} ${fmt(payloadForC3(l, c3) / 1000)} t`).join(', ');
    return [
      `per stage: Isp g0 ln(1/(1-f)) = ${fmt(isp)} x 9.81 x ln(${fmt(1 / (1 - f))}) = ${fmt(dv1 / 1000)} km/s`,
      `${n} stage${n > 1 ? 's' : ''}: dv = ${fmt(dv / 1000)} km/s; overall m0/mf = ${fmt(massRatioFor(dv, isp))}`,
      `C3 ${fmt(c3)} needs ~${fmt(need / 1000)} km/s from the pad -> ${dv >= need ? 'ENOUGH' : 'SHORT'}`,
      `payload at C3 ${fmt(c3)}: ${pay}`,
    ];
  },
  draw: (s, v, box, t = 0) => {
    const p = s.palette;
    frame(s, box);
    const isp = v.isp ?? 330;
    const f = v.f ?? 0.88;
    const n = Math.round(v.n ?? 2);
    const c3 = v.c3 ?? 20;
    const dv1 = rocketDv(isp, 1 / (1 - f));
    const period = n * BURN_S + 1.6;
    const tt = phase(t, period) * period;
    // Rocket column (left): stacked stages, the active one firing, spent ones falling away.
    const rx = box.x + 26;
    const stageH = Math.min(22, (box.h - 50) / (n + 1));
    const baseY = box.y + box.h - 24;
    const climb = Math.min(1, tt / (n * BURN_S)) * (box.h * 0.25);
    for (let k = 0; k < n; k++) {
      const start = k * BURN_S;
      const y0 = baseY - (k + 1) * stageH - climb;
      const w = 12 - k * 1.5;
      if (tt >= start + BURN_S) {
        // Spent: falls and drifts left.
        const dt = tt - start - BURN_S;
        const fy = y0 + 18 * dt * dt + 4 * dt;
        if (fy < box.y + box.h - 6) rect(s, rx - w / 2 - 6 * dt, fy, w, stageH - 2, { color: p.dim, glow: 0, dash: [2, 2] });
        continue;
      }
      rect(s, rx - w / 2, y0, w, stageH - 2, { color: s.role('craft'), glow: 0.7 });
      if (tt >= start) {
        const fl = 6 + 4 * Math.abs(Math.sin(t * 13));
        s.stroke([rx - 3, y0 + stageH - 2, rx, y0 + stageH - 2 + fl, rx + 3, y0 + stageH - 2], { color: p.hot, glow: 1 });
      }
    }
    const capY = baseY - (n + 1) * stageH - climb;
    s.stroke([rx - 4, capY + stageH, rx, capY + stageH - 8, rx + 4, capY + stageH], { color: s.role('craft'), glow: 0.7 });
    // Speed staircase (top right): cumulative dv per stage, drawn up to the current time.
    const L = box.x + 64;
    const Rr = box.x + box.w - 10;
    const top = box.y + 16;
    const midY = box.y + box.h * 0.45;
    const vmax = Math.max(12000, 4 * dv1 * 1.05);
    const sx = (time: number): number => L + (time / (4 * BURN_S)) * (Rr - L);
    const sy = (dv: number): number => midY - (dv / vmax) * (midY - top);
    s.stroke([L, top, L, midY, Rr, midY], { color: p.dim, glow: 0 });
    const pts: number[] = [];
    const tMax = Math.min(tt, n * BURN_S);
    for (let i = 0; i <= 40; i++) {
      const time = (i / 40) * tMax;
      const k = Math.floor(time / BURN_S);
      const within = (time - k * BURN_S) / BURN_S;
      // Within a burn, mass falls linearly: dv(t) = Isp g0 ln(m0 / (m0 - f m0 x within)).
      const dv = k * dv1 + (k < n ? rocketDv(isp, 1 / (1 - f * within)) : 0);
      pts.push(sx(time), sy(dv));
    }
    s.stroke(pts, { color: s.role('craft'), glow: 0.8 });
    const leo = sy(DV_TO_LEO);
    s.stroke([L, leo, Rr, leo], { color: s.role('planet'), glow: 0.2, dash: [3, 3] });
    label(s, box, 'ORBIT ~9.4 KM/S', Rr - 92, leo - 10, 7, s.role('planet'));
    label(s, box, `DV ${fmt(stagedDv(isp, f, n) / 1000)} KM/S`, L + 4, top - 10, 8, p.hot, 0.5);
    // Payload vs C3 (bottom right), log mass.
    const bTop = midY + 18;
    const bBot = box.y + box.h - 16;
    const cx = (c: number): number => L + (c / 130) * (Rr - L);
    const my = (kg: number): number => bBot - (Math.log10(Math.max(100, kg) / 100) / Math.log10(1e5 / 100)) * (bBot - bTop);
    s.stroke([L, bTop, L, bBot, Rr, bBot], { color: p.dim, glow: 0 });
    LAUNCHERS.forEach((l, i) => {
      const cp: number[] = [];
      for (let c = 0; c <= 130; c += 2) {
        const kg = payloadForC3(l, c);
        if (kg < 100) break;
        cp.push(cx(c), my(kg));
      }
      if (cp.length >= 4) s.stroke(cp, { color: s.role('program'), glow: 0.4, dash: DASHES[i] ?? [] });
      const kg = payloadForC3(l, c3);
      if (kg >= 100) s.circle(cx(c3), my(kg), 3, { color: p.hot, glow: 0.8 });
      s.stroke([Rr - 90, bTop + i * 10 + 3, Rr - 74, bTop + i * 10 + 3], { color: s.role('program'), glow: 0.3, dash: DASHES[i] ?? [] });
      label(s, box, l.name, Rr - 70, bTop + i * 10, 6, p.dim);
    });
    s.stroke([cx(c3), bTop, cx(c3), bBot], { color: p.dim, glow: 0, dash: [1, 3] });
    label(s, box, 'PAYLOAD (LOG) VS C3', L + 4, bTop - 10, 7, p.dim);
  },
};
