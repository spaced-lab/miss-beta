// WHAT: The ACTION BAR: a row of labelled buttons along the bottom of a screen, each standing in for one logical
//       key code, plus the MORE menu, a grid of the same kind of button over the screen.
// WHY:  Owner 2026-10-21: the main game needs every action reachable by touch "without covering needed text",
//       and simplified menus; the same bar also improves the desktop, where it replaces a footer line of thirty
//       key hints nobody could read. Every screen already reads logical key codes (ui/input.ts), so a button that
//       injects a code works with every overlay (planner, programs, tech, lore panel, debrief) with no new code paths.
// HOW:  Pure functions over a list of `BarItem`s. `barLayout(W, H, items, touch)` places the buttons in one row of
//       equal widths (two rows when the row would make a button narrower than `MIN_W`), touch rows 38 px tall (a
//       finger) and mouse rows 24 px; `barHit(points, boxes)` finds the tapped button; `drawBar` draws them. The MORE
//       menu (`menuLayout`, `drawMenu`) is a centred grid of the remaining actions, 2 or 3 columns by width. Nothing
//       here reads game state: the screen chooses the items each frame from its phase and injects the code it gets back.
// LORE: G2 (screens and HUD)

import type { Surface } from '../render/canvas';
import { uiColors, withAlpha } from '../render/palettes';
import { drawText, drawTextFit } from '../render/vectorFont';

export interface BarItem {
  /** The button's text. */
  label: string;
  /** The logical key code the button presses (Input.inject), or 'MORE' / 'MENU_CLOSE' for the menu itself. */
  code: string;
  /** A key hint drawn small in the corner on the desktop (none on touch screens). */
  key?: string;
  /** Drawn in the hot colour (the one action the moment calls for). */
  hot?: boolean;
  /** Drawn dim and ignored by taps. */
  off?: boolean;
}

export interface BarBox {
  x: number;
  y: number;
  w: number;
  h: number;
  item: BarItem;
}

/** Narrowest button before the bar wraps to a second row, px. */
export const MIN_W = 58;
export const ROW_H_TOUCH = 38;
export const ROW_H_MOUSE = 24;

/**
 * Button boxes for a W x H window, bottom-anchored with a 6 px margin, `items` left to right. Rows wrap when a
 * single row would make a button narrower than MIN_W (two rows at most; the first row takes the first half).
 * Example: barLayout(390, 740, 5 items, true) -> one row, 5 boxes 69.6 px wide, 38 px tall, y = 740 - 6 - 38.
 */
export function barLayout(W: number, H: number, items: readonly BarItem[], touch: boolean): BarBox[] {
  const n = items.length;
  if (n === 0) return [];
  const m = 6;
  const gap = 5;
  const rowH = touch ? ROW_H_TOUCH : ROW_H_MOUSE;
  const oneRowW = (W - 2 * m - gap * (n - 1)) / n;
  const rows = oneRowW < MIN_W && n > 2 ? 2 : 1;
  const out: BarBox[] = [];
  const perRow = Math.ceil(n / rows);
  for (let r = 0; r < rows; r++) {
    const slice = items.slice(r * perRow, (r + 1) * perRow);
    const bw = (W - 2 * m - gap * (slice.length - 1)) / slice.length;
    const y = H - m - rowH - (rows - 1 - r) * (rowH + gap);
    slice.forEach((item, i) => out.push({ x: m + i * (bw + gap), y, w: bw, h: rowH, item }));
  }
  return out;
}

/** Total height the bar takes above the window's bottom edge (rows plus margins), px. */
export function barHeight(boxes: readonly BarBox[], H: number): number {
  let top = H;
  for (const b of boxes) top = Math.min(top, b.y);
  return boxes.length === 0 ? 0 : H - top + 6;
}

/** The button under (x, y), or null. Buttons marked `off` are skipped. */
export function barHit(x: number, y: number, boxes: readonly BarBox[]): BarItem | null {
  for (const b of boxes) if (!b.item.off && x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return b.item;
  return null;
}

/** Draw the bar's buttons: a box, the label fitted inside, the key hint in the top-right corner on the desktop. */
export function drawBar(s: Surface, boxes: readonly BarBox[], touch: boolean): void {
  const p = s.palette;
  const ui = uiColors(p, s.spectrum);
  for (const b of boxes) {
    const it = b.item;
    const col = it.off ? p.dim : it.hot ? p.hot : ui.sub;
    s.ctx.fillStyle = withAlpha(p.bg, 0.82);
    s.ctx.fillRect(b.x, b.y, b.w, b.h);
    s.stroke([b.x, b.y, b.x + b.w, b.y, b.x + b.w, b.y + b.h, b.x, b.y + b.h], { closed: true, color: col, glow: it.hot ? 1 : 0.3, alpha: it.off ? 0.5 : 0.9 });
    const size = touch ? 9.5 : 9;
    drawTextFit(s, it.label, b.x + b.w / 2, b.y + b.h / 2 - size / 2, size, b.w - 10, { align: 'center', color: it.off ? p.dim : it.hot ? p.hot : ui.text, glow: it.hot ? 0.8 : 0.3 });
    if (!touch && it.key) drawText(s, it.key, b.x + b.w - 4, b.y + 3, 6, { align: 'right', color: p.dim, glow: 0 });
  }
}

/**
 * The MORE menu: `items` in a centred grid, 3 columns when the window is 520 px or wider, else 2; rows 44 px on
 * touch screens and 30 px with a mouse. Example: menuLayout(390, 740, 12 items, true) -> 2 columns x 6 rows.
 */
export function menuLayout(W: number, H: number, items: readonly BarItem[], touch: boolean): BarBox[] {
  const cols = W >= 520 ? 3 : 2;
  const rowH = touch ? 44 : 30;
  const gap = 8;
  const gw = Math.min(W - 24, cols * 190 + (cols - 1) * gap);
  const bw = (gw - (cols - 1) * gap) / cols;
  const rows = Math.ceil(items.length / cols);
  const gh = rows * rowH + (rows - 1) * gap;
  const x0 = (W - gw) / 2;
  const y0 = Math.max(44, (H - gh) / 2);
  return items.map((item, i) => ({ x: x0 + (i % cols) * (bw + gap), y: y0 + Math.floor(i / cols) * (rowH + gap), w: bw, h: rowH, item }));
}

/** Draw the MORE menu: a dimmed screen, a title, the grid. */
export function drawMenu(s: Surface, boxes: readonly BarBox[], title: string, touch: boolean): void {
  const p = s.palette;
  const ui = uiColors(p, s.spectrum);
  s.ctx.fillStyle = withAlpha(p.bg, 0.9);
  s.ctx.fillRect(0, 0, s.width, s.height);
  const top = boxes.reduce((a, b) => Math.min(a, b.y), s.height);
  drawTextFit(s, title, s.width / 2, Math.max(10, top - 26), 12, s.width - 32, { align: 'center', color: ui.title, glow: 1.2 });
  drawBar(s, boxes, touch);
}
