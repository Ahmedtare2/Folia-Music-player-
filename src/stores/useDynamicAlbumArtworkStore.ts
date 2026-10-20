import { create } from 'zustand';
import {
    type DynamicAlbumArtworkIntensity,
    type DynamicAlbumArtworkSettings,
    normalizeDynamicAlbumArtworkSettings,
    readStoredDynamicAlbumArtworkSettings,
    writeStoredDynamicAlbumArtworkSettings,
} from '../utils/dynamicAlbumArtwork';

// src/stores/useDynamicAlbumArtworkStore.ts
// Reactive Zustand store for the persisted "Dynamic Album Artwork" setting (On/Off + Low/Normal intensity).

export interface DynamicAlbumArtworkStoreState extends DynamicAlbumArtworkSettings {
    setDynamicAlbumArtworkEnabled: (enabled: boolean) => void;
    setDynamicAlbumArtworkIntensity: (intensity: DynamicAlbumArtworkIntensity) => void;
    updateDynamicAlbumArtworkSettings: (patch: Partial<DynamicAlbumArtworkSettings>) => void;
}

const initialSettings = readStoredDynamicAlbumArtworkSettings();

export const useDynamicAlbumArtworkStore = create<DynamicAlbumArtworkStoreState>((set, get) => ({
    ...initialSettings,

    updateDynamicAlbumArtworkSettings: (patch) => {
        const current = get();
        const next = writeStoredDynamicAlbumArtworkSettings(
            normalizeDynamicAlbumArtworkSettings({
                enabled: patch.enabled ?? current.enabled,
                intensity: patch.intensity ?? current.intensity,
            }),
        );
        set(next);
    },

    setDynamicAlbumArtworkEnabled: (enabled) => {
        get().updateDynamicAlbumArtworkSettings({ enabled: Boolean(enabled) });
    },

    setDynamicAlbumArtworkIntensity: (intensity) => {
        get().updateDynamicAlbumArtworkSettings({
            intensity: intensity === 'low' ? 'low' : 'normal',
        });
    },
}));
