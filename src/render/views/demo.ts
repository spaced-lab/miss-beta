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
//       realities and then 16; quiet low bleeps and bloops instead of high clicks; the voice a touch quieter. Third
//       pass: the 16 realities keep running (each cell cuts between simulations on its own clock), merge back to one,
//       and the second pass warps again into 4, 16 and 32; no hit is replayed; a longer blur of mayhem with the storm
//       past full heat; the teletype follows the voice sentence by sentence.
// HOW:  A reel of shots (render/demoScenes.ts, render/demoFuture.ts), each a pure function of local time and an
//       intensity. A burst is one scene cut into several 0.36 s shots, each starting at a different local time so
//       every shot lands a different hit. The reel is two explicit passes (PASS0, then pass1() at DEMO_REEL.REPEAT_X
//       of each length from later local times), then BLUR_CUTS cuts at the floor through MAYHEM (the blur), then
//       PAUSE_S of black and silence, then the window types with a synth click per character, each sentence across
//       the span the voice speaks it (FINALE_CUES; TYPE_CPS when the voice is off or never starts). `heat` is montage time over the planned total (0..1): it drives the scenes' intensity, the hit
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
import { dcPlanets, dinoImpact, dinoLaunch, earthHits, laserFleet, laserMap, merge, mothership, rockHits, salvo, solar, split16, split32, split4, ufo, wormhole, worldsSalvo } from '../demoFuture';
import { hitsBy, impacts, racks, type DemoScene } from '../demoScenes';
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
  /** Seconds on screen (never under the photosensitive floor). */
  len: number;
  sound: Sound;
  /** Local time the shot starts from. */
  t0: number;
  /** Realities on screen from this shot on (the header counter); unset keeps the last count. */
  worlds?: number;
}

/** One shot of a scene. */
function shot(draw: DemoScene, caption: readonly [string, string], len: number, sound: Sound, t0: number, worlds?: number): MontageScene {
  return worlds === undefined ? { draw, caption, len, sound, t0 } : { draw, caption, len, sound, t0, worlds };
}

/**
 * A burst: `n` 0.36 s shots of one scene, 2.9 s of local time apart, so each lands a different hit; `from` numbers
 * the first shot, so a later burst of the same scene goes on to new hits instead of replaying the old ones.
 */
function burst(draw: DemoScene, captions: readonly (readonly [string, string])[], n: number, from = 0): MontageScene[] {
  return Array.from({ length: n }, (_, j) => shot(draw, captions[(j + from) % captions.length] ?? ['', ''], 0.36, 'hits', 0.12 + (j + from) * 2.9));
}

/**
 * The realities run: shots of one split scene on a single continuous local clock (each starts where the last
 * ended), so the cells keep running across the cuts instead of restarting.
 */
function run(draw: DemoScene, caps: readonly (readonly [string, string])[], lens: readonly number[], worlds: number): MontageScene[] {
  let t0 = 0;
  return lens.map((len, j) => {
    const sh = shot(draw, caps[j] ?? ['', ''], len, j === 0 ? 'warp' : 'blips', t0, j === 0 ? worlds : undefined);
    t0 += len;
    return sh;
  });
}

const HIT_CAPS = [['HIT', 'KINETIC IMPACTOR ON TARGET'], ['HIT', 'AND AGAIN'], ['HIT', 'AND AGAIN'], ['HIT', 'IT IS STILL THERE'], ['HIT', 'STILL THERE'], ['HIT', 'HIT IT AGAIN']] as const;
const HOME_CAPS = [['HOME: HIT', 'SIMULATION 1 OF MANY'], ['HOME: HIT', 'SIMULATION 2'], ['HOME: HIT', 'SIMULATION 3'], ['HOME: HIT', 'SIMULATION 4'], ['HOME: HIT', 'WE NEED ANOTHER WAY'], ['HOME: HIT', 'SIMULATION 6'], ['HOME: HIT', 'SIMULATION 7']] as const;

