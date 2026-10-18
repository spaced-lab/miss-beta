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
  private typedBuffer = '';
  private readonly listeners: Array<(ch: string) => void> = [];
  /** Printable characters and control keys that went down this frame, in order (for text entry). */
  private keyEvents: string[] = [];
  /** When true, keydown events are not prevented for text keys (console typing); Space still is. */
  textMode = false;
  private wheelAcc = 0;
  private dragAcc = { x: 0, y: 0 };
  private dragging = false;
  private lastMouse = { x: 0, y: 0 };

  constructor(target: Window = window) {
    target.addEventListener('keydown', (e) => {
      // Keep the page from scrolling or triggering browser shortcuts on game keys.
      if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) e.preventDefault();
      if (!this.down.has(e.code)) this.edge.add(e.code);
      this.down.add(e.code);
      if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter') this.keyEvents.push(e.key);
      if (e.key.length === 1 && /[a-z0-9]/i.test(e.key)) {
        this.typedBuffer = (this.typedBuffer + e.key.toUpperCase()).slice(-24);
        for (const l of this.listeners) l(e.key.toUpperCase());
      }
    });
    target.addEventListener('keyup', (e) => this.down.delete(e.code));
    target.addEventListener('blur', () => {
      this.down.clear();
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
    this.keyEvents.length = 0;
  }
}
