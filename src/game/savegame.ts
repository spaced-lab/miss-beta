// WHAT: Run <-> SAVE.md glue: build a SaveFile from the run, mirror it in localStorage, export/import.
// WHY:  GAME_PLAN 22.1: the run is saved as a markdown file, mirrored in localStorage, EXPORT downloads it,
//       IMPORT accepts drag and drop. The parser only trusts the front matter (game/saveMd.ts).
// HOW:  Saves happen at round boundaries only; EXPORT downloads the last one. CONTINUE rebuilds a RunState from the
//       SaveFile and starts that round fresh (missions in flight are not persisted; STATUS.md).
// LORE: G1 (how to play)

import { createPrograms, defaultEffects, programById, applyEffects } from '../sim/programs';
import { asProgram, studyById } from '../sim/studies';
import type { World } from '../sim/world';
import { budgetAt, createEconomy } from './economy';
import { loadJson, saveJson } from './persistence';
import { createRun, nextRound, type RunState } from './run';
import { loadSettings } from './settings';
import { mergeProgress, progress } from '../lore/store';
import { reapplyTech } from './tech';
import { parseSave, writeSave, type SaveFile } from './saveMd';
import { is3D } from '../sim/orbit3';

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
    ...(run.exaggerated ? { exaggerated: true } : {}),
    studies: run.studies.filter((x) => x.attempt > 0).map((x) => ({ id: x.id, attempt: x.attempt, progress: x.progress, funding: x.funding, status: x.status })),
    networks_active: [...run.networks.active],
    run_score: run.score,
    rounds_survived: run.roundsSurvived,
    current_threat: th ? { name: th.name, type: th.type.id, D_m: Math.round(th.D), t_impact_years: (th.tImpact - t) / 3.15576e7, p_impact: 1, ...(is3D(th.elements) ? { i_rad: th.elements.i, raan_rad: th.elements.raan } : {}) } : null,
    learning_level: loadSettings().learningLevel,
    lore_read: { ...progress },
    color_mode: loadSettings().colorMode,
  };
}

export function renderSave(run: RunState, world: World | null): string {
  return writeSave(toSaveFile(run, world), run.history);
}

/**
 * SAVE.md text for a finished round, as the start of the next one: a copy of the run goes through nextRound (round
 * + 1, rounds survived + 1, the budget banked at `budgetNow`), with no threat yet. NOTE: the debrief used to save the
 * finished round itself with its score already added, so CONTINUE replayed the same round from the same seed and
 * paid its score again (code review 2026-10-18). The live run is not touched.
 */
export function renderAfterRound(run: RunState, budgetNow: number): string {
  const next = structuredClone(run);
  nextRound(next, budgetNow);
  return renderSave(next, null);
}

/** Mirror a rendered SAVE.md in localStorage (the text a round boundary produced). */
export function storeSave(text: string): boolean {
  return saveJson(KEY, text);
}

/** True only for a save that parses, so the title never offers a run CONTINUE would refuse. */
export function hasSavedRun(): boolean {
  const text = loadSavedText();
  return text !== null && parseSave(text) !== null; // parse only: loadRun would also merge lore progress
}

function loadSavedText(): string | null {
  return loadJson<string | null>(KEY, (v): v is string => typeof v === 'string' && v.length < 300000, null);
}

/** Rebuild a RunState from a SaveFile. Program effects are re-applied so completed programs count. */
export function runFromSave(sf: SaveFile): RunState {
  mergeProgress(sf.lore_read);
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
  run.exaggerated = sf.exaggerated === true;
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
  for (const x of sf.studies ?? []) {
    const st = run.studies.find((y) => y.id === x.id);
    if (!st) continue;
    st.attempt = x.attempt;
    st.progress = x.progress;
    st.funding = x.funding;
    st.status = x.status;
    if (x.status === 'SUCCEEDED' || x.status === 'FAILED') st.endedAt = 0;
    if (x.status === 'SUCCEEDED') applyEffects(asProgram(studyById(x.id)), { economy: run.economy, effects: run.effects, networks: run.networks }, 0);
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

/**
 * Trigger a browser download of a SAVE.md text. Returns false when the DOM is unavailable. NOTE: callers pass the
 * last round-boundary save, never a mid-round snapshot: CONTINUE restarts a round at t = 0 without its missions, so
 * a mid-round budget would bank the round's accrued income and drop missions already paid for (code review
 * 2026-10-18).
 */
export function exportSave(text: string): boolean {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof Blob === 'undefined') return false;
  const blob = new Blob([text], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'SAVE.md';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
