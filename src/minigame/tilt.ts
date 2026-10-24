// WHAT: TILT STEER for PERIMETER: tip the phone left or right to turn the launchers, the device's motion sensor
//       read through the browser's deviceorientation event.
// WHY:  Owner 2026-10-23: "see if you can do anything for minigame to work with gyroscope". A phone has the sensor
//       and the web exposes it (DeviceOrientationEvent); turning by tilt frees the left thumb, so only FIRE and the
//       weapons stay on the screen. Tuned by rounds of owner tests on a real phone (docs/TILT_EXPERIMENTS.md).
// HOW:  Pure part: `screenRoll(beta, gamma, angle)` turns the device's tilt angles into a roll about the screen's
//       own vertical axis for the way the screen is held (0, 90, 180 or 270 degrees), positive = right side down;
//       `tiltAmount(roll, neutral, invert, fullDeg)` is a signed 0..1 turn from the knob TILT_DEAD_DEG (no turn
//       inside it) to `fullDeg` (a full-rate turn; the player picks it from TILT_RANGES_DEG). The sim takes the
//       amount as an analog turn (`Input.turn`), so a part tilt is a slower turn, not a stuttering one.
//       `tiltReadout` formats the numbers the HUD shows while tilt is on, so a tester can quote them. DOM part:
//       `TiltSensor` listens, keeps the last roll, and asks for permission where the browser wants it (iOS Safari:
//       `requestPermission()` must run inside a touch handler, so arming it makes the next tap ask). Prefs (on,
//       invert, range, autoLevel) persist under one guarded key.
// LORE: G1 (how to play)

import { loadJson, saveJson } from '../game/persistence';
import { MG } from './config';

/**
 * Roll about the screen's vertical axis, degrees, positive when the screen's right edge dips.
 * `angle` is screen.orientation.angle (0 upright, 90 turned counter-clockwise, 270 clockwise, 180 upside down).
 * Example: screenRoll(0, 20, 0) = 20; screenRoll(20, 0, 90) = 20; screenRoll(20, 0, 270) = -20.
 */
export function screenRoll(beta: number, gamma: number, angle: number): number {
  const a = (((Math.round(angle / 90) * 90) % 360) + 360) % 360;
  if (a === 90) return beta;
  if (a === 270) return -beta;
  if (a === 180) return -gamma;
  return gamma;
}

/**
 * Signed turn amount -1..1 from a roll (degrees) relative to `neutral`: 0 inside TILT_DEAD_DEG, rising linearly to
 * 1 at `fullDeg`. Negative turns left. Example (dead 6, full 24): tiltAmount(15, 0, false, 24) = 0.5;
 * tiltAmount(3, 0, false, 24) = 0; tiltAmount(-40, 0, false, 24) = -1; tiltAmount(15, 0, true, 24) = -0.5.
 */
export function tiltAmount(roll: number, neutral: number, invert: boolean, fullDeg: number): number {
  const d = (roll - neutral) * (invert ? -1 : 1);
  const span = Math.max(1e-9, fullDeg - MG.TILT_DEAD_DEG);
  const mag = Math.min(1, Math.max(0, (Math.abs(d) - MG.TILT_DEAD_DEG) / span));
  return Math.sign(d) * mag;
}

/**
 * The HUD line while tilt is on: the roll from level (degrees, signed), the turn it gives (L / R and the amount),
 * the range in use and how the screen is held. Example: tiltReadout(14, 0, 0.42, 24, 90) = "TILT +14  R 0.42  /24  SIDE".
 */
export function tiltReadout(roll: number, neutral: number, amount: number, fullDeg: number, angle: number): string {
  const d = Math.round(roll - neutral);
  const dir = amount === 0 ? '-' : amount < 0 ? 'L' : 'R';
  const held = (((Math.round(angle / 90) * 90) % 360) + 360) % 360 === 0 ? 'UP' : 'SIDE';
  return `TILT ${d >= 0 ? '+' : ''}${d}  ${dir} ${Math.abs(amount).toFixed(2)}  /${fullDeg}  ${held}`;
}

export interface TiltPrefs {
  on: boolean;
  invert: boolean;
  /** Index into MG.TILT_RANGES_DEG: the roll that gives a full-rate turn. */
  range: number;
  /** Take the phone's angle at the start of a game as level (else only TILT: LEVEL IS HERE does). */
  autoLevel: boolean;
}

