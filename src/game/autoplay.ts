// WHAT: AUTOPLAY (IDEAS 19, owner 2026-10-18): the game plays itself and explains each step in info panes.
// WHY:  Watching a competent player is the fastest way to learn the loop (threat, porkchop, plan, warp, debrief).
//       The autopilot drives the real screens with the same keys a player presses, so what you watch is the game.
// HOW:  A pure state machine. Each frame the system screen hands it a read-only `AutoView`; it answers with
//       logical key codes to inject and, now and then, a pane to show. While a pane is up the autopilot waits,
//       so every explanation stays on screen for its reading time (`readSeconds`). Choices are deterministic
//       given the view (no Rng): the first affordable plan predicted to MISS, warheads last.
// LORE: G1 (how to play), G3 (reading the planner), D1 (impulse)

export interface AutoCand {
  readonly label: string;
  readonly outcome: string;
  readonly margin: number;
  readonly cost: number;
  readonly affordable: boolean;
  readonly warhead: boolean;
}

export interface AutoView {
  readonly round: number;
  readonly phase: 'planning' | 'debrief' | 'over';
  readonly threat: { readonly name: string; readonly D: number; readonly energyMt: number; readonly leadS: number; readonly kind: string } | null;
  readonly missions: number;
  readonly craftInFlight: boolean;
  /** The round's resolved outcome with the plans so far (the HUD's prediction once beta is known). */
  readonly predicted: string | null;
  /** Miss distance in Earth radii with the plans so far (negative: a hit). */
  readonly margin: number;
  readonly budget: number;
  readonly warp: number;
  readonly planner: { readonly open: boolean; readonly ready: boolean; readonly sel: number; readonly cands: readonly AutoCand[] };
  readonly overlayOpen: boolean;
  readonly teleModal: boolean;
  readonly teleComplete: boolean;
  readonly cine: boolean;
  readonly canEvacuate: boolean;
  readonly debrief: { readonly outcome: string; readonly score: number } | null;
  /** Debrief investments the screen can make now (pure picks, see chooseTech / chooseProgram), or null. */
  readonly invest?: { readonly tech: { readonly id: string; readonly name: string; readonly cost: number } | null; readonly program: { readonly id: string; readonly name: string; readonly costPerYear: number } | null };
}

export interface Pane {
  readonly title: string;
  readonly body: string;
  /** Seconds on screen. */
  readonly hold: number;
}

export interface AutoOut {
  keys: string[];
  pane: Pane | null;
  /** An investment the screen should make (it then shows the panel briefly so the viewer sees it happen). */
  invest?: { kind: 'TECH' | 'PROGRAM'; id: string };
}

/** Programs AUTOPLAY funds, in teaching order: coordination first, then finding rocks, then reacting [knob]. */
export const AUTO_PROGRAMS: readonly string[] = ['INTL_COORDINATION', 'GROUND_SURVEY_EXPANSION', 'SPACE_IR_SURVEYOR', 'SUNWARD_SENTINEL', 'PRECURSOR_FLEET', 'INTERCEPTOR_STOCKPILE', 'CIVIL_DEFENSE_READY', 'RADAR_NET'];
/** Fund a program only while the budget stays above this and all funded programs cost under half the income [knob]. */
export const AUTO_PROGRAM_RESERVE = 6;

/**
 * The cheapest tech node AUTOPLAY can unlock now, launch and impactor tracks first (they decide most rounds).
 * `nodes` carry their unlock verdict. Example: L2 (5, OK), I2 (4, OK) -> I2.
 */
export function chooseTech(nodes: readonly { id: string; name: string; track: string; cost: number; ok: boolean }[]): { id: string; name: string; cost: number } | null {
  const rank = (t: string): number => (t === 'LAUNCH' || t === 'IMPACTOR' ? 0 : 1);
  const best = nodes.filter((n) => n.ok).sort((a, b) => rank(a.track) - rank(b.track) || a.cost - b.cost)[0];
  return best ? { id: best.id, name: best.name, cost: best.cost } : null;
}

