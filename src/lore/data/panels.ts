// WHAT: Real-data panels for the Learning Center's right pane: fireballs on a world grid, the closest recorded
//       approaches, and the Sentry impact-risk list.
// WHY:  Owner, 2026-10-18: pull public-domain data. Real numbers make the lore concrete: Chelyabinsk was not a
//       hypothetical, 2025 UC11 really passed 6,600 km from Earth's centre.
// HOW:  Data comes from src/config/realdata.json (baked by scripts/fetch_realdata.py from NASA/JPL SSD APIs,
//       public domain). Each panel is a pure draw(s, box, t); t animates a reveal so the eye follows the order.
// LORE: T3 (how often), O12 (close approach), F9 (Torino and Palermo)

import realdata from '../../config/realdata.json';
import coastline from '../../config/coastline.json';
import type { Surface } from '../../render/canvas';
import { drawText, drawTextFit, wrapText } from '../../render/vectorFont';
import type { Box } from '../labs/lab';

interface Approach { des: string; date: string; dist_ld: number; v_rel_kms: number; h: number | null }
interface Risk { des: string; range: string; ip: number; ps_cum: number; ts_max: number; d_km: number | null; h: number; v_inf_kms: number }
interface Fireball { date: string; impact_kt: number; lat: number; lon: number; alt_km: number | null; vel_kms: number | null }
const D = realdata as unknown as { fetched: string; approaches: Approach[]; risks: Risk[]; fireballs: Fireball[] };

export interface DataPanel {
  id: string;
  title: string;
  topics: string[];
  note: string;
  draw(s: Surface, box: Box, t: number): void;
}

function frame(s: Surface, b: Box): void {
  s.stroke([b.x, b.y, b.x + b.w, b.y, b.x + b.w, b.y + b.h, b.x, b.y + b.h], { closed: true, color: s.palette.dim, glow: 0 });
}

/** Rough diameter (m) from absolute magnitude H at albedo 0.14: D = 1329 km / sqrt(p) x 10^(-H/5). */
export function diameterFromHm(h: number, albedo = 0.14): number {
  return (1329e3 / Math.sqrt(albedo)) * Math.pow(10, -h / 5);
}

const FIREBALLS: DataPanel = {
  id: 'FIREBALLS',
  title: 'THEY ALREADY HIT: THE 40 BIGGEST RECORDED FIREBALLS',
  topics: ['T3', 'T2', 'D10'],
  note: 'US government sensors record bright fireballs worldwide. Energy in kilotons of TNT; Hiroshima was about 15 kt.',
  draw: (s, b, t) => {
    const p = s.palette;
    const mh = Math.min(b.h - 90, b.w * 0.5);
    const m: Box = { x: b.x, y: b.y + 18, w: b.w, h: mh };
    frame(s, m);
    const X = (lon: number): number => m.x + ((lon + 180) / 360) * m.w;
    const Y = (lat: number): number => m.y + ((90 - lat) / 180) * m.h;
    // Coastlines: Natural Earth 1:110m (public domain), thinned by scripts/bake_coastline.py.
    for (const line of (coastline as { lines: number[][] }).lines) {
      const buf: number[] = [];
      for (let i = 0; i + 1 < line.length; i += 2) buf.push(X(line[i] ?? 0), Y(line[i + 1] ?? 0));
      if (buf.length >= 4) s.stroke(buf, { color: s.role('planet'), glow: 0, alpha: 0.55, width: 1 });
    }
    for (let lat = -60; lat <= 60; lat += 30) s.stroke([m.x, Y(lat), m.x + m.w, Y(lat)], { color: s.role('orbit'), alpha: lat === 0 ? 0.6 : 0.25, glow: 0, dash: lat === 0 ? [] : [2, 4] });
    for (let lon = -120; lon <= 120; lon += 60) s.stroke([X(lon), m.y, X(lon), m.y + m.h], { color: s.role('orbit'), alpha: 0.25, glow: 0, dash: [2, 4] });
    const byDate = [...D.fireballs].sort((a, c) => a.date.localeCompare(c.date));
    const shown = Math.min(byDate.length, Math.floor((t % 16) * 4));
    byDate.slice(0, shown).forEach((f, i) => {
      const r = 1.5 + 2.2 * Math.log10(1 + f.impact_kt);
      const fresh = i === shown - 1;
      s.circle(X(f.lon), Y(f.lat), r * (fresh ? 1.6 : 1), { color: f.impact_kt > 30 ? s.role('danger') : s.role('threat'), glow: fresh ? 1.5 : 0.5, alpha: fresh ? 1 : 0.8 });
    });
    const top = [...D.fireballs].sort((a, c) => c.impact_kt - a.impact_kt).slice(0, 4);
    let y = m.y + m.h + 10;
    for (const f of top) {
      drawTextFit(s, `${f.date.slice(0, 10)}  ${f.impact_kt.toFixed(0)} KT  ${Math.abs(f.lat).toFixed(0)}${f.lat >= 0 ? 'N' : 'S'} ${Math.abs(f.lon).toFixed(0)}${f.lon >= 0 ? 'E' : 'W'}${f.vel_kms ? `  ${f.vel_kms.toFixed(1)} KM/S` : ''}${f.impact_kt > 300 ? '  (CHELYABINSK)' : ''}`, b.x, y, 8, b.w, { color: p.ink, glow: 0.2 });
      y += 12;
    }
  },
};

