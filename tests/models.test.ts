// @ts-ignore node types are not installed; fs is available in the test runner
import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { MODELS, modelForTopic } from '../src/lore/models/catalog';
import { box, dish, extent, project, ring } from '../src/lore/models/mesh';

describe('3-D model catalog', () => {
  it('primitives have the expected segment counts', () => {
    expect(box(1, 2, 3).seg.length).toBe(12 * 6);
    expect(ring(1, 0, 24).seg.length).toBe(24 * 6);
    expect(dish(35, 9, 6, 12).length).toBe(7);
  });
  it('every model builds finite geometry at several times, and its topics exist in EDUCATION.md', () => {
    const md = (readFileSync as (p: string, e: string) => string)('EDUCATION.md', 'utf8');
    for (const m of MODELS) {
      for (const t of [0, 1.7, 6.5, 11]) {
        const parts = m.build(t);
        expect(parts.length, m.id).toBeGreaterThan(0);
        for (const p of parts) for (const v of p.seg) expect(Number.isFinite(v), m.id).toBe(true);
        expect(extent(parts)).toBeGreaterThan(0);
        const pts = project(parts[0]!, { yaw: t, pitch: 0.35, cx: 0, cy: 0, k: 1, focal: extent(parts) * 4 });
        for (const v of pts) expect(Number.isFinite(v)).toBe(true);
      }
      for (const id of m.topics) expect(md, `${m.id} topic ${id}`).toMatch(new RegExp(`^## ${id} `, 'm'));
      expect(m.facts.length).toBeGreaterThanOrEqual(2);
      expect(m.source.length).toBeGreaterThan(10);
    }
    expect(modelForTopic('D3')?.id).toBe('DART');
    expect(modelForTopic('F6')?.id).toBe('GOLDSTONE');
    expect(modelForTopic('ZZ')).toBeNull();
  });
});
