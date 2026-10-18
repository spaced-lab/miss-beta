// WHAT: Civilization level advancing on its own (GAME_PLAN 22.3, IDEAS 14).
// WHY:  The cheat codes shortcut an honest progression: finish every REALISTIC program and SCI-FI opens without
//       a code; finish every SPECULATIVE program and SIMULATION opens. Programs a mode allows join the run.
// HOW:  `advanceCivilization(run)` counts completed program states against PROGRAMS, updates run.civLevel and
//       enters the next mode when earned; returns the line to announce, or null. Pure apart from the run.
// LORE: G6 (modes, civilization levels and cheat codes)

import { PROGRAMS, syncPrograms } from '../sim/programs';
import { civilizationLevel, enterMode, modeIndex } from './modes';
import type { RunState } from './run';

export function advanceCivilization(run: RunState): string | null {
  syncPrograms(run.programs, modeIndex(run.mode) >= 1 ? 'SCIFI' : 'REALISTIC');
  const done = (mode: 'REALISTIC' | 'SCIFI'): [number, number] => {
    const defs = PROGRAMS.filter((p) => p.mode === mode);
    const n = defs.filter((d) => run.programs.some((s) => s.id === d.id && s.completedAt !== null)).length;
    return [n, defs.length];
  };
  const [r, rt] = done('REALISTIC');
  const [f, ft] = done('SCIFI');
  const level = civilizationLevel(r, rt, f, ft);
  // NOTE: the mode checks run on every call, not only when the level rises: a cheat can set civLevel ahead of
  // the mode, and level 2 reached from REALISTIC needs one call to open SCI-FI and the next to open SIMULATION.
  // enterMode never lowers a mode, so repeating them is safe.
  const rose = level > run.civLevel;
  if (rose) run.civLevel = level;
  if (level >= 1 && run.mode === 'REALISTIC' && enterMode(run, 'SCIFI') === 'OK') {
    syncPrograms(run.programs, 'SCIFI');
    return 'CIVILIZATION LEVEL 1: EVERY REAL PROGRAM IS BUILT. SCI-FI IS OPEN: SPECULATIVE PROGRAMS AND METHODS JOIN THE PANELS.';
  }
  if (level >= 2 && run.mode === 'SCIFI' && enterMode(run, 'SIMULATION') === 'OK') {
    return 'CIVILIZATION LEVEL 2: EVERY SPECULATIVE PROGRAM IS BUILT. SOMETHING IN THE CONSOLE HAS STARTED ANSWERING BACK.';
  }
  return rose ? `CIVILIZATION LEVEL ${level}.` : null;
}
