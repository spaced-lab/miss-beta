// WHAT: The SOUND LAB: a control panel where the player auditions and picks the voice of every PERIMETER sound.
// WHY:  Nobody tuning this repo can hear it (tests run in node, the sim is silent), so "that bleep is annoying"
//       can only be settled by the person at the speakers. The lab lists every game event with its current
//       variant, plays a variant the moment it is selected, replays the whole backlog in sequence (REVIEW) so
//       the player can listen through and note what grates, and holds the master volume and the ambient level.
// HOW:  Pure state plus two functions, like the rest of the minigame: `updateLab` reads key edges and mutates a
//       `LabState` and the `SfxPlayer`, returning true when a persisted preference changed (the screen saves
//       then); `renderLab` draws with the stroke font over the dimmed field. The lab is opened from the ready or
//       game-over panel with L (letters are cheat-code input while playing, so never there), and while it is open
//       the screen does not step the sim. REVIEW walks `reviewSequence()` (every event once, in table order),
//       waiting each variant's nominal length plus REVIEW_GAP; an AMBIENT audition is a short burst of pops
//       because a single pop says nothing about a texture. Nothing here touches storage or the DOM.
// LORE: G8 (the look, and the sound)

import type { Surface } from '../render/canvas';
import { withAlpha } from '../render/palettes';
import { drawText } from '../render/vectorFont';
import type { Input as Keys } from '../ui/input';
import { choicesFor, OFF, SOUND_EVENTS, type SfxPlayer, type SoundEvent } from './sfx';

/** KeyboardEvent.code that opens the lab from the ready / game-over panel (and closes it from inside). */
export const LAB_KEY = 'KeyL';
/** Seconds of silence between two events of the REVIEW sequence (after the variant's nominal length). */
export const REVIEW_GAP = 0.6;
/** An AMBIENT audition: this many pops, this far apart, alternating the static and the activity voice. */
const BURST_POPS = 6;
const BURST_SPACING = 0.12;
const VOLUME_STEP = 0.05;
const AMBIENT_STEP = 0.1;

export type LabRow = SoundEvent | 'VOLUME' | 'AMBIENT LEVEL';
export const LAB_ROWS: readonly LabRow[] = [...SOUND_EVENTS, 'VOLUME', 'AMBIENT LEVEL'];

export interface LabState {
  open: boolean;
  row: number;
  /** REVIEW mode: index into reviewSequence() of the next event to play, or -1 when not reviewing. */
  reviewAt: number;
  reviewTimer: number;
  /** AMBIENT burst: pops still to play and the time to the next one. */
  burstLeft: number;
  burstTimer: number;
  lastPlayed: SoundEvent | null;
  /** Seconds since the last audition started: drives the highlight. */
  sincePlay: number;
}

export function createLab(): LabState {
  return { open: false, row: 0, reviewAt: -1, reviewTimer: 0, burstLeft: 0, burstTimer: 0, lastPlayed: null, sincePlay: 10 };
}

/** The REVIEW order: every event with a variant table exactly once, in table order. */
export const reviewSequence = (): readonly SoundEvent[] => SOUND_EVENTS;

const isEvent = (row: LabRow | undefined): row is SoundEvent => row !== undefined && (SOUND_EVENTS as readonly string[]).includes(row);

/** Play `ev` once from the lab (AMBIENT becomes a burst, see the header). */
export function audition(lab: LabState, sfx: SfxPlayer, ev: SoundEvent): void {
  lab.lastPlayed = ev;
  lab.sincePlay = 0;
  if (ev === 'AMBIENT') {
    lab.burstLeft = BURST_POPS;
    lab.burstTimer = 0;
    return;
  }
  lab.burstLeft = 0;
  sfx.audition(ev);
}

/** Nominal seconds an audition of `ev` occupies: the variant's length, or the burst for AMBIENT. */
function auditionLength(sfx: SfxPlayer, ev: SoundEvent): number {
  if (ev === 'AMBIENT') return sfx.variantOf(ev) === OFF ? 0 : BURST_POPS * BURST_SPACING;
  return sfx.variantOf(ev).dur;
}

function stopReview(lab: LabState): void {
  lab.reviewAt = -1;
  lab.reviewTimer = 0;
}

type LabKeys = Pick<Keys, 'pressed' | 'anyPressed'>;

