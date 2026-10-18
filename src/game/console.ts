// WHAT: The console (GAME_PLAN 13.10, 22.2, 20.4): a command table, no eval. Cheat codes, mode codes,
//       SPAWN scenarios, the FICTION commands with their forbidding quantity, and the knobs editor.
// WHY:  Cheats are open and teach how the state is wired; FICTION commands each print the physics that
//       forbids them before doing the thing anyway; the knobs editor is the SIMULATION premise made literal.
// HOW:  `runCommand(line, ctx)` tokenizes on whitespace (numbers and identifiers only), looks the verb up in
//       COMMANDS, checks the mode gate (modes.ts), and calls the handler with a GameContext the screen
//       implements. Handlers return the lines to print. Any code used flags the run ASSISTED.
// LORE: G6 (modes, civilization levels and cheat codes), G7 (under the hood)

import { KNOBS } from '../config/knobs';
import { G } from '../physics/constants';
import { SCENARIOS, scenarioById } from '../sim/scenarios';
import { allowsTag, enterMode, type Mode } from './modes';
import type { RunState } from './run';
import { TECH, techById, applyTech } from './tech';

/** What a command may touch. The system screen implements it; tests use a stub. */
export interface GameContext {
  run: RunState;
  /** Hooks into the current round (null-safe: the title has no round). */
  round: {
    hasThreat: boolean;
    teleport(): string;
    observe(): string;
    rewind(years: number): string;
    editG(factor: number): string;
    deleteThreat(): string;
    tractorBeam(): string;
    singularity(): string;
    planetThrusters(dv: number): string;
    shrink(): string;
    multiverse(n: number): string;
    wormhole(): string;
    revealNow(): string;
    completeAllPrograms(scifi: boolean): string;
  } | null;
}

export interface Command {
  verb: string;
  tag: 'CHEAT' | 'MODE' | 'FICTION' | 'DEV' | 'INFO';
  usage: string;
  help: string;
  /** Minimum mode. */
  mode: Mode;
  handler: (args: string[], ctx: GameContext) => string[];
}

const SINGULARITY_LINE = 'A 1E4 KG HOLE LASTS 8E-5 S AND RELEASES 9E20 J (215 MT) NEXT TO YOUR PROBE. ROUND OVER.';

/** Hawking evaporation time t = 5120 pi G^2 M^3 / (hbar c^4), s. Example: 1e4 kg -> 8.4e-5 s; 1e9 kg -> 2.7e3 yr. */
export function hawkingLifetime(M: number): number {
  const hbar = 1.054571817e-34;
  const c = 299792458;
  return (5120 * Math.PI * G * G * M * M * M) / (hbar * Math.pow(c, 4));
}

function flag(ctx: GameContext, code: string): void {
  if (!ctx.run.cheatsUsed.includes(code)) ctx.run.cheatsUsed.push(code);
  ctx.run.assisted = true;
}

function num(args: string[], i: number, fallback: number): number {
  const v = Number(args[i]);
  return Number.isFinite(v) ? v : fallback;
}

