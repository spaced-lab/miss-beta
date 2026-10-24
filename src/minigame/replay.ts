// WHAT: PERIMETER replays (IDEAS 4): the input stream, run-length encoded, and a player that feeds it back.
// WHY:  The sim is deterministic in (seed, collision strategy, inputs), so a whole game is a seed plus a few
//       thousand numbers. "Watch best run" falls out, and so does a regression fixture for the sim.
// HOW:  Each fixed step's Input becomes a 6-bit mask (left, right, fire, pulse, seeker, swarm). The recorder
//       stores [mask, count, mask, count, ...]; the player expands it step by step. Pure, no DOM.
// LORE: O14 (randomness, seeds), C1 (how the game is built)

import { MG, type Difficulty } from './config';
import type { Input } from './sim';

export function inputMask(i: Readonly<Input>): number {
  return (i.left ? 1 : 0) | (i.right ? 2 : 0) | (i.fire ? 4 : 0) | (i.pulse ? 8 : 0) | (i.seeker ? 16 : 0) | (i.swarm ? 32 : 0);
}

export function maskInput(m: number): Input {
  return { left: (m & 1) !== 0, right: (m & 2) !== 0, fire: (m & 4) !== 0, pulse: (m & 8) !== 0, seeker: (m & 16) !== 0, swarm: (m & 32) !== 0 };
}

export class Recorder {
  readonly rle: number[] = [];
  push(i: Readonly<Input>): void {
    const m = inputMask(i);
    const n = this.rle.length;
    if (n >= 2 && this.rle[n - 2] === m) this.rle[n - 1] = (this.rle[n - 1] ?? 0) + 1;
    else this.rle.push(m, 1);
  }
}

export class Player {
  private i = 0;
  private left = 0;
  constructor(private readonly rle: readonly number[]) {
    this.left = rle[1] ?? 0;
  }
  /** The next step's input, or null when the recording has ended. */
  next(): Input | null {
    while (this.left <= 0) {
      this.i += 2;
      if (this.i >= this.rle.length) return null;
      this.left = this.rle[this.i + 1] ?? 0;
    }
    this.left--;
    return maskInput(this.rle[this.i] ?? 0);
  }
}

export interface SavedReplay {
  seed: number;
  collision: 'auto' | 'naive' | 'grid';
  score: number;
  rle: number[];
  /** Absent in replays saved before difficulty levels: NORMAL. */
  difficulty?: Difficulty;
  /** The LEVEL TURN switch the game ran with; absent in older replays: on. */
  levelTurn?: boolean;
}

export const isSavedReplay = (v: unknown): v is SavedReplay => {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.seed === 'number' && typeof o.score === 'number' && (o.collision === 'auto' || o.collision === 'naive' || o.collision === 'grid') && Array.isArray(o.rle) && o.rle.every((x) => typeof x === 'number' && Number.isInteger(x) && x >= 0) && (o.difficulty === undefined || (MG.DIFFICULTY_ORDER as readonly unknown[]).includes(o.difficulty)) && (o.levelTurn === undefined || typeof o.levelTurn === 'boolean');
};
