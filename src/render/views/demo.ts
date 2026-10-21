// WHAT: SUPER-DUPER-DEMO finale (IDEAS 20, owner 2026-10-18): after the self-played games, a montage that runs
//       faster and faster, a pause, then a green teletype window with the closing line (and the robot voice).
// WHY:  The demo's punchline. Every montage line is FICTION in character (GAME_PLAN 30 deadpan): nothing here is
//       a claim about real computers, power grids or time travel, and none of it is a feature of the game.
//       Owner notes after shipping: faster, more data centres with racks growing more complex and futuristic,
//       hit after hit with the bass rumbling; the ending (blur, pause, teletype) kept exactly as it was. Owner
//       2026-10-20 ("go to town on this demo"): many more and stranger scenes, colour, hits growing far more frequent
//       and intense, voice lines cut off by the next, the bass rumbling up to the silent pause. Second pass the same
//       day: hit-hit-hit bursts on a rock and on HOME, then the warp; the rumble starting earlier and building; a
//       bigger laser battle, the mothership, more dinosaurs and aliens; the time warp splitting the screen into 4
//       realities and then 16; quiet low bleeps and bloops instead of high clicks; the voice a touch quieter.
// HOW:  A reel of shots (render/demoScenes.ts, render/demoFuture.ts), each a pure function of local time and an
//       intensity. A burst is one scene cut into several 0.36 s shots, each starting at a different local time so
//       every shot lands a different hit. Pass 0 plays each shot for its length from `t0`, pass 1 for
//       DEMO_REEL.REPEAT_X of it from `hot` (shots marked once are skipped), then BLUR_CUTS cuts at the floor (the
//       blur), then PAUSE_S of black and silence, then the window types at TYPE_CPS with a synth click per
//       character. `heat` is montage time over the planned total (0..1): it drives the scenes' intensity, the hit
//       storm over every shot (render/pixelDust.ts) with a thump per hit, and from DEMO_REEL.RUMBLE_FROM a bass
//       rumble bed that tightens from RUMBLE_S0 to RUMBLE_S and grows louder up to the pause. Esc or any key after
//       the text ends returns to the title.
// LORE: G1 (how to play)

import { Bloops } from '../../audio/bloops';
import { KNOBS } from '../../config/knobs';
import type { UiSfx } from '../../audio/ui';
import type { VoiceId } from '../../audio/voice';
import type { Router, Screen } from '../../game/screen';
import type { Input } from '../../ui/input';
import type { Surface } from '../canvas';
import { hash01 } from '../cinematics/pixel';
import { dcPlanets, dinoImpact, dinoLaunch, earthHits, laserFleet, laserMap, mothership, rockHits, salvo, solar, split16, split4, ufo, wormhole, worldsSalvo } from '../demoFuture';
import { hitsBy, racks, type DemoScene } from '../demoScenes';
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
  /** Local time the shot starts from in pass 0. */
  t0: number;
  /** Local time the shot starts from on later passes (its best moment comes into the shorter cut). */
  hot: number;
  /** Shown in pass 0 only (the tail of a burst). */
  once?: boolean;
}

/** One shot of a scene. */
function shot(draw: DemoScene, caption: readonly [string, string], len: number, sound: Sound, hot: number): MontageScene {
  return { draw, caption, len, sound, t0: 0, hot };
}

/** A burst: `n` 0.36 s shots of one scene, 2.9 s of local time apart, so each lands a different hit. */
function burst(draw: DemoScene, captions: readonly (readonly [string, string])[], n: number): MontageScene[] {
  return Array.from({ length: n }, (_, j) => ({ draw, caption: captions[j % captions.length] ?? ['', ''], len: 0.36, sound: 'hits' as const, t0: 0.12 + j * 2.9, hot: 0.12 + j * 2.9, once: j >= 2 }));
}

const HIT_CAPS = [['HIT', 'KINETIC IMPACTOR ON TARGET'], ['HIT', 'AND AGAIN'], ['HIT', 'AND AGAIN'], ['HIT', 'IT IS STILL THERE']] as const;
const HOME_CAPS = [['HOME: HIT', 'SIMULATION 1 OF MANY'], ['HOME: HIT', 'SIMULATION 2'], ['HOME: HIT', 'SIMULATION 3'], ['HOME: HIT', 'SIMULATION 4'], ['HOME: HIT', 'WE NEED ANOTHER WAY']] as const;

