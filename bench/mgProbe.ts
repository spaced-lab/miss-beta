// WHAT: The PERIMETER balance probe: the bot (src/minigame/bot.ts) plays seeds 1..4 from each start level and the
//       table reports seconds survived and the level reached (docs/MINIGAME_BACKLOG.md "Measured difficulty table").
// WHY:  IDEAS 31: balance is changed by knobs and checked by measurement, never by feel. One shared harness so the
//       three difficulty benches (minigame*.bench.ts) run in parallel, one per vitest worker. Results land in
//       .dev/mg-<difficulty>.txt.
// HOW:  newGame(seed, 'auto', { difficulty, startLevel }) then step(st, botInput(st), MG.DT) until game over or the
//       cap; god mode off. Pure and seeded, so a cell replays exactly.
// LORE: C3 (tests), G6 (modes)

import { botInput } from '../src/minigame/bot';
import { MG, type Difficulty } from '../src/minigame/config';
import { newGame } from '../src/minigame/modes';
import { step } from '../src/minigame/sim';

/** node:fs, loaded by a computed specifier: the repo has no Node type declarations (src is browser code). */
export interface NodeFs { mkdirSync(p: string, o: { recursive: boolean }): void; writeFileSync(p: string, d: string): void; appendFileSync(p: string, d: string): void }
export const nodeFs = async (): Promise<NodeFs> => (await import(/* @vite-ignore */ `node:${'fs'}`)) as NodeFs;

export interface Cell { start: number; secs: number[]; levels: number[]; alive: boolean[] }

export function probe(difficulty: Difficulty, starts: readonly number[] = MG.START_LEVELS, seeds: readonly number[] = [1, 2, 3, 4], cap = 900): Cell[] {
  return starts.map((start) => {
    const cell: Cell = { start, secs: [], levels: [], alive: [] };
    for (const seed of seeds) {
      const st = newGame(seed, 'auto', { difficulty, startLevel: start });
      const t0 = st.t;
      const n = Math.round(cap / MG.DT);
      for (let i = 0; i < n && st.status === 'playing'; i++) {
        step(st, botInput(st), MG.DT);
        st.events.length = 0;
      }
      cell.secs.push(Math.round(st.t - t0));
      cell.levels.push(st.level);
      cell.alive.push(st.status === 'playing');
    }
    return cell;
  });
}

/**
 * One table row per start level: "min-max s (+ if alive at the cap), Lmin-Lmax". NOTE: written to
 * .dev/mg-<difficulty>.txt (gitignored), because this vitest setup does not show console output from passing tests.
 */
export async function report(difficulty: Difficulty, cells: readonly Cell[], tag = ''): Promise<string> {
  const lines = [`${difficulty.toUpperCase()}${tag ? ` ${tag}` : ''}`];
  for (const c of cells) {
    const plus = c.alive.some((a) => a) ? '+' : '';
    lines.push(`  start ${String(c.start).padStart(2)}: ${Math.min(...c.secs)}-${Math.max(...c.secs)}${plus} s, L${Math.min(...c.levels)}-${Math.max(...c.levels)}${plus}   [${c.secs.join(' ')}] [L ${c.levels.join(' ')}]`);
  }
  const text = lines.join('\n') + '\n';
  const fs = await nodeFs();
  fs.mkdirSync('.dev', { recursive: true });
  fs.writeFileSync(`.dev/mg-${difficulty}.txt`, text);
  return text;
}
