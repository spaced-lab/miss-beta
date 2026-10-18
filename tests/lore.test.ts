// M9: the lore loader (lazy, LRU-capped, validated), markdown flattening, progress, the lab registry, and
// the built index on disk (scripts/build_lore.py output) when present.
import { describe, expect, it } from 'vitest';
// @ts-ignore node types are not installed; fs is available in the test runner
import { existsSync, readFileSync } from 'fs';
import { isProgress, LEVELS, LoreStore, markRead, markdownToLines, wrap, type Chunk } from '../src/lore/index';
import { BUILT_LABS, labStatus, loadLab } from '../src/lore/labs/index';
import { nudge, values } from '../src/lore/labs/lab';
import { substitute, hasGlyph } from '../src/render/vectorFont';

function fakeFetch(log: string[]) {
  return async (url: string): Promise<unknown> => {
    log.push(url);
    if (url.endsWith('index.json')) return { topics: [{ id: 'T1', group: 'T', title: 'What', tags: [], related: ['T2'], game: [], levels: LEVELS, pictureId: 'pic-neo-orbits', demoId: null }, { id: 'T2', group: 'T', title: 'Size', tags: [], related: [], game: [], levels: LEVELS, pictureId: 'pic-size-ladder', demoId: 'LAB_IMPACT_ENERGY' }], groups: { T: 'THE THREAT' }, labs: ['LAB_IMPACT_ENERGY'] };
    const m = /lore\/([A-Z0-9]+)\/([A-Z]+)\.json$/.exec(url);
    if (!m) throw new Error('404');
    const chunk: Chunk = { id: m[1]!, level: m[2] as Chunk['level'], title: 'x', markdown: 'word '.repeat(2000), pictureId: null, demoId: null };
    return chunk;
  };
}

describe('LORE loader', () => {
  it('fetches nothing until asked, then the index once, and chunks on demand with an LRU cap', async () => {
    const log: string[] = [];
    const store = new LoreStore('lore/', fakeFetch(log), 30000);
    expect(store.fetches).toBe(0);
    expect(log.length).toBe(0);
    await store.loadIndex();
    await store.loadIndex();
    expect(store.fetches).toBe(1);
    expect(store.topic('T1')?.related).toEqual(['T2']);
    const a = await store.chunk('T1', 'BEGINNER');
    const b = await store.chunk('T1', 'BEGINNER');
    expect(a).toBe(b);
    expect(store.fetches).toBe(2);
    // Each chunk is ~10 KB; the 30 KB cap keeps about three.
    for (const lv of LEVELS) await store.chunk('T2', lv);
    expect(store.cachedBytes).toBeLessThanOrEqual(30000);
    expect(store.cachedBytes).toBeGreaterThan(10000);
    // The evicted first chunk is fetched again.
    const before = store.fetches;
    await store.chunk('T1', 'BEGINNER');
    expect(store.fetches).toBe(before + 1);
  });

  it('rejects a bad index and a bad chunk', async () => {
    const bad = new LoreStore('lore/', async () => ({ nope: true }));
    await expect(bad.loadIndex()).rejects.toThrow(/bad index/);
    const bad2 = new LoreStore('lore/', async (u) => (u.endsWith('index.json') ? { topics: [], groups: {}, labs: [] } : { id: 1 }));
    await bad2.loadIndex();
    await expect(bad2.chunk('T1', 'SIMPLE')).rejects.toThrow(/bad chunk/);
  });

  it('the shared store at boot has made no fetch', async () => {
    const mod = await import('../src/lore/store');
    expect(mod.lore.fetches).toBe(0);
  });
});

