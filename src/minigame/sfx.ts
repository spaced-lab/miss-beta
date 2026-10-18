// WHAT: Sounds for PERIMETER: sim events in, synth calls out, with a table of named variants per event.
// WHY:  The sim never touches audio (it stays pure and testable); it emits events and this module decides
//       what they sound like. Nobody tuning this repo can hear it from a test, so every game event carries
//       three or four synthesized voices plus OFF and the player picks by ear in the SOUND LAB (key L on the
//       ready panel, src/minigame/soundLab.ts). The chosen names are persisted under one localStorage key
//       (`SfxPrefs`, validated by `isSfxPrefs`); the SimEvent -> sound mapping reads the choice.
// HOW:  `SfxPlayer.play(events)` is called once per frame with the events the step produced. Shots and hits
//       are rate-limited so eight launchers at full fire stay delicate. Each `Variant` is a stateless function
//       of the synth and a `Cue` (strength, tier, size, count, beams, chaos) and documents a "clickiness" proxy:
//       `hz`, the rough spectral centre of its loudest component (a sine's pitch; a saw's or square's about
//       three times the fundamental under its filter; a noise voice's lowpass cutoff), and `attackMs`, its
//       onset. `clickiness` = hz / (1 + attackMs): lower is softer, and the FIRST entry of every table is the
//       default. For the events the owner called "bleepy" (SHOT, HIT, SENTRY) the default is the least clicky
//       variant by that proxy; for the others it is the v3.2 voice, so nothing the owner already liked moves.
//       The mix leans bassy on purpose (owner's notes, 2026-10-17): the hull hit is a deep rumble (synth.rumble:
//       40 Hz sub with a slow pitch drop over a 120 Hz lowpassed noise bed, the loudest voice), breakups are a
//       low thud with a tail, and the ambient bass static gains an 80-120 Hz activity voice above chaos 0.5.
//       The master compressor in synth.ts keeps forty stacked voices from clipping. None of this is audible in
//       tests; the tuning numbers are commented inline and the tests check the tables, the guard and the proxy.
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
  // tickFreq is the soft high component of a BLIP shot; the sub pop under it carries the weight (owner: less clicky,
  // more bassy). Lowered a fifth or so in the second pass (1200 -> 950, 900 -> 720, 1400 -> 1100).
  { name: 'DELICATE', tickWave: 'triangle', tickFreq: 950, crunchRate: 7000, crunchBits: 4, laserWave: 'sawtooth' },
  { name: 'SQUARE', tickWave: 'square', tickFreq: 720, crunchRate: 5000, crunchBits: 3, laserWave: 'square' },
  { name: 'GLASS', tickWave: 'sine', tickFreq: 1100, crunchRate: 9000, crunchBits: 5, laserWave: 'sawtooth' },
];

/** The game events with a variant table. The order is the SOUND LAB's row order and its review order. */
export const SOUND_EVENTS = ['SHOT', 'HIT', 'BREAK', 'IMPACT', 'LASER', 'MESH', 'PULSE', 'SEEKER', 'SWARM', 'SENTRY', 'MOONHIT', 'LEVELUP', 'AMBIENT'] as const;
export type SoundEvent = (typeof SOUND_EVENTS)[number];

/** What a variant may shape its voice by. Every field has a neutral default (`AUDITION_CUE`) for the lab. */
export interface Cue {
  /** Shot stream strength (1..). */
  strength: number;
  /** Rock hardness tier (0..5). */
  tier: number;
  /** Rock radius, planet radii (0.1..1). */
  r: number;
  /** Drones in a swarm release. */
  count: number;
  /** Beams in a MESH pull. */
  beams: number;
  /** Ambient: chaos level 0..1; `lift` > 0 marks a pop of the higher activity layer (0..1). */
  chaos: number;
  lift: number;
  /** Ambient layer gain multiplier (the lab's AMBIENT LEVEL row), 0..1. */
  level: number;
  /** True every ~120 ms: variants may add a sparkle grain on these hits only, so a volley does not hiss. */
  sparkle: boolean;
  kit: Kit;
}

export const AUDITION_CUE: Readonly<Cue> = { strength: 1, tier: 1, r: 0.4, count: 7, beams: 24, chaos: 0.6, lift: 0, level: 1, sparkle: true, kit: KITS[0] as Kit };

export interface Variant {
  /** Short label, 4 to 8 capitals: what the lab prints. */
  name: string;
  /** One line for the lab's description column. */
  about: string;
  /** Clickiness proxy: rough spectral centre of the loudest component, Hz (0 for silence). */
  hz: number;
  /** Clickiness proxy: onset of that component, ms. */
  attackMs: number;
  /** Nominal length, s; the review mode waits this plus a gap before the next event. */
  dur: number;
  play(synth: Synth, c: Cue): void;
}

