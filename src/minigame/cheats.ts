// WHAT: Cheat codes for the PERIMETER minigame.
// WHY:  Testing a ramping arcade game by playing to level nine every time is slow. These jump straight to
//       a state. Each one sets `assisted`, so a cheated score is displayed but never saved as a best.
// HOW:  Type the word while playing (no text box). Matching lives in game/cheats.ts. Each handler touches
//       one or two state fields; reading them is a quick tour of how the sim is wired.
// LORE: G6 (modes and cheat codes)

import type { Cheat } from '../game/cheats';
import { MG } from './config';
import { deployTurret, flash, type MinigameState } from './sim';

function assisted(st: MinigameState, text: string): void {
  st.cheats.assisted = true;
  flash(st, text, 1.5);
}

export const MINIGAME_CHEATS: readonly Cheat<MinigameState>[] = [
  { code: 'GODMODE', message: 'hull takes no damage', apply: (st) => { st.cheats.god = !st.cheats.god; assisted(st, st.cheats.god ? 'GODMODE ON' : 'GODMODE OFF'); } },
  { code: 'OCTO', message: 'eight launchers now', apply: (st) => { st.cheats.launchers = 8; assisted(st, 'OCTO'); } },
  { code: 'HYDRA', message: 'five streams now', apply: (st) => { st.cheats.streams = 5; assisted(st, 'HYDRA'); } },
  { code: 'PULSE', message: 'full pulse stock', apply: (st) => { st.pulses = MG.PULSE_MAX; assisted(st, 'PULSES FULL'); } },
  { code: 'SLOWMO', message: 'half speed toggle', apply: (st) => { st.cheats.timeScale = st.cheats.timeScale === 1 ? 0.5 : 1; assisted(st, st.cheats.timeScale === 1 ? 'NORMAL SPEED' : 'SLOW MOTION'); } },
  { code: 'WARP', message: 'skip ahead two minutes of levels', apply: (st) => { st.t += 120; assisted(st, 'TIME WARP'); } },
  { code: 'SKIP', message: 'next level now', apply: (st) => { st.t = st.level * MG.LEVEL_SECONDS; assisted(st, 'LEVEL SKIP'); } },
  { code: 'REPAIR', message: 'hull restored', apply: (st) => { st.hp = MG.MAX_HP; assisted(st, 'HULL REPAIRED'); } },
  { code: 'COOL', message: 'heat off', apply: (st) => { st.cheats.noHeat = !st.cheats.noHeat; st.heat = 0; st.overheated = false; assisted(st, st.cheats.noHeat ? 'COOLANT UNLIMITED' : 'HEAT ON'); } },
  { code: 'TURRET', message: 'deploy a sentry of a random archetype', apply: (st) => { deployTurret(st, false); assisted(st, 'SENTRY'); } },
  { code: 'SUPER', message: 'deploy a SUPER sentry', apply: (st) => { deployTurret(st, true); assisted(st, 'SUPER SENTRY'); } },
  { code: 'ORBITER', message: 'deploy an ORBITER sentry', apply: (st) => { deployTurret(st, false, 'orbiter'); assisted(st, 'ORBITER'); } },
  { code: 'SWEEPER', message: 'deploy a SWEEPER sentry', apply: (st) => { deployTurret(st, false, 'sweeper'); assisted(st, 'SWEEPER'); } },
  { code: 'PICKET', message: 'deploy a PICKET sentry', apply: (st) => { deployTurret(st, false, 'picket'); assisted(st, 'PICKET'); } },
  { code: 'CHASER', message: 'deploy a CHASER sentry', apply: (st) => { deployTurret(st, false, 'chaser'); assisted(st, 'CHASER'); } },
  { code: 'KARDASHEV', message: 'everything maxed', apply: (st) => { st.cheats.launchers = 8; st.cheats.streams = 5; st.pulses = MG.PULSE_MAX; st.cheats.god = true; st.cheats.noHeat = true; assisted(st, 'KARDASHEV'); } },
];