/**
 * The next program AUTOPLAY funds: the first in AUTO_PROGRAMS not yet funded or done, if nothing else is running
 * and the money allows (budget above the reserve, its cost under half the yearly income).
 */
export function chooseProgram(rows: readonly { id: string; name: string; costPerYear: number; funded: boolean; done: boolean }[], budget: number, perYear: number): { id: string; name: string; costPerYear: number } | null {
  if (rows.some((r) => r.funded && !r.done)) return null;
  if (budget < AUTO_PROGRAM_RESERVE) return null;
  for (const id of AUTO_PROGRAMS) {
    const r = rows.find((x) => x.id === id);
    if (r && !r.funded && !r.done && r.costPerYear <= perYear * 0.5) return { id: r.id, name: r.name, costPerYear: r.costPerYear };
  }
  return null;
}

/** Reading time for a pane [knob]: 2.5 s plus 0.32 s a word, between 4 and 14 s (slow readers get the long end). */
export const AUTO_READ = { base: 2.5, perWord: 0.32, min: 4, max: 14 } as const;
/** Seconds between injected selection steps and warp steps, so the viewer sees each move [knob]. */
export const AUTO_STEP_S = 0.45;
/** Warp index the autopilot flies at once plans are in (1 MONTH/S) [knob]. */
export const AUTO_CRUISE_WARP = 3;
/** Warp index once every craft has arrived and the rock will miss (1 YEAR/S): nothing left to watch [knob]. */
export const AUTO_COAST_WARP = 4;
/** Re-plans allowed per round after the craft have arrived and the rock still hits [knob]. */
export const AUTO_REPLANS = 2;
/** Partial plans stacked per planning pass when no single plan makes the rock miss [knob]. */
export const AUTO_STACK = 4;
/** With no useful plan: wait this long for the budget to grow before planning again [knob, s]. */
export const AUTO_RETRY_S = 31557600;
/** Order the evacuation once the impact is this close and the rock still hits [knob, s]. */
export const AUTO_EVAC_LEAD_S = 120 * 86400;

/** Seconds a pane of `text` stays up. Example: 20 words -> 2.5 + 6.4 = 8.9 s. */
export function readSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(AUTO_READ.min, Math.min(AUTO_READ.max, AUTO_READ.base + AUTO_READ.perWord * words));
}

function pane(title: string, body: string): Pane {
  return { title, body, hold: readSeconds(`${title} ${body}`) };
}

/** Index of the plan that makes the rock miss: affordable without a warhead first, then any affordable; -1 if none. */
export function choosePlan(cands: readonly AutoCand[]): number {
  const ok = cands.map((c, i) => ({ c, i })).filter((x) => x.c.affordable);
  const clean = ok.find((x) => x.c.outcome === 'MISS' && !x.c.warhead) ?? ok.find((x) => x.c.outcome === 'MISS');
  return clean ? clean.i : -1;
}

/**
 * No plan misses on its own: the affordable plan that improves the margin most over `margin` (pushes add up,
 * so it is committed and the planner re-ranks on top of it); -1 when nothing helps by at least 0.05 R.
 */
export function stackPlan(cands: readonly AutoCand[], margin: number): number {
  let best = -1;
  let bestM = margin + 0.05;
  cands.forEach((c, i) => {
    if (c.affordable && !c.warhead && c.margin > bestM) {
      best = i;
      bestM = c.margin;
    }
  });
  return best;
}

