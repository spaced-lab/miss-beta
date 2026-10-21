// WHAT: SUPER-DUPER-DEMO cutaways: while the games play themselves the screen cuts away to short animated summaries
//       (planning, launch salvos, hit after hit, data centres, lasers, hit after hit, the wormhole) and back, with a random
//       voice line, more often and in longer bursts as the demo speeds up.
// WHY:  Owner 2026-10-18: "randomly use voice or screens and go to animated summary of switching back and forth as
//       it's running ... just want it to look fast and faster". 2026-10-20: the first cut sooner, and the planner's
//       thinking time always covered ("seems to pause on lots of screens"); then, second pass: it "reuses scenes and
//       toggles back and forth", so scenes are dealt from a deck and come in bursts, and the high clicking became
//       quiet low bleeps and bloops (audio/bloops.ts).
// HOW:  A timer counts real seconds. At demo progress f in 0..1 the gap between bursts runs from DEMO_CUT.GAP0_S to
//       GAP1_S, each cut from LEN0_S to LEN1_S, and a burst chains 1 + f x (BURST_MAX - 1) cuts back to back. A cut
//       never lasts under DEMO_MONTAGE.SAFE_MIN_S, so the screen changes at most three times a second (photosensitive
//       safety, docs/WARNINGS.md); REDUCE MOTION turns cutaways off. Cuts are dealt from the scenes unlocked so far
//       (`from` <= f) without repeating one until all have shown; the order is a seeded Rng, so a demo run is the
//       same every time. While `cover` is set (the planner is computing its grid) cuts chain with no gap. The system
//       view holds cutaways while a cinematic plays. From f = 0.3 the hit storm (render/pixelDust.ts) lands over
//       every cut.
// LORE: G1 (how to play), G8 (the look, and the sound)

import { Bloops } from '../../audio/bloops';
import { KNOBS } from '../../config/knobs';
import type { UiSfx } from '../../audio/ui';
import type { VoiceId } from '../../audio/voice';
import { Rng } from '../../sim/rng';
import type { Surface } from '../canvas';
import { dcPlanets, earthHits, laserFleet, laserMap, rockHits, salvo, solar, wormhole, worldsSalvo } from '../demoFuture';
import { clocks, dcGlobe, hitsBy, impacts, planning, racks, type DemoScene } from '../demoScenes';
import { hitStorm } from '../pixelDust';
import { uiColors } from '../palettes';
import { drawText } from '../vectorFont';

interface Cut {
  scene: DemoScene;
  caption: string;
  sound: 'blips' | 'hits' | 'launch' | 'laser' | 'none';
  /** Demo progress at which the cut joins the deck. */
  from: number;
}

/** Every caption is FICTION in character (GAME_PLAN 30). */
const CUTS: readonly Cut[] = [
  { scene: planning, caption: 'PLANNING: EVERY WINDOW, EVERY ORBIT', sound: 'blips', from: 0 },
  { scene: salvo, caption: 'LAUNCH WINDOW OPEN', sound: 'launch', from: 0 },
  { scene: rockHits, caption: 'KINETIC STRIKE: CONFIRMED', sound: 'hits', from: 0 },
  { scene: racks, caption: 'DATA CENTRE CAPACITY: DOUBLED AGAIN', sound: 'blips', from: 0 },
  { scene: dcGlobe, caption: 'GLOBAL DATA CENTRES: MORE OF THEM', sound: 'blips', from: 0 },
  { scene: clocks, caption: 'TIMELINE ADJUSTMENT IN PROGRESS', sound: 'blips', from: 0.1 },
  { scene: impacts, caption: 'REPLAYING EVERY ROCK WE MISSED', sound: 'hits', from: 0.15 },
  { scene: dcPlanets, caption: 'DATA CENTRES: OFF-WORLD', sound: 'blips', from: 0.2 },
  { scene: worldsSalvo, caption: 'LAUNCHING FROM LUNA, MARS AND EUROPA', sound: 'launch', from: 0.3 },
  { scene: laserMap, caption: 'PLANETARY LASER GRID: TEST FIRE', sound: 'laser', from: 0.35 },
  { scene: solar, caption: 'SOLAR ERUPTION: STEERED', sound: 'laser', from: 0.45 },
  { scene: laserFleet, caption: 'EVERY LASER WE OWN', sound: 'laser', from: 0.6 },
  { scene: earthHits, caption: 'HOME: HIT, HIT, HIT', sound: 'hits', from: 0.7 },
  { scene: wormhole, caption: 'TIME WARP: WARMING UP', sound: 'none', from: 0.75 },
];

const VOICES: readonly VoiceId[] = ['LAUNCHING', 'INTERCEPT', 'DEFLECTED', 'BUILDING', 'RESEARCHING', 'WARP', 'THREAT_DETECTED', 'PLAN_COMMITTED', 'FRAGMENTS', 'IMPACT_IMMINENT'];

/** Linear blend a -> b by f in 0..1. Example: lerp(5, 1, 0.5) = 3. */
function lerp(a: number, b: number, f: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, f));
}

