import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    applyAudioEqualizerSettings,
    computeEqualizerFrequencyResponseDb,
    connectAudioEqualizerGraph,
    getAudioEqualizerRuntimeStatus,
    subscribeAudioEqualizerRuntime,
} from '@/services/audioEqualizerGraph';
import {
    AUDIO_EQUALIZER_BANDS,
    AUDIO_EQUALIZER_PRESETS,
    AUDIO_EQUALIZER_STORAGE_KEY,
    DEFAULT_AUDIO_EQUALIZER_SETTINGS,
    isAudioEqualizerFlat,
    readStoredAudioEqualizerSettings,
    resetAudioEqualizerToFlat,
    resolveAudioEqualizerSettings,
    writeStoredAudioEqualizerSettings,
} from '@/utils/audioEqualizer';
import { createNeutralAudioEffects, normalizeAudioEffects } from '@/utils/audioEffects';
import { AUDIO_SOUND_PRESET_IDS, AUDIO_SOUND_PRESETS } from '@/utils/audioPresets';

// test/unit/utils/audioEqualizer.test.ts
// Verifies persisted equalizer normalization, presets (Flat, Rock, Pop, Classical, Jazz, Bass Boost, etc.),
// Reset-to-Flat, ten-node Web Audio BiquadFilterNode chain, runtime lifecycle, and transfer-function frequency response.

const createAudioParam = () => ({
    value: 0,
    cancelScheduledValues: vi.fn(),
    setTargetAtTime: vi.fn(),
});

const createFilter = () => ({
    type: 'peaking',
    frequency: createAudioParam(),
    Q: createAudioParam(),
    gain: createAudioParam(),
    connect: vi.fn(),
});

