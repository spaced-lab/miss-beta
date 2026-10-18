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

describe('Learning Center columns', () => {
  it('cutWords cuts at a word boundary and never exceeds the column', async () => {
    const { cutWords } = await import('../src/render/views/center');
    expect(cutWords('SHORT', 20)).toBe('SHORT');
    const t = ' E T6   COMETS AND VISITORS FROM OTHER STARS';
    for (const cols of [12, 20, 31, 40]) {
      const out = cutWords(t, cols);
      expect(out.length).toBeLessThanOrEqual(cols);
      if (out !== t) expect(out.endsWith('..')).toBe(true);
    }
    expect(cutWords(t, 31)).toBe(' E T6   COMETS AND VISITORS..');
  });
});

describe('lore links and tips', () => {
  it('every linked topic exists, and tips match the situation first', async () => {
    // @ts-ignore node types are not installed
    const { readFileSync } = await import('fs');
    const md = (readFileSync as (p: string, e: string) => string)('EDUCATION.md', 'utf8');
    const { TRACK_TOPIC, PROGRAM_TOPIC, OPTION_TOPIC } = await import('../src/game/loreLinks');
    for (const id of [...Object.values(TRACK_TOPIC), ...Object.values(PROGRAM_TOPIC), ...Object.values(OPTION_TOPIC)]) expect(md).toMatch(new RegExp(`^## ${id} `, 'm'));
    const { pickTip, TIPS } = await import('../src/game/tips');
    expect(TIPS.length).toBeGreaterThan(5);
    const t = pickTip({ missions: 0, inFlight: false, budget: 5, leadLeftYears: 5, predictedMiss: false }, 0);
    expect(t?.when).toBe('NO_MISSIONS');
    const r = pickTip({ missions: 2, inFlight: false, budget: 50, leadLeftYears: 5, predictedMiss: false }, 0);
    expect(r?.when).toBe('RICH');
  });
});
