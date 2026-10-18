// WHAT: SUPER-DUPER-DEMO finale (IDEAS 20, owner 2026-10-18): after 100 self-played games, a montage that runs
//       faster and faster, a pause, then a green teletype window with the closing line (and the robot voice).
// WHY:  The demo's punchline. Every montage line is FICTION in character (GAME_PLAN 30 deadpan): nothing here is
//       a claim about real computers, power grids or time travel, and none of it is a feature of the game.
// HOW:  Six scenes drawn as pure functions of local time. Pass n shows each scene for SCENE_S0 x SHRINK^n seconds
//       until the scenes are a blur (MIN_S), then PAUSE_S of black, then the window types at TYPE_CPS with a
//       synth click per character. Esc or any key after the text ends returns to the title.
// LORE: G1 (how to play)

import type { UiSfx } from '../../audio/ui';
import type { Router, Screen } from '../../game/screen';
import { Rng } from '../../sim/rng';
import type { Input } from '../../ui/input';
import coastline from '../../config/coastline.json';
import type { Surface } from '../canvas';
import { uiColors, withAlpha } from '../palettes';
import { drawText, wrapText } from '../vectorFont';
import { wireSphere } from '../wire';

/** Montage pacing [knob]: first scene length (s), shrink per pass, the blur floor, the pause, typing speed. */
export const DEMO_MONTAGE = { SCENE_S0: 3.2, SHRINK: 0.62, MIN_S: 0.09, BLUR_PASSES: 2, PAUSE_S: 2.4, TYPE_CPS: 16 } as const;

/** The closing line (owner's text, spelling checked). */
export const FINALE_TEXT = 'STRANGE GAME. THE ONLY OPTION IS TO KEEP WORKING TO PROTECT YOUR PLANET. SHALL WE PLAY A GAME OF CHESS, OR WILL YOU HELP US SAVE THE WORLD?';

/** Teaser lines for tech that is not in the game (FICTION). */
const HINTS = ['STELLAR LIFTING', 'PLANETARY ENGINES', 'CAUSALITY FIREWALL', 'MATRIOSHKA BRAIN V0.1', 'VACUUM STABILITY INSURANCE', 'THE SECOND MOON PROTOCOL', 'KARDASHEV III PREVIEW', 'ORBITAL RING (BETA)'];

type Scene = (s: Surface, t: number, ui: ReturnType<typeof uiColors>) => void;

/** Lines on screen per scene: headline plus a status line. */
const CAPTIONS: readonly [string, string][] = [
  ['DATA CENTRES: ALL OF THEM', 'RACKS ONLINE  ##########  INFERENCE AT FULL LOAD'],
  ['SUPERINTELLIGENCE ACTIVATIONS: GLOBAL', 'NODES WAKING  /  CONSENSUS FORMING  /  PLANET-SCALE MODEL'],
  ['ALL POWER ROUTED TO SIMULATION', 'GRIDS REASSIGNED  /  STREETLIGHTS DIMMED  /  KETTLES ON HOLD'],
  ['GLOBAL AND OFF-WORLD CPU DEDICATED TO INFERENCE AND LEARNING', 'LUNAR FARM  /  MARS RELAY  /  ORBITAL RING'],
  ['TIME PORTAL OPEN', 'NANOBOTS PUSHED BACK THROUGH THE WORMHOLE TO BUILD TOMORROW\'S TECH IN THE PAST'],
  ['UNLOCKING', 'FEATURES NOT IN THIS GAME'],
];

export class DemoScreen implements Screen {
  private t = 0;
  private stage: 'montage' | 'pause' | 'finale' = 'montage';
  private pass = 0;
  private sceneIdx = 0;
  private sceneT = 0;
  private blurPasses = 0;
  private typed = 0;
  private stageT = 0;
  private readonly scenes: Scene[];

  constructor(private readonly s: Surface, private readonly keys: Input, private readonly router: Router, private readonly sfx: UiSfx | null = null) {
    this.scenes = [racks, worldMap, power, offWorld, portal, hints];
  }

  enter(): void {
    this.t = 0;
    this.stage = 'montage';
    this.pass = 0;
    this.sceneIdx = 0;
    this.sceneT = 0;
    this.blurPasses = 0;
    this.typed = 0;
    this.stageT = 0;
  }
  exit(): void {}

