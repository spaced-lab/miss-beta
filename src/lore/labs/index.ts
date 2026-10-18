// WHAT: LAB registry with dynamic imports (code-split; loaded only when a lab is opened).
// WHY:  EDUCATION.md 0.4: demos never sit in the main bundle.
// HOW:  Each entry is a lazy `import()`; ids not listed here are BACKLOG (the registry in EDUCATION.md
//       Section 7 names 20; six are built in M9). `labStatus` tells the Learning Center which.
// LORE: C2 (reading the code)

import type { Lab } from './lab';

const LOADERS: Readonly<Record<string, () => Promise<{ lab: Lab }>>> = {
  LAB_ELLIPSE: () => import('./ellipse'),
  LAB_VISVIVA: () => import('./visviva'),
  LAB_KEPLER_SOLVER: () => import('./keplerSolver'),
  LAB_BETA: () => import('./beta'),
  LAB_FOCUSING: () => import('./focusing'),
  LAB_3DVT: () => import('./threeDvT'),
  LAB_MAGNITUDE: () => import('./magnitude'),
  LAB_IMPACT_ENERGY: () => import('./impactEnergy'),
  LAB_QSTAR: () => import('./qstar'),
  LAB_FRAGMENT_CLOUD: () => import('./fragmentCloud'),
  LAB_NUKE_STANDOFF: () => import('./nukeStandoff'),
  LAB_TRACTOR: () => import('./tractor'),
  LAB_ROCKET_EQ: () => import('./rocketEq'),
  LAB_TORINO: () => import('./torino'),
  LAB_LAMBERT_PORKCHOP: () => import('./lambertPorkchop'),
  LAB_FLYBY: () => import('./flyby'),
  LAB_SAIL_SPIRAL: () => import('./sailSpiral'),
  LAB_SUNWARD: () => import('./sunward'),
  LAB_GAUGE: () => import('./gauge'),
  LAB_MONTECARLO: () => import('./monteCarlo'),
  LAB_RK4: () => import('./rk4'),
};

export const BUILT_LABS: readonly string[] = Object.keys(LOADERS);

export function labStatus(id: string | null): 'BUILT' | 'BACKLOG' | 'NONE' {
  if (!id) return 'NONE';
  return id in LOADERS ? 'BUILT' : 'BACKLOG';
}

export async function loadLab(id: string): Promise<Lab | null> {
  const l = LOADERS[id];
  if (!l) return null;
  const m = await l();
  // Fresh slider objects per open so one lab's state does not leak into the next.
  return { ...m.lab, sliders: m.lab.sliders.map((sl) => ({ ...sl })) };
}
