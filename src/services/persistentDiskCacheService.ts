import type { DualTheme, LocalSong, LyricData } from '../types';
import type { LocalLibraryAssignment, LocalLibraryEntity } from '../types/localLibrary';
import type { RawLyricSource } from '../utils/lyrics/types';
import { ensureLyricDataRenderHints } from '../utils/lyrics/renderHints';
import {
    cacheAndroidCoverAndExtractPalette,
    deleteAndroidDiskCacheEntry,
    readAndroidDiskCacheJson,
    writeAndroidDiskCacheJson,
    type FoliaDiskCacheNamespace,
} from './android/foliaAndroidBridge';

// src/services/persistentDiskCacheService.ts
// Persistent internal disk cache coordinator backed by Android's context.getFilesDir()/media_cache/
// (with an in-memory hot tier for synchronous/zero-latency hits and test environments):
//   1. Pre-Parsed & Pre-Segmented Lyrics (media_cache/lyrics/): full LyricData timeline, word/syllable
//      timing structures, Jieba/ICU autoWordSegments, Pinyin/romanization, and translation rows.
//   2. Cover Art Mipmaps & Theme Palettes (media_cache/covers/ & media_cache/palettes/): 256x256 WebP
//      (for grids/Bravais lattice walls), 1024x1024 WebP (for the player), vibrant/representative
//      hex color palettes, and Monet/dynamic DualTheme palettes.
//   3. Persistent Library Index (media_cache/index/): scanned SAF library metadata index for instant launch.

export interface CachedCoverPaletteRecord {
    assetId: string;
    vibrantColors?: string[];
    representativeColors?: string[];
    dualTheme?: DualTheme;
    updatedAt: number;
}

export interface PersistedLibraryIndexSnapshot {
    version: number;
    updatedAt: number;
    songs: LocalSong[];
    entities?: LocalLibraryEntity[];
    assignments?: LocalLibraryAssignment[];
}

const LIBRARY_INDEX_CACHE_KEY = 'library_index_v1';
const LIBRARY_INDEX_SCHEMA_VERSION = 1;
const MAX_MEMORY_LYRIC_ENTRIES = 300;
const MAX_MEMORY_PALETTE_ENTRIES = 500;

const memoryLyricsCache = new Map<string, LyricData>();
const memoryPaletteCache = new Map<string, CachedCoverPaletteRecord>();
let memoryLibraryIndex: PersistedLibraryIndexSnapshot | null = null;

// Weak reference map from a parsed LyricData object (or its line content digest) to its disk cache key
// so post-parse segmentation (Jieba/ICU autoWordSegments, chorus detection, renderHints) can write back
// the ready-to-render structure to the exact same disk cache entry.
const lyricDataToCacheKey = new WeakMap<LyricData, string>();
const contentDigestToCacheKey = new Map<string, string>();