  private sceneLen(): number {
    return Math.max(DEMO_MONTAGE.MIN_S, DEMO_MONTAGE.SCENE_S0 * Math.pow(DEMO_MONTAGE.SHRINK, this.pass));
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
      if (this.sceneT >= this.sceneLen()) {
        this.sceneT = 0;
        this.sceneIdx++;
        // A blip per cut, a little higher every pass.
        this.sfx?.synth.tick({ freq: 180 + 60 * this.pass, dur: 0.03, wave: 'square', gain: 0.03 });
        if (this.sceneIdx >= this.scenes.length) {
          this.sceneIdx = 0;
          this.pass++;
          if (this.sceneLen() <= DEMO_MONTAGE.MIN_S && ++this.blurPasses > DEMO_MONTAGE.BLUR_PASSES) {
            this.stage = 'pause';
            this.stageT = 0;
          }
        }
      }
    } else if (this.stage === 'pause') {
      if (this.stageT >= DEMO_MONTAGE.PAUSE_S) {
        this.stage = 'finale';
        this.stageT = 0;
        this.sfx?.voice.say('FINALE', true);
      }
    } else {
      const want = Math.min(FINALE_TEXT.length, Math.floor(this.stageT * DEMO_MONTAGE.TYPE_CPS));
      while (this.typed < want) {
        const ch = FINALE_TEXT[this.typed] ?? ' ';
        this.typed++;
        if (ch !== ' ') this.sfx?.synth.tick({ freq: 1400 + (this.typed % 5) * 90, dur: 0.012, wave: 'square', gain: 0.025 });
      }
      if (this.typed >= FINALE_TEXT.length && this.stageT > FINALE_TEXT.length / DEMO_MONTAGE.TYPE_CPS + 1.5 && k.anyKeyPressed()) this.router.go('title');
    }
  }

  render(): void {
    const s = this.s;
    s.clear();
    const ui = uiColors(s.palette, true);
    if (this.stage === 'montage') {
      const scene = this.scenes[this.sceneIdx];
      if (scene) scene(s, this.t, ui);
      const cap = CAPTIONS[this.sceneIdx];
      if (cap) {
        drawText(s, cap[0], s.width / 2, 28, Math.min(22, s.width / 40), { align: 'center', color: ui.title, glow: 1.6 });
        drawText(s, cap[1], s.width / 2, s.height - 48, 11, { align: 'center', color: ui.text, glow: 0.6 });
      }
      drawText(s, `PASS ${this.pass + 1}   X${(1 / Math.pow(DEMO_MONTAGE.SHRINK, this.pass)).toFixed(1)}`, s.width - 16, 10, 9, { align: 'right', color: ui.dim, glow: 0 });
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
    if (this.typed >= FINALE_TEXT.length && this.stageT > FINALE_TEXT.length / DEMO_MONTAGE.TYPE_CPS + 1.5) drawText(s, 'PRESS ANY KEY', s.width / 2, y + h + 20, 11, { align: 'center', color: green, glow: 0.6, alpha: 0.6 + 0.4 * Math.sin(this.t * 4) });
  }
}

/** Rows of racks with blinking LEDs; the blink pattern is a hash of (rack, led, time step). */
const racks: Scene = (s, t, ui) => {
  const cols = Math.max(6, Math.floor(s.width / 90));
  const rw = (s.width - 80) / cols;
  const rh = (s.height - 160) / 2;
  const step = Math.floor(t * 12);
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = 40 + c * rw + 6;
      const y0 = 80 + r * rh + 6;
      const w = rw - 12;
      const h = rh - 12;
      s.stroke([x0, y0, x0 + w, y0, x0 + w, y0 + h, x0, y0 + h], { closed: true, color: ui.dim, glow: 0 });
      for (let i = 0; i < 36; i++) {
        const hsh = Math.sin((c * 31 + r * 17 + i * 7 + step * 13) * 12.9898) * 43758.5453;
        const on = hsh - Math.floor(hsh) > 0.4;
        const lx = x0 + 8 + (i % 3) * (w - 16) / 2;
        const ly = y0 + 10 + Math.floor(i / 3) * (h - 20) / 11;
        if (on) s.circle(lx, ly, 2.6, { color: i % 5 === 0 ? ui.title : i % 7 === 0 ? ui.head : ui.sel, glow: 1.8 });
        else s.dot(lx, ly, 1.2, ui.dim, 0.8);
      }
    }
  }
};

