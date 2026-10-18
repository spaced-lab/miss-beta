// WHAT: LAB_SUNWARD: a rock closes on HOME from a chosen direction relative to the Sun; each survey's field
//       of regard is drawn as a cone around HOME and lights up on the night it discovers the rock; a timeline
//       gives each network's days of warning.
// WHY:  EDUCATION F3: ground telescopes cannot look near the Sun, so a rock that arrives out of the glare
//       (Chelyabinsk, 2013) is unseen until it hits. An infrared sentinel that looks sunward closes that gap.
// HOW:  The rock's orbit is built backwards from impact: at t_i it sits on HOME with velocity v_home + v_inf,
//       v_inf pointing away from the chosen approach direction; stateToElements gives the orbit. For each of the
//       last WINDOW_DAYS nights, detects (src/sim/detection.ts, which calls photometry.ts for H, V and the
//       viewing angles) is evaluated for every network with its own fixed-seed Rng, and a network discovers
//       on its DISCOVERY_NIGHTS-th consecutive detection, exactly as discover() does. Cached by the rounded
//       slider values. Drawn in a HOME-centred frame with the Sun fixed to the left, where the cones are still.
// LORE: F3 (the sunward blind spot), F4 (seeing heat), F5 (today's surveys)

import { KNOBS } from '../../config/knobs';
import { AU, DAY, MU_SUN } from '../../physics/constants';
import { stateToElements } from '../../physics/elements';
import { propagate, type Elements } from '../../physics/kepler';
import { absoluteMagnitude, viewGeometry } from '../../physics/photometry';
import { detects, networkById, type Network } from '../../sim/detection';
import { hashSeed, Rng } from '../../sim/rng';
import { fmt, type Box, type Lab } from './lab';
import { fitLabel, keyOf, loop, Memo } from './kit';

/** NOTE: lab scenario constants: HOME circular, an INNER observer orbit, the encounter speed and window. */
const HOME: Elements = { a: AU, e: 0, w: 0, M0: 0, t0: 0 };
const INNER: Elements = { a: 0.723 * AU, e: 0, w: 0, M0: 1, t0: 0 };
const V_INF = 15000;
const ALBEDO = 0.14;
const WINDOW_DAYS = 365;
const T_IMPACT = WINDOW_DAYS * DAY;
const GROUND_IDS = ['ATLAS', 'CATALINA', 'PANSTARRS', 'ZTF', 'RUBIN'];
const SURVEYOR_ID = 'SPACE_IR_SURVEYOR';
const SENTINEL_ID = 'SUNWARD_SENTINEL';

interface Row {
  net: Network;
  short: string;
  /** Discovery day index (0 .. WINDOW_DAYS - 1) or -1 (never). */
  day: number;
  on: boolean;
}

interface Run {
  rows: Row[];
  /** Threat position relative to HOME in the sun-fixed frame (Sun along -x), m, one per day. */
  rel: Float64Array;
  H: number;
  /** Days in the last 30 when the rock sat inside 60 deg of the Sun as seen from HOME. */
  glareDays: number;
}

const runs = new Memo<Run>(12);

function threatOrbit(dirDeg: number): Elements {
  const hs = propagate(HOME, MU_SUN, T_IMPACT);
  const rm = Math.hypot(hs.r.x, hs.r.y);
  // Direction the rock comes FROM, seen from HOME: the sun line (-r_hat) turned by dirDeg.
  const th = (dirDeg * Math.PI) / 180;
  const sx = -hs.r.x / rm;
  const sy = -hs.r.y / rm;
  const cxd = sx * Math.cos(th) - sy * Math.sin(th);
  const cyd = sx * Math.sin(th) + sy * Math.cos(th);
  for (const f of [1, 1.03, 0.97]) {
    try {
      return stateToElements(hs.r, { x: hs.v.x - V_INF * f * cxd, y: hs.v.y - V_INF * f * cyd }, MU_SUN, T_IMPACT, true);
    } catch {
      // parabolic or retrograde at this exact speed: try a slightly different one
    }
  }
  return HOME;
}

