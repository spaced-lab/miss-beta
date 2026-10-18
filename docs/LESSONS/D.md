# D. DEFLECTION

Generated from EDUCATION.md by `scripts/build_lore.py --lessons`; edit the source, not this file.

## D1 Impulse: what a push does to an orbit

*A tiny push changes the orbit a tiny bit. The change grows every lap.*

### Beginner

You do not need to stop the asteroid or turn it around. You need to make it arrive at the crossing point a few minutes early or late, because Earth will have moved on. A push along the direction of motion makes the orbit slightly bigger and the year slightly longer; the asteroid falls a little further behind on every lap. After enough laps, "a little" is thousands of kilometers.

### Intermediate

A 1 cm/s speed change on a body circling the Sun at 30 km/s is one part in three million. But it changes the orbital period by about three millionths of a year, about 100 seconds per orbit, and the asteroid moves 30 km in 1 second, so each lap it slips 3,000 km. Ten laps, 30,000 km, almost five Earth radii. That is the entire logic of planetary defense: find it early, nudge it gently, let the clock do the rest.

Related: O5, O3, D2, O7. In the game: dv readouts, planner.

## D2 Why early beats big

*Years of warning turn a gentle nudge into a safe miss. Weeks need a miracle.*

### Beginner

Because the miss distance grows with the time remaining, a push ten years out is worth ten times the same push one year out. A single small impactor launched early can do what a dozen could not do late. That is why the game rewards building telescopes (lead time) as much as building rockets, and why the debrief tells you how much earlier a better survey would have seen the threat.

### Intermediate

Miss distance ≈ 3 × dv × T. To miss Earth's effective target (about 1.5 Earth radii, 9,500 km at 10 km/s approach): with 10 years remaining you need dv ≈ 1 cm/s; with 2 years, 5 cm/s; with 3 months, 40 cm/s. A kinetic impactor on a 300 m stony body delivers a few mm/s; a nuclear standoff a few cm/s. So the 10-year case is a routine mission, the 2-year case needs a warhead or a very large campaign, and the 3-month case has no deflection solution at all, only evacuation.

Related: D1, F7, G4, D3. In the game: debrief counterfactual, programs.

## D3 Kinetic impactors and the beta factor

*Hit it with a spacecraft. The splash of rock flying off pushes even harder than the hit.*

### Beginner

The simplest real method: crash a spacecraft into the asteroid at high speed. NASA did it in 2022 (DART) and shortened a small moon's orbit around its parent by 33 minutes. The surprise was how well it worked: the crater's debris flew backward like rocket exhaust and more than tripled the push. That multiplier, called beta, is the single most important number in the game, and you do not know it precisely until after you hit.

### Intermediate

