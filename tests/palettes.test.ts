// M10 PALETTES: contrast rule (24.1), role styles, the camera projection, the materialize frame walk.
import { describe, expect, it } from 'vitest';
import { CAMERA_PITCHES, polyhedron, tilt } from '../src/render/camera3d';
import { contrast, PALETTES, ROLE_STYLE, SPECTRUM, roleColor, holoHue, type ColorMode, type Role } from '../src/render/palettes';
import { Materialize } from '../src/render/wire';

describe('PALETTES (GAME_PLAN 24.1)', () => {
  it('every mode has text contrast of at least 4.5:1 for ink and hot on bg', () => {
    for (const name of Object.keys(PALETTES) as ColorMode[]) {
      const p = PALETTES[name];
      expect(p.name).toBe(name);
      expect(contrast(p.ink, p.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.hot, p.bg)).toBeGreaterThanOrEqual(4.5);
      if (p.alt) expect(contrast(p.alt, p.bg)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast('#33FF33', '#000000')).toBeCloseTo(15.3, 0);
  });

  it('SPECTRUM text and role colours read on every dark mode; roles pair with distinct line styles', () => {
    for (const name of Object.keys(PALETTES) as ColorMode[]) {
      const p = PALETTES[name];
      if (!p.glow) continue; // DAYLIGHT keeps ink (roleColor returns ink there)
      expect(contrast(SPECTRUM.text, p.bg)).toBeGreaterThanOrEqual(4.5);
      for (const role of Object.keys(SPECTRUM) as Role[]) expect(contrast(SPECTRUM[role], p.bg)).toBeGreaterThanOrEqual(3);
    }
    expect(roleColor(PALETTES.DAYLIGHT, 'threat', true)).toBe(PALETTES.DAYLIGHT.ink);
    expect(roleColor(PALETTES.PHOSPHOR, 'threat', true)).toBe('#FFB000');
    expect(roleColor(PALETTES.PHOSPHOR, 'threat', false)).toBe(PALETTES.PHOSPHOR.ink);
    const keys = new Set(['threat', 'fragment', 'sail', 'nuclear', 'craft'].map((r) => `${ROLE_STYLE[r as Role].dash.join(',')}|${ROLE_STYLE[r as Role].marker}`));
    expect(keys.size).toBe(5);
    expect(holoHue(0, 0)).toBe('hsl(160 100% 70%)');
    expect(holoHue(1, 0)).toBe('hsl(300 100% 70%)');
  });
});

describe('camera3d (24.3)', () => {
  it('pitch 0 is the identity; a tilt foreshortens y and keeps x at z = 0; perspective scales with depth', () => {
    expect(tilt({ pitch: 0, focal: 900 }, 10, -20)).toEqual([10, -20]);
    const [x, y] = tilt({ pitch: Math.PI / 3, focal: 900 }, 100, 100);
    expect(Math.abs(y)).toBeLessThan(100);
    expect(x).toBeLessThan(100); // the point is behind the plane (positive z) so it shrinks
    const [x2] = tilt({ pitch: Math.PI / 3, focal: 900 }, 100, -100);
    expect(x2).toBeGreaterThan(100); // a point in front grows
    expect(CAMERA_PITCHES[0]).toBe(0);
    const segs = polyhedron({ pitch: Math.PI / 6, focal: 900 }, 0, 0, 10, 1.3, [1, 0.8, 1.2, 0.9, 1.1, 1]);
    expect(segs.length).toBe(12);
    for (const sg of segs) for (const v of sg) expect(Math.abs(v)).toBeLessThan(40);
  });
});

describe('materialize', () => {
  it('starts at 0, finishes after its duration, and is done at once under reduce-motion semantics', () => {
    const m = new Materialize();
    expect(m.done).toBe(true);
    m.start();
    expect(m.done).toBe(false);
    m.tick(Materialize.DURATION / 2);
    expect(m.done).toBe(false);
    m.tick(Materialize.DURATION);
    expect(m.done).toBe(true);
  });
});
