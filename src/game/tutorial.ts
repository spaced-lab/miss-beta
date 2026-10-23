// WHAT: The tutorial script (GAME_PLAN 25, EDUCATION G1): eight spotlight steps over a fixed-seed round.
// WHY:  A first player needs the loop shown once: brief, clock, planner, commit, flight, impact, approach,
//       debrief. Each step waits for the player to do the thing, then moves on; Tab skips the whole script.
// HOW:  Pure data plus a pure `advanceTutorial(state, facts)`: the system view assembles `TutorialFacts`
//       from its state every frame and the step's `done` predicate decides. Lore ids are kept on each step
//       so the M9 lore panel can open them; until then the text is the step itself.
// LORE: G1 (how to play), G2 (screens and HUD)

export interface TutorialFacts {
  /** Warp index (0 paused). */
  warp: number;
  /** Highest warp index reached so far this round. */
  maxWarp: number;
  plannerOpen: boolean;
  plannerOpened: boolean;
  missions: number;
  /** A committed mission has launched (launchTime <= t). */
  launched: boolean;
  /** An IMPACT or FRAGMENTATION event lies in the past. */
  impacted: boolean;
  planetOpened: boolean;
  /** The close approach has passed: debrief or over. */
  debrief: boolean;
  programsOpened: boolean;
}

export interface TutorialStep {
  title: string;
  lines: readonly string[];
  lore: readonly string[];
  done: (f: TutorialFacts) => boolean;
}

export const TUTORIAL_SEED = 'TUTORIAL-1';

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    title: 'THREAT BRIEF',
    lines: [
      'A 100 M STONY ROCK, TEN YEARS OUT. THE TOP LINE IS THE BRIEF: SIZE, TYPE, ENERGY IN',
      'MEGATONS, DAMAGE CLASS, WHO FOUND IT. BELOW IT: CLOSING SPEED, LEAD TIME, THE PREDICTED',
      'OUTCOME AND P(IMPACT). TEN YEARS IS A GIFT: A SMALL NUDGE NOW BEATS A BIG ONE LATER.',
      'PRESS SPACE TO START THE CLOCK.',
    ],
    lore: ['T2', 'F9'],
    done: (f) => f.warp > 0 || f.plannerOpened,
  },
  {
    title: 'SYSTEM VIEW AND TIME',
    lines: [
      'STAR, ORBITS, PLANETS, THE THREAT ON ITS DASHED PATH, A RING WHERE HOME WILL BE AT IMPACT.',
      'DRAG TO PAN, WHEEL TO ZOOM, Z RESETS, S SWITCHES TRUE / COMPRESSED DISTANCES.',
      '] SPEEDS THE CLOCK UP, [ SLOWS IT, SPACE PAUSES. REACH 1 MONTH PER SECOND OR FASTER.',
    ],
    lore: ['G2', 'O6'],
    done: (f) => f.maxWarp >= 3 || f.plannerOpened,
  },
  {
    title: 'THE PLANNER',
    lines: [
      'PRESS P. THE PLANNER RANKS EVERY PLAN YOUR TECH ALLOWS. THE PORKCHOP ON THE RIGHT IS',
      'LAUNCH DATE AGAINST ARRIVAL DATE: BRIGHT CELLS ARE CHEAP (LOW C3) AND SLOW (LOW U).',
      'READ ONE LINE: LAUNCH, IMPACT, U (CLOSING SPEED), DV, MISS EST, P(MISS), COST.',
    ],
    lore: ['O10', 'G3'],
    done: (f) => f.plannerOpened,
  },
  {
    title: 'COMMIT',
    lines: [
      'PICK THE TOP KINETIC PLAN (UP / DOWN, ENTER). MISS EST IS 3 x DV x T: THE EARLIER THE HIT,',
      'THE MORE EVERY MM/S IS WORTH. P(MISS) IS 200 MONTE CARLO RUNS OVER BETA AND TRACKING.',
      'ONE IMPACTOR IS ENOUGH HERE; A SECOND IS INSURANCE IF YOU CAN AFFORD IT. ESC CLOSES.',
    ],
    lore: ['D3', 'D2'],
    done: (f) => f.missions >= 1,
  },
  {
    title: 'LAUNCH AND FLIGHT',
    lines: [
      'RUN THE CLOCK (] ). THE LAUNCH EVENT APPEARS IN THE LOG AT BOTTOM LEFT; THE CRAFT DRAWS ITS',
      'TRAIL ALONG THE TRANSFER ORBIT. IT COASTS: KEPLER DOES THE FLYING, NO FUEL IS BURNT.',
    ],
    lore: ['O8'],
    done: (f) => f.launched,
  },
  {
    title: 'IMPACT AND BETA',
    lines: [
      'AT ARRIVAL THE IMPACT EVENT LOGS U AND THE MASS. BETA, THE MOMENTUM MULTIPLIER FROM EJECTA,',
      'IS DRAWN NOW BUT HIDDEN: THE LOG SAYS WHEN TRACKING WILL REVEAL IT. UNTIL THEN P(IMPACT)',
      'IS A SPREAD, NOT A NUMBER. KEEP THE CLOCK RUNNING.',
    ],
    lore: ['D3', 'O5'],
    done: (f) => f.impacted,
  },
  {
    title: 'CLOSE APPROACH',
    lines: [
      'THE ROUND ENDS AT CLOSEST APPROACH. PRESS V FOR THE PLANET VIEW: THE B-CRIT RING IS THE',
      'GRAVITATIONAL FOCUSING RADIUS; ANYTHING INSIDE IT FALLS IN. THE MARGIN IS QUOTED IN RADII.',
      'R RESOLVES THE ROUND AT ONCE IF YOU DO NOT WANT TO WAIT.',
    ],
    lore: ['O12'],
    done: (f) => f.debrief,
  },
  {
    title: 'DEBRIEF AND PROGRAMS',
    lines: [
      'SCORE AND RESEARCH ARE BANKED. THE LINES BELOW ARE THE EVENT LOG; LEFT / RIGHT SCRUB THE',
      'REPLAY. PRESS G AND FUND A PROGRAM: SURVEYS FIND THE NEXT ROCK EARLIER, AND LEAD TIME IS',
      'THE STRONGEST MULTIPLIER IN THE GAME. T SPENDS RESEARCH ON TECH.',
      'SPACE STARTS ROUND 1 FOR REAL (A NEW SEED; THE TUTORIAL IS NEVER RECORDED).',
    ],
    lore: ['G5', 'G4'],
    done: () => false,
  },
];

