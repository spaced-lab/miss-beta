// WHAT: The touch BACK tab: a small "<" box in the top-left corner that stands in for Esc on a phone or tablet.
// WHY:  A touch screen has no Esc key (owner 2026-10-20, "make sure the menu works on mobile"); the first version
//       was a 78 x 34 "< BACK" box that sat over each screen's top-left content (owner 2026-10-21: "move the back
//       button out of the way"). It is now a 30 x 26 corner tab; the tap target stays finger-sized (44 x 40).
// HOW:  `BACK_TAB` is the drawn box, `onBackTab` tests a point against the larger hit box, `drawBackTab` draws it.
//       main.ts uses it on every screen but the title and PERIMETER; PERIMETER's pad (minigame/touchPad.ts) uses the
//       same tab.
// LORE: G2 (screens and HUD)

import type { Surface } from '../render/canvas';
import { drawText } from '../render/vectorFont';

/** Which corner tabs main.ts draws this frame (BACK top-left, GEAR top-right, ui/gearMenu.ts); views that put a title
 *  in a top corner read `cornerInset` instead of guessing from the window size. */
export const cornerTabs = { back: false, gear: false };

/** Px to keep clear at the top-left and top-right for the corner tabs. Example: both shown -> { left: 36, right: 36 }. */
export function cornerInset(): { left: number; right: number } {
  return { left: cornerTabs.back ? 36 : 0, right: cornerTabs.gear ? 36 : 0 };
}

/** The drawn tab, CSS px. */
export const BACK_TAB = { x: 3, y: 3, w: 30, h: 26 };

/** True when (x, y) is on the tab or within the finger-sized area around it (44 x 40 from the corner). */
export function onBackTab(x: number, y: number): boolean {
  return x >= 0 && x <= 44 && y >= 0 && y <= 40;
}

export function drawBackTab(s: Surface): void {
  const b = BACK_TAB;
  const p = s.palette;
  s.ctx.fillStyle = p.bg;
  s.ctx.fillRect(b.x, b.y, b.w, b.h);
  s.stroke([b.x, b.y, b.x + b.w, b.y, b.x + b.w, b.y + b.h, b.x, b.y + b.h], { closed: true, color: p.hot, glow: 0.6, alpha: 0.8 });
  drawText(s, '<', b.x + b.w / 2, b.y + b.h / 2 - 6, 12, { align: 'center', color: p.hot, glow: 0.6 });
}
