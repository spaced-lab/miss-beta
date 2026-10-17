// WHAT: Cheat codes for the PERIMETER minigame.
// WHY:  Testing a ramping arcade game by playing to minute five every time is slow. These jump straight
//       to a state. Each one sets `assisted`, so a cheated score is displayed but never saved as a best.
// HOW:  Type the word while playing (no text box). Matching lives in game/cheats.ts.
// LORE: G6 (modes and cheat codes)

import type { Cheat } from '../game/cheats';
import { MG } from './config';
import { flash, type MinigameState } from './sim';

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
  { code: 'WARP', message: 'skip ahead two minutes of difficulty', apply: (st) => { st.t += 120; assisted(st, 'TIME WARP'); } },
  { code: 'REPAIR', message: 'hull restored', apply: (st) => { st.hp = MG.MAX_HP; assisted(st, 'HULL REPAIRED'); } },
  { code: 'KARDASHEV', message: 'everything maxed', apply: (st) => { st.cheats.launchers = 8; st.cheats.streams = 5; st.pulses = MG.PULSE_MAX; st.cheats.god = true; assisted(st, 'KARDASHEV'); } },
];
