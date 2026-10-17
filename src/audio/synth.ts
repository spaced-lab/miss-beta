// WHAT: A tiny WebAudio synthesizer: every sound in the game is generated, no sample files.
// WHY:  GAME_PLAN 4: "WebAudio square/triangle bleeps". Keeping instruments generic (tick, crunch, 303
//       sweep, sample-and-hold LFO tone, noise grains, thud) lets the minigame and later the main game
//       build sound kits from the same six voices, and lets us try variants by changing numbers.
// HOW:  Lazily creates an AudioContext on the first `ensure()` (browsers require a user gesture). Each
//       instrument builds a short node graph, schedules envelopes with setTargetAtTime / linear ramps and
//       lets the nodes garbage-collect after `stop`. The master bus is a gain into a DynamicsCompressor
//       (threshold -16 dB, ratio 6, fast attack): forty bullets landing in one frame get squashed rather
//       than clipped, so the kit can lean bassy without a hard ceiling. `bass()` carries a second, lower
//       sub layer (30 to 45 Hz, longer tail) under the main pop; that is where "bassier" comes from.
//       Everything is guarded so the module is inert in node (tests) and when audio is unavailable.
// LORE: G8 (the look, and the sound)

export interface TickOpts {
  freq?: number;
  /** Seconds, very short. */
  dur?: number;
  wave?: OscillatorType;
  gain?: number;
  /** Seconds from now to start; lets a caller schedule a cluster of blips in one go. */
  delay?: number;
}

export interface SweepOpts {
  /** Oscillator pitch, Hz, with an optional slide. */
  freq?: number;
  freqEnd?: number;
  /** Filter cutoff sweep, Hz. */
  cutoff?: number;
  cutoffEnd?: number;
  q?: number;
  dur?: number;
  wave?: OscillatorType;
  gain?: number;
}

export interface LfoToneOpts {
  base?: number;
  spread?: number;
  /** Seconds between random pitch steps (sample and hold). */
  stepDur?: number;
  dur?: number;
  wave?: OscillatorType;
  gain?: number;
}

export interface CrunchOpts {
  /** Effective sample rate of the quantized noise, Hz: lower is crunchier. */
  rate?: number;
  bits?: number;
  dur?: number;
  /** Lowpass cutoff, Hz. */
  cutoff?: number;
  gain?: number;
  /** Playback rate multiplier; < 1 lowers and lengthens. */
  pitch?: number;
}

export interface GrainsOpts {
  count?: number;
  /** Seconds over which the grains are scattered. */
  spread?: number;
  grainDur?: number;
  cutoff?: number;
  gain?: number;
}

