// WHAT: PLANNER overlay (GAME_PLAN 13.4): porkchop dot-matrix, ranked plans (KINETIC and SWARM), target
//       selection among live bodies after a breakup, Monte Carlo for the selected plan, COMMIT.
// WHY:  Design pillar 3: show the numbers. Each plan prints the planner's work as a terminal readout, so
//       the player can learn why a plan is ranked where it is, including whether it would shatter the body.
// HOW:  Opening the overlay posts a porkchop job for the current target; when the grid arrives the
//       candidates are ranked (planner/candidates.ts) with a resolve callback that includes the missions
//       already committed, so verdicts are totals. Tab cycles the target over bodies alive at the current
//       time. Selecting a plan posts a Monte Carlo job (debounced) whose P(MISS) joins the readout. Enter
//       commits all of the plan's missions through the callback; the overlay stays open for more.
// LORE: G3 (the planner), O10 (A to B), D2 (early beats big), D4 (fragmentation)

import { KNOBS } from '../../config/knobs';
import { YEAR } from '../../physics/constants';
import { propagate } from '../../physics/kepler';
import { rankCandidates, rankMissions, rankNukes, rankSlowPush, type Candidate, type CandidateContext } from '../../planner/candidates';
import { RULE_PRESETS } from '../../planner/rules';
import type { FlybyResult } from '../../planner/flybySearch';
import { missionFromFlyby, missionFromSail } from '../../planner/legs';
import type { SailResult } from '../../planner/sailSearch';
import type { MonteCarloResult } from '../../planner/monteCarlo';
import type { PorkchopGrid } from '../../planner/porkchop';
import type { PlannerClient } from '../../planner/workerClient';
import type { Mission } from '../../sim/mission';
import { bodyAlive, elementsAt, resolveRound, type Body, type RoundResult } from '../../sim/resolver';
import { planetById, type World } from '../../sim/world';
import { formatCountdown } from '../../ui/hud';
import type { Input } from '../../ui/input';
import type { Surface } from '../canvas';
import { withAlpha } from '../palettes';
import { drawText } from '../vectorFont';

export interface PlannerSession {
  world: World;
  missions: readonly Mission[];
  result: RoundResult;
  launcherTier: number;
  impactorTier: number;
  navTier: number;
  sailTier: number;
  warheadTier: number;
  slowPushTier: number;
  swarmTier: number;
  autonomyTier: number;
  rulesPreset: string;
  dsmBudget: number;
  /** Build time for a new mission, s (programs can shorten it). */
  buildTime: number;
  budget: number;
  onCommit: (ms: Mission[]) => boolean;
}

export class PlannerOverlay {
  private open = false;
  private session: PlannerSession | null = null;
  private grid: PorkchopGrid | null = null;
  private cands: Candidate[] = [];
  private sel = 0;
  private status = '';
  private jobToken = 0;
  private targets: Body[] = [];
  private targetIdx = 0;
  private mc: MonteCarloResult | null = null;
  private mcToken = 0;
  private mcTimer = 0;
  private flybyRes: FlybyResult | null = null;
  private sailRes: SailResult | null = null;
  private extra: Candidate[] = [];
  private extraStatus = '';

  constructor(private readonly s: Surface, private readonly keys: Input, private readonly client: PlannerClient) {}

  get isOpen(): boolean {
    return this.open;
  }

  private get target(): Body | null {
    return this.targets[this.targetIdx] ?? null;
  }

  show(session: PlannerSession): void {
    this.open = true;
    this.session = session;
    const t = session.world.t;
    this.targets = session.result.bodies.filter((b) => bodyAlive(b, t) && !b.harmless);
    this.targetIdx = 0;
    this.requestGrid();
  }

