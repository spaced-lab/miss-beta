// WHAT: The Learning Center (GAME_PLAN 23): topic tree by group with completion, content at a level, the
//       LAB (sliders, live plot, formula with numbers, SHOW CODE path), search, bookmarks, progress, LABS tab.
// WHY:  The whole EDUCATION.md at the player's level, with the demos that reuse the game's real physics.
// HOW:  Three columns: tree (left), content (center), lab (right, when the topic has a built one). Focus
//       cycles TREE -> CONTENT -> LAB with Tab. Search is the typed buffer after `/`. Everything reads the
//       shared LoreStore; labs load through dynamic import on first open.
// LORE: G1, C2

import type { Router, Screen, ScreenId } from '../../game/screen';
import type { Settings } from '../../game/settings';
import { LEVELS, LEVEL_TABS, markdownToLines, type Chunk, type Level, type LoreIndex, type LoreLine, type TopicMeta } from '../../lore/index';
import { BUILT_LABS, labStatus, loadLab } from '../../lore/labs/index';
import { nudge, values, type Lab } from '../../lore/labs/lab';
import { bookmarks, lore, progress, recordRead, toggleBookmark } from '../../lore/store';
import type { Input } from '../../ui/input';
import type { Surface } from '../canvas';
import { drawPicture } from '../pictureCache';
import { modelForTopic } from '../../lore/models/catalog';
import { drawModel } from '../../lore/models/viewer';
import type { DataPanel } from '../../lore/data/panels';
import { ADVANCE, charsPerLine, drawText, drawTextFit, GLYPH_H, getTextScale, substitute, wrapText } from '../vectorFont';

type Focus = 'TREE' | 'CONTENT' | 'LAB';
type View = 'TOPICS' | 'LABS' | 'BOOKMARKS';

/** The real-data panels (and their JSON) load on first use: they stay out of the main bundle (EDUCATION 0.4). */
let panelsMod: typeof import('../../lore/data/panels') | null = null;
let panelsLoading = false;
function panels(): typeof import('../../lore/data/panels') | null {
  if (!panelsMod && !panelsLoading) {
    panelsLoading = true;
    void import('../../lore/data/panels').then((m) => (panelsMod = m));
  }
  return panelsMod;
}

export class CenterScreen implements Screen {
  private index: LoreIndex | null = null;
  private status = '';
  private sel = 0;
  private topicId = '';
  level: Level = 'BEGINNER';
  private chunk: Chunk | null = null;
  private lines: LoreLine[] = [];
  private linesCols = 0;
  /** Mouse targets from the last frame: tree rows (list index) and level tabs. */
  private rowHits: { y: number; h: number; idx: number }[] = [];
  private tabHits: { x: number; y: number; level: Level }[] = [];
  private scroll = 0;
  private focus: Focus = 'TREE';
  private view: View = 'TOPICS';
  private lab: Lab | null = null;
  private labSel = 0;
  private search = '';
  private searching = false;
  private token = 0;
  returnTo: ScreenId = 'title';

  constructor(private readonly s: Surface, private readonly keys: Input, private readonly router: Router, private readonly settings: Settings) {}

  /** Open on a topic (from the lore panel or the codex). */
  openTopic(id: string, level?: Level): void {
    this.pendingTopic = id;
    if (level) this.level = level;
  }
  private pendingTopic: string | null = null;

  enter(): void {
    this.level = this.pendingTopic ? this.level : (this.settings.learningLevel as Level);
    this.keys.textMode = false;
    this.status = 'LOADING INDEX';
    void lore
      .loadIndex()
      .then((ix) => {
        this.index = ix;
        this.status = '';
        const list = this.list();
        if (this.pendingTopic) {
          const i = list.findIndex((t) => t.id === this.pendingTopic);
          this.sel = Math.max(0, i);
          this.pendingTopic = null;
        }
        this.select(this.sel);
      })
      .catch((e: unknown) => {
        this.status = `LORE UNAVAILABLE: ${String(e).slice(0, 60)}`;
      });
  }
  exit(): void {
    this.keys.textMode = false;
    this.searching = false;
  }

