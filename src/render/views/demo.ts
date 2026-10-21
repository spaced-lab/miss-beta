// WHAT: SUPER-DUPER-DEMO finale (IDEAS 20, owner 2026-10-18): after the self-played games, a montage that runs
//       faster and faster, a pause, then a green teletype window with the closing line (and the robot voice).
// WHY:  The demo's punchline. Every montage line is FICTION in character (GAME_PLAN 30 deadpan): nothing here is
//       a claim about real computers, power grids or time travel, and none of it is a feature of the game.
//       Owner notes after shipping: faster, more data centres with racks growing more complex and futuristic,
//       blippy data-centre noises, clocks and dates being adjusted over and over, hit after hit with the bass
//       rumbling, a shorter time portal; the ending (blur, pause, teletype) kept exactly as it was. Owner
//       2026-10-20 ("go to town on this demo"): many more and stranger scenes (launch salvos, launches and data
//       centres on other worlds, lasers from the map, steered solar eruptions, a wormhole instead of the spiral,
//       dinosaurs, a saucer and its gray pilot), hits that grow far more frequent and intense towards the end,
//       voice lines cut off by the next, the bass rumbling up to the silent pause.
// HOW:  A reel of scenes (render/demoScenes.ts, render/demoFuture.ts) drawn as pure functions of local time and an
//       intensity. Pass 0 plays each scene for its own length, pass 1 for DEMO_REEL.REPEAT_X of it (starting at the
//       scene's `hot` moment so the impact or the year counter still shows), then BLUR_CUTS cuts at the floor
//       (the blur), then PAUSE_S of black and silence, then the window types at TYPE_CPS with a synth click per
//       character. `heat` (0..1 over the whole montage) drives the hit storm drawn over every scene
//       (render/pixelDust.ts) with a thump per hit, and in the blur a bass rumble every DEMO_REEL.RUMBLE_S.
//       Esc or any key after the text ends returns to the title.
// LORE: G1 (how to play)

import { KNOBS } from '../../config/knobs';
import type { UiSfx } from '../../audio/ui';
import type { VoiceId } from '../../audio/voice';
import type { Router, Screen } from '../../game/screen';
import type { Input } from '../../ui/input';
import type { Surface } from '../canvas';
import { hash01 } from '../cinematics/pixel';
import { dcPlanets, dinoImpact, dinoLaunch, laserMap, salvo, solar, ufo, wormhole, worldsSalvo } from '../demoFuture';
import { clocks, dcGlobe, hints, hitsBy, impacts, offWorld, power, racks, type DemoScene } from '../demoScenes';
import { uiColors, withAlpha } from '../palettes';
import { hitStorm, stormHits } from '../pixelDust';
import { drawText, wrapText } from '../vectorFont';


/** The closing line (owner's text, spelling checked). */
export const FINALE_TEXT = 'STRANGE GAME. THE ONLY OPTION IS TO KEEP WORKING TO PROTECT YOUR PLANET. SHALL WE PLAY A GAME OF CHESS, OR WILL YOU HELP US SAVE THE WORLD?';

type Sound = 'blips' | 'hits' | 'launch' | 'laser' | 'warp' | 'none';

interface MontageScene {
  draw: DemoScene;
  /** Headline plus a status line. */
  caption: readonly [string, string];
  /** Seconds on screen in pass 0. */
  len: number;
  sound: Sound;
  /** Local time the scene starts from on later passes (its best moment comes into the shorter cut). */
  hot: number;
}