export const COMMANDS: readonly Command[] = [
  { verb: 'HELP', tag: 'INFO', usage: 'HELP', help: 'list commands available in this mode', mode: 'REALISTIC', handler: (_a, ctx) => COMMANDS.filter((c) => allowsMode(ctx.run.mode, c.mode)).map((c) => `${c.usage.padEnd(16)} ${c.help}`) },
  { verb: 'MODE', tag: 'INFO', usage: 'MODE', help: 'show the current mode and civilization level', mode: 'REALISTIC', handler: (_a, ctx) => [`MODE ${ctx.run.mode}  HIGHEST ${ctx.run.highestMode}  CIVILIZATION LEVEL ${ctx.run.civLevel}  CHEATS ${ctx.run.cheatsUsed.join(' ') || 'NONE'}`] },
  { verb: 'KARDASHEV1', tag: 'CHEAT', usage: 'KARDASHEV1', help: 'civilization level 1: all REAL + PROPOSED tech and programs complete, budget x10', mode: 'REALISTIC', handler: (_a, ctx) => { flag(ctx, 'KARDASHEV1'); for (const n of TECH) if (n.mode !== 'SCIFI' && !ctx.run.tech.includes(n.id)) { ctx.run.tech.push(n.id); applyTech(ctx.run, n); } ctx.run.economy.perYear *= 10; ctx.run.economy.start *= 10; ctx.run.civLevel = Math.max(ctx.run.civLevel, 1); const extra = ctx.round ? ctx.round.completeAllPrograms(false) : ''; return ['CIVILIZATION LEVEL 1. EVERY REAL AND PROPOSED TECH OWNED, PROGRAMS COMPLETE, BUDGET X10.', extra].filter(Boolean); } },
  { verb: 'KARDASHEV2', tag: 'CHEAT', usage: 'KARDASHEV2', help: 'civilization level 2: SCI-FI mode, all SPECULATIVE programs complete, budget x1000', mode: 'REALISTIC', handler: (_a, ctx) => { flag(ctx, 'KARDASHEV2'); for (const n of TECH) if (!ctx.run.tech.includes(n.id)) { ctx.run.tech.push(n.id); applyTech(ctx.run, n); } if (ctx.run.mode === 'REALISTIC') enterMode(ctx.run, 'SCIFI'); ctx.run.economy.perYear *= 1000; ctx.run.economy.start *= 1000; ctx.run.civLevel = 2; const extra = ctx.round ? ctx.round.completeAllPrograms(true) : ''; return ['CIVILIZATION LEVEL 2. SCI-FI MODE. EVERY TECH OWNED, EVERY PROGRAM COMPLETE, BUDGET X1000.', extra].filter(Boolean); } },
  { verb: 'SCIFI', tag: 'MODE', usage: 'SCIFI', help: 'enter SCI-FI mode (SPECULATIVE methods and programs)', mode: 'REALISTIC', handler: (_a, ctx) => { flag(ctx, 'SCIFI'); const v = enterMode(ctx.run, 'SCIFI'); return [v === 'OK' ? 'SCI-FI MODE. PHYSICS STILL HOLDS; THE TECHNOLOGY DOES NOT EXIST YET.' : `ALREADY IN ${ctx.run.mode}`]; } },
  { verb: 'SIMULATION', tag: 'MODE', usage: 'SIMULATION', help: 'enter SIMULATION mode (requires SCI-FI): the console gains the FICTION commands', mode: 'REALISTIC', handler: (_a, ctx) => { flag(ctx, 'SIMULATION'); const v = enterMode(ctx.run, 'SIMULATION'); return [v === 'OK' ? 'HOME IS INSIDE A SIMULATION AND YOU HAVE FOUND THE CONSOLE. FICTION COMMANDS UNLOCKED; RUNS ARE FLAGGED FICTION.' : v === 'REQUIRES_SCIFI' ? 'SIMULATION REQUIRES SCI-FI MODE FIRST (TYPE SCIFI).' : `ALREADY IN ${ctx.run.mode}`]; } },
  { verb: 'MULTIVERSE', tag: 'MODE', usage: 'MULTIVERSE n', help: 'fork the round into n branches (4, 9 or 16); requires SIMULATION', mode: 'REALISTIC', handler: (a, ctx) => { flag(ctx, 'MULTIVERSE'); if (ctx.run.mode === 'SCIFI' || ctx.run.mode === 'REALISTIC') { const v = enterMode(ctx.run, 'MULTIVERSE'); if (v !== 'OK') return ['MULTIVERSE REQUIRES SIMULATION MODE FIRST (TYPE SCIFI, THEN SIMULATION).']; } else if (ctx.run.mode === 'SIMULATION') enterMode(ctx.run, 'MULTIVERSE'); const n = [4, 9, 16].includes(num(a, 0, 4)) ? num(a, 0, 4) : 4; return ['EVERETT WOULD LIKE A WORD.', ctx.round ? ctx.round.multiverse(n) : 'NO ROUND TO FORK.']; } },
  { verb: 'REVEAL', tag: 'CHEAT', usage: 'REVEAL', help: 'show ground truth: beta, fragment outcomes, before they happen', mode: 'REALISTIC', handler: (_a, ctx) => { flag(ctx, 'REVEAL'); ctx.run.reveal = true; return ['GROUND TRUTH REVEALED. BETAS AND OUTCOMES SHOW BEFORE THEY HAPPEN.', ctx.round?.revealNow() ?? ''].filter(Boolean); } },
  { verb: 'FASTBUILD', tag: 'CHEAT', usage: 'FASTBUILD', help: 'all build times 0', mode: 'REALISTIC', handler: (_a, ctx) => { flag(ctx, 'FASTBUILD'); ctx.run.fastBuild = true; ctx.run.effects.buildTimeYears = 0; return ['BUILD TIMES ZERO.']; } },
  { verb: 'GODTRACK', tag: 'CHEAT', usage: 'GODTRACK', help: 'sigma_v = 0: perfect orbit knowledge', mode: 'REALISTIC', handler: (_a, ctx) => { flag(ctx, 'GODTRACK'); ctx.run.godTrack = true; ctx.run.effects.sigmaVMult = 0; return ['PERFECT TRACKING.']; } },
  { verb: 'LEADTIME', tag: 'CHEAT', usage: 'LEADTIME n', help: 'force lead time to n years on the next round', mode: 'REALISTIC', handler: (a, ctx) => { const n = num(a, 0, NaN); if (!(n > 0 && n < 200)) return ['USAGE: LEADTIME <YEARS 0..200>']; flag(ctx, 'LEADTIME'); ctx.run.leadTimeNext = n; return [`NEXT ROUND: ${n} YEARS OF LEAD.`]; } },
  { verb: 'SPAWN', tag: 'CHEAT', usage: 'SPAWN name', help: `next round is a named scenario: ${SCENARIOS.map((s) => s.id).join(' ')}`, mode: 'REALISTIC', handler: (a, ctx) => { const sc = a[0] ? scenarioById(a[0]) : null; if (!sc) return [`USAGE: SPAWN <${SCENARIOS.map((s) => s.id).join('|')}>`]; flag(ctx, 'SPAWN'); ctx.run.spawnNext = sc.id; return [`NEXT ROUND: ${sc.name}. ${sc.note.toUpperCase()}`]; } },
  { verb: 'DART', tag: 'CHEAT', usage: 'DART', help: 'replay the real DART geometry as a round (SPAWN DIDYMOS with the real numbers)', mode: 'REALISTIC', handler: (_a, ctx) => { flag(ctx, 'DART'); ctx.run.spawnNext = 'DIDYMOS'; return ['NEXT ROUND: DIMORPHOS. DART: 580 KG AT 6.14 KM/S, BETA 3.6, DV 2.7 MM/S. THE FULL TUTORIAL ARRIVES IN M8.']; } },
  { verb: 'TELEPORT', tag: 'FICTION', usage: 'TELEPORT', help: 'threat position += 1 AU along track', mode: 'SIMULATION', handler: (_a, ctx) => ['NO-CLONING THEOREM FORBIDS COPYING ITS STATE. ALSO NOBODY BUILT A RECEIVER.', ctx.round?.teleport() ?? 'NO THREAT.'] },
  { verb: 'OBSERVE', tag: 'FICTION', usage: 'OBSERVE', help: 'quantum redirection: re-roll the orbit; miss with P = 1/e', mode: 'SIMULATION', handler: (_a, ctx) => ['WAVEFUNCTIONS OF 1E11 KG BODIES HAVE DECOHERED. WE ARE PRETENDING.', ctx.round?.observe() ?? 'NO THREAT.'] },
  { verb: 'REWIND', tag: 'FICTION', usage: 'REWIND n', help: 'rewind the round clock n years, keep knowledge', mode: 'SIMULATION', handler: (a, ctx) => ['CLOSED TIMELIKE CURVES NOT FOUND.', ctx.round?.rewind(num(a, 0, 1)) ?? 'NO ROUND.'] },
  { verb: 'EDIT', tag: 'FICTION', usage: 'EDIT G x', help: 'change G (the star mass) by factor x; planets drift', mode: 'SIMULATION', handler: (a, ctx) => { if ((a[0] ?? '').toUpperCase() !== 'G') return ['USAGE: EDIT G <FACTOR>']; const f = num(a, 1, NaN); if (!(f > 0.1 && f < 10)) return ['FACTOR 0.1..10 ONLY, EVEN IN A SIMULATION.']; return ['G HAS BEEN 6.674E-11 FOR 13.8 GYR.', ctx.round?.editG(f) ?? 'NO ROUND.']; } },
  { verb: 'DELETE', tag: 'FICTION', usage: 'DELETE', help: 'remove the threat entity', mode: 'SIMULATION', handler: (_a, ctx) => ['MASS-ENERGY CONSERVATION VIOLATED BY 9E27 J.', ctx.round?.deleteThreat() ?? 'NO THREAT.'] },
  { verb: 'NOCLIP', tag: 'FICTION', usage: 'NOCLIP', help: 'HOME becomes non-colliding this round', mode: 'SIMULATION', handler: (_a, ctx) => { ctx.run.noclip = true; return ['PAULI EXCLUSION STILL APPLIES TO PLANETS.', 'HOME IS NON-COLLIDING THIS ROUND.']; } },
  { verb: 'TRACTORBEAM', tag: 'FICTION', usage: 'TRACTORBEAM', help: '1e6 N on the threat at any range, no reaction mass', mode: 'SIMULATION', handler: (_a, ctx) => ['MOMENTUM CONSERVATION: WHO IS PUSHING BACK?', ctx.round?.tractorBeam() ?? 'NO THREAT.'] },
  { verb: 'SINGULARITY', tag: 'FICTION', usage: 'SINGULARITY', help: 'a pocket black hole near the threat; it evaporates', mode: 'SIMULATION', handler: (_a, ctx) => [SINGULARITY_LINE, `T_EVAP(1E4 KG) = ${hawkingLifetime(1e4).toExponential(2)} S.  T_EVAP(1E9 KG) = ${(hawkingLifetime(1e9) / 3.15576e7).toExponential(2)} YR.`, ctx.round?.singularity() ?? 'NO ROUND.'] },
  { verb: 'WORMHOLE', tag: 'FICTION', usage: 'WORMHOLE', help: 'route the threat into another MULTIVERSE branch', mode: 'MULTIVERSE', handler: (_a, ctx) => ['EXOTIC MATTER WITH NEGATIVE ENERGY DENSITY: 0 KG ON HAND.', ctx.round?.wormhole() ?? 'NO BRANCHES.'] },
  { verb: 'DIPLOMACY', tag: 'FICTION', usage: 'DIPLOMACY', help: 'send a message; the threat replies', mode: 'SIMULATION', handler: () => ['MESSAGE SENT.', "RESPONSE RECEIVED: 'NO.'"] },
  { verb: 'DRILLCREW', tag: 'FICTION', usage: 'DRILLCREW', help: 'launch a human crew with a drill at T-18 d', mode: 'SIMULATION', handler: () => ['TEXAS-SIZED BODY (1.4E21 KG) NEEDS DV 6.5 M/S IN 18 D: >= 3E22 J, ABOUT 7 MILLION MEGATONS. YOU BROUGHT ONE.', 'THE CREW REFUSES.'] },
  { verb: 'PLANETTHRUSTERS', tag: 'FICTION', usage: 'PLANETTHRUSTERS dv', help: 'move HOME by dv m/s', mode: 'SIMULATION', handler: (a, ctx) => { const dv = num(a, 0, 1); return [`0.5 X 6E24 KG X (${dv} M/S)^2 = ${(0.5 * 6e24 * dv * dv).toExponential(1)} J, ABOUT ${((0.5 * 6e24 * dv * dv) / 4.184e15).toExponential(1)} MEGATONS.`, ctx.round?.planetThrusters(dv) ?? 'NO ROUND.']; } },
  { verb: 'SHIELD', tag: 'FICTION', usage: 'SHIELD', help: 'absorb the impact energy in a dome', mode: 'SIMULATION', handler: (_a, ctx) => { ctx.run.shield = true; return ['2E19 J DUMPED INTO ONE STRUCTURE. THE GRID IS A CRATER NOW.', 'A HIT THIS ROUND SCORES AS PARTIAL.']; } },
  { verb: 'SHRINK', tag: 'FICTION', usage: 'SHRINK', help: 'D *= 0.1', mode: 'SIMULATION', handler: (_a, ctx) => ['WHERE DID 99.9% OF THE MASS GO?', ctx.round?.shrink() ?? 'NO THREAT.'] },
  { verb: 'SUMMONDEVS', tag: 'FICTION', usage: 'SUMMONDEVS', help: 'open the knobs editor: KNOB name value', mode: 'SIMULATION', handler: (_a, ctx) => { flag(ctx, 'SUMMONDEVS'); return ['YOU ARE NOW THE SIMULATION.', 'KNOB <NAME> <VALUE> SETS ANY NUMERIC KNOB LIVE. KNOBS LISTS THEM.']; } },
  { verb: 'KNOBS', tag: 'DEV', usage: 'KNOBS [filter]', help: 'list numeric knobs (after SUMMONDEVS)', mode: 'SIMULATION', handler: (a, ctx) => { if (!ctx.run.cheatsUsed.includes('SUMMONDEVS')) return ['TYPE SUMMONDEVS FIRST.']; const f = (a[0] ?? '').toUpperCase(); return Object.entries(KNOBS).filter(([k, v]) => typeof v === 'number' && (f === '' || k.includes(f))).slice(0, 40).map(([k, v]) => `${k} = ${v}`); } },
  { verb: 'KNOB', tag: 'DEV', usage: 'KNOB name value', help: 'set a numeric knob live (after SUMMONDEVS)', mode: 'SIMULATION', handler: (a, ctx) => { if (!ctx.run.cheatsUsed.includes('SUMMONDEVS')) return ['TYPE SUMMONDEVS FIRST.']; const k = (a[0] ?? '').toUpperCase(); const v = num(a, 1, NaN); const knobs = KNOBS as unknown as Record<string, unknown>; if (!(k in knobs) || typeof knobs[k] !== 'number') return [`NO NUMERIC KNOB ${k || '?'}`]; if (!Number.isFinite(v)) return ['VALUE MUST BE A NUMBER']; const old = knobs[k]; knobs[k] = v; return [`${k}: ${old} -> ${v}`]; } },
  { verb: 'TECH', tag: 'DEV', usage: 'TECH id', help: 'unlock a tech node for free (cheat)', mode: 'REALISTIC', handler: (a, ctx) => { const id = (a[0] ?? '').toUpperCase(); try { const n = techById(id); flag(ctx, 'TECH'); if (!ctx.run.tech.includes(id)) { ctx.run.tech.push(id); applyTech(ctx.run, n); } return [`${id} OWNED.`]; } catch { return [`NO TECH ${id || '?'}`]; } } },
];