export interface TutorialState {
  /** Which script: the basic first round, or the DART replay (IDEAS 15). */
  script?: 'BASIC' | 'DART';
  step: number;
  /** Seconds the current step has been showing (for the fade-in). */
  shownFor: number;
}

/** IDEAS 15: the DART replay as a guided round, with the real numbers. Steps advance on the same facts. */
export const DART_STEPS: readonly TutorialStep[] = [
  {
    title: 'DART: THE REAL TARGET',
    lines: [
      'DIMORPHOS IS A 160 M MOONLET OF THE ASTEROID DIDYMOS. IT WAS NEVER A THREAT: NASA PICKED IT BECAUSE ITS 11.9',
      'HOUR ORBIT AROUND DIDYMOS LET TELESCOPES ON EARTH MEASURE ANY CHANGE. HERE IT FLIES ALONE TOWARD HOME WITH THE',
      'REAL SIZE AND TYPE (A RUBBLE PILE). PRESS SPACE TO START THE CLOCK.',
    ],
    lore: ['T4', 'D3'],
    done: (f) => f.warp > 0 || f.plannerOpened,
  },
  {
    title: 'DART: THE SPACECRAFT',
    lines: [
      'DART WEIGHED 580 KG AT IMPACT. IT LAUNCHED ON 24 NOVEMBER 2021 ON A FALCON 9 AND FLEW FOR TEN MONTHS, STEERING',
      'ITSELF FOR THE LAST HOURS WITH ITS DRACO CAMERA (SMART NAV). PRESS P AND COMMIT A KINETIC PLAN. IF ITS RESULT',
      'LINE STILL SAYS IMPACT, COMMIT A SECOND: ONE DART-CLASS CRAFT NUDGES A 160 M ROCK, IT DOES NOT ALWAYS SAVE A PLANET.',
    ],
    lore: ['D3', 'D12'],
    done: (f) => f.missions >= 1,
  },
  {
    title: 'DART: THE LONG COAST',
    lines: [
      'RUN THE CLOCK (] ). A KINETIC IMPACTOR SPENDS ITS LIFE COASTING ON A TRANSFER ORBIT; ALL THE ENGINEERING IS IN',
      'ARRIVING AT THE RIGHT PLACE AT THE RIGHT SECOND. DART SAW DIMORPHOS AS A SINGLE PIXEL ONLY AN HOUR BEFORE IMPACT.',
    ],
    lore: ['O10', 'D12'],
    done: (f) => f.launched,
  },
  {
    title: 'DART: 26 SEPTEMBER 2022',
    lines: [
      'IMPACT AT 6.14 KM/S. THE ORBIT OF DIMORPHOS SHORTENED BY 33 MINUTES, FAR MORE THAN THE SPACECRAFT ALONE COULD',
      'DO: THE CRATER EJECTA FLEW BACK AND PUSHED TOO. THAT MULTIPLIER IS BETA, MEASURED AT ABOUT 3.6. THIS ROUND USES',
      'THE MEASURED BETA.',
    ],
    lore: ['D3', 'O5'],
    done: (f) => f.impacted,
  },
  {
    title: 'DART: WHAT IT PROVED',
    lines: [
      'A SPACECRAFT CAN MOVE AN ASTEROID, AND A RUBBLE PILE PUSHES BACK HARDER THAN A SOLID ROCK. ESA\'S HERA MISSION',
      'REACHES DIDYMOS IN 2026 TO MEASURE THE CRATER AND THE MASS, PINNING BETA DOWN. SPACE CONTINUES TO A NORMAL ROUND.',
    ],
    lore: ['D3', 'D11'],
    done: () => false,
  },
];

