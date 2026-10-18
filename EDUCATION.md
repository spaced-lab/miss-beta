# MISS β: EDUCATION.md
## The Learning Center and lore content, in five levels

This file is content, not code. The game's build script (`scripts/build_lore.py`) parses it into small JSON chunks that the browser loads on demand, so the whole thing never sits in memory at once. Claude Code: read Section 0 before touching anything else; it is the contract between this file and the game.

---

## 0. Contract: how the game uses this file

### 0.1 Levels

Every topic is written five times, once per level. The player picks a level in OPTIONS (default BEGINNER) and can switch per panel.

| Level        | Tab | Who it is for                          | Rules for the text                                                                 |
|--------------|-----|----------------------------------------|------------------------------------------------------------------------------------|
| SIMPLE       | S   | kids, first look, non-readers          | one picture (a vector diagram the game draws) and at most 20 words                  |
| BEGINNER     | B   | anyone, no math                        | 2 to 5 plain sentences; analogies allowed; no formulas; numbers only as "about ..."  |
| INTERMEDIATE | I   | curious adults, high-school math       | one worked example with real numbers; at most one simple formula                     |
| ADVANCED     | A   | adult reading level, formulas          | the equations the game actually uses, variables defined, units given                 |
| EXPERT       | E   | engineers, students, the curious-obsessed | a live demo (LAB), a derivation sketch or the code path, and where to learn more; may be BACKLOG |

A level that reads `BACKLOG` is allowed only for EXPERT. The build script fails if any other level is missing.

### 0.2 File format the build script parses

```
## <ID> <Title>                  ID like T2, F7, O10, D3, G1, C4
meta: related=[ids]  game=[where the entry is reachable in the game]  tags=[...]
### SIMPLE
PICTURE: <picture-id>  <one-line description of what the vector diagram shows>
TEXT: <= 20 words
### BEGINNER
<prose>
### INTERMEDIATE
<prose, one worked number>
### ADVANCED
<prose + code-fenced formulas>
### EXPERT
DEMO: <LAB id from Section 7>  (or none)
NOTES: <derivation sketch / code path>
MORE: <reading list, free sources first>
```

Output: `public/lore/index.json` (ids, titles, tags, related, game anchors, level availability; about 10 KB) and `public/lore/<ID>/<LEVEL>.json` with `{ id, level, title, markdown, pictureId, demoId }`. Pictures are generated as SVG by `src/lore/pictures/<picture-id>.ts` (vector line art in the current color mode, so they match the game) or hand-authored in `public/lore/svg/`. The script validates: all five level headers present, every `related` id exists, every DEMO id is in the LAB registry (Section 7), every PICTURE id has a generator or an svg file, no em dashes anywhere.

### 0.3 Where it shows up in the game

- **Lore panel**: press `?` or click any entity, HUD number, planner readout, program, network, or method. A side panel opens with the matching topic at the current level, with level tabs S B I A E, a "related" row, and a brain button.
- **Brain button (Learning Center)**: full-screen mode. Left: topic tree (the six groups below). Center: content. Right/bottom: the LAB demo when one exists. Level selector, search, bookmarks, progress ("31 of 50 read at INTERMEDIATE"), and a LABS tab listing every demo. Progress and level are saved in SAVE.md (`learning_level`, `lore_read`).
- **Tutorial** (G1) is built from lore entries, so it is level-aware.
- **Codex** (GAME_PLAN.md Section 22.4) links each network, program and method to its lore topic.

### 0.4 Memory and loading

The game bundle does not include lore. On first open of any panel the client fetches `index.json`; each topic+level chunk (2 to 20 KB) is fetched on demand and kept in an LRU cache capped at 2 MB. LAB demos are code-split modules loaded with dynamic `import()` only when opened. The optional "RUN IN PYTHON" button in EXPERT labs loads Pyodide (about 10 MB, cached by the browser) only on explicit click, never automatically.

### 0.5 Accuracy

Facts carry a date where they can change ("as of 2026"). Numbers marked `[verify]` in GAME_PLAN.md are marked the same here. Every topic's EXPERT level names a primary source. Where a number is a game knob rather than a measured fact, the text says so.

### 0.6 Topic map

```
T  THE THREAT       T1 what is a NEO   T2 size ladder   T3 how often   T4 case files   T5 what they're made of   T6 comets and visitors
F  FINDING THEM     F1 moving dots   F2 brightness and size   F3 sunward blind spot   F4 seeing heat   F5 today's surveys
                    F6 radar   F7 future missions   F8 dots to orbits   F9 Torino and Palermo   F10 who's in charge
O  ORBITS AND MATH  O1 numbers   O2 logs and magnitudes   O3 vectors   O4 Newton   O5 energy and momentum   O6 Kepler
                    O7 elements   O8 vis-viva   O9 anomalies   O10 A to B   O11 gravity assists   O12 close approach
                    O13 integration   O14 randomness and probability
D  DEFLECTION       D1 impulse   D2 early beats big   D3 kinetic and beta   D4 fragmentation   D5 nuclear   D6 slow push
                    D7 sails   D8 rockets   D9 Yarkovsky   D10 last resorts   D11 the catalog and the chart   D12 autonomy
                    D13 wild ideas
G  THE GAME         G1 how to play   G2 screens and HUD   G3 the planner   G4 programs   G5 scoring   G6 modes and cheats
                    G7 under the hood   G8 the look
C  THE CODE         C1 how it is built   C2 reading the code   C3 tests and two languages   C4 build your own   C5 sources
```

---

# T. THE THREAT

## T1 What is a near-Earth object
meta: related=[T2,T5,T6,F1]  game=[threat brief, codex]  tags=[basics]
### SIMPLE
PICTURE: pic-neo-orbits  Sun in the middle, Earth's circle, three lopsided asteroid ovals crossing it.
TEXT: Rocks and ice chunks whose paths around the Sun come close to Earth's path.
### BEGINNER
A near-Earth object (NEO) is an asteroid or comet whose orbit brings it within about 45 million km of Earth's orbit. Most are leftovers from the solar system's formation, nudged out of the asteroid belt by Jupiter's gravity. As of 2026 more than 40,000 near-Earth asteroids are known, and new ones are found every night. Almost all of them will never hit us. The game is about the rare one that would.
### INTERMEDIATE
The formal definition: perihelion distance q < 1.3 AU (1 AU is the Earth-Sun distance, 150 million km). A "potentially hazardous asteroid" (PHA) is one that comes within 0.05 AU (7.5 million km) of Earth's orbit and is bigger than about 140 m (absolute magnitude H <= 22). About 2,500 PHAs are known. Four orbit families: Atiras (entirely inside Earth's orbit), Atens (mostly inside, crossing), Apollos (mostly outside, crossing; the largest group), Amors (outside, approaching but not crossing). The game's generated threats are Apollos and Atens, because those cross.
### ADVANCED
Classification by semi-major axis `a` and perihelion `q = a(1-e)`, aphelion `Q = a(1+e)`:

```
Atira:  Q < 0.983 AU              (inside Earth's perihelion)
Aten:   a < 1.0 AU, Q > 0.983 AU  (crossing from inside)
Apollo: a > 1.0 AU, q < 1.017 AU  (crossing from outside)
Amor:   1.017 < q < 1.3 AU        (approaching, not crossing)
PHA:    MOID <= 0.05 AU and H <= 22.0
```
MOID is the minimum orbit intersection distance, the closest the two orbit curves come regardless of where the bodies are. A small MOID is necessary for an impact, not sufficient: the bodies also have to arrive at that point at the same time. The game's round generator builds the orbit backward from the impact point, which forces MOID ≈ 0 and the timing to match (GAME_PLAN.md Section 10).
### EXPERT
DEMO: LAB_ELLIPSE
NOTES: Population models (Granvik et al. 2018) estimate about 25,000 NEOs larger than 140 m and roughly 900 larger than 1 km; the known fraction is about 95% for the 1 km class and about 45% for the 140 m class as of 2026. Source rates are dominated by the ν6 secular resonance and the 3:1 mean-motion resonance with Jupiter.
MORE: NASA CNEOS "NEO Basics" and discovery statistics (cneos.jpl.nasa.gov); ESA NEOCC (neo.ssa.esa.int); Granvik et al. 2018, Icarus, "Debiased orbit and absolute-magnitude distributions for near-Earth objects".

## T2 How big is dangerous: the size ladder
meta: related=[T3,T4,D4,D10]  game=[threat brief, planet view, scoring]  tags=[basics,energy]
### SIMPLE
PICTURE: pic-size-ladder  Five rocks drawn to scale next to a house, a stadium, a city block, a mountain; captions: fireball, city, region, world.
TEXT: Small rocks burn up. Bigger ones break windows, then cities, then the whole world.
### BEGINNER
A rock the size of a car burns up as a bright fireball; this happens several times a year. A rock the size of a house (about 20 m) explodes high in the air with the force of a small nuclear weapon, breaking windows for miles (Chelyabinsk, 2013). A rock the size of a stadium (about 140 m) would flatten a city. One about a kilometer wide would change the world's climate. One 10 km wide ended the dinosaurs. The game's threats run from 50 m to 2 km.
### INTERMEDIATE
Energy comes from mass times speed squared, and mass grows with the cube of diameter, so doubling the size gives eight times the energy. At a typical impact speed of 20 km/s, a stony 20 m rock carries about half a megaton (Mt) of TNT; 50 m about 8 Mt; 140 m about 200 Mt; 1 km about 70,000 Mt; 10 km about 70 million Mt. For comparison, the largest nuclear test ever was 50 Mt. The atmosphere protects us from the small ones: a stony body below about 25 m usually airbursts high up, an iron one below about 10 m.
### ADVANCED
```
M = (4/3) * pi * (D/2)^3 * rho            rho: rubble 1300, stony 2700, iron 5300 kg/m^3
v_impact = sqrt(v_inf^2 + v_esc^2)         v_esc = 11.2 km/s for Earth
E = 0.5 * M * v_impact^2                   J;   1 Mt TNT = 4.184e15 J
```
Game categories: AIRBURST (< 25 m stony, < 10 m iron), CITY (< 140 m), REGIONAL (< 1 km), GLOBAL (>= 1 km). The 140 m threshold is the one written into US law (the 2005 George E. Brown Jr. NEO Survey Act), and "1 km" is the classic "global consequences" threshold from the 1990s Spaceguard studies. Crater diameter scales roughly as the 1/3.4 power of energy for large impacts (Barringer: a 50 m iron made a 1.2 km crater).
### EXPERT
DEMO: LAB_IMPACT_ENERGY
NOTES: Airburst altitude follows from the "pancake" model (Chyba, Thomas and Zahnle 1993; Hills and Goda 1993): a body breaks up when ram pressure `rho_air * v^2` exceeds its strength (about 1 MPa for stony, 100+ MPa for iron), then spreads and deposits energy in a few km of altitude. The game does not model the atmosphere; it classifies by size and type.
MORE: Collins, Melosh and Marcus 2005, "Earth Impact Effects Program" (impact.ese.ic.ac.uk, free calculator); Popova et al. 2013, Science, Chelyabinsk; Boslough and Crawford 2008 on airbursts.

## T3 How often
meta: related=[T2,T4,F5]  game=[threat brief]  tags=[basics,statistics]
### SIMPLE
PICTURE: pic-frequency-bars  A timeline bar: car-size every year, house-size every lifetime, stadium every 20,000 years, mountain every million years.
TEXT: Small hits are common. Big hits are rare, but they happen.
### BEGINNER
Something the size of a car hits the atmosphere a few times a year. A Chelyabinsk-size rock (about 20 m) arrives about once every 60 to 80 years. A Tunguska-size rock (about 50 m) about every few hundred years. A 140 m "city killer" about every 20,000 years. A 1 km object about every 500,000 years, and a 10 km one roughly every 100 million years. Rare is not never: the last 20 m one was 2013, and it was not seen coming.
### INTERMEDIATE
The rate follows a power law: there are roughly 100 times more objects at one tenth the size. That is why surveys find hundreds of 1 km objects but there are tens of thousands of 140 m ones and millions of 20 m ones. The risk, counterintuitively, is spread: the 1 km class is almost fully catalogued (about 95% found), so most of the remaining uncertainty is in the 50 to 300 m range where only a few percent to half are known.
### ADVANCED
Cumulative impact rate (Earth, all types, approximate):

