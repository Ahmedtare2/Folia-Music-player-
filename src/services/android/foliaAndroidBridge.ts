import { isAndroidNativeApp } from '../../utils/platform';

// src/services/android/foliaAndroidBridge.ts
// Typed interface and runtime bridge to the native Android Capacitor plugin (FoliaNativeBridgePlugin)
// for Storage Access Framework (SAF) local folder/file access, 512 KB+ buffered & pre-staged
// byte-range media streaming (context.getCacheDir()/saf_audio_stage/), off-thread native
// metadata/artwork extraction, persistent internal disk caching
// (context.getFilesDir()/media_cache/{covers,lyrics,palettes,index}), 256x256 + 1024x1024 WebP
// cover mipmap generation & native Monet/palette color extraction, AndroidX Media3 foreground
// playback notification, and AndroidX WindowInsetsControllerCompat system bar visibility.

export type FoliaDiskCacheNamespace = 'covers' | 'lyrics' | 'palettes' | 'index';

export interface FoliaDiskCacheStats {
    coversBytes: number;
    lyricsBytes: number;
    palettesBytes: number;
    indexBytes: number;
    totalBytes: number;
}

export interface FoliaCachedCoverAndPaletteResult {
    ok: boolean;
    hit?: boolean;
    assetId?: string;
    cover256Path?: string;
    cover1024Path?: string;
    vibrantColors?: string[];
    representativeColors?: string[];
}

export interface FoliaPrestageSafAudioResult {
    ok: boolean;
    stagedCount: number;
    stagedPaths?: string[];
    cacheDir?: string;
}

export interface FoliaSafPickedDirectory {
    treeUri: string;
    name: string;
    documentId: string;
}

export interface FoliaSafEntryDescriptor {
    name: string;
    relativePath: string;
    kind: 'file' | 'directory';
    documentId: string;
    contentUri: string;
    mimeType: string;
    size: number;
    lastModified: number;
}

export interface FoliaSafPickedFilesResult {
    rootName: string;
    treeUri: string;
    documentId: string;
    files: FoliaSafEntryDescriptor[];
}

export interface FoliaAndroidPlaybackMetadataPayload {
    title: string;
    artist: string;
    album: string;
    artworkUrl?: string | null;
    durationMs: number;
    positionMs: number;
    isPlaying: boolean;
    playbackSpeed?: number;
}

export interface FoliaAndroidExtractedMetadata {
    title?: string;
    artist?: string;
    albumArtist?: string;
    album?: string;
    durationMs?: number;
    bitrate?: number;
    trackNumber?: number;
    discNumber?: number;
    year?: number;
    genre?: string;
    codec?: string;
    cover?: Blob;
    coverAssetId?: string;
    hasEmbeddedCover?: boolean;
    vibrantColors?: string[];
    representativeColors?: string[];
    hasEmbeddedLyrics?: boolean;
    lyrics?: string;
    translationLyrics?: string;
}

export type FoliaAndroidMediaActionType =
    | 'play'
    | 'pause'
    | 'previoustrack'
    | 'nexttrack'
    | 'seekto'
    | 'stop'
    | 'duck'
    | 'unduck';

export interface FoliaAndroidMediaActionEvent {
    action: FoliaAndroidMediaActionType;
    seekTimeMs?: number;
}

export interface FoliaAndroidSystemBarsConfig {
    hideStatusBar: boolean;
    hideNavigationBar: boolean;
}

export interface FoliaAndroidSystemBarsState extends FoliaAndroidSystemBarsConfig {
    supported: boolean;
    behavior?: string;
}

export interface FoliaAndroidLyricProxyResponse {
    ok: boolean;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    bodyText: string;
}

export interface FoliaDisplayRefreshRateInfo {
    refreshRate: number;
    rawRefreshRate?: number;
    vsyncIntervalMs: number;
}

export interface FoliaNativeVisualizerStateOptions {
    enabled: boolean;
    visible: boolean;
    fps?: number;
    vsyncDivider?: 1 | 2;
    dim?: number;
}

export interface FoliaNativeVisualizerPaletteOptions {
    colors: string[];
    transitionMs?: number;
}

export interface FoliaNativeVisualizerEnergyOptions {
    bass: number;
    mid: number;
    high: number;
    isPlaying: boolean;
}

export interface FoliaNativeLoadTrackOptions {
    url: string;
    uri?: string;
    trackId?: string;
    title?: string;
    artist?: string;
    album?: string;
    artworkUrl?: string | null;
    autoPlay?: boolean;
    startPositionMs?: number;
    volume?: number;
    playbackSpeed?: number;
}

export interface FoliaNativePlaybackClockAnchor {
    trackId?: string;
    positionMs: number;
    durationMs?: number;
    bufferedPositionMs?: number;
    elapsedRealtimeMs: number;
    clientPerfNowMs?: number;
    isPlaying: boolean;
    playbackSpeed: number;
    playbackState?: 'idle' | 'buffering' | 'ready' | 'ended';
    ended?: boolean;
    reason?: string;
}


export type FoliaVideoEncoderEntry = {
    name: string;
    mime: string;
    hardware: boolean;
    supports4k: boolean;
    supports4k60?: boolean;
    maxFps4k?: number;
    maxBitrateMbps?: number;
};

export type FoliaVideoEncoderInfo = {
    model?: string;
    sdk?: number;
    soc?: string;
    totalRamMb?: number;
    encoders?: FoliaVideoEncoderEntry[];
};

