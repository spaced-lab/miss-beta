// WHAT: A seeded fuzz of the SAVE.md parser and loader: tens of thousands of mutated and hostile saves.
// WHY:  SAVE.md is the one file a stranger can hand a player (drag and drop). docs/SAFETY.md asks for evidence that
//       a hand-edited save is rejected cleanly or loaded safely; reading the parser is not evidence, running it is.
// HOW:  A seeded Rng (no Math.random) mutates valid saves (byte flips, token splices, line edits, value swaps from a
//       hostile dictionary) and builds random ones. For every input: parseSave never throws; anything accepted
//       keeps the toSaveFile invariants, survives writeSave -> parseSave (the game's own autosave of an imported
//       file must load again) and runFromSave; Object.prototype never changes; no input is pathologically slow.
//       Failures print the seed-indexed case so they replay exactly. FUZZ_N scales the run (default 20000).
// LORE: C3 (tests)

import { describe, expect, it } from 'vitest';
import { parseSave, SAVE_MAX_ABS, SAVE_MAX_BYTES, writeSave, type SaveFile } from '../src/game/saveMd';
import { runFromSave } from '../src/game/savegame';
import { hashSeed, Rng } from '../src/sim/rng';

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
// FUZZ_N must be a positive whole number: '20k' or an empty value would run zero cases and fail on a confusing line.
const N = ((raw: string | undefined): number => {
  const n = Number(raw ?? 20000);
  if (!Number.isInteger(n) || n < 1) throw new Error(`FUZZ_N must be a positive whole number, got ${JSON.stringify(raw)}`);
  return n;
})(env['FUZZ_N']);

const base: SaveFile = {
  version: 1, seed: '8F3A21C9', started: '2026-10-17', round: 4, mode: 'REALISTIC', highest_mode: 'SCIFI', civ_level: 0, cheats_used: [],
  budget: 14.5, budget_per_year: 8, research: 37, tech: ['L2', 'I2', 'SL1', 'N1', 'T1', 'A1'],
  programs: [{ id: 'RADAR_NET', progress: 1, funding: 0 }, { id: 'SPACE_IR_SURVEYOR', progress: 0.62, funding: 1 }],
  studies: [{ id: 'HIVE_1', attempt: 1, progress: 0.4, funding: 1, status: 'RUNNING' }],
  networks_active: ['CATALINA', 'PANSTARRS', 'ATLAS'], run_score: 1180, rounds_survived: 3,
  current_threat: { name: '2041 KX-7', type: 'STONY', D_m: 310, t_impact_years: 6.1, p_impact: 0.97, i_rad: 0.3, raan_rad: 1.2 },
  learning_level: 'INTERMEDIATE', lore_read: { T1: 'ADVANCED', D3: 'INTERMEDIATE' }, color_mode: 'SPECTRUM',
};

// Values a hostile or careless editor might type. Strings that look like other types are the interesting ones.
const DICT = [
  '', ' ', '0', '-0', '1', '-1', '1.5', '1e308', '1e309', '-1e309', '5e-324', '12E45', '0x10', 'NaN', 'Infinity', '9007199254740993',
  'true', 'false', 'null', '~', 'yes', '"', '""', '"a"', '"a #b"', '"a, b"', '"\\""', '"\\u0000"', "'q'", '#', ' #c', ':', '::', ',', '{', '}',
  '[', ']', '{}', '[]', '[,]', '{a: 1}', '{__proto__: 1}', '{constructor: ADVANCED}', '[1, "x", null]', '__proto__', 'constructor',
  'prototype', 'toString', '<script>console.log(1)</script>', '<img src=x onerror=1>', '‮', '\ud800', 'é', '𝛽', 'A'.repeat(40),
  'REALISTIC', 'MULTIVERSE', 'EXPERT', 'SUCCEEDED', 'RADAR_NET', 'HIVE_1', '---', '- { id: X }', '\t', '\r',
];
const KEYS = ['version', 'seed', 'started', 'round', 'mode', 'highest_mode', 'civ_level', 'cheats_used', 'budget', 'budget_per_year', 'research', 'tech', 'programs', 'studies', 'exaggerated', 'networks_active', 'run_score', 'rounds_survived', 'current_threat', 'learning_level', 'lore_read', 'color_mode', '__proto__', 'constructor'];

