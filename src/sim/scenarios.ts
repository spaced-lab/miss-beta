// WHAT: SPAWN scenarios (GAME_PLAN 22.2): named historical threats built with the collision construction.
// WHY:  Chelyabinsk, Tunguska, YR4, Apophis, Bennu, Dimorphos and Chicxulub are the cases people know; being
//       able to summon them is both a cheat and a lesson.
// HOW:  `spawnScenario` builds a Threat of the given size, type and lead on a colliding orbit (sunward ones
//       approach from inside with a small elongation; lead 0 means a NO WARNING round with NO_WARNING_LEAD).
//       Draw order from the round's Rng is fixed.
// LORE: T4 (case files), G6 (modes and cheat codes)

import scenariosJson from '../config/scenarios.json';
import { KNOBS } from '../config/knobs';
import { AU, YEAR } from '../physics/constants';
import { sphereMass } from '../physics/closeApproach';
import { OrbitError, stateToElements } from '../physics/elements';
import { apoapsis, periapsis, type Elements } from '../physics/kepler';
import type { Rng } from './rng';
import { THREAT_TYPES } from './roundGen';
import { generateAsteroidShape } from './shapes';
import type { Threat, ThreatType } from './threat';
import { planetById, planetState, type World } from './world';

export interface Scenario {
  id: string;
  name: string;
  D: number;
  type: string;
  leadYears: number;
  vInfKms: number;
  sunward: boolean;
  note: string;
}

export const SCENARIOS = (scenariosJson as { scenarios: Scenario[] }).scenarios;

export function scenarioById(id: string): Scenario | null {
  return SCENARIOS.find((s) => s.id === id.toUpperCase()) ?? null;
}

export function spawnScenario(sc: Scenario, world: World, rng: Rng, now = world.t): Threat {
  const type: ThreatType = THREAT_TYPES.find((t) => t.id === sc.type) ?? (THREAT_TYPES[1] as ThreatType);
  const noWarning = sc.leadYears <= 0;
  const tImpact = now + (noWarning ? KNOBS.NO_WARNING_LEAD : sc.leadYears * YEAR);
  const home = planetById(world, 'HOME');
  const hs = planetState(world, home, tImpact);
  const uInf = sc.vInfKms * 1000;
  const rm = Math.hypot(hs.r.x, hs.r.y);
  let elements: Elements | null = null;
  for (let attempt = 0; attempt < 200 && !elements; attempt++) {
    // Sunward: closing velocity along the outward radial (the rock comes from inside, in daylight).
    const phi = sc.sunward ? Math.atan2(hs.r.y, hs.r.x) + rng.float(-0.4, 0.4) : rng.float(0, Math.PI * 2);
    const v = { x: hs.v.x + uInf * Math.cos(phi), y: hs.v.y + uInf * Math.sin(phi) };
    try {
      const el = stateToElements(hs.r, v, world.star.mu, tImpact);
      if (periapsis(el) > 0.25 * AU && apoapsis(el) < 6 * AU && el.e < 0.98) elements = el;
    } catch (e) {
      if (!(e instanceof OrbitError)) throw e;
    }
  }
  if (!elements) throw new Error(`spawnScenario ${sc.id}: no orbit`);
  void rm;
  return {
    kind: 'THREAT',
    id: `S-${sc.id}`,
    name: sc.name,
    type,
    D: sc.D,
    mass: sphereMass(sc.D, type.density),
    elements,
    tImpact,
    vInfNominal: uInf,
    shape: generateAsteroidShape(rng),
    discoveredBy: noWarning ? null : 'SCENARIO',
    noWarning,
  };
}
