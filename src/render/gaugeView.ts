// WHAT: Draws the detection capability gauge (src/sim/gauge.ts): a log size bar from 1 m to 10 km, the red danger
//       band, and one row per needle with the sizes that needle catches in time.
// WHY:  The needles are the visible payoff of background spending: a program finishes and the bars grow to the left.
//       The debrief drops the round's rock on the same bar so the player sees whether they were lucky.
// HOW:  Pure drawing from a GaugeReading; it never mutates it. x = left + w * log10(D / min) / log10(max / min).
//       Each needle row is a bar from its needle to the right edge ("caught from this size up"); a missing needle
//       draws a dim row reading NONE. `rock` adds a dashed vertical marker for the round's body.
// LORE: F11 (the detection gauge)

import { KNOBS } from '../config/knobs';
import { NEEDLES, sizeLabel, type GaugeReading, type NeedleId } from '../sim/gauge';
import type { Surface } from './canvas';
import { uiColors, withAlpha } from './palettes';
import { drawText, drawTextFit } from './vectorFont';

const NEEDLE_LABEL: Record<NeedleId, string> = {
  DEFLECT: 'DEFLECT  1 Y',
  EVACUATE: 'EVACUATE  3 WK',
  AFTERMATH: 'AFTERMATH',
  SUNWARD: 'SUNWARD  3 WK',
  INTERSTELLAR: 'INTERSTELLAR  3 WK',
};

/** Screen x of size D on a bar from x0, width w. Example: D = 100 on 1 m..10 km, w = 400 -> x0 + 200. */
export function gaugeX(D: number, x0: number, w: number): number {
  const f = Math.log10(Math.max(KNOBS.GAUGE_MIN_M, Math.min(KNOBS.GAUGE_MAX_M, D)) / KNOBS.GAUGE_MIN_M) / Math.log10(KNOBS.GAUGE_MAX_M / KNOBS.GAUGE_MIN_M);
  return x0 + w * f;
}

/** Height the gauge takes for `rows` needle rows. */
export function gaugeHeight(rows = NEEDLES.length, title = true, rock = false): number {
  return (title ? 30 : 0) + 36 + rows * 15 + (rock ? 10 : 0);
}

export function drawGauge(s: Surface, reading: GaugeReading | null, x: number, y: number, width: number, opts: { rock?: number; title?: boolean } = {}): number {
  const p = s.palette;
  const ui = uiColors(p, s.spectrum);
  const labelW = 150;
  const x0 = x + labelW;
  const w = Math.max(80, width - labelW - 10);
  let yy = y;
  if (opts.title !== false) {
    drawText(s, 'DETECTION GAUGE', x, yy, 11, { color: ui.title, glow: 0.9 });
    drawTextFit(s, 'SMALLEST ROCK YOUR NETWORKS FIND IN TIME ON HALF OF ALL APPROACHES (GAME MODEL)', x, yy + 15, 8, width, { color: ui.sub, glow: 0.3 });
    yy += 30;
  }
  // Danger band: damage begins near 20 m, the catalog is fairly complete from 140 m.
  const [d0, d1] = KNOBS.GAUGE_DANGER_M;
  const bx0 = gaugeX(d0, x0, w);
  const bx1 = gaugeX(d1, x0, w);
  const rows = NEEDLES.length;
  const top = yy + 14;
  const bottom = top + rows * 15;
  s.ctx.fillStyle = withAlpha(p.hot, 0.12);
  s.ctx.fillRect(bx0, top - 4, bx1 - bx0, bottom - top + 4);
  drawText(s, 'BLIND DANGER ZONE', (bx0 + bx1) / 2, yy, 8, { align: 'center', color: p.hot, glow: 0.4 });
  // Axis and decade ticks.
  s.stroke([x0, bottom + 2, x0 + w, bottom + 2], { color: p.dim, glow: 0 });
  for (let d = KNOBS.GAUGE_MIN_M; d <= KNOBS.GAUGE_MAX_M * 1.001; d *= 10) {
    const tx = gaugeX(d, x0, w);
    s.stroke([tx, bottom, tx, bottom + 6], { color: p.dim, glow: 0 });
    drawText(s, sizeLabel(d), tx, bottom + 9, 8, { align: 'center', color: p.dim, glow: 0 });
  }
  NEEDLES.forEach((id, i) => {
    const ry = top + i * 15;
    drawText(s, NEEDLE_LABEL[id], x, ry, 9, { color: ui.text, glow: 0.3 });
    const D = reading ? reading.needles[id] : null;
    if (!reading) {
      if (i === 0) drawText(s, 'COMPUTING ...', x0 + 4, ry, 9, { color: p.dim, glow: 0 });
      return;
    }
    if (D === null) {
      s.stroke([x0, ry + 4, x0 + w, ry + 4], { color: p.dim, glow: 0, dash: [2, 4] });
      drawText(s, 'NONE ON THE BAR', x0 + w, ry - 1, 8, { align: 'right', color: p.dim, glow: 0 });
      return;
    }
    const nx = gaugeX(D, x0, w);
    const col = s.spectrum ? s.role(id === 'AFTERMATH' ? 'danger' : 'craft') : p.ink;
    s.stroke([nx, ry + 4, x0 + w, ry + 4], { color: col, width: 3, glow: 0.6 });
    s.stroke([nx, ry - 1, nx, ry + 9], { color: col, glow: 1 });
    drawText(s, sizeLabel(D), nx - 4, ry, 8, { align: 'right', color: col, glow: 0.5 });
  });
  if (opts.rock !== undefined) {
    const rx = gaugeX(opts.rock, x0, w);
    // The label sits under the axis labels so it never meets BLIND DANGER ZONE above the rows.
    s.stroke([rx, top - 4, rx, bottom + 4], { color: ui.title, glow: 1, dash: [4, 3] });
    drawText(s, `THIS ROCK ${sizeLabel(opts.rock)}`, rx, bottom + 20, 8, { align: 'center', color: ui.title, glow: 0.8 });
  }
  return bottom + (opts.rock !== undefined ? 32 : 22) - y;
}
