import { describe, expect, it } from 'vitest';
import { AU, DAY, MU_SUN } from '../src/physics/constants';
import { stateToElements } from '../src/physics/elements';
import { propagate } from '../src/physics/kepler';
import { lambert } from '../src/physics/lambert';

describe('fast hyperbolic Lambert transfers (code review 2026-10-18 finding 27)', () => {
  it('fast transfers either side of 180 deg are found and reach r2 at dt', () => {
    const r1 = { x: AU, y: 0 };
    for (const [deg, days] of [[120, 4], [90, 2], [150, 6], [60, 1], [200, 3], [240, 2], [300, 1.5]] as const) {
      const a = (deg * Math.PI) / 180;
      const r2 = { x: 1.2 * AU * Math.cos(a), y: 1.2 * AU * Math.sin(a) };
      const dt = days * DAY;
      const sol = lambert(r1, r2, dt, MU_SUN);
      expect(sol, `${deg} deg in ${days} d`).not.toBeNull();
      if (!sol) continue;
      expect(sol.z).toBeLessThan(0);
      const el = stateToElements(r1, sol.v1, MU_SUN, 0, true);
      const p = propagate(el, MU_SUN, dt);
      expect(Math.hypot(p.r.x - r2.x, p.r.y - r2.y) / AU, `${deg} deg in ${days} d`).toBeLessThan(1e-7);
    }
  });
});
