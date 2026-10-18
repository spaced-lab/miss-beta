// @ts-ignore node types are not installed; fs is available in the test runner
import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { HELP_PAGES } from '../src/render/views/help';
import { hasGlyph } from '../src/render/vectorFont';

describe('manual', () => {
  it('in-game pages use only glyphs the stroke font has, and the markdown manual covers the same topics', () => {
    for (const page of HELP_PAGES) for (const line of page.lines) for (const ch of line) expect(hasGlyph(ch)).toBe(true);
    // @ts-ignore node types are not installed; fs is available in the test runner
    const md = (readFileSync as (p: string, e: string) => string)('docs/HOW_TO_PLAY.md', 'utf8');
    for (const topic of ['round loop', 'Reading a plan', 'Plan types', 'Autonomy', 'Programs', 'Civil defense', 'Saving', 'PERIMETER']) expect(md).toContain(topic);
    expect(md).toContain('`]`');
  });
});

describe('attribution (NOTICE, AGPL section 7(b))', () => {
  it('the credits page keeps "Created by SPACED" and the full name, and NOTICE and LICENSE are AGPL', () => {
    const credits = HELP_PAGES.find((p) => p.title.startsWith('CREDITS'));
    const text = [credits?.title ?? '', ...(credits?.lines ?? [])].join(' ');
    expect(text).toContain('CREATED BY SPACED');
    expect(text).toContain('RIDLEY DISIENA AKA SPACED');
    expect(text).toContain('PATREON.COM/CW/SPACEDLAB');
    // @ts-ignore node types are not installed; fs is available in the test runner
    const read = readFileSync as (p: string, e: string) => string;
    expect(read('LICENSE', 'utf8')).toContain('GNU AFFERO GENERAL PUBLIC LICENSE');
    expect(read('NOTICE', 'utf8')).toContain('Created by SPACED');
  });
});
