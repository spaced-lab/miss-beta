// WHAT: LAB_QSTAR: the Benz and Asphaug disruption threshold Q* against body size, with the current body marked
//       and the specific energy Q an impactor delivers drawn over it.
// WHY:  The curve has a minimum near a few hundred metres (strength below, self-gravity above): the bodies
//       easiest to shatter by accident are exactly the mid-size ones a kinetic impactor is aimed at.
// HOW:  fragment.ts qStar(R, rho, strengthMult, material) per type (threats.json multipliers; comets use the
//       ice law), specificEnergy(m, M, U) with M = sphereMass(2R, rho). Log-log axes; the Q line has slope
//       -3 (Q ~ 1/M ~ R^-3) and crosses the curve where a hit turns into a breakup. A pulse ring on the body
//       marker and a probe dot sliding along the curve are the animation.
// LORE: T5 (what they are made of), D4 (fragmentation)

import { sphereMass } from '../../physics/closeApproach';
import { qStar, specificEnergy, type Material } from '../../physics/fragment';
import { THREAT_TYPES } from '../../sim/roundGen';
import { fmt, type Lab } from './lab';
import { frame, label, phase } from './labKit';

const R_LO = 1;
const R_HI = 1e4;
const Q_LO = 1;
const Q_HI = 1e7;

function typeOf(v: Record<string, number>): { label: string; mult: number; material: Material } {
  const tt = THREAT_TYPES[Math.round(v.type ?? 1)] ?? THREAT_TYPES[1];
  if (!tt) return { label: 'STONY', mult: 1, material: 'basalt' };
  return { label: tt.label, mult: tt.strengthMult, material: tt.kind === 'comet' ? 'ice' : 'basalt' };
}

