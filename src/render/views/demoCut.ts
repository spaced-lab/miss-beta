// WHAT: SUPER-DUPER-DEMO cutaways: while the games play themselves the screen keeps cutting away to short animated
//       summaries (planning, launch, strike, data centres, the globe, clocks, hit after hit) and back, with a
//       random voice line, more often and shorter as the demo speeds up.
// WHY:  Owner 2026-10-18: "randomly use voice or screens and go to animated summary of switching back and forth as
//       it's running ... just want it to look fast and faster". The cutaways also cover the planner's thinking time.
// HOW:  A timer counts real seconds. Gap and length run from DEMO_CUT.GAP0_S / LEN0_S at the start to GAP1_S /
//       LEN1_S at the finale (progress f in 0..1); a cut never lasts under DEMO_MONTAGE.SAFE_MIN_S, so the screen
//       changes at most three times a second (photosensitive safety, docs/WARNINGS.md), and REDUCE MOTION turns
//       cutaways off. Scene order is a seeded Rng, so a demo run is the same every time. The system view skips
//       cutaways while a cinematic plays (launches and strikes are the game's own animation).
// LORE: G1 (how to play), G8 (the look, and the sound)

import { KNOBS } from '../../config/knobs';
import type { UiSfx } from '../../audio/ui';
import type { VoiceId } from '../../audio/voice';
import { Rng } from '../../sim/rng';
import type { Surface } from '../canvas';
import { clocks, dcGlobe, hitsBy, impacts, launch, planning, racks, strike, worldMap, type DemoScene } from '../demoScenes';
import { uiColors } from '../palettes';
import { drawText } from '../vectorFont';

interface Cut {
  scene: DemoScene;
  caption: string;
  sound: 'blips' | 'hits' | 'none';
}

/** Every caption is FICTION in character (GAME_PLAN 30). */
const CUTS: readonly Cut[] = [
  { scene: planning, caption: 'PLANNING: EVERY WINDOW, EVERY ORBIT', sound: 'none' },
  { scene: launch, caption: 'LAUNCH WINDOW OPEN', sound: 'none' },
  { scene: strike, caption: 'KINETIC STRIKE: CONFIRMED', sound: 'hits' },
  { scene: racks, caption: 'DATA CENTRE CAPACITY: DOUBLED AGAIN', sound: 'blips' },
  { scene: dcGlobe, caption: 'GLOBAL DATA CENTRES: MORE OF THEM', sound: 'blips' },
  { scene: clocks, caption: 'TIMELINE ADJUSTMENT IN PROGRESS', sound: 'blips' },
  { scene: impacts, caption: 'REPLAYING EVERY ROCK WE MISSED', sound: 'hits' },
  { scene: worldMap, caption: 'TRACKING NETWORK: ALL STATIONS', sound: 'none' },
];

const VOICES: readonly VoiceId[] = ['LAUNCHING', 'INTERCEPT', 'DEFLECTED', 'BUILDING', 'RESEARCHING', 'WARP', 'THREAT_DETECTED', 'PLAN_COMMITTED', 'FRAGMENTS', 'IMPACT_IMMINENT'];

/** Linear blend a -> b by f in 0..1. Example: lerp(5, 1, 0.5) = 3. */
function lerp(a: number, b: number, f: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, f));
}

export class DemoCutaways {
  private rng = new Rng(20261018);
  private until: number = KNOBS.DEMO_CUT.GAP0_S;
  private cur: Cut | null = null;
  private t = 0;
  private len = 0;
  private f = 0;
  private hitsHeard = 0;
  private blipT = 0;

  constructor(private readonly sfx: UiSfx | null, private readonly reduceMotion: () => boolean) {}

  get isOn(): boolean {
    return this.cur !== null;
  }

  reset(): void {
    this.rng = new Rng(20261018);
    this.until = KNOBS.DEMO_CUT.GAP0_S;
    this.cur = null;
  }

  /** Advance by dt real seconds at demo progress f (0 start, 1 finale); `blocked` holds a pending cut (cinematic). */
  update(dt: number, f: number, blocked: boolean): void {
    this.f = f;
    if (this.reduceMotion()) {
      this.cur = null;
      return;
    }
    const c = KNOBS.DEMO_CUT;
    if (this.cur) {
      this.t += dt;
      this.sounds(dt);
      if (this.t >= this.len) {
        this.cur = null;
        this.until = lerp(c.GAP0_S, c.GAP1_S, f);
      }
      return;
    }
    this.until -= dt;
    if (this.until > 0 || blocked) return;
    this.cur = CUTS[this.rng.int(0, CUTS.length - 1)] ?? null;
    this.t = 0;
    this.len = Math.max(KNOBS.DEMO_MONTAGE.SAFE_MIN_S, lerp(c.LEN0_S, c.LEN1_S, f));
    this.hitsHeard = 0;
    this.blipT = 0;
    this.sfx?.synth.tick({ freq: 520 + 600 * f, dur: 0.025, wave: 'square', gain: 0.03 });
    if (this.rng.next() < c.VOICE_P) this.sfx?.voice.say(VOICES[this.rng.int(0, VOICES.length - 1)] ?? 'WARP');
  }

  /** Blippy data-centre chatter and a bass hit for every hit drawn. */
  private sounds(dt: number): void {
    const cut = this.cur;
    const synth = this.sfx?.synth;
    if (!cut || !synth) return;
    if (cut.sound === 'blips') {
      this.blipT -= dt;
      while (this.blipT <= 0) {
        this.blipT += 1 / (14 + 16 * this.f);
        synth.tick({ freq: 900 + Math.floor(this.rng.next() * 8) * 160, dur: 0.012, wave: 'square', gain: 0.018 });
      }
    } else if (cut.sound === 'hits') {
      const n = hitsBy(this.t, this.f);
      if (n > this.hitsHeard) {
        this.hitsHeard = n;
        synth.rumble(38 + this.rng.int(0, 6), 0.45, 0.32, 110);
      }
    }
  }

  render(s: Surface, header: string): void {
    const cut = this.cur;
    if (!cut) return;
    s.clear();
    const ui = uiColors(s.palette, true);
    cut.scene(s, this.t, ui, this.f);
    drawText(s, cut.caption, s.width / 2, 28, Math.min(20, s.width / 44), { align: 'center', color: ui.title, glow: 1.6 });
    drawText(s, header, s.width / 2, s.height - 30, 10, { align: 'center', color: ui.sub, glow: 0.5 });
  }
}
