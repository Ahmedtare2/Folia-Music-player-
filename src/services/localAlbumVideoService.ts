import { getDirHandles, getFromCache, saveToCache } from './db';
import { createSafeObjectUrl } from '../utils/blobGuards';
import {
    buildAndroidSafStreamUrl,
    checkAndroidFileReadable,
    hasFoliaAndroidBridge,
    pickAndroidVideoFiles,
} from './android/foliaAndroidBridge';
import {
    createAndroidSafFileHandle,
    isAndroidSafDirectoryHandle,
    isAndroidSafFileHandle,
    pickAndroidDirectoryHandle,
    rehydrateDirHandlesFromStorage,
    serializeDirHandlesForStorage,
    type SerializedAndroidSafDirectoryHandle,
} from './android/androidSafDirectoryHandle';

// src/services/localAlbumVideoService.ts
// Persistent local album video index, filename-to-album matcher, manual override store,
// and O(1) stream URL resolver integrated with Folia's persistent IndexedDB & Android SAF storage.

export const LOCAL_ALBUM_VIDEOS_STORAGE_KEY = 'local_album_videos_v1';
export const LOCAL_ALBUM_VIDEO_LINKS_STORAGE_KEY = 'local_album_video_links_v1';
export const LOCAL_VIDEO_DIR_HANDLES_STORAGE_KEY = 'local_video_dir_handles';
export const LOCAL_ALBUM_VIDEOS_UPDATED_EVENT = 'folia-local-album-videos-updated';

export const KNOWN_ALBUM_VIDEO_EXTENSIONS = /\.(mp4|webm|mkv|m4v|mov|3gp)$/i;

const VIDEO_EXTENSION_MIME_MAP: Record<string, string> = {
    mp4: 'video/mp4',
    m4v: 'video/mp4',
    webm: 'video/webm',
    mkv: 'video/x-matroska',
    mov: 'video/quicktime',
    '3gp': 'video/3gpp',
};

const VIDEO_FORMAT_RANK: Record<string, number> = {
    mp4: 6,
    webm: 5,
    m4v: 4,
    mov: 3,
    mkv: 2,
    '3gp': 1,
};

const FOLDER_COVER_VIDEO_STEMS = new Set([
    'cover',
    'album',
    'canvas',
    'motion',
    'animated',
    'loop',
    'artwork',
]);

export interface LocalAlbumVideoEntry {
    id: string;
    fileName: string;
    filePath: string;
    folderName: string;
    rootFolderName: string;
    mimeType: string;
    fileSize: number;
    fileLastModified: number;
    fileSignature: string;
    normalizedStem: string;
    strippedStem: string;
    formatRank: number;
    safContentUri?: string;
    safTreeUri?: string;
    safDocumentId?: string;
    addedAt: number;
}

export interface LocalAlbumVideoAssociation {
    albumKey: string;
    albumName: string;
    artistName?: string;
    /** null means user explicitly unlinked/disabled video for this album */
    videoId: string | null;
    origin: 'auto' | 'manual';
    videoSignature?: string;
    updatedAt: number;
}

export interface AlbumVideoResolutionResult {
    albumKey: string;
    video: LocalAlbumVideoEntry | null;
    streamUrl: string | null;
    origin: 'auto' | 'manual' | 'none';
    ambiguousCandidates: LocalAlbumVideoEntry[];
}

export interface VideoSnapshotFileDescriptor {
    name: string;
    relativePath: string;
    folderName?: string;
    size: number;
    lastModified: number;
    mimeType?: string;
    handle?: FileSystemFileHandle;
    safContentUri?: string;
    safTreeUri?: string;
    safDocumentId?: string;
}

const videoEntriesById = new Map<string, LocalAlbumVideoEntry>();
const associationsByAlbumKey = new Map<string, LocalAlbumVideoAssociation>();
const inMemoryVideoFileHandles = new Map<string, FileSystemFileHandle>();
const activeVideoBlobUrls = new Map<string, { url: string; signature: string }>();
const MAX_CACHED_VIDEO_BLOB_URLS = 24;

let catalogHydrated = false;
let catalogHydrationPromise: Promise<void> | null = null;

const notifyAlbumVideosUpdated = (): void => {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent(LOCAL_ALBUM_VIDEOS_UPDATED_EVENT));
    }
};

export const isAlbumVideoFileName = (fileName: string): boolean => (
    KNOWN_ALBUM_VIDEO_EXTENSIONS.test(fileName.trim())
);

