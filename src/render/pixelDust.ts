// WHAT: Pixel dust for the SUPER-DUPER-DEMO: bright, fine, many-coloured pixel bursts, exhaust trails, a sparkle
//       field and a "hit storm" of small strikes that thickens towards the finale.
// WHY:  Owner 2026-10-20: "way more colorful pixel dust, bright fine pixel explosions", and hits that increase "way
//       more in intensity and frequency" towards the end. One module so every demo scene shares the same dust.
// HOW:  Every function is a pure function of (position, age or time, integer seed): each spark's angle, speed,
//       lifetime and colour come from `hash01(spark, seed, n)`, so a frame redraws identically and nothing is stored.
//       A spark eases out (fast at first, then hanging), falls under an optional gravity, starts white-hot for the
//       first 12 % of its life and then takes a colour from `dustColors` (KNOBS.DEMO_DUST_COLORS on a glowing mode,
//       the mode's own steps on DAYLIGHT, where bright colours would vanish on the light ground). Sparks twinkle at
//       30 Hz. Photosensitive safety (docs/WARNINGS.md): sparks are 1 to 3 px, a burst covers a small area and its
//       pixels fade; nothing here fills the screen.
// LORE: G8 (the look)

import { KNOBS } from '../config/knobs';
import type { Surface } from './canvas';
import { hash01 } from './cinematics/pixel';

/** Dust colours for this surface: the bright ramp on a glowing (dark) mode, the palette's own steps otherwise. */
export function dustColors(s: Surface): readonly string[] {
  const p = s.palette;
  return p.glow ? KNOBS.DEMO_DUST_COLORS : [p.hot, p.ink, p.alt ?? p.ink];
}

export interface BurstOpts {
  /** Sparks. */
  n?: number;
  /** Initial speed, px/s. */
  speed?: number;
  /** Mean lifetime, s (each spark lives 0.5 to 1.4 times this). */
  life?: number;
  /** Spark size, px (one in ten is twice the size). */
  size?: number;
  /** Downward pull, px/s^2. */
  gravity?: number;
  /** Direction range, radians (default the full circle; 0 = right, PI/2 = down). */
  from?: number;
  to?: number;
}

/**
 * A burst of fine coloured sparks from (x, y), `age` seconds after it went off. Spark i travels
 * speed x life x 0.5 x (1 - (1 - f)^2) along its angle (f = age / its life), plus gravity x age^2 / 2 down.
 * Example: at age 0 every spark is at (x, y), white; at age >= 1.4 x life nothing is drawn.
 */
export function dustBurst(s: Surface, x: number, y: number, age: number, seed: number, o: BurstOpts = {}): void {
  const life = o.life ?? 0.9;
  if (age < 0 || age > life * 1.4) return;
  const n = o.n ?? 70;
  const speed = o.speed ?? 260;
  const size = o.size ?? 1.5;
  const g = o.gravity ?? 0;
  const a0 = o.from ?? 0;
  const a1 = o.to ?? Math.PI * 2;
  const cols = dustColors(s);
  const frame = Math.floor(age * 30);
  for (let i = 0; i < n; i++) {
    const li = life * (0.5 + 0.9 * hash01(i, seed, 3));
    if (age > li) continue;
    const f = age / li;
    const ang = a0 + (a1 - a0) * hash01(i, seed, 1);
    const v = speed * (0.2 + 0.8 * Math.sqrt(hash01(i, seed, 2)));
    const d = v * li * 0.5 * (1 - (1 - f) * (1 - f));
    const px = x + Math.cos(ang) * d;
    const py = y + Math.sin(ang) * d + 0.5 * g * age * age;
    const col = f < 0.12 ? '#FFFFFF' : (cols[(i + seed) % cols.length] ?? '#FFFFFF');
    const tw = 0.55 + 0.45 * hash01(i, seed, frame);
    s.dot(px, py, hash01(i, seed, 4) > 0.9 ? size * 2 : size, col, (1 - f) * tw);
  }
}

/**
 * A sparkle field: n coloured pixels drifting slowly and twinkling, the demo's coloured "stars".
 * Example: dustField(s, t, 120, 5) draws 120 pixels, the same layout every frame at the same t.
 */
