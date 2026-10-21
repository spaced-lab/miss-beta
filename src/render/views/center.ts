// WHAT: The Learning Center (GAME_PLAN 23): topic tree by group with completion, content at a level, the
//       LAB (sliders, live plot, formula with numbers, SHOW CODE path), search, bookmarks, progress, LABS tab.
// WHY:  The whole EDUCATION.md at the player's level, with the demos that reuse the game's real physics.
// HOW:  Three columns: tree (left), content (center), lab (right, when the topic has a built one). Focus
//       cycles TREE -> CONTENT -> LAB with Tab. Search is the typed buffer after `/`. Everything reads the
//       shared LoreStore; labs load through dynamic import on first open. Three layouts by window size
//       (`mode()`): FULL (desktop), WIDE (a phone held sideways: tree + column + arrow strip) and STACK (a phone
//       held upright: one pane at a time, TOPICS / READ / SIDE, switched by the button bar). The side pane holds
//       what the desktop's right pane would: the lab, else the real-data panel, else the rotating model.
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
import { uiColors, withAlpha } from '../palettes';
import { modelForTopic } from '../../lore/models/catalog';
import { answer, current as quizCurrent, next as quizNext, startQuiz, type QuizState } from '../../lore/quiz';
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

/** A compact-layout button's action. */
type NavAct = 'UP' | 'DOWN' | 'TOPIC_UP' | 'TOPIC_DOWN' | 'LEVEL_DOWN' | 'LEVEL_UP' | 'VIEW' | 'QUIZ' | 'SIDE' | 'TREE' | 'READ' | 'BOOKMARK' | 'BACK' | 'FIND';
/** The compact layouts' panes: the topic list, the reading column, the side pane (lab / data / model). */
type Pane = 'TREE' | 'READ' | 'SIDE';
type Mode = 'FULL' | 'WIDE' | 'STACK';
type SideKind = 'LAB' | 'DATA' | 'MODEL';

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
  /** The quiz, open over the reading column (Q), or null. */
  private quiz: QuizState | null = null;
  private quizHits: { y: number; h: number; choice: number }[] = [];
  private tabHits: { x: number; y: number; level: Level }[] = [];
  private scroll = 0;
  private focus: Focus = 'TREE';
  private view: View = 'TOPICS';
  private lab: Lab | null = null;
  private labSel = 0;
  private search = '';
  private searching = false;
  private token = 0;
  /** Lab slider tracks from the last frame (a tap or drag on one sets its value). */
  private sliderHits: { i: number; x: number; y: number; w: number; h: number }[] = [];
  /** Compact layouts: the pane shown in the column (WIDE: READ or SIDE; STACK: any of the three). */
  private pane: Pane = 'READ';
  private side: SideKind = 'LAB';
  /** Compact layout's touch buttons, rebuilt every frame by render(). */
  private navHits: { x: number; y: number; w: number; h: number; act: NavAct }[] = [];
  /** Vertical drag carried between frames, px (a drag scrolls the column under the finger). */
  private dragY = 0;
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
    this.keys.softKeyboard(false);
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
  /** Width of the compact layout's arrow strip, px. */
  static readonly STRIP = 34;
  /**
   * NOTE: owner 2026-10-21 ("make the navigation in learning center present ok on a phone in landscape mode ... it
   * will need some navigation arrows on the side and text wrap will need to work. text can be quite small"): under
   * 900 x 500 the screen goes compact: two panes (a narrow tree and the reading column, which the lab replaces on
   * LAB), 8 px text wrapped to the column, an arrow strip on the right edge, topic arrows under the tree and a button
   * bar at the bottom. The keys keep working the same way.
   */
  private mode(): Mode {
    const { width: w, height: h } = this.s;
    if (w < 560 || (w < h && w < 900)) return 'STACK';
    return w < 900 || h < 500 ? 'WIDE' : 'FULL';
  }
  private compact(): boolean {
    return this.mode() !== 'FULL';
  }
  private stack(): boolean {
    return this.mode() === 'STACK';
  }
  /** Reading text size and line height. NOTE: 9 px sideways and 10 px upright (owner 2026-10-21: readable). */
  private fs(): number {
    const m = this.mode();
    return m === 'STACK' ? 10 : 9;
  }
  private lineH(): number {
    const m = this.mode();
    return m === 'STACK' ? 14 * getTextScale() : m === 'WIDE' ? 12.5 * getTextScale() : 13;
  }
  private treeW(): number {
    return this.compact() ? Math.max(150, this.s.width * 0.3) : Math.min(300, Math.max(200, this.s.width * 0.22));
  }
  /** What the side pane can show for this topic in a compact layout, in the order the SIDE button cycles them. */
  private sideKinds(): SideKind[] {
    const out: SideKind[] = [];
    const t = this.index?.topics.find((q) => q.id === this.topicId);
    if (t?.demoId && labStatus(t.demoId) === 'BUILT') out.push('LAB');
    const pm = panels();
    if (pm && pm.panelForTopic(this.topicId)) out.push('DATA');
    if (modelForTopic(this.topicId)) out.push('MODEL');
    return out;
  }
  /** The side pane's content now (the first available kind when the stored one is not for this topic). */
  private sideKind(): SideKind | null {
    const kinds = this.sideKinds();
    return kinds.includes(this.side) ? this.side : (kinds[0] ?? null);
  }
  private wantsLab(): boolean {
    if (this.compact()) return false;
    return this.lab !== null || (this.chunk?.level === 'EXPERT' && !!this.index?.topics.find((t) => t.id === this.topicId)?.demoId);
  }
  /** Px for `cols` characters at cap height `size`, TEXT SIZE included. */
  private colsPx(cols: number, size: number): number {
    return (cols * ADVANCE * size * getTextScale()) / GLYPH_H;
  }
  private layout(): { tw: number; cx0: number; cw: number; rx: number; rw: number } {
    const m = this.compact() ? 12 : 16;
    const tw = this.treeW();
    if (this.stack()) {
      // One pane at a time, as wide as the window less the arrow strip.
      const cx0 = m;
      const cw = Math.max(120, this.s.width - 2 * m - CenterScreen.STRIP - 8);
      return { tw: cw, cx0, cw, rx: this.s.width, rw: 0 };
    }
    if (this.compact()) {
      // Tree, reading column, then the arrow strip (CenterScreen.STRIP px) on the right edge; no right pane.
      const cx0 = m + tw + 12;
      const cw = Math.max(120, this.s.width - cx0 - m - CenterScreen.STRIP - 8);
      return { tw, cx0, cw, rx: this.s.width, rw: 0 };
    }
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
    return charsPerLine(this.layout().cw, this.fs());
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
    // The quiz owns the keys while open: 1-3 or a click answers, N or Enter moves on, Q or Esc closes.
    if (this.quiz) {
      const qz = this.quiz;
      const click = k.takeClick();
      if (click && this.navHits.some((b) => b.act === 'QUIZ' && click.x >= b.x && click.x < b.x + b.w && click.y >= b.y && click.y < b.y + b.h)) {
        this.quiz = null;
        return;
      }
      const hit = click ? this.quizHits.find((h) => click.y >= h.y && click.y < h.y + h.h) : undefined;
      for (let c = 0; c < 3; c++) if (k.pressed(`Digit${c + 1}`)) answer(qz, c);
      if (hit && qz.chosen < 0) answer(qz, hit.choice);
      else if (click && qz.chosen >= 0) quizNext(qz);
      if (qz.chosen >= 0 && (k.pressed('KeyN') || k.pressed('Enter') || k.pressed('Space'))) quizNext(qz);
      if (k.pressed('KeyQ') || k.pressed('Escape')) this.quiz = null;
      return;
    }
    if (k.pressed('KeyQ') && !this.searching) {
      this.quiz = startQuiz((this.topicId || 'T').charAt(0));
      return;
    }
    // Mouse: click a topic row or a level tab; the wheel scrolls the reading column.
    const click = k.takeClick();
    // A tap on a lab slider's track sets it there (the only way to work a lab without arrow keys).
    const sl = click && this.lab ? this.sliderHits.find((h) => click.x >= h.x - 8 && click.x <= h.x + h.w + 8 && click.y >= h.y && click.y < h.y + h.h) : undefined;
    if (sl && this.lab) {
      const slider = this.lab.sliders[sl.i];
      if (slider) {
        const f = Math.max(0, Math.min(1, ((click as { x: number }).x - sl.x) / sl.w));
        slider.value = slider.log ? slider.min * Math.pow(slider.max / slider.min, f) : slider.min + f * (slider.max - slider.min);
        this.labSel = sl.i;
        this.focus = 'LAB';
      }
      return;
    }
    const nav = click ? this.navHits.find((b) => click.x >= b.x && click.x < b.x + b.w && click.y >= b.y && click.y < b.y + b.h && (!this.searching || b.act === 'FIND')) : undefined;
    if (nav) {
      this.navAct(nav.act);
      return;
    }
    // A vertical drag scrolls the column under the finger: the tree left of the reading column, else the text.
    const drag = k.takeDrag();
    if (this.compact() && drag.y !== 0 && !this.searching) {
      this.dragY += drag.y;
      const step = this.lineH() * 2;
      while (Math.abs(this.dragY) >= step) {
        const dir = this.dragY > 0 ? -1 : 1;
        this.dragY -= -dir * step;
        const onTree = this.stack() ? this.pane === 'TREE' : (k.mouse?.x ?? 0) < this.treeW() + 16;
        if (onTree) this.select(this.sel + dir);
        else this.scroll = Math.max(0, Math.min(Math.max(0, this.lines.length - 4), this.scroll + dir * 2));
      }
    }
    if (click && !this.searching) {
      // The level tabs: a finger-sized box in the compact layouts, the glyph's box on the desktop.
      const tab = this.tabHits.find((t) => (this.compact() ? click.x >= t.x - 6 && click.x < t.x + 22 && click.y >= t.y - 8 && click.y < t.y + 24 : Math.abs(click.x - t.x - 5) < 10 && Math.abs(click.y - t.y - 7) < 12));
      if (tab) {
        this.level = tab.level;
        const t = this.list()[this.sel];
        if (t) this.load(t);
        return;
      }
      const treeRight = this.stack() ? this.s.width : this.treeW() + 16;
      const row = this.rowHits.find((r) => click.x < treeRight && click.y >= r.y && click.y < r.y + r.h);
      if (row) {
        this.focus = 'TREE';
        this.select(row.idx);
        // Upright phone: a tapped topic opens for reading (the list is the whole screen).
        if (this.stack()) this.pane = 'READ';
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
      if (!this.searching) k.softKeyboard(false);
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

  /** A compact-layout button. */
  private navAct(a: NavAct): void {
    const page = 6;
    if (a === 'UP' || a === 'DOWN') this.scroll = Math.max(0, Math.min(Math.max(0, this.lines.length - 4), this.scroll + (a === 'DOWN' ? page : -page)));
    else if (a === 'TOPIC_UP' || a === 'TOPIC_DOWN') this.select(this.sel + (a === 'TOPIC_DOWN' ? 1 : -1));
    else if (a === 'LEVEL_UP' || a === 'LEVEL_DOWN') {
      const i = LEVELS.indexOf(this.level) + (a === 'LEVEL_UP' ? 1 : -1);
      this.level = LEVELS[((i % LEVELS.length) + LEVELS.length) % LEVELS.length] as Level;
      const t = this.list()[this.sel];
      if (t) this.load(t);
    } else if (a === 'VIEW') {
      this.view = this.view === 'TOPICS' ? 'LABS' : this.view === 'LABS' ? 'BOOKMARKS' : 'TOPICS';
      this.sel = 0;
      this.select(0);
    } else if (a === 'QUIZ') this.quiz = startQuiz((this.topicId || 'T').charAt(0));
    else if (a === 'TREE') this.pane = 'TREE';
    else if (a === 'READ') this.pane = 'READ';
    else if (a === 'BOOKMARK') {
      if (this.topicId) toggleBookmark(this.topicId);
    } else if (a === 'BACK') this.router.go(this.returnTo);
    else if (a === 'FIND') {
      // A search on a phone: the soft keyboard types into the filter; Enter or FIND again closes it.
      if (this.searching) {
        this.searching = false;
        this.keys.textMode = false;
        this.keys.softKeyboard(false);
      } else {
        this.searching = true;
        this.search = '';
        this.keys.textMode = true;
        this.keys.takeKeyEvents();
        if (this.keys.touchUsed) this.keys.softKeyboard(true);
      }
    }
    else if (a === 'SIDE') {
      // The button walks LAB -> DATA -> MODEL (those that exist) and back to the text.
      const kinds = this.sideKinds();
      const cur = this.pane === 'SIDE' ? kinds.indexOf(this.sideKind() ?? 'LAB') : -1;
      const next = kinds[cur + 1];
      this.pane = next ? 'SIDE' : 'READ';
      if (next) this.side = next;
      // The three-pane layout loads a lab with the EXPERT text; here the button loads it at any level.
      const t = this.index?.topics.find((q) => q.id === this.topicId);
      if (this.pane === 'SIDE' && this.side === 'LAB' && !this.lab && t?.demoId && labStatus(t.demoId) === 'BUILT') {
        const token = this.token;
        void loadLab(t.demoId).then((l) => {
          if (token === this.token) this.lab = l;
        });
      }
    }
  }

  /** An arrow button: a box with a filled-outline triangle pointing `dir`. */
  private arrowButton(x: number, y: number, w: number, h: number, dir: 'up' | 'down' | 'left' | 'right', act: NavAct): void {
    const s = this.s;
    const p = s.palette;
    s.stroke([x, y, x + w, y, x + w, y + h, x, y + h], { closed: true, color: p.dim, glow: 0, alpha: 0.8 });
    const cx = x + w / 2;
    const cy = y + h / 2;
    const r = Math.min(w, h) * 0.28;
    const pts = dir === 'up' ? [cx, cy - r, cx + r, cy + r * 0.7, cx - r, cy + r * 0.7] : dir === 'down' ? [cx, cy + r, cx + r, cy - r * 0.7, cx - r, cy - r * 0.7] : dir === 'left' ? [cx - r, cy, cx + r * 0.7, cy - r, cx + r * 0.7, cy + r] : [cx + r, cy, cx - r * 0.7, cy - r, cx - r * 0.7, cy + r];
    s.stroke(pts, { closed: true, color: p.hot, glow: 0.8 });
    this.navHits.push({ x, y, w, h, act });
  }

  /** A labelled button in the compact layout's bottom bar. */
  private barButton(x: number, y: number, w: number, h: number, label: string, act: NavAct, on = false): void {
    const s = this.s;
    const p = s.palette;
    s.stroke([x, y, x + w, y, x + w, y + h, x, y + h], { closed: true, color: on ? p.hot : p.dim, glow: on ? 0.8 : 0, alpha: 0.9 });
    drawTextFit(s, label, x + w / 2, y + h / 2 - 4.5, 9, w - 8, { align: 'center', color: on ? p.hot : p.ink, glow: 0.4 });
    this.navHits.push({ x, y, w, h, act });
  }

  render(): void {
    const s = this.s;
    s.clear();
    this.navHits.length = 0;
    this.rowHits.length = 0;
    this.tabHits.length = 0;
    this.sliderHits.length = 0;
    this.ensureLines();
    if (this.compact()) {
      this.renderCompact();
      return;
    }
    const p = s.palette;
    const fs = this.fs();
    const clh = this.lineH();
    const foot = 40;
    const m = 16;
    const { tw, cx0, cw, rx, rw } = this.layout();
    const lw = this.wantsLab() ? Math.min(rw, CenterScreen.LAB_MAX) : 0;
    // Without a lab the right pane shows the topic's 3-D model when there is room for one.
    // Real data first (it is the stronger evidence), then the device model.
    const pm = panels();
    const dataPanel: DataPanel | null = lw === 0 && rw >= 260 && pm ? pm.panelForTopic(this.topicId) : null;
    const model = lw === 0 && rw >= 260 && !dataPanel ? modelForTopic(this.topicId) : null;
    const free = lw === 0 && !model && !dataPanel ? rw : 0;
    const readCount = this.index ? this.index.topics.filter((t) => progress[t.id]).length : 0;
    const ui = uiColors(p, s.spectrum);
    // The touch BACK tab sits in the top-left corner: the title starts right of it on a touch screen.
    const tx0 = this.keys.touchUsed ? m + 30 : m;
    drawText(s, 'LEARNING CENTER', tx0, m, 16, { color: ui.title, glow: 1.5 });
    let hx = tx0 + 270;
    hx += drawText(s, `${readCount} OF ${this.index?.topics.length ?? 0} TOPICS READ   `, hx, m + 3, 10, { color: ui.dim, glow: 0 });
    hx += drawText(s, `LEVEL ${this.level}`, hx, m + 3, 10, { color: ui.sub, glow: 0.6 });
    drawText(s, `   VIEW ${this.view}${this.search ? `   SEARCH "${this.search.toUpperCase()}"` : ''}`, hx, m + 3, 10, { color: ui.dim, glow: 0 });
    this.drawLevelTabs(s.width - m - 120, m + 2, 12, 22);
    if (this.status) drawTextFit(s, this.status, m, m + 24, 10, s.width - 2 * m, { color: p.hot, glow: 0.5 });
    // Tree.
    const top = m + 40;
    this.drawTree(m, top, tw, s.height - 60, 14, 9);
    // Content.
    s.stroke([cx0 - 8, top - 6, cx0 - 8, s.height - foot], { color: p.dim, glow: 0 });
    const c = this.chunk;
    let cy = top;
    if (c) {
      drawTextFit(s, `${c.id}  ${substitute(c.title).toUpperCase()}`, cx0, cy, 12, cw + free, { color: this.focus === 'CONTENT' ? ui.title : ui.head, glow: 1.2 });
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
      const maxLines = Math.floor((s.height - foot - 10 - cy) / clh);
      this.drawLines(cx0, cy, cw, free, fs, clh, maxLines, 8);
      cy += Math.min(maxLines, this.lines.length - this.scroll) * clh;
      if (this.lines.length > this.scroll + maxLines) drawTextFit(s, `... ${this.lines.length - this.scroll - maxLines} MORE (TAB TO CONTENT, DOWN)`, cx0, cy, fs, cw, { color: p.dim, glow: 0 });
      const meta = this.index?.topics.find((t) => t.id === c.id);
      if (meta && meta.related.length > 0) drawText(s, cutWords(`RELATED ${meta.related.join(' ')}   IN GAME: ${meta.game.join(', ').toUpperCase()}`, charsPerLine(cw, 8)), cx0, s.height - 52, 8, { color: p.dim, glow: 0 });
    } else if (!this.status) drawText(s, 'LOADING', cx0, cy, 10, { color: p.dim, glow: 0 });
    if (this.quiz) this.drawQuiz(cx0, top, cw, s.height - top - foot, false);
    if (dataPanel) {
      s.stroke([rx - 8, top - 6, rx - 8, s.height - 40], { color: p.dim, glow: 0 });
      pm?.drawPanel(s, dataPanel, { x: rx, y: top, w: Math.min(rw, CenterScreen.LAB_MAX), h: s.height - 46 - top }, this.settings.reduceMotion ? 60 : performance.now() / 1000);
    }
    if (model) {
      s.stroke([rx - 8, top - 6, rx - 8, s.height - 40], { color: p.dim, glow: 0 });
      drawModel(s, model, { x: rx, y: top, w: Math.min(rw, CenterScreen.LAB_MAX), h: s.height - 46 - top }, this.settings.reduceMotion ? 2 : performance.now() / 1000);
    }
    if (lw > 0) {
      s.stroke([rx - 8, top - 6, rx - 8, s.height - 40], { color: p.dim, glow: 0 });
      this.drawLab(rx, top, lw, s.height - 40);
    }
    drawTextFit(s, `Q QUIZ   CLICK A TOPIC OR TAB   WHEEL SCROLLS   UP/DOWN ${this.focus === 'TREE' ? 'TOPIC' : this.focus === 'CONTENT' ? 'SCROLL' : 'SLIDER'}   LEFT/RIGHT ${this.focus === 'LAB' ? 'ADJUST' : 'LEVEL'}   1-5 LEVEL   TAB FOCUS (${this.focus})   V VIEW   B BOOKMARK   / SEARCH   ESC BACK TO ${this.returnTo.toUpperCase()}   LABS ${BUILT_LABS.length} OF ${this.index?.labs.length ?? BUILT_LABS.length}`.slice(0, charsPerLine(s.width - 2 * m, 9)), s.width / 2, s.height - m - 10, 9, s.width - 2 * m, { align: 'center', color: p.dim, glow: 0 });
  }

  /**
   * The phone layouts. WIDE (held sideways): tree on the left, one column (READ or SIDE) in the middle, the arrow
   * strip on the right edge, a button bar at the bottom. STACK (held upright): one pane fills the window (TREE,
   * READ or SIDE), the strip scrolls it, the bar switches panes. Buttons are finger-sized (at least 34 px tall).
   */
  private renderCompact(): void {
    const s = this.s;
    const p = s.palette;
    const ui = uiColors(p, s.spectrum);
    const stack = this.stack();
    const fs = this.fs();
    const clh = this.lineH();
    const m = 12;
    const foot = 44;
    const { tw, cx0, cw } = this.layout();
    const readCount = this.index ? this.index.topics.filter((t) => progress[t.id]).length : 0;
    // Header: title, a short status, the level tabs (finger-sized hit boxes).
    const tx0 = this.keys.touchUsed ? m + 30 : m;
    const tabsW = 5 * 26;
    const titleW = drawTextFit(s, stack ? 'LEARN' : 'LEARNING CENTER', tx0, m, 12, s.width - tabsW - tx0 - 2 * m, { color: ui.title, glow: 1.5 });
    if (!stack) drawTextFit(s, `${readCount}/${this.index?.topics.length ?? 0} READ   LEVEL ${this.level}   VIEW ${this.view}${this.search ? `   "${this.search.toUpperCase()}"` : ''}`, tx0 + titleW + 16, m + 2, 8, Math.max(40, s.width - m - tabsW - tx0 - titleW - 26), { color: ui.dim, glow: 0 });
    this.drawLevelTabs(s.width - m - tabsW + 6, m - 1, 14, 26);
    if (this.status) drawTextFit(s, this.status, m, m + 22, 9, s.width - 2 * m, { color: p.hot, glow: 0.5 });
    const top = m + 26;
    const bottom = s.height - foot;
    const sx = s.width - m - CenterScreen.STRIP;
    const pane: Pane = stack ? this.pane : this.pane === 'SIDE' ? 'SIDE' : 'READ';
    const side = this.sideKind();
    // Tree (WIDE: always; STACK: as the TREE pane).
    if (!stack || pane === 'TREE') {
      const treeBottom = stack ? bottom - 4 : bottom - 36;
      // STACK's tree pane carries a view row: VIEW cycles TOPICS / LABS / BOOKMARKS, then the bookmark toggle.
      let ty = top;
      if (stack) {
        const bw = (tw - 12) / 3;
        this.barButton(m, ty, bw, 28, `VIEW: ${this.view}`, 'VIEW');
        this.barButton(m + bw + 6, ty, bw, 28, bookmarks.includes(this.topicId) ? 'UNMARK' : 'BOOKMARK', 'BOOKMARK', bookmarks.includes(this.topicId));
        this.barButton(m + 2 * (bw + 6), ty, bw, 28, this.search || this.searching ? `FIND "${this.search.toUpperCase()}"` : 'FIND', 'FIND', this.searching);
        ty += 36;
      }
      this.drawTree(m, ty, tw, treeBottom, (stack ? 15 : 12.5) * getTextScale(), stack ? 9 : 8.5);
      if (!stack) {
        const bw = (tw - 12) / 3;
        this.arrowButton(m, treeBottom + 4, bw, 30, 'up', 'TOPIC_UP');
        this.arrowButton(m + bw + 6, treeBottom + 4, bw, 30, 'down', 'TOPIC_DOWN');
        this.barButton(m + 2 * (bw + 6), treeBottom + 4, bw, 30, this.search || this.searching ? `"${this.search.toUpperCase()}"` : 'FIND', 'FIND', this.searching);
      }
    }
    // The column: READ or SIDE.
    if (!stack) s.stroke([cx0 - 7, top - 4, cx0 - 7, bottom], { color: p.dim, glow: 0 });
    const c = this.chunk;
    if (pane === 'READ') {
      let cy = top;
      if (c) {
        drawTextFit(s, `${c.id}  ${substitute(c.title).toUpperCase()}`, cx0, cy, stack ? 12 : 11, cw, { color: ui.head, glow: 1.2 });
        cy += stack ? 22 : 20;
        if (c.pictureId && c.level === 'SIMPLE') {
          // At most half the column's height, so some text shows under the picture.
          const pw = Math.min(cw, ((bottom - cy) * 0.5 * 480) / 320);
          drawPicture(s, c.pictureId, cx0, cy, pw, (pw * 320) / 480);
          cy += (pw * 320) / 480 + 10;
          if (c.pictureCaption) {
            drawTextFit(s, substitute(c.pictureCaption), cx0, cy, 8, pw, { color: p.dim, glow: 0, lower: true });
            cy += 14;
          }
        }
        const maxLines = Math.floor((bottom - 14 - cy) / clh);
        this.drawLines(cx0, cy, cw, 0, fs, clh, maxLines, fs - 1.5);
        cy += Math.min(maxLines, this.lines.length - this.scroll) * clh;
        if (this.lines.length > this.scroll + maxLines) drawTextFit(s, `... ${this.lines.length - this.scroll - maxLines} MORE`, cx0, cy, fs, cw, { color: p.dim, glow: 0 });
      } else if (!this.status) drawText(s, 'LOADING', cx0, cy, 10, { color: p.dim, glow: 0 });
    } else if (pane === 'SIDE') {
      const pm = panels();
      const dataPanel = side === 'DATA' && pm ? pm.panelForTopic(this.topicId) : null;
      const model = side === 'MODEL' ? modelForTopic(this.topicId) : null;
      if (side === 'LAB') this.drawLab(cx0, top, cw, bottom);
      else if (dataPanel) pm?.drawPanel(s, dataPanel, { x: cx0, y: top, w: cw, h: bottom - top - 6 }, this.settings.reduceMotion ? 60 : performance.now() / 1000);
      else if (model) drawModel(s, model, { x: cx0, y: top, w: cw, h: bottom - top - 6 }, this.settings.reduceMotion ? 2 : performance.now() / 1000);
      else drawTextFit(s, 'NO LAB, DATA OR MODEL FOR THIS TOPIC', cx0, top, 10, cw, { color: p.dim, glow: 0 });
    }
    if (this.quiz) this.drawQuiz(cx0, top, cw, bottom - top, true);
    // The arrow strip on the right edge: the top half scrolls up a page, the bottom half down.
    const sh = (bottom - top) / 2 - 4;
    const scrollsTree = stack && pane === 'TREE';
    this.arrowButton(sx, top - 2, CenterScreen.STRIP, sh, 'up', scrollsTree ? 'TOPIC_UP' : 'UP');
    this.arrowButton(sx, top + sh + 6, CenterScreen.STRIP, sh, 'down', scrollsTree ? 'TOPIC_DOWN' : 'DOWN');
    // The button bar.
    const by = s.height - foot + 6;
    const bh = foot - 12;
    const gap = 6;
    // The SIDE button names what it shows next: the first side kind from the text, the next one from a side pane, READ last.
    const kinds = this.sideKinds();
    const nextKind = pane === 'SIDE' ? kinds[kinds.indexOf(side ?? 'LAB') + 1] : kinds[0];
    const sideLabel = nextKind ?? 'READ';
    const buttons: { label: string; act: NavAct; on?: boolean }[] = stack
      ? [
          { label: pane === 'TREE' ? 'READ' : 'TOPICS', act: pane === 'TREE' ? 'READ' : 'TREE' },
          { label: `< ${LEVEL_TABS[LEVELS[(LEVELS.indexOf(this.level) + LEVELS.length - 1) % LEVELS.length] as Level]}`, act: 'LEVEL_DOWN' },
          { label: `${LEVEL_TABS[LEVELS[(LEVELS.indexOf(this.level) + 1) % LEVELS.length] as Level]} >`, act: 'LEVEL_UP' },
          { label: this.quiz ? 'CLOSE' : 'QUIZ', act: 'QUIZ', on: this.quiz !== null },
          { label: sideLabel, act: 'SIDE', on: pane === 'SIDE' },
        ]
      : [
          { label: `< ${LEVEL_TABS[LEVELS[(LEVELS.indexOf(this.level) + LEVELS.length - 1) % LEVELS.length] as Level]} LEVEL`, act: 'LEVEL_DOWN' },
          { label: `LEVEL ${LEVEL_TABS[LEVELS[(LEVELS.indexOf(this.level) + 1) % LEVELS.length] as Level]} >`, act: 'LEVEL_UP' },
          { label: `VIEW: ${this.view}`, act: 'VIEW' },
          { label: this.quiz ? 'CLOSE QUIZ' : 'QUIZ', act: 'QUIZ', on: this.quiz !== null },
          { label: kinds.length === 0 ? 'LAB (NONE)' : sideLabel, act: 'SIDE', on: pane === 'SIDE' },
        ];
    const n = buttons.length;
    const bw = (s.width - 2 * m - gap * (n - 1)) / n;
    buttons.forEach((b, i) => this.barButton(m + i * (bw + gap), by, bw, bh, b.label, b.act, b.on ?? false));
  }

  /** The S B I A E level tabs at (x, y), `size` px, `step` px apart; hit boxes are recorded for update(). */
  private drawLevelTabs(x: number, y: number, size: number, step: number): void {
    const s = this.s;
    const ui = uiColors(s.palette, s.spectrum);
    let tx = x;
    for (const lv of LEVELS) {
      const on = lv === this.level;
      drawText(s, LEVEL_TABS[lv], tx, y, size, { color: on ? ui.head : ui.sub, glow: on ? 1.4 : 0.3 });
      if (on && this.compact()) s.stroke([tx - 2, y + size + 4, tx + size * 0.8, y + size + 4], { color: ui.head, glow: 0.6 });
      this.tabHits.push({ x: tx, y, level: lv });
      tx += step;
    }
  }

  /** The topic tree in a box from `top` to `bottom` at x, `w` wide; rows `lineH` tall at `tfs` px. */
  private drawTree(x: number, top: number, w: number, bottom: number, lineH: number, tfs: number): void {
    const s = this.s;
    const ui = uiColors(s.palette, s.spectrum);
    const list = this.list();
    const rows = Math.floor((bottom - top) / lineH);
    const start = Math.max(0, Math.min(this.sel - Math.floor(rows / 2), list.length - rows));
    let y = top;
    let lastGroup = '';
    const groups = this.index?.groups ?? {};
    const cols = charsPerLine(w - 8, tfs);
    for (let i = start; i < Math.min(list.length, start + rows); i++) {
      const t = list[i] as TopicMeta;
      if (t.group !== lastGroup && this.view === 'TOPICS' && !this.search) {
        drawText(s, cutWords(`${t.group}  ${groups[t.group] ?? ''}`, cols), x, y, tfs, { color: ui.sub, glow: 0.3 });
        lastGroup = t.group;
        y += lineH;
        if (y + lineH > bottom + 2) break;
      }
      if (y + lineH > bottom + 2) break; // group headers take rows too: stop above the footer
      const on = i === this.sel;
      this.rowHits.push({ y: y - 2, h: lineH, idx: i });
      const read = progress[t.id];
      const mark = bookmarks.includes(t.id) ? '*' : read ? (LEVEL_TABS[read as Level] ?? '.') : ' ';
      drawText(s, cutWords(`${on ? '>' : ' '}${mark} ${t.id.padEnd(4)} ${substitute(t.title).toUpperCase()}`, cols), x, y, tfs, { color: on ? ui.sel : ui.text, glow: on ? 1.6 : 0.2 });
      y += lineH;
    }
  }

  /** The reading column's lines from `scroll`, at most `maxLines`; code and tables may use `free` extra px. */
  private drawLines(x: number, y: number, w: number, free: number, fs: number, clh: number, maxLines: number, codeFs: number): void {
    const s = this.s;
    const ui = uiColors(s.palette, s.spectrum);
    let cy = y;
    for (const l of this.lines.slice(this.scroll, this.scroll + maxLines)) {
      const txt = substitute(l.text);
      if (l.kind === 'head') drawTextFit(s, txt.toUpperCase(), x, cy, fs + 1, w, { color: ui.head, glow: 0.9 });
      // Code and tables are never re-wrapped (columns would break): they may use the empty right pane, else shrink.
      else if (l.kind === 'code' || l.kind === 'table') drawTextFit(s, txt, x + 6, cy, codeFs, w + free - 6, { color: ui.text, glow: 0.2, lower: true });
      else drawText(s, txt, x, cy, fs, { color: ui.text, glow: 0.3, lower: true });
      cy += clh;
    }
  }

  /** The quiz panel over the reading column's box. */
  private drawQuiz(cx0: number, top: number, cw: number, h: number, compact: boolean): void {
    const s = this.s;
    const p = s.palette;
    const qz = this.quiz;
    if (!qz) return;
    const q = quizCurrent(qz);
    // Compact: 9 px text and tighter lines so a question and its answers fit a phone held sideways.
    const qf = compact ? 9 : 11;
    const ql = compact ? 13 : 17;
    // Opaque: the reading column's bright text must not show through the questions.
    s.ctx.fillStyle = compact ? p.bg : withAlpha(p.bg, 0.97);
    s.ctx.fillRect(cx0 - 4, top - 4, cw + 8, h);
    this.quizHits = [];
    if (!q) return;
    let qy = top;
    drawTextFit(s, `QUIZ   ${qz.right} RIGHT OF ${qz.asked}   QUESTION ON ${q.topic}`, cx0, qy, qf, cw, { color: p.hot, glow: 1 });
    qy += ql + 8;
    for (const l of wrapText(q.q, cw, qf)) {
      drawText(s, l, cx0, qy, qf, { color: p.ink, glow: 0.5 });
      qy += ql + 1;
    }
    qy += compact ? 6 : 10;
    q.a.forEach((a, i) => {
      const chosen = qz.chosen === i;
      const reveal = qz.chosen >= 0;
      const col = reveal && i === q.right ? s.role('planet') : reveal && chosen ? s.role('danger') : p.ink;
      const lines = wrapText(`${i + 1}  ${a}`, cw - 20, qf);
      const hh = lines.length * ql + (compact ? 8 : 10);
      s.stroke([cx0, qy - 4, cx0 + cw, qy - 4, cx0 + cw, qy - 4 + hh, cx0, qy - 4 + hh], { closed: true, color: col, glow: chosen || (reveal && i === q.right) ? 1 : 0.2, alpha: 0.8 });
      this.quizHits.push({ y: qy - 4, h: hh, choice: i });
      let ay = qy;
      for (const l of lines) {
        drawText(s, l, cx0 + 10, ay, qf, { color: col, glow: 0.4 });
        ay += ql;
      }
      qy += hh + (compact ? 5 : 8);
    });
    if (qz.chosen >= 0) {
      qy += 6;
      drawText(s, qz.chosen === q.right ? 'RIGHT.' : 'NOT QUITE.', cx0, qy, 12, { color: qz.chosen === q.right ? s.role('planet') : s.role('danger'), glow: 1 });
      qy += 20;
      for (const l of wrapText(q.why, cw, 9)) {
        drawText(s, l, cx0, qy, 9, { color: p.ink, glow: 0.3 });
        qy += 14;
      }
      drawTextFit(s, compact ? 'TAP: NEXT QUESTION' : `N OR CLICK: NEXT QUESTION   READ ${q.topic} FOR MORE   Q CLOSES`, cx0, qy + 10, 9, cw, { color: p.dim, glow: 0 });
    } else drawTextFit(s, compact ? 'TAP AN ANSWER' : '1, 2, 3 OR CLICK TO ANSWER   Q CLOSES', cx0, qy + 4, 9, cw, { color: p.dim, glow: 0 });
  }

  /** The lab pane: title, sliders, the plot (clipped), the formula lines and SHOW CODE paths. */
  private drawLab(lx: number, top: number, lw: number, bottom: number): void {
    const s = this.s;
    const p = s.palette;
    const compact = this.compact();
    const meta = this.index?.topics.find((t) => t.id === this.topicId);
    const lab = this.lab;
    if (!lab) {
      drawText(s, `LAB ${meta?.demoId ?? ''}: ${labStatus(meta?.demoId ?? null) === 'BUILT' ? 'LOADING' : 'BACKLOG'}`, lx, top, 10, { color: p.dim, glow: 0 });
      return;
    }
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
      s.circle(bx + frac * bw, ly + 4, compact ? 4 : 3, { color: on ? p.hot : p.ink, glow: on ? 1 : 0.3 });
      drawText(s, `${sl.value === 0 ? '0' : Math.abs(sl.value) >= 1e5 || Math.abs(sl.value) < 0.01 ? sl.value.toExponential(2) : Number(sl.value.toPrecision(4))}`, bx + bw + 8, ly, 8, { color: p.dim, glow: 0, align: 'left' });
      this.sliderHits.push({ i, x: bx, y: ly - 7, w: bw, h: 18 });
      ly += compact ? 18 : 16;
    });
    // The plot takes the pane's height minus room for the formula lines and SHOW CODE.
    const plotH = this.stack() ? Math.max(80, Math.min(lw * 0.9, bottom - ly - 120)) : compact ? Math.max(60, Math.min(lw * 0.6, bottom - ly - 70)) : Math.max(160, Math.min(lw * 0.9, bottom - ly - 130));
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
        if (ly > bottom - 12) break;
        drawText(s, w, lx, ly, 8, { color: p.ink, glow: 0.3, lower: true });
        ly += 11;
      }
      ly += 2;
    }
    ly += 4;
    if (ly > bottom - 24) return;
    drawText(s, 'SHOW CODE:', lx, ly, 8, { color: p.hot, glow: 0.5 });
    ly += 12;
    for (const cpath of lab.code) {
      if (ly > bottom - 10) break;
      drawTextFit(s, cpath, lx, ly, 8, lw, { color: p.dim, glow: 0, lower: true });
      ly += 11;
    }
  }
}

/** Cut `text` to `cols` characters at a word boundary, marking the cut with "..": no half words in a column. */
export function cutWords(text: string, cols: number): string {
  if (text.length <= cols) return text;
  const room = Math.max(1, cols - 2);
  const cut = text.lastIndexOf(' ', room);
  return (cut > cols * 0.5 ? text.slice(0, cut) : text.slice(0, room)).trimEnd() + '..';
}
