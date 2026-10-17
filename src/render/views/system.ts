// WHAT: SYSTEM VIEW (GAME_PLAN 13.2): the main screen. Star, orbits, planets, the threat and its orbit,
//       spacecraft in flight, the THREAT BRIEF, clock and warp, the planner overlay, the play-by-play log,
//       DEBRIEF after a miss and RUN OVER after a hit. Owns the run loop of Section 3 from M2 on.
// WHY:  Everything the player does happens here or in the planner overlay it opens.
// HOW:  A round is: createWorld + generateThreat, then resolveRound(world, missions) whenever missions
//       change. The clock replays the result: craft fly their Lambert arcs (elements from the departure
//       state), the threat follows its element segments, log lines appear as their time passes, and the
//       close-approach time ends the round. Keys: Space pause, [ ] warp, P planner (pauses), R resolve
//       now, S scale, Z reset camera, Esc title.
// LORE: G1 (how to play), G2 (screens and HUD), O12 (close approach), G5 (scoring)

import { KNOBS } from '../../config/knobs';
import { budgetAt, spend } from '../../game/economy';
import { recordRun } from '../../game/leaderboard';
import { createRun, nextRound, type RunState } from '../../game/run';
import { scoreRound, type ScoreBreakdown } from '../../game/scoring';
import type { Router, Screen } from '../../game/screen';
import { AU, DAY, YEAR } from '../../physics/constants';
import { stateToElements } from '../../physics/elements';
import { orbitPoints, propagate, type Elements } from '../../physics/kepler';
import { PlannerClient } from '../../planner/workerClient';
import { formatEvent } from '../../sim/eventLog';
import type { Mission } from '../../sim/mission';
import { elementsAt, resolveRound, type RoundResult } from '../../sim/resolver';
import { roundRng } from '../../sim/rng';
import { generateThreat } from '../../sim/roundGen';
import { advance, createWorld, planetById, planetState, setWarp, warpLabel, type World } from '../../sim/world';
import { formatCountdown } from '../../ui/hud';
import type { Input } from '../../ui/input';
import type { Surface } from '../canvas';
import { withAlpha } from '../palettes';
import { drawText } from '../vectorFont';
import { PlannerOverlay } from './planner';

export type ScaleMode = 'LINEAR' | 'COMPRESSED';
type Phase = 'planning' | 'debrief' | 'over';

export class SystemScreen implements Screen {
  world: World;
  run: RunState;
  missions: Mission[] = [];
  result: RoundResult | null = null;
  phase: Phase = 'planning';
  scale: ScaleMode = 'COMPRESSED';
  private score: ScoreBreakdown | null = null;
  private rank = -1;
  private zoom = 1;
  private panX = 0;
  private panY = 0;
  private readonly orbitCache = new Map<string, Float64Array>();
  private threatOrbitCache: { el: Elements; pts: Float64Array } | null = null;
  private readonly craftCache = new Map<string, Elements>();
  private ghost: { x: number; y: number } | null = null;
  private readonly planner: PlannerOverlay;

  constructor(private readonly s: Surface, private readonly keys: Input, private readonly router: Router) {
    this.world = createWorld('DEV', 1);
    this.run = createRun('DEV');
    this.planner = new PlannerOverlay(s, keys, new PlannerClient());
  }

  enter(): void {
    this.newRun();
  }
  exit(): void {
    this.planner.hide();
  }

  private newRun(): void {
    this.run = createRun(Date.now().toString(36).toUpperCase());
    this.startRound();
  }

  private startRound(): void {
    const { seed, round } = this.run;
    this.world = createWorld(seed, round);
    this.world.threat = generateThreat(roundRng(seed, round), this.world, round);
    this.missions = [];
    this.result = resolveRound(this.world, this.missions);
    this.phase = 'planning';
    this.score = null;
    this.rank = -1;
    this.orbitCache.clear();
    this.threatOrbitCache = null;
    this.craftCache.clear();
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    const home = planetById(this.world, 'HOME');
    const hs = planetState(this.world, home, this.world.threat.tImpact);
    this.ghost = { x: hs.r.x, y: hs.r.y };
  }

  private plannerSession() {
    return {
      world: this.world,
      missions: this.missions,
      launcherTier: this.run.launcherTier,
      impactorTier: this.run.impactorTier,
      budget: budgetAt(this.run.economy, this.world.t),
      onCommit: (m: Mission): boolean => {
        if (!spend(this.run.economy, this.world.t, m.cost)) return false;
        this.missions.push(m);
        this.result = resolveRound(this.world, this.missions);
        this.planner.refresh(this.plannerSession());
        return true;
      },
    };
  }

