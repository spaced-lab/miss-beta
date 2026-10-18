# F. FINDING THEM

Generated from EDUCATION.md by `scripts/build_lore.py --lessons`; edit the source, not this file.

## F1 Finding a moving dot

*Stars stay still. An asteroid moves. Four photos, one moving dot: found.*

### Beginner

A survey telescope photographs the same patch of sky several times, minutes apart. Stars do not move between the photos; an asteroid does. Software links the moving dots into a short track and sends it to the Minor Planet Center, where other telescopes around the world confirm it. The whole process from first photo to confirmed object can take a night or a week, and there are thousands of candidates a night.

### Intermediate

Each detection has a time and a position on the sky, nothing about distance. Three or four detections over about an hour make a "tracklet". The direction and rate of motion already hint at distance: nearby objects move fast across the sky. A new NEO candidate goes on the Minor Planet Center's confirmation page, and follow-up telescopes observe it over days. Only once it has been seen over enough of an arc can an orbit be fitted. The game's discovery rule, "three consecutive nights of detection", is a simplification of this pipeline.

Related: F2, F5, F8. In the game: networks panel, discovery event.

## F2 Brightness, albedo, and why size is uncertain

*A small bright rock and a big dark rock look the same. Size is a guess.*

### Beginner

A telescope measures light, not size. A small, pale asteroid and a large, coal-black one can reflect the same amount of sunlight, so from brightness alone the size can be wrong by a factor of two or three. That is why early news stories about a new asteroid give a wide size range. Infrared telescopes fix this by seeing the rock's own heat instead of reflected light.

### Intermediate

Astronomers use "absolute magnitude" H: how bright the object would look at a standard distance. Lower numbers are brighter; each 5 magnitudes is 100 times brighter. Albedo p is the fraction of light reflected: a dark C-type reflects about 5%, a bright S-type about 20%. Example: an object with H = 22 is about 140 m across if its albedo is 0.14, about 250 m if it is dark (0.05), about 100 m if bright (0.25). Apparent brightness also falls with the square of distance twice over (Sun to rock, rock to telescope).

Related: F1, F4, T5, O2. In the game: threat brief size range, LAB_MAGNITUDE.

## F3 The sunward blind spot

*Telescopes look at the night sky. A rock coming from the Sun's side is invisible.*

### Beginner

Ground telescopes can only search the dark sky. Anything approaching from roughly the direction of the Sun is lost in daylight glare until it is almost here. Chelyabinsk came that way in 2013 and was discovered by the people it hit. Roughly half the sky near the Sun is unwatched. The fix is a telescope in space, parked between Earth and the Sun, looking back at the ring of sky around the Sun in infrared, which is what ESA's planned NEOMIR does.

### Intermediate

Ground surveys need the object at least about 60 degrees from the Sun (the "solar elongation"), and even then twilight limits them. An object on an orbit mostly inside Earth's (an Atira or Aten) can spend years in the glare. The game's detection model enforces an elongation floor per network: 60 degrees for ground, 45 to 120 for a NEO Surveyor-class telescope at L1, and 10 to 45 degrees for a NEOMIR-class sunward sentinel. In play, a threat that stays sunward produces a NO WARNING round unless you have built the sentinel.

Related: F4, F7, T4. In the game: SUNWARD_SENTINEL program, NO WARNING rounds.

## F4 Seeing heat: infrared surveys

*Dark rocks still glow with heat. Infrared cameras see the glow and measure the size.*

### Beginner

Every sun-warmed rock radiates heat, and heat glow depends on the rock's size, not on how dark it is. An infrared telescope in space (it has to be in space; the atmosphere and the telescope itself glow at those wavelengths) sees dark asteroids that visible-light surveys miss and gets their size within about 10 to 20 percent. NASA's NEOWISE did this from 2013 to 2024. NASA's NEO Surveyor, launching in 2027, is built for it.

### Intermediate

