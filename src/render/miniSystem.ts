// WHAT: A small self-contained system-view drawer: star, orbits, planets, live bodies and craft dots.
// WHY:  Used by the title attract mode and the MULTIVERSE tiles; the full SystemScreen is too entangled
//       with its HUD and camera to reuse.
// HOW:  Compressed radial scale (sqrt of r / AU) into a circle of radius `base` at (cx, cy); pure reads.
// LORE: G2 (screens and HUD)

import { AU } from '../physics/constants';
import { orbitPoints, propagate } from '../physics/kepler';
import { craftPosition } from '../planner/legs';
import { bodyAlive, elementsAt, type RoundResult } from '../sim/resolver';
import { planetState, type World } from '../sim/world';
import type { Surface } from './canvas';

export interface MiniOpts {
  /** Alpha for the whole drawing (the attract sketch is dim). */
  alpha?: number;
  /** Draw the threat's predicted path. */
  threatPath?: boolean;
}

export function drawMiniSystem(s: Surface, w: World, result: RoundResult | null, cx: number, cy: number, base: number, o: MiniOpts = {}): void {
  const p = s.palette;
  const alpha = o.alpha ?? 1;
  const proj = (x: number, y: number): [number, number] => {
    const r = Math.hypot(x, y);
    const rs = (Math.sqrt(r / AU) / 2.5) * base;
    const f = r > 0 ? rs / r : 0;
    return [cx + x * f, cy - y * f];
  };
  const poly = (pts: Float64Array, closed: boolean, color: string, a: number, dash?: readonly number[]): void => {
    const buf: number[] = [];
    for (let i = 0; i < pts.length; i += 2) buf.push(...proj(pts[i] as number, pts[i + 1] as number));
    s.stroke(buf, { closed, color, glow: 0, width: 1, alpha: a * alpha, ...(dash ? { dash } : {}) });
  };
  s.circle(cx, cy, 2.5, { color: p.hot, glow: 0.8, alpha });
  for (const pl of w.planets) {
    poly(orbitPoints(pl.elements, 96), true, p.dim, 0.7);
    const st = planetState(w, pl);
    const [px, py] = proj(st.r.x, st.r.y);
    s.circle(px, py, pl.id === 'HOME' ? 2.5 : 1.5, { color: pl.id === 'HOME' ? p.hot : p.ink, glow: 0.5, alpha });
  }
  if (result) {
    for (const body of result.bodies.filter((q) => bodyAlive(q, w.t))) {
      const el = elementsAt(body.segments, w.t);
      if (o.threatPath && body.role !== 'FRAGMENT') poly(orbitPoints(el, 180), el.e < 1, p.ink, 0.35, [3, 5]);
      const st = propagate(el, w.star.mu, w.t);
      const [tx, ty] = proj(st.r.x, st.r.y);
      s.circle(tx, ty, body.role === 'FRAGMENT' ? 1 : 2.5, { color: body.harmless ? p.dim : p.hot, glow: 0.6, alpha });
    }
    for (const mi of result.missionsResolved) {
      if (w.t < mi.launchTime || w.t >= mi.arrivalTime) continue;
      const pos = craftPosition(mi, w.star.mu, w.t);
      if (pos) {
        const [qx, qy] = proj(pos.x, pos.y);
        s.dot(qx, qy, 2, p.ink, alpha);
      }
    }
  } else if (w.threat) {
    poly(orbitPoints(w.threat.elements, 180), w.threat.elements.e < 1, p.ink, 0.35, [3, 5]);
    const st = propagate(w.threat.elements, w.star.mu, w.t);
    const [tx, ty] = proj(st.r.x, st.r.y);
    s.circle(tx, ty, 2.5, { color: p.hot, glow: 0.6, alpha });
  }
}
