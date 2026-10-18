// WHAT: Sound kits for PERIMETER: sim events in, synth calls out.
// WHY:  The sim never touches audio (it stays pure and testable); it emits events and this module decides
//       what they sound like. Three kits exist so variants can be compared in play (key 5 cycles them).
// HOW:  `SfxPlayer.play(events)` is called once per frame with the events the step produced. Ticks are
//       rate-limited so eight launchers at full fire stay delicate. Everything is lo-fi and short:
//       ticks 10 to 25 ms, crunches under 250 ms, the laser and the pulse are 303-style sweeps, level-ups
//       and turrets are SH-101-style sample-and-hold tones. The mix leans bassy on purpose (owner's notes,
//       2026-10-17, three times): the hull hit is a deep rumble (synth.rumble: 40 Hz sub with a slow pitch drop
//       over a 120 Hz lowpassed noise bed, the loudest voice), hits are bass pops with almost no grain, breakups
//       are a big low thud with a tail (synth.thud at 45-60 Hz, tail and weight scaling with rock size and tier,
//       under a crunch lowpassed low), shots are a soft-attack low blip over a sub pop, and the ambient
//       bass static gains a second 80-120 Hz voice above chaos 0.5 so the field sounds busier as levels climb.
//       A laser MESH pull is a short cluster of layered zaps; a level-up is two gentle sub pulses. The master compressor in synth.ts keeps forty
//       stacked voices from clipping. None of this is audible in tests; the tuning numbers are commented inline.
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
  // tickFreq is the soft high component of a shot; the sub pop under it carries the weight (owner: less clicky,
  // more bassy). Lowered a fifth or so in the second pass (1200 -> 950, 900 -> 720, 1400 -> 1100).
  { name: 'DELICATE', tickWave: 'triangle', tickFreq: 950, crunchRate: 7000, crunchBits: 4, laserWave: 'sawtooth' },
  { name: 'SQUARE', tickWave: 'square', tickFreq: 720, crunchRate: 5000, crunchBits: 3, laserWave: 'square' },
  { name: 'GLASS', tickWave: 'sine', tickFreq: 1100, crunchRate: 9000, crunchBits: 5, laserWave: 'sawtooth' },
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
  private activityAcc = 0;

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
   * the frame's seconds so the rate is time-based, not frame-based. Above chaos 0.5 a second, slightly higher
   * voice (80-120 Hz sine pops, no sub) joins on its own clock, 0 to 6 pops per second as chaos goes 0.5 to 1:
   * the "activity" layer that rises with level (chaosLevel carries (level - 1) / 20).
   */
  ambient(chaos: number, dt: number): void {
    if (!this.enabled || !this.synth.ready || chaos < 0.2) return;
    const rate = 1.5 + 9 * chaos; // pops per second
    this.staticAcc += rate * dt;
    if (this.staticAcc >= 1 && Math.random() < 0.7) {
      this.staticAcc = 0;
      this.synth.bassStatic(0.05 + 0.14 * chaos, 0.05 + 0.07 * chaos);
    }
    if (chaos <= 0.5) return;
    const lift = (chaos - 0.5) * 2; // 0..1 over the top half of the chaos range
    this.activityAcc += 6 * lift * dt;
    if (this.activityAcc >= 1 && Math.random() < 0.8) {
      this.activityAcc = 0;
      // Tune here: 80-120 Hz keeps it above the 36-54 Hz static so the two read as separate rhythms.
      this.synth.bass(80 + Math.random() * 40, 0.045, 0.04 + 0.07 * lift, 0, 1);
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
            // Shot: a soft-attack low blip (12 ms, 0.7-1.1 kHz by kit, 6 ms attack so there is no click edge)
            // under which a 62-76 Hz sub pop carries the sound. Tune here: tick gain for presence, bass gain for weight.
            this.synth.tick({ wave: k.tickWave, freq: k.tickFreq * (1 + 0.1 * (e.strength - 1)), dur: 0.012, gain: 0.017, attack: 0.006 });
            this.synth.bass(55 + 7 * e.strength, 0.035, 0.13, 0.7, 1.6);
          }
          break;
        case 'laser':
          // Soft zap: a triangle sweep with a gentle filter.
          this.synth.sweep({ wave: 'triangle', freq: 640, freqEnd: 110, cutoff: 1800, cutoffEnd: 220, q: 3, dur: 0.16, gain: 0.13 });
          this.synth.bass(55, 0.08, 0.12);
          break;
        case 'mesh': {
          // MESH pull: a cluster of 3 to 5 layered zaps (one per 8 beams, 18 ms apart, each a fifth or so higher
          // than the last) over one fuller sub. Short on purpose: the whole cluster is under 200 ms.
          const n = Math.max(3, Math.min(5, Math.ceil(e.beams / 8)));
          for (let i = 0; i < n; i++) {
            this.synth.sweep({ wave: 'triangle', freq: 560 + i * 110, freqEnd: 95, cutoff: 1900, cutoffEnd: 190, q: 3, dur: 0.11, gain: 0.075, delay: i * 0.018 });
          }
          this.synth.bass(50, 0.1, 0.17, 0.9, 2);
          break;
        }
        case 'hit':
          // Bullet-on-rock hit: a bass pop, almost no grain. A 57-72 Hz sine (lower for harder tiers) with a
          // quick pitch drop (50 ms) and the sub under it, rate limited so a volley does not stack into mud; a
          // faint low crunch (cutoff 380 Hz, 30 ms) gives it an edge, and a single dust grain only every 120 ms.
          if (now - this.lastBass > 0.04) {
            this.lastBass = now;
            this.synth.bass(72 - e.tier * 3, 0.05, 0.17, 0.85, 1.7);
            this.synth.crunch({ rate: 2500, bits: 3, dur: 0.03, cutoff: 380, gain: 0.03 });
          }
          if (now - this.lastGrain > 0.12) {
            this.lastGrain = now;
            this.synth.grains({ count: 1, spread: 0.01, grainDur: 0.005, cutoff: 1600 + e.tier * 200, gain: 0.006 });
          }
          this.hitCount++;
          break;
        case 'break': {
          // Breakup: a big low thud with a tail (the hull hit itself is the deeper rumble above). Sine 60 Hz
          // dropping 3 Hz per tier (45 Hz floor),
          // tail 0.26 s + 0.5 s per radius + 0.03 s per tier (0.33 s for the smallest tier-0 shard, 0.62 s for the
          // largest tier-5 rock), weight 0.26 + 0.35 per radius + 0.03 per tier; its own crunch sits at 480 Hz
          // (hull: 700 Hz) and lasts 0.1 s + 0.25 s per radius. Under it the kit crunch, lowpassed lower than
          // before (900 Hz, was 1500) and pitched down with size, and a couple of dust grains for the sparkle.
          const freq = Math.max(45, 60 - e.tier * 3);
          this.synth.thud(freq, 0.26 + e.r * 0.5 + e.tier * 0.03, 0.26 + e.r * 0.35 + e.tier * 0.03, 480, 0.1 + e.r * 0.25);
          this.synth.crunch({ rate: k.crunchRate, bits: k.crunchBits, dur: 0.1 + e.r * 0.3, cutoff: 900, gain: 0.14 + e.tier * 0.03, pitch: 1.0 - e.r });
          this.synth.grains({ count: 2, spread: 0.08, grainDur: 0.008, cutoff: 1800, gain: 0.02 });
          break;
        }
        case 'crash':
          this.synth.crunch({ rate: 3500, bits: 3, dur: 0.09, cutoff: 600, gain: 0.11 });
          this.synth.bass(46, 0.07, 0.14, 0.8, 1.8);
          break;
        case 'impact':
          // Hull hit: the deep rumble (owner: "the low-frequency rumble when the planet is hit"). 40 Hz sub sine
          // sliding to 28 Hz over 0.7 s, noise bed lowpassed at 120 Hz on the same tail, gain 0.55: the loudest
          // voice here (breakups peak near 0.45, shots 0.13). No mid or high content at all.
          this.synth.rumble(40, 0.7, 0.55, 120);
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
        case 'seeker':
          // Soft bass whoosh: a low triangle sliding down under a closing filter, with the sub beneath.
          this.synth.sweep({ wave: 'triangle', freq: 150, freqEnd: 48, cutoff: 900, cutoffEnd: 120, q: 2, dur: 0.35, gain: 0.2 });
          this.synth.bass(48, 0.2, 0.18, 0.9, 1.8);
          break;
        case 'blast':
          // Area blast: a thud with a longer crunch than a breakup.
          this.synth.thud(60, 0.4, 0.4);
          this.synth.crunch({ rate: 3000, bits: 3, dur: 0.22, cutoff: 1200, gain: 0.18, pitch: 0.8 });
          break;
        case 'swarm': {
          // A cluster of tiny blips, one per drone, scattered over a fifth of a second and rising.
          for (let i = 0; i < e.count; i++) {
            this.synth.tick({ wave: 'triangle', freq: 1800 + i * 160 + Math.random() * 120, dur: 0.012, gain: 0.035, delay: i * 0.028 + Math.random() * 0.01 });
          }
          this.synth.bass(58, 0.06, 0.1, 0.6, 1.5);
          break;
        }
        case 'burnout':
          if (now - this.lastTick > 0.03) {
            this.lastTick = now;
            this.synth.tick({ wave: 'sine', freq: 700, dur: 0.03, gain: 0.03 });
          }
          break;
        case 'levelup':
          // New level (owner: subtle and gentle, a low bass pulse, no square tone): two soft 55 Hz sine pulses a
          // beat (0.36 s) apart, 40 ms attack, 0.3 s tail, gain 0.14 (the hull thud is 0.42); the second a touch
          // lower and quieter so it reads as an echo.
          this.synth.softPulse(55, 0.3, 0.14, 0.04);
          this.synth.softPulse(52, 0.34, 0.11, 0.05, 0.36);
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
