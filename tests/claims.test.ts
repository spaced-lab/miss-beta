// Claim registry (docs/RESEARCH.md): shape, statuses, cross-references from the lore, and the worked U-1 number.
// @ts-expect-error node built-in without @types/node (same pattern as tests/help.test.ts)
import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import registry from '../src/config/claims.json';

const STATUSES = ['UNVERIFIED', 'SOURCED', 'CHECKED', 'CONTESTED', 'REFUTED', 'OPEN', 'UNFEASIBLE'];
const claims = (registry as { claims: Record<string, unknown>[] }).claims;

describe('CLAIMS registry', () => {
  it('every claim has an id, a status from the list, a check, and a source unless unverified or open', () => {
    const ids = new Set<string>();
    for (const c of claims) {
      expect(typeof c.id).toBe('string');
      expect(ids.has(c.id as string)).toBe(false);
      ids.add(c.id as string);
      expect(STATUSES).toContain(c.status);
      for (const k of ['topic', 'claim', 'value', 'check']) expect(typeof c[k] === 'string' && (c[k] as string).length > 0, `${String(c.id)} ${k}`).toBe(true);
      expect(Array.isArray(c.usedIn)).toBe(true);
      if (c.status !== 'UNVERIFIED' && c.status !== 'OPEN') expect((c.source as string).length, `${String(c.id)} source`).toBeGreaterThan(0);
    }
  });
  it('every claim id named in EDUCATION.md exists, and text that calls one UNVERIFIED matches the registry', () => {
    const edu = (readFileSync as (p: string, e: string) => string)('EDUCATION.md', 'utf8');
    const byId = new Map(claims.map((c) => [c.id as string, c]));
    const refs = [...edu.matchAll(/\(([A-Za-z ]+), claim ([A-Z0-9]+-\d+)[^)]*\)/g)];
    expect(refs.length).toBeGreaterThan(3);
    for (const m of refs) {
      const c = byId.get(m[2] as string);
      expect(c, m[2]).toBeDefined();
      if ((m[1] as string).includes('UNVERIFIED')) expect(c?.status).toBe('UNVERIFIED');
    }
  });
  it('U-1: about 7e11 DART-class hits to move Ceres by 1 cm/s', () => {
    const dp = 9.38e20 * 0.01;
    const hit = 3.6 * 580 * 6100;
    expect(dp / hit).toBeGreaterThan(7e11);
    expect(dp / hit).toBeLessThan(8e11);
  });
});
