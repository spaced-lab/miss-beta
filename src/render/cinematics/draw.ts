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
import { KNOBS } from '../../config/knobs';
import { drawLaunchStage, drawLaunchVehicle, launchCell } from './launch';
import { approachPos, type Scene } from './scene';
import { falseColor, fireColor, hash01 } from './pixel';
import type { Role } from '../palettes';

/** Debris roles cycle like the minigame's hardness colours, so a breakup is not one flat colour under NEON. */
const DEBRIS_ROLES: readonly Role[] = ['threat', 'fragment', 'sail', 'danger', 'craft'];

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

/**
 * The body as a fuller wireframe (owner 2026-10-18: higher-detail wireframes): the outline, two inner contours
 * shifted toward a lit point (a cheap sense of a rounded, lumpy surface), ridge lines from that point to every
 * second vertex, and a few seeded craters on the near face. All in body units, rotated with the body.
 * Cost: about 3 + n/2 strokes plus 3 crater rings for an n-vertex outline.
 */
function wireBody(s: Surface, pts: readonly number[], ox: number, oy: number, k: number, rot: number, color: string, seed: number): void {
  polyAt(s, pts, ox, oy, k, rot, { color, glow: 1.2, width: 1.5 });
  const n = pts.length / 2;
  if (n < 5) return;
  // The lit point sits up-left of centre; contours shrink toward it.
  const lx = -0.28;
  const ly = -0.22;
  let rMean = 0;
  for (let i = 0; i < n; i++) rMean += Math.hypot(pts[i * 2] ?? 0, pts[i * 2 + 1] ?? 0) / n;
  const cx = lx * rMean;
  const cy = ly * rMean;
  for (const f of [0.7, 0.4]) {
    const ring: number[] = [];
    for (let i = 0; i < n; i++) ring.push(cx + ((pts[i * 2] ?? 0) - cx) * f, cy + ((pts[i * 2 + 1] ?? 0) - cy) * f);
    polyAt(s, ring, ox, oy, k, rot, { color, glow: 0.4, width: 1, alpha: f > 0.5 ? 0.55 : 0.35 });
  }
  const c = Math.cos(rot);
  const sn = Math.sin(rot);
  const P = (x: number, y: number): [number, number] => [ox + (x * c - y * sn) * k, oy + (x * sn + y * c) * k];
  for (let i = 0; i < n; i += 2) {
    const [ax, ay] = P(cx + ((pts[i * 2] ?? 0) - cx) * 0.4, cy + ((pts[i * 2 + 1] ?? 0) - cy) * 0.4);
    const [bx, by] = P(pts[i * 2] ?? 0, pts[i * 2 + 1] ?? 0);
    s.stroke([ax, ay, bx, by], { color, glow: 0, width: 1, alpha: 0.3 });
  }
  // Craters: deterministic per body (seed), placed inside the 0.7 contour.
  // NOTE: five craters of mixed sizes at golden-angle spacing: three equal ones read as a face.
  const h = (j: number, salt: number): number => {
    const u = Math.sin(seed * 12.9898 + j * 78.233 + salt * 37.719) * 43758.5453;
    return u - Math.floor(u);
  };
  for (let j = 0; j < 5; j++) {
    const ang = h(j, 1) * 0.6 + j * 2.39996;
    const rr = rMean * (0.15 + 0.5 * h(j, 2));
    const [qx, qy] = P(cx * 0.4 + Math.cos(ang) * rr, cy * 0.4 + Math.sin(ang) * rr);
    const cr = rMean * k * (j === 0 ? 0.13 : 0.035 + 0.05 * h(j, 3));
    s.circle(qx, qy, Math.max(1.2, cr), { color, glow: 0, width: 1, alpha: 0.4 });
  }
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
  if (sc.kind === 'LAUNCH') drawLaunchStage(s, sc, elapsed, ox, oy, k);
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

  // A passing cloud: small markers on parallel paths, each at its own miss distance.
  if (sc.approach && sc.crowd.length > 0) {
    for (const c of sc.crowd) {
      const [px, py] = approachPos({ ...sc.approach, d: c.d, impact: false }, t + c.lag);
      if (c.hit && Math.hypot(px, py) < sc.approach.homeR) continue;
      s.dot(X(px), Y(py), 3, s.role(c.hit ? 'danger' : 'fragment'), 0.9);
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
      wireBody(s, pts.map((v) => v * sc.bodyR), X(bx), Y(by), k, rot, s.role('threat'), sc.body.length + sc.bodyR);
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

  // Push scenes: the speculative capabilities and the slow pushes, each with its own mechanism.
  if (sc.push && !reduceMotion) drawPushScene(s, sc, t, X, Y, k);

  // Launch vehicle.
  if (sc.launch && !reduceMotion) drawLaunchVehicle(s, sc, t, X, Y, k);

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
      // A ring of pixels rides each shock front.
      const rr = (r.r0 + (r.r1 - r.r0) * f) * k;
      // Finer front (owner 2026-10-18): more, smaller pixels, a few riding just behind the front.
      const np = Math.min(120, Math.max(16, Math.round(rr / 2)));
      const ringPx = Math.max(1, 2 * KNOBS.CINE_DEBRIS_PX_SCALE * k);
      for (let j = 0; j < np; j++) {
        const a = (j / np) * Math.PI * 2 + f;
        const lag = j % 3 === 0 ? 1 - 0.06 * hash01(j, 21, sc.seed) : 1;
        s.dot(Math.round(X(r.x) + Math.cos(a) * rr * lag), Math.round(Y(r.y) + Math.sin(a) * rr * lag), ringPx, s.role(r.role), (1 - f) * 0.85);
      }
      s.circle(X(r.x), Y(r.y), (r.r0 + (r.r1 - r.r0) * f) * k, { color: s.role(r.role), glow: 1.5 * (1 - f), alpha: 1 - f * 0.9, ...(r.dash ? { dash: r.dash } : {}), width: 1 + (1 - f) });
    }
    for (const sh of sc.shards) {
      if (t < sh.t0) continue;
      const dt = t - sh.t0;
      polyAt(s, sh.pts, X(sh.x + sh.vx * dt), Y(sh.y + sh.vy * dt), k, sh.rot0 + sh.spin * dt, { color: s.role(sh.role), glow: 0.8, width: sh.width });
    }
    for (let i = 0; i < sc.particles.length; i++) {
      const q = sc.particles[i];
      if (!q) continue;
      if (t < q.t0 || t > q.t0 + q.life) continue;
      const dt = t - q.t0;
      const a = 1 - dt / q.life;
      // Fine pixels (CINE_DEBRIS_PX_SCALE): sizes vary per particle; debris cycles the minigame's hardness
      // colours under NEON; a fresh particle is hot ejecta in false colour; a one-pixel tail marks its motion.
      const hi = hash01(i, sc.seed);
      const role = (q.role === 'threat' || q.role === 'fragment') && sc.kind !== 'LAUNCH' ? (DEBRIS_ROLES[Math.floor(hi * DEBRIS_ROLES.length)] ?? q.role) : q.role;
      const hot = KNOBS.CINE_FALSE_COLOUR && dt < KNOBS.CINE_HOT_EJECTA_S;
      const col = hot ? falseColor(s, 1 - dt / KNOBS.CINE_HOT_EJECTA_S) : s.role(role);
      const px = Math.round(X(q.x + q.vx * dt));
      const sy = q.y + q.vy * dt + 0.5 * q.ay * dt * dt;
      // Launch exhaust shed near the pad must not sink through the ground.
      if (sc.kind === 'LAUNCH' && sy > 0) continue;
      const py = Math.round(Y(sy));
      const size0 = Math.max(1, q.size * k * (1.2 + 1.8 * hi) * KNOBS.CINE_DEBRIS_PX_SCALE);
      // The launch trail stays on the launch art's fine grid: at most two cells.
      const size = sc.kind === 'LAUNCH' ? Math.min(size0, 2 * launchCell(k)) : size0;
      s.dot(px, py, size, col, a);
      const tdt = Math.max(0, dt - 0.03);
      const qx = Math.round(X(q.x + q.vx * tdt));
      const qy = Math.round(Y(q.y + q.vy * tdt + 0.5 * q.ay * tdt * tdt));
      if (qx !== px || qy !== py) s.dot(qx, qy, Math.max(1, size * 0.6), col, a * 0.45);
    }
  }

  // The hit flash: one bright frame that fades in a tenth of a second, the arcade "white-out".
  if (!reduceMotion && sc.hitAt > 0 && t >= sc.hitAt && t < sc.hitAt + 0.12) {
    s.ctx.fillStyle = withAlpha(s.spectrum ? '#FFFFFF' : p.hot, 0.35 * (1 - (t - sc.hitAt) / 0.12));
    s.ctx.fillRect(0, 0, s.width, s.height);
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

/** The mechanism of a push, drawn around the body at the origin (scene units, X/Y map to screen). */
function drawPushScene(s: Surface, sc: Scene, t: number, X: (x: number) => number, Y: (y: number) => number, k: number): void {
  const push = sc.push;
  if (!push) return;
  const R = sc.bodyR;
  const drift = t > sc.hitAt ? sc.bodyDrift.vx * (t - sc.hitAt) : 0;
  const onSurface = (i: number, n: number): [number, number] => {
    const a = (i / n) * Math.PI * 2;
    const j = Math.floor((a / (Math.PI * 2)) * (sc.body.length / 2)) * 2;
    const r = Math.hypot(sc.body[j] ?? 1, sc.body[j + 1] ?? 0) * R;
    return [Math.cos(a) * r + drift, Math.sin(a) * r];
  };
  const fire = (x: number, y: number, ang: number, len: number, seed: number): void => {
    const frame = Math.floor(t * 30);
    for (let i = 0; i < 10; i++) {
      const d = (i / 10) * len * (0.8 + 0.4 * hash01(i, frame, seed));
      s.dot(X(x + Math.cos(ang) * d), Y(y + Math.sin(ang) * d), Math.max(1.5, 2.5 * k * (1 - i / 12)), KNOBS.CINE_FALSE_COLOUR && i < 4 ? falseColor(s, 1 - i / 4) : fireColor(s, 1 - i / 10), 0.9 - i * 0.07);
    }
  };
  switch (push.method) {
    case 'NANOFORGE': {
      // Seeds fall onto the surface; from each landing point a lattice of replicators creeps inward over the
      // body (grid points inside the outline, revealed by distance from the nearest seed), then the forge
      // fires a regolith jet off the trailing side.
      const seeds: [number, number, number][] = [];
      for (let i = 0; i < push.n; i++) {
        const land = 0.2 + (i / push.n) * 0.8;
        const [sx, sy] = onSurface(i * 7, push.n * 7);
        if (t < land) {
          const u = t / land;
          s.dot(X(sx - 260 * (1 - u)), Y(sy - 180 * (1 - u)), 2.5 * k, s.role('craft'), 0.9);
        } else seeds.push([sx, sy, t - land]);
      }
      const step = Math.max(6, R / 9);
      const inside = (x: number, y: number): boolean => {
        // Ray-cast against the outline polygon (scene units).
        let c = false;
        const n = sc.body.length / 2;
        for (let i = 0, j = n - 1; i < n; j = i++) {
          const xi = (sc.body[i * 2] ?? 0) * R + drift, yi = (sc.body[i * 2 + 1] ?? 0) * R;
          const xj = (sc.body[j * 2] ?? 0) * R + drift, yj = (sc.body[j * 2 + 1] ?? 0) * R;
          if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
        }
        return c;
      };
      for (let gx = -R; gx <= R; gx += step) {
        for (let gy = -R; gy <= R; gy += step) {
          const x = gx + drift;
          if (!inside(x, gy)) continue;
          let reach = Infinity;
          for (const [sx, sy, age] of seeds) reach = Math.min(reach, Math.hypot(x - sx, gy - sy) - age * R * 0.45);
          if (reach < 0) s.dot(X(x), Y(gy), 2.2 * k, s.role('sail'), Math.min(0.9, -reach / step + 0.3));
        }
      }
      if (t > sc.hitAt) {
        const frame = Math.floor(t * 30);
        for (let i = 0; i < 70; i++) {
          const d = (((t - sc.hitAt) * 260 + i * 9) % 300);
          const spread = (hash01(i, frame, 4) - 0.5) * (4 + d * 0.18);
          s.dot(X(-R + drift - d), Y(spread), Math.max(1.5, 3 * k * (1 - d / 360)), d < 40 ? fireColor(s, 0.9) : s.role('fragment'), 1 - d / 320);
        }
      }
      break;
    }
    case 'THRUSTER_SWARM': {
      for (let i = 0; i < push.n; i++) {
        const arrive = 0.3 + (i / push.n) * 1.1;
        const [ex, ey] = onSurface(i, push.n);
        const u = Math.min(1, t / arrive);
        const x = ex + (1 - u) * (-300 + 40 * hash01(i, 5));
        const y = ey + (1 - u) * (-160 + 320 * hash01(i, 6));
        s.dot(X(x), Y(y), 3 * k, s.role('craft'), 1);
        // Units on the trailing side fire together once the swarm is down.
        if (t > sc.hitAt && ex < drift) fire(x - 3, y, Math.PI, 40, i);
      }
      break;
    }
    case 'FUSION_TUG': {
      const dock = Math.min(1, t / sc.hitAt);
      const cx = -R - 18 - (1 - dock) * 240 + drift;
      s.stroke([X(cx - 14), Y(-6), X(cx + 10), Y(-6), X(cx + 10), Y(6), X(cx - 14), Y(6)], { closed: true, color: s.role('craft'), glow: 1.2 });
      if (t > sc.hitAt) {
        const frame = Math.floor(t * 30);
        for (let i = 0; i < 40; i++) s.dot(X(cx - 16 - i * 7 * (0.9 + 0.2 * hash01(i, frame))), Y((hash01(i, frame, 2) - 0.5) * (2 + i * 0.6)), 2.4 * k, i < 6 ? '#FFFFFF' : s.role('orbit'), 1 - i / 44);
      }
      break;
    }
    case 'DE_STAR': {
      const on = t > sc.hitAt;
      if (on) {
        s.stroke([X(-700), Y(0), X(-R + drift), Y(0)], { color: s.role('nuclear'), glow: 2.5, width: 3, alpha: 0.9 });
        s.stroke([X(-700), Y(0), X(-R + drift), Y(0)], { color: '#FFFFFF', glow: 0, width: 1, alpha: 0.8 });
        // Vapour boils off the lit face, back toward the beam.
        for (let i = 0; i < 40; i++) {
          const a = Math.PI + (hash01(i, 9) - 0.5) * 1.6;
          const d = ((t * 60 + i * 13) % 80);
          s.dot(X(-R + drift + Math.cos(a) * d), Y(Math.sin(a) * d), 2 * k, s.role('fragment'), 1 - d / 80);
        }
      }
      break;
    }
    case 'GENERIC': {
      // A craft hovering beside the rock, holding station on canted plumes: the gravity tractor's posture.
      const hx = drift;
      const hy = -R - 40 + 4 * Math.sin(t * 2);
      s.stroke([X(hx - 10), Y(hy - 5), X(hx + 10), Y(hy - 5), X(hx + 10), Y(hy + 5), X(hx - 10), Y(hy + 5)], { closed: true, color: s.role('craft'), glow: 1.2 });
      s.stroke([X(hx - 26), Y(hy), X(hx + 26), Y(hy)], { color: s.role('program'), glow: 0.6 });
      // Plumes canted outward so they miss the rock below (the tractor must not blast what it pulls).
      fire(hx - 8, hy + 5, Math.PI / 2 + 0.75, 70, 1);
      fire(hx + 8, hy + 5, Math.PI / 2 - 0.75, 70, 2);
      s.stroke([X(hx), Y(hy + 8), X(hx), Y(-R * 0.6)], { color: s.role('sail'), dash: [2, 4], glow: 0.3, alpha: 0.7 });
      break;
    }
  }
}
