// WHAT: Keyboard state tracker with per-frame edge detection.
// WHY:  Screens need "is held" (move, fire) and "went down this frame" (pulse, menu select). Reading
//       DOM events directly inside screens makes them untestable; this class is the only listener.
// HOW:  Tracks KeyboardEvent.code (layout independent). `pressed()` is true once per key-down until
//       `endFrame()` clears the edge set. Typed characters are also exposed for cheat-code entry.
// LORE: G2 (screens and HUD)

import { padCodes } from './gamepad';

export class Input {
  private readonly down = new Set<string>();
  private readonly edge = new Set<string>();
  /** Physical code -> the logical code it went down as, while held. */
  private readonly physical = new Map<string, string>();
  private typedBuffer = '';
  private readonly listeners: Array<(ch: string) => void> = [];
  /** Printable characters and control keys that went down this frame, in order (for text entry). */
  private keyEvents: string[] = [];
  /** When true, keydown events are not prevented for text keys (console typing); Space still is. */
  textMode = false;
  /** Physical -> logical key codes from OPTIONS > KEYS (game/keybinds.ts); off while typing text. */
  remap: Map<string, string> = new Map();
  private code(c: string): string {
    return this.textMode ? c : this.remap.get(c) ?? c;
  }
  private wheelAcc = 0;
  private dragAcc = { x: 0, y: 0 };
  private dragging = false;
  private lastMouse = { x: 0, y: 0 };

