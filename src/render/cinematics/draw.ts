// WHAT: Draws one cinematic scene at one moment: body, streak, rods, cracks, rings, shards, particles.
// WHY:  GAME_PLAN 29: the PERIMETER look (pixel debris, shards, neon strokes) on the resolved numbers.
//       Everything here is a pure function of (scene, elapsed): scrubbing, skipping and reduce-motion
//       cost nothing and the scene data is never mutated.
// HOW:  The drawer picks an origin per kind (pad bottom-left for a launch, the planet for a close
//       approach, centre otherwise), scales scene px to the window and maps roles through Surface.role.
//       Under reduce-motion it draws one still frame: title, subtitle and the final body.
// LORE: G8 (the look), D4 (fragmentation), O12 (close approach)

import type { Surface } from '../canvas';
import { withAlpha } from '../palettes';
import { drawText } from '../vectorFont';
import { wireSphere } from '../wire';
import { approachPos, launchArc, launchProgress, type Scene } from './scene';

function polyAt(s: Surface, pts: readonly number[], ox: number, oy: number, k: number, rot: number, style: Parameters<Surface['stroke']>[1]): void {
  const c = Math.cos(rot);
  const sn = Math.sin(rot);
  const buf: number[] = [];
  for (let i = 0; i + 1 < pts.length; i += 2) {
    const x = pts[i] ?? 0;
    const y = pts[i + 1] ?? 0;
    buf.push(ox + (x * c - y * sn) * k, oy + (x * sn + y * c) * k);
  }
  if (buf.length >= 4) s.stroke(buf, { closed: pts.length > 4, ...style });
}

