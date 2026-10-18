// WHAT: CONSOLE overlay (GAME_PLAN 13.10): type a command, see the reply. Opened with the backquote key.
// WHY:  Cheat codes, mode codes and the FICTION commands live here, in the open.
// HOW:  Text entry from Input.takeKeyEvents; Enter runs game/console.ts; Up recalls history. The screen
//       passes a GameContext so commands can touch the round.
// LORE: G6 (modes, civilization levels and cheat codes)

import { runCommand, type GameContext } from '../../game/console';
import type { Input } from '../../ui/input';
import type { Surface } from '../canvas';
import { withAlpha } from '../palettes';
import { drawText } from '../vectorFont';

export class ConsoleOverlay {
  private open = false;
  private line = '';
  private lines: string[] = ['MISS BETA CONSOLE. TYPE HELP. CODES FLAG THE RUN ASSISTED.'];
  private history: string[] = [];
  private histIdx = -1;
  constructor(private readonly s: Surface, private readonly keys: Input) {}

  get isOpen(): boolean {
    return this.open;
  }
  show(): void {
    this.open = true;
    this.keys.textMode = true;
    this.keys.takeKeyEvents();
  }
  hide(): void {
    this.open = false;
    this.keys.textMode = false;
  }

  update(ctx: GameContext): void {
    if (!this.open) return;
    const k = this.keys;
    if (k.pressed('Escape') || k.pressed('Backquote')) {
      this.hide();
      return;
    }
    if (k.pressed('ArrowUp') && this.history.length > 0) {
      this.histIdx = Math.min(this.history.length - 1, this.histIdx + 1);
      this.line = this.history[this.history.length - 1 - this.histIdx] ?? '';
    }
    if (k.pressed('ArrowDown')) {
      this.histIdx = Math.max(-1, this.histIdx - 1);
      this.line = this.histIdx < 0 ? '' : this.history[this.history.length - 1 - this.histIdx] ?? '';
    }
    for (const key of k.takeKeyEvents()) {
      if (key === 'Enter') {
        const cmd = this.line.trim();
        this.line = '';
        this.histIdx = -1;
        if (!cmd) continue;
        this.history.push(cmd);
        this.lines.push(`> ${cmd.toUpperCase()}`);
        for (const out of runCommand(cmd, ctx)) this.lines.push(out);
      } else if (key === 'Backspace') this.line = this.line.slice(0, -1);
      else if (key.length === 1 && key !== '`' && this.line.length < 60) this.line += key;
    }
    if (this.lines.length > 200) this.lines = this.lines.slice(-200);
  }

  render(ctx: GameContext): void {
    if (!this.open) return;
    const s = this.s;
    const p = s.palette;
    const m = 16;
    const h = Math.min(s.height * 0.6, 420);
    s.ctx.fillStyle = withAlpha(p.bg, 0.92);
    s.ctx.fillRect(0, 0, s.width, h + m);
    s.stroke([0, h + m, s.width, h + m], { color: p.dim, glow: 0.5 });
    const lineH = 14;
    const visible = Math.floor((h - 40) / lineH);
    const start = Math.max(0, this.lines.length - visible);
    let y = m;
    for (let i = start; i < this.lines.length; i++) {
      const l = this.lines[i] as string;
      drawText(s, l, m, y, 10, { color: l.startsWith('>') ? p.hot : p.ink, glow: l.startsWith('>') ? 0.6 : 0.2 });
      y += lineH;
    }
    const cursor = Math.floor(performance.now() / 400) % 2 === 0 ? '_' : ' ';
    drawText(s, `${ctx.run.mode}> ${this.line.toUpperCase()}${cursor}`, m, h - 10, 12, { color: p.hot, glow: 1 });
  }
}
