// WHAT: LAB_TORINO: the Torino chart in the (energy, probability) plane with the current object marked, and
//       its Palermo value with the PS = 0 line for the chosen time to impact.
// WHY:  Torino is for the public (a colour and a number); Palermo is for analysts (risk relative to the
//       background rate of such impacts over the time until the event). Moving T shows what Torino leaves
//       out: the same object is more alarming the sooner it arrives.
// HOW:  risk.ts torino(P, E) sampled on a grid draws the region boundaries; each region carries its level
//       number (so the chart reads in monochrome) and its band colour via roles. palermo(P, E, T) and
//       backgroundFrequency(E) give the PS value; the PS = 0 line is P = f_B(E) T, a straight line of slope
//       -0.8 in log-log. The marker pulses on a 1.5 s loop.
// LORE: F9 (Torino and Palermo), T3 (how often)

import type { Role } from '../../render/palettes';
import { backgroundFrequency, palermo, torino, torinoBand, type TorinoBand } from '../../physics/risk';
import { fmt, type Lab } from './lab';
import { frame, label, phase } from './labKit';

const E_LO = 0;
const E_HI = 8;
const P_LO = -8;
const P_HI = 0;
const GX = 96;
const GY = 48;
/** Height of the P >= 0.99 strip (levels 8 to 10) above the chart, px. */
const STRIP = 14;

const BAND_ROLE: Readonly<Record<TorinoBand, Role | null>> = { WHITE: null, GREEN: 'planet', YELLOW: 'threat', ORANGE: 'nuclear', RED: 'danger' };

const MEANING = ['NO HAZARD', 'NORMAL: ROUTINE DISCOVERY', 'MERITS ATTENTION', 'MERITS ATTENTION', 'MERITS ATTENTION', 'THREATENING', 'THREATENING', 'THREATENING', 'CERTAIN COLLISION', 'CERTAIN COLLISION', 'CERTAIN COLLISION'];