  private finishRound(): void {
    const res = this.result;
    const th = this.world.threat;
    if (!res || !th) return;
    this.world.t = res.ca.tCa;
    setWarp(this.world, 0);
    const available = this.run.economy.start + (this.run.economy.perYear * this.world.t) / YEAR;
    this.score = scoreRound({
      round: this.run.round,
      energyMt: res.energy.energyMt,
      outcome: res.outcome,
      marginRadii: res.ca.marginRadii,
      budgetUnspent: budgetAt(this.run.economy, this.world.t),
      budgetAvailable: available,
      marginSeconds: th.tImpact - (res.tLastAction || 0),
      leadSeconds: th.tImpact,
      usedWarhead: false,
      producedFragments: false,
      netCapture: false,
    });
    if (res.outcome === 'MISS') {
      this.run.score += this.score.roundScore;
      this.run.research += this.score.research;
      this.phase = 'debrief';
    } else {
      this.phase = 'over';
      this.rank = recordRun({ handle: 'PLAYER', rounds: this.run.roundsSurvived, score: this.run.score, seed: this.run.seed, date: this.run.startedAt, tech: `L${this.run.launcherTier} I${this.run.impactorTier}`, assisted: this.run.assisted });
    }
  }

  update(dtMs: number): void {
    const k = this.keys;
    const w = this.world;
    if (this.planner.isOpen) {
      this.planner.update();
      return;
    }
    if (k.pressed('Escape')) {
      this.router.go('title');
      return;
    }
    if (this.phase === 'debrief') {
      if (k.pressed('Space') || k.pressed('Enter')) {
        nextRound(this.run, budgetAt(this.run.economy, w.t));
        this.startRound();
      }
      return;
    }
    if (this.phase === 'over') {
      if (k.pressed('Space') || k.pressed('Enter')) this.newRun();
      return;
    }
    if (k.pressed('KeyP')) {
      setWarp(w, 0);
      this.planner.show(this.plannerSession());
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
      this.finishRound();
      return;
    }
    advance(w, Math.min(dtMs, 100) / 1000);
    if (this.result && w.t >= this.result.ca.tCa) this.finishRound();
  }

  private project(x: number, y: number): [number, number] {
    const s = this.s;
    const base = (Math.min(s.width, s.height) / 2) * 0.9 * this.zoom;
    const r = Math.hypot(x, y);
    const rs = this.scale === 'COMPRESSED' ? (Math.sqrt(r / AU) / 2.5) * base : (r / AU / 5.6) * base;
    const f = r > 0 ? rs / r : 0;
    return [s.width / 2 + this.panX + x * f, s.height / 2 + this.panY - y * f];
  }

