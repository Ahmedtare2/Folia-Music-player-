import { isAndroidNativeApp } from '../../utils/platform';
import {
    buildAndroidSafStreamUrl,
    checkAndroidDirectoryPermission,
    checkAndroidFileReadable,
    extractAndroidAudioMetadata,
    pickAndroidMusicSource,
    readAndroidContentUriBytes,
    resolveAndroidRelativeFile,
    scanAndroidDirectoryTree,
    type FoliaAndroidExtractedMetadata,
    type FoliaSafEntryDescriptor,
} from './foliaAndroidBridge';

// src/services/android/androidSafDirectoryHandle.ts
// Implements FileSystemDirectoryHandle and FileSystemFileHandle over Android's Storage Access
// Framework (SAF) with persisted URI permissions, structured-cloneable IndexedDB persistence,
// bounded header-slice metadata reads, and direct byte-range stream URL resolution.

export interface SerializedAndroidSafDirectoryHandle {
    __foliaAndroidSafHandle: true;
    kind: 'directory';
    name: string;
    treeUri: string;
    documentId: string;
    relativePrefix?: string;
    virtualEntries?: FoliaSafEntryDescriptor[];
}

export interface AndroidSafFileHandle extends FileSystemFileHandle {
    readonly __foliaAndroidSafFileHandle: true;
    readonly kind: 'file';
    readonly name: string;
    readonly contentUri: string;
    readonly treeUri: string;
    readonly documentId: string;
    readonly relativePath: string;
    readonly size: number;
    readonly lastModified: number;
    readonly mimeType: string;
    getStatMetadata(): { name: string; size: number; lastModified: number; type: string };
    canStreamDirectly(): boolean;
    getPlayableStreamUrl(): string;
    verifyReadable(): Promise<boolean>;
    /**
     * Reads only a bounded header slice of the audio file for metadata/tag inspection so
     * multi-megabyte lossless files are never loaded in full into the WebView JS heap.
     */
    getMetadataFile(options?: { includeCover?: boolean; maxBytes?: number }): Promise<File>;
    /**
     * Uses Android's native off-thread MediaMetadataRetriever (when available) to extract
     * tags and downscaled cover art without reading the audio stream into JS memory.
     */
    extractNativeMetadata(options?: { includeCover?: boolean; maxCoverDimension?: number }): Promise<FoliaAndroidExtractedMetadata | null>;
}

export interface AndroidSafDirectoryHandle extends FileSystemDirectoryHandle, Omit<SerializedAndroidSafDirectoryHandle, 'kind' | 'name'> {
    queryPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
    requestPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
    invalidateTreeCache(): void;
}

const normalizeRelativePath = (value: string): string => (
    value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
);

const inferAudioOrLyricMimeType = (fileName: string, providedMime?: string): string => {
    if (providedMime && providedMime !== 'application/octet-stream') {
        return providedMime;
    }
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.mp3')) return 'audio/mpeg';
    if (lower.endsWith('.flac')) return 'audio/flac';
    if (lower.endsWith('.m4a') || lower.endsWith('.aac')) return 'audio/mp4';
    if (lower.endsWith('.alac')) return 'audio/alac';
    if (lower.endsWith('.wav')) return 'audio/wav';
    if (lower.endsWith('.aif') || lower.endsWith('.aiff')) return 'audio/aiff';
    if (lower.endsWith('.caf')) return 'audio/x-caf';
    if (lower.endsWith('.ogg')) return 'audio/ogg';
    if (lower.endsWith('.opus')) return 'audio/opus';
    if (lower.endsWith('.wma')) return 'audio/x-ms-wma';
    if (lower.endsWith('.wv')) return 'audio/x-wavpack';
    if (lower.endsWith('.ape')) return 'audio/x-monkeys-audio';
    if (lower.endsWith('.tta')) return 'audio/x-tta';
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.ttml')) return 'application/ttml+xml';
    if (lower.endsWith('.vtt')) return 'text/vtt';
    return 'text/plain';
};

export const isAndroidSafFileHandle = (handle: unknown): handle is AndroidSafFileHandle => (
    Boolean(handle && typeof handle === 'object' && (handle as AndroidSafFileHandle).__foliaAndroidSafFileHandle === true)
);