/** One teaching sentence per plan family, matched on the planner's label. */
export function explainPlan(label: string): string {
  if (label.startsWith('KINETIC-FLYBY')) return 'A planet flyby bends the craft onto a faster path for free, so it hits harder than a direct launch could.';
  if (label.startsWith('SAIL')) return 'A solar sail spirals in on sunlight alone, building speed for months before it is dropped onto the rock.';
  if (label.startsWith('NUKE')) return 'A nuclear burst heats one face of the rock and the blow-off pushes it. Strong, but it costs score.';
  if (label.startsWith('SLOW PUSH')) return 'A slow push (a tractor or a laser) nudges the rock for years. Tiny force, huge lead time.';
  if (label.startsWith('SWARM')) return 'A swarm sends several impactors in a row: if one misses or under-performs, the others still count.';
  if (label.startsWith('SPLIT')) return 'A split bus carries several impactors that separate late and hit one after another.';
  if (label.startsWith('PI')) return 'PI shreds the rock just before arrival; the pieces burn up as airbursts instead of one crater.';
  return 'A kinetic impactor hits the rock to change its speed by millimetres per second. Years ahead that is enough: the miss grows every orbit.';
}

type State = 'intro' | 'brief' | 'openPlanner' | 'waitGrid' | 'select' | 'commit' | 'closePlanner' | 'fly' | 'debrief' | 'over';

export class Autopilot {
  private state: State = 'intro';
  private wait = 0;
  private round = -1;
  private replans = 0;
  private target = -1;
  private gridWait = 0;
  private committedFrom = 0;
  private teleT = 0;
  private explainedPorkchop = false;
  private stacked = 0;
  private retryLead = -1;
  private evacPending = false;
  private stacking = false;
  private coastSaid = false;
  /** Multiplies real time (SUPER-DUPER-DEMO speeds this up); panes shrink with it. */
  speed = 1;
  /** Rounds watched since AUTOPLAY started. */
  rounds = 0;
  /** SUPER-DUPER-DEMO: cinematics are cut short and `speed` climbs every game. */
  demo = false;
  private cineT = 0;
  private invested = 0;

