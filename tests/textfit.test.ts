import { describe, expect, it } from 'vitest';
import type { Surface } from '../src/render/canvas';
import { drawTextFit, measureText, setTextScale, wrapText, charsPerLine } from '../src/render/vectorFont';

const sink = { stroke() {} } as unknown as Surface;

describe('text that fits its box', () => {
  it('drawTextFit keeps the size when it fits and shrinks to the box when it does not', () => {
    setTextScale(1);
    const t = '<SPACE> NEW RUN   LEFT/RIGHT SCRUB   <H> HIDE PANEL   <V> PLANET   <ESC> TITLE';
    const full = measureText(t, 13);
    expect(drawTextFit(sink, t, 0, 0, 13, full + 10)).toBeCloseTo(full, 6);
    expect(drawTextFit(sink, t, 0, 0, 13, 300)).toBeLessThanOrEqual(300 + 1e-6);
    setTextScale(1.5);
    expect(drawTextFit(sink, t, 0, 0, 13, 300)).toBeLessThanOrEqual(300 + 1e-6);
    setTextScale(1);
  });
  it('wrapText never exceeds the column count and keeps every word', () => {
    for (const scale of [1, 1.25, 1.5]) {
      setTextScale(scale);
      const text = 'SCORE AND RESEARCH ARE BANKED. THE LINES BELOW ARE THE EVENT LOG; LEFT / RIGHT SCRUB THE REPLAY. PRESS G AND FUND A PROGRAM.';
      const lines = wrapText(text, 676, 9);
      const cols = charsPerLine(676, 9);
      for (const l of lines) expect(l.length).toBeLessThanOrEqual(cols);
      expect(lines.join(' ')).toBe(text);
    }
    setTextScale(1);
  });
});