/**
 * Clickiness proxy: hz / (1 + attackMs). A 60 Hz sine with a 4 ms attack scores 12; a 950 Hz blip with a 6 ms attack
 * 136; a 1000 Hz sawtooth warble with no attack 1000. Lower is softer. Example: clickiness({hz: 60, attackMs: 4}) = 12.
 */
export const clickiness = (v: Pick<Variant, 'hz' | 'attackMs'>): number => v.hz / (1 + v.attackMs);

/** The shared silent variant: the last choice of every table (index = table length). */
export const OFF: Variant = { name: 'OFF', about: 'SILENT', hz: 0, attackMs: 0, dur: 0, play() {} };

/** The default choice is the first entry of every table (see the HOW header). */
export const DEFAULT_INDEX = 0;

const rnd = (a: number, b: number): number => a + Math.random() * (b - a); // NOTE: sound never feeds back into the sim.

export const VARIANTS: Readonly<Record<SoundEvent, readonly Variant[]>> = {
  SHOT: [
    {
      name: 'THUMP', about: 'A SUB POP AND NOTHING ABOVE IT', hz: 60, attackMs: 4, dur: 0.08,
      // Tune here: 60-66 Hz by strength, 4 ms attack so a sine starting mid-cycle has no click edge.
      play: (s, c) => s.bass(60 + 6 * c.strength, 0.04, 0.15, 0.7, 1.6, 0.004),
    },
    {
      name: 'BLIP', about: 'V3.2: SOFT HIGH BLIP OVER THE SUB POP (KIT SETS THE BLIP)', hz: 950, attackMs: 6, dur: 0.06,
      play: (s, c) => {
        s.tick({ wave: c.kit.tickWave, freq: c.kit.tickFreq * (1 + 0.1 * (c.strength - 1)), dur: 0.012, gain: 0.017, attack: 0.006 });
        s.bass(55 + 7 * c.strength, 0.035, 0.13, 0.7, 1.6);
      },
    },
    {
      name: 'KNOCK', about: 'A LOW WOODEN SINE KNOCK OVER THE SUB', hz: 240, attackMs: 3, dur: 0.06,
      play: (s, c) => {
        s.tick({ wave: 'sine', freq: 240 + 10 * c.strength, dur: 0.025, gain: 0.03, attack: 0.003 });
        s.bass(58, 0.03, 0.1, 0.6, 1.5);
      },
    },
    {
      name: 'PUFF', about: 'A LOWPASSED NOISE PUFF, LIKE AIR, OVER THE SUB', hz: 450, attackMs: 5, dur: 0.06,
      play: (s) => {
        s.crunch({ rate: 4000, bits: 4, dur: 0.03, cutoff: 450, gain: 0.045, attack: 0.005 });
        s.bass(56, 0.03, 0.09, 0.5, 1.5);
      },
    },
  ],
  HIT: [
    {
      name: 'SUB POP', about: 'BASS POP ONLY, LOWER FOR HARDER ROCKS, NO GRAIN', hz: 70, attackMs: 3, dur: 0.1,
      play: (s, c) => s.bass(72 - c.tier * 3, 0.05, 0.17, 0.85, 1.7, 0.003),
    },
    {
      name: 'BASS POP', about: 'V3.2: BASS POP WITH A FAINT LOW CRUNCH AND A DUST GRAIN', hz: 380, attackMs: 0, dur: 0.1,
      play: (s, c) => {
        s.bass(72 - c.tier * 3, 0.05, 0.17, 0.85, 1.7);
        s.crunch({ rate: 2500, bits: 3, dur: 0.03, cutoff: 380, gain: 0.03 });
        if (c.sparkle) s.grains({ count: 1, spread: 0.01, grainDur: 0.005, cutoff: 1600 + c.tier * 200, gain: 0.006 });
      },
    },
    {
      name: 'KNOCK', about: 'A SHORT LOW SINE KNOCK, DEEPER FOR HARDER ROCKS', hz: 180, attackMs: 2, dur: 0.08,
      play: (s, c) => {
        s.tick({ wave: 'sine', freq: 180 - 8 * c.tier, dur: 0.04, gain: 0.05, attack: 0.002 });
        s.bass(60, 0.04, 0.1, 0.7, 1.6);
      },
    },
    {
      name: 'DUST', about: 'A FEW BRIGHT GRAINS OVER A LIGHT SUB: GRITTY', hz: 1400, attackMs: 0, dur: 0.06,
      play: (s, c) => {
        s.grains({ count: 3, spread: 0.02, grainDur: 0.006, cutoff: 1400 + 200 * c.tier, gain: 0.012 });
        s.bass(64, 0.03, 0.08, 0.5, 1.5);
      },
    },
  ],
  BREAK: [
    {
      name: 'THUD', about: 'V3.2: LOW THUD WITH A TAIL BY SIZE, KIT CRUNCH, TWO GRAINS', hz: 900, attackMs: 0, dur: 0.7,
      // Sine 60 Hz dropping 3 Hz per tier (45 Hz floor), tail 0.26 s + 0.5 s per radius + 0.03 s per tier; its own crunch at
      // 480 Hz; under it the kit crunch lowpassed at 900 Hz and pitched down with size.
      play: (s, c) => {
        const freq = Math.max(45, 60 - c.tier * 3);
        s.thud(freq, 0.26 + c.r * 0.5 + c.tier * 0.03, 0.26 + c.r * 0.35 + c.tier * 0.03, 480, 0.1 + c.r * 0.25);
        s.crunch({ rate: c.kit.crunchRate, bits: c.kit.crunchBits, dur: 0.1 + c.r * 0.3, cutoff: 900, gain: 0.14 + c.tier * 0.03, pitch: 1.0 - c.r });
        s.grains({ count: 2, spread: 0.08, grainDur: 0.008, cutoff: 1800, gain: 0.02 });
      },
    },
    {
      name: 'DEEP', about: 'THE THUD ALONE, LOWER AND LONGER, NO CRUNCH, NO GRAINS', hz: 300, attackMs: 0, dur: 0.8,
      play: (s, c) => {
        const freq = Math.max(40, 52 - c.tier * 3);
        s.thud(freq, 0.36 + c.r * 0.5 + c.tier * 0.03, 0.26 + c.r * 0.35 + c.tier * 0.03, 300, 0.12 + c.r * 0.25);
      },
    },
    {
      name: 'CRUNCH', about: 'THE 8-BIT CRUNCH UP FRONT (V2 STYLE) OVER A BASS POP', hz: 1500, attackMs: 0, dur: 0.5,
      play: (s, c) => {
        s.crunch({ rate: c.kit.crunchRate, bits: c.kit.crunchBits, dur: 0.12 + c.r * 0.3, cutoff: 1500, gain: 0.2 + c.tier * 0.03, pitch: 1.0 - c.r });
        s.bass(55 - 2 * c.tier, 0.08, 0.2, 0.8, 1.8);
      },
    },
    {
      name: 'SHATTER', about: 'A SPRAY OF BRIGHT GRAINS OVER A SMALLER THUD', hz: 2400, attackMs: 0, dur: 0.5,
      play: (s, c) => {
        s.grains({ count: 6, spread: 0.12, grainDur: 0.01, cutoff: 2400, gain: 0.03 });
        s.thud(Math.max(45, 60 - c.tier * 3), 0.2 + c.r * 0.3, 0.2 + c.r * 0.25, 600, 0.08);
      },
    },
  ],
  IMPACT: [
    {
      name: 'RUMBLE', about: 'V3.2: 40 HZ SUB SLIDING TO 28 OVER A 120 HZ NOISE BED', hz: 40, attackMs: 15, dur: 0.8,
      play: (s) => s.rumble(40, 0.7, 0.55, 120),
    },
    {
      name: 'QUAKE', about: 'LOWER AND LONGER: 34 HZ OVER 1.1 S, NOISE BED AT 90 HZ', hz: 34, attackMs: 15, dur: 1.2,
      play: (s) => s.rumble(34, 1.1, 0.5, 90),
    },
    {
      name: 'THUD', about: 'V3.1: A 70 HZ HULL THUD WITH A 700 HZ CRUNCH', hz: 700, attackMs: 0, dur: 0.4,
      play: (s) => s.thud(70, 0.3, 0.42, 700, 0.12),
    },
    {
      name: 'CRACK', about: 'SHORT AND BRIGHT: A 1.4 KHZ CRUNCH OVER A BASS POP', hz: 1400, attackMs: 0, dur: 0.25,
      play: (s) => {
        s.crunch({ rate: 3000, bits: 3, dur: 0.14, cutoff: 1400, gain: 0.22 });
        s.bass(45, 0.08, 0.2, 0.9, 2);
      },
    },
  ],
  LASER: [
    {
      name: 'ZAP', about: 'V3.2: TRIANGLE SWEEP 640 TO 110 HZ UNDER A CLOSING FILTER', hz: 900, attackMs: 8, dur: 0.2,
      play: (s) => {
        s.sweep({ wave: 'triangle', freq: 640, freqEnd: 110, cutoff: 1800, cutoffEnd: 220, q: 3, dur: 0.16, gain: 0.13 });
        s.bass(55, 0.08, 0.12);
      },
    },
    {
      name: 'BEAM', about: 'A SINE SWEEP 320 TO 90 HZ: ROUNDER, NO EDGE', hz: 320, attackMs: 8, dur: 0.25,
      play: (s) => {
        s.sweep({ wave: 'sine', freq: 320, freqEnd: 90, cutoff: 1000, cutoffEnd: 150, q: 2, dur: 0.2, gain: 0.14 });
        s.bass(55, 0.08, 0.12);
      },
    },
    {
      name: 'PEW', about: 'THE ARCADE SAWTOOTH ZAP, 900 TO 150 HZ, BRIGHT', hz: 1800, attackMs: 8, dur: 0.15,
      play: (s) => s.sweep({ wave: 'sawtooth', freq: 900, freqEnd: 150, cutoff: 2600, cutoffEnd: 300, q: 5, dur: 0.12, gain: 0.12 }),
    },
    {
      name: 'THROB', about: 'NO SWEEP: A 110 HZ SINE THROB OVER THE SUB', hz: 110, attackMs: 10, dur: 0.2,
      play: (s) => {
        s.softPulse(110, 0.14, 0.14, 0.01);
        s.bass(55, 0.08, 0.12, 0.7, 1.6, 0.005);
      },
    },
  ],
  MESH: [
    {
      name: 'CLUSTER', about: 'V3.2: 3 TO 5 LAYERED ZAPS 18 MS APART, EACH A LITTLE HIGHER', hz: 1000, attackMs: 8, dur: 0.25,
      play: (s, c) => {
        const n = Math.max(3, Math.min(5, Math.ceil(c.beams / 8)));
        for (let i = 0; i < n; i++) s.sweep({ wave: 'triangle', freq: 560 + i * 110, freqEnd: 95, cutoff: 1900, cutoffEnd: 190, q: 3, dur: 0.11, gain: 0.075, delay: i * 0.018 });
        s.bass(50, 0.1, 0.17, 0.9, 2);
      },
    },
    {
      name: 'CHORD', about: 'THREE SOFT SINE PULSES, 55 82 110 HZ, 30 MS APART', hz: 110, attackMs: 20, dur: 0.35,
      play: (s) => {
        s.softPulse(55, 0.18, 0.1, 0.02, 0);
        s.softPulse(82, 0.18, 0.1, 0.02, 0.03);
        s.softPulse(110, 0.18, 0.1, 0.02, 0.06);
        s.bass(50, 0.1, 0.15, 0.9, 2, 0.005);
      },
    },
    {
      name: 'RAKE', about: 'A RAKE OF BRIGHT SAWTOOTH ZAPS, 12 MS APART', hz: 1800, attackMs: 8, dur: 0.2,
      play: (s, c) => {
        const n = Math.max(3, Math.min(5, Math.ceil(c.beams / 8)));
        for (let i = 0; i < n; i++) s.sweep({ wave: 'sawtooth', freq: 800 + i * 120, freqEnd: 140, cutoff: 2600, cutoffEnd: 300, q: 4, dur: 0.08, gain: 0.06, delay: i * 0.012 });
      },
    },
    {
      name: 'SURGE', about: 'ONE LONGER TRIANGLE SWEEP 300 TO 70 HZ OVER A FULL SUB', hz: 500, attackMs: 8, dur: 0.3,
      play: (s) => {
        s.sweep({ wave: 'triangle', freq: 300, freqEnd: 70, cutoff: 1200, cutoffEnd: 150, q: 4, dur: 0.25, gain: 0.16 });
        s.bass(50, 0.1, 0.17, 0.9, 2);
      },
    },
  ],
  PULSE: [
    {
      name: 'RISER', about: 'V3.2: SAWTOOTH RISING 55 TO 440 HZ, FILTER OPENING TO 6 KHZ', hz: 2000, attackMs: 8, dur: 0.7,
      play: (s) => s.sweep({ wave: 'sawtooth', freq: 55, freqEnd: 440, cutoff: 300, cutoffEnd: 6000, q: 10, dur: 0.6, gain: 0.25 }),
    },
    {
      name: 'SURGE', about: 'TRIANGLE RISING 50 TO 220 HZ UNDER A LOWER FILTER: DARKER', hz: 700, attackMs: 8, dur: 0.6,
      play: (s) => s.sweep({ wave: 'triangle', freq: 50, freqEnd: 220, cutoff: 200, cutoffEnd: 1800, q: 6, dur: 0.5, gain: 0.22 }),
    },
    {
      name: 'BOOM', about: 'NO SWEEP: A SHORT RUMBLE WITH A SOFT 55 HZ PULSE', hz: 45, attackMs: 15, dur: 0.6,
      play: (s) => {
        s.rumble(45, 0.5, 0.4, 160);
        s.softPulse(55, 0.4, 0.12, 0.03);
      },
    },
    {
      name: 'SIREN', about: 'SQUARE RISING 110 TO 330 HZ: THE ARCADE ALARM', hz: 1200, attackMs: 8, dur: 0.5,
      play: (s) => s.sweep({ wave: 'square', freq: 110, freqEnd: 330, cutoff: 2500, cutoffEnd: 2500, q: 4, dur: 0.45, gain: 0.16 }),
    },
  ],
  SEEKER: [
    {
      name: 'WHOOSH', about: 'V3.2: LOW TRIANGLE SLIDING 150 TO 48 HZ UNDER A CLOSING FILTER', hz: 400, attackMs: 8, dur: 0.45,
      play: (s) => {
        s.sweep({ wave: 'triangle', freq: 150, freqEnd: 48, cutoff: 900, cutoffEnd: 120, q: 2, dur: 0.35, gain: 0.2 });
        s.bass(48, 0.2, 0.18, 0.9, 1.8);
      },
    },
    {
      name: 'DIVE', about: 'SAWTOOTH DIVING 220 TO 40 HZ: MORE GROWL', hz: 800, attackMs: 8, dur: 0.55,
      play: (s) => {
        s.sweep({ wave: 'sawtooth', freq: 220, freqEnd: 40, cutoff: 1200, cutoffEnd: 90, q: 4, dur: 0.45, gain: 0.2 });
        s.bass(48, 0.2, 0.18, 0.9, 1.8);
      },
    },
    {
      name: 'HUM', about: 'A 90 HZ SINE HUM WITH A SLOW 60 MS ATTACK OVER THE SUB', hz: 90, attackMs: 60, dur: 0.45,
      play: (s) => {
        s.softPulse(90, 0.3, 0.16, 0.06);
        s.bass(48, 0.15, 0.14, 0.9, 1.8, 0.01);
      },
    },
    {
      name: 'PING', about: 'A 660 HZ SINE PING OVER THE SUB: THE BLEEPY ONE', hz: 660, attackMs: 10, dur: 0.2,
      play: (s) => {
        s.tick({ wave: 'sine', freq: 660, dur: 0.06, gain: 0.06, attack: 0.01 });
        s.bass(48, 0.1, 0.14);
      },
    },
  ],
  SWARM: [
    {
      name: 'CHIRPS', about: 'V3.2: ONE RISING HIGH CHIRP PER DRONE OVER A FIFTH OF A SECOND', hz: 2200, attackMs: 0, dur: 0.45,
      play: (s, c) => {
        for (let i = 0; i < c.count; i++) s.tick({ wave: 'triangle', freq: 1800 + i * 160 + rnd(0, 120), dur: 0.012, gain: 0.035, delay: i * 0.028 + rnd(0, 0.01) });
        s.bass(58, 0.06, 0.1, 0.6, 1.5);
      },
    },
    {
      name: 'PATTER', about: 'ONE SOFT LOW SINE TAP PER DRONE, 300 HZ AND UP A LITTLE EACH', hz: 320, attackMs: 4, dur: 0.45,
      play: (s, c) => {
        for (let i = 0; i < c.count; i++) s.tick({ wave: 'sine', freq: 300 + i * 12, dur: 0.02, gain: 0.03, attack: 0.004, delay: i * 0.03 });
        s.bass(58, 0.06, 0.1, 0.6, 1.5);
      },
    },
    {
      name: 'HIVE', about: 'A 160 HZ TRIANGLE BUZZ STEPPING RANDOMLY FOR 0.3 S', hz: 200, attackMs: 20, dur: 0.35,
      play: (s) => {
        s.lfoTone({ base: 160, spread: 0.4, stepDur: 0.03, dur: 0.3, wave: 'triangle', gain: 0.08, attack: 0.02 });
        s.bass(58, 0.06, 0.1, 0.6, 1.5);
      },
    },
    {
      name: 'BURST', about: 'ONE BASS POP AND A 900 HZ NOISE PUFF: A SINGLE RELEASE', hz: 900, attackMs: 5, dur: 0.2,
      play: (s) => {
        s.bass(70, 0.08, 0.2, 0.8, 1.8);
        s.crunch({ rate: 5000, bits: 4, dur: 0.1, cutoff: 900, gain: 0.1, attack: 0.005 });
      },
    },
  ],
  SENTRY: [
    {
      name: 'THRUM', about: 'A LOW 110 HZ TRIANGLE STEPPING SLOWLY, 20 MS ATTACK, OVER THE SUB', hz: 140, attackMs: 20, dur: 0.4,
      play: (s) => {
        s.lfoTone({ base: 110, spread: 0.25, stepDur: 0.08, dur: 0.35, wave: 'triangle', gain: 0.09, attack: 0.02 });
        s.bass(55, 0.08, 0.12, 0.7, 1.6, 0.005);
      },
    },
    {
      name: 'WARBLE', about: 'V3.2: SH-101 SAWTOOTH AT 330 HZ STEPPING EVERY 50 MS', hz: 1000, attackMs: 0, dur: 0.55,
      play: (s) => s.lfoTone({ base: 330, spread: 0.6, stepDur: 0.05, dur: 0.5, wave: 'sawtooth', gain: 0.1 }),
    },
    {
      name: 'CLUNK', about: 'A MECHANICAL CLUNK: 90 HZ POP WITH A 600 HZ CRUNCH', hz: 600, attackMs: 4, dur: 0.15,
      play: (s) => {
        s.bass(90, 0.08, 0.2, 0.8, 1.6, 0.003);
        s.crunch({ rate: 3000, bits: 3, dur: 0.08, cutoff: 600, gain: 0.1, attack: 0.004 });
      },
    },
    {
      name: 'TONE', about: 'ONE PLAIN 440 HZ SINE TONE, 20 MS ATTACK', hz: 440, attackMs: 20, dur: 0.2,
      play: (s) => s.tick({ wave: 'sine', freq: 440, dur: 0.15, gain: 0.07, attack: 0.02 }),
    },
  ],
  MOONHIT: [
    {
      name: 'CRUNCH', about: 'V3.2: A 700 HZ CRUNCH OVER A 44 HZ POP', hz: 700, attackMs: 0, dur: 0.2,
      play: (s) => {
        s.crunch({ rate: 3000, bits: 3, dur: 0.12, cutoff: 700, gain: 0.14 });
        s.bass(44, 0.1, 0.14);
      },
    },
    {
      name: 'KNOCK', about: 'A DEEPER 80 HZ THUD WITH A 400 HZ CRUNCH', hz: 400, attackMs: 0, dur: 0.3,
      play: (s) => s.thud(80, 0.2, 0.3, 400, 0.08),
    },
    {
      name: 'DUST', about: 'FOUR BRIGHT GRAINS OVER THE POP: REGOLITH', hz: 2000, attackMs: 0, dur: 0.15,
      play: (s) => {
        s.grains({ count: 4, spread: 0.06, grainDur: 0.01, cutoff: 2000, gain: 0.03 });
        s.bass(44, 0.08, 0.12);
      },
    },
    {
      name: 'BELL', about: 'A 520 HZ SINE TAP OVER THE POP', hz: 520, attackMs: 10, dur: 0.2,
      play: (s) => {
        s.tick({ wave: 'sine', freq: 520, dur: 0.1, gain: 0.06, attack: 0.01 });
        s.bass(44, 0.1, 0.14);
      },
    },
  ],
  LEVELUP: [
    {
      name: 'PULSES', about: 'V3.2: TWO GENTLE 55 HZ SINE PULSES A BEAT APART, THE SECOND LOWER', hz: 55, attackMs: 40, dur: 0.8,
      play: (s) => {
        s.softPulse(55, 0.3, 0.14, 0.04);
        s.softPulse(52, 0.34, 0.11, 0.05, 0.36);
      },
    },
    {
      name: 'RISE', about: 'THE SAME TWO PULSES, THE SECOND A FIFTH UP (82 HZ)', hz: 82, attackMs: 40, dur: 0.8,
      play: (s) => {
        s.softPulse(55, 0.3, 0.14, 0.04);
        s.softPulse(82, 0.34, 0.11, 0.05, 0.36);
      },
    },
    {
      name: 'CHIME', about: 'TWO SINE NOTES, 660 THEN 990 HZ: A SMALL CHIME', hz: 990, attackMs: 15, dur: 0.4,
      play: (s) => {
        s.tick({ wave: 'sine', freq: 660, dur: 0.12, gain: 0.07, attack: 0.015 });
        s.tick({ wave: 'sine', freq: 990, dur: 0.16, gain: 0.06, attack: 0.015, delay: 0.18 });
      },
    },
    {
      name: 'DRONE', about: 'THE OLD SH-101 TONE, LOWER: 110 HZ TRIANGLE STEPPING FOR 0.7 S', hz: 140, attackMs: 30, dur: 0.75,
      play: (s) => s.lfoTone({ base: 110, spread: 0.3, stepDur: 0.09, dur: 0.7, wave: 'triangle', gain: 0.08, attack: 0.03 }),
    },
  ],
  AMBIENT: [
    {
      name: 'STATIC', about: 'V3.2: LOW NOISE POPS 36-54 HZ; 80-120 HZ SINE POPS JOIN ABOVE CHAOS 0.5', hz: 220, attackMs: 0, dur: 0.1,
      play: (s, c) => {
        if (c.lift > 0) s.bass(rnd(80, 120), 0.045, (0.04 + 0.07 * c.lift) * c.level, 0, 1);
        else s.bassStatic((0.05 + 0.14 * c.chaos) * c.level, 0.05 + 0.07 * c.chaos);
      },
    },
    {
      name: 'DRONE', about: 'SLOW SINE SWELLS 36-46 HZ, 80 MS ATTACK; HIGHER SWELLS FOR ACTIVITY', hz: 45, attackMs: 80, dur: 0.35,
      play: (s, c) => {
        if (c.lift > 0) s.softPulse(rnd(72, 96), 0.12, (0.03 + 0.06 * c.lift) * c.level, 0.03);
        else s.softPulse(rnd(36, 46), 0.25, (0.05 + 0.1 * c.chaos) * c.level, 0.08);
      },
    },
    {
      name: 'TICKS', about: 'SINGLE 900 HZ DUST GRAINS OVER A FAINT SUB: A GEIGER COUNTER', hz: 900, attackMs: 0, dur: 0.05,
      play: (s, c) => {
        if (c.lift > 0) {
          s.tick({ wave: 'sine', freq: rnd(300, 400), dur: 0.02, gain: 0.02 * c.level, attack: 0.003 });
        } else {
          s.grains({ count: 1, spread: 0.01, grainDur: 0.008, cutoff: 900, gain: (0.01 + 0.02 * c.chaos) * c.level });
          s.bass(40, 0.04, 0.05 * c.level, 0, 1);
        }
      },
    },
    {
      name: 'HEARTBEAT', about: 'PAIRED 48/44 HZ SUB BEATS 160 MS APART; A LIGHT 70 HZ TAP FOR ACTIVITY', hz: 48, attackMs: 4, dur: 0.3,
      play: (s, c) => {
        if (c.lift > 0) {
          s.bass(70, 0.05, 0.05 * c.level, 0, 1, 0.003);
        } else {
          const g = (0.06 + 0.1 * c.chaos) * c.level;
          s.bass(48, 0.09, g, 0.9, 2, 0.004);
          s.bass(44, 0.09, g * 0.7, 0.9, 2, 0.004, 0.16);
        }
      },
    },
  ],
};