  private requestGrid(): void {
    const session = this.session;
    const target = this.target;
    this.grid = null;
    this.cands = [];
    this.extra = [];
    this.flybyRes = null;
    this.sailRes = null;
    this.extraStatus = '';
    this.sel = 0;
    this.mc = null;
    if (!session || !target) {
      this.status = 'NO TARGET BODY ALIVE';
      return;
    }
    this.status = `COMPUTING PORKCHOP GRID FOR ${target.id} ...`;
    const w = session.world;
    const home = planetById(w, 'HOME');
    const tMin = w.t + session.buildTime;
    const token = ++this.jobToken;
    this.client
      .porkchop({ home: home.elements, threat: elementsAt(target.segments, tMin), muSun: w.star.mu, tMin, tImpact: session.result.ca.tCa, tier: session.launcherTier })
      .then((grid) => {
        if (token !== this.jobToken) return;
        this.grid = grid;
        this.rank();
      })
      .catch((e: unknown) => {
        this.status = `PLANNER ERROR: ${e instanceof Error ? e.message.toUpperCase() : 'UNKNOWN'}`;
      });
    // Flyby and sail searches run alongside; their plans join the list when they land.
    const threatEl = elementsAt(target.segments, tMin);
    if (session.navTier >= 1) {
      this.extraStatus = 'FLYBY SEARCH ...';
      this.client
        .flyby({ home: home.elements, threat: threatEl, planets: w.planets.filter((p) => p.id !== 'HOME').map((p) => ({ id: p.id, mu: p.mu, radius: p.radius, elements: p.elements })), muSun: w.star.mu, tMin, tImpact: session.result.ca.tCa, tier: session.launcherTier, dsmBudget: session.dsmBudget })
        .then((r) => {
          if (token !== this.jobToken) return;
          this.flybyRes = r;
          this.rankExtra();
        })
        .catch(() => undefined);
    }
    if (session.sailTier >= 1) {
      this.client
        .sail({ home: home.elements, threat: threatEl, muSun: w.star.mu, tMin, tImpact: session.result.ca.tCa, tier: session.launcherTier, sailTier: session.sailTier, dsmBudget: session.dsmBudget })
        .then((r) => {
          if (token !== this.jobToken) return;
          this.sailRes = r;
          this.rankExtra();
        })
        .catch(() => undefined);
    }
  }

  private context(): CandidateContext | null {
    const s = this.session;
    const target = this.target;
    if (!s || !target) return null;
    const w = s.world;
    const th = w.threat;
    if (!th) return null;
    const home = planetById(w, 'HOME');
    const range = KNOBS.BETA_RANGE[th.type.id] ?? ([2, 4] as const);
    const betaMid = (range[0] + range[1]) / 2;
    return {
      targetId: target.id,
      targetMass: target.mass,
      targetD: target.D,
      threatType: th.type.id,
      threatDensity: th.type.density,
      threatStrength: th.type.strengthMult,
      threatMaterial: th.type.kind === 'comet' ? 'ice' : 'basalt',
      threatEnergyMt: s.result.energy.energyMt,
      tImpact: th.tImpact,
      rHome: home.radius,
      launcherTier: s.launcherTier,
      impactorTier: s.impactorTier,
      budget: s.budget,
      committedAt: w.t,
      targetVelocity: (t) => propagate(elementsAt(target.segments, t), w.star.mu, t).v,
      resolve: (ms) => {
        const r = resolveRound(w, [...s.missions, ...ms], { betaOverride: betaMid });
        return { outcome: r.outcome, marginRadii: r.ca.marginRadii, hitEnergyMt: r.hitEnergyMt, producedFragments: r.producedFragments };
      },
      swarmTier: s.swarmTier,
      autonomyTier: s.autonomyTier,
      dvBudget: s.dsmBudget,
    };
  }

