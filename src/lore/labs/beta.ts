// WHAT: LAB_BETA: dv = beta m U / M with momentum bars; DART preset is the default.
// LORE: D3, O5
import { kineticDv } from '../../physics/kinetic';
import { missFromImpulse } from '../../physics/estimates';
import { YEAR } from '../../physics/constants';
import { drawText } from '../../render/vectorFont';
import { fmt, type Lab } from './lab';

export const lab: Lab = {
  id: 'LAB_BETA',
  title: 'KINETIC IMPACT: dv = beta m U / M',
  code: ['src/physics/kinetic.ts: kineticDv, kineticImpact', 'src/physics/estimates.ts: missFromImpulse'],
  sliders: [
    { key: 'm', label: 'm impactor (kg)', min: 100, max: 50000, step: 100, value: 580, log: true },
    { key: 'U', label: 'U (km/s)', min: 1, max: 30, step: 0.5, value: 6.14 },
    { key: 'M', label: 'M target (kg)', min: 1e8, max: 1e13, step: 1e8, value: 4.3e9, log: true },
    { key: 'beta', label: 'beta', min: 1, max: 6, step: 0.1, value: 3.6 },
    { key: 'T', label: 'years to impact', min: 0.5, max: 20, step: 0.5, value: 5 },
  ],
  lines: (v) => {
    const dv = kineticDv(v.m ?? 1, v.M ?? 1, (v.U ?? 1) * 1000, v.beta ?? 1);
    const miss = missFromImpulse(dv, (v.T ?? 1) * YEAR);
    return [
      `dv = ${fmt(v.beta ?? 1)} x ${fmt(v.m ?? 1)} kg x ${fmt((v.U ?? 1) * 1000)} m/s / ${(v.M ?? 1).toExponential(2)} kg = ${dv.toExponential(3)} m/s`,
      `miss after T: 3 dv T = 3 x ${dv.toExponential(2)} x ${fmt((v.T ?? 1) * YEAR)} s = ${fmt(miss / 1000)} km = ${fmt(miss / 6371e3)} Earth radii`,
      'DART (2022): m 580 kg, U 6.14 km/s, M 4.3e9 kg, beta 3.6 -> dv 2.98 mm/s; the orbit period changed by 33 min.',
    ];
  },
  draw: (s, v, box) => {
    const p = s.palette;
    const m = v.m ?? 1;
    const U = (v.U ?? 1) * 1000;
    const beta = v.beta ?? 1;
    const bars: [string, number][] = [
      ['IMPACTOR  m U', m * U],
      ['EJECTA  (beta - 1) m U', (beta - 1) * m * U],
      ['TARGET  beta m U', beta * m * U],
    ];
    const max = Math.max(...bars.map((b) => b[1]));
    const x0 = box.x + 200;
    const w = box.w - 220;
    bars.forEach(([name, val], i) => {
      const y = box.y + 30 + i * 46;
      drawText(s, name, box.x + 10, y, 9, { color: p.dim, glow: 0 });
      const bw = (val / max) * w;
      s.stroke([x0, y + 2, x0 + bw, y + 2, x0 + bw, y + 14, x0, y + 14], { closed: true, color: i === 2 ? p.hot : p.ink, glow: 0.5 });
      drawText(s, `${val.toExponential(2)} N s`, x0 + bw + 6, y + 3, 8, { color: p.dim, glow: 0 });
    });
    drawText(s, 'MOMENTUM IS CONSERVED: THE EJECTA FLYING BACK IS WHAT MULTIPLIES THE PUSH.', box.x + 10, box.y + box.h - 18, 8, { color: p.dim, glow: 0 });
  },
};
