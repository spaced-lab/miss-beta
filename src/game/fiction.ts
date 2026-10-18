// WHAT: The deadpan voice of the FICTION modes, the REALITY switch, and the newer FICTION commands.
// WHY:  Owner, 2026-10-18 (GAME_PLAN 30): inside SIMULATION and MULTIVERSE nothing breaks character. Commands
//       answer as ordinary procedure, straight-faced, like a bureau that has filed stranger forms. The honest
//       physics line (GAME_PLAN 20.4) is not lost: REALITY ON prints it first again, and the CODEX keeps it.
// HOW:  DEADPAN maps a verb to its in-character opening lines; console.ts swaps the honest first line for one
//       of them (picked by a hash of the verb and the run seed, so it is stable per run) unless REALITY is ON.
//       EXTRA_FICTION are command table rows like console.ts's; their effects go through GameContext hooks.
// LORE: G6 (modes, civilization levels and cheat codes)

import { G } from '../physics/constants';
import type { Command, GameContext } from './console';

let reality = false;
export const realityOn = (): boolean => reality;
export function setReality(on: boolean): void {
  reality = on;
}

/** In-character openers, one or more per FICTION verb. Deadpan: never a wink, never an apology. */
export const DEADPAN: Readonly<Record<string, readonly string[]>> = {
  TELEPORT: ['RELOCATION APPROVED. THE ROCK HAS BEEN ADVISED OF ITS NEW ADDRESS.', 'TRANSFER COMPLETE. PLEASE DO NOT ASK THE ROCK HOW IT FEELS.'],
  OBSERVE: ['OBSERVATION LOGGED. THE UNIVERSE HAS BEEN ASKED TO MAKE UP ITS MIND.', 'WE LOOKED AT IT. THAT IS USUALLY ENOUGH.'],
  REWIND: ['CLOCKS RETURNED TO THE STOCKROOM IN WORKING ORDER.', 'TIME HAS BEEN RE-ISSUED. PLEASE SIGN FOR IT.'],
  EDIT: ['CONSTANT AMENDED. THE PREVIOUS VALUE HAS BEEN ARCHIVED IN THE BASEMENT.', 'GRAVITY ADJUSTED PER MEMO 44-G. THE PLANETS HAVE BEEN NOTIFIED.'],
  DELETE: ['OBJECT REMOVED FROM INVENTORY. THE INVENTORY WAS NOT CONSULTED.', 'DELETED. THE SPACE IT OCCUPIED IS NOW AVAILABLE FOR LEASE.'],
  NOCLIP: ['HOME HAS BEEN RECLASSIFIED AS SCENERY FOR THE DURATION.', 'COLLISION PRIVILEGES SUSPENDED PENDING REVIEW.'],
  TRACTORBEAM: ['BEAM ENGAGED. THE ROCK HAS BEEN PLACED ON A LEASH.', 'TRACTOR ONLINE. MOMENTUM WILL BE INVOICED LATER.'],
  SINGULARITY: ['SINGULARITY DEPLOYED. THE PAPERWORK HAS ALSO BEEN DEPLOYED, INTO THE SINGULARITY.'],
  WORMHOLE: ['THROAT OPENED. THE ROCK HAS BEEN FORWARDED TO A NEIGHBOURING TIMELINE, RETURN TO SENDER DISABLED.'],
  DIPLOMACY: ['A FORMAL NOTE HAS BEEN DELIVERED BY THE AMBASSADOR TO SMALL BODIES.'],
  DRILLCREW: ['A CREW HAS VOLUNTEERED. THEY HAVE SEEN A FILM ABOUT THIS.'],
  PLANETTHRUSTERS: ['HOME IS UNDER WAY. PLEASE REMAIN SEATED.', 'THE PLANET HAS BEEN ASKED TO STEP ASIDE. IT HAS AGREED.'],
  SHIELD: ['DOME RAISED. IT WAS IN STORAGE ALL ALONG.'],
  SHRINK: ['RESIZED TO REGULATION DIMENSIONS.', 'THE ROCK HAS BEEN TOLD IT IS SMALLER. IT BELIEVED US.'],
  SUMMONDEVS: ['THE OPERATORS WILL SEE YOU NOW.'],
  MULTIVERSE: ['THE TIMELINE HAS BEEN PHOTOCOPIED.'],
  MICROHOLE: ['ORDNANCE: PRIMORDIAL, CLASS IV. HANDLE WITH TONGS. SIGNED OUT TO YOUR DEPARTMENT.', 'A HOLE THE SIZE OF A PROTON HAS BEEN THROWN. IT WEIGHS A MOUNTAIN. IT WAS BORN BEFORE THE STARS.'],
  TIMEFOLD: ['THE ROCK HAS BEEN RESCHEDULED. IT WAS NOT CONSULTED.', 'SPACETIME CREASED ALONG THE DOTTED LINE.'],
  DETOUR: ['A DETOUR SIGN HAS BEEN ERECTED IN DEEP SPACE. THE ROCK IS LAW-ABIDING.', 'ROADWORKS AHEAD. ALL TRAFFIC, INCLUDING ASTEROIDS, PLEASE FOLLOW THE CONES.'],
  LUNA: ['LUNA PROTOCOL ENGAGED. THE MOON WAS ALWAYS A SHIP. IT HAS BEEN WAITING FOR THIS.'],
  HOLLOW: ['CORE SAMPLE RETURNED: HOLLOW. FORM 7-B (UNEXPECTED VOIDS) FILED IN TRIPLICATE.'],
  TICKET: ['TICKET SUBMITTED TO THE SIMULATION OPERATORS.'],
  NIBIRU: ['PLANET X CONFIRMED. ARRIVAL: NEXT YEAR. ARRIVAL HAS BEEN NEXT YEAR FOR SOME TIME.'],
  PEEL: ['THE WALLPAPER HAS COME AWAY. PLEASE DO NOT LOOK DIRECTLY AT THE NUMBERS.', 'MAINTENANCE PANEL OPENED. MIND THE VARIABLES.'],
  BOOTSTRAP: ['THE IMPACTOR WAS ALWAYS HERE. NOBODY BUILT IT. DO NOT ASK WHO DID.', 'A SPARE IMPACTOR HAS BEEN FOUND IN THE STOREROOM. ITS SERIAL NUMBER IS ITS OWN.'],
  RETROCAUSAL: ['LAUNCH WINDOW: YESTERDAY. THE IMPACT HAS ALREADY HAPPENED; THE LAUNCH WILL CATCH UP.', 'EFFECT FILED BEFORE CAUSE. THE CAUSE HAS BEEN NOTIFIED.'],
  BORROW: ['PLAGIARISM ACROSS TIMELINES IS NOT AN OFFENCE IN THIS JURISDICTION.', 'THE OTHER TIMELINE WAS NOT USING ITS PLAN ANYWAY.'],
  MANDELA: ['HISTORY HAS BEEN AMENDED. IT WAS ALWAYS THIS WAY. YOU REMEMBER IT THIS WAY.'],
};

