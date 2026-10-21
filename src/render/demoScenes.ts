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

import { Rng } from '../sim/rng';
import type { Surface } from './canvas';
import { uiColors } from './palettes';
import { drawText, drawTextFit } from './vectorFont';
import { withAlpha } from './palettes';
import { dustBurst, dustColors, dustField } from './pixelDust';
import { wireSphere } from './wire';

export type Ui = ReturnType<typeof uiColors>;
export type DemoScene = (s: Surface, t: number, ui: Ui, k: number) => void;

/** What a demo shot is about, for its caption colour. */
export type CaptionKind = 'blips' | 'hits' | 'launch' | 'laser' | 'warp' | 'none';

/** Caption colour per kind on glowing modes: hits red, launches yellow, lasers cyan, warps violet, computers blue,
 *  everything else (the aliens, the arrivals) green; the palette's title colour elsewhere. */
const CAPTION_COLORS: Record<CaptionKind, string> = { hits: '#FF3B6B', launch: '#FFE14D', laser: '#2EF2FF', warp: '#B04DFF', blips: '#3D7BFF', none: '#7CFF4F' };

/**
 * A demo shot's main message (owner 2026-10-21: "size text for demo main messages and color them to stand out"):
 * the headline large (up to 40 px, fitted to the width) on a dark band across the top, coloured by `kind`, and the
 * status line fitted under it. Example: demoCaption(s, ui, 'HIT', 'AND AGAIN', 'hits') draws a red HIT.
 */
export function demoCaption(s: Surface, ui: Ui, head: string, sub: string, kind: CaptionKind): void {
  const W = s.width;
  const size = Math.max(14, Math.min(40, W / 24));
  const subSize = Math.max(9, Math.min(15, W / 70));
  const bandH = size + (sub ? subSize + 22 : 16);
  s.ctx.fillStyle = withAlpha(s.palette.bg, 0.62);
  s.ctx.fillRect(0, 10, W, bandH);
  const col = s.palette.glow ? CAPTION_COLORS[kind] : ui.title;
  drawTextFit(s, head, W / 2, 16, size, W - 32, { align: 'center', color: col, glow: 1.8, width: 2 });
  if (sub) drawTextFit(s, sub, W / 2, 16 + size + 10, subSize, W - 32, { align: 'center', color: ui.text, glow: 0.6 });
}

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
      // NOTE: owner 2026-10-21 ("globe with dots all over the edge ... different colors is weird"): every hit used to
      // land on the rim (0.9 R) and leave a permanent coloured dot there, a flat ring of dots around a 3-D globe.
      // Hits now land anywhere on the visible face (uniform over the disc), their shock rings are flattened by the
      // tilt of the surface there (minor axis x sqrt(1 - (d / R)^2)), and the scar cools away over 3 s.
      const a = rng.float(0, Math.PI * 2);
      const d = R * 0.88 * Math.sqrt(rng.next());
      const hx = cx + shake + Math.cos(a) * d;
      const hy = cy + Math.sin(a) * d;
      const flat = Math.max(0.25, Math.sqrt(Math.max(0, 1 - (d / R) ** 2)));
      // Inbound from the upper left, steeply.
      const ia = -Math.PI * (0.62 + 0.2 * rng.next());
      const dt = t - at - r * 0.05;
      const col = cols[(i * 3 + r) % cols.length] ?? ui.title;
      if (dt < 0) {
        // Inbound: a streak closing on the hit point over the last 0.35 s.
        const f = Math.max(0, 1 + dt / 0.35);
        const sx = hx + Math.cos(ia) * R * 2.5 * (1 - f);
        const sy = hy + Math.sin(ia) * R * 2.5 * (1 - f);
        if (f > 0) s.stroke([sx + Math.cos(ia) * 30, sy + Math.sin(ia) * 30, sx, sy], { color: col, glow: 1.4, width: 2 });
      } else {
        landed++;
        if (dt < 1.2) dustBurst(s, hx, hy, dt, i * 31 + r, { n: 40 + Math.round(90 * k), speed: 160 + 260 * k, life: 0.8, size: 1.5, from: ia + Math.PI - 1.1, to: ia + Math.PI + 1.1 });
        const ring = Math.min(1, dt / 0.5);
        if (ring < 1) {
          const rr = 4 + ring * R * (0.22 + 0.18 * k);
          const pts: number[] = [];
          for (let q = 0; q <= 28; q++) {
            const u = (q / 28) * Math.PI * 2;
            const ex = Math.cos(u) * rr * flat;
            const ey = Math.sin(u) * rr;
            pts.push(hx + ex * Math.cos(a) - ey * Math.sin(a), hy + ex * Math.sin(a) + ey * Math.cos(a));
          }
          s.stroke(pts, { closed: true, color: col, glow: 1.4, alpha: 1 - ring });
        }
        if (dt < 3) s.dot(hx, hy, 2.5, col, 0.9 * (1 - dt / 3));
      }
    }
    at += gap;
    gap = Math.max(0.09, gap * 0.82);
  }
  drawText(s, `IMPACTS ${String(landed).padStart(3, '0')}   SIMULATED, NOT SURVIVED`, cx, cy + R + 30, 11, { align: 'center', color: ui.text, glow: 0.6 });
};