export interface FoliaNativeBridgePluginContract {
    pickDirectory?: () => Promise<FoliaSafPickedDirectory | { cancelled?: boolean }>;
    pickAudioFiles?: (options?: { mimeType?: string }) => Promise<FoliaSafPickedFilesResult | { cancelled?: boolean }>;
    fetchLyricProxy?: (options: {
        url: string;
        method?: string;
        headers?: Record<string, string>;
        body?: string;
        timeoutMs?: number;
    }) => Promise<FoliaAndroidLyricProxyResponse>;
    readDiskCacheJson?: (options: {
        namespace: FoliaDiskCacheNamespace;
        key: string;
    }) => Promise<{ hit: boolean; json?: string }>;
    writeDiskCacheJson?: (options: {
        namespace: FoliaDiskCacheNamespace;
        key: string;
        json: string;
    }) => Promise<{ ok: boolean; size?: number }>;
    deleteDiskCacheEntry?: (options: {
        namespace: FoliaDiskCacheNamespace;
        key?: string;
    }) => Promise<{ ok: boolean }>;
    getDiskCacheStats?: () => Promise<FoliaDiskCacheStats>;
    getCachedTrackPalette?: (options: {
        trackId?: string;
        albumId?: string;
        contentUri?: string;
        assetId?: string;
        applyToVisualizer?: boolean;
        transitionMs?: number;
    }) => Promise<FoliaCachedCoverAndPaletteResult>;
    cacheCoverAndExtractPalette?: (options: {
        assetId?: string;
        trackId?: string;
        albumId?: string;
        dataBase64?: string;
        contentUri?: string;
    }) => Promise<FoliaCachedCoverAndPaletteResult>;
    prestageSafAudioTracks?: (options: {
        uris: string[];
        contentUri?: string;
    }) => Promise<FoliaPrestageSafAudioResult>;
    checkDirectoryPermission?: (options: { treeUri: string }) => Promise<{ granted: boolean; exists: boolean }>;
    scanDirectoryTree?: (options: { treeUri: string; documentId?: string }) => Promise<{ entries: FoliaSafEntryDescriptor[] }>;
    resolveRelativeFile?: (options: { treeUri: string; relativePath: string }) => Promise<{ entry: FoliaSafEntryDescriptor | null }>;
    checkFileReadable?: (options: { contentUri: string; treeUri?: string }) => Promise<{ readable: boolean; size?: number; lastModified?: number }>;
    getVideoEncoderInfo?: () => Promise<FoliaVideoEncoderInfo>;
    readFileBase64?: (options: {
        contentUri: string;
        treeUri?: string;
        offset?: number;
        length?: number;
    }) => Promise<{ data: string; mimeType?: string; size?: number; lastModified?: number }>;
    extractAudioMetadata?: (options: {
        contentUri: string;
        trackId?: string;
        albumId?: string;
        includeCover?: boolean;
        maxCoverDimension?: number;
    }) => Promise<{
        title?: string;
        artist?: string;
        albumArtist?: string;
        album?: string;
        durationMs?: number;
        bitrate?: number;
        trackNumber?: number;
        discNumber?: number;
        year?: number;
        genre?: string;
        codec?: string;
        coverBase64?: string;
        coverMimeType?: string;
        coverAssetId?: string;
        hasEmbeddedCover?: boolean;
        vibrantColors?: string[];
        representativeColors?: string[];
        hasEmbeddedLyrics?: boolean;
        lyrics?: string;
        translationLyrics?: string;
    }>;
    syncPlaybackState?: (payload: FoliaAndroidPlaybackMetadataPayload) => Promise<void>;
    stopPlaybackService?: () => Promise<void>;
    minimizeApp?: () => Promise<void>;
    setSystemBarsVisibility?: (options: FoliaAndroidSystemBarsConfig) => Promise<FoliaAndroidSystemBarsState>;
    getSystemBarsVisibility?: () => Promise<FoliaAndroidSystemBarsState>;
    getDisplayRefreshRate?: () => Promise<FoliaDisplayRefreshRateInfo>;
    setNativeVisualizerState?: (options: FoliaNativeVisualizerStateOptions) => Promise<{
        ok: boolean;
        enabled?: boolean;
        visible?: boolean;
        fps?: number;
        vsyncDivider?: number;
        refreshRate?: number;
        dim?: number;
    }>;
    setNativeVisualizerPalette?: (options: FoliaNativeVisualizerPaletteOptions) => Promise<{
        ok: boolean;
        colorCount?: number;
        transitionMs?: number;
    }>;
    setNativeVisualizerEnergy?: (options: FoliaNativeVisualizerEnergyOptions) => Promise<{
        ok: boolean;
    }>;
    loadTrack?: (options: FoliaNativeLoadTrackOptions) => Promise<FoliaNativePlaybackClockAnchor & { ok: boolean }>;
    play?: () => Promise<FoliaNativePlaybackClockAnchor & { ok: boolean }>;
    pause?: () => Promise<FoliaNativePlaybackClockAnchor & { ok: boolean }>;
    seekTo?: (options: { positionMs: number }) => Promise<FoliaNativePlaybackClockAnchor & { ok: boolean }>;
    setVolume?: (options: { volume: number }) => Promise<{ ok: boolean; volume?: number }>;
    setPlaybackSpeed?: (options: { playbackSpeed: number; speed?: number }) => Promise<FoliaNativePlaybackClockAnchor & { ok: boolean }>;
    getPlaybackPosition?: () => Promise<FoliaNativePlaybackClockAnchor & { ok: boolean }>;
    addListener?: (
        eventName: 'mediaAction' | 'displayRefreshRateChanged' | 'playbackClockAnchor',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        listenerFunc: (event: any) => void,
    ) => Promise<{ remove: () => Promise<void> }> | { remove: () => Promise<void> };
}

export const ANDROID_SAF_STREAM_PATH = '/__folia_saf/stream';
export const ANDROID_SAF_STREAM_READ_BUFFER_BYTES = 512 * 1024;
export const ANDROID_VISIBILITY_EVENT = 'folia:native-visibility';
export const ANDROID_SYSTEM_BARS_STATE_EVENT = 'folia:system-bars-state';
export const ANDROID_SYSTEM_INSETS_EVENT = 'folia:system-insets';
export const ANDROID_DISPLAY_REFRESH_RATE_EVENT = 'folia:display-refresh-rate';

const getNativePlugin = (): FoliaNativeBridgePluginContract | null => {
    if (typeof globalThis === 'undefined') return null;
    const globalAny = globalThis as {
        __FOLIA_ANDROID_BRIDGE__?: FoliaNativeBridgePluginContract;
        Capacitor?: {
            Plugins?: {
                FoliaNativeBridge?: FoliaNativeBridgePluginContract;
            };
        };
    };
    if (globalAny.__FOLIA_ANDROID_BRIDGE__) {
        return globalAny.__FOLIA_ANDROID_BRIDGE__;
    }
    return globalAny.Capacitor?.Plugins?.FoliaNativeBridge ?? null;
};

/** Whether the native FoliaAndroidBridge plugin (or an injected test bridge) is available. */
export const hasFoliaAndroidBridge = (): boolean => {
    const plugin = getNativePlugin();
    if (!plugin) return false;
    return isAndroidNativeApp() || Boolean((globalThis as { __FOLIA_ANDROID_BRIDGE__?: unknown }).__FOLIA_ANDROID_BRIDGE__);
};

/** Moves the Android Activity to the background when Back is pressed at the root navigation state. */
export const minimizeAndroidApp = async (): Promise<boolean> => {
    const plugin = getNativePlugin();
    if (!plugin?.minimizeApp) return false;
    try {
        await plugin.minimizeApp();
        return true;
    } catch {
        return false;
    }
};

/**
 * Applies native Android system bar visibility via WindowInsetsControllerCompat with
 * BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE. No-ops gracefully on web and desktop.
 */
export const applyAndroidSystemBarsVisibility = async (
    config: FoliaAndroidSystemBarsConfig,
): Promise<FoliaAndroidSystemBarsState> => {
    const plugin = getNativePlugin();
    if (!plugin?.setSystemBarsVisibility) {
        return {
            supported: false,
            hideStatusBar: Boolean(config.hideStatusBar),
            hideNavigationBar: Boolean(config.hideNavigationBar),
        };
    }
    try {
        const res = await plugin.setSystemBarsVisibility({
            hideStatusBar: Boolean(config.hideStatusBar),
            hideNavigationBar: Boolean(config.hideNavigationBar),
        });
        return {
            supported: res?.supported ?? true,
            hideStatusBar: res?.hideStatusBar ?? Boolean(config.hideStatusBar),
            hideNavigationBar: res?.hideNavigationBar ?? Boolean(config.hideNavigationBar),
            behavior: res?.behavior ?? 'SHOW_TRANSIENT_BARS_BY_SWIPE',
        };
    } catch (error) {
        console.warn('[AndroidBridge] Failed to set system bars visibility:', error);
        return {
            supported: false,
            hideStatusBar: Boolean(config.hideStatusBar),
            hideNavigationBar: Boolean(config.hideNavigationBar),
        };
    }
};

/** Queries the current native Android system bar visibility state. */
export const getAndroidSystemBarsVisibility = async (): Promise<FoliaAndroidSystemBarsState> => {
    const plugin = getNativePlugin();
    if (!plugin?.getSystemBarsVisibility) {
        return {
            supported: false,
            hideStatusBar: false,
            hideNavigationBar: false,
        };
    }
    try {
        const res = await plugin.getSystemBarsVisibility();
        return {
            supported: res?.supported ?? true,
            hideStatusBar: Boolean(res?.hideStatusBar),
            hideNavigationBar: Boolean(res?.hideNavigationBar),
            behavior: res?.behavior ?? 'SHOW_TRANSIENT_BARS_BY_SWIPE',
        };
    } catch {
        return {
            supported: false,
            hideStatusBar: false,
            hideNavigationBar: false,
        };
    }
};