const SCENES: readonly MontageScene[] = [
  { draw: racks, caption: ['DATA CENTRES: ALL OF THEM', 'RACKS ONLINE  ##########  INFERENCE AT FULL LOAD'], len: 0.8, sound: 'blips', hot: 0 },
  { draw: dcGlobe, caption: ['MORE DATA CENTRES', 'ONE EVERY FEW MINUTES  /  COOLING: OPTIMISTIC'], len: 0.7, sound: 'blips', hot: 0.6 },
  { draw: dcPlanets, caption: ['DATA CENTRES: OFF-WORLD', 'LUNAR FARM  /  OLYMPUS RACKS  /  EUROPA COLD STORE  /  JOVIAN RING'], len: 1.1, sound: 'blips', hot: 0.4 },
  { draw: salvo, caption: ['LAUNCH CADENCE: CONTINUOUS', 'EVERY PAD  /  EVERY DESIGN  /  NO WAITING FOR WEATHER'], len: 1.3, sound: 'launch', hot: 0.5 },
  { draw: worldsSalvo, caption: ['LAUNCHES FROM EVERY WORLD WE HAVE', 'LUNA  /  MARS  /  EUROPA'], len: 1.2, sound: 'launch', hot: 0.3 },
  { draw: clocks, caption: ['TIMELINE ADJUSTMENTS', 'CALENDARS RE-RUN  /  CLOCKS RE-SYNCED  /  DATES UNDER REVIEW'], len: 0.6, sound: 'blips', hot: 0.4 },
  { draw: power, caption: ['ALL POWER ROUTED TO SIMULATION', 'GRIDS REASSIGNED  /  STREETLIGHTS DIMMED  /  KETTLES ON HOLD'], len: 0.5, sound: 'none', hot: 0.3 },
  { draw: laserMap, caption: ['PLANETARY LASER GRID: ARMED', 'FIRING FROM THE MAP  /  AIMING: AUTOMATIC'], len: 1.1, sound: 'laser', hot: 0.6 },
  { draw: solar, caption: ['SOLAR ERUPTIONS: STEERED', 'GUIDE SATELLITES ALIGNED  /  PLASMA ON TARGET'], len: 1.2, sound: 'laser', hot: 0.5 },
  { draw: impacts, caption: ['EVERY ROCK WE EVER MISSED', 'REPLAYED UNTIL NONE GET THROUGH'], len: 1.2, sound: 'hits', hot: 0 },
  { draw: offWorld, caption: ['GLOBAL AND OFF-WORLD CPU DEDICATED TO INFERENCE AND LEARNING', 'LUNAR FARM  /  MARS RELAY  /  ORBITAL RING'], len: 0.5, sound: 'none', hot: 0 },
  { draw: wormhole, caption: ['TIME WARP: WORMHOLE OPEN', 'NANOBOTS PUSHED BACK THROUGH THE THROAT TO BUILD TOMORROW\'S TECH IN THE PAST'], len: 1.4, sound: 'warp', hot: 1 },
  { draw: dinoImpact, caption: ['ARRIVAL: 66 MILLION YEARS AGO', 'WRONG WINDOW  /  OBSERVERS ON SITE'], len: 1.8, sound: 'hits', hot: 0.7 },
  { draw: dinoLaunch, caption: ['TECHNOLOGY TRANSFER: EARLY', 'THE PAD CREW HAS QUESTIONS'], len: 1.4, sound: 'launch', hot: 0.3 },
  { draw: ufo, caption: ['OUTSIDE HELP HAS ARRIVED', 'CONTRACTOR: GRAY  /  REFERENCES: NONE  /  RESULTS: EXCELLENT'], len: 1.8, sound: 'none', hot: 0.8 },
  { draw: hints, caption: ['UNLOCKING', 'FEATURES NOT IN THIS GAME'], len: 0.7, sound: 'none', hot: 0 },
];

/** Lines the montage throws in; each new one cuts the last one off (the voice plays the newest). */
const VOICES: readonly VoiceId[] = ['LAUNCHING', 'INTERCEPT', 'DEFLECTED', 'WARP', 'THREAT_DETECTED', 'IMPACT_IMMINENT', 'FRAGMENTS', 'PLAN_COMMITTED', 'RESEARCHING', 'HIT'];

export class DemoScreen implements Screen {
  private t = 0;
  private stage: 'montage' | 'pause' | 'finale' = 'montage';
  private pass = 0;
  private sceneIdx = 0;
  private sceneT = 0;
  private blurCuts = 0;
  private typed = 0;
  private stageT = 0;
  private blipT = 0;
  private hitsHeard = 0;
  private blipN = 0;
  private stormHeard = 0;
  private stormT = 0;
  private thumpT = 0;
  private rumbleT = 0;
  private opened = false;

  constructor(private readonly s: Surface, private readonly keys: Input, private readonly router: Router, private readonly sfx: UiSfx | null = null, private readonly settings: { reduceMotion: boolean } = { reduceMotion: false }) {}

  enter(): void {
    this.t = 0;
    this.stage = 'montage';
    this.pass = 0;
    this.sceneIdx = 0;
    this.sceneT = 0;
    this.blurCuts = 0;
    this.typed = 0;
    this.stageT = 0;
    this.blipT = 0;
    this.hitsHeard = 0;
    this.stormHeard = 0;
    this.stormT = 0;
    this.thumpT = 0;
    this.rumbleT = 0;
    this.opened = false;
  }
  exit(): void {}

  private floor(): number {
    return Math.max(KNOBS.DEMO_MONTAGE.MIN_S, this.settings.reduceMotion ? KNOBS.DEMO_MONTAGE.CALM_MIN_S : KNOBS.DEMO_MONTAGE.SAFE_MIN_S);
  }

