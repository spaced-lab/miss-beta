// WHAT: LAB_NUKE_STANDOFF: a standoff burst at height H beside a body of radius R; the intercepted fraction
//       f_omega, the absorbed energy, the push dv and the disruption check against Q*.
// WHY:  Closer bursts catch more of the yield (f_omega -> 0.5 at the surface) but heat a smaller cap; the
//       far burst wastes most of the X-rays. The picture shows the cone of rays that hits, the heated face
//       blowing off as vapour, and the body recoiling the other way.
// HOW:  nuclear.ts nuclearBurst(Y, 'STANDOFF', M, R, H) and interceptedFraction(R, H); M from
//       closeApproach.ts sphereMass. The C_m slider rescales dp = C_m E_abs linearly from the knob value
//       (KNOBS.NUKE_CM) the function uses. Disruption: Q = E_abs / M against fragment.ts qStar. The X-ray
//       shell expands from the burst point on a 3 s loop; once it reaches the surface the cap flashes and
//       vapour streams back toward the burst: a pure function of t.
// LORE: D5 (nuclear options), D4 (fragmentation)

import { KNOBS } from '../../config/knobs';
import { sphereMass } from '../../physics/closeApproach';
import { MT_TNT } from '../../physics/constants';
import { qStar } from '../../physics/fragment';
import { interceptedFraction, nuclearBurst } from '../../physics/nuclear';
import { fmt, type Lab } from './lab';
import { arrow, frame, label, phase } from './labKit';

function compute(v: Record<string, number>): { Y: number; R: number; H: number; rho: number; M: number; f: number; eAbs: number; dv: number; Q: number; Qs: number; qSurf: number } {
  const Y = v.Y ?? 1;
  const R = v.R ?? 500;
  const H = (v.HR ?? 0.5) * R;
  const rho = v.rho ?? 2700;
  const M = sphereMass(2 * R, rho);
  const res = nuclearBurst(Y, 'STANDOFF', M, R, H);
  const cm = (v.Cm ?? 3) * 1e-4;
  return { Y, R, H, rho, M, f: interceptedFraction(R, H), eAbs: res.eAbs, dv: res.dv * (cm / KNOBS.NUKE_CM), Q: res.Q, Qs: qStar(R, rho), qSurf: nuclearBurst(Y, 'SURFACE', M, R, 0).Q };
}