const APPROACHES: DataPanel = {
  id: 'APPROACHES',
  title: 'CLOSEST RECORDED PASSES SINCE 2015',
  topics: ['O12', 'F8'],
  note: 'Distance from Earth\'s centre in lunar distances (LD, 384,400 km), against estimated size. Inside 0.0166 LD a rock is in the atmosphere.',
  draw: (s, b, t) => {
    const p = s.palette;
    const ph = Math.min(b.h - 80, b.w * 0.75);
    const g: Box = { x: b.x + 30, y: b.y + 18, w: b.w - 34, h: ph };
    frame(s, g);
    // x: log10 distance in LD from 0.01 to 3.9; y: diameter (m) log from 1 to 100.
    const X = (ld: number): number => g.x + ((Math.log10(Math.max(0.01, ld)) + 2) / (Math.log10(3.9) + 2)) * g.w;
    const Y = (dm: number): number => g.y + g.h - (Math.log10(Math.max(1, Math.min(100, dm))) / 2) * g.h;
    // Earth's surface (1 Earth radius = 0.0166 LD) and the Moon's distance.
    s.stroke([X(0.0166), g.y, X(0.0166), g.y + g.h], { color: s.role('planet'), glow: 0.6 });
    drawText(s, 'EARTH', X(0.0166) + 3, g.y + 3, 7, { color: s.role('planet'), glow: 0 });
    s.stroke([X(1), g.y, X(1), g.y + g.h], { color: s.role('orbit'), glow: 0.3, dash: [3, 3] });
    drawText(s, 'MOON', X(1) + 3, g.y + 3, 7, { color: s.role('orbit'), glow: 0 });
    for (const dm of [1, 10, 100]) drawText(s, `${dm} M`, b.x, Y(dm) - 4, 7, { color: p.dim, glow: 0 });
    for (const ld of [0.01, 0.1, 1]) drawText(s, `${ld} LD`, X(ld) - 8, g.y + g.h + 4, 7, { color: p.dim, glow: 0 });
    // One pass at a time is highlighted and labelled, stepping through the list every 0.6 s.
    const litIdx = Math.floor(t / 0.6) % D.approaches.length;
    D.approaches.forEach((a, i) => {
      if (a.h === null) return;
      const d = diameterFromHm(a.h);
      const lit = i === litIdx;
      s.circle(X(a.dist_ld), Y(d), lit ? 4 : 2, { color: lit ? p.hot : s.role('threat'), glow: lit ? 1.4 : 0.4 });
      if (lit) drawTextFit(s, `${a.des}  ${a.date.slice(0, 11)}  ${(a.dist_ld * 384400).toFixed(0)} KM  ${d.toFixed(0)} M  ${a.v_rel_kms} KM/S`, b.x, g.y + g.h + 18, 8, b.w, { color: p.hot, glow: 0.6 });
    });
    const c = D.approaches[0];
    if (c) drawTextFit(s, `CLOSEST: ${c.des}, ${(c.dist_ld * 384400).toFixed(0)} KM FROM EARTH'S CENTRE (${(c.dist_ld * 384400 - 6371).toFixed(0)} KM UP).`, b.x, g.y + g.h + 32, 8, b.w, { color: p.ink, glow: 0.2 });
  },
};

