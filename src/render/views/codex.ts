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
import { drawText, drawTextFit, wrapText } from '../vectorFont';
import { ScreenBar } from '../../ui/actionBar';
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

  /** The action bar (ui/actionBar.ts). */
  private readonly bar = new ScreenBar();
  /** Row hit boxes from the last frame (a tap selects; a second tap opens the lore). */
  private rowHits: { y: number; h: number; idx: number }[] = [];
  private compact(): boolean {
    return this.s.width < 700;
  }
  update(): void {
    const k = this.keys;
    this.bar.tap(k);
    if (this.lore.isOpen) {
      this.lore.update();
      return;
    }
    if (k.pressed('Escape')) {
      this.router.go('title');
      return;
    }
    const click = k.takeClick();
    if (click) {
      const row = this.rowHits.find((r) => click.y >= r.y && click.y < r.y + r.h);
      if (row && row.idx === this.sel) k.inject('Slash');
      else if (row) this.sel = row.idx;
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
    const compact = this.compact();
    let x = this.keys.touchUsed ? m + 30 : m;
    const tabStep = compact ? (s.width - x - m) / TABS.length : 140;
    TABS.forEach((t, i) => {
      drawTextFit(s, t, x, m, compact ? 11 : 14, tabStep - 8, { color: i === this.tab ? p.hot : p.dim, glow: i === this.tab ? 1.5 : 0 });
      x += tabStep;
    });
    drawTextFit(s, 'TAGS: REAL = FLOWN OR LAB-VERIFIED   PROPOSED = PUBLISHED ENGINEERING   SPECULATIVE = PHYSICS OK, TECHNOLOGY NOT   FICTION = BREAKS PHYSICS', m, m + 18, compact ? 7 : 9, s.width - 2 * m, { color: p.dim, glow: 0 });
    const rows = this.rows();
    const lineH = compact ? 14 : 15;
    const listTop = m + 36;
    // The detail block under the list: three lines on a desktop, name + equation + two wrapped lines on a phone.
    const detailH = compact ? 72 : 110;
    const bottom = s.height - this.bar.height;
    const visible = Math.max(3, Math.floor((bottom - listTop - detailH - 10) / lineH));
    const start = Math.max(0, Math.min(this.sel - Math.floor(visible / 2), rows.length - visible));
    let y = listTop;
    this.rowHits = [];
    for (let i = start; i < Math.min(rows.length, start + visible); i++) {
      const r = rows[i];
      if (!r) continue;
      const selected = i === this.sel;
      const tagCol = r.tag === 'REAL' ? p.ink : r.tag === 'PROPOSED' ? p.ink : p.dim;
      if (selected) drawText(s, '>', m - 12, y, 11, { color: p.hot, glow: 1 });
      this.rowHits.push({ y: y - 2, h: lineH, idx: i });
      // A phone shows the tag's first letter and cuts the name to the width.
      if (compact) drawTextFit(s, `${r.tag.charAt(0)}  ${r.name}  ${r.status}`, m, y, 9, s.width - 2 * m, { color: selected ? p.hot : tagCol, glow: selected ? 0.8 : 0.2 });
      else drawText(s, `${r.tag.padEnd(12)} ${r.name.padEnd(40).slice(0, 40)}  ${r.status}`, m, y, 11, { color: selected ? p.hot : tagCol, glow: selected ? 0.8 : 0.2 });
      y += lineH;
    }
    const r = rows[this.sel];
    if (r) {
      const by = bottom - detailH + 10;
      s.stroke([m, by - 10, s.width - m, by - 10], { color: p.dim, glow: 0 });
      drawTextFit(s, `${r.name}   [${r.tag}]   LORE ${r.lore}`, m, by, compact ? 10 : 12, s.width - 2 * m, { color: p.hot, glow: 1 });
      drawTextFit(s, `EQUATION  ${r.equation}`, m, by + (compact ? 15 : 20), compact ? 9 : 11, s.width - 2 * m);
      if (compact) {
        let ey = by + 29;
        for (const l of wrapText(r.extra.toUpperCase(), s.width - 2 * m, 8).slice(0, 2)) {
          drawText(s, l, m, ey, 8, { color: p.dim, glow: 0 });
          ey += 11;
        }
      } else drawTextFit(s, r.extra.toUpperCase().slice(0, 160), m, by + 38, 10, s.width - 2 * m, { color: p.dim, glow: 0 });
    }
    this.bar.draw(s, this.lore.isOpen ? [{ label: 'UP', code: 'ArrowUp' }, { label: 'DOWN', code: 'ArrowDown' }, { label: 'LEVEL', code: 'Tab', key: 'TAB' }, { label: 'LEARN MORE', code: 'KeyL', key: 'L' }, { label: 'CLOSE', code: 'Escape', key: 'ESC' }] : [{ label: '< TAB', code: 'ArrowLeft' }, { label: 'TAB >', code: 'ArrowRight' }, { label: 'UP', code: 'ArrowUp' }, { label: 'DOWN', code: 'ArrowDown' }, { label: 'LORE', code: 'Slash', key: '?' }, { label: 'LEARN', code: 'KeyL', key: 'L' }, { label: 'TITLE', code: 'Escape', key: 'ESC' }], this.keys.touchUsed || compact);
    this.lore.bottomInset = this.bar.height;
    this.lore.render();
  }
}
