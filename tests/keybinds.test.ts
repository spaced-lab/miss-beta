import { describe, expect, it } from 'vitest';
import { bind, codeLabel, defaultBindings, isKeyBindings, remapFor } from '../src/game/keybinds';
import { uiColors, PALETTES } from '../src/render/palettes';

describe('keybinds', () => {
  it('defaults need no remap and MANUAL is M, not F1', () => {
    const d = defaultBindings();
    expect(d['MANUAL']).toBe('KeyM');
    expect(remapFor(d).size).toBe(0);
  });
  it('binding MANUAL to F1 swaps the two keys', () => {
    const b = bind(defaultBindings(), 'MANUAL', 'F1');
    const m = remapFor(b);
    expect(m.get('F1')).toBe('KeyM');
    expect(m.get('KeyM')).toBe('F1');
  });
  it('binding onto a key in use swaps the actions, never sharing a key', () => {
    const b = bind(defaultBindings(), 'MANUAL', 'KeyP');
    expect(b['MANUAL']).toBe('KeyP');
    expect(b['PLANNER']).toBe('KeyM');
    const vals = Object.values(b);
    expect(new Set(vals).size).toBe(vals.length);
    const m = remapFor(b);
    expect(m.get('KeyP')).toBe('KeyM');
    expect(m.get('KeyM')).toBe('KeyP');
  });
  it('the guard rejects unknown actions and unsafe codes', () => {
    expect(isKeyBindings({ MANUAL: 'F1' })).toBe(true);
    expect(isKeyBindings({ MANUAL: 'Escape' })).toBe(false);
    expect(isKeyBindings({ NOPE: 'KeyA' })).toBe(false);
    expect(isKeyBindings('x')).toBe(false);
  });
  it('labels read like the keycaps', () => {
    expect(codeLabel('KeyM')).toBe('M');
    expect(codeLabel('Slash')).toBe('?');
    expect(codeLabel('F1')).toBe('F1');
  });
});

describe('neon screen text', () => {
  it('NEON gives cyan text and a pink title; MONO falls back to the mode ink', () => {
    const p = PALETTES.PHOSPHOR;
    expect(uiColors(p, true).title).not.toBe(p.hot);
    expect(uiColors(p, false).text).toBe(p.ink);
    expect(uiColors(PALETTES.DAYLIGHT, true).text).toBe(PALETTES.DAYLIGHT.ink);
  });
});
