// WHAT: LAB_FLYBY: a spacecraft bends around a planet on its hyperbola, with the incoming and outgoing
//       excess-velocity arrows, and a vector inset showing the heliocentric speed it gains or loses.
// WHY:  EDUCATION O11: a flyby never changes the speed relative to the planet; it only turns it. Turned
//       around a moving planet, that rotation becomes a free heliocentric dv of 2 v_inf sin(delta/2).
// HOW:  turnAngle and flyby (src/physics/flyby.ts) give delta and the outgoing vectors. The path is the
//       real hyperbola as Kepler elements in the planet frame (a = -mu / v_inf^2, e = 1 + r_p v_inf^2 / mu,
//       w chosen so the incoming asymptote points along +x): orbitPoints draws it, propagate moves the craft.
//       side = -1 mirrors the pass. The inset adds the planet's circular velocity (visViva) at the angle
//       `phi` to the incoming excess velocity; v_in, v_out and dv are drawn tip to tail on the v_inf circle.
// LORE: O11 (gravity assists)

import bodies from '../../config/bodies.json';
import { AU, MU_SUN } from '../../physics/constants';
import { flyby, turnAngle } from '../../physics/flyby';
import { orbitPoints, propagate, visViva, type Elements } from '../../physics/kepler';
import { fmt, type Box, type Lab } from './lab';
import { arrow, fitLabel, loop } from './kit';

interface PlanetRow {
  id: string;
  name: string;
  mu: number;
  a_au: number;
  radius: number;
}
const PLANETS = bodies.planets as PlanetRow[];

interface Setup {
  pl: PlanetRow;
  vinf: number;
  rP: number;
  side: 1 | -1;
  delta: number;
  el: Elements;
  vp: { x: number; y: number };
  res: ReturnType<typeof flyby>;
}

function setup(v: Record<string, number>): Setup {
  const idx = Math.max(0, Math.min(PLANETS.length - 1, Math.round(v.planet ?? 3)));
  const pl = PLANETS[idx] ?? { id: 'GIANT', name: 'GIANT', mu: 1.26686534e17, a_au: 5.203, radius: 6.9911e7 };
  const vinf = (v.vinf ?? 10) * 1000;
  const rP = (v.rp ?? 10) * pl.radius;
  const side: 1 | -1 = (v.side ?? 1) < 0 ? -1 : 1;
  const delta = turnAngle(rP, vinf, pl.mu);
  const e = 1 + (rP * vinf * vinf) / pl.mu;
  // Incoming asymptote direction in the perifocal frame is atan(sqrt(e^2 - 1)); rotate it onto +x.
  const el: Elements = { a: -pl.mu / (vinf * vinf), e, w: -Math.atan(Math.sqrt(e * e - 1)), M0: 0, t0: 0 };
  const vpl = visViva(MU_SUN, pl.a_au * AU, pl.a_au * AU);
  const phi = ((v.phi ?? 120) * Math.PI) / 180;
  const vp = { x: vpl * Math.cos(phi), y: vpl * Math.sin(phi) };
  const res = flyby({ x: vp.x + vinf, y: vp.y }, vp, delta, side, pl.mu);
  return { pl, vinf, rP, side, delta, el, vp, res };
}