export const lab: Lab = {
  id: 'LAB_QSTAR',
  title: 'DISRUPTION THRESHOLD Q* VS SIZE',
  code: ['src/physics/fragment.ts: qStar, specificEnergy', 'src/physics/closeApproach.ts: sphereMass', 'src/config/threats.json: strengthMult'],
  sliders: [
    { key: 'R', label: 'R radius (m)', min: 1, max: 10000, step: 50, value: 150, log: true },
    { key: 'rho', label: 'rho (kg/m^3)', min: 500, max: 8000, step: 100, value: 2700 },
    { key: 'type', label: 'type 0 RUB 1 STO 2 IRN 3 ICE', min: 0, max: 3, step: 1, value: 1 },
    { key: 'm', label: 'impactor m (kg)', min: 100, max: 100000, step: 500, value: 1000, log: true },
    { key: 'U', label: 'impactor U (km/s)', min: 1, max: 30, step: 0.5, value: 10 },
  ],
  lines: (v) => {
    const R = v.R ?? 150;
    const rho = v.rho ?? 2700;
    const ty = typeOf(v);
    const Qs = qStar(R, rho, ty.mult, ty.material);
    const M = sphereMass(2 * R, rho);
    const Q = specificEnergy(v.m ?? 1000, M, (v.U ?? 10) * 1000);
    return [
      `Q* = (Q0 R_cm^a + B rho R_cm^b) 1e-4 x ${fmt(ty.mult)} (${ty.label}, ${ty.material}) = ${fmt(Qs)} J/kg at R = ${fmt(R)} m`,
      `Q = 0.5 m U^2 / M = 0.5 x ${fmt(v.m ?? 1000)} x (${fmt((v.U ?? 10) * 1000)})^2 / ${M.toExponential(2)} = ${fmt(Q)} J/kg`,
      `Q / Q* = ${fmt(Q / Qs)} -> ${Q >= Qs ? 'DISRUPTED: the body breaks into a cloud' : 'INTACT: a clean push'}`,
    ];
  },
  draw: (s, v, box, t = 0) => {
    const p = s.palette;
    frame(s, box);
    const L = box.x + 34;
    const Rt = box.x + box.w - 10;
    const T = box.y + 16;
    const B = box.y + box.h - 22;
    const X = (R: number): number => L + (Math.log10(R / R_LO) / Math.log10(R_HI / R_LO)) * (Rt - L);
    const Y = (Q: number): number => B - (Math.log10(Math.max(Q_LO, Math.min(Q_HI, Q)) / Q_LO) / Math.log10(Q_HI / Q_LO)) * (B - T);
    // Axes and decade ticks.
    s.stroke([L, T, L, B, Rt, B], { color: p.dim, glow: 0 });
    for (let k = 0; k <= 4; k++) {
      const x = X(Math.pow(10, k));
      s.stroke([x, B, x, B + 3], { color: p.dim, glow: 0 });
      label(s, box, k < 3 ? `${Math.pow(10, k)}M` : `${Math.pow(10, k - 3)}KM`, x - 6, B + 6, 6, p.dim);
    }
    for (let k = 0; k <= 7; k += 1) {
      const y = Y(Math.pow(10, k));
      s.stroke([L - 3, y, L, y], { color: p.dim, glow: 0 });
      if (k % 2 === 1) label(s, box, `1E${k}`, box.x + 4, y - 3, 6, p.dim);
    }
    label(s, box, 'Q (J/KG)', L + 4, T - 10, 7, p.dim);
    label(s, box, 'R', Rt - 8, B - 10, 7, p.dim);
    const rho = v.rho ?? 2700;
    const cur = Math.round(v.type ?? 1);
    // All four type curves: the selected one solid and bright, the others dashed and dim.
    THREAT_TYPES.forEach((tt, i) => {
      const pts: number[] = [];
      for (let k = 0; k <= 80; k++) {
        const R = R_LO * Math.pow(R_HI / R_LO, k / 80);
        pts.push(X(R), Y(qStar(R, rho, tt.strengthMult, tt.kind === 'comet' ? 'ice' : 'basalt')));
      }
      const on = i === cur;
      s.stroke(pts, { color: on ? s.role('threat') : p.dim, glow: on ? 0.8 : 0, ...(on ? {} : { dash: [3, 4] }) });
      if (on) label(s, box, `Q* ${tt.label}`, X(2), Y(qStar(2, rho, tt.strengthMult, tt.kind === 'comet' ? 'ice' : 'basalt')) - 12, 7, s.role('threat'));
    });
    // Impactor Q line: slope -3 in log-log.
    const m = v.m ?? 1000;
    const U = (v.U ?? 10) * 1000;
    // Only the part inside the axes (Q from Q_LO to Q_HI); the line is clipped, not clamped to the edge.
    const qPts: number[] = [];
    for (let k = 0; k <= 80; k++) {
      const R = R_LO * Math.pow(R_HI / R_LO, k / 80);
      const q = specificEnergy(m, sphereMass(2 * R, rho), U);
      if (q >= Q_LO && q <= Q_HI) qPts.push(X(R), Y(q));
    }
    if (qPts.length >= 4) s.stroke(qPts, { color: s.role('craft'), glow: 0.5, dash: [6, 3] });
    label(s, box, 'Q FROM IMPACTOR (DASHED)', X(200), T + 2, 7, s.role('craft'));
    // Probe dot sliding along the selected curve: shows the minimum near a few hundred metres.
    const ty = typeOf(v);
    const Rp = R_LO * Math.pow(R_HI / R_LO, phase(t, 8));
    s.dot(X(Rp), Y(qStar(Rp, rho, ty.mult, ty.material)), 3, p.ink);
    // The current body.
    const R = v.R ?? 150;
    const Qs = qStar(R, rho, ty.mult, ty.material);
    const Q = specificEnergy(m, sphereMass(2 * R, rho), U);
    const bx = X(R);
    s.stroke([bx, T, bx, B], { color: p.dim, glow: 0, dash: [1, 3] });
    s.circle(bx, Y(Qs), 4, { color: p.hot, glow: 1 });
    s.circle(bx, Y(Qs), 4 + 6 * phase(t, 1.6), { color: p.hot, glow: 0.3, alpha: 1 - phase(t, 1.6) });
    s.circle(bx, Y(Q), 3, { color: s.role('craft'), glow: 0.8 });
    label(s, box, Q >= Qs ? 'Q > Q*: BREAKS UP' : 'Q < Q*: INTACT', Math.min(bx + 8, box.x + box.w - 110), Math.min(B - 12, Math.max(Y(Qs), Y(Q)) + 6), 7, Q >= Qs ? s.role('danger') : p.hot);
  },
};
