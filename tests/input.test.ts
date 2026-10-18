import { describe, expect, it } from 'vitest';
import { Input } from '../src/ui/input';

/** A window stand-in: Input only adds listeners; the test fires them by hand. */
function fakeWindow(): { target: Window; fire: (type: string, e: Record<string, unknown>) => void } {
  const ls = new Map<string, ((e: unknown) => void)[]>();
  const target = { addEventListener: (type: string, fn: (e: unknown) => void) => void ls.set(type, [...(ls.get(type) ?? []), fn]) } as unknown as Window;
  const fire = (type: string, e: Record<string, unknown>): void => {
    for (const fn of ls.get(type) ?? []) fn({ preventDefault: () => undefined, key: '', ...e });
  };
  return { target, fire };
}

describe('Input key release (code review 2026-10-18 finding 26)', () => {
  it('releases the code the key went down as, even if text mode or the remap changed while it was held', () => {
    const { target, fire } = fakeWindow();
    const k = new Input(target);
    k.remap = new Map([['KeyX', 'KeyM'], ['KeyM', 'KeyX']]);
    fire('keydown', { code: 'KeyX', key: 'x' });
    expect(k.held('KeyM')).toBe(true);
    k.textMode = true; // the console opened while the key is held
    fire('keyup', { code: 'KeyX', key: 'x' });
    expect(k.held('KeyM')).toBe(false);
    expect(k.held('KeyX')).toBe(false);
  });

  it('key repeat while held does not add a second code', () => {
    const { target, fire } = fakeWindow();
    const k = new Input(target);
    k.remap = new Map([['KeyX', 'KeyM'], ['KeyM', 'KeyX']]);
    fire('keydown', { code: 'KeyX', key: 'x' });
    k.textMode = true;
    fire('keydown', { code: 'KeyX', key: 'x', repeat: true });
    fire('keyup', { code: 'KeyX', key: 'x' });
    expect(k.held('KeyM')).toBe(false);
    expect(k.held('KeyX')).toBe(false);
  });
});