/** Stable pick for a verb within a run. */
export function deadpanFor(verb: string, seed: string): string | null {
  const lines = DEADPAN[verb];
  if (!lines || lines.length === 0) return null;
  let h = 0;
  for (const ch of verb + seed) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return lines[Math.abs(h) % lines.length] ?? null;
}

/** Deflection of a passing mass M at impact parameter b and speed v: dv = 2 G M / (b v). Example: 1e15 kg (a mountain), 100 m, 20 km/s -> 0.067 m/s; 1e12 kg gives only 6.7e-5 m/s. */
export function flybyDeflection(M: number, b: number, v: number): number {
  return (2 * G * M) / (b * v);
}

function n(args: string[], i: number, fallback: number): number {
  const v = Number(args[i]);
  return Number.isFinite(v) ? v : fallback;
}

function flag(ctx: GameContext, code: string): void {
  if (!ctx.run.cheatsUsed.includes(code)) ctx.run.cheatsUsed.push(code);
  ctx.run.assisted = true;
}

/** Each handler returns [honest physics line, effect line(s)]; console.ts swaps the first for DEADPAN. */
export const EXTRA_FICTION: readonly Command[] = [
  {
    verb: 'MICROHOLE', tag: 'FICTION', usage: 'MICROHOLE [b m]', help: 'fire a primordial micro black hole past the threat (1e15 kg); dv = 2 G M / (b v)', mode: 'SIMULATION',
    handler: (a, ctx) => {
      flag(ctx, 'MICROHOLE');
      const b = Math.max(10, n(a, 0, 100));
      const dv = flybyDeflection(1e15, b, 20000);
      return ['A 1E15 KG BLACK HOLE IS 1.5E-12 M ACROSS AND OUTLIVES THE UNIVERSE. NOBODY KNOWS WHERE TO FIND ONE.', `PASS AT ${b} M, 20 KM/S: DV = 2 G M / (B V) = ${dv.toExponential(2)} M/S.`, ctx.round?.impulse(dv, 'MICROHOLE') ?? 'NO THREAT.'];
    },
  },
  {
    verb: 'TIMEFOLD', tag: 'FICTION', usage: 'TIMEFOLD days', help: 'crease spacetime: the threat arrives n days late (Earth has moved on)', mode: 'SIMULATION',
    handler: (a, ctx) => {
      flag(ctx, 'TIMEFOLD');
      const d = Math.max(-30, Math.min(30, n(a, 0, 1)));
      return ['NO KNOWN PHYSICS SLIDES ONE OBJECT ALONG ITS OWN WORLDLINE.', ctx.round?.timefold(d) ?? 'NO THREAT.'];
    },
  },
  {
    verb: 'DETOUR', tag: 'FICTION', usage: 'DETOUR', help: 'put up a road sign in space; the rock takes the detour', mode: 'SIMULATION',
    handler: (_a, ctx) => {
      flag(ctx, 'DETOUR');
      return ['ROCKS FOLLOW GEODESICS, NOT SIGNAGE.', ctx.round?.detour() ?? 'NO THREAT.'];
    },
  },
  {
    verb: 'LUNA', tag: 'FICTION', usage: 'LUNA', help: 'the Moon was always a ship: it takes the hit this round', mode: 'SIMULATION',
    handler: (_a, ctx) => {
      flag(ctx, 'LUNA');
      ctx.run.shield = true;
      return ['THE MOON IS 7.3E22 KG OF ROCK WITH NO ENGINES. SEISMOMETERS SAY SO.', 'A HIT THIS ROUND IS INTERCEPTED BY THE MOON AND SCORES AS PARTIAL.'];
    },
  },
  {
    verb: 'HOLLOW', tag: 'FICTION', usage: 'HOLLOW', help: 'the threat turns out to be hollow: mass / 10', mode: 'SIMULATION',
    handler: (_a, ctx) => {
      flag(ctx, 'HOLLOW');
      return ['RUBBLE PILES ARE UP TO HALF EMPTY SPACE. NINETY PERCENT WOULD NOT HOLD TOGETHER.', ctx.round?.hollow() ?? 'NO THREAT.'];
    },
  },
  {
    verb: 'TICKET', tag: 'FICTION', usage: 'TICKET', help: 'file a bug report with the simulation operators', mode: 'SIMULATION',
    handler: (_a, ctx) => {
      flag(ctx, 'TICKET');
      return ['THERE IS NO EVIDENCE OF OPERATORS.', ctx.round?.ticket() ?? 'NO THREAT. TICKET CLOSED: CANNOT REPRODUCE.'];
    },
  },
  {
    verb: 'NIBIRU', tag: 'FICTION', usage: 'NIBIRU', help: 'confirm Planet X (it is always arriving next year)', mode: 'SIMULATION',
    handler: (_a, ctx) => {
      flag(ctx, 'NIBIRU');
      return ['INFRARED SURVEYS RULE OUT A SATURN-SIZE PLANET WITHIN ABOUT 10,000 AU.', ctx.round?.nibiru() ?? 'NOTED.'];
    },
  },
  {
    verb: 'MANDELA', tag: 'FICTION', usage: 'MANDELA', help: 'amend history: the threat was always named differently, and maybe aimed differently', mode: 'SIMULATION',
    handler: (_a, ctx) => {
      flag(ctx, 'MANDELA');
      return ['MEMORY IS RECONSTRUCTIVE. ORBITS ARE NOT.', ctx.round?.mandela() ?? 'NO THREAT.'];
    },
  },
  {
    verb: 'PEEL', tag: 'FICTION', usage: 'PEEL', help: 'peel back a corner of the render: the raw state of the threat underneath', mode: 'SIMULATION',
    handler: (_a, ctx) => {
      flag(ctx, 'PEEL');
      return ['THE SCREEN IS A PICTURE OF NUMBERS THE PROGRAM KEEPS. THESE ARE THEM: ORBITAL ELEMENTS, MASS, TIME.', ctx.round?.peel() ?? 'NOTHING TO PEEL.'];
    },
  },
  {
    verb: 'BOOTSTRAP', tag: 'FICTION', usage: 'BOOTSTRAP', help: 'the next mission you commit costs nothing (a causal loop built it)', mode: 'SIMULATION',
    handler: (_a, ctx) => {
      flag(ctx, 'BOOTSTRAP');
      return ['A BOOTSTRAP PARADOX HAS NO ORIGIN FOR ITS INFORMATION OR ITS MATTER. CAUSALITY SAYS NO.', ctx.round?.bootstrap() ?? 'NO ROUND.'];
    },
  },
  {
    verb: 'RETROCAUSAL', tag: 'FICTION', usage: 'RETROCAUSAL', help: 'a 5 t impactor at 30 km/s that arrived before it launched (applied now)', mode: 'SIMULATION',
    handler: (_a, ctx) => {
      flag(ctx, 'RETROCAUSAL');
      return ['NO SIGNAL OR MASS TRAVELS BACKWARD IN TIME: THE LIGHT CONE IS ONE-WAY.', ctx.round?.retrocausal() ?? 'NO THREAT.'];
    },
  },
  {
    verb: 'BORROW', tag: 'FICTION', usage: 'BORROW n', help: 'copy branch n\'s missions into the selected branch', mode: 'MULTIVERSE',
    handler: (a, ctx) => {
      flag(ctx, 'BORROW');
      return ['BRANCHES OF A WAVEFUNCTION DO NOT EXCHANGE MATTER OR PLANS.', ctx.round?.borrow(n(a, 0, 1)) ?? 'NO BRANCHES.'];
    },
  },
  {
    verb: 'REALITY', tag: 'INFO', usage: 'REALITY ON|OFF', help: 'ON: FICTION commands state the physics that forbids them first', mode: 'SIMULATION',
    handler: (a) => {
      const on = (a[0] ?? '').toUpperCase() === 'ON';
      setReality(on);
      return [on ? 'REALITY ON. THE PHYSICS WILL BE STATED BEFORE EACH FICTION.' : 'REALITY OFF. PROCEDURE RESUMES.'];
    },
  },
];

