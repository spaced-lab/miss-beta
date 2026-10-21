// WHAT: Computer chatter for the SUPER-DUPER-DEMO's data-centre scenes: quiet, low bleeps and bloops in quick bursts.
// WHY:  Owner 2026-10-20: the old chatter (square ticks at 880-2000 Hz, faster as the demo sped up) sounded like midrange
//       clicking, "like clocks speeding up", and took away from the scenes; asked for "quieter lower bleeps and bloops
//       rapidly in bursts when the computer scene is occurring".
// HOW:  A small scheduler the caller steps with real dt. It plays a burst of 4-7 notes NOTE_S apart, then rests REST_S
//       (shorter as `pace` in 0..1 rises). Notes are soft triangle or sine waves with a 6 ms attack (no click) on a
//       low pentatonic scale (196-392 Hz, G3 to G4), picked by a counter, so a run sounds the same every time.
// LORE: G8 (the look, and the sound)

import type { Synth } from './synth';

/** G3 pentatonic, Hz: G3 A3 B3 D4 E4 G4. */
const SCALE: readonly number[] = [196, 220, 247, 294, 330, 392];
const NOTE_S = 0.055;

export class Bloops {
  private wait = 0;
  private left = 0;
  private n = 0;

  /** Advance dt seconds at pace 0..1 and play any notes that fall due. */
  step(synth: Synth, dt: number, pace: number): void {
    this.wait -= dt;
    while (this.wait <= 0) {
      if (this.left <= 0) {
        // New burst after a rest: 0.32 s at pace 0, 0.12 s at full pace.
        this.left = 4 + (this.n % 4);
        this.wait += 0.32 - 0.2 * Math.max(0, Math.min(1, pace));
        continue;
      }
      this.left--;
      this.n++;
      const freq = SCALE[(this.n * 7 + (this.n >> 2)) % SCALE.length] ?? 220;
      // An occasional octave drop gives the "bloop".
      synth.tick({ freq: this.n % 5 === 0 ? freq / 2 : freq, dur: 0.045, wave: this.n % 3 ? 'triangle' : 'sine', gain: 0.022, attack: 0.006 });
      this.wait += NOTE_S;
    }
  }
}
