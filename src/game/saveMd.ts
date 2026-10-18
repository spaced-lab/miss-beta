// WHAT: SAVE.md writer and parser (GAME_PLAN 22.1): a markdown file the player can read, with YAML front
//       matter the game reads back.
// WHY:  Saves should be portable and legible. The parser reads only the front matter; the tables below it
//       are regenerated on every save, so a player can hand-edit a field and still load.
// HOW:  A deliberately small YAML subset (docs/WARNINGS.md 3: untrusted input): `key: scalar`, `key: [a, b]`,
//       `key: { k: v, ... }`, and `key:` followed by `- { ... }` items. Strings, numbers, booleans, null.
//       Everything parsed is checked by a type guard before it becomes run state; unknown keys are ignored.
//       The size is capped so a hostile file cannot stall the parser.
// LORE: G1 (how to play), C2 (reading the code)

export interface SaveProgram {
  id: string;
  progress: number;
  funding: number;
}

export interface SaveThreat {
  name: string;
  type: string;
  D_m: number;
  t_impact_years: number;
  p_impact: number;
  /**
   * M14 phase 2: a visitor off the ecliptic records its inclination and node, rad (exact doubles). Absent in
   * older saves and for planar threats, which read as i = 0 (the round itself regenerates from the seed).
   */
  i_rad?: number;
  raan_rad?: number;
}

export interface SaveStudy {
  id: string;
  attempt: number;
  progress: number;
  funding: number;
  status: 'IDLE' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
}

export interface SaveFile {
  version: 1;
  seed: string;
  started: string;
  round: number;
  mode: 'REALISTIC' | 'SCIFI' | 'SIMULATION' | 'MULTIVERSE';
  highest_mode: 'REALISTIC' | 'SCIFI' | 'SIMULATION' | 'MULTIVERSE';
  civ_level: number;
  cheats_used: string[];
  budget: number;
  budget_per_year: number;
  research: number;
  tech: string[];
  programs: SaveProgram[];
  /** Feasibility studies that were ever started (optional: older saves have none). */
  studies?: SaveStudy[];
  /** Run stamped EXAGGERATED (interstellar rate above REAL); optional for older saves. */
  exaggerated?: boolean;
  networks_active: string[];
  run_score: number;
  rounds_survived: number;
  current_threat: SaveThreat | null;
  learning_level: 'SIMPLE' | 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
  lore_read: Record<string, string>;
  color_mode: string;
}

export const SAVE_MAX_BYTES = 256 * 1024;

type Scalar = string | number | boolean | null;
type Value = Scalar | Scalar[] | Record<string, Scalar> | Record<string, Scalar>[];

function fmtScalar(v: Scalar): string {
  if (v === null) return 'null';
  if (typeof v === 'string') return /^[A-Za-z0-9_.:-]+$/.test(v) && v !== '' ? v : JSON.stringify(v);
  return String(v);
}

function fmtValue(v: Value): string {
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]';
    if (typeof v[0] === 'object' && v[0] !== null) return '\n' + (v as Record<string, Scalar>[]).map((o) => `  - { ${Object.entries(o).map(([k, x]) => `${k}: ${fmtScalar(x)}`).join(', ')} }`).join('\n');
    return `[${(v as Scalar[]).map(fmtScalar).join(', ')}]`;
  }
  if (typeof v === 'object' && v !== null) return `{ ${Object.entries(v).map(([k, x]) => `${k}: ${fmtScalar(x)}`).join(', ')} }`;
  return fmtScalar(v);
}

