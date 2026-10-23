// WHAT: The PERIMETER minigame screen: fixed-step loop, input mapping, cheats, best score.
// WHY:  Glue between the pure sim (sim.ts), the renderer (render.ts) and the browser. Everything that
//       touches the DOM or the clock lives here so the other two files stay testable.
// HOW:  Real time is accumulated and consumed in MG.DT steps (capped per frame so a background tab does
//       not spiral). The pulse, seeker (`<`) and swarm (`>`) keys are edge-triggered here and passed as
//       booleans; a replay could feed the same Input records back into `step` and reproduce the game exactly. A game in progress is
//       autosaved to sessionStorage (every level-up, every AUTOSAVE_SECONDS, and on leaving the screen) so
//       the dev server's reload-on-change does not wipe it; the ready panel offers <SPACE> RESUME (R is an
//       alias) and <BACKSPACE> NEW GAME. Space resumes on purpose: a player still holding fire when the
//       reload lands must not wipe their game, and resuming is the harmless action. L on the ready or game-over
//       panel opens the SOUND LAB (soundLab.ts); while it is open the sim is not stepped and the game is kept.
//       Sound choices (variant per event, volume, ambient level) persist under one localStorage key, guarded.
//       Run options (modes.ts): `9` cycles the difficulty, `0` the start level; both persist under one guarded key.
//       Each difficulty keeps its own best (NORMAL keeps the original key); a run started past level 1 or cheated is
//       never ranked, replayed or saved as a daily best. `8` starts the SUPER DEMO: the bot (bot.ts) plays NORMAL from
//       level 1 at MG.DEMO_SPEED, its Input fed per step into the same `step` call the keyboard uses; it is never
//       saved or ranked, restarts itself after a game over, and ANY key except the view toggles 1, 2 and 4 ends it (back
//       to the ready panel; Escape still goes to the title). Exiting was chosen over taking over: simpler, and a demo
//       game can never leak into a best score. Screen shake is off when the main OPTIONS > REDUCE MOTION is on.
// LORE: G1 (how to play), C1 (how the game is built)

import { CheatRegistry } from '../game/cheats';
import { loadJson, loadNumber, loadSessionJson, removeSessionJson, saveJson, saveSessionJson } from '../game/persistence';
import type { Router, Screen } from '../game/screen';
import type { GlowMode, Surface } from '../render/canvas';
import type { Input as Keys } from '../ui/input';
import { botInput } from './bot';
import { MINIGAME_CHEATS } from './cheats';
import { MG, type Difficulty } from './config';
import { isRanked, newGame, nextDifficulty, nextStartLevel, type MinigameSettings } from './modes';
import { loadMinigameSettings, saveMinigameSettings } from './prefs';
import { renderMinigame } from './render';
import { drawPad, padHeld, padLayout, type PadId } from './touchPad';
import { loadTiltPrefs, saveTiltPrefs, tiltAmount, tiltPwm, TiltSensor } from './tilt';
import { onGearTab, type GearItem, type GearSpec } from '../ui/gearMenu';
import { drawTextFit } from '../render/vectorFont';
import { onBackTab } from '../ui/touchBack';
import { isSfxPrefs, SfxPlayer } from './sfx';
import { createLab, LAB_KEY, renderLab, updateLab, type LabState } from './soundLab';
import { PANEL_HITS } from './render';
import { ScreenBar } from '../ui/actionBar';
import { isSavedReplay, Player, Recorder, type SavedReplay } from './replay';
import { chaosLevel, createState, flash, fromSaved, isSavedGame, start, step, toSaved, type Input, type MinigameState } from './sim';

