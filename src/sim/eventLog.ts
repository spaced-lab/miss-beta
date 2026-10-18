// WHAT: The event log: what happened when, as data and as play-by-play lines.
// WHY:  GAME_PLAN 11: the resolver's output is an EventLog; the debrief scrubs it, the HUD prints lines as
//       the clock passes them, and a replay is just this log plus the seed. Lines follow the terminal
//       cadence of Section 4: `T-04Y 112D  IMPACTOR-2 FLYBY VENUS  dV +3.1 km/s`.
// HOW:  Plain discriminated union; `formatEvent` is the only place lines are composed.
// LORE: G2 (screens and HUD), G7 (under the hood)

import { formatCountdown } from '../ui/hud';
import { YEAR } from '../physics/constants';

export type SimEventRecord =
  | { t: number; kind: 'LAUNCH'; missionId: string; c3: number; massKg: number; tier: number }
  | { t: number; kind: 'IMPACT'; missionId: string; U: number; beta: number; dvAlong: number; dvTotal: number; massKg: number; targetId?: string; qRatio?: number; betaKnownAt?: number }
  | { t: number; kind: 'IMPACT_MISS'; missionId: string; offset: number; reason?: string }
  | { t: number; kind: 'RETARGET'; missionId: string; targetId: string; dv: number; remaining: number }
  | { t: number; kind: 'SPLIT'; missionId: string; count: number; targets: string[] }
  | { t: number; kind: 'BETA_ASSESSED'; missionId: string; beta: number; marginRadii: number }
  | { t: number; kind: 'PI'; missionId: string; targetId: string; D: number; damageMt: number; ok: boolean; reason: string }
  | { t: number; kind: 'PUSH'; missionId: string; targetId: string; method: string; force: number; dv: number; duration: number; viable: boolean; note: string }
  | { t: number; kind: 'NUKE'; missionId: string; targetId: string; mode: string; yieldMt: number; dv: number; qRatio: number; fuzed: boolean; pulses: number }
  | { t: number; kind: 'FRAGMENTATION'; missionId: string; targetId: string; qRatio: number; count: number; largestD: number; vEj: number; escaped: number }
  | { t: number; kind: 'CLOSE_APPROACH'; dMin: number; bCrit: number; marginRadii: number; impact: boolean; bodyId?: string }
  | { t: number; kind: 'ROUND_START'; name: string; lead: number }
  | { t: number; kind: 'NOTE'; text: string };

export type EventLog = SimEventRecord[];

function kms(v: number): string {
  return `${(v / 1000).toFixed(1)} KM/S`;
}

/** `now` hides numbers the player cannot know yet (beta before its assessment); omit it for the debrief. */
export function formatEvent(e: SimEventRecord, tImpact: number, now?: number): string {
  const stamp = formatCountdown(tImpact - e.t);
  switch (e.kind) {
    case 'ROUND_START':
      return `${stamp}  ${e.name} ACQUIRED  LEAD ${(e.lead / YEAR).toFixed(1)} Y`;
    case 'LAUNCH':
      return `${stamp}  ${e.missionId} LAUNCH  L${e.tier}  C3 ${e.c3.toFixed(1)}  ${e.massKg.toFixed(0)} KG`;
    case 'IMPACT': {
      const known = e.betaKnownAt;
      if (now !== undefined && known !== undefined && now < known) return `${stamp}  ${e.missionId} IMPACT ${e.targetId ?? 'THREAT'}  U ${kms(e.U)}  BETA ?  (ASSESSMENT ${formatCountdown(tImpact - known)})`;
      return `${stamp}  ${e.missionId} IMPACT ${e.targetId ?? 'THREAT'}  U ${kms(e.U)}  BETA ${e.beta.toFixed(2)}  dV ${(e.dvTotal * 1000).toFixed(2)} MM/S (ALONG ${(e.dvAlong * 1000).toFixed(2)})${e.qRatio !== undefined ? `  Q/Q* ${e.qRatio.toFixed(2)}` : ''}`;
    }
    case 'IMPACT_MISS':
      return `${stamp}  ${e.missionId} MISSED THE TARGET${e.reason ? `  (${e.reason})` : `  OFF BY ${(e.offset / 1000).toFixed(0)} KM`}`;
    case 'RETARGET':
      return `${stamp}  ${e.missionId} RETARGET -> ${e.targetId}  DSM ${(e.dv).toFixed(0)} M/S  (${e.remaining.toFixed(0)} M/S LEFT)`;
    case 'SPLIT':
      return `${stamp}  ${e.missionId} DEPLOYS ${e.count} SUB-IMPACTORS -> ${[...new Set(e.targets)].join(' ')}`;
    case 'BETA_ASSESSED':
      return `${stamp}  ${e.missionId} BETA ASSESSED ${e.beta.toFixed(2)}  PREDICTED MARGIN ${e.marginRadii >= 0 ? '+' : ''}${e.marginRadii.toFixed(2)} R`;
    case 'PI':
      return `${stamp}  ${e.missionId} PI ARRAY ON ${e.targetId} (${e.D.toFixed(0)} M)  ${e.ok ? `SHREDDED: AIRBURSTS, ${e.damageMt.toFixed(2)} MT OF DAMAGE` : 'FAILED: ' + e.reason}`;
    case 'PUSH':
      return `${stamp}  ${e.missionId} ${e.method} ON ${e.targetId}  ${e.viable ? `F ${e.force < 1 ? (e.force * 1000).toFixed(2) + ' MN' : e.force.toFixed(1) + ' N'}  ${(e.duration / 86400).toFixed(0)} D  dV ${(e.dv * 1000).toFixed(3)} MM/S` : 'NOT VIABLE: ' + e.note}`;
    case 'NUKE':
      return `${stamp}  ${e.missionId} ${e.mode} BURST ${e.yieldMt} MT ON ${e.targetId}${e.pulses > 1 ? ` X${e.pulses}` : ''}  ${e.fuzed ? `dV ${(e.dv * 1000).toFixed(2)} MM/S  Q/Q* ${e.qRatio.toFixed(2)}` : 'FUZE FAILED (CLOSING SPEED TOO HIGH)'}`;
    case 'FRAGMENTATION':
      return `${stamp}  ${e.missionId} DISRUPTED ${e.targetId}  Q/Q* ${e.qRatio.toFixed(2)}  ${e.count} PIECES  LARGEST ${e.largestD.toFixed(0)} M  V-EJ ${e.vEj.toFixed(2)} M/S${e.escaped ? `  ${e.escaped} ESCAPED` : ''}`;
    case 'CLOSE_APPROACH':
      return `${stamp}  ${e.bodyId ?? 'THREAT'} CLOSE APPROACH  D ${(e.dMin / 1000).toFixed(0)} KM  B-CRIT ${(e.bCrit / 1000).toFixed(0)} KM  ${e.impact ? 'IMPACT' : `MISS BY ${e.marginRadii.toFixed(2)} R`}`;
    case 'NOTE':
      return `${stamp}  ${e.text}`;
  }
}
