// WHAT: The TELETYPE overlay: a brief types itself in, header first, then the body, fast.
// WHY:  GAME_PLAN 29: the log says what happened, the teletype says what it means, with the retro typing
//       look. A key renders the rest at once; another key clears it. In a run it is non-modal (the clock
//       keeps its warp, the key also does its normal job); at the debrief it is modal and the panel waits.
// HOW:  A queue of Narratives. `shown` counts revealed characters across header + wrapped body lines at
//       max(TELETYPE_MIN_CPS, total / TELETYPE_MAX_S) chars per second. Role colours come from
//       Surface.role (SPECTRUM on) and fall back to the palette ink. Draws only; never touches game state.
// LORE: G2 (screens and HUD), G8 (the look)

import { KNOBS } from '../../config/knobs';
import { narrativeLength, type Narrative, type NarrativeLine } from '../../game/narrative';
import type { Surface } from '../canvas';
import { withAlpha } from '../palettes';
import { charsPerLine, drawText, getTextScale, measureText } from '../vectorFont';

interface Queued {
  n: Narrative;
  modal: boolean;
}

export type TeletypeAnchor = 'dock' | 'center';

export class Teletype {
  private queue: Queued[] = [];
  private cur: Queued | null = null;
  private shown = 0;
  private hold = 0;
  private blink = 0;

  /** The panel drawn last frame (a tap on it is a key press on phones). */
  private box: { x: number; y: number; w: number; h: number } | null = null;

  constructor(private readonly s: Surface) {}

  /** True when (x, y) is on the brief drawn last frame. */
  hit(x: number, y: number): boolean {
    const b = this.box;
    return this.cur !== null && b !== null && x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
  }

  get isOpen(): boolean {
    return this.cur !== null;
  }

  /** True while the current brief must be dismissed before the screen under it takes keys. */
  get isModal(): boolean {
    return this.cur?.modal ?? false;
  }

  get complete(): boolean {
    return this.cur !== null && this.shown >= narrativeLength(this.cur.n);
  }

  push(n: Narrative, modal = false): void {
    this.queue.push({ n, modal });
    // At high warp events outrun reading: keep at most two non-modal briefs waiting (the newest).
    while (this.queue.filter((q) => !q.modal).length > 2) {
      const i = this.queue.findIndex((q) => !q.modal);
      if (i < 0) break;
      this.queue.splice(i, 1);
    }
    // A finished non-modal brief gives way to the new one at once.
    if (!this.cur || (!this.cur.modal && this.complete)) this.next();
  }

  clear(): void {
    this.queue = [];
    this.cur = null;
  }

  /** A key press: finish typing, or clear a finished brief. */
  key(): void {
    if (!this.cur) return;
    if (!this.complete) this.shown = narrativeLength(this.cur.n);
    else this.next();
  }

  private next(): void {
    this.cur = this.queue.shift() ?? null;
    this.shown = 0;
    this.hold = 0;
  }

  update(dtMs: number): void {
    if (!this.cur) return;
    const dt = dtMs / 1000;
    this.blink += dt;
    const total = narrativeLength(this.cur.n);
    const cps = Math.max(KNOBS.TELETYPE_MIN_CPS, total / KNOBS.TELETYPE_MAX_S);
    if (this.shown < total) this.shown = Math.min(total, this.shown + cps * dt);
    else if (!this.cur.modal) {
      this.hold += dt;
      if (this.hold >= KNOBS.TELETYPE_HOLD_S) this.next();
    }
  }

  /** Wrap a line into display lines of at most `cols` characters, keeping its role. */
  static wrap(line: NarrativeLine, cols: number): NarrativeLine[] {
    const out: NarrativeLine[] = [];
    let cur = '';
    for (const word of line.text.split(' ')) {
      if (cur.length === 0) cur = word;
      else if (cur.length + 1 + word.length <= cols) cur += ' ' + word;
      else {
        out.push({ text: cur, role: line.role });
        cur = word;
      }
    }
    if (cur.length > 0) out.push({ text: cur, role: line.role });
    return out;
  }

