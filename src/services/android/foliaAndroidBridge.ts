import { isAndroidNativeApp } from '../../utils/platform';

// src/services/android/foliaAndroidBridge.ts
// Typed interface and runtime bridge to the native Android Capacitor plugin (FoliaNativeBridgePlugin)
// for Storage Access Framework (SAF) local folder/file access, byte-range media streaming,
// off-thread native metadata/artwork extraction, and AndroidX Media3 foreground playback notification.

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
    album?: string;
    durationMs?: number;
    bitrate?: number;
    trackNumber?: number;
    discNumber?: number;
    cover?: Blob;
    coverAssetId?: string;
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

export interface FoliaNativeBridgePluginContract {
    pickDirectory?: () => Promise<FoliaSafPickedDirectory | { cancelled?: boolean }>;
    pickAudioFiles?: () => Promise<FoliaSafPickedFilesResult | { cancelled?: boolean }>;
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
        album?: string;
        durationMs?: number;
        bitrate?: number;
        trackNumber?: number;
        discNumber?: number;
        coverBase64?: string;
        coverMimeType?: string;
        coverAssetId?: string;
    }>;
    syncPlaybackState?: (payload: FoliaAndroidPlaybackMetadataPayload) => Promise<void>;
    stopPlaybackService?: () => Promise<void>;
    minimizeApp?: () => Promise<void>;
    addListener?: (
        eventName: 'mediaAction',
        listenerFunc: (event: FoliaAndroidMediaActionEvent) => void,
    ) => Promise<{ remove: () => Promise<void> }> | { remove: () => Promise<void> };
}

export const ANDROID_SAF_STREAM_PATH = '/__folia_saf/stream';
export const ANDROID_VISIBILITY_EVENT = 'folia:native-visibility';

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

/**
 * Reads the raw bytes (or a bounded byte slice) of an Android SAF content:// URI via local
 * HTTP 206 stream fetch or native base64 bridge fallback.
 */
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

/**
 * Extracts audio metadata and downscaled embedded cover artwork via Android's native
 * MediaMetadataRetriever when available on the bridge.
 */
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

        return {
            title: res.title,
            artist: res.artist,
            album: res.album,
            durationMs: typeof res.durationMs === 'number' && res.durationMs > 0 ? res.durationMs : undefined,
            bitrate: typeof res.bitrate === 'number' && res.bitrate > 0 ? res.bitrate : undefined,
            trackNumber: typeof res.trackNumber === 'number' && res.trackNumber > 0 ? res.trackNumber : undefined,
            discNumber: typeof res.discNumber === 'number' && res.discNumber > 0 ? res.discNumber : undefined,
            cover,
            coverAssetId: res.coverAssetId,
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
            void handlePromise.then(handle => handle?.remove?.()).catch(() => undefined);
        }
    };
};
