// WHAT: SKY view (owner backlog 11, K): the sky as seen from HOME drawn as a slowly turning wireframe sphere, each
//       direction marked by how often the player's networks cover it, the Sun's glare cap, and the threat's
//       track across the sky over the past months.
// WHY:  "Where are we blind?" is a direction question. Rocks from the Sun's side, and visitors from far above or
//       below the plane, arrive through the gaps; this view shows the gaps and the rock in them.
// HOW:  Directions are (lambda, beta): longitude from the Sun along the ecliptic and ecliptic latitude, so the
//       elongation is acos(cos beta cos lambda). Nightly coverage per direction is sim/sky.ts coverageAll over the
//       active discovering networks (brightness ignored: it says where they look, not how deep). A direction is a
//       short cross, dim where coverage is high, hot where it is low. Orthographic projection of the unit sphere,
//       yaw turning with time (frozen under REDUCE MOTION), pitch fixed. The threat's direction each 10 days over
//       the last 400 comes from its 3-D position (a 3-D orbit since M14 phase 2; older 3-D lite threats are
//       tilted about their node).
//       Pure drawing: it reads the world and never changes it.
// LORE: F12 (visitors from other stars), F3 (the sunward blind spot), F5 (today's surveys), F11 (the gauge)

import { Materialize } from '../wire';
import { cornerInset } from '../../ui/touchBack';
import { NETWORKS } from '../../sim/detection';
import { is3D, lift, stateAt } from '../../sim/orbit3';
import { coverageAll, eclipticLatitude, nodeLine, tiltAboutNode } from '../../sim/sky';
import { planetById, planetState, type World } from '../../sim/world';
import type { Input } from '../../ui/input';
import type { Surface } from '../canvas';
import { uiColors, withAlpha } from '../palettes';
import { drawText, drawTextFit } from '../vectorFont';

const DEG = Math.PI / 180;

/** Unit vector of sky direction (lambda from the Sun, beta latitude) in a frame with the Sun on +x, ecliptic north +z. */
export function skyVector(lambdaDeg: number, betaDeg: number): [number, number, number] {
  const l = lambdaDeg * DEG;
  const b = betaDeg * DEG;
  return [Math.cos(b) * Math.cos(l), Math.cos(b) * Math.sin(l), Math.sin(b)];
}

/** Elongation from the Sun of a direction, deg. Example: lambda 90, beta 0 -> 90; lambda 0, beta 60 -> 60. */
export function elongationOf(lambdaDeg: number, betaDeg: number): number {
  return Math.acos(Math.max(-1, Math.min(1, Math.cos(betaDeg * DEG) * Math.cos(lambdaDeg * DEG)))) / DEG;
}

export class SkyOverlay {
  /** Overlay frame transition and the reduce-motion switch (set by the owner screen). */
  private readonly mat = new Materialize();
  still: () => boolean = () => false;
  private open = false;
  /** Px reserved along the bottom edge (the owner's action bar), set by the owner each frame. */
  bottomInset = 36;
  constructor(private readonly s: Surface, private readonly keys: Input) {}

  get isOpen(): boolean {
    return this.open;
  }
  show(): void {
    this.open = true;
    this.mat.start();
  }
  hide(): void {
    this.open = false;
  }

  /** K or Esc closes. */
  update(): void {
    if (!this.open) return;
    if (this.keys.pressed('KeyK') || this.keys.pressed('Escape')) this.hide();
  }