/** Builds a same-origin local streaming URL intercepted by FoliaSafStreamHandler with HTTP 206 Range support. */
export const buildAndroidSafStreamUrl = (
    contentUri: string,
    treeUri?: string,
    mimeType?: string,
    fileSize?: number,
): string => {
    const params = new URLSearchParams();
    params.set('uri', contentUri);
    if (treeUri) params.set('treeUri', treeUri);
    if (mimeType) params.set('mime', mimeType);
    if (typeof fileSize === 'number' && Number.isFinite(fileSize) && fileSize > 0) {
        params.set('size', String(Math.floor(fileSize)));
    }
    return `${ANDROID_SAF_STREAM_PATH}?${params.toString()}`;
};

export const isAndroidSafStreamUrl = (url: string | null | undefined): boolean => (
    typeof url === 'string' && (
        url.startsWith(`${ANDROID_SAF_STREAM_PATH}?`)
        || url.includes(`://${typeof location !== 'undefined' ? location.host : 'localhost'}${ANDROID_SAF_STREAM_PATH}?`)
    )
);

/**
 * Pre-stages the currently playing and next queued local SAF audio tracks into
 * context.getCacheDir()/saf_audio_stage/ using a 512 KB copy buffer so playback reads from
 * a contiguous local file instead of making hundreds of SAF ContentProvider IPC calls.
 */
export const prestageAndroidSafAudioTracks = async (
    uris: ReadonlyArray<string | null | undefined>,
): Promise<FoliaPrestageSafAudioResult | null> => {
    const plugin = getNativePlugin();
    if (!plugin?.prestageSafAudioTracks) return null;
    const normalized = Array.from(new Set(
        uris
            .filter((uri): uri is string => typeof uri === 'string' && uri.trim().startsWith('content://'))
            .map(uri => uri.trim()),
    ));
    if (normalized.length === 0) return null;
    try {
        return await plugin.prestageSafAudioTracks({
            uris: normalized,
            contentUri: normalized[0],
        });
    } catch {
        return null;
    }
};

/** Opens the Android SAF folder picker, falling back to multi-file selection if document trees are unsupported. */
export const pickAndroidMusicSource = async (): Promise<
    | { mode: 'tree'; directory: FoliaSafPickedDirectory }
    | { mode: 'files'; filesResult: FoliaSafPickedFilesResult }
    | null
> => {
    const plugin = getNativePlugin();
    if (!plugin) return null;

    if (typeof plugin.pickDirectory === 'function') {
        try {
            const res = await plugin.pickDirectory();
            if (res && 'cancelled' in res && res.cancelled) {
                return null;
            }
            if (res && 'treeUri' in res && typeof res.treeUri === 'string' && res.treeUri.length > 0) {
                return {
                    mode: 'tree',
                    directory: {
                        treeUri: res.treeUri,
                        name: res.name || 'Music',
                        documentId: res.documentId || '',
                    },
                };
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (/cancel|abort/i.test(message)) {
                return null;
            }
            console.warn('[AndroidBridge] SAF directory picker failed, attempting multi-file picker fallback:', error);
        }
    }

    if (typeof plugin.pickAudioFiles === 'function') {
        const res = await plugin.pickAudioFiles();
        if (!res || ('cancelled' in res && res.cancelled)) {
            return null;
        }
        if ('files' in res && Array.isArray(res.files) && res.files.length > 0) {
            return {
                mode: 'files',
                filesResult: res,
            };
        }
    }

    return null;
};

export const checkAndroidDirectoryPermission = async (
    treeUri: string,
): Promise<{ granted: boolean; exists: boolean }> => {
    const plugin = getNativePlugin();
    if (!plugin?.checkDirectoryPermission) {
        return { granted: false, exists: false };
    }
    try {
        return await plugin.checkDirectoryPermission({ treeUri });
    } catch (error) {
        console.warn('[AndroidBridge] Failed to check directory permission:', error);
        return { granted: false, exists: false };
    }
};

export const scanAndroidDirectoryTree = async (
    treeUri: string,
    documentId?: string,
): Promise<FoliaSafEntryDescriptor[]> => {
    const plugin = getNativePlugin();
    if (!plugin?.scanDirectoryTree) return [];
    const response = await plugin.scanDirectoryTree({ treeUri, documentId });
    return Array.isArray(response?.entries) ? response.entries : [];
};

export const resolveAndroidRelativeFile = async (
    treeUri: string,
    relativePath: string,
): Promise<FoliaSafEntryDescriptor | null> => {
    const plugin = getNativePlugin();
    if (!plugin?.resolveRelativeFile) return null;
    try {
        const response = await plugin.resolveRelativeFile({ treeUri, relativePath });
        return response?.entry ?? null;
    } catch (error) {
        console.warn(`[AndroidBridge] Failed to resolve relative file "${relativePath}":`, error);
        return null;
    }
};

export const checkAndroidFileReadable = async (
    contentUri: string,
    treeUri?: string,
): Promise<{ readable: boolean; size?: number; lastModified?: number }> => {
    const plugin = getNativePlugin();
    if (!plugin?.checkFileReadable) {
        return { readable: true };
    }
    try {
        return await plugin.checkFileReadable({ contentUri, treeUri });
    } catch {
        return { readable: false };
    }
};

const decodeBase64ToUint8Array = (base64: string): Uint8Array => {
    const clean = base64.replace(/^data:[^;]+;base64,/, '');
    if (typeof Buffer !== 'undefined') {
        return new Uint8Array(Buffer.from(clean, 'base64'));
    }
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
};

const encodeUint8ArrayToBase64 = (bytes: Uint8Array): string => {
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(bytes).toString('base64');
    }
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const sub = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...sub);
    }
    return btoa(binary);
};

export interface ReadAndroidBytesOptions {
    offset?: number;
    maxBytes?: number;
}

export const readAndroidContentUriBytes = async (
    contentUri: string,
    treeUri?: string,
    mimeType?: string,
    options?: ReadAndroidBytesOptions,
): Promise<Uint8Array> => {
    const plugin = getNativePlugin();
    const offset = typeof options?.offset === 'number' && options.offset > 0 ? Math.floor(options.offset) : 0;
    const maxBytes = typeof options?.maxBytes === 'number' && options.maxBytes > 0 ? Math.floor(options.maxBytes) : undefined;

    if (typeof fetch === 'function' && typeof window !== 'undefined' && isAndroidNativeApp()) {
        try {
            const streamUrl = buildAndroidSafStreamUrl(contentUri, treeUri, mimeType);
            const headers: Record<string, string> = {};
            if (offset > 0 || maxBytes !== undefined) {
                const end = maxBytes !== undefined ? offset + maxBytes - 1 : '';
                headers.Range = `bytes=${offset}-${end}`;
            }
            const response = await fetch(streamUrl, Object.keys(headers).length > 0 ? { headers } : undefined);
            if (response.ok || response.status === 206) {
                const contentType = response.headers?.get?.('content-type') || '';
                if (!contentType.includes('text/html')) {
                    const bytes = new Uint8Array(await response.arrayBuffer());
                    if (maxBytes !== undefined && bytes.byteLength > maxBytes) {
                        return bytes.subarray(offset, offset + maxBytes);
                    }
                    return bytes;
                }
            }
        } catch {
            // Fall through to native base64 reader.
        }
    }

    if (plugin?.readFileBase64) {
        const result = await plugin.readFileBase64({
            contentUri,
            treeUri,
            ...(offset > 0 ? { offset } : {}),
            ...(maxBytes !== undefined ? { length: maxBytes } : {}),
        });
        if (typeof result?.data === 'string') {
            const decoded = decodeBase64ToUint8Array(result.data);
            if (maxBytes !== undefined && decoded.byteLength > maxBytes) {
                return decoded.subarray(0, maxBytes);
            }
            return decoded;
        }
    }

    throw new Error(`Unable to read Android SAF content URI: ${contentUri}`);
};

