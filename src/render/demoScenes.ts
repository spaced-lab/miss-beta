// WHAT: The SUPER-DUPER-DEMO's animated scenes, shared by the finale montage (views/demo.ts) and the quick
//       cutaways that interrupt the self-playing games (views/demoCut.ts): data-centre racks that grow more
//       complex, a globe filling with data centres, clocks and calendars being adjusted, hit after hit on a
//       planet, and short planning / strike vignettes (launches, the wormhole and the stranger scenes are in
//       render/demoFuture.ts).
// WHY:  Owner 2026-10-18: the demo should look fast and keep getting faster, switching back and forth between
//       the game and animated summaries. Every caption is FICTION in character (GAME_PLAN 30 deadpan); nothing here
//       is a claim about real computers, power grids or time travel, and none of it is a feature of the game.
// HOW:  Each scene is a pure function of (surface, local time t in s, colours, intensity k in 0..1); it draws and
//       mutates nothing else. Intensity raises the detail and the pace (more racks, more data centres, faster
//       clocks). Pseudo-random layout comes from seeded Rng, so a scene looks the same every run. Sounds are left
//       to the callers; `hitsBy` is the shared schedule so the montage can thump on every hit it draws.
//       Photosensitive safety (docs/WARNINGS.md): no scene fills or flashes the whole screen; bright marks are
//       small (LEDs, rings, dots), and cut pacing is the callers' job.
// LORE: G1 (how to play), G8 (the look, and the sound)

import coastline from '../config/coastline.json';
import { Rng } from '../sim/rng';
import type { Surface } from './canvas';
import { uiColors } from './palettes';
import { drawText } from './vectorFont';
import { dustBurst, dustColors, dustField } from './pixelDust';
import { wireSphere } from './wire';

export type Ui = ReturnType<typeof uiColors>;
export type DemoScene = (s: Surface, t: number, ui: Ui, k: number) => void;

