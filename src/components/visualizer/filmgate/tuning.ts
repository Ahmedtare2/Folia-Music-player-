import { defineVisualizerTuning, modNumber, MOD_SWITCH, type StoredTuningFields } from '../tuningDefinition';
import { DEFAULT_FILMGATE_TUNING, normalizeFilmgateTuning, type FilmgateTuning } from './types';

// src/components/visualizer/filmgate/tuning.ts
// FILMGATE's tuning: its defaults, the settings store fields it lives in and where it is stored.
// The renderer reads it from the tuning bundle with read() (entry.tsx), so there is no named prop.

declare module '../tuningDefinition' {
    interface VisualizerTuningSettings extends StoredTuningFields<'filmgateTuning', 'handleSetFilmgateTuning', 'handleResetFilmgateTuning', FilmgateTuning> {}
}

export default defineVisualizerTuning<FilmgateTuning>({
    mode: 'filmgate',
    defaults: DEFAULT_FILMGATE_TUNING,
    modKeys: {
        grain: modNumber(0, 2),
        lightLeaks: modNumber(0, 2),
        gateMotion: modNumber(0, 2),
        impact: modNumber(0, 2),
        illumination: modNumber(0, 2),
        frame: MOD_SWITCH,
    },
    settingsKey: 'filmgateTuning',
    settingsSetterKey: 'handleSetFilmgateTuning',
    settingsResetterKey: 'handleResetFilmgateTuning',
    storage: {
        key: 'filmgate_tuning',
        read: normalizeFilmgateTuning,
        // Merge then normalize: the same clamp runs for slider drags, imports, sync and Folium.
        merge: (held, patch) => normalizeFilmgateTuning({ ...held, ...patch }),
        resetNotice: 'notifications.filmgateReset',
    },
});
