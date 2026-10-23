// WHAT: TILT STEER for PERIMETER: tip the phone left or right to turn the launchers, the device's motion sensor
//       read through the browser's deviceorientation event.
// WHY:  Owner 2026-10-23: "see if you can do anything for minigame to work with gyroscope". A phone has the sensor
//       and the web exposes it (DeviceOrientationEvent); turning by tilt frees the left thumb, so only FIRE and the
//       weapons stay on the screen.
// HOW:  Pure part: `screenRoll(beta, gamma, angle)` turns the device's tilt angles into a roll about the screen's
//       own vertical axis for the way the screen is held (0, 90, 180 or 270 degrees), positive = right side down;
//       `tiltAmount(roll, neutral, invert)` is a signed 0..1 turn from the knobs TILT_DEAD_DEG (no turn inside it)
//       to TILT_FULL_DEG (full turn); `tiltPwm(acc, amount)` spreads a part turn over frames (0.4 = turning on
//       four frames in ten), since the sim's turn input is on or off. DOM part: `TiltSensor` listens, keeps the last
//       roll, and asks for permission where the browser wants it (iOS Safari: `requestPermission()` must run inside
//       a touch handler, so arming it makes the next tap ask). Prefs (on, invert) persist under one guarded key.
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
 * 1 at TILT_FULL_DEG. Negative turns left. Example (dead 6, full 24): tiltAmount(15, 0, false) = 0.5;
 * tiltAmount(3, 0, false) = 0; tiltAmount(-40, 0, false) = -1; tiltAmount(15, 0, true) = -0.5.
 */
export function tiltAmount(roll: number, neutral: number, invert: boolean): number {
  const d = (roll - neutral) * (invert ? -1 : 1);
  const mag = Math.min(1, Math.max(0, (Math.abs(d) - MG.TILT_DEAD_DEG) / (MG.TILT_FULL_DEG - MG.TILT_DEAD_DEG)));
  return Math.sign(d) * mag;
}

/**
 * Pulse-width turning: add |amount| to the accumulator and turn this frame when it reaches 1.
 * Example: amount 0.5 from acc 0 turns on every second frame; amount 1 turns on every frame; 0 resets.
 */
export function tiltPwm(acc: number, amount: number): { on: boolean; acc: number } {
  const m = Math.abs(amount);
  if (m === 0) return { on: false, acc: 0 };
  const next = acc + m;
  return next >= 1 ? { on: true, acc: next - 1 } : { on: false, acc: next };
}

export interface TiltPrefs {
  on: boolean;
  invert: boolean;
}

const TILT_KEY = 'minigame.tilt';
export const isTiltPrefs = (v: unknown): v is TiltPrefs => typeof v === 'object' && v !== null && typeof (v as { on?: unknown }).on === 'boolean' && typeof (v as { invert?: unknown }).invert === 'boolean';
export const loadTiltPrefs = (): TiltPrefs => loadJson(TILT_KEY, isTiltPrefs, { on: false, invert: false });
export const saveTiltPrefs = (p: TiltPrefs): boolean => saveJson(TILT_KEY, p);

type PermissionFn = () => Promise<'granted' | 'denied'>;

/** The browser side: the last roll, whether readings arrive, and the permission dance. */
export class TiltSensor {
  /** Last roll, degrees, or null before the first reading. */
  roll: number | null = null;
  /** The roll that counts as level (CALIBRATE sets it to the current one). */
  neutral = 0;
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
      this.roll = screenRoll(e.beta, e.gamma, angle);
    });
  }

  /** The current roll becomes level. */
  calibrate(): void {
    if (this.roll !== null) this.neutral = this.roll;
  }
}