/** Deterministic 0..1 hash of an integer triple (LED patterns, digit flips). Example: h3(0, 0, 0) is about 0.0. */
function h3(a: number, b: number, c: number): number {
  const x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Data-centre racks. k = 0: two rows of plain cabinets with blinking LEDs; as k grows the hall gains rows,
 * light bars and cable trays, then hexagonal compute modules with pulsing cores and a scan line ("futuristic").
 * LEDs blink faster with k (12 to 30 steps a second).
 */
export const racks: DemoScene = (s, t, ui, k) => {
  const rows = 2 + Math.round(k * 2);
  const tier = k < 0.34 ? 0 : k < 0.67 ? 1 : 2;
  // Plain cabinets get narrower and more numerous as k grows; the hex modules are drawn larger and fewer.
  const cols = tier === 2 ? Math.max(5, Math.floor(s.width / 120)) : Math.max(6, Math.floor(s.width / (90 - k * 30)));
  const top = 70;
  const rw = (s.width - 80) / cols;
  const rh = (s.height - 150) / rows;
  const step = Math.floor(t * (12 + 18 * k));
  const leds = dustColors(s);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = 40 + c * rw + 5;
      const y0 = top + r * rh + 5;
      const w = rw - 10;
      const h = rh - 10;
      if (tier < 2) {
        s.stroke([x0, y0, x0 + w, y0, x0 + w, y0 + h, x0, y0 + h], { closed: true, color: ui.dim, glow: 0 });
        const n = tier === 0 ? 24 : 36;
        const perRow = 3;
        for (let i = 0; i < n; i++) {
          const on = h3(c * 31 + r * 17, i, step) > 0.4;
          const lx = x0 + 6 + (i % perRow) * (w - 12) / (perRow - 1);
          const ly = y0 + 8 + Math.floor(i / perRow) * (h - 16) / Math.max(1, n / perRow - 1);
          if (on) s.circle(lx, ly, 2.2, { color: i % 3 === 0 ? (leds[(i + c + r) % leds.length] ?? ui.title) : i % 7 === 0 ? ui.head : ui.sel, glow: 1.6 });
          else s.dot(lx, ly, 1.1, ui.dim, 0.8);
        }
        if (tier === 1) {
          // Light bar along the top and a cable tray running to the next cabinet.
          const f = (t * 2 + c * 0.13) % 1;
          s.stroke([x0 + 2, y0 + 3, x0 + 2 + (w - 4) * f, y0 + 3], { color: ui.title, glow: 1.2, width: 2 });
          s.stroke([x0 + w, y0 + h * 0.85, x0 + w + 10, y0 + h * 0.85], { color: ui.sub, glow: 0.4, dash: [3, 2] });
        }
      } else {
        // Hex compute module with a pulsing core and three status pips.
        const cx = x0 + w / 2;
        const cy = y0 + h / 2;
        const R = Math.min(w, h) * 0.46;
        const pts: number[] = [];
        for (let i = 0; i < 6; i++) pts.push(cx + R * Math.cos(Math.PI / 6 + (i * Math.PI) / 3), cy + R * Math.sin(Math.PI / 6 + (i * Math.PI) / 3));
        s.stroke(pts, { closed: true, color: ui.sub, glow: 0.6 });
        const pulse = 0.5 + 0.5 * Math.sin(t * 9 + c * 0.7 + r * 1.3);
        s.circle(cx, cy, R * (0.25 + 0.2 * pulse), { color: h3(c, r, step >> 2) > 0.5 ? ui.title : ui.sel, glow: 1.8 });
        // Inner ring of twelve compute cells blinking around the core, three status pips under it.
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2 + t * 0.6;
          if (h3(c * 13 + i, r, step) > 0.45) s.dot(cx + Math.cos(a) * R * 0.66, cy + Math.sin(a) * R * 0.66, 2.4, leds[(i + c) % leds.length] ?? ui.sel, 1);
        }
        for (let i = 0; i < 3; i++) {
          if (h3(c + 9, r + i, step) > 0.35) s.dot(cx - R * 0.3 + i * R * 0.3, cy + R * 0.86, 2.2, ui.head, 1);
        }
      }
    }
  }
  if (tier === 2) {
    // Scan line sweeping the hall.
    const y = top + ((t * 0.9) % 1) * (s.height - 150);
    s.stroke([40, y, s.width - 40, y], { color: ui.title, glow: 1, alpha: 0.5 });
  }
};

/**
 * The globe filling with data centres: a fast-turning wire sphere, 30 + 110 k sites lit in a seeded order, and
 * links pulsing between neighbours. Sites on the far side are hidden.
 */
export const dcGlobe: DemoScene = (s, t, ui, k) => {
  const cx = s.width / 2;
  const cy = s.height / 2 + 10;
  const R = Math.min(s.width, s.height) * 0.32;
  const spin = t * (0.8 + 1.6 * k);
  wireSphere(s, cx, cy, R, spin, 6, 10, ui.dim);
  const rng = new Rng(1609);
  const total = 140;
  const lit = Math.min(total, Math.floor(30 + 110 * k + t * 40));
  const pts: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < total; i++) {
    const lon = rng.float(-Math.PI, Math.PI);
    const lat = Math.asin(rng.float(-0.85, 0.95));
    if (i >= lit) continue;
    const a = lon + spin;
    const x = Math.cos(lat) * Math.sin(a);
    const z = Math.cos(lat) * Math.cos(a);
    const y = -Math.sin(lat);
    pts.push({ x: cx + R * x, y: cy + R * y, z });
  }
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (!p || p.z < 0) continue;
    s.dot(p.x, p.y, 3.2, i % 2 === 0 ? (dustColors(s)[i % 9] ?? ui.title) : ui.sel, 0.5 + 0.5 * p.z);
    if (i % 9 === 0) s.circle(p.x, p.y, 4 + ((t * 2 + i * 0.3) % 1) * 12, { color: ui.text, glow: 0.6, alpha: 0.6 * p.z });
    // Link to the nearest lit site in front (short hops, not chords across the globe).
    let q: (typeof pts)[number] | undefined;
    let best = (R * 0.45) ** 2;
    for (let j = 0; j < pts.length; j++) {
      const o = pts[j];
      if (!o || j === i || o.z < 0) continue;
      const d2 = (o.x - p.x) ** 2 + (o.y - p.y) ** 2;
      if (d2 < best) {
        best = d2;
        q = o;
      }
    }
    if (q) {
      const f = (t * 1.8 + i * 0.11) % 1;
      s.stroke([p.x, p.y, q.x, q.y], { color: ui.sub, glow: 0.2, alpha: 0.35 });
      s.dot(p.x + (q.x - p.x) * f, p.y + (q.y - p.y) * f, 1.8, ui.head, 0.9);
    }
  }
  drawText(s, `SITES ONLINE ${String(lit * 1000 + Math.floor(t * 977) % 1000).padStart(6, '0')}`, cx, cy + R + 22, 11, { align: 'center', color: ui.text, glow: 0.6 });
};

