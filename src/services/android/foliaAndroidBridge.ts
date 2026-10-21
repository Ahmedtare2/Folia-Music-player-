import { isAndroidNativeApp } from '../../utils/platform';

// src/services/android/foliaAndroidBridge.ts
// Typed interface and runtime bridge to the native Android Capacitor plugin (FoliaNativeBridgePlugin)
// for Storage Access Framework (SAF) local folder/file access, byte-range media streaming,
// off-thread native metadata/artwork extraction, AndroidX Media3 foreground playback notification,
// and AndroidX WindowInsetsControllerCompat system bar visibility.

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
    checkDirectoryPermission?: (options: { treeUri: string }) => Promise<{ granted: boolean; exists: boolean }>;
    scanDirectoryTree?: (options: { treeUri: string; documentId?: string }) => Promise<{ entries: FoliaSafEntryDescriptor[] }>;
    resolveRelativeFile?: (options: { treeUri: string; relativePath: string }) => Promise<{ entry: FoliaSafEntryDescriptor | null }>;
    checkFileReadable?: (options: { contentUri: string; treeUri?: string }) => Promise<{ readable: boolean; size?: number; lastModified?: number }>;
    readFileBase64?: (options: {
        contentUri: string;
        treeUri?: string;
        offset?: number;
        length?: number;
    }) => Promise<{ data: string; mimeType?: string; size?: number; lastModified?: number }>;
    extractAudioMetadata?: (options: {
        contentUri: string;
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
    }>;
    syncPlaybackState?: (payload: FoliaAndroidPlaybackMetadataPayload) => Promise<void>;
    stopPlaybackService?: () => Promise<void>;
    minimizeApp?: () => Promise<void>;
    setSystemBarsVisibility?: (options: FoliaAndroidSystemBarsConfig) => Promise<FoliaAndroidSystemBarsState>;
    getSystemBarsVisibility?: () => Promise<FoliaAndroidSystemBarsState>;
    addListener?: (
        eventName: 'mediaAction',
        listenerFunc: (event: FoliaAndroidMediaActionEvent) => void,
    ) => Promise<{ remove: () => Promise<void> }> | { remove: () => Promise<void> };
}

export const ANDROID_SAF_STREAM_PATH = '/__folia_saf/stream';
export const ANDROID_VISIBILITY_EVENT = 'folia:native-visibility';
export const ANDROID_SYSTEM_BARS_STATE_EVENT = 'folia:system-bars-state';
export const ANDROID_SYSTEM_INSETS_EVENT = 'folia:system-insets';

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
        };
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