  /** The visible topic list for the current view and search. */
  private list(): TopicMeta[] {
    const ix = this.index;
    if (!ix) return [];
    let ts = ix.topics;
    if (this.view === 'LABS') ts = ts.filter((t) => t.demoId);
    if (this.view === 'BOOKMARKS') ts = ts.filter((t) => bookmarks.includes(t.id));
    const q = this.search.trim().toLowerCase();
    if (q) ts = ts.filter((t) => t.id.toLowerCase().includes(q) || t.title.toLowerCase().includes(q) || t.tags.some((g) => g.includes(q)));
    return ts;
  }

  private select(i: number): void {
    const list = this.list();
    if (list.length === 0) return;
    this.sel = ((i % list.length) + list.length) % list.length;
    const t = list[this.sel] as TopicMeta;
    if (t.id !== this.topicId || !this.chunk || this.chunk.level !== this.level) this.load(t);
  }

  private load(t: TopicMeta): void {
    this.topicId = t.id;
    this.chunk = null;
    this.lines = [];
    this.scroll = 0;
    this.lab = null;
    const lv = t.levels.includes(this.level) ? this.level : (t.levels[0] ?? 'BEGINNER');
    const token = ++this.token;
    void lore
      .chunk(t.id, lv)
      .then((c) => {
        if (token !== this.token) return;
        this.chunk = c;
        this.linesCols = 0; // re-wrapped in render() at the pane's current width
        recordRead(t.id, c.level);
        if (c.level === 'EXPERT' && t.demoId && labStatus(t.demoId) === 'BUILT') return loadLab(t.demoId).then((l) => {
          if (token === this.token) this.lab = l;
        });
        return undefined;
      })
      .catch((e: unknown) => {
        if (token !== this.token) return;
        // A preview rebuilt while the page is open serves new chunk names; the old page cannot fetch them.
        this.status = /dynamically imported|Failed to fetch|Importing a module/i.test(String(e)) ? 'THE GAME WAS REBUILT: RELOAD THE PAGE (CMD-R / CTRL-R)' : `CHUNK FAILED: ${String(e).slice(0, 60)}`;
      });
  }

  /**
   * Three panes at every level (owner, 2026-10-18): the topic tree, a reading column capped at
   * READ_COLS characters (page-width proportions), and a right pane for the lab or left blank. The SIMPLE
   * picture may use the reading column plus the empty right pane; prose never gets wider than READ_COLS.
   */
  static readonly READ_COLS = 72;
  static readonly LAB_MIN = 360;
  static readonly LAB_MAX = 460;
  private treeW(): number {
    return Math.min(300, Math.max(200, this.s.width * 0.22));
  }
  private wantsLab(): boolean {
    return this.lab !== null || (this.chunk?.level === 'EXPERT' && !!this.index?.topics.find((t) => t.id === this.topicId)?.demoId);
  }
  /** Px for `cols` characters at cap height `size`, TEXT SIZE included. */
  private colsPx(cols: number, size: number): number {
    return (cols * ADVANCE * size * getTextScale()) / GLYPH_H;
  }
  private layout(): { tw: number; cx0: number; cw: number; rx: number; rw: number } {
    const m = 16;
    const tw = this.treeW();
    const cx0 = m + tw + 16;
    const avail = this.s.width - m - cx0;
    const read = this.colsPx(CenterScreen.READ_COLS, 9) + 8;
    let cw: number;
    if (this.wantsLab()) {
      // The lab gets what the reading column leaves, within its bounds; the column shrinks only if it must.
      const lw = Math.max(CenterScreen.LAB_MIN, Math.min(CenterScreen.LAB_MAX, avail - read - 24));
      cw = Math.max(this.colsPx(36, 9), Math.min(read, avail - lw - 24));
    } else cw = Math.min(read, avail);
    const rx = cx0 + cw + 24;
    return { tw, cx0, cw, rx, rw: Math.max(0, this.s.width - m - rx) };
  }
  private contentCols(): number {
    return charsPerLine(this.layout().cw, 9);
  }
  /** Re-wrap the chunk when the reading column's width changed (lab arrived, resize, TEXT SIZE). */
  private ensureLines(): void {
    const cols = this.contentCols();
    if (this.chunk && cols !== this.linesCols) {
      this.lines = markdownToLines(this.chunk.markdown, cols);
      this.linesCols = cols;
      this.scroll = Math.min(this.scroll, Math.max(0, this.lines.length - 1));
    }
  }