export const extractAndroidAudioMetadata = async (
    contentUri: string,
    options?: { includeCover?: boolean; maxCoverDimension?: number },
): Promise<FoliaAndroidExtractedMetadata | null> => {
    const plugin = getNativePlugin();
    if (!plugin?.extractAudioMetadata) return null;
    try {
        const res = await plugin.extractAudioMetadata({
            contentUri,
            includeCover: options?.includeCover ?? false,
            maxCoverDimension: options?.maxCoverDimension ?? 512,
        });
        if (!res || typeof res !== 'object') return null;

        let cover: Blob | undefined;
        if (res.coverBase64) {
            const bytes = decodeBase64ToUint8Array(res.coverBase64);
            if (bytes.byteLength > 0) {
                cover = new Blob([bytes as unknown as BlobPart], {
                    type: res.coverMimeType || 'image/jpeg',
                });
            }
        }

        const hasEmbeddedCover = typeof res.hasEmbeddedCover === 'boolean'
            ? res.hasEmbeddedCover
            : (options?.includeCover ? Boolean(cover) : undefined);

        return {
            title: res.title,
            artist: res.artist,
            albumArtist: res.albumArtist,
            album: res.album,
            durationMs: typeof res.durationMs === 'number' && res.durationMs > 0 ? res.durationMs : undefined,
            bitrate: typeof res.bitrate === 'number' && res.bitrate > 0 ? res.bitrate : undefined,
            trackNumber: typeof res.trackNumber === 'number' && res.trackNumber > 0 ? res.trackNumber : undefined,
            discNumber: typeof res.discNumber === 'number' && res.discNumber > 0 ? res.discNumber : undefined,
            year: typeof res.year === 'number' && res.year > 0 ? res.year : undefined,
            genre: res.genre,
            codec: res.codec,
            cover,
            coverAssetId: res.coverAssetId,
            hasEmbeddedCover,
            vibrantColors: Array.isArray(res.vibrantColors) ? res.vibrantColors : undefined,
            representativeColors: Array.isArray(res.representativeColors) ? res.representativeColors : undefined,
            hasEmbeddedLyrics: typeof res.hasEmbeddedLyrics === "boolean" ? res.hasEmbeddedLyrics : Boolean(res.lyrics),
            lyrics: typeof res.lyrics === "string" && res.lyrics.trim() ? res.lyrics : undefined,
            translationLyrics: typeof res.translationLyrics === "string" && res.translationLyrics.trim() ? res.translationLyrics : undefined,
        };
    } catch {
        return null;
    }
};

export const readAndroidDiskCacheJson = async (
    namespace: FoliaDiskCacheNamespace,
    key: string,
): Promise<string | null> => {
    const plugin = getNativePlugin();
    if (!plugin?.readDiskCacheJson || !key) return null;
    try {
        const res = await plugin.readDiskCacheJson({ namespace, key });
        return res?.hit && typeof res.json === 'string' && res.json.length > 0 ? res.json : null;
    } catch {
        return null;
    }
};

export const writeAndroidDiskCacheJson = async (
    namespace: FoliaDiskCacheNamespace,
    key: string,
    json: string,
): Promise<boolean> => {
    const plugin = getNativePlugin();
    if (!plugin?.writeDiskCacheJson || !key || typeof json !== 'string') return false;
    try {
        const res = await plugin.writeDiskCacheJson({ namespace, key, json });
        return Boolean(res?.ok);
    } catch {
        return false;
    }
};

export const deleteAndroidDiskCacheEntry = async (
    namespace: FoliaDiskCacheNamespace,
    key?: string,
): Promise<boolean> => {
    const plugin = getNativePlugin();
    if (!plugin?.deleteDiskCacheEntry) return false;
    try {
        const res = await plugin.deleteDiskCacheEntry({ namespace, key });
        return Boolean(res?.ok);
    } catch {
        return false;
    }
};

export const getAndroidDiskCacheStats = async (): Promise<FoliaDiskCacheStats | null> => {
    const plugin = getNativePlugin();
    if (!plugin?.getDiskCacheStats) return null;
    try {
        return await plugin.getDiskCacheStats();
    } catch {
        return null;
    }
};

export const ANDROID_MEDIA_CACHE_ROOT_DIR = 'folia_media_cache';

export const getCachedAndroidTrackPalette = async (options: {
    trackId?: string;
    albumId?: string;
    contentUri?: string;
    assetId?: string;
    applyToVisualizer?: boolean;
    transitionMs?: number;
}): Promise<FoliaCachedCoverAndPaletteResult | null> => {
    const plugin = getNativePlugin();
    if (!plugin?.getCachedTrackPalette) return null;
    try {
        const res = await plugin.getCachedTrackPalette(options);
        return res?.ok ? res : null;
    } catch {
        return null;
    }
};

export const cacheAndroidCoverAndExtractPalette = async (options: {
    assetId?: string;
    trackId?: string;
    albumId?: string;
    blob?: Blob;
    contentUri?: string;
}): Promise<FoliaCachedCoverAndPaletteResult | null> => {
    const plugin = getNativePlugin();
    if (!plugin?.cacheCoverAndExtractPalette) return null;
    try {
        let dataBase64: string | undefined;
        if (options.blob && options.blob.size > 0) {
            const bytes = new Uint8Array(await options.blob.arrayBuffer());
            dataBase64 = encodeUint8ArrayToBase64(bytes);
        }
        return await plugin.cacheCoverAndExtractPalette({
            assetId: options.assetId,
            trackId: options.trackId,
            albumId: options.albumId,
            dataBase64,
            contentUri: options.contentUri,
        });
    } catch {
        return null;
    }
};

export const syncAndroidPlaybackNotification = async (
    payload: FoliaAndroidPlaybackMetadataPayload,
): Promise<void> => {
    const plugin = getNativePlugin();
    if (!plugin?.syncPlaybackState) return;
    try {
        await plugin.syncPlaybackState(payload);
    } catch (error) {
        console.warn('[AndroidBridge] Failed to sync native playback state:', error);
    }
};

export const stopAndroidPlaybackNotification = async (): Promise<void> => {
    const plugin = getNativePlugin();
    if (!plugin?.stopPlaybackService) return;
    try {
        await plugin.stopPlaybackService();
    } catch (error) {
        console.warn('[AndroidBridge] Failed to stop native playback service:', error);
    }
};

export const subscribeAndroidMediaActions = (
    listener: (event: FoliaAndroidMediaActionEvent) => void,
): (() => void) => {
    const plugin = getNativePlugin();
    if (!plugin?.addListener) return () => {};

    let handlePromise: Promise<{ remove: () => Promise<void> }> | null = null;
    try {
        const maybePromise = plugin.addListener('mediaAction', listener);
        handlePromise = Promise.resolve(maybePromise);
    } catch (error) {
        console.warn('[AndroidBridge] Failed to subscribe to native mediaAction events:', error);
        return () => {};
    }

    return () => {
        if (handlePromise) {
            void handlePromise.then(handle => handle?.remove?.()).catch(() => {});
        }
    };
};