const WORMHOLE_CAP = ['TIME WARP: WORMHOLE OPEN', 'NANOBOTS PUSHED BACK THROUGH THE THROAT TO BUILD TOMORROW\'S TECH IN THE PAST'] as const;
const SPLIT4_CAP = ['REALITIES: 4', 'ONE WORMHOLE  /  FOUR TIMELINES  /  ALL DIFFERENT'] as const;
const DINO_IMPACT_CAP = ['ARRIVAL: 66 MILLION YEARS AGO', 'WRONG WINDOW  /  OBSERVERS ON SITE'] as const;
const DINO_LAUNCH_CAP = ['TECHNOLOGY TRANSFER: EARLY', 'THE PAD CREW HAS QUESTIONS  /  ONE OF THEM IS SUITED UP'] as const;
const UFO_CAP = ['OUTSIDE HELP HAS ARRIVED', 'CONTRACTOR: GRAY  /  REFERENCES: NONE  /  RESULTS: EXCELLENT  /  COW: UNEXPLAINED'] as const;
const MOTHER_CAP = ['THE NEIGHBOURS BROUGHT THE BIG ONE', 'MOTHERSHIP ON STATION  /  EVERY WINDOW WAVING'] as const;

/** Pass 1: every scene at its own length, the hit bursts, the warp into 4 and 16 running realities, back to one. */
const PASS0: readonly MontageScene[] = [
  shot(racks, ['DATA CENTRES: ALL OF THEM', 'RACKS ONLINE  ##########  INFERENCE AT FULL LOAD'], 0.6, 'blips', 0, 1),
  shot(dcPlanets, ['DATA CENTRES: OFF-WORLD', 'LUNAR FARM  /  OLYMPUS RACKS  /  EUROPA COLD STORE  /  JOVIAN RING'], 0.9, 'blips', 0.4),
  shot(salvo, ['LAUNCH CADENCE: CONTINUOUS', 'EVERY PAD  /  EVERY DESIGN  /  NO WAITING FOR WEATHER'], 1, 'launch', 0.5),
  shot(worldsSalvo, ['LAUNCHES FROM EVERY WORLD WE HAVE', 'LUNA  /  MARS  /  EUROPA'], 0.9, 'launch', 0.3),
  shot(laserMap, ['PLANETARY LASER GRID: ARMED', 'FIRING FROM THE MAP  /  AIMING: AUTOMATIC'], 0.9, 'laser', 0.6),
  shot(laserFleet, ['EVERY LASER WE OWN', 'PLANETS  /  MOON  /  SATELLITES  /  STATION  /  ALL FIRING'], 1.5, 'laser', 1),
  shot(solar, ['SOLAR ERUPTIONS: STEERED', 'GUIDE SATELLITES ALIGNED  /  PLASMA ON TARGET'], 0.9, 'laser', 0.5),
  ...burst(rockHits, HIT_CAPS, 4),
  ...burst(earthHits, HOME_CAPS, 5),
  shot(wormhole, WORMHOLE_CAP, 1.2, 'warp', 1),
  shot(split4, SPLIT4_CAP, 1.8, 'warp', 0, 4),
  ...run(split16, [
    ['REALITIES: 16', 'EVERY TIMELINE SPLITS AGAIN  /  SIXTEEN SIMULATIONS RUNNING'],
    ['SIXTEEN SIMULATIONS: ALL STILL RUNNING', 'NO TWO ALIKE  /  OUTCOMES DIVERGING'],
    ['SIMULATIONS: DIVERGING', 'SOME OF THEM HAVE DINOSAURS  /  ONE HAS A COW'],
  ], [1.95, 1.7, 1.5], 16),
  shot(merge, ['REALITIES: 1', 'COLLAPSED BACK TO THIS ONE  /  FOR NOW'], 0.95, 'warp', 0, 1),
  shot(dinoImpact, DINO_IMPACT_CAP, 1.7, 'hits', 0.7),
  shot(dinoLaunch, DINO_LAUNCH_CAP, 1.3, 'launch', 0.3),
  shot(ufo, UFO_CAP, 1.6, 'none', 0.8),
  shot(mothership, MOTHER_CAP, 1.5, 'laser', 0.6),
];

/**
 * Pass 2, faster: each scene at DEMO_REEL.REPEAT_X of its length from a later moment, new hits in the bursts, the
 * weird arrivals, then (owner 2026-10-20: "reset back to one reality then split into 4 with warp, then 16 again,
 * maybe 32") the warp again into 4, 16 and 32 running realities.
 */
