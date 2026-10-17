// WHAT: SYSTEM VIEW: star, dim orbits, planets, HUD with the clock and warp ladder.
// WHY:  GAME_PLAN 13.2. This is the main screen of the game; M0 shows the planets orbiting with correct
//       periods under time warp. Threats, craft and the planner layer onto it in later milestones.
// HOW:  Camera: centre offset (pan) and zoom (wheel). Two radial scales: LINEAR, and COMPRESSED where the
//       drawn radius is proportional to sqrt(r) so GIANT fits while the inner system stays readable.
//       Orbits are sampled from kepler.orbitPoints and projected point by point (so COMPRESSED bends them
//       correctly). Keys: Space pause, [ and ] warp, S scale toggle, R reset camera, Esc title.
// LORE: G2 (screens and HUD), O6 (Kepler), G8 (the look)

import type { Router, Screen } from '../../game/screen';
import { AU } from '../../physics/constants';
import { orbitPoints } from '../../physics/kepler';
import { advance, createWorld, planetState, setWarp, warpLabel, type World } from '../../sim/world';
import { formatElapsed } from '../../ui/hud';
import type { Input } from '../../ui/input';
import type { Surface } from '../canvas';
import { drawText } from '../vectorFont';

export type ScaleMode = 'LINEAR' | 'COMPRESSED';

export class SystemScreen implements Screen {
  world: World;
  scale: ScaleMode = 'COMPRESSED';
  private zoom = 1;
  private panX = 0;
  private panY = 0;
  private readonly orbitCache = new Map<string, Float64Array>();

  constructor(private readonly s: Surface, private readonly keys: Input, private readonly router: Router) {
    this.world = createWorld('DEV', 1);
  }

  enter(): void {
    this.world = createWorld(`${Date.now().toString(36).toUpperCase()}`, 1);
    this.orbitCache.clear();
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
  }
  exit(): void {}

  update(dtMs: number): void {
    const k = this.keys;
    const w = this.world;
    if (k.pressed('Escape')) {
      this.router.go('title');
      return;
    }
    if (k.pressed('Space')) setWarp(w, w.warp === 0 ? 1 : 0);
    if (k.pressed('BracketRight')) setWarp(w, w.warp + 1);
    if (k.pressed('BracketLeft')) setWarp(w, w.warp - 1);
    if (k.pressed('KeyS')) this.scale = this.scale === 'LINEAR' ? 'COMPRESSED' : 'LINEAR';
    if (k.pressed('KeyR')) {
      this.zoom = 1;
      this.panX = 0;
      this.panY = 0;
    }
    const wheel = k.takeWheel();
    if (wheel !== 0) this.zoom = Math.max(0.2, Math.min(40, this.zoom * Math.exp(-wheel * 0.0015)));
    const drag = k.takeDrag();
    this.panX += drag.x;
    this.panY += drag.y;
    advance(w, Math.min(dtMs, 100) / 1000);
  }

  /** World metres -> screen px. COMPRESSED maps radius r to sqrt(r / AU) AU-equivalents. */
  private project(x: number, y: number): [number, number] {
    const s = this.s;
    const base = (Math.min(s.width, s.height) / 2) * 0.9 * this.zoom;
    const r = Math.hypot(x, y);
    let rs: number;
    if (this.scale === 'COMPRESSED') {
      // sqrt scale; GIANT at 5.2 AU lands at 2.28 AU-equivalents, so fit 2.5 AU-eq on the short axis.
      rs = (Math.sqrt(r / AU) / 2.5) * base;
    } else {
      rs = (r / AU / 5.6) * base;
    }
    const f = r > 0 ? rs / r : 0;
    return [s.width / 2 + this.panX + x * f, s.height / 2 + this.panY - y * f];
  }

  render(): void {
    const s = this.s;
    const p = s.palette;
    const w = this.world;
    s.clear();

    // Star: circle with short radial ticks.
    const [sx, sy] = this.project(0, 0);
    const sr = 7;
    s.circle(sx, sy, sr, { color: p.hot, glow: 2 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      s.stroke([sx + Math.cos(a) * (sr + 3), sy + Math.sin(a) * (sr + 3), sx + Math.cos(a) * (sr + 8), sy + Math.sin(a) * (sr + 8)], { color: p.hot, glow: 1 });
    }

    // Orbits (dim) and planets.
    const buf: number[] = [];
    for (const pl of w.planets) {
      let pts = this.orbitCache.get(pl.id);
      if (!pts) {
        pts = orbitPoints(pl.elements, 256);
        this.orbitCache.set(pl.id, pts);
      }
      buf.length = 0;
      for (let i = 0; i < pts.length; i += 2) {
        const [px, py] = this.project(pts[i] as number, pts[i + 1] as number);
        buf.push(px, py);
      }
      s.stroke(buf, { closed: true, color: p.dim, glow: 0, width: 1 });

      const st = planetState(w, pl);
      const [px, py] = this.project(st.r.x, st.r.y);
      const pr = pl.id === 'GIANT' ? 7 : pl.id === 'HOME' ? 5 : 4;
      s.circle(px, py, pr, { glow: pl.id === 'HOME' ? 1.6 : 1, color: pl.id === 'HOME' ? p.hot : p.ink });
      // Detail lines: short chords inside the disc.
      for (let i = 0; i < pl.detailLines; i++) {
        const yy = py - pr * 0.5 + (i / Math.max(1, pl.detailLines - 1)) * pr * (pl.detailLines > 1 ? 1 : 0);
        const half = Math.sqrt(Math.max(0, pr * pr - (yy - py) * (yy - py))) * 0.8;
        s.stroke([px - half, yy, px + half, yy], { glow: 0.5, width: 1 });
      }
      drawText(s, pl.name, px + pr + 5, py - 5, 10, { color: p.dim, glow: 0 });
    }

    this.drawHud();
  }

  private drawHud(): void {
    const s = this.s;
    const p = s.palette;
    const w = this.world;
    const m = 16;
    drawText(s, formatElapsed(w.t), m, m, 14);
    drawText(s, `WARP ${warpLabel(w)}`, m, m + 24, 14, { color: w.warp === 0 ? p.hot : p.ink, glow: w.warp === 0 ? 1.5 : 1 });
    drawText(s, `ROUND ${w.round}   SEED ${w.runSeed}   SCALE ${this.scale}`, s.width - m, m, 12, { align: 'right', color: p.dim, glow: 0 });
    drawText(s, 'MISS 4.1 R', s.width - m, m + 20, 12, { align: 'right', color: p.dim, glow: 0 });
    drawText(s, 'SPACE PAUSE   [ ] WARP   S SCALE   WHEEL ZOOM   DRAG PAN   R RESET   ESC TITLE', s.width / 2, s.height - m - 12, 11, { align: 'center', color: p.dim, glow: 0 });
    drawText(s, 'THREAT BRIEF: NO OBJECT TRACKED (M1 BUILDING)', s.width / 2, m, 12, { align: 'center', color: p.dim, glow: 0 });
  }
}