  /** Rank flyby and sail plans (pre-built missions) and merge them into the shown list. */
  private rankExtra(): void {
    const s = this.session;
    const target = this.target;
    const ctx = this.context();
    if (!s || !target || !ctx) return;
    const w = s.world;
    const home = planetById(w, 'HOME');
    const legCtx = { home: home.elements, muSun: w.star.mu, launcherTier: s.launcherTier, impactorTier: s.impactorTier, committedAt: w.t, targetId: target.id };
    const list: { archetype: 'KINETIC_FLYBY' | 'SAIL_KINETIC'; missions: Mission[] }[] = [];
    if (this.flybyRes) {
      // Keep the best few flyby cells by closing speed per planet so the resolve budget is spent well.
      const byPlanet = new Map<string, typeof this.flybyRes.cells>();
      for (const c of this.flybyRes.cells) {
        const arr = byPlanet.get(c.planetId) ?? [];
        arr.push(c);
        byPlanet.set(c.planetId, arr);
      }
      for (const arr of byPlanet.values()) {
        arr.sort((a, b) => b.U * Math.min(b.payload, 2e4) - a.U * Math.min(a.payload, 2e4));
        for (const c of arr.slice(0, 4)) {
          const m = missionFromFlyby(c, legCtx, 'FLYBY');
          if (m) list.push({ archetype: 'KINETIC_FLYBY', missions: [m] });
        }
      }
    }
    if (this.sailRes) {
      const cells = [...this.sailRes.cells].sort((a, b) => b.U * b.impactorKg - a.U * a.impactorKg).slice(0, 6);
      for (const c of cells) {
        const m = missionFromSail(c, legCtx, 'SAIL', s.sailTier);
        if (m) list.push({ archetype: 'SAIL_KINETIC', missions: [m] });
      }
    }
    this.extra = rankMissions(list, ctx);
    const nf = this.flybyRes ? this.flybyRes.cells.length : 0;
    const ns = this.sailRes ? this.sailRes.cells.length : 0;
    this.extraStatus = `${this.flybyRes ? `FLYBY ${nf} CELLS` : 'FLYBY ...'}   ${this.sailRes ? `SAIL ${ns} ARCS` : s.sailTier >= 1 ? 'SAIL ...' : ''}`;
    this.merge();
  }

  /** Merge grid candidates and extra plans into one list sorted by score, ids renumbered. */
  private merge(): void {
    const all = [...this.cands.filter((c) => c.archetype !== 'KINETIC_FLYBY' && c.archetype !== 'SAIL_KINETIC'), ...this.extra];
    all.sort((a, b) => b.score - a.score);
    const shown = all.slice(0, KNOBS.PLANNER_SHOW_TOP);
    shown.forEach((c, i) => c.missions.forEach((m, j) => (m.id = `${c.archetype === 'SWARM' ? 'SWARM' : c.archetype === 'KINETIC_FLYBY' ? 'FLYBY' : c.archetype === 'SAIL_KINETIC' ? 'SAIL' : c.archetype === 'NUKE_STANDOFF' || c.archetype === 'NUKE_DISRUPT' ? 'NUKE' : c.archetype === 'SLOW_PUSH' ? 'PUSH' : c.archetype === 'SPLIT' ? 'CARRIER' : 'IMPACTOR'}-${i + 1}${c.missions.length > 1 ? String.fromCharCode(65 + j) : ''}`)));
    this.cands = shown;
    this.sel = Math.min(this.sel, Math.max(0, shown.length - 1));
    this.scheduleMc();
  }

  refresh(session: PlannerSession): void {
    this.session = session;
    const t = session.world.t;
    this.targets = session.result.bodies.filter((b) => bodyAlive(b, t) && !b.harmless);
    this.targetIdx = Math.min(this.targetIdx, Math.max(0, this.targets.length - 1));
    if (this.grid) this.rank();
    if (this.flybyRes || this.sailRes) this.rankExtra();
  }

  hide(): void {
    this.open = false;
    this.mcToken++;
  }

  private rank(): void {
    const s = this.session;
    const g = this.grid;
    const target = this.target;
    const ctx = this.context();
    if (!s || !g || !target || !ctx) return;
    this.cands = [...rankCandidates(g, ctx), ...rankNukes(g, ctx, s.warheadTier), ...rankSlowPush(g, ctx, s.slowPushTier, s.sailTier, s.dsmBudget, (s.world.threat?.type.id ?? '') === 'IRON')];
    this.sel = 0;
    this.status = g.feasible === 0 ? `NO FEASIBLE LAUNCH WINDOW TO ${target.id} FOR THIS LAUNCHER` : `TARGET ${target.id} (${target.D.toFixed(0)} M)   ${g.feasible} FEASIBLE CELLS  ${g.nL}X${g.nA}  STEP ${(g.step / 86400).toFixed(0)} D`;
    if (this.extra.length > 0) this.merge();
    else this.scheduleMc();
  }

