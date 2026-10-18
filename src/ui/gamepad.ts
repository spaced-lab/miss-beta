// WHAT: Gamepad support (IDEAS 7, GAME_PLAN 13 "controller"): standard-mapping buttons become key codes.
// WHY:  Every screen already speaks keyboard; translating the pad keeps screens unchanged. A button may carry
//       several codes when screens disagree (RB is warp-up in the sim and the swarm key in PERIMETER): each
//       screen only reads its own.
// HOW:  `padCodes(buttons, axes)` is pure: the set of codes held this frame (stick past 0.5 counts as the
//       arrow). Input.pollGamepads diffs it against last frame to make edges, as the keyboard does.
// LORE: G2 (screens and HUD)

/** Standard mapping (https://w3c.github.io/gamepad/#remapping): button index -> key codes. */
export const PAD_MAP: Readonly<Record<number, readonly string[]>> = {
  0: ['Space', 'Enter'], // A: fire / pause / start; Enter commits in the planner
  1: ['Escape'], // B: back
  2: ['KeyP'], // X: planner
  3: ['Slash'], // Y: lore panel
  4: ['BracketLeft', 'Comma'], // LB: warp down / seeker
  5: ['BracketRight', 'Period'], // RB: warp up / swarm
  6: ['ShiftLeft'], // LT: pulse
  7: ['KeyV'], // RT: planet view
  8: ['Tab'], // BACK / VIEW: next target, focus, skip tutorial
  9: ['KeyL'], // START / MENU: Learning Center
  12: ['ArrowUp'],
  13: ['ArrowDown'],
  14: ['ArrowLeft'],
  15: ['ArrowRight'],
};

export function padCodes(buttons: readonly { pressed: boolean }[], axes: readonly number[]): Set<string> {
  const held = new Set<string>();
  buttons.forEach((b, i) => {
    if (b.pressed) for (const c of PAD_MAP[i] ?? []) held.add(c);
  });
  const [x = 0, y = 0] = axes;
  if (x < -0.5) held.add('ArrowLeft');
  if (x > 0.5) held.add('ArrowRight');
  if (y < -0.5) held.add('ArrowUp');
  if (y > 0.5) held.add('ArrowDown');
  return held;
}
