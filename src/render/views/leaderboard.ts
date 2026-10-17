// WHAT: LEADERBOARD screen (GAME_PLAN 13.7): the local top 20 for the REALISTIC board.
// WHY:  Runs are seeded, so a score next to its seed is a challenge anyone can replay.
// HOW:  Reads game/leaderboard.ts (validated localStorage). Mode tabs arrive with modes in M7.
// LORE: G5 (scoring)

import type { Router, Screen } from '../../game/screen';
import { loadBoard } from '../../game/leaderboard';
import type { Input } from '../../ui/input';
import type { Surface } from '../canvas';
import { drawText } from '../vectorFont';

export class LeaderboardScreen implements Screen {
  constructor(private readonly s: Surface, private readonly keys: Input, private readonly router: Router) {}
  enter(): void {}
  exit(): void {}
  update(): void {
    if (this.keys.pressed('Escape') || this.keys.pressed('Enter') || this.keys.pressed('Space')) this.router.go('title');
  }
  render(): void {
    const s = this.s;
    const p = s.palette;
    s.clear();
    const m = 16;
    drawText(s, 'LEADERBOARD  REALISTIC', s.width / 2, m + 10, 20, { align: 'center', color: p.hot, glow: 1.5 });
    const board = loadBoard();
    const x = Math.max(m, s.width / 2 - 330);
    let y = m + 56;
    drawText(s, 'RANK  HANDLE    ROUNDS   SCORE     SEED          DATE        TECH', x, y, 11, { color: p.dim, glow: 0 });
    y += 20;
    if (board.length === 0) drawText(s, 'NO RUNS YET. SURVIVE A ROUND, THEN LOSE ONE.', x, y, 12);
    board.forEach((e, i) => {
      const line = `${String(i + 1).padStart(2, ' ')}    ${e.handle.padEnd(8).slice(0, 8)}  ${String(e.rounds).padStart(5, ' ')}   ${String(e.score).padStart(7, ' ')}   ${e.seed.padEnd(12).slice(0, 12)}  ${e.date}  ${e.tech}${e.assisted ? '  ASSISTED' : ''}`;
      drawText(s, line, x, y, 11, { color: i === 0 ? p.hot : p.ink, glow: i === 0 ? 1 : 0.4 });
      y += 18;
    });
    drawText(s, '<ESC> TITLE', s.width / 2, s.height - m - 12, 12, { align: 'center', color: p.dim, glow: 0 });
  }
}