/** Equirectangular coastlines with activation rings spreading from seeded points. */
export const worldMap: DemoScene = (s, t, ui, k) => {
  const mw = Math.min(s.width - 60, (s.height - 140) * 2);
  const mh = mw / 2;
  const x0 = (s.width - mw) / 2;
  const y0 = (s.height - mh) / 2 + 10;
  const px = (lon: number): number => x0 + ((lon + 180) / 360) * mw;
  const py = (lat: number): number => y0 + ((90 - lat) / 180) * mh;
  for (const line of (coastline as { lines: number[][] }).lines) {
    const pts: number[] = [];
    for (let i = 0; i + 1 < line.length; i += 2) pts.push(px(line[i] as number), py(line[i + 1] as number));
    s.stroke(pts, { color: ui.sub, glow: 0.3 });
  }
  const rng = new Rng(2026);
  const all = 60 + Math.round(60 * k);
  const n = Math.min(all, Math.floor(t * (20 + 40 * k)) + 8);
  for (let i = 0; i < all; i++) {
    const lon = rng.float(-125, 145);
    const lat = rng.float(-40, 60);
    if (i >= n) continue;
    const age = (t * (1.7 + 2 * k) + i * 0.37) % 1;
    s.dot(px(lon), py(lat), 2.5, ui.title, 1);
    s.circle(px(lon), py(lat), 3 + age * 22, { color: ui.text, glow: 0.8, alpha: 1 - age });
  }
};

/** Region bars filling to 100 % and a flow arrow into SIM. */
export const power: DemoScene = (s, t, ui, k) => {
  const regions = ['NORTH AMERICA', 'SOUTH AMERICA', 'EUROPE', 'AFRICA', 'ASIA', 'OCEANIA', 'ANTARCTIC STATION 4'];
  const x0 = s.width * 0.18;
  const bw = s.width * 0.5;
  const rate = 0.5 + k;
  regions.forEach((r, i) => {
    const y = 100 + i * ((s.height - 220) / regions.length);
    const f = Math.min(1, t * rate + i * 0.08 - Math.floor(t * rate + i * 0.08) + 0.4);
    drawText(s, r, x0 - 12, y, 11, { align: 'right', color: ui.text, glow: 0.4 });
    s.stroke([x0, y + 5, x0 + bw, y + 5], { color: ui.dim, glow: 0 });
    s.stroke([x0, y + 5, x0 + bw * f, y + 5], { color: ui.title, glow: 1.2, width: 4 });
    drawText(s, `${Math.round(f * 100)}% -> SIM`, x0 + bw + 14, y, 11, { color: ui.sub, glow: 0.4 });
  });
};