export function allowsMode(current: Mode, required: Mode): boolean {
  const order: Mode[] = ['REALISTIC', 'SCIFI', 'SIMULATION', 'MULTIVERSE'];
  return order.indexOf(current) >= order.indexOf(required);
}

/** Tokenize: identifiers and numbers only; anything else is dropped (no quoting, no eval). */
export function tokenize(line: string): string[] {
  return line.trim().split(/\s+/).map((t) => t.replace(/[^A-Za-z0-9_.+-]/g, '')).filter((t) => t.length > 0).slice(0, 8);
}

/** Run one console line. Returns the lines to print. */
export function runCommand(line: string, ctx: GameContext): string[] {
  const tokens = tokenize(line);
  const verb = (tokens[0] ?? '').toUpperCase();
  if (!verb) return [];
  const cmd = COMMANDS.find((c) => c.verb === verb);
  if (!cmd) return [`UNKNOWN COMMAND ${verb}. TYPE HELP.`];
  if (!allowsMode(ctx.run.mode, cmd.mode)) {
    const why = cmd.mode === 'MULTIVERSE' ? 'MULTIVERSE' : cmd.mode === 'SIMULATION' ? 'SIMULATION' : 'SCI-FI';
    return [`${verb} IS ${cmd.tag === 'FICTION' ? 'FICTION' : 'GATED'}: ${why} MODE ONLY. YOU ARE IN ${ctx.run.mode}.`];
  }
  if (cmd.tag === 'FICTION' && !allowsTag(ctx.run.mode, 'FICTION')) return [`${verb} IS FICTION: SIMULATION MODE ONLY.`];
  return cmd.handler(tokens.slice(1), ctx);
}
