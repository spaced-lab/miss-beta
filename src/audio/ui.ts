// WHAT: Main-game sounds (GAME_PLAN 13 / M8): menu ticks, commit, launch, impact, breakup, approach, round end.
// WHY:  Short synthesized cues from the same Synth as the arcade mode; nothing sampled, nothing loaded.
// HOW:  One method per cue with its numbers at the call site; `enabled` mirrors the SOUND option. The
//       synth needs a user gesture to start, so `unlock()` is called on the first key press. `voice` (voice.ts)
//       plays the canned robot lines through the same synth; it has its own OFF/FEMALE/MALE switch, so the
//       context unlocks when either the bleeps or the voice is on.
// LORE: G8 (the look)

import { Synth } from './synth';
import { Voice } from './voice';
import { AUDITION_CUE, VARIANTS, type Cue, type SoundEvent } from '../minigame/sfx';

/** OPTIONS > SOUND STYLE: ARCADE borrows PERIMETER's low lo-fi voices; CLASSIC is the original sine bleeps. */
export type SoundStyle = 'ARCADE' | 'CLASSIC';

export class UiSfx {
  readonly synth = new Synth();
  readonly voice = new Voice(this.synth);
  enabled = true;
  style: SoundStyle = 'ARCADE';
  private unlocked = false;

  /** Play PERIMETER's variant `i` (its default first) for `ev` with a cue tweak. True when ARCADE handled it. */
  private arcade(ev: SoundEvent, cue: Partial<Cue> = {}, i = 0): boolean {
    if (this.style !== 'ARCADE') return false;
    VARIANTS[ev][i]?.play(this.synth, { ...AUDITION_CUE, sparkle: false, ...cue });
    return true;
  }

  unlock(): void {
    if (this.unlocked || (!this.enabled && this.voice.mode === 'OFF')) return;
    this.unlocked = this.synth.ensure();
    this.synth.setVolume(0.5);
  }

  private get on(): boolean {
    return this.enabled && this.unlocked;
  }

  /** Menu cursor move: a tiny low blip. */
  move(): void {
    if (this.on && !this.arcade('SHOT', { strength: 0.6 })) this.synth.tick({ freq: 420, dur: 0.025, wave: 'sine', gain: 0.05, attack: 0.004 });
  }
  /** Menu select / commit: two blips rising. */
  select(): void {
    if (!this.on || this.arcade('HIT', { tier: 1, r: 0.3 })) return;
    this.synth.tick({ freq: 520, dur: 0.04, wave: 'sine', gain: 0.07, attack: 0.004 });
    this.synth.tick({ freq: 780, dur: 0.05, wave: 'sine', gain: 0.06, attack: 0.004, delay: 0.06 });
  }
  commit(): void {
    if (this.on && !this.arcade('LEVELUP')) this.synth.sweep({ freq: 220, freqEnd: 440, dur: 0.18, wave: 'triangle', gain: 0.08, cutoff: 1200, cutoffEnd: 2400 });
  }
  launch(): void {
    if (this.on && !this.arcade('SEEKER')) this.synth.sweep({ freq: 90, freqEnd: 260, dur: 0.35, wave: 'sawtooth', gain: 0.07, cutoff: 400, cutoffEnd: 1800, q: 4 });
  }
  impact(): void {
    if (this.on && !this.arcade('BREAK', { r: 0.3 })) this.synth.thud(80, 0.22, 0.3, 600, 0.1);
  }
  breakup(): void {
    if (this.on && !this.arcade('BREAK', { r: 0.8 }, 1)) this.synth.thud(55, 0.4, 0.4, 500, 0.18);
  }
  /** Close approach: a miss is a soft low pulse, a hit a long rumble. */
  approach(hit: boolean): void {
    if (!this.on || this.arcade(hit ? 'IMPACT' : 'LEVELUP', {}, hit ? 0 : 1)) return;
    if (hit) this.synth.rumble(38, 0.9, 0.5, 110);
    else this.synth.softPulse(60, 0.35, 0.16, 0.03);
  }
  note(): void {
    if (this.on && !this.arcade('SHOT', { strength: 0.4 })) this.synth.tick({ freq: 660, dur: 0.03, wave: 'sine', gain: 0.04, attack: 0.004 });
  }
}