const TILT_KEY = 'minigame.tilt';
const DEFAULT_PREFS: TiltPrefs = { on: false, invert: false, range: MG.TILT_RANGE_DEFAULT, autoLevel: true };
const isTiltPrefs = (v: unknown): v is TiltPrefs =>
  typeof v === 'object' && v !== null
  && typeof (v as { on?: unknown }).on === 'boolean' && typeof (v as { invert?: unknown }).invert === 'boolean'
  && typeof (v as { range?: unknown }).range === 'number' && Number.isInteger((v as { range: number }).range)
  && (v as { range: number }).range >= 0 && (v as { range: number }).range < MG.TILT_RANGES_DEG.length
  && typeof (v as { autoLevel?: unknown }).autoLevel === 'boolean';
// NOTE: a pref saved by the first round (on, invert only) is upgraded rather than dropped, so a tester's ON survives.
const isOldPrefs = (v: unknown): v is Pick<TiltPrefs, 'on' | 'invert'> =>
  typeof v === 'object' && v !== null && typeof (v as { on?: unknown }).on === 'boolean' && typeof (v as { invert?: unknown }).invert === 'boolean';
export function loadTiltPrefs(): TiltPrefs {
  const full = loadJson<TiltPrefs | null>(TILT_KEY, (v): v is TiltPrefs | null => v === null || isTiltPrefs(v), null);
  if (full) return full;
  const old = loadJson<Pick<TiltPrefs, 'on' | 'invert'> | null>(TILT_KEY, (v): v is Pick<TiltPrefs, 'on' | 'invert'> | null => v === null || isOldPrefs(v), null);
  return old ? { ...DEFAULT_PREFS, on: old.on, invert: old.invert } : { ...DEFAULT_PREFS };
}
export const saveTiltPrefs = (p: TiltPrefs): boolean => saveJson(TILT_KEY, p);
/** The full-turn roll for a prefs record, degrees. */
export const tiltFullDeg = (p: TiltPrefs): number => MG.TILT_RANGES_DEG[p.range] ?? MG.TILT_RANGES_DEG[MG.TILT_RANGE_DEFAULT] ?? 24;

type PermissionFn = () => Promise<'granted' | 'denied'>;

/** The browser side: the last roll, whether readings arrive, and the permission dance. */
export class TiltSensor {
  /** Last roll, degrees, or null before the first reading. */
  roll: number | null = null;
  /** The roll that counts as level (CALIBRATE sets it to the current one). */
  neutral = 0;
  /** The screen's orientation angle at the last reading (0 upright), for the readout. */
  angle = 0;
  /** 'idle' (not asked), 'waiting' (next tap asks), 'granted', 'denied', 'none' (no sensor in this browser). */
  state: 'idle' | 'waiting' | 'granted' | 'denied' | 'none' = 'idle';
  private listening = false;

  constructor() {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
      this.state = 'none';
      return;
    }
    if (typeof (window as { DeviceOrientationEvent?: unknown }).DeviceOrientationEvent === 'undefined') this.state = 'none';
    // NOTE: iOS only shows its motion prompt for a call made inside a user gesture; the frame loop is not one.
    window.addEventListener('touchend', () => {
      if (this.state === 'waiting') this.ask();
    }, { passive: true });
  }

  /** True when this browser needs a permission prompt before readings arrive (iOS 13 and later). */
  private permissionFn(): PermissionFn | null {
    const D = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: PermissionFn } }).DeviceOrientationEvent;
    return D && typeof D.requestPermission === 'function' ? D.requestPermission.bind(D) : null;
  }

  /** Turn tilt on: listen now, or arm the prompt for the next tap. Returns the state after the call. */
  start(): TiltSensor['state'] {
    if (this.state === 'none' || this.state === 'denied') return this.state;
    if (this.permissionFn() && this.state !== 'granted') {
      this.state = 'waiting';
      return this.state;
    }
    this.listen();
    this.state = 'granted';
    return this.state;
  }

  private ask(): void {
    const fn = this.permissionFn();
    if (!fn) return;
    fn().then(
      (r) => {
        this.state = r === 'granted' ? 'granted' : 'denied';
        if (r === 'granted') this.listen();
      },
      () => (this.state = 'denied'),
    );
  }

  private listen(): void {
    if (this.listening) return;
    this.listening = true;
    window.addEventListener('deviceorientation', (e) => {
      if (e.beta === null || e.gamma === null) return;
      const angle = typeof screen !== 'undefined' && screen.orientation ? screen.orientation.angle : ((window as { orientation?: number }).orientation ?? 0);
      this.angle = angle;
      this.roll = screenRoll(e.beta, e.gamma, angle);
    });
  }

  /** The current roll becomes level. */
  calibrate(): void {
    if (this.roll !== null) this.neutral = this.roll;
  }
}
