// WHAT: LEADERBOARD screen (GAME_PLAN 13.7): the local top 20 for the REALISTIC board.
// WHY:  Runs are seeded, so a score next to its seed is a challenge anyone can replay.
// HOW:  Reads game/leaderboard.ts (validated localStorage). Mode tabs arrive with modes in M7.
// LORE: G5 (scoring)

import type { Router, Screen } from '../../game/screen';
import { loadBoard, type Mode } from '../../game/leaderboard';
import type { Input } from '../../ui/input';
import type { Surface } from '../canvas';
import { drawText, drawTextFit } from '../vectorFont';
import { ScreenBar } from '../../ui/actionBar';
import type { GearSpec } from '../../ui/gearMenu';

const MODES: readonly Mode[] = ['REALISTIC', 'SCIFI', 'FICTION'];

export class LeaderboardScreen implements Screen {
  private tab = 0;
  private readonly bar = new ScreenBar();
  constructor(private readonly s: Surface, private readonly keys: Input, private readonly router: Router) {}
  enter(): void {}
  exit(): void {}
  gear(): GearSpec {
    return { title: 'LEADERBOARD', items: [...this.bar.items] };
  }
  update(): void {
    this.bar.tap(this.keys);
    if (this.keys.pressed('Escape') || this.keys.pressed('Enter') || this.keys.pressed('Space')) this.router.go('title');
    if (this.keys.pressed('ArrowLeft')) this.tab = (this.tab + MODES.length - 1) % MODES.length;
    if (this.keys.pressed('ArrowRight')) this.tab = (this.tab + 1) % MODES.length;
  }
  render(): void {
    const s = this.s;
    const p = s.palette;
    s.clear();
    const m = 16;
    // A phone (under 700 px) shows rank, handle, rounds and score only, at 10 px.
    const compact = s.width < 700;
    drawText(s, 'LEADERBOARD', s.width / 2, m + 6, 20, { align: 'center', color: p.hot, glow: 1.5 });
    const step = compact ? (s.width - 2 * m) / MODES.length : 120;
    let tx = compact ? m : s.width / 2 - 170;
    MODES.forEach((mode, i) => {
      drawTextFit(s, mode, tx, m + 34, 12, step - 8, { color: i === this.tab ? p.hot : p.dim, glow: i === this.tab ? 1.2 : 0 });
      tx += step;
    });
    const board = loadBoard(MODES[this.tab] ?? 'REALISTIC');
    const x = Math.max(m, s.width / 2 - 330);
    let y = m + 60;
    drawText(s, compact ? 'RANK  HANDLE    ROUNDS   SCORE' : 'RANK  HANDLE    ROUNDS   SCORE     SEED          DATE        TECH', x, y, compact ? 10 : 11, { color: p.dim, glow: 0 });
    y += 20;
    if (board.length === 0) drawText(s, this.tab === 0 ? 'NO RUNS YET. SURVIVE A ROUND, THEN LOSE ONE.' : 'THIS MODE ARRIVES IN M7.', x, y, 12);
    board.forEach((e, i) => {
      if (y > s.height - this.bar.height - 20) return;
      const line = compact
        ? `${String(i + 1).padStart(2, ' ')}    ${e.handle.padEnd(8).slice(0, 8)}  ${String(e.rounds).padStart(5, ' ')}   ${String(e.score).padStart(7, ' ')}${e.assisted ? '  ASSISTED' : ''}`
        : `${String(i + 1).padStart(2, ' ')}    ${e.handle.padEnd(8).slice(0, 8)}  ${String(e.rounds).padStart(5, ' ')}   ${String(e.score).padStart(7, ' ')}   ${e.seed.padEnd(12).slice(0, 12)}  ${e.date}  ${e.tech}${e.assisted ? '  ASSISTED' : ''}${e.exaggerated ? '  EXAGGERATED' : ''}`;
      drawTextFit(s, line, x, y, compact ? 10 : 11, s.width - x - m, { color: i === 0 ? p.hot : p.ink, glow: i === 0 ? 1 : 0.4 });
      y += 18;
    });
    this.bar.draw(s, [{ label: '< MODE', code: 'ArrowLeft' }, { label: 'MODE >', code: 'ArrowRight' }, { label: 'TITLE', code: 'Escape', key: 'ESC' }], this.keys.touchUsed || compact);
  }
}