/** The variant table of `ev` with OFF appended: what the lab cycles through. */
export const choicesFor = (ev: SoundEvent): readonly Variant[] => [...(VARIANTS[ev] ?? []), OFF];

/** Index of the variant named `name` in `ev`'s table (OFF is the last index), or -1. */
export function variantIndex(ev: SoundEvent, name: string): number {
  return choicesFor(ev).findIndex((v) => v.name === name);
}

/** What the lab persists: variant names per event (missing = default), master volume and ambient level, both 0..1. */
export interface SfxPrefs {
  choices: Partial<Record<SoundEvent, string>>;
  volume: number;
  ambient: number;
}

const unit = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;

/** Type guard for what comes back from localStorage: every key must be an event and every name one of its variants. */
export function isSfxPrefs(v: unknown): v is SfxPrefs {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  if (!unit(o.volume) || !unit(o.ambient)) return false;
  const ch = o.choices;
  if (typeof ch !== 'object' || ch === null || Array.isArray(ch)) return false;
  for (const [k, name] of Object.entries(ch as Record<string, unknown>)) {
    if (!(SOUND_EVENTS as readonly string[]).includes(k)) return false;
    if (typeof name !== 'string' || variantIndex(k as SoundEvent, name) < 0) return false;
  }
  return true;
}