describe('audio equalizer model', () => {
    const originalWindow = (globalThis as { window?: unknown }).window;

    afterEach(() => {
        if (originalWindow === undefined) {
            delete (globalThis as { window?: unknown }).window;
        } else {
            (globalThis as { window?: unknown }).window = originalWindow;
        }
    });

    it('normalizes malformed persisted values into ten safe bands', () => {
        const settings = resolveAudioEqualizerSettings({
            enabled: true,
            gains: [20, -20, '4', Number.NaN],
        });

        expect(settings.enabled).toBe(true);
        expect(settings.gains).toHaveLength(AUDIO_EQUALIZER_BANDS.length);
        expect(settings.gains.slice(0, 5)).toEqual([12, -12, 4, 0, 0]);
        expect(settings.preset).toBe('custom1');
        expect(settings.customSlots[0].gains).toEqual(settings.gains);
    });

    it('returns an independent flat default for invalid input', () => {
        const first = resolveAudioEqualizerSettings(null);
        first.gains[0] = 6;
        const second = resolveAudioEqualizerSettings(null);

        expect(second).toEqual(DEFAULT_AUDIO_EQUALIZER_SETTINGS);
        expect(second.gains).not.toBe(DEFAULT_AUDIO_EQUALIZER_SETTINGS.gains);
        expect(second.customSlots[0].gains).not.toBe(DEFAULT_AUDIO_EQUALIZER_SETTINGS.customSlots[0].gains);
    });

    it('includes Flat, Rock, Pop, Classical, Jazz, and Bass Boost presets with 10 valid bands each', () => {
        const requiredPresets = ['flat', 'rock', 'pop', 'classical', 'jazz', 'bass', 'vocal', 'lofi', 'radio', 'hall'] as const;
        for (const presetId of requiredPresets) {
            expect(AUDIO_SOUND_PRESET_IDS).toContain(presetId);
            const preset = AUDIO_SOUND_PRESETS[presetId];
            expect(preset.gains).toHaveLength(10);
            preset.gains.forEach(gain => {
                expect(gain).toBeGreaterThanOrEqual(-12);
                expect(gain).toBeLessThanOrEqual(12);
            });
        }

        const rockSettings = resolveAudioEqualizerSettings({
            enabled: true,
            preset: 'rock',
            gains: AUDIO_SOUND_PRESETS.rock.gains,
            effects: AUDIO_SOUND_PRESETS.rock.effects,
        });
        expect(rockSettings.preset).toBe('rock');
        expect(isAudioEqualizerFlat(rockSettings)).toBe(false);
    });

    it('resets any preset or custom curve to Flat while preserving custom slots and enabled state', () => {
        const customSlotGains = [4, 3, 2, 1, 0, -1, -2, -3, 2, 5];
        const activeRock = resolveAudioEqualizerSettings({
            enabled: true,
            preset: 'rock',
            gains: AUDIO_SOUND_PRESETS.rock.gains,
            effects: AUDIO_SOUND_PRESETS.rock.effects,
            customSlots: [{ gains: customSlotGains, effects: createNeutralAudioEffects() }, {}],
        });

        expect(isAudioEqualizerFlat(activeRock)).toBe(false);
        const reset = resetAudioEqualizerToFlat(activeRock);
        expect(reset.enabled).toBe(true);
        expect(reset.preset).toBe('flat');
        expect(reset.gains).toEqual(Array(10).fill(0));
        expect(reset.effects).toEqual(createNeutralAudioEffects());
        expect(isAudioEqualizerFlat(reset)).toBe(true);
        expect(reset.customSlots[0].gains).toEqual(customSlotGains);
    });

    it('persists and restores equalizer settings via localStorage', () => {
        const store = new Map<string, string>();
        (globalThis as { window?: unknown }).window = {
            localStorage: {
                getItem: (key: string) => store.get(key) ?? null,
                setItem: (key: string, value: string) => {
                    store.set(key, value);
                },
            },
        };

        const toSave = resolveAudioEqualizerSettings({
            enabled: true,
            preset: 'jazz',
            gains: AUDIO_SOUND_PRESETS.jazz.gains,
            effects: AUDIO_SOUND_PRESETS.jazz.effects,
        });

        writeStoredAudioEqualizerSettings(toSave);
        expect(store.has(AUDIO_EQUALIZER_STORAGE_KEY)).toBe(true);

        const loaded = readStoredAudioEqualizerSettings();
        expect(loaded.enabled).toBe(true);
        expect(loaded.preset).toBe('jazz');
        expect(loaded.gains).toEqual(AUDIO_SOUND_PRESETS.jazz.gains);
        expect(loaded.effects).toEqual(AUDIO_SOUND_PRESETS.jazz.effects);
    });

    it('preserves the custom slots while a built-in preset is active', () => {
        const settings = resolveAudioEqualizerSettings({
            enabled: true,
            gains: AUDIO_EQUALIZER_PRESETS.lofi,
            preset: 'lofi',
            customSlots: [{ gains: [3, 2, 1, 0, -1, -2, -3, -4, -5, -6] }, {}],
        });

        expect(settings.preset).toBe('lofi');
        expect(settings.gains).toEqual(AUDIO_EQUALIZER_PRESETS.lofi);
        expect(settings.customSlots).toHaveLength(2);
        expect(settings.customSlots[0].gains).toEqual([3, 2, 1, 0, -1, -2, -3, -4, -5, -6]);
        expect(settings.customSlots[1].gains).toEqual(Array(10).fill(0));
    });
});