function run(v: Record<string, number>): Run {
  const dir = v.dir ?? 30;
  const D = v.D ?? 50;
  const sentinel = (v.sentinel ?? 0) >= 0.5;
  return runs.get(keyOf(dir, D, sentinel ? 1 : 0), () => {
    const th = threatOrbit(dir);
    const ids = [...GROUND_IDS, SURVEYOR_ID, SENTINEL_ID];
    const rows: Row[] = ids.map((id) => {
      const net = networkById(id);
      const short = id === SURVEYOR_ID ? 'NEO SURVEYOR' : id === SENTINEL_ID ? 'SENTINEL' : id;
      return { net, short, day: -1, on: id !== SENTINEL_ID || sentinel };
    });
    const rngs = rows.map((r) => new Rng(hashSeed(`LAB_SUNWARD#${r.net.id}`)));
    const streak = rows.map(() => 0);
    const rel = new Float64Array(WINDOW_DAYS * 2);
    let glareDays = 0;
    for (let d = 0; d < WINDOW_DAYS; d++) {
      const t = d * DAY;
      const rT = propagate(th, MU_SUN, t).r;
      const home = propagate(HOME, MU_SUN, t).r;
      const inner = propagate(INNER, MU_SUN, t).r;
      // Sun-fixed frame: rotate so the Sun (seen from HOME) lies along -x.
      const ang = Math.PI - Math.atan2(-home.y, -home.x);
      const dx = rT.x - home.x;
      const dy = rT.y - home.y;
      rel[2 * d] = dx * Math.cos(ang) - dy * Math.sin(ang);
      rel[2 * d + 1] = dx * Math.sin(ang) + dy * Math.cos(ang);
      if (d >= WINDOW_DAYS - 30 && viewGeometry(rT, home).epsDeg < 60) glareDays++;
      const inp = { t, rT, home, inner, D, albedo: ALBEDO };
      rows.forEach((row, i) => {
        if (!row.on || row.day >= 0) return;
        const rng = rngs[i];
        if (!rng) return;
        if (detects(row.net, inp, rng)) {
          streak[i] = (streak[i] ?? 0) + 1;
          if ((streak[i] ?? 0) >= KNOBS.DISCOVERY_NIGHTS) row.day = d;
        } else streak[i] = 0;
      });
    }
    return { rows, rel, H: absoluteMagnitude(D, ALBEDO), glareDays };
  });
}

const warn = (day: number): number => WINDOW_DAYS - day;