/** Master volume 1.0 maps to this master gain; the default volume (0.5) gives the v3.2 level of 0.3. */
const MASTER_SCALE = 0.6;
export const DEFAULT_VOLUME = 0.5;
export const DEFAULT_AMBIENT = 1;

/** Which SimEvents carry a variant table, and how their payload becomes a Cue. */
function cueFor(e: SimEvent, kit: Kit, sparkle: boolean): { ev: SoundEvent; cue: Cue } | null {
  const base: Cue = { ...AUDITION_CUE, kit, sparkle };
  switch (e.type) {
    case 'shot': return { ev: 'SHOT', cue: { ...base, strength: e.strength } };
    case 'hit': return { ev: 'HIT', cue: { ...base, tier: e.tier } };
    case 'break': return { ev: 'BREAK', cue: { ...base, tier: e.tier, r: e.r } };
    case 'impact': return { ev: 'IMPACT', cue: base };
    case 'laser': return { ev: 'LASER', cue: base };
    case 'mesh': return { ev: 'MESH', cue: { ...base, beams: e.beams } };
    case 'pulse': return { ev: 'PULSE', cue: base };
    case 'seeker': return { ev: 'SEEKER', cue: base };
    case 'swarm': return { ev: 'SWARM', cue: { ...base, count: e.count } };
    case 'turret': return { ev: 'SENTRY', cue: base };
    case 'moonhit': return { ev: 'MOONHIT', cue: base };
    case 'levelup': return { ev: 'LEVELUP', cue: base };
    default: return null;
  }
}