Push on the asteroid = beta × (spacecraft mass / asteroid mass) × closing speed. DART: 579 kg at 6.1 km/s into 4.3 billion kg; pure momentum would give 0.8 mm/s; the measured result was about 2.7 mm/s, so beta ≈ 3.6 (uncertain between about 2.2 and 4.9 because the asteroid's mass is uncertain). Beta depends on the target: loose rubble throws more debris (beta 2.5 to 5), solid iron less (1.2 to 2). In the game beta is drawn at impact from the type's range and revealed only after your tracking tier's delay, so your second wave is planned under uncertainty, as it would be in reality.

Related: D1, O5, T4, D4, T5. In the game: KINETIC plans, beta reveal.

## D4 Don't blow it up: fragmentation

*Blow it up late and you get a shotgun blast instead of a bullet. Break it early or never.*

### Beginner

The movie plan, blowing the asteroid apart, mostly makes it worse: the pieces keep going the same way, and now they are spread over a wider area with the same total energy. There are two exceptions. If you break it up years early, the pieces drift apart far enough that most miss. And if the pieces are all small (under about 25 m), the atmosphere burns them up. The game lets you try the "hammer" plan, but shows you the fragment cloud, and you will see the shotgun problem yourself.

### Intermediate

Whether a hit shatters the body depends on the energy per kilogram delivered versus the body's "disruption threshold" Q*, which is lowest (a few hundred joules per kilogram) for bodies a few hundred meters across. A 1 tonne impactor at 10 km/s on a 200 m stony rock delivers about 4 J/kg: a crater, no breakup. A 20 tonne hammer at 30 km/s on a 60 m rubble pile delivers about 60,000 J/kg: it shatters. The fragments fly apart at only about the body's escape speed, 0.1 to 1 m/s; over two years that spreads them across about 15 Earth radii, so most miss; over two months, about one Earth radius, so most hit.

Related: D3, T5, D5, D10. In the game: HAMMER_SWEEP plans, fragment cloud.

## D5 Nuclear options

*Explode near it, not on it. The heated face boils off and pushes the rock away, like a rocket.*

### Beginner

A nuclear device detonated a few hundred meters off the surface floods one face with X-rays, vaporizing a thin layer that blasts outward and shoves the asteroid the other way. No crater, no shattering if done right, and far more push than any spacecraft could carry as momentum. It has never been done in space, but the physics was tested in a lab in 2024 using an X-ray machine on tiny mock asteroids. Detonating on or under the surface instead shatters the body, which is the "disrupt then sweep" plan with all its risks. Treaties currently forbid nuclear weapons in space, so the game charges a political price.

### Intermediate

Energy scale: a 1 megaton device holds 4.2e15 J, about the kinetic energy of DART times 400,000. Only the fraction that reaches the asteroid (a few percent to 20 percent, set by the standoff distance) and couples into vaporized rock matters. A 1 Mt standoff on a 1 km stony body gives a few centimeters per second of push: at 10 years out that is a comfortable miss, at 2 years a marginal one. The same device buried in a 300 m body shatters it into a cloud, which only helps if you have years for the cloud to spread.

Related: D4, D3, D2, F10. In the game: NUKE_STANDOFF, NUKE_DISRUPT, HAIV.

## D6 The slow push family

*Push gently for years: hover and tug, blow on it, cook it with a laser, or throw its rocks off.*

### Beginner

If you have decades, you do not need to hit anything. A heavy spacecraft hovering nearby tugs the asteroid with its gravity alone (the gravity tractor). An ion engine pointed at the asteroid pushes it with exhaust (the ion beam shepherd). A laser or a mirror boils rock off one side (ablation). A robot could even mine the surface and fling the rubble away (a mass driver). All are gentle, controllable, and slow: millimeters per second per year. They shine for small bodies, for fine-tuning after a big push, and for herding fragments.

### Intermediate

Typical numbers for a 100 m body (about 1.4 billion kg): a 20 tonne gravity tractor hovering 150 m from the center pulls with about 80 millinewtons, giving about 1.9 mm/s per year; a 0.5 N ion beam gives 11 mm/s per year; a 200 kW laser (coupling 30 micronewtons per watt) gives 6 N and 0.13 m/s per year. For a 1 km body divide all of those by a thousand. Every slow-push mission first has to rendezvous (match the asteroid's velocity), which costs as much fuel as the deflection itself, so sails and ion propulsion matter here.

Related: D1, D2, D7, T5. In the game: SLOW_PUSH plans, NET_TOW.

## D7 Solar sails: free speed from sunlight

*Sunlight pushes. A huge thin mirror catches enough to speed up, slowly, forever.*

### Beginner

Light carries momentum; a square kilometer of perfect mirror at Earth's distance feels about nine newtons, roughly the weight of a liter of water. Tiny, but it never runs out. Tilt the sail and you can spiral outward or inward, building up kilometers per second over a year. Japan's IKAROS (2010) and the Planetary Society's LightSail 2 (2019) flew real sails. In the game a sail turns a small impactor into a very fast one, which multiplies its punch, at the cost of time.

### Intermediate

Sunlight pressure at 1 AU is 4.5 micronewtons per square meter (9 if the sail reflects perfectly). What matters is sail loading: mass per square meter. At 10 grams per square meter the sail accelerates at 0.8 mm/s², which sounds like nothing until you multiply by a year: up to 10 km/s of velocity change. The best angle for spiraling is about 35 degrees off the Sun line. A sail cannot push toward the Sun, but by tilting the other way it can shed speed and fall inward.

Related: D6, O13, D8. In the game: SAIL_KINETIC plans, sail tiers.

## D8 Rockets: delta-v, Isp, C3

*Rockets throw fuel backward to go forward. Most of a rocket is fuel.*

### Beginner

A rocket speeds up by throwing exhaust backward. The faster the exhaust and the more of the rocket is fuel, the more speed it gains. The cruel part is the math: to double your speed gain you need to square your fuel ratio, which is why rockets are 90 percent propellant and why every extra kilometer per second a mission needs cuts the payload sharply. The game shows this as a launcher table: more launch energy, less mass delivered.

### Intermediate

Specific impulse (Isp) is exhaust efficiency, in seconds: chemical rockets about 320 (kerosene) to 450 (hydrogen); ion engines 3,000 but with thrust measured in tenths of a newton. The rocket equation says speed gained = Isp × 9.81 × ln(full mass / empty mass). A chemical stage that is 80 percent fuel gains 320 × 9.81 × ln(5) ≈ 5 km/s. C3 is the launch energy toward the target (the square of the leftover speed after escaping Earth); a Falcon Heavy-class rocket sends about 16 tonnes to C3 = 0 and only a couple of tonnes to C3 = 60 km²/s².

Related: O8, O10, D7. In the game: launcher tiers, stage upgrades.

## D9 Yarkovsky and YORP: the real tiny forces

*A rock's warm side glows heat, which pushes it a tiny bit. Over centuries, it adds up.*

### Beginner

Sunlight warms an asteroid; the warm side radiates heat; radiating heat is a (very) small push. Because the rock spins, the afternoon side is warmest, so the push is slightly sideways and slowly changes the orbit. This is the Yarkovsky effect, and it is real: Bennu's orbit drifts by about 280 meters per year because of it. The cousin effect, YORP, slowly changes the spin. Both matter for predicting impacts centuries out; neither can be used to deflect anything on a human schedule. The game lists them honestly as NOT VIABLE.

### Intermediate

Painting one side of an asteroid to change its heat radiation has been proposed as a deflection "method." The numbers: for a 1 km body the orbit drifts about 1e-4 AU per million years, which is about 300 meters over the 10 years a game round lasts. Compared with the thousands of kilometers needed, it is useless, but over a century of advance knowledge it could change whether a keyhole is hit. The game computes the number and shows it so the comparison is on screen.

Related: D6, F8, T5. In the game: codex NOT VIABLE entry.

## D10 Last resorts: evacuation and shredding

*If there is no time to move the rock, move the people.*

### Beginner

If a city-size rock is found weeks out, no spacecraft can be built, flown, and arrive in time. The real plan for that case is civil defense: compute the strip of ground where it could land, evacuate it, and get people away from windows everywhere else. Governments rehearse exactly this in planetary defense exercises. In the game, EVACUATE is always available and turns a small hit from "run over" into a survivable, lower-scoring round.

### Intermediate

A newer idea for the very last days is to shred a small threat (under about 100 m) into pieces smaller than about 10 m using an array of penetrator rods, so the atmosphere does the rest: many high airbursts instead of one ground impact. It is a published concept (Lubin's "PI"), untested, and it only works for small, weak bodies. The game offers it as a terminal option down to 12 hours before impact with damage reduced to a few percent of the intact case, and tags it PROPOSED.

Related: D4, F10, T2. In the game: EVACUATE action, PI.

## D11 The catalog and the chart: which method, when

*Small rock, lots of time: nudge. Big rock, little time: nuclear. No time: run.*

### Beginner

Every method has a home territory. Gentle pushes (tractors, beams, lasers) work for small rocks with decades of warning. Kinetic impactors cover the middle: up to a few hundred meters with a decade. Nuclear standoff reaches the kilometer class or shortens the needed warning. Nothing works for a big rock with under a year, except moving the people. The game's codex tags every method REAL, PROPOSED, SPECULATIVE or FICTION, and the planner ranks only the ones that fit this round.

### Intermediate

Rules of thumb from the 2010 National Research Council chart: kinetic impactors, roughly 100 m to 500 m with 5 to 20 years; slow push, below 150 m with 20+ years; nuclear standoff, 500 m to 2 km, or anything with 2 to 10 years; nuclear disruption only as a last resort with enough years for the cloud to spread; civil defense for anything under 1 year. The game's balance targets (GAME_PLAN.md Section 17) were chosen to reproduce exactly those regions.

Related: D2, D3, D5, D6, G3. In the game: codex, planner categories.

## D12 Autonomy: letting the spacecraft decide

*Light takes minutes to reach the probe. Sometimes it has to choose its own target.*

### Beginner

After your first impactor hits, you learn how the rock responded: how hard it was pushed, whether it broke. By then your second wave may already be flying, and radio signals take minutes each way. So the spacecraft needs instructions for what to do if things change: "if it breaks into pieces, go for the biggest piece that is still going to hit." The game lets you write those rules, and later gives your probes onboard smarts to re-plan themselves.

### Intermediate

Tiers in the game: fixed targeting; if-then rules you write (evaluated at events like FRAGMENTATION or BETA_ASSESSED); onboard re-planning (the probe re-solves its own transfer to the best fragment within its remaining fuel); and swarm coordination (all probes assigned to fragments together, most dangerous first). DART itself used autonomous terminal guidance for its last four hours because the target was too small to steer from Earth. The hard part the game makes you feel: you commit fuel and timing before you know what the rock will do.

Related: D4, G3, C1. In the game: autonomy tiers, rules editor.
