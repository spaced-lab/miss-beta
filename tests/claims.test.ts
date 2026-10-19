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
  it('F12-2: a 100 m class visitor hits the Earth about once per 40 to 140 million years (Do et al. 2018 density)', () => {
    const AU = 1.495978707e11;
    const YEAR = 3.15576e7;
    const n = 0.2 / AU ** 3; // objects per cubic metre
    const R = 6.371e6;
    const vEsc = 11.19e3;
    // v_inf 26 km/s far from the Sun; about 49 km/s at 1 AU once the Sun's pull is added (sqrt(26^2 + 42.1^2)).
    const years = (v: number): number => 1 / (n * Math.PI * R * R * (1 + (vEsc / v) ** 2) * v * YEAR);
    const slow = years(26e3);
    const fast = years(49e3);
    expect(slow).toBeGreaterThan(4e7);
    expect(slow).toBeLessThan(1.5e8);
    expect(fast).toBeGreaterThan(4e7);
    expect(fast).toBeLessThan(1.5e8);
  });
  it('F12-3: v_inf = sqrt(mu / -a) gives 26, 32 and 58 km/s for 1I, 2I and 3I', () => {
    const MU = 1.32712440018e20;
    const AU = 1.495978707e11;
    const vinf = (aAu: number): number => Math.sqrt(MU / (-aAu * AU)) / 1000;
    expect(vinf(-1.27)).toBeCloseTo(26.4, 0);
    expect(vinf(-0.851)).toBeCloseTo(32.3, 0);
    expect(vinf(-0.264)).toBeCloseTo(58.0, 0);
  });
  it('PK-1: a craft inclined 10 degrees at 1 AU moves up to about 5.2 km/s out of the plane', () => {
    expect(29.78 * Math.sin((10 * Math.PI) / 180)).toBeCloseTo(5.17, 2);
  });
});