describe('audio effect model', () => {
    it('leaves the chain neutral for settings persisted before the effect chain existed', () => {
        const settings = resolveAudioEqualizerSettings({
            enabled: true,
            gains: AUDIO_EQUALIZER_PRESETS.lofi,
            preset: 'lofi',
            customGains: Array(10).fill(0),
        });

        expect(settings.effects).toEqual(createNeutralAudioEffects());
        expect(settings.gains).toEqual(AUDIO_EQUALIZER_PRESETS.lofi);
        expect(settings.preset).toBe('lofi');
        expect(settings.customSlots[0].effects).toEqual(createNeutralAudioEffects());
    });

    it('keeps honouring effects that were actually persisted', () => {
        const settings = resolveAudioEqualizerSettings({
            enabled: true,
            gains: AUDIO_EQUALIZER_PRESETS.lofi,
            preset: 'lofi',
            effects: AUDIO_SOUND_PRESETS.lofi.effects,
        });

        expect(settings.effects).toEqual(AUDIO_SOUND_PRESETS.lofi.effects);
    });

    it('clamps malformed effect values and fills missing ones with their neutral value', () => {
        const effects = normalizeAudioEffects({ drive: 4, width: -1, space: 'x', lowpass: 8000 });

        expect(effects.drive).toBe(1);
        expect(effects.width).toBe(0);
        expect(effects.space).toBe(0);
        expect(effects.lowpass).toBe(8000);
        expect(effects.highpass).toBe(20);
    });

    it('detects a built-in preset only when gains and effects both match', () => {
        const matched = resolveAudioEqualizerSettings({
            enabled: true,
            gains: AUDIO_SOUND_PRESETS.hall.gains,
            effects: AUDIO_SOUND_PRESETS.hall.effects,
        });
        const mismatched = resolveAudioEqualizerSettings({
            enabled: true,
            gains: AUDIO_SOUND_PRESETS.hall.gains,
            effects: { ...AUDIO_SOUND_PRESETS.hall.effects, space: 0 },
        });

        expect(matched.preset).toBe('hall');
        expect(mismatched.preset).toBe('custom1');
    });

    it('moves a retired preset into the first custom slot without losing the older custom sound', () => {
        const retiredSound = {
            gains: [3, 2, 1, 0, -1, -1, -2, -3, -5, -7],
            effects: normalizeAudioEffects({ noise: 0.38, wow: 0.22, lowpass: 11000 }),
        };
        const settings = resolveAudioEqualizerSettings({
            enabled: true,
            preset: 'vinyl',
            gains: retiredSound.gains,
            effects: retiredSound.effects,
            customGains: [6, 6, 6, 0, 0, 0, 0, 0, 0, 0],
        });

        expect(settings.preset).toBe('custom1');
        expect(settings.gains).toEqual(retiredSound.gains);
        expect(settings.effects).toEqual(retiredSound.effects);
        expect(settings.customSlots[0]).toEqual(retiredSound);
        expect(settings.customSlots[1].gains).toEqual([6, 6, 6, 0, 0, 0, 0, 0, 0, 0]);
    });

    it('maps the former single custom slot onto the first of the two slots', () => {
        const settings = resolveAudioEqualizerSettings({
            enabled: true,
            preset: 'custom',
            gains: Array(10).fill(2),
            customGains: Array(10).fill(2),
        });

        expect(settings.preset).toBe('custom1');
        expect(settings.customSlots[0].gains).toEqual(Array(10).fill(2));
        expect(settings.customSlots[1].gains).toEqual(Array(10).fill(0));
    });
});

