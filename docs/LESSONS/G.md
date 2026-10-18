# G. THE GAME

Generated from EDUCATION.md by `scripts/build_lore.py --lessons`; edit the source, not this file.

## G1 How to play

*See the rock. Pick a plan. Speed up time. Make it miss. Then a bigger rock comes.*

### Beginner

A rock is coming, years out. Read the threat brief (size, type, years left, odds). Open the planner, look at the ranked plans, and commit one or more missions. Run the clock, fast or slow, and watch them fly, hit, and (you hope) push the rock off course. The debrief tells you what happened and why. Spend research on new tech, fund long-term programs, and the next round brings a harder rock. If one hits, the run ends and your score goes on the board.

### Intermediate

The loop has two investments: missions for this threat and programs for every future threat. A good first-round habit: commit a single kinetic impactor early (it is cheap and the lead time does the work), then start funding a survey program with what is left, because round 5's threat may come from the sunward blind spot. Watch three numbers: years remaining (your lever), U (closing speed: punch and breakup risk), and P(MISS) (what the Monte Carlo thinks). Pause any time to add missions; the clock is yours.

Related: G2, G3, G4, D2. In the game: TUTORIAL menu item, first run.

## G2 Screens, HUD and controls

*Top bar: time left, money, round. Right: warp speed. Brain button: learn.*

### Beginner

System view is home: the star, orbits, planets, the threat and its predicted path, your spacecraft with trails. Planet view zooms to your world and the approach. Planner, Tech, Programs, Debrief, Leaderboard, Codex and the Learning Center are the other screens. The HUD always shows T-MINUS (years and days), BUDGET, ROUND, P(IMPACT), and the warp controls. Space pauses. The `?` key or a click on anything opens its lore panel.

### Intermediate

Keys: space pause; `[` and `]` slower and faster warp; R resolve now; P planner; T tech; G programs; C codex; L learning center; `~` console; 1-6 views; Esc back. Mouse and touch: drag to pan, wheel or pinch to zoom, click a body for a readout card. The scale toggle switches between true distances and a compressed view (radial square root) so the giant planet fits on screen while the inner system stays readable. The replay scrubber in the debrief lets you drag through the whole round at any speed.

Related: G1, G3, G8. In the game: every screen.

## G3 Reading the planner

*The planner ranks plans and shows its math. Longer bar, better plan.*

### Beginner

The planner lists every plan your tech allows, ranked. Each line shows the mission type, when it launches, when it hits, how hard, the predicted miss, the chance of success, and the cost. Click one to see the readout with the actual numbers. Green means clean deflection; amber means it will break the rock (and the planner then shows the fragment picture); violet means a slow push. Commit the one you believe in, or two if you can afford a backup.

### Intermediate

