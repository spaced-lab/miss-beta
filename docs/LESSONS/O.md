# O. ORBITS AND MATH

Generated from EDUCATION.md by `scripts/build_lore.py --lessons`; edit the source, not this file.

## O1 Numbers: units, scientific notation, orders of magnitude

*Space numbers are huge. We write them as "a number times ten, so many times."*

### Beginner

The Sun is 150,000,000,000 meters away. Writing that every time is silly, so scientists write 1.5e11: "1.5 times ten to the eleventh," meaning move the decimal point eleven places. Tiny numbers work the same way: 0.000005 is 5e-6. The game shows distances in AU (one Earth-Sun distance), speeds in km/s, time in years and days, and energy in megatons, but all the math underneath is done in meters, seconds, kilograms and joules.

### Intermediate

Scientific notation makes estimation easy: multiply the front numbers, add the exponents. Mass of a 100 m stony asteroid: volume ≈ 0.5 × 10^6 m³ (half a million cubic meters) times 2,700 kg/m³ ≈ 1.4e9 kg. Energy at 20 km/s: 0.5 × 1.4e9 × (2e4)² = 0.5 × 1.4e9 × 4e8 = 2.8e17 J; divide by 4.184e15 J per megaton: about 67 Mt. Getting within a factor of two this way, before touching a calculator, is the main skill in this whole subject.

Related: O2, T2. In the game: every readout.

## O2 Logarithms and the magnitude scale

*Star brightness uses a backwards scale: smaller number, brighter star. Each step is 2.5 times.*

### Beginner

A logarithm answers "ten to what power?" log10(1000) = 3. Logs turn multiplying into adding, which is why they show up wherever numbers span many powers of ten. Astronomers' magnitude scale is logarithmic and backwards: a magnitude 1 star is 100 times brighter than a magnitude 6 star (five steps, each about 2.5 times). The faintest things today's surveys can see are about magnitude 20 to 24.5; the Sun is -27.

### Intermediate

Five magnitudes = factor 100, so one magnitude = 100^(1/5) ≈ 2.512. If a telescope reaches magnitude 24.5 and another reaches 20, the first sees sources 4.5 magnitudes fainter: 2.512^4.5 ≈ 63 times fainter. Since brightness falls with distance squared, that means seeing the same rock about 8 times farther away. That is the Rubin-versus-ATLAS difference in one number.

Related: O1, F2, F9. In the game: threat brief H, detection.

## O3 Vectors: position and velocity

*An arrow says where. Another says which way and how fast.*

### Beginner

A vector is an arrow with a length and a direction. The game uses two for every body: position (an arrow from the Sun) and velocity (an arrow along its path whose length is its speed). Adding vectors is laying arrows head to tail. A push changes the velocity arrow a little; which direction you push matters as much as how hard.

### Intermediate

In the game's flat solar system a vector is just two numbers, (x, y). Length is Pythagoras: |v| = sqrt(vx² + vy²). The dot product tells you how much of one arrow points along another: v·u = vx ux + vy uy = |v||u| cos(angle). That is how the game splits a push into the part along the orbit (which changes arrival time a lot) and the part across it (which changes it little). Example: a 10 mm/s push at 60 degrees from the direction of motion contributes only 10 × cos(60°) = 5 mm/s along-track.

Related: O4, O7, D1. In the game: system view arrows.

## O4 Newton: gravity and motion

*Things move in straight lines until something pulls. The Sun pulls. Paths bend into orbits.*

### Beginner

Newton's three laws: things keep moving unless pushed; force equals mass times acceleration; every push has an equal push back. His gravity law: every mass pulls every other, more strongly the closer they are (four times stronger at half the distance). An orbit is a fall that keeps missing: the rock is always falling toward the Sun and always moving sideways fast enough to miss it.

### Intermediate

Gravity's pull on a 1 kg mass at Earth's distance from the Sun is about 0.006 N (6 mm/s² of acceleration). That seems tiny, but it acts for a year at a time: 0.006 m/s² × 31 million seconds = 190 km/s of "would-be" velocity change, which is why the Sun can bend a 30 km/s path into a full circle. The same arithmetic is why a deflection push of millimeters per second, given years, moves an asteroid by thousands of kilometers.

Related: O3, O5, O6. In the game: system view, RK4.

## O5 Energy and momentum

*Momentum is mass times speed, and it is never lost. Hit a mountain, the mountain moves a little.*

### Beginner

Kinetic energy is how much damage something can do: it grows with speed squared, so twice as fast is four times the punch. Momentum is mass times velocity, and in a collision the total momentum before equals the total after. That second rule is the whole basis of asteroid deflection: a 600 kg spacecraft at 6 km/s hits a 5 billion kg rock, and the rock must pick up the spacecraft's momentum, so it speeds up by a few millimeters per second. Not much, but forever.

### Intermediate

