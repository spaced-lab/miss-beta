// WHAT: HOW TO PLAY screen: the manual (docs/HOW_TO_PLAY.md) rendered in the stroke font, page by page.
// WHY:  The tutorial and Learning Center arrive in M8/M9; until then the player needs the rules in the game.
// HOW:  Pages are arrays of lines kept in step with docs/HOW_TO_PLAY.md (a test checks the headings match).
//       Left/Right page, Up/Down scroll, Esc back to wherever it was opened from.
// LORE: G1 (how to play), G2 (screens and HUD), G3 (the planner)

import type { Router, Screen, ScreenId } from '../../game/screen';
import type { Input } from '../../ui/input';
import type { Surface } from '../canvas';
import { drawText, drawTextFit } from '../vectorFont';

export interface HelpPage {
  section: 'BASIC' | 'STRATEGY' | 'ADVANCED';
  title: string;
  lines: readonly string[];
}

export const HELP_PAGES: readonly HelpPage[] = [
  {
    section: 'BASIC',
    title: 'YOUR FIRST ROUND IN SIX STEPS',
    lines: [
      '1. READ THE TOP LINE: HOW BIG THE ROCK IS AND HOW MANY YEARS YOU HAVE (LEAD).',
      '2. PRESS P. THE PLANNER LISTS PLANS. PLAN 1 IS USUALLY THE BEST. READ ITS RESULT LINE:',
      '   MISS = GOOD.   HIT = NOT ENOUGH, YOU WILL NEED MORE THAN ONE.',
      '3. PRESS ENTER TO COMMIT PLAN 1. COMMIT AGAIN IF THE RESULT STILL SAYS HIT (BUDGET ALLOWING).',
      '4. PRESS P (OR ESC) TO CLOSE THE PLANNER. PRESS ] A FEW TIMES TO SPEED UP THE CLOCK.',
      '5. WATCH THE CRAFT FLY AND THE LOG AT THE BOTTOM LEFT. PRESS R TO JUMP TO THE END.',
      '6. A MISS OPENS THE DEBRIEF. PRESS SPACE FOR THE NEXT ROUND. BETWEEN ROUNDS: T SPENDS RESEARCH ON TECH,',
      '   G FUNDS LONG-TERM PROGRAMS. A HIT ENDS THE RUN.',
      '',
      'STUCK? WAIT A YEAR OR TWO WITH ] : BUDGET GROWS ON THE CLOCK. OR PRESS E TO EVACUATE A SMALL ROCK.',
      'WANT TO EXPERIMENT FIRST? START A SANDBOX RUN FROM THE TITLE: UNLIMITED BUDGET, EVERY TECH.',
      '',
      'KEYS:  P PLANNER   T TECH   G PROGRAMS   V PLANET VIEW   E EVACUATE   R RESOLVE   X EXPORT SAVE',
      '       SPACE PAUSE   [ ] WARP   S SCALE   Z RESET CAMERA   WHEEL ZOOM   DRAG PAN   ? THIS MANUAL',
      '       EVENTS PAUSE THE CLOCK FOR A SHORT CINEMATIC (ANY KEY SKIPS). A BRIEF TYPES IN (ANY KEY CLEARS).',
    ],
  },
  {
    section: 'BASIC',
    title: 'THE ROUND LOOP',
    lines: [
      'YOU RUN BETA, THE PLANETARY DEFENSE OFFICE OF A PLANET CALLED HOME.',
      'EACH ROUND AN OBJECT IS FOUND ON A COLLISION COURSE. CHANGE ITS ORBIT ENOUGH THAT IT MISSES.',
      'MISS = 3 x BETA x (M/M) x U x T.   EARLY AND FAST BEATS LATE AND BIG.',
      '',
      '1. THREAT BRIEF (TOP): TYPE, SIZE, MEGATONS, CLOSING SPEED, WHO FOUND IT, LEAD TIME, MARGIN.',
      '2. PLAN: PRESS P. THE PLANNER LISTS THE BEST PLANS WITH THEIR NUMBERS. UP/DOWN, ENTER TO COMMIT.',
      '   COMMIT SEVERAL IF ONE IS NOT ENOUGH; THE MARGIN SHOWN IS THE TOTAL.',
      '3. RUN THE CLOCK: ] AND [ CHANGE WARP (1 DAY/S .. 1 YEAR/S), SPACE PAUSES. THE LOG PRINTS EVENTS.',
      '   PAUSE AND PRESS P AGAIN ANY TIME TO ADD MISSIONS. BUDGET ACCRUES ON THE CLOCK.',
      '4. RESOLVE: R JUMPS TO THE CLOSE APPROACH. A MISS OPENS THE DEBRIEF; SPACE STARTS THE NEXT ROUND.',
      '   A HIT ENDS THE RUN AND RECORDS IT ON THE LEADERBOARD.',
      '',
      'KEYS:  P PLANNER   T TECH   G PROGRAMS   V PLANET VIEW   E EVACUATE   R RESOLVE   X EXPORT SAVE',
      '       SPACE PAUSE   [ ] WARP   S SCALE   Z RESET CAMERA   WHEEL ZOOM   DRAG PAN   ? THIS MANUAL',
    ],
  },
  {
    section: 'STRATEGY',
    title: 'READING A PLAN',
    lines: [
      'PLAN 1  DEFLECT (Q/Q* 0.11)  KINETIC   SCORE 0.96',
      ' LAUNCH  T-06Y 150D   C3 11.3   PAYLOAD 1500 KG',
      ' IMPACT  T-05Y 258D   U 26.5 KM/S   TARGET THREAT',
      ' PUSH    DV 9.17 MM/S (BETA 2.0..4.0)   EST 0.54 R',
      ' RESULT  MISS  MARGIN +1.03 R   P(MISS) 100%  N 120',
      '',
      'C3     LAUNCH ENERGY THE ROCKET MUST PROVIDE; PAYLOAD FALLS AS C3 RISES.',
      'U      CLOSING SPEED AT IMPACT. THE PUSH IS BETA (M/M) U: FASTER AND HEAVIER IS BETTER.',
      'Q/Q*   UNDER 1 THE HIT CRATERS (DEFLECT); OVER 1 IT SHATTERS (DISRUPT).',
      '       BREAKING IT EARLY SCATTERS THE PIECES PAST THE PLANET; BREAKING IT LATE AIMS A SHOTGUN AT YOU.',
      'BETA   MOMENTUM ENHANCEMENT FROM EJECTA. DRAWN AT IMPACT, REVEALED AFTER THE TRACKING DELAY.',
      'EST    THE QUICK 3 DV T ESTIMATE.   RESULT   THE REAL PROPAGATION.',
      'P(MISS) 120 MONTE CARLO SAMPLES OF BETA AND FRAGMENT DRAWS FOR THE SELECTED PLAN.',
      'MARGIN DISTANCE OUTSIDE THE GRAVITATIONAL-FOCUSING RING, IN PLANET RADII. POSITIVE MISSES.',
      '',
      'AFTER A BREAKUP, TAB IN THE PLANNER CYCLES THE TARGET OVER THE SURVIVING PIECES.',
    ],
  },
  {
    section: 'STRATEGY',
    title: 'PLAN TYPES (THE TECH TREE UNLOCKS THEM)',
    lines: [
      'KINETIC          ONE IMPACTOR ON A DIRECT INTERCEPT. ALWAYS AVAILABLE.',
      'SWARM            2 TO 3 LAUNCHES ON STAGGERED WINDOWS.',
      'SPLIT BUS        ONE CARRIER RELEASES 3 OR 8 SUB-IMPACTORS LATE, EACH ABLE TO RE-AIM AT A FRAGMENT.',
      'KINETIC-FLYBY    A PLANET ROTATES THE VELOCITY FOR FREE. FLYBY WINDOWS LISTS THE DATES THAT WORK.',
      'SAIL-KINETIC     A SAIL SPIRALS FOR MONTHS TO BUILD SPEED, DROPS, THEN INTERCEPTS.',
      'NUKE STANDOFF    A BURST PUSHES WITHOUT BREAKING IF THE APPROACH IS SLOW ENOUGH TO FUZE.',
      'NUKE SUBSURFACE  SHATTERS. WARHEADS COST EXTRA AND CARRY A SCORE PENALTY.',
      'SLOW PUSH        RENDEZVOUS, THEN PUSH FOR YEARS: TRACTOR, ION BEAM, LASER AND THE REST.',
      '                 TINY FORCES: SMALL BODIES, FINE-TUNING, SWEEPING FRAGMENTS. NOT VIABLE ONES SHOW TOO.',
      'PI               A PENETRATOR ARRAY SHREDS A BODY UNDER 100 M HOURS BEFORE IMPACT.',
      '',
      'AUTONOMY: ASSETS IN FLIGHT CAN REACT. TIER 1 FOLLOWS RULES (R IN THE PLANNER CYCLES THE PRESET).',
      'TIER 2 RE-AIMS ITSELF AT THE BEST FRAGMENT WITHIN ITS DV. TIER 3 ASSIGNS A FLEET JOINTLY.',
    ],
  },
  {
    section: 'ADVANCED',
    title: 'PROGRAMS, CIVIL DEFENSE, SCORE, SAVING',
    lines: [
      'PROGRAMS (G): YEARS-LONG PROJECTS THAT DRAIN BUDGET PER YEAR: MORE BUDGET, CIVIL-DEFENSE READINESS,',
      '  NEW SURVEY NETWORKS (SPACE IR, A SUNWARD SENTINEL), RADAR, PRE-BUILT INTERCEPTORS, LAUNCH CADENCE.',
      '  NETWORKS CHANGE HOW EARLY LATER THREATS ARE FOUND. LEAD TIME IS THE STRONGEST MULTIPLIER IN THE GAME.',
      '',
      'CIVIL DEFENSE (E): WHEN NOTHING CAN BE FLOWN IN TIME, EVACUATE (COST 2). AN EVACUATED AIRBURST- OR',
      '  CITY-CLASS HIT, ORDERED EARLY ENOUGH, SCORES AS PARTIAL AT A QUARTER AND THE RUN CONTINUES.',
      '  NO WARNING ROUNDS (FOUND AT ATMOSPHERIC ENTRY) ARE CIVIL DEFENSE ONLY.',
      '',
      'BUDGET ACCRUES PER YEAR ON THE CLOCK. RESEARCH COMES FROM ROUND SCORE AND BUYS TECH (T).',
      'SCORE = LOG10(MT + 1) x 100 x (1 + 0.15 ROUND) x OUTCOME x (1 + EFFICIENCY + TIMING + STYLE).',
      '  CLEAN MISS 1.0, MARGINAL 0.8, PARTIAL 0.35. NO WARHEAD AND NO FRAGMENTS EARN STYLE.',
      '',
      'LEARNING: ? OPENS THE LORE PANEL ON WHAT YOU ARE LOOKING AT (5 LEVELS, 1-5 OR TAB; F1-F4 RELATED);',
      '  L OPENS THE LEARNING CENTER (56 TOPICS, SEARCH /, BOOKMARKS B, LABS WITH LIVE SLIDERS ON EXPERT TOPICS).',
      'TUTORIAL (TITLE): A GUIDED ROUND 0 ON A FIXED 100 M ROCK; TAB SKIPS. DAILY RUN: ONE SEED PER UTC DAY.',
      'OPTIONS (TITLE): COLOR MODE, SPECTRUM (UNLOCKS AFTER A CLEAN MISS), CRT, GLOW, SOUND, UNITS, REDUCE MOTION,',
      '  TEXT SIZE, LEARNING LEVEL. I TILTS THE SYSTEM VIEW INTO WIREFRAME 3-D.',
      '',
      'SAVING: THE RUN SAVES AT ROUND BOUNDARIES. CONTINUE ON THE TITLE RESUMES IT. X DOWNLOADS SAVE.MD;',
      '  DROP A SAVE.MD ONTO THE WINDOW TO IMPORT IT.',
      '',
      'PERIMETER (ARCADE): ARROWS MOVE, SPACE FIRES (WATCH THE HEAT), SHIFT PULSE, < SEEKER, > SWARM.',
    ],
  },
  {
    section: 'ADVANCED',
    title: 'CONSOLE, CHEAT CODES, MODES',
    lines: [
      'THE CONSOLE (BACKQUOTE KEY, ON THE TITLE OR IN A RUN) TAKES TYPED COMMANDS. HELP LISTS THEM. CHEAT CODES',
      '  ARE PUBLIC AND FLAG THE RUN ASSISTED (ITS OWN LEADERBOARD). CODES TYPED ON THE TITLE APPLY TO THE NEXT NEW RUN.',
      '',
      'CHEATS: REVEAL (BETAS NOW), FASTBUILD, GODTRACK, LEADTIME N, SPAWN <CHELYABINSK|TUNGUSKA|YR4|APOPHIS|BENNU|',
      '  DIDYMOS|CHICXULUB>, DART, KARDASHEV1 (ALL REALISTIC TECH), KARDASHEV2 (SCI-FI WITH EVERYTHING).',
      '',
      'MODES NEST: REALISTIC > SCIFI > SIMULATION > MULTIVERSE. BUILDING EVERY REAL PROGRAM OPENS SCI-FI; EVERY',
      '  SPECULATIVE ONE OPENS SIMULATION. SCIFI: BUDGET X10 AND THE SPECULATIVE TIER (CNT NET, DE-STAR, FUSION TUGS,',
      '  DISASSEMBLER, NANOFORGE SEEDS, THRUSTER SWARM, SHEPHERD NETWORK, SEED FLEET), INTERSTELLAR OBJECTS, COMETS.',
      '',
      'SIMULATION: GLITCHES, PEELING CORNERS, OPERATOR BULLETINS, AND THE FICTION COMMANDS, PLAYED STRAIGHT:',
      '  TELEPORT OBSERVE REWIND EDIT-G DELETE NOCLIP TRACTORBEAM SINGULARITY PLANETTHRUSTERS SHIELD SHRINK',
      '  MICROHOLE TIMEFOLD DETOUR LUNA HOLLOW TICKET NIBIRU MANDELA PEEL BOOTSTRAP RETROCAUSAL SUMMONDEVS+KNOB.',
      '  REALITY ON MAKES EACH ONE STATE THE PHYSICS THAT FORBIDS IT FIRST (THE CODEX LISTS THEM TOO).',
      '',
      'MULTIVERSE N: THE ROUND FORKS INTO N TILES ON ONE CLOCK; DIGITS SELECT, P PLANS THE SELECTED BRANCH,',
      '  C COLLAPSES IT INTO THE MAIN TIMELINE, WORMHOLE MOVES A THREAT, BORROW N COPIES A BRANCH\'S PLAN.',
    ],
  },
  {
    title: 'CREDITS AND SOURCES',
    section: 'ADVANCED',
    lines: [
      'REAL DATA (PUBLIC DOMAIN): NASA/JPL SOLAR SYSTEM DYNAMICS APIS: CLOSE APPROACHES (CAD), THE SENTRY RISK LIST,',
      '  CNEOS FIREBALLS. SNAPSHOTS BAKED BY SCRIPTS/FETCH_REALDATA.PY; NOTHING IS FETCHED WHILE YOU PLAY.',
      'MAP: MADE WITH NATURAL EARTH (PUBLIC DOMAIN), 1:110M COASTLINE, THINNED BY SCRIPTS/BAKE_COASTLINE.PY.',
      '',
      '3-D WIREFRAMES ARE DRAWN BY HAND FROM PUBLIC DIMENSIONS AND FACT SHEETS: NASA AND JHU-APL (DART), RUBIN',
      '  OBSERVATORY (NSF-DOE), NASA JPL DEEP SPACE NETWORK (GOLDSTONE DSS-14), NASA JPL (NEO SURVEYOR), NASA (NEA',
      '  SCOUT, SOLAR CRUISER), OSIRIS-REX AND HAYABUSA2 SHAPE WORK (BENNU, RYUGU), BARBEE ET AL. 2018 (HAMMER).',
      '  NO IMAGES OR LOGOS ARE SHIPPED. SPECULATIVE DEVICES (NANOFORGE, SWARM, SHEPHERD) ARE INVENTED FOR THE GAME.',
      '',
      'PHYSICS REFERENCES: SEE EACH LEARNING CENTER TOPIC AT EXPERT LEVEL (MORE:) AND DOCS/ASSUMPTIONS.MD.',
      'FICTION IN SIMULATION AND MULTIVERSE IS FICTION. REALITY ON IN THE CONSOLE STATES THE PHYSICS THAT FORBIDS IT.',
      '',
      'MISS BETA IS AN OPEN TEACHING REPOSITORY UNDER THE GNU AGPL-3.0 LICENCE. THE PYTHON MIRROR (PYMISS) CHECKS THE PHYSICS.',
    ],
  },
];