/** Ambient bulletins from "the operators" in SIMULATION and MULTIVERSE: deadpan, never a wink. */
export const OPERATOR_NOTES: readonly string[] = [
  'REMINDER: THE SUN IS A PLACEHOLDER. A FINAL SUN WILL BE INSTALLED IN A LATER RELEASE.',
  'SCHEDULED MAINTENANCE ON THE SPEED OF LIGHT IS POSTPONED. PLEASE CONTINUE TO NOT EXCEED IT.',
  'A SMALL NUMBER OF PROTONS HAVE BEEN REPORTED MISSING. IF FOUND, PLEASE RETURN TO THE NEAREST STAR.',
  'THE OPERATORS THANK YOU FOR YOUR CONTINUED PARTICIPATION IN THIS REALITY.',
  'ENTROPY IS PROCEEDING AS PLANNED. NO ACTION IS REQUIRED.',
  'IF YOU CAN READ THIS, THE TEXT LAYER IS LOADED. THE REST WILL FOLLOW.',
  'THE MOON HAS ASKED NOT TO BE MENTIONED IN CONNECTION WITH LAST WEEK.',
  'PLEASE DO NOT FEED THE ASTEROIDS. THEY ARE ON A STRICT DIET OF MOMENTUM.',
  'A MINOR ROUNDING ERROR IN PI HAS BEEN CORRECTED. CIRCLES ARE NOW SLIGHTLY ROUNDER.',
  'YOUR TICKET HAS BEEN ESCALATED TO A SUPERVISOR. THE SUPERVISOR IS ALSO A TICKET.',
  'GRAVITY REMAINS ON. THIS NOTICE WILL REPEAT UNTIL GRAVITY IS OFF.',
  'THE NEXT TIMELINE HAS LEFT THE STATION. ANOTHER WILL BE ALONG SHORTLY.',
];

