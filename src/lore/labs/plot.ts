// WHAT: Plot helpers for labs: axes, a polyline in data space, a marker, a bar.
// WHY:  Every lab draws into a box; one mapping keeps them consistent and glow-free (lines only).
// HOW:  `Plot` maps data (x0..x1, y0..y1) to the box with 10 px padding; y grows upward.
// LORE: G8

import type { Surface } from '../../render/canvas';
import { drawText } from '../../render/vectorFont';
import type { Box } from './lab';

export class Plot {
  constructor(private readonly s: Surface, private readonly box: Box, private readonly x0: number, private readonly x1: number, private readonly y0: number, private readonly y1: number) {}
  X(x: number): number {
    return this.box.x + 10 + ((x - this.x0) / (this.x1 - this.x0)) * (this.box.w - 20);
  }
  Y(y: number): number {
    return this.box.y + this.box.h - 10 - ((y - this.y0) / (this.y1 - this.y0)) * (this.box.h - 20);
  }
  frame(): void {
    const b = this.box;
    this.s.stroke([b.x, b.y, b.x + b.w, b.y, b.x + b.w, b.y + b.h, b.x, b.y + b.h], { closed: true, color: this.s.palette.dim, glow: 0 });
  }
  axes(xl = '', yl = ''): void {
    const p = this.s.palette;
    this.s.stroke([this.X(this.x0), this.Y(0), this.X(this.x1), this.Y(0)], { color: p.dim, glow: 0 });
    this.s.stroke([this.X(0), this.Y(this.y0), this.X(0), this.Y(this.y1)], { color: p.dim, glow: 0 });
    if (xl) drawText(this.s, xl, this.X(this.x1), this.Y(0) + 4, 8, { align: 'right', color: p.dim, glow: 0 });
    if (yl) drawText(this.s, yl, this.X(0) + 4, this.Y(this.y1), 8, { color: p.dim, glow: 0 });
  }
  curve(pts: readonly (readonly [number, number])[], color?: string, dash?: readonly number[], closed = false): void {
    const buf: number[] = [];
    for (const [x, y] of pts) buf.push(this.X(x), this.Y(y));
    this.s.stroke(buf, { closed, color: color ?? this.s.palette.ink, glow: 0.4, ...(dash ? { dash } : {}) });
  }
  mark(x: number, y: number, r = 3, color?: string): void {
    this.s.circle(this.X(x), this.Y(y), r, { color: color ?? this.s.palette.hot, glow: 0.8 });
  }
  /** A legend line right-aligned inside the frame at data height y (never runs past the box edge). */
  legend(y: number, text: string, color?: string): void {
    drawText(this.s, text, this.box.x + this.box.w - 12, this.Y(y) - 10, 8, { align: 'right', color: color ?? this.s.palette.dim, glow: 0 });
  }
  label(x: number, y: number, text: string, color?: string): void {
    drawText(this.s, text, this.X(x) + 5, this.Y(y) - 10, 8, { color: color ?? this.s.palette.dim, glow: 0 });
  }
}