Readout line by line: LAUNCH (date and C3: the launcher must reach that C3 with that payload); IMPACT (date and U: closing speed; Q/Q* tells you how close to breakup: under 1 is a crater, over 1 shatters); PUSH (dv with the beta range in brackets, the planner's instant estimate MISS EST = 3 dv T, and P(MISS) from 200 Monte Carlo runs); COST versus budget. The score bar weighs P(MISS) most, then residual damage, cost, margin, and a small penalty for warheads. The porkchop plot shows C3 and U across launch and arrival dates; the planner picks the best few cells per plan type, but EXPERT toggle lets you pick a cell by hand.

Related: O10, D2, D3, D4, O14. In the game: planner screen.

## G4 Programs: investing in lead time

*Build telescopes and radar in the background. They take years. They pay forever.*

### Beginner

Programs are long projects that outlast any single rock: a space telescope, a sunward sentinel, a radar network, a stockpile of ready impactors. You set how much of your yearly budget goes to each; they take years; when done they permanently change what you can see and how fast you can respond. The temptation is to spend everything on the rock in front of you. The game is designed so that, sooner or later, that loses.

### Intermediate

Each program lists its real-world basis and tag. Early, cheap, high-value: INTL_COORDINATION (more budget), GROUND_SURVEY_EXPANSION and SPACE_IR_SURVEYOR (lead time), RADAR_NET (confidence), INTERCEPTOR_STOCKPILE (build time). Mid-game: SUNWARD_SENTINEL (the one that saves you from a Chelyabinsk), PRECURSOR_FLEET (know beta before you commit), HEAVY_LAUNCH_CADENCE. Late: ORBITAL_DEPOT, L4_L5_SENTINELS, VENUS_ORBIT_IR. SCI-FI mode adds the laser array, the lunar mass driver, fusion tugs and the disassembler swarm.

Related: F7, D2, G5. In the game: PROGRAMS screen.

## G5 Scoring and the leaderboard

*Survive rounds, score points. Clean, cheap, early misses score more.*

### Beginner

Each round scores by how big the threat was, how cleanly you beat it, how little budget you spent, and how early you resolved it. Bonuses for no warheads, no fragments, and capturing a rock. A hit ends the run; your total goes on the leaderboard with your handle, rounds survived, and the seed, so anyone can replay your exact rocks. Cheats mark a run ASSISTED; fiction modes have their own board.

### Intermediate

Round score = base(threat energy, round number) × outcome (clean 1.0, marginal 0.8, partial 0.35) × (1 + efficiency + timing + style). Partial means fragments hit but did under 10 percent of the original energy. Research earned is score / 50. The daily seed mode gives everyone the same rounds for a fair race.

Related: G4, G6, O14. In the game: debrief, leaderboard.

## G6 Modes, civilization levels and cheat codes

*Real science first. Then science fiction. Then you find the console. Then there are many worlds.*

### Beginner

REALISTIC is the game: only real and seriously proposed methods. SCI-FI (unlocked by finishing every real program, or by a code) adds things that obey physics but need technology we do not have: fusion tugs, orbital laser arrays, nanotube nets. SIMULATION, unlocked only from inside SCI-FI, hands you the console: teleport the rock, rewind time, edit gravity; each command tells you exactly why it is impossible before doing it anyway. MULTIVERSE forks the round into many parallel worlds you play at once.

### Intermediate

Codes (title screen or `~`): KARDASHEV1 and KARDASHEV2 jump civilization levels; SCIFI, SIMULATION, MULTIVERSE enter modes in order; REVEAL shows hidden truths; FASTBUILD, GODTRACK, LEADTIME n adjust difficulty; SPAWN name loads a real scenario (CHELYABINSK, TUNGUSKA, YR4, APOPHIS, BENNU, DIDYMOS, CHICXULUB); DART replays the real mission. Every code marks the run ASSISTED. Fiction commands are refused outside SIMULATION with a one-line reason.

Related: D11, G5, G7. In the game: console, options.

## G7 Under the hood: what is real and what is simplified

*Real formulas, flat solar system, only the Sun's gravity. Good enough to be honest.*

### Beginner

The game uses the real equations for orbits, impacts, breakup, sails, flybys and detection. It simplifies in three ways: the solar system is flat (no tilted orbits), only the Sun's gravity acts between events (planets only matter during flybys and at the final approach), and some messy physics (how a crater throws rock, how a nuclear burst couples) is reduced to a single calibrated number. The codex says, for every number, whether it is measured, modeled, or a game knob.

### Intermediate

What this costs: without inclination, the fragment cloud spreads in one direction only, so the game applies a correction factor; without planetary perturbations, long-term keyholes and resonant returns are not simulated (a stretch goal); without an atmosphere model, airbursts are classified by size. What it buys: every coasting body's position is an exact formula, so time warp and "jump to the end" are free, and every round is perfectly reproducible from its seed.

Related: O9, O11, O13, O14, C1. In the game: codex.

## G8 The look: phosphor green, neon spectrum, holograms

*Starts as old green terminal glow. Earn colors. Pick your own look, even a daytime one.*

### Beginner

The game opens in PHOSPHOR: green lines on black, the look of 1970s vector arcade machines and radar scopes. After your first clean miss, SPECTRUM unlocks and gives every kind of thing its own neon color: cyan spacecraft, amber threats, magenta fragments, violet programs. Options offer more moods: AMBER, ICE, VAPOR, BLACKLIGHT, HOLO (iridescent, holographic glow), and DAYLIGHT (dark ink on pale paper for bright rooms). Every mode keeps the lines thin and the glow soft, like a hologram drawn in light.

### Intermediate

Why green: early CRT phosphors (P1) glowed green, and monochrome vector displays like the Asteroids cabinet drew only lines, no fills. The game keeps that rule (lines, glow, no filled shapes) but draws at full resolution and can tilt the system into a 3-D wireframe. Colors are chosen for contrast and for the colorblind: each semantic color is paired with a line style (dashes, markers), so the meaning survives if the hue does not.

Related: G2, C4. In the game: OPTIONS color mode.