export class SfxPlayer {
  readonly synth = new Synth();
  enabled = true;
  kitIndex = 0;
  /** Index into choicesFor(ev) per event; the OFF index is the table length. */
  readonly choice: Record<SoundEvent, number> = Object.fromEntries(SOUND_EVENTS.map((e) => [e, DEFAULT_INDEX])) as Record<SoundEvent, number>;
  private vol = DEFAULT_VOLUME;
  /** Gain multiplier of the ambient layer, 0..1 (the lab's AMBIENT LEVEL row). */
  ambientLevel = DEFAULT_AMBIENT;
  private lastTick = 0;
  private lastBass = 0;
  private lastGrain = 0;
  private staticAcc = 0;
  private activityAcc = 0;

  constructor() {
    this.synth.volume = this.vol * MASTER_SCALE;
  }

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

  get volume(): number {
    return this.vol;
  }

  /** Master volume 0..1 (0.5 is the v3.2 level). */
  setVolume(v: number): void {
    this.vol = Math.min(1, Math.max(0, v));
    this.synth.setVolume(this.vol * MASTER_SCALE);
  }

  /** The chosen variant of `ev` (OFF when the index is past the table). */
  variantOf(ev: SoundEvent): Variant {
    return choicesFor(ev)[this.choice[ev]] ?? OFF;
  }

