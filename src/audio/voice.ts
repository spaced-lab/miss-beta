// WHAT: Canned robot voice-overs (IDEAS 21): play a short line ("LAUNCHING", "IMPACT IMMINENT") by id.
// WHY:  A mission computer that speaks makes the big moments land without reading the HUD. The lines are baked
//       offline (scripts/gen_voice.py: Kokoro TTS, Apache-2.0, through a channel vocoder) into tiny Opus files,
//       so nothing is synthesised or fetched from anywhere but our own origin.
// HOW:  Nothing loads at boot. The first `say(id)` fetches public/audio/voice/<voice>/<id>.ogg (same origin, allowed
//       by the CSP's connect-src 'self'), decodes it once and caches the AudioBuffer (a failed load caches null and
//       stays silent). Lines never overlap: a new line cuts the playing one with a short fade (newest wins, the
//       freshest news is the one that matters), a line that arrives later than VOICE_STALE_S is dropped, and the
//       same id is not repeated within VOICE_REPEAT_S. A line may name one follow-up (`then`) that plays when it
//       ends uncut ("IMPACT. EARTH HAS BEEN HIT." then "GAME OVER."). Playback goes through the shared Synth's master bus and
//       compressor, so the SOUND volume and the loudness cap apply. The voice has its own mode: OFF or one of the
//       baked robot voices (FEMALE, MALE, TERMINAL, COMPUTER, MAINFRAME, TOY, NARRATOR, RADIO), each a folder named after
//       it. scripts/voice_check.py scores each voice's clarity with a speech recogniser (IDEAS 36).
// LORE: G8 (the look, and the sound)

import manifest from '../config/voice.json';
import { KNOBS } from '../config/knobs';
import type { SimEventRecord } from '../sim/eventLog';
import type { VoiceSetting } from '../game/settings';
import type { Synth } from './synth';

export type VoiceMode = VoiceSetting;
export type VoiceId = keyof typeof manifest;

export const VOICE_IDS = Object.keys(manifest) as VoiceId[];

/** The text of a line (for captions and the tests). */
export function voiceText(id: VoiceId): string {
  return manifest[id];
}

/**
 * Path of a clip relative to the page (Vite's base is relative, so this also works from a sub-path). The folder is
 * the voice's name in lower case, so a new voice is a new folder plus a VOICES entry, nothing else.
 * Example: voiceUrl('MAINFRAME', 'PLAY_A_GAME') = 'audio/voice/mainframe/PLAY_A_GAME.ogg'.
 */
export function voiceUrl(mode: Exclude<VoiceMode, 'OFF'>, id: VoiceId): string {
  return `audio/voice/${mode.toLowerCase()}/${id}.ogg`;
}

/**
 * The one line worth saying for a batch of events that passed on the clock this frame (at high warp a frame can
 * pass many; only the most important speaks). Priority: fragments, disruption, deflection verdict, intercept,
 * launch. Close approaches are left to the round result (MISS / PARTIAL / HIT). Pure, so it is tested.
 */
export function voiceForEvents(passed: readonly SimEventRecord[]): VoiceId | null {
  let best: VoiceId | null = null;
  let rank = 0;
  const offer = (id: VoiceId, r: number): void => {
    if (r > rank) {
      best = id;
      rank = r;
    }
  };
  for (const e of passed) {
    if (e.kind === 'FRAGMENTATION') offer('FRAGMENTS', 6);
    else if ((e.kind === 'PI' && e.ok) || e.kind === 'NUKE') offer('DISRUPTED', 5);
    else if (e.kind === 'BETA_ASSESSED') offer(e.marginRadii > 1 ? 'DEFLECTED' : 'PARTIAL', 4);
    else if (e.kind === 'IMPACT') offer('INTERCEPT', 3);
    else if (e.kind === 'LAUNCH') offer('LAUNCHING', 2);
  }
  return best;
}

export class Voice {
  mode: VoiceMode = 'FEMALE';
  private readonly cache = new Map<string, Promise<AudioBuffer | null>>();
  private playing: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private lastSaid = new Map<VoiceId, number>();
  /** Bumped on every request so an older, slower load never plays over a newer line. */
  private ticket = 0;
  /** The line last started and when (performance.now() s), for a caller that follows it (the demo's teletype). */
  current: { id: VoiceId; at: number } | null = null;

  constructor(private readonly synth: Synth) {}

  /**
   * Say a line now (newest wins). `force` skips the repeat guard (the OPTIONS sample); `then` follows it; `repeatS`
   * replaces VOICE_REPEAT_S as the guard for this call (the demo's longer one).
   */
  say(id: VoiceId, force = false, then?: VoiceId, repeatS: number = KNOBS.VOICE_REPEAT_S): void {
    if (this.mode === 'OFF' || typeof fetch === 'undefined') return;
    const bus = this.synth.bus();
    if (!bus) return;
    const now = performance.now() / 1000;
    const last = this.lastSaid.get(id);
    if (!force && last !== undefined && now - last < repeatS) return;
    this.lastSaid.set(id, now);
    const ticket = ++this.ticket;
    void this.load(bus.ctx, voiceUrl(this.mode, id)).then((buf) => {
      if (!buf || ticket !== this.ticket || performance.now() / 1000 - now > KNOBS.VOICE_STALE_S) return;
      const live = this.synth.bus();
      if (live) this.play(live.ctx, live.master, buf, then, id);
    });
  }

  /** Fetch and decode a line now without playing it, so a later `say` starts on time. */
  preload(id: VoiceId): void {
    const bus = this.synth.bus();
    if (this.mode === 'OFF' || typeof fetch === 'undefined' || !bus) return;
    void this.load(bus.ctx, voiceUrl(this.mode, id));
  }

  /** Stop whatever is playing (screen change, pause of the audio). */
  hush(): void {
    this.ticket++;
    this.current = null;
    const p = this.synth.bus();
    if (this.playing && p) this.fadeOut(p.ctx, this.playing);
    this.playing = null;
  }

  private load(ctx: AudioContext, url: string): Promise<AudioBuffer | null> {
    let p = this.cache.get(url);
    if (!p) {
      p = fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status}`))))
        .then((data) => ctx.decodeAudioData(data))
        .catch((e: unknown) => {
          console.warn('[voice] cannot load', url, e);
          return null;
        });
      this.cache.set(url, p);
    }
    return p;
  }

  private fadeOut(ctx: AudioContext, p: { src: AudioBufferSourceNode; gain: GainNode }): void {
    const t = ctx.currentTime;
    p.gain.gain.setTargetAtTime(0, t, KNOBS.VOICE_CUT_S / 3);
    p.src.stop(t + KNOBS.VOICE_CUT_S);
  }

  private play(ctx: AudioContext, master: GainNode, buf: AudioBuffer, then: VoiceId | undefined, id: VoiceId): void {
    if (this.playing) this.fadeOut(ctx, this.playing);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = KNOBS.VOICE_GAIN;
    src.connect(gain).connect(master);
    const cur = { src, gain };
    src.onended = () => {
      if (this.playing !== cur) return;
      this.playing = null;
      if (then) this.say(then, true);
    };
    this.playing = cur;
    this.current = { id, at: performance.now() / 1000 };
    src.start();
  }
}