  step(v: AutoView, dtS: number): AutoOut {
    const out: AutoOut = { keys: [], pane: null };
    const dt = dtS * this.speed;
    this.wait = Math.max(0, this.wait - dt);
    // Cinematics play out on their own (the demo cuts them short); modal briefs are read, then dismissed.
    if (v.cine) {
      this.cineT += dt;
      if (this.demo && this.cineT > 3) {
        out.keys.push('Space');
        this.cineT = 0;
      }
      return out;
    }
    this.cineT = 0;
    if (v.teleModal) {
      this.teleT += dt;
      if (v.teleComplete && this.teleT > 5) {
        out.keys.push('Enter');
        this.teleT = 0;
      }
      return out;
    }
    this.teleT = 0;
    if (this.wait > 0) return out;
    const show = (p: Pane): AutoOut => {
      out.pane = p;
      this.wait = p.hold;
      return out;
    };
    if (v.phase === 'planning' && v.round !== this.round && this.state !== 'intro') {
      this.round = v.round;
      this.replans = 0;
      this.retryLead = -1;
      this.evacPending = false;
      this.coastSaid = false;
      this.state = 'brief';
    }
    if (v.phase === 'debrief' && this.state !== 'debrief') this.state = 'debrief';
    if (v.phase === 'over' && this.state !== 'over') this.state = 'over';

    switch (this.state) {
      case 'intro':
        this.state = 'brief';
        this.round = v.round;
        return show(pane('AUTOPLAY', 'The game plays itself and explains each step. Press A to take over at any time, Esc for the title.'));
      case 'brief': {
        const th = v.threat;
        if (v.overlayOpen) {
          out.keys.push('Escape');
          return out;
        }
        this.state = 'openPlanner';
        if (!th) return out;
        const years = th.leadS / 31557600;
        const lead = years >= 1 ? `${years.toFixed(1)} years` : `${Math.round(years * 365)} days`;
        return show(pane(`ROUND ${v.round}: ${th.name}`, `A ${th.kind} about ${th.D.toFixed(0)} m across is on a collision course: ${th.energyMt.toFixed(0)} megatons if it hits, in ${lead}. First we open the planner.`));
      }
      case 'openPlanner':
        if (v.planner.open) {
          this.state = 'waitGrid';
          this.gridWait = 0;
          return out;
        }
        out.keys.push('KeyP');
        this.state = 'waitGrid';
        this.gridWait = 0;
        this.wait = AUTO_STEP_S;
        return out;
      case 'waitGrid':
        // NOTE: real seconds, not demo seconds: the porkchop worker does not get faster with the demo.
        this.gridWait += dtS;
        if (!v.planner.open && this.gridWait > 2) {
          this.state = 'openPlanner';
          return out;
        }
        if (!v.planner.ready && this.gridWait < 30) return out;
        this.target = choosePlan(v.planner.cands);
        this.stacking = false;
        if (this.target < 0 && this.stacked < AUTO_STACK) {
          this.target = stackPlan(v.planner.cands, v.margin);
          this.stacking = this.target >= 0;
        }
        if (this.target < 0) {
          this.stacked = 0;
          this.state = 'closePlanner';
          const lead = v.threat?.leadS ?? 0;
          if (lead > AUTO_RETRY_S * 1.5) {
            this.retryLead = lead - AUTO_RETRY_S;
            return show(pane('NOT YET', 'No plan we can afford changes the outcome. The budget grows every year and new tech arrives, so we let a year pass and plan again. Waiting costs push, though: early is cheap.'));
          }
          this.evacPending = true;
          return show(pane('NO PLAN THAT WORKS', 'Every launch window left is too weak, too late or too expensive. Close to impact we order an evacuation: it saves lives even when the rock still lands.'));
        }
        this.state = 'select';
        if (!this.explainedPorkchop) {
          this.explainedPorkchop = true;
          return show(pane('THE PORKCHOP PLOT', 'Each dot is one launch date (across) and arrival date (up). Brighter dots need less launch energy. The planner ranks the best ones as plans on the right.'));
        }
        return out;
      case 'select': {
        const n = Math.max(1, v.planner.cands.length);
        if (!v.planner.open) {
          this.state = 'openPlanner';
          return out;
        }
        if (v.planner.sel !== this.target) {
          const down = (this.target - v.planner.sel + n) % n;
          out.keys.push(down <= n / 2 ? 'ArrowDown' : 'ArrowUp');
          this.wait = AUTO_STEP_S;
          return out;
        }
        const c = v.planner.cands[this.target];
        this.state = 'commit';
        if (!c) return out;
        if (this.stacking) return show(pane(`PLAN ${this.target + 1}: ${c.label}, STACKED`, `No single plan makes it miss, but pushes add up. This one moves the miss distance from ${v.margin.toFixed(2)} to ${c.margin.toFixed(2)} Earth radii for ${c.cost} of our ${v.budget.toFixed(1)}. We commit it and plan another on top.`));
        const why = `predicted to MISS by ${c.margin.toFixed(1)} Earth radii`;
        return show(pane(`PLAN ${this.target + 1}: ${c.label}`, `${explainPlan(c.label)} It costs ${c.cost} of our ${v.budget.toFixed(1)} budget and is ${why}.`));
      }
      case 'commit':
        this.committedFrom = v.missions;
        out.keys.push('Enter');
        this.state = 'closePlanner';
        this.wait = AUTO_STEP_S * 2;
        return out;
      case 'closePlanner':
        if (v.planner.open) {
          out.keys.push('Escape');
          this.wait = AUTO_STEP_S;
          return out;
        }
        if (this.stacking && v.missions > this.committedFrom) {
          this.stacked++;
          this.stacking = false;
          this.state = 'openPlanner';
          this.wait = AUTO_STEP_S * 2;
          return out;
        }
        this.stacked = 0;
        this.state = 'fly';
        if (v.missions > this.committedFrom && this.target >= 0) return show(pane('COMMITTED. NOW WE WAIT', 'The craft is built and launched on the date we picked. We speed up time; the screen slows down again when something happens.'));
        return out;
      case 'fly':
        if (v.overlayOpen) {
          out.keys.push('Escape');
          this.wait = AUTO_STEP_S;
          return out;
        }
        if (this.evacPending && v.canEvacuate && (v.threat?.leadS ?? 0) < AUTO_EVAC_LEAD_S && v.predicted === 'HIT') {
          this.evacPending = false;
          out.keys.push('KeyE');
          return show(pane('EVACUATION ORDERED', 'Four months out we move people away from the predicted impact zone. The rock still lands, but the debrief counts the lives saved.'));
        }
        if (this.retryLead > 0 && (v.threat?.leadS ?? 0) < this.retryLead) {
          this.retryLead = -1;
          this.state = 'openPlanner';
          return out;
        }
        const coast = !v.craftInFlight && v.missions > 0 && v.predicted === 'MISS';
        if (coast && !this.coastSaid) {
          this.coastSaid = true;
          return show(pane('IT WILL MISS', 'Every craft has arrived and the new orbit is measured: the rock now passes Earth. Nothing is left to steer, so we skip ahead a year a second to the close approach.'));
        }
        if (v.warp < (coast ? AUTO_COAST_WARP : AUTO_CRUISE_WARP)) {
          out.keys.push(v.warp === 0 ? 'Space' : 'BracketRight');
          this.wait = AUTO_STEP_S;
          return out;
        }
        if (!v.craftInFlight && v.missions > 0 && v.predicted && v.predicted !== 'MISS' && this.replans < AUTO_REPLANS && (v.threat?.leadS ?? 0) > 120 * 86400) {
          this.replans++;
          this.state = 'openPlanner';
          return show(pane('NOT ENOUGH YET', `With every craft arrived the rock is still predicted to ${v.predicted === 'HIT' ? 'hit' : 'scrape past'}. The push was smaller than hoped (the beta factor varies). We plan again from here.`));
        }
        return out;
      case 'debrief': {
        if (v.overlayOpen) {
          out.keys.push('Escape');
          this.wait = AUTO_STEP_S;
          return out;
        }
        const d = v.debrief;
        if (this.round !== -2) {
          this.round = -2;
          this.rounds++;
          this.invested = 0;
          const outcome = d?.outcome ?? '';
          const body = outcome === 'MISS' ? `It missed. ${d?.score ?? 0} points and research for better tech next round. Early, cheap pushes beat late, big ones.` : `A partial result: some energy still came through. ${d?.score ?? 0} points. More lead time or a bigger push next time.`;
          return show(pane(`DEBRIEF: ${outcome}`, body));
        }
        // Spend between rounds like a player would: research on tech, spare budget on one program at a time.
        if (this.invested < 3 && v.invest?.tech) {
          this.invested++;
          const tch = v.invest.tech;
          out.invest = { kind: 'TECH', id: tch.id };
          return show(pane(`TECH: ${tch.name}`, `Research points buy tech between rounds. ${tch.name} costs ${tch.cost}. Launchers and impactors first: they decide what one mission can push.`));
        }
        if (this.invested < 4 && v.invest?.program) {
          this.invested = 4;
          const pr = v.invest.program;
          out.invest = { kind: 'PROGRAM', id: pr.id };
          return show(pane(`PROGRAM: ${pr.name}`, `Programs pay off over many rounds. This one costs ${pr.costPerYear} a year while it builds. Most of them buy warning time, the strongest lever in the game.`));
        }
        out.keys.push('Space');
        this.wait = AUTO_STEP_S * 2;
        return out;
      }
      case 'over':
        if (this.round !== -3) {
          this.round = -3;
          this.rounds++;
          return show(pane('EARTH WAS HIT', 'This run is over. The lesson is in the debrief: what we found too late, or pushed too little. A fresh run starts now.'));
        }
        out.keys.push('Space');
        this.wait = AUTO_STEP_S * 2;
        return out;
    }
    return out;
  }
}