export const isAndroidSafDirectoryHandle = (handle: unknown): handle is AndroidSafDirectoryHandle => (
    Boolean(handle && typeof handle === 'object' && (handle as SerializedAndroidSafDirectoryHandle).__foliaAndroidSafHandle === true)
);

/**
 * Shared tree entry cache keyed by `treeUri::documentId` so handle recovery and nested directory
 * lookups reuse the scanned entries in O(1) without triggering repeated native full-tree scans.
 */
const sharedTreeEntriesCache = new Map<string, Promise<FoliaSafEntryDescriptor[]>>();

export const invalidateAndroidSafTreeCache = (treeUri?: string): void => {
    if (!treeUri) {
        sharedTreeEntriesCache.clear();
        return;
    }
    for (const key of Array.from(sharedTreeEntriesCache.keys())) {
        if (key === treeUri || key.startsWith(`${treeUri}::`)) {
            sharedTreeEntriesCache.delete(key);
        }
    }
};

/**
 * Creates a lightweight stat-only File object for initial directory snapshot diffing so scanning
 * a large folder does not read multi-megabyte audio, lyric, or cover payloads into memory before diffing signatures.
 */
const createBrowserOrNodeFile = (
    parts: BlobPart[],
    name: string,
    options: { type: string; lastModified: number },
): File => {
    if (typeof File === 'function') {
        return new File(parts, name, options);
    }
    const blob = new Blob(parts, { type: options.type });
    return Object.assign(blob, {
        name,
        lastModified: options.lastModified,
        webkitRelativePath: '',
    }) as unknown as File;
};

export interface TaggedStatFile extends File {
    readonly __foliaSafStatFile?: boolean;
    readonly __foliaSafHandle?: AndroidSafFileHandle;
}

export const createLightweightStatFile = (handle: AndroidSafFileHandle): TaggedStatFile => {
    const stat = handle.getStatMetadata();
    const file = createBrowserOrNodeFile([], stat.name, {
        type: stat.type,
        lastModified: stat.lastModified,
    }) as TaggedStatFile;
    Object.defineProperty(file, 'size', {
        configurable: true,
        enumerable: true,
        value: stat.size,
    });
    Object.defineProperty(file, '__foliaSafStatFile', {
        configurable: true,
        enumerable: false,
        value: true,
    });
    Object.defineProperty(file, '__foliaSafHandle', {
        configurable: true,
        enumerable: false,
        value: handle,
    });
    return file;
};

/**
 * Resolves a real File with actual bytes if the given File was created via `createLightweightStatFile`
 * during fast snapshot tree traversal.
 */
export const ensureLoadedSafFile = async (file: File): Promise<File> => {
    const tagged = file as TaggedStatFile;
    if (tagged?.__foliaSafStatFile && tagged.__foliaSafHandle) {
        return await tagged.__foliaSafHandle.getFile();
    }
    return file;
};

/** Default bounded header slice sizes for tag-only vs embedded-cover metadata inspection. */
export const METADATA_HEADER_SLICE_NO_COVER_BYTES = 256 * 1024;
export const METADATA_HEADER_SLICE_WITH_COVER_BYTES = 1536 * 1024;

