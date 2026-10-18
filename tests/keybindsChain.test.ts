import { describe, expect, it } from 'vitest';
import { bind, defaultBindings, KEY_ACTIONS, remapFor, type KeyBindings } from '../src/game/keybinds';
import { Rng } from '../src/sim/rng';

/** Every bound key reports its action, and the table is a permutation: no logical code is left without a key. */
function checkRemap(b: KeyBindings): void {
  const m = remapFor(b);
  for (const a of KEY_ACTIONS) {
    const phys = b[a.id] ?? a.def;
    expect(m.get(phys) ?? phys, a.id).toBe(a.def);
  }
  expect([...m.values()].sort()).toEqual([...m.keys()].sort());
}

describe('key remapping keeps every key (code review 2026-10-18 finding 25)', () => {
  it('chained rebinds: MANUAL to X, then PLANNER to M, leaves a key that reports X (EXPORT)', () => {
    const b = bind(bind(defaultBindings(), 'MANUAL', 'KeyX'), 'PLANNER', 'KeyM');
    const m = remapFor(b);
    expect([...m.values()]).toContain('KeyX');
    checkRemap(b);
  });

  it('any sequence of rebinds gives a permutation with every action on its key', () => {
    const r = new Rng(25);
    const codes = ['KeyA', 'KeyB', 'KeyM', 'KeyP', 'KeyX', 'KeyZ', 'F1', 'F2', 'Digit1', 'Slash', 'KeyT', 'KeyG', 'Space'];
    for (let n = 0; n < 2000; n++) {
      let b = defaultBindings();
      const steps = r.int(1, 8);
      for (let k = 0; k < steps; k++) b = bind(b, r.pick(KEY_ACTIONS).id, r.pick(codes));
      checkRemap(b);
    }
  });
});