export const lab: Lab = {
  id: 'LAB_SUNWARD',
  title: 'THE SUNWARD BLIND SPOT',
  code: ['src/sim/detection.ts: detects, discover', 'src/physics/photometry.ts: absoluteMagnitude, apparentMagnitude, viewGeometry', 'src/physics/elements.ts: stateToElements'],
  sliders: [
    { key: 'dir', label: 'comes from (deg off sun)', min: 0, max: 180, step: 5, value: 30 },
    { key: 'D', label: 'D (m)', min: 10, max: 1000, step: 5, value: 50, log: true },
    { key: 'sentinel', label: 'sunward sentinel', min: 0, max: 1, step: 1, value: 0 },
  ],
  lines: (v) => {
    const r = run(v);
    const seen = r.rows.filter((x) => x.on && x.day >= 0).sort((a, b) => a.day - b.day);
    const first = seen[0];
    const sen = r.rows.find((x) => x.net.id === SENTINEL_ID);
    return [
      `H = 5 log10(1329 / (D_km sqrt p)) = ${fmt(r.H)} (D ${fmt(v.D ?? 50)} m, p ${ALBEDO})   v_inf ${V_INF / 1000} km/s`,
      first ? `first discovery: ${first.short}, ${warn(first.day)} days before impact (${KNOBS.DISCOVERY_NIGHTS} nights in a row)` : `nobody discovers it in the last ${WINDOW_DAYS} days: no warning at all`,
      `ground needs elongation >= 60 deg and V <= V_lim; in glare ${r.glareDays} of the last 30 days`,
      `sentinel (IR, 10 to 45 deg from the sun): ${!sen?.on ? 'OFF' : sen.day >= 0 ? `${warn(sen.day)} days of warning` : 'on, but does not see it'}`,
    ];
  },
  draw: (s, v, box, t = 0) => {
    const r = run(v);
    const pal = s.palette;
    s.stroke([box.x, box.y, box.x + box.w, box.y, box.x + box.w, box.y + box.h, box.x, box.y + box.h], { closed: true, color: pal.dim, glow: 0 });
    // Animated clock: days before impact shrink fast far out and slowly near the end (most of the story).
    const ph = Math.min(1, loop(t, 8) * 1.12);
    const left = WINDOW_DAYS * (1 - ph) * (1 - ph);
    const dayNow = Math.min(WINDOW_DAYS - 1, WINDOW_DAYS - left);
    const gb: Box = { x: box.x + 2, y: box.y + 2, w: box.w - 4, h: Math.floor(box.h * 0.52) };
    const cx = gb.x + gb.w * 0.55;
    const cy = gb.y + gb.h / 2;
    const half = 0.5 * AU;
    const k = Math.min(gb.w * 0.45, gb.h * 0.5 - 4) / half;
    const L = Math.min(gb.w * 0.45, gb.h * 0.5);
    // Sun marker off to the left.
    s.circle(gb.x + 8, cy, 4, { color: s.role('star'), glow: 1 });
    fitLabel(s, gb, 'SUN 1 AU', gb.x + 15, cy - 4, pal.dim, 7);
    // Cones: rays at +/- eps from the sun line (-x). Lit once that group has discovered the rock.
    const groupDay = (pred: (row: Row) => boolean): number => {
      let best = -1;
      for (const row of r.rows) if (row.on && pred(row) && row.day >= 0 && (best < 0 || row.day < best)) best = row.day;
      return best;
    };
    const cone = (epsMin: number, epsMax: number, day: number, on: boolean, dash: readonly number[] | undefined, label: string): void => {
      if (!on) return;
      const lit = day >= 0 && dayNow >= day;
      const col = lit ? pal.hot : pal.dim;
      for (const eps of [epsMin, epsMax]) {
        if (eps >= 180) continue;
        const a = Math.PI - (eps * Math.PI) / 180;
        for (const sg of [1, -1]) s.stroke([cx, cy, cx + L * Math.cos(a), cy - sg * L * Math.sin(a)], { color: col, glow: lit ? 0.8 : 0, ...(dash ? { dash } : {}) });
      }
      const am = Math.PI - (((epsMin + Math.min(epsMax, 170)) / 2) * Math.PI) / 180;
      fitLabel(s, gb, label, cx + L * 0.8 * Math.cos(am), cy - L * 0.8 * Math.sin(am) - 4, col, 6);
    };
    const ground = GROUND_IDS.map(networkById)[0];
    cone(ground?.epsMin ?? 60, 180, groupDay((x) => x.net.kind === 'GROUND_OPTICAL'), true, undefined, 'GROUND');
    const sv = networkById(SURVEYOR_ID);
    cone(sv.epsMin ?? 45, sv.epsMax ?? 120, groupDay((x) => x.net.id === SURVEYOR_ID), true, [4, 2], 'L1 IR');
    const se = networkById(SENTINEL_ID);
    cone(se.epsMin ?? 10, se.epsMax ?? 45, groupDay((x) => x.net.id === SENTINEL_ID), (v.sentinel ?? 0) >= 0.5, [1, 3], 'SENTINEL');
    s.circle(cx, cy, 4, { color: s.role('planet'), glow: 0.8 });
    // The rock's approach in this frame, clipped to the panel.
    const path: number[] = [];
    const di = Math.floor(dayNow);
    for (let d = 0; d <= di; d++) {
      const x = cx + (r.rel[2 * d] ?? 0) * k;
      const y = cy - (r.rel[2 * d + 1] ?? 0) * k;
      if (x < gb.x || x > gb.x + gb.w || y < gb.y || y > gb.y + gb.h) {
        if (path.length >= 4) s.stroke(path, { color: s.role('threat'), glow: 0.4 });
        path.length = 0;
        continue;
      }
      path.push(x, y);
    }
    if (path.length >= 4) s.stroke(path, { color: s.role('threat'), glow: 0.4 });
    const tx = cx + (r.rel[2 * di] ?? 0) * k;
    const ty = cy - (r.rel[2 * di + 1] ?? 0) * k;
    if (tx >= gb.x && tx <= gb.x + gb.w && ty >= gb.y && ty <= gb.y + gb.h) s.circle(tx, ty, 3, { color: s.role('threat'), glow: 1 });
    fitLabel(s, gb, `${Math.max(0, Math.round(left))} DAYS TO IMPACT`, gb.x + gb.w - 110, gb.y + 2, pal.ink, 7);

    // Timeline: one row per network, days before impact on a log axis (365 .. 1).
    const tb: Box = { x: box.x + 74, y: gb.y + gb.h + 6, w: box.w - 80, h: box.h - gb.h - 12 };
    const rowsOn = r.rows;
    const rh = tb.h / (rowsOn.length + 1);
    const TX = (daysLeft: number): number => tb.x + (1 - Math.log(Math.max(1, daysLeft)) / Math.log(WINDOW_DAYS)) * tb.w;
    for (const dl of [365, 100, 30, 10, 3, 1]) {
      s.stroke([TX(dl), tb.y, TX(dl), tb.y + tb.h - rh], { color: pal.dim, glow: 0, dash: [1, 4] });
      fitLabel(s, box, `${dl}`, TX(dl) - 6, tb.y + tb.h - rh + 2, pal.dim, 6);
    }
    s.stroke([TX(left), tb.y, TX(left), tb.y + tb.h - rh], { color: pal.ink, glow: 0.3 });
    rowsOn.forEach((row, i) => {
      const y = tb.y + i * rh;
      const lit = row.on && row.day >= 0 && dayNow >= row.day;
      const col = !row.on ? pal.dim : lit ? pal.hot : pal.ink;
      fitLabel(s, { x: box.x, y: box.y, w: 72, h: box.h }, row.short, box.x + 4, y, col, Math.min(7, rh * 0.75));
      s.stroke([tb.x, y + rh * 0.4, tb.x + tb.w, y + rh * 0.4], { color: pal.dim, glow: 0, dash: [1, 6] });
      if (!row.on) fitLabel(s, tb, 'OFF', tb.x + 4, y, pal.dim, Math.min(7, rh * 0.75));
      else if (row.day < 0) fitLabel(s, tb, 'NEVER', tb.x + 4, y, pal.dim, Math.min(7, rh * 0.75));
      else {
        const x = TX(warn(row.day));
        s.circle(x, y + rh * 0.4, Math.min(3, rh * 0.35), { color: col, glow: lit ? 1 : 0.2 });
        if (lit) fitLabel(s, tb, `${warn(row.day)} D`, x + 5, y, pal.hot, Math.min(7, rh * 0.75));
      }
    });
  },
};
