// WHAT: SUPER-DUPER-DEMO finale (IDEAS 20, owner 2026-10-18): after the self-played games, a montage that runs
//       faster and faster, a pause, then a green teletype window with the closing line (and the robot voice).
// WHY:  The demo's punchline. Every montage line is FICTION in character (GAME_PLAN 30 deadpan): nothing here is
//       a claim about real computers, power grids or time travel, and none of it is a feature of the game.
//       Owner notes after shipping: faster, more data centres with racks growing more complex and futuristic,
//       blippy data-centre noises, clocks and dates being adjusted over and over, hit after hit with the bass
//       rumbling, a shorter time portal; the ending (blur, pause, teletype) kept exactly as it was.
// HOW:  Scenes (render/demoScenes.ts) drawn as pure functions of local time and an intensity that rises with the
//       pass. Pass n shows each scene for SCENE_S0 x SHRINK^n seconds (times the scene's share; the portal gets
//       half) until the scenes are a blur (MIN_S), then PAUSE_S of black, then the window types at TYPE_CPS with a
//       synth click per character. Esc or any key after the text ends returns to the title.
// LORE: G1 (how to play)

import { KNOBS } from '../../config/knobs';
import type { UiSfx } from '../../audio/ui';
import type { Router, Screen } from '../../game/screen';
import type { Input } from '../../ui/input';
import type { Surface } from '../canvas';
import { clocks, dcGlobe, hints, hitsBy, impacts, offWorld, portal, power, racks, worldMap, type DemoScene } from '../demoScenes';
import { uiColors, withAlpha } from '../palettes';
import { drawText, wrapText } from '../vectorFont';


/** The closing line (owner's text, spelling checked). */
export const FINALE_TEXT = 'STRANGE GAME. THE ONLY OPTION IS TO KEEP WORKING TO PROTECT YOUR PLANET. SHALL WE PLAY A GAME OF CHESS, OR WILL YOU HELP US SAVE THE WORLD?';

interface MontageScene {
  draw: DemoScene;
  /** Headline plus a status line. */
  caption: readonly [string, string];
  /** Multiple of the pass's scene length this scene gets above the floor (hits run long, the portal short). */
  share: number;
  sound: 'blips' | 'hits' | 'none';
}