/** Equirectangular coastlines with activation rings spreading from seeded points. */
const worldMap: Scene = (s, t, ui) => {
  const mw = Math.min(s.width - 60, (s.height - 140) * 2);
  const mh = mw / 2;
  const x0 = (s.width - mw) / 2;
  const y0 = (s.height - mh) / 2 + 10;
  const px = (lon: number): number => x0 + ((lon + 180) / 360) * mw;
  const py = (lat: number): number => y0 + ((90 - lat) / 180) * mh;
  for (const line of (coastline as { lines: number[][] }).lines) {
    const pts: number[] = [];
    for (let i = 0; i + 1 < line.length; i += 2) pts.push(px(line[i] as number), py(line[i + 1] as number));
    s.stroke(pts, { color: ui.sub, glow: 0.3 });
  }
  const rng = new Rng(2026);
  const n = Math.min(60, Math.floor(t * 20) + 8);
  for (let i = 0; i < 60; i++) {
    const lon = rng.float(-125, 145);
    const lat = rng.float(-40, 60);
    if (i >= n) continue;
    const age = (t * 1.7 + i * 0.37) % 1;
    s.dot(px(lon), py(lat), 2.5, ui.title, 1);
    s.circle(px(lon), py(lat), 3 + age * 22, { color: ui.text, glow: 0.8, alpha: 1 - age });
  }
};

/** Region bars filling to 100 % and a flow arrow into SIM. */
const power: Scene = (s, t, ui) => {
  const regions = ['NORTH AMERICA', 'SOUTH AMERICA', 'EUROPE', 'AFRICA', 'ASIA', 'OCEANIA', 'ANTARCTIC STATION 4'];
  const x0 = s.width * 0.18;
  const bw = s.width * 0.5;
  regions.forEach((r, i) => {
    const y = 100 + i * ((s.height - 220) / regions.length);
    const f = Math.min(1, t * 0.5 + i * 0.08 - Math.floor(t * 0.5 + i * 0.08) + 0.4);
    drawText(s, r, x0 - 12, y, 11, { align: 'right', color: ui.text, glow: 0.4 });
    s.stroke([x0, y + 5, x0 + bw, y + 5], { color: ui.dim, glow: 0 });
    s.stroke([x0, y + 5, x0 + bw * f, y + 5], { color: ui.title, glow: 1.2, width: 4 });
    drawText(s, `${Math.round(f * 100)}% -> SIM`, x0 + bw + 14, y, 11, { color: ui.sub, glow: 0.4 });
  });
};

/** Earth, Moon and Mars with compute links and an orbital ring of nodes. */
const offWorld: Scene = (s, t, ui) => {
  const cx = s.width / 2;
  const cy = s.height / 2 + 10;
  const R = Math.min(s.width, s.height) * 0.14;
  wireSphere(s, cx, cy, R, t * 0.6, 5, 8, ui.text);
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2 + t * 0.4;
    s.dot(cx + Math.cos(a) * R * 1.6, cy + Math.sin(a) * R * 0.45, 2, ui.title, 0.9);
  }
  const moon = { x: cx + R * 3.2 * Math.cos(t * 0.3), y: cy - R * 1.9 };
  const mars = { x: cx - R * 3.4, y: cy + R * 0.9 };
  wireSphere(s, moon.x, moon.y, R * 0.3, t, 3, 6, ui.sub);
  wireSphere(s, mars.x, mars.y, R * 0.4, -t * 0.8, 3, 6, ui.head);
  for (const b of [moon, mars]) {
    const k = (t * 1.5) % 1;
    s.stroke([cx, cy, b.x, b.y], { color: ui.dim, glow: 0 });
    s.dot(cx + (b.x - cx) * k, cy + (b.y - cy) * k, 3, ui.sel, 1);
  }
};

/** A wormhole of nested ellipses with nanobots streaming into its throat. */
const portal: Scene = (s, t, ui) => {
  const cx = s.width / 2;
  const cy = s.height / 2 + 10;
  const R = Math.min(s.width, s.height) * 0.36;
  for (let i = 0; i < 14; i++) {
    const f = ((i / 14 + t * 0.35) % 1) ** 1.6;
    const r = R * (1 - f);
    s.circle(cx, cy, Math.max(2, r), { color: i % 2 ? ui.sub : ui.title, glow: 1, alpha: 0.3 + 0.7 * f });
  }
  const rng = new Rng(7);
  for (let i = 0; i < 80; i++) {
    const a0 = rng.float(0, Math.PI * 2);
    const f = (rng.next() + t * 0.6) % 1;
    const a = a0 + f * 3;
    const r = R * 1.3 * (1 - f);
    s.dot(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8, 1.8, ui.text, 1 - f * 0.5);
  }
};

/** Locked teasers scrolling past. */
const hints: Scene = (s, t, ui) => {
  HINTS.forEach((h, i) => {
    const y = 90 + i * ((s.height - 180) / HINTS.length);
    const lit = Math.floor(t * 6) % HINTS.length === i;
    drawText(s, `[LOCKED]  ${h}`, s.width / 2, y, 14, { align: 'center', color: lit ? ui.sel : ui.text, glow: lit ? 1.6 : 0.5 });
    drawText(s, 'NOT IN THIS GAME', s.width / 2, y + 24, 8, { align: 'center', color: ui.dim, glow: 0 });
  });
};
