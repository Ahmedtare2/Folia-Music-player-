import type { LocalSong } from '../../types';
import { getFromCache, saveToCache } from '../../services/db';

// src/utils/lyrics/lyricAutoMatchState.ts
// Tracks persistent and in-memory automatic lyric lookup state, retrieval metadata,
// and negative-lookup cooldowns so unavailable tracks are not repeatedly queried on every play.

export const LOCAL_LYRIC_NEGATIVE_CACHE_KEY = 'local_lyric_negative_cache_v1';
export const AUTO_MATCH_FAILURE_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_NEGATIVE_CACHE_ENTRIES = 2000;

export interface NegativeLyricMatchRecord {
    songId: string;
    signature: string;
    failedAt: number;
}

const memoryNegativeCache = new Map<string, NegativeLyricMatchRecord>();
let negativeCacheHydrated = false;
let negativeCacheHydrationPromise: Promise<void> | null = null;

export const normalizeLookupToken = (value?: string | null): string => (
    (value || '')
        .normalize('NFKC')
        .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()
);

export const buildSongLyricLookupSignature = (song: LocalSong): string => {
    const title = normalizeLookupToken(song.title || song.fileName);
    const artists = (
        song.onlineMetadata?.artists?.map(a => a.name).join(',')
        || song.importedMetadata?.artistNames?.join(',')
        || ''
    );
    const album = (
        song.onlineMetadata?.album?.name
        || song.importedMetadata?.albumName
        || ''
    );
    const durationBucket = Math.round((song.duration || 0) / 1000);
    const candidateKey = song.onlineMetadata?.source && song.onlineMetadata?.songId !== undefined
        ? `${song.onlineMetadata.source}:${song.onlineMetadata.songId}`
        : '';
    return `${title}|${normalizeLookupToken(artists)}|${normalizeLookupToken(album)}|${durationBucket}|${candidateKey}`;
};

export const hydrateNegativeLyricMatchCache = async (): Promise<void> => {
    if (negativeCacheHydrated) return;
    if (negativeCacheHydrationPromise) {
        await negativeCacheHydrationPromise;
        return;
    }
    negativeCacheHydrationPromise = (async () => {
        try {
            const stored = await getFromCache<Record<string, NegativeLyricMatchRecord>>(LOCAL_LYRIC_NEGATIVE_CACHE_KEY);
            if (stored && typeof stored === 'object') {
                for (const [songId, entry] of Object.entries(stored)) {
                    if (entry && typeof entry.failedAt === 'number' && typeof entry.signature === 'string') {
                        memoryNegativeCache.set(songId, entry);
                    }
                }
            }
        } catch {
            // Ignore cache read failures in restricted environments
        } finally {
            negativeCacheHydrated = true;
            negativeCacheHydrationPromise = null;
        }
    })();
    await negativeCacheHydrationPromise;
};

const persistNegativeCacheSnapshot = async (): Promise<void> => {
    try {
        const serialized: Record<string, NegativeLyricMatchRecord> = {};
        for (const [songId, record] of memoryNegativeCache.entries()) {
            serialized[songId] = record;
        }
        await saveToCache(LOCAL_LYRIC_NEGATIVE_CACHE_KEY, serialized);
    } catch {
        // Ignore persistence errors
    }
};

export const recordAutomaticLyricMatchFailure = async (
    song: LocalSong,
    now = Date.now(),
): Promise<void> => {
    const signature = buildSongLyricLookupSignature(song);
    song.lastAutoMatchFailedAt = now;
    song.lastAutoMatchFailedQuerySignature = signature;

    memoryNegativeCache.delete(song.id);
    memoryNegativeCache.set(song.id, {
        songId: song.id,
        signature,
        failedAt: now,
    });
    if (memoryNegativeCache.size > MAX_NEGATIVE_CACHE_ENTRIES) {
        const oldestKey = memoryNegativeCache.keys().next().value;
        if (oldestKey !== undefined) {
            memoryNegativeCache.delete(oldestKey);
        }
    }
    await persistNegativeCacheSnapshot();
};

export const recordAutomaticLyricMatchSuccess = async (
    song: LocalSong,
    now = Date.now(),
): Promise<void> => {
    const signature = buildSongLyricLookupSignature(song);
    song.matchedLyricsFetchedAt = now;
    song.matchedLyricsQuerySignature = signature;
    song.lastAutoMatchFailedAt = undefined;
    song.lastAutoMatchFailedQuerySignature = undefined;
    if (memoryNegativeCache.delete(song.id)) {
        await persistNegativeCacheSnapshot();
    }
};

export const clearNegativeLyricMatchRecord = async (songId?: string): Promise<void> => {
    if (!songId) {
        memoryNegativeCache.clear();
        negativeCacheHydrated = false;
        await persistNegativeCacheSnapshot();
        return;
    }
    if (memoryNegativeCache.delete(songId)) {
        await persistNegativeCacheSnapshot();
    }
};

export const isSongOnAutomaticLyricMatchCooldown = (
    song: LocalSong,
    now = Date.now(),
): boolean => {
    const currentSignature = buildSongLyricLookupSignature(song);
    if (
        typeof song.lastAutoMatchFailedAt === 'number'
        && song.lastAutoMatchFailedQuerySignature === currentSignature
        && (now - song.lastAutoMatchFailedAt) < AUTO_MATCH_FAILURE_COOLDOWN_MS
    ) {
        return true;
    }
    const cached = memoryNegativeCache.get(song.id);
    if (
        cached
        && cached.signature === currentSignature
        && (now - cached.failedAt) < AUTO_MATCH_FAILURE_COOLDOWN_MS
    ) {
        return true;
    }
    return false;
};

export const hasKnownGoodWordByWordLocalLyric = (song: LocalSong): boolean => {
    if (song.hasLocalLyrics && song.localLyricsContent) {
        const fmt = song.localLyricsFormat;
        if (fmt === 'ttml' || fmt === 'qrc' || fmt === 'yrc' || fmt === 'krc') {
            return true;
        }
        if (/<tt(?:\s|>)/i.test(song.localLyricsContent) || /<\d{1,2}:\d{2}/.test(song.localLyricsContent)) {
            return true;
        }
    }
    if (song.hasEmbeddedLyrics && song.embeddedLyricsContent) {
        if (/<tt(?:\s|>)/i.test(song.embeddedLyricsContent) || /<\d{1,2}:\d{2}/.test(song.embeddedLyricsContent)) {
            return true;
        }
    }
    return false;
};

export const hasTimedLocalOrEmbeddedLyric = (song: LocalSong): boolean => {
    if (hasKnownGoodWordByWordLocalLyric(song)) return true;
    const isTimedText = (text?: string | null): boolean => {
        if (!text) return false;
        return /\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/.test(text)
            || /\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->/.test(text)
            || /<\s*p\b[^>]*\bbegin\s*=/i.test(text);
    };
    return (Boolean(song.hasLocalLyrics) && isTimedText(song.localLyricsContent))
        || (Boolean(song.hasEmbeddedLyrics) && isTimedText(song.embeddedLyricsContent));
};
