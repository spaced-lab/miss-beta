// WHAT: SYSTEM VIEW (GAME_PLAN 13.2): the main screen. Star, orbits, planets, the threat and its orbit,
//       spacecraft in flight, the THREAT BRIEF, clock and warp, the planner overlay, the play-by-play log,
//       DEBRIEF after a miss and RUN OVER after a hit. Owns the run loop of Section 3 from M2 on.
// WHY:  Everything the player does happens here or in the planner overlay it opens.
// HOW:  A round is: createWorld + generateThreat, then resolveRound(world, missions) whenever missions
//       change. The clock replays the result: craft fly their Lambert arcs (elements from the departure
//       state), the threat follows its element segments, log lines appear as their time passes, and the
//       close-approach time ends the round. Events that pass on the clock play a short cinematic (the
//       clock waits) and a teletype brief (GAME_PLAN 29); when the last craft has arrived the warp drops
//       to 1 DAY/S once. Keys: Space pause, [ ] warp, P planner (pauses), R resolve now, S scale, Z reset
//       camera, any key skips a cinematic, Esc title.
// LORE: G1 (how to play), G2 (screens and HUD), O12 (close approach), G5 (scoring)

import { targetOf, type TargetId } from '../../sim/targets';
import { canUnlock, TECH, unlock } from '../../game/tech';
import { SkyOverlay } from './sky';
import { nodeLine, tiltAboutNode } from '../../sim/sky';
import { orbitPoints3 } from '../../physics/kepler3';
import { is3D, onPlaneOf, stateAt, toElements as elementsFromState } from '../../sim/orbit3';
import { advanceStudies, studyById } from '../../sim/studies';
import { yearOf } from '../../sim/detection';
import { drawGauge, gaugeHeight } from '../gaugeView';
import { gaugeVerdict, type GaugeReading } from '../../sim/gauge';
import { KNOBS } from '../../config/knobs';
import { keyName } from '../../game/keybinds';
import { budgetAt, spend } from '../../game/economy';
import { recordRun } from '../../game/leaderboard';
import { createRun, nextRound, type RunState } from '../../game/run';
import { scoreRound, type ScoreBreakdown } from '../../game/scoring';
import type { Router, Screen } from '../../game/screen';
import { AU, DAY, YEAR } from '../../physics/constants';
import { orbitPoints, propagate, type Elements } from '../../physics/kepler';
import type { MonteCarloResult } from '../../planner/monteCarlo';
import { sharedPlanner } from '../../planner/workerClient';
import { formatEvent } from '../../sim/eventLog';
import type { Mission } from '../../sim/mission';
import { bodyAlive, elementsAt, resolveRound, type ResolveOpts, type RoundResult } from '../../sim/resolver';
import { roundRng } from '../../sim/rng';
import { generateThreat } from '../../sim/roundGen';
import { advance, createWorld, planetById, planetState, setWarp, warpLabel, type World } from '../../sim/world';
import { formatCountdown } from '../../ui/hud';
import { impactProbability, sigmaB, sigmaVWithArc } from '../../physics/uncertainty';
import type { Input } from '../../ui/input';
import type { Surface } from '../canvas';
import { uiColors, withAlpha } from '../palettes';
import { Autopilot, chooseProgram, chooseTech, demoSpeed, type AutoView, type Pane } from '../../game/autoplay';
import { DemoCutaways } from './demoCut';
import { drawText, drawTextFit, getTextScale, measureText, wrapText } from '../vectorFont';
import { PlanetOverlay } from './planet';
import { PlannerOverlay } from './planner';
import { ProgramsOverlay } from './programs';
import { TechOverlay } from './tech';
import { ConsoleOverlay } from './console';
import { LorePanel } from './lorePanel';
import type { Level } from '../../lore/index';
import type { GameContext } from '../../game/console';
import { budgetScale } from '../../game/modes';
import { branchSurvives, earliestEnd, forkMultiverse, resolveBranch, survivalFraction, tickMultiverse, wormhole, type Branch, type Multiverse } from '../../game/multiverse';
import { ambientPeel, glitchPass, peelPass } from '../glitch';
import { drawMiniSystem } from '../miniSystem';
import { CAMERA_PITCHES, polyhedron, tilt, type Camera } from '../camera3d';
import { Materialize, StarField } from '../wire';
import { ROLE_STYLE } from '../palettes';
import type { UiSfx } from '../../audio/ui';
import { voiceForEvents } from '../../audio/voice';
import { advanceTutorial, createTutorial, stepsOf, TUTORIAL_SEED, TUTORIAL_SEEN_KEY, type TutorialFacts, type TutorialState } from '../../game/tutorial';
import { saveJson } from '../../game/persistence';
import { AUTO_SPEED_LEVELS, DEFAULT_SETTINGS, saveSettings, type Settings } from '../../game/settings';
import { scenarioById, spawnScenario } from '../../sim/scenarios';
import { shiftEpoch } from '../../sim/roundGen';
import { craftPosition } from '../../planner/legs';
import { hashSeed, Rng } from '../../sim/rng';
import { applyEffects, createPrograms, programById, syncPrograms } from '../../sim/programs';
import { advanceCivilization } from '../../game/civ';
import { modeIndex } from '../../game/modes';
import { stateToElements as toElements } from '../../physics/elements';
import { sphereMass } from '../../physics/closeApproach';
import { boardFor } from '../../game/modes';
import { advancePrograms } from '../../sim/programs';
import { exportSave, renderAfterRound, renderSave, storeSave } from '../../game/savegame';
import { Teletype } from './teletype';
import { Cinematics } from '../cinematics/index';
import type { CineContext } from '../cinematics/scene';
import { ANOMALY_LINES, anomalyFor, operatorNote, type Anomaly } from '../../game/fiction';
import { cloudNarrative, debriefNarrative, evacuateNarrative, eventNarrative, lessonFor, roundStartNarrative } from '../../game/narrative';
import { craftRemaining, WarpDown } from '../../game/warpDown';
import { pickTip } from '../../game/tips';
import type { SimEventRecord } from '../../sim/eventLog';

export type ScaleMode = 'LINEAR' | 'COMPRESSED';
type Phase = 'planning' | 'debrief' | 'over';

export class SystemScreen implements Screen {
  world: World;
  run: RunState;
  missions: Mission[] = [];
  result: RoundResult | null = null;
  phase: Phase = 'planning';
  scale: ScaleMode = 'COMPRESSED';
  private score: ScoreBreakdown | null = null;
  /** The same round with no missions (programs still act): the debrief's "without you" line. */
  private counterfactual: { outcome: string; margin: number } | null = null;
  private rank = -1;
  private zoom = 1;
  private panX = 0;
  private panY = 0;
  private readonly orbitCache = new Map<string, Float64Array>();
  private threatOrbitCache: { el: Elements; pts: Float64Array } | null = null;
  private readonly craftCache = new Map<string, Elements>();
  private ghost: { x: number; y: number } | null = null;
  private readonly client = sharedPlanner();
  private readonly planner: PlannerOverlay;
  private readonly planet: PlanetOverlay;
  private readonly programs: ProgramsOverlay;
  /** SKY view (K): coverage by direction and the threat's track across the sky. */
  private readonly sky: SkyOverlay;
  private readonly tech: TechOverlay;
  private planetOpen = false;
  private noteText = '';
  private noteT = 0;
  rulesPreset = 'DEFAULT';
  private scrub = 0;
  private panelHidden = false;
  /** Top of the last centred panel (debrief / RUN OVER), for layout. */
  private panelTop = Infinity;
  private readonly console: ConsoleOverlay;
  /** A run prepared on the title with codes, used by the next NEW RUN. */
  pendingRun: RunState | null = null;
  private mv: Multiverse | null = null;
  private glitch = false;
  /** AUTOPLAY (IDEAS 19): the autopilot, whether this run started from the title (no saves), and the pane up now. */
  autoplayNext = false;
  /** SUPER-DUPER-DEMO (IDEAS 20): AUTOPLAY that speeds up every game, then hands over to the montage. */
  demoNext = false;
  private auto: Autopilot | null = null;
  private autoFresh = false;
  private autoPane: { pane: Pane; t: number } | null = null;
  /** Detection gauge (backlog 9): computed in the worker whenever the network set or the calendar year changes. */
  private gauge: GaugeReading | null = null;
  private gaugeKey = '';
  /** TUTORIAL on the title: the next NEW RUN is the guided round (GAME_PLAN 25). */
  tutorialNext = false;
  private tut: TutorialState | null = null;
  private tutSeen = { maxWarp: 0, plannerOpened: false, planetOpened: false, programsOpened: false };
  private mc: MonteCarloResult | null = null;
  private mcToken = 0;

