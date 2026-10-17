// WHAT: SYSTEM VIEW: star, dim orbits, planets, the threat with its predicted path and impact ghost, the
//       THREAT BRIEF, the clock and warp ladder, RESOLVE NOW and the RUN OVER panel.
// WHY:  GAME_PLAN 13.2 and milestone M1 ("a threat, and losing"). This is the main screen; the planner,
//       missions and scoring layer onto it in M2.
// HOW:  Camera: centre offset (pan) and zoom (wheel). Two radial scales: LINEAR, and COMPRESSED where the
//       drawn radius is proportional to sqrt(r) so GIANT fits while the inner system stays readable.
//       Orbits and the threat path are sampled in world space and projected point by point. The round
//       result comes from sim/resolver.ts at round start (no missions yet) and is replayed by the clock:
//       when t reaches the close-approach time the round is over. Keys: Space pause, [ ] warp, R resolve
//       now, S scale, Z reset camera, Esc title.
// LORE: G2 (screens and HUD), O6 (Kepler), O12 (close approach), T2 (size ladder)

import type { Router, Screen } from '../../game/screen';
import { DAY, YEAR } from '../../physics/constants';
import { orbitPoints, propagate } from '../../physics/kepler';
import { resolveRound, type RoundResult } from '../../sim/resolver';
import { roundRng } from '../../sim/rng';
import { generateThreat } from '../../sim/roundGen';
import { advance, createWorld, planetById, planetState, setWarp, warpLabel, type World } from '../../sim/world';
import { formatCountdown, formatElapsed } from '../../ui/hud';
import type { Input } from '../../ui/input';
import { withAlpha } from '../palettes';
import type { Surface } from '../canvas';
import { drawText } from '../vectorFont';

export type ScaleMode = 'LINEAR' | 'COMPRESSED';
type Phase = 'planning' | 'over';

export class SystemScreen implements Screen {
  world: World;
  result: RoundResult | null = null;
  phase: Phase = 'planning';
  scale: ScaleMode = 'COMPRESSED';
  private zoom = 1;
  private panX = 0;
  private panY = 0;
  private readonly orbitCache = new Map<string, Float64Array>();
  private pathCache: Float64Array | null = null;
  private ghost: { x: number; y: number } | null = null;

  constructor(private readonly s: Surface, private readonly keys: Input, private readonly router: Router) {
    this.world = createWorld('DEV', 1);
  }

  enter(): void {
    this.newRun();
  }
  exit(): void {}

  private newRun(): void {
    const seed = Date.now().toString(36).toUpperCase();
    const round = 1;
    this.world = createWorld(seed, round);
    this.world.threat = generateThreat(roundRng(seed, round), this.world, round);
    this.result = resolveRound(this.world);
    this.phase = 'planning';
    this.orbitCache.clear();
    this.pathCache = null;
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    const home = planetById(this.world, 'HOME');
    const hs = planetState(this.world, home, this.world.threat.tImpact);
    this.ghost = { x: hs.r.x, y: hs.r.y };
  }

  update(dtMs: number): void {
    const k = this.keys;
    const w = this.world;
    if (k.pressed('Escape')) {
      this.router.go('title');
      return;
    }
    if (this.phase === 'over') {
      if (k.pressed('Space') || k.pressed('Enter')) this.newRun();
      return;
    }
    if (k.pressed('Space')) setWarp(w, w.warp === 0 ? 1 : 0);
    if (k.pressed('BracketRight')) setWarp(w, w.warp + 1);
    if (k.pressed('BracketLeft')) setWarp(w, w.warp - 1);
    if (k.pressed('KeyS')) this.scale = this.scale === 'LINEAR' ? 'COMPRESSED' : 'LINEAR';
    if (k.pressed('KeyZ')) {
      this.zoom = 1;
      this.panX = 0;
      this.panY = 0;
    }
    const wheel = k.takeWheel();
    if (wheel !== 0) this.zoom = Math.max(0.2, Math.min(40, this.zoom * Math.exp(-wheel * 0.0015)));
    const drag = k.takeDrag();
    this.panX += drag.x;
    this.panY += drag.y;

    if (k.pressed('KeyR') && this.result) {
      w.t = this.result.ca.tCa;
      this.phase = 'over';
      setWarp(w, 0);
      return;
    }
    advance(w, Math.min(dtMs, 100) / 1000);
    if (this.result && w.t >= this.result.ca.tCa) {
      w.t = this.result.ca.tCa;
      this.phase = 'over';
      setWarp(w, 0);
    }
  }

