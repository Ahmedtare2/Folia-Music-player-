import { describe, expect, it, vi } from 'vitest';
import { AUDIO_ENGINE_STORAGE_KEY, getAudioEngine, setAudioEngine } from '@/services/audioEngine';
import { buildNativeEqPayload } from '@/services/nativeEqSync';
import { computeDeCumulatedBandGainDb } from '@/services/mobileEqualizerCompat';

// test/unit/services/nativeEqSync.test.ts
// What the native ExoPlayer engine is told: the same de-cumulated band gains the web graph uses, the preamp
// and the limiter. And the engine choice: Standard unless Native was picked.

describe('native equalizer payload', () => {
    it('sends one de-cumulated gain per band plus preamp and limiter', () => {
        const gains = [9, 9, 6, 0, 0, 0, 0, 0, -3, 2];
        const payload = buildNativeEqPayload({ enabled: true, gains }, { preampDb: -4.5, limiterEnabled: false });
        expect(payload.enabled).toBe(true);
        expect(payload.gainsDb).toHaveLength(10);
        expect(payload.gainsDb[1]).toBeCloseTo(computeDeCumulatedBandGainDb(gains, 1), 6);
        expect(payload.gainsDb[1]).toBeLessThan(9);
        expect(payload.gainsDb[8]).toBe(-3);
        expect(payload.preampDb).toBe(-4.5);
        expect(payload.limiterEnabled).toBe(false);
    });
});

describe('audio engine choice', () => {
    it('defaults to standard and remembers native', () => {
        const store = new Map<string, string>();
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => { store.set(key, value); },
        });
        expect(getAudioEngine()).toBe('standard');
        setAudioEngine('native');
        expect(getAudioEngine()).toBe('native');
        expect(store.get(AUDIO_ENGINE_STORAGE_KEY)).toBe('native');
        setAudioEngine('standard');
        expect(getAudioEngine()).toBe('standard');
        vi.unstubAllGlobals();
    });
});