function mutate(r: Rng, text: string): string {
  let t = text;
  const ops = r.int(1, 4);
  for (let k = 0; k < ops; k++) {
    const lines = t.split('\n');
    const li = r.int(0, Math.max(0, lines.length - 1));
    const line = lines[li] ?? '';
    switch (r.int(0, 8)) {
      case 0: { // flip one character to a random printable or special one
        if (t.length === 0) break;
        const i = r.int(0, t.length - 1);
        const c = r.next() < 0.8 ? String.fromCharCode(r.int(32, 126)) : r.pick(['\n', '\r', '\t', '\u0000', '"', '#', ':', ',', '{', '}']);
        t = t.slice(0, i) + c + t.slice(i + 1);
        break;
      }
      case 1: // splice a dictionary token at a random place
        { const i = r.int(0, t.length); t = t.slice(0, i) + r.pick(DICT) + t.slice(i); }
        break;
      case 2: // replace a value after "key:"
        { const m = /^(\s*-?\s*[A-Za-z_][A-Za-z0-9_]*:\s*)/.exec(line); if (m) lines[li] = m[1] + r.pick(DICT); t = lines.join('\n'); }
        break;
      case 3: // replace a value inside a flow map or list
        lines[li] = line.replace(/(:\s*)[^,}\]]+/, (_s, p: string) => p + r.pick(DICT)); t = lines.join('\n');
        break;
      case 4: lines.splice(li, 1); t = lines.join('\n'); break;
      case 5: lines.splice(li, 0, line); t = lines.join('\n'); break;
      case 6: lines.splice(li, 0, `${r.pick(KEYS)}: ${r.pick(DICT)}`); t = lines.join('\n'); break;
      case 7: t = t.slice(0, r.int(0, t.length)); break;
      default: lines[li] = `${r.pick(KEYS)}: ${r.pick(DICT)}`; t = lines.join('\n');
    }
  }
  return t;
}

/** A valid SaveFile with random but legal values, including awkward strings. */
function randomValid(r: Rng): SaveFile {
  const str = (): string => (r.next() < 0.5 ? r.pick(DICT) : Array.from({ length: r.int(1, 12) }, () => String.fromCharCode(r.int(32, 126))).join(''));
  const num = (): number => r.pick([0, -0, 1, -1, 0.1 + 0.2, 1e15, -1e15, 5e-324, 123456.789, r.float(-1e6, 1e6), r.int(-1000, 1000)]);
  const modes = ['REALISTIC', 'SCIFI', 'SIMULATION', 'MULTIVERSE'] as const;
  const seed = str().slice(0, 32);
  return {
    ...base,
    seed, started: str(), round: r.int(1, 1e6), mode: r.pick(modes), highest_mode: r.pick(modes), civ_level: num(), cheats_used: [str()],
    budget: num(), budget_per_year: num(), research: num(), tech: [str(), 'L2'], networks_active: [str()], run_score: num(), rounds_survived: num(),
    current_threat: r.next() < 0.2 ? null : { name: str(), type: str(), D_m: num(), t_impact_years: num(), p_impact: num() },
    lore_read: { [r.pick(['T1', 'D3', 'constructor', 'toString', 'x y'])]: r.pick(['BEGINNER', 'EXPERT', str()]) },
    color_mode: str(),
  };
}

const MODES = ['REALISTIC', 'SCIFI', 'SIMULATION', 'MULTIVERSE'];
const LEVELS = ['SIMPLE', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];

/** Every invariant toSaveFile promises; returns the first broken one, or null. */
function invariant(s: SaveFile): string | null {
  const fin = (v: number): boolean => Number.isFinite(v);
  if (s.version !== 1) return 'version';
  if (typeof s.seed !== 'string' || s.seed.length > 32) return 'seed';
  if (!Number.isInteger(s.round) || s.round < 1) return 'round';
  if (!MODES.includes(s.mode) || !MODES.includes(s.highest_mode)) return 'mode';
  if (![s.civ_level, s.budget, s.budget_per_year, s.research, s.run_score, s.rounds_survived].every((v) => fin(v) && Math.abs(v) <= SAVE_MAX_ABS)) return 'bounded numbers';
  if (!s.programs.every((p) => typeof p.id === 'string' && p.progress >= 0 && p.progress <= 1 && p.funding >= 0 && p.funding <= 1)) return 'programs';
  if (!(s.studies ?? []).every((x) => Number.isInteger(x.attempt) && x.attempt >= 0 && x.attempt <= 1000 && x.progress >= 0 && x.progress <= 1)) return 'studies';
  if (!LEVELS.includes(s.learning_level)) return 'learning_level';
  if (Object.getPrototypeOf(s.lore_read) !== Object.prototype || !Object.values(s.lore_read).every((v) => typeof v === 'string')) return 'lore_read';
  return null;
}

interface Failure { kind: string; i: number; detail: string; input: string }

/** Run every check on one input; returns the parsed save (null when rejected) so the caller need not parse again. */
function check(input: string, i: number, kind: string, fails: Failure[], slow: { ms: number; i: number }): SaveFile | null {
  const t0 = performance.now();
  let sf: SaveFile | null;
  try {
    sf = parseSave(input);
  } catch (e) {
    fails.push({ kind: 'parseSave threw', i, detail: String(e), input });
    return null;
  }
  const ms = performance.now() - t0;
  if (ms > slow.ms) { slow.ms = ms; slow.i = i; }
  if (!sf) return null;
  const bad = invariant(sf);
  if (bad) fails.push({ kind: `invariant ${bad}`, i, detail: kind, input });
  // The game re-renders an imported run with writeSave on its next autosave; that text must load again and be
  // stable from then on (the first write may round budget and progress).
  const again = parseSave(writeSave(sf));
  if (!again) fails.push({ kind: 'writeSave output rejected', i, detail: kind, input });
  else if (JSON.stringify(parseSave(writeSave(again))) !== JSON.stringify(again)) fails.push({ kind: 'writeSave not idempotent', i, detail: kind, input });
  try {
    const run = runFromSave(sf);
    if (!Number.isFinite(run.economy.start) || !Number.isFinite(run.economy.perYear)) fails.push({ kind: 'runFromSave non-finite economy', i, detail: kind, input });
  } catch (e) {
    fails.push({ kind: 'runFromSave threw', i, detail: String(e), input });
  }
  return sf;
}

