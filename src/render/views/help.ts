// WHAT: HOW TO PLAY screen: the manual (docs/HOW_TO_PLAY.md) rendered in the stroke font, page by page.
// WHY:  The tutorial and Learning Center arrive in M8/M9; until then the player needs the rules in the game.
// HOW:  Pages are arrays of lines kept in step with docs/HOW_TO_PLAY.md (a test checks the headings match).
//       Left/Right page, Up/Down scroll, Esc back to wherever it was opened from.
// LORE: G1 (how to play), G2 (screens and HUD), G3 (the planner)

import { openSupport } from '../../game/support';
import type { Router, Screen, ScreenId } from '../../game/screen';
import type { Input } from '../../ui/input';
import type { Surface } from '../canvas';
import { ScreenBar } from '../../ui/actionBar';
import type { GearSpec } from '../../ui/gearMenu';
import { drawText, drawTextFit, wrapText } from '../vectorFont';

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
      '2. PRESS P. THE PLANNER LISTS PLANS; < > PICKS A METHOD TAB (KINETIC, SWARM, FLYBY, SAIL, NUKE, PUSH, PI).',
      '   PLAN 1 IS USUALLY THE BEST. READ ITS RESULT LINE:',
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
      'KEYS:  P PLANNER   F PLAY IT OUT   T TECH   G PROGRAMS   V PLANET VIEW   E EVACUATE   R RESOLVE   X EXPORT',
      '       SPACE PAUSE   [ ] WARP   S SCALE   Z RESET CAMERA   WHEEL ZOOM   DRAG PAN   M THIS MANUAL',
      '       K SKY COVERAGE   I TILT   A AUTOPLAY (- AND = PACE)   L LEARN   ? LORE   TAB IN PROGRAMS: STUDIES',
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
      '   < > CHANGE THE METHOD TAB; A LOCKED TAB NAMES THE TECH TO RESEARCH (T OPENS THE TREE).',
      '   COMMIT SEVERAL IF ONE IS NOT ENOUGH; THE MARGIN SHOWN IS THE TOTAL.',
      '3. RUN THE CLOCK: ] AND [ CHANGE WARP (1 DAY/S .. 1 YEAR/S), SPACE PAUSES. THE LOG PRINTS EVENTS.',
      '   PAUSE AND PRESS P AGAIN ANY TIME TO ADD MISSIONS. BUDGET ACCRUES ON THE CLOCK.',
      '4. WATCH: F PLAYS THE ROUND OUT IN UNDER A MINUTE (BUILD, LAUNCH, HIT, CLOSE APPROACH, RESULT). ESC STOPS.',
      '   RESOLVE: R JUMPS TO THE CLOSE APPROACH. A MISS OPENS THE DEBRIEF; SPACE STARTS THE NEXT ROUND.',
      '   A HIT ENDS THE RUN AND RECORDS IT ON THE LEADERBOARD.',
      '',
      'KEYS:  P PLANNER   F PLAY IT OUT   T TECH   G PROGRAMS   V PLANET VIEW   E EVACUATE   R RESOLVE   X EXPORT',
      '       SPACE PAUSE   [ ] WARP   S SCALE   Z RESET CAMERA   WHEEL ZOOM   DRAG PAN   M THIS MANUAL',
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
      'LEARNING: ? OPENS THE LORE PANEL ON WHAT YOU ARE LOOKING AT (5 LEVELS, 1-5 OR TAB);',
      '  L OPENS THE LEARNING CENTER (61 TOPICS, SEARCH /, BOOKMARKS B, LABS WITH LIVE SLIDERS ON EXPERT TOPICS).',
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
    title: 'CREDITS AND SOURCES  (CREATED BY SPACED)',
    section: 'ADVANCED',
    lines: [
      'REAL DATA (PUBLIC DOMAIN): NASA/JPL SOLAR SYSTEM DYNAMICS APIS: CLOSE APPROACHES (CAD), THE SENTRY RISK LIST,',
      '  CNEOS FIREBALLS. SNAPSHOTS BAKED BY SCRIPTS/FETCH_REALDATA.PY; NOTHING IS FETCHED WHILE YOU PLAY.',
      'MAP: MADE WITH NATURAL EARTH (PUBLIC DOMAIN), 1:110M COASTLINE, THINNED BY SCRIPTS/BAKE_COASTLINE.PY.',
      'VOICE: KOKORO-82M TEXT TO SPEECH BY HEXGRAD (APACHE-2.0), VOICES BF_EMMA, BM_FABLE, BM_GEORGE, AF_HEART, AM_MICHAEL,',
      '  AM_ONYX, AF_BELLA AND AM_ADAM, VOCODED AND BAKED OFFLINE BY SCRIPTS/GEN_VOICE.PY INTO PUBLIC/AUDIO/VOICE.',
      '  OPTIONS > VOICE: OFF, FEMALE, MALE, TERMINAL, COMPUTER, MAINFRAME, TOY, NARRATOR OR RADIO; VOICE TEST PLAYS A SAMPLE.',
      '',
      '3-D WIREFRAMES ARE DRAWN BY HAND FROM PUBLIC DIMENSIONS AND FACT SHEETS: NASA AND JHU-APL (DART), RUBIN',
      '  OBSERVATORY (NSF-DOE), NASA JPL DEEP SPACE NETWORK (GOLDSTONE DSS-14), NASA JPL (NEO SURVEYOR), NASA (NEA',
      '  SCOUT, SOLAR CRUISER), OSIRIS-REX AND HAYABUSA2 SHAPE WORK (BENNU, RYUGU), BARBEE ET AL. 2018 (HAMMER).',
      '  NO IMAGES OR LOGOS ARE SHIPPED. SPECULATIVE DEVICES (NANOFORGE, SWARM, SHEPHERD) ARE INVENTED FOR THE GAME.',
      '',
      'PHYSICS REFERENCES: SEE EACH LEARNING CENTER TOPIC AT EXPERT LEVEL (MORE:) AND DOCS/ASSUMPTIONS.MD.',
      'FICTION IN SIMULATION AND MULTIVERSE IS FICTION. REALITY ON IN THE CONSOLE STATES THE PHYSICS THAT FORBIDS IT.',
      '',
      'MISS BETA IS AN OPEN TEACHING REPOSITORY UNDER THE GNU AGPL-3.0 (OR LATER) LICENCE. THE PYTHON MIRROR (PYMISS) CHECKS THE PHYSICS.',
      '  SOURCE CODE: GITHUB.COM/SPACED-LAB/MISS-BETA (SEE NOTICE AND LICENSE). A CHANGED VERSION RUN ONLINE MUST OFFER ITS SOURCE TOO.',
      '',
      'ABOUT THIS GAME: CREATED BY RIDLEY DISIENA AKA SPACED.',
      'SUPPORT: MISS BETA IS SELF-FUNDED AND RUNS ON COFFEE. DONATIONS FOR COFFEE ARE WELCOME AND HELP KEEP IT FREE AND OPEN.',
      '  PRESS C OR CLICK THIS LINE TO OPEN THE COFFEE FUND IN A NEW TAB.',
    ],
  },
];

