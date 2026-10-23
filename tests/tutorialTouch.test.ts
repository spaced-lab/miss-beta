import { describe, expect, it } from 'vitest';
import { DART_STEPS, TUTORIAL_STEPS, touchText } from '../src/game/tutorial';

const all = [...TUTORIAL_STEPS, ...DART_STEPS].map((s) => s.lines.join(' '));

describe('tutorial text on a touch screen', () => {
  it('names no keyboard key a phone does not have', () => {
    for (const text of all) {
      const t = touchText(text);
      expect(t).not.toMatch(/PRESS (SPACE|P|V|G)\b/);
      expect(t).not.toMatch(/\bSPACE (STARTS|CONTINUES|PAUSES)\b/);
      expect(t).not.toMatch(/WHEEL|ESC CLOSES|\(\] \)/);
    }
  });

  it('leaves the desktop text alone and rewrites only listed phrases', () => {
    expect(touchText('PRESS P. THE PLANNER')).toBe('TAP PLANNER. THE PLANNER');
    expect(touchText('NOTHING HERE')).toBe('NOTHING HERE');
  });
});
