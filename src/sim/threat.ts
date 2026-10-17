// WHAT: The threat object: an asteroid or comet on a collision course with HOME.
// WHY:  One record carries everything the brief, the planner and the resolver need: orbit, size, type,
//       mass, nominal impact epoch and the seeded outline it is drawn with.
// HOW:  Built by roundGen.ts; elements are replaced by the resolver after every impulse (M2+).
// LORE: T1 (what is a NEO), T5 (what they are made of)

import type { Elements } from '../physics/kepler';

export type ThreatTypeId = 'RUBBLE' | 'STONY' | 'IRON' | 'ICY';

export interface ThreatType {
  id: ThreatTypeId;
  label: string;
  density: number;
  strengthMult: number;
  vInfMin: number;
  vInfMax: number;
  albedo: number;
  fromRound: number;
  weight: number;
  kind: 'asteroid' | 'comet';
}

export interface Threat {
  readonly kind: 'THREAT';
  readonly id: string;
  readonly name: string;
  readonly type: ThreatType;
  /** Diameter, m. */
  readonly D: number;
  /** Mass, kg. */
  readonly mass: number;
  elements: Elements;
  /** Nominal impact epoch, s (round time). */
  readonly tImpact: number;
  /** Closing speed drawn at generation, m/s. */
  readonly vInfNominal: number;
  /** Seeded outline, vertex radius multipliers. */
  readonly shape: Float64Array;
}