  /**
   * NOTE: photosensitive safety (WCAG 2.3.1, docs/WARNINGS.md): a full-screen cut is a flash, so the montage never
   * cuts more than three times a second (SAFE_MIN_S), and once a second with REDUCE MOTION.
   */
  private sceneLen(): number {
    if (this.atFloor()) return this.floor();
    const len = SCENES[this.sceneIdx]?.len ?? 1;
    return Math.max(this.floor(), this.pass === 0 ? len : len * KNOBS.DEMO_REEL.REPEAT_X);
  }
  /** Pass 2 on is the blur. */
  private atFloor(): boolean {
    return this.pass >= 2;
  }

  /** How far into the montage, 0..1: pass 0 to 0.45, pass 1 to 0.8, the blur to 1. Drives the hit storm. */
  private heat(): number {
    const f = this.sceneIdx / SCENES.length;
    if (this.pass === 0) return 0.45 * f;
    if (this.pass === 1) return 0.45 + 0.35 * f;
    return Math.min(1, 0.8 + (0.2 * this.blurCuts) / KNOBS.DEMO_MONTAGE.BLUR_CUTS);
  }

  /** Intensity 0..1 for the scenes: 0.3 at the start, full by the repeat pass. */
  private intensity(): number {
    return Math.min(1, 0.3 + this.heat() * 1.6);
  }

  /** Scene-local time: later passes start at the scene's best moment, hits restart with the scene. */
  private localT(): number {
    const sc = SCENES[this.sceneIdx];
    return this.pass === 0 || !sc ? this.sceneT : this.sceneT + sc.hot;
  }

  /** Per-scene sound, a thump per storm hit (at most one every 0.11 s), and the rumbling bass in the blur. */
  private sounds(dt: number): void {
    const synth = this.sfx?.synth;
    const sc = SCENES[this.sceneIdx];
    if (!synth || !sc) return;
    const k = this.intensity();
    const lt = this.localT();
    if (sc.sound === 'blips') {
      this.blipT -= dt;
      while (this.blipT <= 0) {
        this.blipT += 1 / (14 + 22 * k);
        this.blipN++;
        synth.tick({ freq: 880 + ((this.blipN * 7) % 9) * 150, dur: 0.012, wave: 'square', gain: 0.018 });
      }
    } else if (sc.sound === 'laser') {
      this.blipT -= dt;
      while (this.blipT <= 0) {
        this.blipT += 1 / (4 + 7 * k);
        this.blipN++;
        synth.sweep({ freq: 1700 + (this.blipN % 4) * 200, freqEnd: 260, dur: 0.07, wave: 'square', gain: 0.02 });
      }
    } else if (sc.sound === 'hits') {
      const n = sc.draw === dinoImpact ? Math.floor((lt - 0.9) / 2.4) + 1 : hitsBy(lt, k);
      if (n > this.hitsHeard) {
        this.hitsHeard = n;
        synth.rumble(34 + (n % 4) * 3, 0.5 + 0.3 * k, Math.min(0.6, 0.3 + 0.03 * n), 100);
      }
    }
    this.stormT += dt;
    const sh = stormHits(this.stormT, this.heat());
    this.thumpT -= dt;
    if (sh > this.stormHeard) {
      this.stormHeard = sh;
      if (this.thumpT <= 0) {
        this.thumpT = 0.11;
        synth.bassStatic(0.08 + 0.1 * this.heat(), 0.07);
      }
    }
    if (this.atFloor()) {
      this.rumbleT -= dt;
      if (this.rumbleT <= 0) {
        this.rumbleT = KNOBS.DEMO_REEL.RUMBLE_S;
        synth.rumble(30 + (this.blurCuts % 3) * 2, 0.5, Math.min(0.65, 0.35 + 0.025 * this.blurCuts), 110);
      }
    }
  }

  /** On every cut: a blip a little higher each pass, the scene's opening sound, and sometimes a voice line. */
  private onCut(): void {
    const sc = SCENES[this.sceneIdx];
    const sfx = this.sfx;
    if (!sc || !sfx) return;
    sfx.synth.tick({ freq: 180 + 60 * this.pass, dur: 0.03, wave: 'square', gain: 0.03 });
    if (sc.sound === 'launch') sfx.synth.rumble(46, 0.7, 0.3, 160);
    if (sc.sound === 'warp') sfx.synth.sweep({ freq: 90, freqEnd: 900, cutoff: 400, cutoffEnd: 3000, dur: 1.2, wave: 'sawtooth', gain: 0.04 });
    if (!this.atFloor() && hash01(this.pass, this.sceneIdx, 77) < 0.6) sfx.voice.say(VOICES[Math.floor(hash01(this.pass, this.sceneIdx, 78) * VOICES.length)] ?? 'WARP', true);
  }

