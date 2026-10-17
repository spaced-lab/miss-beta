// WHAT: PLANET VIEW overlay (GAME_PLAN 13.3): HOME's disc with continents, the b_crit ring, the approach
//       corridor and every body's closest-approach offset (the fragment cloud's cross-section).
// WHY:  The system view cannot show a miss of two planet radii; this view is where "miss by 1.3 R" and a
//       fragment shotgun become pictures.
// HOW:  Plane centred on HOME. Each resolved body is placed at its closest-approach offset vector
//       (r_body(t_ca) - r_home(t_ca)), drawn to scale against the disc and the focusing ring; the primary's
//       approach direction (its relative velocity at t_ca) is the corridor line. Continents reuse the
//       seeded generator with the run seed so the planet looks the same every round of a run.
// LORE: O12 (close approach), D4 (fragmentation), T2 (size ladder)

import { generateContinents, type Continent } from '../../minigame/planet';
import { propagate } from '../../physics/kepler';
import type { RoundResult } from '../../sim/resolver';
import { hashSeed, Rng } from '../../sim/rng';
import { planetById, type World } from '../../sim/world';
import type { Surface } from '../canvas';
import { withAlpha } from '../palettes';
import { drawText } from '../vectorFont';

export class PlanetOverlay {
  private continents: Continent[] = [];
  private seed = '';
  constructor(private readonly s: Surface) {}

  render(world: World, res: RoundResult | null, mc: { pMiss: number; n: number } | null): void {
    const s = this.s;
    const p = s.palette;
    const home = planetById(world, 'HOME');
    if (this.seed !== world.runSeed) {
      this.seed = world.runSeed;
      this.continents = generateContinents(new Rng(hashSeed(`${world.runSeed}#home`)), 1);
    }
    s.ctx.fillStyle = withAlpha(p.bg, 0.9);
    s.ctx.fillRect(0, 0, s.width, s.height);
    const cx = s.width / 2;
    const cy = s.height / 2 + 10;
    // Fit 4 planet radii on the short axis, more if a body sits further out.
    let extent = 4;
    if (res) for (const o of res.outcomes) if (o.ca) extent = Math.max(extent, Math.min(12, o.ca.dMin / home.radius + 0.5));
    // k: pixels per planet radius; R is one planet radius on screen.
    const k = (Math.min(s.width, s.height) / 2) * 0.85 / extent;
    const R = k;
    const X = (x: number): number => cx + x * k;
    const Y = (y: number): number => cy - y * k;

    // Disc and continents.
    s.circle(cx, cy, R, { glow: 1.4, width: p.lineWidth + 0.25 });
    const buf: number[] = [];
    for (const c of this.continents) {
      buf.length = 0;
      for (let i = 0; i < c.length; i += 2) buf.push(cx + (c[i] as number) * R, cy - (c[i + 1] as number) * R);
      s.stroke(buf, { closed: true, glow: 0.5, alpha: 0.85, width: 1 });
    }
    // Radius rings for scale.
    for (let r = 2; r <= extent; r += 2) s.circle(cx, cy, r * R, { color: p.dim, glow: 0, width: 1, alpha: 0.5, dash: [3, 7] });

    if (res) {
      const primary = res.ca;
      s.circle(cx, cy, (primary.bCrit / home.radius) * R, { color: p.hot, glow: 1, width: 1, dash: [4, 4] });
      drawText(s, `B-CRIT ${(primary.bCrit / home.radius).toFixed(2)} R`, cx + (primary.bCrit / home.radius) * R + 6, cy - 6, 10, { color: p.hot, glow: 0.5 });
      // Bodies at their closest-approach offsets.
      for (const o of res.outcomes) {
        if (!o.ca) continue;
        const el = o.body.segments[o.body.segments.length - 1]?.elements;
        if (!el) continue;
        const tb = propagate(el, world.star.mu, o.ca.tCa);
        const th = propagate(home.elements, world.star.mu, o.ca.tCa);
        const dx = (tb.r.x - th.r.x) / home.radius;
        const dy = (tb.r.y - th.r.y) / home.radius;
        const x = X(dx);
        const y = Y(dy);
        const isPrimary = o.body.role !== 'FRAGMENT';
        const size = isPrimary ? 6 : Math.max(2, Math.min(6, o.body.D / 40));
        const color = o.hits ? p.hot : o.body.harmless ? p.dim : p.ink;
        if (isPrimary) {
          s.circle(x, y, size, { color, glow: 1.5 });
          // Approach corridor: the relative velocity direction through the body.
          const vx = tb.v.x - th.v.x;
          const vy = tb.v.y - th.v.y;
          const vm = Math.hypot(vx, vy) || 1;
          const L = extent * R * 1.5;
          s.stroke([x - (vx / vm) * L, y + (vy / vm) * L, x + (vx / vm) * L, y - (vy / vm) * L], { color: p.dim, glow: 0, width: 1, alpha: 0.6, dash: [6, 6] });
        } else {
          s.dot(x, y, size, color, o.body.harmless ? 0.5 : 1);
        }
      }
    }

    const m = 16;
    drawText(s, 'PLANET VIEW  HOME', m, m, 14, { color: p.hot, glow: 1.2 });
    if (res) {
      const hits = res.outcomes.filter((o) => o.hits).length;
      const bodies = res.outcomes.length;
      drawText(s, `${res.outcome}   MARGIN ${res.ca.marginRadii.toFixed(2)} R   BODIES ${bodies}   HITTING ${hits}   ENERGY THROUGH ${res.hitEnergyMt.toFixed(1)} MT`, m, m + 22, 12, { color: p.dim, glow: 0 });
      if (mc) drawText(s, `MONTE CARLO  P(MISS) ${(mc.pMiss * 100).toFixed(0)}%  N ${mc.n}`, m, m + 40, 12, { color: p.dim, glow: 0 });
    }
    drawText(s, 'DOTS: BODIES AT CLOSEST APPROACH.  BRIGHT = HITS.  DIM = HARMLESS (AIRBURST).  DASHED RING = GRAVITATIONAL FOCUSING.', s.width / 2, s.height - m - 30, 10, { align: 'center', color: p.dim, glow: 0 });
    drawText(s, '<V> BACK TO SYSTEM VIEW', s.width / 2, s.height - m - 12, 12, { align: 'center', color: p.dim, glow: 0 });
  }
}