  /** Monte Carlo for the selected plan, debounced so arrow-key browsing does not flood the worker. */
  private scheduleMc(): void {
    this.mc = null;
    const token = ++this.mcToken;
    const c = this.cands[this.sel];
    const s = this.session;
    if (!c || !s) return;
    const delay = 250;
    this.mcTimer = performance.now() + delay;
    setTimeout(() => {
      if (token !== this.mcToken || !this.open) return;
      this.client
        .monteCarlo(s.world, [...s.missions, ...c.missions], KNOBS.MC_SAMPLES)
        .then((r) => {
          if (token === this.mcToken) this.mc = r;
        })
        .catch(() => undefined);
    }, delay);
  }

  update(): void {
    if (!this.open) return;
    const k = this.keys;
    if (k.pressed('Escape') || k.pressed('KeyP')) {
      this.hide();
      return;
    }
    if (k.pressed('KeyR') && this.session) {
      const names = Object.keys(RULE_PRESETS);
      const i = names.indexOf(this.session.rulesPreset);
      this.session.rulesPreset = names[(i + 1) % names.length] ?? 'DEFAULT';
      this.status = `RULES PRESET ${this.session.rulesPreset}: ${(RULE_PRESETS[this.session.rulesPreset] ?? []).map((r) => `${r.when}->${r.do}`).join('  ')}`;
    }
    if (k.pressed('Tab') && this.targets.length > 1) {
      this.targetIdx = (this.targetIdx + 1) % this.targets.length;
      this.requestGrid();
    }
    const n = Math.max(1, this.cands.length);
    if (k.pressed('ArrowUp')) {
      this.sel = (this.sel + n - 1) % n;
      this.scheduleMc();
    }
    if (k.pressed('ArrowDown')) {
      this.sel = (this.sel + 1) % n;
      this.scheduleMc();
    }
    if (k.pressed('Enter')) {
      const c = this.cands[this.sel];
      const session = this.session;
      if (c && session) {
        const base = session.missions.length + 1;
        const rules = RULE_PRESETS[session.rulesPreset] ?? RULE_PRESETS['DEFAULT'] ?? [];
        const ms = c.missions.map((m, j) => ({ ...m, id: c.missions.length > 1 ? `SWARM-${base}${String.fromCharCode(65 + j)}` : `${c.archetype === 'SPLIT' ? 'CARRIER' : c.archetype === 'KINETIC_FLYBY' ? 'FLYBY' : c.archetype === 'SAIL_KINETIC' ? 'SAIL' : c.archetype.startsWith('NUKE') ? 'NUKE' : c.archetype === 'SLOW_PUSH' ? 'PUSH' : 'IMPACTOR'}-${base}`, autonomyTier: session.autonomyTier, dvBudget: Math.max(m.dvBudget ?? 0, session.dsmBudget - (m.dsmUsed ?? 0)), rules }));
        const ok = session.onCommit(ms);
        this.status = ok ? `${ms.map((m) => m.id).join(' ')} COMMITTED` : 'CANNOT AFFORD THIS PLAN';
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
    s.ctx.fillStyle = withAlpha(p.bg, 0.86);
    s.ctx.fillRect(0, 0, W, H);
    const top = m + 40;
    const bottom = H - m - 40;
    const leftW = Math.min(W * 0.46, 600);
    drawText(s, `PLANNER  L${this.session.launcherTier} I${this.session.impactorTier} A${this.session.autonomyTier}${this.session.autonomyTier === 1 ? ' ' + this.session.rulesPreset : ''}  BUDGET ${this.session.budget.toFixed(1)}  COMMITTED ${this.session.missions.length}  TARGETS ${this.targets.length}${this.targets.length > 1 ? '  <TAB> NEXT TARGET' : ''}`, m, m, 14, { color: p.hot, glow: 1.2 });
    drawText(s, this.status, m, m + 20, 11, { color: p.dim, glow: 0 });

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
          const bright = 1 - Math.min(1, (g.c3[i] as number) / Math.max(1, c3max));
          const size = Math.max(1, Math.min(cw, ch) * (0.35 + 0.6 * Math.min(1, pay / 4000)));
          s.dot(px0 + (iL + 0.5) * cw, py0 + ph - (iA + 0.5) * ch, size, p.ink, 0.15 + 0.75 * bright);
        }
      }
      const spanL = (g.nL * g.step) / YEAR;
      for (let y = 0; y <= spanL; y += 1) {
        const x = px0 + ((y * YEAR) / (g.nL * g.step)) * pw;
        s.stroke([x, py0 + ph, x, py0 + ph + 4], { color: p.dim, glow: 0 });
        drawText(s, `${y}`, x, py0 + ph + 6, 8, { align: 'center', color: p.dim, glow: 0 });
      }
      this.cands.forEach((c, idx) => {
        const selected = idx === this.sel;
        c.missions.forEach((mi, j) => {
          const iL = (mi.launchTime - g.tL0) / g.step;
          const iA = (mi.arrivalTime - g.tA0) / g.step;
          const x = px0 + (iL + 0.5) * cw;
          const y = py0 + ph - (iA + 0.5) * ch;
          s.circle(x, y, selected ? 9 : 6, { color: selected ? p.hot : p.ink, glow: selected ? 1.8 : 0.8, width: selected ? 1.5 : 1 });
          if (j === 0) drawText(s, `${idx + 1}`, x + 8, y - 12, 10, { color: selected ? p.hot : p.ink, glow: 0.5 });
        });
      });
      for (const mi of this.session.missions) {
        if ((mi.targetId ?? 'THREAT') !== (this.target?.id ?? 'THREAT')) continue;
        const iL = (mi.launchTime - g.tL0) / g.step;
        const iA = (mi.arrivalTime - g.tA0) / g.step;
        const x = px0 + (iL + 0.5) * cw;
        const y = py0 + ph - (iA + 0.5) * ch;
        s.stroke([x - 5, y - 5, x + 5, y + 5], { color: p.hot, glow: 0.8 });
        s.stroke([x - 5, y + 5, x + 5, y - 5], { color: p.hot, glow: 0.8 });
      }
    }