/** Earth, Moon and Mars with compute links and an orbital ring of nodes. */
export const offWorld: DemoScene = (s, t, ui, k) => {
  const cx = s.width / 2;
  const cy = s.height / 2 + 10;
  const R = Math.min(s.width, s.height) * 0.14;
  const sp = 1 + 1.5 * k;
  wireSphere(s, cx, cy, R, t * 0.6 * sp, 5, 8, ui.text);
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2 + t * 0.4 * sp;
    s.dot(cx + Math.cos(a) * R * 1.6, cy + Math.sin(a) * R * 0.45, 2, ui.title, 0.9);
  }
  const moon = { x: cx + R * 3.2 * Math.cos(t * 0.3 * sp), y: cy - R * 1.9 };
  const mars = { x: cx - R * 3.4, y: cy + R * 0.9 };
  wireSphere(s, moon.x, moon.y, R * 0.3, t * sp, 3, 6, ui.sub);
  wireSphere(s, mars.x, mars.y, R * 0.4, -t * 0.8 * sp, 3, 6, ui.head);
  for (const b of [moon, mars]) {
    const f = (t * 1.5 * sp) % 1;
    s.stroke([cx, cy, b.x, b.y], { color: ui.dim, glow: 0 });
    s.dot(cx + (b.x - cx) * f, cy + (b.y - cy) * f, 3, ui.sel, 1);
  }
};

/**
 * Clocks and calendars being adjusted: a date readout whose year, month and day flip forwards and backwards at
 * random, three dials whose hands run at different speeds (one backwards), and a log of timeline corrections.
 */
export const clocks: DemoScene = (s, t, ui, k) => {
  const rate = 8 + 22 * k;
  const step = Math.floor(t * rate);
  const year = 2026 + Math.round((h3(step, 1, 3) - 0.5) * 400 * (0.3 + k));
  const month = 1 + Math.floor(h3(step, 2, 5) * 12);
  const day = 1 + Math.floor(h3(step, 3, 7) * 28);
  const hh = Math.floor(h3(step, 4, 9) * 24);
  const mm = Math.floor((t * 600) % 60);
  const ss = Math.floor((t * 6000) % 60);
  const p2 = (n: number): string => String(n).padStart(2, '0');
  const big = Math.min(44, s.width / 18);
  drawText(s, `${year}-${p2(month)}-${p2(day)}  ${p2(hh)}:${p2(mm)}:${p2(ss)}`, s.width / 2, s.height * 0.22, big, { align: 'center', color: ui.title, glow: 1.6 });
  const R = Math.min(s.width / 9, s.height / 6);
  const speeds = [1.5, -4, 11];
  speeds.forEach((v, i) => {
    const cx = s.width / 2 + (i - 1) * R * 2.8;
    const cy = s.height * 0.55;
    s.circle(cx, cy, R, { color: ui.sub, glow: 0.6 });
    for (let j = 0; j < 12; j++) {
      const a = (j / 12) * Math.PI * 2;
      s.stroke([cx + Math.cos(a) * R * 0.86, cy + Math.sin(a) * R * 0.86, cx + Math.cos(a) * R, cy + Math.sin(a) * R], { color: ui.dim, glow: 0 });
    }
    const a1 = t * v * (1 + 2 * k);
    const a2 = a1 * 12;
    s.stroke([cx, cy, cx + Math.sin(a1) * R * 0.5, cy - Math.cos(a1) * R * 0.5], { color: ui.text, glow: 1, width: 3 });
    s.stroke([cx, cy, cx + Math.sin(a2) * R * 0.85, cy - Math.cos(a2) * R * 0.85], { color: ui.sel, glow: 1.2 });
    drawText(s, ['LOCAL', 'RETROCAUSAL', 'BRANCH 7'][i] ?? '', cx, cy + R + 14, 9, { align: 'center', color: ui.dim, glow: 0 });
  });
  for (let i = 0; i < 4; i++) {
    const n = step - i;
    const dy = Math.round((h3(n, 5, 1) - 0.5) * 2000);
    drawText(s, `TIMELINE ADJUST ${dy >= 0 ? '+' : ''}${dy} D   DRIFT ${(h3(n, 6, 2) * 9).toFixed(3)} S   ${h3(n, 7, 3) > 0.5 ? 'ACCEPTED' : 'RE-RUN'}`, s.width / 2, s.height - 110 + i * 16, 10, { align: 'center', color: i === 0 ? ui.text : ui.dim, glow: i === 0 ? 0.6 : 0, alpha: 1 - i * 0.2 });
  }
};