export const resolveVideoMimeType = (fileName: string, explicitMime?: string): string => {
    if (explicitMime && explicitMime.startsWith('video/')) {
        return explicitMime;
    }
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    return VIDEO_EXTENSION_MIME_MAP[ext] || 'video/mp4';
};

export const getVideoFormatRank = (fileName: string): number => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    return VIDEO_FORMAT_RANK[ext] ?? 1;
};

/**
 * Checks whether the current runtime's HTMLVideoElement decoder supports the given video MIME type.
 */
export const isVideoDecoderSupported = (mimeType: string): boolean => {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
        return true;
    }
    try {
        const video = document.createElement('video');
        if (!video || typeof video.canPlayType !== 'function') {
            return true;
        }
        const support = video.canPlayType(mimeType);
        if (support === 'probably' || support === 'maybe') {
            return true;
        }
        // WebView on Android supports H.264/HEVC MP4 and VP8/VP9 WebM natively even when a bare subtype is passed
        if (mimeType === 'video/mp4' || mimeType === 'video/webm' || mimeType === 'video/3gpp') {
            return true;
        }
        return support !== '';
    } catch {
        return true;
    }
};

export const stripVideoExtension = (fileName: string): string => (
    fileName.replace(KNOWN_ALBUM_VIDEO_EXTENSIONS, '').trim()
);

/**
 * Normalizes case, whitespace, punctuation, and Arabic/CJK orthography for album-to-video matching.
 */