export const hasAndroidLyricProxyBridge = (): boolean => {
    const plugin = getNativePlugin();
    return Boolean(plugin && typeof plugin.fetchLyricProxy === 'function');
};

export const fetchAndroidLyricProxy = async (
    targetUrl: string,
    init?: RequestInit,
): Promise<FoliaAndroidLyricProxyResponse> => {
    const plugin = getNativePlugin();
    if (!plugin?.fetchLyricProxy) {
        throw new Error('Native Android lyric proxy bridge is unavailable');
    }
    const headers: Record<string, string> = {};
    if (init?.headers) {
        if (init.headers instanceof Headers) {
            init.headers.forEach((value, key) => {
                headers[key] = value;
            });
        } else if (Array.isArray(init.headers)) {
            for (const [key, value] of init.headers) {
                headers[String(key)] = String(value);
            }
        } else {
            for (const [key, value] of Object.entries(init.headers as Record<string, unknown>)) {
                if (value !== undefined && value !== null) {
                    headers[key] = String(value);
                }
            }
        }
    }
    const body = typeof init?.body === 'string' ? init.body : undefined;
    return await plugin.fetchLyricProxy({
        url: targetUrl,
        method: init?.method || 'GET',
        headers,
        ...(body !== undefined ? { body } : {}),
    });
};

export const pickAndroidVideoFiles = async (): Promise<FoliaSafPickedFilesResult | null> => {
    const plugin = getNativePlugin();
    if (!plugin?.pickAudioFiles) return null;
    try {
        const res = await plugin.pickAudioFiles({ mimeType: 'video/*' });
        if (!res || ('cancelled' in res && res.cancelled)) {
            return null;
        }
        if ('files' in res && Array.isArray(res.files) && res.files.length > 0) {
            return res;
        }
    } catch (error) {
        console.warn('[AndroidBridge] Failed to pick video files:', error);
    }
    return null;
};

/**
 * Whether the native Android OpenGL background visualizer (FoliaBackgroundSurfaceView) is available.
 */
export const hasAndroidNativeVisualizerBridge = (): boolean => {
    if (!hasFoliaAndroidBridge()) return false;
    const plugin = getNativePlugin();
    return Boolean(
        plugin && (
            typeof plugin.setNativeVisualizerState === 'function'
            || typeof plugin.setNativeVisualizerPalette === 'function'
            || isAndroidNativeApp()
        ),
    );
};

export const applyRootNativeVisualizerTransparency = (active: boolean): void => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const body = document.body;
    if (root) {
        root.setAttribute('data-native-visualizer', active ? 'active' : 'inactive');
        root.style.backgroundColor = active ? 'transparent' : '#09090b';
    }
    if (body) {
        body.setAttribute('data-native-visualizer', active ? 'active' : 'inactive');
        body.style.backgroundColor = active ? 'transparent' : '#09090b';
    }
};

export const getCurrentDisplayRefreshRateHz = (): number => {
    if (typeof globalThis !== 'undefined') {
        const globalAny = globalThis as { __FOLIA_DISPLAY_REFRESH_RATE__?: unknown };
        const raw = Number(globalAny.__FOLIA_DISPLAY_REFRESH_RATE__);
        if (Number.isFinite(raw) && raw >= 30 && raw <= 240) {
            return Math.round(raw);
        }
    }
    return 60;
};

export const getAndroidDisplayRefreshRate = async (): Promise<FoliaDisplayRefreshRateInfo> => {
    const plugin = getNativePlugin();
    if (plugin?.getDisplayRefreshRate) {
        try {
            const info = await plugin.getDisplayRefreshRate();
            if (info && Number.isFinite(info.refreshRate) && info.refreshRate >= 30) {
                const hz = Math.max(30, Math.min(240, Math.round(info.refreshRate)));
                if (typeof globalThis !== 'undefined') {
                    (globalThis as { __FOLIA_DISPLAY_REFRESH_RATE__?: number }).__FOLIA_DISPLAY_REFRESH_RATE__ = hz;
                }
                return {
                    refreshRate: hz,
                    rawRefreshRate: info.rawRefreshRate ?? hz,
                    vsyncIntervalMs: info.vsyncIntervalMs ?? (1000 / hz),
                };
            }
        } catch {
            // Fall through to cached/default refresh rate
        }
    }
    const fallbackHz = getCurrentDisplayRefreshRateHz();
    return {
        refreshRate: fallbackHz,
        rawRefreshRate: fallbackHz,
        vsyncIntervalMs: 1000 / fallbackHz,
    };
};

export const subscribeAndroidDisplayRefreshRate = (
    listener: (info: FoliaDisplayRefreshRateInfo) => void,
): (() => void) => {
    const handleUpdate = (rawHz: unknown, rawExact?: unknown) => {
        const num = Number(rawHz);
        if (!Number.isFinite(num) || num < 30) return;
        const hz = Math.max(30, Math.min(240, Math.round(num)));
        const exact = Number.isFinite(Number(rawExact)) ? Number(rawExact) : hz;
        if (typeof globalThis !== 'undefined') {
            (globalThis as { __FOLIA_DISPLAY_REFRESH_RATE__?: number }).__FOLIA_DISPLAY_REFRESH_RATE__ = hz;
        }
        listener({
            refreshRate: hz,
            rawRefreshRate: exact,
            vsyncIntervalMs: 1000 / exact,
        });
    };

    const domHandler = (event: Event) => {
        const detail = (event as CustomEvent<FoliaDisplayRefreshRateInfo> | undefined)?.detail;
        if (detail) {
            handleUpdate(detail.refreshRate, detail.rawRefreshRate);
        }
    };

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener(ANDROID_DISPLAY_REFRESH_RATE_EVENT, domHandler);
    }

    const plugin = getNativePlugin();
    let handlePromise: Promise<{ remove: () => Promise<void> }> | null = null;
    if (plugin?.addListener) {
        try {
            const maybePromise = plugin.addListener('displayRefreshRateChanged', (ev: FoliaDisplayRefreshRateInfo) => {
                if (ev) {
                    handleUpdate(ev.refreshRate, ev.rawRefreshRate);
                }
            });
            handlePromise = Promise.resolve(maybePromise);
        } catch {
            handlePromise = null;
        }
    }

    return () => {
        if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
            window.removeEventListener(ANDROID_DISPLAY_REFRESH_RATE_EVENT, domHandler);
        }
        if (handlePromise) {
            void handlePromise.then(h => h?.remove?.()).catch(() => {});
        }
    };
};

export const setAndroidNativeVisualizerState = async (
    options: FoliaNativeVisualizerStateOptions,
): Promise<boolean> => {
    const isActive = Boolean(options.enabled && options.visible);
    if (hasFoliaAndroidBridge()) {
        applyRootNativeVisualizerTransparency(isActive);
    }
    const plugin = getNativePlugin();
    if (!plugin?.setNativeVisualizerState) return false;
    try {
        const divider: 1 | 2 = options.vsyncDivider ?? 2;
        const displayHz = getCurrentDisplayRefreshRateHz();
        const resolvedFps = options.fps !== undefined
            ? options.fps
            : (isActive ? Math.max(15, Math.round(displayHz / divider)) : 0);
        const res = await plugin.setNativeVisualizerState({
            enabled: Boolean(options.enabled),
            visible: Boolean(options.visible),
            fps: resolvedFps,
            vsyncDivider: divider,
            dim: options.dim ?? 0.28,
        });
        return Boolean(res?.ok ?? true);
    } catch {
        return false;
    }
};

