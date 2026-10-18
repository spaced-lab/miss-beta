// WHAT: Tests for the SIMPLE-level picture generators (src/lore/pictures).
// WHY:  Every PICTURE id in EDUCATION.md must render, as line art only, deterministically and small.
// HOW:  Parse the `PICTURE:` lines, render each id with a palette, inspect the SVG text.
// LORE: G8

// @ts-ignore node types are not installed; fs is available in the test runner (same pattern as help.test.ts)
import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { PICTURES, renderPicture } from '../src/lore/pictures/index';
import type { PicPalette } from '../src/lore/pictures/svg';

const PAL: PicPalette = { bg: '#000000', ink: '#33ff66', dim: '#1b7a33', hot: '#ffffff' };
const PAL2: PicPalette = { bg: '#f4f0e6', ink: '#222222', dim: '#999999', hot: '#cc3300' };

function educationIds(): string[] {
  // NOTE: vitest runs from the repo root (as help.test.ts assumes too); cast because tsconfig has no node types.
  const md = (readFileSync as (p: string, e: string) => string)('EDUCATION.md', 'utf8');
  const ids: string[] = [];
  for (const line of md.split('\n')) {
    const m = /^PICTURE:\s+(pic-[a-z0-9-]+)\b/.exec(line);
    if (m && m[1]) ids.push(m[1]);
  }
  return ids;
}

/** Strip the parts that are allowed to carry a fill: the background rect, label text and glowDot circles. */
function withoutAllowedFills(svg: string): string {
  return svg
    .replace(/^<svg [^>]*><rect width="480" height="320" fill="[^"]*"\/>/, '')
    .replace(/<text [^>]*>[^<]*<\/text>/g, '')
    .replace(/<circle [^>]*stroke="none"\/>/g, '')
    .replace(/<g fill="none"/g, '<g');
}

describe('SIMPLE pictures (EDUCATION.md Section 8)', () => {
  const ids = educationIds();

  it('has one generator per PICTURE id in EDUCATION.md and no extras', () => {
    expect(ids.length).toBe(56);
    expect(new Set(ids).size).toBe(ids.length);
    const keys = Object.keys(PICTURES).sort();
    expect(keys).toEqual([...ids].sort());
    expect(renderPicture('pic-does-not-exist', PAL)).toBeNull();
  });

  it('renders every picture as stroked SVG under 12 KB with no fills beyond background, glow dots and labels', () => {
    for (const id of ids) {
      const svg = renderPicture(id, PAL);
      expect(svg, id).not.toBeNull();
      if (svg === null) continue;
      expect(svg.startsWith('<svg'), id).toBe(true);
      expect(svg.endsWith('</svg>'), id).toBe(true);
      expect(svg.length, `${id} is ${svg.length} bytes`).toBeLessThan(12 * 1024);
      expect(withoutAllowedFills(svg), `${id} has a fill`).not.toContain('fill="');
      expect(svg, `${id} has NaN coordinates`).not.toContain('NaN');
      // The palette is used: the background colour appears once and the ink colour is the default stroke.
      expect(svg.split(PAL.bg).length - 1, `${id} background`).toBe(1);
      expect(svg, id).toContain(`stroke="${PAL.ink}"`);
    }
  });

  it('is deterministic and palette-driven', () => {
    for (const id of ids) {
      const a = renderPicture(id, PAL), b = renderPicture(id, PAL), c = renderPicture(id, PAL2);
      expect(a, id).toBe(b);
      expect(c, id).not.toBe(a);
      expect(c, id).toContain(PAL2.bg);
    }
  });
});