Conservation of momentum: m × U = M × dv (if the spacecraft sticks). DART: 579 kg × 6,140 m/s = 3.55 million kg·m/s; divide by Dimorphos's mass, about 4.3 billion kg: dv ≈ 0.8 mm/s. The measured change was about 2.7 mm/s, three times more, because rock blasted off the crater flew backward, pushing the asteroid forward like a rocket exhaust. That extra is the "beta" factor (D3). Energy is a different story: DART's kinetic energy was about 11 gigajoules, 2.6 tonnes of TNT, almost all of it spent making the crater and heat.

Related: O4, D1, D3, O8. In the game: impact energy, dv readouts.

## O6 Kepler's laws and the ellipse

*Orbits are ovals with the Sun off-center. Close to the Sun: fast. Far: slow.*

### Beginner

Kepler worked out three rules in the 1600s, before Newton explained them. One: orbits are ellipses (ovals) with the Sun at one focus, not the middle. Two: a body sweeps out equal areas in equal times, so it moves fastest at its closest point (perihelion) and slowest at its farthest (aphelion). Three: the farther an orbit is from the Sun, the longer the year, in a precise way: the square of the period is proportional to the cube of the average distance.

### Intermediate

Third law in handy units: with distance in AU and time in years, T² = a³ for anything orbiting the Sun. Mars at 1.52 AU: 1.52³ ≈ 3.5, so T ≈ 1.88 years. An asteroid with a = 2.5 AU: T ≈ 3.95 years. The ellipse is described by its half-length a (semi-major axis) and its eccentricity e (0 is a circle, close to 1 is a long cigar). Perihelion is a(1-e), aphelion a(1+e). Earth: a = 1 AU, e = 0.017, so its distance varies by only ±1.7%.

Related: O4, O7, O8, O9. In the game: system view orbits.

## O7 Orbital elements

*Four numbers describe a flat orbit: size, shape, direction, and where the rock is right now.*

### Beginner

Instead of storing a path as thousands of points, astronomers store a few numbers that describe the whole ellipse: how big it is, how stretched, which way it is turned, and where along it the body is at a reference moment. From those you can compute the position at any time, past or future, instantly. That is why the game can jump years ahead without "simulating" anything in between.

### Intermediate

In the game's flat system: a (size, in AU), e (shape), ϖ (longitude of perihelion: the angle the long axis points), and M0 (mean anomaly at epoch t0: a clock reading that says how far around the body is). Real 3-D orbits need two more angles, inclination (tilt) and the node (where the tilted plane crosses the reference plane). Example card for Apophis: a = 0.922 AU, e = 0.191, i = 3.3 degrees; so it crosses Earth's orbit twice a year and spends most of its time inside it.

Related: O6, O9, O3. In the game: threat brief orbit card, SAVE.md.

## O8 Vis-viva: how fast at any point

*One formula gives the speed anywhere on an orbit from the distance and the orbit's size.*

### Beginner

Speed on an orbit depends only on two things: how far from the Sun you are right now, and how big the orbit is overall. Closer is faster. For a given spot, a bigger orbit means you are moving faster there (you have more energy). Earth moves at about 30 km/s; something falling in from very far away passes Earth's distance at about 42 km/s.

### Intermediate

The vis-viva equation ("living force", an old name for energy): v² = GM(2/r - 1/a). At Earth's distance, r = 1 AU: a circular orbit (a = 1 AU) gives 29.8 km/s; an orbit with a = 2 AU passing through gives 36.5 km/s; a parabola (a infinite) gives 42.1 km/s. Those differences are what a rocket or an impactor has to supply or absorb. The game prints "U", the closing speed at impact, which is the vector difference between the impactor's and the asteroid's vis-viva velocities at the same point.

Related: O6, O5, D8, O11. In the game: planner readouts, LAB_VISVIVA.

## O9 Anomalies and Kepler's equation

*Three angles say where a rock is. One ticks like a clock. The others follow from it.*

### Beginner

Finding where a body is on its ellipse at a given time is harder than it sounds, because it speeds up and slows down. Kepler's trick: define a clock angle that ticks evenly (the mean anomaly), then solve a small puzzle to turn it into the real angle. Computers solve that puzzle in a few steps, millions of times a second, which is what the game does for every planet, asteroid, fragment and spacecraft every frame.

### Intermediate

Mean anomaly M grows evenly: M = n (t - t0), where n = 360 degrees per period. Kepler's equation M = E - e sin E links it to the eccentric anomaly E, which then gives the true angle from the Sun and the distance. There is no formula for E; you guess E = M and improve the guess with Newton's method. For Earth (e = 0.017) one or two steps give 12 digits. For a comet with e = 0.95 it may take ten, and you start from a different guess.

Related: O6, O7, O13. In the game: kepler.ts, time warp.

## O10 Getting from A to B: Hohmann, Lambert, porkchop plots

*Pick a launch day and an arrival day. Some pairs are cheap, some impossible. The map shows which.*

### Beginner

