// WHAT: Body types for the world: the star, planets, and (from M1) threats and fragments.
// WHY:  Everything that coasts is "elements + a gravitational parameter + a radius"; keeping one shape for
//       all of them means the resolver and the renderer need one code path.
// HOW:  Plain readonly records. Elements are those of physics/kepler.ts. The star has no elements.
// LORE: O7 (elements), T5 (what they are made of)

import type { Elements } from '../physics/kepler';

export type BodyKind = 'STAR' | 'PLANET' | 'THREAT' | 'FRAGMENT' | 'CRAFT';

export interface Star {
  readonly id: 'STAR';
  readonly name: string;
  readonly mu: number;
  readonly radius: number;
}

export interface Planet {
  readonly kind: 'PLANET';
  readonly id: string;
  readonly name: string;
  readonly mu: number;
  readonly radius: number;
  readonly elements: Elements;
  /** 1 to 3 inner detail lines in the vector look. */
  readonly detailLines: number;
}
