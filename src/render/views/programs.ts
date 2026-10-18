// WHAT: PROGRAMS panel (GAME_PLAN 13.8, 19): run-level projects with progress bars and funding, plus the
//       active network list.
// WHY:  The early programs are cheap and real; the player who ignores them loses to a sunward rock in
//       round 5. This panel is where that lesson is bought.
// HOW:  Up/Down select, Left/Right set funding in steps of 0.25, Enter toggles full/none. Progress and cost
//       are read from the run; the sim advances them with the clock (sim/programs.ts).
// LORE: G4 (programs), F7 (future missions)

import type { RunState } from '../../game/run';
import { topicForProgram } from '../../game/loreLinks';
import { NETWORKS } from '../../sim/detection';
import { programBurn, programById } from '../../sim/programs';
import type { Input } from '../../ui/input';
import type { Surface } from '../canvas';
import { uiColors, withAlpha } from '../palettes';
import { drawText, drawTextFit, wrapText } from '../vectorFont';
import { KNOBS } from '../../config/knobs';
import { anyWorks, cancelStudy, milestones, startStudy, studyAvailable, studyBurn, studyById, studyCostPerYear, trlReached, type StudyState } from '../../sim/studies';
import { drawGauge, gaugeHeight } from '../gaugeView';
import type { GaugeReading } from '../../sim/gauge';

export class ProgramsOverlay {
  /** Mouse targets from the last frame: each row's y and the progress / funding column's x. */
  private rowYs: number[] = [];
  private fundX = Infinity;
  /** Set by the owner screen: open the Learning Center on a topic. */
  openLore: ((id: string) => void) | null = null;
  private open = false;
  private sel = 0;
  /** PROGRAMS (things we know how to build) or STUDIES (feasibility research); Tab switches. */
  private tab: 'PROGRAMS' | 'STUDIES' = 'PROGRAMS';
  private studySel = 0;
  private studyRowYs: number[] = [];
  /** Right edge of the name column, CSS px: a click left of it on the selected row opens the lore. */
  private readonly nameW = 16 + 190;
  constructor(private readonly s: Surface, private readonly keys: Input) {}

  get isOpen(): boolean {
    return this.open;
  }
  show(): void {
    this.open = true;
  }
  hide(): void {
    this.open = false;
  }

  update(run: RunState, experimental = false): void {
    if (!this.open) return;
    const k = this.keys;
    if (k.pressed('Escape') || k.pressed('KeyG')) {
      this.hide();
      return;
    }
    if (k.pressed('Tab')) {
      this.tab = this.tab === 'PROGRAMS' ? 'STUDIES' : 'PROGRAMS';
      return;
    }
    if (this.tab === 'STUDIES') {
      this.updateStudies(run, experimental);
      return;
    }
    if ((k.pressed('KeyL') || k.pressed('Slash')) && this.openLore) {
      const ps = run.programs[this.sel];
      if (ps) this.openLore(topicForProgram(ps.id));
      return;
    }
    const n = run.programs.length;
    const click = k.takeClick();
    if (click) {
      const i = this.rowYs.findIndex((y) => click.y >= y - 2 && click.y < y + 15);
      // Click-to-learn: a click on the name of the row already selected opens its lore topic.
      const ps0 = run.programs[i];
      if (i >= 0 && i === this.sel && click.x < this.nameW && ps0 && this.openLore) {
        this.openLore(topicForProgram(ps0.id));
        return;
      }
      if (i >= 0) {
        this.sel = i;
        const ps = run.programs[i];
        if (ps && ps.completedAt === null && click.x >= this.fundX - 8) ps.funding = ps.funding >= 1 ? 0 : Math.min(1, Math.round((ps.funding + 0.25) * 4) / 4);
      }
    }
    if (k.pressed('ArrowUp')) this.sel = (this.sel + n - 1) % n;
    if (k.pressed('ArrowDown')) this.sel = (this.sel + 1) % n;
    const st = run.programs[this.sel];
    if (!st || st.completedAt !== null) return;
    if (k.pressed('ArrowRight')) st.funding = Math.min(1, Math.round((st.funding + 0.25) * 4) / 4);
    if (k.pressed('ArrowLeft')) st.funding = Math.max(0, Math.round((st.funding - 0.25) * 4) / 4);
    if (k.pressed('Enter')) st.funding = st.funding > 0 ? 0 : 1;
  }