export const setAndroidNativeVisualizerPalette = async (
    options: FoliaNativeVisualizerPaletteOptions,
): Promise<boolean> => {
    const plugin = getNativePlugin();
    if (!plugin?.setNativeVisualizerPalette) return false;
    const validColors = (options.colors ?? []).filter(c => typeof c === 'string' && c.trim().length > 0);
    if (validColors.length === 0) return false;
    try {
        const res = await plugin.setNativeVisualizerPalette({
            colors: validColors.slice(0, 6),
            transitionMs: options.transitionMs ?? 900,
        });
        return Boolean(res?.ok ?? true);
    } catch {
        return false;
    }
};

export const setAndroidNativeVisualizerEnergy = async (
    options: FoliaNativeVisualizerEnergyOptions,
): Promise<boolean> => {
    const plugin = getNativePlugin();
    if (!plugin?.setNativeVisualizerEnergy) return false;
    try {
        const res = await plugin.setNativeVisualizerEnergy({
            bass: Math.max(0, Math.min(1, Number.isFinite(options.bass) ? options.bass : 0)),
            mid: Math.max(0, Math.min(1, Number.isFinite(options.mid) ? options.mid : 0)),
            high: Math.max(0, Math.min(1, Number.isFinite(options.high) ? options.high : 0)),
            isPlaying: Boolean(options.isPlaying),
        });
        return Boolean(res?.ok ?? true);
    } catch {
        return false;
    }
};

export const buildAndroidVisualizerPalette = (
    song?: {
        vibrantColors?: string[] | null;
        representativeColors?: string[] | null;
    } | null,
    theme?: {
        primaryColor?: string;
        secondaryColor?: string;
        accentColor?: string;
        backgroundColor?: string;
    } | null,
): string[] => {
    const candidates: string[] = [];
    const pushUnique = (color?: string | null) => {
        if (!color || typeof color !== 'string') return;
        const trimmed = color.trim();
        if (!trimmed || trimmed === 'transparent') return;
        if (!candidates.includes(trimmed)) {
            candidates.push(trimmed);
        }
    };

    for (const c of song?.vibrantColors ?? []) pushUnique(c);
    for (const c of song?.representativeColors ?? []) pushUnique(c);
    pushUnique(theme?.accentColor);
    pushUnique(theme?.primaryColor);
    pushUnique(theme?.secondaryColor);
    pushUnique(theme?.backgroundColor);

    const defaults = ['#5b38c7', '#943ddb', '#297ad1', '#1f1a47', '#c2429e', '#2ea3ad'];
    for (const fallback of defaults) {
        if (candidates.length >= 6) break;
        pushUnique(fallback);
    }
    return candidates.slice(0, 6);
};

export const ANDROID_PLAYBACK_CLOCK_ANCHOR_EVENT = 'folia:playback-clock-anchor';

type StampedPlaybackClockAnchor = FoliaNativePlaybackClockAnchor & {
    clientPerfNowMs: number;
};

let latestPlaybackClockAnchor: StampedPlaybackClockAnchor | null = null;
let nativeExoPlayerRoutingActive = false;
const clockAnchorSubscribers = new Set<(anchor: StampedPlaybackClockAnchor) => void>();

const getNowPerfMs = (): number => (
    typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()
);

export const updateAndroidPlaybackClockAnchor = (
    raw: Partial<FoliaNativePlaybackClockAnchor> | null | undefined,
): StampedPlaybackClockAnchor | null => {
    if (!raw || typeof raw !== 'object') return latestPlaybackClockAnchor;
    const nowPerf = getNowPerfMs();
    const prev = latestPlaybackClockAnchor;
    const positionMs = Number.isFinite(Number(raw.positionMs))
        ? Math.max(0, Number(raw.positionMs))
        : (prev?.positionMs ?? 0);
    const durationMs = Number.isFinite(Number(raw.durationMs)) && Number(raw.durationMs) > 0
        ? Math.max(0, Number(raw.durationMs))
        : (prev?.durationMs ?? 0);
    const bufferedPositionMs = Number.isFinite(Number(raw.bufferedPositionMs))
        ? Math.max(positionMs, Number(raw.bufferedPositionMs))
        : Math.max(positionMs, prev?.bufferedPositionMs ?? positionMs);
    const elapsedRealtimeMs = Number.isFinite(Number(raw.elapsedRealtimeMs))
        ? Number(raw.elapsedRealtimeMs)
        : nowPerf;
    const playbackSpeed = Number.isFinite(Number(raw.playbackSpeed)) && Number(raw.playbackSpeed) > 0
        ? Number(raw.playbackSpeed)
        : (prev?.playbackSpeed ?? 1);
    const isPlaying = typeof raw.isPlaying === 'boolean' ? raw.isPlaying : Boolean(prev?.isPlaying);
    const ended = Boolean(raw.ended);

    const stamped: StampedPlaybackClockAnchor = {
        trackId: raw.trackId ?? prev?.trackId ?? '',
        positionMs,
        durationMs,
        bufferedPositionMs,
        elapsedRealtimeMs,
        clientPerfNowMs: Number.isFinite(Number(raw.clientPerfNowMs)) ? Number(raw.clientPerfNowMs) : nowPerf,
        isPlaying,
        playbackSpeed,
        playbackState: raw.playbackState ?? (ended ? 'ended' : (isPlaying ? 'ready' : (prev?.playbackState ?? 'idle'))),
        ended,
        reason: raw.reason ?? 'sync',
    };
    latestPlaybackClockAnchor = stamped;
    clockAnchorSubscribers.forEach(cb => {
        try {
            cb(stamped);
        } catch {
            // Ignore subscriber error
        }
    });
    return stamped;
};

export const hasAndroidNativeExoPlayerBridge = (): boolean => {
    if (!hasFoliaAndroidBridge()) return false;
    const plugin = getNativePlugin();
    return Boolean(plugin && typeof plugin.loadTrack === 'function');
};

export const isAndroidNativeExoPlayerActive = (): boolean => (
    nativeExoPlayerRoutingActive && hasAndroidNativeExoPlayerBridge()
);

export const setAndroidNativeExoPlayerActive = (active: boolean): void => {
    nativeExoPlayerRoutingActive = Boolean(active);
    if (!active) {
        latestPlaybackClockAnchor = null;
    }
};

/**
 * Routes standard Android audio playback through native AndroidX Media3 (ExoPlayer) whenever
 * WebAudio-only DSP features (Stem Separation / Automix / Equalizer) are not active.
 */
export const shouldRouteToAndroidNativeExoPlayer = (options: {
    audioSrc?: string | null;
    automixEnabled?: boolean;
    stemSeparationEnabled?: boolean;
    equalizerEnabled?: boolean;
}): boolean => {
    if (!hasAndroidNativeExoPlayerBridge()) return false;
    if (options.automixEnabled || options.stemSeparationEnabled || options.equalizerEnabled) {
        return false;
    }
    const src = options.audioSrc?.trim() ?? '';
    if (!src) return false;
    // Standard Android SAF streams, content://, file://, and HTTP/HTTPS streams decode in native ExoPlayer.
    return (
        isAndroidSafStreamUrl(src)
        || src.startsWith('content://')
        || src.startsWith('file://')
        || src.startsWith('http://')
        || src.startsWith('https://')
    );
};

export const getLatestAndroidPlaybackClockAnchor = (): StampedPlaybackClockAnchor | null => (
    latestPlaybackClockAnchor
);

/**
 * Computes the sub-millisecond interpolated playback position from the latest native ExoPlayer
 * clock anchor using the high-resolution requestAnimationFrame / performance.now() timestamp,
 * without polling the Capacitor bridge on every frame.
 */
