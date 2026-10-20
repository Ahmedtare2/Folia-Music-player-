import { create } from 'zustand';
import {
    type EffectiveSystemBarState,
    type SystemBarSettings,
    normalizeSystemBarSettings,
    readStoredSystemBarSettings,
    resolveEffectiveSystemBars,
    syncSystemBarsWithPlatform,
    writeStoredSystemBarSettings,
} from '../utils/systemBarSettings';

// src/stores/useSystemBarSettingsStore.ts
// Reactive Zustand store for "Display and Immersive Mode" settings:
//   - hideStatusBar
//   - hideNavigationBar
//   - fullScreenLyricsMode
// Tracks whether the user is currently on a lyrics or visualizer screen so entering/leaving
// full-screen lyrics or visualizer automatically applies or restores the system-bar visibility.

export interface SystemBarSettingsStoreState extends SystemBarSettings {
    isLyricsOrVisualizerScreen: boolean;
    effectiveState: EffectiveSystemBarState;
    setHideStatusBar: (hide: boolean) => void;
    setHideNavigationBar: (hide: boolean) => void;
    setFullScreenLyricsMode: (enabled: boolean) => void;
    updateSystemBarSettings: (patch: Partial<SystemBarSettings>) => void;
    setLyricsOrVisualizerScreenActive: (active: boolean) => void;
    reapplySystemBars: () => void;
}

const initialSettings = readStoredSystemBarSettings();
const initialEffective = resolveEffectiveSystemBars(initialSettings, {
    isLyricsOrVisualizerScreen: false,
});

export const useSystemBarSettingsStore = create<SystemBarSettingsStoreState>((set, get) => ({
    ...initialSettings,
    isLyricsOrVisualizerScreen: false,
    effectiveState: initialEffective,

    updateSystemBarSettings: (patch) => {
        const current = get();
        const nextSettings = writeStoredSystemBarSettings(
            normalizeSystemBarSettings({
                hideStatusBar: patch.hideStatusBar ?? current.hideStatusBar,
                hideNavigationBar: patch.hideNavigationBar ?? current.hideNavigationBar,
                fullScreenLyricsMode: patch.fullScreenLyricsMode ?? current.fullScreenLyricsMode,
            }),
        );
        const nextEffective = resolveEffectiveSystemBars(nextSettings, {
            isLyricsOrVisualizerScreen: current.isLyricsOrVisualizerScreen,
        });
        set({
            ...nextSettings,
            effectiveState: nextEffective,
        });
        void syncSystemBarsWithPlatform(nextEffective);
    },

    setHideStatusBar: (hide) => {
        get().updateSystemBarSettings({ hideStatusBar: Boolean(hide) });
    },

    setHideNavigationBar: (hide) => {
        get().updateSystemBarSettings({ hideNavigationBar: Boolean(hide) });
    },

    setFullScreenLyricsMode: (enabled) => {
        get().updateSystemBarSettings({ fullScreenLyricsMode: Boolean(enabled) });
    },

    setLyricsOrVisualizerScreenActive: (active) => {
        const current = get();
        const nextActive = Boolean(active);
        const nextEffective = resolveEffectiveSystemBars(current, {
            isLyricsOrVisualizerScreen: nextActive,
        });
        const changed =
            current.isLyricsOrVisualizerScreen !== nextActive
            || current.effectiveState.hideStatusBar !== nextEffective.hideStatusBar
            || current.effectiveState.hideNavigationBar !== nextEffective.hideNavigationBar
            || current.effectiveState.isImmersiveLyricsActive !== nextEffective.isImmersiveLyricsActive;

        if (!changed) {
            return;
        }
        set({
            isLyricsOrVisualizerScreen: nextActive,
            effectiveState: nextEffective,
        });
        void syncSystemBarsWithPlatform(nextEffective);
    },

    reapplySystemBars: () => {
        const current = get();
        const stored = readStoredSystemBarSettings();
        const nextEffective = resolveEffectiveSystemBars(stored, {
            isLyricsOrVisualizerScreen: current.isLyricsOrVisualizerScreen,
        });
        set({
            ...stored,
            effectiveState: nextEffective,
        });
        void syncSystemBarsWithPlatform(nextEffective);
    },
}));