const SCENES: readonly MontageScene[] = [
  shot(racks, ['DATA CENTRES: ALL OF THEM', 'RACKS ONLINE  ##########  INFERENCE AT FULL LOAD'], 0.6, 'blips', 0),
  shot(dcPlanets, ['DATA CENTRES: OFF-WORLD', 'LUNAR FARM  /  OLYMPUS RACKS  /  EUROPA COLD STORE  /  JOVIAN RING'], 0.9, 'blips', 0.4),
  shot(salvo, ['LAUNCH CADENCE: CONTINUOUS', 'EVERY PAD  /  EVERY DESIGN  /  NO WAITING FOR WEATHER'], 1, 'launch', 0.5),
  shot(worldsSalvo, ['LAUNCHES FROM EVERY WORLD WE HAVE', 'LUNA  /  MARS  /  EUROPA'], 0.9, 'launch', 0.3),
  shot(laserMap, ['PLANETARY LASER GRID: ARMED', 'FIRING FROM THE MAP  /  AIMING: AUTOMATIC'], 0.9, 'laser', 0.6),
  shot(laserFleet, ['EVERY LASER WE OWN', 'PLANETS  /  MOON  /  SATELLITES  /  STATION  /  ALL FIRING'], 1.5, 'laser', 1),
  shot(solar, ['SOLAR ERUPTIONS: STEERED', 'GUIDE SATELLITES ALIGNED  /  PLASMA ON TARGET'], 0.9, 'laser', 0.5),
  ...burst(rockHits, HIT_CAPS, 4),
  ...burst(earthHits, HOME_CAPS, 5),
  shot(wormhole, ['TIME WARP: WORMHOLE OPEN', 'NANOBOTS PUSHED BACK THROUGH THE THROAT TO BUILD TOMORROW\'S TECH IN THE PAST'], 1.2, 'warp', 1),
  shot(split4, ['REALITIES: 4', 'ONE WORMHOLE  /  FOUR TIMELINES  /  ALL DIFFERENT'], 1.8, 'warp', 0),
  shot(split16, ['REALITIES: 16', 'EVERY TIMELINE SPLITS AGAIN  /  SIXTEEN SIMULATIONS RUNNING'], 1.95, 'warp', 0),
  shot(dinoImpact, ['ARRIVAL: 66 MILLION YEARS AGO', 'WRONG WINDOW  /  OBSERVERS ON SITE'], 1.7, 'hits', 0.7),
  shot(dinoLaunch, ['TECHNOLOGY TRANSFER: EARLY', 'THE PAD CREW HAS QUESTIONS  /  ONE OF THEM IS SUITED UP'], 1.3, 'launch', 0.3),
  shot(ufo, ['OUTSIDE HELP HAS ARRIVED', 'CONTRACTOR: GRAY  /  REFERENCES: NONE  /  RESULTS: EXCELLENT  /  COW: UNEXPLAINED'], 1.6, 'none', 0.8),
  shot(mothership, ['THE NEIGHBOURS BROUGHT THE BIG ONE', 'MOTHERSHIP ON STATION  /  EVERY WINDOW WAVING'], 1.5, 'laser', 0.6),
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
  private stormHeard = 0;
  private stormT = 0;
  private thumpT = 0;
  private rumbleT = 0;
  private opened = false;
  private bloops = new Bloops();

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
  private lenOf(pass: number, sc: MontageScene | undefined): number {
    if (pass >= 2) return this.floor();
    const len = sc?.len ?? 1;
    return Math.max(this.floor(), pass === 0 ? len : len * KNOBS.DEMO_REEL.REPEAT_X);
  }
  private sceneLen(): number {
    return this.lenOf(this.pass, SCENES[this.sceneIdx]);
  }
  /** Pass 2 on is the blur. */
  private atFloor(): boolean {
    return this.pass >= 2;
  }

  /** The planned montage length to the pause, s (passes 0 and 1 plus the blur). */
  private plan(): number {
    let sum = KNOBS.DEMO_MONTAGE.BLUR_CUTS * this.floor();
    for (const sc of SCENES) sum += this.lenOf(0, sc) + (sc.once ? 0 : this.lenOf(1, sc));
    return sum;
  }

  /** How far into the montage, 0..1, by the clock. Drives the intensity, the hit storm and the rumble bed. */
  private heat(): number {
    return Math.min(1, this.stormT / this.plan());
  }

  /** Intensity 0..1 for the scenes: 0.35 at the start, full by the warp. */
  private intensity(): number {
    return Math.min(1, 0.35 + this.heat() * 1.4);
  }

  /** Scene-local time: pass 0 from the shot's t0, later passes from its best moment. */
  private localT(): number {
    const sc = SCENES[this.sceneIdx];
    if (!sc) return this.sceneT;
    return this.sceneT + (this.pass === 0 ? sc.t0 : sc.hot);
  }

  /** Per-scene sound, a thump per storm hit (at most one every 0.11 s), and the rumble bed from RUMBLE_FROM on. */
  private sounds(dt: number): void {
    const synth = this.sfx?.synth;
    const sc = SCENES[this.sceneIdx];
    if (!synth || !sc) return;
    const heat = this.heat();
    const k = this.intensity();
    const lt = this.localT();
    const bx = KNOBS.DEMO_REEL.BASS_X;
    if (sc.sound === 'blips') this.bloops.step(synth, dt, k);
    else if (sc.sound === 'laser') {
      this.blipT -= dt;
      while (this.blipT <= 0) {
        this.blipT += 1 / (3 + 6 * k);
        synth.sweep({ freq: 620, freqEnd: 140, dur: 0.11, wave: 'triangle', gain: 0.03 });
      }
    } else if (sc.sound === 'hits') {
      const n = sc.draw === dinoImpact ? Math.floor((lt - 0.9) / 2.4) + 1 : sc.draw === rockHits || sc.draw === earthHits ? Math.floor((lt - 0.1) / 0.3) + 1 : hitsBy(lt, k);
      if (n > this.hitsHeard) {
        if (this.hitsHeard > 0 || this.sceneT > 0.02) synth.rumble(34 + (n % 4) * 3, 0.55 + 0.3 * k, Math.min(0.9, (0.34 + 0.03 * n) * bx), 100);
        this.hitsHeard = n;
      }
    }
    const sh = stormHits(this.stormT, heat);
    this.thumpT -= dt;
    if (sh > this.stormHeard) {
      this.stormHeard = sh;
      if (this.thumpT <= 0) {
        this.thumpT = 0.11;
        synth.bassStatic((0.08 + 0.12 * heat) * bx, 0.07);
      }
    }
    const from = KNOBS.DEMO_REEL.RUMBLE_FROM;
    if (heat >= from) {
      const g = (heat - from) / (1 - from);
      this.rumbleT -= dt;
      if (this.rumbleT <= 0) {
        this.rumbleT = KNOBS.DEMO_REEL.RUMBLE_S0 + (KNOBS.DEMO_REEL.RUMBLE_S - KNOBS.DEMO_REEL.RUMBLE_S0) * g;
        synth.rumble(30 + (Math.floor(this.stormT * 5) % 3) * 2, 0.6, Math.min(0.9, (0.25 + 0.45 * g) * bx), 110);
      }
    }
  }

  /** On every cut: a soft low pulse, the scene's opening sound, and sometimes a voice line. */
  private onCut(): void {
    const sc = SCENES[this.sceneIdx];
    const sfx = this.sfx;
    if (!sc || !sfx) return;
    sfx.synth.softPulse(62, 0.1, 0.05, 0.01);
    if (sc.sound === 'launch') sfx.synth.rumble(46, 0.7, 0.3 * KNOBS.DEMO_REEL.BASS_X, 160);
    if (sc.sound === 'warp' && sc.draw === wormhole) sfx.synth.sweep({ freq: 60, freqEnd: 420, cutoff: 300, cutoffEnd: 1400, dur: 1.2, wave: 'sawtooth', gain: 0.04 });
    if (!this.atFloor() && hash01(this.pass, this.sceneIdx, 77) < 0.55) sfx.voice.say(VOICES[Math.floor(hash01(this.pass, this.sceneIdx, 78) * VOICES.length)] ?? 'WARP', true);
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
      this.stormT += dt;
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
        this.advance();
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

  /** Next shot; pass 1 skips the shots marked `once`, and passing the end of the reel starts the next pass. */
  private advance(): void {
    do {
      this.sceneIdx++;
      if (this.sceneIdx >= SCENES.length) {
        this.sceneIdx = 0;
        this.pass++;
      }
    } while (this.pass === 1 && SCENES[this.sceneIdx]?.once);
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
      drawText(s, `PASS ${this.pass + 1}   X${(this.pass === 0 ? 1 : 1 / KNOBS.DEMO_REEL.REPEAT_X / (this.pass === 1 ? 1 : 0.4)).toFixed(1)}   REALITIES ${this.pass === 0 && this.sceneIdx < SCENES.findIndex((x) => x.draw === split4) ? 1 : 16}`, s.width - 16, 10, 9, { align: 'right', color: ui.dim, glow: 0 });
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