/** The steps of a tutorial script. */
export function stepsOf(st: TutorialState): readonly TutorialStep[] {
  return st.script === 'DART' ? DART_STEPS : TUTORIAL_STEPS;
}

export function createTutorial(script: 'BASIC' | 'DART' = 'BASIC'): TutorialState {
  return { script, step: 0, shownFor: 0 };
}

/** Advance when the current step's predicate holds; returns true when the step changed. */
export function advanceTutorial(st: TutorialState, facts: TutorialFacts, dtSeconds = 0): boolean {
  st.shownFor += dtSeconds;
  const steps = stepsOf(st);
  const step = steps[st.step];
  if (!step || !step.done(facts)) return false;
  if (st.step >= steps.length - 1) return false;
  st.step++;
  st.shownFor = 0;
  return true;
}

export const TUTORIAL_SEEN_KEY = 'tutorial.seen';

/**
 * Key words in a step's text, as the buttons a touch screen shows (owner 2026-10-23: every action by touch). Applied
 * to the joined text of a step before it is wrapped; phrases not listed stay as written.
 */
const TOUCH_WORDS: readonly (readonly [string, string])[] = [
  ['PRESS SPACE TO START THE CLOCK', 'TAP RUN TO START THE CLOCK'],
  ['DRAG TO PAN, WHEEL TO ZOOM, Z RESETS, S SWITCHES TRUE / COMPRESSED DISTANCES.', 'DRAG TO PAN, PINCH TO ZOOM; RESET VIEW AND SCALE ARE IN THE GEAR MENU.'],
  ['] SPEEDS THE CLOCK UP, [ SLOWS IT, SPACE PAUSES.', 'WARP + SPEEDS THE CLOCK UP, WARP - SLOWS IT, PAUSE PAUSES.'],
  ['PRESS P.', 'TAP PLANNER.'],
  ['(UP / DOWN, ENTER)', '(UP / DOWN, COMMIT)'],
  ['ESC CLOSES.', 'CLOSE CLOSES.'],
  ['PRESS V FOR THE PLANET VIEW', 'TAP PLANET VIEW (GEAR MENU)'],
  ['PRESS G AND FUND', 'TAP PROGRAMS AND FUND'],
  ['T SPENDS RESEARCH', 'TECH SPENDS RESEARCH'],
  ['SPACE STARTS ROUND 1', 'TAP ROUND 1 TO START IT'],
  ['PRESS P AND COMMIT', 'TAP PLANNER AND COMMIT'],
  ['RUN THE CLOCK (] ).', 'RUN THE CLOCK (WARP +).'],
  ['SPACE CONTINUES', 'NEXT ROUND CONTINUES'],
];

/**
 * A step's text for a touch screen. Example: touchText('PRESS P. THE PLANNER') = 'TAP PLANNER. THE PLANNER'.
 */
export function touchText(text: string): string {
  let out = text;
  for (const [from, to] of TOUCH_WORDS) out = out.split(from).join(to);
  return out;
}
