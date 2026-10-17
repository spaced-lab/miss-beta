// WHAT: The event log: what happened when, as data and as play-by-play lines.
// WHY:  GAME_PLAN 11: the resolver's output is an EventLog; the debrief scrubs it, the HUD prints lines as
//       the clock passes them, and a replay is just this log plus the seed. Lines follow the terminal
//       cadence of Section 4: `T-04Y 112D  IMPACTOR-2 FLYBY VENUS  dV +3.1 km/s`.
// HOW:  Plain discriminated union; `formatEvent` is the only place lines are composed.
// LORE: G2 (screens and HUD), G7 (under the hood)

import { formatCountdown } from '../ui/hud';

export type SimEventRecord =
  | { t: number; kind: 'LAUNCH'; missionId: string; c3: number; massKg: number; tier: number }
  | { t: number; kind: 'IMPACT'; missionId: string; U: number; beta: number; dvAlong: number; dvTotal: number; massKg: number }
  | { t: number; kind: 'IMPACT_MISS'; missionId: string; offset: number }
  | { t: number; kind: 'CLOSE_APPROACH'; dMin: number; bCrit: number; marginRadii: number; impact: boolean }
  | { t: number; kind: 'ROUND_START'; name: string; lead: number }
  | { t: number; kind: 'NOTE'; text: string };

export type EventLog = SimEventRecord[];

function kms(v: number): string {
  return `${(v / 1000).toFixed(1)} KM/S`;
}

export function formatEvent(e: SimEventRecord, tImpact: number): string {
  const stamp = formatCountdown(tImpact - e.t);
  switch (e.kind) {
    case 'ROUND_START':
      return `${stamp}  ${e.name} ACQUIRED  LEAD ${(e.lead / 3.15576e7).toFixed(1)} Y`;
    case 'LAUNCH':
      return `${stamp}  ${e.missionId} LAUNCH  L${e.tier}  C3 ${e.c3.toFixed(1)}  ${e.massKg.toFixed(0)} KG`;
    case 'IMPACT':
      return `${stamp}  ${e.missionId} IMPACT  U ${kms(e.U)}  BETA ${e.beta.toFixed(2)}  dV ${(e.dvTotal * 1000).toFixed(2)} MM/S (ALONG ${(e.dvAlong * 1000).toFixed(2)})`;
    case 'IMPACT_MISS':
      return `${stamp}  ${e.missionId} MISSED THE TARGET  OFF BY ${(e.offset / 1000).toFixed(0)} KM`;
    case 'CLOSE_APPROACH':
      return `${stamp}  CLOSE APPROACH  D ${(e.dMin / 1000).toFixed(0)} KM  B-CRIT ${(e.bCrit / 1000).toFixed(0)} KM  ${e.impact ? 'IMPACT' : `MISS BY ${e.marginRadii.toFixed(2)} R`}`;
    case 'NOTE':
      return `${stamp}  ${e.text}`;
  }
}
