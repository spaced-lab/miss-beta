// WHAT: The lore side panel (GAME_PLAN 23): one topic at one level, tabs S B I A E, picture (SIMPLE),
//       related row, and a jump to the Learning Center.
// WHY:  `?` from anywhere in a run answers "what is this number" without leaving the screen.
// HOW:  An overlay owned by a screen: `open(id)` fetches the chunk through the shared LoreStore; the text
//       is flattened by markdownToLines and wrapped to the panel's column count. Reading a level marks it.
// LORE: G2, C1

import { lore, recordRead } from '../../lore/store';
import { cornerInset } from '../../ui/touchBack';
import { LEVELS, LEVEL_TABS, markdownToLines, type Chunk, type Level, type LoreLine, type TopicMeta } from '../../lore/index';
import { labStatus } from '../../lore/labs/index';
import type { Input } from '../../ui/input';
import type { Surface } from '../canvas';
import { drawPicture } from '../pictureCache';
import { charsPerLine, drawText, substitute } from '../vectorFont';

export const PANEL_W = 360;

export class LorePanel {
  private open = false;
  private id = '';
  level: Level = 'BEGINNER';
  private chunk: Chunk | null = null;
  private meta: TopicMeta | null = null;
  private lines: LoreLine[] = [];
  private scroll = 0;
  private status = '';
  private token = 0;
  /** Set by the owner: opens the Learning Center on this topic. */
  onCenter: ((id: string, level: Level) => void) | null = null;
  /** Px reserved along the bottom edge (the owner's action bar), set by the owner each frame. */
  bottomInset = 16;
  /** The panel's width: PW, or the window on a phone. */
  private width(): number {
    return this.s.width < 600 ? this.s.width - 16 : PANEL_W;
  }

  constructor(private readonly s: Surface, private readonly keys: Input) {}

  get isOpen(): boolean {
    return this.open;
  }

  show(id: string, level: Level = this.level): void {
    this.open = true;
    this.id = id;
    this.level = level;
    this.scroll = 0;
    this.chunk = null;
    this.lines = [];
    this.status = 'LOADING';
    const token = ++this.token;
    void lore
      .loadIndex()
      .then((ix) => {
        this.meta = ix.topics.find((t) => t.id === id) ?? null;
        if (!this.meta) throw new Error(`no topic ${id}`);
        const lv = this.meta.levels.includes(level) ? level : (this.meta.levels[0] ?? 'BEGINNER');
        this.level = lv;
        return lore.chunk(id, lv);
      })
      .then((c) => {
        if (token !== this.token) return;
        this.chunk = c;
        this.lines = markdownToLines(c.markdown, charsPerLine(this.width() - 24, 9));
        this.status = '';
        recordRead(id, c.level);
      })
      .catch((e: unknown) => {
        if (token !== this.token) return;
        this.status = `LORE UNAVAILABLE (${String(e).slice(0, 40)})`;
      });
  }

  hide(): void {
    this.open = false;
  }

  update(): void {
    const k = this.keys;
    if (k.pressed('Escape') || k.pressed('Slash')) {
      this.hide();
      return;
    }
    if (k.pressed('Tab')) this.show(this.id, LEVELS[(LEVELS.indexOf(this.level) + 1) % LEVELS.length] as Level);
    for (let i = 0; i < LEVELS.length; i++) if (k.pressed(`Digit${i + 1}`)) this.show(this.id, LEVELS[i] as Level);
    if (k.pressed('ArrowDown')) this.scroll = Math.min(this.scroll + 2, Math.max(0, this.lines.length - 6));
    if (k.pressed('ArrowUp')) this.scroll = Math.max(0, this.scroll - 2);
    const rel = this.meta?.related ?? [];
    if (rel.length > 0) {
      for (let i = 0; i < Math.min(rel.length, 4); i++) if (k.pressed(`F${i + 1}`)) this.show(rel[i] as string, this.level);
      if (k.pressed('ArrowRight')) this.show(rel[0] as string, this.level);
    }
    if (k.pressed('KeyL') && this.onCenter) {
      this.onCenter(this.id, this.level);
      this.hide();
    }
  }

