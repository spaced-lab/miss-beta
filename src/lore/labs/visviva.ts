// WHAT: LAB_VISVIVA: speed on an orbit from r and a, with circular and escape markers.
// LORE: O8
import { AU, MU_SUN } from '../../physics/constants';
import { visViva } from '../../physics/kepler';
import { fmt, type Lab } from './lab';
import { Plot } from './plot';

export const lab: Lab = {
  id: 'LAB_VISVIVA',
  title: 'VIS-VIVA: v = sqrt(mu (2/r - 1/a))',
  code: ['src/physics/kepler.ts: visViva, specificEnergy'],
  sliders: [
    { key: 'r', label: 'r (AU)', min: 0.3, max: 5, step: 0.05, value: 1 },
    { key: 'a', label: 'a (AU)', min: 0.3, max: 8, step: 0.05, value: 1.5 },
  ],
  lines: (v) => {
    const r = (v.r ?? 1) * AU;
    const a = (v.a ?? 1) * AU;
    const ok = 2 / r - 1 / a > 0;
    const vel = ok ? visViva(MU_SUN, r, a) : NaN;
    return [
      ok ? `v = sqrt(${MU_SUN.toExponential(3)} x (2/${fmt(r / AU)} AU - 1/${fmt(a / AU)} AU)) = ${fmt(vel / 1000)} km/s` : 'r > 2a: no orbit with this a reaches this r',
      `circular at r: ${fmt(Math.sqrt(MU_SUN / r) / 1000)} km/s    escape at r: ${fmt(Math.sqrt((2 * MU_SUN) / r) / 1000)} km/s`,
    ];
  },
  draw: (s, v, box) => {
    const a = (v.a ?? 1) * AU;
    const pl = new Plot(s, box, 0, 5, 0, 80);
    pl.frame();
    pl.axes('r (AU)', 'km/s');
    const curve: [number, number][] = [];
    const circ: [number, number][] = [];
    const esc: [number, number][] = [];
    for (let i = 1; i <= 100; i++) {
      const r = (i / 100) * 5 * AU;
      if (2 / r - 1 / a > 0) curve.push([r / AU, visViva(MU_SUN, r, a) / 1000]);
      circ.push([r / AU, Math.sqrt(MU_SUN / r) / 1000]);
      esc.push([r / AU, Math.sqrt((2 * MU_SUN) / r) / 1000]);
    }
    pl.curve(circ, s.palette.dim, [2, 4]);
    pl.curve(esc, s.palette.dim, [6, 4]);
    pl.curve(curve);
    const r = (v.r ?? 1) * AU;
    if (2 / r - 1 / a > 0) pl.mark(r / AU, visViva(MU_SUN, r, a) / 1000, 4);
    pl.label(3.6, 68, 'ESCAPE (DASHED LONG)');
    pl.label(3.6, 58, 'CIRCULAR (DASHED SHORT)');
  },
};
