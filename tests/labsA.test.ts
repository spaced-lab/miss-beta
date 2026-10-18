import { describe, expect, it } from 'vitest';
import type { Surface } from '../src/render/canvas';
import { PALETTES } from '../src/render/palettes';
import { labStatus, loadLab } from '../src/lore/labs/index';
import { values, type Lab, type Slider } from '../src/lore/labs/lab';

const IDS = ['LAB_IMPACT_ENERGY', 'LAB_QSTAR', 'LAB_FRAGMENT_CLOUD', 'LAB_NUKE_STANDOFF', 'LAB_TRACTOR', 'LAB_ROCKET_EQ', 'LAB_TORINO'];

/** A Surface whose drawing calls only record that coordinates are finite. */
function stub(): { s: Surface; bad: number; calls: number } {
  const rec = { bad: 0, calls: 0 };
  const check = (...xs: number[]): void => {
    rec.calls++;
    for (const x of xs) if (!Number.isFinite(x)) rec.bad++;
  };
  const s = {
    canvas: {} as HTMLCanvasElement,
    ctx: {} as CanvasRenderingContext2D,
    width: 1280,
    height: 800,
    dpr: 1,
    palette: PALETTES.PHOSPHOR,
    glowMode: 'none',
    spectrum: false,
    holoDrift: 0,
    role: () => PALETTES.PHOSPHOR.ink,
    resize: () => {},
    clear: () => {},
    stroke: (pts: ArrayLike<number>) => check(...Array.from(pts)),
    circle: (x: number, y: number, r: number) => check(x, y, r),
    dot: (x: number, y: number) => check(x, y),
  } as unknown as Surface;
  return {
    s,
    get bad() {
      return rec.bad;
    },
    get calls() {
      return rec.calls;
    },
  };
}

function at(sliders: readonly Slider[], which: 'min' | 'max' | 'value'): Record<string, number> {
  return values(sliders.map((sl) => ({ ...sl, value: sl[which] })));
}

describe('labs batch A (impact energy, Q*, fragment cloud, nuclear standoff, slow push, rocket, Torino)', () => {
  it('every lab is registered and loads', async () => {
    for (const id of IDS) {
      expect(labStatus(id), id).toBe('BUILT');
      const lab = await loadLab(id);
      expect(lab, id).not.toBeNull();
      expect(lab!.id).toBe(id);
      expect(lab!.code.length).toBeGreaterThan(0);
    }
  });

  it('lines() are 2 to 4 finite lines at the slider minimum, default and maximum', async () => {
    for (const id of IDS) {
      const lab = (await loadLab(id)) as Lab;
      for (const which of ['min', 'value', 'max'] as const) {
        const lines = lab.lines(at(lab.sliders, which));
        expect(lines.length, `${id} ${which}`).toBeGreaterThanOrEqual(2);
        expect(lines.length, `${id} ${which}`).toBeLessThanOrEqual(4);
        for (const l of lines) {
          expect(l, `${id} ${which}`).not.toMatch(/NaN|undefined|Infinity/);
          expect(l.length, `${id} ${which}: ${l}`).toBeLessThanOrEqual(110);
        }
      }
    }
  });

  it('draw() runs at t = 0 and t = 5 with finite coordinates in narrow and wide boxes', async () => {
    for (const id of IDS) {
      const lab = (await loadLab(id)) as Lab;
      for (const which of ['min', 'value', 'max'] as const) {
        for (const box of [{ x: 800, y: 300, w: 360, h: 140 }, { x: 800, y: 300, w: 460, h: 260 }]) {
          for (const t of [0, 5]) {
            const st = stub();
            expect(() => lab.draw(st.s, at(lab.sliders, which), box, t), `${id} ${which} t=${t}`).not.toThrow();
            expect(st.calls, id).toBeGreaterThan(5);
            expect(st.bad, `${id} ${which} t=${t}`).toBe(0);
          }
        }
      }
    }
  });

  it('the numbers teach the right lessons', async () => {
    const torino = (await loadLab('LAB_TORINO')) as Lab;
    expect(torino.lines(values(torino.sliders))[0]).toMatch(/= 3 YELLOW/); // 2024 YR4 defaults
    const nuke = (await loadLab('LAB_NUKE_STANDOFF')) as Lab;
    expect(nuke.lines(values(nuke.sliders))[3]).toMatch(/INTACT/); // 1 Mt standoff does not shatter a 1 km body
    const rocket = (await loadLab('LAB_ROCKET_EQ')) as Lab;
    expect(rocket.lines(values(rocket.sliders))[0]).toMatch(/= 6\.\d+ km\/s/); // 330 s, f 0.88: ln(8.33) x 3.24
  });
});