export function renderScene(s: Surface, sc: Scene, elapsed: number, countdown: string, reduceMotion: boolean): void {
  const p = s.palette;
  s.clear();
  const k = Math.max(0.5, Math.min(1.4, Math.min(s.width / 1000, s.height / 700)));
  const origin: [number, number] = sc.kind === 'LAUNCH' ? [s.width * 0.3, s.height * 0.8] : sc.kind === 'CLOSE_APPROACH' ? [s.width * 0.42, s.height * 0.5] : [s.width * 0.5 + 40 * k, s.height * 0.5 - 10];
  const [ox, oy] = origin;
  const X = (x: number): number => ox + x * k;
  const Y = (y: number): number => oy + y * k;
  const t = reduceMotion ? sc.duration : elapsed;
  const hit = t >= sc.hitAt;

  // Static stage.
  if (sc.kind === 'LAUNCH') {
    const limbR = 900 * k;
    s.circle(ox, oy + limbR, limbR, { color: s.role('planet'), glow: 1, width: 1.5 });
    for (let i = 1; i <= 3; i++) s.circle(ox, oy + limbR, limbR + i * 9 * k, { color: p.dim, glow: 0, alpha: 0.35 - i * 0.08 });
    s.stroke([X(-10), Y(0), X(10), Y(0), X(10), Y(-8), X(-10), Y(-8)], { closed: true, color: p.dim, glow: 0 });
  }
  if (sc.kind === 'CLOSE_APPROACH' && sc.approach) {
    const a = sc.approach;
    wireSphere(s, ox, oy, a.homeR * k, elapsed * 0.25, 5, 8, s.role('planet'));
    s.circle(ox, oy, a.ringR * k, { color: s.role('danger'), dash: [3, 4], glow: 0.4, alpha: 0.7 });
    drawText(s, 'B-CRIT', ox + a.ringR * k * 0.72, oy - a.ringR * k - 14, 9, { color: p.dim, glow: 0 });
    const [ax, ay] = approachPos(a, -10);
    const [bx, by] = approachPos(a, 10);
    s.stroke([X(ax), Y(ay), X(bx), Y(by)], { color: p.dim, dash: [2, 6], glow: 0, alpha: 0.6 });
    if (!a.impact && t >= 1.8) {
      const [mx, my] = approachPos(a, 1.8);
      s.stroke([ox, oy, X(mx), Y(my)], { color: s.role('threat'), dash: [4, 3], glow: 0.6, alpha: 0.8 });
    }
  }

  // The body.
  if (sc.body.length > 0) {
    let bx = 0;
    let by = 0;
    if (sc.kind === 'CLOSE_APPROACH' && sc.approach) {
      if (!(sc.approach.impact && hit)) [bx, by] = approachPos(sc.approach, t);
      else [bx, by] = [NaN, NaN];
    } else if (hit) {
      bx = sc.bodyDrift.vx * (t - sc.hitAt);
      by = sc.bodyDrift.vy * (t - sc.hitAt);
    }
    const pts = hit ? sc.bodyAfter : sc.body;
    if (pts && Number.isFinite(bx)) {
      const rot = sc.kind === 'CLOSE_APPROACH' ? t * 0.8 : t * 0.15;
      polyAt(s, pts.map((v, i) => v * sc.bodyR * (i % 2 === 0 ? 1 : 1)), X(bx), Y(by), k, rot, { color: s.role('threat'), glow: 1.2, width: 1.5 });
    }
  }

  // Streak (impactor, warhead, PI rods).
  if (sc.streak && !reduceMotion) {
    const st = sc.streak;
    const [fx, fy] = st.from;
    const [tx, ty] = st.to;
    const u = Math.max(0, t / st.tArrive);
    if (u <= 1 || st.passThrough) {
      const px = fx + (tx - fx) * u;
      const py = fy + (ty - fy) * u;
      const len = Math.hypot(tx - fx, ty - fy) || 1;
      const dx = (tx - fx) / len;
      const dy = (ty - fy) / len;
      const rods = sc.rods > 0 ? sc.rods : 1;
      for (let r = 0; r < rods; r++) {
        const off = rods > 1 ? (r - (rods - 1) / 2) * sc.bodyR * 0.22 : 0;
        const ax = px - dy * off;
        const ay = py + dx * off;
        s.stroke([X(ax - dx * st.tail), Y(ay - dy * st.tail), X(ax), Y(ay)], { color: s.role(st.role), glow: 2, width: rods > 1 ? 2 : 3, alpha: rods > 1 ? 0.8 : 1 });
        if (rods === 1) s.dot(X(ax), Y(ay), 6 * k, p.hot, 1);
      }
    }
  }

  // Launch vehicle.
  if (sc.launch && !reduceMotion) {
    const u = launchProgress(t, sc.duration);
    const [x, y, tx, ty] = launchArc(u, sc.launch.tier);
    const len = 18 + 6 * sc.launch.tier;
    s.stroke([X(x - tx * len), Y(y - ty * len), X(x), Y(y)], { color: s.role('craft'), glow: 2, width: 3 });
    // Flame: a flickering line behind the vehicle.
    const fl = (8 + 6 * sc.launch.tier) * (0.7 + 0.3 * Math.abs(Math.sin(t * 37)));
    s.stroke([X(x - tx * len), Y(y - ty * len), X(x - tx * (len + fl)), Y(y - ty * (len + fl))], { color: s.role('nuclear'), glow: 2, width: 2 });
    s.dot(X(x - tx * len), Y(y - ty * len), 5 * k, s.role('nuclear'), 0.9);
    // The arc flown so far.
    const buf: number[] = [];
    for (let i = 0; i <= 24; i++) {
      const [ax, ay] = launchArc((u * i) / 24, sc.launch.tier);
      buf.push(X(ax), Y(ay));
    }
    if (buf.length >= 4) s.stroke(buf, { color: s.role('craft'), glow: 0.3, dash: [2, 4], alpha: 0.6 });
  }

  if (!reduceMotion) {
    for (const c of sc.cracks) {
      if (t < c.t0) continue;
      const f = Math.min(1, (t - c.t0) / c.dur);
      const n = Math.floor(f * (c.pts.length / 2 - 1));
      const buf: number[] = [];
      for (let i = 0; i <= n; i++) buf.push(X((c.pts[i * 2] ?? 0) * (sc.bodyR / sc.bodyR)), Y(c.pts[i * 2 + 1] ?? 0));
      if (buf.length >= 4) s.stroke(buf, { color: s.role('fragment'), glow: 1, width: 1.5 });
    }
    for (const r of sc.rings) {
      if (t < r.t0 || t > r.t0 + r.dur) continue;
      const f = (t - r.t0) / r.dur;
      s.circle(X(r.x), Y(r.y), (r.r0 + (r.r1 - r.r0) * f) * k, { color: s.role(r.role), glow: 1.5 * (1 - f), alpha: 1 - f * 0.9, ...(r.dash ? { dash: r.dash } : {}), width: 1 + (1 - f) });
    }
    for (const sh of sc.shards) {
      if (t < sh.t0) continue;
      const dt = t - sh.t0;
      polyAt(s, sh.pts, X(sh.x + sh.vx * dt), Y(sh.y + sh.vy * dt), k, sh.rot0 + sh.spin * dt, { color: s.role(sh.role), glow: 0.8, width: sh.width });
    }
    for (const q of sc.particles) {
      if (t < q.t0 || t > q.t0 + q.life) continue;
      const dt = t - q.t0;
      const a = 1 - dt / q.life;
      s.dot(X(q.x + q.vx * dt), Y(q.y + q.vy * dt + 0.5 * q.ay * dt * dt), q.size * k * 1.6, s.role(q.role), a);
    }
  }

  // Labels.
  const m = 16;
  drawText(s, countdown, m, m, 14, { color: p.hot, glow: 1.2 });
  drawText(s, 'CLOCK PAUSED FOR THE EVENT', m, m + 22, 9, { color: p.dim, glow: 0 });
  drawText(s, sc.title, s.width / 2, m + 6, 18, { align: 'center', color: s.role(sc.titleRole), glow: 1.8 });
  drawText(s, sc.subtitle, s.width / 2, m + 34, 11, { align: 'center', color: p.ink, glow: 0.6 });
  drawText(s, 'ANY KEY SKIPS', s.width - m, s.height - m - 12, 9, { align: 'right', color: p.dim, glow: 0 });
  const f = Math.min(1, elapsed / sc.duration);
  s.ctx.fillStyle = withAlpha(p.dim, 0.5);
  s.ctx.fillRect(0, s.height - 2, s.width * f, 2);
}
