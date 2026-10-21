// src/utils/dynamicAlbumArtwork.ts
// Persisted model, motion-intensity profile resolver, and playback/visibility synchronization
// for the Apple Music-inspired Dynamic Album Artwork experience on the normal player Cover screen.

export const DYNAMIC_ALBUM_ARTWORK_STORAGE_KEY = 'folia_dynamic_album_artwork_v1';

export type DynamicAlbumArtworkIntensity = 'low' | 'normal';

export interface DynamicAlbumArtworkSettings {
    enabled: boolean;
    intensity: DynamicAlbumArtworkIntensity;
}

export interface DynamicAlbumArtworkRuntimeInput {
    settings?: DynamicAlbumArtworkSettings;
    enabled?: boolean;
    intensity?: DynamicAlbumArtworkIntensity;
    isPlaying: boolean;
    isCoverScreenActive: boolean;
    isPageVisible?: boolean;
    prefersReducedMotion?: boolean;
}

export interface DynamicAlbumArtworkMotionProfile {
    shouldAnimate: boolean;
    effectiveIntensity: 'off' | 'low' | 'normal';
    cameraDriftPx: number;
    zoomScaleMin: number;
    zoomScaleMax: number;
    parallaxOffsetPx: number;
    ambientBloomOpacity: number;
    specularSweepOpacity: number;
    lowerEdgeFeatherPercent: number;
    cycleDurationSec: number;
}

export const DEFAULT_DYNAMIC_ALBUM_ARTWORK_SETTINGS: DynamicAlbumArtworkSettings = {
    enabled: true,
    intensity: 'normal',
};