const SECTIONS = ['BASIC', 'STRATEGY', 'ADVANCED'] as const;

export class HelpScreen implements Screen {
  private page = 0;
  private scroll = 0;
  /** Screen y of the CREDITS support line in the last frame (click target), or null. */
  private supportY: number | null = null;
  private get section(): (typeof SECTIONS)[number] {
    return HELP_PAGES[this.page]?.section ?? 'BASIC';
  }
  /** Where Esc returns to. */
  returnTo: ScreenId = 'title';
  /** Set by main: open the Learning Center (L), Esc there returns to this page. */
  openCenter: ((id: string) => void) | null = null;
  /** The action bar (ui/actionBar.ts): page, section, scroll, learn, back. */
  private readonly bar = new ScreenBar();
  /** Phone layout (IDEAS 39): lines re-wrapped to the width at 9 px instead of shrunk. */
  private compact(): boolean {
    return this.s.width < 700;
  }
  constructor(private readonly s: Surface, private readonly keys: Input, private readonly router: Router) {}
  enter(): void {
    this.scroll = 0;
  }
  exit(): void {}
  gear(): GearSpec {
    const onCredits = HELP_PAGES[this.page]?.title.startsWith('CREDITS') === true;
    return { title: 'HOW TO PLAY', items: [...this.bar.items, ...(onCredits ? [{ label: 'COFFEE FUND', code: 'KeyC', key: 'C' }] : [])] };
  }
  update(): void {
    const k = this.keys;
    // CREDITS: C or a click on the support lines opens the coffee fund (src/game/support.ts).
    const onCredits = HELP_PAGES[this.page]?.title.startsWith('CREDITS') === true;
    this.bar.tap(k);
    const click = k.takeClick();
    if (onCredits && (k.pressed('KeyC') || (click && this.supportY !== null && click.y >= this.supportY - 4 && click.y <= this.supportY + 34))) {
      openSupport();
      return;
    }
    if (k.pressed('Escape') || k.pressed('KeyM')) {
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
    // On a phone the wrapped page is longer than its source lines: scroll runs to three times their count.
    if (k.pressed('ArrowDown')) this.scroll = Math.min(this.scroll + (this.compact() ? 4 : 1), Math.max(0, (HELP_PAGES[this.page]?.lines.length ?? 0) * (this.compact() ? 3 : 1) - 5));
    if (k.pressed('ArrowUp')) this.scroll = Math.max(0, this.scroll - 1);
  }
  render(): void {
    const s = this.s;
    const p = s.palette;
    s.clear();
    const m = 16;
    const page = HELP_PAGES[this.page];
    if (!page) return;
    const compact = this.compact();
    let tx = this.keys.touchUsed ? m + 30 : m;
    for (const sec of SECTIONS) {
      drawText(s, sec, tx, m, compact ? 10 : 12, { color: sec === page.section ? p.hot : p.dim, glow: sec === page.section ? 1.2 : 0 });
      tx += compact ? 90 : 110;
    }
    if (compact) drawTextFit(s, `${this.page + 1} / ${HELP_PAGES.length}   ${page.title}`, m, m + 16, 9, s.width - 2 * m, { color: p.ink, glow: 0.5 });
    // NOTE: the title line ends left of the GEAR tab in a short window (ui/gearMenu.ts).
    else drawTextFit(s, `HOW TO PLAY   ${this.page + 1} / ${HELP_PAGES.length}   ${page.title}`, tx + 20, m, 12, s.width - m - tx - 20 - (this.keys.touchUsed || s.height < 500 ? 34 : 0), { color: p.ink, glow: 0.5 });
    const size = compact ? 9 : Math.max(9, Math.min(12, (s.width - 2 * m) / 105 / (5.5 / 6)));
    const lineH = size * (compact ? 1.45 : 1.7);
    let y = m + (compact ? 34 : 36);
    this.supportY = null;
    const bottom = s.height - this.bar.height - (compact ? 8 : 24);
    // Hand-aligned lines (key tables) are never re-wrapped on a desktop, shrunk to the window instead; a phone
    // wraps each line at 9 px (a continuation keeps its indent and dim colour).
    const shown: { text: string; dim: boolean; support: boolean }[] = [];
    for (const line of page.lines) {
      if (!compact) shown.push({ text: line, dim: line.startsWith(' '), support: line.startsWith('SUPPORT:') });
      else {
        const parts = wrapText(line.trim(), s.width - 2 * m - (line.startsWith(' ') ? 12 : 0), size);
        if (parts.length === 0) shown.push({ text: '', dim: false, support: false });
        parts.forEach((t, j) => shown.push({ text: (line.startsWith(' ') ? '  ' : '') + t, dim: line.startsWith(' '), support: j === 0 && line.startsWith('SUPPORT:') }));
      }
    }
    for (let i = this.scroll; i < shown.length; i++) {
      if (y > bottom - lineH) break;
      const line = shown[i] as { text: string; dim: boolean; support: boolean };
      if (line.support) this.supportY = y;
      drawTextFit(s, line.text, m, y, size, s.width - 2 * m, { color: line.dim ? p.dim : p.ink, glow: 0.2 });
      y += lineH;
    }
    if (!compact) drawTextFit(s, 'FULL MANUAL: DOCS/HOW_TO_PLAY.MD', s.width - m, bottom - 12, 9, s.width / 2, { align: 'right', color: p.dim, glow: 0 });
    this.bar.draw(s, [{ label: '< PAGE', code: 'ArrowLeft' }, { label: 'PAGE >', code: 'ArrowRight' }, { label: 'SECTION', code: 'Tab', key: 'TAB' }, { label: 'UP', code: 'ArrowUp' }, { label: 'DOWN', code: 'ArrowDown' }, { label: 'LEARNING CENTER', code: 'KeyL', key: 'L' }, { label: 'BACK', code: 'Escape', key: 'ESC' }], this.keys.touchUsed || compact);
  }
}
