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
      // With the soft keyboard up its field delivers characters and backspaces (below); only Enter comes from here.
      const soft = this.soft !== null;
      if ((e.key.length === 1 && !soft) || (e.key === 'Backspace' && !soft) || e.key === 'Enter') this.keyEvents.push(e.key);
      if (e.key.length === 1 && !soft && /[a-z0-9]/i.test(e.key)) {
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
      this.touchUsed = true;
      if (t.length === 1) {
        const a = t[0] as Touch;
        this.mouse = { x: a.clientX, y: a.clientY };
        this.downAt = { x: a.clientX, y: a.clientY };
      } else this.downAt = null;
      if (t.length >= 2) this.multiTap = true;
      if (t.length === 1) {
        this.dragging = true;
        this.lastMouse = { x: (t[0] as Touch).clientX, y: (t[0] as Touch).clientY };
      } else if (t.length === 2) {
        this.dragging = false;
        pinch = dist(t);
      }
      // NOTE: not passive: the default action of a touch on the canvas is a long-press selection / callout or a
      // browser gesture, never anything the game wants (owner 2026-10-21: the whole screen got selected in PERIMETER).
      if (e.cancelable) e.preventDefault();
    }, { passive: false });
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
      // NOTE: iOS raises the soft keyboard only for a focus() made inside a touch handler, so a tap while the
      // field is wanted focuses it here (the frame loop's own focus() is enough on Android).
      if (this.soft && document.activeElement !== this.soft) this.soft.focus();
      this.setTouches(e.touches);
      if (e.touches.length === 0) this.dragging = false;
      pinch = 0;
      // NOTE: a tap is a click, read from the touch itself. Phones (iOS Safari above all) do not send the emulated
      // mouse events to a window listener over a plain canvas, so taps never reached the game and the first-boot
      // photosensitivity notice could not be passed on a phone (owner 2026-10-20). preventDefault stops the
      // emulated mouse events where a browser does send them, so one tap is never two clicks.
      const a = e.changedTouches[0];
      if (a && e.touches.length === 0 && this.downAt && Math.hypot(a.clientX - this.downAt.x, a.clientY - this.downAt.y) < 12) {
        this.click = { x: a.clientX, y: a.clientY };
        this.mouse = { x: a.clientX, y: a.clientY };
        if (e.cancelable) e.preventDefault();
      }
      this.downAt = null;
    }, { passive: false });
  }

  /** True on a touch-first device (coarse pointer) or once the player has touched the screen: screens show touch
   *  hints and on-screen controls. */
  touchUsed = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

  /** Last pointer position in CSS px (the canvas fills the window), or null before the mouse moved. */
  mouse: { x: number; y: number } | null = null;
  private downAt: { x: number; y: number } | null = null;
  private click: { x: number; y: number } | null = null;

  /** The click since the last takeClick, without clearing it. */
  peekClick(): { x: number; y: number } | null {
    return this.click;
  }

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

  /** Press a logical code for one frame, as if the player had: AUTOPLAY (game/autoplay.ts, not `real`) and the
   *  on-screen buttons (ui/actionBar.ts, `real`: a tap is the player, so it can take control back from AUTOPLAY). */
  inject(code: string, real = false): void {
    this.edge.add(code);
    if (real) this.real = true;
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

  /** The hidden text field behind the soft keyboard (phones), or null. */
  private soft: HTMLInputElement | null = null;
  private softVal = '';
  /**
   * Phones have no keys for the console or a search: a hidden text field raises the soft keyboard while `on`, and
   * what is typed in it reaches takeKeyEvents() and typed() like key presses (characters and backspaces from its
   * input events, Enter from its keydown). Off removes the field and the keyboard.
   */
  softKeyboard(on: boolean): void {
    if (typeof document === 'undefined') return;
    if (!on) {
      if (this.soft) {
        this.soft.blur();
        this.soft.remove();
        this.soft = null;
      }
      return;
    }
    if (this.soft) return;
    const el = document.createElement('input');
    el.type = 'text';
    el.autocapitalize = 'characters';
    el.autocomplete = 'off';
    el.spellcheck = false;
    el.setAttribute('aria-label', 'text entry');
    // 16 px keeps iOS from zooming the page on focus; the field itself is a dot in the corner.
    el.style.cssText = 'position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:0.01;border:0;padding:0;margin:0;font-size:16px;background:transparent;color:transparent;';
    el.addEventListener('input', () => {
      const v = el.value;
      const old = this.softVal;
      let common = 0;
      while (common < v.length && common < old.length && v[common] === old[common]) common++;
      for (let i = 0; i < old.length - common; i++) this.keyEvents.push('Backspace');
      for (const ch of v.slice(common)) {
        if (ch === '\n') continue;
        this.keyEvents.push(ch);
        if (/[a-z0-9]/i.test(ch)) {
          this.typedBuffer = (this.typedBuffer + ch.toUpperCase()).slice(-24);
          for (const l of this.listeners) l(ch.toUpperCase());
        }
      }
      this.softVal = v;
      // Keep the field short: it only relays keystrokes.
      if (v.length > 120) {
        el.value = '';
        this.softVal = '';
      }
    });
    document.body.appendChild(el);
    this.soft = el;
    this.softVal = '';
    el.focus();
  }
  /** True while the soft keyboard's field exists. */
  get softOpen(): boolean {
    return this.soft !== null;
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