/** Teaser lines for tech that is not in the game (FICTION). */
const HINTS = ['STELLAR LIFTING', 'PLANETARY ENGINES', 'CAUSALITY FIREWALL', 'MATRIOSHKA BRAIN V0.1', 'VACUUM STABILITY INSURANCE', 'THE SECOND MOON PROTOCOL', 'KARDASHEV III PREVIEW', 'ORBITAL RING (BETA)'];

/** Locked teasers scrolling past. */
export const hints: DemoScene = (s, t, ui, k) => {
  HINTS.forEach((h, i) => {
    const y = 90 + i * ((s.height - 180) / HINTS.length);
    const lit = Math.floor(t * (6 + 10 * k)) % HINTS.length === i;
    drawText(s, `[LOCKED]  ${h}`, s.width / 2, y, 14, { align: 'center', color: lit ? ui.sel : ui.text, glow: lit ? 1.6 : 0.5 });
    drawText(s, 'NOT IN THIS GAME', s.width / 2, y + 24, 8, { align: 'center', color: ui.dim, glow: 0 });
  });
};

/**
 * Hits on the planet by local time t: the gap between hits shrinks from 0.6 s to a floor of 0.09 s, faster with k.
 * Example: hitsBy(0, 0) = 0; hitsBy(1, 0) = 2 (hits at 0.30 s and 0.90 s).
 */
export function hitsBy(t: number, k: number): number {
  let n = 0;
  let at = 0.3;
  let gap = 0.6 / (1 + k);
  while (at <= t && n < 400) {
    n++;
    at += gap;
    gap = Math.max(0.09, gap * 0.82);
  }
  return n;
}

/**
 * Hit after hit: rocks streak in from every side, each ends in a burst of coloured pixel dust, a ring and a scar
 * that stays. From k = 0.5 a hit can bring two or three rocks at once, and the bursts grow with k.
 */
export const impacts: DemoScene = (s, t, ui, k) => {
  const cx = s.width / 2;
  const cy = s.height / 2 + 10;
  const R = Math.min(s.width, s.height) * 0.22;
  const n = hitsBy(t, k);
  dustField(s, t, 90, 19);
  // The planet shakes with every hit, a few px.
  const shake = Math.min(6 + 6 * k, n * 0.5) * Math.sin(t * 60);
  wireSphere(s, cx + shake, cy, R, t * 0.5, 6, 10, ui.text);
  const cols = dustColors(s);
  const rng = new Rng(4242);
  let at = 0.3;
  let gap = 0.6 / (1 + k);
  let landed = 0;
  for (let i = 0; i < n + 2; i++) {
    const rocks = k >= 0.5 ? 1 + Math.floor(rng.next() * 3 * k) : 1;
    for (let r = 0; r < rocks; r++) {
      const a = rng.float(0, Math.PI * 2);
      const hx = cx + shake + Math.cos(a) * R * 0.9;
      const hy = cy + Math.sin(a) * R * 0.9;
      const dt = t - at - r * 0.05;
      const col = cols[(i * 3 + r) % cols.length] ?? ui.title;
      if (dt < 0) {
        // Inbound: a streak closing on the hit point over the last 0.35 s.
        const f = Math.max(0, 1 + dt / 0.35);
        const sx = hx + Math.cos(a) * R * 2.5 * (1 - f);
        const sy = hy + Math.sin(a) * R * 2.5 * (1 - f);
        if (f > 0) s.stroke([sx + Math.cos(a) * 30, sy + Math.sin(a) * 30, sx, sy], { color: col, glow: 1.4, width: 2 });
      } else {
        landed++;
        dustBurst(s, hx, hy, dt, i * 31 + r, { n: 40 + Math.round(90 * k), speed: 160 + 260 * k, life: 0.8, size: 1.5, from: a - 1.3, to: a + 1.3 });
        const ring = Math.min(1, dt / 0.5);
        if (ring < 1) s.circle(hx, hy, 4 + ring * R * (0.5 + 0.4 * k), { color: col, glow: 1.4, alpha: 1 - ring });
        s.dot(hx, hy, 3, col, 0.9);
      }
    }
    at += gap;
    gap = Math.max(0.09, gap * 0.82);
  }
  drawText(s, `IMPACTS ${String(landed).padStart(3, '0')}   SIMULATED, NOT SURVIVED`, cx, cy + R + 30, 11, { align: 'center', color: ui.text, glow: 0.6 });
};