const fnv1a64Hex = (input: string): string => {
    let h1 = 0xdeadbeef ^ input.length;
    let h2 = 0x41c6ce57 ^ input.length;
    for (let i = 0; i < input.length; i += 1) {
        const ch = input.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
};

export const computeParsedLyricsContentDigest = (lyrics: LyricData | null | undefined): string | null => {
    if (!lyrics || !Array.isArray(lyrics.lines) || lyrics.lines.length === 0) return null;
    const count = lyrics.lines.length;
    const first = lyrics.lines[0];
    const mid = lyrics.lines[Math.floor(count / 2)];
    const last = lyrics.lines[count - 1];
    const signature = [
        count,
        Boolean(lyrics.isWordByWord),
        first?.startTime ?? 0,
        first?.fullText ?? '',
         first?.translation ?? '',
        mid?.startTime ?? 0,
        mid?.fullText ?? '',
        last?.startTime ?? 0,
        last?.fullText ?? '',
    ].join('|');
    return `ld_${fnv1a64Hex(signature)}`;
};

export const computeLyricSourceCacheKey = (source: RawLyricSource, optionsSignature = ''): string => {
    const rec = source as unknown as Record<string, unknown>;
    const str = (key: string, altKey?: string): string => {
        const val = rec[key] ?? (altKey ? rec[altKey] : undefined);
        return typeof val === 'string' ? val : '';
    };
    let rawPayload = '';
    switch (source.type) {
        case 'embedded':
            rawPayload = `embedded|${str('textContent')}|${str('translationContent')}`;
            break;
        case 'local':
            rawPayload = `local|${str('formatHint')}|${str('lrcContent')}|${str('tLrcContent')}|${str('yrcContent')}`;
            break;
        case 'netease':
            rawPayload = `netease|${str('lrc')}|${str('tLrc', 'tlrc')}|${str('yrc')}|${str('romaLrc', 'romalrc')}|${str('ttml')}`;
            break;
        case 'qrc':
            rawPayload = `qrc|${str('qrc', 'qrcContent')}|${str('tLrc', 'tlrc')}|${str('romaLrc', 'romalrc')}`;
            break;
        case 'navidrome':
            rawPayload = `navidrome|${JSON.stringify(rec.structured ?? rec.lines ?? null)}|${str('rawText', 'lrcContent')}`;
            break;
        default:
            rawPayload = JSON.stringify(source);
            break;
    }
    return `lyric_v1_${fnv1a64Hex(`${optionsSignature}|${rawPayload}`)}_${rawPayload.length}`;
};

const touchMemoryLyricCache = (key: string, value: LyricData): void => {
    memoryLyricsCache.delete(key);
    memoryLyricsCache.set(key, value);
    while (memoryLyricsCache.size > MAX_MEMORY_LYRIC_ENTRIES) {
        const oldest = memoryLyricsCache.keys().next().value;
        if (!oldest) break;
        memoryLyricsCache.delete(oldest);
    }
};

export const associateLyricDataWithCacheKey = (lyrics: LyricData | null | undefined, cacheKey: string): void => {
    if (!lyrics || !cacheKey) return;
    lyricDataToCacheKey.set(lyrics, cacheKey);
    const digest = computeParsedLyricsContentDigest(lyrics);
    if (digest) {
        contentDigestToCacheKey.set(digest, cacheKey);
    }
};

export const readPreParsedLyricsFromDisk = async (cacheKey: string): Promise<LyricData | null> => {
    if (!cacheKey) return null;
    const memHit = memoryLyricsCache.get(cacheKey);
    if (memHit) {
        touchMemoryLyricCache(cacheKey, memHit);
        associateLyricDataWithCacheKey(memHit, cacheKey);
        return memHit;
    }

    const rawJson = await readAndroidDiskCacheJson('lyrics', cacheKey);
    if (!rawJson) return null;
    try {
        const parsed = JSON.parse(rawJson) as LyricData;
        if (!parsed || !Array.isArray(parsed.lines)) return null;
        const hydrated = ensureLyricDataRenderHints(parsed) ?? parsed;
        touchMemoryLyricCache(cacheKey, hydrated);
        associateLyricDataWithCacheKey(hydrated, cacheKey);
        return hydrated;
    } catch {
        return null;
    }
};

export const writePreParsedLyricsToDisk = async (
    cacheKey: string,
    lyrics: LyricData | null | undefined,
): Promise<void> => {
    if (!cacheKey || !lyrics || !Array.isArray(lyrics.lines) || lyrics.lines.length === 0) return;
    const normalized = ensureLyricDataRenderHints(lyrics) ?? lyrics;
    touchMemoryLyricCache(cacheKey, normalized);
    associateLyricDataWithCacheKey(normalized, cacheKey);
    try {
        await writeAndroidDiskCacheJson('lyrics', cacheKey, JSON.stringify(normalized));
    } catch {
        // Ignore disk write failure.
    }
};

/**
 * Persists a fully post-processed LyricData structure (with Jieba/ICU autoWordSegments,
 * chorus markers, Pinyin/romanization, translations, and renderHints) to the persistent
 * disk cache so subsequent plays of the same track skip both parsing and word segmentation.
 */
export const persistPreSegmentedLyricsToDisk = (
    lyrics: LyricData | null | undefined,
    songKey?: string | number | null,
): void => {
    if (!lyrics || !Array.isArray(lyrics.lines) || lyrics.lines.length === 0) return;
    const normalized = ensureLyricDataRenderHints(lyrics) ?? lyrics;
    const directKey = lyricDataToCacheKey.get(lyrics) || lyricDataToCacheKey.get(normalized);
    const digest = computeParsedLyricsContentDigest(normalized);
    const resolvedCacheKey = directKey || (digest ? contentDigestToCacheKey.get(digest) : undefined);

    if (resolvedCacheKey) {
        lyricDataToCacheKey.set(normalized, resolvedCacheKey);
        void writePreParsedLyricsToDisk(resolvedCacheKey, normalized);
    }
    if (songKey !== undefined && songKey !== null && String(songKey).trim().length > 0) {
        const songCacheKey = `song_lyric_v1_${ fnv1a64Hex(String(songKey)) }`;
        void writePreParsedLyricsToDisk(songCacheKey, normalized);
    }
};

export const readSongPreSegmentedLyricsFromDisk = async (
    songKey: string | number | null | undefined,
): Promise<LyricData | null> => {
    if (songKey === undefined || songKey === null || String(songKey).trim().length === 0) return null;
    const songCacheKey = `song_lyric_v1_${fnv1a64Hex(String(songKey))}`;
    return await readPreParsedLyricsFromDisk(songCacheKey);
};

// ============================================================================
// Cover Art Mipmaps (256x256 & 1024x1024 WebP) & Theme Palette Disk Cache
// ============================================================================

const SHA256_EXTRACT_REGEX = /sha256(?::|%3A)([0-9a-f]{64})/i;

export const normalizePaletteCacheKey = (urlOrAssetId: string | null | undefined): string | null => {
    if (!urlOrAssetId || typeof urlOrAssetId !== 'string') return null;
    const trimmed = urlOrAssetId.trim();
    if (!trimmed) return null;
    const shaMatch = SHA256_EXTRACT_REGEX.exec(trimmed);
    if (shaMatch?.[1]) {
        return `sha256:${shaMatch[1].toLowerCase()}`;
    }
    if (/^[0-9a-f]{64}$/i.test(trimmed)) {
        return `sha256:${trimmed.toLowerCase()}`;
    }
    return `url_${fnv1a64Hex(trimmed)}`;
};

const toDiskPaletteFileKey = (normalizedKey: string): string => (
    normalizedKey.startsWith('sha256:') ? normalizedKey.slice('sha256:'.length) : normalizedKey
);

const touchMemoryPaletteCache = (key: string, record: CachedCoverPaletteRecord): void => {
    memoryPaletteCache.delete(key);
    memoryPaletteCache.set(key, record);
    while (memoryPaletteCache.size > MAX_MEMORY_PALETTE_ENTRIES) {
        const oldest = memoryPaletteCache.keys().next().value;
        if (!oldest) break;
        memoryPaletteCache.delete(oldest);
    }
};

export const stageCachedCoverPalette = (
    urlOrAssetId: string | null | undefined,
    patch: {
        vibrantColors?: string[];
        representativeColors?: string[];
        dualTheme?: DualTheme;
    },
): CachedCoverPaletteRecord | null => {
    const key = normalizePaletteCacheKey(urlOrAssetId);
    if (!key) return null;
    const existing = memoryPaletteCache.get(key);
    const merged: CachedCoverPaletteRecord = {
        assetId: key,
        vibrantColors: patch.vibrantColors?.length ? patch.vibrantColors : existing?.vibrantColors,
        representativeColors: patch.representativeColors?.length ? patch.representativeColors : existing?.representativeColors,
        dualTheme: patch.dualTheme ?? existing?.dualTheme,
        updatedAt: Date.now(),
    };
    touchMemoryPaletteCache(key, merged);
    return merged;
};

export const readCachedCoverPalette = async (
    urlOrAssetId: string | null | undefined,
): Promise<CachedCoverPaletteRecord | null> => {
    const key = normalizePaletteCacheKey(urlOrAssetId);
    if (!key) return null;

    const memHit = memoryPaletteCache.get(key);
    if (memHit) {
        touchMemoryPaletteCache(key, memHit);
        return memHit;
    }

    const diskKey = toDiskPaletteFileKey(key);
    const rawJson = await readAndroidDiskCacheJson('palettes', diskKey);
    if (!rawJson) return null;
    try {
        const parsed = JSON.parse(rawJson) as Partial<CachedCoverPaletteRecord>;
        if (!parsed || typeof parsed !== 'object') return null;
        const record: CachedCoverPaletteRecord = {
            assetId: key,
            vibrantColors: Array.isArray(parsed.vibrantColors) ? parsed.vibrantColors : undefined,
            representativeColors: Array.isArray(parsed.representativeColors) ? parsed.representativeColors : undefined,
            dualTheme: parsed.dualTheme,
            updatedAt: Number(parsed.updatedAt) || Date.now(),
        };
        touchMemoryPaletteCache(key, record);
        return record;
    } catch {
        return null;
    }
};

export const writeCachedCoverPalette = async (
    urlOrAssetId: string | null | undefined,
    patch: {
        vibrantColors?: string[];
        representativeColors?: string[];
        dualTheme?: DualTheme;
    },
): Promise<void> => {
    const key = normalizePaletteCacheKey(urlOrAssetId);
    if (!key) return;
    // Merge with any existing disk record first if not in memory yet
    if (!memoryPaletteCache.has(key)) {
        await readCachedCoverPalette(key);
    }
    const merged = stageCachedCoverPalette(key, patch);
    if (!merged) return;
    const diskKey = toDiskPaletteFileKey(key);
    try {
        await writeAndroidDiskCacheJson('palettes', diskKey, JSON.stringify(merged));
    } catch {
        // Ignore disk write failure.
    }
};

/**
 * Ensures 256x256 WebP (grids/Bravais lattice walls) and 1024x1024 WebP (player) mipmaps exist
 * in context.getFilesDir()/media_cache/covers/ and extracts/caches vibrant & representative
 * color palettes in context.getFilesDir()/media_cache/palettes/.
 */
export const ensureCoverMipmapsAndPalettePersisted = async (
    assetId: string,
    blob?: Blob,
): Promise<CachedCoverPaletteRecord | null> => {
    const key = normalizePaletteCacheKey(assetId);
    if (!key) return null;
    const res = await cacheAndroidCoverAndExtractPalette({
        assetId: key,
        blob,
    });
    if (res?.ok && (res.vibrantColors?.length || res.representativeColors?.length)) {
        return stageCachedCoverPalette(key, {
            vibrantColors: res.vibrantColors,
            representativeColors: res.representativeColors,
        });
    }
    return memoryPaletteCache.get(key) ?? null;
};

// ============================================================================
// Persistent Library Index (media_cache/index/library_index_v1.json)
// ============================================================================

export const readPersistedLibraryIndex = async (): Promise<PersistedLibraryIndexSnapshot | null> => {
    if (memoryLibraryIndex && memoryLibraryIndex.songs.length > 0) {
        return memoryLibraryIndex;
    }
    const rawJson = await readAndroidDiskCacheJson('index', LIBRARY_INDEX_CACHE_KEY);
    if (!rawJson) return null;
    try {
        const parsed = JSON.parse(rawJson) as Partial<PersistedLibraryIndexSnapshot>;
        if (
            !parsed
            || parsed.version !== LIBRARY_INDEX_SCHEMA_VERSION
            || !Array.isArray(parsed.songs)
        ) {
            return null;
        }
        const snapshot: PersistedLibraryIndexSnapshot = {
            version: LIBRARY_INDEX_SCHEMA_VERSION,
            updatedAt: Number(parsed.updatedAt) || Date.now(),
            songs: parsed.songs,
            entities: Array.isArray(parsed.entities) ? parsed.entities : undefined,
            assignments: Array.isArray(parsed.assignments) ? parsed.assignments : undefined,
        };
        memoryLibraryIndex = snapshot;
        return snapshot;
    } catch {
        return null;
    }
};

export const writePersistedLibraryIndex = async (payload: {
    songs: LocalSong[];
    entities?: LocalLibraryEntity[];
    assignments?: LocalLibraryAssignment[];
}): Promise<void> => {
    const snapshot: PersistedLibraryIndexSnapshot = {
        version: LIBRARY_INDEX_SCHEMA_VERSION,
        updatedAt: Date.now(),
        songs: payload.songs,
        entities: payload.entities ?? memoryLibraryIndex?.entities,
        assignments: payload.assignments ?? memoryLibraryIndex?.assignments,
    };
    memoryLibraryIndex = snapshot;
    try {
        await writeAndroidDiskCacheJson('index', LIBRARY_INDEX_CACHE_KEY, JSON.stringify(snapshot));
    } catch {
        // Ignore disk write failure.
    }
};

export const updatePersistedLibraryIndexSongs = async (upsertedSongs: LocalSong[]): Promise<void> => {
    if (upsertedSongs.length === 0) return;
    const current = await readPersistedLibraryIndex();
    const byId = new Map<string, LocalSong>(
        (current?.songs ?? []).map(song => [song.id, song]),
    );
    for (const song of upsertedSongs) {
        byId.set(song.id, song);
    }
    await writePersistedLibraryIndex({
        songs: Array.from(byId.values()),
        entities: current?.entities,
        assignments: current?.assignments,
    });
};

export const removePersistedLibraryIndexSongs = async (songIds: string[]): Promise<void> => {
    if (songIds.length === 0) return;
    const current = await readPersistedLibraryIndex();
    if (!current) return;
    const removeSet = new Set(songIds);
    const remaining = current.songs.filter(song => !removeSet.has(song.id));
    await writePersistedLibraryIndex({
        songs: remaining,
        entities: current.entities,
        assignments: current.assignments?.filter(a => !removeSet.has(a.songId)),
    });
};

export const clearPersistentDiskCacheNamespace = async (namespace: FoliaDiskCacheNamespace): Promise<void> => {
    if (namespace === 'lyrics') {
        memoryLyricsCache.clear();
        contentDigestToCacheKey.clear();
    } else if (namespace === 'palettes' || namespace === 'covers') {
        memoryPaletteCache.clear();
    } else if (namespace === 'index') {
        memoryLibraryIndex = null;
    }
    await deleteAndroidDiskCacheEntry(namespace, '*');
};

export const clearPersistentDiskCacheForTests = (): void => {
    memoryLyricsCache.clear();
    memoryPaletteCache.clear();
    contentDigestToCacheKey.clear();
    memoryLibraryIndex = null;
};
