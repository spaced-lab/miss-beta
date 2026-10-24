// WHAT: TILT STEER for PERIMETER: tip the phone left or right to turn the launchers, the device's motion sensor
//       read through the browser's deviceorientation event; and SHAKE TO PULSE, a jerk read from devicemotion.
// WHY:  Owner 2026-10-23: "see if you can do anything for minigame to work with gyroscope". A phone has the sensor
//       and the web exposes it (DeviceOrientationEvent); turning by tilt frees the left thumb, so only FIRE and the
//       weapons stay on the screen. Tuned by rounds of owner tests on a real phone (docs/TILT_EXPERIMENTS.md).
// HOW:  Pure part: `screenRoll(beta, gamma, angle)` turns the device's tilt angles into a roll about the screen's
//       own vertical axis for the way the screen is held (0, 90, 180 or 270 degrees), positive = right side down;
//       `tiltAmount(roll, neutral, invert, fullDeg)` is a signed 0..1 turn from the knob TILT_DEAD_DEG (no turn
//       inside it) to `fullDeg` (a full-rate turn; the player picks it from TILT_RANGES_DEG). The sim takes the
//       amount as an analog turn (`Input.turn`), so a part tilt is a slower turn, not a stuttering one.
//       `tiltReadout` formats the numbers the HUD shows while tilt is on, so a tester can quote them. `shakeStep`
//       turns a stream of acceleration magnitudes into pulse edges (over SHAKE_ACCEL, then a cooldown). DOM part:
//       `TiltSensor` listens to both events, keeps the last roll and the last second's peak acceleration, and asks
//       for permission where the browser wants it (iOS Safari: `requestPermission()` must run inside a touch handler,
//       so arming it makes the next tap ask; orientation and motion are asked in turn, one prompt covers both).
//       Prefs (on, invert, range, autoLevel, shake) persist under one guarded key; older records are filled in.
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
 * the range in use, how the screen is held and, with `peak`, the last second's peak acceleration (m/s^2) for SHAKE TO
 * PULSE. Example: tiltReadout(14, 0, 0.42, 24, 90) = "TILT +14  R 0.42  /24  SIDE"; with peak 3.2, "...  SIDE  A 3".
 */
export function tiltReadout(roll: number, neutral: number, amount: number, fullDeg: number, angle: number, peak?: number): string {
  const d = Math.round(roll - neutral);
  const dir = amount === 0 ? '-' : amount < 0 ? 'L' : 'R';
  const held = (((Math.round(angle / 90) * 90) % 360) + 360) % 360 === 0 ? 'UP' : 'SIDE';
  const a = peak === undefined ? '' : `  A ${peak.toFixed(0)}`;
  return `TILT ${d >= 0 ? '+' : ''}${d}  ${dir} ${Math.abs(amount).toFixed(2)}  /${fullDeg}  ${held}${a}`;
}

/**
 * Shake detector state and step: `fire` is true on the reading whose magnitude (m/s^2, gravity removed) crosses
 * `threshold` while no cooldown is running; `until` is the time the cooldown ends. Example (threshold 14, cooldown
 * 0.8): shakeStep({ until: 0 }, 20, 1.0, 14, 0.8) = { fire: true, until: 1.8 }; then 25 at t = 1.5 does not fire.
 */
export function shakeStep(state: { until: number }, magnitude: number, t: number, threshold: number, cooldown: number): { fire: boolean; until: number } {
  if (t < state.until || magnitude < threshold) return { fire: false, until: state.until };
  return { fire: true, until: t + cooldown };
}

export interface TiltPrefs {
  on: boolean;
  invert: boolean;
  /** Index into MG.TILT_RANGES_DEG: the roll that gives a full-rate turn. */
  range: number;
  /** Take the phone's angle at the start of a game as level (else only TILT: LEVEL IS HERE does). */
  autoLevel: boolean;
  /** SHAKE TO PULSE: a jerk fires a pulse (round 2). */
  shake: boolean;
}

const TILT_KEY = 'minigame.tilt';
const DEFAULT_PREFS: TiltPrefs = { on: false, invert: false, range: MG.TILT_RANGE_DEFAULT, autoLevel: true, shake: true };
/** Any record with the two round-1 booleans; later fields are checked where present and filled in where not. */
const isPrefsRecord = (v: unknown): v is Partial<TiltPrefs> & Pick<TiltPrefs, 'on' | 'invert'> => {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  if (typeof o.on !== 'boolean' || typeof o.invert !== 'boolean') return false;
  if (o.range !== undefined && !(typeof o.range === 'number' && Number.isInteger(o.range) && o.range >= 0 && o.range < MG.TILT_RANGES_DEG.length)) return false;
  if (o.autoLevel !== undefined && typeof o.autoLevel !== 'boolean') return false;
  if (o.shake !== undefined && typeof o.shake !== 'boolean') return false;
  return true;
};
// NOTE: a pref saved by an earlier round is upgraded rather than dropped, so a tester's ON survives each round.
export function loadTiltPrefs(): TiltPrefs {
  const rec = loadJson<(Partial<TiltPrefs> & Pick<TiltPrefs, 'on' | 'invert'>) | null>(TILT_KEY, (v): v is (Partial<TiltPrefs> & Pick<TiltPrefs, 'on' | 'invert'>) | null => v === null || isPrefsRecord(v), null);
  return rec ? { ...DEFAULT_PREFS, ...rec } : { ...DEFAULT_PREFS };
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
  /** Peak acceleration without gravity (m/s^2) over the last second, for the readout; 0 before any motion reading. */
  peak = 0;
  private peakAt = 0;
  private shakeState = { until: 0 };
  private shakes = 0;
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
  private permissionFn(kind: 'DeviceOrientationEvent' | 'DeviceMotionEvent' = 'DeviceOrientationEvent'): PermissionFn | null {
    const D = (window as unknown as Record<string, { requestPermission?: PermissionFn } | undefined>)[kind];
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
        // NOTE: iOS shows one "Motion & Orientation" prompt; asking the motion class too costs nothing where the
        // first grant already covers it, and is needed where it does not.
        const m = this.permissionFn('DeviceMotionEvent');
        if (r === 'granted' && m) m().then(() => undefined, () => undefined);
      },
      () => (this.state = 'denied'),
    );
  }

  /** The acceleration magnitude without gravity from a motion event (falls back to the with-gravity vector minus 1 g). */
  private static magnitude(e: DeviceMotionEvent): number | null {
    const a = e.acceleration;
    if (a && a.x !== null && a.y !== null && a.z !== null) return Math.hypot(a.x, a.y, a.z);
    const g = e.accelerationIncludingGravity;
    if (g && g.x !== null && g.y !== null && g.z !== null) return Math.abs(Math.hypot(g.x, g.y, g.z) - 9.81);
    return null;
  }

  /** True once per detected shake since the last call (the screen turns it into a pulse edge). */
  takeShake(): boolean {
    const n = this.shakes;
    this.shakes = 0;
    return n > 0;
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
    window.addEventListener('devicemotion', (e) => {
      const m = TiltSensor.magnitude(e);
      if (m === null) return;
      const t = performance.now() / 1000;
      if (m >= this.peak || t - this.peakAt > 1) {
        this.peak = m;
        this.peakAt = t;
      }
      const r = shakeStep(this.shakeState, m, t, MG.SHAKE_ACCEL, MG.SHAKE_COOLDOWN_S);
      this.shakeState = { until: r.until };
      if (r.fire) this.shakes++;
    });
  }

  /** The current roll becomes level. */
  calibrate(): void {
    if (this.roll !== null) this.neutral = this.roll;
  }
}
