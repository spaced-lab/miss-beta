// WHAT: LAB_MAGNITUDE: H from D and albedo, V from geometry, detectable or not per limiting magnitude.
// LORE: F2, O2
import { absoluteMagnitude, apparentMagnitude } from '../../physics/photometry';
import { fmt, type Lab } from './lab';
import { Plot } from './plot';

export const lab: Lab = {
  id: 'LAB_MAGNITUDE',
  title: 'BRIGHTNESS: H AND V',
  code: ['src/physics/photometry.ts: absoluteMagnitude, apparentMagnitude', 'src/sim/detection.ts'],
  sliders: [
    { key: 'D', label: 'D (m)', min: 10, max: 2000, step: 10, value: 140, log: true },
    { key: 'p', label: 'albedo', min: 0.03, max: 0.5, step: 0.01, value: 0.14 },
    { key: 'r', label: 'r sun (AU)', min: 0.5, max: 3, step: 0.05, value: 1.1 },
    { key: 'delta', label: 'delta earth (AU)', min: 0.01, max: 2, step: 0.01, value: 0.1, log: true },
    { key: 'alpha', label: 'phase (deg)', min: 0, max: 120, step: 5, value: 20 },
    { key: 'vlim', label: 'V limit', min: 18, max: 26, step: 0.5, value: 21.5 },
  ],
  lines: (v) => {
    const H = absoluteMagnitude(v.D ?? 1, v.p ?? 0.1);
    const V = apparentMagnitude(H, v.r ?? 1, v.delta ?? 1, v.alpha ?? 0);
    return [
      `H = 5 log10(1329 / (D_km sqrt(p))) = ${fmt(H)}`,
      `V = H + 5 log10(r delta) + 0.035 alpha = ${fmt(V)}   ${V <= (v.vlim ?? 21) ? 'DETECTABLE' : 'TOO FAINT'} for V_lim ${fmt(v.vlim ?? 21)}`,
      'each magnitude is 2.512 x in brightness; five magnitudes is 100 x.',
    ];
  },
  draw: (s, v, box) => {
    const H = absoluteMagnitude(v.D ?? 1, v.p ?? 0.1);
    const pl = new Plot(s, box, 0, 2, 10, 30);
    pl.frame();
    pl.axes('delta (AU)', 'V');
    const c: [number, number][] = [];
    for (let i = 1; i <= 100; i++) {
      const d = (i / 100) * 2;
      c.push([d, apparentMagnitude(H, v.r ?? 1, d, v.alpha ?? 0)]);
    }
    pl.curve(c);
    pl.curve([[0, v.vlim ?? 21], [2, v.vlim ?? 21]], s.palette.hot, [3, 4]);
    pl.label(1.3, v.vlim ?? 21, 'V LIMIT (ABOVE IS TOO FAINT)', s.palette.hot);
    pl.mark(v.delta ?? 1, apparentMagnitude(H, v.r ?? 1, v.delta ?? 1, v.alpha ?? 0), 4);
  },
};