Thermal infrared flux scales with the object's cross-section (diameter squared) and its temperature, and the temperature depends on distance from the Sun, not on albedo. So the infrared signal gives size directly. Example: a 140 m rock at 1 AU from the Sun has a surface temperature around 280 K and peaks near 10 micrometers; NEO Surveyor's two bands (4 to 5.2 and 6 to 10 micrometers) bracket that peak. The game models an IR survey as detecting any object larger than a reference diameter scaled by the product of its Sun distance and observer distance.

Related: F2, F3, F7. In the game: SPACE_IR_SURVEYOR program.

## F5 Today's surveys and what they can see

*A few telescopes on mountaintops scan the whole sky every night.*

### Beginner

A handful of survey telescopes find almost all NEOs: Catalina Sky Survey (Arizona), Pan-STARRS (Hawaii), ATLAS (four small telescopes on two hemispheres that scan the whole sky nightly), ZTF (California), ESA's new Flyeye (Italy), and since 2026 the huge Rubin Observatory in Chile, which is expected to roughly triple the catalog. There is currently no survey telescope in space; the last one, NEOWISE, retired in 2024. How small a rock each can find depends on how close it is: ATLAS can catch a 10 m rock about two days out and a 100 m rock about three weeks out.

### Intermediate

"Detectable size" is really "detectable brightness at a given distance." A survey with limiting magnitude 20 (ATLAS) sees a 140 m rock out to about 0.1 to 0.2 AU; one reaching magnitude 24.5 (Rubin) sees the same rock across the inner solar system, which is why Rubin finds things years before they come near. The known fraction as of 2026: about 95% of 1 km objects, about 45% of 140 m objects, and only a few percent of 30 to 100 m objects. Thirteen objects, all under 8 m, have been discovered before impact, nearly all by Catalina and ATLAS hours to a day ahead.

Related: F1, F6, F7, F3. In the game: networks panel, codex.

## F6 Radar

*Radar bounces radio waves off the rock: exact distance, speed, and shape.*

### Beginner

Once an asteroid is found and comes within a few million kilometers, a big radio dish can bounce a signal off it. The echo gives the distance to within meters and the speed to within millimeters per second, far better than any camera, and the shape too. That turns a fuzzy orbit into a sharp one and can rule out impacts decades ahead (it did for Apophis in 2021). The biggest radar, Arecibo, collapsed in 2020; Goldstone in California remains, working with the Green Bank dish.

### Intermediate

Radar cannot discover asteroids (the echo weakens with the fourth power of distance), but for a known object within about 0.1 AU it is the best orbit-measuring tool there is. In the game, the RADAR_NET program and the tracking tiers set `sigma_v`, the uncertainty in the threat's velocity: 5 mm/s for optical-only, 0.2 mm/s with radar. Over a 10-year lead that is the difference between a 1.5 planet-radius uncertainty and a 0.06 one, which decides whether a plan's predicted miss is a sure thing.

Related: F5, F8, T5. In the game: RADAR_NET program, tracking tier.

## F7 Future missions: seeing smaller, sooner

*New eyes in space will spot smaller rocks, earlier, even ones hiding in the Sun's glare.*

### Beginner

NASA's NEO Surveyor (launch planned 2027) is an infrared telescope that will sit between Earth and the Sun and find most of the city-killer-size rocks within a decade. ESA's NEOMIR (early 2030s) will watch the ring of sky around the Sun for rocks as small as 20 m and give at least three weeks' warning. ESA is building up to four Flyeye telescopes. China is studying its own space survey. Further out are ideas for telescope pairs at the L4 and L5 points and a survey from an orbit near Venus, to see objects that stay inside Earth's orbit. In the game these are the PROGRAMS you fund in the background; each takes years and permanently improves what you can see.

### Intermediate

What each buys you, in the game's terms (GAME_PLAN.md 18.4 and 19): SPACE_IR_SURVEYOR makes detection albedo-blind and widens elongation to 45 to 120 degrees; SUNWARD_SENTINEL covers 10 to 45 degrees for 20 m bodies; FLYEYE_NETWORK and GROUND_SURVEY_EXPANSION raise nightly coverage; RADAR_NET sharpens orbits; L4_L5_SENTINELS add parallax, cutting velocity uncertainty by three; VENUS_ORBIT_IR catches interior-orbit threats; LUNAR_FARSIDE_STATION gives a deep, weatherless survey. The payoff is lead time, and lead time multiplies every deflection: miss distance grows with the years remaining.