export class DemoCutaways {
  private rng = new Rng(20261018);
  private until: number = KNOBS.DEMO_CUT.FIRST_S;
  private cur: Cut | null = null;
  private last: Cut | null = null;
  private used = new Set<Cut>();
  private burstLeft = 0;
  private t = 0;
  private len = 0;
  private f = 0;
  private hitsHeard = 0;
  private blipT = 0;
  /** This cut's local start time and hit-storm seed, drawn per cut so no two showings land the same hits. */
  private t0 = 0;
  private seed = 1;
  /** Seconds of cutaways shown, the hit storm's clock (it runs on across cuts instead of restarting). */
  private stormT = 0;
  private bloops = new Bloops();

  constructor(private readonly sfx: UiSfx | null, private readonly reduceMotion: () => boolean) {}

  get isOn(): boolean {
    return this.cur !== null;
  }

  reset(): void {
    this.rng = new Rng(20261018);
    this.until = KNOBS.DEMO_CUT.FIRST_S;
    this.cur = null;
    this.last = null;
    this.used.clear();
    this.burstLeft = 0;
    this.stormT = 0;
  }

  /** The next cut from the deck: an unlocked scene not shown since the deck was last reshuffled, never the last one. */
  private deal(f: number): Cut | null {
    const open = CUTS.filter((x) => x.from <= f);
    let fresh = open.filter((x) => !this.used.has(x) && x !== this.last);
    if (fresh.length === 0) {
      this.used.clear();
      fresh = open.filter((x) => x !== this.last);
    }
    const c = fresh[this.rng.int(0, Math.max(0, fresh.length - 1))] ?? open[0] ?? null;
    if (c) this.used.add(c);
    return c;
  }

  /**
   * Advance by dt real seconds at demo progress f (0 start, 1 finale); `blocked` holds a pending cut (cinematic);
   * `cover` cuts at once and chains cuts with no gap (the game screen would be still).
   */
  update(dt: number, f: number, blocked: boolean, cover = false): void {
    this.f = f;
    if (this.reduceMotion()) {
      this.cur = null;
      return;
    }
    const c = KNOBS.DEMO_CUT;
    if (this.cur) {
      this.t += dt;
      this.stormT += dt;
      this.sounds(dt);
      if (this.t < this.len) return;
      this.cur = null;
      if (this.burstLeft <= 0) this.until = lerp(c.GAP0_S, c.GAP1_S, f);
      if (blocked || (this.burstLeft <= 0 && !cover)) return;
    } else {
      this.until -= dt;
      if ((this.until > 0 && !cover) || blocked) return;
      this.burstLeft = 1 + Math.floor(Math.max(0, Math.min(1, f)) * (c.BURST_MAX - 1) + 1e-9);
    }
    this.burstLeft--;
    this.cur = this.deal(f);
    this.last = this.cur;
    this.t = 0;
    this.len = Math.max(KNOBS.DEMO_MONTAGE.SAFE_MIN_S, lerp(c.LEN0_S, c.LEN1_S, f));
    this.hitsHeard = 0;
    this.blipT = 0;
    // NOTE: owner 2026-10-20: impacts "seem to just keep reoccurring" and some "are replayed": every cut used to start
    // at local time 0 with the same storm seed, so each showing of a scene landed the same hits in the same places.
    this.t0 = this.cur?.sound === 'hits' ? 0.1 + this.rng.next() * 30 : this.rng.next() * 2;
    this.seed = this.rng.int(1, 99999);
    const synth = this.sfx?.synth;
    if (synth && this.cur?.sound === 'launch') synth.rumble(46, 0.6, 0.3 * KNOBS.DEMO_REEL.BASS_X, 160);
    if (this.rng.next() < c.VOICE_P) this.sfx?.voice.say(VOICES[this.rng.int(0, VOICES.length - 1)] ?? 'WARP');
  }

  /** Quiet low bleeps and bloops in bursts for the computers, soft laser sweeps, and a bass hit for every hit drawn. */
  private sounds(dt: number): void {
    const cut = this.cur;
    const synth = this.sfx?.synth;
    if (!cut || !synth) return;
    if (cut.sound === 'blips') this.bloops.step(synth, dt, this.f);
    else if (cut.sound === 'laser') {
      this.blipT -= dt;
      while (this.blipT <= 0) {
        this.blipT += 1 / (3 + 5 * this.f);
        synth.sweep({ freq: 620, freqEnd: 140, dur: 0.11, wave: 'triangle', gain: 0.03 });
      }
    } else if (cut.sound === 'hits') {
      const lt = this.t0 + this.t;
      const n = cut.scene === rockHits || cut.scene === earthHits ? Math.floor((lt - 0.1) / 0.3) + 1 : hitsBy(lt, this.f);
      if (n > this.hitsHeard) {
        this.hitsHeard = n;
        synth.rumble(36 + this.rng.int(0, 6), 0.5, Math.min(0.85, 0.36 * KNOBS.DEMO_REEL.BASS_X * (1 + 0.4 * this.f)), 110);
      }
    }
  }

  render(s: Surface, header: string): void {
    const cut = this.cur;
    if (!cut) return;
    s.clear();
    const ui = uiColors(s.palette, true);
    cut.scene(s, this.t0 + this.t, ui, Math.min(1, 0.15 + this.f));
    hitStorm(s, this.stormT, this.f * 0.85, this.seed);
    drawText(s, cut.caption, s.width / 2, 28, Math.min(20, s.width / 44), { align: 'center', color: ui.title, glow: 1.6 });
    drawText(s, header, s.width / 2, s.height - 30, 10, { align: 'center', color: ui.sub, glow: 0.5 });
  }
}