export const normalizeDynamicAlbumArtworkSettings = (raw: unknown): DynamicAlbumArtworkSettings => {
    if (!raw || typeof raw !== 'object') {
        return { ...DEFAULT_DYNAMIC_ALBUM_ARTWORK_SETTINGS };
    }
    const record = raw as Record<string, unknown>;
    const enabled = typeof record.enabled === 'boolean'
        ? record.enabled
        : DEFAULT_DYNAMIC_ALBUM_ARTWORK_SETTINGS.enabled;
    const intensity: DynamicAlbumArtworkIntensity = record.intensity === 'low' ? 'low' : 'normal';
    return { enabled, intensity };
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

export const readStoredDynamicAlbumArtworkSettings = (): DynamicAlbumArtworkSettings => {
    try {
        const storage = getStorage();
        const raw = storage?.getItem(DYNAMIC_ALBUM_ARTWORK_STORAGE_KEY);
        if (!raw) {
            return { ...DEFAULT_DYNAMIC_ALBUM_ARTWORK_SETTINGS };
        }
        return normalizeDynamicAlbumArtworkSettings(JSON.parse(raw));
    } catch {
        return { ...DEFAULT_DYNAMIC_ALBUM_ARTWORK_SETTINGS };
    }
};

export const writeStoredDynamicAlbumArtworkSettings = (
    settings: DynamicAlbumArtworkSettings,
): DynamicAlbumArtworkSettings => {
    const normalized = normalizeDynamicAlbumArtworkSettings(settings);
    try {
        const storage = getStorage();
        storage?.setItem(DYNAMIC_ALBUM_ARTWORK_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
        // Ignore storage write errors
    }
    return normalized;
};

export const detectPrefersReducedMotion = (): boolean => {
    try {
        if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
            return Boolean(window.matchMedia('(prefers-reduced-motion: reduce)')?.matches);
        }
    } catch {
        // Ignore matchMedia errors
    }
    return false;
};

/**
 * Computes bounded, composition-preserving motion parameters for the Dynamic Album Cover stage.
 * - Preserves essential artwork composition (faces, text, subject framing) by keeping zoom scale
 *   within 1.0..1.045 and camera drift within ±5.5px.
 * - Automatically steps down to 'low' intensity when system `prefers-reduced-motion` is enabled.
 * - Suspends animation work when playback is paused, when the Cover screen is inactive, or when
 *   the application/document is hidden.
 */
export const resolveDynamicAlbumArtworkMotion = ({
    settings,
    enabled,
    intensity,
    isPlaying,
    isCoverScreenActive,
    isPageVisible = true,
    prefersReducedMotion = false,
}: DynamicAlbumArtworkRuntimeInput): DynamicAlbumArtworkMotionProfile => {
    const normalized = normalizeDynamicAlbumArtworkSettings(
        settings ?? {
            enabled: typeof enabled === 'boolean' ? enabled : DEFAULT_DYNAMIC_ALBUM_ARTWORK_SETTINGS.enabled,
            intensity: intensity ?? DEFAULT_DYNAMIC_ALBUM_ARTWORK_SETTINGS.intensity,
        },
    );
    if (!normalized.enabled) {
        return {
            shouldAnimate: false,
            effectiveIntensity: 'off',
            cameraDriftPx: 0,
            zoomScaleMin: 1,
            zoomScaleMax: 1,
            parallaxOffsetPx: 0,
            ambientBloomOpacity: 0.22,
            specularSweepOpacity: 0,
            lowerEdgeFeatherPercent: 0,
            cycleDurationSec: 0,
        };
    }

    const effectiveIntensity: 'low' | 'normal' =
        prefersReducedMotion || normalized.intensity === 'low' ? 'low' : 'normal';
    const shouldAnimate = Boolean(isPlaying && isCoverScreenActive && isPageVisible);

    if (effectiveIntensity === 'low') {
        return {
            shouldAnimate,
            effectiveIntensity: 'low',
            cameraDriftPx: shouldAnimate ? 2.2 : 0,
            zoomScaleMin: 1.0,
            zoomScaleMax: shouldAnimate ? 1.018 : 1.0,
            parallaxOffsetPx: shouldAnimate ? 4.0 : 0,
            ambientBloomOpacity: shouldAnimate ? 0.46 : 0.3,
            specularSweepOpacity: shouldAnimate ? 0.08 : 0.03,
            lowerEdgeFeatherPercent: 20,
            cycleDurationSec: 26,
        };
    }

    return {
        shouldAnimate,
        effectiveIntensity: 'normal',
        cameraDriftPx: shouldAnimate ? 5.5 : 0,
        zoomScaleMin: 1.0,
        zoomScaleMax: shouldAnimate ? 1.045 : 1.0,
        parallaxOffsetPx: shouldAnimate ? 9.5 : 0,
        ambientBloomOpacity: shouldAnimate ? 0.68 : 0.38,
        specularSweepOpacity: shouldAnimate ? 0.16 : 0.05,
        lowerEdgeFeatherPercent: 26,
        cycleDurationSec: 18,
    };
};

export const ALBUM_VIDEO_COVERS_STORAGE_KEY = 'folia_album_video_covers_v1';

export const readStoredAlbumVideoCoversEnabled = (): boolean => {
    try {
        const storage = getStorage();
        const raw = storage?.getItem(ALBUM_VIDEO_COVERS_STORAGE_KEY);
        if (raw === null || raw === undefined) {
            return true;
        }
        return raw !== 'false';
    } catch {
        return true;
    }
};

export const writeStoredAlbumVideoCoversEnabled = (enabled: boolean): boolean => {
    const normalized = Boolean(enabled);
    try {
        const storage = getStorage();
        storage?.setItem(ALBUM_VIDEO_COVERS_STORAGE_KEY, normalized ? 'true' : 'false');
    } catch {
        // Ignore storage errors
    }
    return normalized;
};

export interface AlbumVideoStageStateInput {
    albumVideoEnabled: boolean;
    videoStreamUrl: string | null | undefined;
    videoId?: string | null;
    isPlaying: boolean;
    isCoverScreenActive: boolean;
    isPageVisible?: boolean;
    prefersReducedMotion?: boolean;
    videoWidth?: number;
    videoHeight?: number;
    viewportWidth?: number;
    viewportHeight?: number;
}

export interface AlbumVideoStageState {
    shouldShowVideo: boolean;
    shouldPlayVideo: boolean;
    videoKey: string | null;
    scalingMode: 'cover-fill' | 'ambient-framed';
}

/**
 * Resolves full-screen local album video playback, continuity key, battery/visibility pause,
 * and aspect-ratio-aware scaling.
 * - `videoKey` is keyed by the video identity (`videoId` or `videoStreamUrl`), NEVER by `songId`,
 *   so switching between tracks on the same album keeps the `<video>` element playing continuously.
 * - Uses `'ambient-framed'` when a wide landscape video (`aspect > 1.32`) is displayed on a portrait
 *   viewport (`aspect < 0.85`) to fill the screen while avoiding harsh horizontal cropping.
 */
export const resolveAlbumVideoStageState = ({
    albumVideoEnabled,
    videoStreamUrl,
    videoId,
    isPlaying,
    isCoverScreenActive,
    isPageVisible = true,
    prefersReducedMotion = false,
    videoWidth = 0,
    videoHeight = 0,
    viewportWidth = 390,
    viewportHeight = 844,
}: AlbumVideoStageStateInput): AlbumVideoStageState => {
    const hasVideo = Boolean(albumVideoEnabled && videoStreamUrl);
    if (!hasVideo) {
        return {
            shouldShowVideo: false,
            shouldPlayVideo: false,
            videoKey: null,
            scalingMode: 'cover-fill',
        };
    }

    const shouldPlayVideo = Boolean(
        isPlaying
        && isCoverScreenActive
        && isPageVisible
        && !prefersReducedMotion
    );

    const videoAspect = videoWidth > 0 && videoHeight > 0 ? videoWidth / videoHeight : 1;
    const viewportAspect = viewportWidth > 0 && viewportHeight > 0 ? viewportWidth / viewportHeight : 0.46;
    const scalingMode: 'cover-fill' | 'ambient-framed' =
        videoAspect > 1.32 && viewportAspect < 0.85 ? 'ambient-framed' : 'cover-fill';

    return {
        shouldShowVideo: true,
        shouldPlayVideo,
        videoKey: videoId || videoStreamUrl || null,
        scalingMode,
    };
};
