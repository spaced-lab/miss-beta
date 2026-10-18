// WHAT: Close approach between a threat and HOME on 3-D orbits, with the same gravitational-focusing impact test
//       as the planar version (M14 phase 1, not yet called by the game).
// WHY:  Once orbits are tilted, a rock can cross HOME's orbit radius well above or below HOME; only the full
//       3-D separation says whether it hits. With i = raan = 0 on both bodies this returns closeApproach's answer.
// HOW:  Identical search to closeApproach.ts (hourly scan over +-90 d, then goldenMin to 1 s) on the distance
//       |r_threat(t) - r_home(t)| from propagate3; b_crit focusing unchanged: b_crit = R sqrt(1 + (v_esc / v_inf)^2).
//       Python mirror: pymiss/physics/close_approach3.py.
// LORE: O12 (close approach), O7 (elements)

import { DAY } from './constants';
import { bCrit, escapeSpeed, goldenMin, type CloseApproach, type CloseApproachOpts } from './closeApproach';
import { propagate3, type Elements3 } from './kepler3';

/**
 * Closest approach of `threat` to `home` near `tNominal`, separation measured in 3-D.
 *   d(t) = |r_T(t) - r_H(t)|;  t_ca = argmin d near tNominal;  v_inf = |v_T - v_H| at t_ca;  impact if d_min < b_crit.
 * Units: m, m/s, s. Example: a threat built from HOME's state at t_i plus 12 km/s with an out-of-plane part
 * (stateToElements3) has its node on HOME and returns impact true, d_min under 100 km, t_ca within 5 s of t_i.
 */
export function closeApproach3(threat: Elements3, home: Elements3, muSun: number, muHome: number, rHome: number, tNominal: number, opts: CloseApproachOpts = {}): CloseApproach {
  const window = opts.window ?? 90 * DAY;
  const coarse = opts.coarseStep ?? 3600;
  const tol = opts.tol ?? 1;
  const dist = (t: number): number => {
    const a = propagate3(threat, muSun, t);
    const b = propagate3(home, muSun, t);
    return Math.hypot(a.r.x - b.r.x, a.r.y - b.r.y, a.r.z - b.r.z);
  };
  let bestT = tNominal;
  let bestD = Infinity;
  for (let t = tNominal - window; t <= tNominal + window; t += coarse) {
    const d = dist(t);
    if (d < bestD) {
      bestD = d;
      bestT = t;
    }
  }
  const tCa = goldenMin(dist, bestT - coarse, bestT + coarse, tol);
  const a = propagate3(threat, muSun, tCa);
  const b = propagate3(home, muSun, tCa);
  const dMin = Math.hypot(a.r.x - b.r.x, a.r.y - b.r.y, a.r.z - b.r.z);
  const vInf = Math.hypot(a.v.x - b.v.x, a.v.y - b.v.y, a.v.z - b.v.z);
  const bc = bCrit(muHome, rHome, vInf);
  const vEsc = escapeSpeed(muHome, rHome);
  return {
    tCa,
    dMin,
    vInf,
    bCrit: bc,
    impact: dMin < bc,
    marginRadii: (dMin - bc) / rHome,
    vImpact: Math.sqrt(vInf * vInf + vEsc * vEsc),
  };
}