/** The bulletin for a time slot (stable per run): seconds-based slot so it rotates while you play. */
export function operatorNote(seed: string, slot: number): string {
  let h = 7;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return OPERATOR_NOTES[Math.abs(h + slot * 7919) % OPERATOR_NOTES.length] ?? '';
}

/** SIMULATION round anomalies (GAME_PLAN 30): picked per (seed, round), about one round in three. */
export type Anomaly = 'LOOPED' | 'MIRRORED' | 'UNSTABLE_G';
export const ANOMALY_LINES: Readonly<Record<Anomaly, string>> = {
  LOOPED: 'THIS ROUND HAS HAPPENED BEFORE. THE OPERATORS APOLOGISE FOR THE REPEAT.',
  MIRRORED: 'THE ROCK IS ARRIVING FROM THE OTHER SIDE OF THE MIRROR. PLEASE READ ITS NAME BACKWARDS.',
  UNSTABLE_G: 'GRAVITY IS RUNNING A FEW PERCENT OFF SPEC THIS ROUND. A TECHNICIAN HAS BEEN DISPATCHED.',
};
export function anomalyFor(seed: string, round: number): Anomaly | null {
  if (round < 2) return null;
  // FNV-1a with a final avalanche, so neighbouring rounds are uncorrelated.
  let h = 2166136261;
  for (const ch of `${seed}#anomaly#${round}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  const u = (h >>> 0) / 4294967296;
  return u < 0.11 ? 'LOOPED' : u < 0.22 ? 'MIRRORED' : u < 0.33 ? 'UNSTABLE_G' : null;
}