export class Synth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseCache = new Map<string, AudioBuffer>();
  volume = 0.3;

  /** True once an AudioContext exists and is running. */
  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** Create or resume the context. Call from a user-gesture handler. Safe to call repeatedly. */
  ensure(): boolean {
    if (typeof AudioContext === 'undefined') return false;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      // NOTE: the compressor is the loudness cap. Many short voices stack linearly; without it a busy frame
      // clips the sub layers first (they carry the most energy per voice).
      if (typeof this.ctx.createDynamicsCompressor === 'function') {
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -16;
        comp.knee.value = 10;
        comp.ratio.value = 6;
        comp.attack.value = 0.002;
        comp.release.value = 0.14;
        this.master.connect(comp).connect(this.ctx.destination);
      } else {
        this.master.connect(this.ctx.destination);
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return true;
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  private out(): { ctx: AudioContext; master: GainNode } | null {
    if (!this.ctx || !this.master || this.ctx.state !== 'running') return null;
    return { ctx: this.ctx, master: this.master };
  }

  /** A very short blip: the projectile tick. */
  tick(o: TickOpts = {}): void {
    const io = this.out();
    if (!io) return;
    const { ctx, master } = io;
    const t = ctx.currentTime + (o.delay ?? 0);
    const dur = o.dur ?? 0.018;
    const osc = ctx.createOscillator();
    osc.type = o.wave ?? 'square';
    osc.frequency.setValueAtTime(o.freq ?? 2200, t);
    osc.frequency.exponentialRampToValueAtTime((o.freq ?? 2200) * 0.6, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.gain ?? 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.01);
  }

  /** 303-style: saw/square through a resonant lowpass with a cutoff envelope and a pitch slide. */
  sweep(o: SweepOpts = {}): void {
    const io = this.out();
    if (!io) return;
    const { ctx, master } = io;
    const t = ctx.currentTime;
    const dur = o.dur ?? 0.18;
    const osc = ctx.createOscillator();
    osc.type = o.wave ?? 'sawtooth';
    osc.frequency.setValueAtTime(o.freq ?? 110, t);
    osc.frequency.exponentialRampToValueAtTime(o.freqEnd ?? (o.freq ?? 110) * 0.5, t + dur);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = o.q ?? 12;
    f.frequency.setValueAtTime(o.cutoff ?? 2400, t);
    f.frequency.exponentialRampToValueAtTime(o.cutoffEnd ?? 180, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain ?? 0.25, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(f).connect(g).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** SH-101-style: a tone whose pitch jumps to random values every stepDur (sample and hold LFO). */
  lfoTone(o: LfoToneOpts = {}): void {
    const io = this.out();
    if (!io) return;
    const { ctx, master } = io;
    const t = ctx.currentTime;
    const dur = o.dur ?? 0.35;
    const step = o.stepDur ?? 0.03;
    const osc = ctx.createOscillator();
    osc.type = o.wave ?? 'square';
    const base = o.base ?? 440;
    const spread = o.spread ?? 1.0;
    for (let tt = 0; tt < dur; tt += step) {
      // NOTE: Math.random is fine here: sound never feeds back into the simulation.
      osc.frequency.setValueAtTime(base * Math.pow(2, (Math.random() * 2 - 1) * spread), t + tt);
    }
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 3000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.gain ?? 0.12, t);
    g.gain.setValueAtTime(o.gain ?? 0.12, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(f).connect(g).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noiseBuffer(ctx: AudioContext, rate: number, bits: number, seconds: number): AudioBuffer {
    const key = `${rate}:${bits}:${seconds}`;
    const cached = this.noiseCache.get(key);
    if (cached) return cached;
    // Quantized noise generated at a low rate and held, so playing it at the context rate aliases
    // into the classic 8-bit crunch.
    const n = Math.ceil(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    const hold = Math.max(1, Math.round(ctx.sampleRate / rate));
    const levels = Math.pow(2, bits);
    let v = 0;
    for (let i = 0; i < n; i++) {
      if (i % hold === 0) v = (Math.round((Math.random() * 2 - 1) * levels) / levels);
      data[i] = v;
    }
    this.noiseCache.set(key, buf);
    return buf;
  }

  /** 8-bit breakup crunch: low-rate quantized noise through a lowpass with a fast decay. */
  crunch(o: CrunchOpts = {}): void {
    const io = this.out();
    if (!io) return;
    const { ctx, master } = io;
    const t = ctx.currentTime;
    const dur = o.dur ?? 0.16;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx, o.rate ?? 6000, o.bits ?? 4, 0.5);
    src.playbackRate.value = o.pitch ?? 1;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(o.cutoff ?? 1800, t);
    f.frequency.exponentialRampToValueAtTime(110, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.gain ?? 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  /** Pixel dust: a handful of tiny noise grains scattered over a few tens of milliseconds. */
  grains(o: GrainsOpts = {}): void {
    const io = this.out();
    if (!io) return;
    const { ctx, master } = io;
    const t0 = ctx.currentTime;
    const count = o.count ?? 4;
    const buf = this.noiseBuffer(ctx, 12000, 5, 0.5);
    for (let i = 0; i < count; i++) {
      const t = t0 + Math.random() * (o.spread ?? 0.08);
      const dur = o.grainDur ?? 0.012;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = 0.8 + Math.random() * 0.8;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = o.cutoff ?? 3500;
      f.Q.value = 2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(o.gain ?? 0.08, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(master);
      src.start(t);
      src.stop(t + dur + 0.01);
    }
  }

  /**
   * Sub-bass pop: a short sine at 35-90 Hz with a fast pitch drop, plus a second, lower layer (half the
   * pitch, clamped to 30-45 Hz) with a tail `subTail` times longer. `sub` scales that layer (0 disables it).
   * The "tiny lo-fi bass" that sits under almost every event.
   */
  bass(freq = 70, dur = 0.035, gain = 0.12, sub = 0.7, subTail = 1.8): void {
    const io = this.out();
    if (!io) return;
    const { ctx, master } = io;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.55, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.01);
    if (sub <= 0) return;
    const subFreq = Math.min(45, Math.max(30, freq * 0.5));
    const subDur = dur * subTail;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(subFreq, t);
    o2.frequency.exponentialRampToValueAtTime(subFreq * 0.8, t + subDur);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(gain * sub, t + Math.min(0.012, subDur * 0.3));
    g2.gain.exponentialRampToValueAtTime(0.0001, t + subDur);
    o2.connect(g2).connect(master);
    o2.start(t);
    o2.stop(t + subDur + 0.01);
  }

  /** Bass static: a discrete low rumble pop, noise through a very low lowpass plus a sub sine. */
  bassStatic(gain = 0.1, dur = 0.06): void {
    const io = this.out();
    if (!io) return;
    const { ctx, master } = io;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx, 4000, 3, 0.5);
    src.playbackRate.value = 0.5 + Math.random() * 0.5;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(220, t);
    f.frequency.exponentialRampToValueAtTime(90, t + dur);
    f.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
    // The sub under the static: a touch fuller than the rumble itself, with the longer tail.
    this.bass(36 + Math.random() * 18, dur * 1.3, gain, 0.9, 2.2);
  }

  /** Low thud: a sine dropping in pitch plus a short noise layer. Hull impacts. */
  thud(freq = 90, dur = 0.25, gain = 0.35): void {
    const io = this.out();
    if (!io) return;
    const { ctx, master } = io;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.4, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    this.crunch({ rate: 3000, bits: 3, dur: 0.12, cutoff: 700, gain: gain * 0.5 });
    this.bass(freq * 0.5, dur * 0.8, gain * 0.8, 0.8, 1.6);
  }
}
