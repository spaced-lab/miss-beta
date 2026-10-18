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
// LORE: G1 (how to play), C1 (how the game is built)

import { CheatRegistry } from '../game/cheats';
import { loadJson, loadNumber, loadSessionJson, removeSessionJson, saveJson, saveSessionJson } from '../game/persistence';
import type { Router, Screen } from '../game/screen';
import type { GlowMode, Surface } from '../render/canvas';
import type { Input as Keys } from '../ui/input';
import { MINIGAME_CHEATS } from './cheats';
import { MG } from './config';
import { renderMinigame } from './render';
import { isSfxPrefs, SfxPlayer } from './sfx';
import { createLab, LAB_KEY, renderLab, updateLab, type LabState } from './soundLab';
import { isSavedReplay, Player, Recorder, type SavedReplay } from './replay';
import { chaosLevel, createState, flash, fromSaved, isSavedGame, start, step, toSaved, type Input, type MinigameState } from './sim';

const BEST_KEY = 'minigame.best';
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
  private best = loadNumber(BEST_KEY, 0);
  private frameMs = 0;
  private lastFrame = 0;
  /** A game restored from sessionStorage, offered on the ready panel until the player picks RESUME or NEW. */
  private saved: MinigameState | null = null;
  private sinceSave = 0;
  private readonly cheats = new CheatRegistry<MinigameState>(MINIGAME_CHEATS);
  private readonly sfx = new SfxPlayer();
  private readonly labState = createLab();

  constructor(private readonly s: Surface, private readonly keys: Keys, private readonly router: Router) {
    this.st = createState(this.newSeed());
    this.sfx.enabled = loadJson(SOUND_KEY, (v): v is boolean => typeof v === 'boolean', true);
    this.sfx.kitIndex = loadJson(KIT_KEY, (v): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 8, 0) % 3;
    // NOTE: a malformed or stale preference (an unknown variant name after a rename) fails the guard and the
    // defaults apply; nothing is read from it piecemeal.
    const prefs = loadJson(SFX_KEY, isSfxPrefs, null);
    if (prefs) this.sfx.applyPrefs(prefs);
  }

  /** The SOUND LAB state; read by tests. */
  get lab(): Readonly<LabState> {
    return this.labState;
  }

  /** The sound player (choices, volume); read by tests. */
  get sounds(): SfxPlayer {
    return this.sfx;
  }

  /** The live state; read by tests (ready-panel key mapping) and never mutated from outside. */
  get state(): Readonly<MinigameState> {
    return this.st;
  }

  private soundLabel(): string {
    return `${this.sfx.enabled ? 'SND ON' : 'SND OFF'}  KIT ${this.sfx.kit.name}`;
  }

  /** DAILY mode on: new games use today's seed. */
  private daily = false;
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
    this.st = createState(this.newSeed(), this.st.collision);
    // NOTE: the save is validated by isSavedGame before anything is read from it; only a game still in
    // progress is worth offering.
    const saved = loadSessionJson(SAVE_KEY, isSavedGame, null);
    this.saved = saved && saved.status === 'playing' ? fromSaved(saved) : null;
    this.acc = 0;
    this.sinceSave = 0;
    this.keys.clearTyped();
  }

  exit(): void {
    // The surface and listeners are shared; only the game in progress needs keeping.
    if (this.st.status === 'playing') saveSessionJson(SAVE_KEY, toSaved(this.st));
  }

  update(dtMs: number): void {
    const k = this.keys;
    const st = this.st;

    // Any key counts as the user gesture browsers require before audio may start.
    if (k.anyKeyPressed()) this.sfx.unlock();
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

    if (st.status === 'ready' && k.pressed('Digit7')) {
      // WATCH BEST: the saved best game, fed back step by step from its seed.
      const r = loadJson(REPLAY_KEY, isSavedReplay, null);
      if (r) {
        this.st = createState(r.seed, r.collision);
        start(this.st);
        this.player = new Player(r.rle);
        this.rec = null;
        this.saved = null;
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
      this.st = createState(this.newSeed(), st.collision);
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
        start(st);
        this.rec = new Recorder();
        this.player = null;
      }
    }
    if (st.status === 'over' && k.pressed('Space')) {
      removeSessionJson(SAVE_KEY);
      this.st = createState(this.newSeed(), st.collision);
      start(this.st);
      this.rec = new Recorder();
      this.player = null;
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
    const input: Input = {
      left: k.anyHeld('ArrowLeft', 'KeyA'),
      right: k.anyHeld('ArrowRight', 'KeyD'),
      fire: k.held('Space'),
      pulse: k.anyPressed('Enter', 'ShiftLeft', 'ShiftRight'),
      seeker: k.pressed('Comma'),
      swarm: k.pressed('Period'),
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
    if (st.status === 'playing') {
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

    if (st.status === 'over' && this.rec && !st.cheats.assisted) {
      const prev = loadJson(REPLAY_KEY, isSavedReplay, null);
      if (!prev || st.score > prev.score) saveJson(REPLAY_KEY, { seed: st.seed, collision: st.collision, score: st.score, rle: this.rec.rle } satisfies SavedReplay);
      this.rec = null;
    }
    if (st.status === 'over' && !st.cheats.assisted && st.score > this.best) {
      this.best = st.score;
      saveJson(BEST_KEY, this.best);
    }
    if (this.daily && st.status === 'over' && !st.cheats.assisted && st.score > this.dailyBest) {
      this.dailyBest = st.score;
      saveJson(DAILY_KEY, { date: today(), best: st.score });
    }
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
    });
    if (this.labState.open) renderLab(this.s, this.labState, this.sfx);
  }
}
