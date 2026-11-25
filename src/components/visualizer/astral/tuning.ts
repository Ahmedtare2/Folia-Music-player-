import { defineVisualizerTuning, modChoice, modNumber, type StoredTuningFields } from '../tuningDefinition';
import { ASTRAL_QUALITY_LEVELS, DEFAULT_ASTRAL_TUNING, normalizeAstralTuning, type AstralTuning } from './types';

// src/components/visualizer/astral/tuning.ts
// ASTRAL's tuning: its defaults, the settings store fields it lives in and where it is stored.
// The renderer reads it from the tuning bundle with read() (entry.tsx), so there is no named prop.

declare module '../tuningDefinition' {
    interface VisualizerTuningSettings extends StoredTuningFields<'astralTuning', 'handleSetAstralTuning', 'handleResetAstralTuning', AstralTuning> {}
}

export default defineVisualizerTuning<AstralTuning>({
    mode: 'astral',
    defaults: DEFAULT_ASTRAL_TUNING,
    modKeys: {
        cameraMotion: modNumber(0, 2),
        cameraSpeed: modNumber(0.25, 2),
        orbitalActivity: modNumber(0, 2),
        atmosphere: modNumber(0, 2),
        audioReactivity: modNumber(0, 2),
        lyricIllumination: modNumber(0, 2),
        quality: modChoice(ASTRAL_QUALITY_LEVELS),
    },
    settingsKey: 'astralTuning',
    settingsSetterKey: 'handleSetAstralTuning',
    settingsResetterKey: 'handleResetAstralTuning',
    storage: {
        key: 'astral_tuning',
        read: normalizeAstralTuning,
        // Merge then normalize: the same clamp runs for slider drags, imports, sync and Folium.
        merge: (held, patch) => normalizeAstralTuning({ ...held, ...patch }),
        resetNotice: 'notifications.astralReset',
    },
});