function pass1(): MontageScene[] {
  const x = KNOBS.DEMO_REEL.REPEAT_X;
  const fast = (sc: MontageScene | undefined, dt: number): MontageScene[] => (sc ? [{ ...sc, len: sc.len * x, t0: sc.t0 + dt }] : []);
  return [
    ...PASS0.slice(0, 7).flatMap((sc) => fast(sc, 1.3)),
    ...burst(rockHits, HIT_CAPS, 2, 4),
    ...burst(earthHits, HOME_CAPS, 2, 5),
    ...fast(PASS0.find((sc) => sc.draw === dinoImpact), 0.6),
    ...fast(PASS0.find((sc) => sc.draw === ufo), 1.2),
    ...fast(PASS0.find((sc) => sc.draw === mothership), 1.4),
    ...fast(PASS0.find((sc) => sc.draw === dinoLaunch), 0.9),
    shot(wormhole, ['TIME WARP: AGAIN', 'DEEPER THIS TIME'], 0.8, 'warp', 2),
    shot(split4, SPLIT4_CAP, 1.2, 'warp', 0, 4),
    ...run(split16, [['REALITIES: 16', 'AGAIN  /  ALL STILL RUNNING']], [1.4], 16),
    ...run(split32, [
      ['REALITIES: 32', 'EVERY ONE OF THEM SPLITS AGAIN'],
      ['THIRTY-TWO SIMULATIONS RUNNING', 'NONE OF THEM AGREE  /  ALL OF THEM ARE TRYING'],
    ], [1.8, 1.6], 32),
  ];
}

/**
 * The blur: BLUR_CUTS shots at the floor through the loudest scenes, each pass of the list from later local times so
 * no hit repeats (owner 2026-10-20: "a little longer rumble part and mayhem").
 */
const MAYHEM: readonly MontageScene[] = [
  shot(earthHits, ['HOME: HIT', ''], 0, 'hits', 40),
  shot(rockHits, ['HIT', ''], 0, 'hits', 40),
  shot(laserFleet, ['ALL FIRING', ''], 0, 'laser', 3),
  shot(split16, ['REALITIES: 16', ''], 0, 'blips', 6),
  shot(mothership, ['THE BIG ONE', ''], 0, 'laser', 2),
  shot(impacts, ['EVERY ROCK', ''], 0, 'hits', 4),
  shot(worldsSalvo, ['EVERY WORLD', ''], 0, 'launch', 3),
  shot(dinoImpact, ['66 MILLION YEARS AGO', ''], 0, 'hits', 3.1),
  shot(solar, ['STEERED', ''], 0, 'laser', 2),
  shot(split32, ['REALITIES: 32', ''], 0, 'blips', 8),
];

/** Lines the montage throws in; each new one cuts the last one off (the voice plays the newest). */
const VOICES: readonly VoiceId[] = ['LAUNCHING', 'INTERCEPT', 'DEFLECTED', 'WARP', 'THREAT_DETECTED', 'IMPACT_IMMINENT', 'FRAGMENTS', 'PLAN_COMMITTED', 'RESEARCHING', 'HIT'];

/**
 * Where each recorded voice speaks the finale's three sentences, [start, end] s into the clip, measured from the
 * .ogg files with ffmpeg silencedetect (-35 dB, 0.18 s) on 2026-10-20; where a voice runs two sentences together the
 * boundary is set by the text's share of the run. The teletype types each sentence across its own span, so the
 * text keeps pace with the voice (owner 2026-10-20: "the last sentence speaks just before it is typed").
 */
const FINALE_CUES: Readonly<Record<string, readonly (readonly [number, number])[]>> = {
  computer: [[0.43, 1.31], [1.97, 4.9], [5.45, 9.37]],
  female: [[0.34, 1.17], [1.41, 4.12], [4.68, 7.54]],
  mainframe: [[0.38, 1.15], [1.2, 4.45], [4.99, 8.54]],
  male: [[0.34, 1.0], [1.05, 3.95], [4.4, 7.29]],
  narrator: [[0.32, 1.35], [1.71, 4.79], [5.24, 8.77]],
  radio: [[0.35, 1.18], [1.56, 4.14], [4.65, 7.56]],
  terminal: [[0.38, 1.23], [1.66, 4.46], [4.98, 8.21]],
  toy: [[0.42, 1.32], [1.8, 4.58], [5.07, 8.3]],
};

/** The text starts each sentence this far ahead of the voice, s. */
const TYPE_LEAD_S = 0.06;

/**
 * Characters typed `t` s into the voice clip: sentence j's characters spread evenly over cues[j], all of an earlier
 * sentence typed before a later one starts. Example: before cues[0][0] - TYPE_LEAD_S nothing; at cues[2][1] all.
 */
export function typedAt(t: number, cues: readonly (readonly [number, number])[], text = FINALE_TEXT): number {
  const ends: number[] = [];
  for (let i = 0; i < text.length; i++) if (text[i] === '.' && text[i + 1] === ' ') ends.push(i + 2);
  ends.push(text.length);
  let typed = 0;
  let c0 = 0;
  for (let j = 0; j < ends.length; j++) {
    const c1 = ends[j] ?? text.length;
    const cue = cues[Math.min(j, cues.length - 1)];
    if (!cue) break;
    const f = Math.max(0, Math.min(1, (t + TYPE_LEAD_S - cue[0]) / Math.max(0.1, cue[1] - cue[0])));
    if (f <= 0) break;
    typed = c0 + Math.round((c1 - c0) * f);
    c0 = c1;
  }
  return typed;
}