const RISKS: DataPanel = {
  id: 'RISKS',
  title: 'THE SENTRY LIST: TOP 12 BY PALERMO VALUE',
  topics: ['F9', 'F10'],
  note: 'Palermo compares a risk with the background rate of impacts of that size until that date; below -2 means no concern. Torino 0 is "no hazard".',
  draw: (s, b, t) => {
    const p = s.palette;
    const rows = D.risks.slice(0, 12);
    const lh = Math.min(22, (b.h - 70) / rows.length);
    const x0 = b.x + 110;
    const w = b.w - 120;
    // Palermo axis from -6 to 0.
    const X = (ps: number): number => x0 + ((Math.max(-6, Math.min(0, ps)) + 6) / 6) * w;
    s.stroke([X(-2), b.y + 16, X(-2), b.y + 18 + rows.length * lh], { color: s.role('danger'), dash: [3, 3], glow: 0.3 });
    drawText(s, '-2', X(-2) - 6, b.y + 4, 7, { color: s.role('danger'), glow: 0 });
    const grow = Math.min(1, (t % 12) / 2);
    rows.forEach((r, i) => {
      const y = b.y + 20 + i * lh;
      drawTextFit(s, r.des, b.x, y, 8, 100, { color: p.ink, glow: 0.2 });
      const xe = X(-6) + (X(r.ps_cum) - X(-6)) * grow;
      s.stroke([X(-6), y + 4, xe, y + 4], { color: r.ps_cum > -2 ? s.role('danger') : s.role('threat'), width: Math.max(2, lh * 0.35), glow: 0.4 });
      drawTextFit(s, `${r.ps_cum.toFixed(2)}  P ${r.ip.toExponential(1)}  ${r.d_km ? (r.d_km * 1000).toFixed(0) + ' M' : ''}  ${r.range}`, xe + 4, y, 7, b.x + b.w - xe - 4, { color: p.dim, glow: 0 });
    });
  },
};

export const PANELS: readonly DataPanel[] = [FIREBALLS, APPROACHES, RISKS];

export function panelForTopic(id: string): DataPanel | null {
  return PANELS.find((pnl) => pnl.topics.includes(id)) ?? null;
}

/** Title, plot, note and the source line in a box (the right pane). */
export function drawPanel(s: Surface, pnl: DataPanel, box: Box, t: number): void {
  const p = s.palette;
  drawTextFit(s, pnl.title, box.x, box.y, 10, box.w, { color: p.hot, glow: 1 });
  const noteLines = wrapText(pnl.note, box.w, 8);
  const plotH = box.h - 40 - noteLines.length * 12;
  pnl.draw(s, { x: box.x, y: box.y + 4, w: box.w, h: plotH }, t);
  let y = box.y + plotH + 14;
  for (const l of noteLines) {
    drawText(s, l, box.x, y, 8, { color: p.ink, glow: 0.2, lower: true });
    y += 12;
  }
  drawTextFit(s, `SOURCE: NASA/JPL SSD APIS (PUBLIC DOMAIN), SNAPSHOT ${D.fetched}${pnl.id === 'FIREBALLS' ? '. MAP: MADE WITH NATURAL EARTH' : ''}`, box.x, y + 2, 7, box.w, { color: p.dim, glow: 0 });
}
