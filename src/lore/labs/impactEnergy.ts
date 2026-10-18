// WHAT: LAB_IMPACT_ENERGY: mass, impact speed and energy of a rock from D, rho and v_inf; log-scale comparison
//       bars against Hiroshima, Chelyabinsk, Tunguska, the Tsar Bomba, Krakatoa and Chicxulub.
// WHY:  Energy goes as D^3 v^2, so the bars span eleven decades: a log scale is the only honest picture, and
//       watching them fill one after another shows how far apart "a city" and "the dinosaurs" are.
// HOW:  closeApproach.ts sphereMass / impactEnergy / impactCategory / escapeSpeed do all the physics. The bars
//       grow over the first seconds of a 7 s loop (staggered), then hold: a pure function of t.
// LORE: T2 (how big is dangerous), O5 (energy and momentum)

import { escapeSpeed, impactCategory, impactEnergy } from '../../physics/closeApproach';
import { MU_HOME, R_HOME } from '../../physics/constants';
import { fmt, type Lab } from './lab';
import { ease, frame, label, logFrac, phase, rect } from './labKit';

/** Reference events, Mt TNT (order-of-magnitude literature values). */
const REFS: readonly (readonly [string, number])[] = [
  ['HIROSHIMA 1945', 0.015],
  ['CHELYABINSK 2013', 0.5],
  ['TUNGUSKA 1908', 10],
  ['TSAR BOMBA 1961', 50],
  ['KRAKATOA 1883', 200],
  ['CHICXULUB', 1e8],
];
const LO = 1e-3;
const HI = 1e9;

function compute(v: Record<string, number>): { D: number; rho: number; vImp: number; vEsc: number; mass: number; J: number; Mt: number; cat: string } {
  const D = v.D ?? 140;
  const rho = v.rho ?? 2700;
  const vEsc = escapeSpeed(MU_HOME, R_HOME);
  const vInf = (v.vinf ?? 17) * 1000;
  const vImp = Math.sqrt(vInf * vInf + vEsc * vEsc);
  const e = impactEnergy(D, rho, vImp);
  return { D, rho, vImp, vEsc, mass: e.mass, J: e.energyJ, Mt: e.energyMt, cat: impactCategory(D, rho >= 5000) };
}

export const lab: Lab = {
  id: 'LAB_IMPACT_ENERGY',
  title: 'IMPACT ENERGY: E = 1/2 M v^2',
  code: ['src/physics/closeApproach.ts: sphereMass, impactEnergy, impactCategory, escapeSpeed'],
  sliders: [
    { key: 'D', label: 'D diameter (m)', min: 5, max: 10000, step: 50, value: 140, log: true },
    { key: 'rho', label: 'rho (kg/m^3)', min: 600, max: 8000, step: 100, value: 2700 },
    { key: 'vinf', label: 'v_inf (km/s)', min: 1, max: 70, step: 0.5, value: 17 },
  ],
  lines: (v) => {
    const c = compute(v);
    return [
      `M = (4/3) pi (D/2)^3 rho = (4/3) pi (${fmt(c.D / 2)} m)^3 x ${fmt(c.rho)} = ${c.mass.toExponential(2)} kg`,
      `v = sqrt(v_inf^2 + v_esc^2) = sqrt(${fmt((v.vinf ?? 17))}^2 + ${fmt(c.vEsc / 1000)}^2) = ${fmt(c.vImp / 1000)} km/s`,
      `E = 0.5 M v^2 = ${c.J.toExponential(2)} J = ${fmt(c.Mt)} Mt TNT -> ${c.cat}${c.rho >= 5000 ? ' (iron)' : ''}`,
      `= ${fmt(c.Mt / 0.015)} Hiroshimas = ${fmt(c.Mt / 50)} Tsar Bombas. Double D: 8x the energy.`,
    ];
  },
  draw: (s, v, box, t = 0) => {
    const p = s.palette;
    const c = compute(v);
    frame(s, box);
    const rows: (readonly [string, number, boolean])[] = REFS.map(([n, e]) => [n, e, false] as const);
    // Insert this impact in energy order so the bar sits among its neighbours.
    const at = rows.findIndex((r) => r[1] > c.Mt);
    rows.splice(at < 0 ? rows.length : at, 0, ['THIS IMPACT', c.Mt, true]);
    const labelW = Math.min(120, box.w * 0.32);
    const x0 = box.x + 8 + labelW;
    const bw = box.x + box.w - 12 - x0;
    const top = box.y + 18;
    const rowH = Math.max(10, (box.h - 40) / rows.length);
    const ph = phase(t, 7) * 7;
    label(s, box, `${c.cat}   ${fmt(c.Mt)} MT`, box.x + 8, box.y + 5, 8, p.hot, 0.6);
    rows.forEach(([name, e, mine], i) => {
      const y = top + i * rowH;
      const grow = ease((ph - i * 0.25) / 1.2);
      const w = Math.max(1, logFrac(e, LO, HI) * bw * grow);
      const col = mine ? s.role('threat') : name.startsWith('HIROSHIMA') || name.startsWith('TSAR') ? s.role('nuclear') : p.ink;
      label(s, { ...box, w: labelW + 8 }, name, box.x + 8, y + 1, 7, mine ? p.hot : p.dim);
      const h = Math.max(4, rowH - 5);
      rect(s, x0, y, w, h, { color: col, glow: mine ? 1 : 0.3, ...(mine ? {} : name.startsWith('HIROSHIMA') || name.startsWith('TSAR') ? { dash: [2, 2] } : {}) });
      if (mine) rect(s, x0 - 2, y - 2, w + 4, h + 4, { color: col, glow: 0.3 });
    });
    // Decade axis.
    const ay = top + rows.length * rowH + 2;
    s.stroke([x0, ay, x0 + bw, ay], { color: p.dim, glow: 0 });
    for (let k = -3; k <= 9; k += 3) {
      const x = x0 + logFrac(Math.pow(10, k), LO, HI) * bw;
      s.stroke([x, ay, x, ay + 3], { color: p.dim, glow: 0 });
      label(s, box, k === 0 ? '1 MT' : `1E${k}`, x - 6, ay + 5, 6, p.dim);
    }
  },
};