Getting to an asteroid is not "point and go": the rocket, the Earth and the target are all moving. The cheapest path is usually half an ellipse that just touches both orbits (a Hohmann transfer). For any chosen launch day and arrival day there is exactly one coasting path connecting them (Lambert's problem), and some cost far more fuel than others. Plotting the cost for every pair of days gives a "porkchop plot," a map with cheap valleys and impossible mountains. The game's planner draws one for every mission.

### Intermediate

Earth to Mars by Hohmann: leave Earth 2.9 km/s faster than Earth moves, coast 259 days, arrive. Miss the window and the cost climbs steeply: launch 3 months late and you need two or three times the fuel, which means a third of the payload. For an impactor the planner cares about two numbers per grid cell: C3 (the launch energy, which limits payload) and U (the closing speed at the target, which sets the punch and the breakup risk). Cheap cells and hard-hitting cells are rarely the same cells; that trade-off is the planner's whole job.

Related: O8, D8, O11, G3. In the game: planner porkchop.

## O11 Gravity assists

*Swing close to a planet: it bends your path and can throw you faster, for free.*

### Beginner

A spacecraft passing close to a planet gets whipped around by its gravity. Relative to the planet it leaves as fast as it came, just in a new direction. But the planet itself is moving around the Sun, so relative to the Sun the spacecraft can come out much faster (or slower). It is like bouncing a ball off the front of a moving truck. Voyager, Cassini and New Horizons all used this. In the game, a well-timed pass of the inner planet or the giant can add kilometers per second to an impactor at no fuel cost.

### Intermediate

The bend angle depends on how fast you arrive and how close you pass: slower and closer bends more. Jupiter-class planet, 10 km/s approach, passing at 10 planet radii: about 80 degrees of bend. A 90-degree bend at 10 km/s changes your Sun-relative velocity by up to 14 km/s. The catch is timing: the planet has to be in the right place when you get there, which is why the game shows "FLYBY WINDOWS" per planet and why each round's planet configuration changes what is possible.

Related: O10, O8, O3. In the game: flyby windows, KINETIC_FLYBY plans.

## O12 Close approach and gravitational focusing

*Earth's gravity pulls passing rocks inward, so the target is bigger than the planet.*

### Beginner

A rock that would have missed Earth by a few thousand kilometers gets pulled in by Earth's gravity and hits anyway. The slower it comes, the stronger this effect. For a typical 10 km/s approach the effective target is about 1.5 Earth radii; for a very slow approach it can be two or more. So "miss by one Earth radius" is not a miss. The game draws this bigger ring on the planet view and counts a hit whenever the rock's path crosses it.

### Intermediate

The game finds the closest approach by checking the distance between asteroid and planet every hour near the predicted impact time, then refining to the second. That distance, computed without the planet's gravity, is the "impact parameter" b. Earth's escape speed is 11.2 km/s. Rule: the effective radius is R × sqrt(1 + (11.2 / v_inf)²). At v_inf = 10 km/s that is 1.50 R; at 5 km/s, 2.45 R; at 20 km/s, 1.15 R.

Related: O6, T2, D2, F8. In the game: planet view b_crit ring, MISS readout.

## O13 Numerical integration: when there is no formula

*When the pull keeps changing, take many tiny steps and add them up.*

### Beginner

Kepler's formula works only when gravity is the only force. A solar sail or an ion engine adds a small, continuous push, and then there is no formula: the computer takes a tiny time step, works out the forces, moves the craft a little, and repeats, millions of times. Doing this well (not drifting, not blowing up) is a whole branch of math; the game uses a classic method called Runge-Kutta 4.

### Intermediate

The simplest method (Euler) uses the force at the start of each step and drifts badly. RK4 samples the force four times within the step and blends them, so the error per step shrinks with the fifth power of the step size: halve the step, get 32 times less error. For a sail arc the game uses 6-hour steps; over a year that is 1,460 steps per craft, cheap enough to run in a worker while you watch. After the arc ends, the state is converted back into an ellipse and Kepler takes over again.

Related: O4, D7, D6, O9. In the game: sail arcs, slow push, RK4.

## O14 Randomness, seeds, Monte Carlo and probability

*Run the future a hundred times with small changes. Count the hits. That is the risk.*

### Beginner

Some things in the game are not known exactly: how hard the rock will respond to a hit, exactly where it is, how it breaks. Instead of pretending, the game plays the future out a few hundred times with slightly different values and counts how often the planet survives. That count is the "P(MISS)" number the planner shows. All the randomness comes from one seed number, so the same seed always gives the same game, which is what makes leaderboards fair and replays exact.

### Intermediate

A seeded pseudo-random generator is a formula that produces a fixed sequence of numbers that look random. Two players with the same seed get the same asteroid, the same beta draw, the same fragments. Monte Carlo estimation: with N = 200 samples the estimate of a probability p has a standard error of about sqrt(p(1-p)/N); for p = 0.9 that is ±2%, good enough to rank plans. The normal (bell) distribution handles orbit uncertainty: 68% of outcomes fall within one sigma, 95% within two.

Related: F8, G7, G5. In the game: P(MISS) readout, seeds, leaderboard.