  setChoice(ev: SoundEvent, index: number): void {
    const n = choicesFor(ev).length;
    this.choice[ev] = ((Math.round(index) % n) + n) % n;
  }

  /** Step the choice of `ev` by `dir` (+1 / -1), wrapping through OFF. */
  cycleChoice(ev: SoundEvent, dir: number): void {
    this.setChoice(ev, this.choice[ev] + dir);
  }

  resetChoices(): void {
    for (const ev of SOUND_EVENTS) this.choice[ev] = DEFAULT_INDEX;
    this.setVolume(DEFAULT_VOLUME);
    this.ambientLevel = DEFAULT_AMBIENT;
  }

  prefs(): SfxPrefs {
    const choices: Partial<Record<SoundEvent, string>> = {};
    for (const ev of SOUND_EVENTS) choices[ev] = this.variantOf(ev).name;
    return { choices, volume: this.vol, ambient: this.ambientLevel };
  }

  applyPrefs(p: SfxPrefs): void {
    for (const ev of SOUND_EVENTS) {
      const name = p.choices[ev];
      const i = name === undefined ? DEFAULT_INDEX : variantIndex(ev, name);
      this.choice[ev] = i < 0 ? DEFAULT_INDEX : i;
    }
    this.setVolume(p.volume);
    this.ambientLevel = Math.min(1, Math.max(0, p.ambient));
  }

