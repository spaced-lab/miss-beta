// WHAT: Seeded pseudo-random number generator (mulberry32) plus string hashing.
// WHY:  Design pillar 5: a round is fully determined by its seed. Leaderboards compare, replays are exact,
//       and the resolver can be re-run anywhere (worker, tests, Python) with identical results. Math.random
//       is never used in sim code.
// HOW:  mulberry32 is a 32-bit state generator with a 2^32 period, good enough for game randomness and
//       trivially portable to Python (pymiss/sim/rng.py mirrors it bit for bit). Every random draw goes
//       through one Rng instance in a fixed order, so changing the order of draws changes the round;
//       that is intentional and tested.
// LORE: O14 (randomness and probability), C3 (tests and the two-language trick)

export class Rng {
  private state: number;

  constructor(seed: number) {
    // NOTE: force into uint32 so negative or fractional seeds behave the same in TS and Python.
    this.state = seed >>> 0;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    // mulberry32 (Tommy Ettinger, public domain)
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let z = this.state;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform float in [lo, hi). */
  float(lo: number, hi: number): number {
    return lo + (hi - lo) * this.next();
  }

  /** Uniform integer in [lo, hi] inclusive. */
  int(lo: number, hi: number): number {
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }

  /** Log-uniform float in [lo, hi): equal probability per decade. Used for threat diameters. */
  logUniform(lo: number, hi: number): number {
    return Math.exp(this.float(Math.log(lo), Math.log(hi)));
  }

  /** Standard normal via Box-Muller (one sample; the second is discarded to keep the stream order simple). */
  gaussian(mean = 0, sigma = 1): number {
    let u = 0;
    while (u === 0) u = this.next(); // avoid log(0)
    const v = this.next();
    return mean + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Rayleigh distributed sample with the given scale. Used for fragment ejection speeds. */
  rayleigh(scale: number): number {
    let u = 0;
    while (u === 0) u = this.next();
    return scale * Math.sqrt(-2 * Math.log(u));
  }

  pick<T>(items: readonly T[]): T {
    const i = this.int(0, items.length - 1);
    const v = items[i];
    if (v === undefined) throw new Error('Rng.pick: empty array');
    return v;
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Expose the raw state so a save file can resume a stream exactly. */
  getState(): number {
    return this.state;
  }

  /** Resume a stream from a raw state captured with getState(): the next draw is the one that would have come. */
  static fromState(state: number): Rng {
    const r = new Rng(0);
    r.state = state >>> 0;
    return r;
  }

  /** Derive a child generator (e.g. one per round) without disturbing this stream's determinism. */
  fork(): Rng {
    return new Rng(Math.floor(this.next() * 4294967296));
  }
}

/**
 * FNV-1a 32-bit hash of a string, so human-readable seeds ("TUTORIAL-1", "8F3A21C9") map to a uint32.
 * Mirrored in pymiss/sim/rng.py.
 */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Build a round-specific generator from the run seed and the round index, in a fixed, documented way. */
export function roundRng(runSeed: string, roundIndex: number): Rng {
  return new Rng(hashSeed(`${runSeed}#${roundIndex}`));
}