export function writeSave(s: SaveFile, rounds: { round: number; threat: string; type: string; D: number; lead: number; by: string; plan: string; outcome: string; score: number }[] = []): string {
  const fm: [string, Value][] = [
    ['version', s.version],
    ['seed', s.seed],
    ['started', s.started],
    ['round', s.round],
    ['mode', s.mode],
    ['highest_mode', s.highest_mode],
    ['civ_level', s.civ_level],
    ['cheats_used', s.cheats_used],
    ['budget', Math.round(s.budget * 100) / 100],
    ['budget_per_year', s.budget_per_year],
    ['research', s.research],
    ['tech', s.tech],
    ['programs', s.programs.map((p) => ({ id: p.id, progress: Math.round(p.progress * 1000) / 1000, funding: p.funding }))],
    ...((s.studies?.length ?? 0) > 0 ? ([['studies', (s.studies ?? []).map((x) => ({ id: x.id, attempt: x.attempt, progress: Math.round(x.progress * 1000) / 1000, funding: x.funding, status: x.status }))]] as [string, Value][]) : []),
    ...(s.exaggerated ? ([['exaggerated', true]] as [string, Value][]) : []),
    ['networks_active', s.networks_active],
    ['run_score', s.run_score],
    ['rounds_survived', s.rounds_survived],
    ['current_threat', s.current_threat ? { name: s.current_threat.name, type: s.current_threat.type, D_m: s.current_threat.D_m, t_impact_years: Math.round(s.current_threat.t_impact_years * 100) / 100, p_impact: s.current_threat.p_impact, ...(s.current_threat.i_rad !== undefined && s.current_threat.raan_rad !== undefined ? { i_rad: s.current_threat.i_rad, raan_rad: s.current_threat.raan_rad } : {}) } : null],
    ['learning_level', s.learning_level],
    ['lore_read', s.lore_read],
    ['color_mode', s.color_mode],
  ];
  const lines = ['---', ...fm.map(([k, v]) => `${k}: ${fmtValue(v)}`), '---', `# RUN ${s.seed}`, '', '| Round | Threat | Type | D (m) | Lead (y) | Discovered by | Plan | Outcome | Score |', '|---|---|---|---|---|---|---|---|---|'];
  for (const r of rounds) lines.push(`| ${r.round} | ${r.threat} | ${r.type} | ${r.D.toFixed(0)} | ${r.lead.toFixed(1)} | ${r.by} | ${r.plan} | ${r.outcome} | ${r.score} |`);
  lines.push('', '## Programs', '', '| Program | Progress | Funding |', '|---|---|---|');
  for (const p of s.programs) lines.push(`| ${p.id} | ${(p.progress * 100).toFixed(0)}% | ${p.progress >= 1 ? 'done' : p.funding >= 1 ? 'full' : p.funding > 0 ? `${(p.funding * 100).toFixed(0)}%` : 'none'} |`);
  return lines.join('\n') + '\n';
}

// --- parser -------------------------------------------------------------------------------------------------

function parseScalar(raw: string): Scalar {
  const t = raw.trim();
  if (t === 'null' || t === '~' || t === '') return null;
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (/^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(t)) return Number(t);
  if (t.startsWith('"') && t.endsWith('"')) {
    try {
      const v: unknown = JSON.parse(t);
      return typeof v === 'string' ? v : t;
    } catch {
      return t.slice(1, -1);
    }
  }
  return t;
}

function parseFlowMap(raw: string): Record<string, Scalar> {
  const inner = raw.trim().replace(/^\{/, '').replace(/\}$/, '');
  const out: Record<string, Scalar> = {};
  for (const part of splitTop(inner)) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = parseScalar(part.slice(i + 1));
  }
  return out;
}

/** Split on commas outside quotes. */
function splitTop(s: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (const ch of s) {
    if (ch === '"') q = !q;
    if (ch === ',' && !q) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur.trim() !== '') out.push(cur);
  return out;
}

function parseValue(raw: string): Value {
  const t = raw.trim();
  if (t.startsWith('[')) {
    const inner = t.replace(/^\[/, '').replace(/\]$/, '');
    return inner.trim() === '' ? [] : splitTop(inner).map(parseScalar);
  }
  if (t.startsWith('{')) return parseFlowMap(t);
  return parseScalar(t);
}