```
N(> D) per year  ≈  k * D^-2.6  ... fitted near:  1 m: ~10/yr, 10 m: 1/10 yr, 20 m: 1/70 yr, 50 m: 1/300..1000 yr,
                                           140 m: 1/20,000 yr, 1 km: 1/500,000 yr, 10 km: 1/100 Myr
```
Numbers differ by a factor of 2 to 3 between studies (Brown et al. 2002 and 2013, Harris and D'Abramo 2015). The game uses them only for flavor text; its difficulty ramp (GAME_PLAN.md Section 10) is not a statistical sample.
### EXPERT
DEMO: none
NOTES: Brown et al. 2013 (Nature, after Chelyabinsk) argued the 10 to 50 m rate is higher than earlier bolide-based estimates by a factor of a few. The CNEOS fireball database (satellite sensor detections) is the source for the small end; crater counting on the Moon anchors the large end.
MORE: Harris and D'Abramo 2015, Icarus, "The population of near-Earth asteroids"; Catalina Sky Survey FAQ "How often do asteroids strike Earth?"; CNEOS fireball data (cneos.jpl.nasa.gov/fireballs).

## T4 Case files
meta: related=[T2,T3,F3,F8,D3]  game=[SPAWN scenarios, codex]  tags=[history]
### SIMPLE
PICTURE: pic-case-files  Five stamps: a shattered window (2013), fallen trees (1908), a round crater, a dinosaur silhouette, a spacecraft hitting a small moon (2022).
TEXT: Real rocks that hit, nearly hit, or got hit by us.
### BEGINNER
Chelyabinsk, Russia, 2013: a 20 m rock exploded 30 km up, brighter than the Sun; about 1,500 people were hurt by flying glass. Nobody saw it coming because it came from the direction of the Sun. Tunguska, Siberia, 1908: a 50 m object flattened 2,000 square kilometers of forest. Meteor Crater, Arizona: a 50 m iron body punched a 1.2 km hole 50,000 years ago. Chicxulub, Mexico, 66 million years ago: 10 km, end of the dinosaurs. And in 2022 the DART spacecraft hit a small asteroid moon on purpose, and moved it.
### INTERMEDIATE
Things we saw coming: 2008 TC3, a 4 m rock, was discovered 19 hours before it hit the Sudanese desert, the first predicted impact ever; by September 2026, 13 objects had been found before impact (all under about 8 m). 2024 YR4, about 60 m, was found by ATLAS in December 2024; its Earth impact odds for 2032 climbed to about 3% in February 2025, then dropped to zero as the orbit was pinned down; Webb observations in 2026 also ruled out a lunar hit. Apophis, 340 m, will pass inside the ring of geostationary satellites on 13 April 2029, visible to the naked eye; it cannot hit for at least a century. Bennu, 490 m, has a 1-in-2,700 chance of impact in 2182.
### ADVANCED
Numbers the game uses as SPAWN presets and calibration:

```
Chelyabinsk 2013   D ≈ 18-20 m, v ≈ 19 km/s, E ≈ 0.5 Mt, airburst ~30 km, sunward approach (eps < 15 deg), no warning
Tunguska 1908      D ≈ 50-60 m, E ≈ 10-15 Mt, airburst 5-10 km, 2000 km^2 flattened
Barringer          D ≈ 50 m iron, crater 1.2 km, ~50,000 yr ago
Chicxulub          D ≈ 10-15 km, E ≈ 1e8 Mt, crater 150-200 km, 66 Myr
2008 TC3           D ≈ 4 m, 19 h warning (Catalina), meteorites recovered (Almahata Sitta)
2024 YR4           D ≈ 53-67 m (Webb), discovered 2024-12-27 by ATLAS Chile, peak P ≈ 3% for 2032-12-22, Earth ruled out 2025-02-24
Apophis            D ≈ 340 m, 2029-04-13 flyby at ~32,000 km, reached Torino 4 in 2004 (the record)
Bennu              D ≈ 490 m, P(2182-09-24) ≈ 1/2700, rubble pile, rho ≈ 1190 kg/m^3
DART / Dimorphos   m = 579 kg, U = 6.14 km/s, Dimorphos D ≈ 150 m, period change -33.0 ± 1.0 min, beta ≈ 3.6 (2.2-4.9)
```
### EXPERT
DEMO: LAB_BETA
NOTES: DART's period change would have been about 7 minutes if the spacecraft's momentum had simply been absorbed; the extra came from ejecta flying back along the impact direction, which is the beta effect. Hera (ESA, launched 2024, arriving late 2026) will measure Dimorphos' mass directly, which turns the beta estimate from a range into a number.
MORE: Thomas et al. 2023 and Cheng et al. 2023, Nature (DART results); Popova et al. 2013 (Chelyabinsk); Jenniskens et al. 2009 (2008 TC3); NASA Planetary Defense blog for the 2024 YR4 timeline.

## T5 What they are made of
meta: related=[T2,D3,D4,F2]  game=[threat brief, precursor probe]  tags=[materials]
### SIMPLE
PICTURE: pic-asteroid-types  Three cutaways: a pile of boulders held by gravity, a solid rock, a dense metal lump; an icy dirty snowball beside them.
TEXT: Some are piles of rubble. Some are solid rock. A few are iron. Comets are dirty ice.
### BEGINNER
Most asteroids bigger than a few hundred meters are not solid: they are rubble piles, gravel and boulders held together by their own weak gravity, with a lot of empty space inside. Bennu and Ryugu, visited by spacecraft, are like that. Stony asteroids are rock. Iron asteroids are pieces of the metal cores of shattered baby planets, dense and strong. Comets are mostly ice with dust, which is why they grow tails near the Sun. What a threat is made of changes how you can move it.
### INTERMEDIATE
Density is the giveaway. Bennu's bulk density is about 1,190 kg/m³, barely above water, meaning roughly half its volume is void. Typical stony (S-type) asteroids are around 2,700 kg/m³; iron (M-type) around 5,000 or more; comet nuclei around 500 to 600. For the same size, an iron body has four times the mass of a rubble pile, so it needs four times the push, but it will not fall apart when you push it. The game's "precursor probe" program exists because you often do not know which you have until you go look.
### ADVANCED
Game table (GAME_PLAN.md Section 5.3): density, strength multiplier applied to the disruption threshold Q*, albedo used in detection, and beta range used for kinetic impacts.

```
Rubble pile   rho 1300   Q* x0.5   p 0.06   beta 2.5-5.0   (lots of ejecta, breaks easily)
Stony         rho 2700   Q* x1.0   p 0.20   beta 2.0-4.0
Iron          rho 5300   Q* x5.0   p 0.15   beta 1.2-2.0   (little ejecta, hard to break)
Icy / comet   rho  600   Q* x0.3   p 0.04   beta 1.5-3.5
```
Macroporosity (void fraction) P = 1 - rho_bulk / rho_grain; for Bennu with meteorite-analog grain density ~2,900, P ≈ 0.6. Spin matters too: most rubble piles cannot spin faster than about 2.2 hours per rotation without flying apart ("spin barrier"), which tells us they are not monolithic.
### EXPERT
DEMO: LAB_QSTAR
NOTES: The strength-vs-gravity regime crossover in Q* happens near 100 to 300 m: smaller bodies are held by material strength, larger ones by self-gravity, so the weakest objects to disrupt are a few hundred meters across. That minimum is why the game's HAMMER strategy works on mid-size threats and fails on both pebbles-held-by-strength and mountains-held-by-gravity.
MORE: Carry 2012, "Density of asteroids" (Planetary and Space Science); OSIRIS-REx and Hayabusa2 mission papers (Lauretta et al. 2019; Watanabe et al. 2019); Scheeres et al. on rubble-pile structure.

## T6 Comets and visitors from other stars
meta: related=[T1,T5,F3,F7]  game=[comet rounds, INTERSTELLAR_WATCH program]  tags=[comets]
### SIMPLE
PICTURE: pic-comet-orbit  A long thin oval reaching far from the Sun, a comet with a tail near the Sun; a straight-ish line passing through for a visitor.
TEXT: Comets come from far away, fast, with little warning. Some visitors never come back.
### BEGINNER
Comets spend most of their time far beyond Neptune and only occasionally dive toward the Sun, so they arrive fast and from unexpected directions, often with only a year or two of warning. Interstellar objects, like 1I/'Oumuamua (2017), 2I/Borisov (2019) and 3I/ATLAS (2025), are passing through from other star systems and will never return. They are rare but they are the hardest possible case: fastest, least predictable, and no second chances.
### INTERMEDIATE
A long-period comet falling in from the Oort cloud arrives near Earth at up to 70 km/s, three times a typical asteroid, and energy goes with speed squared, so a 600 m comet nucleus can carry as much energy as a 1.5 km asteroid. The game's comet rounds give you 1 to 2.5 years, high closing speeds, and a weak, icy body that shatters easily (which is both a problem and an opportunity). Interstellar rounds (SCI-FI mode) are hyperbolic: they do not orbit the Sun at all.
### ADVANCED
Comets in the game are bound orbits with e up to 0.98 and aphelion up to 40 AU; their heliocentric speed near 1 AU approaches the escape speed `v = sqrt(2*mu/r) = 42.1 km/s`, so `v_inf` relative to Earth (moving at 29.8 km/s) can reach 72 km/s head-on. Interstellar objects have `e > 1`; the game propagates them with the hyperbolic Kepler equation `M = e*sinh(F) - F` and `r = a*(1 - e*cosh(F))` with `a < 0`. Outgassing adds a small non-gravitational acceleration that the game models as orbit-knowledge noise (sigma_v x3).
### EXPERT
DEMO: none
NOTES: 3I/ATLAS was reported on 1 July 2025 by the ATLAS unit in Chile at about 670 million km, the third known interstellar visitor. Non-gravitational forces are the reason comet impact predictions are harder than asteroid ones; Marsden's A1/A2/A3 parameterization is the standard.
MORE: Jewitt and Seligman 2023, "The Interstellar Interlopers" (Annual Review); JPL Small-Body Database for 3I/ATLAS; Yeomans, "Comets: A Chronological History".

---

# F. FINDING THEM

## F1 Finding a moving dot
meta: related=[F2,F5,F8]  game=[networks panel, discovery event]  tags=[detection,basics]
### SIMPLE
PICTURE: pic-tracklet  Four frames of the same star field; one dot moves a little each frame; a line joins the four.
TEXT: Stars stay still. An asteroid moves. Four photos, one moving dot: found.
### BEGINNER
A survey telescope photographs the same patch of sky several times, minutes apart. Stars do not move between the photos; an asteroid does. Software links the moving dots into a short track and sends it to the Minor Planet Center, where other telescopes around the world confirm it. The whole process from first photo to confirmed object can take a night or a week, and there are thousands of candidates a night.
### INTERMEDIATE
Each detection has a time and a position on the sky, nothing about distance. Three or four detections over about an hour make a "tracklet". The direction and rate of motion already hint at distance: nearby objects move fast across the sky. A new NEO candidate goes on the Minor Planet Center's confirmation page, and follow-up telescopes observe it over days. Only once it has been seen over enough of an arc can an orbit be fitted. The game's discovery rule, "three consecutive nights of detection", is a simplification of this pipeline.
### ADVANCED
Survey throughput is set by étendue (collecting area × field of view) and cadence. A field is revisited 3 to 4 times with 10 to 30 minute gaps; a moving source at rate `omega` (deg/day) shifts by `omega * dt` between visits and is linked if the motion is consistent with a great-circle path. Detection requires signal-to-noise above a threshold (SNR ≥ 5 typical) in each visit, which sets the limiting magnitude `V_lim`. The game's detection model (GAME_PLAN.md Section 18.1): `V <= V_lim` and solar elongation `eps >= 60 deg` and a nightly coverage probability `p_cover`, with a full-moon penalty.
### EXPERT
DEMO: LAB_MAGNITUDE
NOTES: Modern pipelines (Rubin's, ATLAS's) link tracklets across nights with "digest2" scoring and HelioLinC-style heliocentric linking. The trailing loss for fast movers (long streaks spread light over more pixels) is a real sensitivity penalty the game ignores.
MORE: Minor Planet Center NEO Confirmation Page (minorplanetcenter.net); Jedicke et al. 2015, "Surveys, Astrometric Follow-Up, and Population Statistics" (Asteroids IV); Rubin Observatory solar system processing documentation.

## F2 Brightness, albedo, and why size is uncertain
meta: related=[F1,F4,T5,O2]  game=[threat brief size range, LAB_MAGNITUDE]  tags=[detection,photometry]
### SIMPLE
PICTURE: pic-albedo  Two rocks lit by the Sun: a small white one and a big charcoal one shining equally bright to a telescope.
TEXT: A small bright rock and a big dark rock look the same. Size is a guess.
### BEGINNER
A telescope measures light, not size. A small, pale asteroid and a large, coal-black one can reflect the same amount of sunlight, so from brightness alone the size can be wrong by a factor of two or three. That is why early news stories about a new asteroid give a wide size range. Infrared telescopes fix this by seeing the rock's own heat instead of reflected light.
### INTERMEDIATE
Astronomers use "absolute magnitude" H: how bright the object would look at a standard distance. Lower numbers are brighter; each 5 magnitudes is 100 times brighter. Albedo p is the fraction of light reflected: a dark C-type reflects about 5%, a bright S-type about 20%. Example: an object with H = 22 is about 140 m across if its albedo is 0.14, about 250 m if it is dark (0.05), about 100 m if bright (0.25). Apparent brightness also falls with the square of distance twice over (Sun to rock, rock to telescope).
### ADVANCED
```
D_km = 1329 / sqrt(p) * 10^(-H/5)                       Harris and Harris relation
H    = 5 * log10( 1329 / (D_km * sqrt(p)) )
V    = H + 5*log10(r_au * delta_au) + phase(alpha)        r: Sun-object, delta: observer-object
phase(alpha) ≈ 0.035 * alpha_deg (game simplification; IAU H-G with G = 0.15 is the standard)
```
Worked: D = 140 m, p = 0.14 gives H ≈ 22.0; at r = 1.1 AU, delta = 0.1 AU, alpha = 20 deg, V ≈ 17.9 (easy for any survey); at delta = 1 AU, V ≈ 22.9 (only Rubin-class). Because D ∝ p^-1/2, an albedo uncertainty of 0.05 to 0.25 is a diameter uncertainty of 2.2x.
### EXPERT
DEMO: LAB_MAGNITUDE
NOTES: The 1329 constant comes from the Sun's visual magnitude (-26.74) and the definition of H at 1 AU, 1 AU, zero phase. Thermal models (NEATM, Harris 1998) invert infrared flux to diameter with 10 to 20% precision, albedo-independent to first order; this is NEO Surveyor's whole point.
MORE: Harris and Harris 1997, Icarus; Bowell et al. 1989 (H-G system); Mainzer et al. NEOWISE papers for the thermal method.

## F3 The sunward blind spot
meta: related=[F4,F7,T4]  game=[SUNWARD_SENTINEL program, NO WARNING rounds]  tags=[detection]
### SIMPLE
PICTURE: pic-sunward  Earth, the Sun, a telescope on Earth's night side looking away from the Sun; a rock sneaking in from the Sun's side, unseen.
TEXT: Telescopes look at the night sky. A rock coming from the Sun's side is invisible.
### BEGINNER
Ground telescopes can only search the dark sky. Anything approaching from roughly the direction of the Sun is lost in daylight glare until it is almost here. Chelyabinsk came that way in 2013 and was discovered by the people it hit. Roughly half the sky near the Sun is unwatched. The fix is a telescope in space, parked between Earth and the Sun, looking back at the ring of sky around the Sun in infrared, which is what ESA's planned NEOMIR does.
### INTERMEDIATE
Ground surveys need the object at least about 60 degrees from the Sun (the "solar elongation"), and even then twilight limits them. An object on an orbit mostly inside Earth's (an Atira or Aten) can spend years in the glare. The game's detection model enforces an elongation floor per network: 60 degrees for ground, 45 to 120 for a NEO Surveyor-class telescope at L1, and 10 to 45 degrees for a NEOMIR-class sunward sentinel. In play, a threat that stays sunward produces a NO WARNING round unless you have built the sentinel.
### ADVANCED
Elongation `eps` is the Sun-observer-object angle. For an object on a collision course approaching from the day side, `eps` at discovery is bounded by geometry: `sin(eps) = (r * sin(alpha)) / delta` in the Sun-observer-object triangle, so a body inside 1 AU at small phase angle has small elongation. The L1 vantage point (1.5 million km sunward of Earth) does not change the geometry much but allows a sun-shielded infrared telescope to look within 10 to 20 degrees of the Sun, where thermal emission from a warm, well-lit body is strongest.
### EXPERT
DEMO: LAB_SUNWARD
NOTES: ESA's NEOMIR study target: detect objects of 20 m and larger coming from the sunward region at least three weeks before impact; worst case (object passing near the spacecraft) about three days. NEOMIR would have found 2024 YR4 about a month before the ground surveys did, per ESA simulation.
MORE: ESA NEOMIR mission pages and the NEOSST2 2023 paper (Conversi et al.); Rubin's twilight survey proposals for Atiras (Seaman, Ivezic et al.).

## F4 Seeing heat: infrared surveys
meta: related=[F2,F3,F7]  game=[SPACE_IR_SURVEYOR program]  tags=[detection]
### SIMPLE
PICTURE: pic-infrared  The same dark rock twice: dim in visible light, glowing in heat-vision.
TEXT: Dark rocks still glow with heat. Infrared cameras see the glow and measure the size.
### BEGINNER
Every sun-warmed rock radiates heat, and heat glow depends on the rock's size, not on how dark it is. An infrared telescope in space (it has to be in space; the atmosphere and the telescope itself glow at those wavelengths) sees dark asteroids that visible-light surveys miss and gets their size within about 10 to 20 percent. NASA's NEOWISE did this from 2013 to 2024. NASA's NEO Surveyor, launching in 2027, is built for it.
### INTERMEDIATE
Thermal infrared flux scales with the object's cross-section (diameter squared) and its temperature, and the temperature depends on distance from the Sun, not on albedo. So the infrared signal gives size directly. Example: a 140 m rock at 1 AU from the Sun has a surface temperature around 280 K and peaks near 10 micrometers; NEO Surveyor's two bands (4 to 5.2 and 6 to 10 micrometers) bracket that peak. The game models an IR survey as detecting any object larger than a reference diameter scaled by the product of its Sun distance and observer distance.
### ADVANCED
```
F_IR ∝ D^2 * T^4 / delta^2,   T ∝ r^-1/2   =>   F_IR ∝ D^2 / (r^2 * delta^2)
detect if  D >= D_ref * (r_au * delta_au) / (r_ref * delta_ref)        [game model]
NEO Surveyor-class: D_ref = 140 m at r*delta = 0.5 AU^2, elongation 45..120 deg   [knob, verify]
NEOMIR-class:       D_ref = 20 m  at r*delta = 0.18 AU^2, elongation 10..45 deg   [knob]
```
Albedo enters only through the small fraction of sunlight reflected in-band, which NEATM handles with a beaming parameter eta ≈ 0.9 to 1.2.
### EXPERT
DEMO: LAB_MAGNITUDE
NOTES: NEO Surveyor: 50 cm aperture, 1,300 kg, Sun-Earth L1 halo orbit, 12-year mission, launch planned for September 2027 (NASA's commitment is no later than June 2028), goal of finding two thirds of the 140 m population within 5 years and 90% within 10. The game's D_ref scaling is a one-parameter stand-in for a full thermal model.
MORE: Mainzer et al. 2023, PSJ, NEO Surveyor mission overview; Harris 1998 (NEATM); NEOWISE data releases (IPAC).

## F5 Today's surveys and what they can see
meta: related=[F1,F6,F7,F3]  game=[networks panel, codex]  tags=[detection,networks]
### SIMPLE
PICTURE: pic-survey-map  A world map with telescope icons: Arizona, Hawaii, Chile, South Africa, Italy, China; a dashed ring for "space: empty".
TEXT: A few telescopes on mountaintops scan the whole sky every night.
### BEGINNER
A handful of survey telescopes find almost all NEOs: Catalina Sky Survey (Arizona), Pan-STARRS (Hawaii), ATLAS (four small telescopes on two hemispheres that scan the whole sky nightly), ZTF (California), ESA's new Flyeye (Italy), and since 2026 the huge Rubin Observatory in Chile, which is expected to roughly triple the catalog. There is currently no survey telescope in space; the last one, NEOWISE, retired in 2024. How small a rock each can find depends on how close it is: ATLAS can catch a 10 m rock about two days out and a 100 m rock about three weeks out.
### INTERMEDIATE
"Detectable size" is really "detectable brightness at a given distance." A survey with limiting magnitude 20 (ATLAS) sees a 140 m rock out to about 0.1 to 0.2 AU; one reaching magnitude 24.5 (Rubin) sees the same rock across the inner solar system, which is why Rubin finds things years before they come near. The known fraction as of 2026: about 95% of 1 km objects, about 45% of 140 m objects, and only a few percent of 30 to 100 m objects. Thirteen objects, all under 8 m, have been discovered before impact, nearly all by Catalina and ATLAS hours to a day ahead.
### ADVANCED
Game parameters (`config/networks.json`, GAME_PLAN.md 18.3; `[verify]` all):

```
Catalina (G96 1.5 m / 703 0.7 m)  V_lim 21.5 / 19.5   p_cover 0.5   eps >= 60
Pan-STARRS 1+2 (1.8 m)            V_lim 22             p_cover 0.5
ATLAS (4 x 0.5 m)                 V_lim 20             p_cover 0.95  whole sky nightly; 10 m: ~2 d, 100 m: ~3 wk, 140 m: 10-40 d warning
ZTF (1.2 m)                       V_lim 20.5           p_cover 0.6
Rubin / LSST (8.4 m)              V_lim 24.5           p_cover 0.6   southern sky; ~6x sensitivity of other surveys; ~90,000 new NEOs expected over 10 yr
Flyeye #1 (1 m, 44 deg^2)         V_lim 21.5           p_cover 0.8   up to four planned
CNEOST (1.04 m)                   V_lim 21             p_cover 0.4
```
Warning time for a body of diameter D approaching at speed v: find the distance `delta` at which `V(D, delta) = V_lim`, then `T_warn ≈ delta / v`. A 140 m stony body (H ≈ 22) reaches V = 20 near delta ≈ 0.3 AU in good geometry, about 25 days at 20 km/s, which brackets ATLAS's own 10 to 40 day figure once phase angle, sky coverage and full-moon gaps are averaged in.
### EXPERT
DEMO: LAB_MAGNITUDE
NOTES: Discovery credit by survey over the last decade: Catalina and Pan-STARRS roughly split the majority; ATLAS leads imminent impactors; Rubin began its ten-year survey in mid-2026 and reported more than 11,000 new asteroids including 33 NEOs from six weeks of commissioning data.
MORE: CNEOS discovery statistics by survey; ATLAS "How it works" (fallingstar.com); Rubin Observatory solar system science pages; Chow et al. 2026, ApJ, imminent impactors with LSST.

## F6 Radar
meta: related=[F5,F8,T5]  game=[RADAR_NET program, tracking tier]  tags=[detection,tracking]
### SIMPLE
PICTURE: pic-radar  A big dish sending a wave to a potato-shaped rock; the echo comes back drawn as a shape and a distance.
TEXT: Radar bounces radio waves off the rock: exact distance, speed, and shape.
### BEGINNER
Once an asteroid is found and comes within a few million kilometers, a big radio dish can bounce a signal off it. The echo gives the distance to within meters and the speed to within millimeters per second, far better than any camera, and the shape too. That turns a fuzzy orbit into a sharp one and can rule out impacts decades ahead (it did for Apophis in 2021). The biggest radar, Arecibo, collapsed in 2020; Goldstone in California remains, working with the Green Bank dish.
### INTERMEDIATE
Radar cannot discover asteroids (the echo weakens with the fourth power of distance), but for a known object within about 0.1 AU it is the best orbit-measuring tool there is. In the game, the RADAR_NET program and the tracking tiers set `sigma_v`, the uncertainty in the threat's velocity: 5 mm/s for optical-only, 0.2 mm/s with radar. Over a 10-year lead that is the difference between a 1.5 planet-radius uncertainty and a 0.06 one, which decides whether a plan's predicted miss is a sure thing.
### ADVANCED
```
Received power  P_r ∝ P_t * G^2 * lambda^2 * sigma / R^4        R: range, sigma: radar cross-section
Range precision ~ pulse length (10s of m); Doppler precision ~ 0.01 Hz at X-band ≈ 0.1 mm/s line-of-sight
Game: within range_max (0.1 AU Goldstone-class, 0.2 AU RADAR_NET), sigma_v -> tier-2 value; rho and shape revealed
```
Delay-Doppler imaging resolves the surface to tens of meters per pixel, which is how Didymos's binary nature and Apophis's shape were found.
### EXPERT
DEMO: none
NOTES: China's compound-eye phased-array radar ("Fuyan") in Chongqing is designed to extend radar reach; the bistatic Goldstone-transmit / Green Bank-receive configuration replaced part of Arecibo's capability.
MORE: Ostro et al., "Asteroid Radar Astronomy" (Asteroids III); JPL Goldstone Solar System Radar pages; Benner et al. for Apophis 2021 results.

## F7 Future missions: seeing smaller, sooner
meta: related=[F3,F4,F5,G4]  game=[PROGRAMS panel]  tags=[detection,future]
### SIMPLE
PICTURE: pic-future-telescopes  Earth, L1 point with two satellites looking sunward, a telescope on the Moon, two dots at L4 and L5.
TEXT: New eyes in space will spot smaller rocks, earlier, even ones hiding in the Sun's glare.
### BEGINNER
NASA's NEO Surveyor (launch planned 2027) is an infrared telescope that will sit between Earth and the Sun and find most of the city-killer-size rocks within a decade. ESA's NEOMIR (early 2030s) will watch the ring of sky around the Sun for rocks as small as 20 m and give at least three weeks' warning. ESA is building up to four Flyeye telescopes. China is studying its own space survey. Further out are ideas for telescope pairs at the L4 and L5 points and a survey from an orbit near Venus, to see objects that stay inside Earth's orbit. In the game these are the PROGRAMS you fund in the background; each takes years and permanently improves what you can see.
### INTERMEDIATE
What each buys you, in the game's terms (GAME_PLAN.md 18.4 and 19): SPACE_IR_SURVEYOR makes detection albedo-blind and widens elongation to 45 to 120 degrees; SUNWARD_SENTINEL covers 10 to 45 degrees for 20 m bodies; FLYEYE_NETWORK and GROUND_SURVEY_EXPANSION raise nightly coverage; RADAR_NET sharpens orbits; L4_L5_SENTINELS add parallax, cutting velocity uncertainty by three; VENUS_ORBIT_IR catches interior-orbit threats; LUNAR_FARSIDE_STATION gives a deep, weatherless survey. The payoff is lead time, and lead time multiplies every deflection: miss distance grows with the years remaining.
### ADVANCED
```
Program               model change                                        deploy (game yr)   status
SPACE_IR_SURVEYOR     IR, D_ref 140 m at 0.5 AU^2, eps 45..120            4                  REAL (built, launch 2027/28)
SUNWARD_SENTINEL      IR, D_ref 20 m at 0.18 AU^2, eps 10..45             5                  PROPOSED (ESA study)
FLYEYE_NETWORK        p_cover -> 0.95 at V_lim 21.5                        3                  PROPOSED (partly funded)
TWILIGHT_SURVEY       eps floor 45, V_lim 22                               1                  PROPOSED
RADAR_NET             range 0.2 AU, sigma_v tier 2                         3                  PROPOSED
L4_L5_SENTINELS       sigma_v / 3, interior coverage                       6                  PROPOSED (studied)
VENUS_ORBIT_IR        interior-orbit discovery, D_ref 100 m at 0.5 AU^2   7                  PROPOSED
LUNAR_FARSIDE_STATION V_lim 25, p_cover 0.7                                8                  PROPOSED
INTERSTELLAR_WATCH    enables hyperbolic rounds                            2                  PROPOSED
```
### EXPERT
DEMO: LAB_SUNWARD
NOTES: The US National NEO Preparedness Strategy and Action Plan (2018, updated 2023) and ESA's Space Safety programme are the policy documents behind these missions. Parallax from L4/L5 (60 degrees ahead and behind Earth) gives instantaneous distance to a detected object, collapsing the short-arc orbit ambiguity that plagues single-site discovery.
MORE: NASA PDCO strategy documents; ESA Space Safety programme pages; Mainzer et al. 2023 (NEO Surveyor); Conversi et al. 2023 (NEOMIR).

## F8 From dots to orbits: uncertainty, probability, keyholes
meta: related=[F1,F6,O7,O14,F9]  game=[P(IMPACT) readout, MISS CONFIDENCE, tracking tiers]  tags=[orbit determination,probability]
### SIMPLE
PICTURE: pic-uncertainty-cloud  A fuzzy cigar-shaped cloud of possible positions crossing Earth; a few days later the cloud is a thin line that misses.
TEXT: At first we only know roughly where it will be. More looks shrink the fuzz.
### BEGINNER
A new asteroid's orbit is fitted to a few nights of positions, so the prediction for years ahead is a long fuzzy region. If Earth sits inside that region, the impact probability is the fraction of the region Earth covers, maybe 1 or 2 percent. That is not "we think it will hit"; it is "we cannot yet rule it out." As more observations come in, the region shrinks. Usually Earth drops out of it and the probability falls to zero; occasionally the region shrinks toward Earth and the probability rises first, as 2024 YR4's did before collapsing.
### INTERMEDIATE
The uncertainty grows mostly along the orbit (an error in speed becomes an error in arrival time). The game keeps one number for this, sigma_v, the velocity knowledge in m/s, and projects it to the close approach: sigma_b ≈ 3 × sigma_v × T. With sigma_v = 5 mm/s and T = 8 years, sigma_b ≈ 3,800 km, about 0.6 Earth radii. Impact probability is then the slice of a bell curve that falls inside Earth's effective radius. A "keyhole" is a tiny region in one flyby that would steer the asteroid into a hit on a later pass; Apophis's 2029 keyhole for a 2036 impact was a few hundred meters wide and has been ruled out.
### ADVANCED
```
sigma_b = 3 * sigma_v * T_remaining                                   along-track projection (game)
P_impact = Phi((d_min + b_crit)/sigma_b) - Phi((d_min - b_crit)/sigma_b)    1-D Gaussian over the b-plane
sigma_v(t) = max(sigma_v_tier, sigma_v_0 * sqrt(30 d / arc_days))     knowledge improves with arc length
```
Real systems (JPL Sentry-II, ESA Aegis) sample the full 6-D orbit covariance, propagate thousands of virtual asteroids with planetary perturbations, and report probability on the target plane (b-plane). The game's 1-D along-track model captures the dominant term.
### EXPERT
DEMO: LAB_MONTECARLO
NOTES: The b-plane (Öpik) coordinates separate the geometry: xi (MOID direction) and zeta (timing). Keyholes are thin strips in zeta. Sentry-II (Roa et al. 2021) replaced the line-of-variations method with importance-sampled Monte Carlo to catch low-probability, Yarkovsky-driven cases.
MORE: Milani and Gronchi, "Theory of Orbit Determination"; Farnocchia et al. in Asteroids IV; JPL Sentry documentation; Valsecchi et al. 2003 on resonant returns and keyholes.

## F9 The Torino and Palermo scales
meta: related=[F8,T4]  game=[threat brief rating]  tags=[risk]
### SIMPLE
PICTURE: pic-torino  A 0 to 10 color ladder from white (nothing) through green, yellow, orange, to red.
TEXT: Torino scale: 0 means no worry. 10 means certain global disaster. Almost everything is 0.
### BEGINNER
The Torino scale is the public, 0-to-10 rating of an asteroid's threat, combining how likely a hit is and how big it would be. Almost every object is 0. A 1 means "worth watching, will probably drop to 0." The highest ever was Apophis at 4 in December 2004; 2024 YR4 reached 3 in 2025. Both fell to 0 once the orbit was pinned down. The Palermo scale is the technical version astronomers use, comparing the risk to the background chance of a random impact of that size.
### INTERMEDIATE
Torino needs two inputs: impact probability and kinetic energy. Probability under about 1 percent and energy under about 1 Mt stays at 0 or 1; a few percent chance of a city-scale event is a 3 or 4; a near-certain regional or global event is 8 to 10. Palermo is logarithmic: PS = 0 means the risk equals the background rate of such impacts over the time until the event; PS = -2 is one percent of background; positive values deserve attention. The game shows the Torino number on the threat brief and recomputes it after every maneuver.
### ADVANCED
```
Palermo:  PS = log10( P_i / (f_B * T) ),   f_B = 0.03 * E_Mt^-0.8   per year (annual background impact frequency for energy >= E)
          P_i impact probability, T years until the potential impact, E in megatons
Torino:   lookup in the (P, E) plane; the game implements the published grid as a function torino(P, E_Mt)
```
Example: P = 0.03, E = 8 Mt, T = 7 years: f_B = 0.03 × 8^-0.8 ≈ 5.7e-3/yr, denominator 0.04, PS = log10(0.75) ≈ -0.1 (2024 YR4 peaked near there).
### EXPERT
DEMO: LAB_TORINO
NOTES: Torino was proposed by Richard Binzel (1995, adopted by the IAU in 1999, revised 2005). Palermo is from Chesley et al. 2002. Both deliberately leave out lead time for deflection; a 9 with 50 years' warning is a very different problem from a 9 with 5.
MORE: Binzel 2000, Planetary and Space Science; Chesley et al. 2002, Icarus; CNEOS Sentry risk table (live).

## F10 Who is in charge, and what happens after discovery
meta: related=[F1,F8,F9,D10,G4]  game=[INTL_COORDINATION program, debrief]  tags=[policy]
### SIMPLE
PICTURE: pic-chain  Telescope -> clearing house -> orbit computers -> warning network -> space agencies -> governments.
TEXT: Finders report to one clearing house. Experts check. If real, the world's space agencies plan together.
### BEGINNER
Every observation goes to the Minor Planet Center. JPL's Sentry and ESA's Aegis systems compute impact odds automatically. If something looks real, the International Asteroid Warning Network (IAWN) alerts governments and the Space Mission Planning Advisory Group (SMPAG), a club of space agencies, works out what mission could be flown. NASA's Planetary Defense Coordination Office and ESA's Planetary Defence Office run their agencies' efforts. All of this was set up in 2013 to 2016 after Chelyabinsk and a United Nations recommendation. 2024 YR4 was the first object to trigger the full chain.
### INTERMEDIATE
The 2024 YR4 timeline is the best modern example: discovered 27 December 2024 by ATLAS Chile; odds for 22 December 2032 rose above 1 percent on 29 January 2025, triggering IAWN and SMPAG notifications; peaked near 3 percent on 18 February; new observations after the full moon dropped it to 0.28 percent on 20 February and effectively zero on 24 February; Webb measured its size (53 to 67 m) in March and April; a lunar impact chance of about 4 percent lingered until Webb data in February 2026 ruled it out. In the game, the INTL_COORDINATION program models the value of this plumbing: more budget, less political cost, faster confirmation.
### ADVANCED
Decision thresholds in SMPAG's published criteria: IAWN notifies when P > 1 percent for an object > 10 m; SMPAG begins mission planning when P > 1 percent and D > 50 m; a "recommended for action" case is P > 10 percent and D > 50 m (approximate; the documents define them precisely). The game's EVACUATE action and damage multipliers (GAME_PLAN.md 18.6) stand in for the civil-protection side, which in the US is coordinated with FEMA through tabletop exercises held every two years.
### EXPERT
DEMO: none
NOTES: Legal backdrop: the Outer Space Treaty (1967) governs liability; a nuclear deflection would need an exception to the Partial Test Ban Treaty (1963) and the Outer Space Treaty's ban on nuclear weapons in space, which is why the game attaches a political cost to warheads.
MORE: IAWN (iawn.net) and SMPAG (smpag.net) public documents; NASA Planetary Defense Strategy and Action Plan 2023; the Planetary Defense Conference hypothetical exercises (2013 to 2025) published at cneos.jpl.nasa.gov/pd/cs.

---

# O. ORBITS AND THE MATH BEHIND THEM

## O1 Numbers: units, scientific notation, orders of magnitude
meta: related=[O2,T2]  game=[every readout]  tags=[math basics]
### SIMPLE
PICTURE: pic-powers-of-ten  A row of boxes: 1, 10, 100, 1,000 ... each ten times bigger, with a pebble, a car, a building, a mountain.
TEXT: Space numbers are huge. We write them as "a number times ten, so many times."
### BEGINNER
The Sun is 150,000,000,000 meters away. Writing that every time is silly, so scientists write 1.5e11: "1.5 times ten to the eleventh," meaning move the decimal point eleven places. Tiny numbers work the same way: 0.000005 is 5e-6. The game shows distances in AU (one Earth-Sun distance), speeds in km/s, time in years and days, and energy in megatons, but all the math underneath is done in meters, seconds, kilograms and joules.
### INTERMEDIATE
Scientific notation makes estimation easy: multiply the front numbers, add the exponents. Mass of a 100 m stony asteroid: volume ≈ 0.5 × 10^6 m³ (half a million cubic meters) times 2,700 kg/m³ ≈ 1.4e9 kg. Energy at 20 km/s: 0.5 × 1.4e9 × (2e4)² = 0.5 × 1.4e9 × 4e8 = 2.8e17 J; divide by 4.184e15 J per megaton: about 67 Mt. Getting within a factor of two this way, before touching a calculator, is the main skill in this whole subject.
### ADVANCED
Conversions the game uses: 1 AU = 1.495978707e11 m; 1 Julian year = 3.15576e7 s; 1 day = 86,400 s; 1 Mt TNT = 4.184e15 J; 1 Earth radius = 6.371e6 m; 1 km²/s² (the unit of C3) = 1e6 m²/s². Floating-point doubles carry about 16 significant digits, which is why the sim can keep positions in meters at 1e12 scale and velocities in m/s and still resolve mm/s changes.
### EXPERT
DEMO: none
NOTES: Dimensional analysis is the free unit test: every equation in GAME_PLAN.md Section 6 balances in SI units, and `tests/physics` includes a units check that fails if a function returns km where m is expected.
MORE: "Street-Fighting Mathematics" (Mahajan, MIT Press, free PDF) for estimation; NIST SI brochure.

## O2 Logarithms and the magnitude scale
meta: related=[O1,F2,F9]  game=[threat brief H, detection]  tags=[math basics]
### SIMPLE
PICTURE: pic-magnitude-ladder  Six dots of decreasing brightness labeled 1, 2, 3, 4, 5, 6; the brightest has the smallest number.
TEXT: Star brightness uses a backwards scale: smaller number, brighter star. Each step is 2.5 times.
### BEGINNER
A logarithm answers "ten to what power?" log10(1000) = 3. Logs turn multiplying into adding, which is why they show up wherever numbers span many powers of ten. Astronomers' magnitude scale is logarithmic and backwards: a magnitude 1 star is 100 times brighter than a magnitude 6 star (five steps, each about 2.5 times). The faintest things today's surveys can see are about magnitude 20 to 24.5; the Sun is -27.
### INTERMEDIATE
Five magnitudes = factor 100, so one magnitude = 100^(1/5) ≈ 2.512. If a telescope reaches magnitude 24.5 and another reaches 20, the first sees sources 4.5 magnitudes fainter: 2.512^4.5 ≈ 63 times fainter. Since brightness falls with distance squared, that means seeing the same rock about 8 times farther away. That is the Rubin-versus-ATLAS difference in one number.
### ADVANCED
```
m1 - m2 = -2.5 * log10(F1 / F2)                   definition
distance modulus for reflected light: V = H + 5*log10(r * delta) + phase(alpha)   (two inverse-square laws)
```
The Palermo scale (F9), decibels, pH and the Richter scale are the same idea; the asteroid absolute magnitude H is a log of size and albedo (F2).
### EXPERT
DEMO: LAB_MAGNITUDE
NOTES: Pogson's ratio (1856) fixed 5 magnitudes to exactly 100 to match Hipparchus's eyeballed classes. In code, prefer `Math.log10` and keep magnitudes as floats; never round H before computing D.
MORE: Any first-year astronomy text (Carroll and Ostlie, ch. 3); Khan Academy on logarithms.

## O3 Vectors: position and velocity
meta: related=[O4,O7,D1]  game=[system view arrows]  tags=[math basics]
### SIMPLE
PICTURE: pic-vectors  A rock with two arrows: a long one from the Sun to the rock (where), a short one along its path (which way, how fast).
TEXT: An arrow says where. Another says which way and how fast.
### BEGINNER
A vector is an arrow with a length and a direction. The game uses two for every body: position (an arrow from the Sun) and velocity (an arrow along its path whose length is its speed). Adding vectors is laying arrows head to tail. A push changes the velocity arrow a little; which direction you push matters as much as how hard.
### INTERMEDIATE
In the game's flat solar system a vector is just two numbers, (x, y). Length is Pythagoras: |v| = sqrt(vx² + vy²). The dot product tells you how much of one arrow points along another: v·u = vx ux + vy uy = |v||u| cos(angle). That is how the game splits a push into the part along the orbit (which changes arrival time a lot) and the part across it (which changes it little). Example: a 10 mm/s push at 60 degrees from the direction of motion contributes only 10 × cos(60°) = 5 mm/s along-track.
### ADVANCED
```
r = (x, y),  v = (vx, vy)
|v| = sqrt(vx^2 + vy^2)             unit vector  v_hat = v / |v|
dot(a, b) = ax*bx + ay*by           cross_z(a, b) = ax*by - ay*bx    (2-D cross product: a scalar)
along-track component of dv:  dv_t = dot(dv, v_hat)
specific angular momentum:    h = cross_z(r, v)      (> 0 prograde)
```
The 2-D cross product sign is what the game uses to decide prograde vs retrograde and which side of a planet a flyby passes.
### EXPERT
DEMO: none
NOTES: In 3-D (the inclination stretch goal) the cross product becomes a vector normal to the orbit plane and the orbital elements gain two angles (inclination, node). Everything in `src/physics/vec.ts` is written so that swapping in a 3-vector type is mechanical.
MORE: 3Blue1Brown, "Essence of Linear Algebra" (free video series).

## O4 Newton: gravity and motion
meta: related=[O3,O5,O6]  game=[system view, RK4]  tags=[physics basics]
### SIMPLE
PICTURE: pic-newton  Sun pulling on a rock with an arrow; the rock's path bends into a curve instead of going straight.
TEXT: Things move in straight lines until something pulls. The Sun pulls. Paths bend into orbits.
### BEGINNER
Newton's three laws: things keep moving unless pushed; force equals mass times acceleration; every push has an equal push back. His gravity law: every mass pulls every other, more strongly the closer they are (four times stronger at half the distance). An orbit is a fall that keeps missing: the rock is always falling toward the Sun and always moving sideways fast enough to miss it.
### INTERMEDIATE
Gravity's pull on a 1 kg mass at Earth's distance from the Sun is about 0.006 N (6 mm/s² of acceleration). That seems tiny, but it acts for a year at a time: 0.006 m/s² × 31 million seconds = 190 km/s of "would-be" velocity change, which is why the Sun can bend a 30 km/s path into a full circle. The same arithmetic is why a deflection push of millimeters per second, given years, moves an asteroid by thousands of kilometers.
### ADVANCED
```
F = G * M * m / r^2               Newton's gravitation, G = 6.674e-11 m^3 kg^-1 s^-2
a = -mu * r_vec / |r|^3           acceleration on a test body, mu = G*M (Sun: 1.327e20 m^3/s^2)
F = m * a                         second law; action-reaction is why every deflection method needs something to push against
```
The game integrates this only during thrust arcs (O13); otherwise it uses the exact solution, Kepler's ellipse (O6, O9).
### EXPERT
DEMO: LAB_RK4
NOTES: The two-body problem is the only gravitational problem with a closed-form solution. The game's "patched" approach (Sun-only two-body plus instantaneous planetary flybys) is the same patched-conic method mission designers use for first-cut trajectory design.
MORE: Feynman Lectures Vol. I ch. 7 and 9 (free online); Curtis, "Orbital Mechanics for Engineering Students", ch. 1-2.

## O5 Energy and momentum
meta: related=[O4,D1,D3,O8]  game=[impact energy, dv readouts]  tags=[physics basics]
### SIMPLE
PICTURE: pic-momentum  A small fast ball hitting a big slow one; after, the big one moves a tiny bit.
TEXT: Momentum is mass times speed, and it is never lost. Hit a mountain, the mountain moves a little.
### BEGINNER
Kinetic energy is how much damage something can do: it grows with speed squared, so twice as fast is four times the punch. Momentum is mass times velocity, and in a collision the total momentum before equals the total after. That second rule is the whole basis of asteroid deflection: a 600 kg spacecraft at 6 km/s hits a 5 billion kg rock, and the rock must pick up the spacecraft's momentum, so it speeds up by a few millimeters per second. Not much, but forever.
### INTERMEDIATE
Conservation of momentum: m × U = M × dv (if the spacecraft sticks). DART: 579 kg × 6,140 m/s = 3.55 million kg·m/s; divide by Dimorphos's mass, about 4.3 billion kg: dv ≈ 0.8 mm/s. The measured change was about 2.7 mm/s, three times more, because rock blasted off the crater flew backward, pushing the asteroid forward like a rocket exhaust. That extra is the "beta" factor (D3). Energy is a different story: DART's kinetic energy was about 11 gigajoules, 2.6 tonnes of TNT, almost all of it spent making the crater and heat.
### ADVANCED
```
KE = 0.5 * m * v^2                     J
p = m * v                              kg m/s, conserved in collisions (vector)
dv_target = beta * (m / M) * U         kinetic impact, M >> m, beta >= 1 (ejecta enhancement)
specific orbital energy  eps = v^2/2 - mu/r   (< 0 bound, = 0 parabolic, > 0 hyperbolic)
```
Energy and momentum scale differently with speed (v² vs v), which is why a fast impactor delivers more push but also risks shattering the target (D4): the push grows with U, the specific energy with U².
### EXPERT
DEMO: LAB_BETA
NOTES: In the center-of-mass frame of a perfectly inelastic collision the target gains exactly m/(M+m) of the relative velocity; the game writes m/M because m/M ~ 1e-7. Beta is defined via the ejecta momentum: beta = 1 + p_ejecta / (m U).
MORE: Feynman Lectures Vol. I ch. 10 (momentum); Holsapple and Housen 2012 on momentum transfer from cratering.

## O6 Kepler's laws and the ellipse
meta: related=[O4,O7,O8,O9]  game=[system view orbits]  tags=[orbits]
### SIMPLE
PICTURE: pic-ellipse  An oval with the Sun at one focus (not the center); a rock fast near the Sun, slow far away; equal-area wedges.
TEXT: Orbits are ovals with the Sun off-center. Close to the Sun: fast. Far: slow.
### BEGINNER
Kepler worked out three rules in the 1600s, before Newton explained them. One: orbits are ellipses (ovals) with the Sun at one focus, not the middle. Two: a body sweeps out equal areas in equal times, so it moves fastest at its closest point (perihelion) and slowest at its farthest (aphelion). Three: the farther an orbit is from the Sun, the longer the year, in a precise way: the square of the period is proportional to the cube of the average distance.
### INTERMEDIATE
Third law in handy units: with distance in AU and time in years, T² = a³ for anything orbiting the Sun. Mars at 1.52 AU: 1.52³ ≈ 3.5, so T ≈ 1.88 years. An asteroid with a = 2.5 AU: T ≈ 3.95 years. The ellipse is described by its half-length a (semi-major axis) and its eccentricity e (0 is a circle, close to 1 is a long cigar). Perihelion is a(1-e), aphelion a(1+e). Earth: a = 1 AU, e = 0.017, so its distance varies by only ±1.7%.
### ADVANCED
```
r(nu) = a * (1 - e^2) / (1 + e*cos(nu))          polar equation, nu = true anomaly from perihelion
T = 2*pi * sqrt(a^3 / mu)                         period; n = 2*pi/T = sqrt(mu/a^3) is the mean motion
q = a(1-e)  (perihelion),  Q = a(1+e)  (aphelion),  b = a*sqrt(1-e^2)  (semi-minor axis)
equal areas:  dA/dt = h/2 = const,  h = |r x v|
```
### EXPERT
DEMO: LAB_ELLIPSE
NOTES: Deriving the ellipse from F = -mu m / r² takes the Laplace-Runge-Lenz (eccentricity) vector, which the game computes directly in `elements.ts` to convert a state vector into orbital elements (GAME_PLAN.md 6.3).
MORE: Feynman Lectures I-7; Curtis ch. 2; Goldstein, "Classical Mechanics", ch. 3 for the LRL vector.

## O7 Orbital elements
meta: related=[O6,O9,O3]  game=[threat brief orbit card, SAVE.md]  tags=[orbits]
### SIMPLE
PICTURE: pic-elements  An oval with labels: how big (a), how squashed (e), which way it points (ϖ), where the rock is now (M).
TEXT: Four numbers describe a flat orbit: size, shape, direction, and where the rock is right now.
### BEGINNER
Instead of storing a path as thousands of points, astronomers store a few numbers that describe the whole ellipse: how big it is, how stretched, which way it is turned, and where along it the body is at a reference moment. From those you can compute the position at any time, past or future, instantly. That is why the game can jump years ahead without "simulating" anything in between.
### INTERMEDIATE
In the game's flat system: a (size, in AU), e (shape), ϖ (longitude of perihelion: the angle the long axis points), and M0 (mean anomaly at epoch t0: a clock reading that says how far around the body is). Real 3-D orbits need two more angles, inclination (tilt) and the node (where the tilted plane crosses the reference plane). Example card for Apophis: a = 0.922 AU, e = 0.191, i = 3.3 degrees; so it crosses Earth's orbit twice a year and spends most of its time inside it.
### ADVANCED
```
2-D elements: a, e, w (longitude of periapsis), M0 at t0
state -> elements (game, GAME_PLAN.md 6.3):
  h = x*vy - y*vx;  eps = v^2/2 - mu/r;  a = -mu/(2*eps)
  e_vec = ((v^2 - mu/r)*r_vec - dot(r,v)*v_vec)/mu;  e = |e_vec|;  w = atan2(e_y, e_x)
  nu = atan2(y, x) - w;  E = 2*atan2(sqrt(1-e)*sin(nu/2), sqrt(1+e)*cos(nu/2));  M0 = E - e*sin(E)
```
Every impulse in the game (impact, flyby, warhead) is: take the state vector, add dv, convert back to elements, carry on analytically.
### EXPERT
DEMO: LAB_ELLIPSE
NOTES: Osculating elements are the elements of the ellipse the body would follow if all perturbations stopped now; they drift slowly under planetary perturbations, which the game ignores except at flybys. For e → 0 the periapsis direction is undefined; the code guards this by setting w = 0.
MORE: Curtis ch. 4; Vallado, "Fundamentals of Astrodynamics and Applications", ch. 2.

## O8 Vis-viva: how fast at any point
meta: related=[O6,O5,D8,O11]  game=[planner readouts, LAB_VISVIVA]  tags=[orbits]
### SIMPLE
PICTURE: pic-visviva  One ellipse with three speed arrows: long near the Sun, short far away.
TEXT: One formula gives the speed anywhere on an orbit from the distance and the orbit's size.
### BEGINNER
Speed on an orbit depends only on two things: how far from the Sun you are right now, and how big the orbit is overall. Closer is faster. For a given spot, a bigger orbit means you are moving faster there (you have more energy). Earth moves at about 30 km/s; something falling in from very far away passes Earth's distance at about 42 km/s.
### INTERMEDIATE
The vis-viva equation ("living force", an old name for energy): v² = GM(2/r - 1/a). At Earth's distance, r = 1 AU: a circular orbit (a = 1 AU) gives 29.8 km/s; an orbit with a = 2 AU passing through gives 36.5 km/s; a parabola (a infinite) gives 42.1 km/s. Those differences are what a rocket or an impactor has to supply or absorb. The game prints "U", the closing speed at impact, which is the vector difference between the impactor's and the asteroid's vis-viva velocities at the same point.
### ADVANCED
```
v^2 = mu * (2/r - 1/a)
circular:   v_c = sqrt(mu/r)          escape:  v_esc = sqrt(2*mu/r) = sqrt(2) * v_c
Hohmann transfer 1 -> 1.524 AU:  a_t = 1.262 AU;  v at 1 AU on transfer = 32.7 km/s;  dv1 = 2.94 km/s;  flight time = T_t/2 = 259 d
```
### EXPERT
DEMO: LAB_VISVIVA
NOTES: Vis-viva is energy conservation rewritten: eps = v²/2 - mu/r = -mu/(2a). Differentiate it along-track to get the key deflection result da = 2a²v dv/mu, which leads to the 3dvT rule (D2).
MORE: Curtis ch. 2 and 6; Bate, Mueller and White, "Fundamentals of Astrodynamics" (Dover, cheap).

## O9 Anomalies and Kepler's equation
meta: related=[O6,O7,O13]  game=[kepler.ts, time warp]  tags=[orbits,numerics]
### SIMPLE
PICTURE: pic-anomalies  An ellipse inside a circle; one angle measured from the center (E), one from the Sun (ν), and a steadily ticking clock (M).
TEXT: Three angles say where a rock is. One ticks like a clock. The others follow from it.
### BEGINNER
Finding where a body is on its ellipse at a given time is harder than it sounds, because it speeds up and slows down. Kepler's trick: define a clock angle that ticks evenly (the mean anomaly), then solve a small puzzle to turn it into the real angle. Computers solve that puzzle in a few steps, millions of times a second, which is what the game does for every planet, asteroid, fragment and spacecraft every frame.
### INTERMEDIATE
Mean anomaly M grows evenly: M = n (t - t0), where n = 360 degrees per period. Kepler's equation M = E - e sin E links it to the eccentric anomaly E, which then gives the true angle from the Sun and the distance. There is no formula for E; you guess E = M and improve the guess with Newton's method. For Earth (e = 0.017) one or two steps give 12 digits. For a comet with e = 0.95 it may take ten, and you start from a different guess.
### ADVANCED
```
M = M0 + n*(t - t0),  n = sqrt(mu/a^3)
solve  E - e*sin(E) = M:   E_{k+1} = E_k - (E_k - e*sin(E_k) - M)/(1 - e*cos(E_k)),  E_0 = M (e<0.8) else pi
nu = 2*atan2( sqrt(1+e)*sin(E/2), sqrt(1-e)*cos(E/2) )
r = a*(1 - e*cos(E))
position (perifocal): (r cos nu, r sin nu);  velocity: sqrt(mu*a)/r * (-sin E, sqrt(1-e^2) cos E)
```
Rotate by the longitude of perihelion to get system-frame coordinates. Cost: O(1) per evaluation, so time warp is free.
### EXPERT
DEMO: LAB_KEPLER_SOLVER
NOTES: Newton's method converges quadratically here because the derivative 1 - e cos E never vanishes for e < 1. Danby's starter E0 = M + 0.85 e sign(sin M) is a classic robust choice. Hyperbolic orbits use M = e sinh F - F. The game's test suite checks E to 1e-12 rad for 10,000 random (e, M) pairs.
MORE: Danby, "Fundamentals of Celestial Mechanics", ch. 6; Colwell, "Solving Kepler's Equation Over Three Centuries".

## O10 Getting from A to B: Hohmann, Lambert, porkchop plots
meta: related=[O8,D8,O11,G3]  game=[planner porkchop]  tags=[trajectory]
### SIMPLE
PICTURE: pic-porkchop  A grid of launch date vs arrival date colored like a weather map; a dark valley marked "cheap".
TEXT: Pick a launch day and an arrival day. Some pairs are cheap, some impossible. The map shows which.
### BEGINNER
Getting to an asteroid is not "point and go": the rocket, the Earth and the target are all moving. The cheapest path is usually half an ellipse that just touches both orbits (a Hohmann transfer). For any chosen launch day and arrival day there is exactly one coasting path connecting them (Lambert's problem), and some cost far more fuel than others. Plotting the cost for every pair of days gives a "porkchop plot," a map with cheap valleys and impossible mountains. The game's planner draws one for every mission.
### INTERMEDIATE
Earth to Mars by Hohmann: leave Earth 2.9 km/s faster than Earth moves, coast 259 days, arrive. Miss the window and the cost climbs steeply: launch 3 months late and you need two or three times the fuel, which means a third of the payload. For an impactor the planner cares about two numbers per grid cell: C3 (the launch energy, which limits payload) and U (the closing speed at the target, which sets the punch and the breakup risk). Cheap cells and hard-hitting cells are rarely the same cells; that trade-off is the planner's whole job.
### ADVANCED
```
Lambert: given r1 (at t1), r2 (at t2), find v1, v2 of the coasting arc.  Universal-variable form (Curtis 5.3):
  A = sin(dth) * sqrt(r1*r2/(1-cos(dth)));   y(z) = r1 + r2 + A*(z*S(z)-1)/sqrt(C(z))
  F(z) = (y/C)^1.5 * S + A*sqrt(y) - sqrt(mu)*dt = 0   -> solve for z (bisection/Newton)
  f = 1 - y/r1,  g = A*sqrt(y/mu),  gdot = 1 - y/r2;   v1 = (r2 - f*r1)/g,   v2 = (gdot*r2 - r1)/g
C3 = |v1 - v_Earth(t1)|^2;  U = |v2 - v_target(t2)|
```
Stumpff functions S(z), C(z) handle elliptic, parabolic and hyperbolic arcs in one formula.
### EXPERT
DEMO: LAB_LAMBERT_PORKCHOP
NOTES: The game grids launch × arrival at 10-day steps in a web worker (a few thousand Lambert solves, milliseconds each). Multi-revolution solutions and the 180-degree singularity are skipped. Izzo's 2015 algorithm is the modern fast solver if you ever need thousands per frame.
MORE: Curtis ch. 5; Izzo 2015, "Revisiting Lambert's problem", Celestial Mechanics and Dynamical Astronomy; NASA's free "Trajectory Browser" for real porkchops.

## O11 Gravity assists
meta: related=[O10,O8,O3]  game=[flyby windows, KINETIC_FLYBY plans]  tags=[trajectory]
### SIMPLE
PICTURE: pic-flyby  A spacecraft curving around a planet; it leaves going a different direction and, in the Sun's frame, faster.
TEXT: Swing close to a planet: it bends your path and can throw you faster, for free.
### BEGINNER
A spacecraft passing close to a planet gets whipped around by its gravity. Relative to the planet it leaves as fast as it came, just in a new direction. But the planet itself is moving around the Sun, so relative to the Sun the spacecraft can come out much faster (or slower). It is like bouncing a ball off the front of a moving truck. Voyager, Cassini and New Horizons all used this. In the game, a well-timed pass of the inner planet or the giant can add kilometers per second to an impactor at no fuel cost.
### INTERMEDIATE
The bend angle depends on how fast you arrive and how close you pass: slower and closer bends more. Jupiter-class planet, 10 km/s approach, passing at 10 planet radii: about 80 degrees of bend. A 90-degree bend at 10 km/s changes your Sun-relative velocity by up to 14 km/s. The catch is timing: the planet has to be in the right place when you get there, which is why the game shows "FLYBY WINDOWS" per planet and why each round's planet configuration changes what is possible.
### ADVANCED
```
v_inf_in = v_sc - v_planet;    |v_inf| conserved
turn angle  delta = 2*asin( 1 / (1 + r_p * v_inf^2 / mu_planet) ),   r_p >= R_planet + h_min
v_inf_out = rotate(v_inf_in, +/- delta);   v_sc_out = v_planet + v_inf_out
|dv_heliocentric| = 2 * v_inf * sin(delta/2)
```
Two-leg planning in the game: Lambert from home to the planet, Lambert from the planet to the target, feasible if the required change in v_inf direction is within delta_max and the magnitude mismatch is within the onboard dv budget (a powered flyby or deep-space maneuver).
### EXPERT
DEMO: LAB_FLYBY
NOTES: The energy comes from the planet's orbital motion: the planet slows by an unmeasurably tiny amount. Patched conics treat the flyby as instantaneous at the sphere of influence r_SOI = a (m_p/M_sun)^0.4; errors are a few percent for fast flybys, which is fine for a game and for first-cut mission design.
MORE: Curtis ch. 8; Bate, Mueller and White ch. 8; JPL's "Basics of Space Flight" (free online), gravity assist chapter.

## O12 Close approach and gravitational focusing
meta: related=[O6,T2,D2,F8]  game=[planet view b_crit ring, MISS readout]  tags=[orbits,impact]
### SIMPLE
PICTURE: pic-focusing  Earth with a dashed ring bigger than itself; a rock aimed at the ring curves in and hits.
TEXT: Earth's gravity pulls passing rocks inward, so the target is bigger than the planet.
### BEGINNER
A rock that would have missed Earth by a few thousand kilometers gets pulled in by Earth's gravity and hits anyway. The slower it comes, the stronger this effect. For a typical 10 km/s approach the effective target is about 1.5 Earth radii; for a very slow approach it can be two or more. So "miss by one Earth radius" is not a miss. The game draws this bigger ring on the planet view and counts a hit whenever the rock's path crosses it.
### INTERMEDIATE
The game finds the closest approach by checking the distance between asteroid and planet every hour near the predicted impact time, then refining to the second. That distance, computed without the planet's gravity, is the "impact parameter" b. Earth's escape speed is 11.2 km/s. Rule: the effective radius is R × sqrt(1 + (11.2 / v_inf)²). At v_inf = 10 km/s that is 1.50 R; at 5 km/s, 2.45 R; at 20 km/s, 1.15 R.
### ADVANCED
```
b_crit = R * sqrt( 1 + v_esc^2 / v_inf^2 ),   v_esc^2 = 2*mu_planet/R
impact if  d_min < b_crit;    margin = (d_min - b_crit)/R;    v_impact = sqrt(v_inf^2 + v_esc^2)
```
Derivation: conserve energy and angular momentum from infinity to the surface; a grazing hit has periapsis = R. The "d_min" the sim computes from two-body heliocentric motion is the asymptotic b, so the comparison is exact within the model.
### EXPERT
DEMO: LAB_FOCUSING
NOTES: The same formula gives the lunar hit probability enhancement (tiny: lunar v_esc is 2.4 km/s) and is why slow Aten-type encounters are over-represented among impactors relative to their population share.
MORE: Öpik 1951 on collision probabilities; Wetherill 1967; any astrodynamics text under "gravitational focusing".

## O13 Numerical integration: when there is no formula
meta: related=[O4,D7,D6,O9]  game=[sail arcs, slow push, RK4]  tags=[numerics]
### SIMPLE
PICTURE: pic-rk4  A curved true path and a chain of short straight steps that follow it closely.
TEXT: When the pull keeps changing, take many tiny steps and add them up.
### BEGINNER
Kepler's formula works only when gravity is the only force. A solar sail or an ion engine adds a small, continuous push, and then there is no formula: the computer takes a tiny time step, works out the forces, moves the craft a little, and repeats, millions of times. Doing this well (not drifting, not blowing up) is a whole branch of math; the game uses a classic method called Runge-Kutta 4.
### INTERMEDIATE
The simplest method (Euler) uses the force at the start of each step and drifts badly. RK4 samples the force four times within the step and blends them, so the error per step shrinks with the fifth power of the step size: halve the step, get 32 times less error. For a sail arc the game uses 6-hour steps; over a year that is 1,460 steps per craft, cheap enough to run in a worker while you watch. After the arc ends, the state is converted back into an ellipse and Kepler takes over again.
### ADVANCED
```
state y = (x, y, vx, vy);   f(t, y) = (vx, vy, ax, ay),  a = -mu*r/|r|^3 + a_thrust(t, y)
k1 = f(t, y);  k2 = f(t+h/2, y + h/2*k1);  k3 = f(t+h/2, y + h/2*k2);  k4 = f(t+h, y + h*k3)
y_next = y + h/6 * (k1 + 2*k2 + 2*k3 + k4)         local error O(h^5), global O(h^4)
```
Check: run with gravity only and compare with Kepler; the game's test requires agreement to 1 km after one year at h = 6 h for a 1 AU orbit.
### EXPERT
DEMO: LAB_RK4
NOTES: For long propagations astronomers use symplectic or high-order adaptive integrators (Dormand-Prince, Gauss-Radau IAS15) to control energy drift; RK4 is adequate for the game's months-long thrust arcs. Step size should shrink near perihelion for eccentric sail trajectories (adaptive h ∝ r^1.5).
MORE: Numerical Recipes ch. 17 (free older editions online); Hairer, Lubich and Wanner, "Geometric Numerical Integration" for the symplectic story.

## O14 Randomness, seeds, Monte Carlo and probability
meta: related=[F8,G7,G5]  game=[P(MISS) readout, seeds, leaderboard]  tags=[probability,numerics]
### SIMPLE
PICTURE: pic-montecarlo  A hundred faint ghost asteroids drawn around one bold one; most miss, a few hit; a counter "7 of 100".
TEXT: Run the future a hundred times with small changes. Count the hits. That is the risk.
### BEGINNER
Some things in the game are not known exactly: how hard the rock will respond to a hit, exactly where it is, how it breaks. Instead of pretending, the game plays the future out a few hundred times with slightly different values and counts how often the planet survives. That count is the "P(MISS)" number the planner shows. All the randomness comes from one seed number, so the same seed always gives the same game, which is what makes leaderboards fair and replays exact.
### INTERMEDIATE
A seeded pseudo-random generator is a formula that produces a fixed sequence of numbers that look random. Two players with the same seed get the same asteroid, the same beta draw, the same fragments. Monte Carlo estimation: with N = 200 samples the estimate of a probability p has a standard error of about sqrt(p(1-p)/N); for p = 0.9 that is ±2%, good enough to rank plans. The normal (bell) distribution handles orbit uncertainty: 68% of outcomes fall within one sigma, 95% within two.
### ADVANCED
```
PRNG: mulberry32 or xoshiro128** seeded from (run seed, round, stream id); one stream per purpose so adding a new
      random draw somewhere does not change unrelated outcomes
Gaussian sampling: Box-Muller;  Rayleigh for ejecta speeds;  Pareto for fragment masses
P_miss estimate = (1/N) * sum_i [no fragment hits in sample i],  N = 200 (worker);  SE = sqrt(p(1-p)/N)
Gaussian CDF Phi(x) via erf: Phi(x) = 0.5*(1 + erf(x/sqrt2)), erf by Abramowitz-Stegun 7.1.26 (1e-7 accuracy)
```
### EXPERT
DEMO: LAB_MONTECARLO
NOTES: Determinism in the game is a property of the resolver being a pure function of (world state, missions, seed); the same inputs twice must produce byte-identical event logs, which is a test. Floating-point reproducibility across browsers holds for the basic operations the sim uses (IEEE 754 doubles) but not for transcendental functions in every engine, so the test suite pins expected values with tolerances.
MORE: "Statistical Rethinking" (McElreath) for intuition; Knuth, TAOCP vol. 2 for PRNGs; Vigna's xoshiro page (prng.di.unimi.it).

---

# D. MOVING A MOUNTAIN: THE DEFLECTION SCIENCE

## D1 Impulse: what a push does to an orbit
meta: related=[O5,O3,D2,O7]  game=[dv readouts, planner]  tags=[deflection,basics]
### SIMPLE
PICTURE: pic-impulse  An orbit before (dashed) and after (solid) a small push; the two ovals nearly overlap but one is slightly bigger.
TEXT: A tiny push changes the orbit a tiny bit. The change grows every lap.
### BEGINNER
You do not need to stop the asteroid or turn it around. You need to make it arrive at the crossing point a few minutes early or late, because Earth will have moved on. A push along the direction of motion makes the orbit slightly bigger and the year slightly longer; the asteroid falls a little further behind on every lap. After enough laps, "a little" is thousands of kilometers.
### INTERMEDIATE
A 1 cm/s speed change on a body circling the Sun at 30 km/s is one part in three million. But it changes the orbital period by about three millionths of a year, about 100 seconds per orbit, and the asteroid moves 30 km in 1 second, so each lap it slips 3,000 km. Ten laps, 30,000 km, almost five Earth radii. That is the entire logic of planetary defense: find it early, nudge it gently, let the clock do the rest.
### ADVANCED
```
Along-track impulse dv_t on a near-circular orbit:
  da/a = 2 * dv_t / v                       (from vis-viva)
  dT/T = 1.5 * da/a = 3 * dv_t / v          (Kepler III)
  along-track drift after time t:  ds ≈ 3 * dv_t * t
Radial impulse dv_r:  changes e, shifts the crossing point sideways by ~ dv_r * t / n ... far less effective per unit dv
```
The game resolves plans exactly by propagation; the 3 dv t rule is the planner's instant estimate (GAME_PLAN.md 6.15).
### EXPERT
DEMO: LAB_3DVT
NOTES: The along-track rule follows from differentiating n = sqrt(mu/a³): dn/n = -1.5 da/a. The factor 3 is exact for circular orbits and within 20% for e < 0.3 over a few orbits; the game's test compares it against full propagation.
MORE: Ahrens and Harris 1992, Nature, "Deflection and fragmentation of near-Earth asteroids"; NRC "Defending Planet Earth" (2010), ch. 5.

## D2 Why early beats big
meta: related=[D1,F7,G4,D3]  game=[debrief counterfactual, programs]  tags=[deflection,strategy]
### SIMPLE
PICTURE: pic-lever  A see-saw: a small push on a long arm (years) lifts the same weight as a huge push on a short arm (months).
TEXT: Years of warning turn a gentle nudge into a safe miss. Weeks need a miracle.
### BEGINNER
Because the miss distance grows with the time remaining, a push ten years out is worth ten times the same push one year out. A single small impactor launched early can do what a dozen could not do late. That is why the game rewards building telescopes (lead time) as much as building rockets, and why the debrief tells you how much earlier a better survey would have seen the threat.
### INTERMEDIATE
Miss distance ≈ 3 × dv × T. To miss Earth's effective target (about 1.5 Earth radii, 9,500 km at 10 km/s approach): with 10 years remaining you need dv ≈ 1 cm/s; with 2 years, 5 cm/s; with 3 months, 40 cm/s. A kinetic impactor on a 300 m stony body delivers a few mm/s; a nuclear standoff a few cm/s. So the 10-year case is a routine mission, the 2-year case needs a warhead or a very large campaign, and the 3-month case has no deflection solution at all, only evacuation.
### ADVANCED
```
dv_required ≈ b_crit / (3 * T)                     for an along-track push applied at T before impact
examples (b_crit = 9.5e6 m):  T = 10 yr -> 1.0 cm/s;  T = 2 yr -> 5.0 cm/s;  T = 90 d -> 41 cm/s;  T = 18 d -> 2 m/s
kinetic dv ≈ beta * m * U / M:   300 m stony (3.8e10 kg), 2 t at 12 km/s, beta 3 -> 1.9 mm/s  (need 5+ of them at T = 10 yr)
```
The campaign size scales as 1/T, and the number of launch windows available also shrinks with T, so late campaigns are doubly hard.
### EXPERT
DEMO: LAB_3DVT
NOTES: The NRC 2010 chart of "size vs warning time vs method" (D11) is just this scaling drawn as regions. For very long lead times (decades) the limiting factor flips from dv to orbit knowledge: you cannot aim a 1 mm/s nudge if the uncertainty is bigger than the needed shift, which is why tracking tiers matter in the game.
MORE: NRC 2010, ch. 5; NASA 2018/2023 NEO Preparedness Strategy; Ahrens and Harris 1992.

## D3 Kinetic impactors and the beta factor
meta: related=[D1,O5,T4,D4,T5]  game=[KINETIC plans, beta reveal]  tags=[deflection,real]
### SIMPLE
PICTURE: pic-kinetic  A spacecraft slams into a rock; a spray of debris flies backward; the rock drifts forward a little.
TEXT: Hit it with a spacecraft. The splash of rock flying off pushes even harder than the hit.
### BEGINNER
The simplest real method: crash a spacecraft into the asteroid at high speed. NASA did it in 2022 (DART) and shortened a small moon's orbit around its parent by 33 minutes. The surprise was how well it worked: the crater's debris flew backward like rocket exhaust and more than tripled the push. That multiplier, called beta, is the single most important number in the game, and you do not know it precisely until after you hit.
### INTERMEDIATE
Push on the asteroid = beta × (spacecraft mass / asteroid mass) × closing speed. DART: 579 kg at 6.1 km/s into 4.3 billion kg; pure momentum would give 0.8 mm/s; the measured result was about 2.7 mm/s, so beta ≈ 3.6 (uncertain between about 2.2 and 4.9 because the asteroid's mass is uncertain). Beta depends on the target: loose rubble throws more debris (beta 2.5 to 5), solid iron less (1.2 to 2). In the game beta is drawn at impact from the type's range and revealed only after your tracking tier's delay, so your second wave is planned under uncertainty, as it would be in reality.
### ADVANCED
```
dv_vec = beta * (m/M) * U * u_hat            u_hat = direction of impactor relative velocity
beta = 1 + p_ejecta / (m * U)                ejecta momentum normalized to impactor momentum
along-track effectiveness: dv_t = dot(dv_vec, v_hat_asteroid)   -> aim head-on or tail-on, not sideways
game beta ranges: rubble U(2.5, 5.0), stony U(2.0, 4.0), iron U(1.2, 2.0), icy U(1.5, 3.5); soft/blunt impactor -> 1.0-1.3
```
Head-on intercepts (impactor retrograde to the asteroid) maximize U and dv but maximize fragmentation risk (D4); the planner shows Q/Q* next to every kinetic option.
### EXPERT
DEMO: LAB_BETA
NOTES: Beta scales weakly with U and with the impactor's size relative to surface boulders (point-source crater scaling, Holsapple and Housen 2012: p_ej ∝ U^(mu_s) with mu_s ≈ 0.4 for rubble). Hera's mass measurement of Dimorphos (late 2026 onward) will narrow DART's beta; China's 2027-2029 mission on a 30 m body will give a second data point with a direct heliocentric orbit change.
MORE: Cheng et al. 2023, Nature, "Momentum transfer from the DART mission kinetic impact on asteroid Dimorphos"; Thomas et al. 2023, Nature; Holsapple and Housen 2012, Icarus; Daly et al. 2023 on Dimorphos's mass.

## D4 Don't blow it up: fragmentation
meta: related=[D3,T5,D5,D10]  game=[HAMMER_SWEEP plans, fragment cloud]  tags=[deflection,physics]
### SIMPLE
PICTURE: pic-shotgun  One big rock aimed at Earth; after a blast, a cloud of small rocks still aimed at Earth.
TEXT: Blow it up late and you get a shotgun blast instead of a bullet. Break it early or never.
### BEGINNER
The movie plan, blowing the asteroid apart, mostly makes it worse: the pieces keep going the same way, and now they are spread over a wider area with the same total energy. There are two exceptions. If you break it up years early, the pieces drift apart far enough that most miss. And if the pieces are all small (under about 25 m), the atmosphere burns them up. The game lets you try the "hammer" plan, but shows you the fragment cloud, and you will see the shotgun problem yourself.
### INTERMEDIATE
Whether a hit shatters the body depends on the energy per kilogram delivered versus the body's "disruption threshold" Q*, which is lowest (a few hundred joules per kilogram) for bodies a few hundred meters across. A 1 tonne impactor at 10 km/s on a 200 m stony rock delivers about 4 J/kg: a crater, no breakup. A 20 tonne hammer at 30 km/s on a 60 m rubble pile delivers about 60,000 J/kg: it shatters. The fragments fly apart at only about the body's escape speed, 0.1 to 1 m/s; over two years that spreads them across about 15 Earth radii, so most miss; over two months, about one Earth radius, so most hit.
### ADVANCED
```
Q = 0.5 * m * U^2 / M                                       specific energy delivered, J/kg
Q*_D = (Q0 * R_cm^a + B * rho_cgs * R_cm^b) * 1e-4 * strength_mult    Benz and Asphaug 1999 (basalt 5 km/s: Q0 9.0e7, a -0.36, B 0.5, b 1.36)
if Q >= Q*:  f_LR = clamp(1 - 0.5*Q/Q*, 0.02, 0.5);  N_frag 8..40 with Pareto masses;  v_ej ~ Rayleigh(k_ej * v_esc * sqrt(Q/Q*))
cloud footprint after T:  ~ 3 * v_ej * T;   hit fraction ~ min(1, 2*b_crit / (3*v_ej*T))  (x 3-D correction)
```
Minimum of Q* near R ≈ 100-300 m: strength regime below, gravity regime above (T5).
### EXPERT
DEMO: LAB_FRAGMENT_CLOUD
NOTES: The largest-remnant relation is from Leinhardt and Stewart 2012. Real fragment clouds are 3-D and self-gravitating; some re-accumulate into a new rubble pile over days to weeks (Michel et al. 2001), which the game ignores. The "all fragments < 25 m" terminal strategy is Lubin's PI concept (D10).
MORE: Benz and Asphaug 1999, Icarus; Leinhardt and Stewart 2012, ApJ; Michel, Benz and Richardson 2001 on gravitational reaccumulation; Ahrens and Harris 1992.

## D5 Nuclear options
meta: related=[D4,D3,D2,F10]  game=[NUKE_STANDOFF, NUKE_DISRUPT, HAIV]  tags=[deflection,proposed]
### SIMPLE
PICTURE: pic-standoff  A burst of light beside a rock (not touching it); one face of the rock boils off as vapor, pushing it the other way.
TEXT: Explode near it, not on it. The heated face boils off and pushes the rock away, like a rocket.
### BEGINNER
A nuclear device detonated a few hundred meters off the surface floods one face with X-rays, vaporizing a thin layer that blasts outward and shoves the asteroid the other way. No crater, no shattering if done right, and far more push than any spacecraft could carry as momentum. It has never been done in space, but the physics was tested in a lab in 2024 using an X-ray machine on tiny mock asteroids. Detonating on or under the surface instead shatters the body, which is the "disrupt then sweep" plan with all its risks. Treaties currently forbid nuclear weapons in space, so the game charges a political price.
### INTERMEDIATE
Energy scale: a 1 megaton device holds 4.2e15 J, about the kinetic energy of DART times 400,000. Only the fraction that reaches the asteroid (a few percent to 20 percent, set by the standoff distance) and couples into vaporized rock matters. A 1 Mt standoff on a 1 km stony body gives a few centimeters per second of push: at 10 years out that is a comfortable miss, at 2 years a marginal one. The same device buried in a 300 m body shatters it into a cloud, which only helps if you have years for the cloud to spread.
### ADVANCED
```
Standoff at height H:  f_omega = (1 - sqrt(1 - (R/(R+H))^2)) / 2       intercepted fraction of isotropic yield
E_abs = eps_couple * f_omega * Y,   eps_couple ≈ 0.3  [knob]
dp = C_m * E_abs,  C_m ≈ 3e-4 N s/J  [knob, calibrated so 1 Mt on 1 km stony gives a few cm/s];  dv = dp / M
Q_nuc = E_abs / M -> disruption check (D4).  Surface burst: f_omega 0.5, eps 0.5.  Subsurface: f_omega 1.0, eps 0.9.
```
Delivery is an intercept like any other, but a standoff burst needs a fuze that works at the closing speed, so the game limits standoff to U <= 5 km/s (tier 1) or 20 km/s (tier 2). HAIV (leader impactor opens a crater, follower device detonates in it) buys subsurface coupling at high U.
### EXPERT
DEMO: LAB_NUKE_STANDOFF
NOTES: X-ray deposition depth in rock is microns to millimeters; the ablation pressure and the resulting momentum coupling have been modeled with radiation-hydrodynamics codes (LLNL, LANL, Sandia) and measured on the Sandia Z machine (Moore et al. 2024). The game's C_m knob is a stand-in for those simulations; its calibration target is the NRC 2010 order of magnitude.
MORE: Moore et al. 2024, Nature Physics; Bruck Syal, Dearborn and Schultz 2013, Acta Astronautica; NRC "Defending Planet Earth" 2010, ch. 5; Barbee et al. 2018 (HAMMER); Wie 2013 (HAIV).

## D6 The slow push family
meta: related=[D1,D2,D7,T5]  game=[SLOW_PUSH plans, NET_TOW]  tags=[deflection,proposed]
### SIMPLE
PICTURE: pic-slowpush  Four tiny spacecraft near a rock: one just hovering (gravity), one blowing a beam, one shining a laser, one throwing stones off the rock.
TEXT: Push gently for years: hover and tug, blow on it, cook it with a laser, or throw its rocks off.
### BEGINNER
If you have decades, you do not need to hit anything. A heavy spacecraft hovering nearby tugs the asteroid with its gravity alone (the gravity tractor). An ion engine pointed at the asteroid pushes it with exhaust (the ion beam shepherd). A laser or a mirror boils rock off one side (ablation). A robot could even mine the surface and fling the rubble away (a mass driver). All are gentle, controllable, and slow: millimeters per second per year. They shine for small bodies, for fine-tuning after a big push, and for herding fragments.
### INTERMEDIATE
Typical numbers for a 100 m body (about 1.4 billion kg): a 20 tonne gravity tractor hovering 150 m from the center pulls with about 80 millinewtons, giving about 1.9 mm/s per year; a 0.5 N ion beam gives 11 mm/s per year; a 200 kW laser (coupling 30 micronewtons per watt) gives 6 N and 0.13 m/s per year. For a 1 km body divide all of those by a thousand. Every slow-push mission first has to rendezvous (match the asteroid's velocity), which costs as much fuel as the deflection itself, so sails and ion propulsion matter here.
### ADVANCED
```
Gravity tractor:   a = G*m_sc/d^2,  d >= 1.5 R;  hover thrust F = 1.3*m_sc*G*M/d^2 (canted);  dv = a * tau
Ion beam shepherd: a = F_beam/M,  F_beam 0.1-2 N,  propellant m_dot = F/(Isp*g0), Isp ≈ 3000 s
Laser ablation:    F = C_m,laser * P_opt,  C_m ≈ 3e-5 N/W [knob],  P 50 kW - 1 MW
Solar concentrator: P_conc = 0.6 * 1361 * A_mirror;  F ≈ 1e-4 * P_conc [knob];  dust fouling -10%/month
Mass driver:       F = m_dot * v_e,  m_dot 0.1-10 kg/s at v_e 500 m/s;  power = 0.5*m_dot*v_e^2
Tugboat (attach):  a = eta_spin * F/M,  eta_spin 0.3 unless despun
Continuous push for tau then coast T_rem:  miss ≈ 3 * a * tau * (T_rem + tau/2)
```
Net result in the game: slow push is the precision tool, not the sledgehammer, and the readouts say so.
### EXPERT
DEMO: LAB_TRACTOR
NOTES: Gravity tractor: Lu and Love 2005. Enhanced gravity tractor (pick up a boulder to add mass) was part of NASA's cancelled ARM. Ion beam shepherd: Bombardelli and Peláez 2011. Laser ablation: Phipps (ground) and Lubin's DE-STAR family (space); Vasile's "mirror bees" for concentrators. The tether-ballast and electrostatic-tractor concepts are in the game catalog with their honest (tiny) numbers.
MORE: Lu and Love 2005, Nature; Bombardelli and Peláez 2011, JGCD; Thiry and Vasile 2016 (comparison); Lubin et al. 2016 (DE-STARLITE).

## D7 Solar sails: free speed from sunlight
meta: related=[D6,O13,D8]  game=[SAIL_KINETIC plans, sail tiers]  tags=[propulsion,real]
### SIMPLE
PICTURE: pic-sail  A big square mirror sail tilted to the Sun; light arrows bounce off; a tiny thrust arrow results.
TEXT: Sunlight pushes. A huge thin mirror catches enough to speed up, slowly, forever.
### BEGINNER
Light carries momentum; a square kilometer of perfect mirror at Earth's distance feels about nine newtons, roughly the weight of a liter of water. Tiny, but it never runs out. Tilt the sail and you can spiral outward or inward, building up kilometers per second over a year. Japan's IKAROS (2010) and the Planetary Society's LightSail 2 (2019) flew real sails. In the game a sail turns a small impactor into a very fast one, which multiplies its punch, at the cost of time.
### INTERMEDIATE
Sunlight pressure at 1 AU is 4.5 micronewtons per square meter (9 if the sail reflects perfectly). What matters is sail loading: mass per square meter. At 10 grams per square meter the sail accelerates at 0.8 mm/s², which sounds like nothing until you multiply by a year: up to 10 km/s of velocity change. The best angle for spiraling is about 35 degrees off the Sun line. A sail cannot push toward the Sun, but by tilting the other way it can shed speed and fall inward.
### ADVANCED
```
sigma = m_total / A_sail;   a_c = 2 * eta * P_rad / sigma,  P_rad = 4.54e-6 N/m^2 at 1 AU, eta ≈ 0.9
a_sail = a_c * (AU/r)^2 * cos^2(alpha) * n_hat;  tangential a_t = a_c (AU/r)^2 cos^2(alpha) sin(alpha), max at 35.26 deg (0.385 a_c)
lightness number beta_s = a_c / (mu_sun / AU^2) = a_c / 5.93e-3
tiers: 100 g/m^2 (0.08 mm/s^2, near-term), 25 (0.33), 10 (0.82), 3 (2.7, graphene; SCI-FI)
```
Integrated with RK4 in 6-hour steps; the sail is dropped before impact so the bus mass is what hits.
### EXPERT
DEMO: LAB_SAIL_SPIRAL
NOTES: Flown sails are far heavier than the game's tiers: IKAROS 196 m² at 315 kg (1.6 kg/m²), LightSail 2 32 m² at 5 kg, NASA's ACS3 (2024) 80 m². The 10 g/m² tier assumes CP1 or thinner films with boomless spin deployment; graphene sails are laboratory material only. Locally optimal steering laws (maximize da/dt) are in McInnes.
MORE: McInnes, "Solar Sailing" (Springer); Planetary Society LightSail reports; JAXA IKAROS results (Tsuda et al. 2011).

## D8 Rockets: delta-v, Isp, C3
meta: related=[O8,O10,D7]  game=[launcher tiers, stage upgrades]  tags=[propulsion]
### SIMPLE
PICTURE: pic-rocket-eq  A rocket shrinking as it burns fuel; a staircase of speed gained with each stage.
TEXT: Rockets throw fuel backward to go forward. Most of a rocket is fuel.
### BEGINNER
A rocket speeds up by throwing exhaust backward. The faster the exhaust and the more of the rocket is fuel, the more speed it gains. The cruel part is the math: to double your speed gain you need to square your fuel ratio, which is why rockets are 90 percent propellant and why every extra kilometer per second a mission needs cuts the payload sharply. The game shows this as a launcher table: more launch energy, less mass delivered.
### INTERMEDIATE
Specific impulse (Isp) is exhaust efficiency, in seconds: chemical rockets about 320 (kerosene) to 450 (hydrogen); ion engines 3,000 but with thrust measured in tenths of a newton. The rocket equation says speed gained = Isp × 9.81 × ln(full mass / empty mass). A chemical stage that is 80 percent fuel gains 320 × 9.81 × ln(5) ≈ 5 km/s. C3 is the launch energy toward the target (the square of the leftover speed after escaping Earth); a Falcon Heavy-class rocket sends about 16 tonnes to C3 = 0 and only a couple of tonnes to C3 = 60 km²/s².
### ADVANCED
```
dv = Isp * g0 * ln(m0 / mf)                     Tsiolkovsky
C3 = v_inf_departure^2 = |v1 - v_Earth(t_L)|^2     km^2/s^2;  Hohmann to Mars: C3 ≈ 8.6
launcher table (game): Tier 2  C3 0: 16 t, 20: 9 t, 40: 4.5 t, 60: 2 t, 90: 0.7 t  (interpolate in log mass)
Oberth effect: burning deep in a gravity well gains more energy per unit dv; the game folds it into C3 at launch
```
### EXPERT
DEMO: LAB_ROCKET_EQ
NOTES: Ion stages in the game are integrated continuously (a = F/m with m decreasing); chemical kicks are impulsive. Nuclear-electric tugs (SCI-FI) assume 1 MW class power; nothing like that has flown.
MORE: Sutton and Biblarz, "Rocket Propulsion Elements"; JPL "Basics of Space Flight"; NASA Launch Services performance website (real payload-vs-C3 curves).

## D9 Yarkovsky and YORP: the real tiny forces
meta: related=[D6,F8,T5]  game=[codex NOT VIABLE entry]  tags=[physics]
### SIMPLE
PICTURE: pic-yarkovsky  A spinning rock with a warm afternoon side glowing; a tiny arrow of thrust from the glow.
TEXT: A rock's warm side glows heat, which pushes it a tiny bit. Over centuries, it adds up.
### BEGINNER
Sunlight warms an asteroid; the warm side radiates heat; radiating heat is a (very) small push. Because the rock spins, the afternoon side is warmest, so the push is slightly sideways and slowly changes the orbit. This is the Yarkovsky effect, and it is real: Bennu's orbit drifts by about 280 meters per year because of it. The cousin effect, YORP, slowly changes the spin. Both matter for predicting impacts centuries out; neither can be used to deflect anything on a human schedule. The game lists them honestly as NOT VIABLE.
### INTERMEDIATE
Painting one side of an asteroid to change its heat radiation has been proposed as a deflection "method." The numbers: for a 1 km body the orbit drifts about 1e-4 AU per million years, which is about 300 meters over the 10 years a game round lasts. Compared with the thousands of kilometers needed, it is useless, but over a century of advance knowledge it could change whether a keyhole is hit. The game computes the number and shows it so the comparison is on screen.
### ADVANCED
```
da/dt (diurnal Yarkovsky) ∝ (1/D) * cos(obliquity) * f(thermal inertia, spin)   ~ 1e-4 AU/Myr for D ≈ 1 km, ∝ 1/D
Bennu measured: da/dt ≈ -284 m/yr (OSIRIS-REx, Farnocchia et al. 2021)
YORP: spin-rate change ∝ 1/D^2; measured on 54509 YORP, Bennu, Itokawa
```
### EXPERT
DEMO: none
NOTES: Yarkovsky is the dominant uncertainty in century-scale impact predictions (it is why Bennu's 2182 probability needed OSIRIS-REx tracking data to pin down). Sentry-II includes it as a fitted parameter when the arc is long enough.
MORE: Vokrouhlický et al. in Asteroids IV; Farnocchia et al. 2021, Icarus (Bennu); Bottke et al. 2006, Annual Review.

## D10 Last resorts: evacuation and shredding
meta: related=[D4,F10,T2]  game=[EVACUATE action, PI]  tags=[civil defense]
### SIMPLE
PICTURE: pic-evacuate  A map with a shaded stripe (where it could land) and arrows of people leaving it.
TEXT: If there is no time to move the rock, move the people.
### BEGINNER
If a city-size rock is found weeks out, no spacecraft can be built, flown, and arrive in time. The real plan for that case is civil defense: compute the strip of ground where it could land, evacuate it, and get people away from windows everywhere else. Governments rehearse exactly this in planetary defense exercises. In the game, EVACUATE is always available and turns a small hit from "run over" into a survivable, lower-scoring round.
### INTERMEDIATE
A newer idea for the very last days is to shred a small threat (under about 100 m) into pieces smaller than about 10 m using an array of penetrator rods, so the atmosphere does the rest: many high airbursts instead of one ground impact. It is a published concept (Lubin's "PI"), untested, and it only works for small, weak bodies. The game offers it as a terminal option down to 12 hours before impact with damage reduced to a few percent of the intact case, and tags it PROPOSED.
### ADVANCED
```
Impact corridor (game): the along-track uncertainty sigma_b projected onto the planet's limb; drawn in the planet view
Damage multipliers with evacuation: AIRBURST 0.3, CITY 0.4, REGIONAL 0.7, GLOBAL 1.0;  CIVIL_DEFENSE_READY: x0.7 again
PI terminal: allowed for D < 100 m, T >= 12 h; fragments < 10 m; damage = 0.05 * E_threat
```
### EXPERT
DEMO: none
NOTES: Real corridor prediction uses the b-plane covariance mapped through the atmosphere entry model to a ground strip tens of kilometers wide and hundreds long (as done for 2008 TC3 and 2024 BX1 within hours). FEMA-NASA tabletop exercises (2013-2024) are public and make good reading.
MORE: Lubin and Cohen 2021, arXiv, "PI: Terminal Planetary Defense"; NASA/FEMA Planetary Defense Interagency Tabletop Exercise reports; Rumpf et al. 2017 on asteroid impact risk to populations.

## D11 The catalog and the chart: which method, when
meta: related=[D2,D3,D5,D6,G3]  game=[codex, planner categories]  tags=[strategy]
### SIMPLE
PICTURE: pic-decision-chart  A grid: rock size up the side, years of warning along the bottom; zones labeled nudge, hit, nuke, run.
TEXT: Small rock, lots of time: nudge. Big rock, little time: nuclear. No time: run.
### BEGINNER
Every method has a home territory. Gentle pushes (tractors, beams, lasers) work for small rocks with decades of warning. Kinetic impactors cover the middle: up to a few hundred meters with a decade. Nuclear standoff reaches the kilometer class or shortens the needed warning. Nothing works for a big rock with under a year, except moving the people. The game's codex tags every method REAL, PROPOSED, SPECULATIVE or FICTION, and the planner ranks only the ones that fit this round.
### INTERMEDIATE
Rules of thumb from the 2010 National Research Council chart: kinetic impactors, roughly 100 m to 500 m with 5 to 20 years; slow push, below 150 m with 20+ years; nuclear standoff, 500 m to 2 km, or anything with 2 to 10 years; nuclear disruption only as a last resort with enough years for the cloud to spread; civil defense for anything under 1 year. The game's balance targets (GAME_PLAN.md Section 17) were chosen to reproduce exactly those regions.
### ADVANCED
Game method catalog, status tags and the physics model behind each (GAME_PLAN.md Section 20):

```
REAL         kinetic impactor (6.9), precursor cratering probe, civil defense (18.6), nuclear standoff physics (6.11, lab-verified)
PROPOSED     nuclear surface/subsurface, HAIV, HAMMER, pulse train, gravity tractor (+enhanced), ion beam shepherd, laser ablation,
             ground laser, solar concentrator, mass driver, tugboat, tether ballast, electrostatic tractor, magnetic tractor,
             Yarkovsky paint, attached sail, electric/magnetic sail, PI shredding, capture bag, conventional explosives, dust cloud
SPECULATIVE  CNT capture net + tug, graphene sails, DE-STAR orbital laser, nuclear pulse tug, fusion tug, antimatter standoff,
             lunar mass-driver launcher, pre-accelerated sail swarm, asteroid billiards, disassembler swarm, arcology civil defense
FICTION      teleport, quantum observe, rewind, edit G, delete, noclip, tractor beam, singularity, wormhole, diplomacy, drill crew,
             planet thrusters, shield, shrink, summon devs, multiverse
```
### EXPERT
DEMO: none
NOTES: Thiry and Vasile 2016 ran thousands of virtual scenarios comparing kinetic, laser and ion-beam methods with realistic spacecraft sizing; their conclusion, that no single method covers the threat space, is the reason the game makes you build a portfolio.
MORE: NRC 2010 "Defending Planet Earth" (free PDF, National Academies Press); Thiry and Vasile 2016; the SMPAG "Mitigation Techniques" fact sheets.

## D12 Autonomy: letting the spacecraft decide
meta: related=[D4,G3,C1]  game=[autonomy tiers, rules editor]  tags=[strategy,software]
### SIMPLE
PICTURE: pic-autonomy  Three in-flight probes; the rock has just split; dashed lines re-aim each probe at a different piece.
TEXT: Light takes minutes to reach the probe. Sometimes it has to choose its own target.
### BEGINNER
After your first impactor hits, you learn how the rock responded: how hard it was pushed, whether it broke. By then your second wave may already be flying, and radio signals take minutes each way. So the spacecraft needs instructions for what to do if things change: "if it breaks into pieces, go for the biggest piece that is still going to hit." The game lets you write those rules, and later gives your probes onboard smarts to re-plan themselves.
### INTERMEDIATE
Tiers in the game: fixed targeting; if-then rules you write (evaluated at events like FRAGMENTATION or BETA_ASSESSED); onboard re-planning (the probe re-solves its own transfer to the best fragment within its remaining fuel); and swarm coordination (all probes assigned to fragments together, most dangerous first). DART itself used autonomous terminal guidance for its last four hours because the target was too small to steer from Earth. The hard part the game makes you feel: you commit fuel and timing before you know what the rock will do.
### ADVANCED
```
Rule DSL (JSON): { when: EVENT, if: {metric: {op: value}}, do: ACTION, target: EXPR, budget: EXPR }
Tier 2: at event time t_e, for each in-flight impactor with residual dv, solve Lambert(r_sc(t_e), r_frag(t_A)) for candidate
        fragments; pick max(P_hit * mass) with required dv <= residual
Tier 3: greedy assignment (or Hungarian for N <= 12) of impactors to fragments by expected averted energy
```
### EXPERT
DEMO: none
NOTES: Real autonomous navigation on DART (SMART Nav) selected and locked onto Dimorphos by image processing; Hera and China's 2027 mission extend this. The assignment problem is the same math as job scheduling; the game's greedy solver is within a few percent of optimal for small swarms.
MORE: Rivkin et al. 2021, PSJ (DART mission overview); Chen et al. 2018 on SMART Nav; Kuhn 1955 (the Hungarian method) if you want the optimal assignment.

---

# G. THE GAME

## D13 Wild ideas that might work someday
meta: related=[D6,D10,D3,G6]  game=[SCI-FI programs, CODEX SPECULATIVE tier]  tags=[speculative,sci-fi]
### SIMPLE
PICTURE: pic-wild-ideas  A rock covered in tiny machines with a jet of dust streaming off one side, and a small rock being steered toward it.
TEXT: Tiny machines could grow on a rock and turn it into its own rocket.
### BEGINNER
Some defenses are not possible today but break no laws of physics, only the limits of our factories. Picture seeds no bigger than sand grains that land on an asteroid, copy themselves from its own dust, and build a machine that throws that dust away, so the rock pushes itself off course. Or hundreds of small thrusters that land, link up, and push together. Or a standing fleet that keeps a few small captured rocks parked in space, ready to throw at anything dangerous. In SCI-FI mode the game lets you fund these, labelled SPECULATIVE: unproven, but maybe someday.
### INTERMEDIATE
The self-replicating forge turns the threat into its own propellant. Suppose the forge throws 40 kg of regolith every second at 900 m/s. The push is F = mdot x v_e = 40 x 900 = 36,000 newtons, about the thrust of a small jet engine, and it never needs fuel from Earth. On a 2e10 kg rock (a 250 m stony body) that is an acceleration of 1.8e-6 m/s^2; after a year of pushing the rock has changed speed by about 57 m/s, thousands of times what a single DART-style impact gives. The catch is the growth time and that nobody has built a machine that copies itself from raw rock.
### ADVANCED
```
NANOFORGE (game):   growth delay NANOFORGE_GROW_DAYS (240 d), then F = mdot v_e = 40 kg/s x 900 m/s = 3.6e4 N
THRUSTER SWARM:     F = eta_spin N F_unit = 0.6 x 600 x 25 N = 9.0e3 N, after a 200 d transit
SHEPHERD NETWORK:   dv = beta m_rock U / M = 2 x 2e7 kg x 12 km/s / M, once per threat, 150 d after discovery
FUSION TUG FLEET:   F = 5e4 N continuous after a 1 yr transit
SEED FLEET:         arrives after 1 yr, doubles every 1.5 yr; strike k throws 2^k shepherd rocks (max 16)
All are knobs in src/config/knobs.ts and act through the resolver's standing-push routine (integratePush).
```
The physics is ordinary rocketry and momentum; only the machines are imaginary. The rocket equation still rules the forge: the rock loses mass as it throws regolith, so dv = v_e ln(M0 / M1) caps what a given fraction of the body can buy.
### EXPERT
DEMO: none
NOTES: The standing pushes are in src/sim/resolver.ts (search "standing"); the programs in src/config/programs.json; their cinematics in src/render/cinematics/draw.ts (drawPushScene). Self-replication: von Neumann's universal constructor (1966) and the NASA 1980 summer study on a self-replicating lunar factory are the classic starting points. Mass drivers on asteroids: O'Neill's 1970s work. Gravitational and kinetic shepherding of small bodies: asteroid retrieval studies (Keck Institute 2012, NASA ARM 2013-2017).
MORE: Freitas and Merkle 2004, "Kinematic Self-Replicating Machines" (free online); NASA CP-2255 (1982), "Advanced Automation for Space Missions"; Keck Institute for Space Studies 2012, "Asteroid Retrieval Feasibility Study" (free PDF).

## G1 How to play
meta: related=[G2,G3,G4,D2]  game=[TUTORIAL menu item, first run]  tags=[tutorial]
### SIMPLE
PICTURE: pic-howto  Four panels: see the rock, pick a plan, press go, watch it miss.
TEXT: See the rock. Pick a plan. Speed up time. Make it miss. Then a bigger rock comes.
### BEGINNER
A rock is coming, years out. Read the threat brief (size, type, years left, odds). Open the planner, look at the ranked plans, and commit one or more missions. Run the clock, fast or slow, and watch them fly, hit, and (you hope) push the rock off course. The debrief tells you what happened and why. Spend research on new tech, fund long-term programs, and the next round brings a harder rock. If one hits, the run ends and your score goes on the board.
### INTERMEDIATE
The loop has two investments: missions for this threat and programs for every future threat. A good first-round habit: commit a single kinetic impactor early (it is cheap and the lead time does the work), then start funding a survey program with what is left, because round 5's threat may come from the sunward blind spot. Watch three numbers: years remaining (your lever), U (closing speed: punch and breakup risk), and P(MISS) (what the Monte Carlo thinks). Pause any time to add missions; the clock is yours.
### ADVANCED
Tutorial script (level-aware; each step opens the named lore entry in the side panel):

```
STEP 1  THREAT BRIEF      read size, type, T-minus, P(IMPACT), Torino            -> T2, F9
STEP 2  SYSTEM VIEW       pan, zoom, warp 1 day/s -> 1 month/s, watch the ghost markers at t_impact   -> G2, O6
STEP 3  PLANNER           open; see the porkchop; hover a cell; read C3 and U      -> O10, G3
STEP 4  COMMIT            pick the top KINETIC plan; note MISS EST and P(MISS)      -> D3, D2
STEP 5  LAUNCH + FLIGHT   warp to launch; follow the trail; pause at the halfway event   -> O8
STEP 6  IMPACT            watch the impact event; beta is drawn and hidden; note the reveal timer   -> D3, O5
STEP 7  CLOSE APPROACH    planet view; the b_crit ring; MISS 3.8 R                  -> O12
STEP 8  DEBRIEF           score, research, the counterfactual line; open PROGRAMS and fund one   -> G5, G4
then:   ROUND 1 begins for real (the tutorial is a fixed-seed 100 m stony threat with 10 years)
```
### EXPERT
DEMO: none
NOTES: The tutorial round is seed `TUTORIAL-1`, excluded from leaderboards. The DART cheat replays the real geometry as a second tutorial for people who want to check the numbers against the papers.
MORE: GAME_PLAN.md Sections 3 and 13.

## G2 Screens, HUD and controls
meta: related=[G1,G3,G8]  game=[every screen]  tags=[ui]
### SIMPLE
PICTURE: pic-hud  The system view with callouts: clock, budget, round, warp buttons, brain button.
TEXT: Top bar: time left, money, round. Right: warp speed. Brain button: learn.
### BEGINNER
System view is home: the star, orbits, planets, the threat and its predicted path, your spacecraft with trails. Planet view zooms to your world and the approach. Planner, Tech, Programs, Debrief, Leaderboard, Codex and the Learning Center are the other screens. The HUD always shows T-MINUS (years and days), BUDGET, ROUND, P(IMPACT), and the warp controls. Space pauses. The `?` key or a click on anything opens its lore panel.
### INTERMEDIATE
Keys: space pause; `[` and `]` slower and faster warp; R resolve now; P planner; T tech; G programs; C codex; L learning center; `~` console; 1-6 views; Esc back. Mouse and touch: drag to pan, wheel or pinch to zoom, click a body for a readout card. The scale toggle switches between true distances and a compressed view (radial square root) so the giant planet fits on screen while the inner system stays readable. The replay scrubber in the debrief lets you drag through the whole round at any speed.
### ADVANCED
HUD readouts and their sources: T-MINUS from `t_impact - t`; P(IMPACT) from `uncertainty.ts` (F8); MISS from `closeApproach.ts` (O12); U, C3 from the planner's selected cell (O10); BETA (hidden until assessed) from `kinetic.ts`. Everything on screen is a pure function of the world state, so pausing and scrubbing never desynchronizes anything.
### EXPERT
DEMO: none
NOTES: Rendering is DPR-aware vector line art on Canvas 2D (an optional WebGL2 post-processing pass adds bloom in HOLO mode). Text is a stroke font so it scales like everything else.
MORE: GAME_PLAN.md Section 13 and 24.

## G3 Reading the planner
meta: related=[O10,D2,D3,D4,O14]  game=[planner screen]  tags=[ui,strategy]
### SIMPLE
PICTURE: pic-planner  A list of plans with bars; one highlighted; a map of launch days beside it.
TEXT: The planner ranks plans and shows its math. Longer bar, better plan.
### BEGINNER
The planner lists every plan your tech allows, ranked. Each line shows the mission type, when it launches, when it hits, how hard, the predicted miss, the chance of success, and the cost. Click one to see the readout with the actual numbers. Green means clean deflection; amber means it will break the rock (and the planner then shows the fragment picture); violet means a slow push. Commit the one you believe in, or two if you can afford a backup.
### INTERMEDIATE
Readout line by line: LAUNCH (date and C3: the launcher must reach that C3 with that payload); IMPACT (date and U: closing speed; Q/Q* tells you how close to breakup: under 1 is a crater, over 1 shatters); PUSH (dv with the beta range in brackets, the planner's instant estimate MISS EST = 3 dv T, and P(MISS) from 200 Monte Carlo runs); COST versus budget. The score bar weighs P(MISS) most, then residual damage, cost, margin, and a small penalty for warheads. The porkchop plot shows C3 and U across launch and arrival dates; the planner picks the best few cells per plan type, but EXPERT toggle lets you pick a cell by hand.
### ADVANCED
```
S = w_miss*P_miss - w_res*E_res/E_threat - w_cost*cost/budget + w_margin*clamp(margin/3,0,1) - w_nuke*[warhead]
defaults: 1.0, 0.6, 0.25, 0.15, 0.1     (GAME_PLAN.md 7.3)
P_miss: 200 samples over beta, sigma_v, fragment draws;  SE ≈ sqrt(p(1-p)/200)
Categories: DEFLECT (clean) / DISRUPT+SWEEP / SLOW PUSH / TOW
```
### EXPERT
DEMO: LAB_LAMBERT_PORKCHOP
NOTES: The planner never hides a method's tag (REAL/PROPOSED/...) and prints the formula path on demand (the "SHOW WORK" button opens the matching lore topic at ADVANCED with the live numbers substituted).
MORE: GAME_PLAN.md Section 7.

## G4 Programs: investing in lead time
meta: related=[F7,D2,G5]  game=[PROGRAMS screen]  tags=[strategy]
### SIMPLE
PICTURE: pic-programs  Progress bars for telescopes and radar filling up over years while rounds go by.
TEXT: Build telescopes and radar in the background. They take years. They pay forever.
### BEGINNER
Programs are long projects that outlast any single rock: a space telescope, a sunward sentinel, a radar network, a stockpile of ready impactors. You set how much of your yearly budget goes to each; they take years; when done they permanently change what you can see and how fast you can respond. The temptation is to spend everything on the rock in front of you. The game is designed so that, sooner or later, that loses.
### INTERMEDIATE
Each program lists its real-world basis and tag. Early, cheap, high-value: INTL_COORDINATION (more budget), GROUND_SURVEY_EXPANSION and SPACE_IR_SURVEYOR (lead time), RADAR_NET (confidence), INTERCEPTOR_STOCKPILE (build time). Mid-game: SUNWARD_SENTINEL (the one that saves you from a Chelyabinsk), PRECURSOR_FLEET (know beta before you commit), HEAVY_LAUNCH_CADENCE. Late: ORBITAL_DEPOT, L4_L5_SENTINELS, VENUS_ORBIT_IR. SCI-FI mode adds the laser array, the lunar mass driver, fusion tugs and the disassembler swarm.
### ADVANCED
```
progress += funding_fraction * dt / (years * YEAR);  cost drawn continuously at costPerYear * funding_fraction
effects applied when progress >= 1.0: network params (18.1), build times, launch caps, budget, sigma_v, damage multipliers
```
Civilization level 1 is reached when every REALISTIC program is complete; level 2 when every SPECULATIVE one is.
### EXPERT
DEMO: LAB_SUNWARD
NOTES: The debrief's counterfactual line is computed by re-running the discovery search with each unfinished program marked complete, and reporting the one that would have added the most lead time.
MORE: GAME_PLAN.md Section 19.

## G5 Scoring and the leaderboard
meta: related=[G4,G6,O14]  game=[debrief, leaderboard]  tags=[rules]
### SIMPLE
PICTURE: pic-score  A scoreboard: rounds survived, score, a star for no fragments, a little nuke icon crossed out.
TEXT: Survive rounds, score points. Clean, cheap, early misses score more.
### BEGINNER
Each round scores by how big the threat was, how cleanly you beat it, how little budget you spent, and how early you resolved it. Bonuses for no warheads, no fragments, and capturing a rock. A hit ends the run; your total goes on the leaderboard with your handle, rounds survived, and the seed, so anyone can replay your exact rocks. Cheats mark a run ASSISTED; fiction modes have their own board.
### INTERMEDIATE
Round score = base(threat energy, round number) × outcome (clean 1.0, marginal 0.8, partial 0.35) × (1 + efficiency + timing + style). Partial means fragments hit but did under 10 percent of the original energy. Research earned is score / 50. The daily seed mode gives everyone the same rounds for a fair race.
### ADVANCED
```
round_base  = log10(E_threat_Mt + 1) * 100 * (1 + 0.15*k)
efficiency  = 0.5 * budget_unspent/budget_available;  timing = 0.3 * clamp(years_margin/T_lead, 0, 1)
style       = +0.2 no warhead, +0.2 no fragments, +0.3 net capture
run_score   = sum(round_score);  research = floor(round_score/50)
```
### EXPERT
DEMO: none
NOTES: Scores are reproducible from (seed, mission list) alone; the leaderboard stores both so a replay can verify any entry locally.
MORE: GAME_PLAN.md Section 12.

## G6 Modes, civilization levels and cheat codes
meta: related=[D11,G5,G7]  game=[console, options]  tags=[rules]
### SIMPLE
PICTURE: pic-modes  Four nested boxes: REALISTIC inside SCI-FI inside SIMULATION inside MULTIVERSE.
TEXT: Real science first. Then science fiction. Then you find the console. Then there are many worlds.
### BEGINNER
REALISTIC is the game: only real and seriously proposed methods. SCI-FI (unlocked by finishing every real program, or by a code) adds things that obey physics but need technology we do not have: fusion tugs, orbital laser arrays, nanotube nets. SIMULATION, unlocked only from inside SCI-FI, hands you the console: teleport the rock, rewind time, edit gravity; each command tells you exactly why it is impossible before doing it anyway. MULTIVERSE forks the round into many parallel worlds you play at once.
### INTERMEDIATE
Codes (title screen or `~`): KARDASHEV1 and KARDASHEV2 jump civilization levels; SCIFI, SIMULATION, MULTIVERSE enter modes in order; REVEAL shows hidden truths; FASTBUILD, GODTRACK, LEADTIME n adjust difficulty; SPAWN name loads a real scenario (CHELYABINSK, TUNGUSKA, YR4, APOPHIS, BENNU, DIDYMOS, CHICXULUB); DART replays the real mission. Every code marks the run ASSISTED. Fiction commands are refused outside SIMULATION with a one-line reason.
### ADVANCED
Mode gating lives in `game/modes.ts`; the method catalog's `mode` field decides what the planner will even enumerate. The FICTION commands each carry a `forbidden_by` string with a computed quantity (for example the energy to move the planet: `0.5 * 6e24 * dv^2`), so the joke is also a calculation.
### EXPERT
DEMO: none
NOTES: Multiverse branches are plain copies of the world with independent RNG streams; the resolver's purity is what makes this a feature instead of a rewrite.
MORE: GAME_PLAN.md Sections 20.4, 21, 22.

## G7 Under the hood: what is real and what is simplified
meta: related=[O9,O11,O13,O14,C1]  game=[codex]  tags=[honesty]
### SIMPLE
PICTURE: pic-under-hood  A flat solar system drawn as a disk; a small note "flat, Sun-only gravity, real formulas".
TEXT: Real formulas, flat solar system, only the Sun's gravity. Good enough to be honest.
### BEGINNER
The game uses the real equations for orbits, impacts, breakup, sails, flybys and detection. It simplifies in three ways: the solar system is flat (no tilted orbits), only the Sun's gravity acts between events (planets only matter during flybys and at the final approach), and some messy physics (how a crater throws rock, how a nuclear burst couples) is reduced to a single calibrated number. The codex says, for every number, whether it is measured, modeled, or a game knob.
### INTERMEDIATE
What this costs: without inclination, the fragment cloud spreads in one direction only, so the game applies a correction factor; without planetary perturbations, long-term keyholes and resonant returns are not simulated (a stretch goal); without an atmosphere model, airbursts are classified by size. What it buys: every coasting body's position is an exact formula, so time warp and "jump to the end" are free, and every round is perfectly reproducible from its seed.
### ADVANCED
```
Exact:        Kepler propagation (O9), state<->elements (O7), vis-viva (O8), Lambert (O10), flyby rotation (O11), focusing (O12)
Calibrated:   beta ranges (D3), Q* coefficients (D4), C_m for nuclear (D5), C_m for laser (D6), sail efficiency (D7)
Simplified:   2-D plane; Sun-only gravity between events; 1-D along-track uncertainty (F8); IR detection as D_ref scaling (F4);
              phase function linear in alpha (F2); fragment ejection Rayleigh (D4); no atmosphere; no spin
```
### EXPERT
DEMO: none
NOTES: Each simplification is a named assumption in `docs/ASSUMPTIONS.md` with the test that would break if it were removed; that document is the roadmap for a 3-D version.
MORE: GAME_PLAN.md Sections 5, 6, 27.

## G8 The look: phosphor green, neon spectrum, holograms
meta: related=[G2,C4]  game=[OPTIONS color mode]  tags=[design]
### SIMPLE
PICTURE: pic-color-modes  Six small swatches: green on black, amber, ice blue, pink and cyan, violet and acid, dark ink on paper.
TEXT: Starts as old green terminal glow. Earn colors. Pick your own look, even a daytime one.
### BEGINNER
The game opens in PHOSPHOR: green lines on black, the look of 1970s vector arcade machines and radar scopes. After your first clean miss, SPECTRUM unlocks and gives every kind of thing its own neon color: cyan spacecraft, amber threats, magenta fragments, violet programs. Options offer more moods: AMBER, ICE, VAPOR, BLACKLIGHT, HOLO (iridescent, holographic glow), and DAYLIGHT (dark ink on pale paper for bright rooms). Every mode keeps the lines thin and the glow soft, like a hologram drawn in light.
### INTERMEDIATE
Why green: early CRT phosphors (P1) glowed green, and monochrome vector displays like the Asteroids cabinet drew only lines, no fills. The game keeps that rule (lines, glow, no filled shapes) but draws at full resolution and can tilt the system into a 3-D wireframe. Colors are chosen for contrast and for the colorblind: each semantic color is paired with a line style (dashes, markers), so the meaning survives if the hue does not.
### ADVANCED
Palettes (`config/palettes.json`), each with background, ink, dim, hot and the semantic set:

```
PHOSPHOR   bg #000000  ink #33FF33  dim #0B4D0B  hot #B6FFB6
SPECTRUM   + threat #FFB000  danger #FF3B3B  craft #00F0FF  fragments #FF2BD6  programs #9D4EDD  sails #CCFF00  nuclear #FF6A00  text #E6FFE6
AMBER      bg #0A0600  ink #FFB000  dim #4A3000  hot #FFE2A0
ICE        bg #00060C  ink #7DF9FF  dim #0A3A44  hot #E0FFFF
VAPOR      bg #05000A  ink #FF71CE  alt #01CDFE  dim #3A0A3A  hot #FFFFFF   (synthwave)
BLACKLIGHT bg #050008  ink #BF5FFF  alt #CCFF00  dim #2A0A40  hot #F0E0FF
HOLO       bg #02030A  ink: iridescent gradient along each stroke (hue cycles 160 -> 300 deg), bloom, 1 px chromatic offset
DAYLIGHT   bg #F2F5F3  ink #0B3D0B  dim #B8CCB8  hot #000000  no glow, 1.5 px lines
```
Contrast target: text >= 4.5:1 in every mode. Reduce-motion option disables flicker, sweeps and parallax.
### EXPERT
DEMO: none
NOTES: Glow is two passes: a wide low-alpha stroke under a crisp 1-1.25 px stroke; HOLO adds a WebGL2 bloom and a slow hue drift. The wireframe-3-D tilt is a camera pitch applied to the 2-D plane (z = 0 for everything), so it is a projection, not new physics.
MORE: GAME_PLAN.md Section 24.

---

# C. THE CODE (this repo teaches programming too)

## C1 How the game is built
meta: related=[C2,C3,G7]  game=[codex, README]  tags=[code]
### SIMPLE
PICTURE: pic-architecture  Boxes: physics -> sim -> planner -> game -> render; a worker box beside; a Python box mirroring physics.
TEXT: Math at the bottom, pictures at the top. The same math also lives in Python.
### BEGINNER
The game runs in your browser, so its code is TypeScript (JavaScript with types). It is split into layers: physics (pure formulas), sim (the world and events), planner (ranking plans), game (rules, saves, modes), and render (drawing). A separate "worker" thread does the heavy math so the screen never stutters. Beside it sits a Python package with the same physics, used for teaching notebooks and for checking that the two agree.
### INTERMEDIATE
Why two languages: the browser needs JavaScript, and Python is the language most people learn first and the one scientists use. Every physics function exists in both (`src/physics/kepler.ts` and `pymiss/physics/kepler.py`) with the same name and the same test vectors, so a learner can read either. The Python side generates `tests/vectors/*.json`; the TypeScript tests must reproduce them. No frameworks: Vite builds it, vitest and pytest test it, GitHub Actions runs both and publishes the game to GitHub Pages.
### ADVANCED
```
src/physics   pure functions, no DOM; one file per topic; each file header: WHAT / WHY / HOW / LORE: <topic id>
src/sim       World, bodies, missions, resolver (pure: (state, missions, seed) -> event log), detection, programs
src/planner   candidates, porkchop (worker), Monte Carlo (worker), ranking, rules DSL, autonomy
src/game      state machine, economy, tech, scoring, saves (SAVE.md), modes, cheats, multiverse
src/render    canvas, stroke font, glow, palettes, views; optional WebGL2 bloom
src/lore      index loader, LRU cache, panel, learning center, pictures (SVG generators), labs (code-split)
pymiss/       mirror of src/physics + vectors generator + notebooks/ for EXPERT labs
scripts/      build_lore.py (EDUCATION.md -> public/lore/*), gen_vectors.py
```
### EXPERT
DEMO: none
NOTES: The resolver's purity is the architectural keystone: replay, multiverse, Monte Carlo and the counterfactual debrief all reuse it. If a change makes the resolver depend on wall-clock time, DOM state or a global RNG, the determinism test fails.
MORE: GAME_PLAN.md Sections 14 and 26; `docs/CODE_TOUR.md` in the repo.

## C2 Reading the code: a guided path
meta: related=[C1,O9,O10]  game=[Learning Center LABS tab, "SHOW CODE"]  tags=[code,learning]
### SIMPLE
PICTURE: pic-code-path  A trail with numbered stops: constants, Kepler, elements, close approach, Lambert, kinetic.
TEXT: Start with the smallest file. Each one builds on the last.
### BEGINNER
Read in this order, each file is short and commented: `constants.ts` (numbers), `vec.ts` (arrows), `kepler.ts` (where is it now), `elements.ts` (describe an orbit), `closeApproach.ts` (does it hit), `kinetic.ts` (what a hit does), `lambert.ts` (how to get there). Each file starts with a plain-language header and names the lore topic that explains the math. Every EXPERT lab has a SHOW CODE button that opens the real function next to the formula.
### INTERMEDIATE
Each function is written the same way: a doc comment with the formula and units, the inputs validated, the math in the same order as the lore entry, and a test next door with a number you can check by hand. Try this exercise: open `kepler.ts`, change the Newton iteration's stopping tolerance from 1e-12 to 1e-3, run the tests, and watch which ones fail and by how much. Then put it back.
### ADVANCED
Conventions: SI internally; no hidden state; functions return new objects; `[knob]` constants live only in `config/knobs.ts`; every `// NOTE:` comment explains a decision, not what the code does; every simplification links to `docs/ASSUMPTIONS.md`. Python mirrors use NumPy where arrays help and plain floats otherwise, with identical function names in snake_case.
### EXPERT
DEMO: LAB_KEPLER_SOLVER
NOTES: Suggested first contributions are labeled `good first issue`: add a palette, add a SPAWN scenario from a real asteroid (pull elements from the JPL Small-Body Database), add a lore picture generator.
MORE: `docs/CODE_TOUR.md`; `CONTRIBUTING.md`.

## C3 Tests and the two-language trick
meta: related=[C1,C2,O14]  game=[CI badge in README]  tags=[code,testing]
### SIMPLE
PICTURE: pic-tests  Two boxes, TypeScript and Python, both pointing at one sheet of numbers with a checkmark.
TEXT: The same math in two languages must give the same numbers. The computer checks every change.
### BEGINNER
A test is a tiny program that runs a function with known inputs and complains if the output is wrong. The game has hundreds: Earth's year must come out to 365.25 days; DART's push must come out near 3 mm/s; the same seed must produce the same game twice. Because the physics exists in Python too, the Python version produces the expected answers and the TypeScript version must match them, and vice versa. Every change on GitHub runs all of them automatically.
### INTERMEDIATE
Calibration tests pin the sim to reality: Hohmann Earth-Mars departure 2.94 km/s; Jupiter-class flyby turn 80.2 degrees at 10 planet radii and 10 km/s; Q* about 360 J/kg for a 100 m basalt body; a 10 g/m² sail building 8 to 11 km/s in a year. Property tests check invariants: fragment masses sum to the parent; |v_inf| is conserved through a flyby; energy is constant along a Kepler orbit to 1e-12. Fuzz tests run a thousand random rounds and fail on any NaN.
### ADVANCED
```
tests/vectors/<topic>.json:  [{ "name", "inputs": {...}, "expected": {...}, "tol": 1e-9 }]   generated by pymiss/gen_vectors.py
vitest: for each vector, call the TS function, assert within tol;  pytest: same against the Python function
determinism: resolve(seed, missions) twice -> byte-equal event log JSON
```
### EXPERT
DEMO: none
NOTES: Transcendental functions can differ in the last bits across JS engines and NumPy; tolerances are chosen per vector, never zero. The CI matrix runs Chromium, Firefox and WebKit headless for the TS side.
MORE: GAME_PLAN.md Section 16; vitest and pytest documentation.

## C4 Build your own: knobs, methods, scenarios
meta: related=[C2,D11,G6]  game=[console knobs editor, codex]  tags=[code,modding]
### SIMPLE
PICTURE: pic-modding  A control panel of sliders labeled with physics names; a new card being added to a deck of methods.
TEXT: Every number has a dial. Every method is a card. Add your own.
### BEGINNER
All the tunable numbers live in one file, and SIMULATION mode shows them as sliders. Adding a deflection method means adding one card to `methods.json` (name, tag, which formula, which knobs) and, if it needs new physics, one function with a test. Adding a real asteroid as a scenario means copying its orbit from NASA's database into `scenarios.json`. The codex and the Learning Center pick up new entries automatically.
### INTERMEDIATE
Walkthrough: add "ELECTROSTATIC_TRACTOR_V2". 1) `src/physics/slowPush.ts`: add a function returning acceleration from charge, distance and Debye screening. 2) `tests/`: one vector where screening kills the force. 3) `config/methods.json`: a card with tag PROPOSED, mode REALISTIC, unlock G1, and the lore id. 4) `EDUCATION.md`: a five-level entry (SIMPLE can be two sentences). 5) Run `scripts/build_lore.py` and the tests. The planner enumerates the new method the next time it runs.
### ADVANCED
Method card schema:
```json
{ "id": "ELECTROSTATIC_TRACTOR_V2", "tag": "PROPOSED", "mode": "REALISTIC", "class": "SLOW_PUSH",
  "unlock": "G1", "lore": "D6", "model": "slowPush.electrostatic", "knobs": ["es_charge_kV", "debye_m"],
  "requires_rendezvous": true, "cost": 4, "build_years": 1.5 }
```
### EXPERT
DEMO: none
NOTES: Custom star systems (`bodies.json`), custom palettes and custom lore packs are all data; the only code change a new method needs is its physics function.
MORE: `CONTRIBUTING.md`; GAME_PLAN.md Section 14.

## C5 Sources and where to learn more
meta: related=[C1,T1,D11]  game=[codex footer, every EXPERT entry]  tags=[sources]
### SIMPLE
PICTURE: pic-library  A shelf: NASA, ESA, three textbooks, a stack of papers.
TEXT: Everything here comes from real missions, real papers, and free textbooks. Here they are.
### BEGINNER
Free, reliable starting points: NASA's Planetary Defense pages and CNEOS (live risk tables, close approaches, fireballs); ESA's NEO Coordination Centre; the Planetary Society's explainers; JPL's "Basics of Space Flight"; the National Academies' 2010 report "Defending Planet Earth", free as a PDF. For the math, Feynman's lectures are free online and Curtis's "Orbital Mechanics for Engineering Students" is the standard textbook.
### INTERMEDIATE
Mission papers worth reading in full: the DART results (Nature, March 2023, several papers); the NEO Surveyor overview (Planetary Science Journal, 2023); ESA's NEOMIR study (NEOSST2 conference, 2023); OSIRIS-REx on Bennu's structure and Yarkovsky drift (Science and Icarus, 2019-2021). For impact physics: Benz and Asphaug 1999 (disruption), Holsapple and Housen 2012 (cratering momentum), Popova et al. 2013 (Chelyabinsk), Collins et al. 2005 (impact effects calculator).
### ADVANCED
Primary references by topic, as cited in the entries above:
```
Orbits:     Curtis (2020); Bate, Mueller, White (1971); Vallado (2013); Danby (1988); Izzo (2015, Lambert)
Population: Granvik et al. (2018); Harris and D'Abramo (2015); Brown et al. (2002, 2013); Bottke et al. (2002)
Detection:  Jedicke et al. (2015, Asteroids IV); Mainzer et al. (2023, NEO Surveyor); Conversi et al. (2023, NEOMIR); Tonry et al. (2018, ATLAS); Ivezić et al. (2019, LSST); Chow et al. (2026)
Risk:       Milani and Gronchi (2010); Chesley et al. (2002, Palermo); Binzel (2000, Torino); Roa et al. (2021, Sentry-II); Farnocchia et al. (2015, 2021)
Deflection: Ahrens and Harris (1992); NRC (2010); Lu and Love (2005); Bombardelli and Peláez (2011); Thiry and Vasile (2016); Lubin et al. (2016, 2021); Barbee et al. (2018); Wie (2013); Bruck Syal et al. (2013); Moore et al. (2024)
Impacts:    Cheng et al. (2023); Thomas et al. (2023); Daly et al. (2023); Benz and Asphaug (1999); Leinhardt and Stewart (2012); Holsapple and Housen (2012); Popova et al. (2013); Collins et al. (2005)
Sails:      McInnes (1999); Tsuda et al. (2011, IKAROS)
Policy:     NASA NEO Preparedness Strategy and Action Plan (2018, 2023); IAWN and SMPAG documents; UN COPUOS A/AC.105/1038
```
### EXPERT
DEMO: none
NOTES: The in-game codex renders this list with DOIs where known; the build script validates that every `MORE:` line in this file cites something in this list or a URL.
MORE: Asteroids IV (University of Arizona Press, 2015), the field's reference volume; the biennial Planetary Defense Conference proceedings.

---

## 7. LAB registry (EXPERT demos; code-split modules in `src/lore/labs/`)

Each lab: sliders on the left, a live vector plot on the right, the formula shown with the current numbers substituted, SHOW CODE (opens the real function), and RUN IN PYTHON (optional, Pyodide, explicit click). Labs reuse the game's physics functions directly; they are never reimplemented.

| LAB id                 | Inputs (sliders)                                   | Output                                                         | Uses                     |
|------------------------|----------------------------------------------------|----------------------------------------------------------------|--------------------------|
| LAB_ELLIPSE            | a, e, w; drag the body                             | ellipse, foci, q and Q, period                                 | kepler.ts, elements.ts   |
| LAB_VISVIVA            | r, a                                               | speed; circular and escape markers                             | estimates.ts             |
| LAB_KEPLER_SOLVER      | e, M; step button                                  | Newton iterations drawn on the E - e sin E curve; error log    | kepler.ts                |
| LAB_LAMBERT_PORKCHOP   | launch window, flight range, target orbit          | C3 and U contour maps; click a cell to draw the arc             | lambert.ts, porkchop.ts  |
| LAB_FLYBY              | v_inf, r_p/R, side                                 | turn angle, in/out vectors, heliocentric dv                     | flyby.ts                 |
| LAB_FOCUSING           | v_inf, planet mass                                 | b_crit ring vs planet radius; sample trajectories bending in    | closeApproach.ts         |
| LAB_3DVT               | dv, T, e                                           | miss estimate vs propagated miss; the 3 dv T line               | estimates.ts, resolver   |
| LAB_BETA               | m, U, M, beta                                      | dv; DART preset; momentum bars (impactor, ejecta, target)       | kinetic.ts               |
| LAB_QSTAR              | R, rho, type; impactor m, U                        | Q* curve vs size with the current body marked; Q from an impactor overlay | fragment.ts     |
| LAB_FRAGMENT_CLOUD     | Q/Q*, v_esc, T, N                                  | cloud footprint at close approach; hit fraction                 | fragment.ts, resolver    |
| LAB_SAIL_SPIRAL        | sigma, alpha law, duration                         | spiral trajectory; dv-equivalent vs time                        | sail.ts, integrate.ts    |
| LAB_NUKE_STANDOFF      | Y, H/R, R, rho, C_m                                | f_omega, E_abs, dv; disruption flag                             | nuclear.ts               |
| LAB_TRACTOR            | m_sc, d/R, tau, T_rem, D, tier; method selector    | dv and miss for tractor / ion beam / laser / mass driver        | slowPush.ts              |
| LAB_ROCKET_EQ          | Isp, mass fraction, stages; C3                     | dv; payload vs C3 curve for each launcher tier                  | economy tables           |
| LAB_MAGNITUDE          | D, p, r, delta, alpha; network                     | H, V; detectable or not per network; distance where V = V_lim   | photometry.ts, detection |
| LAB_SUNWARD            | approach direction, D; sentinel on/off             | when each network first sees it; days of warning                | detection.ts             |
| LAB_MONTECARLO         | N, sigma_v, beta range                             | histogram of miss distances; P(MISS) with error bar             | monteCarlo.ts            |
| LAB_RK4                | step size, method (Euler/RK4), thrust on/off       | integrated path vs Kepler; energy error vs step                 | integrate.ts             |
| LAB_IMPACT_ENERGY      | D, rho, v_inf                                      | mass, energy in Mt, category; comparison bars (Hiroshima, Tsar) | estimates.ts             |
| LAB_TORINO             | P, E_Mt, T                                         | Torino color cell; Palermo value                                | risk.ts                  |

## 8. Picture registry (SIMPLE-level diagrams; vector SVG generators in `src/lore/pictures/`)

All pictures are line art in the current palette, 480 × 320 viewBox, no fills except glow, labels in the stroke font. One generator per id; ids are listed with each SIMPLE entry above (`pic-*`). Hand-authored SVGs are allowed in `public/lore/svg/` when a generator would be silly (e.g. `pic-library`). The build script fails on a missing picture.

## 9. Tutorial, quizzes and progress

- The tutorial (G1) is a scripted round with spotlights; each step opens its lore entry at the player's level.
- Optional quizzes (BACKLOG): three questions per group at BEGINNER and INTERMEDIATE, generated from a `quiz:` block that entries may add later; never block progress.
- Progress: `lore_read: { "<ID>": "<highest level read>" }` in SAVE.md; the Learning Center shows a per-group completion ring.

## 10. Writing rules for future entries

- No em dashes. Numbers get units. "About" for anything uncertain. Date anything that changes ("as of 2026").
- SIMPLE is a picture and at most 20 words. BEGINNER has no formulas. INTERMEDIATE has one worked example. ADVANCED shows the game's equation. EXPERT names a LAB or `none`, a derivation or code path, and at least one free source.
- Tag every method and mission REAL / PROPOSED / SPECULATIVE / FICTION exactly as GAME_PLAN.md does; this file never promotes or demotes a tag.
- If the game's knob and the literature disagree, say so in the entry; the game is allowed to be wrong, it is not allowed to hide it.
