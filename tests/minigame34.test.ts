import { describe, expect, it } from 'vitest';
import { MG } from '../src/minigame/config';
import { SOUND_EVENTS, VARIANTS } from '../src/minigame/sfx';
import {
  arrayOn, blockedByPlanet, createState, deployTurret, deserialize, droneSpeed, droneTier, releaseSwarm, sentryLasersOn, serialize, start, step, swarmKillsNeeded,
  NO_INPUT, type Asteroid, type MinigameState,
} from '../src/minigame/sim';

function rock(st: MinigameState, x: number, y: number, r = 0.4, tier = 1, hp = 40): Asteroid {
  const a: Asteroid = { id: st.nextId++, x, y, vx: 0, vy: 0, r, tier, hp, maxHp: hp, core: false, passing: false, shape: new Float64Array([1, 1, 1, 1, 1, 1]), rot: 0, spin: 0 };
  st.asteroids.push(a);
  return a;
}

function atLevel(seed: number, level: number): MinigameState {
  const st = createState(seed);
  start(st);
  st.t = (level - 1) * MG.LEVEL_SECONDS + 0.5;
  st.level = level;
  st.spawnTimer = 1e9;
  st.cheats.god = true;
  return st;
}

describe('PERIMETER v3.4 (owner follow-up 2026-10-18)', () => {
  it('swarm kills needed rise, then ease back past level 20 and never below the late floor', () => {
    expect(swarmKillsNeeded(20)).toBeGreaterThan(swarmKillsNeeded(10));
    expect(swarmKillsNeeded(30)).toBeLessThan(swarmKillsNeeded(25));
    expect(swarmKillsNeeded(40)).toBeLessThan(swarmKillsNeeded(30));
    expect(swarmKillsNeeded(60)).toBe(MG.SWARM_KILLS_LATE_MIN);
    expect(swarmKillsNeeded(40)).toBe(MG.SWARM_KILLS_LATE_MIN);
    // Still a real cost in the late game: more than the level-6 price.
    expect(swarmKillsNeeded(60)).toBeGreaterThan(swarmKillsNeeded(6));
  });

  it('drones come in tiers that are faster and hit harder, two colours per swarm', () => {
    expect(droneTier(1)).toBe(0);
    expect(droneTier(MG.SWARM_TIER_FROM_LEVEL)).toBe(1);
    expect(droneTier(MG.SWARM_TIER_FROM_LEVEL + MG.SWARM_TIER_LEVELS)).toBe(2);
    expect(droneTier(99)).toBe(MG.SWARM_TIER_MAX);
    expect(droneSpeed(3)).toBeGreaterThan(droneSpeed(0) * 1.5);
    const st = atLevel(3, 30);
    st.swarmStock = 1;
    expect(releaseSwarm(st)).toBe(true);
    const tiers = new Set(st.drones.map((d) => d.tier));
    expect(tiers.size).toBe(2);
    expect(Math.max(...tiers)).toBe(droneTier(30));
    expect(st.drones.length).toBeGreaterThan(20);
    for (const d of st.drones) expect(Math.hypot(d.vx, d.vy)).toBeCloseTo(droneSpeed(d.tier), 6);
    // A tier-3 drone's bullet carries SWARM_DAMAGE + 3.
    const d3 = st.drones.find((d) => d.tier === droneTier(30))!;
    st.drones.length = 0;
    st.drones.push({ ...d3, x: 2.5, y: 0, vx: 0, vy: 0, cooldown: 0, targetId: -1 });
    rock(st, 3.5, 0);
    step(st, NO_INPUT, MG.DT);
    const shot = st.bullets.find((b) => b.auto);
    expect(shot).toBeDefined();
    expect(shot!.damage).toBe(MG.SWARM_DAMAGE + droneTier(30));
  });

  it('sentries fire tier-coloured lasers from SENTRY_LASER_LEVEL, stronger with tier', () => {
    expect(sentryLasersOn(MG.SENTRY_LASER_LEVEL - 1)).toBe(false);
    const st = atLevel(5, MG.SENTRY_LASER_LEVEL);
    deployTurret(st, false, 'orbiter');
    const tr = st.turrets[0]!;
    const a = rock(st, Math.cos(tr.angle) * 3.2, Math.sin(tr.angle) * 3.2, 0.5, 2, 1000);
    for (let i = 0; i < Math.round(1.5 / MG.DT) && st.beams.every((b) => b.tier < 0); i++) step(st, NO_INPUT, MG.DT);
    const beam = st.beams.find((b) => b.tier >= 0);
    expect(beam, 'a sentry beam was drawn').toBeDefined();
    expect(beam!.tier).toBe(tr.tier);
    expect(beam!.len).toBe(MG.SENTRY_LASER_RANGE);
    expect(a.hp).toBeLessThan(1000);
    // Below the level no sentry beam appears.
    const st2 = atLevel(5, MG.SENTRY_LASER_LEVEL - 1);
    deployTurret(st2, false, 'orbiter');
    const tr2 = st2.turrets[0]!;
    rock(st2, Math.cos(tr2.angle) * 3.2, Math.sin(tr2.angle) * 3.2, 0.5, 2, 1000);
    for (let i = 0; i < Math.round(3 / MG.DT); i++) step(st2, NO_INPUT, MG.DT);
    expect(st2.beams.some((b) => b.tier >= 0)).toBe(false);
  });

  it('from SENTRY_ARRAY_LEVEL three sentries fire a beam array that eliminates the target without fragments', () => {
    expect(arrayOn(MG.SENTRY_ARRAY_LEVEL - 1)).toBe(false);
    const st = atLevel(9, MG.SENTRY_ARRAY_LEVEL);
    for (let i = 0; i < MG.SENTRY_ARRAY_MIN; i++) deployTurret(st, false, 'orbiter');
    expect(st.turrets.length).toBe(MG.SENTRY_ARRAY_MIN);
    // All three on the target's side of the planet, so no beam is blocked by it.
    st.turrets.forEach((tr, i) => { tr.angle = Math.PI / 2 + (i - 1) * 0.6; });
    const big = rock(st, 0, 4.5, 0.9, 3, 1e6);
    const bigId = big.id;
    st.arrayCd = 0;
    step(st, NO_INPUT, MG.DT);
    expect(st.asteroids.find((a) => a.id === bigId), 'the target is gone').toBeUndefined();
    expect(st.asteroids.length, 'no fragments were spawned').toBe(0);
    expect(st.beams.filter((b) => b.tier === 5).length).toBe(MG.SENTRY_ARRAY_MIN);
    expect(st.events.some((e) => e.type === 'array' && e.beams === MG.SENTRY_ARRAY_MIN)).toBe(true);
    expect(st.arrayCd).toBeGreaterThan(MG.SENTRY_ARRAY_PERIOD - MG.DT - 1e-9);
    // Not again until the period has passed.
    rock(st, 0, 4.5, 0.9, 3, 1e6);
    st.events.length = 0;
    for (let i = 0; i < Math.round((MG.SENTRY_ARRAY_PERIOD - 1) / MG.DT); i++) step(st, NO_INPUT, MG.DT);
    expect(st.events.some((e) => e.type === 'array')).toBe(false);
    // With too few sentries nothing fires.
    const st2 = atLevel(9, MG.SENTRY_ARRAY_LEVEL);
    deployTurret(st2, false, 'orbiter');
    rock(st2, 0, 4.5, 0.9, 3, 1e6);
    st2.arrayCd = 0;
    for (let i = 0; i < 30; i++) step(st2, NO_INPUT, MG.DT);
    expect(st2.events.some((e) => e.type === 'array')).toBe(false);
  });

  it('the planet blocks beams: a sentry on the far side does not join the array', () => {
    const st = atLevel(9, MG.SENTRY_ARRAY_LEVEL);
    for (let i = 0; i < 3; i++) deployTurret(st, false, 'orbiter');
    st.turrets.forEach((tr, i) => { tr.angle = i < 2 ? Math.PI / 2 + (i - 0.5) * 0.6 : -Math.PI / 2; });
    rock(st, 0, 4.5, 0.9, 3, 1e6);
    st.arrayCd = 0;
    step(st, NO_INPUT, MG.DT);
    expect(st.beams.filter((b) => b.tier === 5).length).toBe(2);
    expect(blockedByPlanet(0, -2, Math.PI / 2, 6)).toBe(true);
    expect(blockedByPlanet(0, 2, Math.PI / 2, 6)).toBe(false);
  });

  it('the new fields round-trip through a save, and a v3.3 save without them still loads', () => {
    const st = atLevel(2, MG.SENTRY_ARRAY_LEVEL);
    deployTurret(st, false, 'picket');
    st.swarmStock = 1;
    releaseSwarm(st);
    st.arrayCd = 4.5;
    const back = deserialize(serialize(st));
    expect(back).not.toBeNull();
    expect(back!.arrayCd).toBe(4.5);
    expect(back!.drones.map((d) => d.tier)).toEqual(st.drones.map((d) => d.tier));
    expect(back!.turrets[0]!.laserCd).toBe(st.turrets[0]!.laserCd);
    const old = JSON.parse(serialize(st)) as Record<string, unknown>;
    delete old.arrayCd;
    old.drones = (old.drones as Record<string, unknown>[]).map((d) => { const { tier: _t, ...rest } = d; return rest; });
    old.turrets = (old.turrets as Record<string, unknown>[]).map((t) => { const { laserCd: _l, ...rest } = t; return rest; });
    old.beams = [{ angle: 1, t: 0.1 }];
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded).not.toBeNull();
    expect(loaded!.arrayCd).toBe(0);
    expect(loaded!.drones.every((d) => d.tier === 0)).toBe(true);
    expect(loaded!.turrets[0]!.laserCd).toBe(0);
    expect(loaded!.beams[0]!.tier).toBe(-1);
    expect(loaded!.beams[0]!.len).toBeGreaterThan(0);
  });

  it('the sentry and swarm cues sit low: no variant of SENTRY above 450 Hz by the lab proxy', () => {
    for (const v of VARIANTS.SENTRY) expect(v.hz, v.name).toBeLessThanOrEqual(450);
    expect(VARIANTS.SWARM[0]!.hz).toBeLessThan(1000);
    expect(SOUND_EVENTS.length).toBeGreaterThan(0);
  });
});

describe('PERIMETER daily seed (IDEAS 6)', () => {
  it('the daily seed is a stable hash of the date, different per day', async () => {
    const { dailySeed } = await import('../src/minigame/index');
    expect(dailySeed('2026-10-18')).toBe(dailySeed('2026-10-18'));
    expect(dailySeed('2026-10-18')).not.toBe(dailySeed('2026-10-19'));
    expect(Number.isInteger(dailySeed('2026-10-18'))).toBe(true);
  });
});
