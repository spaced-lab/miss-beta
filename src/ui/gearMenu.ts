// WHAT: The GEAR menu: a gear tab in the top-right corner of every screen on a phone or a small window, and the
//       full list of that screen's actions it opens, one finger-sized button each.
// WHY:  Owner 2026-10-23: "all interactions being able to be done by a gear icon as well and menus". The action
//       bars (ui/actionBar.ts) hold what the moment needs; some actions (a key only, or the MORE grid of SYSTEM)
//       were still a hunt on a phone. One icon in one place on every screen lists them all.
// HOW:  A screen offers `gear()` (game/screen.ts): a title and `GearItem`s. An item either presses a logical key
//       code (Input.inject, like the bar) or runs `act` directly (the title's menu, PERIMETER's own settings).
//       main.ts owns one `GearMenu`: `update(keys, spec, W)` handles the tab, the taps on the open menu and Esc, and
//       returns true while the menu holds the frame (the screen is not updated: the game waits, like a pause). An
//       item marked `stay` keeps the menu open (a setting that cycles, so its new value shows); any other item
//       closes it. Layout and drawing reuse the MORE menu's grid (menuLayout / drawMenu). Pure but for the Input.
// LORE: G2 (screens and HUD)

import type { Surface } from '../render/canvas';
import { barHit, drawMenu, menuLayout, type BarBox, type BarItem } from './actionBar';
import type { Input } from './input';

export interface GearItem extends BarItem {
  /** Run this instead of pressing `code`. */
  act?: () => void;
  /** Keep the menu open after the tap (a cycling setting). */
  stay?: boolean;
}

export interface GearSpec {
  title: string;
  items: GearItem[];
}

/** The drawn tab for a window W px wide, CSS px (the BACK tab's mirror). */
export const gearTab = (W: number): { x: number; y: number; w: number; h: number } => ({ x: W - 33, y: 3, w: 30, h: 26 });

/** True when (x, y) is on the tab or the finger-sized area around it (44 x 40 from the top-right corner). */
export function onGearTab(x: number, y: number, W: number): boolean {
  return x >= W - 44 && x <= W && y >= 0 && y <= 40;
}

/**
 * The gear as line segments around (cx, cy): `teeth` square teeth on a ring of radius r, a hole of r / 2.5.
 * Example: gearPoints(0, 0, 8, 8) has 8 x 4 = 32 points (each tooth: two on the ring, two on the tip).
 */
export function gearPoints(cx: number, cy: number, r: number, teeth: number): number[] {
  const pts: number[] = [];
  const tip = r * 1.35;
  const half = Math.PI / teeth / 2;
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    for (const [ang, rad] of [[a - half * 1.2, r], [a - half * 0.7, tip], [a + half * 0.7, tip], [a + half * 1.2, r]] as const) pts.push(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad);
  }
  return pts;
}

/** Draw the gear tab: a box like the BACK tab with a gear inside, brighter while the menu is open. */
export function drawGearTab(s: Surface, open: boolean): void {
  const b = gearTab(s.width);
  const p = s.palette;
  s.ctx.fillStyle = p.bg;
  s.ctx.fillRect(b.x, b.y, b.w, b.h);
  s.stroke([b.x, b.y, b.x + b.w, b.y, b.x + b.w, b.y + b.h, b.x, b.y + b.h], { closed: true, color: p.hot, glow: open ? 1.2 : 0.6, alpha: open ? 1 : 0.8 });
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  s.stroke(gearPoints(cx, cy, 6.5, 8), { closed: true, color: p.hot, glow: 0.6 });
  s.circle(cx, cy, 2.6, { color: p.hot, glow: 0.4 });
}

export class GearMenu {
  open = false;
  boxes: BarBox[] = [];

  /**
   * One frame: a tap on the tab toggles the menu; while open, a tap on an item runs it, a tap elsewhere or Esc
   * closes. Returns true when the screen should not be updated this frame (the menu is open and nothing was
   * pressed for the screen).
   */
  update(keys: Input, spec: GearSpec | null, W: number): boolean {
    if (!spec) {
      this.open = false;
      return false;
    }
    const tap = keys.peekClick();
    if (!this.open) {
      if (tap && onGearTab(tap.x, tap.y, W)) {
        keys.takeClick();
        this.open = true;
        return true;
      }
      return false;
    }
    if (keys.pressed('Escape')) {
      keys.drop('Escape');
      this.open = false;
      return true;
    }
    if (!tap) return true;
    keys.takeClick();
    const it = barHit(tap.x, tap.y, this.boxes) as GearItem | null;
    if (!it || !it.stay) this.open = false;
    if (!it || it.code === 'GEAR_CLOSE') return true;
    if (it.act) {
      it.act();
      return true;
    }
    keys.inject(it.code, true);
    return false;
  }

  /** Draw the tab, and the menu over the screen while open (call after the screen's own render). */
  draw(s: Surface, spec: GearSpec | null): void {
    if (!spec) return;
    if (this.open) {
      this.boxes = menuLayout(s.width, s.height, [...spec.items, { label: 'CLOSE MENU', code: 'GEAR_CLOSE' }], true);
      drawMenu(s, this.boxes, spec.title, true);
    }
    drawGearTab(s, this.open);
  }
}