export const lab: Lab = {
  id: 'LAB_NUKE_STANDOFF',
  title: 'NUCLEAR STANDOFF: X-RAY ABLATION',
  code: ['src/physics/nuclear.ts: nuclearBurst, interceptedFraction', 'src/physics/fragment.ts: qStar', 'src/config/knobs.ts: NUKE_EPS, NUKE_CM'],
  sliders: [
    { key: 'Y', label: 'Y yield (Mt)', min: 0.01, max: 10, step: 0.05, value: 1, log: true },
    { key: 'HR', label: 'H / R burst height', min: 0.05, max: 5, step: 0.05, value: 0.5 },
    { key: 'R', label: 'R radius (m)', min: 25, max: 5000, step: 25, value: 500, log: true },
    { key: 'rho', label: 'rho (kg/m^3)', min: 600, max: 8000, step: 100, value: 2700 },
    { key: 'Cm', label: 'C_m (1e-4 N s/J)', min: 0.5, max: 10, step: 0.5, value: 3 },
  ],
  lines: (v) => {
    const c = compute(v);
    const x = c.R / (c.R + c.H);
    const eps = KNOBS.NUKE_EPS.STANDOFF ?? 0.3;
    return [
      `f_omega = (1 - sqrt(1 - (R/(R+H))^2)) / 2 = (1 - sqrt(1 - ${fmt(x)}^2)) / 2 = ${fmt(c.f)}`,
      `E_abs = eps f_omega Y = ${fmt(eps)} x ${fmt(c.f)} x ${(c.Y * MT_TNT).toExponential(2)} J = ${c.eAbs.toExponential(2)} J`,
      `dv = C_m E_abs / M = ${fmt((v.Cm ?? 3) * 1e-4)} x ${c.eAbs.toExponential(2)} / ${c.M.toExponential(2)} kg = ${fmt(c.dv * 100)} cm/s`,
      `Q = E_abs/M = ${fmt(c.Q)} J/kg vs Q* ${fmt(c.Qs)} -> ${c.Q >= c.Qs ? 'DISRUPTS' : 'INTACT'}; a surface burst gives Q ${fmt(c.qSurf)}`,
    ];
  },
  draw: (s, v, box, t = 0) => {
    const p = s.palette;
    const c = compute(v);
    frame(s, box);
    // Side view: burst on the left, body on the right; scale so R + H + R fits with margins.
    const span = c.H + 2 * c.R;
    const k = Math.min((box.w - 60) / span, (box.h - 50) / (2 * c.R));
    const cy = box.y + box.h / 2 + 4;
    const bx = box.x + 24;
    const cx = bx + (c.R + c.H) * k;
    const rp = c.R * k;
    // Body outline (lumpy polygon so it reads as a rock in monochrome).
    const body: number[] = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r = rp * (1 + 0.05 * Math.sin(5 * a) + 0.03 * Math.cos(3 * a));
      body.push(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    s.stroke(body, { color: s.role('threat'), glow: 0.7, closed: true });
    // Tangent cone: the rays that hit. Half-angle asin(R / (R + H)); the lit cap spans +/- acos(R / (R + H)).
    const half = Math.asin(Math.min(1, c.R / (c.R + c.H)));
    const L = Math.sqrt(Math.max(0, (c.R + c.H) ** 2 - c.R ** 2)) * k;
    for (const sg of [-1, 1]) s.stroke([bx, cy, bx + L * Math.cos(half), cy + sg * L * Math.sin(half)], { color: p.dim, glow: 0, dash: [2, 3] });
    const capHalf = Math.acos(Math.min(1, c.R / (c.R + c.H)));
    const ph = phase(t, 3);
    const shellR = ph * (span * 1.1) * k;
    const lit = shellR >= c.H * k;
    const cap: number[] = [];
    for (let i = 0; i <= 16; i++) {
      const a = Math.PI - capHalf + (2 * capHalf * i) / 16;
      cap.push(cx + (rp + 2) * Math.cos(a), cy + (rp + 2) * Math.sin(a));
    }
    s.stroke(cap, { color: lit ? p.hot : s.role('nuclear'), glow: lit ? 1.2 : 0.3, width: lit ? 2 : 1 });
    // X-ray shell (dashed: the nuclear role's line style) and a fainter trailing shell.
    s.circle(bx, cy, Math.max(1, shellR), { color: s.role('nuclear'), glow: 0.8, dash: [2, 2], alpha: 1 - ph * 0.7 });
    if (shellR > 12) s.circle(bx, cy, shellR - 10, { color: s.role('nuclear'), glow: 0.2, dash: [1, 4], alpha: 0.5 * (1 - ph) });
    // Burst marker: a small star.
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI;
      s.stroke([bx - 5 * Math.cos(a), cy - 5 * Math.sin(a), bx + 5 * Math.cos(a), cy + 5 * Math.sin(a)], { color: s.role('nuclear'), glow: 1 });
    }
    label(s, box, 'BURST', bx - 14, cy + 10, 7, p.dim);
    // Vapour streams off the cap back toward the burst after the shell arrives.
    if (lit) {
      const since = (shellR - c.H * k) / Math.max(1, span * 1.1 * k - c.H * k);
      for (let i = 0; i < 9; i++) {
        const a = Math.PI - capHalf * 0.9 + (1.8 * capHalf * i) / 8;
        const d = rp + 3 + since * 28 * (0.6 + 0.4 * Math.abs(Math.sin(i * 1.7)));
        s.dot(cx + d * Math.cos(a), cy + d * Math.sin(a), 1.6, p.hot);
      }
      // Recoil arrow on the far side.
      arrow(s, cx + rp + 4, cy, cx + rp + 4 + 10 + 14 * since, cy, { color: s.role('threat'), glow: 0.8 });
    }
    label(s, box, `F_OMEGA ${fmt(100 * c.f)}%   DV ${fmt(c.dv * 100)} CM/S`, box.x + 8, box.y + 6, 8, p.hot, 0.5);
    label(s, box, `H = ${fmt(c.H)} M`, bx + 10, cy - 14, 7, p.dim);
    label(s, box, c.Q >= c.Qs ? 'Q > Q*: DISRUPTS' : 'INTACT: Q < Q*', box.x + 8, box.y + box.h - 14, 8, c.Q >= c.Qs ? s.role('danger') : p.dim);
  },
};
