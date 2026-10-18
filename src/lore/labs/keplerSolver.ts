// WHAT: LAB_KEPLER_SOLVER: Newton's iterations on E - e sin E = M drawn on the curve.
// LORE: O9, O13
import { fmt, type Lab } from './lab';
import { Plot } from './plot';

export const lab: Lab = {
  id: 'LAB_KEPLER_SOLVER',
  title: 'KEPLER SOLVER: NEWTON ON E - e sin E = M',
  code: ['src/physics/kepler.ts: solveKepler'],
  sliders: [
    { key: 'e', label: 'e', min: 0, max: 0.99, step: 0.01, value: 0.8 },
    { key: 'M', label: 'M (rad)', min: 0, max: 6.28, step: 0.02, value: 1 },
    { key: 'steps', label: 'steps shown', min: 0, max: 8, step: 1, value: 3 },
  ],
  lines: (v) => {
    const e = v.e ?? 0;
    const M = v.M ?? 0;
    let E = e < 0.8 ? M : Math.PI;
    const out = [`start E0 = ${e < 0.8 ? 'M' : 'pi'} = ${fmt(E)}`];
    for (let i = 0; i < (v.steps ?? 0); i++) {
      const f = E - e * Math.sin(E) - M;
      const fp = 1 - e * Math.cos(E);
      const dE = f / fp;
      E -= dE;
      out.push(`step ${i + 1}: f = ${fmt(f, 4)}  f' = ${fmt(fp, 4)}  dE = ${fmt(dE, 4)}  E = ${fmt(E, 6)}`);
    }
    return out;
  },
  draw: (s, v, box) => {
    const e = v.e ?? 0;
    const M = v.M ?? 0;
    const pl = new Plot(s, box, 0, 2 * Math.PI, -1, 2 * Math.PI + 1);
    pl.frame();
    pl.axes('E', 'E - e sin E');
    const c: [number, number][] = [];
    for (let i = 0; i <= 120; i++) {
      const E = (i / 120) * 2 * Math.PI;
      c.push([E, E - e * Math.sin(E)]);
    }
    pl.curve(c);
    pl.curve([[0, M], [2 * Math.PI, M]], s.palette.dim, [3, 4]);
    let E = e < 0.8 ? M : Math.PI;
    for (let i = 0; i < (v.steps ?? 0); i++) {
      const f = E - e * Math.sin(E) - M;
      const fp = 1 - e * Math.cos(E);
      const En = E - f / fp;
      pl.curve([[E, E - e * Math.sin(E)], [En, M]], s.palette.hot);
      pl.mark(E, E - e * Math.sin(E), 2);
      E = En;
    }
    pl.mark(E, M, 4);
  },
};