  private readonly lore: LorePanel;
  private readonly stars = new StarField();
  private readonly cam: Camera = { pitch: 0, focal: 900 };
  private pitchIdx = 0;
  private readonly mat = new Materialize();
  private matPhase: Phase = 'planning';
  /** GAME_PLAN 29: briefs that type themselves in, event cinematics, and the once-per-arrival warp-down. */
  private readonly tele: Teletype;
  private readonly cine: Cinematics;
  private warpDown = new WarpDown();
  /** The close approach passed while its cinematic plays: finish the round when the scene ends. */
  private pendingFinish = false;
  /** GAME_PLAN 30 fiction props for this round: the detour sign's time and place, Planet X, one ticket per round. */
  private detourAt: { t: number; x: number; y: number } | null = null;
  private nibiru = false;
  private ticketFiled = false;
  /** PEEL: until this real time (ms) a big flap shows the raw state. */
  private peelUntil = 0;
  /** BOOTSTRAP: the next commit is free. */
  private freeNext = false;
  /** Last operator bulletin slot shown (SIMULATION ambience). */
  private opSlot = -1;
  /** SIMULATION anomaly of this round, or null. */
  private anomaly: Anomaly | null = null;
  /** Click-to-learn (IDEAS 8): regions registered by this frame's draw calls, topmost last. */
  private hits: { x: number; y: number; w: number; h: number; topic: string; label: string }[] = [];
  private hit(x: number, y: number, w: number, h: number, topic: string, label: string): void {
    this.hits.push({ x, y, w, h, topic, label });
  }
  private hitAt(px: number, py: number): { topic: string; label: string } | null {
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const h = this.hits[i];
      if (h && px >= h.x && px <= h.x + h.w && py >= h.y && py <= h.y + h.h) return h;
    }
    return null;
  }
  private approachSounded = false;
  /** IDEAS 21: "IMPACT IMMINENT" is said once per round. */
  private imminentSaid = false;

  constructor(private readonly s: Surface, private readonly keys: Input, private readonly router: Router, private readonly settings: Settings = DEFAULT_SETTINGS, private readonly sfx: UiSfx | null = null, openCenter: ((id: string, level: Level) => void) | null = null) {
    this.lore = new LorePanel(s, keys);
    this.lore.onCenter = openCenter;
    this.world = createWorld('DEV', 1);
    this.run = createRun('DEV');
    this.planner = new PlannerOverlay(s, keys, this.client);
    this.planet = new PlanetOverlay(s);
    this.programs = new ProgramsOverlay(s, keys);
    this.sky = new SkyOverlay(s, keys);
    this.tech = new TechOverlay(s, keys);
    this.console = new ConsoleOverlay(s, keys);
    this.tele = new Teletype(s);
    const toCenter = (id: string): void => {
      setWarp(this.world, 0);
      openCenter?.(id, this.settings.learningLevel as Level);
    };
    this.tech.openLore = toCenter;
    this.programs.openLore = toCenter;
    this.planner.openLore = toCenter;
    for (const o of [this.planner, this.programs, this.tech, this.sky]) o.still = () => this.settings.reduceMotion;
    this.cine = new Cinematics(s, () => this.settings.reduceMotion);
    this.demoCut = new DemoCutaways(sfx, () => this.settings.reduceMotion);
    this.cine.onHit = (sc) => {
      if (!this.sfx) return;
      if (sc.kind === 'LAUNCH') this.sfx.launch();
      else if (sc.kind === 'IMPACT') this.sfx.impact();
      else if (sc.kind === 'CLOSE_APPROACH') {
        this.sfx.approach(sc.approach?.impact ?? false);
        this.approachSounded = true;
      } else this.sfx.breakup();
    };
  }

  /** Begin a run from a loaded run state (CONTINUE). */
  resume(run: RunState): void {
    this.run = run;
    this.startRound();
  }

  /** Tracking tier: the best of researched tracking, radar programs, and a radar network within range (6.14). */
  /** Resolver options for this run: tracking tier plus the SCI-FI standing capabilities (20.3). */
  private resolveOpts(): ResolveOpts {
    const tier = this.trackingTier();
    const done = (id: string): number | null => this.run.programs.find((p) => p.id === id)?.completedAt ?? null;
    // The DART replay uses the beta DART measured (3.6), so the push matches the real one.
    const beta = this.tut?.script === 'DART' ? { betaOverride: 3.6 } : {};
    const scifiMode = this.run.mode !== 'REALISTIC';
    // REALISTIC programs with standing effects (GROUND_LASER) act in every mode; the SPECULATIVE ones only
    // outside REALISTIC (a run that entered SCI-FI keeps them; GAME_PLAN 21 nesting).
    return {
      ...beta,
      trackingTier: tier,
      scifi: {
        orbitalLaserW: scifiMode ? this.run.effects.orbitalLaserW : 0,
        laserSince: scifiMode ? done('ORBITAL_LASER_ARRAY') : null,
        disassemblerTauYears: scifiMode ? this.run.effects.disassemblerTauYears : 0,
        disassemblerSince: scifiMode ? done('DISASSEMBLER_SWARM') : null,
        netTier: scifiMode ? this.run.netTier : 0,
        nanoforgeSince: scifiMode ? done('NANOFORGE_SEEDS') : null,
        thrusterSwarmSince: scifiMode ? done('THRUSTER_SWARM') : null,
        shepherdSince: scifiMode ? done('SHEPHERD_NETWORK') : null,
        // A fusion line won by a feasibility study pushes in REALISTIC too, from the study's success.
        fusionTugN: scifiMode ? Math.max(this.run.effects.fusionTugN, this.run.effects.studyFusionTugN) : this.run.effects.studyFusionTugN,
        fusionTugSince: scifiMode && done('FUSION_TUG_FLEET') !== null ? done('FUSION_TUG_FLEET') : this.studyFusionSince(),
        groundLaserSince: this.run.effects.groundLaser ? done('GROUND_LASER') : null,
        sailDepot: scifiMode ? this.run.effects.sailDepot : 0,
        sailDepotSince: scifiMode ? done('SAIL_SWARM_DEPOT') : null,
        seedFleetSince: scifiMode ? done('SEED_FLEET') : null,
        picketSince: scifiMode ? done('L4_L5_PICKET') : null,
        kitsSince: scifiMode ? done('SAIL_KITS') : null,
      },
    };
  }

  /** What AUTOPLAY could buy at the debrief: the cheapest unlockable tech and the next program in its list. */
  private autoInvestView(): NonNullable<AutoView['invest']> {
    const mode = modeIndex(this.run.mode) >= 1 ? 'SCIFI' : 'REALISTIC';
    const tech = chooseTech(TECH.map((n) => ({ id: n.id, name: n.name, track: n.track, cost: n.cost, ok: canUnlock(this.run, n.id, mode) === 'OK' })));
    const program = chooseProgram(this.run.programs.map((ps) => {
      const def = programById(ps.id);
      return { id: ps.id, name: def.name, costPerYear: def.costPerYear, funded: ps.funding > 0, done: ps.completedAt !== null };
    }), budgetAt(this.run.economy, this.world.t), this.run.economy.perYear);
    return { tech, program };
  }

  /** EXPERIMENTAL studies are offered with OPTIONS > EXPERIMENTAL TECH, or in any SCI-FI-or-above run. */
  private experimental(): boolean {
    return this.settings.experimental === true || this.run.mode !== 'REALISTIC';
  }

  /** Earliest end time of a succeeded study that grants fusion tugs, or null. */
  private studyFusionSince(): number | null {
    let best: number | null = null;
    for (const st of this.run.studies) {
      if (st.status !== 'SUCCEEDED' || st.endedAt === null) continue;
      if (!studyById(st.id).effects.some((e) => e.kind === 'STUDY_FUSION_TUGS')) continue;
      if (best === null || st.endedAt < best) best = st.endedAt;
    }
    return best;
  }

  private trackingTier(): number {
    // PRECURSOR_FLEET (19): a reconnaissance probe at discovery measures density, spin and the beta range,
    // which the game models as at least tracking tier 1 (beta revealed sooner after an impact).
    return this.run.sandbox ? 2 : Math.max(this.run.trackingTier, this.run.effects.trackingTier, this.run.effects.precursor ? 1 : 0);
  }

  private note(text: string, seconds = 3): void {
    this.noteText = text;
    this.noteT = seconds;
  }

  /** Monte Carlo for the committed mission set, shown in the brief. */
  private requestMc(): void {
    const token = ++this.mcToken;
    this.mc = null;
    if (this.missions.length === 0) return;
    this.client
      .monteCarlo(this.world, this.missions, KNOBS.MC_SAMPLES)
      .then((r) => {
        if (token === this.mcToken) this.mc = r;
      })
      .catch(() => undefined);
  }

  enter(): void {
    // AUTOPLAY from the title watches a fresh run that never touches the save or the leaderboard.
    this.auto = this.autoplayNext || this.demoNext ? new Autopilot() : null;
    this.demoT = 0;
    this.demoCut.reset();
    if (this.auto) {
      this.auto.demo = this.demoNext;
      this.sfx?.voice.say('AUTOPLAY', true);
    }
    this.autoFresh = this.autoplayNext || this.demoNext;
    this.autoplayNext = false;
    this.demoNext = false;
    this.autoPane = null;
    this.newRun();
  }
  exit(): void {
    this.planner.hide();
  }

  private newRun(): void {
    if (this.tutorialNext) {
      this.run = createRun(TUTORIAL_SEED, { tutorial: true });
      this.run.spawnNext = 'TUTORIAL';
      this.tut = createTutorial();
      saveJson(TUTORIAL_SEEN_KEY, true);
    } else {
      this.run = this.pendingRun ?? createRun(Date.now().toString(36).toUpperCase(), { sandbox: this.sandboxNext });
      this.tut = null;
    }
    this.tutorialNext = false;
    this.pendingRun = null;
    this.sandboxNext = false;
    this.startRound();
  }

  /** Feed the tutorial script what the player has done; Tab skips it. */
  private trackTutorial(dtMs: number): void {
    const t = this.tut;
    if (!t) return;
    const w = this.world;
    const seen = this.tutSeen;
    seen.maxWarp = Math.max(seen.maxWarp, w.warp);
    if (this.planner.isOpen) seen.plannerOpened = true;
    if (this.planetOpen) seen.planetOpened = true;
    if (this.programs.isOpen) seen.programsOpened = true;
    if (this.keys.pressed('Tab') && !this.planner.isOpen) {
      this.tut = null;
      this.note('TUTORIAL SKIPPED. ? OPENS THE MANUAL ANY TIME.', 4);
      return;
    }
    const facts: TutorialFacts = {
      warp: w.warp,
      maxWarp: seen.maxWarp,
      plannerOpen: this.planner.isOpen,
      plannerOpened: seen.plannerOpened,
      missions: this.missions.length,
      launched: this.missions.some((m) => m.launchTime <= w.t),
      impacted: (this.result?.events ?? []).some((e) => (e.kind === 'IMPACT' || e.kind === 'FRAGMENTATION' || e.kind === 'IMPACT_MISS') && e.t <= w.t),
      planetOpened: seen.planetOpened,
      debrief: this.phase !== 'planning',
      programsOpened: seen.programsOpened,
    };
    advanceTutorial(t, facts, dtMs / 1000);
  }

  private drawTutorial(): void {
    const t = this.tut;
    if (!t) return;
    const steps = stepsOf(t);
    const step = steps[t.step];
    if (!step) return;
    const s = this.s;
    const p = s.palette;
    const w = Math.min(700, s.width - 32);
    const x = s.width - w - 16;
    const y = 96;
    const inner = w - 24;
    // Re-wrap the step text to the panel's width at draw time (TEXT SIZE and window width both change it).
    const body = wrapText(step.lines.join(' '), inner, 9);
    const lineH = 15 * getTextScale();
    const h = 58 + body.length * lineH;
    // At the debrief or RUN OVER the centred panel comes first: the tutorial box only draws if it fits above it.
    if (this.phase !== 'planning' && !this.panelHidden && y + h > this.panelTop - 8) return;
    const alpha = Math.min(1, t.shownFor * 2);
    s.stroke([x, y, x + w, y, x + w, y + h, x, y + h], { closed: true, color: p.hot, glow: 0.8, alpha });
    drawTextFit(s, `${t.script === 'DART' ? 'DART REPLAY' : 'TUTORIAL'} ${t.step + 1} / ${steps.length}   ${step.title}`, x + 12, y + 10, 12, inner, { color: p.hot, glow: 1, alpha });
    let ly = y + 32;
    for (const line of body) {
      drawText(s, line, x + 12, ly, 9, { color: p.ink, glow: 0.3, alpha });
      ly += lineH;
    }
    drawTextFit(s, `<TAB> SKIP TUTORIAL   <?> LORE ${step.lore.join(' ')}   <${keyName('LEARN')}> LEARNING CENTER   <${keyName('MANUAL')}> MANUAL`, x + 12, y + h - 16, 9, inner, { color: p.ink, glow: 0.3, alpha });
  }

  /** The next NEW RUN is a sandbox (set by the title before routing here). */
  sandboxNext = false;

  private startRound(): void {
    const { seed, round } = this.run;
    this.world = createWorld(seed, round);
    // The run's networks (programs may have added some) drive discovery; the world keeps the live copy.
    if (this.run.networks.active.length === 0) this.run.networks = { active: [...this.world.networks.active], since: {} };
    this.world.networks = this.run.networks;
    // Programs the current mode allows (SCI-FI adds its own when the mode is entered by code or by level).
    syncPrograms(this.run.programs, modeIndex(this.run.mode) >= 1 ? 'SCIFI' : 'REALISTIC');
    // SIMULATION anomalies (GAME_PLAN 30): a LOOPED round redraws the previous round's threat.
    const fictionMode = this.run.mode === 'SIMULATION' || this.run.mode === 'MULTIVERSE';
    this.anomaly = fictionMode ? anomalyFor(seed, round) : null;
    const rng = roundRng(seed, this.anomaly === 'LOOPED' ? round - 1 : round);
    // A DART replay lasts one round.
    if (this.tut?.script === 'DART') this.tut = null;
    if (this.run.spawnNext) {
      // The DART code's round is the guided DART replay (IDEAS 15).
      if (this.run.spawnNext === 'DIDYMOS' && this.run.cheatsUsed.includes('DART')) this.tut = createTutorial('DART');
      const sc = scenarioById(this.run.spawnNext);
      this.world.threat = sc ? spawnScenario(sc, this.world, rng) : generateThreat(rng, this.world, round);
      this.run.spawnNext = null;
    } else if (this.run.leadTimeNext !== null) {
      // LEADTIME n: the plain draw with the lead forced (the clock starts now).
      const th = generateThreat(rng, this.world, round, 0, { skipDiscovery: true, scifi: this.run.mode !== 'REALISTIC', scifiVisitorShare: KNOBS.SCIFI_VISITOR_SHARES[this.settings.scifiVisitors ?? 'RARE'] });
      // Re-time: keep the geometry, move the impact epoch by shifting the epoch of everything (world.t is 0 here).
      const shift = th.tImpact - this.run.leadTimeNext * YEAR;
      for (const p of this.world.planets) (p as { elements: typeof p.elements }).elements = shiftEpoch(p.elements, shift);
      this.world.threat = { ...th, elements: shiftEpoch(th.elements, shift), tImpact: th.tImpact - shift };
      this.run.leadTimeNext = null;
    } else {
      // OPTIONS INTERSTELLAR RATE: REALISTIC rounds may bring a visitor from another star (its own seeded stream).
      const rate = KNOBS.INTERSTELLAR_RATES[this.settings.interstellarRate ?? 'REAL'];
      if (this.run.mode === 'REALISTIC' && (this.settings.interstellarRate ?? 'REAL') !== 'REAL' && !this.run.tutorial) this.run.exaggerated = true;
      this.world.threat = generateThreat(rng, this.world, round, 0, { scifi: this.run.mode !== 'REALISTIC', interstellarRate: this.run.tutorial ? 0 : rate, runSeed: this.run.seed, scifiVisitorShare: KNOBS.SCIFI_VISITOR_SHARES[this.settings.scifiVisitors ?? 'RARE'], sites: this.run.tutorial ? [] : (this.run.effects.sites as TargetId[]) });
    }
    if (this.run.mode !== 'REALISTIC' && this.run.economy.perYear < KNOBS.BUDGET_PER_YEAR * budgetScale(this.run.mode)) {
      // SCI-FI and beyond: budget scale x10 (21.2), applied once.
      this.run.economy.perYear *= budgetScale(this.run.mode);
      this.run.economy.start *= budgetScale(this.run.mode);
    }
    if (this.anomaly === 'MIRRORED' && this.world.threat) this.world.threat = { ...this.world.threat, name: this.world.threat.name.split('').reverse().join('') };
    if (this.anomaly === 'UNSTABLE_G') {
      const f = 1 + (hashSeed(`${seed}#g#${round}`) % 2 === 0 ? 0.03 : -0.03);
      (this.world as { star: { mu: number } }).star = { ...this.world.star, mu: this.world.star.mu * f };
    }
    this.mv = null;
    this.glitch = this.run.mode === 'SIMULATION' || this.run.mode === 'MULTIVERSE';
    this.run.evacuatedAt = null;
    this.tutSeen = { maxWarp: 0, plannerOpened: false, planetOpened: false, programsOpened: false };
    // The round-boundary save: mirrored for CONTINUE (real runs only) and kept for EXPORT (any run).
    this.boundarySave = renderSave(this.run, this.world);
    if (!this.run.tutorial && !this.autoFresh) storeSave(this.boundarySave);
    this.missions = [];
    this.result = resolveRound(this.world, this.missions, this.resolveOpts());
    this.requestMc();
    this.planetOpen = false;
    this.phase = 'planning';
    this.score = null;
    this.rank = -1;
    this.orbitCache.clear();
    this.threatOrbitCache = null;
    this.craftCache.clear();
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    // Where the target will be at impact (HOME, or the site this rock is aimed at).
    const hs = targetOf(this.world, this.world.threat.targetId).state(this.world.threat.tImpact);
    this.ghost = { x: hs.r.x, y: hs.r.y };
    this.warpDown = new WarpDown();
    this.cine.clear();
    this.tele.clear();
    this.pendingFinish = false;
    this.approachSounded = false;
    this.imminentSaid = false;
    this.sfx?.voice.say('ROUND_START', true, 'THREAT_DETECTED');
    this.detourAt = null;
    this.nibiru = false;
    this.ticketFiled = false;
    // The tutorial round starts paused (step 1 asks for SPACE) and its first step already explains the brief.
    if (this.tut) setWarp(this.world, 0);
    if (this.run.tutorial || this.tut?.script === 'DART') {
      // guided rounds explain the brief in their first step
    } else if (this.result) this.tele.push(roundStartNarrative(this.world.threat, this.result, this.world, this.sunwardActive()));
    if (this.anomaly) this.tele.push({ header: { text: `ANOMALY: ${this.anomaly.replace('_', ' ')}`, role: 'program' }, lines: [{ text: ANOMALY_LINES[this.anomaly], role: 'text' }] });
  }

  private sunwardActive(): boolean {
    return this.run.networks.active.includes('SUNWARD_SENTINEL');
  }

  private cineContext(passed: readonly SimEventRecord[]): CineContext | null {
    const th = this.world.threat;
    const res = this.result;
    if (!th || !res) return null;
    const betaHidden = !this.run.reveal && passed.some((e) => e.kind === 'IMPACT' && e.betaKnownAt !== undefined && this.world.t < e.betaKnownAt);
    return { name: th.name, typeId: th.type.id, D: th.D, shape: th.shape, betaHidden, energyMt: res.energy.energyMt };
  }

  /** Events whose time passed this frame: a brief each, and a cinematic for the kinds that have one. */
  private onEventsPassed(passed: readonly SimEventRecord[]): void {
    const th = this.world.threat;
    if (!th || passed.length === 0) return;
    if (this.mv) {
      // MULTIVERSE tiles share the clock; the sound cues stand in for the scenes.
      for (const e of passed) {
        if (e.kind === 'LAUNCH') this.sfx?.launch();
        else if (e.kind === 'IMPACT') this.sfx?.impact();
        else if (e.kind === 'FRAGMENTATION' || e.kind === 'NUKE' || e.kind === 'PI') this.sfx?.breakup();
      }
      return;
    }
    const line = voiceForEvents(passed);
    if (line) this.sfx?.voice.say(line);
    const cas = passed.filter((e): e is Extract<SimEventRecord, { kind: 'CLOSE_APPROACH' }> => e.kind === 'CLOSE_APPROACH');
    for (const e of passed) {
      if (e.kind === 'CLOSE_APPROACH' && cas.length > 1) continue;
      const n = eventNarrative(e, { threat: th, now: this.run.reveal ? undefined : this.world.t });
      if (n) this.tele.push(n);
    }
    if (cas.length > 1) {
      const n = cloudNarrative(cas, th);
      if (n) this.tele.push(n);
    }
    const ctx = this.cineContext(passed);
    if (ctx) this.cine.enqueue(passed, ctx);
  }

  private plannerSession() {
    const branch = this.mv ? this.mv.branches[this.mv.selected] ?? null : null;
    const world = branch ? branch.world : this.world;
    const missions = branch ? branch.missions : this.missions;
    const result = branch ? branch.result : this.result;
    if (!result) throw new Error('no result');
    return {
      world,
      missions,
      result,
      // HEAVY_LAUNCH_CADENCE unlocks the Tier 3 launcher without the tech node (GAME_PLAN 19).
      launcherTier: Math.max(this.run.launcherTier, this.run.effects.launcherTierUnlock),
      impactorTier: this.run.impactorTier,
      navTier: this.run.navTier,
      sailTier: this.run.sailTier,
      warheadTier: this.run.warheadTier,
      slowPushTier: this.run.slowPushTier,
      swarmTier: this.run.swarmTier,
      autonomyTier: this.run.autonomyTier,
      rulesPreset: this.rulesPreset,
      pi: this.run.pi,
      dsmBudget: KNOBS.DSM_BUDGET[this.run.propulsionTier - 1] ?? 0,
      // A craft on standby needs no build time against a visitor from another star (INTERCEPTOR_ON_STANDBY).
      buildTime: this.run.effects.standbyInterceptor && this.world.threat?.flavor === 'INTERSTELLAR' ? 0 : this.run.effects.buildTimeYears * YEAR,
      c3Bonus: this.run.effects.c3Bonus + this.run.effects.lunarDriverC3,
      launchCap: this.run.effects.launchCap,
      budget: budgetAt(this.run.economy, this.world.t),
      onCommit: (ms: Mission[]): boolean => {
        // Launch cadence (19): at most launchCap launches within any 365-day window (2 at start, 6 with HEAVY_LAUNCH_CADENCE).
        const cap = this.run.effects.launchCap;
        const all = [...missions, ...ms].filter((m) => m.archetype !== 'SLOW_PUSH' || m.launchTime > this.world.t);
        for (const m of ms) {
          const near = all.filter((o) => Math.abs(o.launchTime - m.launchTime) < YEAR / 2).length;
          if (near > cap) {
            this.note(`LAUNCH CADENCE: ${cap} LAUNCHES PER YEAR. FUND HEAVY LAUNCH CADENCE (G) OR PICK ANOTHER WINDOW.`, 5);
            return false;
          }
        }
        const cost = this.freeNext ? 0 : ms.reduce((a, m) => a + m.cost, 0);
        if (!spend(this.run.economy, this.world.t, cost)) return false;
        if (this.freeNext) {
          this.freeNext = false;
          this.note('BOOTSTRAP: THIS ONE WAS ALWAYS PAID FOR.', 4);
        }
        this.sfx?.commit();
        this.sfx?.voice.say('PLAN_COMMITTED', true, ms.some((m) => m.launchTime > this.world.t) ? 'BUILDING' : undefined);
        if (branch) {
          branch.missions.push(...ms);
          resolveBranch(branch, this.resolveOpts());
        } else {
          this.missions.push(...ms);
          this.result = resolveRound(this.world, this.missions, this.resolveOpts());
          this.requestMc();
        }
        this.planner.refresh(this.plannerSession());
        return true;
      },
    };
  }

  private finishRound(): void {
    const res0 = this.result;
    const th = this.world.threat;
    if (!res0 || !th) return;
    let res = res0;
    if (this.mv) {
      // MULTIVERSE: the round ends with the survival fraction; COLLAPSE (C) picked the main timeline already.
      const sel = this.mv.branches[this.mv.selected];
      if (sel) {
        res = sel.result;
        this.result = res;
        this.missions = sel.missions;
        this.note(`MULTIVERSE: ${(survivalFraction(this.mv) * 100).toFixed(0)}% OF BRANCHES SURVIVED. TIMELINE ${sel.index + 1} IS NOW THE MAIN ONE.`, 6);
      }
      this.mv = null;
    }
    this.world.t = res.ca.tCa;
    setWarp(this.world, 0);
    try {
      const cf = this.missions.length > 0 ? resolveRound(this.world, [], this.resolveOpts()) : null;
      this.counterfactual = cf ? { outcome: cf.outcome, margin: cf.ca.marginRadii } : null;
    } catch {
      this.counterfactual = null;
    }
    if (this.run.noclip && res.outcome === 'HIT') {
      // NOCLIP: HOME is non-colliding this round; the resolver's numbers stand, the outcome is a miss. NOTE: `res`
      // itself becomes the miss, before anything reads its outcome: scoring, the run-over decision and the history
      // all used the HIT copy, so the cheat ended the run anyway (code review 2026-10-18).
      res = { ...res, outcome: 'MISS' };
      this.result = res;
    }
    const available = this.run.economy.start + (this.run.economy.perYear * this.world.t) / YEAR;
    // Civil defense (18.6): an evacuated AIRBURST/CITY hit ordered early enough scores as PARTIAL x0.25 and the run continues.
    const evacOk = this.run.evacuatedAt !== null && th.tImpact - this.run.evacuatedAt >= this.run.effects.evacMinDays * DAY;
    // A guided DART replay is practice: a hit there scores like a survived partial and the run continues.
    // IDEAS 26: a rock that hits a site (not HOME) destroys the site; HOME is safe and the run goes on.
    const siteLost = res.outcome === 'HIT' && th.targetId !== undefined && th.targetId !== 'HOME' && !this.run.shield;
    const survivable = siteLost || (res.outcome === 'HIT' && evacOk && (res.category === 'AIRBURST' || res.category === 'CITY')) || (res.outcome === 'HIT' && this.run.shield) || (res.outcome === 'HIT' && (this.tut?.script === 'DART' || this.run.tutorial));
    this.score = scoreRound({
      round: this.run.round,
      energyMt: res.energy.energyMt,
      outcome: survivable ? 'PARTIAL' : res.outcome,
      marginRadii: res.ca.marginRadii,
      budgetUnspent: budgetAt(this.run.economy, this.world.t),
      budgetAvailable: available,
      marginSeconds: th.tImpact - (res.tLastAction || 0),
      leadSeconds: th.tImpact,
      usedWarhead: res.usedWarhead,
      producedFragments: res.producedFragments,
      netCapture: false,
    });
    this.scrub = Math.max(0, res.events.length - 1);
    this.panelHidden = false;
    if (survivable) this.score = { ...this.score, roundScore: Math.round(this.score.roundScore * KNOBS.EVACUATED_HIT_SCORE_MULT), research: Math.floor((this.score.roundScore * KNOBS.EVACUATED_HIT_SCORE_MULT) / 50) };
    const finalOutcome = survivable ? 'PARTIAL' : res.outcome;
    if (siteLost && th.targetId) this.loseSite(th.targetId);
    if (!this.approachSounded) this.sfx?.approach(finalOutcome === 'HIT');
    this.sfx?.voice.say(finalOutcome === 'HIT' ? 'HIT' : finalOutcome === 'PARTIAL' ? 'PARTIAL' : 'MISS', true, finalOutcome === 'HIT' ? 'GAME_OVER' : undefined);
    const plan = this.missions.length === 0 ? (this.run.evacuatedAt !== null ? 'EVACUATE' : 'NONE') : [...new Set(this.missions.map((m) => m.archetype))].join('+') + (this.run.evacuatedAt !== null ? '+EVAC' : '');
    this.run.history.push({ round: this.run.round, threat: th.name, type: th.type.id, D: th.D, lead: th.tImpact / YEAR, by: th.discoveredBy ?? 'NONE', plan, outcome: finalOutcome === 'MISS' ? `MISS ${res.ca.marginRadii.toFixed(1)} R` : finalOutcome, score: finalOutcome === 'HIT' ? 0 : this.score.roundScore });
    this.cine.clear();
    this.tele.clear();
    this.tele.push(
      debriefNarrative({
        round: this.run.round,
        outcome: finalOutcome,
        marginRadii: res.ca.marginRadii,
        throughMt: res.hitEnergyMt,
        energyMt: res.energy.energyMt,
        category: res.category,
        plan,
        nEvents: res.events.length,
        score: this.score.roundScore,
        research: this.score.research,
        lesson: lessonFor(th, this.sunwardActive()),
      }),
      true,
    );
    const civ = finalOutcome !== 'HIT' ? advanceCivilization(this.run) : null;
    if (civ) this.note(civ, 8);
    if (finalOutcome !== 'HIT') {
      this.run.score += Math.round(this.score.roundScore * this.run.effects.researchMult) === this.score.roundScore ? this.score.roundScore : this.score.roundScore;
      this.run.research += Math.floor(this.score.research * this.run.effects.researchMult);
      this.phase = 'debrief';
      this.boundarySave = renderAfterRound(this.run, budgetAt(this.run.economy, this.world.t));
      if (!this.run.tutorial && !this.autoFresh) storeSave(this.boundarySave);
    } else {
      this.phase = 'over';
      this.rank = this.run.sandbox || this.run.tutorial || this.autoFresh ? -1 : recordRun({ handle: 'PLAYER', rounds: this.run.roundsSurvived, score: this.run.score, seed: this.run.seed, date: this.run.startedAt, tech: `L${this.run.launcherTier} I${this.run.impactorTier}`, assisted: this.run.assisted, ...(this.run.exaggerated ? { exaggerated: true } : {}) }, boardFor(this.run.mode));
    }
  }

  update(dtMs: number): void {
    const k = this.keys;
    const w = this.world;
    this.updateAutoplay(dtMs);
    if (this.programs.isOpen || this.phase !== 'planning') this.refreshGauge();
    this.trackTutorial(dtMs);
    if (this.cine.isOpen) {
      // The clock does not advance while a scene plays; any key skips it (GAME_PLAN 29).
      this.cine.update(dtMs, k.anyKeyPressed());
      if (!this.cine.isOpen && this.pendingFinish) {
        this.pendingFinish = false;
        this.finishRound();
      }
      return;
    }
    if (this.tele.isOpen) {
      const modal = this.tele.isModal;
      if (k.anyKeyPressed()) this.tele.key();
      this.tele.update(dtMs);
      if (modal) return;
    }
    if (this.planner.isOpen) {
      this.planner.update();
      return;
    }
    // The console takes every key while open (typing L, ? or Esc must not leave the screen).
    if (this.console.isOpen) {
      this.console.update(this.gameContext());
      return;
    }
    // Esc closes the open overlay first (each overlay handles its own Esc); only the bare map leaves for the title.
    if (k.pressed('Escape') && !this.lore.isOpen && !this.programs.isOpen && !this.tech.isOpen && !this.sky.isOpen && !this.planetOpen) {
      this.router.go('title');
      return;
    }
    if (k.pressed('Escape') && this.planetOpen && !this.lore.isOpen && !this.programs.isOpen && !this.tech.isOpen && !this.sky.isOpen) {
      this.planetOpen = false;
      return;
    }
    if (this.lore.isOpen) {
      this.lore.update();
      return;
    }
    // Click-to-learn (IDEAS 8): a click on a body, a craft or a HUD readout opens its lore topic.
    // Overlays (programs, tech, planet view) take their own clicks; only the bare map is clickable here.
    const click = !this.planetOpen && !this.programs.isOpen && !this.tech.isOpen ? k.takeClick() : null;
    if (click) {
      const h = this.hitAt(click.x, click.y);
      if (h && h.topic === 'HELP') {
        this.router.go('help');
        return;
      }
      if (h) {
        setWarp(w, 0);
        this.lore.show(h.topic, this.settings.learningLevel as Level);
        return;
      }
    }
    if (k.pressed('Slash')) {
      // The lore panel opens on what the player is looking at (GAME_PLAN 23 entry points).
      setWarp(w, 0);
      this.lore.show(this.contextTopic(), this.settings.learningLevel as Level);
      return;
    }
    if (k.pressed('KeyL') && this.lore.onCenter) {
      setWarp(w, 0);
      this.lore.onCenter(this.contextTopic(), this.settings.learningLevel as Level);
      return;
    }
    if (k.pressed('KeyM')) {
      this.router.go('help');
      return;
    }
    if (k.pressed('Backquote')) {
      setWarp(w, 0);
      this.console.show();
      return;
    }
    if (this.mv && this.phase === 'planning') {
      for (let d = 1; d <= 9; d++) if (k.pressed(`Digit${d}`) && d <= this.mv.branches.length) this.mv.selected = d - 1;
      if (k.pressed('KeyC')) {
        const sel = this.mv.branches[this.mv.selected];
        if (sel) {
          this.world = sel.world;
          this.missions = sel.missions;
          this.result = sel.result;
          this.note(`COLLAPSE: BRANCH ${sel.index + 1} IS THE MAIN TIMELINE.`, 4);
          this.mv = null;
        }
      }
    }
    if (this.programs.isOpen) {
      const funded = this.run.programs.filter((p) => p.funding > 0).length;
      this.programs.update(this.run, this.experimental());
      if (this.run.programs.filter((p) => p.funding > 0).length > funded) this.sfx?.voice.say('PROGRAM_FUNDED');
      return;
    }
    if (this.sky.isOpen) {
      this.sky.update();
      return;
    }
    if (this.tech.isOpen) {
      const research = this.run.research;
      this.tech.update(this.run);
      if (this.run.research < research) this.sfx?.voice.say('RESEARCHING', true);
      return;
    }
    if (this.phase === 'debrief' || this.phase === 'over') {
      // Timeline scrubber (GAME_PLAN 11): Left/Right step the clock through the event log; the map replays.
      const evs = this.result?.events ?? [];
      if (k.pressed('ArrowLeft') && evs.length > 0) {
        this.scrub = Math.max(0, this.scrub - 1);
        w.t = evs[this.scrub]?.t ?? w.t;
      }
      if (k.pressed('ArrowRight') && evs.length > 0) {
        this.scrub = Math.min(evs.length - 1, this.scrub + 1);
        w.t = evs[this.scrub]?.t ?? w.t;
      }
      if (k.pressed('KeyV')) this.planetOpen = !this.planetOpen;
      if (k.pressed('KeyH')) this.panelHidden = !this.panelHidden;
    }
    if (this.phase === 'debrief') {
      if (k.pressed('KeyG')) {
        syncPrograms(this.run.programs, modeIndex(this.run.mode) >= 1 ? 'SCIFI' : 'REALISTIC');
        this.programs.show();
      }
      if (k.pressed('KeyT')) this.tech.show();
      if (k.pressed('Space') || k.pressed('Enter')) {
        if (this.run.tutorial) {
          // The tutorial was round 0: ROUND 1 begins for real on a fresh seed (GAME_PLAN 25).
          this.tut = null;
          this.newRun();
          this.note('ROUND 1. GOOD LUCK.', 4);
          return;
        }
        nextRound(this.run, budgetAt(this.run.economy, w.t));
        this.startRound();
      }
      return;
    }
    if (this.phase === 'over') {
      if (k.pressed('Space') || k.pressed('Enter')) this.newRun();
      return;
    }
    if (k.pressed('KeyV')) this.planetOpen = !this.planetOpen;
    if (k.pressed('KeyK')) {
      setWarp(w, 0);
      this.sky.show();
      return;
    }
    if (k.pressed('KeyG')) {
      setWarp(w, 0);
      syncPrograms(this.run.programs, modeIndex(this.run.mode) >= 1 ? 'SCIFI' : 'REALISTIC');
      this.programs.show();
      return;
    }
    if (k.pressed('KeyT')) {
      setWarp(w, 0);
      this.tech.show();
      return;
    }
    if (k.pressed('KeyE') && this.run.evacuatedAt === null && w.threat) {
      if (spend(this.run.economy, w.t, KNOBS.EVACUATE_COST)) {
        this.run.evacuatedAt = w.t;
        this.sfx?.voice.say('EVACUATE', true);
        this.note(`EVACUATION ORDERED  ${formatCountdown(w.threat.tImpact - w.t)}  (${this.run.effects.evacMinDays} D MINIMUM FOR CREDIT)`);
        this.tele.push(evacuateNarrative(w.threat.tImpact - w.t, this.run.effects.evacMinDays));
      } else this.note('CANNOT AFFORD EVACUATION (COST 2)');
    }
    if (k.pressed('KeyP')) {
      setWarp(w, 0);
      this.planetOpen = false;
      this.planner.show(this.plannerSession());
      return;
    }
    if (k.pressed('Space')) setWarp(w, w.warp === 0 ? 1 : 0);
    if (k.pressed('Space') && w.warp === 0) this.sfx?.voice.say('PAUSED');
    if (k.pressed('BracketRight')) setWarp(w, w.warp + 1);
    if (k.pressed('BracketRight') && w.warp === KNOBS.WARP_LEVELS.length - 1) this.sfx?.voice.say('WARP');
    if (k.pressed('BracketLeft')) setWarp(w, w.warp - 1);
    if (k.pressed('KeyS')) this.scale = this.scale === 'LINEAR' ? 'COMPRESSED' : 'LINEAR';
    if (k.pressed('KeyI')) {
      this.pitchIdx = (this.pitchIdx + 1) % CAMERA_PITCHES.length;
      this.cam.pitch = CAMERA_PITCHES[this.pitchIdx] as number;
    }
    if (k.pressed('KeyZ')) {
      this.zoom = 1;
      this.panX = 0;
      this.panY = 0;
    }
    const wheel = k.takeWheel();
    if (wheel !== 0) this.zoom = Math.max(0.2, Math.min(40, this.zoom * Math.exp(-wheel * 0.0015)));
    const drag = k.takeDrag();
    this.panX += drag.x;
    this.panY += drag.y;

    if (k.pressed('KeyX')) {
      // EXPORT is the last round boundary (what CONTINUE would load), not this moment of the round.
      this.note(exportSave(this.boundarySave) ? 'SAVE.MD DOWNLOADED (THE START OF THIS ROUND)' : 'EXPORT UNAVAILABLE');
    }
    if (k.pressed('KeyR') && this.result) {
      this.finishRound();
      return;
    }
    // SIMULATION ambience: every 120 s of play the operators post a bulletin (in character, GAME_PLAN 30).
    if ((this.run.mode === 'SIMULATION' || this.run.mode === 'MULTIVERSE') && !this.tele.isOpen) {
      const slot = Math.floor(performance.now() / 120000);
      if (slot !== this.opSlot && performance.now() > 30000) {
        this.opSlot = slot;
        this.tele.push({ header: { text: 'BULLETIN FROM THE OPERATORS', role: 'program' }, lines: [{ text: operatorNote(this.run.seed, slot), role: 'text' }] });
      }
    }
    const before = w.t;
    // SUPER-DUPER-DEMO runs the clock faster every game; everything else plays at warp.
    advance(w, (Math.min(dtMs, 100) / 1000) * (this.auto?.speed ?? 1));
    if (this.result && w.t > before) this.onEventsPassed(this.result.events.filter((e) => e.t > before && e.t <= w.t));
    if (!this.imminentSaid && this.result?.outcome === 'HIT' && w.threat && w.threat.tImpact - w.t < KNOBS.VOICE_IMMINENT_S) {
      this.imminentSaid = true;
      this.sfx?.voice.say('IMPACT_IMMINENT', true);
    }
    // Auto warp-down (29): the last craft has arrived, so the player sees there is room to act.
    const arrived = this.warpDown.check(this.result?.missionsResolved ?? this.missions, before, w.t);
    if (arrived.length > 0 && !this.mv) {
      if (w.warp > KNOBS.WARP_DOWN_INDEX) setWarp(w, KNOBS.WARP_DOWN_INDEX);
      this.note('NO MORE CRAFT IN FLIGHT: PLAN OR LET IT PLAY OUT', 6);
    }
    this.noteT = Math.max(0, this.noteT - dtMs / 1000);
    // Programs run on the sim clock and drain the budget; completions change the networks for later rounds.
    const done = advancePrograms(this.run.programs, { economy: this.run.economy, effects: this.run.effects, networks: this.run.networks }, w.t, w.t - before);
    for (const id of done) this.note(`PROGRAM COMPLETE: ${id}`, 4);
    if (done.length > 0) this.sfx?.voice.say('RESEARCHING');
    // Feasibility studies: milestones and verdicts arrive on the same clock (SCI-FI and above: assured).
    const ev = advanceStudies(this.run.studies, this.run.seed, { economy: this.run.economy, effects: this.run.effects, networks: this.run.networks }, w.t, w.t - before, this.run.mode !== 'REALISTIC');
    for (const e of ev) this.note(e.kind === 'MILESTONE' ? `STUDY ${e.id}: READINESS LEVEL ${e.trl} REACHED` : e.kind === 'SUCCEEDED' ? `STUDY ${e.id} SUCCEEDED: IT WORKS` : `STUDY ${e.id} FAILED AT READINESS LEVEL ${e.trl}: FUNDING STOPPED`, 5);
    if (ev.some((e) => e.kind === 'SUCCEEDED')) this.sfx?.voice.say('RESEARCHING');
    if (this.mv) {
      tickMultiverse(this.mv, w.t - before);
      if (w.t >= earliestEnd(this.mv)) this.finishRound();
      return;
    }
    if (this.result && w.t >= this.result.ca.tCa) {
      if (this.cine.isOpen) this.pendingFinish = true;
      else this.finishRound();
    }
  }

  /** A site was hit: it is gone (rebuild it in PROGRAMS), the round scores nothing and the run loses SITE_LOSS_SCORE. */
  private loseSite(id: TargetId): void {
    this.run.effects.sites = this.run.effects.sites.filter((x) => x !== id);
    for (const ps of this.run.programs) {
      if (programById(ps.id).effects.some((e) => e.kind === 'SITE' && e.site === id)) {
        ps.progress = 0;
        ps.completedAt = null;
        ps.funding = 0;
      }
    }
    if (this.score) this.score = { ...this.score, roundScore: 0, research: 0 };
    this.run.score = Math.max(0, this.run.score - KNOBS.SITE_LOSS_SCORE);
    this.note(`${targetOf(this.world, id).label} LOST. HOME IS SAFE. REBUILD IT IN PROGRAMS.`, 8);
  }

  /** SAVE.md text of the last round boundary (round start, or the next round once a round is won): EXPORT's text. */
  private boundarySave = '';
  /** SUPER-DUPER-DEMO real seconds watched (the demo is timed by the clock). */
  private demoT = 0;
  /** SUPER-DUPER-DEMO cutaways to animated summaries between the games' own frames. */
  private readonly demoCut: DemoCutaways;

  /** Ask the worker for a fresh gauge when the networks or the whole calendar year changed (cheap to test per frame). */
  private refreshGauge(): void {
    const nets = this.world.networks;
    const year = Math.floor(yearOf(this.world.t));
    const key = `${[...nets.active].sort().join(',')}|${Object.entries(nets.since).map(([k, v]) => `${k}:${Math.floor(v)}`).sort().join(',')}|${year}`;
    if (key === this.gaugeKey) return;
    this.gaugeKey = key;
    this.client
      .gauge(nets.active, nets.since, year)
      .then((r) => {
        if (this.gaugeKey === key) this.gauge = r;
      })
      .catch(() => undefined);
  }

  /** AUTOPLAY: the A key toggles it; while on, the autopilot reads the screen and presses keys for the player. */
  private updateAutoplay(dtMs: number): void {
    const k = this.keys;
    if (this.autoPane) {
      this.autoPane.t += (dtMs / 1000) * (this.auto?.speed ?? 1);
      if (this.autoPane.t >= this.autoPane.pane.hold) this.autoPane = null;
    }
    const typing = this.console.isOpen || this.lore.isOpen;
    if (!typing && k.realKey() && k.pressed('KeyA')) {
      if (this.auto) {
        this.auto = null;
        this.autoPane = null;
        this.note('AUTOPLAY OFF: YOU HAVE CONTROL', 4);
      } else {
        this.auto = new Autopilot();
        this.run.assisted = true;
        this.sfx?.voice.say('AUTOPLAY', true);
        this.note('AUTOPLAY ON: WATCH AND LEARN (A TAKES OVER)', 4);
      }
      return;
    }
    if (!this.auto) return;
    // Pace (owner 2026-10-18): - and = step SLOW / NORMAL / FAST live; the choice is the OPTIONS AUTOPLAY SPEED row.
    if (!typing && (k.pressed('Minus') || k.pressed('Equal'))) {
      const i = AUTO_SPEED_LEVELS.indexOf(this.settings.autoSpeed ?? 'NORMAL');
      const next = AUTO_SPEED_LEVELS[Math.max(0, Math.min(AUTO_SPEED_LEVELS.length - 1, i + (k.pressed('Equal') ? 1 : -1)))] ?? 'NORMAL';
      this.settings.autoSpeed = next;
      saveSettings(this.settings);
      this.note(`AUTOPLAY SPEED ${next}`, 2);
    }
    const pace = KNOBS.AUTO_SPEEDS[this.settings.autoSpeed ?? 'NORMAL'];
    const demoLen = KNOBS.DEMO_LENGTHS[this.settings.demoLength ?? 'MEDIUM'].seconds;
    this.auto.speed = pace;
    if (this.auto.demo) {
      this.demoT += dtMs / 1000;
      this.auto.speed = pace * demoSpeed(this.demoT, demoLen);
      this.demoCut.update(dtMs / 1000, this.demoT / demoLen, this.cine.isOpen);
      if (this.demoT >= demoLen) {
        this.auto = null;
        this.autoPane = null;
        this.router.go('demo');
        return;
      }
    }
    const w = this.world;
    const th = w.threat;
    const res = this.result;
    const out = this.auto.step({
      round: this.run.round,
      phase: this.phase,
      threat: th && res ? { name: th.name, D: th.D, energyMt: res.energy.energyMt, leadS: th.tImpact - w.t, kind: th.type.kind === 'comet' ? 'comet' : 'asteroid' } : null,
      missions: this.missions.length,
      craftInFlight: craftRemaining(res?.missionsResolved ?? this.missions, w.t),
      predicted: res?.outcome ?? null,
      margin: res?.ca.marginRadii ?? 0,
      budget: budgetAt(this.run.economy, w.t),
      warp: w.warp,
      planner: this.planner.autoView(),
      overlayOpen: this.programs.isOpen || this.tech.isOpen || this.planetOpen || this.lore.isOpen || this.sky.isOpen,
      teleModal: this.tele.isOpen && this.tele.isModal,
      teleComplete: this.tele.complete,
      cine: this.cine.isOpen,
      canEvacuate: this.run.evacuatedAt === null && budgetAt(this.run.economy, w.t) >= KNOBS.EVACUATE_COST,
      debrief: this.score ? { outcome: this.run.history[this.run.history.length - 1]?.outcome.split(' ')[0] ?? '', score: this.score.roundScore } : null,
      ...(this.phase === 'debrief' ? { invest: this.autoInvestView() } : {}),
    }, dtMs / 1000);
    for (const c of out.keys) k.inject(c);
    if (out.invest?.kind === 'TECH' && unlock(this.run, out.invest.id, modeIndex(this.run.mode) >= 1 ? 'SCIFI' : 'REALISTIC') === 'OK') this.tech.show();
    if (out.invest?.kind === 'PROGRAM') {
      const ps = this.run.programs.find((x) => x.id === out.invest?.id);
      if (ps && ps.completedAt === null) {
        ps.funding = 1;
        this.programs.show();
        this.sfx?.voice.say('PROGRAM_FUNDED');
      }
    }
    if (out.pane) this.autoPane = { pane: out.pane, t: 0 };
  }

  private drawAutoPane(): void {
    const s = this.s;
    if (!this.auto) return;
    const ui = uiColors(s.palette, s.spectrum);
    const a = this.auto;
    const left = Math.max(0, KNOBS.DEMO_LENGTHS[this.settings.demoLength ?? 'MEDIUM'].seconds - this.demoT);
    const clock = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
    // Bottom left by default (the teletype docks bottom right); with the planner open the porkchop owns the left,
    // so everything docks bottom right under the plan list.
    const right = this.planner.isOpen;
    const hx = right ? s.width - 16 : 16;
    const align = right ? 'right' : 'left';
    drawText(s, `${a.demo ? `SUPER-DUPER-DEMO  GAME ${a.rounds + 1}  FINALE IN ${clock}  SPEED X${a.speed.toFixed(a.speed < 10 ? 1 : 0)}` : 'AUTOPLAY'}  ${keyName('AUTOPLAY')} TAKES OVER  ESC TITLE${this.autoFresh ? '  (NOT SAVED)' : ''}`, hx, s.height - 64, 10, { align, color: ui.title, glow: 1 });
    // How to change the pace, always on screen while the game plays itself.
    const lv = this.settings.autoSpeed ?? 'NORMAL';
    const pace = AUTO_SPEED_LEVELS.map((l) => (l === lv ? `[${l}]` : l)).join(' ');
    drawText(s, `PACE ${pace}   ${keyName('AUTO_SLOWER')} SLOWER  ${keyName('AUTO_FASTER')} FASTER`, hx, s.height - 50, 9, { align, color: ui.sub, glow: 0.5 });
    const ap = this.autoPane;
    if (!ap) return;
    // Bottom left: the teletype docks bottom right and the HUD owns the top.
    const w = Math.min(560, s.width * 0.42, s.width - 32);
    const lines = wrapText(ap.pane.body, w - 28, 11);
    const h = 44 + lines.length * 16 + 10;
    const x = right ? s.width - 16 - w : 16;
    const y = s.height - 74 - h;
    const fade = Math.min(1, ap.t * 4, (ap.pane.hold - ap.t) * 3);
    s.ctx.fillStyle = withAlpha(s.palette.bg, 0.88 * fade);
    s.ctx.fillRect(x, y, w, h);
    s.stroke([x, y, x + w, y, x + w, y + h, x, y + h], { closed: true, color: ui.sub, glow: 1, alpha: fade });
    drawText(s, ap.pane.title, x + 14, y + 12, 13, { color: ui.title, glow: 1.2, alpha: fade });
    let ly = y + 36;
    for (const l of lines) {
      drawText(s, l, x + 14, ly, 11, { color: ui.text, glow: 0.4, alpha: fade, lower: true });
      ly += 16;
    }
    // Time left on this pane, so the viewer knows the next step is coming.
    const frac = 1 - ap.t / ap.pane.hold;
    s.stroke([x + 14, y + h - 6, x + 14 + (w - 28) * frac, y + h - 6], { color: ui.sub, glow: 0.5, alpha: fade });
  }

  private project(x: number, y: number, z = 0): [number, number] {
    const s = this.s;
    const base = (Math.min(s.width, s.height) / 2) * 0.9 * this.zoom;
    const r = Math.hypot(x, y, z);
    const rs = this.scale === 'COMPRESSED' ? (Math.sqrt(r / AU) / 2.5) * base : (r / AU / 5.6) * base;
    const f = r > 0 ? rs / r : 0;
    // Wireframe-3-D camera (24.3): the tilt is applied to screen offsets, so the physics never sees it.
    const [dx, dy] = tilt(this.cam, x * f, -y * f, z * f);
    return [s.width / 2 + this.panX + dx, s.height / 2 + this.panY + dy];
  }

  /** A threat position: a 3-D orbit passes its own z (M14 phase 2); a 3-D lite threat is tilted about its node. */
  private threat3(x: number, y: number, z?: number): [number, number] {
    if (z !== undefined) return this.project(x, y, z);
    const th = this.world.threat;
    if (!th?.incl || th.node === undefined) return this.project(x, y);
    const v = tiltAboutNode({ x, y }, nodeLine(th.node), th.incl);
    return this.project(v.x, v.y, v.z);
  }

  private polyline(pts: Float64Array, style: Parameters<Surface['stroke']>[1], stride: 2 | 3 = 2): void {
    const buf: number[] = [];
    for (let i = 0; i < pts.length; i += stride) {
      const [px, py] = this.project(pts[i] as number, pts[i + 1] as number, stride === 3 ? (pts[i + 2] as number) : 0);
      buf.push(px, py);
    }
    this.s.stroke(buf, style);
  }

  render(): void {
    const s = this.s;
    const p = s.palette;
    const w = this.world;
    if (this.auto?.demo && this.demoCut.isOn && !this.cine.isOpen) {
      const left = Math.max(0, KNOBS.DEMO_LENGTHS[this.settings.demoLength ?? 'MEDIUM'].seconds - this.demoT);
      this.demoCut.render(s, `SUPER-DUPER-DEMO  GAME ${this.auto.rounds + 1}  SPEED X${this.auto.speed.toFixed(0)}  FINALE IN ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`);
      return;
    }
    if (this.cine.isOpen) {
      this.cine.render(formatCountdown((w.threat?.tImpact ?? 0) - w.t));
      this.drawAutoPane();
      return;
    }
    s.clear();
    this.hits.length = 0;
    this.stars.draw(s, this.panX, this.panY, !this.settings.reduceMotion);
    if (this.matPhase !== this.phase) {
      this.matPhase = this.phase;
      this.mat.start();
    }
    this.mat.tick(1 / 60);

    const [sx, sy] = this.project(0, 0);
    const sr = 7;
    const starC = s.spectrum ? s.role('star') : p.hot;
    this.hit(sx - 14, sy - 14, 28, 28, 'O6', 'THE STAR: KEPLER AND ORBITS');
    s.circle(sx, sy, sr, { color: starC, glow: 2 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      s.stroke([sx + Math.cos(a) * (sr + 3), sy + Math.sin(a) * (sr + 3), sx + Math.cos(a) * (sr + 8), sy + Math.sin(a) * (sr + 8)], { color: starC, glow: 1 });
    }

    // Under the 3-D tilt (I), a faint grid on the plane of the planets gives the eye a floor: rings at 0.5-6 AU and
    // spokes every 30 deg, fading with distance. Nothing is drawn top-down, where it would only add clutter.
    if (this.cam.pitch > 0) {
      const gridCol = s.spectrum ? s.role('orbit') : p.dim;
      for (const rAu of [0.5, 1, 1.5, 2, 3, 4, 6]) {
        const ring: number[] = [];
        for (let i = 0; i <= 72; i++) {
          const a = (i / 72) * 2 * Math.PI;
          ring.push(...this.project(rAu * AU * Math.cos(a), rAu * AU * Math.sin(a)));
        }
        s.stroke(ring, { color: gridCol, glow: 0, alpha: 0.22 * Math.min(1, 1.6 / rAu), dash: [1, 5] });
      }
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * 2 * Math.PI;
        const spoke: number[] = [];
        for (const rAu of [0.3, 1, 2, 4, 6]) spoke.push(...this.project(rAu * AU * Math.cos(a), rAu * AU * Math.sin(a)));
        s.stroke(spoke, { color: gridCol, glow: 0, alpha: 0.12, dash: [1, 6] });
      }
    }
    for (const pl of w.planets) {
      let pts = this.orbitCache.get(pl.id);
      if (!pts) {
        pts = orbitPoints(pl.elements, 256);
        this.orbitCache.set(pl.id, pts);
      }
      this.polyline(pts, { closed: true, color: s.spectrum ? s.role('orbit') : p.dim, glow: 0, width: 1, alpha: s.spectrum ? 0.55 : 1 });
      const st = planetState(w, pl);
      const [px, py] = this.project(st.r.x, st.r.y);
      const pr = pl.id === 'GIANT' ? 7 : pl.id === 'HOME' ? 5 : 4;
      s.circle(px, py, pr, { glow: pl.id === 'HOME' ? 1.6 : 1, color: pl.id === 'HOME' ? (s.spectrum ? s.role('planet') : p.hot) : s.spectrum ? s.role('orbit') : p.ink });
      for (let i = 0; i < pl.detailLines; i++) {
        const yy = py - pr * 0.5 + (i / Math.max(1, pl.detailLines - 1)) * pr * (pl.detailLines > 1 ? 1 : 0);
        const half = Math.sqrt(Math.max(0, pr * pr - (yy - py) * (yy - py))) * 0.8;
        s.stroke([px - half, yy, px + half, yy], { glow: 0.5, width: 1 });
      }
      drawText(s, pl.name, px + pr + 5, py - 5, 10, { color: p.dim, glow: 0 });
      this.hit(px - 10, py - 10, 20 + pl.name.length * 9, 20, pl.id === 'HOME' ? 'O12' : pl.id === 'GIANT' ? 'O11' : 'O7', pl.id === 'HOME' ? 'HOME: CLOSE APPROACH' : `${pl.name}: ${pl.id === 'GIANT' ? 'GRAVITY ASSISTS' : 'ORBITAL ELEMENTS'}`);
    }
    // IDEAS 26: built sites. Moons are drawn at an exaggerated distance (a true 0.0026 AU is under a pixel) in their
    // true direction from the planet; a planet site gets a ring. The rock's target is drawn in the threat colour.
    for (const id of this.run.effects.sites as TargetId[]) {
      const tg = targetOf(w, id);
      const st = tg.state(w.t);
      const aimedHere = w.threat?.targetId === id;
      const col = aimedHere ? (s.spectrum ? s.role('threat') : p.hot) : s.spectrum ? s.role('planet') : p.ink;
      if (id === 'OUTER') {
        const [px, py] = this.project(st.r.x, st.r.y);
        s.circle(px, py, 8, { color: col, glow: 0.8, dash: [2, 2] });
        drawText(s, 'CITIES', px + 10, py + 6, 9, { color: col, glow: 0.4 });
        continue;
      }
      const host = planetState(w, planetById(w, id === 'MOON' ? 'HOME' : 'GIANT'));
      const [hx, hy] = this.project(host.r.x, host.r.y);
      const ang = Math.atan2(st.r.y - host.r.y, st.r.x - host.r.x);
      const off = id === 'MOON' ? 14 : 16;
      const mx = hx + off * Math.cos(ang);
      const my = hy - off * Math.sin(ang);
      s.circle(mx, my, 2.5, { color: col, glow: 0.8 });
      drawText(s, id === 'MOON' ? 'MOON BASE' : 'OUTPOSTS', mx + 4, my + 5, 8, { color: col, glow: 0.3 });
      this.hit(mx - 8, my - 8, 16, 16, 'T7', `${tg.label}: A SECOND WORLD TO DEFEND`);
    }

    if (this.mv) this.drawMultiverse(this.mv);
    else {
      this.drawCraft();
      this.drawThreat();
      this.drawFictionProps();
    }
    if (!this.planner.isOpen && !this.planetOpen && !this.programs.isOpen && !this.tech.isOpen && !this.sky.isOpen) this.drawHud();
    if (this.planetOpen && !this.planner.isOpen) this.planet.render(this.world, this.result, this.mc);
    this.programs.render(this.run, budgetAt(this.run.economy, this.world.t), this.world.t, this.gauge, this.experimental());
    this.tech.render(this.run);
    this.sky.render(this.world, performance.now() / 1000, this.settings.reduceMotion);
    // The debrief panel stays under any overlay the player (or AUTOPLAY) opened from it.
    const overlay = this.programs.isOpen || this.tech.isOpen || this.sky.isOpen;
    if (!this.panelHidden && !this.tele.isModal && !overlay) {
      if (this.phase === 'debrief') this.drawDebrief();
      if (this.phase === 'over') this.drawOver();
    } else if (this.phase !== 'planning' && !overlay) {
      drawTextFit(this.s, `REPLAY  ${formatCountdown((this.world.threat?.tImpact ?? 0) - this.world.t)}   LEFT / RIGHT STEP EVENTS   <H> PANEL   <V> PLANET   <SPACE> CONTINUE`, this.s.width / 2, this.s.height - 62, 12, this.s.width - 32, { align: 'center', color: this.s.palette.hot, glow: 1 });
    }
    this.planner.render();
    if (this.planner.isOpen && this.tut) {
      // The tutorial box is hidden under the planner, so the step it asks for is repeated in one line here.
      const hint = this.tut.step <= 3 ? 'TUTORIAL: UP / DOWN PICKS A PLAN, ENTER COMMITS THE TOP KINETIC PLAN. ESC CLOSES THE PLANNER.' : 'TUTORIAL: COMMITTED. ESC CLOSES THE PLANNER, THEN ] RUNS THE CLOCK.';
      drawTextFit(s, hint, s.width / 2, s.height - 50, 11, s.width - 32, { align: 'center', color: s.spectrum ? s.role('program') : p.hot, glow: 1 });
    }
    if (!this.planner.isOpen && !this.programs.isOpen && !this.tech.isOpen) this.drawTutorial();
    if (this.tele.isModal || (!this.planner.isOpen && !this.programs.isOpen && !this.tech.isOpen && !this.planetOpen)) this.tele.render(this.tele.isModal ? 'center' : 'dock');
    // Hover: name what a click would teach.
    const mp = this.keys.mouse;
    if (mp && this.phase === 'planning' && !this.planner.isOpen && !this.lore.isOpen && !this.console.isOpen) {
      const h = this.hitAt(mp.x, mp.y);
      if (h) drawText(s, `${h.label}  (CLICK: LEARN ${h.topic})`, mp.x + 14, mp.y + 14, 9, { color: s.spectrum ? s.role('program') : p.hot, glow: 0.6 });
    }
    this.lore.render();
    this.drawAutoPane();
    this.console.render(this.gameContext());
    if (this.glitch && !this.settings.reduceMotion) {
      const now = performance.now();
      const big = now < this.peelUntil ? Math.min(1, (this.peelUntil - now) / 600, (now - (this.peelUntil - 8000)) / 600) : 0;
      const amb = ambientPeel(now / 1000);
      const th = w.threat;
      const raw = th
        ? [`RENDER LAYER 0   ENTITY ${th.id}  ${th.name}`, `a ${(th.elements.a / AU).toFixed(6)} AU   e ${th.elements.e.toFixed(6)}`, `w ${th.elements.w.toFixed(5)} RAD   M0 ${th.elements.M0.toFixed(5)} RAD`, `MASS ${th.mass.toExponential(4)} KG   D ${th.D.toFixed(1)} M`, `T_IMPACT ${th.tImpact.toFixed(0)} S   T ${w.t.toFixed(0)} S`, `SEED ${w.runSeed}#${w.round}   RNG OK`]
        : ['RENDER LAYER 0', 'NO ENTITIES'];
      if (big > 0) peelPass(s, big, 1, raw, now / 1000);
      else if (amb.amount > 0) peelPass(s, amb.amount, amb.corner, raw.slice(0, 3), now / 1000);
    }
    if (this.glitch && !this.settings.reduceMotion) glitchPass(s, w.t / 86400, this.run.mode === 'MULTIVERSE' ? 1.5 : 1, `SIM  FRAME ${(1000 / 60).toFixed(1)} MS  ENTITIES ${this.result ? this.result.bodies.length + this.missions.length : 0}  T ${w.t.toFixed(0)}`);
  }

  /** MULTIVERSE: tiles, one branch each, on the shared clock. */
  private drawMultiverse(mv: Multiverse): void {
    const s = this.s;
    const p = s.palette;
    const n = mv.branches.length;
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const m = 16;
    const top = 70;
    const tw = (s.width - 2 * m) / cols;
    const th = (s.height - top - 60) / rows;
    mv.branches.forEach((b, i) => {
      const x0 = m + (i % cols) * tw;
      const y0 = top + Math.floor(i / cols) * th;
      const selected = i === mv.selected;
      s.stroke([x0, y0, x0 + tw, y0, x0 + tw, y0 + th, x0, y0 + th], { closed: true, color: selected ? p.hot : p.dim, glow: selected ? 1 : 0 });
      this.drawBranchTile(b, x0, y0, tw, th);
      const alive = branchSurvives(b);
      drawText(s, `${i + 1}  ${b.result.outcome}${b.extraResult ? ` + ${b.extraResult.outcome}` : ''}  ${alive ? 'SURVIVES' : 'LOST'}  MISSIONS ${b.missions.length}`, x0 + 6, y0 + 4, 9, { color: alive ? p.ink : p.hot, glow: 0.3 });
    });
    drawText(s, `MULTIVERSE X${n}   SURVIVAL ${(survivalFraction(mv) * 100).toFixed(0)}%   DIGITS SELECT   P PLANS THE SELECTED BRANCH   C COLLAPSE   WORMHOLE IN THE CONSOLE`, s.width / 2, s.height - 44, 11, { align: 'center', color: p.hot, glow: 0.8 });
  }

  private drawBranchTile(b: Branch, x0: number, y0: number, tw: number, th: number): void {
    const s = this.s;
    const p = s.palette;
    const w = b.world;
    const cx = x0 + tw / 2;
    const cy = y0 + th / 2;
    const base = (Math.min(tw, th) / 2) * 0.9;
    drawMiniSystem(s, w, b.result, cx, cy, base);
    if (b.extraThreat && b.extraResult) {
      const st = stateAt(elementsAt(b.extraResult.segments, w.t), w.star.mu, w.t);
      const r = Math.hypot(st.r.x, st.r.y);
      const f = r > 0 ? ((Math.sqrt(r / AU) / 2.5) * base) / r : 0;
      s.circle(cx + st.r.x * f, cy - st.r.y * f, 2.5, { color: p.hot, glow: 1, dash: [2, 2] });
    }
  }

  /** Which lore topic `?` opens: the panel on screen, else the round's situation. */
  private contextTopic(): string {
    if (this.programs.isOpen) return 'G4';
    if (this.tech.isOpen) return 'G5';
    if (this.planetOpen) return 'O12';
    if (this.phase === 'debrief') return 'G5';
    if (this.phase === 'over') return 'T2';
    if (this.tut) return 'G1';
    const th = this.world.threat;
    if (th?.noWarning) return 'F3';
    if (th?.flavor === 'INTERSTELLAR' || th?.type.kind === 'comet') return 'T6';
    if (this.result?.producedFragments) return 'D4';
    if (this.missions.some((m) => m.push)) return 'D6';
    if (this.missions.some((m) => m.warhead)) return 'D5';
    if (this.missions.length > 0) return 'D3';
    return this.world.t > 0 ? 'G2' : 'T1';
  }

  /** The console's hooks into the round (game/console.ts GameContext). */
  private gameContext(): GameContext {
    const reresolve = (): void => {
      if (!this.world.threat) return;
      this.result = resolveRound(this.world, this.missions, this.resolveOpts());
      this.requestMc();
      this.threatOrbitCache = null;
      this.orbitCache.clear();
    };
    return {
      run: this.run,
      round: {
        hasThreat: !!this.world.threat,
        teleport: () => {
          const th = this.world.threat;
          if (!th) return 'NO THREAT.';
          // 1 AU along track: advance the mean anomaly by the time it takes to travel 1 AU.
          const st = propagate(th.elements, this.world.star.mu, this.world.t);
          const v = Math.hypot(st.v.x, st.v.y);
          const n = Math.sqrt(this.world.star.mu / th.elements.a ** 3);
          this.world.threat = { ...th, elements: { ...th.elements, M0: th.elements.M0 + n * (AU / v) } };
          reresolve();
          return `${th.name} MOVED 1 AU ALONG ITS TRACK. PREDICTED ${this.result?.outcome ?? '?'}.`;
        },
        observe: () => {
          const th = this.world.threat;
          if (!th) return 'NO THREAT.';
          const rng = new Rng(hashSeed(`${this.run.seed}#observe#${this.run.round}#${this.world.t}`));
          const miss = rng.chance(1 / Math.E);
          const n = Math.sqrt(this.world.star.mu / th.elements.a ** 3);
          // A miss: nudge the phase by six hours of travel (well past b_crit); else re-roll the shape only.
          this.world.threat = miss ? { ...th, elements: { ...th.elements, M0: th.elements.M0 + n * 6 * 3600 } } : { ...th, shape: th.shape.map((v) => v * rng.float(0.9, 1.1)) };
          reresolve();
          return miss ? 'THE WAVEFUNCTION COLLAPSED TO A MISS.' : 'THE WAVEFUNCTION COLLAPSED TO THE SAME ORBIT. (P = 1/E PER OBSERVATION.)';
        },
        rewind: (years) => {
          this.world.t = Math.max(0, this.world.t - Math.max(0, years) * YEAR);
          return `CLOCK REWOUND TO ${formatCountdown((this.world.threat?.tImpact ?? 0) - this.world.t)}. KNOWLEDGE KEPT.`;
        },
        editG: (f) => {
          (this.world as { star: { mu: number } }).star = { ...this.world.star, mu: this.world.star.mu * f };
          this.glitch = true;
          reresolve();
          return `STAR MASS X${f}. PLANETS DRIFT. PREDICTED ${this.result?.outcome ?? '?'}.`;
        },
        deleteThreat: () => {
          const th = this.world.threat;
          if (!th) return 'NO THREAT.';
          this.world.threat = { ...th, D: 0.5, mass: 1 };
          reresolve();
          return `${th.name} DELETED. ${(th.mass * 9e16).toExponential(1)} J UNACCOUNTED FOR.`;
        },
        tractorBeam: () => {
          const th = this.world.threat;
          if (!th) return 'NO THREAT.';
          const st = stateAt(th.elements, this.world.star.mu, this.world.t);
          const m: Mission = { id: `BEAM-${this.missions.length + 1}`, archetype: 'SLOW_PUSH', launcherTier: 1, impactorTier: 1, launchTime: this.world.t, arrivalTime: this.world.t + 1, impactorKg: 0, c3: 0, departureV: { x: 0, y: 0 }, arrivalV: st.v, interceptR: st.r, U: 0, cost: 0, committedAt: this.world.t, targetId: 'THREAT', push: { method: 'TRACTORBEAM', tier: 0, sign: 1, tauMax: th.tImpact }, dsmUsed: 0 };
          this.missions.push(m);
          reresolve();
          return `1E6 N ON ${th.name} FROM NOW UNTIL ${formatCountdown(KNOBS.PUSH_END_MARGIN)}. PREDICTED ${this.result?.outcome ?? '?'}.`;
        },
        singularity: () => {
          this.run.shield = false;
          this.phase = 'over';
          this.scrub = 0;
          this.rank = -1;
          setWarp(this.world, 0);
          return 'THE PROBE AND THE NEIGHBOURHOOD ARE GONE. ROUND OVER.';
        },
        planetThrusters: (dv) => {
          const home = planetById(this.world, 'HOME');
          const st = planetState(this.world, home);
          const vm = Math.hypot(st.v.x, st.v.y) || 1;
          const v = { x: st.v.x + (dv * st.v.x) / vm, y: st.v.y + (dv * st.v.y) / vm };
          try {
            (home as { elements: typeof home.elements }).elements = toElements(st.r, v, this.world.star.mu, this.world.t);
          } catch {
            return 'HOME WOULD LEAVE THE SYSTEM. REFUSED.';
          }
          reresolve();
          return `HOME MOVED BY ${dv} M/S. PREDICTED ${this.result?.outcome ?? '?'}.`;
        },
        shrink: () => {
          const th = this.world.threat;
          if (!th) return 'NO THREAT.';
          this.world.threat = { ...th, D: th.D * 0.1, mass: sphereMass(th.D * 0.1, th.type.density) };
          reresolve();
          return `${th.name} IS NOW ${(th.D * 0.1).toFixed(0)} M.`;
        },
        multiverse: (n) => {
          if (!this.world.threat || !this.result) return 'NO ROUND.';
          this.mv = forkMultiverse(this.world, this.missions, n, this.resolveOpts());
          this.glitch = true;
          return `FORKED INTO ${n} BRANCHES. DIGITS SELECT, P PLANS THE SELECTED BRANCH, C COLLAPSES.`;
        },
        wormhole: () => (this.mv ? wormhole(this.mv, this.resolveOpts()) : 'NO BRANCHES: TYPE MULTIVERSE N FIRST.'),
        revealNow: () => {
          if (!this.result) return '';
          const betas = this.result.events.filter((e) => e.kind === 'IMPACT').map((e) => (e.kind === 'IMPACT' ? `${e.missionId} BETA ${e.beta.toFixed(2)}` : ''));
          return betas.length ? betas.join('   ') : 'NO IMPACTS PLANNED YET.';
        },
        completeAllPrograms: (scifi) => {
          const states = createPrograms(scifi ? 'SCIFI' : 'REALISTIC');
          for (const st of states) {
            const existing = this.run.programs.find((p2) => p2.id === st.id);
            const target = existing ?? st;
            if (!existing) this.run.programs.push(st);
            if (target.completedAt === null) {
              target.progress = 1;
              target.funding = 0;
              target.completedAt = this.world.t;
              applyEffects(programById(st.id), { economy: this.run.economy, effects: this.run.effects, networks: this.run.networks }, this.world.t);
            }
          }
          return `${states.length} PROGRAMS COMPLETE.`;
        },
        impulse: (dv, label) => {
          const th = this.world.threat;
          if (!th) return 'NO THREAT.';
          const st = propagate(th.elements, this.world.star.mu, this.world.t);
          const vm = Math.hypot(st.v.x, st.v.y) || 1;
          try {
            const el = toElements(st.r, { x: st.v.x * (1 + dv / vm), y: st.v.y * (1 + dv / vm) }, this.world.star.mu, this.world.t);
            // NOTE: for a 3-D orbit propagate() gives the in-plane state; along track stays in the plane, keep i and raan.
            this.world.threat = { ...th, elements: onPlaneOf(el, th.elements) };
          } catch {
            return `${label}: THE ROCK LEFT THE SYSTEM. FILED AS A SUCCESS.`;
          }
          reresolve();
          return `${label}: ${th.name} NUDGED ${dv.toExponential(2)} M/S ALONG TRACK. PREDICTED ${this.result?.outcome ?? '?'}.`;
        },
        timefold: (days) => {
          const th = this.world.threat;
          if (!th) return 'NO THREAT.';
          const n = Math.sqrt(this.world.star.mu / Math.abs(th.elements.a) ** 3);
          this.world.threat = { ...th, elements: { ...th.elements, M0: th.elements.M0 - n * days * DAY } };
          reresolve();
          return `${th.name} NOW KEEPS ITS APPOINTMENT ${Math.abs(days)} DAY${Math.abs(days) === 1 ? '' : 'S'} ${days >= 0 ? 'LATE' : 'EARLY'}. PREDICTED ${this.result?.outcome ?? '?'}.`;
        },
        detour: () => {
          const th = this.world.threat;
          if (!th) return 'NO THREAT.';
          // The sign goes up a month ahead on the rock's path; the detour costs it a day and a half.
          const ahead = stateAt(th.elements, this.world.star.mu, Math.min(th.tImpact - DAY, this.world.t + 30 * DAY)).r;
          this.detourAt = { t: this.world.t, x: ahead.x, y: ahead.y };
          const n = Math.sqrt(this.world.star.mu / Math.abs(th.elements.a) ** 3);
          this.world.threat = { ...th, elements: { ...th.elements, M0: th.elements.M0 - n * 1.5 * DAY } };
          reresolve();
          return `${th.name} HAS TAKEN THE DETOUR (1.5 DAYS). PREDICTED ${this.result?.outcome ?? '?'}.`;
        },
        hollow: () => {
          const th = this.world.threat;
          if (!th) return 'NO THREAT.';
          this.world.threat = { ...th, mass: th.mass / 10 };
          reresolve();
          return `${th.name}: ${(th.mass / 10).toExponential(2)} KG, AS IT TURNS OUT. PREDICTED ${this.result?.outcome ?? '?'}.`;
        },
        ticket: () => {
          const th = this.world.threat;
          if (!th) return 'TICKET CLOSED: CANNOT REPRODUCE.';
          if (this.ticketFiled) return 'A TICKET IS ALREADY OPEN FOR THIS ROUND. PLEASE DO NOT BUMP.';
          this.ticketFiled = true;
          const rng = new Rng(hashSeed(`${this.run.seed}#ticket#${this.run.round}`));
          const roll = rng.next();
          if (roll < 0.25) {
            this.world.threat = { ...th, D: 0.5, mass: 1 };
            reresolve();
            return `TICKET #${rng.int(1000, 9999)}: RESOLVED (PATCHED). ${th.name} HAS BEEN REMOVED IN THE NEXT BUILD, WHICH IS THIS ONE.`;
          }
          const replies = ['WONTFIX: WORKS AS INTENDED.', 'DUPLICATE OF TICKET #1 (1908, TUNGUSKA). CLOSED.', 'NEEDS MORE INFORMATION. PLEASE ATTACH A SCREENSHOT OF THE UNIVERSE.', 'ACKNOWLEDGED. PRIORITY: LOW. ESTIMATED FIX: NEXT EPOCH.'];
          return `TICKET #${rng.int(1000, 9999)}: ${replies[rng.int(0, replies.length - 1)] ?? 'ACKNOWLEDGED.'}`;
        },
        peel: () => {
          this.peelUntil = performance.now() + 8000;
          this.glitch = true;
          return 'THE CORNER HAS COME AWAY FOR EIGHT SECONDS. THE NUMBERS UNDERNEATH ARE THE REAL ONES.';
        },
        bootstrap: () => {
          this.freeNext = true;
          return 'THE NEXT MISSION YOU COMMIT COSTS NOTHING.';
        },
        retrocausal: () => {
          const th = this.world.threat;
          if (!th) return 'NO THREAT.';
          // Honest impact physics for a 5 t impactor at 30 km/s with beta 2; only the timing is fiction.
          const dv = (2 * 5000 * 30000) / th.mass;
          return this.gameContext().round?.impulse(dv, 'RETROCAUSAL') ?? 'NO THREAT.';
        },
        borrow: (n) => {
          const mv = this.mv;
          if (!mv) return 'NO BRANCHES: TYPE MULTIVERSE N FIRST.';
          const src = mv.branches[Math.round(n) - 1];
          const dst = mv.branches[mv.selected];
          if (!src || !dst || src === dst) return `NO SUCH OTHER BRANCH ${n}.`;
          dst.missions.push(...src.missions.map((m) => ({ ...m, id: `${m.id}-B${src.index + 1}` })));
          resolveBranch(dst, this.resolveOpts());
          return `BRANCH ${dst.index + 1} NOW FLIES BRANCH ${src.index + 1}'S ${src.missions.length} MISSION${src.missions.length === 1 ? '' : 'S'} TOO.`;
        },
        nibiru: () => {
          this.nibiru = true;
          return 'PLANET X HAS BEEN ADDED TO THE CHART. IT WILL ARRIVE NEXT YEAR.';
        },
        mandela: () => {
          const th = this.world.threat;
          if (!th) return 'NO THREAT.';
          const rng = new Rng(hashSeed(`${this.run.seed}#mandela#${this.run.round}#${this.world.t}`));
          const name = th.name.replace(/[A-Z]{2}/, (m) => (m[1] ?? '') + (m[0] ?? ''));
          const moved = rng.chance(1 / 3);
          const n = Math.sqrt(this.world.star.mu / Math.abs(th.elements.a) ** 3);
          this.world.threat = { ...th, name, elements: moved ? { ...th.elements, M0: th.elements.M0 + n * 3 * 3600 } : th.elements };
          reresolve();
          return `IT WAS ALWAYS CALLED ${name}.${moved ? ' IT WAS ALWAYS AIMED A LITTLE TO THE LEFT.' : ''} PREDICTED ${this.result?.outcome ?? '?'}.`;
        },
      },
    };
  }

  /** Spacecraft: a faint planned path (every leg), a triangle and a short trail while in flight. */
  private drawCraft(): void {
    const s = this.s;
    const p = s.palette;
    const w = this.world;
    const home = planetById(w, 'HOME');
    for (const m of this.result?.missionsResolved ?? this.missions) {
      if (m.legs) {
        this.drawLegs(m);
        continue;
      }
      let el = this.craftCache.get(m.id);
      if (!el) {
        const hs = planetState(w, home, m.launchTime);
        try {
          el = elementsFromState(hs.r, m.departureV, w.star.mu, m.launchTime);
        } catch {
          continue;
        }
        this.craftCache.set(m.id, el);
      }
      // Planned arc.
      const n = 48;
      const arc = new Float64Array(n * 3);
      for (let i = 0; i < n; i++) {
        const t = m.launchTime + ((m.arrivalTime - m.launchTime) * i) / (n - 1);
        const st = stateAt(el, w.star.mu, t);
        arc[i * 3] = st.r.x;
        arc[i * 3 + 1] = st.r.y;
        arc[i * 3 + 2] = st.r.z ?? 0;
      }
      this.polyline(arc, { color: p.ink, glow: 0, width: 1, alpha: 0.35, dash: [2, 5] }, 3);
      if (w.t < m.launchTime || w.t >= m.arrivalTime) continue;
      const st = stateAt(el, w.star.mu, w.t);
      const [cx, cy] = this.project(st.r.x, st.r.y, st.r.z ?? 0);
      this.hit(cx - 10, cy - 10, 20, 20, m.archetype === 'SAIL_KINETIC' ? 'D7' : m.warhead ? 'D5' : m.archetype === 'SLOW_PUSH' ? 'D6' : 'D3', `${m.id}: HOW IT WORKS`);
      const ang = Math.atan2(-st.v.y, st.v.x);
      const r = 5;
      const craftRole = m.archetype === 'SAIL_KINETIC' ? 'sail' : m.warhead ? 'nuclear' : 'craft';
      s.stroke([cx + Math.cos(ang) * r * 1.6, cy + Math.sin(ang) * r * 1.6, cx + Math.cos(ang + 2.5) * r, cy + Math.sin(ang + 2.5) * r, cx + Math.cos(ang - 2.5) * r, cy + Math.sin(ang - 2.5) * r], { closed: true, color: s.spectrum ? s.role(craftRole) : p.hot, glow: 1.2 });
      const trail = new Float64Array(10 * 3);
      for (let i = 0; i < 10; i++) {
        const t = Math.max(m.launchTime, w.t - (i * 20 * DAY));
        const ts = stateAt(el, w.star.mu, t);
        trail[i * 3] = ts.r.x;
        trail[i * 3 + 1] = ts.r.y;
        trail[i * 3 + 2] = ts.r.z ?? 0;
      }
      this.polyline(trail, { color: s.spectrum ? s.role(craftRole) : p.ink, glow: 0.4, width: 1, alpha: 0.7, ...(s.spectrum && ROLE_STYLE[craftRole].dash.length > 0 ? { dash: ROLE_STYLE[craftRole].dash } : {}) });
      drawText(s, m.id, cx + 8, cy - 12, 9, { color: p.dim, glow: 0 });
    }
  }

  /** Missions with legs: coast arcs from their elements, sail arcs from samples, a flyby marker at the planet. */
  private drawLegs(m: Mission): void {
    const s = this.s;
    const p = s.palette;
    const w = this.world;
    if (!m.legs) return;
    for (const leg of m.legs) {
      if (leg.kind === 'COAST') {
        const n = 40;
        const arc = new Float64Array(n * 3);
        for (let i = 0; i < n; i++) {
          const t = leg.tFrom + ((leg.tTo - leg.tFrom) * i) / (n - 1);
          const st = stateAt(leg.elements, w.star.mu, t);
          arc[i * 3] = st.r.x;
          arc[i * 3 + 1] = st.r.y;
          arc[i * 3 + 2] = st.r.z ?? 0;
        }
        this.polyline(arc, { color: p.ink, glow: 0, width: 1, alpha: 0.35, dash: [2, 5] }, 3);
      } else if (leg.kind === 'SAIL') {
        // Every 8th sample keeps the stroke cheap; the arc is smooth anyway.
        const n = Math.floor(leg.samples.length / 2);
        const pts: number[] = [];
        for (let i = 0; i < n; i += 8) pts.push(leg.samples[i * 2] as number, leg.samples[i * 2 + 1] as number);
        this.polyline(Float64Array.from(pts), { color: p.ink, glow: 0.3, width: 1, alpha: 0.5 });
      } else if (leg.kind === 'FLYBY') {
        const pl = planetById(w, leg.planetId);
        const ps = planetState(w, pl, leg.t);
        const [x, y] = this.project(ps.r.x, ps.r.y);
        s.circle(x, y, 10, { color: p.hot, glow: 0.6, width: 1, dash: [2, 3], alpha: w.t < leg.t ? 0.7 : 0.3 });
      }
    }
    if (w.t < m.launchTime || w.t >= m.arrivalTime) return;
    const pos = craftPosition(m, w.star.mu, w.t);
    if (!pos) return;
    const [cx, cy] = this.project(pos.x, pos.y, pos.z ?? 0);
    const prev = craftPosition(m, w.star.mu, Math.max(m.launchTime, w.t - 2 * DAY));
    const ang = prev ? Math.atan2(-(pos.y - prev.y), pos.x - prev.x) : 0;
    const r = 5;
    s.stroke([cx + Math.cos(ang) * r * 1.6, cy + Math.sin(ang) * r * 1.6, cx + Math.cos(ang + 2.5) * r, cy + Math.sin(ang + 2.5) * r, cx + Math.cos(ang - 2.5) * r, cy + Math.sin(ang - 2.5) * r], { closed: true, color: p.hot, glow: 1.2 });
    const trail: number[] = [];
    for (let i = 0; i < 10; i++) {
      const q = craftPosition(m, w.star.mu, Math.max(m.launchTime, w.t - i * 20 * DAY));
      if (q) trail.push(q.x, q.y);
    }
    if (trail.length >= 4) this.polyline(Float64Array.from(trail), { color: p.ink, glow: 0.4, width: 1, alpha: 0.7 });
    drawText(s, m.id, cx + 8, cy - 12, 9, { color: p.dim, glow: 0 });
  }

  /** GAME_PLAN 30 props: the detour sign with its cones, and Planet X circling far out (it never arrives). */
  private drawFictionProps(): void {
    const s = this.s;
    const p = s.palette;
    if (this.detourAt) {
      const [x, y] = this.project(this.detourAt.x, this.detourAt.y);
      const c = s.spectrum ? s.role('threat') : p.hot;
      s.stroke([x - 18, y - 30, x + 18, y - 30, x + 18, y - 18, x - 18, y - 18], { closed: true, color: c, glow: 1 });
      s.stroke([x, y - 18, x, y - 2], { color: c, glow: 0.6 });
      drawText(s, 'DETOUR', x, y - 27, 7, { align: 'center', color: c, glow: 0.8 });
      for (let i = -2; i <= 2; i++) s.stroke([x + i * 9 - 3, y + 6, x + i * 9, y, x + i * 9 + 3, y + 6], { closed: true, color: s.spectrum ? s.role('nuclear') : p.ink, glow: 0.5 });
    }
    if (this.nibiru) {
      const a = (this.world.t / (365.25 * 86400)) * 0.05;
      const r = Math.min(s.width, s.height) * 0.47;
      const x = s.width / 2 + Math.cos(a) * r + this.panX;
      const y = s.height / 2 + Math.sin(a) * r + this.panY;
      s.circle(x, y, 9, { color: s.spectrum ? s.role('fragment') : p.dim, dash: [3, 3], glow: 0.6 });
      drawText(s, 'PLANET X (ARRIVING)', x + 13, y - 4, 8, { color: s.spectrum ? s.role('fragment') : p.dim, glow: 0 });
    }
  }

  private drawThreat(): void {
    const s = this.s;
    const p = s.palette;
    const w = this.world;
    const th = w.threat;
    if (!th) return;
    const el = this.result ? elementsAt(this.result.segments, w.t) : th.elements;
    if (!this.threatOrbitCache || this.threatOrbitCache.el !== el) this.threatOrbitCache = { el, pts: is3D(el) ? orbitPoints3(el, 360) : orbitPoints(el, 360) };
    const orbitStyle = { closed: el.e < 1, color: s.spectrum ? s.role('threat') : p.ink, glow: 0, width: 1, alpha: 0.55, dash: [3, 6] };
    if (is3D(el)) this.polyline(this.threatOrbitCache.pts, orbitStyle, 3);
    else if (th.incl) {
      // Off the plane (3-D lite): the track is tilted about the impact node; tilt the camera (I) to see it rise.
      const pts = this.threatOrbitCache.pts;
      const buf3: number[] = [];
      for (let i = 0; i < pts.length; i += 2) buf3.push(...this.threat3(pts[i] as number, pts[i + 1] as number));
      s.stroke(buf3, orbitStyle);
    } else this.polyline(this.threatOrbitCache.pts, orbitStyle);

    if (this.ghost) {
      const [gx, gy] = this.project(this.ghost.x, this.ghost.y);
      this.hit(gx - 14, gy - 14, 28, 28, 'O12', 'WHERE THE TARGET WILL BE AT IMPACT');
      s.circle(gx, gy, 9, { color: p.hot, glow: 0.8, width: 1, dash: [2, 3] });
      for (const [dx, dy] of [[-14, 0], [5, 0], [0, -14], [0, 5]] as const) {
        s.stroke([gx + dx, gy + dy, gx + dx + (dx === 0 ? 0 : 9), gy + dy + (dy === 0 ? 0 : 9)], { color: p.hot, glow: 0.6 });
      }
    }

    // Every body alive now: the threat (or its remnant) as the seeded polygon, fragments as small ones.
    const bodies = this.result ? this.result.bodies.filter((b) => bodyAlive(b, w.t)) : [];
    const buf: number[] = [];
    for (const b of bodies) {
      const bel = elementsAt(b.segments, w.t);
      let st = stateAt(bel, w.star.mu, w.t);
      // During a push segment (a finite tFrom..tTo followed by the pushed orbit) blend toward the post-push orbit
      // by the square of the elapsed fraction (displacement under constant thrust grows as t^2), so the body
      // drifts onto its new path instead of jumping at the end of the push (IDEAS 18).
      const si = b.segments.findIndex((sg) => w.t >= sg.tFrom && w.t < sg.tTo);
      const sg = b.segments[si];
      const after = b.segments[si + 1];
      if (sg && after && Number.isFinite(sg.tTo) && sg.tTo - sg.tFrom > 86400 && after.tFrom === sg.tTo) {
        const f = (w.t - sg.tFrom) / (sg.tTo - sg.tFrom);
        const post = stateAt(after.elements, w.star.mu, w.t);
        const k2 = f * f;
        const z = st.r.z !== undefined || post.r.z !== undefined ? { z: (st.r.z ?? 0) + ((post.r.z ?? 0) - (st.r.z ?? 0)) * k2 } : {};
        st = { ...st, r: { x: st.r.x + (post.r.x - st.r.x) * k2, y: st.r.y + (post.r.y - st.r.y) * k2, ...z } };
      }
      const [tx, ty] = this.threat3(st.r.x, st.r.y, st.r.z);
      this.hit(tx - 12, ty - 12, 24, 24, b.role === 'FRAGMENT' ? 'D4' : 'T5', b.role === 'FRAGMENT' ? `${b.id}: FRAGMENTS` : `${th.name}: WHAT IT IS MADE OF`);
      const n = th.shape.length;
      const size = b.role === 'THREAT' ? 6 : b.role === 'REMNANT' ? 4.5 : Math.max(1.5, Math.min(3.5, b.D / 30));
      buf.length = 0;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + w.t * 1e-7;
        const rr = size * (th.shape[i] as number);
        buf.push(tx + rr * Math.cos(a), ty + rr * Math.sin(a));
      }
      // SPECTRUM (24.1): threat amber, fragments magenta, each with its paired line style; else hot ink.
      const role = b.role === 'FRAGMENT' ? 'fragment' : 'threat';
      const col = b.harmless ? p.dim : s.spectrum ? s.role(role) : p.hot;
      const dash = s.spectrum && ROLE_STYLE[role].dash.length > 0 ? { dash: ROLE_STYLE[role].dash } : {};
      if (this.cam.pitch > 0 && b.role !== 'FRAGMENT') {
        // Tilted view: a seeded wireframe polyhedron tumbling (24.3).
        for (const seg of polyhedron(this.cam, tx, ty, size * 1.1, w.t * 2e-7, th.shape)) s.stroke(seg, { color: col, glow: 1 });
      } else s.stroke(buf, { closed: true, color: col, glow: b.role === 'FRAGMENT' ? 0.6 : 1.5, width: b.role === 'FRAGMENT' ? 0.8 : 1.25, ...dash });
      if (b.role !== 'FRAGMENT') drawText(s, b.role === 'THREAT' ? th.name : `${th.name} ${b.id}`, tx + 10, ty - 14, 10, { color: col === p.dim ? p.dim : col, glow: 0.5 });
    }
    if (bodies.length === 0) {
      const st = stateAt(el, w.star.mu, w.t);
      const [tx, ty] = this.threat3(st.r.x, st.r.y, st.r.z);
      drawText(s, th.name, tx + 10, ty - 14, 10, { color: p.dim, glow: 0 });
    }
  }

  private drawHud(): void {
    const s = this.s;
    const p = s.palette;
    const w = this.world;
    const m = 16;
    const th = w.threat;
    const res = this.result;
    if (!th || !res) return;

    drawText(s, formatCountdown(th.tImpact - w.t), m, m, 14, { color: p.hot, glow: 1.2 });
    this.hit(m, m, 200, 40, 'G2', 'CLOCK AND WARP');
    // An always-visible way into help: a small box under the readouts, clickable (the MANUAL key, M by default, also opens it).
    const hb = { x: s.width - m - 150, y: m + 44, w: 150, h: 22 };
    s.stroke([hb.x, hb.y, hb.x + hb.w, hb.y, hb.x + hb.w, hb.y + hb.h, hb.x, hb.y + hb.h], { closed: true, color: p.dim, glow: 0 });
    drawText(s, `${keyName('MANUAL')} MANUAL  ${keyName('LORE')} LORE`, hb.x + hb.w / 2, hb.y + 6, 9, { align: 'center', color: p.ink, glow: 0.3 });
    this.hit(hb.x, hb.y, hb.w, hb.h, 'HELP', 'THE MANUAL');
    this.hit(m, m + 44, 240, 20, 'G4', 'BUDGET: PROGRAMS AND MISSIONS');
    // The clock / warp / budget column on the left; the centred readouts use the space to its right.
    const leftW = 2 * m + Math.max(measureText(`WARP ${warpLabel(w)}`, 14), measureText(`BUDGET ${budgetAt(this.run.economy, w.t).toFixed(1)}  (+${this.run.economy.perYear}/Y)`, 12)) * getTextScale();
    const rx = (leftW + s.width - m) / 2;
    const rw = s.width - m - leftW;
    drawText(s, `WARP ${warpLabel(w)}`, m, m + 24, 14, { color: w.warp === 0 ? p.hot : p.ink, glow: w.warp === 0 ? 1.5 : 1 });
    drawText(s, `BUDGET ${budgetAt(this.run.economy, w.t).toFixed(1)}  (+${this.run.economy.perYear}/Y)`, m, m + 48, 12);
    drawText(s, `SCORE ${this.run.score}   RESEARCH ${this.run.research}   MISSIONS ${this.missions.length}${this.run.evacuatedAt !== null ? '   EVACUATED' : ''}${this.run.sandbox ? '   SANDBOX (NOT RECORDED)' : ''}${this.run.tutorial ? '   TUTORIAL (NOT RECORDED)' : ''}`, m, m + 68, 12, { color: this.run.sandbox ? p.hot : p.dim, glow: 0 });
    if (this.noteT > 0) drawText(s, this.noteText, s.width / 2, m + 40, 12, { align: 'center', color: p.hot, glow: 1, alpha: Math.min(1, this.noteT) });
    if (th.noWarning) drawText(s, 'NO WARNING: SENSED AT ATMOSPHERIC ENTRY. CIVIL DEFENSE ONLY (<E> EVACUATE).', s.width / 2, m + 58, 12, { align: 'center', color: p.hot, glow: 1.2 });
    if (this.phase === 'planning' && this.missions.length > 0 && !craftRemaining(res.missionsResolved, w.t)) drawText(s, 'NO CRAFT IN FLIGHT: PLAN OR LET IT PLAY OUT', m, m + 96, 10, { color: p.dim, glow: 0 });
    if (this.phase === 'planning' && this.settings.tips !== false && !this.tut && !this.tele.isOpen) {
      const tip = pickTip({ missions: this.missions.length, inFlight: craftRemaining(res.missionsResolved, w.t), budget: budgetAt(this.run.economy, w.t), leadLeftYears: (th.tImpact - w.t) / YEAR, predictedMiss: res.outcome === 'MISS' }, Math.floor(performance.now() / 1000 / KNOBS.TIP_SECONDS));
      if (tip) drawTextFit(s, `TIP  ${tip.text}`, s.width - m, s.height - m - 50, 9, Math.min(620, s.width * 0.5), { align: 'right', color: s.spectrum ? s.role('program') : p.dim, glow: 0.2 });
    }

    const kms = (res.ca.vInf / 1000).toFixed(1);
    const mt = res.energy.energyMt.toFixed(res.energy.energyMt < 10 ? 1 : 0);
    drawTextFit(s, `THREAT BRIEF  ${th.name}  ${th.targetId && th.targetId !== 'HOME' ? `TARGET ${targetOf(w, th.targetId).label}  ` : ''}${th.flavor ? th.flavor + ' ' : ''}${th.type.label}  D ${th.D.toFixed(0)} M  E ${mt} MT  ${res.category}  FOUND BY ${th.discoveredBy ?? 'INFRASOUND'}`, rx, m, 12, rw, { align: 'center' });
    this.hit(rx - rw / 2, m, rw, 18, 'T2', 'THREAT BRIEF: HOW BIG IS DANGEROUS');
    const margin = res.ca.marginRadii;
    const pred = res.outcome === 'HIT' ? `PREDICTED IMPACT  MARGIN ${margin.toFixed(2)} R` : res.outcome === 'PARTIAL' ? `PREDICTED PARTIAL  ${res.hitEnergyMt.toFixed(1)} MT THROUGH` : `PREDICTED MISS  MARGIN +${margin.toFixed(2)} R`;
    // Tracking uncertainty (6.14): a Gaussian over the impact parameter with sigma_b = 3 sigma_v T_rem.
    const tier = this.trackingTier();
    const arcDays = Math.max(0, w.t) / DAY;
    const sv = sigmaVWithArc(tier, arcDays) * this.run.effects.sigmaVMult;
    const pTrack = impactProbability(res.ca.dMin, res.ca.bCrit, sigmaB(sv, Math.max(0, th.tImpact - w.t)));
    const pImpact = this.mc ? (1 - this.mc.pMiss).toFixed(2) : pTrack.toFixed(2);
    const frag = res.producedFragments ? `   BODIES ${res.outcomes.length}` : '';
    drawTextFit(s, `V-INF ${kms} KM/S   LEAD ${(th.tImpact / YEAR).toFixed(1)} Y   ${pred}   P(IMPACT) ${pImpact}${this.mc ? ` (MC N ${this.mc.n})` : ''}   TRACKING T${tier} SIGMA-V ${(sv * 1000).toFixed(1)} MM/S  P ${pTrack.toFixed(2)}${frag}`, rx, m + 18, 12, rw, { align: 'center', color: res.outcome === 'HIT' ? p.hot : p.dim, glow: res.outcome === 'HIT' ? 0.8 : 0 });
    this.hit(rx - rw / 2, m + 18, rw, 18, 'F9', 'PREDICTION AND P(IMPACT): RISK SCALES');

    // Play-by-play: the last six events whose time has passed.
    const passed = res.events.filter((e) => e.t <= w.t).slice(-6);
    let ly = s.height - m - 50 - passed.length * 15;
    for (const e of passed) {
      drawText(s, formatEvent(e, th.tImpact, this.run.reveal ? undefined : w.t), m, ly, 10, { color: p.dim, glow: 0 });
      ly += 15;
    }
    drawText(s, `ROUND ${w.round}   SEED ${w.runSeed}   SCALE ${this.scale}   MISS 4.1 R`, s.width - m, s.height - m - 30, 11, { align: 'right', color: p.dim, glow: 0 });
    drawTextFit(s, `<${keyName('PLANNER')}> PLANNER   <${keyName('TECH')}> TECH   <${keyName('PROGRAMS')}> PROGRAMS   <${keyName('PLANET')}> PLANET   <${keyName('EVACUATE')}> EVACUATE   <${keyName('PAUSE')}> PAUSE   ${keyName('WARP_DOWN')} ${keyName('WARP_UP')} WARP   ${keyName('RESOLVE')} RESOLVE   ${keyName('SCALE')} SCALE   ${keyName('TILT')} TILT   K SKY   Z RESET   X EXPORT   ${keyName('LORE')} LORE   ${keyName('LEARN')} LEARN   ${keyName('MANUAL')} MANUAL   ${keyName('AUTOPLAY')} WATCH   ESC TITLE`, s.width / 2, s.height - m - 12, 11, s.width - 32, { align: 'center', color: p.dim, glow: 0 });
  }

  private panel(w: number, h: number): { x: number; y: number } {
    const s = this.s;
    const x = (s.width - w) / 2;
    const y = (s.height - h) / 2;
    this.panelTop = y;
    s.ctx.fillStyle = withAlpha(s.palette.bg, 0.8);
    s.ctx.fillRect(0, 0, s.width, s.height);
    this.mat.frame(s, x, y, w, h, 1.2, this.settings.reduceMotion);
    return { x, y };
  }

  private drawDebrief(): void {
    const s = this.s;
    const p = s.palette;
    const th = this.world.threat;
    const res = this.result;
    const sc = this.score;
    if (!th || !res || !sc) return;
    const events = res.events.slice(-8);
    const pw = Math.min(900, s.width - 32);
    const { x, y } = this.panel(pw, 150 + events.length * 15 + 60 + gaugeHeight(undefined, false, true) + 24);
    const fitW = pw - 32;
    const cx = s.width / 2;
    // A hit that the run survives (evacuated, shielded, or a practice round) says so instead of "MISS BY -x".
    const site = th.targetId && th.targetId !== 'HOME' ? targetOf(this.world, th.targetId).label : null;
    const why = this.run.tutorial || this.tut?.script === 'DART' ? 'PRACTICE ROUND' : this.run.shield ? 'SHIELDED' : site ? `${site} LOST` : 'EVACUATED';
    const head = res.outcome === 'HIT' ? `HIT, SURVIVED: ${why}` : res.outcome === 'PARTIAL' ? `PARTIAL  ${res.hitEnergyMt.toFixed(1)} MT GOT THROUGH` : `MISS BY ${res.ca.marginRadii.toFixed(2)} R`;
    drawTextFit(s, head, cx, y + 22, 30, fitW, { align: 'center', color: p.hot, glow: 2 });
    drawTextFit(s, `${th.name}  ${th.type.label}  D ${th.D.toFixed(0)} M   CLOSEST APPROACH ${(res.ca.dMin / 1000).toFixed(0)} KM   B-CRIT ${(res.ca.bCrit / 1000).toFixed(0)} KM`, cx, y + 64, 12, fitW, { align: 'center' });
    let ly = y + 92;
    const firstIdx = res.events.length - events.length;
    events.forEach((e, i) => {
      const idx = firstIdx + i;
      const cur = idx === this.scrub;
      drawTextFit(s, (cur ? '> ' : '  ') + formatEvent(e, th.tImpact), x + 10, ly, 10, pw - 20, { color: cur ? p.hot : p.dim, glow: cur ? 0.8 : 0 });
      ly += 15;
    });
    ly += 8;
    drawTextFit(s, `BASE ${sc.base.toFixed(0)}  X OUTCOME ${sc.outcome.toFixed(2)}  X (1 + EFF ${sc.efficiency.toFixed(2)} + TIMING ${sc.timing.toFixed(2)} + STYLE ${sc.style.toFixed(2)})  =  ${sc.roundScore}   RESEARCH +${sc.research}`, cx, ly, 11, fitW, { align: 'center' });
    const cf = this.counterfactual;
    if (cf) {
      // The lesson in one line: what the round would have done without the player's missions.
      const moved = res.ca.marginRadii - cf.margin;
      drawTextFit(s, `WITHOUT YOUR MISSIONS: ${cf.outcome === 'HIT' ? 'IMPACT' : cf.outcome}, MARGIN ${cf.margin >= 0 ? '+' : ''}${cf.margin.toFixed(2)} R.   YOU MOVED IT ${moved >= 0 ? '+' : ''}${moved.toFixed(2)} R.`, cx, ly + 20, 11, fitW, { align: 'center', color: s.spectrum ? s.role('craft') : p.ink, glow: 0.6 });
      ly += 19;
    }
    drawTextFit(s, `RUN SCORE ${this.run.score}   ROUNDS SURVIVED ${this.run.roundsSurvived + 1}${this.run.exaggerated ? '   EXAGGERATED: INTERSTELLAR RATE ABOVE REAL' : ''}`, cx, ly + 20, 12, fitW, { align: 'center', color: p.hot, glow: 1 });
    drawTextFit(s, `FOUND BY ${th.discoveredBy ?? 'NOBODY'} WITH ${(th.tImpact / YEAR).toFixed(1)} Y OF LEAD.  A SUNWARD SENTINEL OR SPACE IR SURVEYOR BUYS LEAD TIME: <G> PROGRAMS`, cx, ly + 36, 10, fitW, { align: 'center', color: p.dim, glow: 0 });
    // Where this rock sat on the detection gauge: seen by design, or by luck.
    drawTextFit(s, this.gauge ? gaugeVerdict(th.D, th.tImpact, th.noWarning, this.gauge.needles.DEFLECT) : `THIS ROCK: ${th.D.toFixed(0)} M. THE DETECTION GAUGE IS STILL COMPUTING.`, cx, ly + 54, 10, fitW, { align: 'center', color: uiColors(p, s.spectrum).sub, glow: 0.5 });
    drawGauge(s, this.gauge, x + 16, ly + 72, pw - 32, { rock: th.D, title: false });
    ly += gaugeHeight(undefined, false, true) + 24;
    drawTextFit(s, '<SPACE> NEXT ROUND   <T> TECH   <G> PROGRAMS   LEFT/RIGHT SCRUB   <H> HIDE PANEL   <V> PLANET   <ESC> TITLE', cx, ly + 56, 13, fitW, { align: 'center', color: p.hot, glow: 1.5 });
  }

  private drawOver(): void {
    const s = this.s;
    const p = s.palette;
    const th = this.world.threat;
    const res = this.result;
    if (!th || !res) return;
    const pw = Math.min(900, s.width - 32);
    const { y } = this.panel(pw, 276);
    const fitW = pw - 32;
    const cx = s.width / 2;
    drawTextFit(s, 'IMPACT', cx, y + 26, 34, fitW, { align: 'center', color: p.hot, glow: 2 });
    drawTextFit(s, `${th.name}  ${th.type.label}  D ${th.D.toFixed(0)} M`, cx, y + 80, 14, fitW, { align: 'center' });
    drawTextFit(s, `${res.energy.energyMt.toFixed(res.energy.energyMt < 10 ? 1 : 0)} MT   ${res.category}   V-IMPACT ${(res.ca.vImpact / 1000).toFixed(1)} KM/S`, cx, y + 106, 14, fitW, { align: 'center' });
    drawTextFit(s, `CLOSEST APPROACH ${(res.ca.dMin / 1000).toFixed(0)} KM   B-CRIT ${(res.ca.bCrit / 1000).toFixed(0)} KM   MARGIN ${res.ca.marginRadii.toFixed(2)} R`, cx, y + 132, 12, fitW, { align: 'center', color: p.dim, glow: 0 });
    const cf = this.counterfactual;
    if (cf) {
      // After a loss the useful number is how far short the plan fell.
      const moved = res.ca.marginRadii - cf.margin;
      drawTextFit(s, `YOUR MISSIONS MOVED IT ${moved >= 0 ? '+' : ''}${moved.toFixed(2)} R. IT NEEDED ${(-res.ca.marginRadii).toFixed(2)} R MORE: EARLIER, OR A SECOND IMPACTOR.`, cx, y + 156, 11, fitW, { align: 'center', color: s.spectrum ? s.role('craft') : p.ink, glow: 0.6 });
    }
    drawTextFit(s, `RUN OVER   ROUNDS SURVIVED ${this.run.roundsSurvived}   RUN SCORE ${this.run.score}${this.rank > 0 ? `   LEADERBOARD RANK ${this.rank}` : this.run.sandbox ? '   SANDBOX: NOT RECORDED' : ''}`, cx, y + 184, 12, fitW, { align: 'center' });
    drawTextFit(s, '<SPACE> NEW RUN   LEFT/RIGHT SCRUB   <H> HIDE PANEL   <V> PLANET   <ESC> TITLE', cx, y + 230, 13, fitW, { align: 'center', color: p.hot, glow: 1.5 });
  }
}