export const lab: Lab = {
  id: 'LAB_TORINO',
  title: 'TORINO AND PALERMO SCALES',
  code: ['src/physics/risk.ts: torino, torinoBand, palermo, backgroundFrequency'],
  sliders: [
    { key: 'P', label: 'P impact probability', min: 1e-8, max: 1, step: 0.0125, value: 0.03, log: true },
    { key: 'E', label: 'E energy (Mt)', min: 1, max: 1e8, step: 1.25e6, value: 8, log: true },
    { key: 'T', label: 'T years to event', min: 1, max: 100, step: 1, value: 7 },
  ],
  lines: (v) => {
    const P = v.P ?? 0.03;
    const E = v.E ?? 8;
    const T = v.T ?? 7;
    const lvl = torino(P, E);
    const fB = backgroundFrequency(E);
    const ps = palermo(P, E, T);
    return [
      `Torino(P ${fmt(P)}, E ${fmt(E)} Mt) = ${lvl} ${torinoBand(lvl)}: ${MEANING[lvl] ?? ''}`,
      `f_B = 0.03 E^-0.8 = ${fB.toExponential(2)} per year (one such impact every ${fmt(1 / fB)} years)`,
      `PS = log10(P / (f_B T)) = log10(${fmt(P)} / (${fB.toExponential(2)} x ${fmt(T)})) = ${ps.toFixed(2)}`,
      ps < -2 ? 'PS < -2: no concern.' : ps < 0 ? '-2 < PS < 0: monitor; worth more observations.' : 'PS > 0: above the background risk: act.',
    ];
  },
  draw: (s, v, box, t = 0) => {
    const p = s.palette;
    frame(s, box);
    const L = box.x + 30;
    const R = box.x + box.w - 8;
    const S = box.y + 16;
    const T = S + STRIP + 2;
    const B = box.y + box.h - 22;
    const X = (e: number): number => L + ((e - E_LO) / (E_HI - E_LO)) * (R - L);
    const Y = (lp: number): number => B - ((lp - P_LO) / (P_HI - P_LO)) * (B - T);
    const cell = (i: number, j: number): number => torino(Math.pow(10, P_LO + ((j + 0.5) / GY) * (P_HI - P_LO)), Math.pow(10, E_LO + ((i + 0.5) / GX) * (E_HI - E_LO)));
    const grid: number[][] = [];
    for (let i = 0; i < GX; i++) {
      const col: number[] = [];
      for (let j = 0; j < GY; j++) col.push(cell(i, j));
      grid.push(col);
    }
    const at = (i: number, j: number): number => grid[i]?.[j] ?? -1;
    const colorOf = (lvl: number): string => {
      const r = BAND_ROLE[torinoBand(lvl)];
      return r ? s.role(r) : p.dim;
    };
    // Region boundaries: a segment wherever two neighbouring cells differ.
    const cw = (R - L) / GX;
    const ch = (B - T) / GY;
    for (let i = 0; i < GX; i++) {
      for (let j = 0; j < GY; j++) {
        const here = at(i, j);
        const x = L + i * cw;
        const y = B - (j + 1) * ch;
        if (i + 1 < GX && at(i + 1, j) !== here) s.stroke([x + cw, y, x + cw, y + ch], { color: colorOf(Math.max(here, at(i + 1, j))), glow: 0.3 });
        if (j + 1 < GY && at(i, j + 1) !== here) s.stroke([x, y, x + cw, y], { color: colorOf(Math.max(here, at(i, j + 1))), glow: 0.3 });
      }
    }
    // Level numbers at each region's centroid.
    const sum = new Map<number, [number, number, number]>();
    for (let i = 0; i < GX; i++) {
      for (let j = 0; j < GY; j++) {
        const lvl = at(i, j);
        const acc = sum.get(lvl) ?? [0, 0, 0];
        sum.set(lvl, [acc[0] + i, acc[1] + j, acc[2] + 1]);
      }
    }
    for (const [lvl, [si, sj, n]] of sum) {
      if (lvl < 0 || n === 0) continue;
      label(s, box, `${lvl}`, L + (si / n + 0.5) * cw - 3, B - (sj / n + 0.5) * ch - 4, 9, colorOf(lvl), 0.5);
    }
    // The certain-collision strip (P >= 0.99: too thin to see on a log axis), sampled along E.
    s.stroke([L, S, R, S, R, S + STRIP, L, S + STRIP], { color: s.role('danger'), glow: 0.3, closed: true });
    let prev = torino(1, 1);
    let x0 = L;
    for (let i = 1; i <= GX; i++) {
      const lvl = i < GX ? torino(1, Math.pow(10, E_LO + (i / GX) * (E_HI - E_LO))) : -1;
      if (lvl !== prev) {
        const x = L + (i / GX) * (R - L);
        if (i < GX) s.stroke([x, S, x, S + STRIP], { color: s.role('danger'), glow: 0.3 });
        label(s, box, `${prev}`, (x0 + x) / 2 - 4, S + 4, 7, s.role('danger'), 0.5);
        x0 = x;
        prev = lvl;
      }
    }
    label(s, box, 'P>.99', box.x + 2, S + 4, 5, p.dim);
    // Axes.
    s.stroke([L, T, L, B, R, B], { color: p.dim, glow: 0 });
    for (let e = 0; e <= 8; e += 2) {
      s.stroke([X(e), B, X(e), B + 3], { color: p.dim, glow: 0 });
      label(s, box, e === 0 ? '1 MT' : `1E${e}`, X(e) - 6, B + 6, 6, p.dim);
    }
    for (let lp = -8; lp <= 0; lp += 2) {
      s.stroke([L - 3, Y(lp), L, Y(lp)], { color: p.dim, glow: 0 });
      label(s, box, lp === 0 ? '1' : `1E${lp}`, box.x + 3, Y(lp) - 3, 6, p.dim);
    }
    // Palermo PS = 0 line: log P = log10(0.03 T) - 0.8 log E.
    const Tyr = v.T ?? 7;
    const lp0 = (e: number): number => Math.log10(backgroundFrequency(Math.pow(10, e)) * Tyr);
    const e0 = E_LO;
    const e1 = E_HI;
    const clampY = (lp: number): number => Y(Math.max(P_LO, Math.min(P_HI, lp)));
    s.stroke([X(e0), clampY(lp0(e0)), X(e1), clampY(lp0(e1))], { color: s.role('orbit'), glow: 0.5, dash: [6, 3] });
    label(s, box, `PS = 0 (T ${fmt(Tyr)} YR)`, X(5.2), clampY(lp0(5.2)) - 12, 7, s.role('orbit'));
    // Current object.
    const P = v.P ?? 0.03;
    const E = v.E ?? 8;
    const mx = X(Math.log10(E));
    const my = Y(Math.log10(P));
    const lvl = torino(P, E);
    s.stroke([mx, T, mx, B], { color: p.dim, glow: 0, dash: [1, 3] });
    s.stroke([L, my, R, my], { color: p.dim, glow: 0, dash: [1, 3] });
    s.circle(mx, my, 4, { color: p.hot, glow: 1 });
    const ph = phase(t, 1.5);
    s.circle(mx, my, 4 + 8 * ph, { color: colorOf(lvl), glow: 0.4, alpha: 1 - ph });
    label(s, box, `TORINO ${lvl} ${torinoBand(lvl)}   PS ${palermo(P, E, Tyr).toFixed(2)}`, L + 4, box.y + 4, 8, p.hot, 0.5);
  },
};