  update(): void {
    const k = this.keys;
    // Mouse: click a topic row or a level tab; the wheel scrolls the reading column.
    const click = k.takeClick();
    if (click && !this.searching) {
      const tab = this.tabHits.find((t) => Math.abs(click.x - t.x - 5) < 10 && Math.abs(click.y - t.y - 7) < 12);
      if (tab) {
        this.level = tab.level;
        const t = this.list()[this.sel];
        if (t) this.load(t);
        return;
      }
      const row = this.rowHits.find((r) => click.x < this.treeW() + 16 && click.y >= r.y && click.y < r.y + r.h);
      if (row) {
        this.focus = 'TREE';
        this.select(row.idx);
        return;
      }
    }
    const wheel = k.takeWheel();
    if (wheel !== 0 && this.lines.length > 0) this.scroll = Math.max(0, Math.min(Math.max(0, this.lines.length - 8), this.scroll + Math.sign(wheel) * 3));
    if (this.searching) {
      for (const ev of k.takeKeyEvents()) {
        if (ev === 'Enter') this.searching = false;
        else if (ev === 'Backspace') this.search = this.search.slice(0, -1);
        else if (ev.length === 1 && ev !== '/') this.search += ev;
      }
      if (k.pressed('Escape')) {
        this.search = '';
        this.searching = false;
      }
      k.textMode = this.searching;
      this.sel = 0;
      this.select(0);
      return;
    }
    if (k.pressed('Escape')) {
      this.router.go(this.returnTo);
      return;
    }
    if (k.pressed('Slash')) {
      this.searching = true;
      k.textMode = true;
      k.takeKeyEvents();
      return;
    }
    if (k.pressed('Tab')) this.focus = this.focus === 'TREE' ? 'CONTENT' : this.focus === 'CONTENT' && this.lab ? 'LAB' : 'TREE';
    if (k.pressed('KeyB') && this.topicId) toggleBookmark(this.topicId);
    if (k.pressed('KeyV')) {
      this.view = this.view === 'TOPICS' ? 'LABS' : this.view === 'LABS' ? 'BOOKMARKS' : 'TOPICS';
      this.sel = 0;
      this.select(0);
    }
    for (let i = 0; i < LEVELS.length; i++) {
      if (k.pressed(`Digit${i + 1}`)) {
        this.level = LEVELS[i] as Level;
        const t = this.list()[this.sel];
        if (t) this.load(t);
      }
    }
    if (k.pressed('ArrowLeft') || k.pressed('ArrowRight')) {
      if (this.focus === 'LAB' && this.lab) {
        const sl = this.lab.sliders[this.labSel];
        if (sl) nudge(sl, k.pressed('ArrowRight') ? 1 : -1);
      } else {
        const i = LEVELS.indexOf(this.level) + (k.pressed('ArrowRight') ? 1 : -1);
        this.level = LEVELS[((i % LEVELS.length) + LEVELS.length) % LEVELS.length] as Level;
        const t = this.list()[this.sel];
        if (t) this.load(t);
      }
    }
    const up = k.pressed('ArrowUp');
    const down = k.pressed('ArrowDown');
    if (up || down) {
      if (this.focus === 'TREE') this.select(this.sel + (down ? 1 : -1));
      else if (this.focus === 'CONTENT') this.scroll = Math.max(0, Math.min(Math.max(0, this.lines.length - 8), this.scroll + (down ? 3 : -3)));
      else if (this.lab) this.labSel = (this.labSel + (down ? 1 : this.lab.sliders.length - 1)) % this.lab.sliders.length;
    }
    if (k.pressed('Enter') && this.focus === 'TREE') this.focus = 'CONTENT';
    if (this.lab && k.held('ShiftLeft')) {
      // Shift + Left/Right handled above by nudge; Shift alone does nothing.
    }
  }

