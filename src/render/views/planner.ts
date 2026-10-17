// WHAT: PLANNER overlay (GAME_PLAN 13.4), KINETIC archetype: porkchop dot-matrix, ranked plans, COMMIT.
// WHY:  Design pillar 3: show the numbers. Each plan prints the planner's work as a terminal readout, so
//       the player can learn why a plan is ranked where it is.
// HOW:  Opening the overlay posts a porkchop job to the worker; when the grid arrives the candidates are
//       ranked (planner/candidates.ts) with a resolve callback that includes the missions already
//       committed, so margins are totals. Left: launch (x) by arrival (y) cells, dot size by payload,
//       brightness by low C3, numbered markers for the ranked plans. Right: the readouts. Enter commits
//       the selected plan through the callback; the overlay stays open so more can be added.
// LORE: G3 (the planner), O10 (A to B), D2 (early beats big)

import { KNOBS } from '../../config/knobs';
import { YEAR } from '../../physics/constants';
import { propagate } from '../../physics/kepler';
import { rankCandidates, type Candidate } from '../../planner/candidates';
import type { PorkchopGrid } from '../../planner/porkchop';
import type { PlannerClient } from '../../planner/workerClient';
import type { Mission } from '../../sim/mission';
import { resolveRound } from '../../sim/resolver';
import { planetById, type World } from '../../sim/world';
import { formatCountdown } from '../../ui/hud';
import type { Input } from '../../ui/input';
import type { Surface } from '../canvas';
import { withAlpha } from '../palettes';
import { drawText } from '../vectorFont';

export interface PlannerSession {
  world: World;
  missions: readonly Mission[];
  launcherTier: number;
  impactorTier: number;
  budget: number;
  onCommit: (m: Mission) => boolean;
}

export class PlannerOverlay {
  private open = false;
  private session: PlannerSession | null = null;
  private grid: PorkchopGrid | null = null;
  private cands: Candidate[] = [];
  private sel = 0;
  private status = '';
  private jobToken = 0;

  constructor(private readonly s: Surface, private readonly keys: Input, private readonly client: PlannerClient) {}

  get isOpen(): boolean {
    return this.open;
  }

  show(session: PlannerSession): void {
    this.open = true;
    this.session = session;
    this.grid = null;
    this.cands = [];
    this.sel = 0;
    this.status = 'COMPUTING PORKCHOP GRID ...';
    const w = session.world;
    const th = w.threat;
    if (!th) return;
    const home = planetById(w, 'HOME');
    const token = ++this.jobToken;
    this.client
      .porkchop({ home: home.elements, threat: th.elements, muSun: w.star.mu, tMin: w.t + KNOBS.BUILD_TIME_KINETIC, tImpact: th.tImpact, tier: session.launcherTier })
      .then((grid) => {
        if (token !== this.jobToken) return;
        this.grid = grid;
        this.rank();
      })
      .catch((e: unknown) => {
        this.status = `PLANNER ERROR: ${e instanceof Error ? e.message.toUpperCase() : 'UNKNOWN'}`;
      });
  }

  /** Re-rank against the current mission list (after a commit) without recomputing the grid. */
  refresh(session: PlannerSession): void {
    this.session = session;
    if (this.grid) this.rank();
  }

  hide(): void {
    this.open = false;
  }

  private rank(): void {
    const s = this.session;
    const g = this.grid;
    if (!s || !g) return;
    const w = s.world;
    const th = w.threat;
    if (!th) return;
    const home = planetById(w, 'HOME');
    const range = KNOBS.BETA_RANGE[th.type.id] ?? ([2, 4] as const);
    const betaMid = (range[0] + range[1]) / 2;
    this.cands = rankCandidates(g, {
      threatMass: th.mass,
      threatType: th.type.id,
      tImpact: th.tImpact,
      rHome: home.radius,
      launcherTier: s.launcherTier,
      impactorTier: s.impactorTier,
      budget: s.budget,
      committedAt: w.t,
      threatVelocity: (t) => propagate(th.elements, w.star.mu, t).v,
      resolveMargin: (m) => resolveRound(w, [...s.missions, m], { betaOverride: betaMid }).ca.marginRadii,
    });
    this.sel = 0;
    this.status = g.feasible === 0 ? 'NO FEASIBLE LAUNCH WINDOW FOR THIS LAUNCHER' : `${g.feasible} FEASIBLE CELLS  ${g.nL}X${g.nA} GRID  STEP ${(g.step / 86400).toFixed(0)} D`;
  }