  /** Play the chosen variant of `ev` once with a neutral cue (the lab). Ignores `enabled`: the lab is for listening. */
  audition(ev: SoundEvent, cue: Partial<Cue> = {}): void {
    if (!this.synth.ready) return;
    this.variantOf(ev).play(this.synth, { ...AUDITION_CUE, kit: this.kit, level: this.ambientLevel, ...cue });
  }

  /**
   * Ambient layer: discrete low pops whose rate follows the chaos level (0..1). Call every frame with the frame's
   * seconds so the rate is time-based, not frame-based. Above chaos 0.5 a second "activity" voice joins on its own
   * clock, 0 to 6 pops per second as chaos goes 0.5 to 1 (chaosLevel carries (level - 1) / 20). The chosen AMBIENT
   * variant decides what each pop sounds like (cue.lift > 0 marks an activity pop); AMBIENT LEVEL scales both.
   */
  ambient(chaos: number, dt: number): void {
    if (!this.enabled || !this.synth.ready || chaos < 0.2 || this.ambientLevel <= 0) return;
    const v = this.variantOf('AMBIENT');
    const cue: Cue = { ...AUDITION_CUE, kit: this.kit, chaos, lift: 0, level: this.ambientLevel };
    const rate = 1.5 + 9 * chaos; // pops per second
    this.staticAcc += rate * dt;
    if (this.staticAcc >= 1 && Math.random() < 0.7) {
      this.staticAcc = 0;
      v.play(this.synth, cue);
    }
    if (chaos <= 0.5) return;
    const lift = (chaos - 0.5) * 2; // 0..1 over the top half of the chaos range
    this.activityAcc += 6 * lift * dt;
    if (this.activityAcc >= 1 && Math.random() < 0.8) {
      this.activityAcc = 0;
      v.play(this.synth, { ...cue, lift });
    }
  }