  render(): void {
    const s = this.s;
    const p = s.palette;
    s.clear();
    const m = 16;
    this.rowHits.length = 0;
    this.tabHits.length = 0;
    this.ensureLines();
    const { tw, cx0, cw, rx, rw } = this.layout();
    const lw = this.wantsLab() ? Math.min(rw, CenterScreen.LAB_MAX) : 0;
    // Without a lab the right pane shows the topic's 3-D model when there is room for one.
    // Real data first (it is the stronger evidence), then the device model.
    const pm = panels();
    const dataPanel: DataPanel | null = lw === 0 && rw >= 260 && pm ? pm.panelForTopic(this.topicId) : null;
    const model = lw === 0 && rw >= 260 && !dataPanel ? modelForTopic(this.topicId) : null;
    const free = lw === 0 && !model && !dataPanel ? rw : 0;
    const readCount = this.index ? this.index.topics.filter((t) => progress[t.id]).length : 0;
    drawText(s, 'LEARNING CENTER', m, m, 16, { color: p.hot, glow: 1.5 });
    drawText(s, `${readCount} OF ${this.index?.topics.length ?? 0} TOPICS READ   LEVEL ${this.level}   VIEW ${this.view}${this.search ? `   SEARCH "${this.search.toUpperCase()}"` : ''}`, m + 270, m + 3, 10, { color: p.dim, glow: 0 });
    let tx = s.width - m - 120;
    for (const lv of LEVELS) {
      const on = lv === this.level;
      drawText(s, LEVEL_TABS[lv], tx, m + 2, 12, { color: on ? p.hot : p.ink, glow: on ? 1.2 : 0.3 });
      this.tabHits.push({ x: tx, y: m + 2, level: lv });
      tx += 22;
    }
    if (this.status) drawTextFit(s, this.status, m, m + 24, 10, s.width - 2 * m, { color: p.hot, glow: 0.5 });
    // Tree.
    const top = m + 40;
    const list = this.list();
    const lineH = 14;
    const rows = Math.floor((s.height - top - 50) / lineH);
    const start = Math.max(0, Math.min(this.sel - Math.floor(rows / 2), list.length - rows));
    let y = top;
    let lastGroup = '';
    const groups = this.index?.groups ?? {};
    for (let i = start; i < Math.min(list.length, start + rows); i++) {
      const t = list[i] as TopicMeta;
      if (t.group !== lastGroup && this.view === 'TOPICS' && !this.search) {
        drawText(s, cutWords(`${t.group}  ${groups[t.group] ?? ''}`, charsPerLine(tw - 8, 9)), m, y, 9, { color: p.dim, glow: 0 });
        lastGroup = t.group;
        y += lineH;
        if (y > s.height - 60) break;
      }
      if (y > s.height - 60) break; // group headers take rows too: stop above the footer
      const on = i === this.sel;
      this.rowHits.push({ y: y - 2, h: lineH, idx: i });
      const read = progress[t.id];
      const mark = bookmarks.includes(t.id) ? '*' : read ? (LEVEL_TABS[read as Level] ?? '.') : ' ';
      drawText(s, cutWords(`${on ? '>' : ' '}${mark} ${t.id.padEnd(4)} ${substitute(t.title).toUpperCase()}`, charsPerLine(tw - 8, 9)), m, y, 9, { color: on ? p.hot : p.ink, glow: on ? 1 : 0.2 });
      y += lineH;
    }
    // Content.
    s.stroke([cx0 - 8, top - 6, cx0 - 8, s.height - 40], { color: p.dim, glow: 0 });
    const c = this.chunk;
    let cy = top;
    if (c) {
      drawTextFit(s, `${c.id}  ${substitute(c.title).toUpperCase()}`, cx0, cy, 12, cw + free,  { color: this.focus === 'CONTENT' ? p.hot : p.ink, glow: 1 });
      cy += 22;
      if (c.pictureId && c.level === 'SIMPLE') {
        // The picture may spill into the empty right pane; the prose below stays at reading width.
        const pw = Math.min(cw + free, 560);
        drawPicture(s, c.pictureId, cx0, cy, pw, (pw * 320) / 480);
        cy += (pw * 320) / 480 + 12;
        if (c.pictureCaption) {
          drawTextFit(s, substitute(c.pictureCaption), cx0, cy, 8, pw, { color: p.dim, glow: 0, lower: true });
          cy += 16;
        }
      }
      const maxLines = Math.floor((s.height - 50 - cy) / 13);
      for (const l of this.lines.slice(this.scroll, this.scroll + maxLines)) {
        const txt = substitute(l.text);
        if (l.kind === 'head') drawTextFit(s, txt.toUpperCase(), cx0, cy, 10, cw, { color: p.hot, glow: 0.8 });
        // Code and tables are never re-wrapped (columns would break): they may use the empty right pane, else shrink.
        else if (l.kind === 'code' || l.kind === 'table') drawTextFit(s, txt, cx0 + 6, cy, 8, cw + free - 6, { color: p.ink, glow: 0.2, lower: true });
        else drawText(s, txt, cx0, cy, 9, { color: p.ink, glow: 0.3, lower: true });
        cy += 13;
      }
      if (this.lines.length > this.scroll + maxLines) drawTextFit(s, `... ${this.lines.length - this.scroll - maxLines} MORE (TAB TO CONTENT, DOWN)`, cx0, cy, 9, cw, { color: p.dim, glow: 0 });
      const meta = this.index?.topics.find((t) => t.id === c.id);
      if (meta && meta.related.length > 0) drawText(s, cutWords(`RELATED ${meta.related.join(' ')}   IN GAME: ${meta.game.join(', ').toUpperCase()}`, charsPerLine(cw, 8)), cx0, s.height - 52, 8, { color: p.dim, glow: 0 });
    } else if (!this.status) drawText(s, 'LOADING', cx0, cy, 10, { color: p.dim, glow: 0 });
    if (dataPanel) {
      s.stroke([rx - 8, top - 6, rx - 8, s.height - 40], { color: p.dim, glow: 0 });
      pm?.drawPanel(s, dataPanel, { x: rx, y: top, w: Math.min(rw, CenterScreen.LAB_MAX), h: s.height - 46 - top }, this.settings.reduceMotion ? 60 : performance.now() / 1000);
    }
    if (model) {
      s.stroke([rx - 8, top - 6, rx - 8, s.height - 40], { color: p.dim, glow: 0 });
      drawModel(s, model, { x: rx, y: top, w: Math.min(rw, CenterScreen.LAB_MAX), h: s.height - 46 - top }, this.settings.reduceMotion ? 2 : performance.now() / 1000);
    }
    // Lab.
    if (lw > 0) {
      const lx = rx;
      s.stroke([lx - 8, top - 6, lx - 8, s.height - 40], { color: p.dim, glow: 0 });
      const meta = this.index?.topics.find((t) => t.id === this.topicId);
      const lab = this.lab;
      if (!lab) drawText(s, `LAB ${meta?.demoId ?? ''}: ${labStatus(meta?.demoId ?? null) === 'BUILT' ? 'LOADING' : 'BACKLOG'}`, lx, top, 10, { color: p.dim, glow: 0 });
      else {
        drawText(s, lab.title, lx, top, 10, { color: this.focus === 'LAB' ? p.hot : p.ink, glow: 1 });
        let ly = top + 20;
        const v = values(lab.sliders);
        lab.sliders.forEach((sl, i) => {
          const on = this.focus === 'LAB' && i === this.labSel;
          const frac = sl.log ? Math.log(sl.value / sl.min) / Math.log(sl.max / sl.min) : (sl.value - sl.min) / (sl.max - sl.min);
          drawText(s, `${on ? '>' : ' '} ${sl.label}`, lx, ly, 8, { color: on ? p.hot : p.ink, glow: on ? 0.8 : 0.2 });
          const bx = lx + Math.min(150, lw * 0.4);
          const bw = Math.max(40, lw - (bx - lx) - 80);
          s.stroke([bx, ly + 4, bx + bw, ly + 4], { color: p.dim, glow: 0 });
          s.circle(bx + frac * bw, ly + 4, 3, { color: on ? p.hot : p.ink, glow: on ? 1 : 0.3 });
          drawText(s, `${sl.value === 0 ? '0' : Math.abs(sl.value) >= 1e5 || Math.abs(sl.value) < 0.01 ? sl.value.toExponential(2) : Number(sl.value.toPrecision(4))}`, bx + bw + 8, ly, 8, { color: p.dim, glow: 0, align: 'left' });
          ly += 16;
        });
        // The plot takes the pane's height minus room for the formula lines and SHOW CODE.
        const plotH = Math.max(160, Math.min(lw * 0.9, s.height - ly - 170));
        // Clip the plot to its frame: a curve that leaves the axes must not draw over the sliders or the text.
        s.ctx.save();
        s.ctx.beginPath();
        s.ctx.rect(lx - 2, ly + 4, lw + 4, plotH + 4);
        s.ctx.clip();
        lab.draw(s, v, { x: lx, y: ly + 6, w: lw, h: plotH }, performance.now() / 1000);
        s.ctx.restore();
        ly += plotH + 14;
        for (const line of lab.lines(v)) {
          for (const w of wrapText(substitute(line), lw, 8)) {
            drawText(s, w, lx, ly, 8, { color: p.ink, glow: 0.3, lower: true });
            ly += 11;
          }
          ly += 2;
        }
        ly += 4;
        drawText(s, 'SHOW CODE:', lx, ly, 8, { color: p.hot, glow: 0.5 });
        ly += 12;
        for (const cpath of lab.code) {
          drawTextFit(s, cpath, lx, ly, 8, lw, { color: p.dim, glow: 0, lower: true });
          ly += 11;
        }
      }
    }
    drawTextFit(s, `CLICK A TOPIC OR TAB   WHEEL SCROLLS   UP/DOWN ${this.focus === 'TREE' ? 'TOPIC' : this.focus === 'CONTENT' ? 'SCROLL' : 'SLIDER'}   LEFT/RIGHT ${this.focus === 'LAB' ? 'ADJUST' : 'LEVEL'}   1-5 LEVEL   TAB FOCUS (${this.focus})   V VIEW   B BOOKMARK   / SEARCH   ESC BACK TO ${this.returnTo.toUpperCase()}   LABS ${BUILT_LABS.length} OF 20`.slice(0, charsPerLine(s.width - 2 * m, 9)), s.width / 2, s.height - m - 10, 9, s.width - 2 * m, { align: 'center', color: p.dim, glow: 0 });
  }
}

/** Cut `text` to `cols` characters at a word boundary, marking the cut with "..": no half words in a column. */
export function cutWords(text: string, cols: number): string {
  if (text.length <= cols) return text;
  const room = Math.max(1, cols - 2);
  const cut = text.lastIndexOf(' ', room);
  return (cut > cols * 0.5 ? text.slice(0, cut) : text.slice(0, room)).trimEnd() + '..';
}
