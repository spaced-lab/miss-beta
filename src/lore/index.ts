// WHAT: Lore loader (GAME_PLAN 23, EDUCATION.md 0.4): the index, topic chunks on demand, an LRU cache.
// WHY:  The bundle carries no lore text; nothing is fetched until the first panel opens, and memory stays
//       bounded (2 MB of chunks) however long someone reads.
// HOW:  `fetchFn` is injectable (tests pass a fake). `markdownToLines` flattens the chunk's markdown to
//       plain lines the stroke font can draw: headings kept, emphasis stripped, code fences indented,
//       tables as rows, word-wrapped to a column count by the caller.
// LORE: C1 (how it is built), G8 (the look)

export type Level = 'SIMPLE' | 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
export const LEVELS: readonly Level[] = ['SIMPLE', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];
export const LEVEL_TABS: Readonly<Record<Level, string>> = { SIMPLE: 'S', BEGINNER: 'B', INTERMEDIATE: 'I', ADVANCED: 'A', EXPERT: 'E' };

export interface TopicMeta {
  id: string;
  group: string;
  title: string;
  tags: string[];
  related: string[];
  game: string[];
  levels: Level[];
  pictureId: string | null;
  demoId: string | null;
}

export interface LoreIndex {
  topics: TopicMeta[];
  groups: Record<string, string>;
  labs: string[];
}

export interface Chunk {
  id: string;
  level: Level;
  title: string;
  markdown: string;
  pictureId: string | null;
  demoId: string | null;
  pictureCaption?: string;
}

export type FetchFn = (url: string) => Promise<unknown>;

/** [knob] LRU cache cap for topic chunks, bytes (EDUCATION.md 0.4). */
export const LORE_CACHE_BYTES = 2 * 1024 * 1024;

const defaultFetch: FetchFn = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`lore: ${url} ${r.status}`);
  return r.json();
};

function isIndex(v: unknown): v is LoreIndex {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return Array.isArray(o.topics) && typeof o.groups === 'object' && Array.isArray(o.labs) && o.topics.every((t) => t && typeof t === 'object' && typeof (t as TopicMeta).id === 'string' && typeof (t as TopicMeta).title === 'string');
}

function isChunk(v: unknown): v is Chunk {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.id === 'string' && typeof o.level === 'string' && typeof o.title === 'string' && typeof o.markdown === 'string';
}

export class LoreStore {
  private index: LoreIndex | null = null;
  private indexPromise: Promise<LoreIndex> | null = null;
  private readonly cache = new Map<string, { chunk: Chunk; bytes: number }>();
  private bytes = 0;
  /** Fetches made (tests assert zero before the first panel opens). */
  fetches = 0;

  constructor(private readonly base = 'lore/', private readonly fetchFn: FetchFn = defaultFetch, private readonly cap = LORE_CACHE_BYTES) {}

  get loadedIndex(): LoreIndex | null {
    return this.index;
  }

  loadIndex(): Promise<LoreIndex> {
    if (this.index) return Promise.resolve(this.index);
    if (!this.indexPromise) {
      this.fetches++;
      this.indexPromise = this.fetchFn(`${this.base}index.json`).then((v) => {
        if (!isIndex(v)) throw new Error('lore: bad index');
        this.index = v;
        return v;
      });
    }
    return this.indexPromise;
  }

  topic(id: string): TopicMeta | null {
    return this.index?.topics.find((t) => t.id === id) ?? null;
  }

  get cachedBytes(): number {
    return this.bytes;
  }

  async chunk(id: string, level: Level): Promise<Chunk> {
    const key = `${id}/${level}`;
    const hit = this.cache.get(key);
    if (hit) {
      // LRU: re-insert so the entry becomes the newest.
      this.cache.delete(key);
      this.cache.set(key, hit);
      return hit.chunk;
    }
    this.fetches++;
    const v = await this.fetchFn(`${this.base}${id}/${level}.json`);
    if (!isChunk(v)) throw new Error(`lore: bad chunk ${key}`);
    const size = JSON.stringify(v).length;
    this.cache.set(key, { chunk: v, bytes: size });
    this.bytes += size;
    while (this.bytes > this.cap && this.cache.size > 1) {
      const oldest = this.cache.keys().next().value as string;
      const ev = this.cache.get(oldest);
      this.cache.delete(oldest);
      if (ev) this.bytes -= ev.bytes;
    }
    return v;
  }
}