  update(): void {
    if (!this.open) return;
    const k = this.keys;
    if (k.pressed('Escape') || k.pressed('KeyP')) {
      this.hide();
      return;
    }
    if (k.pressed('ArrowUp')) this.sel = (this.sel + this.cands.length - 1) % Math.max(1, this.cands.length);
    if (k.pressed('ArrowDown')) this.sel = (this.sel + 1) % Math.max(1, this.cands.length);
    if (k.pressed('Enter')) {
      const c = this.cands[this.sel];
      if (c && this.session) {
        const id = `IMPACTOR-${this.session.missions.length + 1}`;
        const ok = this.session.onCommit({ ...c.mission, id });
        this.status = ok ? `${id} COMMITTED` : 'CANNOT AFFORD THIS PLAN';
      }
    }
  }

  render(): void {
    if (!this.open || !this.session) return;
    const s = this.s;
    const p = s.palette;
    const w = this.session.world;
    const th = w.threat;
    if (!th) return;
    const m = 16;
    const W = s.width;
    const H = s.height;
    s.ctx.fillStyle = withAlpha(p.bg, 0.82);
    s.ctx.fillRect(0, 0, W, H);
    const top = m + 40;
    const bottom = H - m - 40;
    const leftW = Math.min(W * 0.5, 620);
    drawText(s, `PLANNER  KINETIC  L${this.session.launcherTier} I${this.session.impactorTier}  BUDGET ${this.session.budget.toFixed(1)}  COMMITTED ${this.session.missions.length}`, m, m, 14, { color: p.hot, glow: 1.2 });
    drawText(s, this.status, m, m + 20, 11, { color: p.dim, glow: 0 });

    // Porkchop plot.
    const px0 = m;
    const py0 = top + 10;
    const pw = leftW - m;
    const ph = bottom - py0 - 30;
    s.stroke([px0, py0, px0 + pw, py0, px0 + pw, py0 + ph, px0, py0 + ph], { closed: true, color: p.dim, glow: 0 });
    drawText(s, 'LAUNCH (YEARS FROM NOW)', px0 + pw / 2, py0 + ph + 8, 10, { align: 'center', color: p.dim, glow: 0 });
    drawText(s, 'ARRIVAL', px0, py0 - 14, 10, { color: p.dim, glow: 0 });
    const g = this.grid;
    if (g && g.nL > 0 && g.nA > 0) {
      let c3max = 0;
      for (let i = 0; i < g.c3.length; i++) {
        const c = g.c3[i] as number;
        if (Number.isFinite(c) && (g.payload[i] as number) > 0) c3max = Math.max(c3max, c);
      }
      const cw = pw / g.nL;
      const ch = ph / g.nA;
      for (let iL = 0; iL < g.nL; iL++) {
        for (let iA = 0; iA < g.nA; iA++) {
          const i = iL * g.nA + iA;
          const pay = g.payload[i] as number;
          if (!(pay > 0)) continue;
          const c = g.c3[i] as number;
          const bright = 1 - Math.min(1, c / Math.max(1, c3max));
          const size = Math.max(1, Math.min(cw, ch) * (0.35 + 0.6 * Math.min(1, pay / 4000)));
          s.dot(px0 + (iL + 0.5) * cw, py0 + ph - (iA + 0.5) * ch, size, p.ink, 0.15 + 0.75 * bright);
        }
      }
      // Axis ticks in years.
      const spanL = (g.nL * g.step) / YEAR;
      for (let y = 0; y <= spanL; y += 1) {
        const x = px0 + ((y * YEAR) / (g.nL * g.step)) * pw;
        s.stroke([x, py0 + ph, x, py0 + ph + 4], { color: p.dim, glow: 0 });
        drawText(s, `${y}`, x, py0 + ph + 6, 8, { align: 'center', color: p.dim, glow: 0 });
      }
      // Ranked plan markers.
      this.cands.forEach((c, idx) => {
        const x = px0 + (c.iL + 0.5) * cw;
        const y = py0 + ph - (c.iA + 0.5) * ch;
        const selected = idx === this.sel;
        s.circle(x, y, selected ? 9 : 6, { color: selected ? p.hot : p.ink, glow: selected ? 1.8 : 0.8, width: selected ? 1.5 : 1 });
        drawText(s, `${idx + 1}`, x + 8, y - 12, 10, { color: selected ? p.hot : p.ink, glow: 0.5 });
      });
      // Committed missions as crosses.
      for (const mi of this.session.missions) {
        const iL = (mi.launchTime - g.tL0) / g.step;
        const iA = (mi.arrivalTime - g.tA0) / g.step;
        const x = px0 + (iL + 0.5) * cw;
        const y = py0 + ph - (iA + 0.5) * ch;
        s.stroke([x - 5, y - 5, x + 5, y + 5], { color: p.hot, glow: 0.8 });
        s.stroke([x - 5, y + 5, x + 5, y - 5], { color: p.hot, glow: 0.8 });
      }
    }

    // Plan list.
    const lx = leftW + m;
    let ly = top;
    const range = KNOBS.BETA_RANGE[th.type.id] ?? ([2, 4] as const);
    if (this.cands.length === 0 && g) drawText(s, 'NO VIABLE KINETIC PLAN. WAIT FOR BUDGET OR ACCEPT THE HIT.', lx, ly, 12, { color: p.hot });
    this.cands.forEach((c, idx) => {
      const mi = c.mission;
      const selected = idx === this.sel;
      const col = selected ? p.hot : p.ink;
      const dvMid = (((range[0] + range[1]) / 2) * mi.impactorKg * mi.U) / th.mass;
      const lines = [
        `PLAN ${idx + 1}  DEFLECT (KINETIC)   SCORE ${c.score.toFixed(2)}${mi.cost > this.session!.budget ? '  UNAFFORDABLE' : ''}`,
        ` LAUNCH  ${formatCountdown(th.tImpact - mi.launchTime)}   C3 ${mi.c3.toFixed(1)}   PAYLOAD ${mi.impactorKg.toFixed(0)} KG`,
        ` IMPACT  ${formatCountdown(th.tImpact - mi.arrivalTime)}   U ${(mi.U / 1000).toFixed(1)} KM/S`,
        ` PUSH    dV ${(dvMid * 1000).toFixed(2)} MM/S (BETA ${range[0].toFixed(1)}..${range[1].toFixed(1)})   EST ${c.missEstRadii.toFixed(2)} R   MARGIN ${c.marginRadii === null ? '?' : (c.marginRadii >= 0 ? '+' : '') + c.marginRadii.toFixed(2)} R`,
        ` COST    ${mi.cost} / ${this.session!.budget.toFixed(1)}`,
      ];
      if (selected) s.stroke([lx - 8, ly - 4, lx - 8, ly + lines.length * 15 + 2], { color: p.hot, glow: 1.2, width: 2 });
      for (const l of lines) {
        drawText(s, l, lx, ly, 11, { color: col, glow: selected ? 0.8 : 0.3 });
        ly += 15;
      }
      ly += 8;
    });
    drawText(s, 'UP / DOWN SELECT     <ENTER> COMMIT     <P> OR <ESC> CLOSE', W / 2, H - m - 14, 12, { align: 'center', color: p.dim, glow: 0 });
  }
}
