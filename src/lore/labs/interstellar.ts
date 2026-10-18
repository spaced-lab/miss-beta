// WHAT: LAB_INTERSTELLAR: a visitor from another star hits HOME; choose its size, darkness, excess speed, tilt
//       and the side it comes from, and see each survey's days of warning on a log timeline, its track in a
//       HOME-centred side view (height above the plane), and which defences still fit in that time.
// WHY:  EDUCATION F12: interstellar visitors are fast, dark and come from anywhere, so warning is "how far
//       away can I see it" divided by "how fast is it coming". This lab lets you feel both halves of that sum.
// HOW:  The orbit is built backwards from impact, as LAB_SUNWARD does: at t_i the rock sits on HOME with a
//       heliocentric speed sqrt(v_inf^2 + 2 mu / r) whose direction makes it arrive (seen from HOME) from the
//       chosen angle off the Sun; stateToElements gives the in-plane hyperbola. It is then tilted by i about the
//       impact node line (src/sim/sky.ts tiltAboutNode, the same 3-D lite the rounds use). discover() runs once
//       per network with the `tilt` option, its own fixed-seed Rng and the network switched on from day one, over
//       the last WINDOW_YEARS. Cached by the rounded physics sliders, so the two network toggles are free.
// LORE: F12 (visitors from other stars), F3 (the sunward blind spot), F11 (the detection gauge), D5 (nuclear)

import { KNOBS } from '../../config/knobs';
import { AU, DAY, MU_SUN, YEAR } from '../../physics/constants';
import { stateToElements } from '../../physics/elements';
import { propagate, type Elements } from '../../physics/kepler';
import { absoluteMagnitude } from '../../physics/photometry';
import { discover, networkById, type Network } from '../../sim/detection';
import { hashSeed, Rng } from '../../sim/rng';
import { tiltAboutNode, type Vec3 } from '../../sim/sky';
import { fmt, type Box, type Lab } from './lab';
import { fitLabel, keyOf, loop, Memo } from './kit';

/** NOTE: lab scenario constants: HOME circular, an INNER observer orbit, the search window. */
const HOME: Elements = { a: AU, e: 0, w: 0, M0: 0, t0: 0 };
const INNER: Elements = { a: 0.723 * AU, e: 0, w: 0, M0: 1, t0: 0 };
const WINDOW_YEARS = 3;
const T_IMPACT = WINDOW_YEARS * YEAR;
const WINDOW_DAYS = Math.round(T_IMPACT / DAY);
const GROUND_IDS = ['ATLAS', 'CATALINA', 'PANSTARRS', 'ZTF', 'RUBIN'];
const SURVEYOR_ID = 'SPACE_IR_SURVEYOR';
const HIVE_ID = 'HIVE_2';

/**
 * NOTE: rough warning each defence needs, days. These are the lab's rules of thumb, built from the game's knobs,
 * not measured facts: a kinetic impactor needs its build time plus about a year for the nudge to grow into a
 * miss (the gauge's DEFLECT warning); a nuclear standoff craft already waiting at L1 (INTERCEPTOR_ON_STANDBY)
 * needs no build, only a flight of weeks and a push big enough for the short lever arm, so about three months;
 * an evacuation needs about three weeks (the gauge's EVACUATE warning).
 */
const METHODS: readonly { short: string; days: number }[] = [
  { short: 'KINETIC', days: Math.round((KNOBS.BUILD_TIME_KINETIC + KNOBS.GAUGE_DEFLECT_WARNING) / DAY) },
  { short: 'NUKE STANDBY', days: 90 },
  { short: 'EVACUATE', days: Math.round(KNOBS.GAUGE_EVACUATE_WARNING / DAY) },
];

interface Row {
  net: Network;
  short: string;
  /** Warning, days before impact, or -1 (never found in the window). */
  warn: number;
}

interface Run {
  rows: Row[];
  /** Threat position relative to HOME in the sun-fixed frame (Sun along -x), m, x y z per day. */
  rel: Float64Array;
  /** Relative speed to HOME, m/s, per day. */
  speed: Float64Array;
  H: number;
  /** Encounter speed at impact (3-D, relative to HOME), m/s. */
  uHit: number;
}

const runs = new Memo<Run>(12);