describe('SAVE.md fuzz', () => {
  it(`${N} mutated, random and hostile saves: no throw, invariants hold, autosave reloads, prototype untouched`, () => {
    const protoBefore = Object.getOwnPropertyNames(Object.prototype).sort().join();
    const r = new Rng(hashSeed('fuzz:saveMd'));
    const fails: Failure[] = [];
    const slow = { ms: 0, i: -1 };
    const seedText = writeSave(base);
    let accepted = 0;
    for (let i = 0; i < N; i++) {
      const roll = r.next();
      const valid = roll < 0.6 ? null : randomValid(r);
      const input = valid === null ? mutate(r, seedText) : roll < 0.9 ? writeSave(valid) : mutate(r, writeSave(valid));
      const before = fails.length;
      const sf = check(input, i, roll < 0.6 ? 'mutated' : roll < 0.9 ? 'random valid' : 'mutated random', fails, slow);
      if (fails.length === before && sf) accepted++;
      // A save the game itself could hold must survive its own writer.
      if (valid && roll < 0.9 && !sf) fails.push({ kind: 'writeSave of a valid save rejected', i, detail: JSON.stringify(valid).slice(0, 300), input });
    }
    // Size limits: just under the cap parses, just over is rejected without throwing.
    const pad = (n: number): string => seedText + 'X'.repeat(Math.max(0, n - seedText.length));
    expect(parseSave(pad(SAVE_MAX_BYTES))).not.toBeNull();
    expect(parseSave(pad(SAVE_MAX_BYTES + 1))).toBeNull();
    // A worst case for the line scanner: the cap filled with one long front-matter value.
    const t0 = performance.now();
    parseSave(`---\nseed: "${'a,'.repeat(SAVE_MAX_BYTES / 2 - 20)}"\n---\n`);
    const longMs = performance.now() - t0;

    expect(Object.getOwnPropertyNames(Object.prototype).sort().join()).toBe(protoBefore);
    expect(({} as Record<string, unknown>)['ADVANCED']).toBeUndefined();
    const byKind = new Map<string, Failure>();
    for (const f of fails) if (!byKind.has(f.kind)) byKind.set(f.kind, f);
    const report = [...byKind.values()].map((f) => `${f.kind} (case ${f.i}, ${f.detail}, ${fails.filter((x) => x.kind === f.kind).length}x): ${JSON.stringify(f.input.slice(0, 400))}`);
    expect(report, report.join('\n\n')).toEqual([]);
    expect(accepted, 'the fuzzer must reach the accepting path, not only the rejecting one').toBeGreaterThan(N * 0.2);
    expect(slow.ms, `slowest case ${slow.i}`).toBeLessThan(250);
    expect(longMs).toBeLessThan(500);
  }, 120_000);

  it('the cases the fuzz found stay fixed: awkward strings survive writeSave -> parseSave unchanged', () => {
    const { studies: _studies, ...rest } = base;
    const ok: SaveFile = { ...rest, current_threat: null, lore_read: {} };
    for (const s of ['12E45', 'true', 'null', '-0', 'a #b', 'x #', 'a, b', 'q"q', '"', 'a\\b', '{', '}', '[', ']', ':', '#x', ' lead', 'trail ', '', 'é', '\u202e', 'x\ny']) {
      for (const v of [{ ...ok, started: s }, { ...ok, color_mode: s }, { ...ok, tech: [s, 'L2'] }, { ...ok, current_threat: { name: s, type: 'S', D_m: 1, t_impact_years: 1, p_impact: 1 } }, { ...ok, lore_read: { T1: s } }]) {
        expect(parseSave(writeSave(v)), JSON.stringify(s)).toEqual(v);
      }
    }
    // Numbers beyond SAVE_MAX_ABS are clamped, never turned into Infinity by the next autosave, never a rejection.
    const big = parseSave(writeSave(base).replace('budget: 14.5', 'budget: 1e308'));
    expect(big?.budget).toBe(SAVE_MAX_ABS);
    expect(big && parseSave(writeSave(big))?.budget).toBe(SAVE_MAX_ABS);
    expect(parseSave(writeSave(base).replace('budget: 14.5', 'budget: 1e999'))).toBeNull();
    // lore_read keeps topic-id keys only (docs/SAFETY.md finding 9).
    expect(parseSave(writeSave(base).replace('lore_read: {', 'lore_read: {constructor: ADVANCED, __proto__: ADVANCED, '))?.lore_read).toEqual(base.lore_read);
  });
});
