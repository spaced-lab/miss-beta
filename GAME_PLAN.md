# MISS β
### MISS: Momentum, Impulse, Sails, Slingshots
### BETA: Ballistic Engagement of Threatening Asteroids
## Planetary Defense Sim: Design and Build Stencil for Claude Code

Naming, for the build: the program the player runs is BETA (the Ballistic Engagement of Threatening Asteroids office); the simulator is MISS. The title is also the equation the whole game runs on, `miss ≈ 3 * beta * (m/M) * U * T`, so the title screen can render it that way: `MISS ∝ β`. The onboard autonomy of Section 8 answers to the callsign BETA in the play-by-play log. Repo: `miss-beta`. Version string: `MISS β v0.x`. The HUD line stays `MISS 4.1 R`.

Vector-line, green-on-black, Asteroids-era look. Underneath: real orbital mechanics, real deflection physics, the real detection networks (today's and the proposed ones), and a planner that ranks defense plans with actual numbers. Every method is tagged REAL, PROPOSED, SPECULATIVE or FICTION, and the fictional ones live behind nested modes (SCI-FI, SIMULATION, MULTIVERSE). Runs entirely in the browser; saves as a markdown file.

---

## 0. How to use this document

- This is the single source of truth for the first playable build. Work the milestones in Section 15 in order. Each has acceptance criteria.
- Physics lives in pure functions with unit tests (Section 16) before any rendering depends on it.
- SI units internally (meters, seconds, kilograms, radians). Convert for display only (AU, years, days, km/s, Earth radii, megatons).
- Every "knob" marked `[knob]` is a tunable game constant kept in one config file. Defaults are given; balance them in Milestone 5.
- Where a formula is simplified for the game, the simplification is called out. Do not silently simplify further.
- No frameworks. TypeScript + Vite + Canvas 2D + one Web Worker + vitest. Keep the dependency list near zero.

**Companion file:** `EDUCATION.md` holds all learning content (five levels per topic) and the contract for the Learning Center, lore panels, LAB demos and picture generators. Section 23 of this file says how the game consumes it. Both files live at the repo root.

**Auto mode (Claude Code running unattended):**
- Work Section 15 top to bottom, M0 through M12. Each milestone leaves the game playable; the game starts simple and grows. Do not stop to ask; where this document says "(Plan: ...)" that is the decision. Where it is silent, pick the simpler option and note it in `STATUS.md`.
- Keep `STATUS.md` at the repo root: one line per milestone (done / in progress / blocked), the knobs you changed from the defaults here and why, and any formula you could not verify against a reference (tag it `[unverified]`).
- Commit as you go: one commit per feature, never a red test. Commit messages: `feat(scope): what it does` plus a paragraph on how it works and which lore topic explains it. Milestone commits carry the milestone id. Keep `CHANGELOG.md`.
- Comment for teaching: every source file opens with a WHAT / WHY / HOW / LORE header; every function carries its formula and units in the doc comment; `// NOTE:` explains decisions, not mechanics. This repo is public and is also a course (Section 26).
- Language: TypeScript for the game (it must run in a browser without a plugin). Python for everything that does not: the `pymiss` physics mirror, test-vector generation, the lore build script, the notebooks. See Section 26.2 for why and for the one-to-one mirroring rule.
- Never remove a REAL/PROPOSED/SPECULATIVE/FICTION tag or move a method between tags; that classification is content, not implementation detail.
- If a REALISTIC-mode number comes out more than 2x off the balance targets in Section 17, fix the constants, not the targets.
- New ideas: while building, any feature not in this plan goes into `IDEAS.md` with one paragraph and a size estimate; do not build it. When every milestone, every method in Section 20, every program in Section 19 and every topic in EDUCATION.md is implemented and tested, stop, print `IDEAS.md` as a numbered list with your recommendation for each, and wait. The interactive phase chooses from that list.

---

## 1. Concept

You run the planetary defense program for a habitable planet (call it HOME in the HUD). It is Earth-like, but the continents are procedurally generated each run. An object is on a collision course, years out. You see the whole solar system from above, in glowing green lines. You have a budget, a launch capability, and a growing tech tree.

Your job: build and launch missions that change the object's orbit enough that it misses. You can push it with kinetic impactors, speed those impactors up with solar sails and gravity assists, shatter a big rock and sweep up the pieces, nudge it slowly with tractors and beams, burn it with a laser, use a warhead, or (end-game) wrap it in a carbon nanotube net and tow it.

Time can be warped from days per second to a year per second, or you can jump straight to the result and watch the play-by-play. The run ends when something hits. Then the leaderboard, then a reset: same planet, new threat, new planetary configuration, harder.

---

## 2. Design pillars

1. **The math is real.** Kepler orbits, Lambert targeting, patched-conic flybys, momentum transfer with a measured beta factor, a published disruption scaling law. The retro screen is a thin skin over a real simulator.
2. **Rudimentary but correct.** Two-body heliocentric mechanics, coplanar (2D). This is enough for the strategic truth of the problem: early small pushes beat late big pushes; shattering late is worse than not shattering; fast impactors hit harder but risk breaking things.
3. **Show the numbers.** The planner prints its work like a terminal readout. The player should be able to learn why a plan is ranked where it is.
4. **Every option is a trade.** Mass vs speed, speed vs fragmentation risk, early vs late, cheap vs certain, clean vs nuclear.
5. **Deterministic and seeded.** A round is fully determined by its seed. Leaderboards are comparable; replays are exact.

---

## 3. Core loop

```
TITLE -> NEW RUN (seed) ->
  ROUND n:
    THREAT BRIEF        object type, size, energy, years to impact (from the detection model), impact probability,
                        which network found it
    PLANNING            system view + planner; commit one or more missions; adjust PROGRAMS funding
    EXECUTION           clock runs (warp 1x .. 1 yr/s, or RESOLVE NOW)
                        missions launch, fly, flyby, split, impact; AI reacts; programs make progress
                        player may pause and add missions (re-plan from now)
    RESOLUTION          close approach computed; miss / partial / hit
    DEBRIEF             timeline scrubber, play-by-play log, score, research earned,
                        "what a completed program would have changed"
    -> if HIT: RUN OVER -> LEADERBOARD -> history/run-*.md written -> TITLE
    -> else: TECH TREE + PROGRAMS (spend research, set funding) -> SAVE.md written -> ROUND n+1 (harder)
```

Two clocks of investment run side by side: missions (this round, this threat) and programs (this run, every future threat). Round difficulty ramps: bigger objects, less warning, faster closing speeds, comets, binaries, sunward surprises, multiple threats, and eventually "the one you deflected last time comes back" (resonant return, stretch).

---

## 4. Look and feel

The base rule set below is the PHOSPHOR mode the game opens in. Section 24 holds the full visual system: the SPECTRUM unlock, the other color modes (AMBER, ICE, VAPOR, BLACKLIGHT, HOLO, DAYLIGHT), the holographic and wireframe-3D treatments, and the renderer architecture that supports them. Everything in Section 24 obeys the rules here: lines, glow, no fills.

- Background #000000. Primary line #33FF33. Dim lines (orbits, grid) #0B4D0B. Highlight/alert flicker #B6FFB6. Nothing else in PHOSPHOR. No fills except glow.
- Crisp 1 to 1.25 px strokes at device pixel ratio (high resolution, anti-aliased; never blurry upscaled low-res). Phosphor glow via a wide low-alpha under-stroke plus `ctx.shadowBlur`. Optional CRT overlay: scanlines, slight barrel, faint flicker. All toggleable; a reduce-motion option disables flicker, sweeps and parallax.
- Text is a stroke font (Hershey simplex, or a hand-built 16-segment vector font). No raster fonts in the play field. Pure HTML/CSS only for menus if needed, still monochrome green.
- Asteroid: irregular closed polyline (8 to 12 vertices, seeded). Fragments: smaller polylines. Spacecraft: tiny triangle/diamond with a fading trail. Planets: circles with 1 to 3 inner detail lines. Sun: circle with short radial ticks.
- Planet detail view: the planet disc with procedural continents (seeded 1D noise around the circle, 2 to 5 landmasses, Asteroids-style jagged outlines). Approach corridor and the gravitational-focusing circle drawn around it.
- Sound (optional, late): WebAudio square/triangle bleeps. Launch, flyby, impact, alarm.
- Loading messages, labels, logs: all caps, monospace feel, terminal cadence. Example log line: `T-04Y 112D  IMPACTOR-2 FLYBY VENUS  dV +3.1 km/s  V-INF 7.9 km/s`

---

## 5. World model

### 5.1 Frame and scope
- Heliocentric inertial frame, 2D (x, y) in the system plane. All bodies coplanar and prograde for v1. (Inclination is a stretch goal; see Section 18.)
- Two-body dynamics about the star for everything that coasts. Planet gravity is applied only via patched-conic flyby events (Section 6.7) and the gravitational-focusing impact test (Section 6.4). No N-body integration.
- Continuous thrust (sails, tugs, beams, lasers) is numerically integrated (RK4) only during thrust arcs; the result is then re-expressed as Kepler elements for coasting.

### 5.2 The star system (seeded per run, re-phased per round)
Default system is Sol-like so real numbers apply. Each round randomizes mean anomalies (planet positions), so flyby geometry differs every time.

| Body    | mu (m^3/s^2)      | a (AU) | e     | Radius (m)  | Notes                      |
|---------|-------------------|--------|-------|-------------|----------------------------|
| Star    | 1.32712440018e20  |        |       | 6.957e8     | 1 solar mass               |
| INNER   | 3.24859e14        | 0.723  | 0.007 | 6.0518e6    | Venus-like, flyby target   |
| HOME    | 3.986004418e14    | 1.000  | 0.017 | 6.371e6     | the planet you defend      |
| OUTER   | 4.282837e13       | 1.524  | 0.093 | 3.3895e6    | Mars-like, flyby target    |
| GIANT   | 1.26686534e17     | 5.203  | 0.049 | 6.9911e7    | Jupiter-like, big flyby    |

Optional variety `[knob]`: scale all semi-major axes by 0.9 to 1.1, star mass by 0.95 to 1.05, so no two runs are identical.

### 5.3 Threat object types

| Type        | Density (kg/m^3) | Strength mult `[knob]` | Typical v_inf (km/s) | Notes                                   |
|-------------|------------------|------------------------|----------------------|-----------------------------------------|
| Rubble pile | 1300             | 0.5                    | 6 to 20              | easy to disrupt, high beta scatter      |
| Stony (S)   | 2700             | 1.0                    | 8 to 25              | default                                 |
| Iron (M)    | 5300             | 5.0                    | 8 to 25              | hard to break, heavy                    |
| Icy / comet | 600              | 0.3                    | 25 to 60             | high e, short warning, outgassing noise |
| Binary      | as primary       | as primary             |                      | two bodies, two problems (round 6+)     |

Diameter range: 50 m (city) to 2 km (global). See Section 10 for the ramp.

---

## 6. Physics engine (the equations)

All functions pure, all in `src/physics/`. ASCII math below is written to be transcribed directly into code.

### 6.1 Constants (`constants.ts`)

```
G        = 6.67430e-11        m^3 kg^-1 s^-2
MU_SUN   = 1.32712440018e20   m^3/s^2
AU       = 1.495978707e11     m
YEAR     = 3.15576e7          s   (Julian year)
DAY      = 86400              s
C_LIGHT  = 299792458          m/s
SOLAR_CONST_1AU = 1361        W/m^2
P_RAD_1AU = SOLAR_CONST_1AU / C_LIGHT = 4.54e-6   N/m^2  (absorbed; x2 for perfect reflection)
G0       = 9.80665            m/s^2
MT_TNT   = 4.184e15           J   (one megaton)
SUN_ACCEL_1AU = MU_SUN / AU^2 = 5.93e-3  m/s^2
```

### 6.2 Kepler propagation (analytic, O(1) per query)

This is why time warp and "jump to end" are free: any coasting body's state at any time is a closed-form evaluation.

Elements for a 2D prograde orbit: `a` (semi-major axis), `e` (eccentricity, 0 <= e < 1), `w` (longitude of periapsis, radians from +x), `M0` (mean anomaly at epoch `t0`).

```
n   = sqrt(mu / a^3)                           mean motion
M   = M0 + n * (t - t0)        wrap to [0, 2pi)

Solve Kepler:  E - e*sin(E) = M
  E_0 = M            (if e < 0.8)   else E_0 = pi
  E_{k+1} = E_k - (E_k - e*sin(E_k) - M) / (1 - e*cos(E_k))
  stop when |dE| < 1e-12, max 30 iterations

nu  = 2 * atan2( sqrt(1+e)*sin(E/2), sqrt(1-e)*cos(E/2) )
r   = a * (1 - e*cos(E))

perifocal position:  xp = r*cos(nu),  yp = r*sin(nu)
perifocal velocity:  vxp = -sqrt(mu*a)/r * sin(E)
                     vyp =  sqrt(mu*a)/r * sqrt(1-e^2) * cos(E)

rotate by w into the system frame:
  x  =  xp*cos(w) - yp*sin(w)        vx = vxp*cos(w) - vyp*sin(w)
  y  =  xp*sin(w) + yp*cos(w)        vy = vxp*sin(w) + vyp*cos(w)
```

Vis-viva (used everywhere for sanity checks and for the planner's quick estimates):

```
v^2 = mu * (2/r - 1/a)
```

### 6.3 State vector <-> elements (2D)

Needed after every impulse (impact, flyby, warhead) and at the end of every thrust arc.

```
r  = |r_vec|,  v = |v_vec|
h  = x*vy - y*vx                              (must be > 0 for prograde; reject/flip otherwise in v1)
eps = v^2/2 - mu/r                            specific orbital energy (must be < 0 to be bound)
a  = -mu / (2*eps)

e_vec = ( (v^2 - mu/r) * r_vec - dot(r_vec, v_vec) * v_vec ) / mu
e  = |e_vec|
w  = atan2(e_vec.y, e_vec.x)

L  = atan2(y, x)                              true longitude
nu = L - w                                    true anomaly (2D prograde)
E  = 2 * atan2( sqrt(1-e)*sin(nu/2), sqrt(1+e)*cos(nu/2) )
M0 = E - e*sin(E),   t0 = t
```

Guard: `e` within 1e-9 of 0 makes `w` undefined; set `w = 0` and `nu = L`.

### 6.4 Close approach and impact test

Given threat elements and HOME elements, and a nominal impact epoch `t_i` (known from round generation):

```
search t in [t_i - 90 days, t_i + 90 days]:
  coarse: sample every 1 hour, d(t) = |r_threat(t) - r_home(t)|
  refine: golden-section around the coarse minimum to 1 s
  -> t_ca (closest approach time), d_min, v_inf = |v_threat(t_ca) - v_home(t_ca)|
```

Because the heliocentric propagation ignores the planet's gravity, `d_min` is the asymptotic impact parameter `b`. Gravitational focusing enlarges the effective target:

```
v_esc  = sqrt(2*mu_home / R_home)                       11.19 km/s for HOME defaults
b_crit = R_home * sqrt(1 + (v_esc/v_inf)^2)

IMPACT  if d_min < b_crit
MARGIN  = (d_min - b_crit) / R_home                      report in planet radii
v_impact = sqrt(v_inf^2 + v_esc^2)                       surface impact speed if it hits
```

Impact energy and category (for the threat brief and scoring):

```
M = (4/3) * pi * (D/2)^3 * rho
E = 0.5 * M * v_impact^2        J;   E_Mt = E / MT_TNT

D <  25 m   AIRBURST    (stony; iron threshold 10 m)   minor
D <  140 m  CITY
D <  1 km   REGIONAL
D >= 1 km   GLOBAL
```

### 6.5 Lambert targeting (universal variables)

Finds the heliocentric transfer from `r1_vec` at `t1` to `r2_vec` at `t2`. This is the backbone of every intercept, rendezvous, and flyby leg. Implement the Curtis / Bate-Mueller-White universal-variable form; it is short and robust.

```
dt = t2 - t1,   r1 = |r1_vec|,  r2 = |r2_vec|
dtheta = angle from r1_vec to r2_vec, in [0, 2pi), prograde:
   cross = r1x*r2y - r1y*r2x
   dtheta = acos( dot(r1,r2)/(r1*r2) );  if cross < 0: dtheta = 2pi - dtheta

A = sin(dtheta) * sqrt( r1*r2 / (1 - cos(dtheta)) )

Stumpff functions:
  z > 0:  S = (sqrt(z) - sin(sqrt(z))) / z^1.5        C = (1 - cos(sqrt(z))) / z
  z < 0:  S = (sinh(sqrt(-z)) - sqrt(-z)) / (-z)^1.5  C = (cosh(sqrt(-z)) - 1) / (-z)
  z = 0:  S = 1/6,  C = 1/2

y(z) = r1 + r2 + A * (z*S(z) - 1) / sqrt(C(z))
F(z) = (y/C)^1.5 * S + A*sqrt(y) - sqrt(mu)*dt

Solve F(z) = 0:
  bracket z in [-4pi^2, 4pi^2], require y(z) > 0; bisection to |F| < 1e-6 * sqrt(mu)*dt,
  then a few Newton steps (F' = (y/C)^1.5 * [ (C - 1.5*S/C)/(2z) + 0.75*S^2/C ] + (A/8)*[3*S/C*sqrt(y) + A*sqrt(C/y)] for z != 0)
  Bisection alone is fine for v1.

f  = 1 - y/r1
g  = A * sqrt(y/mu)
gd = 1 - y/r2
v1_vec = (r2_vec - f*r1_vec) / g            departure velocity (heliocentric)
v2_vec = (gd*r2_vec - r1_vec) / g           arrival velocity (heliocentric)
```

Degenerate case: `dtheta` near 0 or pi makes `A` blow up; skip those grid cells.

### 6.6 Launch, propulsion, and the porkchop grid

**Departure energy** from HOME at launch time `t_L`:

```
v_inf_dep = v1_vec - v_home(t_L)
C3 = |v_inf_dep|^2            m^2/s^2  (display in km^2/s^2)
```

**Launcher capability** `[knob]`: payload mass vs C3, per launcher tier. Interpolate linearly in `log(mass)` between the points.

```
Tier 1 (basic):     C3 km2/s2 ->  0: 4000 kg | 20: 2000 | 40:  900 | 60:  300 | 80: 0
Tier 2 (heavy):     C3        ->  0: 16000   | 20: 9000 | 40: 4500 | 60: 2000 | 90: 700 | 110: 0
Tier 3 (superheavy):C3        ->  0: 50000   | 20: 30000| 40: 17000| 60: 9000 | 90: 4000| 130: 1000
```

**Onboard propulsion** (upgrades): a stage adds dv via the rocket equation.

```
dv = Isp * G0 * ln(m0 / mf)
Chemical stage:  Isp = 320 s     Ion stage: Isp = 3000 s, thrust 0.2 N per kW (continuous, integrate)
```

For v1 treat chemical stages as impulsive (applied at launch or at a deep-space maneuver point). Ion stages are continuous and use the RK4 path from Section 6.8 with `a = F/m`.

**Porkchop grid** (runs in the worker):

```
for t_L in [now + build_time, t_i - min_flight]  step 10 days
  for t_A in [t_L + 30 days, t_i - resolve_margin]  step 10 days
    lambert( r_home(t_L), r_threat(t_A), t_A - t_L )
    C3, payload_mass(C3), U = |v2_vec - v_threat(t_A)|  (closing speed), arrival geometry
    store cell: { t_L, t_A, C3, mass, U, feasible }
```

Render it as a vector contour plot (C3 contours, U contours). The player can pick a cell; the planner also auto-picks the best cells per plan archetype.

### 6.7 Gravity assist (patched conic flyby)

A flyby is an instantaneous rotation of the spacecraft's planet-relative velocity, applied when the spacecraft passes the planet. Magnitude of `v_inf` is preserved; direction turns by `delta`.

```
r_SOI   = a_planet * (mu_planet / mu_sun)^(2/5)                sphere of influence (for event detection only)

v_inf_in  = v_sc - v_planet                                      (heliocentric minus planet velocity)
v_inf     = |v_inf_in|
delta_max = 2 * asin( 1 / (1 + (R_planet + h_min) * v_inf^2 / mu_planet) )    h_min [knob]: 300 km rocky, 2 R for GIANT
for a chosen periapsis radius r_p >= R_planet + h_min:
  delta   = 2 * asin( 1 / (1 + r_p * v_inf^2 / mu_planet) )
v_inf_out = rotate(v_inf_in, +/- delta)                          sign = which side of the planet you pass
v_sc_out  = v_planet + v_inf_out
|dv_helio| = 2 * v_inf * sin(delta/2)                            free heliocentric velocity change
```

**Multi-leg planning (v1 approach, simple and honest):**

```
Leg 1: lambert( r_home(t_L), r_planet(t_F), t_F - t_L )  -> v_inf_in at the planet
Leg 2: lambert( r_planet(t_F), r_threat(t_A), t_A - t_F ) -> required v_inf_out
feasible if:  | |v_inf_out_req| - |v_inf_in| | <= dv_onboard   (powered flyby / DSM covers the mismatch)
         and  turn angle between v_inf_in and v_inf_out_req <= delta_max
cost = mismatch dv
grid over t_F (10 day step); keep the cheapest feasible cell
```

The planner shows "FLYBY WINDOWS" per planet so the player can see why this round's configuration favors INNER or GIANT.

### 6.8 Solar sail

Sails trade time for free dv. A good sail can build 10 km/s in a year, which turns a small impactor into a very fast one.

```
sigma = (m_bus + m_sail) / A_sail                       sail loading, kg/m^2
a_c   = 2 * eta * P_RAD_1AU / sigma                      characteristic accel at 1 AU, eta ~ 0.9 (reflectivity)
beta_s = a_c / SUN_ACCEL_1AU                             lightness number (0.08 = decent, 0.5 = sci-fi)

sail acceleration (flat, ideal), alpha = cone angle between sun-line and sail normal, |alpha| < 90 deg:
  a_sail = a_c * (AU / r)^2 * cos(alpha)^2  * n_hat
  radial component:      a_r = a_c (AU/r)^2 cos(alpha)^3
  tangential component:  a_t = a_c (AU/r)^2 cos(alpha)^2 sin(alpha)      max at alpha = 35.26 deg, a_t = 0.385 a_c

equation of motion during a sail arc (integrate with RK4, dt = 6 h, state [x,y,vx,vy]):
  r_ddot = -mu * r_vec / r^3 + a_sail
```

Control laws `[knob]` the player can select for a sail arc:
- SPIRAL OUT: `alpha = +35.26 deg` (raise energy)
- SPIRAL IN: `alpha = -35.26 deg` (lower energy; a sail cannot push sunward, only shed angular momentum)
- COAST: sail feathered, `alpha = 90 deg`
- TARGET STEER (upgrade): each step choose alpha in [-70, 70] deg that most reduces the predicted miss to the intercept point (greedy, evaluate 7 candidate angles).

Sail tiers `[knob]`:

```
Tier 1  sigma = 100 g/m^2   a_c = 0.08 mm/s^2    (near-term: NEA Scout class)
Tier 2  sigma =  25 g/m^2   a_c = 0.33 mm/s^2
Tier 3  sigma =  10 g/m^2   a_c = 0.82 mm/s^2
Tier 4  sigma =   3 g/m^2   a_c = 2.7  mm/s^2    (graphene; late game)
```

Sail arcs end with a state vector; convert to elements and coast. The sail can also be dropped (`m_sail` removed) before impact so the impactor mass is just the bus.

### 6.9 Kinetic impactor deflection

The DART-measured result is the calibration point for the whole game.

```
U        = |v_impactor - v_threat|          closing speed at impact
u_hat    = (v_impactor - v_threat) / U      direction of momentum transfer (into the target)
dv_vec   = beta * (m / M) * U * u_hat       beta = momentum enhancement from ejecta

beta [knob, random per impact, revealed after tracking]:
  rubble pile:  beta ~ Uniform(2.5, 5.0)
  stony:        beta ~ Uniform(2.0, 4.0)     (DART on Dimorphos: 3.6, range 2.2 to 4.9)
  iron:         beta ~ Uniform(1.2, 2.0)
  icy:          beta ~ Uniform(1.5, 3.5)
  soft/blunt impactor: beta -> 1.0 to 1.3, and delivered Q scaled by 0.3 (see 6.10)
```

Apply `dv_vec` to the threat state at `t_A`, convert to elements (6.3), re-run the close approach test (6.4). That is the ground truth. The planner's instant estimate is the along-track rule in 6.15.

Note the geometry: a head-on intercept (impactor moving opposite the threat) gives a huge U and a big push, mostly along-track (the most effective direction), but also the highest fragmentation risk. A trailing intercept is gentle and weak. Side intercepts waste momentum on the radial direction.

### 6.10 Fragmentation (disruption)

Specific energy delivered to the target:

```
Q = 0.5 * m * U^2 / M         J/kg        (m << M; use reduced mass if not)
```

Catastrophic disruption threshold, Benz and Asphaug (1999) scaling law, basalt at 5 km/s, in cgs (erg/g, R in cm, rho in g/cm^3). Multiply by 1e-4 to get J/kg, then by the type's strength multiplier from 5.3. Treat the coefficients as `[knob]` and verify against the source before trusting them to three digits.

```
Q_star_cgs = Q0 * R_cm^a  +  B * rho_cgs * R_cm^b
   basalt (5 km/s):  Q0 = 9.0e7,  a = -0.36,  B = 0.5,  b = 1.36
   ice    (3 km/s):  Q0 = 1.6e7,  a = -0.39,  B = 1.2,  b = 1.26
Q_star = Q_star_cgs * 1e-4 * strength_mult        J/kg

sanity values (basalt, rho 2.7):  R = 100 m -> ~360 J/kg;  R = 500 m -> ~510 J/kg;  R = 5 km -> ~7600 J/kg
```

Outcome:

```
if Q < Q_star:
   cratering. Body stays whole. Apply dv from 6.9.
else:
   disruption.
   f_LR   = clamp( 1 - 0.5 * Q/Q_star, 0.02, 0.5 )          largest remnant mass fraction (Leinhardt and Stewart style, linear)
   M_LR   = f_LR * M
   remainder (1 - f_LR) * M split into N_frag pieces, N_frag = 8 .. 40 [knob]
     sample fragment masses from a Pareto distribution (cumulative N(>D) ~ D^-2.5), renormalize to the remainder mass
     diameter from mass and rho
   centre-of-mass velocity: dv_com = (m / (M + m)) * U * u_hat     (beta = 1: all mass is tracked explicitly)
   each fragment i gets dv_com + v_ej_i where
     v_esc  = sqrt(2 * G * M / R)                                  parent escape speed
     |v_ej| ~ Rayleigh(scale = k_ej * v_esc * sqrt(Q/Q_star)),  k_ej = 1.0 [knob]
     direction uniform in the plane (2D)
   convert each fragment to elements, propagate analytically, run the impact test on each
```

Fragments below the airburst threshold (6.4) are harmless. Fragment hit probability is what the "sweep" phase is about.

The key emergent lesson, which the numbers produce on their own: the cloud spreads along-track at roughly `3 * v_ej * T` (6.15). Disrupt with 2 years left and a 0.5 m/s ejection speed and the cloud spans ~15 planet radii with most pieces missing. Disrupt with 2 months left and you have aimed a shotgun at yourself.

**3D correction `[knob]`:** a real cloud also spreads out of plane, which the 2D model cannot see, so it over-counts hits. Multiply each fragment's hit probability by `f_3D = min(1, b_crit / (0.6 * v_ej * T))`.

### 6.11 Nuclear (warheads)

Two modes. Standoff is a deflection tool; surface/subsurface is a disruption tool. Both are delivered like impactors (Lambert intercept), but standoff needs a controlled detonation point, so a slow approach is better.

```
Standoff burst at height H above the surface (burst-to-centre distance R + H):
  f_omega = ( 1 - sqrt(1 - (R/(R+H))^2) ) / 2           fraction of isotropic yield geometrically intercepted
  E_abs   = eps_couple * f_omega * Y                      eps_couple = 0.3 [knob] (X-ray + neutron deposition)
  dp      = C_m * E_abs                                   C_m = 3e-4 N s/J [knob]  (momentum coupling, ablation)
  dv      = dp / M, directed from the burst point through the centre of mass
  Q_nuc   = E_abs / M   -> run the disruption check of 6.10 with this Q

Surface burst:     f_omega -> 0.5, eps_couple -> 0.5
Subsurface burst:  f_omega -> 1.0, eps_couple -> 0.9     (almost always disrupts; fragment cloud per 6.10, v_ej scaled by sqrt(Q/Q_star))

Fuze accuracy [knob]: standoff requires closing speed U <= 5 km/s for Tier 1 fuzing, 20 km/s for Tier 2.
Yields [knob]: 100 kt, 300 kt, 1 Mt, 5 Mt.  Mass ~ 1500 kg + 500 kg per Mt.
Calibration target: 1 Mt standoff on a 1 km stony body should give a few cm/s. Tune C_m to land there.
```

Political cost: warheads cost extra budget and a score multiplier penalty. Disrupting with a nuke and then sweeping the fragments is a legitimate plan, but it is the messy one.

### 6.12 Slow push (rendezvous required)

All of these require matching the threat's velocity first (rendezvous), so the Lambert arrival mismatch `|v2 - v_threat|` must be paid by onboard propulsion or a sail. Then a thrust arc of duration `tau` acts on the threat. Ground truth: RK4-integrate the threat with the push acceleration during `tau`, then convert to elements.

```
Gravity tractor:      a_threat = G * m_sc / d^2,   d = hover distance from centre >= 1.5 R [knob]
                      hover thrust needed: F = 1.3 * m_sc * G*M / d^2  (canted thrusters); propellant via rocket equation
Ion beam shepherd:    a_threat = F_beam / M,  F_beam tiers 0.1 / 0.5 / 2 N;  Isp 3000 s;  m_dot = F / (Isp*G0)
Laser ablation:       F = C_m_laser * P_optical,  C_m_laser = 3e-5 N/W [knob];  P tiers 50 kW / 200 kW / 1 MW
                      (also delivers Q over time; negligible for disruption)
Direction: along-track (+ or -), chosen by the player; the planner recommends the sign that increases the miss.
```

These produce mm/s per year on 100 m class bodies. They are for small threats, for fine-tuning after a big push, and for fragment sweeping. The numbers will show the player that on their own they do not stop a kilometer rock with 3 years warning. That is correct.

### 6.13 Capture net (end-game)

A carbon-nanotube net wraps the body and couples it rigidly to a tug. Honest physics: the tug's thrust is the limit, not the net.

```
a_threat = F_tug / M,  F_tug tiers: 10 N (ion cluster) / 50 N / 200 N (nuclear-electric) [knob]
Net rating F_max tiers: 10 kN / 100 kN (tension limit; never the binding constraint with these tugs, by design)
Effects:
  - momentum coupling 100%, no beta uncertainty
  - rubble piles and fragment clusters are held together: Q_star x 3 for any impact on a netted body
  - a netted small fragment (< 60 m) can be "captured" and parked: score bonus, counts as resolved
  - enables SOFT PULL against a body already under tow: sail-tug combos
```

The "ultimate" feel comes from certainty and from cleaning up fragment fields, not from brute force.

### 6.14 Uncertainty and tracking

Knowledge of the orbit is imperfect and improves with tracking tier and time. Model only the along-track component at close approach, as a 1D Gaussian over the impact parameter.

```
sigma_v (velocity knowledge, m/s) by tracking tier [knob]:  Tier 0: 0.005, Tier 1: 0.001, Tier 2 (radar): 0.0002
sigma_b = 3 * sigma_v * T_remaining                          projected along-track 1-sigma at close approach (6.15 rule)

P_impact = Phi( (d_min + b_crit)/sigma_b ) - Phi( (d_min - b_crit)/sigma_b )     Phi = standard normal CDF
```

Shown as a percentage in the threat brief and after every maneuver ("MISS CONFIDENCE 94%"). Beta for a kinetic hit is drawn at impact but is not revealed to the player until the tracking tier's assessment delay passes (Tier 0: 60 days, Tier 1: 20 days, Tier 2: 5 days). Until then the planner shows the range.

### 6.15 Quick-estimate rules the planner uses (then verifies by propagation)

Along-track displacement from an impulse (near-circular orbits; derived from `da = 2 a^2 v dv / mu` and `dn/n = -1.5 da/a`):

```
miss_est ≈ 3 * dv_along_track * T_remaining
```

Worked: 1 cm/s with 10 years left gives ~9.5e6 m, about 1.5 planet radii.

Continuous push of acceleration `a` for duration `tau` followed by coast `T_rem`:

```
miss_est ≈ 3 * a * tau * (T_rem + tau/2)
```

Fragment cloud footprint: `≈ 3 * v_ej * T`. Rough hit fraction before Monte Carlo: `min(1, 2*b_crit / (3*v_ej*T))`.

These are display estimates. Every committed plan is resolved by actual propagation.

---

## 7. Mission system and planner

### 7.1 Mission object

```ts
interface Mission {
  id: string;
  archetype: 'KINETIC' | 'KINETIC_FLYBY' | 'SAIL_KINETIC' | 'SWARM' | 'HAMMER_SWEEP'
           | 'NUKE_STANDOFF' | 'NUKE_DISRUPT' | 'SLOW_PUSH' | 'NET_TOW';
  launcherTier: number;
  launchTime: number;            // s
  legs: Leg[];                   // Lambert coast, sail arc, flyby, DSM, split, thrust arc, terminal
  payload: { bus_kg: number; impactor_kg: number; sail?: SailSpec; stage?: StageSpec; warhead?: WarheadSpec; tug?: TugSpec; };
  autonomyTier: number;          // 0..3, see Section 8
  rules?: Rule[];                // Section 8 DSL
  cost: number;                  // budget units
  buildTime: number;             // s; launch cannot occur before now + buildTime
}
```

### 7.2 Plan archetypes (what the planner enumerates)

| Archetype      | What it does                                                            | Unlock        |
|----------------|-------------------------------------------------------------------------|---------------|
| KINETIC        | direct Lambert intercept, one impactor                                  | start         |
| SWARM          | k small impactors on staggered windows (and later, split from one bus)   | start (k<=3)  |
| KINETIC_FLYBY  | one or two gravity assists to raise U or reach bad geometry             | Tier 1 nav    |
| SAIL_KINETIC   | sail arc to build U, drop sail, hit                                      | Sail Tier 1   |
| HAMMER_SWEEP   | one big fast hit intended to disrupt early, then a second wave on fragments | Hammer      |
| NUKE_STANDOFF  | warhead, standoff burst, deflect                                        | Warheads 1    |
| NUKE_DISRUPT   | subsurface burst, then sweep                                            | Warheads 2    |
| SLOW_PUSH      | rendezvous + tractor / beam / laser                                      | Slow push     |
| NET_TOW        | rendezvous + net + tug                                                   | Net           |

### 7.3 Ranking

For each candidate (archetype x best few porkchop cells x payload options the budget allows):

```
1. feasibility:  C3 within launcher, mass within payload, buildTime fits, dv budgets close
2. resolve the plan deterministically (6.x) -> predicted d_min, fragments, residual
3. Monte Carlo N = 200 (worker): sample beta, sigma_v, fragment ejection -> P_miss, expected residual energy E_res (Mt)
4. score:
   S = w_miss * P_miss
     - w_res  * E_res / E_threat
     - w_cost * cost / budget_remaining
     + w_margin * clamp(margin_radii / 3, 0, 1)
     - w_nuke * (uses warhead ? 1 : 0)
   defaults [knob]: w_miss 1.0, w_res 0.6, w_cost 0.25, w_margin 0.15, w_nuke 0.1
5. label the category: DEFLECT (clean) / DISRUPT+SWEEP / SLOW PUSH / TOW; sort by S; show top 6 with bars and the readout
```

Readout panel example (vector text):

```
PLAN 2  DEFLECT (SAIL-KINETIC)        SCORE 0.81
 LAUNCH  T-6Y 040D   C3 18.4   PAYLOAD 2400 KG
 SAIL    T3  ARC 410D   dV +8.9 KM/S
 IMPACT  T-4Y 200D   U 27.3 KM/S   Q/Q* 0.04 (NO BREAKUP)
 PUSH    dV 4.1 CM/S (BETA 2.0..4.0)   MISS EST 3.3 R   P(MISS) 0.91
 COST    14 / 22
```

---

## 8. Autonomy (AI) tiers and the rules DSL

The problem the player faces: after a hit you learn how the body responded (beta, breakup) only after launch of the next wave would normally have had to be decided. Autonomy lets in-flight assets react.

```
Tier 0  FIXED        target locked at launch
Tier 1  RULES        player writes if/then rules evaluated at events (fragmentation, beta assessed, miss predicted)
Tier 2  ONBOARD      impactor re-solves Lambert from its current state to the best fragment within its remaining dv
Tier 3  SWARM        all in-flight assets solved jointly: greedy assignment of impactors to fragments by
                     (P_hit_i * mass_i) descending, each within its dv budget; re-run at every event
```

Rules DSL (JSON, validated, no eval):

```json
{ "when": "FRAGMENTATION",
  "if":   { "fragments.count": { ">": 1 } },
  "do":   "RETARGET",
  "target": "MAX(P_HIT * MASS)",
  "budget": "REMAINING_DV" }

{ "when": "BETA_ASSESSED",
  "if":   { "predicted.miss_radii": { "<": 1.5 } },
  "do":   "DEPLOY_SUBIMPACTORS",
  "count": 3 }
```

Events: `LAUNCH, FLYBY, SAIL_START, SAIL_END, DSM, SPLIT, IMPACT, FRAGMENTATION, BETA_ASSESSED, MISS_PREDICTED, CLOSE_APPROACH`.

**Split impactors (upgrade):** a carrier bus carries k sub-impactors, each `m/k` with its own small dv budget (Tier 1: 150 m/s cold gas, Tier 2: 600 m/s). At deploy time `t_d` each solves Lambert from the carrier state to its assigned fragment at `t_A`; feasible if required dv <= budget.

---

## 9. Tech tree and economy

Budget: `B` units per year `[knob]` (start 6/yr), accrued continuously on the clock. Research points: awarded per round from score. Tech costs research; missions cost budget.

```
LAUNCH       L1 basic -> L2 heavy -> L3 superheavy
IMPACTOR     I1 1 t -> I2 5 t -> I3 20 t  |  SOFT/BLUNT (crushable nose, beta~1, low Q)  |  HAMMER (dense tungsten, 2x mass per volume)
SWARM        S1 3 separate launches -> S2 split bus x3 (150 m/s) -> S3 split bus x8 (600 m/s)
NAV          N1 single flyby -> N2 double flyby + DSM budget -> N3 GIANT flyby
SAIL         SL1 .. SL4 (6.8) ; TARGET STEER control law at SL2
PROPULSION   P1 chemical kick (+1 km/s) -> P2 ion stage (+5 km/s over months) -> P3 nuclear-electric (+15 km/s)
TRACKING     T0 optical -> T1 dedicated scope -> T2 radar + precursor probe (reveals beta fast, rho exact)
AUTONOMY     A0 .. A3 (Section 8)
WARHEADS     W1 standoff 100 kt / 300 kt -> W2 1 Mt + subsurface -> W3 5 Mt
SLOW PUSH    G1 gravity tractor -> G2 ion beam shepherd -> G3 laser ablation 1 MW
NET          NET1 10 kN + 10 N tug -> NET2 100 kN + 200 N nuclear-electric tug   (SCI-FI mode; SPECULATIVE)
TERMINAL     PI penetrator array: last-ditch shredding of < 100 m bodies down to T-12 h (Section 20.2)
EARLY WARN   replaced by the PROGRAMS system of Section 19 once M5 lands (networks buy lead time)
```

Costs (budget units) `[knob]`: launcher 2/5/12; impactor 1/3/8; sail 2/3/5/9; chem stage 1; ion stage 3; warhead 6/12/25 (+score penalty); tractor/beam/laser package 4/6/12; net+tug 15/30. Build times: 0.5 yr small kinetic, 1 yr sail or nuke, 1.5 yr slow-push or net.

---

## 10. Round generation (seeded)

PRNG: mulberry32 or xoshiro128**, seeded from the run seed and round index. Everything random in a round draws from this stream in a fixed order.

```
k = round index (1-based)
lead time  T_lead = clamp( 12 - 0.8*k, 2.5, 12 ) * Uniform(0.7, 1.3)  years
diameter   D = logUniform( 50 * 1.15^k, 200 * 1.2^k )  m, capped 2000
type       weights by round: rubble/stony/iron from round 1; comet from round 4; binary from round 6
planet phases: each planet M0 = Uniform(0, 2pi)

collision construction (guarantees a hit, no search needed):
  t_i   = now + T_lead
  r_P, v_P = HOME state at t_i
  U_inf = logUniform(type range)            (comets 25..60 km/s)
  phi   = Uniform(0, 2pi)
  v_a   = v_P + U_inf * [cos(phi), sin(phi)]
  state (r_P, v_a) at t_i -> elements (6.3)
  accept if bound, prograde, periapsis > 0.25 AU, apoapsis < 6 AU (asteroid) or < 40 AU (comet), e < 0.98
  else redraw phi / U_inf
threat spawns "discovered" at now with Tier-dependent sigma_v
```

Name generator: vector-style designations like `2041 KX-7`. Planet name: fixed per run from a short seeded list, or let the player type one.

Note that HOME's position at `t_i` is on its real orbit, so the geometry (which side of the sun, what the inner planets are doing) is different every round. That is the "configuration changes" feature, for free.

From Milestone 5 on, `T_lead` is no longer drawn directly. The generator draws the orbit and size, runs the discovery algorithm of Section 18.2 against the networks active in this run, and keeps the candidate only if the resulting lead falls in the round's window `[0.6, 1.4] * T_lead(k)` (plus the occasional NO WARNING special). The sample above stays as the fallback when no detection model is loaded.

---

## 11. Time control, resolver, and replay

- Sim clock `t` in seconds. Warp levels: PAUSE, 1 day/s, 1 week/s, 1 month/s, 1 year/s, RESOLVE NOW.
- Everything coasting is analytic, so rendering at any warp is just evaluating elements at `t`. Thrust arcs are pre-integrated at commit time into sampled state tables (one sample per 6 h sim) and interpolated for display.
- **Resolver**: given the world state at `t` and the committed missions, computes the full future event timeline deterministically: launches, flybys, sail arcs, splits, impacts, fragmentation, autonomy decisions (Section 8, with the same seeded stream), close approaches. Output is an `EventLog` plus per-body element histories (`ElementSegment[]`: elements valid on `[t_from, t_to)`).
- The resolver runs in the worker and is re-run from `t` whenever the player pauses and commits a new mission. Earlier history is immutable.
- **Replay/debrief**: timeline scrubber over the event log; play-by-play text; speed up / slow down; pause on any event and inspect numbers. Since the log is deterministic, a replay is just re-rendering states; store only the seed, the mission list, and the event log.

---

## 12. Scoring, leaderboard, persistence

```
round_base   = log10(E_threat_Mt + 1) * 100 * (1 + 0.15 * k)
outcome      = clean miss (margin >= 1 R): 1.0 | marginal miss: 0.8 | partial (fragments hit, < 10% energy): 0.35 | HIT: run over
efficiency   = 0.5 * (budget_unspent / budget_available)          bonus
timing       = 0.3 * clamp(years_of_margin / T_lead, 0, 1)         resolved early bonus
style        = +0.2 no warhead, +0.2 no fragments produced, +0.3 net capture
round_score  = round_base * outcome * (1 + efficiency + timing + style)
run_score    = sum(round_score);  research_earned = floor(round_score / 50)
```

Leaderboard: top 20 runs per mode tab (REALISTIC / SCI-FI / FICTION): handle, rounds survived, run score, seed, date, tech path summary, ASSISTED flag if any cheat was used. Stored in `localStorage`. The run itself is saved as the markdown file of Section 22.1 (`SAVE.md`, plus `history/run-*.md` per finished run); replays of the last 5 runs stored as event logs. "Daily seed" mode gives everyone the same rounds.

---

## 13. Screens and UI

1. **TITLE / MENU**: the `MISS ∝ β` logo drawn stroke by stroke, attract mode (a random round resolving itself in the background), menu: NEW RUN / CONTINUE / TUTORIAL / LEARN (brain icon) / LEADERBOARD / CODEX / OPTIONS. Options: color mode, CRT effects, glow intensity, sound, units (SI / imperial display), learning level, reduce motion, text size. Section 25 has the tutorial and onboarding spec.
2. **SYSTEM VIEW** (main): star, orbits (dim), planets, threat with predicted path to `t_i`, ghost markers at `t_i`, spacecraft with trails, HUD: T-MINUS Y/D, BUDGET, ROUND, warp buttons, P(IMPACT). Scale toggle: LINEAR / COMPRESSED (radial `sqrt` so GIANT fits while the inner system stays readable).
3. **PLANET VIEW**: HOME disc with procedural continents, `b_crit` circle, approach corridor, fragment cloud cross-section, miss confidence.
4. **PLANNER**: left: archetype tabs; centre: porkchop contour or flyby windows; right: parameter sliders (payload, sail tier, flyby planet, split count, burst mode) and the ranked plan list with readouts; bottom: COMMIT / CLEAR. Rules editor for Autonomy Tier 1.
5. **TECH TREE**: node graph, vector lines, research counter.
6. **DEBRIEF**: timeline scrubber, event list, play-by-play text, score breakdown, counterfactual line ("a SUNWARD SENTINEL would have found it 26 days earlier"), NEXT ROUND.
7. **LEADERBOARD**: tabs per mode, export/import.
8. **PROGRAMS**: run-level projects with progress bars and funding sliders; the active network map (which surveys cover which sky).
9. **CODEX**: every network, program and method with its tag and equation (Section 22.4), each linked to its lore topic.
10. **CONSOLE** (`~`): cheat codes; in SIMULATION mode the FICTION commands and the knobs editor.
11. **LORE PANEL**: side panel opened by `?` or by clicking any entity, readout or program; shows the matching EDUCATION.md topic at the current level with level tabs S B I A E (Section 23).
12. **LEARNING CENTER**: full-screen mode behind the brain icon; topic tree, level selector, LABS tab, progress (Section 23).

Keyboard: space pause, `[`/`]` warp, `R` resolve now, `P` planner, `T` tech, `G` programs, `C` codex, `L` learning center, `?` lore panel, `~` console, `1..6` views, Esc back. Mouse/touch: pan/zoom, click bodies for readouts.

---

## 14. Architecture and file layout

```
/
  index.html
  package.json            vite, typescript, vitest only
  GAME_PLAN.md            this file
  src/
    main.ts               boot, state machine
    config/
      knobs.ts            every [knob] with its default
      tech.json           tech tree
      launchers.json      payload-vs-C3 tables
      bodies.json         star system defaults
      threats.json        type table
      networks.json       detection networks (18.3, 18.4) with model params and tags
      programs.json       infrastructure programs (19)
      methods.json        method catalog with tags (20); feeds the codex and the planner
      scenarios.json      SPAWN presets (22.2)
    physics/
      constants.ts  kepler.ts  elements.ts  closeApproach.ts  lambert.ts  stumpff.ts
      flyby.ts  sail.ts  integrate.ts (RK4)  kinetic.ts  fragment.ts  nuclear.ts
      slowPush.ts  net.ts  uncertainty.ts  estimates.ts  photometry.ts (H, V, phase)
    sim/
      world.ts  body.ts  mission.ts  resolver.ts  eventLog.ts  rng.ts  roundGen.ts
      detection.ts  programs.ts  civilDefense.ts
    planner/
      candidates.ts  porkchop.ts  monteCarlo.ts  ranking.ts  rules.ts (DSL)  autonomy.ts
    game/
      stateMachine.ts  economy.ts  tech.ts  scoring.ts  persistence.ts  replay.ts
      saveMd.ts (SAVE.md writer/parser)  cheats.ts  modes.ts  multiverse.ts  fiction.ts (20.4 commands)
    render/
      canvas.ts  vectorFont.ts (Hershey data)  glow.ts  crt.ts  glitch.ts (SIMULATION mode)
      palettes.ts  holo.ts (gradient strokes, WebGL2 bloom pass)  camera3d.ts (wireframe tilt projection)
      views/ system.ts planet.ts planner.ts tech.ts debrief.ts leaderboard.ts title.ts
             programs.ts codex.ts console.ts multiverse.ts (tiled) tutorial.ts
    lore/
      index.ts (loader + LRU cache)  panel.ts  center.ts  pictures/<pic-id>.ts  labs/<LAB_id>.ts (code-split)
    ui/
      hud.ts  input.ts  panels.ts
    worker/
      planner.worker.ts   porkchop grid, Monte Carlo, resolver, discovery search
  public/
    lore/               generated by scripts/build_lore.py: index.json, <ID>/<LEVEL>.json, svg/
  pymiss/               Python mirror of src/physics (same function names, snake_case) + gen_vectors.py
    physics/  tests/  notebooks/ (one per LAB, EXPERT level)
  scripts/
    build_lore.py       EDUCATION.md -> public/lore/*, with validation (see EDUCATION.md Section 0.2)
    gen_vectors.py      writes tests/vectors/*.json from pymiss
  docs/
    CODE_TOUR.md  ASSUMPTIONS.md  LESSONS/ (one page per lore group, for the GitHub Pages site)
  tests/
    kepler.test.ts lambert.test.ts flyby.test.ts kinetic.test.ts fragment.test.ts sail.test.ts
    closeApproach.test.ts roundGen.test.ts resolver.test.ts detection.test.ts programs.test.ts
    saveMd.test.ts modes.test.ts lore.test.ts palettes.test.ts vectors/ (shared JSON test vectors)
  EDUCATION.md  GAME_PLAN.md  STATUS.md  IDEAS.md  CHANGELOG.md  README.md  CONTRIBUTING.md  LICENSE (AGPL-3.0)
```

Rules of the codebase:
- `physics/` and `sim/` have zero DOM or Canvas imports.
- The worker receives plain JSON (world snapshot + missions) and returns plain JSON (event log + segments + MC stats).
- Rendering reads state; it never mutates it.
- Float64 throughout; positions in meters are fine at 1e12 scale.

---

## 15. Build milestones (do these in order)

**M0: Skeleton and orbits**
- Vite + TS scaffold, canvas with green vector rendering, Hershey font loaded.
- `kepler.ts`, `elements.ts`, constants. System view with the four planets orbiting. Time warp controls.
- Accept: planets complete one orbit in their correct periods; energy constant to 1e-12 relative; state->elements->state round trip to 1e-9.

**M1: A threat, and losing**
- Round generation with guaranteed collision (Section 10). Close approach test with gravitational focusing.
- Threat drawn with predicted path and ghost at `t_i`. RESOLVE NOW. Hit -> RUN OVER screen with energy in Mt.
- Accept: every generated threat impacts when unperturbed; `d_min < b_crit` for 100/100 seeds.

**M2: First playable: direct kinetic**
- Lambert, porkchop grid in the worker, launcher tables, KINETIC archetype, commit, resolver applies dv, close approach re-run, miss/hit, scoring, leaderboard in localStorage, next round.
- Accept: DART calibration test passes; a 100 m stony threat with 10 years warning is beaten by one Tier 1 launch; round loop works end to end.

**M3: Breaking things**
- Fragmentation (6.10), fragment cloud propagation, per-fragment impact tests, HAMMER_SWEEP and SWARM archetypes, planet view with cloud cross-section, Monte Carlo P(miss).
- Accept: disrupting late produces more hits than disrupting early in a seeded A/B test; fragment masses sum to the parent.

**M4: Going faster**
- Solar sail arcs (RK4), control laws, drop-sail; patched-conic flybys with the two-leg search; KINETIC_FLYBY and SAIL_KINETIC archetypes; flyby windows display.
- Accept: sail Tier 3 builds ~10 km/s in one year of SPIRAL OUT; flyby preserves |v_inf| to 1e-9; a GIANT flyby raises U by > 10 km/s in at least one seeded configuration.

**M5: Seeing it coming**
- Photometry and the detection model (18.1), `networks.json` with today's networks (18.3), the discovery search in the worker (18.2), round generation switched to detection-derived lead time (Section 10 note), civil defense action (18.6), PROGRAMS panel with the REALISTIC programs of Section 19, `SAVE.md` writer/parser and `history/` export (22.1), codex screen generated from config.
- Accept: a 140 m stony threat on a typical Apollo-type orbit is discovered 5 to 15 years out with the 2026 network set; an 18 m sunward object is never discovered; adding SUNWARD_SENTINEL discovers a 25 m sunward object with >= 3 weeks lead in 90/100 seeds; SAVE.md round-trips (parse(write(state)) deep-equals state).

**M6: The full tree**
- Economy, tech tree UI, autonomy tiers and rules DSL, split impactors, nuclear (incl. HAIV, pulse train), slow push family (tractor, enhanced tractor, ion beam, laser, mirrors, mass driver, tugboat, tether ballast, electrostatic, e-sail), PI, capture bag, tracking tiers and beta reveal delay, debrief scrubber and play-by-play, leaderboard tabs. Every method in 20.1 and 20.2 present and tagged.
- Accept: every archetype resolves without NaN across 1000 random rounds (fuzz test); balance pass against Section 17; the NOT VIABLE methods (Yarkovsky, electrostatic, tether) display their honest numbers.

**M7: Modes, cheats, fiction**
- `modes.ts` with the nesting rules of Section 21; SCI-FI methods and programs (20.3, 19); civilization levels; cheat console and all codes of 22.2 incl. SPAWN scenarios; SIMULATION console commands of 20.4 with their forbidding-quantity lines; knobs editor; MULTIVERSE forking with tiled render and COLLAPSE; glitch renderer.
- Accept: a FICTION command used in REALISTIC mode is rejected with the mode-gating message; MULTIVERSE x9 runs at >= 30 fps; leaderboard entries land on the correct tab; `cheats_used` written to SAVE.md.

**M8: Polish**
- CRT effects, sound, attract mode, daily seed, compressed scale toggle, controller/touch, performance pass (60 fps with 40 fragments and 12 spacecraft at 1 yr/s), DART tutorial round.

**M9: Learning Center and lore**
- `scripts/build_lore.py` with full validation; `src/lore` loader, LRU cache, lore panel (`?` and click-through from every entity, readout, network, program, method), Learning Center screen with topic tree, level selector, search, bookmarks, progress; all 55 SIMPLE pictures as SVG generators; the first six LABs (ELLIPSE, KEPLER_SOLVER, BETA, 3DVT, MAGNITUDE, FOCUSING); `learning_level` and `lore_read` in SAVE.md; codex entries linked to topics.
- Accept: lore chunks load only on demand (network tab shows none at game start); cache never exceeds 2 MB; every topic opens at every level; build fails on a missing picture, level, related id or LAB id; no em dash anywhere in generated content.

**M10: Visual system**
- Palettes and semantic colors (Section 24), SPECTRUM unlock, all color modes incl. DAYLIGHT, HOLO gradient strokes with an optional WebGL2 bloom pass, wireframe-3D tilt of the system view and the wireframe planet, holographic panel transitions, colorblind-safe line styles, reduce-motion. Remaining LABs (all 20 in EDUCATION.md Section 7).
- Accept: every mode passes the 4.5:1 text-contrast test; HOLO falls back to Canvas-only when WebGL2 is absent; 60 fps at 1080p in HOLO on an integrated GPU with 40 fragments.

**M11: Teaching repo and Python companion**
- `pymiss` mirroring every `src/physics` function; `gen_vectors.py` producing shared test vectors consumed by vitest and pytest; one notebook per LAB; `docs/CODE_TOUR.md`, `docs/ASSUMPTIONS.md`, README with the "learn to code with this repo" path, CONTRIBUTING, `good first issue` templates, AGPL-3.0 license; GitHub Actions (vitest + pytest + lore validation + Playwright smoke) and GitHub Pages deploy of the game and docs; optional Pyodide "RUN IN PYTHON" in EXPERT labs.
- Accept: CI green; every physics function has a vector test in both languages; Pages serves the game at the repo URL; a new contributor can add a palette by following CONTRIBUTING alone.

**M12: Exhaustion check and idea harvest**
- Walk Sections 19, 20, 22.2 and EDUCATION.md's topic map and LAB registry; confirm every item exists and is tested; write the final STATUS.md. Then print `IDEAS.md` as a numbered list with a one-line recommendation each and stop for the interactive phase. Nothing from IDEAS.md is built before that.

---

## 16. Test and calibration cases

```
KEPLER      HOME at a=1 AU, e=0.017: period = 365.25 d within 0.01 d; r at periapsis = a(1-e)
ROUNDTRIP   random (r,v) -> elements -> (r,v): |dr| < 1 m, |dv| < 1e-6 m/s
LAMBERT     circular coplanar 1.0 -> 1.524 AU Hohmann, dt = 259 days:
            departure v_inf ≈ 2.94 km/s (C3 ≈ 8.6 km^2/s^2), arrival v_inf ≈ 2.65 km/s, within 2%
FLYBY       GIANT, r_p = 10 R, v_inf = 10 km/s -> delta ≈ 80.2 deg; |v_inf_out| == |v_inf_in|
FOCUSING    v_inf = 10 km/s -> b_crit ≈ 1.50 R_home
DART        m = 580 kg, U = 6.14 km/s, M = 4.3e9 kg, beta = 3.6 -> dv ≈ 3.0 mm/s (observed ~2.7 mm/s); within 50%
3DV RULE    dv_along = 1 cm/s, T = 10 yr -> propagated d_min change within 25% of 9.5e6 m
Q_STAR      basalt, R = 100 m, rho 2700 -> 300..400 J/kg
FRAGMENT    masses sum to parent within 1e-9; COM momentum conserved within 1e-6
SAIL        sigma = 10 g/m^2, eta 0.9 -> a_c ≈ 0.82 mm/s^2; 1 yr SPIRAL OUT from 1 AU -> dv_equiv 8..11 km/s
NUCLEAR     1 Mt standoff, H = R/2, on D = 1 km stony -> 2..6 cm/s after C_m calibration
ROUNDGEN    1000 seeds: all bound, prograde, impacting; distribution of D and T_lead matches Section 10
RESOLVER    same seed + same missions twice -> identical event logs (byte-equal JSON)
PHOTOMETRY  D = 140 m, p = 0.14 -> H ≈ 22.0;  D = 1 km, p = 0.14 -> H ≈ 17.7;  D = 20 m, p = 0.14 -> H ≈ 26.2
DETECTION   V for H = 22 at r = 1.1 AU, delta = 0.1 AU, alpha = 20 deg -> ~17.9 (easy);  at delta = 1 AU -> ~22.9 (Rubin only)
DISCOVERY   2026 network set, 140 m Apollo-type orbit: lead 5..15 yr in >= 80% of 200 seeds
            2026 network set, 18 m object approaching from eps < 30 deg: lead = 0 in >= 95% of seeds
            + SUNWARD_SENTINEL: 25 m sunward object, lead >= 21 d in >= 90% of seeds
PROGRAMS    funding 1.0 for `years` years -> progress 1.0 within 1e-9; funding 0.5 -> 0.5
SAVE_MD     write -> parse -> deep-equal; a hand-edited front matter field survives a round trip
MODES       FICTION command in REALISTIC -> rejected; MULTIVERSE requires SIMULATION requires SCIFI
LORE        build_lore.py: 55 topics x 5 levels; every PICTURE id has a generator; every DEMO id is in the LAB registry;
            SIMPLE text <= 20 words; related ids resolve; zero em dashes; index.json < 20 KB
VECTORS     every function in src/physics has a tests/vectors/*.json entry generated by pymiss and both test suites pass on it
PALETTES    every mode: text contrast >= 4.5:1 against bg; every semantic color has a distinct line style
SINGULARITY t_evap(M = 1e4 kg) = 5120 pi G^2 M^3 / (hbar c^4) ≈ 8.4e-5 s; t_evap(1e9 kg) ≈ 2.7e3 yr (the fiction readouts must be right too)
```

---

## 17. Balance targets (worked numbers to aim for)

```
Round 1:  D 100 m stony, 10 yr.  M ≈ 1.4e9 kg.  One I1 impactor 1500 kg at U 10 km/s, beta 3:
          dv ≈ 0.032 m/s; 8 yr left -> miss ≈ 3*0.032*2.5e8 ≈ 2.4e7 m ≈ 3.8 R.  Easy win, teaches the loop.

Round 3:  D 300 m stony, 7 yr.  M ≈ 3.8e10 kg.  One 2 t impactor at 12 km/s, beta 3 -> dv 1.9 mm/s,
          6 yr left -> miss 0.17 R. NOT ENOUGH. Player needs ~8 impactors, or one sail-boosted 20 t at 30 km/s
          (dv 4.7 cm/s -> 4.2 R), or a 300 kt standoff. This is where the tech tree starts to matter.

Round 6:  D 800 m iron, 4 yr.  Kinetic is hopeless; standoff 1 Mt gives a few cm/s -> ~1 R with 3 yr left: marginal.
          Options: two warheads, early GIANT-flyby heavy hammer accepting disruption + sweep, or net+tug started on day one.

Comet round: D 600 m icy, 2.5 yr, U_inf 45 km/s. Fast, weak, far. Sail intercepts are too slow; chemical kick + direct
          Lambert with a HAMMER to disrupt early (Q_star low for ice), then SWARM sweep with Tier 2 autonomy.
```

If these do not come out of the sim within a factor of ~2, the constants are wrong, not the design.

---

## 18. Detection networks (finding it before it finds you)

The deflection half of the game is useless without lead time, and lead time comes from surveys. This section puts the real detection architecture into the sim, with real sensitivities, so that "how many years of warning do I get" is computed from physics and from what the player has built, not drawn from a hat.

### 18.1 Detection model (equations, `sim/detection.ts`)

```
Geometric albedo p [knob]:  rubble/C 0.06   stony/S 0.20   iron/M 0.15   comet nucleus 0.04
Absolute magnitude:   H = 5 * log10( 1329 / (D_km * sqrt(p)) )
Apparent magnitude:   V = H + 5*log10(r_au * delta_au) + 0.035 * alpha_deg
                      r = sun-threat distance, delta = observer-threat distance, alpha = phase angle (sun-threat-observer)
                      (0.035/deg is a crude phase slope; swap in the IAU H-G system with G = 0.15 if you want it right)
Elongation:           eps = angle sun-observer-threat, degrees

GROUND OPTICAL survey detects on a given night if:
   V <= V_lim  AND  eps >= 60 deg  AND  rand() < p_cover (sky-coverage probability per night)  AND  moon penalty passes
   moon penalty [knob]: within 3 days of full moon the effective V_lim drops by 1.5
SPACE INFRARED survey is albedo-blind. Thermal flux ~ D^2 / (r^2 * delta^2), so:
   detects if  D >= D_ref * (r_au * delta_au) / (r_ref * delta_ref)  AND  eps in [eps_min, eps_max]
RADAR (tracking only, never discovery):
   if a discovered threat passes within range_max, sigma_v collapses to the radar tier value and rho/shape are revealed

Orbit knowledge improves with observed arc:  sigma_v(t) = max( sigma_v_tier, sigma_v_0 * sqrt(30 days / arc_days) )
```

### 18.2 Discovery algorithm (replaces the fixed lead-time draw once networks exist)

```
given a generated threat (orbit + D + type) and the set of networks ACTIVE at each date:
  for t from t_i - 20 years to t_i, step 1 day:
     for each active network: evaluate detect(t); a survey "discovers" on the 3rd consecutive detection night
  t_disc = earliest discovery across networks      lead = t_i - t_disc
  if never discovered: lead = 0 -> NO WARNING round (civil defense only, see 18.6)
```

Per threat this is ~7300 cheap evaluations. It produces the real behaviour for free: a 140 m rock on a typical orbit is caught on an earlier apparition years out by a Rubin-class survey; a 30 m rock is found days to weeks out; anything coming from the sunward side is invisible to ground surveys until it is almost on top of you (Chelyabinsk, 2013, ~18 m, zero warning).

Round generation (Section 10) keeps its difficulty ramp by rejection sampling: draw orbits until the discovery-derived lead lands in the round's target window, and with probability `p_surprise(k)` allow a NO WARNING event as a special round.

### 18.3 Networks that exist today (2026). Tag: REAL

| Network                              | Where / type                               | Model params (approx, `[verify]`)         | Notes                                                                  |
|--------------------------------------|--------------------------------------------|-------------------------------------------|------------------------------------------------------------------------|
| Catalina Sky Survey                  | Arizona, 1.5 m (G96) + 0.7 m Schmidt (703) | V_lim 21.5 / 19.5, eps >= 60, p_cover 0.5 | historically the largest share of NEO discoveries                     |
| Pan-STARRS 1 + 2                     | Haleakala, two 1.8 m                       | V_lim 22, p_cover 0.5                     | deep, northern sky                                                      |
| ATLAS (4 units)                      | Hawaii x2, Chile, South Africa, 0.5 m      | V_lim 19.5, p_cover 0.95 (whole sky nightly) | the last-days warning system; found 2024 YR4                        |
| ZTF                                  | Palomar 1.2 m Schmidt                      | V_lim 20.5, p_cover 0.6                   | fast cadence                                                            |
| Rubin Observatory / LSST             | Cerro Pachon, 8.4 m                        | V_lim 24.5, p_cover 0.6, southern sky     | 10-year survey formally under way in 2026; roughly 6x the sensitivity of existing surveys; expected to add on the order of 90,000 NEOs |
| ESA Flyeye #1                        | 1 m, 44 deg^2 compound-eye optic            | V_lim 21.5, p_cover 0.8                   | first light 2025 (Matera), to be sited on Monte Mufara, Sicily; up to four planned |
| CNEOST                               | Xuyi, China, 1.04 m Schmidt                 | V_lim 21, p_cover 0.4                     |                                                                         |
| Goldstone DSS-14 + Green Bank radar  | California / West Virginia                 | range_max 0.1 AU for 100 m class          | tracking and shape; Arecibo lost in 2020                               |
| China compound-eye radar array       | Chongqing, phased array (under construction)| range_max 0.1 AU (planned)                |                                                                         |
| Space IR survey                      | none operating                             |                                           | NEOWISE ended 2024; the gap NEO Surveyor fills                          |
| Coordination layer                   | MPC, CNEOS Sentry-II + Scout, ESA NEOCC Aegis, NEODyS, IAWN, SMPAG, NASA PDCO, UN COPUOS | reduces false alarms; +research | in game: the "INTERNATIONAL COORDINATION" program                       |
| Airburst sensing                     | GOES lightning mappers, CTBTO infrasound, US government sensors, fireball camera networks | post-hoc only | flavor: NO WARNING rounds get an "infrasound detected" log line         |

Statistics the threat brief can quote (as of 2026, `[verify]`): roughly 95% of NEOs larger than 1 km are known; only about 40% of those larger than 140 m are known, against a 2005 US congressional mandate of 90%.

### 18.4 Planned and proposed networks. Tag: PROPOSED unless noted

| Program (in-game id)                 | Real-world basis                                           | Model params                                                | Deploy time (game years) | Status      |
|--------------------------------------|------------------------------------------------------------|-------------------------------------------------------------|--------------------------|-------------|
| SPACE_IR_SURVEYOR                    | NASA NEO Surveyor: 50 cm IR telescope at Sun-Earth L1, launch planned Sept 2027 (no later than June 2028), 12-year mission, goal 2/3 of 140 m NEOs in 5 years and 90% in 10 | IR, D_ref 140 m at r*delta = 0.5 AU^2 [knob], eps 45..120 | 4 | REAL (built, awaiting launch) |
| SUNWARD_SENTINEL                     | ESA NEOMIR: IR telescope at L1 watching the ring around the Sun, launch early 2030s; 20 m objects with at least 3 weeks warning, worst case 3 days | IR, D_ref 20 m at r*delta = 0.18 AU^2, eps 10..45 | 5 | PROPOSED (ESA study phase) |
| FLYEYE_NETWORK                       | four Flyeye sites across both hemispheres                  | adds p_cover to 0.95 at V_lim 21.5                          | 3                        | PROPOSED (funded in part) |
| TWILIGHT_SURVEY                      | Rubin twilight observations of the interior (Atira) region | ground, eps >= 45, V_lim 22                                 | 1                        | PROPOSED    |
| RADAR_NET                            | second 70 m class dish + phased array                      | range_max 0.2 AU, sigma_v tier 2                            | 3                        | PROPOSED    |
| CHINA_SPACE_SURVEY                   | CNSA concept similar to NEO Surveyor                       | second IR surveyor, p_cover up                              | 5                        | PROPOSED    |
| L4_L5_SENTINELS                      | twin telescopes at Earth-Sun L4/L5 for parallax and interior coverage | sigma_v / 3 on discovery; eps limit removed for one side   | 6                        | PROPOSED (studied) |
| VENUS_ORBIT_IR                       | IR survey from a Venus-like orbit (studied in the 2000s, revived for Atiras) | sees interior-orbit threats; D_ref 100 m at 0.5 AU^2 | 7 | PROPOSED |
| LUNAR_FARSIDE_STATION                | survey telescopes on the lunar far side                    | V_lim 25, p_cover 0.7, no weather                           | 8                        | PROPOSED    |
| RADAR_CONSTELLATION                  | space-based radar at high orbit                            | range_max 0.3 AU                                            | 8                        | SPECULATIVE |
| INTERSTELLAR_WATCH                   | wide-field survey tuned for hyperbolic visitors (1I/2017 U1, 2I/Borisov, 3I/ATLAS 2025) | enables the interstellar-object round type | 2 | PROPOSED |

Each program is a run-level background project (Section 19): it costs budget per year, takes years, and changes the detection model for all later rounds. The payoff is lead time, and lead time is the most powerful deflection multiplier in the game (`miss ≈ 3 * dv * T`).

### 18.5 Demonstration missions (history and near-future, for the codex)

| Mission                 | Year         | What it showed                                                          | Tag  |
|-------------------------|--------------|-------------------------------------------------------------------------|------|
| Deep Impact             | 2005         | 370 kg impactor at 10.3 km/s into comet Tempel 1 (science, not deflection) | REAL |
| Hayabusa2 SCI           | 2019         | 2 kg copper slug at 2 km/s made a crater on Ryugu                        | REAL |
| DART                    | 2022         | 580 kg at 6.1 km/s; Dimorphos period changed by 33 min; beta ≈ 3.6       | REAL |
| Sandia Z-machine test   | 2024         | lab demonstration of X-ray ablation deflection on mock asteroids (nuclear standoff physics) | REAL |
| Hera                    | arrives late 2026 | measures the DART crater, Dimorphos mass and interior (beta pinned down) | REAL |
| China kinetic impactor  | launch ~2027, impact 2029 | observer + impactor on 2015 XF261 (~30 m) at ~10 km/s; direct heliocentric orbit change measured | REAL (in development) |
| RAMSES (ESA/JAXA) and OSIRIS-APEX | 2029 | rendezvous with Apophis during its 2029 Earth flyby                    | REAL (in development) |
| ARM (Asteroid Redirect) | cancelled 2017 | boulder capture bag + enhanced gravity tractor demo                     | PROPOSED |
| Don Quijote / NEOShield | 2005 / 2012-15 | ESA and EU kinetic impactor + observer studies that fed DART/Hera     | PROPOSED |

### 18.6 Civil defense (the fallback). Tag: REAL

When lead time is too short for any deflection, the only real option is evacuation of the impact corridor, which planetary defense exercises rehearse. In game:

```
impact corridor: in 2D, the sigma_b spread projected onto HOME's limb; drawn in the planet view
EVACUATE action: cost 2 budget units, available any time
damage multiplier: AIRBURST 0.3, CITY 0.4, REGIONAL 0.7 (no help for GLOBAL)
outcome: a hit still ends the run unless the threat is AIRBURST or CITY class with evacuation ordered >= 7 days out,
         in which case the round scores as PARTIAL and the run continues (round_score x 0.25)
```

---

## 19. Defense infrastructure programs (working in the background)

Run-level projects, separate from per-mission spending. They take years of sim time, drain budget per year while active, can be paused, and persist across rounds. They appear in a PROGRAMS panel with progress bars, and the planner takes their effects into account automatically.

```ts
interface Program {
  id: string;
  tag: 'REAL' | 'PROPOSED' | 'SPECULATIVE';
  years: number;            // to completion at full funding
  costPerYear: number;      // budget units
  prereq?: string[];        // other program ids or tech ids
  mode: 'REALISTIC' | 'SCIFI';
  effects: Effect[];        // applied to knobs/networks when progress reaches 1.0
}
progress += (funding_fraction) * dt / (years * YEAR);   funding_fraction in [0, 1], player sets it
```

| id                         | Tag         | Years | Cost/yr | Effect when complete                                                        | Mode      |
|----------------------------|-------------|-------|---------|------------------------------------------------------------------------------|-----------|
| INTL_COORDINATION          | REAL        | 1     | 1       | +2 budget/yr, +10% research, warhead score penalty halved                     | REALISTIC |
| CIVIL_DEFENSE_READY        | REAL        | 2     | 1       | evacuation threshold 7 d -> 2 d; damage multipliers x0.7                      | REALISTIC |
| GROUND_SURVEY_EXPANSION    | REAL        | 3     | 2       | adds FLYEYE_NETWORK + Rubin-class coverage to 0.9                             | REALISTIC |
| SPACE_IR_SURVEYOR          | REAL        | 4     | 3       | NEO Surveyor-class IR at L1 (18.4)                                            | REALISTIC |
| SUNWARD_SENTINEL           | PROPOSED    | 5     | 3       | NEOMIR-class sunward ring coverage (18.4)                                     | REALISTIC |
| RADAR_NET                  | PROPOSED    | 3     | 2       | tracking tier 2 for any discovered threat within 0.2 AU                       | REALISTIC |
| PRECURSOR_FLEET            | PROPOSED    | 2     | 2       | a reconnaissance probe auto-launches at discovery: rho, spin, beta range known within 1 yr | REALISTIC |
| INTERCEPTOR_STOCKPILE      | PROPOSED    | 3     | 3       | up to 4 kinetic impactors pre-built: build time 0.5 yr -> 0.1 yr              | REALISTIC |
| HEAVY_LAUNCH_CADENCE       | PROPOSED    | 4     | 3       | launches per year cap 2 -> 6; Tier 3 launcher unlock                          | REALISTIC |
| ORBITAL_DEPOT              | PROPOSED    | 5     | 4       | propellant depot in high orbit: effective C3 +15 km^2/s^2 for departures      | REALISTIC |
| NUCLEAR_READINESS          | PROPOSED    | 3     | 2       | warheads available with 0.5 yr build (treaty framework + device stock)        | REALISTIC |
| GROUND_LASER               | PROPOSED    | 4     | 3       | ground laser station (Phipps): ablation while a threat is within 0.05 AU, atm_eff 0.3 | REALISTIC |
| L4_L5_SENTINELS            | PROPOSED    | 6     | 4       | sigma_v / 3 at discovery; interior coverage                                   | REALISTIC |
| VENUS_ORBIT_IR             | PROPOSED    | 7     | 5       | interior-orbit threats discovered                                             | REALISTIC |
| LUNAR_FARSIDE_STATION      | PROPOSED    | 8     | 5       | V_lim 25, p_cover 0.7                                                         | REALISTIC |
| SAIL_SWARM_DEPOT           | SPECULATIVE | 6     | 6       | 6 sail impactors pre-accelerated to 15 km/s parked at 0.6 AU, ready on demand | SCIFI     |
| ORBITAL_LASER_ARRAY        | SPECULATIVE | 10    | 10      | DE-STAR-class phased laser at L1: laser ablation of any threat within 0.3 AU without a flight | SCIFI |
| LUNAR_MASS_DRIVER          | SPECULATIVE | 12    | 10      | impactor launches from the Moon weekly, C3 free up to 60 km^2/s^2            | SCIFI     |
| FUSION_TUG_FLEET           | SPECULATIVE | 15    | 15      | 50 kN continuous-thrust tugs (Section 20.3)                                   | SCIFI     |
| DISASSEMBLER_SWARM         | SPECULATIVE | 20    | 20      | von Neumann mining swarm: consumes a threat with M(t) = M0 * exp(-t/tau), tau = 5 yr | SCIFI |

Design note: the early programs are cheap and real; the player who ignores them loses to a sunward 60 m rock in round 5. The game should make that lesson land once, loudly, in the debrief ("DISCOVERED 11 DAYS BEFORE IMPACT. A SUNWARD SENTINEL WOULD HAVE SEEN IT 26 DAYS EARLIER.").

---

## 20. Method catalog: every deflection proposal, tagged

Tags, enforced in `config/methods.json` and shown in the in-game CODEX:
- **REAL**: flown, demonstrated, or lab-verified.
- **PROPOSED**: published engineering studies with honest physics; nothing stops it but money and time.
- **SPECULATIVE**: physics-consistent but needs technology that does not exist at the needed scale. SCI-FI mode only.
- **FICTION**: violates known physics or the game itself. SIMULATION / MULTIVERSE modes only. Every FICTION entry prints the quantity that forbids it.

### 20.1 REAL

| Method                      | In-game model                                                     | Unlock       |
|-----------------------------|-------------------------------------------------------------------|--------------|
| Kinetic impactor            | Section 6.9 (DART calibration)                                    | start        |
| Precursor cratering probe   | Hayabusa2-SCI style small slug: reveals strength multiplier and beta range (Q tiny) | Tracking T1 |
| Civil defense / evacuation  | Section 18.6                                                      | start        |
| Nuclear standoff (X-ray ablation) | Section 6.11; physics lab-verified (Z-machine 2024), never flown | Warheads W1 |

### 20.2 PROPOSED

| Method                              | In-game model                                                                                                   | Unlock          |
|-------------------------------------|-----------------------------------------------------------------------------------------------------------------|-----------------|
| Nuclear surface / subsurface        | Section 6.11 disruption branch                                                                                   | W2              |
| HAIV (hypervelocity intercept vehicle) | leader impactor opens a crater, follower warhead detonates in it: subsurface coupling at high U, accuracy factor 0.7 [knob] | W2 + I2 |
| HAMMER (NASA/NNSA 2018 study)        | 8.8 t vehicle usable as kinetic or nuclear; a Tier 3 launcher payload preset                                    | L3              |
| Nuclear pulse train                  | several standoff bursts spaced in time; sum of 6.11 impulses; fragmentation check after each                     | W3              |
| Gravity tractor                      | Section 6.12                                                                                                     | G1              |
| Enhanced gravity tractor             | tractor picks up a surface boulder: m_sc += m_boulder (up to 20 t) [knob]                                        | G1 + NET1       |
| Ion beam shepherd                    | Section 6.12                                                                                                     | G2              |
| Laser ablation (DE-STARLITE class)   | Section 6.12                                                                                                     | G3              |
| Ground-based laser (Phipps)          | F = C_m_laser * P * atm_eff, atm_eff 0.3 [knob]; only while threat is within 0.05 AU and above the horizon station | GROUND_LASER program |
| Solar concentrator / "mirror bees"   | P_conc = 0.6 * 1361 * A_mirror (W); F = 1e-4 * P_conc [knob]; dust fouling: A decays 10%/month of operation      | G2              |
| Mass driver (mine and throw)         | F = m_dot * v_e; tiers m_dot 0.1 / 1 / 10 kg/s at v_e 500 m/s; power = 0.5 * m_dot * v_e^2; needs landing + anchoring (rendezvous) | G3        |
| Tugboat (attach and push)            | a = eta_spin * F / M; F = 2 kN chemical (propellant-limited, rocket equation) or 5 N ion; eta_spin 0.3 unless despun [knob] | G2    |
| Tether ballast                       | COM shift dr = L * m_b / (M + m_b); L up to 1000 km, m_b 20 t: shows ~100 m. Included so the number is on screen | G1              |
| Electrostatic tractor                | Coulomb force between charged craft and body, screened by solar-wind plasma (Debye length ~10 m at 1 AU): F ~ 0 beyond that. Shown, then greyed as NOT VIABLE | G1 |
| Magnetic tractor (iron bodies)       | contact-only induction tug; same numbers as Tugboat with eta_spin 0.5                                            | G2, iron only   |
| Yarkovsky / albedo paint             | da/dt ~ 2e-4 AU/Myr for a 1 km body: ~300 m of drift in 10 years. Shown as NOT VIABLE at game timescales        | always shown    |
| Solar sail attached to the body      | F = 2 * P_RAD * A * (AU/r)^2; A up to 1 km^2 gives ~9 N                                                          | SL2 + NET1      |
| Electric sail / magnetic sail tug    | F ~ 0.5 mN per km of tether at 1 AU; 100 km tether gives 50 mN. Small-body tool                                 | SL2             |
| PI "Pulverize It" (Lubin)            | array of penetrator rods shreds a < 100 m body hours to days before impact into < 10 m pieces that airburst high; damage = 0.05 * E_threat; allowed down to T-12 h | PI tech |
| Capture bag (ARM style)              | capture of a < 10 m body or fragment; counts as resolved; +score                                                 | NET1            |
| Conventional explosives (surface)    | Q from chemical yield (4.2 MJ/kg); weak; mostly a fragmentation hazard                                           | start           |
| Dust cloud braking                   | steer a cloud ejected from a nearby small asteroid into the threat's path: drag impulse dv = sigma_cloud * U^2 * A / M... requires a donor body within 0.05 AU; rare | G3 |
| Multiple-mission campaigns            | the planner's SWARM and HAMMER_SWEEP archetypes (Section 7)                                                     | start           |

### 20.3 SPECULATIVE (SCI-FI mode)

| Method                            | In-game model                                                                                      | Why it is not PROPOSED                                 |
|-----------------------------------|----------------------------------------------------------------------------------------------------|--------------------------------------------------------|
| Carbon nanotube capture net + tug | Section 6.13                                                                                       | km-scale CNT fabric does not exist                     |
| Graphene sails (SL4)              | Section 6.8 Tier 4                                                                                 | 3 g/m^2 sails at km^2 scale                            |
| DE-STAR orbital laser array       | ORBITAL_LASER_ARRAY program: F = 3e-5 * P_opt, P_opt 1 GW .. 70 GW, works at range without a flight | GW-class phased arrays in orbit                        |
| Nuclear pulse tug (Orion style)   | pulse unit impulse 1e7 N s [knob], one pulse per 10 s, N pulses; dv = N * 1e7 / M; attach + despin required | never built; treaty-barred                        |
| Fusion tug                        | F = 50 kN continuous: a = F/M, one year on 1e11 kg gives ~15 m/s                                   | no fusion engine exists                                |
| Antimatter standoff               | 1 g of antimatter = 1.8e14 J (~43 kt); same model as 6.11 with eps_couple 0.5 and no fuze limit    | storage and production are 12 orders of magnitude off |
| Lunar mass-driver interceptor     | LUNAR_MASS_DRIVER program: weekly 5 t impactors at C3 up to 60, no launcher cost                   | lunar industry                                         |
| Pre-accelerated sail swarm        | SAIL_SWARM_DEPOT program                                                                           | needs decades of lead and a depot                      |
| Asteroid billiards                | capture a 20 m rock (1e7 kg) years earlier, steer it with a sail, hit the threat at 10 km/s: dv = beta * 1e7 * 1e4 / M | decade-scale lead, enormous ops; physics fine |
| Disassembler swarm                | DISASSEMBLER_SWARM program; M(t) exponential decay; residual dust cloud is harmless                | self-replicating machines                              |
| Planetary-scale civil defense     | arcologies: damage multipliers x0.1 for CITY/REGIONAL                                              | economics                                              |

### 20.4 FICTION (SIMULATION and MULTIVERSE modes)

Each entry is a console command. Each prints one honest line about why it is fiction, then does the thing anyway.

| Command           | Effect in the sim                                                              | The forbidding quantity printed                                              |
|-------------------|--------------------------------------------------------------------------------|------------------------------------------------------------------------------|
| TELEPORT          | threat position += 1 AU along-track                                            | "NO-CLONING THEOREM FORBIDS COPYING ITS STATE. ALSO NOBODY BUILT A RECEIVER." |
| OBSERVE           | "quantum redirection": re-roll the orbit; miss with P = 1/e                    | "WAVEFUNCTIONS OF 1e11 KG BODIES HAVE DECOHERED. WE ARE PRETENDING."         |
| REWIND n          | rewind the round clock n years, keep knowledge                                 | "CLOSED TIMELIKE CURVES NOT FOUND."                                          |
| EDIT G x          | change G (or MU_SUN) live; planets drift; glitch render                        | "G HAS BEEN 6.674e-11 FOR 13.8 GYR."                                         |
| DELETE            | remove the threat entity                                                        | "MASS-ENERGY CONSERVATION VIOLATED BY 9e27 J."                               |
| NOCLIP            | HOME becomes non-colliding this round                                           | "PAULI EXCLUSION STILL APPLIES TO PLANETS."                                  |
| TRACTORBEAM       | 1e6 N on the threat at any range, no reaction mass                              | "MOMENTUM CONSERVATION: WHO IS PUSHING BACK?"                                |
| SINGULARITY       | pocket black hole near the threat; it evaporates via Hawking radiation (t_evap = 5120 pi G^2 M^3 / (hbar c^4)) | "A 1e4 KG HOLE LASTS 8e-5 S AND RELEASES 9e20 J (215 MT) NEXT TO YOUR PROBE. ROUND OVER." |
| WORMHOLE          | route the threat into another MULTIVERSE branch                                 | "EXOTIC MATTER WITH NEGATIVE ENERGY DENSITY: 0 KG ON HAND."                  |
| DIPLOMACY         | send a message; the threat replies in Hershey font; effect 0                    | "RESPONSE RECEIVED: 'NO.'"                                                   |
| DRILLCREW         | launch a human crew with a drill at T-18 d; the readout computes the energy and the crew refuses | "TEXAS-SIZED BODY (1.4e21 KG) NEEDS dv 6.5 M/S IN 18 D: >= 3e22 J, ABOUT 7 MILLION MEGATONS. YOU BROUGHT ONE." |
| PLANETTHRUSTERS   | move HOME by dv                                                                  | "0.5 * 6e24 KG * (1 M/S)^2 = 3e24 J, ABOUT 7e8 MEGATONS."                   |
| SHIELD            | absorb the impact energy in a dome                                               | "2e19 J DUMPED INTO ONE STRUCTURE. THE GRID IS A CRATER NOW."                |
| SHRINK            | D *= 0.1                                                                         | "WHERE DID 99.9% OF THE MASS GO?"                                            |
| SUMMONDEVS        | opens the knobs editor (every [knob] live)                                       | "YOU ARE NOW THE SIMULATION."                                                |
| MULTIVERSE n      | fork the round into n branches (Section 21.4)                                    | "EVERETT WOULD LIKE A WORD."                                                 |

---

## 21. Modes

Modes are nested. Each one is reached from inside the previous one, and each has its own leaderboard tab. Nothing in a later mode leaks into an earlier one.

### 21.1 REALISTIC (default)
Only REAL and PROPOSED methods and programs. All constants at their honest defaults. Cheats off. This is the game. Everything in Sections 5 to 19 is written for this mode.

### 21.2 SCI-FI
Unlocked by reaching civilization level 1 (Section 22.3) or by the `SCIFI` code. Adds SPECULATIVE methods and programs (20.3, 19). Physics is still consistent: energy and momentum are conserved, Kepler still rules, fragments still fragment. The budget scale changes (x10), programs are long (10 to 20 years), so the run becomes a multi-decade civilization-building game where the asteroids are a background hazard. New round types: interstellar objects (hyperbolic, 50 to 90 km/s), long-period comets with 1 year warning, 5 km bodies.

### 21.3 SIMULATION
Unlocked only from inside SCI-FI, by the `SIMULATION` code or by a hidden achievement (survive 20 rounds). Premise: HOME is inside a simulation and you have found the console. Adds the FICTION commands of 20.4 and the knobs editor. Visual: scanlines tear, Hershey glyphs occasionally render as their stroke data, the HUD shows frame time and entity ids. Scoring is kept but every run is flagged FICTION.

### 21.4 MULTIVERSE
Unlocked only from inside SIMULATION. The round forks into n branches (4, 9, or 16; tiled system views). Branch variants: different plans, different beta/fragment draws, different threats, or all three. All branches resolve simultaneously on the shared clock; the player can commit different missions in different tiles. End of round: survival fraction across branches, and the player chooses which branch becomes the main timeline ("COLLAPSE"). A wormhole from a branch dumps that branch's threat into a sibling branch. Implementation: the resolver is already pure and deterministic, so a branch is just a `World` copy with its own RNG stream; render budget is the only cost.

Mode gating and flags live in `game/modes.ts`. The save file records the highest mode reached and which were active per round.

---

## 22. Save file, cheat codes, codex

### 22.1 Save file: a markdown file the player can read

`SAVE.md` (current run) and `history/run-<seed>-<date>.md` (one per finished run). Machine-readable YAML front matter, human-readable tables below it. The parser reads only the front matter; the tables are regenerated on every save. Storage: mirrored in `localStorage`; EXPORT downloads the file; IMPORT accepts drag and drop; when the File System Access API is available, the player can pick a folder and the game writes there directly.

```markdown
---
version: 1
seed: 8F3A21C9
started: 2026-10-17
round: 4
mode: REALISTIC            # REALISTIC | SCIFI | SIMULATION | MULTIVERSE
highest_mode: REALISTIC
civ_level: 0               # 0 today, 1 planetary, 2 stellar (cheat or achievement)
cheats_used: []            # codes entered this run; non-empty flags the leaderboard entry ASSISTED
budget: 14.5
budget_per_year: 8
research: 37
tech: [L2, I2, SL1, N1, T1, A1]
programs:
  - { id: RADAR_NET, progress: 1.0, funding: 0 }
  - { id: SPACE_IR_SURVEYOR, progress: 0.62, funding: 1.0 }
networks_active: [CATALINA, PANSTARRS, ATLAS, ZTF, RUBIN, FLYEYE1, GOLDSTONE, RADAR_NET]
run_score: 1180
rounds_survived: 3
current_threat: { name: "2041 KX-7", type: STONY, D_m: 310, t_impact: 2044-03-02, lead_years: 6.1, p_impact: 0.97 }
learning_level: INTERMEDIATE   # SIMPLE | BEGINNER | INTERMEDIATE | ADVANCED | EXPERT
lore_read: { T1: ADVANCED, D3: INTERMEDIATE, O6: BEGINNER }
color_mode: SPECTRUM           # PHOSPHOR | SPECTRUM | AMBER | ICE | VAPOR | BLACKLIGHT | HOLO | DAYLIGHT
---
# RUN 8F3A21C9

| Round | Threat    | Type   | D (m) | Lead (y) | Discovered by | Plan           | Outcome       | Score |
|-------|-----------|--------|-------|----------|---------------|----------------|---------------|-------|
| 1     | 2039 AB   | STONY  | 95    | 9.8      | CATALINA      | KINETIC        | MISS 4.1 R    | 310   |
| 2     | 2039 QQ-2 | RUBBLE | 160   | 7.2      | RUBIN         | SWARM x3       | MISS 2.2 R    | 390   |
| 3     | 2040 FD   | IRON   | 210   | 4.4      | ATLAS         | SAIL_KINETIC   | MISS 1.3 R    | 480   |

## Programs
| Program            | Progress | Funding |
|--------------------|----------|---------|
| RADAR_NET          | 100%     | done    |
| SPACE_IR_SURVEYOR  | 62%      | full    |
```

### 22.2 Cheat codes

Typed on the title screen or in the console (`~`). Any code flags the run ASSISTED on the leaderboard; mode codes move the run to that mode's board. Codes are case-insensitive.

```
KARDASHEV1    civilization level 1: all REAL + PROPOSED tech and programs complete, budget x10
KARDASHEV2    civilization level 2: unlocks SCI-FI mode, all SPECULATIVE programs complete, budget x1000
SCIFI         enter SCI-FI mode (requires nothing; flags the run)
SIMULATION    enter SIMULATION mode (requires SCI-FI active)
MULTIVERSE    enter MULTIVERSE mode (requires SIMULATION active)
REVEAL        show ground truth: beta, true orbit, fragment outcomes before they happen
FASTBUILD     all build times 0
GODTRACK      sigma_v = 0
LEADTIME n    force lead time to n years on the next round
SPAWN name    spawn a named historical scenario next round:
              CHELYABINSK (18 m, sunward, no warning), TUNGUSKA (55 m, 3 weeks), YR4 (55 m, 7 yr, rubble),
              APOPHIS (340 m, 7 yr), BENNU (490 m, 15 yr), DIDYMOS (DART replay, 160 m binary), CHICXULUB (10 km, 20 yr)
DART          replay the real DART geometry with the real numbers as a tutorial round
```

### 22.3 Civilization level

An honest progression axis that the cheats shortcut. Level 0 is today. Level 1 is reached when all REALISTIC programs are complete (roughly 25 game years of funding); it unlocks SCI-FI mode without a code. Level 2 is reached when all SPECULATIVE programs are complete; it unlocks SIMULATION without a code. The title screen shows the level as a Kardashev-style readout: energy budget in watts, with the number computed from completed programs (flavor, not mechanics).

### 22.4 Codex

An in-game screen listing every network (18), program (19) and method (20) with its tag, its real-world basis, the equation the game uses, and the current knob values. The codex is generated from `config/*.json`, so it cannot drift from the simulation. This is where the REAL / PROPOSED / SPECULATIVE / FICTION distinction is taught; the planner never hides a method's tag.

---

## 23. Learning Center and lore panels

The content lives in `EDUCATION.md` (55 topics in six groups, each written at five levels: SIMPLE, BEGINNER, INTERMEDIATE, ADVANCED, EXPERT). That file's Section 0 is the contract; this section is the game side of it.

- **Build step**: `scripts/build_lore.py` (Python) parses EDUCATION.md into `public/lore/index.json` plus one small JSON per topic per level, generates nothing else, and validates everything (all levels present, related ids resolve, every PICTURE id has a generator, every DEMO id is in the LAB registry, SIMPLE text at most 20 words, no em dashes). The game bundle contains no lore text.
- **Loading**: `index.json` (about 10 KB) is fetched on the first lore request. Topic chunks load on demand into an LRU cache capped at 2 MB. LAB demos are code-split modules loaded with dynamic `import()` when opened. Pyodide (for RUN IN PYTHON) loads only on an explicit click in an EXPERT lab, never automatically. Memory for lore is therefore bounded no matter how long someone reads.
- **Entry points**: `?` key; click on any body, readout, HUD number, planner line, program, network or method; the codex; the tutorial; the brain icon in the HUD (always visible) which opens the full Learning Center.
- **Lore panel**: side panel, 360 px, with the topic at the current level, tabs S B I A E, the picture (SIMPLE) or the LAB thumbnail (EXPERT), a related-topics row, and OPEN LEARNING CENTER.
- **Learning Center**: full-screen mode. Left: topic tree by group with completion rings. Center: content. Right or bottom: the LAB when one exists, with sliders, live plot, formula with current numbers, SHOW CODE (the real function source) and RUN IN PYTHON. Top: level selector, search, bookmarks. LABS tab lists all 20 demos. Progress is saved per topic as the highest level read.
- **Level default**: BEGINNER on a fresh install; the tutorial asks once ("Pictures / Plain words / Some math / Formulas / Everything") and stores the answer in SAVE.md as `learning_level`.
- **Pictures**: SIMPLE-level diagrams are vector SVG generated in the current palette so they match the game; registry in EDUCATION.md Section 8.
- **Honesty rule**: the panel always shows the method's or mission's tag (REAL / PROPOSED / SPECULATIVE / FICTION) and, for any number that is a game knob, says so.

---

## 24. Visual system: color modes, holographic and wireframe looks

Lines, glow, no fills, always. Within that rule the game grows from a monochrome terminal into a holographic instrument.

### 24.1 Modes

```
PHOSPHOR   (start)  bg #000000  ink #33FF33  dim #0B4D0B  hot #B6FFB6               P1 green phosphor; the Asteroids look
SPECTRUM   (unlocks after the first clean miss; a layer on any dark mode)
           threat #FFB000  danger #FF3B3B  craft #00F0FF  fragments #FF2BD6  programs #9D4EDD  sails #CCFF00
           nuclear #FF6A00  planets #33FF33  text #E6FFE6  grid/orbits stay dim
AMBER      bg #0A0600  ink #FFB000  dim #4A3000  hot #FFE2A0                         P3 amber monochrome
ICE        bg #00060C  ink #7DF9FF  dim #0A3A44  hot #E0FFFF
VAPOR      bg #05000A  ink #FF71CE  alt #01CDFE  dim #3A0A3A  hot #FFFFFF             synthwave / holographic pink-cyan
BLACKLIGHT bg #050008  ink #BF5FFF  alt #CCFF00  dim #2A0A40  hot #F0E0FF             UV violet + acid
HOLO       bg #02030A  iridescent strokes (hue cycles 160 -> 300 deg along each path), bloom, 1 px chromatic offset,
           slow hue drift (reduce-motion freezes it)
DAYLIGHT   bg #F2F5F3  ink #0B3D0B  dim #B8CCB8  hot #000000  no glow, 1.5 px lines   for bright rooms and projectors
```
Rules: text contrast at least 4.5:1 in every mode (tested); each semantic color is paired with a line style (solid, dashed, dotted, marker shape) so colorblind players lose nothing; mode is an OPTIONS choice saved in SAVE.md; SPECTRUM is both an unlock and a toggle.

### 24.2 Holographic treatment
- Glow: wide low-alpha under-stroke plus a crisp 1 to 1.25 px stroke at device pixel ratio. HOLO adds a WebGL2 bloom pass when available and falls back to the Canvas-only glow when not.
- Panels "materialize": frames draw themselves in, text types in with the stroke font, a thin vertical light sweep crosses once. 1 to 2 percent opacity jitter ("hologram flicker"), off under reduce-motion.
- Depth cues: a parallax star field (three layers), the orbit plane grid fading with distance, and the camera tilt below.

### 24.3 Wireframe 3-D (old computer graphics at high resolution)
- The system view can tilt from top-down to a 60 degree pitch with perspective projection. Physics stays 2-D (z = 0 for every body); the tilt is a camera, so nothing in the sim changes. Orbits become wireframe rings, trails become ribbons, the threat is a seeded wireframe polyhedron that tumbles.
- Planet view: a wireframe sphere (latitude and longitude lines) with the procedural continents drawn on the sphere, slowly rotating; the `b_crit` ring and approach corridor drawn in the orbit plane.
- Everything anti-aliased and DPR-aware. The look is Battlezone and Tempest, not a pixel filter: thin lines at retina resolution with modern glow.

### 24.4 Renderer architecture
`render/canvas.ts` draws through a small `Stroke` interface (path, width, color or gradient, dash, glow) so the Canvas 2D backend and the optional WebGL2 bloom backend share every view. Palettes are data (`config/palettes.json`). `camera3d.ts` is a pure projection function. Views never reach into the sim.

---

## 25. Menu, tutorial, onboarding

- **Menu** (Section 13, item 1): NEW RUN / CONTINUE / TUTORIAL / LEARN / LEADERBOARD / CODEX / OPTIONS. First launch opens the tutorial automatically; it can be skipped and replayed.
- **First-launch questions** (one screen, three choices each, all skippable): learning level (Pictures / Plain words / Some math / Formulas / Everything), color mode (PHOSPHOR / DAYLIGHT, with "more unlock later"), units (SI / imperial display).
- **Tutorial** = Round 0 on fixed seed `TUTORIAL-1` (100 m stony, 10 years, 2026 network set), excluded from leaderboards. Eight spotlight steps, each opening its lore entry at the chosen level: brief, system view and time warp, planner and porkchop, commit, launch and flight, impact and beta, close approach and the focusing ring, debrief and programs. Script in EDUCATION.md G1 (ADVANCED). The `DART` code replays the real mission as a second tutorial with the real numbers.
- **How-to-play** is also a Learning Center group (G1 to G8) reachable any time.
- **Onboarding hints**: the first time a new screen opens, a one-line hint with a `?` link; never repeated after dismissal (stored in SAVE.md `hints_seen`).

---

## 26. Repository, teaching code, Python companion, build process

### 26.1 The repo is a course
- Public GitHub repo `miss-beta`, AGPL-3.0 license. README has two paths: PLAY (link to the Pages build) and LEARN TO CODE (start at `docs/CODE_TOUR.md`, which follows EDUCATION.md C1 to C4).
- Every file: WHAT / WHY / HOW / LORE header. Every function: formula, units, one hand-checkable example in its doc comment. `// NOTE:` for decisions. `docs/ASSUMPTIONS.md` lists every simplification with the test that would break if it were removed.
- `docs/LESSONS/` has one page per lore group, built into the Pages site next to the game.
- `good first issue` templates: add a palette, add a SPAWN scenario from JPL's Small-Body Database, add a picture generator, add a lore quiz.

### 26.2 Languages: TypeScript for the game, Python beside it
- The game must run in a browser without plugins, so the engine is TypeScript (Pyodide would be a 10 MB download and too slow for a real-time sim). Python is used for everything that is not the live game: `pymiss/` mirrors `src/physics` one function to one function (same names, snake_case), generates the shared test vectors, powers the EXPERT notebooks, and runs the lore build script.
- The mirroring rule: a physics function is not done until it exists in both languages and both pass the same vectors (`tests/vectors/*.json`). That is the "same math, two languages" teaching device.
- Optional in-browser Python: EXPERT labs offer RUN IN PYTHON via Pyodide, loaded only on click.

### 26.3 Build and ship
- Vite build, vitest, pytest, Playwright smoke test (title -> tutorial -> one committed mission -> debrief), lore validation, all in GitHub Actions on every push; Pages deploy from `main`.
- Commit discipline per Section 0: feature commits with explanatory messages, milestone tags, CHANGELOG.
- `IDEAS.md` collects new feature ideas during the auto build; M12 presents them for the interactive phase.

---

## 27. Stretch ideas (after M12)

- **Inclination**: 3D elements with a top-down projection; out-of-plane dv becomes a real option and the 2D fragment correction goes away.
- **Resonant return**: apply the patched-conic flyby to the threat itself on a near miss; it comes back in a later round with a known date. Keyhole display.
- **Spin and shape**: elongated bodies, impact timing vs rotation, tumbling fragments; makes Tugboat eta_spin a real mechanic.
- **Binary threats**, **threat showers** (a fragment field from an earlier disruption elsewhere), **two simultaneous threats** in REALISTIC mode (MULTIVERSE already does many at once).
- **Campaign branching**: public opinion / funding reacting to nukes and near misses.
- **Custom star systems** from JSON (the SIMULATION knobs editor already exposes constants).
- **Multiplayer seed race**: same daily seed, compare scores.
- **Full H-G phase function and a real albedo distribution** in the detection model; weather and lunar-cycle calendars per site.

---

## 28. Open questions (decide during M2/M3)

- Should missions be committable only at round start, or any time the clock is paused? (Plan: any time; it makes the AI tiers meaningful.)
- Is budget per year or per round? (Plan: per year, accrued on the clock, so time warp is also a resource decision.)
- How much of the porkchop should the planner auto-select vs let the player hand-pick? (Plan: both; auto by default, manual cell pick as an "expert" toggle.)
- Hershey font vs hand-built 16-segment font? (Hershey simplex gives a nicer look; 16-segment is more arcade. Try Hershey first.)
- Is the 2D-only model acceptable for the first public build, with inclination as the headline v2 feature? (Plan: yes.)

---

## Appendix A: Glossary

```
a, e, w, M0, t0   Kepler elements: semi-major axis, eccentricity, longitude of periapsis, mean anomaly at epoch
mu                gravitational parameter G*M
v_inf             hyperbolic excess speed relative to a planet
C3                v_inf^2 at departure; the launcher's job
U                 closing speed between impactor and threat at impact
beta              momentum enhancement factor from impact ejecta (DART: 3.6)
Q, Q*             specific impact energy delivered; catastrophic disruption threshold
b, b_crit         impact parameter; critical impact parameter including gravitational focusing
f_LR              largest remnant mass fraction after disruption
sigma             sail loading (kg/m^2); also, separately, 1-sigma uncertainty where noted
a_c               sail characteristic acceleration at 1 AU
delta             flyby turn angle
DSM               deep space maneuver (onboard impulsive burn mid-flight)
SOI               sphere of influence
```

## Appendix B: References to check the constants against

- Benz and Asphaug (1999), Icarus 142, "Catastrophic Disruptions Revisited" (Q* scaling coefficients)
- Leinhardt and Stewart (2012), ApJ 745, "Collisions between Gravity-dominated Bodies" (largest-remnant relation)
- DART mission results (Cheng et al. 2023; Daly et al. 2023), Nature: beta ≈ 3.6, dv ≈ 2.7 mm/s, Dimorphos mass ≈ 4.3e9 kg
- Curtis, "Orbital Mechanics for Engineering Students", ch. 5 (Lambert, universal variables) and ch. 8 (patched conics)
- McInnes, "Solar Sailing" (sail force model, lightness number)
- NASA/NRC "Defending Planet Earth" (2010) for nuclear standoff and slow-push order-of-magnitude figures
- Thiry and Vasile (2016), IAC-16, "Statistical multicriteria evaluation of asteroid deflection methods" (kinetic vs laser vs ion beam vs tractor, with spacecraft sizing)
- Barbee et al. (2018), Acta Astronautica, HAMMER study (NASA/NNSA/LLNL)
- Wie (2013), HAIV concept (NIAC)
- Lubin and Cohen (2021/2023), "PI: Terminal planetary defense" (Pulverize It)
- Moore et al. (2024), Nature Physics, X-ray ablation deflection demonstration on the Sandia Z machine
- Vasile and Maddock (2010), solar concentrator "mirror bees"; Phipps (2010), ground-based laser deflection
- Lu and Love (2005), Nature, gravity tractor; Bombardelli and Pelaez (2011), ion beam shepherd
- Mainzer et al., NEO Surveyor mission papers; ESA NEOMIR study (Conversi et al., NEOSST2 2023)
- Bowell et al. (1989), asteroid H-G photometric system; Harris and Harris (1997), D-H-albedo relation (the 1329 km constant)
- Ivezic et al., LSST science requirements (survey depth); Chow et al. (2026), ApJ, imminent impactors discovered by LSST

---

## 29. Event cinematics and narratives (added 2026-10-17 from play feedback)

- **Cinematics**: every clock-passing event (launch, impact, breakup, nuclear, PI, close approach) pauses the clock for a 2 to 5 second vector animation in the PERIMETER minigame's style (pixel debris, shards, bass thud), drawn from the resolved numbers: body type (rubble crumbles, stony cracks, iron rings, comet puffs), U, beta, Q/Q*, fragment count and sizes. A launch shows a planet-level mock-up: HOME's limb, the ascent arc, staging, scaled by launcher tier and payload. Any key skips; reduce-motion replaces it with a flash and the brief. Then the clock returns to the warp that was running.
- **Auto warp-down**: when no craft is in flight any more the clock drops to 1 day per second, with a HUD line saying so, so the player sees there is room to act.
- **Narratives**: canned templated briefs (no LLM at play time) at round start ("spotted by what, at what magnitude, how big, how long") and after every event (post-impact summary, breakup summary, fuze, civil defense, debrief). A teletype overlay types the header first, then the body, fast; a key renders the rest at once; another clears it. Narratives use the SPECTRUM role colours (threat amber, craft cyan, fragments magenta) so the screen is not only green; the whole game keeps the minigame's neon feel.
- Implementation home: `src/render/cinematics/*`, `src/config/narratives.json`, `src/render/views/teletype.ts`; BUILD_PLAN M13.


## 30. Unproven tech, deadpan fiction, and "Earth must be protected by all means" (added 2026-10-18)

Owner's core tenet: Earth must be protected by all means, and nothing is ruled out. The game keeps three tiers.

- **REALISTIC** stays pure science: only REAL and PROPOSED methods, honest numbers.
- **SCI-FI** adds the SPECULATIVE tier: "unproven, might work someday". Physics-consistent but unbuilt at scale:
  carbon-nanotube nets (since M7), the disassembler swarm, DE-STAR, and since 2026-10-18 three standing
  capabilities that act on every threat without a flight once their program is complete:
  - **NANOFORGE SEEDS**: self-replicating, reconfigurable-matter seeds land, grow over the body (NANOFORGE_GROW_DAYS),
    then run a mass driver from the rock's own regolith: F = mdot v_e. The rock becomes its own rocket.
  - **SELF-ASSEMBLING THRUSTER SWARM**: hundreds of small units land, lock together, despin the body (eta_spin) and push.
  - **SHEPHERD NETWORK**: a standing fleet steering captured 25 m rocks; one is fired into every new threat
    (dv = beta m U / M), the planetary-defense infrastructure that uses objects already in space.
  Ideas queued for the same tier: seed fleets that build more of themselves from what they find, attachable
  sail and tether kits, a picket line of parked impactors at L4/L5.
- **SIMULATION / MULTIVERSE** are FICTION played straight. Inside those modes nothing breaks character: commands
  answer in deadpan bureaucratic voice as if this were ordinary procedure (Alice in Wonderland, Hitchhiker's
  Guide, the Bureau of Paperwork). The honest physics line that GAME_PLAN 20.4 printed first now lives behind
  the console command REALITY ON (and in the CODEX), so the joke lands and the science is one keystroke away.
  Themes allowed: paradox fiction, theoretical-physics flights (micro black holes, timefolds, branch swaps,
  spacetime detours), and harmless popular "theories" played for deadpan laughs (the Moon was always a ship, the
  hollow asteroid, a ticket to the simulation's operators). Nothing distasteful, nothing about real people.