    // FLYBY WINDOWS: feasible flyby dates per planet, under the plot.
    if (this.flybyRes) {
      let wy = py0 + ph + 22;
      drawText(s, `FLYBY WINDOWS  ${this.extraStatus}`, px0, wy, 10, { color: p.dim, glow: 0 });
      wy += 13;
      for (const [pid, times] of Object.entries(this.flybyRes.windows)) {
        const txt = times.length === 0 ? 'NONE' : `${times.length} DATES  ${formatCountdown(th.tImpact - (times[0] as number))} .. ${formatCountdown(th.tImpact - (times[times.length - 1] as number))}`;
        drawText(s, `${pid.padEnd(6)} ${txt}`, px0, wy, 10, { color: times.length ? p.ink : p.dim, glow: 0 });
        wy += 12;
      }
    } else if (this.extraStatus) {
      drawText(s, this.extraStatus, px0, py0 + ph + 22, 10, { color: p.dim, glow: 0 });
    }

    const lx = leftW + m;
    let ly = top;
    const range = KNOBS.BETA_RANGE[th.type.id] ?? ([2, 4] as const);
    if (this.cands.length === 0 && g) drawText(s, 'NO VIABLE PLAN. WAIT FOR BUDGET, CHANGE TARGET, OR ACCEPT THE HIT.', lx, ly, 12, { color: p.hot });
    this.cands.forEach((c, idx) => {
      const selected = idx === this.sel;
      const col = selected ? p.hot : p.ink;
      const first = c.missions[0];
      if (!first) return;
      const v = c.verdict;
      const target = this.target;
      const dvMid = target ? (((range[0] + range[1]) / 2) * first.impactorKg * first.U) / target.mass : 0;
      const label = c.archetype === 'SPLIT' ? `SPLIT BUS X${first.split?.count}` : c.archetype === 'SWARM' ? `SWARM X${c.missions.length}` : c.archetype === 'KINETIC_FLYBY' ? 'KINETIC-FLYBY' : c.archetype === 'SAIL_KINETIC' ? 'SAIL-KINETIC' : c.archetype === 'NUKE_STANDOFF' ? `NUKE STANDOFF ${first.warhead?.yieldMt} MT` : c.archetype === 'NUKE_DISRUPT' ? `NUKE SUBSURFACE ${first.warhead?.yieldMt} MT` : c.archetype === 'SLOW_PUSH' ? `SLOW PUSH ${first.push?.method}` : 'KINETIC';
      const fly = first.legs?.find((l) => l.kind === 'FLYBY');
      const sail = first.legs?.find((l) => l.kind === 'SAIL');
      const legLine = fly && fly.kind === 'FLYBY' ? ` FLYBY   ${fly.planetId} ${formatCountdown(th.tImpact - fly.t)}   TURN ${((fly.delta * 180) / Math.PI).toFixed(0)} DEG   dV +${(fly.dvHelio / 1000).toFixed(1)} KM/S   DSM ${(fly.dsm / 1000).toFixed(2)} KM/S` : sail && sail.kind === 'SAIL' ? ` SAIL    ${sail.law}  ARC ${((sail.tTo - sail.tFrom) / 86400).toFixed(0)} D   BUILT ${(sail.dvEquiv / 1000).toFixed(1)} KM/S   DROP ${formatCountdown(th.tImpact - sail.tTo)}   DSM ${((first.dsmUsed ?? 0) / 1000).toFixed(2)} KM/S` : null;
      const kind = (c.archetype === 'SLOW_PUSH' ? (c.verdict && c.missEstRadii === 0 ? 'NOT VIABLE' : 'SLOW PUSH') : c.qRatio >= 1 ? `DISRUPT (Q/Q* ${c.qRatio.toFixed(2)})` : `DEFLECT (Q/Q* ${c.qRatio.toFixed(2)})`) + (first.warhead ? '  [WARHEAD: SCORE PENALTY]' : '');
      const verdict = v ? `${v.outcome}${v.outcome !== 'MISS' ? ` ${v.hitEnergyMt.toFixed(1)} MT THROUGH` : ''}  MARGIN ${v.marginRadii >= 0 ? '+' : ''}${v.marginRadii.toFixed(2)} R` : '...';
      const mcLine = selected ? (this.mc ? `  P(MISS) ${(this.mc.pMiss * 100).toFixed(0)}%  P(PARTIAL) ${(this.mc.pPartial * 100).toFixed(0)}%  N ${this.mc.n}` : '  P(MISS) ...') : '';
      const lines = [
        `PLAN ${idx + 1}  ${kind}  ${label}   SCORE ${c.score.toFixed(2)}${c.cost > this.session!.budget ? '  UNAFFORDABLE' : ''}`,
        ` LAUNCH  ${formatCountdown(th.tImpact - first.launchTime)}${c.missions.length > 1 ? ` (+${c.missions.length - 1} STAGGERED)` : ''}   C3 ${first.c3.toFixed(1)}   PAYLOAD ${first.impactorKg.toFixed(0)} KG`,
        ...(legLine ? [legLine] : []),
        ` IMPACT  ${formatCountdown(th.tImpact - first.arrivalTime)}   U ${(first.U / 1000).toFixed(1)} KM/S   TARGET ${first.targetId ?? 'THREAT'}`,
        first.push ? ` PUSH    ${first.push.method} ${first.push.sign > 0 ? 'PROGRADE' : 'RETROGRADE'}   RENDEZVOUS dV ${((first.dsmUsed ?? 0) / 1000).toFixed(2)} KM/S   UP TO ${(first.push.tauMax / 86400).toFixed(0)} D   EST ${c.missEstRadii.toFixed(3)} R` : first.warhead ? ` PUSH    ${first.warhead.mode} BURST   EST ${c.missEstRadii.toFixed(2)} R   WARHEAD ${first.impactorKg.toFixed(0)} KG` : ` PUSH    dV ${(dvMid * 1000).toFixed(2)} MM/S (BETA ${range[0].toFixed(1)}..${range[1].toFixed(1)})   EST ${c.missEstRadii.toFixed(2)} R`,
        ` RESULT  ${verdict}${mcLine}`,
        ` COST    ${c.cost} / ${this.session!.budget.toFixed(1)}`,
      ];
      if (selected) s.stroke([lx - 8, ly - 4, lx - 8, ly + lines.length * 13 + 2], { color: p.hot, glow: 1.2, width: 2 });
      for (const l of lines) {
        drawText(s, l, lx, ly, 10, { color: col, glow: selected ? 0.8 : 0.3 });
        ly += 13;
      }
      ly += 6;
    });
    drawText(s, 'UP / DOWN SELECT     <ENTER> COMMIT     <TAB> TARGET     <R> RULES PRESET     <P> OR <ESC> CLOSE', W / 2, H - m - 14, 12, { align: 'center', color: p.dim, glow: 0 });
    void this.mcTimer;
  }
}