export const getInterpolatedAndroidPlaybackPositionSec = (
    frameNowPerfMs?: number,
): {
    positionSec: number;
    durationSec: number;
    isPlaying: boolean;
    playbackSpeed: number;
    ended: boolean;
} | null => {
    const anchor = latestPlaybackClockAnchor;
    if (!anchor) return null;
    const nowPerf = typeof frameNowPerfMs === 'number' && Number.isFinite(frameNowPerfMs) && frameNowPerfMs > 0
        ? frameNowPerfMs
        : getNowPerfMs();
    const elapsedMs = anchor.isPlaying
        ? Math.max(0, nowPerf - anchor.clientPerfNowMs) * (anchor.playbackSpeed || 1)
        : 0;
    const rawPosMs = anchor.positionMs + elapsedMs;
    const clampedPosMs = anchor.durationMs && anchor.durationMs > 0
        ? Math.min(anchor.durationMs, rawPosMs)
        : rawPosMs;
    return {
        positionSec: Math.max(0, clampedPosMs / 1000),
        durationSec: Math.max(0, (anchor.durationMs ?? 0) / 1000),
        isPlaying: anchor.isPlaying,
        playbackSpeed: anchor.playbackSpeed || 1,
        ended: Boolean(anchor.ended),
    };
};

export const loadAndroidNativeTrack = async (
    options: FoliaNativeLoadTrackOptions,
): Promise<StampedPlaybackClockAnchor | null> => {
    const plugin = getNativePlugin();
    if (!plugin?.loadTrack) return null;
    nativeExoPlayerRoutingActive = true;
    const startPosMs = Math.max(0, Math.round(options.startPositionMs ?? 0));
    const speed = options.playbackSpeed && options.playbackSpeed > 0 ? options.playbackSpeed : 1;
    updateAndroidPlaybackClockAnchor({
        trackId: options.trackId ?? '',
        positionMs: startPosMs,
        durationMs: 0,
        elapsedRealtimeMs: getNowPerfMs(),
        isPlaying: Boolean(options.autoPlay ?? true),
        playbackSpeed: speed,
        playbackState: 'buffering',
        ended: false,
        reason: 'track-change',
    });
    try {
        const res = await plugin.loadTrack({
            ...options,
            uri: options.uri ?? options.url,
            startPositionMs: startPosMs,
            autoPlay: options.autoPlay ?? true,
            volume: options.volume ?? 1,
            playbackSpeed: speed,
        });
        return updateAndroidPlaybackClockAnchor({
            ...res,
            trackId: res?.trackId ?? options.trackId ?? '',
            reason: 'track-change',
        });
    } catch {
        return latestPlaybackClockAnchor;
    }
};

export const playAndroidNativeAudio = async (): Promise<StampedPlaybackClockAnchor | null> => {
    const plugin = getNativePlugin();
    if (!plugin?.play) return null;
    const current = getInterpolatedAndroidPlaybackPositionSec();
    updateAndroidPlaybackClockAnchor({
        positionMs: current ? Math.round(current.positionSec * 1000) : (latestPlaybackClockAnchor?.positionMs ?? 0),
        isPlaying: true,
        ended: false,
        reason: 'play',
    });
    try {
        const res = await plugin.play();
        return updateAndroidPlaybackClockAnchor({ ...res, isPlaying: true, reason: 'play' });
    } catch {
        return latestPlaybackClockAnchor;
    }
};

export const pauseAndroidNativeAudio = async (): Promise<StampedPlaybackClockAnchor | null> => {
    const plugin = getNativePlugin();
    if (!plugin?.pause) return null;
    const current = getInterpolatedAndroidPlaybackPositionSec();
    updateAndroidPlaybackClockAnchor({
        positionMs: current ? Math.round(current.positionSec * 1000) : (latestPlaybackClockAnchor?.positionMs ?? 0),
        isPlaying: false,
        reason: 'pause',
    });
    try {
        const res = await plugin.pause();
        return updateAndroidPlaybackClockAnchor({ ...res, isPlaying: false, reason: 'pause' });
    } catch {
        return latestPlaybackClockAnchor;
    }
};

export const seekAndroidNativeAudio = async (
    positionMs: number,
): Promise<StampedPlaybackClockAnchor | null> => {
    const plugin = getNativePlugin();
    const clampedMs = Math.max(0, Math.round(Number.isFinite(positionMs) ? positionMs : 0));
    updateAndroidPlaybackClockAnchor({
        positionMs: clampedMs,
        ended: false,
        reason: 'seek',
    });
    if (!plugin?.seekTo) return latestPlaybackClockAnchor;
    try {
        const res = await plugin.seekTo({ positionMs: clampedMs });
        return updateAndroidPlaybackClockAnchor({
            ...res,
            positionMs: res?.positionMs ?? clampedMs,
            ended: false,
            reason: 'seek',
        });
    } catch {
        return latestPlaybackClockAnchor;
    }
};

export const setAndroidNativeVolume = async (volume: number): Promise<boolean> => {
    const plugin = getNativePlugin();
    if (!plugin?.setVolume) return false;
    const clamped = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 1));
    try {
        const res = await plugin.setVolume({ volume: clamped });
        return Boolean(res?.ok ?? true);
    } catch {
        return false;
    }
};

export const setAndroidNativePlaybackSpeed = async (
    playbackSpeed: number,
): Promise<StampedPlaybackClockAnchor | null> => {
    const plugin = getNativePlugin();
    const safeSpeed = Math.max(0.25, Math.min(4.0, Number.isFinite(playbackSpeed) && playbackSpeed > 0 ? playbackSpeed : 1));
    const current = getInterpolatedAndroidPlaybackPositionSec();
    updateAndroidPlaybackClockAnchor({
        positionMs: current ? Math.round(current.positionSec * 1000) : (latestPlaybackClockAnchor?.positionMs ?? 0),
        playbackSpeed: safeSpeed,
        reason: 'speed-change',
    });
    if (!plugin?.setPlaybackSpeed) return latestPlaybackClockAnchor;
    try {
        const res = await plugin.setPlaybackSpeed({ playbackSpeed: safeSpeed, speed: safeSpeed });
        return updateAndroidPlaybackClockAnchor({
            ...res,
            playbackSpeed: res?.playbackSpeed ?? safeSpeed,
            reason: 'speed-change',
        });
    } catch {
        return latestPlaybackClockAnchor;
    }
};

export const getAndroidNativePlaybackPosition = async (): Promise<StampedPlaybackClockAnchor | null> => {
    const plugin = getNativePlugin();
    if (!plugin?.getPlaybackPosition) return latestPlaybackClockAnchor;
    try {
        const res = await plugin.getPlaybackPosition();
        return updateAndroidPlaybackClockAnchor(res);
    } catch {
        return latestPlaybackClockAnchor;
    }
};

export const subscribeAndroidPlaybackClockAnchor = (
    listener: (anchor: StampedPlaybackClockAnchor) => void,
): (() => void) => {
    clockAnchorSubscribers.add(listener);

    const domHandler = (event: Event) => {
        const detail = (event as CustomEvent<FoliaNativePlaybackClockAnchor> | undefined)?.detail;
        if (detail) {
            updateAndroidPlaybackClockAnchor(detail);
        }
    };
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener(ANDROID_PLAYBACK_CLOCK_ANCHOR_EVENT, domHandler);
    }

    const plugin = getNativePlugin();
    let handlePromise: Promise<{ remove: () => Promise<void> }> | null = null;
    if (plugin?.addListener) {
        try {
            const maybePromise = plugin.addListener('playbackClockAnchor', (ev: FoliaNativePlaybackClockAnchor) => {
                if (ev) {
                    updateAndroidPlaybackClockAnchor(ev);
                }
            });
            handlePromise = Promise.resolve(maybePromise);
        } catch {
            handlePromise = null;
        }
    }

    return () => {
        clockAnchorSubscribers.delete(listener);
        if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
            window.removeEventListener(ANDROID_PLAYBACK_CLOCK_ANCHOR_EVENT, domHandler);
        }
        if (handlePromise) {
            void handlePromise.then(h => h?.remove?.()).catch(() => {});
        }
    };
};