  /** The cards on the STUDIES tab: every non-EXPERIMENTAL card, EXPERIMENTAL ones only when allowed. */
  private visibleStudies(run: RunState, experimental: boolean): StudyState[] {
    return run.studies.filter((st) => experimental || studyById(st.id).tag !== 'EXPERIMENTAL');
  }

  private updateStudies(run: RunState, experimental: boolean): void {
    const k = this.keys;
    const rows = this.visibleStudies(run, experimental);
    const n = rows.length;
    if (n === 0) return;
    if ((k.pressed('KeyL') || k.pressed('Slash')) && this.openLore) {
      this.openLore('D14');
      return;
    }
    const click = k.takeClick();
    if (click) {
      const i = this.studyRowYs.findIndex((y) => click.y >= y - 2 && click.y < y + 15);
      if (i >= 0 && i === this.studySel && click.x < this.nameW && this.openLore) {
        this.openLore('D14');
        return;
      }
      if (i >= 0) this.studySel = i;
    }
    if (k.pressed('ArrowUp')) this.studySel = (this.studySel + n - 1) % n;
    if (k.pressed('ArrowDown')) this.studySel = (this.studySel + 1) % n;
    this.studySel = Math.min(this.studySel, n - 1);
    const st = rows[this.studySel];
    if (!st) return;
    const c = studyById(st.id);
    if (k.pressed('Enter')) {
      if (st.status === 'RUNNING') cancelStudy(st);
      else if (studyAvailable(c, run.studies, experimental)) startStudy(st);
    }
    if (st.status !== 'RUNNING') return;
    if (k.pressed('ArrowRight')) st.funding = Math.min(1, Math.round((st.funding + 0.25) * 4) / 4);
    if (k.pressed('ArrowLeft')) st.funding = Math.max(0, Math.round((st.funding - 0.25) * 4) / 4);
  }