  /** World metres -> screen px. COMPRESSED maps radius r to sqrt(r / AU) AU-equivalents. */
  private project(x: number, y: number): [number, number] {
    const s = this.s;
    const AU = 1.495978707e11;
    const base = (Math.min(s.width, s.height) / 2) * 0.9 * this.zoom;
    const r = Math.hypot(x, y);
    const rs = this.scale === 'COMPRESSED' ? (Math.sqrt(r / AU) / 2.5) * base : (r / AU / 5.6) * base;
    const f = r > 0 ? rs / r : 0;
    return [s.width / 2 + this.panX + x * f, s.height / 2 + this.panY - y * f];
  }

  render(): void {
    const s = this.s;
    const p = s.palette;
    const w = this.world;
    s.clear();

    const [sx, sy] = this.project(0, 0);
    const sr = 7;
    s.circle(sx, sy, sr, { color: p.hot, glow: 2 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      s.stroke([sx + Math.cos(a) * (sr + 3), sy + Math.sin(a) * (sr + 3), sx + Math.cos(a) * (sr + 8), sy + Math.sin(a) * (sr + 8)], { color: p.hot, glow: 1 });
    }

    const buf: number[] = [];
    for (const pl of w.planets) {
      let pts = this.orbitCache.get(pl.id);
      if (!pts) {
        pts = orbitPoints(pl.elements, 256);
        this.orbitCache.set(pl.id, pts);
      }
      buf.length = 0;
      for (let i = 0; i < pts.length; i += 2) {
        const [px, py] = this.project(pts[i] as number, pts[i + 1] as number);
        buf.push(px, py);
      }
      s.stroke(buf, { closed: true, color: p.dim, glow: 0, width: 1 });

      const st = planetState(w, pl);
      const [px, py] = this.project(st.r.x, st.r.y);
      const pr = pl.id === 'GIANT' ? 7 : pl.id === 'HOME' ? 5 : 4;
      s.circle(px, py, pr, { glow: pl.id === 'HOME' ? 1.6 : 1, color: pl.id === 'HOME' ? p.hot : p.ink });
      for (let i = 0; i < pl.detailLines; i++) {
        const yy = py - pr * 0.5 + (i / Math.max(1, pl.detailLines - 1)) * pr * (pl.detailLines > 1 ? 1 : 0);
        const half = Math.sqrt(Math.max(0, pr * pr - (yy - py) * (yy - py))) * 0.8;
        s.stroke([px - half, yy, px + half, yy], { glow: 0.5, width: 1 });
      }
      drawText(s, pl.name, px + pr + 5, py - 5, 10, { color: p.dim, glow: 0 });
    }

    this.drawThreat();
    this.drawHud();
    if (this.phase === 'over') this.drawOver();
  }

  private drawThreat(): void {
    const s = this.s;
    const p = s.palette;
    const w = this.world;
    const th = w.threat;
    if (!th) return;

    // Predicted path: the threat coasts, so its path is its orbit (a dashed loop), sampled once per round.
    // NOTE: a time-sampled polyline over ten years of revolutions aliases into a tangle; the ellipse is honest.
    if (!this.pathCache) this.pathCache = orbitPoints(th.elements, 360);
    const buf: number[] = [];
    for (let i = 0; i < this.pathCache.length; i += 2) {
      const [px, py] = this.project(this.pathCache[i] as number, this.pathCache[i + 1] as number);
      buf.push(px, py);
    }
    s.stroke(buf, { closed: true, color: p.ink, glow: 0, width: 1, alpha: 0.55, dash: [3, 6] });

    // Ghost at the impact point: a crosshair on HOME's position at t_i.
    if (this.ghost) {
      const [gx, gy] = this.project(this.ghost.x, this.ghost.y);
      s.circle(gx, gy, 9, { color: p.hot, glow: 0.8, width: 1, dash: [2, 3] });
      s.stroke([gx - 14, gy, gx - 5, gy], { color: p.hot, glow: 0.6 });
      s.stroke([gx + 5, gy, gx + 14, gy], { color: p.hot, glow: 0.6 });
      s.stroke([gx, gy - 14, gx, gy - 5], { color: p.hot, glow: 0.6 });
      s.stroke([gx, gy + 5, gx, gy + 14], { color: p.hot, glow: 0.6 });
    }

    // The threat itself: a seeded polygon, drawn at a readable size regardless of true scale.
    const st = propagate(th.elements, w.star.mu, w.t);
    const [tx, ty] = this.project(st.r.x, st.r.y);
    const n = th.shape.length;
    const size = 6;
    buf.length = 0;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + w.t * 1e-7;
      const rr = size * (th.shape[i] as number);
      buf.push(tx + rr * Math.cos(a), ty + rr * Math.sin(a));
    }
    s.stroke(buf, { closed: true, color: p.hot, glow: 1.5, width: 1.25 });
    drawText(s, th.name, tx + 10, ty - 14, 10, { color: p.hot, glow: 0.5 });
  }