export const normalizeAlbumVideoText = (value?: string | null): string => {
    if (!value) return '';
    return value
        .normalize('NFKC')
        .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .toLowerCase()
        .replace(/[_.\-+—–:/\\|()\[\]{}«»"''""،؛؟!?&]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

const EDITION_AND_VIDEO_TAG_PATTERN = /[(\[（【]\s*(?:animated(?:\s+cover|\s+artwork)?|motion(?:\s+cover|\s+artwork)?|album\s+video|canvas|(?:alternate\s+|short\s+|full\s+)?loop|visualizer|ver(?:sion)?\s*\d+|v\d+|deluxe(?:\s+edition|\s+version)?|expanded(?:\s+edition)?|special(?:\s+edition)?|remaster(?:ed)?(?:\s+\d{4})?|explicit|clean|bonus\s+track\s+version|anniversary\s+edition)\s*[)\]）】]/giu;
const TRAILING_TAG_WORDS_PATTERN = /\b(?:animated\s+cover|motion\s+cover|motion\s+artwork|album\s+video|deluxe\s+edition|remastered)\b$/giu;

export const stripAlbumVideoTagsAndNormalize = (value?: string | null): string => {
    if (!value) return '';
    const withoutBrackets = value
        .replace(EDITION_AND_VIDEO_TAG_PATTERN, ' ')
        .replace(TRAILING_TAG_WORDS_PATTERN, ' ');
    return normalizeAlbumVideoText(withoutBrackets) || normalizeAlbumVideoText(value);
};

export const buildNormalizedAlbumKey = (albumName?: string | null): string => {
    const norm = normalizeAlbumVideoText(albumName);
    if (!norm || norm === 'unknown album' || norm === '未知专辑') {
        return '';
    }
    return norm;
};

const hashVideoId = (filePath: string): string => {
    let h = 2166136261;
    for (let i = 0; i < filePath.length; i += 1) {
        h ^= filePath.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return `albvid_${(h >>> 0).toString(16).padStart(8, '0')}`;
};

export const buildLocalAlbumVideoEntry = (
    desc: VideoSnapshotFileDescriptor,
    rootFolderName: string,
): LocalAlbumVideoEntry => {
    const filePath = desc.relativePath.startsWith(`${rootFolderName}/`) || desc.relativePath === rootFolderName
        ? desc.relativePath
        : `${rootFolderName}/${desc.relativePath}`;
    const lastSlash = filePath.lastIndexOf('/');
    const folderName = desc.folderName || (lastSlash > 0 ? filePath.slice(0, lastSlash) : rootFolderName);
    const stem = stripVideoExtension(desc.name);
    const normalizedStem = normalizeAlbumVideoText(stem);
    const strippedStem = stripAlbumVideoTagsAndNormalize(stem);
    const mimeType = resolveVideoMimeType(desc.name, desc.mimeType);
    const fileSignature = `${filePath}::${desc.size}::${desc.lastModified}`;
    const id = hashVideoId(filePath);

    let safContentUri = desc.safContentUri;
    let safTreeUri = desc.safTreeUri;
    let safDocumentId = desc.safDocumentId;
    if (desc.handle && isAndroidSafFileHandle(desc.handle)) {
        safContentUri = desc.handle.contentUri;
        safTreeUri = desc.handle.treeUri;
        safDocumentId = desc.handle.documentId;
    }

    const entry: LocalAlbumVideoEntry = {
        id,
        fileName: desc.name,
        filePath,
        folderName,
        rootFolderName,
        mimeType,
        fileSize: desc.size,
        fileLastModified: desc.lastModified,
        fileSignature,
        normalizedStem,
        strippedStem,
        formatRank: getVideoFormatRank(desc.name),
        ...(safContentUri ? { safContentUri } : {}),
        ...(safTreeUri ? { safTreeUri } : {}),
        ...(safDocumentId ? { safDocumentId } : {}),
        addedAt: Date.now(),
    };

    if (desc.handle) {
        inMemoryVideoFileHandles.set(id, desc.handle);
    }
    return entry;
};

export const ensureLocalAlbumVideoCatalogHydrated = async (): Promise<void> => {
    if (catalogHydrated) return;
    if (catalogHydrationPromise) {
        await catalogHydrationPromise;
        return;
    }
    catalogHydrationPromise = (async () => {
        try {
            const [storedVideos, storedLinks] = await Promise.all([
                getFromCache<LocalAlbumVideoEntry[]>(LOCAL_ALBUM_VIDEOS_STORAGE_KEY),
                getFromCache<Record<string, LocalAlbumVideoAssociation>>(LOCAL_ALBUM_VIDEO_LINKS_STORAGE_KEY),
            ]);
            if (Array.isArray(storedVideos)) {
                for (const video of storedVideos) {
                    if (video && typeof video.id === 'string' && typeof video.filePath === 'string') {
                        videoEntriesById.set(video.id, video);
                    }
                }
            }
            if (storedLinks && typeof storedLinks === 'object') {
                for (const [albumKey, link] of Object.entries(storedLinks)) {
                    if (link && typeof link.albumKey === 'string') {
                        associationsByAlbumKey.set(albumKey, link);
                    }
                }
            }
        } catch (err) {
            console.warn('[AlbumVideo] Failed to hydrate album video catalog:', err);
        } finally {
            catalogHydrated = true;
            catalogHydrationPromise = null;
        }
    })();
    await catalogHydrationPromise;
};

const persistVideoCatalogAndLinks = async (): Promise<void> => {
    try {
        const videos = Array.from(videoEntriesById.values());
        const linksObj: Record<string, LocalAlbumVideoAssociation> = {};
        for (const [key, assoc] of associationsByAlbumKey.entries()) {
            linksObj[key] = assoc;
        }
        await Promise.all([
            saveToCache(LOCAL_ALBUM_VIDEOS_STORAGE_KEY, videos),
            saveToCache(LOCAL_ALBUM_VIDEO_LINKS_STORAGE_KEY, linksObj),
        ]);
    } catch (err) {
        console.warn('[AlbumVideo] Failed to persist album video catalog:', err);
    }
};

export const getRegisteredAlbumVideos = (): LocalAlbumVideoEntry[] => (
    Array.from(videoEntriesById.values()).sort((a, b) => a.fileName.localeCompare(b.fileName))
);

export const getAlbumVideoAssociations = (): LocalAlbumVideoAssociation[] => (
    Array.from(associationsByAlbumKey.values())
);

/**
 * Reconciles the video files discovered inside a root folder (either an imported music folder or a
 * dedicated album video folder) without rescanning any unaffected roots or music tracks.
 */
export const reconcileVideosForRootFolder = async (
    rootFolderName: string,
    discoveredVideos: VideoSnapshotFileDescriptor[],
): Promise<LocalAlbumVideoEntry[]> => {
    await ensureLocalAlbumVideoCatalogHydrated();
    const normalizedRoot = rootFolderName.split('/')[0] || rootFolderName;
    const seenIds = new Set<string>();
    let changed = false;

    for (const desc of discoveredVideos) {
        if (!isAlbumVideoFileName(desc.name)) continue;
        const nextEntry = buildLocalAlbumVideoEntry(desc, normalizedRoot);
        seenIds.add(nextEntry.id);
        const existing = videoEntriesById.get(nextEntry.id);
        if (
            !existing
            || existing.fileSignature !== nextEntry.fileSignature
            || existing.safContentUri !== nextEntry.safContentUri
        ) {
            videoEntriesById.set(nextEntry.id, {
                ...nextEntry,
                addedAt: existing?.addedAt ?? nextEntry.addedAt,
            });
            changed = true;
        }
    }

    // Remove deleted video entries belonging to this rootFolderName
    for (const [id, entry] of Array.from(videoEntriesById.entries())) {
        if (entry.rootFolderName === normalizedRoot && !seenIds.has(id)) {
            videoEntriesById.delete(id);
            inMemoryVideoFileHandles.delete(id);
            const cachedBlob = activeVideoBlobUrls.get(id);
            if (cachedBlob) {
                try {
                    URL.revokeObjectURL(cachedBlob.url);
                } catch {}
                activeVideoBlobUrls.delete(id);
            }
            // Clear auto associations pointing to the removed video; keep manual associations if re-matched
            for (const [albumKey, assoc] of Array.from(associationsByAlbumKey.entries())) {
                if (assoc.videoId === id && assoc.origin === 'auto') {
                    associationsByAlbumKey.delete(albumKey);
                }
            }
            changed = true;
        }
    }

    if (changed) {
        await persistVideoCatalogAndLinks();
        notifyAlbumVideosUpdated();
    }
    return getRegisteredAlbumVideos();
};

export interface ScoredAlbumVideoCandidate {
    video: LocalAlbumVideoEntry;
    score: number;
    reason: 'exact-album' | 'exact-artist-album' | 'folder-cover' | 'stripped-album' | 'artist-album-tokens' | 'partial-album';
}

/**
 * Scores all registered local videos against an album name, optional artist name, and optional track folder.
 */
export const scoreAlbumVideoCandidates = (
    albumName: string,
    artistName?: string,
    trackFolderName?: string,
    videos: readonly LocalAlbumVideoEntry[] = Array.from(videoEntriesById.values()),
): ScoredAlbumVideoCandidate[] => {
    const normAlbum = buildNormalizedAlbumKey(albumName);
    const strippedAlbum = stripAlbumVideoTagsAndNormalize(albumName);
    const normArtist = normalizeAlbumVideoText(artistName);
    const strippedArtist = stripAlbumVideoTagsAndNormalize(artistName);

    const artistPlusAlbum = normArtist && normAlbum ? normalizeAlbumVideoText(`${artistName} ${albumName}`) : '';
    const albumPlusArtist = normArtist && normAlbum ? normalizeAlbumVideoText(`${albumName} ${artistName}`) : '';
    const strippedArtistPlusAlbum = strippedArtist && strippedAlbum
        ? normalizeAlbumVideoText(`${strippedArtist} ${strippedAlbum}`)
        : '';

    const scored: ScoredAlbumVideoCandidate[] = [];

    for (const video of videos) {
        if (!isVideoDecoderSupported(video.mimeType)) {
            continue;
        }
        const vNorm = video.normalizedStem;
        const vStripped = video.strippedStem || stripAlbumVideoTagsAndNormalize(video.fileName.replace(KNOWN_ALBUM_VIDEO_EXTENSIONS, ''));
        if (!vNorm) continue;

        let score = 0;
        let reason: ScoredAlbumVideoCandidate['reason'] = 'partial-album';

        if (normAlbum && vNorm === normAlbum) {
            score = 100;
            reason = 'exact-album';
        } else if (artistPlusAlbum && (vNorm === artistPlusAlbum || vNorm === albumPlusArtist)) {
            score = 98;
            reason = 'exact-artist-album';
        } else if (
            trackFolderName
            && video.folderName === trackFolderName
            && (FOLDER_COVER_VIDEO_STEMS.has(vNorm) || (normAlbum && vNorm === normAlbum))
        ) {
            score = 96;
            reason = 'folder-cover';
        } else if (strippedAlbum && strippedAlbum.length >= 2 && vStripped === strippedAlbum) {
            score = 92;
            reason = 'stripped-album';
        } else if (strippedArtistPlusAlbum && vStripped === strippedArtistPlusAlbum) {
            score = 91;
            reason = 'exact-artist-album';
        } else if (
            strippedAlbum
            && strippedAlbum.length >= 3
            && strippedArtist
            && strippedArtist.length >= 2
            && vStripped.includes(strippedAlbum)
            && vStripped.includes(strippedArtist)
        ) {
            score = 86;
            reason = 'artist-album-tokens';
        } else if (
            strippedAlbum
            && strippedAlbum.length >= 4
            && (vStripped.startsWith(`${strippedAlbum} `) || vStripped.endsWith(` ${strippedAlbum}`))
            && (strippedAlbum.length / Math.max(1, vStripped.length)) >= 0.55
        ) {
            score = 80;
            reason = 'partial-album';
        }

        if (score > 0) {
            // Tie-break slightly by preferred decoder format (.mp4 > .webm > ...) without blurring score tiers
            scored.push({
                video,
                score: score + video.formatRank * 0.05,
                reason,
            });
        }
    }

    return scored.sort((a, b) => b.score - a.score);
};

/**
 * Resolves a playable stream URL (Android SAF HTTP 206 stream or cached Blob URL) for a local video entry.
 * Never copies the video file into app storage.
 */
export const resolvePlayableVideoUrl = async (video: LocalAlbumVideoEntry): Promise<string | null> => {
    // 1. Fast path on Android SAF: stream directly over https://localhost/__folia_saf/stream with Os.lseek
    if (video.safContentUri && hasFoliaAndroidBridge()) {
        const check = await checkAndroidFileReadable(video.safContentUri, video.safTreeUri);
        if (!check.readable) {
            return null;
        }
        return buildAndroidSafStreamUrl(
            video.safContentUri,
            video.safTreeUri,
            video.mimeType,
            video.fileSize,
        );
    }

    // 2. Check cached object URL if signature is unchanged
    const cachedBlob = activeVideoBlobUrls.get(video.id);
    if (cachedBlob && cachedBlob.signature === video.fileSignature) {
        activeVideoBlobUrls.delete(video.id);
        activeVideoBlobUrls.set(video.id, cachedBlob);
        return cachedBlob.url;
    }

    // 3. Resolve FileSystemFileHandle from memory or persisted video/music directory handles
    let handle = inMemoryVideoFileHandles.get(video.id);
    if (!handle && video.safContentUri && video.safTreeUri && hasFoliaAndroidBridge()) {
        handle = createAndroidSafFileHandle(
            {
                name: video.fileName,
                relativePath: video.filePath,
                kind: 'file',
                documentId: video.safDocumentId || video.safContentUri,
                contentUri: video.safContentUri,
                mimeType: video.mimeType,
                size: video.fileSize,
                lastModified: video.fileLastModified,
            },
            video.safTreeUri,
        );
        inMemoryVideoFileHandles.set(video.id, handle);
    }

    if (!handle) {
        handle = (await recoverVideoHandleFromPersistedDirs(video)) ?? undefined;
    }
    if (!handle) {
        return null;
    }

    if (isAndroidSafFileHandle(handle) && handle.canStreamDirectly()) {
        const readable = await handle.verifyReadable();
        if (!readable) return null;
        return handle.getPlayableStreamUrl();
    }

    try {
        const file = await handle.getFile();
        const url = createSafeObjectUrl(file);
        if (!url) return null;
        activeVideoBlobUrls.set(video.id, { url, signature: video.fileSignature });
        if (activeVideoBlobUrls.size > MAX_CACHED_VIDEO_BLOB_URLS) {
            const oldestKey = activeVideoBlobUrls.keys().next().value;
            if (oldestKey !== undefined && oldestKey !== video.id) {
                const old = activeVideoBlobUrls.get(oldestKey);
                activeVideoBlobUrls.delete(oldestKey);
                if (old) {
                    try {
                        URL.revokeObjectURL(old.url);
                    } catch {}
                }
            }
        }
        return url;
    } catch (err) {
        console.warn(`[AlbumVideo] Failed to open video file "${video.filePath}":`, err);
        return null;
    }
};

const getPersistedVideoDirHandles = async (): Promise<Record<string, FileSystemDirectoryHandle>> => {
    const raw = await getFromCache<Record<string, FileSystemDirectoryHandle | SerializedAndroidSafDirectoryHandle>>(
        LOCAL_VIDEO_DIR_HANDLES_STORAGE_KEY,
    );
    return rehydrateDirHandlesFromStorage(raw);
};

const savePersistedVideoDirHandles = async (handles: Record<string, FileSystemDirectoryHandle>): Promise<void> => {
    await saveToCache(LOCAL_VIDEO_DIR_HANDLES_STORAGE_KEY, serializeDirHandlesForStorage(handles));
};

const recoverVideoHandleFromPersistedDirs = async (
    video: LocalAlbumVideoEntry,
): Promise<FileSystemFileHandle | null> => {
    const [videoDirHandles, musicDirHandles] = await Promise.all([
        getPersistedVideoDirHandles(),
        getDirHandles(),
    ]);
    const rootHandle = videoDirHandles[video.rootFolderName] || musicDirHandles[video.rootFolderName];
    if (!rootHandle) return null;

    const relativeFromRoot = video.filePath.startsWith(`${video.rootFolderName}/`)
        ? video.filePath.slice(video.rootFolderName.length + 1)
        : video.filePath;
    const segments = relativeFromRoot.split('/').filter(Boolean);
    if (segments.length === 0) return null;

    try {
        let dir = rootHandle;
        for (let i = 0; i < segments.length - 1; i += 1) {
            dir = await dir.getDirectoryHandle(segments[i]!);
        }
        const fileHandle = await dir.getFileHandle(segments[segments.length - 1]!);
        inMemoryVideoFileHandles.set(video.id, fileHandle);
        if (isAndroidSafFileHandle(fileHandle)) {
            video.safContentUri = fileHandle.contentUri;
            video.safTreeUri = fileHandle.treeUri;
            video.safDocumentId = fileHandle.documentId;
        }
        return fileHandle;
    } catch {
        return null;
    }
};

/**
 * Resolves the local album video for a playing track's album.
 * - Uses persisted manual or confirmed auto association in O(1) when valid.
 * - Otherwise runs candidate matching once, persists the confirmed association, and returns the playable stream URL.
 */
export const resolveAlbumVideoForTrack = async (params: {
    albumName?: string | null;
    artistName?: string | null;
    folderName?: string | null;
}): Promise<AlbumVideoResolutionResult> => {
    await ensureLocalAlbumVideoCatalogHydrated();
    const albumKey = buildNormalizedAlbumKey(params.albumName);
    if (!albumKey && !params.folderName) {
        return {
            albumKey: '',
            video: null,
            streamUrl: null,
            origin: 'none',
            ambiguousCandidates: [],
        };
    }

    const effectiveKey = albumKey || `folder:${normalizeAlbumVideoText(params.folderName)}`;
    const existingAssoc = associationsByAlbumKey.get(effectiveKey);

    if (existingAssoc) {
        // Explicit user unlink/disable for this album
        if (existingAssoc.origin === 'manual' && existingAssoc.videoId === null) {
            return {
                albumKey: effectiveKey,
                video: null,
                streamUrl: null,
                origin: 'manual',
                ambiguousCandidates: [],
            };
        }
        if (existingAssoc.videoId) {
            const linkedVideo = videoEntriesById.get(existingAssoc.videoId);
            if (linkedVideo) {
                const streamUrl = await resolvePlayableVideoUrl(linkedVideo);
                if (streamUrl) {
                    const scored = scoreAlbumVideoCandidates(
                        params.albumName || '',
                        params.artistName || undefined,
                        params.folderName || undefined,
                    );
                    const ambiguousCandidates = scored
                        .filter(item => item.score >= 78)
                        .map(item => item.video);
                    return {
                        albumKey: effectiveKey,
                        video: linkedVideo,
                        streamUrl,
                        origin: existingAssoc.origin,
                        ambiguousCandidates: ambiguousCandidates.length > 1 ? ambiguousCandidates : [],
                    };
                }
            }
            // Stored video was removed or became unreadable; clear stale auto link
            if (existingAssoc.origin === 'auto') {
                associationsByAlbumKey.delete(effectiveKey);
            }
        }
    }

    const candidates = scoreAlbumVideoCandidates(
        params.albumName || '',
        params.artistName || undefined,
        params.folderName || undefined,
    );
    if (candidates.length === 0) {
        return {
            albumKey: effectiveKey,
            video: null,
            streamUrl: null,
            origin: 'none',
            ambiguousCandidates: [],
        };
    }

    const ambiguousCandidates = candidates
        .filter(item => item.score >= 78)
        .map(item => item.video);

    for (const candidate of candidates) {
        const streamUrl = await resolvePlayableVideoUrl(candidate.video);
        if (streamUrl) {
            associationsByAlbumKey.set(effectiveKey, {
                albumKey: effectiveKey,
                albumName: params.albumName || '',
                artistName: params.artistName || undefined,
                videoId: candidate.video.id,
                origin: 'auto',
                videoSignature: candidate.video.fileSignature,
                updatedAt: Date.now(),
            });
            await persistVideoCatalogAndLinks();
            return {
                albumKey: effectiveKey,
                video: candidate.video,
                streamUrl,
                origin: 'auto',
                ambiguousCandidates: ambiguousCandidates.length > 1 ? ambiguousCandidates : [],
            };
        }
    }

    return {
        albumKey: effectiveKey,
        video: null,
        streamUrl: null,
        origin: 'none',
        ambiguousCandidates: [],
    };
};

/**
 * Manually assigns (or unlinks when `videoId === null`) a specific local video for an album and persists the choice.
 */
export const assignVideoToAlbum = async (
    albumName: string,
    videoId: string | null,
    artistName?: string,
    folderName?: string,
): Promise<LocalAlbumVideoAssociation | null> => {
    await ensureLocalAlbumVideoCatalogHydrated();
    const albumKey = buildNormalizedAlbumKey(albumName) || (folderName ? `folder:${normalizeAlbumVideoText(folderName)}` : '');
    if (!albumKey) return null;

    const video = videoId ? videoEntriesById.get(videoId) : null;
    const assoc: LocalAlbumVideoAssociation = {
        albumKey,
        albumName,
        artistName,
        videoId: video ? video.id : null,
        origin: 'manual',
        videoSignature: video?.fileSignature,
        updatedAt: Date.now(),
    };
    associationsByAlbumKey.set(albumKey, assoc);
    await persistVideoCatalogAndLinks();
    notifyAlbumVideosUpdated();
    return assoc;
};

/**
 * Clears a manual override for an album so automatic matching can run again.
 */
export const resetAlbumVideoAssociation = async (
    albumName: string,
    folderName?: string,
): Promise<void> => {
    await ensureLocalAlbumVideoCatalogHydrated();
    const albumKey = buildNormalizedAlbumKey(albumName) || (folderName ? `folder:${normalizeAlbumVideoText(folderName)}` : '');
    if (!albumKey) return;
    if (associationsByAlbumKey.delete(albumKey)) {
        await persistVideoCatalogAndLinks();
        notifyAlbumVideosUpdated();
    }
};

const scanVideoFilesFromDirectoryHandle = async (
    dirHandle: FileSystemDirectoryHandle,
    currentPath: string,
    acc: VideoSnapshotFileDescriptor[] = [],
): Promise<VideoSnapshotFileDescriptor[]> => {
    const entries: FileSystemHandle[] = [];
    try {
        // @ts-ignore
        for await (const entry of dirHandle.values()) {
            entries.push(entry);
        }
    } catch {
        return acc;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
        const entryPath = `${currentPath}/${entry.name}`;
        if (entry.kind === 'directory') {
            await scanVideoFilesFromDirectoryHandle(entry as FileSystemDirectoryHandle, entryPath, acc);
            continue;
        }
        if (!isAlbumVideoFileName(entry.name)) {
            continue;
        }
        const fileHandle = entry as FileSystemFileHandle;
        try {
            if (isAndroidSafFileHandle(fileHandle)) {
                const stat = fileHandle.getStatMetadata();
                acc.push({
                    name: stat.name,
                    relativePath: entryPath,
                    folderName: currentPath,
                    size: stat.size,
                    lastModified: stat.lastModified,
                    mimeType: stat.type,
                    handle: fileHandle,
                    safContentUri: fileHandle.contentUri,
                    safTreeUri: fileHandle.treeUri,
                    safDocumentId: fileHandle.documentId,
                });
            } else {
                const file = await fileHandle.getFile();
                acc.push({
                    name: file.name,
                    relativePath: entryPath,
                    folderName: currentPath,
                    size: file.size,
                    lastModified: file.lastModified,
                    mimeType: file.type,
                    handle: fileHandle,
                });
            }
        } catch {
            // Skip unreadable video file
        }
    }
    return acc;
};

/**
 * Prompts the user to select a dedicated local Album Video folder (or video files on Android SAF),
 * persists the SAF permission and directory handle, and indexes the videos without rescanning the music library.
 */
export const importAlbumVideoFolder = async (expectedRootName?: string): Promise<LocalAlbumVideoEntry[]> => {
    await ensureLocalAlbumVideoCatalogHydrated();
    const persistedHandles = await getPersistedVideoDirHandles();
    let dirHandle: FileSystemDirectoryHandle | null = null;

    if (expectedRootName && persistedHandles[expectedRootName]) {
        dirHandle = persistedHandles[expectedRootName]!;
    } else if (hasFoliaAndroidBridge()) {
        try {
            dirHandle = await pickAndroidDirectoryHandle();
        } catch (err) {
            if ((err as Error)?.name === 'AbortError') return getRegisteredAlbumVideos();
            // Fallback to individual video file picker
            const pickedFiles = await pickAndroidVideoFiles();
            if (!pickedFiles || pickedFiles.files.length === 0) {
                return getRegisteredAlbumVideos();
            }
            const descriptors: VideoSnapshotFileDescriptor[] = pickedFiles.files.map(f => ({
                name: f.name,
                relativePath: `${pickedFiles.rootName || 'AlbumVideos'}/${f.relativePath || f.name}`,
                folderName: pickedFiles.rootName || 'AlbumVideos',
                size: f.size,
                lastModified: f.lastModified,
                mimeType: f.mimeType,
                safContentUri: f.contentUri,
                safTreeUri: pickedFiles.treeUri || f.contentUri,
                safDocumentId: f.documentId,
            }));
            return await reconcileVideosForRootFolder(pickedFiles.rootName || 'AlbumVideos', descriptors);
        }
    } else if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
        try {
            // @ts-ignore
            dirHandle = await window.showDirectoryPicker();
        } catch (err) {
            if ((err as Error)?.name === 'AbortError') return getRegisteredAlbumVideos();
            throw err;
        }
    }

    if (!dirHandle) {
        return getRegisteredAlbumVideos();
    }

    const rootName = expectedRootName || dirHandle.name || 'AlbumVideos';
    persistedHandles[rootName] = dirHandle;
    await savePersistedVideoDirHandles(persistedHandles);

    const discovered = await scanVideoFilesFromDirectoryHandle(dirHandle, rootName);
    await saveToCache(`local_video_snapshot_${rootName}`, {
        rootFolderName: rootName,
        scannedAt: Date.now(),
        videoCount: discovered.length,
    });
    return await reconcileVideosForRootFolder(rootName, discovered);
};

/**
 * Refreshes all registered video folders incrementally without rescanning the 20 GB audio library.
 */
export const resyncAlbumVideoFolders = async (): Promise<LocalAlbumVideoEntry[]> => {
    await ensureLocalAlbumVideoCatalogHydrated();
    const persistedHandles = await getPersistedVideoDirHandles();
    const roots = Object.keys(persistedHandles);
    for (const rootName of roots) {
        await importAlbumVideoFolder(rootName);
    }
    return getRegisteredAlbumVideos();
};

/**
 * Registers an individual File object (e.g. from <input type="file" accept="video/*">) and optionally
 * assigns it as the manual video cover for a specific album.
 */
export const registerStandaloneAlbumVideoFile = async (
    file: File,
    assignToAlbum?: { albumName: string; artistName?: string; folderName?: string },
): Promise<LocalAlbumVideoEntry> => {
    await ensureLocalAlbumVideoCatalogHydrated();
    const rootFolderName = 'ImportedVideos';
    const filePath = `${rootFolderName}/${file.name}`;
    const entry = buildLocalAlbumVideoEntry(
        {
            name: file.name,
            relativePath: filePath,
            folderName: rootFolderName,
            size: file.size,
            lastModified: file.lastModified || Date.now(),
            mimeType: file.type,
        },
        rootFolderName,
    );
    const blobUrl = createSafeObjectUrl(file);
    if (blobUrl) {
        activeVideoBlobUrls.set(entry.id, { url: blobUrl, signature: entry.fileSignature });
    }
    videoEntriesById.set(entry.id, entry);
    if (assignToAlbum) {
        const albumKey = buildNormalizedAlbumKey(assignToAlbum.albumName)
            || (assignToAlbum.folderName ? `folder:${normalizeAlbumVideoText(assignToAlbum.folderName)}` : '');
        if (albumKey) {
            associationsByAlbumKey.set(albumKey, {
                albumKey,
                albumName: assignToAlbum.albumName,
                artistName: assignToAlbum.artistName,
                videoId: entry.id,
                origin: 'manual',
                videoSignature: entry.fileSignature,
                updatedAt: Date.now(),
            });
        }
    }
    await persistVideoCatalogAndLinks();
    notifyAlbumVideosUpdated();
    return entry;
};

export const resetLocalAlbumVideoCatalogForTests = (): void => {
    videoEntriesById.clear();
    associationsByAlbumKey.clear();
    inMemoryVideoFileHandles.clear();
    for (const item of activeVideoBlobUrls.values()) {
        try {
            URL.revokeObjectURL(item.url);
        } catch {}
    }
    activeVideoBlobUrls.clear();
    catalogHydrated = false;
    catalogHydrationPromise = null;
};