/** Heat ramps for the planning map, low to high (owner 2026-10-21: "same pink purple map used several times"). */
const RAMPS: readonly (readonly string[])[] = [
  ['#1B2A6B', '#2EF2FF', '#FFE14D', '#FF3B6B'],
  ['#123D1A', '#7CFF4F', '#FFE14D', '#FFFFFF'],
  ['#3B0A45', '#B04DFF', '#FF4FD8', '#FFE14D'],
  ['#0A2540', '#3D7BFF', '#2EF2FF', '#FFFFFF'],
  ['#40100A', '#FF8A1F', '#FFE14D', '#FFFFFF'],
];

/**
 * Planning vignette, a new map every 2.6 s of local time: segment v alternates a porkchop grid with a scan bar and a
 * radar sweep with blips, puts two to four peaks where hash(v) says, and colours by RAMPS[v mod 5] (the palette's
 * own steps on DAYLIGHT). A ranked list reshuffles on the right.
 */
export const planning: DemoScene = (s, t, ui, k) => {
  const x0 = s.width * 0.08;
  const y0 = s.height * 0.16;
  const w = s.width * 0.5;
  const h = s.height * 0.62;
  const v = Math.floor(t / 2.6);
  const ramp = s.palette.glow ? (RAMPS[v % RAMPS.length] ?? RAMPS[0] ?? []) : [ui.dim, ui.text, ui.sel, ui.title];
  const col = (e: number): string => ramp[Math.min(ramp.length - 1, Math.floor(Math.min(0.999, e) * ramp.length))] ?? ui.text;
  const np = 2 + Math.floor(h3(v, 1, 61) * 3);
  const field = (u: number, w2: number): number => {
    let e = 0;
    for (let p = 0; p < np; p++) e += (1 - 0.3 * p) * Math.exp(-((u - (0.15 + 0.7 * h3(v, p, 62))) ** 2 + (w2 - (0.15 + 0.7 * h3(v, p, 63))) ** 2) * (14 + 20 * h3(v, p, 64)));
    return Math.min(1, e);
  };
  if (v % 2 === 0) {
    const n = 26;
    const scan = (t * (0.9 + k)) % 1;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const u = i / (n - 1);
        const q = j / (n - 1);
        const e = field(u, q);
        const lit = u <= scan;
        s.dot(x0 + u * w, y0 + (1 - q) * h, 3.2, col(e), lit ? 0.3 + 0.7 * Math.min(1, e * 1.6) : 0.12);
      }
    }
    s.stroke([x0 + scan * w, y0, x0 + scan * w, y0 + h], { color: ui.head, glow: 1.2 });
  } else {
    // Radar: rings of dots in polar cells, lit as the sweep passes and fading behind it.
    const cx = x0 + w / 2;
    const cy = y0 + h / 2;
    const R = Math.min(w, h) / 2;
    const sweep = (t * (1.6 + k)) % (Math.PI * 2);
    for (let ring = 1; ring <= 12; ring++) {
      const r = (ring / 12) * R;
      const m = 6 * ring;
      for (let q = 0; q < m; q++) {
        const a = (q / m) * Math.PI * 2;
        const behind = (sweep - a + Math.PI * 4) % (Math.PI * 2);
        const e = field(0.5 + (Math.cos(a) * r) / (2 * R), 0.5 + (Math.sin(a) * r) / (2 * R));
        s.dot(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2.6, col(Math.max(0.3, e)), (0.3 + 0.7 * Math.min(1, e * 1.6)) * Math.max(0.3, 1 - behind / 3));
      }
    }
    s.circle(cx, cy, R, { color: ui.head, glow: 0.6, alpha: 0.6 });
    s.stroke([cx, cy, cx + Math.cos(sweep) * R, cy + Math.sin(sweep) * R], { color: ui.head, glow: 1.4 });
  }
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
