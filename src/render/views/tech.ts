// WHAT: TECH TREE overlay (GAME_PLAN 13.5): tracks as columns, nodes as boxes, research counter, unlock.
// WHY:  Research is the run's long-term currency; this is where the player decides between faster
//       launchers, bigger impactors, sails, autonomy, warheads and slow pushers.
// HOW:  Left/Right pick a track, Up/Down a node, Enter unlocks (game/tech.ts decides). Owned nodes are
//       bright, available ones normal, locked ones dim with the reason.
// LORE: D11 (the catalog and the chart), G1 (how to play)

import type { RunState } from '../../game/run';
import { topicForTrack } from '../../game/loreLinks';
import { canUnlock, TECH, TRACKS, unlock, type TechNode } from '../../game/tech';
import type { Input } from '../../ui/input';
import type { Surface } from '../canvas';
import { withAlpha } from '../palettes';
import { drawText, drawTextFit } from '../vectorFont';

export class TechOverlay {
  /** Mouse targets from the last frame: every node's box. */
  private boxes: { x: number; y: number; w: number; h: number; track: number; row: number }[] = [];
  /** Set by the owner screen: open the Learning Center on a topic. */
  openLore: ((id: string) => void) | null = null;
  private open = false;
  private track = 0;
  private row = 0;
  private note = '';
  constructor(private readonly s: Surface, private readonly keys: Input) {}

  get isOpen(): boolean {
    return this.open;
  }
  show(): void {
    this.open = true;
    this.note = '';
  }
  hide(): void {
    this.open = false;
  }

  private nodesOf(track: string): TechNode[] {
    return TECH.filter((n) => n.track === track);
  }

  update(run: RunState): void {
    if (!this.open) return;
    const k = this.keys;
    if (k.pressed('Escape') || k.pressed('KeyT')) {
      this.hide();
      return;
    }
    if ((k.pressed('KeyL') || k.pressed('Slash')) && this.openLore) {
      // The Learning Center on this track's topic; Esc there comes back here with the tree still open.
      this.openLore(topicForTrack(TRACKS[this.track] as string));
      return;
    }
    if (k.pressed('ArrowLeft')) {
      this.track = (this.track + TRACKS.length - 1) % TRACKS.length;
      this.row = 0;
    }
    if (k.pressed('ArrowRight')) {
      this.track = (this.track + 1) % TRACKS.length;
      this.row = 0;
    }
    const click = k.takeClick();
    let clickUnlock = false;
    if (click) {
      const box = this.boxes.find((b) => click.x >= b.x && click.x <= b.x + b.w && click.y >= b.y && click.y <= b.y + b.h);
      if (box) {
        if (box.track === this.track && box.row === this.row) clickUnlock = true;
        this.track = box.track;
        this.row = box.row;
      }
    }
    const nodes = this.nodesOf(TRACKS[this.track] as string);
    if (k.pressed('ArrowUp')) this.row = (this.row + nodes.length - 1) % nodes.length;
    if (k.pressed('ArrowDown')) this.row = (this.row + 1) % nodes.length;
    if (k.pressed('Enter') || clickUnlock) {
      const n = nodes[this.row];
      if (n) {
        const v = unlock(run, n.id);
        this.note = v === 'OK' ? `${n.id} UNLOCKED: ${n.name}` : v === 'OWNED' ? `${n.id} ALREADY OWNED` : v === 'RESEARCH' ? `NEED ${n.cost} RESEARCH (HAVE ${run.research})` : v === 'REQUIRES' ? `REQUIRES ${n.requires.join(', ')}` : 'SCI-FI MODE ONLY';
      }
    }
  }

  render(run: RunState): void {
    if (!this.open) return;
    const s = this.s;
    const p = s.palette;
    const m = 16;
    s.ctx.fillStyle = withAlpha(p.bg, 0.9);
    s.ctx.fillRect(0, 0, s.width, s.height);
    drawText(s, `TECH TREE   RESEARCH ${run.research}`, m, m, 14, { color: p.hot, glow: 1.2 });
    // Twelve tracks need ~170 px each to read; narrower windows get two rows of six.
    const perRow = (s.width - 2 * m) / TRACKS.length < 170 ? Math.ceil(TRACKS.length / 2) : TRACKS.length;
    const colW = (s.width - 2 * m) / perRow;
    const rowH = 20 + 4 * 58 + 10;
    const top0 = m + 40;
    this.boxes = [];
    TRACKS.forEach((track, ti) => {
      const x = m + (ti % perRow) * colW;
      const top = top0 + Math.floor(ti / perRow) * rowH;
      const selectedTrack = ti === this.track;
      drawText(s, track, x, top, 10, { color: selectedTrack ? p.hot : p.dim, glow: selectedTrack ? 1 : 0 });
      const nodes = this.nodesOf(track);
      nodes.forEach((n, ri) => {
        const y = top + 20 + ri * 58;
        const owned = run.tech.includes(n.id);
        const verdict = canUnlock(run, n.id);
        const selected = selectedTrack && ri === this.row;
        const col = owned ? p.hot : verdict === 'OK' ? p.ink : p.dim;
        const w = colW - 12;
        this.boxes.push({ x, y, w, h: 46, track: ti, row: ri });
        s.stroke([x, y, x + w, y, x + w, y + 46, x, y + 46], { closed: true, color: col, glow: selected ? 1.5 : owned ? 0.8 : 0, width: selected ? 1.5 : 1, ...(owned || verdict === 'OK' ? {} : { dash: [3, 4] }) });
        if (ri > 0) s.stroke([x + w / 2, y - 12, x + w / 2, y], { color: p.dim, glow: 0 });
        drawText(s, `${n.id}  ${owned ? 'OWNED' : `${n.cost} RP`}`, x + 6, y + 6, 10, { color: col, glow: selected ? 0.8 : 0.2 });
        const maxChars = Math.max(8, Math.floor((colW - 18) / (8 * 5.5 / 6)));
        const name = n.name.length > maxChars ? n.name.slice(0, maxChars - 1) + '.' : n.name;
        drawText(s, name, x + 6, y + 20, 8, { color: col, glow: 0 });
        if (!owned && verdict !== 'OK') drawText(s, verdict === 'REQUIRES' ? `NEEDS ${n.requires.join(',')}` : verdict === 'MODE' ? 'SCI-FI' : 'RESEARCH', x + 6, y + 33, 8, { color: p.dim, glow: 0 });
      });
    });
    const sel = this.nodesOf(TRACKS[this.track] as string)[this.row];
    if (sel) drawText(s, `${sel.name}${sel.note ? ': ' + sel.note.toUpperCase() : ''}`, m, s.height - m - 48, 11, { color: p.ink, glow: 0.3 });
    if (this.note) drawText(s, this.note, m, s.height - m - 30, 11, { color: p.hot, glow: 0.8 });
    drawTextFit(s, 'LEFT / RIGHT TRACK    UP / DOWN NODE    <ENTER> OR CLICK AGAIN UNLOCK    <L> LEARN ABOUT THIS TRACK    <T> OR <ESC> CLOSE', s.width / 2, s.height - m - 12, 12, s.width - 32, { align: 'center', color: p.dim, glow: 0 });
  }
}
