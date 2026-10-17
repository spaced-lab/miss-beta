// WHAT: Keyboard state tracker with per-frame edge detection.
// WHY:  Screens need "is held" (move, fire) and "went down this frame" (pulse, menu select). Reading
//       DOM events directly inside screens makes them untestable; this class is the only listener.
// HOW:  Tracks KeyboardEvent.code (layout independent). `pressed()` is true once per key-down until
//       `endFrame()` clears the edge set. Typed characters are also exposed for cheat-code entry.
// LORE: G2 (screens and HUD)

export class Input {
  private readonly down = new Set<string>();
  private readonly edge = new Set<string>();
  private typedBuffer = '';
  private readonly listeners: Array<(ch: string) => void> = [];

  constructor(target: Window = window) {
    target.addEventListener('keydown', (e) => {
      // Keep the page from scrolling or triggering browser shortcuts on game keys.
      if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      if (!this.down.has(e.code)) this.edge.add(e.code);
      this.down.add(e.code);
      if (e.key.length === 1 && /[a-z0-9]/i.test(e.key)) {
        this.typedBuffer = (this.typedBuffer + e.key.toUpperCase()).slice(-24);
        for (const l of this.listeners) l(e.key.toUpperCase());
      }
    });
    target.addEventListener('keyup', (e) => this.down.delete(e.code));
    target.addEventListener('blur', () => this.down.clear());
  }

  held(code: string): boolean {
    return this.down.has(code);
  }

  anyHeld(...codes: string[]): boolean {
    return codes.some((c) => this.down.has(c));
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

  /** Call once per frame after screens have read the edges. */
  endFrame(): void {
    this.edge.clear();
  }
}