/** Parse the YAML front matter into a plain record. Throws on malformed input or oversized text. */
export function parseFrontMatter(text: string): Record<string, Value> {
  if (text.length > SAVE_MAX_BYTES) throw new Error('save too large');
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') throw new Error('no front matter');
  const out: Record<string, Value> = {};
  let i = 1;
  while (i < lines.length && lines[i]?.trim() !== '---') {
    const line = lines[i] as string;
    i++;
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    const m = /^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/.exec(line);
    if (!m) throw new Error(`bad line: ${line.slice(0, 40)}`);
    const key = m[1] as string;
    const rest = (m[2] as string).replace(/\s+#.*$/, '');
    if (rest.trim() === '') {
      // Block list of flow maps.
      const items: Record<string, Scalar>[] = [];
      while (i < lines.length && /^\s+-\s*\{/.test(lines[i] as string)) {
        items.push(parseFlowMap((lines[i] as string).replace(/^\s+-\s*/, '')));
        i++;
      }
      out[key] = items;
    } else {
      out[key] = parseValue(rest);
    }
  }
  if (i >= lines.length) throw new Error('unterminated front matter');
  return out;
}

const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);

/** Validate a parsed record into a SaveFile, or return null. Unknown keys are ignored. */
export function toSaveFile(r: Record<string, unknown>): SaveFile | null {
  const modes = ['REALISTIC', 'SCIFI', 'SIMULATION', 'MULTIVERSE'];
  const levels = ['SIMPLE', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];
  if (r['version'] !== 1) return null;
  if (!isStr(r['seed']) || r['seed'].length > 32 || !isStr(r['started'])) return null;
  if (!isNum(r['round']) || !Number.isInteger(r['round']) || r['round'] < 1) return null;
  if (!isStr(r['mode']) || !modes.includes(r['mode']) || !isStr(r['highest_mode']) || !modes.includes(r['highest_mode'])) return null;
  if (!isNum(r['civ_level']) || !isStrArr(r['cheats_used'])) return null;
  if (!isNum(r['budget']) || !isNum(r['budget_per_year']) || !isNum(r['research']) || !isStrArr(r['tech'])) return null;
  const programs = r['programs'];
  if (!Array.isArray(programs)) return null;
  const ps: SaveProgram[] = [];
  for (const p of programs) {
    if (typeof p !== 'object' || p === null) return null;
    const o = p as Record<string, unknown>;
    if (!isStr(o['id']) || !isNum(o['progress']) || !isNum(o['funding'])) return null;
    ps.push({ id: o['id'], progress: Math.max(0, Math.min(1, o['progress'])), funding: Math.max(0, Math.min(1, o['funding'])) });
  }
  const studyStatuses = ['IDLE', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED'];
  const ss: SaveStudy[] = [];
  const studies = r['studies'];
  if (studies !== undefined) {
    if (!Array.isArray(studies)) return null;
    for (const x of studies) {
      if (typeof x !== 'object' || x === null) return null;
      const o = x as Record<string, unknown>;
      if (!isStr(o['id']) || !isNum(o['attempt']) || !Number.isInteger(o['attempt']) || o['attempt'] < 0 || o['attempt'] > 1000 || !isNum(o['progress']) || !isNum(o['funding']) || !isStr(o['status']) || !studyStatuses.includes(o['status'])) return null;
      ss.push({ id: o['id'], attempt: o['attempt'], progress: Math.max(0, Math.min(1, o['progress'])), funding: Math.max(0, Math.min(1, o['funding'])), status: o['status'] as SaveStudy['status'] });
    }
  }
  if (!isStrArr(r['networks_active']) || !isNum(r['run_score']) || !isNum(r['rounds_survived'])) return null;
  let threat: SaveThreat | null = null;
  const ct = r['current_threat'];
  if (ct !== null && ct !== undefined) {
    if (typeof ct !== 'object') return null;
    const o = ct as Record<string, unknown>;
    if (!isStr(o['name']) || !isStr(o['type']) || !isNum(o['D_m']) || !isNum(o['t_impact_years']) || !isNum(o['p_impact'])) return null;
    threat = { name: o['name'], type: o['type'], D_m: o['D_m'], t_impact_years: o['t_impact_years'], p_impact: o['p_impact'] };
    // Both or neither, in range; anything else is a malformed save.
    const iR = o['i_rad'];
    const nR = o['raan_rad'];
    if (iR !== undefined || nR !== undefined) {
      if (!isNum(iR) || !isNum(nR) || iR < 0 || iR > Math.PI || nR < -2 * Math.PI || nR > 4 * Math.PI) return null;
      threat.i_rad = iR;
      threat.raan_rad = nR;
    }
  }
  if (!isStr(r['learning_level']) || !levels.includes(r['learning_level'])) return null;
  const lr = r['lore_read'];
  const loreRead: Record<string, string> = {};
  if (typeof lr === 'object' && lr !== null && !Array.isArray(lr)) for (const [k, v] of Object.entries(lr as Record<string, unknown>)) if (isStr(v)) loreRead[k] = v;
  if (!isStr(r['color_mode'])) return null;
  return {
    version: 1,
    seed: r['seed'],
    started: r['started'],
    round: r['round'],
    mode: r['mode'] as SaveFile['mode'],
    highest_mode: r['highest_mode'] as SaveFile['mode'],
    civ_level: r['civ_level'],
    cheats_used: r['cheats_used'],
    budget: r['budget'],
    budget_per_year: r['budget_per_year'],
    research: r['research'],
    tech: r['tech'],
    programs: ps,
    ...(ss.length > 0 ? { studies: ss } : {}),
    ...(r['exaggerated'] === true ? { exaggerated: true } : {}),
    networks_active: r['networks_active'],
    run_score: r['run_score'],
    rounds_survived: r['rounds_survived'],
    current_threat: threat,
    learning_level: r['learning_level'] as SaveFile['learning_level'],
    lore_read: loreRead,
    color_mode: r['color_mode'],
  };
}

export function parseSave(text: string): SaveFile | null {
  try {
    return toSaveFile(parseFrontMatter(text) as Record<string, unknown>);
  } catch {
    return null;
  }
}
