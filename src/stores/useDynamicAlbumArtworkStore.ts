import { create } from 'zustand';
import {
    type DynamicAlbumArtworkIntensity,
    type DynamicAlbumArtworkSettings,
    normalizeDynamicAlbumArtworkSettings,
    readStoredAlbumVideoCoversEnabled,
    readStoredDynamicAlbumArtworkSettings,
    writeStoredAlbumVideoCoversEnabled,
    writeStoredDynamicAlbumArtworkSettings,
} from '../utils/dynamicAlbumArtwork';

// src/stores/useDynamicAlbumArtworkStore.ts
// Reactive Zustand store for the persisted "Dynamic Album Artwork" setting (On/Off + Low/Normal intensity)
// and "Full-Screen Local Album Video Covers" setting (albumVideoEnabled).

export interface DynamicAlbumArtworkStoreState extends DynamicAlbumArtworkSettings {
    albumVideoEnabled: boolean;
    setDynamicAlbumArtworkEnabled: (enabled: boolean) => void;
    setDynamicAlbumArtworkIntensity: (intensity: DynamicAlbumArtworkIntensity) => void;
    setAlbumVideoEnabled: (enabled: boolean) => void;
    updateDynamicAlbumArtworkSettings: (patch: Partial<DynamicAlbumArtworkSettings & { albumVideoEnabled: boolean }>) => void;
}

const initialSettings = readStoredDynamicAlbumArtworkSettings();
const initialAlbumVideoEnabled = readStoredAlbumVideoCoversEnabled();

export const useDynamicAlbumArtworkStore = create<DynamicAlbumArtworkStoreState>((set, get) => ({
    ...initialSettings,
    albumVideoEnabled: initialAlbumVideoEnabled,

    updateDynamicAlbumArtworkSettings: (patch) => {
        const current = get();
        const next = writeStoredDynamicAlbumArtworkSettings(
            normalizeDynamicAlbumArtworkSettings({
                enabled: patch.enabled ?? current.enabled,
                intensity: patch.intensity ?? current.intensity,
            }),
        );
        const nextAlbumVideoEnabled = patch.albumVideoEnabled !== undefined
            ? writeStoredAlbumVideoCoversEnabled(patch.albumVideoEnabled)
            : current.albumVideoEnabled;
        set({
            ...next,
            albumVideoEnabled: nextAlbumVideoEnabled,
        });
    },

    setDynamicAlbumArtworkEnabled: (enabled) => {
        get().updateDynamicAlbumArtworkSettings({ enabled: Boolean(enabled) });
    },

    setDynamicAlbumArtworkIntensity: (intensity) => {
        get().updateDynamicAlbumArtworkSettings({
            intensity: intensity === 'low' ? 'low' : 'normal',
        });
    },

    setAlbumVideoEnabled: (enabled) => {
        const next = writeStoredAlbumVideoCoversEnabled(Boolean(enabled));
        set({ albumVideoEnabled: next });
    },
}));
