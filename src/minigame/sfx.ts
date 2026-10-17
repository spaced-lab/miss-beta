// WHAT: Sound kits for PERIMETER: sim events in, synth calls out.
// WHY:  The sim never touches audio (it stays pure and testable); it emits events and this module decides
//       what they sound like. Three kits exist so variants can be compared in play (key 5 cycles them).
// HOW:  `SfxPlayer.play(events)` is called once per frame with the events the step produced. Ticks are
//       rate-limited so eight launchers at full fire stay delicate. Everything is lo-fi and short:
//       ticks 15 to 25 ms, crunches under 200 ms, the laser and the pulse are 303-style sweeps, level-ups
//       and turrets are SH-101-style sample-and-hold tones, bullet hits are pixel-dust grains.
// LORE: G8 (the look, and the sound)

import { Synth } from '../audio/synth';
import type { SimEvent } from './sim';

export interface Kit {
  name: string;
  tickWave: OscillatorType;
  tickFreq: number;
  crunchRate: number;
  crunchBits: number;
  laserWave: OscillatorType;
}

export const KITS: readonly Kit[] = [
  { name: 'DELICATE', tickWave: 'triangle', tickFreq: 2600, crunchRate: 7000, crunchBits: 4, laserWave: 'sawtooth' },
  { name: 'SQUARE', tickWave: 'square', tickFreq: 1900, crunchRate: 5000, crunchBits: 3, laserWave: 'square' },
  { name: 'GLASS', tickWave: 'sine', tickFreq: 3400, crunchRate: 9000, crunchBits: 5, laserWave: 'sawtooth' },
];

export class SfxPlayer {
  readonly synth = new Synth();
  enabled = true;
  kitIndex = 0;
  private lastTick = 0;
  private lastGrain = 0;

  get kit(): Kit {
    return KITS[this.kitIndex] ?? (KITS[0] as Kit);
  }

  /** Call from a user-gesture handler (any key) so the browser allows audio. */
  unlock(): void {
    this.synth.ensure();
  }

  cycleKit(): void {
    this.kitIndex = (this.kitIndex + 1) % KITS.length;
  }

  play(events: readonly SimEvent[], now: number): void {
    if (!this.enabled || !this.synth.ready) return;
    const k = this.kit;
    for (const e of events) {
      switch (e.type) {
        case 'shot':
          if (now - this.lastTick > 0.045) {
            this.lastTick = now;
            this.synth.tick({ wave: k.tickWave, freq: k.tickFreq * (1 + 0.18 * (e.strength - 1)), dur: 0.016 + 0.004 * e.strength, gain: 0.07 });
          }
          break;
        case 'laser':
          this.synth.sweep({ wave: k.laserWave, freq: 220, freqEnd: 55, cutoff: 5000, cutoffEnd: 300, q: 14, dur: 0.22, gain: 0.22 });
          break;
        case 'hit':
          if (now - this.lastGrain > 0.03) {
            this.lastGrain = now;
            this.synth.grains({ count: 3, spread: 0.05, cutoff: 3000 + e.tier * 800, gain: 0.05 });
          }
          break;
        case 'break':
          this.synth.crunch({ rate: k.crunchRate, bits: k.crunchBits, dur: 0.14 + e.r * 0.3, cutoff: 3200, gain: 0.22 + e.tier * 0.04, pitch: 1.3 - e.r });
          this.synth.grains({ count: 6, spread: 0.12, cutoff: 2500, gain: 0.05 });
          break;
        case 'impact':
          this.synth.thud(80, 0.3, 0.35);
          break;
        case 'overheat':
          this.synth.sweep({ wave: 'square', freq: 160, freqEnd: 60, cutoff: 1200, cutoffEnd: 200, q: 6, dur: 0.4, gain: 0.18 });
          break;
        case 'cooled':
          this.synth.tick({ wave: 'triangle', freq: 900, dur: 0.06, gain: 0.1 });
          break;
        case 'pulse':
          this.synth.sweep({ wave: 'sawtooth', freq: 55, freqEnd: 440, cutoff: 300, cutoffEnd: 6000, q: 10, dur: 0.6, gain: 0.25 });
          break;
        case 'levelup':
          this.synth.lfoTone({ base: 660, spread: 1.2, stepDur: 0.035, dur: 0.4, wave: 'square', gain: 0.1 });
          break;
        case 'turret':
          this.synth.lfoTone({ base: 330, spread: 0.6, stepDur: 0.05, dur: 0.5, wave: 'sawtooth', gain: 0.1 });
          break;
        case 'moon':
          this.synth.crunch({ rate: 4000, bits: 3, dur: 0.1, cutoff: 1500, gain: 0.12 });
          break;
        case 'over':
          this.synth.sweep({ wave: 'sawtooth', freq: 220, freqEnd: 30, cutoff: 3000, cutoffEnd: 80, q: 8, dur: 1.2, gain: 0.3 });
          break;
      }
    }
  }
}
