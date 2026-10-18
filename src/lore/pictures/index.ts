// WHAT: The picture registry: SIMPLE-level diagram id -> SVG generator (EDUCATION.md Section 8).
// WHY:  `scripts/build_lore.py` checks every PICTURE id in EDUCATION.md against this map's keys, so a
//       missing diagram fails the build instead of showing a blank panel.
// HOW:  One generator per id, grouped by topic section in sibling files; each returns an SVG string in the
//       given palette. `renderPicture` is the single entry point the lore panel uses.
// LORE: G8 (the look)

import type { PicPalette } from './svg';
import { PICTURES_T } from './t';
import { PICTURES_F } from './f';
import { PICTURES_O } from './o';
import { PICTURES_D } from './d';
import { PICTURES_G } from './g';
import { PICTURES_C } from './c';

export type PictureGen = (p: PicPalette) => string;

export const PICTURES: Readonly<Record<string, PictureGen>> = { ...PICTURES_T, ...PICTURES_F, ...PICTURES_O, ...PICTURES_D, ...PICTURES_G, ...PICTURES_C };

export function renderPicture(id: string, p: PicPalette): string | null {
  const g = PICTURES[id];
  return g ? g(p) : null;
}
