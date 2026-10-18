// WHAT: LAB_GAUGE: the detection gauge for a chosen game year and set of planned networks, with the share of
//       practice impactors found in time plotted against size for each kind of warning.
// WHY:  EDUCATION F11: the needles are where those curves cross one half. Watching a curve slide left as a
//       survey is switched on, or as Rubin's years add up, shows why the catalog of 20 to 140 m rocks is thin.
// HOW:  Calls readGauge (src/sim/gauge.ts) in the planner worker, so the first reading (about two seconds of
//       night tables) never freezes the page; until it arrives the panel reads COMPUTING. Readings are memoised
//       by the slider values. Switched-on planned networks count from PLANNED_SINCE. The bars are the game's
//       own gaugeView; the curves are drawn on the same log axis below them.
// LORE: F11 (the detection gauge), F5 (today's surveys), F7 (future missions)

import { KNOBS } from '../../config/knobs';
import { sharedPlanner, type PlannerClient } from '../../planner/workerClient';
import { drawGauge, gaugeX } from '../../render/gaugeView';
import { defaultActiveNetworks } from '../../sim/detection';
import { sizeLabel, type GaugeReading, type NeedleId } from '../../sim/gauge';
import { fmt, type Lab } from './lab';
import { fitLabel, keyOf } from './kit';

/** NOTE: lab scenario: a planned network switched on here is assumed to fly from this year. */
const PLANNED_SINCE = 2027;
const PLANNED: readonly [string, string][] = [
  ['ir', 'SPACE_IR_SURVEYOR'],
  ['sentinel', 'SUNWARD_SENTINEL'],
  ['l4l5', 'L4_L5_SENTINELS'],
  ['venus', 'VENUS_ORBIT_IR'],
];
const CURVES: readonly [NeedleId, readonly number[]][] = [
  ['DEFLECT', []],
  ['EVACUATE', [5, 3]],
  ['SUNWARD', [2, 3]],
  ['INTERSTELLAR', [8, 3, 2, 3]],
];

let client: PlannerClient | null = null;
const readings = new Map<string, GaugeReading | 'PENDING'>();

function reading(v: Record<string, number>): GaugeReading | null {
  const year = Math.round(v.year ?? 2026);
  const on = PLANNED.filter(([k]) => (v[k] ?? 0) >= 0.5).map(([, id]) => id);
  const key = keyOf(year, ...PLANNED.map(([k]) => ((v[k] ?? 0) >= 0.5 ? 1 : 0)));
  const hit = readings.get(key);
  if (hit === 'PENDING') return null;
  if (hit) return hit;
  readings.set(key, 'PENDING');
  client ??= sharedPlanner();
  const since = Object.fromEntries(on.map((id) => [id, PLANNED_SINCE]));
  client
    .gauge([...defaultActiveNetworks(), ...on], since, year)
    .then((r) => readings.set(key, r))
    .catch(() => readings.delete(key));
  return null;
}

export const lab: Lab = {
  id: 'LAB_GAUGE',
  title: 'THE DETECTION GAUGE',
  code: ['src/sim/gauge.ts: readGauge, nightCeiling, trailingLoss, tiltAboutNode', 'src/sim/detection.ts: networks', 'src/render/gaugeView.ts: drawGauge'],
  sliders: [
    { key: 'year', label: 'game year', min: 2026, max: 2060, step: 1, value: 2026 },
    { key: 'ir', label: 'space IR surveyor (L1)', min: 0, max: 1, step: 1, value: 0 },
    { key: 'sentinel', label: 'sunward sentinel', min: 0, max: 1, step: 1, value: 0 },
    { key: 'l4l5', label: 'L4/L5 sentinels', min: 0, max: 1, step: 1, value: 0 },
    { key: 'venus', label: 'Venus-orbit IR', min: 0, max: 1, step: 1, value: 0 },
  ],
  lines: (v) => {
    const r = reading(v);
    if (!r) return ['computing the night tables in the worker (about two seconds the first time) ...'];
    const n = r.needles;
    return [
      `needle = smallest D found in time on ${fmt(KNOBS.GAUGE_CATCH_SHARE * 100)} % of practice impactors (game model)`,
      `DEFLECT (1 yr) ${sizeLabel(n.DEFLECT)}   EVACUATE (3 wk) ${sizeLabel(n.EVACUATE)}   SUNWARD (3 wk) ${sizeLabel(n.SUNWARD)}`,
      `INTERSTELLAR (3 wk) ${sizeLabel(n.INTERSTELLAR)}   AFTERMATH (fireballs) ${sizeLabel(n.AFTERMATH)}`,
      `planned networks fly from ${PLANNED_SINCE}; Rubin from 2026: move the year to watch its catalog fill`,
    ];
  },
  draw: (s, v, box) => {
    const r = reading(v);
    const pal = s.palette;
    s.stroke([box.x, box.y, box.x + box.w, box.y, box.x + box.w, box.y + box.h, box.x, box.y + box.h], { closed: true, color: pal.dim, glow: 0 });
    const used = drawGauge(s, r, box.x + 6, box.y + 6, box.w - 12, { title: false });
    if (!r) return;
    // Curves: share found in time vs size, on the gauge's own log axis (labels column is 150 px wide).
    const x0 = box.x + 6 + 150;
    const w = Math.max(80, box.w - 12 - 150 - 10);
    const top = box.y + 6 + used + 10;
    const h = box.y + box.h - 18 - top;
    if (h < 40) return;
    s.stroke([x0, top, x0, top + h, x0 + w, top + h], { color: pal.dim, glow: 0 });
    s.stroke([x0, top + h / 2, x0 + w, top + h / 2], { color: pal.dim, glow: 0, dash: [1, 4] });
    fitLabel(s, box, '1', x0 - 10, top - 3, pal.dim, 7);
    fitLabel(s, box, '1/2', x0 - 22, top + h / 2 - 4, pal.dim, 7);
    fitLabel(s, box, '0', x0 - 10, top + h - 6, pal.dim, 7);
    CURVES.forEach(([id, dash], i) => {
      const c = r.curves[id];
      const pts: number[] = [];
      r.grid.forEach((D, k) => pts.push(gaugeX(D, x0, w), top + h * (1 - (c[k] ?? 0))));
      const col = s.spectrum ? s.role(i === 0 ? 'craft' : i === 1 ? 'planet' : i === 2 ? 'star' : 'threat') : pal.ink;
      s.stroke(pts, { color: col, glow: 0.5, ...(dash.length ? { dash } : {}) });
      fitLabel(s, box, id, box.x + 8, top + i * 11, col, 7);
    });
    fitLabel(s, box, 'SHARE FOUND IN TIME', x0 + 4, top + 2, pal.dim, 7);
  },
};