describe('markdown to lines', () => {
  it('wraps prose, keeps code fences and tables, strips emphasis, turns EXPERT fields into headings', () => {
    const md = 'Some **bold** and `code` text that is long enough to wrap onto a second line for sure.\n\n```\nx = 1\n```\n| a | b |\n|---|---|\n| 1 | 2 |\n- item one\nDEMO: LAB_BETA\nNOTES: a note.';
    const lines = markdownToLines(md, 40);
    expect(lines[0]!.kind).toBe('text');
    expect(lines[0]!.text).toContain('Some bold and code');
    expect(lines.every((l) => l.text.length <= 40 || l.kind === 'code' || l.kind === 'table')).toBe(true);
    expect(lines.some((l) => l.kind === 'code' && l.text === 'x = 1')).toBe(true);
    expect(lines.filter((l) => l.kind === 'table').map((l) => l.text)).toEqual(['a  |  b', '1  |  2']);
    expect(lines.some((l) => l.kind === 'bullet' && l.text === '- item one')).toBe(true);
    expect(lines.some((l) => l.kind === 'head' && l.text === 'NOTES')).toBe(true);
    expect(lines.some((l) => l.kind === 'head' && l.text === 'DEMO')).toBe(true);
    expect(wrap('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij']);
    expect(wrap('', 10)).toEqual([]);
  });

  it('progress keeps the highest level and validates', () => {
    const p: Record<string, string> = {};
    expect(markRead(p, 'T1', 'BEGINNER')).toBe(true);
    expect(markRead(p, 'T1', 'SIMPLE')).toBe(false);
    expect(markRead(p, 'T1', 'EXPERT')).toBe(true);
    expect(p['T1']).toBe('EXPERT');
    expect(isProgress({ T1: 'EXPERT' })).toBe(true);
    expect(isProgress({ T1: 'GOD' })).toBe(false);
    expect(isProgress([])).toBe(false);
  });

  it('lore prose substitutes the characters the font lacks and lowercase glyphs exist for a-z', () => {
    expect(substitute('v ≈ 3 × 10² m/s ± 1')).toBe('v ~ 3 x 10^2 m/s +/- 1');
    for (const ch of 'abcdefghijklmnopqrstuvwxyz{}`&') expect(hasGlyph(ch, true)).toBe(true);
    expect(hasGlyph('a')).toBe(true); // maps to A without lower
  });
});

describe('LABS', () => {
  it('the built labs load lazily with fresh sliders, and their lines and nudges behave', async () => {
    expect(BUILT_LABS.length).toBe(21);
    expect(labStatus('LAB_ELLIPSE')).toBe('BUILT');
    expect(labStatus('LAB_RK4')).toBe('BUILT');
    expect(labStatus('LAB_NOT_A_LAB')).toBe('BACKLOG');
    expect(labStatus(null)).toBe('NONE');
    expect(await loadLab('LAB_NOT_A_LAB')).toBeNull();
    for (const id of BUILT_LABS) {
      const lab = await loadLab(id);
      expect(lab).not.toBeNull();
      const v = values(lab!.sliders);
      const lines = lab!.lines(v);
      expect(lines.length).toBeGreaterThan(0);
      for (const l of lines) expect(l).not.toMatch(/NaN|undefined/);
      expect(lab!.code.length).toBeGreaterThan(0);
      const sl = lab!.sliders[0]!;
      const before = sl.value;
      nudge(sl, 1);
      expect(sl.value).not.toBe(before);
      nudge(sl, -1000);
      expect(sl.value).toBe(sl.min);
      const again = await loadLab(id);
      expect(again!.sliders[0]!.value).toBe(before); // fresh copy
    }
    const beta = await loadLab('LAB_BETA');
    expect(beta!.lines(values(beta!.sliders))[0]).toMatch(/2\.98[0-9]e-3 m\/s/);
  });
});

describe('built lore (public/lore)', () => {
  it('index.json lists 57 topics with five levels, chunks exist, SIMPLE text is at most 20 words', () => {
    if (!existsSync('public/lore/index.json')) return; // built by scripts/build_lore.py; the gate runs it
    const ix = JSON.parse(readFileSync('public/lore/index.json', 'utf8')) as { topics: { id: string; levels: string[]; pictureId: string | null; demoId: string | null }[]; labs: string[] };
    expect(ix.topics.length).toBe(57);
    expect(ix.labs.length).toBe(21);
    for (const t of ix.topics) {
      expect(t.levels).toEqual(LEVELS);
      expect(t.pictureId).toMatch(/^pic-/);
      if (t.demoId) expect(ix.labs).toContain(t.demoId);
      const simple = JSON.parse(readFileSync(`public/lore/${t.id}/SIMPLE.json`, 'utf8')) as { markdown: string };
      expect(simple.markdown.split(/\s+/).length).toBeLessThanOrEqual(20);
      expect(existsSync(`public/lore/${t.id}/EXPERT.json`)).toBe(true);
    }
  });
});
