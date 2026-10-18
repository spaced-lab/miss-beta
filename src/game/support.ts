// WHAT: The coffee-fund link (owner 2026-10-18): MISS beta is self-funded and runs on coffee; donations welcome.
// WHY:  Support is voluntary and never a condition of play (AGPL). The game names no platform; the link does.
// HOW:  Opened in a new tab with noopener and noreferrer, only on an explicit key or click on the CREDITS page.
// LORE: C1 (how the game is built)

export const SUPPORT_URL = 'https://www.patreon.com/cw/spacedlab';

/** Open the coffee fund in a new tab (no reference back to this page). */
export function openSupport(): void {
  window.open(SUPPORT_URL, '_blank', 'noopener,noreferrer');
}
