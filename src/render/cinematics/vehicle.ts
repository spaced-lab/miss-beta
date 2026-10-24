// WHAT: Launch vehicles as 3-D wireframes: a core stage lathe (nose cone, fairing, body, interstage bands, engine
//       bell), fins or strap-on boosters by launcher tier, and the spent stage that falls away.
// WHY:  Owner 2026-10-24: "redo launch animations ... same style but more 3D and detailed ... no more static 2D".
//       The pixel sprite could only tilt; a lathe mesh rolls about its own axis, pitches along the arc and shows its
//       lit side, and its stages tumble as solids when they drop.
// HOW:  Pure builders over solid.ts: `lathe` revolves a (radius, y) profile (nose at y = -1, bell at y = +1), `flat`
//       makes two-sided fins, `merge` joins the parts. `vehicle(tier)` is built once per tier. Nozzle exits are
//       given in the same local frame so the plume starts where the bell ends after the vehicle's rotation.
// LORE: M3 (launchers and C3), G8 (the look)

import { flat, lathe, merge, rotate3, type Poly3 } from './solid';

export interface VehicleModel {
  poly: Poly3;
  /** Nozzle exits in the local frame (x across, y along, z depth), the core first; the unit is the half-length. */
  nozzles: readonly (readonly [number, number, number])[];
  /** Local y of the interstage bands (where stages separate), top down. */
  bands: readonly number[];
}

/** Core stage profile: radius by y from nose (-1) to bell (+1); the core is slimmer for tier 1. */
function coreProfile(tier: number): (readonly [number, number])[] {
  const r = tier === 1 ? 0.085 : tier === 2 ? 0.1 : 0.12;
  return [
    [0, -1],
    [r * 0.45, -0.86],
    [r, -0.72],
    [r, 0.78],
    [r * 0.7, 0.84],
    [r * 0.55, 0.88],
    [r * 0.95, 1],
  ];
}

/** Interstage band y positions by tier (none, one, two). */
export function bandsFor(tier: number): readonly number[] {
  return tier <= 1 ? [] : tier === 2 ? [0.1] : [-0.2, 0.3];
}

/** Strap-on booster: a short lathe beside the core. */
function booster(x: number): Poly3 {
  const r = 0.055;
  const p = lathe([[0, -0.35], [r * 0.5, -0.25], [r, -0.12], [r, 0.8], [r * 0.6, 0.86], [r * 0.9, 0.95]], 8);
  const v = new Float64Array(p.v);
  for (let i = 0; i < v.length; i += 3) v[i] = (v[i] ?? 0) + x;
  return { v, f: p.f };
}

/** Four fins at the base of a small or medium launcher. */
function fins(r: number): Poly3[] {
  const out: Poly3[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    out.push(flat([[dx * r, 0.5, dz * r], [dx * r, 0.86, dz * r], [dx * (r + 0.09), 0.9, dz * (r + 0.09)], [dx * (r + 0.07), 0.72, dz * (r + 0.07)]]));
  }
  return out;
}

const cache = new Map<number, VehicleModel>();

/** The vehicle of a launcher tier (1 small with fins, 2 medium with fins and a band, 3 heavy with two boosters). */
export function vehicle(tier: number): VehicleModel {
  const t = Math.max(1, Math.min(3, Math.round(tier)));
  const hit = cache.get(t);
  if (hit) return hit;
  const prof = coreProfile(t);
  const r = prof[2]?.[0] ?? 0.1;
  const parts: Poly3[] = [lathe(prof, t === 1 ? 8 : 10)];
  const nozzles: (readonly [number, number, number])[] = [[0, 1, 0]];
  if (t < 3) parts.push(...fins(r));
  else {
    const off = r + 0.075;
    parts.push(booster(-off), booster(off));
    nozzles.push([-off, 0.95, 0], [off, 0.95, 0]);
  }
  // Interstage bands as thin rings a hair outside the skin.
  for (const y of bandsFor(t)) parts.push(lathe([[r * 1.04, y - 0.015], [r * 1.04, y + 0.015]], t === 1 ? 8 : 10));
  const m: VehicleModel = { poly: merge(parts), nozzles, bands: bandsFor(t) };
  cache.set(t, m);
  return m;
}

/** A spent stage: the tube between two bands (or the base), with its own bell. */
export function spentStage(tier: number, top: number, bottom: number): Poly3 {
  const r = tier === 1 ? 0.085 : tier === 2 ? 0.1 : 0.12;
  return lathe([[r * 0.9, top], [r, top + 0.03], [r, bottom - 0.12], [r * 0.6, bottom - 0.06], [r * 0.95, bottom]], 8);
}

/** A local point of the vehicle in screen offsets for a given size, roll (about its axis) and heading. */
export function localToScreen(x: number, y: number, z: number, size: number, roll: number, heading: number): [number, number] {
  const [px, py] = rotate3(x * size, y * size, z * size, 0, roll, heading);
  return [px, py];
}