const SCENES: readonly MontageScene[] = [
  { draw: racks, caption: ['DATA CENTRES: ALL OF THEM', 'RACKS ONLINE  ##########  INFERENCE AT FULL LOAD'], share: 1, sound: 'blips' },
  { draw: dcGlobe, caption: ['MORE DATA CENTRES', 'ONE EVERY FEW MINUTES  /  COOLING: OPTIMISTIC'], share: 1, sound: 'blips' },
  { draw: worldMap, caption: ['SUPERINTELLIGENCE ACTIVATIONS: GLOBAL', 'NODES WAKING  /  CONSENSUS FORMING  /  PLANET-SCALE MODEL'], share: 1, sound: 'none' },
  { draw: clocks, caption: ['TIMELINE ADJUSTMENTS', 'CALENDARS RE-RUN  /  CLOCKS RE-SYNCED  /  DATES UNDER REVIEW'], share: 1, sound: 'blips' },
  { draw: power, caption: ['ALL POWER ROUTED TO SIMULATION', 'GRIDS REASSIGNED  /  STREETLIGHTS DIMMED  /  KETTLES ON HOLD'], share: 1, sound: 'none' },
  { draw: impacts, caption: ['EVERY ROCK WE EVER MISSED', 'REPLAYED UNTIL NONE GET THROUGH'], share: 2.5, sound: 'hits' },
  { draw: offWorld, caption: ['GLOBAL AND OFF-WORLD CPU DEDICATED TO INFERENCE AND LEARNING', 'LUNAR FARM  /  MARS RELAY  /  ORBITAL RING'], share: 1, sound: 'none' },
  { draw: portal, caption: ['TIME PORTAL OPEN', 'NANOBOTS PUSHED BACK THROUGH THE WORMHOLE TO BUILD TOMORROW\'S TECH IN THE PAST'], share: 0.5, sound: 'none' },
  { draw: hints, caption: ['UNLOCKING', 'FEATURES NOT IN THIS GAME'], share: 1, sound: 'none' },
];

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
  }
  exit(): void {}

  private floor(): number {
    return Math.max(KNOBS.DEMO_MONTAGE.MIN_S, this.settings.reduceMotion ? KNOBS.DEMO_MONTAGE.CALM_MIN_S : KNOBS.DEMO_MONTAGE.SAFE_MIN_S);
  }

  /**
   * NOTE: photosensitive safety (WCAG 2.3.1, docs/WARNINGS.md): a full-screen cut is a flash, so the montage never
   * cuts more than three times a second (SAFE_MIN_S), and once a second with REDUCE MOTION. A short-share scene
   * (the portal) is still never under that floor.
   */
  private sceneLen(): number {
    // At the floor every scene gets the floor, so the blur keeps its old rhythm whatever the shares.
    if (this.atFloor()) return this.floor();
    const share = SCENES[this.sceneIdx]?.share ?? 1;
    return Math.max(this.floor(), KNOBS.DEMO_MONTAGE.SCENE_S0 * Math.pow(KNOBS.DEMO_MONTAGE.SHRINK, this.pass) * share);
  }
  private atFloor(): boolean {
    return KNOBS.DEMO_MONTAGE.SCENE_S0 * Math.pow(KNOBS.DEMO_MONTAGE.SHRINK, this.pass) <= this.floor() + 1e-9;
  }

  /** Intensity 0..1 for the scenes: rises with every pass, full once the montage is at its floor. */
  private intensity(): number {
    return Math.min(1, this.pass / 3);
  }

  /** Data-centre blips (faster each pass) and a bass hit per hit drawn, heavier as the hits pile up. */
  private sounds(dt: number): void {
    const synth = this.sfx?.synth;
    const sc = SCENES[this.sceneIdx];
    if (!synth || !sc) return;
    const k = this.intensity();
    if (sc.sound === 'blips') {
      this.blipT -= dt;
      while (this.blipT <= 0) {
        this.blipT += 1 / (14 + 22 * k);
        this.blipN++;
        synth.tick({ freq: 880 + ((this.blipN * 7) % 9) * 150, dur: 0.012, wave: 'square', gain: 0.018 });
      }
    } else if (sc.sound === 'hits') {
      const n = hitsBy(this.sceneT, k);
      if (n > this.hitsHeard) {
        this.hitsHeard = n;
        synth.rumble(34 + (n % 4) * 3, 0.5 + 0.3 * k, Math.min(0.6, 0.3 + 0.03 * n), 100);
      }
    }
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
      this.sceneT += dt;
      this.sounds(dt);
      if (this.sceneT >= this.sceneLen()) {
        this.sceneT = 0;
        this.hitsHeard = 0;
        if (this.atFloor() && ++this.blurCuts >= KNOBS.DEMO_MONTAGE.BLUR_CUTS) {
          this.stage = 'pause';
          this.stageT = 0;
          return;
        }
        this.sceneIdx++;
        // A blip per cut, a little higher every pass.
        this.sfx?.synth.tick({ freq: 180 + 60 * this.pass, dur: 0.03, wave: 'square', gain: 0.03 });
        if (this.sceneIdx >= SCENES.length) {
          this.sceneIdx = 0;
          this.pass++;
        }
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
      // Hits restart with the scene so each thump lands on a hit drawn; the rest carry on where they were.
      if (scene) scene.draw(s, scene.sound === 'hits' ? this.sceneT : this.sceneT + this.pass * 0.37, ui, this.intensity());
      const cap = scene?.caption;
      if (cap) {
        drawText(s, cap[0], s.width / 2, 28, Math.min(22, s.width / 40), { align: 'center', color: ui.title, glow: 1.6 });
        drawText(s, cap[1], s.width / 2, s.height - 48, 11, { align: 'center', color: ui.text, glow: 0.6 });
      }
      drawText(s, `PASS ${this.pass + 1}   X${(1 / Math.pow(KNOBS.DEMO_MONTAGE.SHRINK, this.pass)).toFixed(1)}`, s.width - 16, 10, 9, { align: 'right', color: ui.dim, glow: 0 });
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