  private renderStudies(run: RunState, experimental: boolean): void {
    const s = this.s;
    const p = s.palette;
    const ui = uiColors(p, s.spectrum);
    const m = 16;
    const rows = this.visibleStudies(run, experimental);
    const cTag = m + 200, cTrl = m + 345, cHy = m + 410, cGy = m + 490, cCost = m + 565, cP = m + 640, bx = m + 735, bw = 150;
    for (const [x, h] of [[m, 'STUDY'], [cTag, 'TAG'], [cTrl, 'TRL'], [cHy, 'HUMAN Y'], [cGy, 'GAME Y'], [cCost, 'COST/Y'], [cP, 'P(WORKS)'], [bx, 'MILESTONES'], [bx + bw + 14, 'STATUS']] as const) drawText(s, h, x, m + 26, 10, { color: p.dim, glow: 0 });
    let y = m + 44;
    this.studyRowYs = [];
    rows.forEach((st, i) => {
      this.studyRowYs.push(y);
      const c = studyById(st.id);
      const selected = i === this.studySel;
      const avail = studyAvailable(c, run.studies, experimental);
      const col = st.status === 'SUCCEEDED' ? p.dim : !avail && st.status === 'IDLE' ? p.dim : selected ? p.hot : p.ink;
      const sty = { color: col, glow: selected ? 0.8 : 0.2 };
      if (selected) drawText(s, '>', m - 12, y, 11, { color: p.hot, glow: 1 });
      drawText(s, c.id, m, y, 11, sty);
      const tagCol = !s.spectrum ? col : c.tag === 'PROPOSED' ? s.role('craft') : c.tag === 'SPECULATIVE' ? s.role('program') : s.role('nuclear');
      drawText(s, c.tag, cTag, y, 11, { ...sty, color: tagCol });
      drawText(s, `${trlReached(c, st)} / ${c.trlNeeded}`, cTrl, y, 11, sty);
      drawText(s, String(c.humanYears), cHy + 56, y, 11, { ...sty, align: 'right' });
      drawText(s, (c.humanYears * KNOBS.STUDY_TIME_COMPRESSION).toFixed(1), cGy + 50, y, 11, { ...sty, align: 'right' });
      drawText(s, studyCostPerYear(c).toFixed(1), cCost + 50, y, 11, { ...sty, align: 'right' });
      drawText(s, `${Math.round(c.pSuccess * 100)}%`, cP + 64, y, 11, { ...sty, align: 'right' });
      // One tick per readiness level to climb; the bar fills as the attempt runs.
      s.stroke([bx, y + 2, bx + bw, y + 2, bx + bw, y + 10, bx, y + 10], { closed: true, color: p.dim, glow: 0 });
      const nm = milestones(c);
      for (let j = 1; j < nm; j++) s.stroke([bx + (bw * j) / nm, y + 1, bx + (bw * j) / nm, y + 11], { color: p.dim, glow: 0 });
      if (st.progress > 0) s.stroke([bx + 2, y + 6, bx + 2 + (bw - 4) * st.progress, y + 6], { color: st.status === 'FAILED' ? p.hot : col, width: 4, glow: 0.5 });
      const stat = st.status === 'RUNNING' ? (st.funding >= 1 ? 'RUNNING' : st.funding > 0 ? `RUNNING ${Math.round(st.funding * 100)}%` : 'PAUSED') : st.status === 'IDLE' ? (avail ? 'NOT STARTED' : `NEEDS ${c.requires.join(' + ')}`) : st.status === 'FAILED' ? 'FAILED (ENTER RETRIES)' : st.status;
      drawText(s, stat, bx + bw + 14, y, 11, { color: st.status === 'FAILED' ? p.hot : col, glow: selected ? 0.8 : 0.2 });
      y += 17;
    });
    const sel = rows[this.studySel];
    if (!sel) return;
    const c = studyById(sel.id);
    y += 8;
    const w = s.width - 2 * m;
    drawTextFit(s, c.name, m, y, 11, w, { color: ui.title, glow: 0.8 });
    y += 16;
    for (const l of wrapText(c.note.toUpperCase(), w, 10)) {
      drawText(s, l, m, y, 10, { color: ui.text, glow: 0.3 });
      y += 14;
    }
    drawTextFit(s, `OPEN PROBLEMS: ${c.breakthroughs.join('; ').toUpperCase()}`, m, y + 2, 10, w, { color: ui.sub, glow: 0.3 });
    y += 18;
    // Parallel funding: the chance that at least one line of this group works.
    const group = rows.filter((x) => studyById(x.id).group === c.group && x.status === 'RUNNING').map((x) => studyById(x.id).pSuccess);
    if (group.length > 1) drawText(s, `PARALLEL ${c.group}: ${group.length} LINES RUNNING, CHANCE AT LEAST ONE WORKS ${Math.round(anyWorks(group) * 100)}%`, m, y, 10, { color: p.hot, glow: 0.6 });
    else drawText(s, `FUND COMPETING ${c.group} LINES TOGETHER: THE CHANCE THAT ONE WORKS RISES, AND SO DOES THE BILL.`, m, y, 10, { color: p.dim, glow: 0 });
    y += 16;
    drawTextFit(s, `HUMAN YEARS ARE THE REAL-WORLD SCALE; THE GAME RUNS THEM AT X${KNOBS.STUDY_TIME_COMPRESSION}. READINESS LEVELS ARE ESTIMATES (UNVERIFIED, CLAIM FS-1); YEARS, COSTS AND ODDS ARE GAME ESTIMATES.`, m, y, 9, w, { color: p.dim, glow: 0 });
    if (!experimental) drawTextFit(s, 'EXPERIMENTAL STUDIES (FUSION LINES): OPTIONS > EXPERIMENTAL TECH, OR ANY SCI-FI RUN.', m, y + 14, 9, w, { color: p.dim, glow: 0 });
  }