  render(world: World, t: number, still: boolean): void {
    if (!this.open) return;
    const s = this.s;
    const p = s.palette;
    const ui = uiColors(p, s.spectrum);
    s.ctx.fillStyle = withAlpha(p.bg, 0.92);
    s.ctx.fillRect(0, 0, s.width, s.height);
    // Materialize (24.2): the frame draws itself in when the overlay opens.
    this.mat.tick(1 / 60);
    this.mat.frame(s, 3, 3, s.width - 6, s.height - 6, 0.8, this.still());
    const cx = s.width / 2;
    const cy = s.height / 2 + 10;
    const R = Math.min(s.width, s.height) * 0.36;
    // Start with the Sun on the near side, a little left of centre.
    const yaw = still ? -0.7 : -0.7 + t * 0.05;
    const pitch = 0.42;
    // Orthographic: rotate about z by yaw, then about x by pitch; screen x right, y up; z2 > 0 faces the viewer.
    const proj = (v: [number, number, number]): [number, number, number] => {
      const x1 = v[0] * Math.cos(yaw) - v[1] * Math.sin(yaw);
      const y1 = v[0] * Math.sin(yaw) + v[1] * Math.cos(yaw);
      const z1 = v[2];
      const y2 = y1 * Math.cos(pitch) - z1 * Math.sin(pitch);
      const z2 = y1 * Math.sin(pitch) + z1 * Math.cos(pitch);
      return [cx + R * x1, cy - R * z2, y2];
    };
    const ci = cornerInset();
    drawTextFit(s, 'SKY FROM HOME   NIGHTLY COVERAGE BY DIRECTION', 16 + ci.left, 16, 14, s.width - 32 - ci.left - ci.right, { color: ui.title, glow: 1.2 });
    drawTextFit(s, 'DOT: LOOKED AT MOST NIGHTS.  RING: SOME NIGHTS.  DIAMOND: RARELY OR NEVER.  BRIGHTNESS OF THE ROCK IGNORED: THIS IS WHERE THE SURVEYS LOOK, NOT HOW DEEP.', 16, 36, 10, s.width - 32, { color: ui.sub, glow: 0.3 });
    // Grid: the ecliptic, latitude circles every 30 deg, meridians every 30 deg; far side dimmer.
    const grid = (pts: [number, number, number][], strong: boolean): void => {
      let front: number[] = [];
      let back: number[] = [];
      for (const v of pts) {
        const [x, y, d] = proj(v);
        if (d <= 0) {
          front.push(x, y);
          if (back.length >= 4) s.stroke(back, { color: p.dim, glow: 0, alpha: 0.25 });
          back = [];
        } else {
          back.push(x, y);
          if (front.length >= 4) s.stroke(front, { color: strong ? ui.text : p.dim, glow: strong ? 0.5 : 0, alpha: strong ? 0.8 : 0.5 });
          front = [];
        }
      }
      if (front.length >= 4) s.stroke(front, { color: strong ? ui.text : p.dim, glow: strong ? 0.5 : 0, alpha: strong ? 0.8 : 0.5 });
      if (back.length >= 4) s.stroke(back, { color: p.dim, glow: 0, alpha: 0.25 });
    };
    for (let b = -60; b <= 60; b += 30) grid(Array.from({ length: 73 }, (_, i) => skyVector(-180 + i * 5, b)), b === 0);
    for (let l = -180; l < 180; l += 30) grid(Array.from({ length: 37 }, (_, i) => skyVector(l, -90 + i * 5)), false);
    // Coverage crosses.
    const home = planetById(world, 'HOME');
    const nets = NETWORKS.filter((n) => world.networks.active.includes(n.id) && (n.kind === 'GROUND_OPTICAL' || n.kind === 'SPACE_IR'));
    let blind = 0;
    let cells = 0;
    for (let b = -75; b <= 75; b += 15) {
      const step = Math.abs(b) >= 75 ? 60 : Math.abs(b) >= 60 ? 30 : 15;
      for (let l = -180; l < 180; l += step) {
        const c = coverageAll(nets, elongationOf(l, b), b);
        cells++;
        if (c < 0.2) blind++;
        const [x, y, d] = proj(skyVector(l, b));
        const a = d <= 0 ? 1 : 0.28;
        // Blind: a bright diamond in the danger colour; partly covered: a small ring; well covered: a dim dot.
        if (c < 0.2) {
          const k = 5;
          s.stroke([x, y - k, x + k, y, x, y + k, x - k, y], { closed: true, color: s.spectrum ? s.role('danger') : p.hot, glow: 1, alpha: a });
        } else if (c < 0.6) s.circle(x, y, 3, { color: ui.sub, glow: 0.4, alpha: a });
        else s.circle(x, y, 1.2, { color: p.dim, glow: 0, alpha: a });
      }
    }
    // The Sun and its glare cap (ground surveys need about 60 deg of elongation).
    const [sx, sy, sd] = proj([1, 0, 0]);
    if (sd <= 0) {
      s.circle(sx, sy, 8, { color: s.role('star'), glow: 1.2 });
      drawText(s, 'SUN', sx + 12, sy - 4, 10, { color: s.role('star'), glow: 0.6 });
    }
    grid(Array.from({ length: 73 }, (_, i) => {
      const a = i * 5 * DEG;
      const e = 60 * DEG;
      return [Math.cos(e), Math.sin(e) * Math.cos(a), Math.sin(e) * Math.sin(a)];
    }), false);
    // The threat's track across HOME's sky: every 10 days over the last 400, in the Sun-fixed frame.
    const th = world.threat;
    if (th) {
      let track: number[] = [];
      let last: [number, number] | null = null;
      let prevLam: number | null = null;
      const flush = (): void => {
        if (track.length >= 4) s.stroke(track, { color: s.role('threat'), glow: 0.8, dash: [3, 3] });
        track = [];
      };
      for (let dt = -400; dt <= 0; dt += 10) {
        const tt = world.t + dt * 86400;
        // A 3-D orbit (M14 phase 2) gives its own z; older 3-D lite threats tilt the planar track about the node.
        const st = stateAt(th.elements, world.star.mu, tt);
        const r3 = is3D(th.elements) ? lift(st.r) : th.incl && th.node !== undefined ? tiltAboutNode(st.r, nodeLine(th.node), th.incl) : { x: st.r.x, y: st.r.y, z: 0 };
        const hr = planetState(world, home, tt).r;
        const beta = eclipticLatitude(r3, hr);
        // Longitude from the Sun: angle between (sun - home) and (rock - home) in the plane, signed.
        const sunA = Math.atan2(-hr.y, -hr.x);
        const rockA = Math.atan2(r3.y - hr.y, r3.x - hr.x);
        let lam = (rockA - sunA) / DEG;
        lam = ((lam + 540) % 360) - 180;
        const [x, y, d] = proj(skyVector(lam, beta));
        // Break the line on the far side and where the longitude wraps through +/-180 deg.
        if (d > 0 || (prevLam !== null && Math.abs(lam - prevLam) > 180)) flush();
        if (d <= 0) track.push(x, y);
        prevLam = lam;
        last = [x, y];
      }
      flush();
      if (last) {
        s.circle(last[0], last[1], 5, { color: s.role('threat'), glow: 1.2 });
        drawText(s, `${th.name} NOW`, last[0] + 9, last[1] - 4, 10, { color: s.role('threat'), glow: 0.6 });
      }
    }
    const pct = Math.round((blind / Math.max(1, cells)) * 100);
    drawTextFit(s, `${nets.length} DISCOVERING NETWORKS   ${pct} % OF THE SKY RARELY COVERED   ECLIPTIC BRIGHT, LATITUDE CIRCLES EVERY 30 DEG, SUN CAP 60 DEG`, cx, s.height - this.bottomInset - 28, 10, s.width - 32, { align: 'center', color: ui.text, glow: 0.3 });
    drawTextFit(s, '<K> OR <ESC> CLOSE   ? LORE F12', cx, s.height - this.bottomInset - 12, 12, s.width - 32, { align: 'center', color: p.dim, glow: 0 });
  }
}