  render(): void {
    if (!this.open) return;
    const s = this.s;
    const p = s.palette;
    const PW = this.width();
    const x = s.width - PW - 8;
    const y = 8;
    const h = s.height - 8 - Math.max(8, this.bottomInset);
    // Dim the panel area so the text reads over the map.
    // Nearly opaque: bright HUD text behind the panel must not bleed through its words.
    s.ctx.globalAlpha = 0.97;
    s.ctx.fillStyle = p.bg;
    s.ctx.fillRect(x, y, PW, h);
    s.ctx.globalAlpha = 1;
    s.stroke([x, y, x + PW, y, x + PW, y + h, x, y + h], { closed: true, color: p.hot, glow: 0.8 });
    const title = this.chunk?.title ?? this.meta?.title ?? this.id;
    // NOTE: the title and the level tabs step clear of a corner tab the panel reaches (a phone: full width).
    const ci = cornerInset();
    const tl = x < 40 ? ci.left : 0;
    const tr = x + PW > s.width - 40 ? ci.right : 0;
    drawText(s, `${this.id}  ${substitute(title).toUpperCase()}`.slice(0, charsPerLine(PW - 24 - tl - tr, 11)), x + 12 + tl, y + 12, 11, { color: p.hot, glow: 1 });
    // Level tabs.
    let tx = x + 12 + tl;
    for (const lv of LEVELS) {
      const on = lv === this.level;
      const has = this.meta ? this.meta.levels.includes(lv) : true;
      drawText(s, LEVEL_TABS[lv], tx, y + 32, 11, { color: on ? p.hot : has ? p.ink : p.dim, glow: on ? 1.2 : 0.3 });
      if (on) s.stroke([tx - 2, y + 46, tx + 10, y + 46], { color: p.hot, glow: 0.5 });
      tx += 22;
    }
    drawText(s, this.level, tx + 8, y + 32, 10, { color: p.dim, glow: 0 });
    let cy = y + 58;
    if (this.chunk?.pictureId && this.level === 'SIMPLE') {
      drawPicture(s, this.chunk.pictureId, x + 12, cy, PW - 24, ((PW - 24) * 320) / 480);
      cy += ((PW - 24) * 320) / 480 + 10;
    }
    if (this.status) drawText(s, this.status, x + 12, cy, 10, { color: p.dim, glow: 0 });
    const maxLines = Math.floor((y + h - 70 - cy) / 13);
    const shown = this.lines.slice(this.scroll, this.scroll + maxLines);
    for (const l of shown) {
      const txt = substitute(l.text);
      if (l.kind === 'head') drawText(s, txt.toUpperCase(), x + 12, cy, 10, { color: p.hot, glow: 0.8 });
      else if (l.kind === 'code' || l.kind === 'table') drawText(s, txt.slice(0, charsPerLine(PW - 28, 8)), x + 16, cy, 8, { color: p.ink, glow: 0.2, lower: true });
      else drawText(s, txt, x + 12, cy, 9, { color: p.ink, glow: 0.3, lower: true });
      cy += 13;
    }
    if (this.lines.length > this.scroll + maxLines) drawText(s, `... ${this.lines.length - this.scroll - maxLines} MORE (DOWN)`, x + 12, cy, 9, { color: p.dim, glow: 0 });
    const by = y + h - 56;
    s.stroke([x + 8, by - 6, x + PW - 8, by - 6], { color: p.dim, glow: 0 });
    const rel = (this.meta?.related ?? []).slice(0, 4);
    if (rel.length > 0) drawText(s, `RELATED  ${rel.map((r, i) => `F${i + 1}:${r}`).join('  ')}`, x + 12, by, 9, { color: p.dim, glow: 0 });
    const demo = this.meta?.demoId ?? null;
    const lab = labStatus(demo);
    drawText(s, `1-5 LEVEL  TAB NEXT  UP/DOWN SCROLL  L CENTER${lab === 'BUILT' ? `  (LAB ${demo})` : lab === 'BACKLOG' ? '  (LAB BACKLOG)' : ''}`.slice(0, charsPerLine(PW - 24, 8)), x + 12, by + 16, 8, { color: p.dim, glow: 0 });
    drawText(s, 'ESC CLOSE', x + 12, by + 30, 8, { color: p.dim, glow: 0 });
  }
}