export const lab: Lab = {
  id: 'LAB_FLYBY',
  title: 'GRAVITY ASSIST: TURN WITHOUT FUEL',
  code: ['src/physics/flyby.ts: turnAngle, flyby, periapsisForTurn', 'src/physics/kepler.ts: orbitPoints, propagate, visViva'],
  sliders: [
    { key: 'vinf', label: 'v_inf (km/s)', min: 2, max: 25, step: 0.5, value: 10 },
    { key: 'rp', label: 'r_p / R', min: 1.05, max: 30, step: 0.05, value: 10, log: true },
    { key: 'side', label: 'side (-1, +1)', min: -1, max: 1, step: 2, value: 1 },
    { key: 'planet', label: 'planet 0..3', min: 0, max: 3, step: 1, value: 3 },
    { key: 'phi', label: 'planet v angle (deg)', min: 0, max: 180, step: 5, value: 120 },
  ],
  lines: (v) => {
    const f = setup(v);
    const vin = Math.hypot(f.vp.x + f.vinf, f.vp.y);
    const vout = Math.hypot(f.res.vOut.x, f.res.vOut.y);
    return [
      `${f.pl.name}: e = 1 + r_p v_inf^2 / mu = ${fmt(f.el.e)}   delta = 2 asin(1/e) = ${fmt((f.delta * 180) / Math.PI)} deg`,
      `r_p = ${fmt(f.rP / f.pl.radius)} R = ${fmt(f.rP / 1000)} km   |v_inf| in = out = ${fmt(f.vinf / 1000)} km/s`,
      `|dv_helio| = 2 v_inf sin(delta/2) = ${fmt(f.res.dvHelio / 1000)} km/s`,
      `sun-frame speed ${fmt(vin / 1000)} -> ${fmt(vout / 1000)} km/s (${vout >= vin ? 'GAIN' : 'LOSS'} ${fmt(Math.abs(vout - vin) / 1000)})`,
    ];
  },
  draw: (s, v, box, t = 0) => {
    const f = setup(v);
    const pal = s.palette;
    s.stroke([box.x, box.y, box.x + box.w, box.y, box.x + box.w, box.y + box.h, box.x, box.y + box.h], { closed: true, color: pal.dim, glow: 0 });
    // Left: planet frame.
    const lw = box.w * 0.6;
    const lb: Box = { x: box.x, y: box.y, w: lw, h: box.h };
    const rView = Math.max(4 * f.rP, 6 * f.pl.radius);
    const k = (Math.min(lw, box.h) - 16) / (2 * rView);
    const cx = box.x + lw / 2;
    const cy = box.y + box.h / 2;
    const SX = (x: number): number => cx + x * k;
    const SY = (y: number): number => cy - f.side * y * k;
    s.circle(cx, cy, Math.max(2, f.pl.radius * k), { color: s.role('planet'), glow: 0.6 });
    s.circle(cx, cy, Math.max(3, f.rP * k), { color: pal.dim, glow: 0, dash: [1, 4] });
    const pts = orbitPoints(f.el, 96, rView);
    const buf = new Array<number>(pts.length);
    for (let i = 0; i < pts.length; i += 2) {
      buf[i] = SX(pts[i] ?? 0);
      buf[i + 1] = SY(pts[i + 1] ?? 0);
    }
    s.stroke(buf, { color: pal.dim, glow: 0.2, dash: [3, 3] });
    // Animate in mean anomaly between the two ends (r = rView), then hold one beat.
    const coshH = (1 - rView / f.el.a) / f.el.e;
    const Hmax = Math.acosh(Math.max(1, coshH));
    const Mmax = f.el.e * Math.sinh(Hmax) - Hmax;
    const n = Math.sqrt(f.pl.mu / Math.pow(-f.el.a, 3));
    const ph = Math.min(1, loop(t, 5) * 1.15);
    const tNow = ((2 * ph - 1) * Mmax) / n;
    // Flown part of the path, bright.
    const flown: number[] = [];
    for (let i = 0; i <= 40; i++) {
      const tt = (-Mmax + (i / 40) * (tNow * n + Mmax)) / n;
      const st = propagate(f.el, f.pl.mu, tt);
      flown.push(SX(st.r.x), SY(st.r.y));
    }
    s.stroke(flown, { color: s.role('craft'), glow: 0.5 });
    const st = propagate(f.el, f.pl.mu, tNow);
    const sx = SX(st.r.x);
    const sy = SY(st.r.y);
    s.circle(sx, sy, 3, { color: s.role('craft'), glow: 1 });
    const vm = Math.hypot(st.v.x, st.v.y) || 1;
    arrow(s, sx, sy, sx + (16 * st.v.x) / vm, sy - (f.side * 16 * st.v.y) / vm, s.role('craft'));
    // v_inf in (left edge) and out (along the outgoing asymptote).
    const L = 26;
    const p0 = propagate(f.el, f.pl.mu, -Mmax / n);
    arrow(s, SX(p0.r.x), SY(p0.r.y), SX(p0.r.x) + L, SY(p0.r.y), pal.ink, [3, 2]);
    fitLabel(s, lb, 'V_INF IN', SX(p0.r.x), SY(p0.r.y) + 6, pal.dim, 7);
    const p1 = propagate(f.el, f.pl.mu, Mmax / n);
    const om = Math.hypot(f.res.vInfOut.x, f.res.vInfOut.y) || 1;
    arrow(s, SX(p1.r.x), SY(p1.r.y), SX(p1.r.x) + (L * f.res.vInfOut.x) / om, SY(p1.r.y) - (L * f.res.vInfOut.y) / om, pal.hot);
    fitLabel(s, lb, 'V_INF OUT', SX(p1.r.x) - 30, SY(p1.r.y) + (f.side > 0 ? -14 : 6), pal.hot, 7);
    fitLabel(s, lb, `DELTA ${Math.round((f.delta * 180) / Math.PI)} DEG  ${f.side > 0 ? 'CCW' : 'CW'}`, box.x + 4, box.y + 4, pal.dim, 7);

    // Right: heliocentric vector inset.
    const ib: Box = { x: box.x + lw + 4, y: box.y + 4, w: box.w - lw - 8, h: box.h - 8 };
    s.stroke([ib.x - 2, ib.y, ib.x - 2, ib.y + ib.h], { color: pal.dim, glow: 0 });
    const vpl = Math.hypot(f.vp.x, f.vp.y);
    const q = (Math.min(ib.w, ib.h) * 0.42) / (vpl + f.vinf);
    const ox = ib.x + ib.w * 0.5 - f.vp.x * q * 0.5;
    const oy = ib.y + ib.h * 0.6 + f.vp.y * q * 0.5;
    const tipX = ox + f.vp.x * q;
    const tipY = oy - f.vp.y * q;
    s.circle(tipX, tipY, f.vinf * q, { color: pal.dim, glow: 0, dash: [2, 3] });
    arrow(s, ox, oy, tipX, tipY, s.role('planet'));
    const inTipX = tipX + f.vinf * q;
    const inTipY = tipY;
    arrow(s, ox, oy, inTipX, inTipY, s.role('craft'), [3, 2]);
    // The current direction of the planet-relative velocity, sweeping around the circle as the craft passes.
    const nowX = tipX + (f.vinf * q * st.v.x) / vm;
    const nowY = tipY - (f.vinf * q * st.v.y * f.side) / vm;
    arrow(s, ox, oy, nowX, nowY, s.role('craft'));
    s.stroke([inTipX, inTipY, nowX, nowY], { color: pal.hot, glow: 0.6 });
    fitLabel(s, ib, 'SUN FRAME', ib.x + 2, ib.y + 2, pal.dim, 7);
    fitLabel(s, ib, 'PLANET V', ib.x + 2, ib.y + ib.h - 30, s.role('planet'), 7);
    fitLabel(s, ib, 'DASH IN  SOLID NOW', ib.x + 2, ib.y + ib.h - 20, pal.dim, 7);
    fitLabel(s, ib, `DV ${fmt(f.res.dvHelio / 1000)} KM/S`, ib.x + 2, ib.y + ib.h - 10, pal.hot, 7);
  },
};