export const createAndroidSafFileHandle = (
    entry: FoliaSafEntryDescriptor,
    treeUri: string,
): AndroidSafFileHandle => {
    const mimeType = inferAudioOrLyricMimeType(entry.name, entry.mimeType);
    const relativePath = normalizeRelativePath(entry.relativePath || entry.name);
    const statSize = Number(entry.size) || 0;
    const statLastModified = Number(entry.lastModified) || 0;

    return {
        __foliaAndroidSafFileHandle: true,
        kind: 'file',
        name: entry.name,
        contentUri: entry.contentUri,
        treeUri,
        documentId: entry.documentId,
        relativePath,
        size: statSize,
        lastModified: statLastModified,
        mimeType,
        getStatMetadata() {
            return {
                name: entry.name,
                size: statSize,
                lastModified: statLastModified,
                type: mimeType,
            };
        },
        canStreamDirectly() {
            return isAndroidNativeApp() && Boolean(entry.contentUri);
        },
        getPlayableStreamUrl() {
            return buildAndroidSafStreamUrl(entry.contentUri, treeUri, mimeType);
        },
        async verifyReadable() {
            const status = await checkAndroidFileReadable(entry.contentUri, treeUri);
            return Boolean(status.readable);
        },
        async getFile(): Promise<File> {
            const bytes = await readAndroidContentUriBytes(entry.contentUri, treeUri, mimeType);
            return createBrowserOrNodeFile([bytes as unknown as BlobPart], entry.name, {
                type: mimeType,
                lastModified: statLastModified || Date.now(),
            });
        },
        async getMetadataFile(options?: { includeCover?: boolean; maxBytes?: number }): Promise<File> {
            const includeCover = options?.includeCover ?? false;
            const defaultMax = includeCover
                ? METADATA_HEADER_SLICE_WITH_COVER_BYTES
                : METADATA_HEADER_SLICE_NO_COVER_BYTES;
            const maxBytes = options?.maxBytes ?? defaultMax;
            const boundedLimit = statSize > 0 ? Math.min(statSize, maxBytes) : maxBytes;
            const bytes = await readAndroidContentUriBytes(entry.contentUri, treeUri, mimeType, {
                offset: 0,
                maxBytes: boundedLimit,
            });
            return createBrowserOrNodeFile([bytes as unknown as BlobPart], entry.name, {
                type: mimeType,
                lastModified: statLastModified || Date.now(),
            });
        },
        async extractNativeMetadata(options?: { includeCover?: boolean; maxCoverDimension?: number }): Promise<FoliaAndroidExtractedMetadata | null> {
            return await extractAndroidAudioMetadata(entry.contentUri, options);
        },
        async isSameEntry(other: FileSystemHandle): Promise<boolean> {
            return isAndroidSafFileHandle(other) && other.contentUri === entry.contentUri;
        },
        createWritable(): Promise<FileSystemWritableFileStream> {
            return Promise.reject(new Error('Read-only Android SAF file handle'));
        },
    } as AndroidSafFileHandle;
};

