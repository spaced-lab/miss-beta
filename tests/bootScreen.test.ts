// WHAT: The boot route: URL hash deep links, gated by the photosensitivity notice.
// WHY:  A new player (fresh site data) must see the notice before any flashing screen; the deep link and the
//       first-launch tutorial once skipped it (found in the pre-publish browser check, 2026-10-18).
// HOW:  bootScreen is pure; the title-side gate (tutorial after the acknowledgement) is checked in the browser.
// LORE: C3 (tests)

import { describe, expect, it } from 'vitest';
import { bootScreen } from '../src/game/screen';

describe('bootScreen', () => {
  it('lands on the title until the notice is acknowledged, whatever the hash', () => {
    for (const h of ['', 'minigame', 'system', 'options', 'center']) expect(bootScreen(h, false)).toBe('title');
  });
  it('follows known deep links after the acknowledgement and ignores anything else', () => {
    expect(bootScreen('minigame', true)).toBe('minigame');
    expect(bootScreen('codex', true)).toBe('codex');
    expect(bootScreen('demo', true)).toBe('title');
    expect(bootScreen('__proto__', true)).toBe('title');
    expect(bootScreen('', true)).toBe('title');
  });
});
