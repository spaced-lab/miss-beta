// WHAT: Visitor reachability probe (IDEAS 27): of 30 SCI-FI interstellar visitors, how many have any feasible launch
//       from HOME, for each lever: today's build time, a craft on standby (no build), and free departure energy.
// WHY:  IDEAS 27 asks for new defences against out-of-plane visitors "not by making visitors easier"; each one is
//       judged by how far it moves this count. Measured 2026-10-18 with L3: build 0.5 y 0/30; standby 1/30; standby
//       + 50 km^2/s^2 2/30; + 150 3/30; + 400 8/30; build 0.5 y + 150 still 0/30; warning x1.5 4/30 (standby 5),
//       x2 5/30 (standby 7); x2 + standby + KICK_STAGES and ORBITAL_DEPOT (C3 55) 8/30; INCLINED_PICKETS alone 3/30,
//       with x2 and C3 55 12/30. Time is the first wall, then the climb out of the plane (50 to 80 % of the C3 of the
//       still-unreachable visitors); flyby and sail legs need more time than a visitor gives.
// HOW:  Seeds VIS-1..30, round 3, flavor INTERSTELLAR, discovery skipped (the lead is the round's). computePorkchop
//       from HOME at L3 for each lever; results in .dev/visitors.txt. About 40 seconds.
// LORE: G3 (the planner), F12 (visitors from other stars)
import { describe, expect, it } from 'vitest';
import { KNOBS } from '../src/config/knobs';
import { launcherTier } from '../src/physics/estimates';
import { computePorkchop } from '../src/planner/porkchop';
import { roundRng } from '../src/sim/rng';
import { generateThreat } from '../src/sim/roundGen';
import { createWorld, planetById } from '../src/sim/world';
import { nodeFs } from './mgProbe';

describe('visitor reachability', () => {
  it('counts SCI-FI visitors with any feasible launch, per lever', { timeout: 600_000 }, async () => {
    // [name, build time, free C3, warning multiplier (the same orbit found earlier: the round starts sooner),
    //  parked out-of-plane speed m/s (INCLINED_PICKETS)]
    const levers: [string, number, number, number, number?][] = [
      ['build 0.5 y', KNOBS.BUILD_TIME_KINETIC, 0, 1], ['standby', 0, 0, 1], ['standby + C3 50', 0, 50, 1], ['standby + C3 150', 0, 150, 1],
      ['standby + C3 400', 0, 400, 1], ['build 0.5 y + C3 150', KNOBS.BUILD_TIME_KINETIC, 150, 1],
      ['warning x1.5, build', KNOBS.BUILD_TIME_KINETIC, 0, 1.5], ['warning x1.5, standby', 0, 0, 1.5],
      ['warning x2, build', KNOBS.BUILD_TIME_KINETIC, 0, 2], ['warning x2, standby', 0, 0, 2],
      // Everything a REALISTIC-to-SCI-FI player can stack today: HIVE_3, a craft on standby, KICK_STAGES + ORBITAL_DEPOT.
      ['warning x2, standby, C3 55', 0, 55, 2], ['warning x2, build, C3 55', KNOBS.BUILD_TIME_KINETIC, 55, 2],
      ['inclined pickets', 0, 0, 1, 5000], ['warning x2, pickets, C3 55', 0, 55, 2, 5000],
    ];
    const out: string[] = [];
    for (const [name, build, c3, mult, vzPark] of levers) {
      let reach = 0;
      for (let i = 1; i <= 30; i++) {
        const seed = `VIS-${i}`;
        const w = createWorld(seed, 3);
        const th = generateThreat(roundRng(seed, 3), w, 3, 0, { flavor: 'INTERSTELLAR', skipDiscovery: true, scifi: true });
        const start = th.tImpact - mult * (th.tImpact - w.t);
        const g = computePorkchop({ home: planetById(w, 'HOME').elements, threat: th.elements, muSun: w.star.mu, tMin: start + build, tImpact: th.tImpact, tier: launcherTier(3), c3Bonus: c3, vzPark: vzPark ?? 0 });
        if (g.feasible > 0) reach++;
      }
      out.push(`${name.padEnd(22)} reachable ${reach}/30`);
    }
    const fs = await nodeFs();
    fs.mkdirSync('.dev', { recursive: true });
    fs.writeFileSync('.dev/visitors.txt', out.join('\n') + '\n');
    expect(out.length).toBe(levers.length);
  });
});
