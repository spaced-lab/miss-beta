// IDEAS 21 robot voice-overs: the manifest matches the committed clips, the settings guard, the event-to-line pick.
// @ts-ignore node types are not installed; fs is available in the test runner
import { existsSync, statSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { VOICE_IDS, voiceForEvents, voiceText, voiceUrl } from '../src/audio/voice';
import { cycle, DEFAULT_SETTINGS, isSettings, VOICES } from '../src/game/settings';
import type { SimEventRecord } from '../src/sim/eventLog';

describe('VOICE manifest (src/config/voice.json)', () => {
  it('every line has non-empty text and a small clip for every voice', () => {
    expect(VOICE_IDS.length).toBeGreaterThanOrEqual(22);
    let total = 0;
    for (const id of VOICE_IDS) {
      expect(id).toMatch(/^[A-Z_]+$/);
      expect(voiceText(id).trim().length).toBeGreaterThan(0);
      for (const mode of VOICES) {
        if (mode === 'OFF') continue;
        const f = `public/${voiceUrl(mode, id)}`;
        expect((existsSync as (p: string) => boolean)(f), f).toBe(true);
        const size = (statSync as (p: string) => { size: number })(f).size;
        expect(size).toBeGreaterThan(500);
        total += size;
      }
    }
    // All voices together stay under 1 MB (IDEAS 21 budgeted 400 KB for two; six voices measured 612 KB).
    expect(total).toBeLessThan(1024 * 1024);
  });

  it('the lines the game hooks exist', () => {
    for (const id of ['LAUNCHING', 'PLAN_COMMITTED', 'MISS', 'HIT', 'GAME_OVER', 'IMPACT_IMMINENT', 'WELCOME', 'FINALE', 'PLAY_A_GAME']) {
      expect(VOICE_IDS).toContain(id);
    }
  });
});

describe('VOICE setting', () => {
  it('defaults to FEMALE, accepts every mode, keeps older records valid, rejects junk', () => {
    expect(DEFAULT_SETTINGS.voice).toBe('FEMALE');
    for (const v of VOICES) expect(isSettings({ ...DEFAULT_SETTINGS, voice: v })).toBe(true);
    const { voice: _drop, ...older } = DEFAULT_SETTINGS;
    expect(isSettings(older)).toBe(true);
    expect(isSettings({ ...DEFAULT_SETTINGS, voice: 'ROBOT' })).toBe(false);
    expect(isSettings({ ...DEFAULT_SETTINGS, voice: 1 })).toBe(false);
    expect(VOICES.length).toBe(9);
    expect(isSettings({ ...DEFAULT_SETTINGS, voice: 'MALE' })).toBe(true);
    expect(cycle(VOICES, 'RADIO', 1)).toBe('OFF');
    expect(voiceUrl('FEMALE', 'LAUNCHING')).toBe('audio/voice/female/LAUNCHING.ogg');
    expect(voiceUrl('MAINFRAME', 'PLAY_A_GAME')).toBe('audio/voice/mainframe/PLAY_A_GAME.ogg');
    expect(voiceText('PLAY_A_GAME')).toBe('Would you like to play a game?');
  });
});

describe('voiceForEvents', () => {
  const launch: SimEventRecord = { t: 1, kind: 'LAUNCH', missionId: 'M1', c3: 10, massKg: 1000, tier: 1 };
  const impact: SimEventRecord = { t: 2, kind: 'IMPACT', missionId: 'M1', U: 6000, beta: 3, dvAlong: 0.01, dvTotal: 0.01, massKg: 1000 };
  const frag: SimEventRecord = { t: 3, kind: 'FRAGMENTATION', missionId: 'M1', targetId: 'THREAT', qRatio: 2, count: 5, largestD: 40, vEj: 1, escaped: 0 };
  it('picks the most important line of a batch, or none', () => {
    expect(voiceForEvents([])).toBeNull();
    expect(voiceForEvents([{ t: 0, kind: 'NOTE', text: 'x' }])).toBeNull();
    expect(voiceForEvents([launch])).toBe('LAUNCHING');
    expect(voiceForEvents([launch, impact])).toBe('INTERCEPT');
    expect(voiceForEvents([frag, impact, launch])).toBe('FRAGMENTS');
    expect(voiceForEvents([{ t: 4, kind: 'BETA_ASSESSED', missionId: 'M1', beta: 3, marginRadii: 2.5 }])).toBe('DEFLECTED');
    expect(voiceForEvents([{ t: 4, kind: 'BETA_ASSESSED', missionId: 'M1', beta: 1, marginRadii: 0.4 }])).toBe('PARTIAL');
  });
});
