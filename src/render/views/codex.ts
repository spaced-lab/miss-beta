// WHAT: CODEX screen (GAME_PLAN 13.9, 22.4): every network, program and method with its tag, basis and equation.
// WHY:  The REAL / PROPOSED / SPECULATIVE / FICTION distinction is taught here, generated from config so it
//       cannot drift from the simulation. The planner never hides a method's tag.
// HOW:  Three tabs (Left/Right), a scrolling list (Up/Down), the selected entry's details at the bottom.
//       Lore links (the `lore` ids) become clickable in M9.
// LORE: G6 (modes and cheats), D11 (the catalog and the chart), F5, G4

import methodsJson from '../../config/methods.json';
import type { Router, Screen } from '../../game/screen';
import { NETWORKS } from '../../sim/detection';
import { PROGRAMS } from '../../sim/programs';
import type { Input } from '../../ui/input';
import type { Surface } from '../canvas';
import { drawText, drawTextFit } from '../vectorFont';
import { LorePanel } from './lorePanel';

interface Method {
  id: string;
  name: string;
  tag: string;
  status: string;
  equation: string;
  lore: string;
  unlock: string;
  note?: string;
  forbidden?: string;
}

export const METHODS = (methodsJson as { methods: Method[] }).methods;

interface Row {
  id: string;
  name: string;
  tag: string;
  status: string;
  equation: string;
  lore: string;
  extra: string;
}

const TABS = ['NETWORKS', 'PROGRAMS', 'METHODS'] as const;

export class CodexScreen implements Screen {
  private tab = 2;
  private sel = 0;
  private readonly lore: LorePanel;
  /** Set by main.ts: open the Learning Center on a topic. */
  openCenter: ((id: string) => void) | null = null;
  constructor(private readonly s: Surface, private readonly keys: Input, private readonly router: Router) {
    this.lore = new LorePanel(s, keys);
    this.lore.onCenter = (id) => this.openCenter?.(id);
  }
  enter(): void {}
  exit(): void {}

  private rows(): Row[] {
    if (this.tab === 0) return NETWORKS.map((n) => ({ id: n.id, name: n.name, tag: n.tag, status: n.active ? 'ACTIVE 2026' : `PROGRAM`, equation: n.kind === 'GROUND_OPTICAL' ? `V <= ${n.vLim}, eps >= ${n.epsMin}, p_cover ${n.pCover}` : n.kind === 'SPACE_IR' ? `D >= ${n.dRef} m x (r delta) / ${n.rDeltaRef} AU^2, eps ${n.epsMin}..${n.epsMax}` : n.kind === 'RADAR' ? `tracking within ${n.rangeMaxAu} AU` : n.kind, lore: n.kind === 'SPACE_IR' ? 'F4' : n.kind === 'RADAR' ? 'F6' : 'F5', extra: n.note }));
    if (this.tab === 1) return PROGRAMS.map((p) => ({ id: p.id, name: p.name, tag: p.tag, status: `${p.years} Y, ${p.costPerYear}/Y`, equation: p.effects.map((e) => e.kind + (e.network ? ` ${e.network}` : e.value !== undefined ? ` ${e.value}` : '')).join(', '), lore: 'G4', extra: p.note }));
    return METHODS.map((m) => ({ id: m.id, name: m.name, tag: m.tag, status: m.status, equation: m.equation, lore: m.lore, extra: m.forbidden ? `FORBIDDEN BY: ${m.forbidden}` : `${m.unlock}${m.note ? '. ' + m.note : ''}` }));
  }

  update(): void {
    const k = this.keys;
    if (this.lore.isOpen) {
      this.lore.update();
      return;
    }
    if (k.pressed('Escape')) {
      this.router.go('title');
      return;
    }
    const cur = this.rows()[this.sel];
    if (k.pressed('Slash') && cur) {
      this.lore.show(cur.lore);
      return;
    }
    if (k.pressed('KeyL') && cur && this.openCenter) {
      this.openCenter(cur.lore);
      return;
    }
    if (k.pressed('ArrowLeft')) {
      this.tab = (this.tab + TABS.length - 1) % TABS.length;
      this.sel = 0;
    }
    if (k.pressed('ArrowRight')) {
      this.tab = (this.tab + 1) % TABS.length;
      this.sel = 0;
    }
    const n = this.rows().length;
    if (k.pressed('ArrowUp')) this.sel = (this.sel + n - 1) % n;
    if (k.pressed('ArrowDown')) this.sel = (this.sel + 1) % n;
  }

  render(): void {
    const s = this.s;
    const p = s.palette;
    s.clear();
    const m = 16;
    let x = m;
    TABS.forEach((t, i) => {
      drawText(s, t, x, m, 14, { color: i === this.tab ? p.hot : p.dim, glow: i === this.tab ? 1.5 : 0 });
      x += 140;
    });
    drawText(s, 'TAGS: REAL = FLOWN OR LAB-VERIFIED   PROPOSED = PUBLISHED ENGINEERING   SPECULATIVE = PHYSICS OK, TECHNOLOGY NOT   FICTION = BREAKS PHYSICS', m, m + 18, 9, { color: p.dim, glow: 0 });
    const rows = this.rows();
    const lineH = 15;
    const listTop = m + 36;
    const visible = Math.floor((s.height - listTop - 120) / lineH);
    const start = Math.max(0, Math.min(this.sel - Math.floor(visible / 2), rows.length - visible));
    let y = listTop;
    for (let i = start; i < Math.min(rows.length, start + visible); i++) {
      const r = rows[i];
      if (!r) continue;
      const selected = i === this.sel;
      const tagCol = r.tag === 'REAL' ? p.ink : r.tag === 'PROPOSED' ? p.ink : p.dim;
      if (selected) drawText(s, '>', m - 12, y, 11, { color: p.hot, glow: 1 });
      drawText(s, `${r.tag.padEnd(12)} ${r.name.padEnd(40).slice(0, 40)}  ${r.status}`, m, y, 11, { color: selected ? p.hot : tagCol, glow: selected ? 0.8 : 0.2 });
      y += lineH;
    }
    const r = rows[this.sel];
    if (r) {
      const by = s.height - 100;
      s.stroke([m, by - 10, s.width - m, by - 10], { color: p.dim, glow: 0 });
      drawText(s, `${r.name}   [${r.tag}]   LORE ${r.lore}`, m, by, 12, { color: p.hot, glow: 1 });
      drawText(s, `EQUATION  ${r.equation}`, m, by + 20, 11);
      drawText(s, r.extra.toUpperCase().slice(0, 160), m, by + 38, 10, { color: p.dim, glow: 0 });
    }
    drawTextFit(s, 'LEFT / RIGHT TAB    UP / DOWN SELECT    <?> LORE    <L> LEARNING CENTER    <ESC> TITLE', s.width / 2, s.height - m - 12, 12, s.width - 32, { align: 'center', color: p.dim, glow: 0 });
    this.lore.render();
  }
}
