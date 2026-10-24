// WHAT: TECH TREE overlay (GAME_PLAN 13.5): tracks as columns, nodes as boxes, research counter, unlock.
// WHY:  Research is the run's long-term currency; this is where the player decides between faster
//       launchers, bigger impactors, sails, autonomy, warheads and slow pushers.
// HOW:  Left/Right pick a track, Up/Down a node, Enter unlocks (game/tech.ts decides). Owned nodes are
//       bright, available ones normal, locked ones dim with the reason.
// LORE: D11 (the catalog and the chart), G1 (how to play)

import { Materialize } from '../wire';
import type { RunState } from '../../game/run';
import { topicForTrack } from '../../game/loreLinks';
import { canUnlock, TECH, TRACKS, unlock, type TechNode } from '../../game/tech';
import type { Input } from '../../ui/input';
import type { Surface } from '../canvas';
import { uiColors, withAlpha } from '../palettes';
import { drawText, drawTextFit } from '../vectorFont';
import { familyForTech } from '../../planner/families';

export class TechOverlay {
  /** Overlay frame transition and the reduce-motion switch (set by the owner screen). */
  private readonly mat = new Materialize();
  still: () => boolean = () => false;
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
    this.mat.start();
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
    const tab = click ? this.tabHits.find((b) => click.x >= b.x && click.x <= b.x + b.w && click.y >= b.y && click.y <= b.y + b.h) : undefined;
    if (tab) {
      this.track = tab.track;
      this.row = 0;
    } else if (click) {
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

  /** Track tabs from the last compact frame (a tap picks the track). */
  private tabHits: { x: number; y: number; w: number; h: number; track: number }[] = [];
  /** Px reserved along the bottom edge (the owner's action bar), set by the owner each frame. */
  bottomInset = 36;
  /** Phone layout (IDEAS 38): one track at a time, picked from a row of tabs; its nodes as full-width boxes. */
  private compact(): boolean {
    return this.s.width < 700 || this.s.height < 500;
  }

  private renderCompact(run: RunState): void {
    const s = this.s;
    const p = s.palette;
    const ui = uiColors(p, s.spectrum);
    const m = 12;
    const W = s.width;
    drawTextFit(s, `TECH TREE   RESEARCH ${run.research}`, m + (this.keys.touchUsed ? 34 : 0), m, 12, W - 2 * m - 34, { color: ui.title, glow: 1.2 });
    // Track tabs: two rows of six, each a box with a short label.
    const perRow = 6;
    const gap = 4;
    const tw = (W - 2 * m - gap * (perRow - 1)) / perRow;
    const th = 22;
    let ty = m + 22;
    this.tabHits = [];
    TRACKS.forEach((track, ti) => {
      const x = m + (ti % perRow) * (tw + gap);
      const y = ty + Math.floor(ti / perRow) * (th + gap);
      const on = ti === this.track;
      const ownedN = this.nodesOf(track).filter((n) => run.tech.includes(n.id)).length;
      s.stroke([x, y, x + tw, y, x + tw, y + th, x, y + th], { closed: true, color: on ? p.hot : p.dim, glow: on ? 1 : 0 });
      drawTextFit(s, `${track.slice(0, 5)} ${ownedN}`, x + tw / 2, y + th / 2 - 4, 7.5, tw - 6, { align: 'center', color: on ? p.hot : ui.text, glow: on ? 0.8 : 0.2 });
      this.tabHits.push({ x, y, w: tw, h: th, track: ti });
    });
    ty += 2 * (th + gap) + 4;
    const track = TRACKS[this.track] as string;
    drawText(s, track, m, ty, 10, { color: p.hot, glow: 1 });
    ty += 16;
    const nodes = this.nodesOf(track);
    const bottom = s.height - this.bottomInset - 40;
    const bh = Math.max(30, Math.min(44, (bottom - ty - 6 * (nodes.length - 1)) / Math.max(1, nodes.length)));
    this.boxes = [];
    nodes.forEach((n, ri) => {
      const y = ty + ri * (bh + 6);
      const owned = run.tech.includes(n.id);
      const verdict = canUnlock(run, n.id);
      const selected = ri === this.row;
      const col = owned ? p.hot : verdict === 'OK' ? p.ink : verdict === 'RESEARCH' ? ui.text : p.dim;
      const w = W - 2 * m;
      this.boxes.push({ x: m, y, w, h: bh, track: this.track, row: ri });
      s.stroke([m, y, m + w, y, m + w, y + bh, m, y + bh], { closed: true, color: col, glow: selected ? 1.5 : owned ? 0.8 : 0, width: selected ? 1.5 : 1, ...(owned || verdict === 'OK' ? {} : { dash: [3, 4] }) });
      drawTextFit(s, `${n.id}  ${owned ? 'OWNED' : `${n.cost} RP`}   ${n.name}`, m + 6, y + 5, 9, w - 12, { color: col, glow: selected ? 0.8 : 0.2 });
      if (bh >= 30) drawTextFit(s, owned ? 'OWNED' : verdict === 'OK' ? 'TAP AGAIN OR UNLOCK TO BUY' : verdict === 'REQUIRES' ? `NEEDS ${n.requires.join(', ')}` : verdict === 'MODE' ? 'SCI-FI MODE ONLY' : `NEXT: ${n.cost - run.research} MORE RP`, m + 6, y + 18, 8, w - 12, { color: verdict === 'RESEARCH' ? ui.sub : p.dim, glow: 0 });
    });
    const sel = nodes[this.row];
    const base = s.height - this.bottomInset;
    const opens = sel ? familyForTech(sel.id) : null;
    if (opens) drawTextFit(s, `OPENS THE ${opens.label} TAB IN THE PLANNER (P)${sel?.note ? '. ' + sel.note.toUpperCase() : ''}`, m, base - 30, 8, W - 2 * m, { color: p.ink, glow: 0.3 });
    else if (sel?.note) drawTextFit(s, sel.note.toUpperCase(), m, base - 30, 8, W - 2 * m, { color: p.ink, glow: 0.3 });
    if (this.note) drawTextFit(s, this.note, m, base - 16, 9, W - 2 * m, { color: p.hot, glow: 0.8 });
  }

  render(run: RunState): void {
    if (!this.open) return;
    const s = this.s;
    const p = s.palette;
    const m = 16;
    s.ctx.fillStyle = withAlpha(p.bg, 0.9);
    s.ctx.fillRect(0, 0, s.width, s.height);
    // Materialize (24.2): the frame draws itself in when the overlay opens.
    this.mat.tick(1 / 60);
    this.mat.frame(s, 3, 3, s.width - 6, s.height - 6, 0.8, this.still());
    if (this.compact()) {
      this.renderCompact(run);
      return;
    }
    this.tabHits = [];
    drawText(s, `TECH TREE   RESEARCH ${run.research}`, m, m, 14, { color: uiColors(p, s.spectrum).title, glow: 1.2 });
    drawText(s, 'RESEARCH POINTS COME WITH EVERY ROUND YOU SURVIVE (SEE THE DEBRIEF). SOLID: BUY NOW. DASHED: NEXT, OR LOCKED.', s.width - m, m + 3, 9, { align: 'right', color: uiColors(p, s.spectrum).sub, glow: 0.2 });
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
        // Four readable states: owned (hot), buyable now (ink), next in line but short of research (the NEON
        // text colour, dashed), locked behind another node or mode (dim, dashed).
        const ui = uiColors(p, s.spectrum);
        const col = owned ? p.hot : verdict === 'OK' ? p.ink : verdict === 'RESEARCH' ? ui.text : p.dim;
        const w = colW - 12;
        this.boxes.push({ x, y, w, h: 46, track: ti, row: ri });
        s.stroke([x, y, x + w, y, x + w, y + 46, x, y + 46], { closed: true, color: col, glow: selected ? 1.5 : owned ? 0.8 : 0, width: selected ? 1.5 : 1, ...(owned || verdict === 'OK' ? {} : { dash: [3, 4] }) });
        if (ri > 0) s.stroke([x + w / 2, y - 12, x + w / 2, y], { color: p.dim, glow: 0 });
        drawText(s, `${n.id}  ${owned ? 'OWNED' : `${n.cost} RP`}`, x + 6, y + 6, 10, { color: col, glow: selected ? 0.8 : 0.2 });
        const maxChars = Math.max(8, Math.floor((colW - 18) / (8 * 5.5 / 6)));
        const name = n.name.length > maxChars ? n.name.slice(0, maxChars - 1) + '.' : n.name;
        drawText(s, name, x + 6, y + 20, 8, { color: col, glow: 0 });
        if (!owned && verdict !== 'OK') drawText(s, verdict === 'REQUIRES' ? `NEEDS ${n.requires.join(',')}` : verdict === 'MODE' ? 'SCI-FI' : `NEXT: ${n.cost - run.research} MORE RP`, x + 6, y + 33, 8, { color: verdict === 'RESEARCH' ? ui.sub : p.dim, glow: 0 });
      });
    });
    const sel = this.nodesOf(TRACKS[this.track] as string)[this.row];
    const base = s.height - this.bottomInset;
    const opens = sel ? familyForTech(sel.id) : null;
    if (sel) drawTextFit(s, `${sel.name}${opens ? `: OPENS THE ${opens.label} TAB IN THE PLANNER (P)` : ''}${sel.note ? (opens ? '. ' : ': ') + sel.note.toUpperCase() : ''}`, m, base - 32, 11, s.width - 2 * m, { color: p.ink, glow: 0.3 });
    if (this.note) drawText(s, this.note, m, base - 14, 11, { color: p.hot, glow: 0.8 });
  }
}