Related: F3, F4, F5, G4. In the game: PROGRAMS panel.

## F8 From dots to orbits: uncertainty, probability, keyholes

*At first we only know roughly where it will be. More looks shrink the fuzz.*

### Beginner

A new asteroid's orbit is fitted to a few nights of positions, so the prediction for years ahead is a long fuzzy region. If Earth sits inside that region, the impact probability is the fraction of the region Earth covers, maybe 1 or 2 percent. That is not "we think it will hit"; it is "we cannot yet rule it out." As more observations come in, the region shrinks. Usually Earth drops out of it and the probability falls to zero; occasionally the region shrinks toward Earth and the probability rises first, as 2024 YR4's did before collapsing.

### Intermediate

The uncertainty grows mostly along the orbit (an error in speed becomes an error in arrival time). The game keeps one number for this, sigma_v, the velocity knowledge in m/s, and projects it to the close approach: sigma_b ≈ 3 × sigma_v × T. With sigma_v = 5 mm/s and T = 8 years, sigma_b ≈ 3,800 km, about 0.6 Earth radii. Impact probability is then the slice of a bell curve that falls inside Earth's effective radius. A "keyhole" is a tiny region in one flyby that would steer the asteroid into a hit on a later pass; Apophis's 2029 keyhole for a 2036 impact was a few hundred meters wide and has been ruled out.

Related: F1, F6, O7, O14, F9. In the game: P(IMPACT) readout, MISS CONFIDENCE, tracking tiers.

## F9 The Torino and Palermo scales

*Torino scale: 0 means no worry. 10 means certain global disaster. Almost everything is 0.*

### Beginner

The Torino scale is the public, 0-to-10 rating of an asteroid's threat, combining how likely a hit is and how big it would be. Almost every object is 0. A 1 means "worth watching, will probably drop to 0." The highest ever was Apophis at 4 in December 2004; 2024 YR4 reached 3 in 2025. Both fell to 0 once the orbit was pinned down. The Palermo scale is the technical version astronomers use, comparing the risk to the background chance of a random impact of that size.

### Intermediate

Torino needs two inputs: impact probability and kinetic energy. Probability under about 1 percent and energy under about 1 Mt stays at 0 or 1; a few percent chance of a city-scale event is a 3 or 4; a near-certain regional or global event is 8 to 10. Palermo is logarithmic: PS = 0 means the risk equals the background rate of such impacts over the time until the event; PS = -2 is one percent of background; positive values deserve attention. The game shows the Torino number on the threat brief and recomputes it after every maneuver.

Related: F8, T4. In the game: threat brief rating.

## F10 Who is in charge, and what happens after discovery

*Finders report to one clearing house. Experts check. If real, the world's space agencies plan together.*

### Beginner

Every observation goes to the Minor Planet Center. JPL's Sentry and ESA's Aegis systems compute impact odds automatically. If something looks real, the International Asteroid Warning Network (IAWN) alerts governments and the Space Mission Planning Advisory Group (SMPAG), a club of space agencies, works out what mission could be flown. NASA's Planetary Defense Coordination Office and ESA's Planetary Defence Office run their agencies' efforts. All of this was set up in 2013 to 2016 after Chelyabinsk and a United Nations recommendation. 2024 YR4 was the first object to trigger the full chain.

### Intermediate

The 2024 YR4 timeline is the best modern example: discovered 27 December 2024 by ATLAS Chile; odds for 22 December 2032 rose above 1 percent on 29 January 2025, triggering IAWN and SMPAG notifications; peaked near 3 percent on 18 February; new observations after the full moon dropped it to 0.28 percent on 20 February and effectively zero on 24 February; Webb measured its size (53 to 67 m) in March and April; a lunar impact chance of about 4 percent lingered until Webb data in February 2026 ruled it out. In the game, the INTL_COORDINATION program models the value of this plumbing: more budget, less political cost, faster confirmation.

Related: F1, F8, F9, D10, G4. In the game: INTL_COORDINATION program, debrief.