  update(dtMs: number): void {
    const dt = dtMs / 1000;
    const k = this.keys;
    this.t += dt;
    this.stageT += dt;
    if (k.pressed('Escape')) {
      this.router.go('title');
      return;
    }
    if (this.stage === 'montage') {
      if (!this.opened) {
        this.opened = true;
        this.onCut();
      }
      this.sceneT += dt;
      this.sounds(dt);
      if (this.sceneT >= this.sceneLen()) {
        this.sceneT = 0;
        this.hitsHeard = 0;
        if (this.atFloor() && ++this.blurCuts >= KNOBS.DEMO_MONTAGE.BLUR_CUTS) {
          // The silent pause: the voice is cut and nothing new sounds (the last rumble's tail dies away).
          this.stage = 'pause';
          this.stageT = 0;
          this.sfx?.voice.hush();
          return;
        }
        this.sceneIdx++;
        if (this.sceneIdx >= SCENES.length) {
          this.sceneIdx = 0;
          this.pass++;
        }
        this.onCut();
      }
    } else if (this.stage === 'pause') {
      if (this.stageT >= KNOBS.DEMO_MONTAGE.PAUSE_S) {
        this.stage = 'finale';
        this.stageT = 0;
        this.sfx?.voice.say('FINALE', true);
      }
    } else {
      const want = Math.min(FINALE_TEXT.length, Math.floor(this.stageT * KNOBS.DEMO_MONTAGE.TYPE_CPS));
      while (this.typed < want) {
        const ch = FINALE_TEXT[this.typed] ?? ' ';
        this.typed++;
        if (ch !== ' ') this.sfx?.synth.tick({ freq: 1400 + (this.typed % 5) * 90, dur: 0.012, wave: 'square', gain: 0.025 });
      }
      if (this.typed >= FINALE_TEXT.length && this.stageT > FINALE_TEXT.length / KNOBS.DEMO_MONTAGE.TYPE_CPS + 1.5 && k.anyKeyPressed()) this.router.go('title');
    }
  }

  render(): void {
    const s = this.s;
    s.clear();
    const ui = uiColors(s.palette, true);
    if (this.stage === 'montage') {
      const scene = SCENES[this.sceneIdx];
      if (scene) scene.draw(s, this.localT(), ui, this.intensity());
      // Hits pile up over every scene as the montage heats up.
      hitStorm(s, this.stormT, this.heat(), 4040);
      const cap = scene?.caption;
      if (cap) {
        drawText(s, cap[0], s.width / 2, 28, Math.min(22, s.width / 40), { align: 'center', color: ui.title, glow: 1.6 });
        drawText(s, cap[1], s.width / 2, s.height - 48, 11, { align: 'center', color: ui.text, glow: 0.6 });
      }
      drawText(s, `PASS ${this.pass + 1}   X${(this.pass === 0 ? 1 : 1 / KNOBS.DEMO_REEL.REPEAT_X / (this.pass === 1 ? 1 : 0.4)).toFixed(1)}`, s.width - 16, 10, 9, { align: 'right', color: ui.dim, glow: 0 });
      return;
    }
    // The finale window: big green terminal text, whatever the colour mode.
    const green = '#33FF33';
    const w = Math.min(900, s.width - 48);
    const size = Math.max(14, Math.min(24, w / 34));
    const lines = wrapText(FINALE_TEXT, w - 48, size);
    const h = lines.length * size * 1.7 + 70;
    const x = (s.width - w) / 2;
    const y = (s.height - h) / 2;
    if (this.stage === 'pause') {
      if (Math.floor(this.stageT * 2) % 2 === 0) drawText(s, '_', x + 24, y + 30, size, { color: green, glow: 1.5 });
      return;
    }
    s.ctx.fillStyle = withAlpha('#001400', 0.9);
    s.ctx.fillRect(x, y, w, h);
    s.stroke([x, y, x + w, y, x + w, y + h, x, y + h], { closed: true, color: green, glow: 1.4, width: 2 });
    drawText(s, 'MISS β  TERMINAL', x + 16, y + 10, 10, { color: green, glow: 0.5, alpha: 0.7 });
    let left = this.typed;
    let ly = y + 40;
    for (const l of lines) {
      const part = l.slice(0, Math.max(0, left));
      left -= l.length + 1;
      const wd = drawText(s, part, x + 24, ly, size, { color: green, glow: 1.6 });
      if (left < 0 && part.length < l.length + 1 && Math.floor(this.t * 3) % 2 === 0) drawText(s, '_', x + 24 + wd + 4, ly, size, { color: green, glow: 1.6 });
      if (left < 0) break;
      ly += size * 1.7;
    }
    if (this.typed >= FINALE_TEXT.length && this.stageT > FINALE_TEXT.length / KNOBS.DEMO_MONTAGE.TYPE_CPS + 1.5) drawText(s, 'PRESS ANY KEY', s.width / 2, y + h + 20, 11, { align: 'center', color: green, glow: 0.6, alpha: 0.6 + 0.4 * Math.sin(this.t * 4) });
  }
}