describe('audio equalizer graph & measurable frequency response', () => {
    it('connects ten filters between the existing gain and analyser nodes and reports runtime status across session changes', () => {
        const filters = AUDIO_EQUALIZER_BANDS.map(() => createFilter());
        const context = {
            sampleRate: 48_000,
            currentTime: 1.5,
            state: 'running',
            createBiquadFilter: vi.fn(() => filters.shift()),
        } as unknown as AudioContext;
        const input = { connect: vi.fn() } as unknown as AudioNode;
        const output = {} as AudioNode;
        const nodesRef = { current: [] as BiquadFilterNode[] };
        const listener = vi.fn();
        const unsubscribe = subscribeAudioEqualizerRuntime(listener);

        connectAudioEqualizerGraph({
            context,
            input,
            output,
            nodesRef,
            settings: {
                enabled: true,
                gains: Array.from({ length: 10 }, (_, index) => index - 5),
                preset: 'custom1',
                effects: createNeutralAudioEffects(),
                customSlots: [],
            },
        });

        expect(nodesRef.current).toHaveLength(10);
        expect(input.connect).toHaveBeenCalledWith(nodesRef.current[0]);
        expect(nodesRef.current[0].type).toBe('lowshelf');
        expect(nodesRef.current[9].type).toBe('highshelf');
        expect(nodesRef.current[9].connect).toHaveBeenCalledWith(output);
        expect(nodesRef.current[0].gain.value).toBe(-5);
        expect(nodesRef.current[9].gain.value).toBe(4);

        const activeStatus = getAudioEqualizerRuntimeStatus();
        expect(activeStatus.connected).toBe(true);
        expect(activeStatus.contextState).toBe('running');
        expect(activeStatus.bandCount).toBe(10);
        expect(activeStatus.activeBandGainsDb[0]).toBe(-5);
        expect(listener).toHaveBeenCalled();

        // Simulate session close / graph teardown
        applyAudioEqualizerSettings(null as unknown as AudioContext, [], DEFAULT_AUDIO_EQUALIZER_SETTINGS);
        const closedStatus = getAudioEqualizerRuntimeStatus();
        expect(closedStatus.connected).toBe(false);
        expect(closedStatus.contextState).toBe('uninitialized');
        unsubscribe();
    });

    it('smoothly bypasses every band when disabled', () => {
        const nodes = AUDIO_EQUALIZER_BANDS.map(() => createFilter()) as unknown as BiquadFilterNode[];
        const context = { currentTime: 2, sampleRate: 48_000, state: 'running' } as AudioContext;

        applyAudioEqualizerSettings(context, nodes, {
            enabled: false,
            gains: Array(10).fill(6),
            preset: 'custom1',
            effects: createNeutralAudioEffects(),
            customSlots: [],
        });

        nodes.forEach(node => {
            expect(node.gain.cancelScheduledValues).toHaveBeenCalledWith(2);
            expect(node.gain.setTargetAtTime).toHaveBeenCalledWith(0, 2, 0.015);
        });
    });

    it('measurably alters the audio biquad frequency response curve across 31 Hz – 16 kHz when enabled', () => {
        const probeFrequencies = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

        // Disabled or Flat -> 0 dB across all frequencies
        const flatResponse = computeEqualizerFrequencyResponseDb(
            { ...DEFAULT_AUDIO_EQUALIZER_SETTINGS, enabled: true },
            probeFrequencies,
        );
        flatResponse.forEach(gainDb => {
            expect(gainDb).toBeCloseTo(0, 3);
        });

        const disabledRockResponse = computeEqualizerFrequencyResponseDb(
            {
                ...DEFAULT_AUDIO_EQUALIZER_SETTINGS,
                enabled: false,
                preset: 'rock',
                gains: AUDIO_SOUND_PRESETS.rock.gains,
            },
            probeFrequencies,
        );
        disabledRockResponse.forEach(gainDb => {
            expect(gainDb).toBe(0);
        });

        // Bass Boost enabled -> boosts low frequencies (31 Hz, 62 Hz, 125 Hz) significantly
        const bassResponse = computeEqualizerFrequencyResponseDb(
            {
                ...DEFAULT_AUDIO_EQUALIZER_SETTINGS,
                enabled: true,
                preset: 'bass',
                gains: AUDIO_SOUND_PRESETS.bass.gains,
            },
            probeFrequencies,
        );
        expect(bassResponse[0]).toBeGreaterThan(3.5); // 31 Hz lowshelf corner + 62 Hz skirt (~+4.06 dB)
        expect(bassResponse[1]).toBeGreaterThan(5);   // 62 Hz peak + 31 Hz lowshelf (~+6.98 dB)
        expect(bassResponse[5]).toBeLessThan(0);      // 1 kHz dipped

        // Rock preset enabled -> V-curve boosts lows (31/62 Hz) and highs (8/16 kHz) while dipping 500 Hz
        const rockResponse = computeEqualizerFrequencyResponseDb(
            {
                ...DEFAULT_AUDIO_EQUALIZER_SETTINGS,
                enabled: true,
                preset: 'rock',
                gains: AUDIO_SOUND_PRESETS.rock.gains,
            },
            probeFrequencies,
        );
        expect(rockResponse[0]).toBeGreaterThan(2.5); // 31 Hz
        expect(rockResponse[1]).toBeGreaterThan(4);   // 62 Hz
        expect(rockResponse[4]).toBeLessThan(-1);     // 500 Hz
        expect(rockResponse[8]).toBeGreaterThan(3);   // 8 kHz
    });
});
