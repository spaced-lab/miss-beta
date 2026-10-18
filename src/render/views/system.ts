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

import { KNOBS } from '../../config/knobs';
import { budgetAt, spend } from '../../game/economy';
import { recordRun } from '../../game/leaderboard';
import { createRun, nextRound, type RunState } from '../../game/run';
import { scoreRound, type ScoreBreakdown } from '../../game/scoring';
import type { Router, Screen } from '../../game/screen';
import { AU, DAY, YEAR } from '../../physics/constants';
import { stateToElements } from '../../physics/elements';
import { orbitPoints, propagate, type Elements } from '../../physics/kepler';
import type { MonteCarloResult } from '../../planner/monteCarlo';
import { PlannerClient } from '../../planner/workerClient';
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
import { withAlpha } from '../palettes';
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
import { advanceTutorial, createTutorial, TUTORIAL_SEED, TUTORIAL_SEEN_KEY, TUTORIAL_STEPS, type TutorialFacts, type TutorialState } from '../../game/tutorial';
import { saveJson } from '../../game/persistence';
import { DEFAULT_SETTINGS, type Settings } from '../../game/settings';
import { scenarioById, spawnScenario } from '../../sim/scenarios';
import { shiftEpoch } from '../../sim/roundGen';
import { craftPosition } from '../../planner/legs';
import { hashSeed, Rng } from '../../sim/rng';
import { applyEffects, createPrograms, programById } from '../../sim/programs';
import { stateToElements as toElements } from '../../physics/elements';
import { sphereMass } from '../../physics/closeApproach';
import { boardFor } from '../../game/modes';
import { advancePrograms } from '../../sim/programs';
import { exportSave, saveRun } from '../../game/savegame';
import { Teletype } from './teletype';
import { Cinematics } from '../cinematics/index';
import type { CineContext } from '../cinematics/scene';
import { cloudNarrative, debriefNarrative, evacuateNarrative, eventNarrative, lessonFor, roundStartNarrative } from '../../game/narrative';
import { craftRemaining, WarpDown } from '../../game/warpDown';
import { pickTip, TIP_SECONDS } from '../../game/tips';
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
  private rank = -1;
  private zoom = 1;
  private panX = 0;
  private panY = 0;
  private readonly orbitCache = new Map<string, Float64Array>();
  private threatOrbitCache: { el: Elements; pts: Float64Array } | null = null;
  private readonly craftCache = new Map<string, Elements>();
  private ghost: { x: number; y: number } | null = null;
  private readonly client = new PlannerClient();
  private readonly planner: PlannerOverlay;
  private readonly planet: PlanetOverlay;
  private readonly programs: ProgramsOverlay;
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
  private approachSounded = false;

  constructor(private readonly s: Surface, private readonly keys: Input, private readonly router: Router, private readonly settings: Settings = DEFAULT_SETTINGS, private readonly sfx: UiSfx | null = null, openCenter: ((id: string, level: Level) => void) | null = null) {
    this.lore = new LorePanel(s, keys);
    this.lore.onCenter = openCenter;
    this.world = createWorld('DEV', 1);
    this.run = createRun('DEV');
    this.planner = new PlannerOverlay(s, keys, this.client);
    this.planet = new PlanetOverlay(s);
    this.programs = new ProgramsOverlay(s, keys);
    this.tech = new TechOverlay(s, keys);
    this.console = new ConsoleOverlay(s, keys);
    this.tele = new Teletype(s);
    const toCenter = (id: string): void => {
      setWarp(this.world, 0);
      openCenter?.(id, this.settings.learningLevel as Level);
    };
    this.tech.openLore = toCenter;
    this.programs.openLore = toCenter;
    this.cine = new Cinematics(s, () => this.settings.reduceMotion);
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
    if (this.run.mode === 'REALISTIC') return { trackingTier: tier };
    const done = (id: string): number | null => this.run.programs.find((p) => p.id === id)?.completedAt ?? null;
    return {
      trackingTier: tier,
      scifi: {
        orbitalLaserW: this.run.effects.orbitalLaserW,
        laserSince: done('ORBITAL_LASER_ARRAY'),
        disassemblerTauYears: this.run.effects.disassemblerTauYears,
        disassemblerSince: done('DISASSEMBLER_SWARM'),
        netTier: this.run.netTier,
        nanoforgeSince: done('NANOFORGE_SEEDS'),
        thrusterSwarmSince: done('THRUSTER_SWARM'),
        shepherdSince: done('SHEPHERD_NETWORK'),
        fusionTugN: this.run.effects.fusionTugN,
        fusionTugSince: done('FUSION_TUG_FLEET'),
      },
    };
  }

  private trackingTier(): number {
    return this.run.sandbox ? 2 : Math.max(this.run.trackingTier, this.run.effects.trackingTier);
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
    const step = TUTORIAL_STEPS[t.step];
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
    drawTextFit(s, `TUTORIAL ${t.step + 1} / ${TUTORIAL_STEPS.length}   ${step.title}`, x + 12, y + 10, 12, inner, { color: p.hot, glow: 1, alpha });
    let ly = y + 32;
    for (const line of body) {
      drawText(s, line, x + 12, ly, 9, { color: p.ink, glow: 0.3, alpha });
      ly += lineH;
    }
    drawTextFit(s, `<TAB> SKIP TUTORIAL   <?> LORE ${step.lore.join(' ')}   <L> LEARNING CENTER   <F1> MANUAL`, x + 12, y + h - 16, 9, inner, { color: p.ink, glow: 0.3, alpha });
  }

  /** The next NEW RUN is a sandbox (set by the title before routing here). */
  sandboxNext = false;

  private startRound(): void {
    const { seed, round } = this.run;
    this.world = createWorld(seed, round);
    // The run's networks (programs may have added some) drive discovery; the world keeps the live copy.
    if (this.run.networks.active.length === 0) this.run.networks = { active: [...this.world.networks.active], since: {} };
    this.world.networks = this.run.networks;
    const rng = roundRng(seed, round);
    if (this.run.spawnNext) {
      const sc = scenarioById(this.run.spawnNext);
      this.world.threat = sc ? spawnScenario(sc, this.world, rng) : generateThreat(rng, this.world, round);
      this.run.spawnNext = null;
    } else if (this.run.leadTimeNext !== null) {
      // LEADTIME n: the plain draw with the lead forced (the clock starts now).
      const th = generateThreat(rng, this.world, round, 0, { skipDiscovery: true, scifi: this.run.mode !== 'REALISTIC' });
      // Re-time: keep the geometry, move the impact epoch by shifting the epoch of everything (world.t is 0 here).
      const shift = th.tImpact - this.run.leadTimeNext * YEAR;
      for (const p of this.world.planets) (p as { elements: typeof p.elements }).elements = shiftEpoch(p.elements, shift);
      this.world.threat = { ...th, elements: shiftEpoch(th.elements, shift), tImpact: th.tImpact - shift };
      this.run.leadTimeNext = null;
    } else {
      this.world.threat = generateThreat(rng, this.world, round, 0, { scifi: this.run.mode !== 'REALISTIC' });
    }
    if (this.run.mode !== 'REALISTIC' && this.run.economy.perYear < KNOBS.BUDGET_PER_YEAR * budgetScale(this.run.mode)) {
      // SCI-FI and beyond: budget scale x10 (21.2), applied once.
      this.run.economy.perYear *= budgetScale(this.run.mode);
      this.run.economy.start *= budgetScale(this.run.mode);
    }
    this.mv = null;
    this.glitch = this.run.mode === 'SIMULATION' || this.run.mode === 'MULTIVERSE';
    this.run.evacuatedAt = null;
    this.tutSeen = { maxWarp: 0, plannerOpened: false, planetOpened: false, programsOpened: false };
    if (!this.run.tutorial) saveRun(this.run, this.world, null);
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
    const home = planetById(this.world, 'HOME');
    const hs = planetState(this.world, home, this.world.threat.tImpact);
    this.ghost = { x: hs.r.x, y: hs.r.y };
    this.warpDown = new WarpDown();
    this.cine.clear();
    this.tele.clear();
    this.pendingFinish = false;
    this.approachSounded = false;
    this.detourAt = null;
    this.nibiru = false;
    this.ticketFiled = false;
    // The tutorial round starts paused (step 1 asks for SPACE) and its first step already explains the brief.
    if (this.run.tutorial) setWarp(this.world, 0);
    else if (this.result) this.tele.push(roundStartNarrative(this.world.threat, this.result, this.world, this.sunwardActive()));
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
      launcherTier: this.run.launcherTier,
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
      buildTime: this.run.effects.buildTimeYears * YEAR,
      budget: budgetAt(this.run.economy, this.world.t),
      onCommit: (ms: Mission[]): boolean => {
        const cost = ms.reduce((a, m) => a + m.cost, 0);
        if (!spend(this.run.economy, this.world.t, cost)) return false;
        this.sfx?.commit();
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
    const available = this.run.economy.start + (this.run.economy.perYear * this.world.t) / YEAR;
    // Civil defense (18.6): an evacuated AIRBURST/CITY hit ordered early enough scores as PARTIAL x0.25 and the run continues.
    const evacOk = this.run.evacuatedAt !== null && th.tImpact - this.run.evacuatedAt >= this.run.effects.evacMinDays * DAY;
    const survivable = (res.outcome === 'HIT' && evacOk && (res.category === 'AIRBURST' || res.category === 'CITY')) || (res.outcome === 'HIT' && this.run.shield);
    if (this.run.noclip && res.outcome === 'HIT') {
      // NOCLIP: HOME is non-colliding this round; the resolver's numbers stand, the outcome is a miss.
      this.result = { ...res, outcome: 'MISS' };
    }
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
    if (!this.approachSounded) this.sfx?.approach(finalOutcome === 'HIT');
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
    if (finalOutcome !== 'HIT') {
      this.run.score += Math.round(this.score.roundScore * this.run.effects.researchMult) === this.score.roundScore ? this.score.roundScore : this.score.roundScore;
      this.run.research += Math.floor(this.score.research * this.run.effects.researchMult);
      this.phase = 'debrief';
      if (!this.run.tutorial) saveRun(this.run, this.world, null);
    } else {
      this.phase = 'over';
      this.rank = this.run.sandbox || this.run.tutorial ? -1 : recordRun({ handle: 'PLAYER', rounds: this.run.roundsSurvived, score: this.run.score, seed: this.run.seed, date: this.run.startedAt, tech: `L${this.run.launcherTier} I${this.run.impactorTier}`, assisted: this.run.assisted }, boardFor(this.run.mode));
    }
  }

  update(dtMs: number): void {
    const k = this.keys;
    const w = this.world;
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
    if (k.pressed('Escape')) {
      this.router.go('title');
      return;
    }
    if (this.lore.isOpen) {
      this.lore.update();
      return;
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
    if (k.pressed('F1')) {
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
      this.programs.update(this.run);
      return;
    }
    if (this.tech.isOpen) {
      this.tech.update(this.run);
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
      if (k.pressed('KeyG')) this.programs.show();
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
    if (k.pressed('KeyG')) {
      setWarp(w, 0);
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
    if (k.pressed('BracketRight')) setWarp(w, w.warp + 1);
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
      saveRun(this.run, this.world, null);
      this.note(exportSave(this.run, this.world) ? 'SAVE.MD DOWNLOADED' : 'EXPORT UNAVAILABLE');
    }
    if (k.pressed('KeyR') && this.result) {
      this.finishRound();
      return;
    }
    const before = w.t;
    advance(w, Math.min(dtMs, 100) / 1000);
    if (this.result && w.t > before) this.onEventsPassed(this.result.events.filter((e) => e.t > before && e.t <= w.t));
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

  private project(x: number, y: number): [number, number] {
    const s = this.s;
    const base = (Math.min(s.width, s.height) / 2) * 0.9 * this.zoom;
    const r = Math.hypot(x, y);
    const rs = this.scale === 'COMPRESSED' ? (Math.sqrt(r / AU) / 2.5) * base : (r / AU / 5.6) * base;
    const f = r > 0 ? rs / r : 0;
    // Wireframe-3-D camera (24.3): the tilt is applied to screen offsets, so the physics never sees it.
    const [dx, dy] = tilt(this.cam, x * f, -y * f);
    return [s.width / 2 + this.panX + dx, s.height / 2 + this.panY + dy];
  }

  private polyline(pts: Float64Array, style: Parameters<Surface['stroke']>[1]): void {
    const buf: number[] = [];
    for (let i = 0; i < pts.length; i += 2) {
      const [px, py] = this.project(pts[i] as number, pts[i + 1] as number);
      buf.push(px, py);
    }
    this.s.stroke(buf, style);
  }

  render(): void {
    const s = this.s;
    const p = s.palette;
    const w = this.world;
    if (this.cine.isOpen) {
      this.cine.render(formatCountdown((w.threat?.tImpact ?? 0) - w.t));
      return;
    }
    s.clear();
    this.stars.draw(s, this.panX, this.panY, !this.settings.reduceMotion);
    if (this.matPhase !== this.phase) {
      this.matPhase = this.phase;
      this.mat.start();
    }
    this.mat.tick(1 / 60);

    const [sx, sy] = this.project(0, 0);
    const sr = 7;
    const starC = s.spectrum ? s.role('star') : p.hot;
    s.circle(sx, sy, sr, { color: starC, glow: 2 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      s.stroke([sx + Math.cos(a) * (sr + 3), sy + Math.sin(a) * (sr + 3), sx + Math.cos(a) * (sr + 8), sy + Math.sin(a) * (sr + 8)], { color: starC, glow: 1 });
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
    }

    if (this.mv) this.drawMultiverse(this.mv);
    else {
      this.drawCraft();
      this.drawThreat();
      this.drawFictionProps();
    }
    if (!this.planner.isOpen && !this.planetOpen && !this.programs.isOpen && !this.tech.isOpen) this.drawHud();
    if (this.planetOpen && !this.planner.isOpen) this.planet.render(this.world, this.result, this.mc);
    this.programs.render(this.run, budgetAt(this.run.economy, this.world.t), this.world.t);
    this.tech.render(this.run);
    if (!this.panelHidden && !this.tele.isModal) {
      if (this.phase === 'debrief') this.drawDebrief();
      if (this.phase === 'over') this.drawOver();
    } else if (this.phase !== 'planning') {
      drawTextFit(this.s, `REPLAY  ${formatCountdown((this.world.threat?.tImpact ?? 0) - this.world.t)}   LEFT / RIGHT STEP EVENTS   <H> PANEL   <V> PLANET   <SPACE> CONTINUE`, this.s.width / 2, this.s.height - 28, 12, this.s.width - 32, { align: 'center', color: this.s.palette.hot, glow: 1 });
    }
    this.planner.render();
    if (this.planner.isOpen && this.tut) {
      // The tutorial box is hidden under the planner, so the step it asks for is repeated in one line here.
      const hint = this.tut.step <= 3 ? 'TUTORIAL: UP / DOWN PICKS A PLAN, ENTER COMMITS THE TOP KINETIC PLAN. ESC CLOSES THE PLANNER.' : 'TUTORIAL: COMMITTED. ESC CLOSES THE PLANNER, THEN ] RUNS THE CLOCK.';
      drawTextFit(s, hint, s.width / 2, s.height - 50, 11, s.width - 32, { align: 'center', color: s.spectrum ? s.role('program') : p.hot, glow: 1 });
    }
    if (!this.planner.isOpen && !this.programs.isOpen && !this.tech.isOpen) this.drawTutorial();
    if (this.tele.isModal || (!this.planner.isOpen && !this.programs.isOpen && !this.tech.isOpen && !this.planetOpen)) this.tele.render(this.tele.isModal ? 'center' : 'dock');
    this.lore.render();
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
      const st = propagate(elementsAt(b.extraResult.segments, w.t), w.star.mu, w.t);
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
          const st = propagate(th.elements, this.world.star.mu, this.world.t);
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
            this.world.threat = { ...th, elements: el };
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
          const ahead = propagate(th.elements, this.world.star.mu, Math.min(th.tImpact - DAY, this.world.t + 30 * DAY)).r;
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
          el = stateToElements(hs.r, m.departureV, w.star.mu, m.launchTime);
        } catch {
          continue;
        }
        this.craftCache.set(m.id, el);
      }
      // Planned arc.
      const n = 48;
      const arc = new Float64Array(n * 2);
      for (let i = 0; i < n; i++) {
        const t = m.launchTime + ((m.arrivalTime - m.launchTime) * i) / (n - 1);
        const st = propagate(el, w.star.mu, t);
        arc[i * 2] = st.r.x;
        arc[i * 2 + 1] = st.r.y;
      }
      this.polyline(arc, { color: p.ink, glow: 0, width: 1, alpha: 0.35, dash: [2, 5] });
      if (w.t < m.launchTime || w.t >= m.arrivalTime) continue;
      const st = propagate(el, w.star.mu, w.t);
      const [cx, cy] = this.project(st.r.x, st.r.y);
      const ang = Math.atan2(-st.v.y, st.v.x);
      const r = 5;
      const craftRole = m.archetype === 'SAIL_KINETIC' ? 'sail' : m.warhead ? 'nuclear' : 'craft';
      s.stroke([cx + Math.cos(ang) * r * 1.6, cy + Math.sin(ang) * r * 1.6, cx + Math.cos(ang + 2.5) * r, cy + Math.sin(ang + 2.5) * r, cx + Math.cos(ang - 2.5) * r, cy + Math.sin(ang - 2.5) * r], { closed: true, color: s.spectrum ? s.role(craftRole) : p.hot, glow: 1.2 });
      const trail = new Float64Array(10 * 2);
      for (let i = 0; i < 10; i++) {
        const t = Math.max(m.launchTime, w.t - (i * 20 * DAY));
        const ts = propagate(el, w.star.mu, t);
        trail[i * 2] = ts.r.x;
        trail[i * 2 + 1] = ts.r.y;
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
        const arc = new Float64Array(n * 2);
        for (let i = 0; i < n; i++) {
          const t = leg.tFrom + ((leg.tTo - leg.tFrom) * i) / (n - 1);
          const st = propagate(leg.elements, w.star.mu, t);
          arc[i * 2] = st.r.x;
          arc[i * 2 + 1] = st.r.y;
        }
        this.polyline(arc, { color: p.ink, glow: 0, width: 1, alpha: 0.35, dash: [2, 5] });
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
    const [cx, cy] = this.project(pos.x, pos.y);
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
    if (!this.threatOrbitCache || this.threatOrbitCache.el !== el) this.threatOrbitCache = { el, pts: orbitPoints(el, 360) };
    this.polyline(this.threatOrbitCache.pts, { closed: el.e < 1, color: s.spectrum ? s.role('threat') : p.ink, glow: 0, width: 1, alpha: 0.55, dash: [3, 6] });

    if (this.ghost) {
      const [gx, gy] = this.project(this.ghost.x, this.ghost.y);
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
      const st = propagate(bel, w.star.mu, w.t);
      const [tx, ty] = this.project(st.r.x, st.r.y);
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
      const st = propagate(el, w.star.mu, w.t);
      const [tx, ty] = this.project(st.r.x, st.r.y);
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
      const tip = pickTip({ missions: this.missions.length, inFlight: craftRemaining(res.missionsResolved, w.t), budget: budgetAt(this.run.economy, w.t), leadLeftYears: (th.tImpact - w.t) / YEAR, predictedMiss: res.outcome === 'MISS' }, Math.floor(performance.now() / 1000 / TIP_SECONDS));
      if (tip) drawTextFit(s, `TIP  ${tip.text}`, s.width - m, s.height - m - 50, 9, Math.min(620, s.width * 0.5), { align: 'right', color: s.spectrum ? s.role('program') : p.dim, glow: 0.2 });
    }

    const kms = (res.ca.vInf / 1000).toFixed(1);
    const mt = res.energy.energyMt.toFixed(res.energy.energyMt < 10 ? 1 : 0);
    drawTextFit(s, `THREAT BRIEF  ${th.name}  ${th.flavor ? th.flavor + ' ' : ''}${th.type.label}  D ${th.D.toFixed(0)} M  E ${mt} MT  ${res.category}  FOUND BY ${th.discoveredBy ?? 'INFRASOUND'}`, rx, m, 12, rw, { align: 'center' });
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

    // Play-by-play: the last six events whose time has passed.
    const passed = res.events.filter((e) => e.t <= w.t).slice(-6);
    let ly = s.height - m - 50 - passed.length * 15;
    for (const e of passed) {
      drawText(s, formatEvent(e, th.tImpact, this.run.reveal ? undefined : w.t), m, ly, 10, { color: p.dim, glow: 0 });
      ly += 15;
    }
    drawText(s, `ROUND ${w.round}   SEED ${w.runSeed}   SCALE ${this.scale}   MISS 4.1 R`, s.width - m, s.height - m - 30, 11, { align: 'right', color: p.dim, glow: 0 });
    drawTextFit(s, '<P> PLANNER   <T> TECH   <G> PROGRAMS   <V> PLANET   <E> EVACUATE   <SPACE> PAUSE   [ ] WARP   R RESOLVE   S SCALE   I TILT   Z RESET   X EXPORT   ? LORE   L LEARN   F1 MANUAL   ESC TITLE', s.width / 2, s.height - m - 12, 11, s.width - 32, { align: 'center', color: p.dim, glow: 0 });
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
    const { x, y } = this.panel(pw, 150 + events.length * 15 + 100);
    const fitW = pw - 32;
    const cx = s.width / 2;
    drawTextFit(s, res.outcome === 'PARTIAL' ? `PARTIAL  ${res.hitEnergyMt.toFixed(1)} MT GOT THROUGH` : `MISS BY ${res.ca.marginRadii.toFixed(2)} R`, cx, y + 22, 30, fitW, { align: 'center', color: p.hot, glow: 2 });
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
    drawText(s, `BASE ${sc.base.toFixed(0)}  X OUTCOME ${sc.outcome.toFixed(2)}  X (1 + EFF ${sc.efficiency.toFixed(2)} + TIMING ${sc.timing.toFixed(2)} + STYLE ${sc.style.toFixed(2)})  =  ${sc.roundScore}   RESEARCH +${sc.research}`, cx, ly, 11, { align: 'center' });
    drawTextFit(s, `RUN SCORE ${this.run.score}   ROUNDS SURVIVED ${this.run.roundsSurvived + 1}`, cx, ly + 20, 12, fitW, { align: 'center', color: p.hot, glow: 1 });
    drawTextFit(s, `FOUND BY ${th.discoveredBy ?? 'NOBODY'} WITH ${(th.tImpact / YEAR).toFixed(1)} Y OF LEAD.  A SUNWARD SENTINEL OR SPACE IR SURVEYOR BUYS LEAD TIME: <G> PROGRAMS`, cx, ly + 36, 10, fitW, { align: 'center', color: p.dim, glow: 0 });
    drawTextFit(s, '<SPACE> NEXT ROUND   <T> TECH   <G> PROGRAMS   LEFT/RIGHT SCRUB   <H> HIDE PANEL   <V> PLANET   <ESC> TITLE', cx, ly + 56, 13, fitW, { align: 'center', color: p.hot, glow: 1.5 });
  }

  private drawOver(): void {
    const s = this.s;
    const p = s.palette;
    const th = this.world.threat;
    const res = this.result;
    if (!th || !res) return;
    const pw = Math.min(900, s.width - 32);
    const { y } = this.panel(pw, 260);
    const fitW = pw - 32;
    const cx = s.width / 2;
    drawTextFit(s, 'IMPACT', cx, y + 26, 34, fitW, { align: 'center', color: p.hot, glow: 2 });
    drawTextFit(s, `${th.name}  ${th.type.label}  D ${th.D.toFixed(0)} M`, cx, y + 80, 14, fitW, { align: 'center' });
    drawTextFit(s, `${res.energy.energyMt.toFixed(res.energy.energyMt < 10 ? 1 : 0)} MT   ${res.category}   V-IMPACT ${(res.ca.vImpact / 1000).toFixed(1)} KM/S`, cx, y + 106, 14, fitW, { align: 'center' });
    drawTextFit(s, `CLOSEST APPROACH ${(res.ca.dMin / 1000).toFixed(0)} KM   B-CRIT ${(res.ca.bCrit / 1000).toFixed(0)} KM   MARGIN ${res.ca.marginRadii.toFixed(2)} R`, cx, y + 132, 12, fitW, { align: 'center', color: p.dim, glow: 0 });
    drawTextFit(s, `RUN OVER   ROUNDS SURVIVED ${this.run.roundsSurvived}   RUN SCORE ${this.run.score}${this.rank > 0 ? `   LEADERBOARD RANK ${this.rank}` : this.run.sandbox ? '   SANDBOX: NOT RECORDED' : ''}`, cx, y + 170, 12, fitW, { align: 'center' });
    drawTextFit(s, '<SPACE> NEW RUN   LEFT/RIGHT SCRUB   <H> HIDE PANEL   <V> PLANET   <ESC> TITLE', cx, y + 214, 13, fitW, { align: 'center', color: p.hot, glow: 1.5 });
  }
}