export function dustField(s: Surface, t: number, n: number, seed: number, drift = 6): void {
  const cols = dustColors(s);
  for (let i = 0; i < n; i++) {
    const x = (hash01(i, seed, 1) * s.width + t * drift * (0.3 + hash01(i, seed, 2))) % s.width;
    const y = hash01(i, seed, 3) * s.height;
    const tw = 0.5 + 0.5 * Math.sin(t * (2 + 5 * hash01(i, seed, 4)) + i);
    s.dot(x, y, hash01(i, seed, 5) > 0.93 ? 2 : 1, cols[i % cols.length] ?? '#FFFFFF', 0.25 + 0.6 * tw * tw);
  }
}

/**
 * An exhaust trail behind a moving emitter: `pos(te)` is the nozzle at emitter time te. Puffs are emitted every
 * `every` s for the last `span` s; a puff of age a sits where the nozzle was at t - a, spread sideways by
 * `spread` x a px and sinking by `sink` x a^2; `pos` returns null where nothing was emitted (engine off). Hot (white, then yellow) at the nozzle, then the dust colours.
 */
export function dustTrail(s: Surface, t: number, pos: (te: number) => { x: number; y: number } | null, seed: number, span = 1.1, every = 0.022, spread = 46, sink = 30, size = 1.6): void {
  const cols = dustColors(s);
  const n = Math.floor(span / every);
  for (let j = 0; j < n; j++) {
    const a = j * every + (t % every);
    const te = t - a;
    if (te < 0) break;
    const p = pos(te);
    if (!p) continue;
    const e = Math.floor((t - a) / every);
    for (let q = 0; q < 4; q++) {
      const side = (hash01(e, q, seed) - 0.5) * 2;
      const px = p.x + side * spread * a;
      const py = p.y + sink * a * a + hash01(e, q + 5, seed) * 6 * a;
      const f = a / span;
      const col = a < 0.04 ? '#FFFFFF' : a < 0.1 ? '#FFE9A8' : (cols[(e + q) % cols.length] ?? '#FFFFFF');
      s.dot(px, py, a < 0.1 ? size * 1.4 : size, col, Math.max(0, 1 - f) * (0.6 + 0.4 * hash01(e, q, 9)));
    }
  }
}

/**
 * Hit-storm rate, hits a second, at heat h in 0..1: nothing below 0.3, then up to KNOBS.DEMO_STORM_MAX_HZ.
 * Example: stormRate(0.2) = 0; stormRate(1) = DEMO_STORM_MAX_HZ.
 */
export function stormRate(h: number): number {
  const x = Math.max(0, (h - 0.3) / 0.7);
  return KNOBS.DEMO_STORM_MAX_HZ * x * x;
}

/** Hits the storm has landed by local time t at heat h (the callers' sound schedule). Example: stormHits(1, 0) = 0. */
export function stormHits(t: number, h: number): number {
  const r = stormRate(h);
  return r > 0 ? Math.floor(t * r) : 0;
}

/**
 * The hit storm over any scene: rocks streak in from the top edge and land anywhere on screen as small coloured
 * bursts with a ring. Hit i lands at i / rate; its streak shows for the 0.18 s before.
 */
export function hitStorm(s: Surface, t: number, h: number, seed: number): void {
  const r = stormRate(h);
  if (r <= 0) return;
  const last = Math.floor(t * r) + 2;
  const first = Math.max(0, last - Math.ceil(r * 1.3) - 2);
  const cols = dustColors(s);
  for (let i = first; i <= last; i++) {
    const at = i / r;
    const x = s.width * (0.06 + 0.88 * hash01(i, seed, 1));
    const y = s.height * (0.18 + 0.72 * hash01(i, seed, 2));
    const dt = t - at;
    const ang = Math.PI * (0.3 + 0.4 * hash01(i, seed, 3));
    if (dt < 0 && dt > -0.18) {
      const f = 1 + dt / 0.18;
      const sx = x - Math.cos(ang) * 260 * (1 - f);
      const sy = y - Math.sin(ang) * 260 * (1 - f);
      s.stroke([sx - Math.cos(ang) * 26, sy - Math.sin(ang) * 26, sx, sy], { color: cols[i % cols.length] ?? '#FFFFFF', glow: 1.2, width: 2 });
    } else if (dt >= 0) {
      dustBurst(s, x, y, dt, i * 7 + seed, { n: 40 + Math.round(60 * h), speed: 170 + 260 * h, life: 0.7, size: 1.5 });
      if (dt < 0.45) s.circle(x, y, 3 + dt * (90 + 120 * h), { color: cols[(i + 3) % cols.length] ?? '#FFFFFF', glow: 1.2, alpha: 1 - dt / 0.45 });
    }
  }
}