const BEST_KEY = 'minigame.best';
/** Best score per difficulty: NORMAL keeps the original key so existing bests stay where they were. */
export const bestKey = (d: Difficulty): string => (d === 'normal' ? BEST_KEY : `${BEST_KEY}.${d}`);
/** Difficulty and start level (modes.ts), one guarded localStorage key. */
export { SETTINGS_KEY } from './prefs';
/** View toggles that do not end the SUPER DEMO (debug HUD, glow, sound). */
const DEMO_KEEP_KEYS = ['Digit1', 'Digit2', 'Digit4'] as const;
const SOUND_KEY = 'minigame.sound';
const KIT_KEY = 'minigame.kit';
/** One key for every SOUND LAB choice (variant names per event, master volume, ambient level). */
const SFX_KEY = 'minigame.sfx';
/** sessionStorage: one tab, survives reloads, gone when the tab closes. */
const SAVE_KEY = 'minigame.save';
const AUTOSAVE_SECONDS = 5;
/** DAILY (IDEAS 6): the day's best, guarded; the seed is the date, the same for everyone. */
const DAILY_KEY = 'minigame.daily';
/** The best unassisted fresh game as (seed, collision, RLE inputs), guarded. */
const REPLAY_KEY = 'minigame.replay';
const isDaily = (v: unknown): v is { date: string; best: number } => typeof v === 'object' && v !== null && typeof (v as { date?: unknown }).date === 'string' && typeof (v as { best?: unknown }).best === 'number';
/** Today's date (local), YYYY-MM-DD. */
export const today = (): string => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
/** The daily seed: a string hash of the date, so every player gets the same field. */
export function dailySeed(date: string): number {
  let h = 2166136261;
  for (const ch of `PERIMETER-${date}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}
const GLOW_CYCLE: readonly GlowMode[] = ['understroke', 'shadow', 'none'];

export class MinigameScreen implements Screen {
  private st: MinigameState;
  private acc = 0;
  private debug = false;
  private settings: MinigameSettings = loadMinigameSettings();
  private best = loadNumber(bestKey(this.settings.difficulty), 0);
  /** SUPER DEMO running: the bot drives, nothing is saved. */
  private demo = false;
  /** Seconds since the demo game ended (the next one starts at MG.DEMO_RESTART_SECONDS). */
  private demoRestart = 0;
  private frameMs = 0;
  private lastFrame = 0;
  /** A game restored from sessionStorage, offered on the ready panel until the player picks RESUME or NEW. */
  private saved: MinigameState | null = null;
  private sinceSave = 0;
  private readonly cheats = new CheatRegistry<MinigameState>(MINIGAME_CHEATS);
  private readonly sfx = new SfxPlayer();
  private readonly labState = createLab();
  /** TILT STEER (tilt.ts): the sensor, the saved choice, the part-turn accumulator, a status line and its timer. */
  private readonly tilt = new TiltSensor();
  private tiltPrefs = loadTiltPrefs();
  private tiltAcc = 0;
  private tiltOnAt = 0;
  private note = '';
  private noteT = 0;

  constructor(private readonly s: Surface, private readonly keys: Keys, private readonly router: Router, private readonly reduceMotion: () => boolean = () => false) {
    this.st = createState(this.newSeed(), 'auto', this.settings.difficulty);
    this.sfx.enabled = loadJson(SOUND_KEY, (v): v is boolean => typeof v === 'boolean', true);
    this.sfx.kitIndex = loadJson(KIT_KEY, (v): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 8, 0) % 3;
    // NOTE: a malformed or stale preference (an unknown variant name after a rename) fails the guard and the
    // defaults apply; nothing is read from it piecemeal.
    const prefs = loadJson(SFX_KEY, isSfxPrefs, null);
    if (prefs) this.sfx.applyPrefs(prefs);
    // NOTE: a phone only lets audio start inside a touch handler; the frame loop's key-press unlock never sees a tap.
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') window.addEventListener('touchend', () => this.sfx.unlock(), { passive: true });
  }

  /** The SOUND LAB state; read by tests. */
  get lab(): Readonly<LabState> {
    return this.labState;
  }

  /** The sound player (choices, volume); read by tests. */
  get sounds(): SfxPlayer {
    return this.sfx;
  }

  /** Difficulty and start level as chosen on the ready panel; read by tests. */
  get options(): Readonly<MinigameSettings> {
    return this.settings;
  }

  /** True while the SUPER DEMO plays; read by tests. */
  get demoOn(): boolean {
    return this.demo;
  }

  /** A fresh game with the panel's options; the recorder runs only for a run that can be ranked and replayed. */
  private begin(seed: number): void {
    this.st = newGame(seed, this.st.collision, this.settings);
    this.best = loadNumber(bestKey(this.settings.difficulty), 0);
    this.rec = isRanked(this.st) ? new Recorder() : null;
    this.player = null;
  }

  /** Leave a finished WATCH BEST replay for the ready panel, which still offers any saved game. */
  private endReplay(): void {
    this.player = null;
    this.st = createState(this.newSeed(), this.st.collision, this.settings.difficulty);
  }

  private startDemo(): void {
    this.demo = true;
    this.demoRestart = 0;
    this.saved = null;
    this.rec = null;
    this.player = null;
    this.acc = 0;
    this.st = newGame(this.newSeed(), this.st.collision, { difficulty: 'normal', startLevel: 1 });
    flash(this.st, 'SUPER DEMO', 2);
  }

  private stopDemo(): void {
    this.demo = false;
    // OPTIONS > PERIMETER writes the same key, so pick up a change made there.
    this.settings = loadMinigameSettings();
    this.best = loadNumber(bestKey(this.settings.difficulty), 0);
    this.st = createState(this.newSeed(), this.st.collision, this.settings.difficulty);
    // A real game was waiting before the demo: offer it again.
    const saved = loadSessionJson(SAVE_KEY, isSavedGame, null);
    this.saved = saved && saved.status === 'playing' ? fromSaved(saved) : null;
    this.acc = 0;
  }

  /** The live state; read by tests (ready-panel key mapping) and never mutated from outside. */
  get state(): Readonly<MinigameState> {
    return this.st;
  }

  /** The touch panels' buttons (render.ts), readable by the dev visual check. */
  readonly panelHits = PANEL_HITS;
  /** The SOUND LAB's touch bar (ui/actionBar.ts). */
  private readonly labBar = new ScreenBar();
  private soundLabel(): string {
    return `${this.sfx.enabled ? 'SND ON' : 'SND OFF'}  KIT ${this.sfx.kit.name}`;
  }

  /** DAILY mode on: new games use today's seed. */
  private daily = false;
  /** A touch was down last frame (edge detection for tap-to-start). */
  private touchWas = false;
  /** On-screen pad buttons held this frame and last frame (touchPad.ts; the edges fire pulse, seeker and swarm). */
  private padNow = new Set<PadId>();
  private padWas = new Set<PadId>();
  /** A finger has been seen down since the last click (see update). */
  private sawTouch = false;
  /** Recording of the current game (null when it cannot be replayed: resumed, or a cheat was used). */
  private rec: Recorder | null = null;
  /** Playing a saved replay instead of the keyboard. */
  private player: Player | null = null;
  private dailyBest = 0;

  private newSeed(): number {
    if (this.daily) return dailySeed(today());
    // NOTE: the seed is the only non-deterministic input; it is shown in the debug HUD so a run can be replayed.
    return (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
  }

  enter(): void {
    this.keys.takeMultiTap?.(); // a two-finger pinch on another screen must not fire a pulse here
    this.demo = false;
    // OPTIONS > PERIMETER writes the same key, so pick up a change made there.
    this.settings = loadMinigameSettings();
    this.best = loadNumber(bestKey(this.settings.difficulty), 0);
    this.st = createState(this.newSeed(), this.st.collision, this.settings.difficulty);
    // NOTE: the save is validated by isSavedGame before anything is read from it; only a game still in
    // progress is worth offering.
    const saved = loadSessionJson(SAVE_KEY, isSavedGame, null);
    this.saved = saved && saved.status === 'playing' ? fromSaved(saved) : null;
    this.acc = 0;
    this.sinceSave = 0;
    this.keys.clearTyped();
    if (this.tiltPrefs.on) this.startTilt();
  }

  private say(text: string, seconds = 3): void {
    this.note = text;
    this.noteT = seconds;
  }

  private startTilt(): void {
    const r = this.tilt.start();
    this.tiltOnAt = performance.now();
    if (r === 'waiting') this.say('TAP THE SCREEN ONCE TO ALLOW MOTION', 6);
    else if (r === 'denied') this.say('MOTION NOT ALLOWED: CHECK THE BROWSER SETTINGS', 5);
    else if (r === 'none') this.say('NO TILT SENSOR IN THIS BROWSER', 4);
  }

  /** Difficulty or start level changed (the panel keys or the gear menu): save, and redo the ready panel's field. */
  private applyOptions(next: MinigameSettings): void {
    this.settings = next;
    saveMinigameSettings(next);
    if (this.st.status === 'ready' && !this.demo && !this.player) {
      this.best = loadNumber(bestKey(next.difficulty), 0);
      this.st = createState(this.st.seed, this.st.collision, next.difficulty);
    }
  }

  /** NEW GAME from the gear menu: any demo, replay or saved game is dropped and a fresh run starts with the options. */
  private resetGame(): void {
    if (this.demo) this.stopDemo();
    this.player = null;
    this.saved = null;
    removeSessionJson(SAVE_KEY);
    this.begin(this.newSeed());
    this.acc = 0;
  }

  /** GEAR menu (ui/gearMenu.ts): reset, start level, difficulty, tilt, sound and the panel's extras, by touch. */
  gear(): GearSpec {
    const st = this.st;
    const o = this.settings;
    const ready = st.status === 'ready' && !this.demo && !this.player;
    const items: GearItem[] = [];
    if (this.demo) items.push({ label: 'STOP DEMO', code: '', act: () => this.stopDemo() });
    if (ready && this.saved) items.push({ label: 'RESUME SAVED GAME', code: 'Space', hot: true });
    items.push({ label: `NEW GAME: LEVEL ${o.startLevel} ${o.difficulty.toUpperCase()}`, code: '', hot: !this.saved, act: () => this.resetGame() });
    items.push({ label: `START LEVEL: ${o.startLevel}${o.startLevel > 1 ? ' (NOT RANKED)' : ''}`, code: '', stay: true, act: () => this.applyOptions({ ...o, startLevel: nextStartLevel(o.startLevel) }) });
    items.push({ label: `DIFFICULTY: ${o.difficulty.toUpperCase()}`, code: '', stay: true, act: () => this.applyOptions({ ...o, difficulty: nextDifficulty(o.difficulty) }) });
    const noSensor = this.tilt.state === 'none';
    items.push({
      label: noSensor ? 'TILT STEER: NO SENSOR' : `TILT STEER: ${this.tiltPrefs.on ? 'ON' : 'OFF'}`,
      code: '',
      stay: true,
      off: noSensor,
      act: () => {
        this.tiltPrefs = { ...this.tiltPrefs, on: !this.tiltPrefs.on };
        saveTiltPrefs(this.tiltPrefs);
        if (this.tiltPrefs.on) this.startTilt();
      },
    });
    if (this.tiltPrefs.on && !noSensor) {
      items.push({ label: 'TILT: LEVEL IS HERE', code: '', act: () => { this.tilt.calibrate(); this.say('TILT LEVELLED', 2); } });
      items.push({ label: `TILT: ${this.tiltPrefs.invert ? 'REVERSED' : 'NORMAL'}`, code: '', stay: true, act: () => { this.tiltPrefs = { ...this.tiltPrefs, invert: !this.tiltPrefs.invert }; saveTiltPrefs(this.tiltPrefs); } });
    }
    items.push({ label: `SOUND: ${this.sfx.enabled ? 'ON' : 'OFF'}`, code: '', stay: true, act: () => { this.sfx.enabled = !this.sfx.enabled; saveJson(SOUND_KEY, this.sfx.enabled); } });
    items.push({ label: `SOUND KIT: ${this.sfx.kit.name}`, code: '', stay: true, act: () => { this.sfx.cycleKit(); saveJson(KIT_KEY, this.sfx.kitIndex); } });
    if ((st.status === 'ready' || st.status === 'over') && !this.demo) items.push({ label: 'SOUND LAB', code: '', act: () => { this.labState.open = true; } });
    if (ready) {
      items.push({ label: 'SUPER DEMO', code: 'Digit8' });
      items.push({ label: 'WATCH BEST GAME', code: 'Digit7' });
      items.push({ label: `DAILY FIELD: ${this.daily ? 'ON' : 'OFF'}`, code: 'Digit6', stay: true });
    }
    items.push({ label: 'TITLE', code: '', act: () => { if (this.demo) this.stopDemo(); this.router.go('title'); } });
    return { title: st.status === 'playing' && !this.demo ? 'PAUSED' : 'PERIMETER', items };
  }

  exit(): void {
    // The surface and listeners are shared; only the game in progress needs keeping.
    if (this.st.status === 'playing' && !this.demo && !this.player) saveSessionJson(SAVE_KEY, toSaved(this.st));
  }

  update(dtMs: number): void {
    const k = this.keys;
    const st = this.st;
    this.noteT = Math.max(0, this.noteT - dtMs / 1000);
    // Tilt switched on but nothing has come from the sensor (a laptop, a blocked sensor): say so once.
    if (this.tiltPrefs.on && this.tilt.state === 'granted' && this.tilt.roll === null && this.tiltOnAt > 0 && performance.now() - this.tiltOnAt > 2500) {
      this.tiltOnAt = 0;
      this.say('NO TILT READINGS: THIS DEVICE MAY HAVE NO MOTION SENSOR', 4);
    }

    // Any key counts as the user gesture browsers require before audio may start (a touch unlocks it in its own
    // handler, see the constructor).
    if (k.anyKeyPressed()) this.sfx.unlock();
    this.padWas = this.padNow;
    this.padNow = k.touchUsed ? padHeld(k.touchPoints ?? [], padLayout(this.s.width, this.s.height)) : new Set();
    const padEdge = (id: PadId): boolean => this.padNow.has(id) && !this.padWas.has(id);
    // NOTE: a tap shorter than a frame never shows in touchPoints; its click still arrives, so it counts too.
    // Only a tap the frame loop never saw as a held finger counts: releasing a held FIRE finger is also a "click"
    // and must not restart a game from the game-over panel.
    const seen = this.sawTouch;
    const rawClick = k.takeClick?.() ?? null;
    if (rawClick) this.sawTouch = false;
    if ((k.touchPoints ?? []).length > 0) this.sawTouch = true;
    const tapClick = rawClick && !seen ? rawClick : null;
    const tapBack = tapClick !== null && k.touchUsed && onBackTab(tapClick.x, tapClick.y);
    // A tap on a panel button (render.ts PANEL_HITS) presses its key and does not start a game. NOTE: the finger's
    // release is read from rawClick (a held finger is "seen", so tapClick is null for it), and the finger going down
    // on a button is kept out of touchStart below, or the game began before the button was ever read.
    const onBtn = (pt: { x: number; y: number }): boolean => PANEL_HITS.some((b) => pt.x >= b.x && pt.x < b.x + b.w && pt.y >= b.y && pt.y < b.y + b.h);
    const panelBtn = rawClick ? PANEL_HITS.find((b) => rawClick.x >= b.x && rawClick.x < b.x + b.w && rawClick.y >= b.y && rawClick.y < b.y + b.h) : undefined;
    if (panelBtn && (st.status === 'ready' || st.status === 'over')) k.inject(panelBtn.code, true);
    // The SOUND LAB's bar (a phone has no arrow keys): its taps press keys too.
    if (this.labState.open) this.labBar.tap(k);
    if ((padEdge('back') || tapBack) && !this.labState.open) {
      if (this.demo) this.stopDemo();
      this.router.go('title');
      return;
    }
    if (this.demo) {
      this.updateDemo(dtMs);
      return;
    }
    // The SOUND LAB owns the keys while open; the sim is not stepped and the game is untouched.
    if (this.labState.open) {
      if (updateLab(this.labState, k, this.sfx, Math.min(dtMs, 250) / 1000)) saveJson(SFX_KEY, this.sfx.prefs());
      k.clearTyped();
      return;
    }
    if ((st.status === 'ready' || st.status === 'over') && k.pressed(LAB_KEY)) {
      this.labState.open = true;
      k.clearTyped();
      return;
    }
    if (k.pressed('Escape')) {
      this.router.go('title');
      return;
    }
    if (k.pressed('Digit4')) {
      this.sfx.enabled = !this.sfx.enabled;
      saveJson(SOUND_KEY, this.sfx.enabled);
    }
    if (k.pressed('Digit5')) {
      this.sfx.cycleKit();
      saveJson(KIT_KEY, this.sfx.kitIndex);
    }
    // NOTE: digits, not letters: letters are reserved for typing cheat codes.
    if (k.pressed('Digit1')) this.debug = !this.debug;
    if (k.pressed('Digit2')) this.s.glowMode = GLOW_CYCLE[(GLOW_CYCLE.indexOf(this.s.glowMode) + 1) % GLOW_CYCLE.length] ?? 'understroke';
    if (k.pressed('Digit3')) st.collision = st.collision === 'auto' ? 'naive' : st.collision === 'naive' ? 'grid' : 'auto';

    if (st.status === 'ready' && k.pressed('Digit8')) {
      this.startDemo();
      k.clearTyped();
      return;
    }
    if ((st.status === 'ready' || (st.status === 'over' && !this.player)) && k.anyPressed('Digit9', 'Digit0')) {
      // NOTE: options apply to the next new game; a saved game keeps the options it was started with. On the
      // game-over panel they set up the retry (owner 2026-10-18: the level skip was hard to find).
      // The game-over panel keeps comparing the finished game with its own difficulty's best (applyOptions redoes
      // only the ready panel).
      let next = this.settings;
      if (k.pressed('Digit9')) next = { ...next, difficulty: nextDifficulty(next.difficulty) };
      if (k.pressed('Digit0')) next = { ...next, startLevel: nextStartLevel(next.startLevel) };
      this.applyOptions(next);
      return;
    }
    if (st.status === 'ready' && k.pressed('Digit7')) {
      // WATCH BEST: the saved best game, fed back step by step from its seed.
      const r = loadJson(REPLAY_KEY, isSavedReplay, null);
      if (r) {
        this.st = createState(r.seed, r.collision, r.difficulty ?? 'normal');
        start(this.st);
        this.player = new Player(r.rle);
        this.rec = null;
        // NOTE: the saved game stays offered; a replay never writes or clears the save (see autosave below).
        flash(this.st, `REPLAY OF THE BEST GAME: ${r.score}`, 3);
        return;
      }
      flash(st, 'NO SAVED BEST GAME YET', 2);
    }
    if (st.status === 'ready' && k.pressed('Digit6')) {
      // DAILY toggles the field: today's seed for everyone, its own best.
      this.daily = !this.daily;
      const rec = loadJson(DAILY_KEY, isDaily, null);
      this.dailyBest = rec && rec.date === today() ? rec.best : 0;
      this.st = createState(this.newSeed(), st.collision, this.settings.difficulty);
      return;
    }
    const touches = k.touchPoints ?? [];
    // NOTE: a finger on BACK (held) must not also start a game from the panel.
    const first = touches[0];
    // NOTE: nor a finger on the GEAR tab (main.ts takes its tap; the finger going down is still seen here).
    const onGear = (pt: { x: number; y: number }): boolean => onGearTab(pt.x, pt.y, this.s.width);
    const touchStart = (touches.length > 0 && !this.touchWas && !this.padNow.has('back') && !(first && (onBtn(first) || onGear(first)))) || (tapClick !== null && !tapBack && !panelBtn && !onGear(tapClick));
    this.touchWas = touches.length > 0;
    if (this.player && st.status === 'over' && (touchStart || k.pressed('Space'))) {
      this.endReplay();
      return;
    }
    if (touchStart && (st.status === 'ready' || st.status === 'over')) {
      if (st.status === 'ready' && !this.saved) this.begin(st.seed);
      else if (st.status === 'ready' && this.saved) { this.st = this.saved; this.saved = null; this.rec = null; }
      else this.begin(this.newSeed());
      return;
    }
    if (st.status === 'ready') {
      // NOTE: with a save present Space RESUMES (so does R); only Backspace, a key nobody hits by reflex while
      // firing, throws the save away. Without a save Space starts a fresh game as it always did.
      if (this.saved && k.anyPressed('Space', 'KeyR')) {
        this.st = this.saved;
        this.saved = null;
        this.rec = null; // a resumed game has no recording from its seed
        this.sinceSave = 0;
        flash(this.st, 'RESUMED', 1.5);
        k.clearTyped();
        return;
      }
      if (this.saved ? k.pressed('Backspace') : k.pressed('Space')) {
        this.saved = null;
        removeSessionJson(SAVE_KEY);
        this.begin(st.seed);
        return;
      }
    }
    if (st.status === 'over' && k.pressed('Space')) {
      removeSessionJson(SAVE_KEY);
      this.begin(this.newSeed());
      return;
    }

    // Cheats: match the typed tail, then clear so a code fires once.
    if (st.status === 'playing') {
      const fired = this.cheats.match(k.typed(), st);
      if (fired) {
        this.rec = null; // cheated games are not saved as replays
        k.clearTyped();
        console.info(`[cheat] ${fired.code}: ${fired.message}`);
      }
    }

    // NOTE: Comma and Period are the `<` and `>` keys on a US layout; KeyboardEvent.code is layout independent.
    // Touch (IDEAS 2): left third turns left, right third turns right, the middle fires; a two-finger tap
    // pulses, and any touch starts or resumes a game from the panels.
    // Owner 2026-10-20: on a touch screen the visible pad (touchPad.ts) replaces the thirds; the two-finger tap is
    // dropped there, since turning and firing at once is two fingers.
    const W = this.s.width;
    const tp = k.touchPoints ?? [];
    const pad = k.touchUsed;
    const multi = k.takeMultiTap?.() ?? false;
    const tLeft = pad ? this.padNow.has('left') : tp.some((t) => t.x < W / 3);
    const tRight = pad ? this.padNow.has('right') : tp.some((t) => t.x > (2 * W) / 3);
    const tFire = pad ? this.padNow.has('fire') : tp.some((t) => t.x >= W / 3 && t.x <= (2 * W) / 3);
    const tPulse = pad ? padEdge('pulse') : multi;
    // TILT STEER (tilt.ts): the phone's roll turns the launchers, a part turn spread over frames.
    let tiltL = false;
    let tiltR = false;
    if (this.tiltPrefs.on && this.tilt.roll !== null && st.status === 'playing') {
      const amt = tiltAmount(this.tilt.roll, this.tilt.neutral, this.tiltPrefs.invert);
      const pw = tiltPwm(this.tiltAcc, amt);
      this.tiltAcc = pw.acc;
      tiltL = pw.on && amt < 0;
      tiltR = pw.on && amt > 0;
    }
    const input: Input = {
      left: k.anyHeld('ArrowLeft', 'KeyA') || tLeft || tiltL,
      right: k.anyHeld('ArrowRight', 'KeyD') || tRight || tiltR,
      fire: k.held('Space') || tFire,
      pulse: k.anyPressed('Enter', 'ShiftLeft', 'ShiftRight') || tPulse,
      seeker: k.pressed('Comma') || (pad && padEdge('seeker')),
      swarm: k.pressed('Period') || (pad && padEdge('swarm')),
    };

    this.acc += Math.min(dtMs, 250) / 1000 * st.cheats.timeScale;
    let steps = 0;
    let edges = input;
    while (this.acc >= MG.DT && steps < MG.MAX_STEPS_PER_FRAME) {
      if (this.player && st.status === 'playing') edges = this.player.next() ?? { ...edges, left: false, right: false, fire: false };
      else if (this.rec && st.status === 'playing') this.rec.push(edges);
      step(st, edges, MG.DT);
      edges = { ...input, pulse: false, seeker: false, swarm: false }; // an edge is consumed by the first step
      this.acc -= MG.DT;
      steps++;
    }
    if (steps === MG.MAX_STEPS_PER_FRAME) this.acc = 0;

    // Autosave: on every level-up and every AUTOSAVE_SECONDS while playing; the save goes when the game ends.
    if (this.player) {
      // A replay is not the player's game: it never autosaves over, or clears, the real save.
    } else if (st.status === 'playing') {
      this.sinceSave += Math.min(dtMs, 250) / 1000;
      if (this.sinceSave >= AUTOSAVE_SECONDS || st.events.some((e) => e.type === 'levelup')) {
        saveSessionJson(SAVE_KEY, toSaved(st));
        this.sinceSave = 0;
      }
    } else if (st.events.some((e) => e.type === 'over')) {
      removeSessionJson(SAVE_KEY);
    }

    // Sound: the step emitted events; play them and clear the queue.
    this.sfx.play(st.events, performance.now() / 1000);
    st.events.length = 0;
    if (st.status === 'playing') this.sfx.ambient(chaosLevel(st), Math.min(dtMs, 250) / 1000);

    if (st.status === 'over' && this.rec && isRanked(st)) {
      const prev = loadJson(REPLAY_KEY, isSavedReplay, null);
      if (!prev || st.score > prev.score) saveJson(REPLAY_KEY, { seed: st.seed, collision: st.collision, score: st.score, rle: this.rec.rle, difficulty: st.difficulty } satisfies SavedReplay);
      this.rec = null;
    }
    if (st.status === 'over' && !this.player && isRanked(st) && st.score > this.best) {
      this.best = st.score;
      saveJson(bestKey(st.difficulty), this.best);
    }
    // NOTE: the daily seed is the same for everyone, so only a NORMAL run from level 1 is a fair daily best.
    if (this.daily && st.status === 'over' && !this.player && isRanked(st) && st.difficulty === 'normal' && st.score > this.dailyBest) {
      this.dailyBest = st.score;
      saveJson(DAILY_KEY, { date: today(), best: st.score });
    }
  }

  /** SUPER DEMO frame: any key but the view toggles ends it; otherwise the bot plays at MG.DEMO_SPEED. */
  private updateDemo(dtMs: number): void {
    const k = this.keys;
    if (k.pressed('Escape')) {
      this.stopDemo();
      this.router.go('title');
      return;
    }
    const toggled = DEMO_KEEP_KEYS.some((c) => k.pressed(c));
    const touched = (k.touchPoints ?? []).length > 0;
    if ((k.anyKeyPressed() && !toggled) || touched) {
      this.stopDemo();
      k.clearTyped();
      return;
    }
    if (k.pressed('Digit1')) this.debug = !this.debug;
    if (k.pressed('Digit2')) this.s.glowMode = GLOW_CYCLE[(GLOW_CYCLE.indexOf(this.s.glowMode) + 1) % GLOW_CYCLE.length] ?? 'understroke';
    if (k.pressed('Digit4')) {
      this.sfx.enabled = !this.sfx.enabled;
      saveJson(SOUND_KEY, this.sfx.enabled);
    }
    k.clearTyped();
    const sec = Math.min(dtMs, 250) / 1000;
    const st = this.st;
    if (st.status === 'over') {
      this.demoRestart += sec;
      st.events.length = 0;
      if (this.demoRestart >= MG.DEMO_RESTART_SECONDS) this.startDemo();
      return;
    }
    this.acc += sec * MG.DEMO_SPEED;
    let steps = 0;
    while (this.acc >= MG.DT && steps < MG.MAX_STEPS_PER_FRAME && st.status === 'playing') {
      step(st, botInput(st), MG.DT);
      this.acc -= MG.DT;
      steps++;
    }
    if (steps === MG.MAX_STEPS_PER_FRAME) this.acc = 0;
    this.sfx.play(st.events, performance.now() / 1000);
    st.events.length = 0;
    if (st.status === 'playing') this.sfx.ambient(chaosLevel(st), sec);
  }

  render(): void {
    const now = performance.now();
    if (this.lastFrame) this.frameMs = this.frameMs * 0.9 + (now - this.lastFrame) * 0.1;
    this.lastFrame = now;
    const sv = this.st.status === 'ready' ? this.saved : null;
    renderMinigame(this.s, this.st, {
      debug: this.debug,
      frameMs: this.frameMs,
      best: this.best,
      sound: this.soundLabel(),
      resume: sv ? { level: sv.level, score: sv.score, t: sv.t } : null,
      daily: this.daily ? { date: today(), best: this.dailyBest } : null,
      demo: this.demo ? { speed: MG.DEMO_SPEED, restartIn: this.st.status === 'over' ? Math.max(0, MG.DEMO_RESTART_SECONDS - this.demoRestart) : null } : null,
      ...(this.player || this.demo ? {} : { options: this.settings }),
      reduceMotion: this.reduceMotion(),
      touchTop: this.keys.touchUsed && !this.labState.open ? Math.min(...padLayout(this.s.width, this.s.height).map((b) => b.y - b.r)) : null,
    });
    if (this.labState.open) {
      renderLab(this.s, this.labState, this.sfx);
      if (this.keys.touchUsed) this.labBar.draw(this.s, [{ label: 'UP', code: 'ArrowUp' }, { label: 'DOWN', code: 'ArrowDown' }, { label: '< PICK', code: 'ArrowLeft' }, { label: 'PICK >', code: 'ArrowRight' }, { label: 'PLAY', code: 'Enter' }, { label: 'REVIEW ALL', code: 'KeyA' }, { label: 'DEFAULTS', code: 'Digit0' }, { label: 'CLOSE', code: 'Escape' }], true);
    }
    else if (this.keys.touchUsed) drawPad(this.s, padLayout(this.s.width, this.s.height), this.padNow, this.st.status === 'playing' && !this.player && !this.demo);
    const s = this.s;
    if (this.tiltPrefs.on && this.st.status === 'playing' && !this.demo) drawTextFit(s, this.tilt.roll === null ? 'TILT: NO READING' : 'TILT STEER', s.width / 2, s.height - 14, 8, 120, { align: 'center', color: s.palette.dim, glow: 0 });
    // The note sits under the planet, clear of the HUD columns and the pad.
    if (this.noteT > 0) drawTextFit(s, this.note, s.width / 2, Math.round(s.height * (s.width > s.height * 1.3 ? 0.8 : 0.66)), 10, Math.min(s.width - 24, s.width > s.height * 1.3 ? s.width * 0.5 : s.width), { align: 'center', color: s.palette.hot, glow: 1, alpha: Math.min(1, this.noteT / 0.4) });
  }
}
