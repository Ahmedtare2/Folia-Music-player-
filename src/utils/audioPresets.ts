import { DEFAULT_AUDIO_EFFECT_SETTINGS, type AudioEffectSettings } from './audioEffects';

// src/utils/audioPresets.ts
// Defines built-in sound presets: each one carries both an EQ curve and a full effect chain state.

export type AudioSoundPresetId =
    | 'flat'
    | 'rock'
    | 'pop'
    | 'classical'
    | 'jazz'
    | 'bass'
    | 'vocal'
    | 'lofi'
    | 'radio'
    | 'hall';

export type AudioSoundPreset = {
    gains: readonly number[];
    effects: AudioEffectSettings;
};

const withEffects = (overrides: Partial<AudioEffectSettings>): AudioEffectSettings => ({
    ...DEFAULT_AUDIO_EFFECT_SETTINGS,
    ...overrides,
});

export const AUDIO_SOUND_PRESETS: Record<AudioSoundPresetId, AudioSoundPreset> = {
    flat: {
        gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        effects: withEffects({}),
    },
    rock: {
        gains: [5, 4, 2, -1, -2, -1, 2, 4, 5, 5],
        effects: withEffects({}),
    },
    pop: {
        gains: [-1, 1, 3, 4, 3, 0, -1, 1, 2, 3],
        effects: withEffects({}),
    },
    classical: {
        gains: [4, 3, 2, 1, -1, -1, 0, 2, 3, 4],
        effects: withEffects({}),
    },
    jazz: {
        gains: [3, 2, 1, 2, -1, -1, 0, 1, 3, 4],
        effects: withEffects({}),
    },
    bass: {
        gains: [6, 5, 3, 1, 0, -1, -1, 0, 1, 2],
        effects: withEffects({
            drive: 0.1,
            width: 1.15,
        }),
    },
    vocal: {
        gains: [-2, -1, 0, 2, 4, 4, 3, 1, 0, -1],
        effects: withEffects({
            highpass: 110,
            width: 0.9,
            space: 0.08,
            punch: 0.35,
        }),
    },
    lofi: {
        gains: [-4, -2, 0, 2, 3, 2, 0, -3, -7, -10],
        effects: withEffects({
            highpass: 90,
            lowpass: 6000,
            drive: 0.28,
            crush: 0.45,
            wow: 0.32,
            noise: 0.22,
            width: 0.7,
            space: 0.16,
            punch: 0.4,
        }),
    },
    radio: {
        gains: [-12, -8, -3, 2, 4, 4, 2, -3, -8, -12],
        effects: withEffects({
            highpass: 420,
            lowpass: 3800,
            drive: 0.42,
            crush: 0.3,
            wow: 0.1,
            noise: 0.2,
            width: 0.12,
            punch: 0.6,
        }),
    },
    hall: {
        gains: [1, 1, 0, 0, 0, 0, 1, 1, 1, 0],
        effects: withEffects({
            lowpass: 16000,
            width: 1.3,
            space: 0.55,
            punch: 0.15,
        }),
    },
};

export const AUDIO_SOUND_PRESET_IDS = Object.keys(AUDIO_SOUND_PRESETS) as AudioSoundPresetId[];

export const isAudioSoundPresetId = (value: unknown): value is AudioSoundPresetId => (
    typeof value === 'string' && Object.hasOwn(AUDIO_SOUND_PRESETS, value)
);