/**
 * One frame of the lab. Returns true when a persisted preference (a variant, the volume, the ambient level)
 * changed. Keys: Up/Down row, Left/Right variant (plays it), Enter/Space replay, A review all, 0 defaults,
 * Esc or L back.
 */
export function updateLab(lab: LabState, k: LabKeys, sfx: SfxPlayer, dt: number): boolean {
  let changed = false;
  lab.sincePlay += dt;

  // The AMBIENT burst and the REVIEW walk run on the frame clock, independent of key input.
  if (lab.burstLeft > 0) {
    lab.burstTimer -= dt;
    if (lab.burstTimer <= 0) {
      const i = BURST_POPS - lab.burstLeft;
      sfx.audition('AMBIENT', { lift: i % 2 === 1 ? 0.6 : 0 });
      lab.burstLeft--;
      lab.burstTimer = BURST_SPACING;
    }
  }
  if (lab.reviewAt >= 0) {
    lab.reviewTimer -= dt;
    if (lab.reviewTimer <= 0) {
      const ev = reviewSequence()[lab.reviewAt];
      if (ev === undefined) {
        stopReview(lab);
      } else {
        lab.row = Math.max(0, LAB_ROWS.indexOf(ev));
        audition(lab, sfx, ev);
        lab.reviewTimer = auditionLength(sfx, ev) + REVIEW_GAP;
        lab.reviewAt++;
      }
    }
  }

  if (k.anyPressed('Escape', LAB_KEY)) {
    lab.open = false;
    stopReview(lab);
    lab.burstLeft = 0;
    return false;
  }
  if (k.pressed('KeyA')) {
    if (lab.reviewAt >= 0) stopReview(lab);
    else {
      lab.reviewAt = 0;
      lab.reviewTimer = 0;
    }
    return false;
  }
  const n = LAB_ROWS.length;
  const dirRow = (k.pressed('ArrowDown') ? 1 : 0) - (k.pressed('ArrowUp') ? 1 : 0);
  const dirCol = (k.pressed('ArrowRight') ? 1 : 0) - (k.pressed('ArrowLeft') ? 1 : 0);
  const replay = k.anyPressed('Enter', 'Space');
  if (dirRow !== 0 || dirCol !== 0 || replay) stopReview(lab);
  if (dirRow !== 0) lab.row = (lab.row + dirRow + n) % n;
  const row = LAB_ROWS[lab.row];
  if (dirCol !== 0) {
    if (isEvent(row)) {
      sfx.cycleChoice(row, dirCol);
      audition(lab, sfx, row);
    } else if (row === 'VOLUME') {
      sfx.setVolume(Math.round((sfx.volume + dirCol * VOLUME_STEP) * 100) / 100);
      audition(lab, sfx, 'BREAK'); // a mid-weight reference cue for setting the level
    } else {
      sfx.ambientLevel = Math.min(1, Math.max(0, Math.round((sfx.ambientLevel + dirCol * AMBIENT_STEP) * 10) / 10));
      audition(lab, sfx, 'AMBIENT');
    }
    changed = true;
  }
  if (replay) audition(lab, sfx, isEvent(row) ? row : row === 'VOLUME' ? 'BREAK' : 'AMBIENT');
  if (k.pressed('Digit0')) {
    sfx.resetChoices();
    changed = true;
  }
  return changed;
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

/** A level bar: an outline with the filled fraction drawn as a thick stroke (no fills, GAME_PLAN 4). */
function bar(s: Surface, x: number, y: number, w: number, h: number, frac: number, color: string): void {
  s.stroke([x, y, x + w, y, x + w, y + h, x, y + h], { closed: true, color, glow: 0.6 });
  if (frac > 0) s.stroke([x + 2, y + h / 2, x + 2 + (w - 4) * Math.min(1, frac), y + h / 2], { color, width: h - 4, glow: 0 });
}

export function renderLab(s: Surface, lab: LabState, sfx: SfxPlayer): void {
  const p = s.palette;
  const rowH = 22;
  const w = Math.min(960, s.width - 32);
  const h = 118 + LAB_ROWS.length * rowH + 74;
  const x0 = (s.width - w) / 2;
  const y0 = Math.max(8, (s.height - h) / 2);
  s.ctx.fillStyle = withAlpha(p.bg, 0.84);
  s.ctx.fillRect(0, 0, s.width, s.height);
  s.stroke([x0, y0, x0 + w, y0, x0 + w, y0 + h, x0, y0 + h], { closed: true, glow: 1.2 });

  const cx = s.width / 2;
  drawText(s, 'SOUND LAB', cx, y0 + 22, 28, { align: 'center', glow: 2, color: p.hot });
  drawText(s, 'CHOOSE EVERY VOICE BY EAR. CHOICES ARE SAVED IN THIS BROWSER.', cx, y0 + 62, 11, { align: 'center', color: p.dim, glow: 0 });

  const colEvent = x0 + 36;
  const colVariant = x0 + 170;
  const colAbout = x0 + 330;
  const yHead = y0 + 90;
  drawText(s, 'EVENT', colEvent, yHead, 10, { color: p.dim, glow: 0 });
  drawText(s, 'VARIANT', colVariant, yHead, 10, { color: p.dim, glow: 0 });
  drawText(s, 'ABOUT', colAbout, yHead, 10, { color: p.dim, glow: 0 });
  s.stroke([x0 + 16, yHead + 16, x0 + w - 16, yHead + 16], { color: p.dim, glow: 0, alpha: 0.5 });

  let y = yHead + 26;
  for (let i = 0; i < LAB_ROWS.length; i++) {
    const row = LAB_ROWS[i];
    if (row === undefined) continue;
    const selected = i === lab.row;
    const playing = isEvent(row) && lab.lastPlayed === row && lab.sincePlay < 0.35;
    const color = selected || playing ? p.hot : p.ink;
    const glow = playing ? 2.2 : selected ? 1.4 : 0.8;
    if (selected) drawText(s, '>', x0 + 18, y, 12, { color: p.hot, glow: 1.5 });
    drawText(s, row, colEvent, y, 12, { color, glow });
    if (isEvent(row)) {
      const v = sfx.variantOf(row);
      const idx = sfx.choice[row] + 1;
      const total = choicesFor(row).length;
      drawText(s, `< ${v.name} >`, colVariant, y, 12, { color, glow });
      drawText(s, `${idx}/${total}`, colAbout - 14, y + 1, 9, { align: 'right', color: p.dim, glow: 0 });
      drawText(s, v.about, colAbout, y + 1, 10, { color: selected ? p.ink : p.dim, glow: 0 });
    } else if (row === 'VOLUME') {
      bar(s, colVariant, y + 1, 120, 11, sfx.volume, color);
      drawText(s, pct(sfx.volume), colVariant + 130, y, 12, { color, glow });
      drawText(s, 'MASTER VOLUME (50% IS THE V3.2 LEVEL)', colAbout, y + 1, 10, { color: selected ? p.ink : p.dim, glow: 0 });
    } else {
      bar(s, colVariant, y + 1, 120, 11, sfx.ambientLevel, color);
      drawText(s, pct(sfx.ambientLevel), colVariant + 130, y, 12, { color, glow });
      drawText(s, 'AMBIENT / CHAOS LAYER GAIN (RISES WITH LEVEL IN PLAY)', colAbout, y + 1, 10, { color: selected ? p.ink : p.dim, glow: 0 });
    }
    y += rowH;
  }

  const yFoot = y0 + h - 58;
  s.stroke([x0 + 16, yFoot - 10, x0 + w - 16, yFoot - 10], { color: p.dim, glow: 0, alpha: 0.5 });
  if (lab.reviewAt >= 0) {
    const seq = reviewSequence();
    const at = Math.min(seq.length, lab.reviewAt);
    drawText(s, `REVIEW ${at}/${seq.length}   ${lab.lastPlayed ?? ''}   (A STOPS)`, cx, yFoot, 12, { align: 'center', color: p.hot, glow: 1.5 });
  } else {
    drawText(s, 'A PLAYS THE WHOLE BACKLOG IN ORDER WITH A 0.6 S GAP: LISTEN THROUGH AND NOTE WHAT GRATES', cx, yFoot, 10, { align: 'center', color: p.dim, glow: 0 });
  }
  drawText(s, 'UP/DOWN ROW   LEFT/RIGHT VARIANT (PLAYS IT)   ENTER/SPACE REPLAY   A REVIEW ALL   0 DEFAULTS   ESC BACK', cx, yFoot + 22, 10, { align: 'center', color: p.dim, glow: 0 });
}
