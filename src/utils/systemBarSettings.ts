import {
    type FoliaAndroidSystemBarsState,
    applyAndroidSystemBarsVisibility,
} from '../services/android/foliaAndroidBridge';

// src/utils/systemBarSettings.ts
// Persisted model, screen-context resolver, and native Android bridge synchronization for
// "Display and Immersive Mode":
//   - hideStatusBar: Hide the top Android status bar across the application.
//   - hideNavigationBar: Hide the bottom Android navigation bar across the application.
//   - fullScreenLyricsMode: Hide both status and navigation bars together while viewing
//     synchronized lyrics or the full-screen visualizer, and restore the user's base
//     system-bar state when leaving full-screen lyrics/visualizer mode.

export const SYSTEM_BAR_SETTINGS_STORAGE_KEY = 'folia_system_bar_settings_v1';

export interface SystemBarSettings {
    hideStatusBar: boolean;
    hideNavigationBar: boolean;
    fullScreenLyricsMode: boolean;
}

export interface SystemBarScreenContext {
    /** Whether the user is currently viewing synchronized lyrics or full-screen visualizer/stage. */
    isLyricsOrVisualizerScreen: boolean;
}

export interface EffectiveSystemBarState {
    hideStatusBar: boolean;
    hideNavigationBar: boolean;
    isImmersiveLyricsActive: boolean;
}

export const DEFAULT_SYSTEM_BAR_SETTINGS: SystemBarSettings = {
    hideStatusBar: false,
    hideNavigationBar: false,
    fullScreenLyricsMode: false,
};

export const normalizeSystemBarSettings = (raw: unknown): SystemBarSettings => {
    if (!raw || typeof raw !== 'object') {
        return { ...DEFAULT_SYSTEM_BAR_SETTINGS };
    }
    const record = raw as Record<string, unknown>;
    return {
        hideStatusBar: Boolean(record.hideStatusBar),
        hideNavigationBar: Boolean(record.hideNavigationBar),
        fullScreenLyricsMode: Boolean(record.fullScreenLyricsMode),
    };
};

const getStorage = (): Storage | null => {
    if (typeof globalThis !== 'undefined') {
        const g = globalThis as { localStorage?: Storage; window?: { localStorage?: Storage } };
        if (g.localStorage && typeof g.localStorage.getItem === 'function') {
            return g.localStorage;
        }
        if (g.window?.localStorage && typeof g.window.localStorage.getItem === 'function') {
            return g.window.localStorage;
        }
    }
    return null;
};

export const readStoredSystemBarSettings = (): SystemBarSettings => {
    try {
        const storage = getStorage();
        const raw = storage?.getItem(SYSTEM_BAR_SETTINGS_STORAGE_KEY);
        if (!raw) {
            return { ...DEFAULT_SYSTEM_BAR_SETTINGS };
        }
        return normalizeSystemBarSettings(JSON.parse(raw));
    } catch {
        return { ...DEFAULT_SYSTEM_BAR_SETTINGS };
    }
};

export const writeStoredSystemBarSettings = (settings: SystemBarSettings): SystemBarSettings => {
    const normalized = normalizeSystemBarSettings(settings);
    try {
        const storage = getStorage();
        storage?.setItem(SYSTEM_BAR_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
        // Ignore storage write errors
    }
    return normalized;
};

/**
 * Computes the effective status-bar and navigation-bar visibility for the current screen.
 * When `fullScreenLyricsMode` is enabled and `isLyricsOrVisualizerScreen` is true, both system
 * bars are hidden together. When leaving the lyrics/visualizer screen, the previous base
 * `hideStatusBar` and `hideNavigationBar` preferences are restored automatically.
 */
export const resolveEffectiveSystemBars = (
    settings: SystemBarSettings,
    context: SystemBarScreenContext,
): EffectiveSystemBarState => {
    const normalized = normalizeSystemBarSettings(settings);
    const isImmersiveLyricsActive = Boolean(
        normalized.fullScreenLyricsMode && context.isLyricsOrVisualizerScreen,
    );
    return {
        hideStatusBar: isImmersiveLyricsActive ? true : normalized.hideStatusBar,
        hideNavigationBar: isImmersiveLyricsActive ? true : normalized.hideNavigationBar,
        isImmersiveLyricsActive,
    };
};

/**
 * Updates document root data attributes and safe-area CSS custom properties so the mobile shell
 * and Now Playing sheet adapt smoothly without layout jumps or flashes when system bars hide/show,
 * then dispatches the native Android WindowInsetsControllerCompat call.
 */
export const syncSystemBarsWithPlatform = async (
    effective: EffectiveSystemBarState,
): Promise<FoliaAndroidSystemBarsState> => {
    if (typeof document !== 'undefined' && document.documentElement?.dataset) {
        const root = document.documentElement;
        root.dataset.hideStatusBar = effective.hideStatusBar ? 'true' : 'false';
        root.dataset.hideNavigationBar = effective.hideNavigationBar ? 'true' : 'false';
        root.dataset.immersiveLyrics = effective.isImmersiveLyricsActive ? 'true' : 'false';
    }
    return applyAndroidSystemBarsVisibility({
        hideStatusBar: effective.hideStatusBar,
        hideNavigationBar: effective.hideNavigationBar,
    });
};
