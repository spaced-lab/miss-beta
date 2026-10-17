// WHAT: Sound kits for PERIMETER: sim events in, synth calls out.
// WHY:  The sim never touches audio (it stays pure and testable); it emits events and this module decides
//       what they sound like. Three kits exist so variants can be compared in play (key 5 cycles them).
// HOW:  `SfxPlayer.play(events)` is called once per frame with the events the step produced. Ticks are
//       rate-limited so eight launchers at full fire stay delicate. Everything is lo-fi and short:
//       ticks 15 to 25 ms, crunches under 200 ms, the laser and the pulse are 303-style sweeps, level-ups
//       and turrets are SH-101-style sample-and-hold tones, bullet hits are pixel-dust grains. The mix leans
//       bassy on purpose (owner's note, 2026-10-17): hits, breakups and crashes carry a sub layer (synth.bass
//       with its 30-45 Hz second voice), crunches are lowpassed lower, the ticks stay as bright blips but a
//       notch quieter, and the master compressor in synth.ts keeps forty stacked hits from clipping.
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
  private lastBass = 0;
  private hitCount = 0;
  private staticAcc = 0;

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

  /**
   * Ambient bass static: discrete low pops whose rate follows the chaos level (0..1). Call every frame with
   * the frame's seconds so the rate is time-based, not frame-based.
   */
  ambient(chaos: number, dt: number): void {
    if (!this.enabled || !this.synth.ready || chaos < 0.2) return;
    const rate = 1.5 + 9 * chaos; // pops per second
    this.staticAcc += rate * dt;
    if (this.staticAcc >= 1 && Math.random() < 0.7) {
      this.staticAcc = 0;
      this.synth.bassStatic(0.05 + 0.14 * chaos, 0.05 + 0.07 * chaos);
    }
  }

  play(events: readonly SimEvent[], now: number): void {
    if (!this.enabled || !this.synth.ready) return;
    const k = this.kit;
    for (const e of events) {
      switch (e.type) {
        case 'shot':
          if (now - this.lastTick > 0.045) {
            this.lastTick = now;
            // The blip stays bright, just a notch quieter than before; the bass under it does the weight.
            this.synth.tick({ wave: k.tickWave, freq: k.tickFreq * (1 + 0.18 * (e.strength - 1)), dur: 0.014 + 0.004 * e.strength, gain: 0.04 });
            this.synth.bass(62 + 8 * e.strength, 0.03, 0.09, 0.5, 1.5);
          }
          break;
        case 'laser':
          // Soft zap: a triangle sweep with a gentle filter.
          this.synth.sweep({ wave: 'triangle', freq: 640, freqEnd: 110, cutoff: 1800, cutoffEnd: 220, q: 3, dur: 0.16, gain: 0.13 });
          this.synth.bass(55, 0.08, 0.12);
          break;
        case 'hit':
          // Bullet hit: a little dust on top, a sub pop underneath on every second hit (rate limited).
          if (now - this.lastGrain > 0.03) {
            this.lastGrain = now;
            this.synth.grains({ count: 2, spread: 0.04, grainDur: 0.008, cutoff: 2600 + e.tier * 500, gain: 0.03 });
          }
          if (++this.hitCount % 2 === 0 && now - this.lastBass > 0.045) {
            this.lastBass = now;
            this.synth.bass(44 + e.tier * 5, 0.045, 0.11, 0.8, 2);
          }
          break;
        case 'break':
          // Breakup: crunch lowpassed low, dust, and a long sub thump that grows with size and tier.
          this.synth.crunch({ rate: k.crunchRate, bits: k.crunchBits, dur: 0.12 + e.r * 0.3, cutoff: 1500, gain: 0.2 + e.tier * 0.04, pitch: 1.1 - e.r });
          this.synth.grains({ count: 4, spread: 0.1, grainDur: 0.009, cutoff: 2000, gain: 0.035 });
          this.synth.bass(40 + e.tier * 4, 0.14 + e.r * 0.25, 0.26 + e.tier * 0.02, 0.9, 2);
          break;
        case 'crash':
          this.synth.crunch({ rate: 3500, bits: 3, dur: 0.09, cutoff: 600, gain: 0.11 });
          this.synth.bass(46, 0.07, 0.14, 0.8, 1.8);
          break;
        case 'impact':
          // Deeper and longer than before: a sub thud with a tail.
          this.synth.thud(52, 0.45, 0.42);
          this.synth.bass(36, 0.25, 0.3);
          break;
        case 'moonhit':
          this.synth.crunch({ rate: 3000, bits: 3, dur: 0.12, cutoff: 700, gain: 0.14 });
          this.synth.bass(44, 0.1, 0.14);
          break;
        case 'moonlost':
          this.synth.sweep({ wave: 'sawtooth', freq: 120, freqEnd: 25, cutoff: 1500, cutoffEnd: 60, q: 6, dur: 1.0, gain: 0.28 });
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
