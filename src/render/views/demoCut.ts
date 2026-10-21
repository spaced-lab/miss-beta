// WHAT: SUPER-DUPER-DEMO cutaways: while the games play themselves the screen keeps cutting away to short animated
//       summaries (planning, launch, strike, data centres, the globe, clocks, hit after hit) and back, with a
//       random voice line, more often and shorter as the demo speeds up.
// WHY:  Owner 2026-10-18: "randomly use voice or screens and go to animated summary of switching back and forth as
//       it's running ... just want it to look fast and faster". The cutaways also cover the planner's thinking time.
// HOW:  A timer counts real seconds. Gap and length run from DEMO_CUT.GAP0_S / LEN0_S at the start to GAP1_S /
//       LEN1_S at the finale (progress f in 0..1); a cut never lasts under DEMO_MONTAGE.SAFE_MIN_S, so the screen
//       changes at most three times a second (photosensitive safety, docs/WARNINGS.md), and REDUCE MOTION turns
//       cutaways off. Scene order is a seeded Rng, so a demo run is the same every time. The system view skips
//       cutaways while a cinematic plays (launches and strikes are the game's own animation). Owner 2026-10-20
//       ("seems to pause on lots of screens ... things not rendering"): the first cut comes at DEMO_CUT.FIRST_S,
//       and while `cover` is set (the planner is still computing its grid) cuts follow each other with no gap, so
//       the empty planner is never on screen. Later scenes join the pool as the demo runs (worlds, lasers, solar
//       eruptions) and from f = 0.3 the hit storm (render/pixelDust.ts) lands over every cut.
// LORE: G1 (how to play), G8 (the look, and the sound)

import { KNOBS } from '../../config/knobs';
import type { UiSfx } from '../../audio/ui';
import type { VoiceId } from '../../audio/voice';
import { Rng } from '../../sim/rng';
import type { Surface } from '../canvas';
import { dcPlanets, laserMap, salvo, solar, worldsSalvo } from '../demoFuture';
import { clocks, dcGlobe, hitsBy, impacts, planning, racks, strike, worldMap, type DemoScene } from '../demoScenes';
import { hitStorm } from '../pixelDust';
import { uiColors } from '../palettes';
import { drawText } from '../vectorFont';

interface Cut {
  scene: DemoScene;
  caption: string;
  sound: 'blips' | 'hits' | 'none';
}

/** Every caption is FICTION in character (GAME_PLAN 30). `from` is the demo progress at which a cut joins the pool. */
const CUTS: readonly (Cut & { from: number })[] = [
  { scene: planning, caption: 'PLANNING: EVERY WINDOW, EVERY ORBIT', sound: 'blips', from: 0 },
  { scene: salvo, caption: 'LAUNCH WINDOW OPEN', sound: 'none', from: 0 },
  { scene: strike, caption: 'KINETIC STRIKE: CONFIRMED', sound: 'hits', from: 0 },
  { scene: racks, caption: 'DATA CENTRE CAPACITY: DOUBLED AGAIN', sound: 'blips', from: 0 },
  { scene: dcGlobe, caption: 'GLOBAL DATA CENTRES: MORE OF THEM', sound: 'blips', from: 0 },
  { scene: clocks, caption: 'TIMELINE ADJUSTMENT IN PROGRESS', sound: 'blips', from: 0.1 },
  { scene: impacts, caption: 'REPLAYING EVERY ROCK WE MISSED', sound: 'hits', from: 0.1 },
  { scene: worldMap, caption: 'TRACKING NETWORK: ALL STATIONS', sound: 'none', from: 0 },
  { scene: dcPlanets, caption: 'DATA CENTRES: OFF-WORLD', sound: 'blips', from: 0.25 },
  { scene: worldsSalvo, caption: 'LAUNCHING FROM LUNA, MARS AND EUROPA', sound: 'none', from: 0.35 },
  { scene: laserMap, caption: 'PLANETARY LASER GRID: TEST FIRE', sound: 'none', from: 0.45 },
  { scene: solar, caption: 'SOLAR ERUPTION: STEERED', sound: 'none', from: 0.55 },
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
    this.until = KNOBS.DEMO_CUT.FIRST_S;
    this.cur = null;
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
      this.sounds(dt);
      if (this.t >= this.len) {
        this.cur = null;
        this.until = lerp(c.GAP0_S, c.GAP1_S, f);
      }
      if (!cover || blocked) return;
    }
    this.until -= dt;
    if ((this.until > 0 && !cover) || blocked) return;
    const pool = CUTS.filter((x) => x.from <= f);
    let next = pool[this.rng.int(0, pool.length - 1)] ?? null;
    // Never the same cut twice in a row when chaining.
    if (next && next === this.last && pool.length > 1) next = pool[(pool.indexOf(next) + 1) % pool.length] ?? next;
    this.cur = next;
    this.last = next;
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
    cut.scene(s, this.t, ui, Math.min(1, 0.15 + this.f));
    hitStorm(s, this.t, this.f * 0.85, 7070);
    drawText(s, cut.caption, s.width / 2, 28, Math.min(20, s.width / 44), { align: 'center', color: ui.title, glow: 1.6 });
    drawText(s, header, s.width / 2, s.height - 30, 10, { align: 'center', color: ui.sub, glow: 0.5 });
  }
}
