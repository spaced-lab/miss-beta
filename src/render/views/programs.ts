// WHAT: PROGRAMS panel (GAME_PLAN 13.8, 19): run-level projects with progress bars and funding, plus the
//       active network list.
// WHY:  The early programs are cheap and real; the player who ignores them loses to a sunward rock in
//       round 5. This panel is where that lesson is bought.
// HOW:  Up/Down select, Left/Right set funding in steps of 0.25, Enter toggles full/none. Progress and cost
//       are read from the run; the sim advances them with the clock (sim/programs.ts).
// LORE: G4 (programs), F7 (future missions)

import type { RunState } from '../../game/run';
import { NETWORKS } from '../../sim/detection';
import { programBurn, programById } from '../../sim/programs';
import type { Input } from '../../ui/input';
import type { Surface } from '../canvas';
import { withAlpha } from '../palettes';
import { drawText } from '../vectorFont';

export class ProgramsOverlay {
  private open = false;
  private sel = 0;
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

  update(run: RunState): void {
    if (!this.open) return;
    const k = this.keys;
    if (k.pressed('Escape') || k.pressed('KeyG')) {
      this.hide();
      return;
    }
    const n = run.programs.length;
    if (k.pressed('ArrowUp')) this.sel = (this.sel + n - 1) % n;
    if (k.pressed('ArrowDown')) this.sel = (this.sel + 1) % n;
    const st = run.programs[this.sel];
    if (!st || st.completedAt !== null) return;
    if (k.pressed('ArrowRight')) st.funding = Math.min(1, Math.round((st.funding + 0.25) * 4) / 4);
    if (k.pressed('ArrowLeft')) st.funding = Math.max(0, Math.round((st.funding - 0.25) * 4) / 4);
    if (k.pressed('Enter')) st.funding = st.funding > 0 ? 0 : 1;
  }

  render(run: RunState, budget: number, t: number): void {
    if (!this.open) return;
    const s = this.s;
    const p = s.palette;
    const m = 16;
    s.ctx.fillStyle = withAlpha(p.bg, 0.88);
    s.ctx.fillRect(0, 0, s.width, s.height);
    const burn = programBurn(run.programs);
    drawText(s, `PROGRAMS   BUDGET ${budget.toFixed(1)}  (+${run.economy.perYear}/Y  -${burn.toFixed(2)}/Y PROGRAMS)`, m, m, 14, { color: p.hot, glow: 1.2 });
    drawText(s, 'ID                          TAG       YEARS  COST/Y     PROGRESS                 FUNDING', m, m + 26, 10, { color: p.dim, glow: 0 });
    let y = m + 44;
    run.programs.forEach((st, i) => {
      const def = programById(st.id);
      const selected = i === this.sel;
      const col = st.completedAt !== null ? p.dim : selected ? p.hot : p.ink;
      const bx = m + 480;
      const bw = 150;
      const line = `${def.id.padEnd(26)} ${def.tag.padEnd(9)} ${String(def.years).padStart(3)}    ${String(def.costPerYear).padStart(3)}`;
      if (selected) drawText(s, '>', m - 12, y, 11, { color: p.hot, glow: 1 });
      drawText(s, line, m, y, 11, { color: col, glow: selected ? 0.8 : 0.2 });
      s.stroke([bx, y + 2, bx + bw, y + 2, bx + bw, y + 10, bx, y + 10], { closed: true, color: p.dim, glow: 0 });
      if (st.progress > 0) s.stroke([bx + 2, y + 6, bx + 2 + (bw - 4) * st.progress, y + 6], { color: col, width: 4, glow: 0.5 });
      const fund = st.completedAt !== null ? 'DONE' : st.funding === 0 ? 'NONE' : st.funding >= 1 ? 'FULL' : `${(st.funding * 100).toFixed(0)}%`;
      drawText(s, fund, bx + bw + 14, y, 11, { color: col, glow: selected ? 0.8 : 0.2 });
      y += 17;
    });
    const sel = run.programs[this.sel];
    if (sel) drawText(s, programById(sel.id).note.toUpperCase(), m, y + 6, 10, { color: p.hot, glow: 0.5 });
    // Networks.
    let ny = y + 30;
    drawText(s, 'ACTIVE NETWORKS', m, ny, 11, { color: p.dim, glow: 0 });
    ny += 15;
    const active = NETWORKS.filter((n) => run.networks.active.includes(n.id));
    for (const n of active) {
      const since = run.networks.since[n.id] ?? n.since;
      drawText(s, `${n.id.padEnd(22)} ${n.tag.padEnd(10)} ${n.kind.padEnd(15)} SINCE ${Math.floor(since)}`, m, ny, 10, { color: p.ink, glow: 0.2 });
      ny += 13;
      if (ny > s.height - 50) break;
    }
    void t;
    drawText(s, 'UP / DOWN SELECT    LEFT / RIGHT FUNDING    <ENTER> FULL / NONE    <G> OR <ESC> CLOSE', s.width / 2, s.height - m - 12, 12, { align: 'center', color: p.dim, glow: 0 });
  }
}