  constructor(target: Window = window) {
    target.addEventListener('keydown', (e) => {
      // Keep the page from scrolling or triggering browser shortcuts on game keys.
      if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) e.preventDefault();
      // NOTE: F keys are prevented only when the player bound one (otherwise F5 still reloads the page).
      if (this.remap.has(e.code) && e.code.startsWith('F')) e.preventDefault();
      // NOTE: a held key keeps the logical code it went down as (key repeat included), and keyup releases that
      // code: opening the console or changing the remap while a key was held left it stuck down (code review
      // 2026-10-18).
      const code = this.physical.get(e.code) ?? this.code(e.code);
      this.physical.set(e.code, code);
      this.lastRaw = e.code;
      this.real = true;
      if (!this.down.has(code)) this.edge.add(code);
      this.down.add(code);
      if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter') this.keyEvents.push(e.key);
      if (e.key.length === 1 && /[a-z0-9]/i.test(e.key)) {
        this.typedBuffer = (this.typedBuffer + e.key.toUpperCase()).slice(-24);
        for (const l of this.listeners) l(e.key.toUpperCase());
      }
    });
    target.addEventListener('keyup', (e) => {
      this.down.delete(this.physical.get(e.code) ?? this.code(e.code));
      this.physical.delete(e.code);
    });
    target.addEventListener('blur', () => {
      this.down.clear();
      this.physical.clear();
      this.dragging = false;
    });
    target.addEventListener('wheel', (e) => {
      this.wheelAcc += e.deltaY;
      e.preventDefault();
    }, { passive: false });
    target.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this.dragging = true;
      this.lastMouse = { x: e.clientX, y: e.clientY };
      this.downAt = { x: e.clientX, y: e.clientY };
    });
    target.addEventListener('mousemove', (e) => {
      this.mouse = { x: e.clientX, y: e.clientY };
      if (!this.dragging) return;
      this.dragAcc.x += e.clientX - this.lastMouse.x;
      this.dragAcc.y += e.clientY - this.lastMouse.y;
      this.lastMouse = { x: e.clientX, y: e.clientY };
    });
    target.addEventListener('mouseup', (e) => {
      this.dragging = false;
      // A click is a press and release that barely moved (a drag pans instead).
      if (this.downAt && Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y) < 5) this.click = { x: e.clientX, y: e.clientY };
      this.downAt = null;
    });
    // Touch (GAME_PLAN 13 mouse/touch): one finger pans, two fingers pinch-zoom (folded into the wheel
    // accumulator so screens need no new code: zoom = exp(-wheel * 0.0015), so wheel = -ln(ratio) / 0.0015).
    let pinch = 0;
    const dist = (t: TouchList): number => (t.length < 2 ? 0 : Math.hypot((t[0] as Touch).clientX - (t[1] as Touch).clientX, (t[0] as Touch).clientY - (t[1] as Touch).clientY));
    target.addEventListener('touchstart', (e) => {
      const t = e.touches;
      this.setTouches(t);
      if (t.length >= 2) this.multiTap = true;
      if (t.length === 1) {
        this.dragging = true;
        this.lastMouse = { x: (t[0] as Touch).clientX, y: (t[0] as Touch).clientY };
      } else if (t.length === 2) {
        this.dragging = false;
        pinch = dist(t);
      }
    }, { passive: true });
    target.addEventListener('touchmove', (e) => {
      const t = e.touches;
      this.setTouches(t);
      if (t.length === 1 && this.dragging) {
        const a = t[0] as Touch;
        this.dragAcc.x += a.clientX - this.lastMouse.x;
        this.dragAcc.y += a.clientY - this.lastMouse.y;
        this.lastMouse = { x: a.clientX, y: a.clientY };
      } else if (t.length === 2 && pinch > 0) {
        const d = dist(t);
        if (d > 0) this.wheelAcc += -Math.log(d / pinch) / 0.0015;
        pinch = d;
      }
      e.preventDefault();
    }, { passive: false });
    target.addEventListener('touchend', (e) => {
      this.setTouches(e.touches);
      if (e.touches.length === 0) this.dragging = false;
      pinch = 0;
    });
  }

  /** Last pointer position in CSS px (the canvas fills the window), or null before the mouse moved. */
  mouse: { x: number; y: number } | null = null;
  private downAt: { x: number; y: number } | null = null;
  private click: { x: number; y: number } | null = null;

  /** The click since the last call, or null. Clears it. */
  takeClick(): { x: number; y: number } | null {
    const c = this.click;
    this.click = null;
    return c;
  }

  /** Accumulated wheel delta since the last call (positive = scroll down). Clears it. */
  takeWheel(): number {
    const v = this.wheelAcc;
    this.wheelAcc = 0;
    return v;
  }

  /** Accumulated left-drag motion in CSS px since the last call. Clears it. */
  takeDrag(): { x: number; y: number } {
    const v = { ...this.dragAcc };
    this.dragAcc.x = 0;
    this.dragAcc.y = 0;
    return v;
  }

  held(code: string): boolean {
    return this.down.has(code);
  }

  anyHeld(...codes: string[]): boolean {
    return codes.some((c) => this.down.has(c));
  }

  /** True if any key went down this frame (used to unlock audio on a user gesture). */
  anyKeyPressed(): boolean {
    return this.edge.size > 0;
  }

  /** AUTOPLAY: press a logical code for one frame, as if the player had (game/autoplay.ts). */
  inject(code: string): void {
    this.edge.add(code);
  }
  private real = false;
  /** True when a physical key went down this frame (AUTOPLAY hands control back on one). */
  realKey(): boolean {
    return this.real;
  }

  /** The physical code of the latest key-down (OPTIONS > KEYS listens to this while waiting for a key). */
  lastRaw = '';

  /** True on the first frame a key is down. */
  pressed(code: string): boolean {
    return this.edge.has(code);
  }

  anyPressed(...codes: string[]): boolean {
    return codes.some((c) => this.edge.has(c));
  }

  /** Last 24 alphanumeric characters typed, upper-cased. Cheat codes match against the tail. */
  typed(): string {
    return this.typedBuffer;
  }

  clearTyped(): void {
    this.typedBuffer = '';
  }

  onTyped(fn: (ch: string) => void): void {
    this.listeners.push(fn);
  }

  /** Text entry: the keys pressed this frame (single characters, 'Backspace', 'Enter'). */
  takeKeyEvents(): string[] {
    const v = this.keyEvents;
    this.keyEvents = [];
    return v;
  }

  /** Active touch points in CSS px (screens that want direct touch, like PERIMETER, read these). */
  touchPoints: { x: number; y: number }[] = [];
  private multiTap = false;
  private setTouches(t: TouchList): void {
    this.touchPoints = Array.from({ length: t.length }, (_, i) => ({ x: (t[i] as Touch).clientX, y: (t[i] as Touch).clientY }));
  }
  /** True once after a touch began with two or more fingers down. */
  takeMultiTap(): boolean {
    const v = this.multiTap;
    this.multiTap = false;
    return v;
  }

  private padHeld = new Set<string>();
  /** Poll connected gamepads (call once per frame before screens update): pad buttons act as their key codes. */
  pollGamepads(): void {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    const pads = nav && typeof nav.getGamepads === 'function' ? nav.getGamepads() : [];
    const now = new Set<string>();
    for (const pad of pads) if (pad) for (const c of padCodes(pad.buttons, pad.axes)) now.add(c);
    for (const c of now) if (!this.padHeld.has(c)) {
      if (!this.down.has(c)) this.edge.add(c);
      this.down.add(c);
    }
    for (const c of this.padHeld) if (!now.has(c)) this.down.delete(c);
    this.padHeld = now;
  }

  /** Call once per frame after screens have read the edges. */
  endFrame(): void {
    this.edge.clear();
    this.real = false;
    this.keyEvents.length = 0;
  }
}
