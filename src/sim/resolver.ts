// WHAT: The resolver: from the world and the committed missions, the deterministic outcome of the round.
// WHY:  GAME_PLAN 11. v0 (M1): no missions exist yet, so the outcome is the unperturbed close approach.
//       The shape is kept pure, (world) -> result, so M2 can add launches, impacts and the event log
//       without changing callers.
// HOW:  Runs closeApproach for the threat against HOME around the nominal impact epoch and classifies.
// LORE: O12 (close approach), G7 (under the hood)

import { closeApproach, impactCategory, impactEnergy, type CloseApproach, type ImpactCategory, type ImpactEnergy } from '../physics/closeApproach';
import { planetById, type World } from './world';

export type Outcome = 'HIT' | 'MISS';

export interface RoundResult {
  outcome: Outcome;
  ca: CloseApproach;
  energy: ImpactEnergy;
  category: ImpactCategory;
}

export function resolveRound(world: World): RoundResult {
  const threat = world.threat;
  if (!threat) throw new Error('resolveRound: no threat');
  const home = planetById(world, 'HOME');
  const ca = closeApproach(threat.elements, home.elements, world.star.mu, home.mu, home.radius, threat.tImpact);
  const energy = impactEnergy(threat.D, threat.type.density, ca.vImpact);
  return { outcome: ca.impact ? 'HIT' : 'MISS', ca, energy, category: impactCategory(threat.D, threat.type.id === 'IRON') };
}