export class DemoScreen implements Screen {
  private readonly reel: readonly MontageScene[] = [...PASS0, ...pass1()];
  private t = 0;
  private stage: 'montage' | 'pause' | 'finale' = 'montage';
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
  private worlds = 1;
  /** Seconds the typing has waited for the voice to start; null once it follows the voice or the clock. */
  private typeFrom: number | null = null;
  private doneT = -1;
  private bloops = new Bloops();

  constructor(private readonly s: Surface, private readonly keys: Input, private readonly router: Router, private readonly sfx: UiSfx | null = null, private readonly settings: { reduceMotion: boolean } = { reduceMotion: false }) {}

  enter(): void {
    this.t = 0;
    this.stage = 'montage';
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
    this.worlds = 1;
    this.typeFrom = null;
    this.doneT = -1;
  }
  exit(): void {}

  private floor(): number {
    return Math.max(KNOBS.DEMO_MONTAGE.MIN_S, this.settings.reduceMotion ? KNOBS.DEMO_MONTAGE.CALM_MIN_S : KNOBS.DEMO_MONTAGE.SAFE_MIN_S);
  }

  /** The shot at reel index i: the two passes, then the blur cycling MAYHEM from later local times each round. */
  private shotAt(i: number): MontageScene | undefined {
    if (i < this.reel.length) return this.reel[i];
    const b = i - this.reel.length;
    const sc = MAYHEM[b % MAYHEM.length];
    return sc ? { ...sc, t0: sc.t0 + Math.floor(b / MAYHEM.length) * 1.7 } : undefined;
  }

  /** Pass 3 is the blur. */
  private atFloor(): boolean {
    return this.sceneIdx >= this.reel.length;
  }

  /**
   * NOTE: photosensitive safety (WCAG 2.3.1, docs/WARNINGS.md): a full-screen cut is a flash, so the montage never
   * cuts more than three times a second (SAFE_MIN_S), and once a second with REDUCE MOTION.
   */
  private lenOf(sc: MontageScene | undefined, blur: boolean): number {
    return blur ? this.floor() : Math.max(this.floor(), sc?.len ?? 1);
  }
  private sceneLen(): number {
    return this.lenOf(this.shotAt(this.sceneIdx), this.atFloor());
  }

  /** The planned montage length to the pause, s (both passes plus the blur). */
  private plan(): number {
    let sum = KNOBS.DEMO_MONTAGE.BLUR_CUTS * this.floor();
    for (const sc of this.reel) sum += this.lenOf(sc, false);
    return sum;
  }

  /** How far into the montage, 0..1, by the clock. Drives the intensity, the hit storm and the rumble bed. */
  private heat(): number {
    return Math.min(1, this.stormT / this.plan());
  }

  /** The storm's heat: the montage's, pushed past 1 through the blur (the mayhem before the pause). */
  private stormHeat(): number {
    return this.heat() + (this.atFloor() ? 0.45 * Math.min(1, this.blurCuts / KNOBS.DEMO_MONTAGE.BLUR_CUTS) : 0);
  }

  /** Intensity 0..1 for the scenes: 0.35 at the start, full by the warp. */
  private intensity(): number {
    return Math.min(1, 0.35 + this.heat() * 1.4);
  }

  private localT(): number {
    return this.sceneT + (this.shotAt(this.sceneIdx)?.t0 ?? 0);
  }