const SECTIONS = ['BASIC', 'STRATEGY', 'ADVANCED'] as const;

export class HelpScreen implements Screen {
  private page = 0;
  private scroll = 0;
  private get section(): (typeof SECTIONS)[number] {
    return HELP_PAGES[this.page]?.section ?? 'BASIC';
  }
  /** Where Esc returns to. */
  returnTo: ScreenId = 'title';
  /** Set by main: open the Learning Center (L), Esc there returns to this page. */
  openCenter: ((id: string) => void) | null = null;
  constructor(private readonly s: Surface, private readonly keys: Input, private readonly router: Router) {}
  enter(): void {
    this.scroll = 0;
  }
  exit(): void {}
  update(): void {
    const k = this.keys;
    if (k.pressed('Escape') || k.pressed('F1')) {
      this.router.go(this.returnTo);
      return;
    }
    if (k.pressed('KeyL') && this.openCenter) {
      this.openCenter('G1');
      return;
    }
    if (k.pressed('ArrowRight') || k.pressed('Space')) {
      this.page = (this.page + 1) % HELP_PAGES.length;
      this.scroll = 0;
    }
    if (k.pressed('ArrowLeft')) {
      this.page = (this.page + HELP_PAGES.length - 1) % HELP_PAGES.length;
      this.scroll = 0;
    }
    if (k.pressed('Tab')) {
      const next = SECTIONS[(SECTIONS.indexOf(this.section) + 1) % SECTIONS.length];
      this.page = Math.max(0, HELP_PAGES.findIndex((pg) => pg.section === next));
      this.scroll = 0;
    }
    if (k.pressed('ArrowDown')) this.scroll = Math.min(this.scroll + 1, Math.max(0, (HELP_PAGES[this.page]?.lines.length ?? 0) - 5));
    if (k.pressed('ArrowUp')) this.scroll = Math.max(0, this.scroll - 1);
  }
  render(): void {
    const s = this.s;
    const p = s.palette;
    s.clear();
    const m = 16;
    const page = HELP_PAGES[this.page];
    if (!page) return;
    let tx = m;
    for (const sec of SECTIONS) {
      drawText(s, sec, tx, m, 12, { color: sec === page.section ? p.hot : p.dim, glow: sec === page.section ? 1.2 : 0 });
      tx += 110;
    }
    drawTextFit(s, `HOW TO PLAY   ${this.page + 1} / ${HELP_PAGES.length}   ${page.title}`, tx + 20, m, 12, s.width - m - tx - 20, { color: p.ink, glow: 0.5 });
    const size = Math.max(9, Math.min(12, (s.width - 2 * m) / 105 / (5.5 / 6)));
    const lineH = size * 1.7;
    let y = m + 36;
    for (let i = this.scroll; i < page.lines.length; i++) {
      if (y > s.height - 60) break;
      const line = page.lines[i] as string;
      // Hand-aligned lines (key tables): never re-wrapped, shrunk to the window instead.
      drawTextFit(s, line, m, y, size, s.width - 2 * m, { color: line.startsWith(' ') ? p.dim : p.ink, glow: 0.2 });
      y += lineH;
    }
    drawTextFit(s, 'LEFT / RIGHT PAGE    <TAB> SECTION (BASIC, STRATEGY, ADVANCED)    UP / DOWN SCROLL    <L> LEARNING CENTER    <ESC> BACK      FULL MANUAL: DOCS/HOW_TO_PLAY.MD', s.width / 2, s.height - m - 12, 11, s.width - 32, { align: 'center', color: p.dim, glow: 0 });
  }
}