const patchedElements = new WeakMap<HTMLAudioElement, { unbind: () => void }>();

/**
 * Binds or unbinds an HTMLAudioElement to the native AndroidX Media3 ExoPlayer bridge so all
 * existing transport callers (audioRef.current.play(), .pause(), .currentTime = ..., .volume = ...)
 * operate on the hardware-decoded ExoPlayer instance when WebAudio DSP features are inactive.
 */
export const bindAudioElementToNativeExoPlayer = (
    audioElement: HTMLAudioElement | null,
    active: boolean,
): void => {
    if (!audioElement) return;
    const existing = patchedElements.get(audioElement);
    if (!active) {
        if (existing) {
            existing.unbind();
            patchedElements.delete(audioElement);
        }
        return;
    }
    if (existing) return;

    const proto = Object.getPrototypeOf(audioElement) as Partial<HTMLMediaElement> | null;
    const origPlay = typeof proto?.play === 'function'
        ? proto.play.bind(audioElement)
        : (typeof audioElement.play === 'function' ? audioElement.play.bind(audioElement) : (() => Promise.resolve()));
    const origPause = typeof proto?.pause === 'function'
        ? proto.pause.bind(audioElement)
        : (typeof audioElement.pause === 'function' ? audioElement.pause.bind(audioElement) : (() => {}));
    const mediaProto = typeof HTMLMediaElement !== 'undefined' ? HTMLMediaElement.prototype : proto;
    const currentTimeDesc = mediaProto ? Object.getOwnPropertyDescriptor(mediaProto, 'currentTime') : undefined;
    const durationDesc = mediaProto ? Object.getOwnPropertyDescriptor(mediaProto, 'duration') : undefined;
    const pausedDesc = mediaProto ? Object.getOwnPropertyDescriptor(mediaProto, 'paused') : undefined;
    const endedDesc = mediaProto ? Object.getOwnPropertyDescriptor(mediaProto, 'ended') : undefined;
    const volumeDesc = mediaProto ? Object.getOwnPropertyDescriptor(mediaProto, 'volume') : undefined;
    const mutedDesc = mediaProto ? Object.getOwnPropertyDescriptor(mediaProto, 'muted') : undefined;
    const rateDesc = mediaProto ? Object.getOwnPropertyDescriptor(mediaProto, 'playbackRate') : undefined;

    // Ensure the underlying WebView media element stays silent and paused while ExoPlayer decodes natively.
    try {
        origPause();
        mutedDesc?.set?.call(audioElement, true);
    } catch {
        // Ignore in non-browser test mocks
    }

    let virtualVolume = 1;
    let virtualMuted = false;

    audioElement.play = () => {
        void playAndroidNativeAudio();
        audioElement.dispatchEvent(new Event('play'));
        audioElement.dispatchEvent(new Event('playing'));
        return Promise.resolve();
    };

    audioElement.pause = () => {
        void pauseAndroidNativeAudio();
        audioElement.dispatchEvent(new Event('pause'));
    };

    Object.defineProperty(audioElement, 'currentTime', {
        configurable: true,
        get: () => getInterpolatedAndroidPlaybackPositionSec()?.positionSec ?? (currentTimeDesc?.get?.call(audioElement) ?? 0),
        set: (val: number) => {
            const safeSec = Math.max(0, Number.isFinite(val) ? val : 0);
            void seekAndroidNativeAudio(Math.round(safeSec * 1000));
            audioElement.dispatchEvent(new Event('timeupdate'));
            audioElement.dispatchEvent(new Event('seeked'));
        },
    });

    Object.defineProperty(audioElement, 'duration', {
        configurable: true,
        get: () => {
            const interp = getInterpolatedAndroidPlaybackPositionSec();
            if (interp && interp.durationSec > 0) return interp.durationSec;
            return durationDesc?.get?.call(audioElement) ?? 0;
        },
    });

    Object.defineProperty(audioElement, 'paused', {
        configurable: true,
        get: () => {
            const interp = getInterpolatedAndroidPlaybackPositionSec();
            return interp ? !interp.isPlaying : true;
        },
    });

    Object.defineProperty(audioElement, 'ended', {
        configurable: true,
        get: () => Boolean(getInterpolatedAndroidPlaybackPositionSec()?.ended),
    });

    Object.defineProperty(audioElement, 'volume', {
        configurable: true,
        get: () => virtualVolume,
        set: (val: number) => {
            virtualVolume = Math.max(0, Math.min(1, Number.isFinite(val) ? val : 1));
            void setAndroidNativeVolume(virtualMuted ? 0 : virtualVolume);
        },
    });

    Object.defineProperty(audioElement, 'muted', {
        configurable: true,
        get: () => virtualMuted,
        set: (val: boolean) => {
            virtualMuted = Boolean(val);
            void setAndroidNativeVolume(virtualMuted ? 0 : virtualVolume);
        },
    });

    Object.defineProperty(audioElement, 'playbackRate', {
        configurable: true,
        get: () => getInterpolatedAndroidPlaybackPositionSec()?.playbackSpeed ?? (rateDesc?.get?.call(audioElement) ?? 1),
        set: (val: number) => {
            const safeRate = Math.max(0.25, Math.min(4.0, Number.isFinite(val) && val > 0 ? val : 1));
            void setAndroidNativePlaybackSpeed(safeRate);
        },
    });

    const unbindSub = subscribeAndroidPlaybackClockAnchor((anchor) => {
        if (anchor.reason === 'ready' || anchor.reason === 'track-change') {
            audioElement.dispatchEvent(new Event('durationchange'));
            audioElement.dispatchEvent(new Event('loadedmetadata'));
        }
        if (anchor.reason === 'play') {
            audioElement.dispatchEvent(new Event('play'));
            audioElement.dispatchEvent(new Event('playing'));
        } else if (anchor.reason === 'pause') {
            audioElement.dispatchEvent(new Event('pause'));
        } else if (anchor.reason === 'seek') {
            audioElement.dispatchEvent(new Event('seeked'));
        }
        audioElement.dispatchEvent(new Event('timeupdate'));
        if (anchor.ended) {
            audioElement.dispatchEvent(new Event('ended'));
        }
    });

    patchedElements.set(audioElement, {
        unbind: () => {
            unbindSub();
            delete (audioElement as { play?: unknown }).play;
            delete (audioElement as { pause?: unknown }).pause;
            for (const prop of ['currentTime', 'duration', 'paused', 'ended', 'volume', 'muted', 'playbackRate']) {
                delete (audioElement as unknown as Record<string, unknown>)[prop];
            }
            try {
                mutedDesc?.set?.call(audioElement, false);
            } catch {
                // Ignore
            }
            void origPlay;
        },
    });
};

/** Stage 0 of the 4K video export: what the phone's native video encoders can do. Null when the native part is missing. */
export const getNativeVideoEncoderInfo = async (): Promise<FoliaVideoEncoderInfo | null> => {
    const plugin = getNativePlugin();
    if (!plugin?.getVideoEncoderInfo) return null;
    return plugin.getVideoEncoderInfo();
};