/** In-plane hyperbola that hits HOME at T_IMPACT arriving from dirDeg off the Sun, heliocentric excess speed vInf. */
function inPlaneOrbit(dirDeg: number, vInf: number): { el: Elements; node: number } {
  const hs = propagate(HOME, MU_SUN, T_IMPACT);
  const rm = Math.hypot(hs.r.x, hs.r.y);
  // Direction the rock comes FROM, seen from HOME: the sun line (-r_hat) turned by dirDeg toward the trailing
  // side, so the in-plane orbit is always prograde; the tilt (up to 180 deg) supplies the head-on cases.
  const th = (dirDeg * Math.PI) / 180;
  const sx = -hs.r.x / rm;
  const sy = -hs.r.y / rm;
  const cx = sx * Math.cos(th) - sy * Math.sin(th);
  const cy = sx * Math.sin(th) + sy * Math.cos(th);
  // Heliocentric speed at 1 AU: V^2 = v_inf^2 + 2 mu / r. Solve |v_home - u c| = V for u > 0.
  const V2 = vInf * vInf + (2 * MU_SUN) / rm;
  const vc = hs.v.x * cx + hs.v.y * cy;
  const vh2 = hs.v.x * hs.v.x + hs.v.y * hs.v.y;
  const u = vc + Math.sqrt(Math.max(0, vc * vc + V2 - vh2));
  const node = Math.atan2(hs.r.y, hs.r.x);
  for (const f of [1, 1.001, 0.999]) {
    try {
      return { el: stateToElements(hs.r, { x: hs.v.x - u * f * cx, y: hs.v.y - u * f * cy }, MU_SUN, T_IMPACT, true), node };
    } catch {
      // exactly radial at this speed: nudge it
    }
  }
  return { el: HOME, node };
}

function run(v: Record<string, number>): Run {
  const D = v.D ?? 300;
  const p = v.p ?? KNOBS.REAL_INTERSTELLAR_ALBEDO;
  const vInf = (v.vinf ?? 40) * 1000;
  const inclDeg = v.incl ?? 60;
  const dir = v.dir ?? 90;
  return runs.get(keyOf(D, p, vInf, inclDeg, dir), () => {
    const { el, node } = inPlaneOrbit(dir, vInf);
    const incl = (inclDeg * Math.PI) / 180;
    const ids = [...GROUND_IDS, SURVEYOR_ID, HIVE_ID];
    const rows: Row[] = ids.map((id) => {
      const net = networkById(id);
      const short = id === SURVEYOR_ID ? 'NEO SURVEYOR' : id === HIVE_ID ? 'HIVE 2' : id;
      const res = discover({ threat: el, home: HOME, inner: INNER, muSun: MU_SUN, tImpact: T_IMPACT, D, albedo: p, activeIds: [id], sinceOverride: { [id]: 0 }, windowYears: WINDOW_YEARS, tilt: { incl, node } }, new Rng(hashSeed(`LAB_INTERSTELLAR#${id}`)));
      return { net, short, warn: res.tDisc === null ? -1 : Math.max(0, Math.round(res.lead / DAY)) };
    });
    const nl = { x: Math.cos(node), y: Math.sin(node) };
    const rel = new Float64Array(WINDOW_DAYS * 3);
    const speed = new Float64Array(WINDOW_DAYS);
    let uHit = 0;
    for (let d = 0; d < WINDOW_DAYS; d++) {
      const t = Math.min(T_IMPACT, (d + 1) * DAY);
      const st = propagate(el, MU_SUN, t);
      const r3: Vec3 = tiltAboutNode(st.r, nl, incl);
      const v3: Vec3 = tiltAboutNode(st.v, nl, incl);
      const hm = propagate(HOME, MU_SUN, t);
      // Sun-fixed frame: rotate so the Sun (seen from HOME) lies along -x; z is height above the plane.
      const ang = Math.PI - Math.atan2(-hm.r.y, -hm.r.x);
      const dx = r3.x - hm.r.x;
      const dy = r3.y - hm.r.y;
      rel[3 * d] = dx * Math.cos(ang) - dy * Math.sin(ang);
      rel[3 * d + 1] = dx * Math.sin(ang) + dy * Math.cos(ang);
      rel[3 * d + 2] = r3.z;
      const u = Math.hypot(v3.x - hm.v.x, v3.y - hm.v.y, v3.z);
      speed[d] = u;
      if (d === WINDOW_DAYS - 1) uHit = u;
    }
    return { rows, rel, speed, H: absoluteMagnitude(D, p), uHit };
  });
}

/**
 * Distance to HOME (m) `warn` days before impact, and the mean speed relative to HOME (m/s) from then to impact.
 * Their ratio is the warning, near enough: the last stretch is close to a straight line.
 */