/** Planning vignette: a porkchop dot field with a scan bar and a ranked list reshuffling on the right. */
export const planning: DemoScene = (s, t, ui, k) => {
  const x0 = s.width * 0.08;
  const y0 = s.height * 0.16;
  const w = s.width * 0.5;
  const h = s.height * 0.62;
  const n = 26;
  const scan = (t * (0.9 + k)) % 1;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const u = i / (n - 1);
      const v = j / (n - 1);
      const e = Math.exp(-((u - 0.35) ** 2 + (v - 0.6) ** 2) * 18) + 0.7 * Math.exp(-((u - 0.72) ** 2 + (v - 0.3) ** 2) * 30);
      const lit = u <= scan;
      s.dot(x0 + u * w, y0 + (1 - v) * h, 3.2, e > 0.5 ? ui.title : e > 0.2 ? ui.sel : ui.dim, lit ? 0.35 + 0.65 * Math.min(1, e * 1.6) : 0.15);
    }
  }
  s.stroke([x0 + scan * w, y0, x0 + scan * w, y0 + h], { color: ui.head, glow: 1.2 });
  const step = Math.floor(t * (5 + 10 * k));
  for (let i = 0; i < 6; i++) {
    const m = (h3(step, i, 11) * 9).toFixed(2);
    drawText(s, `PLAN ${i + 1}  ${['KINETIC', 'SWARM X3', 'KINETIC-FLYBY', 'SLOW PUSH', 'SAIL-KINETIC', 'SPLIT BUS'][(step + i) % 6]}  MISS +${m} R`, x0 + w + 30, y0 + 10 + i * 22, 11, { color: i === 0 ? ui.sel : ui.text, glow: i === 0 ? 1.2 : 0.4 });
  }
};

/** Strike vignette: an impactor closing on a tumbling rock, then a ring, flying debris and the bent orbit. */
export const strike: DemoScene = (s, t, ui, k) => {
  const cx = s.width * 0.55;
  const cy = s.height * 0.5;
  const R = Math.min(s.width, s.height) * 0.12;
  const cyc = 1.2 / (1 + k);
  const ph = (t % cyc) / cyc;
  const rot = t * 0.8;
  const pts: number[] = [];
  const rng = new Rng(31);
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + rot;
    const r = R * rng.float(0.75, 1.1);
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  s.stroke(pts, { closed: true, color: ui.text, glow: 1 });
  if (ph < 0.55) {
    const f = ph / 0.55;
    const sx = cx - R - (1 - f) * s.width * 0.45;
    s.stroke([sx - 40, cy - 8, sx, cy], { color: ui.title, glow: 1.4, width: 2 });
  } else {
    const f = (ph - 0.55) / 0.45;
    s.circle(cx - R, cy, 6 + f * R * 1.2, { color: ui.head, glow: 1.4, alpha: 1 - f });
    // Ejecta: a cone of coloured pixel dust thrown back towards the impactor.
    dustBurst(s, cx - R, cy, f * cyc * 0.45, Math.floor(t / cyc), { n: 90 + Math.round(60 * k), speed: 380, life: cyc * 0.5, from: Math.PI * 0.55, to: Math.PI * 1.45 });
  }
  // Old path straight on, new path bending away: the deflection.
  s.stroke([cx, cy, cx + s.width * 0.35, cy], { color: ui.dim, glow: 0, dash: [4, 4] });
  s.stroke([cx, cy, cx + s.width * 0.18, cy - 8, cx + s.width * 0.35, cy - 34], { color: ui.sel, glow: 0.8 });
};