  private drawHud(): void {
    const s = this.s;
    const p = s.palette;
    const w = this.world;
    const m = 16;
    const th = w.threat;
    const res = this.result;

    if (th) drawText(s, formatCountdown(th.tImpact - w.t), m, m, 14, { color: p.hot, glow: 1.2 });
    else drawText(s, formatElapsed(w.t), m, m, 14);
    drawText(s, `WARP ${warpLabel(w)}`, m, m + 24, 14, { color: w.warp === 0 ? p.hot : p.ink, glow: w.warp === 0 ? 1.5 : 1 });
    drawText(s, `ROUND ${w.round}   SEED ${w.runSeed}   SCALE ${this.scale}   MISS 4.1 R`, s.width - m, s.height - m - 30, 11, { align: 'right', color: p.dim, glow: 0 });

    if (th && res) {
      const kms = (res.ca.vInf / 1000).toFixed(1);
      const lead = (th.tImpact / YEAR).toFixed(1);
      const mt = res.energy.energyMt.toFixed(res.energy.energyMt < 10 ? 1 : 0);
      drawText(s, `THREAT BRIEF  ${th.name}  ${th.type.label}  D ${th.D.toFixed(0)} M  E ${mt} MT  ${res.category}`, s.width / 2, m, 12, { align: 'center' });
      drawText(s, `V-INF ${kms} KM/S   LEAD ${lead} Y   P(IMPACT) 1.00   MARGIN ${res.ca.marginRadii.toFixed(2)} R   M ${th.mass.toExponential(2).toUpperCase()} KG`, s.width / 2, m + 18, 12, { align: 'center', color: p.dim, glow: 0 });
    }
    drawText(s, '<SPACE> PAUSE   [ ] WARP   R RESOLVE NOW   S SCALE   WHEEL ZOOM   DRAG PAN   Z RESET   ESC TITLE', s.width / 2, s.height - m - 12, 11, { align: 'center', color: p.dim, glow: 0 });
    drawText(s, 'PLANNER: MISSIONS ARRIVE IN M2 (BUILDING)', m, s.height - m - 30, 11, { color: p.dim, glow: 0 });
  }

  private drawOver(): void {
    const s = this.s;
    const p = s.palette;
    const th = this.world.threat;
    const res = this.result;
    if (!th || !res) return;
    const w = Math.min(700, s.width - 32);
    const h = 250;
    const x = (s.width - w) / 2;
    const y = (s.height - h) / 2;
    s.ctx.fillStyle = withAlpha(p.bg, 0.78);
    s.ctx.fillRect(0, 0, s.width, s.height);
    s.stroke([x, y, x + w, y, x + w, y + h, x, y + h], { closed: true, glow: 1.2 });
    const cx = s.width / 2;
    drawText(s, res.outcome === 'HIT' ? 'IMPACT' : 'MISS', cx, y + 26, 34, { align: 'center', color: p.hot, glow: 2 });
    drawText(s, `${th.name}  ${th.type.label}  D ${th.D.toFixed(0)} M`, cx, y + 80, 14, { align: 'center' });
    drawText(s, `${res.energy.energyMt.toFixed(res.energy.energyMt < 10 ? 1 : 0)} MT   ${res.category}   V-IMPACT ${(res.ca.vImpact / 1000).toFixed(1)} KM/S`, cx, y + 106, 14, { align: 'center' });
    drawText(s, `CLOSEST APPROACH ${(res.ca.dMin / 1000).toFixed(0)} KM   B-CRIT ${(res.ca.bCrit / 1000).toFixed(0)} KM   T ${(res.ca.tCa / DAY).toFixed(1)} D`, cx, y + 132, 12, { align: 'center', color: p.dim, glow: 0 });
    drawText(s, 'RUN OVER. NO MISSIONS COULD BE FLOWN YET: THE PLANNER ARRIVES IN M2.', cx, y + 166, 11, { align: 'center', color: p.dim, glow: 0 });
    drawText(s, '<SPACE> NEW RUN     <ESC> TITLE', cx, y + 206, 14, { align: 'center', color: p.hot, glow: 1.5 });
  }
}
