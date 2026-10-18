// WHAT: The PERIMETER bot: a weapons-using scripted player that returns one Input per fixed step.
// WHY:  One bot serves three jobs: the balance probe in tests/minigame.test.ts, the difficulty table measured
//       headlessly in tests/minigameModes.test.ts, and the SUPER DEMO on the ready panel (index.ts), which feeds
//       its Input through exactly the path the keyboard uses. Moved here from the test so all three share it.
// HOW:  Pure function of the state, no Rng draws (so it never perturbs the sim's random stream). It is naive
//       where a human is naive (no lead, waits for overheat to clear): it turns toward the nearest non-passing
//       rock and fires, pauses fire for the laser break every 3 s so the beam (or the mesh) arms, presses `<`
//       and `>` whenever stock exists, and pulses when three threats are close or one is about to land.
// LORE: G1 (how to play), C1 (how the game is built)

import { MG } from './config';
import { laserStage, NO_INPUT, type Asteroid, type Input, type MinigameState } from './sim';
import { wrapAngle } from '../util/vec';

/** One step of the armed bot. Example: an empty field returns fire (outside the laser pause) and no movement. */
export function botInput(st: Readonly<MinigameState>): Input {
  let best: Asteroid | null = null;
  let bestD = Infinity;
  let close = 0;
  for (const a of st.asteroids) {
    if (a.passing) continue;
    const d = Math.hypot(a.x, a.y);
    if (d < 2.2) close++;
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  const stage = laserStage(st.streamCount, st.level);
  const pause = (stage >= 2 ? MG.LASER_BREAK_2 : MG.LASER_BREAK_1) + 0.05;
  const fire = !(stage > 0 && st.t % 3 < pause) && !st.overheated;
  const pulse = st.pulses > 0 && st.pulseR < 0 && (close >= 3 || bestD < 1.6);
  const seeker = st.seekerStock > 0 && best !== null;
  const swarm = st.swarmStock > 0 && st.asteroids.length >= 5;
  if (!best) return { ...NO_INPUT, fire, pulse, seeker, swarm };
  const diff = wrapAngle(Math.atan2(best.y, best.x) - st.launcherAngle);
  const sd = diff > Math.PI ? diff - 2 * Math.PI : diff;
  return { left: sd > 0.02, right: sd < -0.02, fire, pulse, seeker, swarm };
}