  /** `bottomInset`: px reserved along the bottom edge (the action bar) that a docked brief stays above. */
  render(anchor: TeletypeAnchor, bottomInset = 36): void {
    const c = this.cur;
    if (!c) return;
    const s = this.s;
    const p = s.palette;
    // NOTE: owner 2026-10-21 (phones): under 700 px the panel takes the full width with smaller text, the header
    // shrinks to fit on one line, and a docked brief sits a third of the way down instead of at the bottom, where the
    // autopilot's pane and the status lines are.
    const narrow = s.width < 700;
    const size = narrow ? 8.5 : anchor === 'center' ? 11 : 10;
    const panelW = narrow ? s.width - 32 : anchor === 'center' ? Math.min(760, s.width - 32) : Math.min(660, Math.max(320, Math.floor(s.width * 0.5)));
    const head0 = anchor === 'center' ? 15 : 12;
    // NOTE: the header always shrinks to the panel (a phone held sideways is wider than 700 px but its 390 px panel
    // still cut a long discovery header off at the screen's edge).
    const headSize = Math.min(head0, (head0 * (panelW - 24)) / Math.max(1, measureText(c.n.header.text, head0) * getTextScale()));
    const cols = charsPerLine(panelW - 24, size);
    const lines = c.n.lines.flatMap((l) => Teletype.wrap(l, cols));
    const lineH = size * 1.5 * (narrow ? getTextScale() : 1);
    const panelH = 14 + headSize + 10 + lines.length * lineH + 10;
    let x: number;
    let y: number;
    if (anchor === 'center') {
      x = (s.width - panelW) / 2;
      y = (s.height - panelH) / 2;
      s.ctx.fillStyle = withAlpha(p.bg, 0.8);
      s.ctx.fillRect(0, 0, s.width, s.height);
    } else {
      x = s.width - 16 - panelW;
      y = narrow ? Math.round(s.height * 0.3) : s.height - bottomInset - 36 - panelH;
    }
    this.box = { x, y, w: panelW, h: panelH };
    s.ctx.fillStyle = withAlpha(p.bg, 0.78);
    s.ctx.fillRect(x, y, panelW, panelH);
    s.stroke([x, y, x + panelW, y, x + panelW, y + panelH, x, y + panelH], { closed: true, glow: 0.8, color: s.role(c.n.header.role), alpha: 0.9 });

    // Reveal budget: the header first, then the body lines in order.
    let budget = Math.floor(this.shown);
    const typing = !this.complete;
    const take = (text: string): string => {
      const t = text.slice(0, Math.max(0, budget));
      budget -= text.length;
      return t;
    };
    const cursor = (px: number, py: number, h: number): void => {
      if (typing || Math.floor(this.blink * 3) % 2 === 0) s.dot(px + 2, py + h * 0.1, Math.max(2, h * 0.5), s.role('text'), 0.9);
    };
    const hx = x + 12;
    let yy = y + 12;
    const head = take(c.n.header.text);
    const hw = drawText(s, head, hx, yy, headSize, { color: s.role(c.n.header.role), glow: 1.4 });
    if (budget < 0 && typing) cursor(hx + hw, yy, headSize);
    yy += headSize + 10;
    for (const l of lines) {
      if (budget <= 0) break;
      const t = take(l.text);
      const w = drawText(s, t, hx, yy, size, { color: s.role(l.role), glow: l.role === 'text' ? 0.4 : 0.9, lower: false });
      if (budget < 0) cursor(hx + w, yy, size);
      yy += lineH;
    }
    if (this.complete) {
      const hint = c.modal ? 'ANY KEY: CONTINUE' : 'ANY KEY CLEARS';
      drawText(s, hint, x + panelW - 10, y + panelH - 11, 8, { align: 'right', color: p.dim, glow: 0, alpha: 0.7 });
    }
  }
}