export const createAndroidSafDirectoryHandle = (
    init: {
        name: string;
        treeUri: string;
        documentId: string;
        relativePrefix?: string;
        virtualEntries?: FoliaSafEntryDescriptor[];
        sharedEntriesLoader?: () => Promise<FoliaSafEntryDescriptor[]>;
    },
): AndroidSafDirectoryHandle => {
    const relativePrefix = normalizeRelativePath(init.relativePrefix || '');
    const rootDocId = init.documentId.includes('/') ? init.documentId.split('/')[0]! : init.documentId;
    const cacheKey = `${init.treeUri}::${rootDocId}`;

    const loadAllTreeEntries = (): Promise<FoliaSafEntryDescriptor[]> => {
        if (init.sharedEntriesLoader) {
            return init.sharedEntriesLoader();
        }
        if (Array.isArray(init.virtualEntries)) {
            return Promise.resolve(init.virtualEntries);
        }
        let cached = sharedTreeEntriesCache.get(cacheKey);
        if (!cached) {
            cached = scanAndroidDirectoryTree(init.treeUri, rootDocId).catch((err) => {
                sharedTreeEntriesCache.delete(cacheKey);
                throw err;
            });
            sharedTreeEntriesCache.set(cacheKey, cached);
        }
        return cached;
    };

    const listDirectChildren = async (): Promise<Array<AndroidSafDirectoryHandle | AndroidSafFileHandle>> => {
        const allEntries = await loadAllTreeEntries();
        const directSubdirectories = new Map<string, FoliaSafEntryDescriptor | null>();
        const directFiles = new Map<string, FoliaSafEntryDescriptor>();

        for (const entry of allEntries) {
            const rel = normalizeRelativePath(entry.relativePath || entry.name);
            if (!rel) continue;

            let remainder: string;
            if (!relativePrefix) {
                remainder = rel;
            } else if (rel.startsWith(`${relativePrefix}/`)) {
                remainder = rel.slice(relativePrefix.length + 1);
            } else {
                continue;
            }

            if (!remainder) continue;
            const slashIndex = remainder.indexOf('/');
            if (slashIndex === -1) {
                if (entry.kind === 'directory') {
                    if (!directSubdirectories.has(remainder)) {
                        directSubdirectories.set(remainder, entry);
                    }
                } else {
                    directFiles.set(remainder, entry);
                }
            } else {
                const childDirName = remainder.slice(0, slashIndex);
                if (childDirName && !directSubdirectories.has(childDirName)) {
                    directSubdirectories.set(childDirName, null);
                }
            }
        }

        const results: Array<AndroidSafDirectoryHandle | AndroidSafFileHandle> = [];

        for (const [dirName, dirDescriptor] of directSubdirectories.entries()) {
            const childPrefix = relativePrefix ? `${relativePrefix}/${dirName}` : dirName;
            results.push(
                createAndroidSafDirectoryHandle({
                    name: dirName,
                    treeUri: init.treeUri,
                    documentId: dirDescriptor?.documentId || `${rootDocId}/${childPrefix}`,
                    relativePrefix: childPrefix,
                    virtualEntries: init.virtualEntries,
                    sharedEntriesLoader: loadAllTreeEntries,
                }),
            );
        }

        for (const [, fileEntry] of directFiles.entries()) {
            results.push(createAndroidSafFileHandle(fileEntry, init.treeUri));
        }

        return results;
    };

    const handle: AndroidSafDirectoryHandle = {
        __foliaAndroidSafHandle: true,
        kind: 'directory',
        name: init.name,
        treeUri: init.treeUri,
        documentId: init.documentId,
        ...(relativePrefix ? { relativePrefix } : {}),
        ...(init.virtualEntries ? { virtualEntries: init.virtualEntries } : {}),

        invalidateTreeCache() {
            invalidateAndroidSafTreeCache(init.treeUri);
        },

        async queryPermission(): Promise<PermissionState> {
            if (Array.isArray(init.virtualEntries) && init.virtualEntries.length > 0 && !init.treeUri.startsWith('content://')) {
                return 'granted';
            }
            const status = await checkAndroidDirectoryPermission(init.treeUri);
            return status.granted && status.exists ? 'granted' : 'prompt';
        },

        async requestPermission(): Promise<PermissionState> {
            if (Array.isArray(init.virtualEntries) && init.virtualEntries.length > 0 && !init.treeUri.startsWith('content://')) {
                return 'granted';
            }
            const status = await checkAndroidDirectoryPermission(init.treeUri);
            return status.granted && status.exists ? 'granted' : 'denied';
        },

        async isSameEntry(other: FileSystemHandle): Promise<boolean> {
            if (!isAndroidSafDirectoryHandle(other)) return false;
            return other.treeUri === init.treeUri
                && normalizeRelativePath(other.relativePrefix || '') === relativePrefix;
        },

        async *values(): AsyncIterableIterator<FileSystemDirectoryHandle | FileSystemFileHandle> {
            const children = await listDirectChildren();
            for (const child of children) {
                yield child;
            }
        },

        async *entries(): AsyncIterableIterator<[string, FileSystemDirectoryHandle | FileSystemFileHandle]> {
            const children = await listDirectChildren();
            for (const child of children) {
                yield [child.name, child];
            }
        },

        async *keys(): AsyncIterableIterator<string> {
            const children = await listDirectChildren();
            for (const child of children) {
                yield child.name;
            }
        },

        async getDirectoryHandle(name: string): Promise<FileSystemDirectoryHandle> {
            const cleanName = normalizeRelativePath(name);
            if (!cleanName) {
                throw new DOMException('Invalid directory name', 'TypeMismatchError');
            }
            const childPrefix = relativePrefix ? `${relativePrefix}/${cleanName}` : cleanName;
            return createAndroidSafDirectoryHandle({
                name: cleanName,
                treeUri: init.treeUri,
                documentId: `${rootDocId}/${childPrefix}`,
                relativePrefix: childPrefix,
                virtualEntries: init.virtualEntries,
                sharedEntriesLoader: loadAllTreeEntries,
            });
        },

        async getFileHandle(name: string): Promise<FileSystemFileHandle> {
            const cleanName = normalizeRelativePath(name);
            const targetRelativePath = relativePrefix ? `${relativePrefix}/${cleanName}` : cleanName;

            if (Array.isArray(init.virtualEntries)) {
                const match = init.virtualEntries.find(
                    entry => entry.kind === 'file' && normalizeRelativePath(entry.relativePath || entry.name) === targetRelativePath,
                );
                if (match) return createAndroidSafFileHandle(match, init.treeUri);
                throw new DOMException(`File not found: ${targetRelativePath}`, 'NotFoundError');
            }

            if (sharedTreeEntriesCache.has(cacheKey)) {
                const entries = await sharedTreeEntriesCache.get(cacheKey)!;
                const match = entries.find(
                    entry => entry.kind === 'file' && normalizeRelativePath(entry.relativePath || entry.name) === targetRelativePath,
                );
                if (match) return createAndroidSafFileHandle(match, init.treeUri);
            }

            const resolved = await resolveAndroidRelativeFile(init.treeUri, targetRelativePath);
            if (resolved && resolved.kind === 'file') {
                return createAndroidSafFileHandle(resolved, init.treeUri);
            }

            // Fallback: check full tree scan in case the provider uses non-hierarchical document IDs.
            const entries = await loadAllTreeEntries();
            const fallbackMatch = entries.find(
                entry => entry.kind === 'file' && normalizeRelativePath(entry.relativePath || entry.name) === targetRelativePath,
            );
            if (fallbackMatch) {
                return createAndroidSafFileHandle(fallbackMatch, init.treeUri);
            }

            throw new DOMException(`File not found in Android SAF tree: ${targetRelativePath}`, 'NotFoundError');
        },

        removeEntry(): Promise<void> {
            return Promise.reject(new DOMException('Read-only Android SAF directory handle', 'NoModificationAllowedError'));
        },

        resolve(): Promise<string[] | null> {
            return Promise.resolve(null);
        },

        [Symbol.asyncIterator]() {
            return handle.entries();
        },
    } as unknown as AndroidSafDirectoryHandle;

    return handle;
};

