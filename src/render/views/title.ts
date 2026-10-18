// WHAT: Title / menu screen: the MISS ∝ β logo, a slow attract orbit sketch, and the menu.
// WHY:  GAME_PLAN 13.1. For now the menu offers the minigame and marks the rest BUILDING; the real
//       attract mode (a round resolving itself) arrives with M1.
// HOW:  Menu navigation by arrows + Enter, or the first letter of an item. The orbit sketch is a cheap
//       four-ring drawing with fake periods; it is replaced by kepler.ts output in M0.
// LORE: G2 (screens and HUD), G8 (the look)

import { hasSavedRun, loadRun } from '../../game/savegame';
import type { Router, Screen } from '../../game/screen';
import type { SystemScreen } from './system';
import type { Input } from '../../ui/input';
import type { Surface } from '../canvas';
import { drawText } from '../vectorFont';

interface Item {
  label: string;
  hotkey: string;
  action: (() => void) | null;
}

export class TitleScreen implements Screen {
  private sel = 0;
  private t = 0;
  private note = '';
  private noteT = 0;
  private readonly items: Item[];

  constructor(private readonly s: Surface, private readonly keys: Input, router: Router, private readonly getSystem: () => SystemScreen | null = () => null) {
    this.items = [
      { label: 'NEW RUN', hotkey: 'KeyN', action: () => router.go('system') },
      {
        label: 'CONTINUE',
        hotkey: 'KeyC',
        action: () => {
          const run = loadRun();
          const sys = this.getSystem();
          if (!run || !sys) {
            this.note = run ? 'CONTINUE UNAVAILABLE' : 'NO SAVED RUN. START A NEW RUN OR DROP A SAVE.MD HERE.';
            this.noteT = 2.5;
            return;
          }
          router.go('system');
          sys.resume(run);
        },
      },
      { label: 'PERIMETER  (ARCADE MINIGAME)', hotkey: 'KeyP', action: () => router.go('minigame') },
      { label: 'CODEX', hotkey: 'KeyX', action: () => router.go('codex') },
      { label: 'LEADERBOARD', hotkey: 'KeyB', action: () => router.go('leaderboard') },
      { label: 'HOW TO PLAY', hotkey: 'KeyH', action: () => router.go('help') },
      { label: 'LEARN', hotkey: 'KeyL', action: null },
      { label: 'OPTIONS', hotkey: 'KeyO', action: null },
    ];
  }

  enter(): void {
    this.sel = 0;
  }
  exit(): void {}

  update(dtMs: number): void {
    this.t += dtMs / 1000;
    this.noteT = Math.max(0, this.noteT - dtMs / 1000);
    const k = this.keys;
    if (k.pressed('ArrowUp') || k.pressed('KeyW')) this.sel = (this.sel + this.items.length - 1) % this.items.length;
    if (k.pressed('ArrowDown') || k.pressed('KeyS')) this.sel = (this.sel + 1) % this.items.length;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      if (it && k.pressed(it.hotkey)) {
        this.sel = i;
        this.activate();
      }
    }
    if (k.pressed('Enter') || k.pressed('Space')) this.activate();
  }

  private activate(): void {
    const it = this.items[this.sel];
    if (!it) return;
    if (it.action) it.action();
    else {
      this.note = `${it.label} IS STILL BUILDING. SEE STATUS.MD`;
      this.noteT = 2.5;
    }
  }

  render(): void {
    const s = this.s;
    const p = s.palette;
    s.clear();
    const cx = s.width / 2;
    const cy = s.height / 2;

    // Attract sketch: four dim rings and moving dots with made-up periods (replaced in M0).
    const R = Math.min(s.width, s.height) * 0.42;
    const rings = [0.18, 0.26, 0.4, 0.95];
    const periods = [0.62, 1, 1.88, 11.9];
    s.circle(cx, cy, 6, { glow: 1.5, color: p.hot });
    for (let i = 0; i < rings.length; i++) {
      const r = (rings[i] as number) * R;
      s.circle(cx, cy, r, { color: p.dim, glow: 0, width: 1 });
      const a = (this.t / (periods[i] as number)) * 0.6 + i;
      s.circle(cx + r * Math.cos(a), cy - r * Math.sin(a), i === 1 ? 4 : 3, { glow: 1 });
    }

    const big = Math.min(72, s.width / 9);
    drawText(s, 'MISS ∝ β', cx, cy - big * 1.9, big, { align: 'center', glow: 2.2, color: p.hot, width: 2 });
    drawText(s, 'MOMENTUM  IMPULSE  SAILS  SLINGSHOTS', cx, cy - big * 0.55, 12, { align: 'center' });
    drawText(s, 'BALLISTIC ENGAGEMENT OF THREATENING ASTEROIDS', cx, cy - big * 0.55 + 20, 12, { align: 'center' });

    let y = cy + 20;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      if (!it) continue;
      const selected = i === this.sel;
      const label = it.label + (it.action ? '' : '   [BUILDING]') + (it.label === 'CONTINUE' ? (hasSavedRun() ? '   (SAVED RUN FOUND)' : '   (NO SAVE)') : '');
      if (selected) drawText(s, '>', cx - 190, y, 16, { color: p.hot, glow: 1.5 });
      drawText(s, label, cx - 160, y, 16, { color: selected ? p.hot : it.action ? p.ink : p.dim, glow: selected ? 1.5 : it.action ? 1 : 0 });
      y += 30;
    }

    if (this.noteT > 0) drawText(s, this.note, cx, s.height - 90, 12, { align: 'center', color: p.hot, alpha: Math.min(1, this.noteT) });
    drawText(s, 'MISS β v0.1   ARROWS SELECT   ENTER START', cx, s.height - 40, 11, { align: 'center', color: p.dim, glow: 0 });
  }
}