  private polyline(pts: Float64Array, style: Parameters<Surface['stroke']>[1]): void {
    const buf: number[] = [];
    for (let i = 0; i < pts.length; i += 2) {
      const [px, py] = this.project(pts[i] as number, pts[i + 1] as number);
      buf.push(px, py);
    }
    this.s.stroke(buf, style);
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

    for (const pl of w.planets) {
      let pts = this.orbitCache.get(pl.id);
      if (!pts) {
        pts = orbitPoints(pl.elements, 256);
        this.orbitCache.set(pl.id, pts);
      }
      this.polyline(pts, { closed: true, color: p.dim, glow: 0, width: 1 });
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

    this.drawCraft();
    this.drawThreat();
    if (!this.planner.isOpen) this.drawHud();
    if (this.phase === 'debrief') this.drawDebrief();
    if (this.phase === 'over') this.drawOver();
    this.planner.render();
  }

  /** Spacecraft on their Lambert arcs: a faint planned arc, a triangle and a short trail while in flight. */
  private drawCraft(): void {
    const s = this.s;
    const p = s.palette;
    const w = this.world;
    const home = planetById(w, 'HOME');
    for (const m of this.missions) {
      let el = this.craftCache.get(m.id);
      if (!el) {
        const hs = planetState(w, home, m.launchTime);
        try {
          el = stateToElements(hs.r, m.departureV, w.star.mu, m.launchTime);
        } catch {
          continue;
        }
        this.craftCache.set(m.id, el);
      }
      // Planned arc.
      const n = 48;
      const arc = new Float64Array(n * 2);
      for (let i = 0; i < n; i++) {
        const t = m.launchTime + ((m.arrivalTime - m.launchTime) * i) / (n - 1);
        const st = propagate(el, w.star.mu, t);
        arc[i * 2] = st.r.x;
        arc[i * 2 + 1] = st.r.y;
      }
      this.polyline(arc, { color: p.ink, glow: 0, width: 1, alpha: 0.35, dash: [2, 5] });
      if (w.t < m.launchTime || w.t >= m.arrivalTime) continue;
      const st = propagate(el, w.star.mu, w.t);
      const [cx, cy] = this.project(st.r.x, st.r.y);
      const ang = Math.atan2(-st.v.y, st.v.x);
      const r = 5;
      s.stroke([cx + Math.cos(ang) * r * 1.6, cy + Math.sin(ang) * r * 1.6, cx + Math.cos(ang + 2.5) * r, cy + Math.sin(ang + 2.5) * r, cx + Math.cos(ang - 2.5) * r, cy + Math.sin(ang - 2.5) * r], { closed: true, color: p.hot, glow: 1.2 });
      const trail = new Float64Array(10 * 2);
      for (let i = 0; i < 10; i++) {
        const t = Math.max(m.launchTime, w.t - (i * 20 * DAY));
        const ts = propagate(el, w.star.mu, t);
        trail[i * 2] = ts.r.x;
        trail[i * 2 + 1] = ts.r.y;
      }
      this.polyline(trail, { color: p.ink, glow: 0.4, width: 1, alpha: 0.7 });
      drawText(s, m.id, cx + 8, cy - 12, 9, { color: p.dim, glow: 0 });
    }
  }

  private drawThreat(): void {
    const s = this.s;
    const p = s.palette;
    const w = this.world;
    const th = w.threat;
    if (!th) return;
    const el = this.result ? elementsAt(this.result.segments, w.t) : th.elements;
    if (!this.threatOrbitCache || this.threatOrbitCache.el !== el) this.threatOrbitCache = { el, pts: orbitPoints(el, 360) };
    this.polyline(this.threatOrbitCache.pts, { closed: true, color: p.ink, glow: 0, width: 1, alpha: 0.55, dash: [3, 6] });

    if (this.ghost) {
      const [gx, gy] = this.project(this.ghost.x, this.ghost.y);
      s.circle(gx, gy, 9, { color: p.hot, glow: 0.8, width: 1, dash: [2, 3] });
      for (const [dx, dy] of [[-14, 0], [5, 0], [0, -14], [0, 5]] as const) {
        s.stroke([gx + dx, gy + dy, gx + dx + (dx === 0 ? 0 : 9), gy + dy + (dy === 0 ? 0 : 9)], { color: p.hot, glow: 0.6 });
      }
    }

    const st = propagate(el, w.star.mu, w.t);
    const [tx, ty] = this.project(st.r.x, st.r.y);
    const n = th.shape.length;
    const size = 6;
    const buf: number[] = [];
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
    if (!th || !res) return;

    drawText(s, formatCountdown(th.tImpact - w.t), m, m, 14, { color: p.hot, glow: 1.2 });
    drawText(s, `WARP ${warpLabel(w)}`, m, m + 24, 14, { color: w.warp === 0 ? p.hot : p.ink, glow: w.warp === 0 ? 1.5 : 1 });
    drawText(s, `BUDGET ${budgetAt(this.run.economy, w.t).toFixed(1)}  (+${this.run.economy.perYear}/Y)`, m, m + 48, 12);
    drawText(s, `SCORE ${this.run.score}   RESEARCH ${this.run.research}   MISSIONS ${this.missions.length}`, m, m + 68, 12, { color: p.dim, glow: 0 });

    const kms = (res.ca.vInf / 1000).toFixed(1);
    const mt = res.energy.energyMt.toFixed(res.energy.energyMt < 10 ? 1 : 0);
    drawText(s, `THREAT BRIEF  ${th.name}  ${th.type.label}  D ${th.D.toFixed(0)} M  E ${mt} MT  ${res.category}`, s.width / 2, m, 12, { align: 'center' });
    const margin = res.ca.marginRadii;
    const pred = res.outcome === 'HIT' ? `PREDICTED IMPACT  MARGIN ${margin.toFixed(2)} R` : `PREDICTED MISS  MARGIN +${margin.toFixed(2)} R`;
    drawText(s, `V-INF ${kms} KM/S   LEAD ${(th.tImpact / YEAR).toFixed(1)} Y   ${pred}   P(IMPACT) ${res.outcome === 'HIT' ? '1.00' : '0.00'}`, s.width / 2, m + 18, 12, { align: 'center', color: res.outcome === 'HIT' ? p.hot : p.dim, glow: res.outcome === 'HIT' ? 0.8 : 0 });

    // Play-by-play: the last six events whose time has passed.
    const passed = res.events.filter((e) => e.t <= w.t).slice(-6);
    let ly = s.height - m - 50 - passed.length * 15;
    for (const e of passed) {
      drawText(s, formatEvent(e, th.tImpact), m, ly, 10, { color: p.dim, glow: 0 });
      ly += 15;
    }
    drawText(s, `ROUND ${w.round}   SEED ${w.runSeed}   SCALE ${this.scale}   MISS 4.1 R`, s.width - m, s.height - m - 30, 11, { align: 'right', color: p.dim, glow: 0 });
    drawText(s, '<P> PLANNER   <SPACE> PAUSE   [ ] WARP   R RESOLVE NOW   S SCALE   WHEEL ZOOM   DRAG PAN   Z RESET   ESC TITLE', s.width / 2, s.height - m - 12, 11, { align: 'center', color: p.dim, glow: 0 });
  }

  private panel(w: number, h: number): { x: number; y: number } {
    const s = this.s;
    const x = (s.width - w) / 2;
    const y = (s.height - h) / 2;
    s.ctx.fillStyle = withAlpha(s.palette.bg, 0.8);
    s.ctx.fillRect(0, 0, s.width, s.height);
    s.stroke([x, y, x + w, y, x + w, y + h, x, y + h], { closed: true, glow: 1.2 });
    return { x, y };
  }

  private drawDebrief(): void {
    const s = this.s;
    const p = s.palette;
    const th = this.world.threat;
    const res = this.result;
    const sc = this.score;
    if (!th || !res || !sc) return;
    const events = res.events.slice(-8);
    const { x, y } = this.panel(Math.min(760, s.width - 32), 150 + events.length * 15 + 80);
    const cx = s.width / 2;
    drawText(s, `MISS BY ${res.ca.marginRadii.toFixed(2)} R`, cx, y + 22, 30, { align: 'center', color: p.hot, glow: 2 });
    drawText(s, `${th.name}  ${th.type.label}  D ${th.D.toFixed(0)} M   CLOSEST APPROACH ${(res.ca.dMin / 1000).toFixed(0)} KM   B-CRIT ${(res.ca.bCrit / 1000).toFixed(0)} KM`, cx, y + 64, 12, { align: 'center' });
    let ly = y + 92;
    for (const e of events) {
      drawText(s, formatEvent(e, th.tImpact), x + 20, ly, 10, { color: p.dim, glow: 0 });
      ly += 15;
    }
    ly += 8;
    drawText(s, `BASE ${sc.base.toFixed(0)}  X OUTCOME ${sc.outcome.toFixed(2)}  X (1 + EFF ${sc.efficiency.toFixed(2)} + TIMING ${sc.timing.toFixed(2)} + STYLE ${sc.style.toFixed(2)})  =  ${sc.roundScore}   RESEARCH +${sc.research}`, cx, ly, 11, { align: 'center' });
    drawText(s, `RUN SCORE ${this.run.score}   ROUNDS SURVIVED ${this.run.roundsSurvived + 1}`, cx, ly + 20, 12, { align: 'center', color: p.hot, glow: 1 });
    drawText(s, '<SPACE> NEXT ROUND     <ESC> TITLE', cx, ly + 46, 14, { align: 'center', color: p.hot, glow: 1.5 });
  }

  private drawOver(): void {
    const s = this.s;
    const p = s.palette;
    const th = this.world.threat;
    const res = this.result;
    if (!th || !res) return;
    const { y } = this.panel(Math.min(700, s.width - 32), 260);
    const cx = s.width / 2;
    drawText(s, 'IMPACT', cx, y + 26, 34, { align: 'center', color: p.hot, glow: 2 });
    drawText(s, `${th.name}  ${th.type.label}  D ${th.D.toFixed(0)} M`, cx, y + 80, 14, { align: 'center' });
    drawText(s, `${res.energy.energyMt.toFixed(res.energy.energyMt < 10 ? 1 : 0)} MT   ${res.category}   V-IMPACT ${(res.ca.vImpact / 1000).toFixed(1)} KM/S`, cx, y + 106, 14, { align: 'center' });
    drawText(s, `CLOSEST APPROACH ${(res.ca.dMin / 1000).toFixed(0)} KM   B-CRIT ${(res.ca.bCrit / 1000).toFixed(0)} KM   MARGIN ${res.ca.marginRadii.toFixed(2)} R`, cx, y + 132, 12, { align: 'center', color: p.dim, glow: 0 });
    drawText(s, `RUN OVER   ROUNDS SURVIVED ${this.run.roundsSurvived}   RUN SCORE ${this.run.score}${this.rank > 0 ? `   LEADERBOARD RANK ${this.rank}` : ''}`, cx, y + 170, 12, { align: 'center' });
    drawText(s, '<SPACE> NEW RUN     <ESC> TITLE', cx, y + 214, 14, { align: 'center', color: p.hot, glow: 1.5 });
  }
}