  play(events: readonly SimEvent[], now: number): void {
    if (!this.enabled || !this.synth.ready) return;
    const k = this.kit;
    for (const e of events) {
      // Rate limits: shots every 45 ms, hits every 40 ms, a sparkle grain at most every 120 ms.
      if (e.type === 'shot') {
        if (now - this.lastTick <= 0.045) continue;
        this.lastTick = now;
      } else if (e.type === 'hit') {
        if (now - this.lastBass <= 0.04) continue;
        this.lastBass = now;
      }
      const sparkle = now - this.lastGrain > 0.12;
      const c = cueFor(e, k, sparkle);
      if (c) {
        if (e.type === 'hit' && sparkle) this.lastGrain = now;
        this.variantOf(c.ev).play(this.synth, c.cue);
        continue;
      }
      // Events without a variant table keep their one voice.
      switch (e.type) {
        case 'crash':
          this.synth.crunch({ rate: 3500, bits: 3, dur: 0.09, cutoff: 600, gain: 0.11 });
          this.synth.bass(46, 0.07, 0.14, 0.8, 1.8);
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
        case 'blast':
          // Area blast: a thud with a longer crunch than a breakup.
          this.synth.thud(60, 0.4, 0.4);
          this.synth.crunch({ rate: 3000, bits: 3, dur: 0.22, cutoff: 1200, gain: 0.18, pitch: 0.8 });
          break;
        case 'burnout':
          if (now - this.lastTick > 0.03) {
            this.lastTick = now;
            this.synth.tick({ wave: 'sine', freq: 700, dur: 0.03, gain: 0.03 });
          }
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