/** Word-wrap one paragraph to at most `cols` characters per line. */
export function wrap(text: string, cols: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter((w) => w.length > 0)) {
    if (line.length === 0) line = word;
    else if (line.length + 1 + word.length <= cols) line += ' ' + word;
    else {
      out.push(line);
      line = word;
    }
    while (line.length > cols) {
      out.push(line.slice(0, cols));
      line = line.slice(cols);
    }
  }
  if (line.length > 0) out.push(line);
  return out;
}

export interface LoreLine {
  text: string;
  kind: 'text' | 'code' | 'head' | 'blank' | 'bullet' | 'table';
}

/**
 * Flatten chunk markdown into drawable lines: fenced code kept verbatim (kind code), headings (kind head),
 * list items (bullet), table rows (table, pipes kept), prose wrapped to `cols`. Emphasis and inline code
 * markers are stripped; links keep their text.
 */
export function markdownToLines(md: string, cols: number): LoreLine[] {
  const out: LoreLine[] = [];
  let inCode = false;
  let para: string[] = [];
  const flush = (): void => {
    if (para.length === 0) return;
    for (const l of wrap(para.join(' '), cols)) out.push({ text: l, kind: 'text' });
    para = [];
  };
  for (const raw of md.split('\n')) {
    if (raw.trim().startsWith('```')) {
      flush();
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      out.push({ text: raw.replace(/\t/g, '  '), kind: 'code' });
      continue;
    }
    const t = raw.trim();
    if (t === '') {
      flush();
      if (out.length > 0 && out[out.length - 1]?.kind !== 'blank') out.push({ text: '', kind: 'blank' });
      continue;
    }
    if (t.startsWith('#')) {
      flush();
      out.push({ text: t.replace(/^#+\s*/, ''), kind: 'head' });
      continue;
    }
    if (t.startsWith('|')) {
      flush();
      if (!/^\|[\s:|-]+\|$/.test(t)) out.push({ text: t.replace(/^\||\|$/g, '').split('|').map((c) => c.trim()).join('  |  '), kind: 'table' });
      continue;
    }
    const clean = inline(t);
    if (/^[-*]\s+/.test(t)) {
      flush();
      const lines = wrap(clean.replace(/^[-*]\s+/, ''), cols - 2);
      lines.forEach((l, i) => out.push({ text: (i === 0 ? '- ' : '  ') + l, kind: 'bullet' }));
      continue;
    }
    if (/^(PICTURE|TEXT|DEMO|NOTES|MORE):/.test(t)) {
      flush();
      const [k, ...rest] = clean.split(':');
      const body = rest.join(':').trim();
      if (k === 'PICTURE' || k === 'TEXT') continue;
      out.push({ text: `${k}`, kind: 'head' });
      for (const l of wrap(body, cols)) out.push({ text: l, kind: 'text' });
      continue;
    }
    para.push(clean);
  }
  flush();
  while (out.length > 0 && out[out.length - 1]?.kind === 'blank') out.pop();
  return out;
}

function inline(t: string): string {
  return t
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
}

/** Reading progress: highest level read per topic (EDUCATION.md Section 9). */
export const LEVEL_RANK: Readonly<Record<Level, number>> = { SIMPLE: 0, BEGINNER: 1, INTERMEDIATE: 2, ADVANCED: 3, EXPERT: 4 };

export function markRead(progress: Record<string, string>, id: string, level: Level): boolean {
  const cur = progress[id];
  if (cur && LEVEL_RANK[cur as Level] >= LEVEL_RANK[level]) return false;
  progress[id] = level;
  return true;
}

export function isProgress(v: unknown): v is Record<string, string> {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.values(v as Record<string, unknown>).every((x) => typeof x === 'string' && (LEVELS as readonly string[]).includes(x));
}
