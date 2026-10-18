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
import { drawSprite, fireColor, hash01, pixelPalette, ROCKETS, SPENT_STAGE, towerSprite } from './pixel';
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
    const pal = pixelPalette(s);
    const cell = Math.max(2, Math.round(3 * k));
    // Pixel stars, twinkling.
    for (let i = 0; i < 90; i++) {
      const sx = hash01(i, 1, sc.seed) * s.width;
      const sy = hash01(i, 2, sc.seed) * s.height * 0.7;
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(elapsed * (1 + hash01(i, 3)) * 2 + i));
      s.dot(sx, sy, hash01(i, 4) > 0.9 ? 2 : 1, pal.w ?? p.ink, tw * 0.8);
    }
    // HOME's limb as a vector arc with a pixel atmosphere band, and blocky terrain under the pad.
    const limbR = 900 * k;
    s.circle(ox, oy + limbR, limbR, { color: s.role('planet'), glow: 1, width: 1.5 });
    for (let i = 1; i <= 3; i++) s.circle(ox, oy + limbR, limbR + i * 9 * k, { color: s.spectrum ? s.role('orbit') : p.dim, glow: 0, alpha: 0.35 - i * 0.08 });
    for (let gx = -40; gx <= 40; gx++) {
      const hgt = 1 + Math.floor(hash01(gx + 99, 7, sc.seed) * 3);
      for (let gy = 0; gy < hgt; gy++) s.dot(ox + gx * cell * 2, oy + 2 + gy * cell, cell, pal.G ?? p.ink, 0.35 + 0.15 * gy);
    }
    drawSprite(s, towerSprite(14), X(-12), Y(-21), cell, 0, 0.9);
    s.stroke([X(-14), Y(0), X(14), Y(0)], { color: p.ink, glow: 0.4, width: 2 });
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

  // Push scenes: the speculative capabilities and the slow pushes, each with its own mechanism.
  if (sc.push && !reduceMotion) drawPushScene(s, sc, t, X, Y, k);

  // Launch vehicle.
  if (sc.launch && !reduceMotion) {
    const u = launchProgress(t, sc.duration);
    const [x, y, tx, ty] = launchArc(u, sc.launch.tier);
    const tier = sc.launch.tier;
    const sprite = ROCKETS[tier] ?? ROCKETS[1] ?? [];
    const cell = Math.max(2, Math.round((2 + 0.5 * tier) * k));
    const heading = Math.atan2(tx, -ty);
    const spriteH = sprite.length * cell;
    // Pad smoke: grey pixel puffs billowing out for the first second and a half.
    if (t < 2) {
      for (let i = 0; i < 60; i++) {
        const a = (hash01(i, 11, sc.seed) - 0.5) * Math.PI;
        const sp = 20 + 60 * hash01(i, 12, sc.seed);
        const r = sp * Math.min(t, 1.5);
        const px = X(Math.sin(a) * r * 1.6);
        const py = Y(-2 - Math.abs(Math.cos(a)) * r * 0.3);
        s.dot(px, py, cell * (1 + Math.floor(hash01(i, 13) * 3)), fireColor(s, 0.1), Math.max(0, 0.8 - t * 0.4));
      }
    }
    // Plume: chunky fire pixels streaming back from the engines, hottest at the nozzle, flickering per frame.
    const fx = X(x) - Math.sin(heading) * (spriteH / 2);
    const fy = Y(y) + Math.cos(heading) * (spriteH / 2);
    const frame = Math.floor(t * 30);
    const n = 26 + 10 * tier;
    for (let i = 0; i < n; i++) {
      const d = (i / n) * (30 + 14 * tier) * k * (0.8 + 0.4 * hash01(i, frame));
      const spread = (hash01(i, frame, 3) - 0.5) * (2 + d * 0.35);
      const px = fx - Math.sin(heading) * d + Math.cos(heading) * spread;
      const py = fy + Math.cos(heading) * d + Math.sin(heading) * spread;
      s.dot(px, py, cell * (i < n * 0.3 ? 1.4 : 1), fireColor(s, 1 - i / n), 0.95 - (0.6 * i) / n);
    }
    drawSprite(s, sprite, X(x), Y(y), cell, heading);
    // Spent stages fall away and tumble after each separation.
    for (const su of sc.launch.stages) {
      const ts = Math.pow(su, 1 / 1.5) * sc.duration * 0.92;
      if (t < ts) continue;
      const dt = t - ts;
      const [sx0, sy0, stx, sty] = launchArc(su, tier);
      drawSprite(s, SPENT_STAGE, X(sx0 + stx * 20 * dt), Y(sy0 + sty * 20 * dt + 45 * dt * dt), cell, Math.atan2(stx, -sty) + dt * 3, Math.max(0, 1 - dt / 1.6));
    }
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
      // A ring of pixels rides each shock front.
      const rr = (r.r0 + (r.r1 - r.r0) * f) * k;
      const np = Math.min(64, Math.max(12, Math.round(rr / 3)));
      for (let j = 0; j < np; j++) {
        const a = (j / np) * Math.PI * 2 + f;
        s.dot(X(r.x) + Math.cos(a) * rr, Y(r.y) + Math.sin(a) * rr, 2, s.role(r.role), (1 - f) * 0.8);
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
      // Chunky pixels: sizes vary per particle; debris cycles the minigame's hardness colours under NEON.
      const hi = hash01(i, sc.seed);
      const role = (q.role === 'threat' || q.role === 'fragment') && sc.kind !== 'LAUNCH' ? (DEBRIS_ROLES[Math.floor(hi * DEBRIS_ROLES.length)] ?? q.role) : q.role;
      const px = Math.round(X(q.x + q.vx * dt));
      const py = Math.round(Y(q.y + q.vy * dt + 0.5 * q.ay * dt * dt));
      s.dot(px, py, Math.max(1.5, q.size * k * (1.2 + 1.8 * hi)), s.role(role), a);
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
      s.dot(X(x + Math.cos(ang) * d), Y(y + Math.sin(ang) * d), Math.max(1.5, 2.5 * k * (1 - i / 12)), fireColor(s, 1 - i / 10), 0.9 - i * 0.07);
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