/** Prompts the user to pick an Android folder or multi-file set and returns an AndroidSafDirectoryHandle. */
export const pickAndroidDirectoryHandle = async (): Promise<AndroidSafDirectoryHandle> => {
    const picked = await pickAndroidMusicSource();
    if (!picked) {
        const abortError = new Error('The user aborted a request.');
        abortError.name = 'AbortError';
        throw abortError;
    }

    if (picked.mode === 'tree') {
        invalidateAndroidSafTreeCache(picked.directory.treeUri);
        return createAndroidSafDirectoryHandle({
            name: picked.directory.name,
            treeUri: picked.directory.treeUri,
            documentId: picked.directory.documentId,
        });
    }

    return createAndroidSafDirectoryHandle({
        name: picked.filesResult.rootName || 'Selected Music',
        treeUri: picked.filesResult.treeUri,
        documentId: picked.filesResult.documentId || 'picked-files',
        virtualEntries: picked.filesResult.files,
    });
};

/** Converts any AndroidSafDirectoryHandle instances in a map to plain JSON objects for IndexedDB storage. */
export const serializeDirHandlesForStorage = (
    handles: Record<string, FileSystemDirectoryHandle>,
): Record<string, FileSystemDirectoryHandle | SerializedAndroidSafDirectoryHandle> => {
    const output: Record<string, FileSystemDirectoryHandle | SerializedAndroidSafDirectoryHandle> = {};
    for (const [rootName, handle] of Object.entries(handles)) {
        if (isAndroidSafDirectoryHandle(handle)) {
            output[rootName] = {
                __foliaAndroidSafHandle: true,
                kind: 'directory',
                name: handle.name,
                treeUri: handle.treeUri,
                documentId: handle.documentId,
                ...(handle.relativePrefix ? { relativePrefix: handle.relativePrefix } : {}),
                ...(handle.virtualEntries ? { virtualEntries: handle.virtualEntries } : {}),
            };
        } else {
            output[rootName] = handle;
        }
    }
    return output;
};

/** Rehydrates serialized Android SAF directory records read from IndexedDB back into live handles. */
export const rehydrateDirHandlesFromStorage = (
    stored: Record<string, FileSystemDirectoryHandle | SerializedAndroidSafDirectoryHandle> | null | undefined,
): Record<string, FileSystemDirectoryHandle> => {
    if (!stored || typeof stored !== 'object') return {};
    const output: Record<string, FileSystemDirectoryHandle> = {};
    for (const [rootName, value] of Object.entries(stored)) {
        if (isAndroidSafDirectoryHandle(value)) {
            output[rootName] = createAndroidSafDirectoryHandle({
                name: value.name || rootName,
                treeUri: value.treeUri,
                documentId: value.documentId || '',
                relativePrefix: value.relativePrefix,
                virtualEntries: value.virtualEntries,
            });
        } else if (value) {
            output[rootName] = value as FileSystemDirectoryHandle;
        }
    }
    return output;
};