  /** Per-scene sound, a thump per storm hit (at most one every 0.11 s), and the rumble bed from RUMBLE_FROM on. */
  private sounds(dt: number): void {
    const synth = this.sfx?.synth;
    const sc = this.shotAt(this.sceneIdx);
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
    const sh = stormHits(this.stormT, this.stormHeat());
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

  /** On every cut: a soft low pulse, the scene's opening sound, and sometimes a voice line; in the blur a deep hit. */
  private onCut(): void {
    const sc = this.shotAt(this.sceneIdx);
    const sfx = this.sfx;
    if (sc?.worlds !== undefined) this.worlds = sc.worlds;
    if (!sc || !sfx) return;
    sfx.synth.softPulse(62, 0.1, 0.05, 0.01);
    if (sc.sound === 'launch') sfx.synth.rumble(46, 0.7, 0.3 * KNOBS.DEMO_REEL.BASS_X, 160);
    if (sc.draw === wormhole) sfx.synth.sweep({ freq: 60, freqEnd: 420, cutoff: 300, cutoffEnd: 1400, dur: 1.2, wave: 'sawtooth', gain: 0.04 });
    if (sc.worlds !== undefined && sc.worlds > 1) sfx.synth.sweep({ freq: 90, freqEnd: 30, cutoff: 500, cutoffEnd: 120, dur: 0.6, wave: 'sawtooth', gain: 0.05 });
    if (this.atFloor()) sfx.synth.rumble(28 + (this.blurCuts % 3) * 2, 0.7, Math.min(0.9, 0.5 * KNOBS.DEMO_REEL.BASS_X), 90);
    else if (hash01(this.sceneIdx, 3, 77) < 0.55) sfx.voice.say(VOICES[Math.floor(hash01(this.sceneIdx, 3, 78) * VOICES.length)] ?? 'WARP', true);
  }

  /** Characters the teletype should show by now: following the voice clip where its cues are known, else TYPE_CPS. */
  private typeTarget(): number {
    const v = this.sfx?.voice;
    const cues = v && v.mode !== 'OFF' ? FINALE_CUES[v.mode.toLowerCase()] : undefined;
    const cps = Math.floor((this.stageT - (this.typeFrom ?? 0)) * KNOBS.DEMO_MONTAGE.TYPE_CPS);
    if (!v || !cues) return cps;
    const cur = v.current;
    // NOTE: follow the clip from when it actually started (its load can lag); if it has not started within 1 s,
    // type by the clock from there instead of waiting on a voice that may never come.
    if (cur?.id === 'FINALE') return typedAt(performance.now() / 1000 - cur.at, cues);
    if (this.typeFrom === null && this.stageT > 1) this.typeFrom = this.stageT;
    return this.typeFrom === null ? 0 : cps;
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
          this.sfx?.voice.preload('FINALE');
          return;
        }
        this.sceneIdx++;
        this.onCut();
      }
    } else if (this.stage === 'pause') {
      if (this.stageT >= KNOBS.DEMO_MONTAGE.PAUSE_S) {
        this.stage = 'finale';
        this.stageT = 0;
        this.sfx?.voice.say('FINALE', true);
      }
    } else {
      const want = Math.min(FINALE_TEXT.length, this.typeTarget());
      while (this.typed < want) {
        const ch = FINALE_TEXT[this.typed] ?? ' ';
        this.typed++;
        if (ch !== ' ') this.sfx?.synth.tick({ freq: 1400 + (this.typed % 5) * 90, dur: 0.012, wave: 'square', gain: 0.025 });
      }
      if (this.typed >= FINALE_TEXT.length && this.doneT < 0) this.doneT = this.stageT;
      if (this.doneT >= 0 && this.stageT > this.doneT + 1.5 && k.anyKeyPressed()) this.router.go('title');
    }
  }

  render(): void {
    const s = this.s;
    s.clear();
    const ui = uiColors(s.palette, true);
    if (this.stage === 'montage') {
      const scene = this.shotAt(this.sceneIdx);
      if (scene) scene.draw(s, this.localT(), ui, this.intensity());
      // Hits pile up over every scene as the montage heats up.
      hitStorm(s, this.stormT, this.stormHeat(), 4040);
      const cap = scene?.caption;
      if (cap) {
        drawText(s, cap[0], s.width / 2, 28, Math.min(22, s.width / 40), { align: 'center', color: ui.title, glow: 1.6 });
        drawText(s, cap[1], s.width / 2, s.height - 48, 11, { align: 'center', color: ui.text, glow: 0.6 });
      }
      const pass = this.sceneIdx < PASS0.length ? 0 : this.atFloor() ? 2 : 1;
      drawText(s, `PASS ${pass + 1}   X${(pass === 0 ? 1 : 1 / KNOBS.DEMO_REEL.REPEAT_X / (pass === 1 ? 1 : 0.4)).toFixed(1)}   REALITIES ${this.worlds}`, s.width - 16, 10, 9, { align: 'right', color: ui.dim, glow: 0 });
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
    if (this.doneT >= 0 && this.stageT > this.doneT + 1.5) drawText(s, 'PRESS ANY KEY', s.width / 2, y + h + 20, 11, { align: 'center', color: green, glow: 0.6, alpha: 0.6 + 0.4 * Math.sin(this.t * 4) });
  }
}