  render(run: RunState, budget: number, t: number, gauge: GaugeReading | null = null, experimental = false): void {
    if (!this.open) return;
    const s = this.s;
    const p = s.palette;
    const m = 16;
    s.ctx.fillStyle = withAlpha(p.bg, 0.88);
    s.ctx.fillRect(0, 0, s.width, s.height);
    const burn = programBurn(run.programs);
    const sBurn = studyBurn(run.studies);
    drawText(s, `${this.tab}   BUDGET ${budget.toFixed(1)}  (+${run.economy.perYear}/Y  -${burn.toFixed(2)}/Y PROGRAMS  -${sBurn.toFixed(2)}/Y STUDIES)`, m, m, 14, { color: uiColors(p, s.spectrum).title, glow: 1.2 });
    drawText(s, this.tab === 'PROGRAMS' ? '<TAB> STUDIES' : '<TAB> PROGRAMS', s.width - m, m, 11, { align: 'right', color: uiColors(p, s.spectrum).sub, glow: 0.6 });
    if (this.tab === 'STUDIES') {
      this.renderStudies(run, experimental);
      drawTextFit(s, 'UP / DOWN OR CLICK SELECT    <ENTER> START / RETRY / CANCEL    LEFT / RIGHT FUNDING    <TAB> PROGRAMS    <L> LEARN    <G> OR <ESC> CLOSE', s.width / 2, s.height - m - 12, 12, s.width - 32, { align: 'center', color: p.dim, glow: 0 });
      return;
    }
    // Columns are placed by x, not by padding, so a long tag (SPECULATIVE) never runs into YEARS.
    const cTag = m + 300, cYr = m + 420, cCost = m + 470, bx = m + 540, bw = 150;
    this.fundX = bx;
    for (const [x, h] of [[m, 'ID'], [cTag, 'TAG'], [cYr, 'YEARS'], [cCost, 'COST/Y'], [bx, 'PROGRESS'], [bx + bw + 14, 'FUNDING']] as const) drawText(s, h, x, m + 26, 10, { color: p.dim, glow: 0 });
    let y = m + 44;
    this.rowYs = [];
    run.programs.forEach((st, i) => {
      this.rowYs.push(y);
      const def = programById(st.id);
      const selected = i === this.sel;
      const col = st.completedAt !== null ? p.dim : selected ? p.hot : p.ink;
      if (selected) drawText(s, '>', m - 12, y, 11, { color: p.hot, glow: 1 });
      const sty = { color: col, glow: selected ? 0.8 : 0.2 };
      drawText(s, def.id, m, y, 11, sty);
      // Tag colour under NEON: real green, proposed cyan, speculative purple (the CODEX tiers).
      const tagCol = st.completedAt !== null || !s.spectrum ? col : def.tag === 'REAL' ? s.role('planet') : def.tag === 'PROPOSED' ? s.role('craft') : s.role('program');
      drawText(s, def.tag, cTag, y, 11, { ...sty, color: tagCol });
      drawText(s, String(def.years), cYr + 30, y, 11, { ...sty, align: 'right' });
      drawText(s, String(def.costPerYear), cCost + 40, y, 11, { ...sty, align: 'right' });
      s.stroke([bx, y + 2, bx + bw, y + 2, bx + bw, y + 10, bx, y + 10], { closed: true, color: p.dim, glow: 0 });
      if (st.progress > 0) s.stroke([bx + 2, y + 6, bx + 2 + (bw - 4) * st.progress, y + 6], { color: col, width: 4, glow: 0.5 });
      const fund = st.completedAt !== null ? 'DONE' : st.funding === 0 ? 'NONE' : st.funding >= 1 ? 'FULL' : `${(st.funding * 100).toFixed(0)}%`;
      drawText(s, fund, bx + bw + 14, y, 11, { color: col, glow: selected ? 0.8 : 0.2 });
      y += 17;
    });
    const sel = run.programs[this.sel];
    if (sel) drawText(s, programById(sel.id).note.toUpperCase(), m, y + 6, 10, { color: p.hot, glow: 0.5 });
    // Networks, with the detection gauge beside them (or under them on a narrow screen).
    let ny = y + 30;
    const gx = Math.max(m + 560, s.width - 16 - 680);
    const gw = s.width - 16 - gx;
    let listBottom = s.height - 50;
    if (gw >= 380) drawGauge(s, gauge, gx, ny, gw);
    else {
      listBottom = s.height - 64 - gaugeHeight();
      drawGauge(s, gauge, m, listBottom + 8, s.width - 2 * m);
    }
    drawText(s, 'ACTIVE NETWORKS', m, ny, 11, { color: p.dim, glow: 0 });
    ny += 15;
    const active = NETWORKS.filter((n) => run.networks.active.includes(n.id));
    for (const n of active) {
      const since = run.networks.since[n.id] ?? n.since;
      drawText(s, `${n.id.padEnd(22)} ${n.tag.padEnd(10)} ${n.kind.padEnd(15)} SINCE ${Math.floor(since)}`, m, ny, 10, { color: p.ink, glow: 0.2 });
      ny += 13;
      if (ny > listBottom) break;
    }
    void t;
    drawTextFit(s, 'UP / DOWN OR CLICK SELECT    LEFT / RIGHT OR CLICK FUNDING    <ENTER> FULL / NONE    <TAB> STUDIES    <L> LEARN    <G> OR <ESC> CLOSE', s.width / 2, s.height - m - 12, 12, s.width - 32, { align: 'center', color: p.dim, glow: 0 });
  }
}
