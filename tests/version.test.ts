// The title-screen version matches package.json and follows YY.Q.N (docs/RELEASING.md).
// @ts-ignore node types are not installed; fs is available in the test runner
import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { VERSION } from '../src/game/version';

describe('version', () => {
  it('matches package.json and the YY.Q.N calendar scheme', () => {
    const pkg = JSON.parse((readFileSync as (p: string, e: string) => string)('package.json', 'utf8')) as { version: string };
    expect(pkg.version).toBe(VERSION);
    const m = /^(\d{2})\.([1-4])\.(\d+)$/.exec(VERSION);
    expect(m).not.toBeNull();
  });
});