function stateAt(r: Run, warn: number): { dist: number; u: number } {
  const d = Math.max(0, Math.min(WINDOW_DAYS - 1, WINDOW_DAYS - 1 - warn));
  let sum = 0;
  for (let i = d; i < WINDOW_DAYS; i++) sum += r.speed[i] ?? 0;
  return { dist: Math.hypot(r.rel[3 * d] ?? 0, r.rel[3 * d + 1] ?? 0, r.rel[3 * d + 2] ?? 0), u: sum / (WINDOW_DAYS - d) };
}

const isOn = (row: Row, v: Record<string, number>): boolean =>
  row.net.id === SURVEYOR_ID ? (v.surveyor ?? 0) >= 0.5 : row.net.id === HIVE_ID ? (v.hive ?? 0) >= 0.5 : true;

function firstFound(r: Run, v: Record<string, number>): Row | undefined {
  return r.rows.filter((x) => isOn(x, v) && x.warn >= 0).sort((a, b) => b.warn - a.warn)[0];
}

export const lab: Lab = {
  id: 'LAB_INTERSTELLAR',
  title: 'VISITORS FROM OTHER STARS',
  code: ['src/sim/detection.ts: discover (tilt option)', 'src/sim/sky.ts: tiltAboutNode, viewGeometry3, trailingLoss, coverage', 'src/physics/photometry.ts: absoluteMagnitude, apparentMagnitude', 'src/physics/elements.ts: stateToElements'],
  sliders: [
    { key: 'D', label: 'D (m)', min: 50, max: 2000, step: 10, value: 300, log: true },
    { key: 'p', label: 'albedo p', min: 0.02, max: 0.25, step: 0.01, value: KNOBS.REAL_INTERSTELLAR_ALBEDO },
    { key: 'vinf', label: 'v_inf vs Sun (km/s)', min: 20, max: 80, step: 1, value: 40 },
    { key: 'incl', label: 'tilt i (deg)', min: 0, max: 180, step: 5, value: 60 },
    { key: 'dir', label: 'comes from (deg off sun)', min: 0, max: 180, step: 5, value: 90 },
    { key: 'surveyor', label: 'NEO Surveyor (IR, L1)', min: 0, max: 1, step: 1, value: 0 },
    { key: 'hive', label: 'HIVE 2 (planned)', min: 0, max: 1, step: 1, value: 0 },
  ],
  lines: (v) => {
    const r = run(v);
    const first = firstFound(r, v);
    const w = first?.warn ?? 0;
    const ok = METHODS.filter((m) => w >= m.days).map((m) => m.short);
    const lines = [`H = 5 log10(1329 / (D_km sqrt p)) = ${fmt(r.H)}   hits at ${fmt(r.uHit / 1000)} km/s (3-D, vs HOME)`];
    if (first) {
      const s = stateAt(r, first.warn);
      lines.push(`first found: ${first.short}, ${first.warn} days before impact (${KNOBS.DISCOVERY_NIGHTS} nights in a row)`);
      lines.push(`warning ~ distance / mean speed = ${fmt(s.dist / AU)} AU / ${fmt(s.u / 1000)} km/s = ${fmt(s.dist / Math.max(1, s.u) / DAY)} days`);
    } else lines.push(`nobody finds it in the last ${WINDOW_YEARS} years: no warning at all`);
    lines.push(ok.length > 0 ? `still in time: ${ok.join(', ')}` : `no defence fits: only the score for seeing it, and the cleanup`);
    return lines;
  },
  draw: (s, v, box, t = 0) => {
    const r = run(v);
    const pal = s.palette;
    s.stroke([box.x, box.y, box.x + box.w, box.y, box.x + box.w, box.y + box.h, box.x, box.y + box.h], { closed: true, color: pal.dim, glow: 0 });
    const first = firstFound(r, v);
    // Animated clock over the part of the approach that matters: from a little before the first discovery.
    const span = Math.min(WINDOW_DAYS - 1, Math.max(60, Math.round((first?.warn ?? 30) * 1.4)));
    const ph = Math.min(1, loop(t, 8) * 1.12);
    const left = Math.round(span * (1 - ph) * (1 - ph));
    const dNow = WINDOW_DAYS - 1 - left;
    const d0 = WINDOW_DAYS - 1 - span;

    // Side view: horizontal = distance from HOME in the plane, vertical = height above the plane.
    const gb: Box = { x: box.x + 2, y: box.y + 2, w: box.w - 4, h: Math.floor(box.h * 0.5) };
    const hx = gb.x + 30;
    const hy = gb.y + gb.h / 2;
    let ext = 0.02 * AU;
    for (let d = d0; d < WINDOW_DAYS; d++) ext = Math.max(ext, Math.hypot(r.rel[3 * d] ?? 0, r.rel[3 * d + 1] ?? 0), Math.abs(r.rel[3 * d + 2] ?? 0) * (gb.w - 40) / (gb.h / 2 - 8));
    const k = (gb.w - 40) / ext;
    s.stroke([gb.x + 4, hy, gb.x + gb.w - 4, hy], { color: pal.dim, glow: 0, dash: [2, 4] });
    fitLabel(s, gb, 'THE PLANE', gb.x + gb.w - 64, hy + 3, pal.dim, 6);
    fitLabel(s, gb, `SIDE VIEW: ${fmt(ext / AU, 2)} AU ACROSS, ${fmt((gb.h / 2 - 8) / k / AU, 2)} AU UP OR DOWN`, gb.x + 4, gb.y + 2, pal.dim, 6);
    s.circle(hx, hy, 4, { color: s.role('planet'), glow: 0.8 });
    fitLabel(s, gb, 'HOME', hx - 12, hy + 6, pal.ink, 6);
    const X = (d: number): number => hx + Math.hypot(r.rel[3 * d] ?? 0, r.rel[3 * d + 1] ?? 0) * k;
    const Y = (d: number): number => hy - (r.rel[3 * d + 2] ?? 0) * k;
    const path: number[] = [];
    for (let d = d0; d <= dNow; d++) path.push(X(d), Y(d));
    if (path.length >= 4) s.stroke(path, { color: s.role('threat'), glow: 0.4 });
    s.circle(X(dNow), Y(dNow), 3, { color: s.role('threat'), glow: 1 });
    for (const row of r.rows) {
      if (!isOn(row, v) || row.warn < 0 || row.warn > span || left > row.warn) continue;
      const d = WINDOW_DAYS - 1 - row.warn;
      s.circle(X(d), Y(d), 2, { color: pal.hot, glow: 0.8 });
      if (row === first) fitLabel(s, gb, `${row.short} SEES IT`, X(d) + 5, Y(d) - 4, pal.hot, 6);
    }
    fitLabel(s, gb, `${left} DAYS TO IMPACT`, gb.x + gb.w - 100, gb.y + 2, pal.ink, 7);

    // Timeline: one row per network, days before impact on a log axis (WINDOW_DAYS .. 1), plus each defence's need.
    const tb: Box = { x: box.x + 74, y: gb.y + gb.h + 6, w: box.w - 80, h: box.h - gb.h - 12 };
    const rh = tb.h / (r.rows.length + 2);
    const TX = (days: number): number => tb.x + (1 - Math.log(Math.max(1, days)) / Math.log(WINDOW_DAYS)) * tb.w;
    const axisY = tb.y + r.rows.length * rh;
    for (const dl of [1000, 100, 10, 1]) fitLabel(s, box, `${dl}`, TX(dl) - 6, axisY + 1, pal.dim, 6);
    fitLabel(s, { x: box.x, y: box.y, w: 72, h: box.h }, 'DAYS LEFT', box.x + 4, axisY + 1, pal.dim, 6);
    for (const m of METHODS) {
      s.stroke([TX(m.days), tb.y, TX(m.days), axisY + rh], { color: pal.dim, glow: 0, dash: [1, 3] });
      fitLabel(s, tb, m.short, TX(m.days) + 2, axisY + rh + 1, pal.dim, 5);
    }
    s.stroke([TX(left), tb.y, TX(left), axisY], { color: pal.ink, glow: 0.3 });
    r.rows.forEach((row, i) => {
      const y = tb.y + i * rh;
      const on = isOn(row, v);
      const lit = on && row.warn >= 0 && left <= row.warn;
      const col = !on ? pal.dim : lit ? pal.hot : pal.ink;
      const fs = Math.min(7, rh * 0.75);
      fitLabel(s, { x: box.x, y: box.y, w: 72, h: box.h }, row.short, box.x + 4, y, col, fs);
      s.stroke([tb.x, y + rh * 0.4, tb.x + tb.w, y + rh * 0.4], { color: pal.dim, glow: 0, dash: [1, 6] });
      if (!on) fitLabel(s, tb, 'OFF', tb.x + 4, y, pal.dim, fs);
      else if (row.warn < 0) fitLabel(s, tb, 'NEVER', tb.x + 4, y, pal.dim, fs);
      else {
        const x = TX(row.warn);
        s.circle(x, y + rh * 0.4, Math.min(3, rh * 0.35), { color: col, glow: lit ? 1 : 0.2 });
        if (lit) fitLabel(s, tb, `${row.warn} D`, x + 5, y, pal.hot, fs);
      }
    });
  },
};
