// WHAT: Run <-> SAVE.md glue: build a SaveFile from the run, mirror it in localStorage, export/import.
// WHY:  GAME_PLAN 22.1: the run is saved as a markdown file, mirrored in localStorage, EXPORT downloads it,
//       IMPORT accepts drag and drop. The parser only trusts the front matter (game/saveMd.ts).
// HOW:  Saves happen at round boundaries and on EXPORT. CONTINUE rebuilds a RunState from the SaveFile and
//       starts that round fresh (missions in flight are not persisted; STATUS.md).
// LORE: G1 (how to play)

import { createPrograms, defaultEffects, programById, applyEffects } from '../sim/programs';
import type { World } from '../sim/world';
import { budgetAt, createEconomy } from './economy';
import { loadJson, saveJson } from './persistence';
import { createRun, type RunState } from './run';
import { reapplyTech } from './tech';
import { parseSave, writeSave, type SaveFile } from './saveMd';

const KEY = 'save.current';

export function toSaveFile(run: RunState, world: World | null): SaveFile {
  const t = world?.t ?? 0;
  const th = world?.threat ?? null;
  return {
    version: 1,
    seed: run.seed,
    started: run.startedAt,
    round: run.round,
    mode: run.mode,
    highest_mode: run.highestMode,
    civ_level: run.civLevel,
    cheats_used: [...run.cheatsUsed],
    budget: budgetAt(run.economy, t),
    budget_per_year: run.economy.perYear,
    research: run.research,
    tech: [...run.tech],
    programs: run.programs.map((p) => ({ id: p.id, progress: p.progress, funding: p.funding })),
    networks_active: [...run.networks.active],
    run_score: run.score,
    rounds_survived: run.roundsSurvived,
    current_threat: th ? { name: th.name, type: th.type.id, D_m: Math.round(th.D), t_impact_years: (th.tImpact - t) / 3.15576e7, p_impact: 1 } : null,
    learning_level: 'BEGINNER',
    lore_read: {},
    color_mode: 'PHOSPHOR',
  };
}

export function renderSave(run: RunState, world: World | null): string {
  return writeSave(toSaveFile(run, world), run.history);
}

/** Mirror the save in localStorage (as the markdown text). */
export function saveRun(run: RunState, world: World | null, _unused: null): boolean {
  return saveJson(KEY, renderSave(run, world));
}

export function hasSavedRun(): boolean {
  return loadSavedText() !== null;
}

function loadSavedText(): string | null {
  return loadJson<string | null>(KEY, (v): v is string => typeof v === 'string' && v.length < 300000, null);
}

/** Rebuild a RunState from a SaveFile. Program effects are re-applied so completed programs count. */
export function runFromSave(sf: SaveFile): RunState {
  const run = createRun(sf.seed);
  run.startedAt = sf.started;
  run.round = sf.round;
  run.economy = createEconomy(sf.budget, sf.budget_per_year);
  run.research = sf.research;
  run.score = sf.run_score;
  run.roundsSurvived = sf.rounds_survived;
  run.cheatsUsed = [...sf.cheats_used];
  run.assisted = sf.cheats_used.length > 0;
  run.sandbox = sf.cheats_used.includes('SANDBOX');
  run.tutorial = false;
  run.mode = sf.mode;
  run.highestMode = sf.highest_mode;
  run.civLevel = sf.civ_level;
  run.tech = [...sf.tech];
  reapplyTech(run);
  run.programs = createPrograms();
  run.effects = defaultEffects();
  run.networks = { active: [...sf.networks_active], since: {} };
  // NOTE: perYear in the save already includes completed programs' budget bonuses; re-applying effects would
  // double them, so the economy is rebuilt afterwards from the saved numbers.
  for (const p of sf.programs) {
    const st = run.programs.find((x) => x.id === p.id);
    if (!st) continue;
    st.progress = p.progress;
    st.funding = p.funding;
    if (p.progress >= 1) {
      st.completedAt = 0;
      try {
        applyEffects(programById(p.id), { economy: run.economy, effects: run.effects, networks: run.networks }, 0);
      } catch {
        // unknown program id in an edited save: ignore
      }
    }
  }
  run.economy = createEconomy(sf.budget, sf.budget_per_year);
  return run;
}

export function loadRun(): RunState | null {
  const text = loadSavedText();
  if (!text) return null;
  const sf = parseSave(text);
  return sf ? runFromSave(sf) : null;
}

/** Import from text (drag and drop); returns the run or null. */
export function importRun(text: string): RunState | null {
  const sf = parseSave(text);
  if (!sf) return null;
  saveJson(KEY, text);
  return runFromSave(sf);
}

/** Trigger a browser download of SAVE.md. Returns false when the DOM is unavailable. */
export function exportSave(run: RunState, world: World | null): boolean {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof Blob === 'undefined') return false;
  const blob = new Blob([renderSave(run, world)], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'SAVE.md';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
