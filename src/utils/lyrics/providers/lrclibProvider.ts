import type { LyricData, SongResult } from '../../../types';
import type { ChorusRange, ProviderLyricsResult } from '../../../types/onlineMusic';
import { applyChorusRangesByTime, applyDetectedChorusEffects } from '../chorusEffects';
import { detectTimedLyricFormat } from '../formatDetection';
import { parseLyricsByFormat } from '../parserCore';

// src/utils/lyrics/providers/lrclibProvider.ts
// Zero-API-key, no-login-required synchronized lyric & metadata provider powered by LRCLIB
// (https://lrclib.net/api) with public Piped Music / Piped caption fallback.
// Blends directly into Folia's lyric priority order (`lyricSources.ts` / `lyricMatchSources.ts`)
// and online metadata search (`onlineMetadataSearchService.ts`).

export interface LrclibApiRecord {
    id: number | string;
    name?: string;
    trackName?: string;
    artistName?: string;
    albumName?: string;
    duration?: number; // seconds in LRCLIB API
    instrumental?: boolean;
    plainLyrics?: string | null;
    syncedLyrics?: string | null;
    coverUrl?: string;
    pipedVideoId?: string;
}

const LRCLIB_API_BASE = 'https://lrclib.net/api';
const PIPED_PIPED_API_BASES = [
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.tokhmi.xyz',
];

const cachedRecordsById = new Map<string, LrclibApiRecord>();
let forceEnableInTests = false;

export function setLrclibTestModeEnabled(enabled: boolean): void {
    forceEnableInTests = enabled;
}

export function clearLrclibCache(): void {
    cachedRecordsById.clear();
}

function shouldSkipUnmockedTestNetwork(): boolean {
    if (forceEnableInTests) return false;
    const isVitest = Boolean(
        (import.meta as { env?: { VITEST?: boolean; MODE?: string } }).env?.VITEST
        || (typeof process !== 'undefined' && process.env?.VITEST),
    );
    if (!isVitest) return false;
    const fetchFn = globalThis.fetch as unknown as { mock?: unknown } | undefined;
    return !Boolean(fetchFn && typeof fetchFn === 'object' && 'mock' in fetchFn && fetchFn.mock);
}

function splitArtistNames(rawArtist: string | undefined): Array<{ id: number; name: string }> {
    const cleaned = (rawArtist || '').trim();
    if (!cleaned) {
        return [{ id: 0, name: 'Unknown Artist' }];
    }
    const parts = cleaned
        .split(/\s*(?:,|&|\/|;|feat\.?|ft\.?)\s*/i)
        .map(part => part.trim())
        .filter(Boolean);
    return (parts.length > 0 ? parts : [cleaned]).map((name, idx) => ({
        id: idx + 1,
        name,
    }));
}

function hasEnhancedWordTimestamps(lyricText: string): boolean {
    return /<\d{1,2}:\d{2}[.:]\d{2,3}>/.test(lyricText)
        || /\[\d{1,2}:\d{2}[.:]\d{2,3}\][^[\]\n]+\[\d{1,2}:\d{2}[.:]\d{2,3}\]/.test(lyricText);
}

function convertPlainLyricsToUntimedLyricData(plainLyrics: string): LyricData | null {
    const lines = plainLyrics
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);
    if (lines.length === 0) return null;
    const stepSec = 4;
    return {
        lines: lines.map((fullText, index) => ({
            startTime: index * stepSec,
            endTime: (index + 1) * stepSec,
            fullText,
            words: [],
        })),
        isWordByWord: false,
    };
}

export function parseLrclibLyricRecord(
    record: LrclibApiRecord,
    chorusRanges: ChorusRange[] = [],
): ProviderLyricsResult | null {
    if (record.instrumental) {
        return {
            lyrics: null,
            isPureMusic: true,
        };
    }

    const rawSynced = (record.syncedLyrics || '').trim();
    const rawPlain = (record.plainLyrics || '').trim();
    const rawText = rawSynced || rawPlain;
    if (!rawText) {
        return null;
    }

    if (rawSynced) {
        const format = detectTimedLyricFormat(rawSynced);
        const parsed = parseLyricsByFormat(format, rawSynced, '', {});
        if (parsed && parsed.lines.length > 0) {
            if (hasEnhancedWordTimestamps(rawSynced)) {
                parsed.isWordByWord = true;
            }
            const withChorus = chorusRanges.length > 0
                ? applyChorusRangesByTime(parsed, chorusRanges)
                : applyDetectedChorusEffects(parsed, rawSynced);
            return {
                lyrics: withChorus,
                isPureMusic: false,
            };
        }
    }

    if (rawPlain) {
        const untimed = convertPlainLyricsToUntimedLyricData(rawPlain);
        if (untimed) {
            return {
                lyrics: untimed,
                isPureMusic: false,
            };
        }
    }

    return null;
}

function toSongResult(record: LrclibApiRecord): SongResult {
    const idStr = String(record.id);
    cachedRecordsById.set(idStr, record);
    const title = (record.trackName || record.name || '').trim() || 'Unknown Song';
    const albumName = (record.albumName || '').trim();
    const durationSec = typeof record.duration === 'number' && Number.isFinite(record.duration)
        ? record.duration
        : 0;
    const durationMs = durationSec > 1000 ? Math.round(durationSec) : Math.round(durationSec * 1000);
    const numericId = typeof record.id === 'number' ? record.id : Number(record.id);

    return {
        id: Number.isSafeInteger(numericId) && numericId > 0 ? numericId : idStr,
        name: title,
        artists: splitArtistNames(record.artistName),
        album: {
            id: Number.isSafeInteger(numericId) && numericId > 0 ? numericId : 0,
            name: albumName,
            ...(record.coverUrl ? { coverUrl: record.coverUrl } : {}),
        },
        durationMs,
        sourceRef: {
            kind: 'online',
            providerId: 'lrclib',
            mediaId: idStr,
        },
    };
}

async function fetchJsonWithHeaders(url: string): Promise<unknown> {
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
        },
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} from ${url}`);
    }
    return await response.json();
}

async function queryLrclibEndpoint(params: Record<string, string>): Promise<LrclibApiRecord[]> {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value && value.trim()) {
            searchParams.set(key, value.trim());
        }
    }
    const url = `${LRCLIB_API_BASE}/search?${searchParams.toString()}`;
    const data = await fetchJsonWithHeaders(url);
    if (!Array.isArray(data)) return [];
    return data.filter((item): item is LrclibApiRecord => Boolean(item && typeof item === 'object' && item.id !== undefined));
}

async function searchPipedMusicPipedFallback(
    query: string,
    limit: number,
): Promise<SongResult[]> {
    for (const base of PIPED_PIPED_API_BASES) {
        try {
            const url = `${base}/search?q=${encodeURIComponent(query)}&filter=music_songs`;
            const data = await fetchJsonWithHeaders(url) as { items?: Array<Record<string, unknown>> };
            const items = Array.isArray(data?.items) ? data.items : [];
            if (items.length === 0) continue;

            const results: SongResult[] = [];
            for (const item of items.slice(0, limit)) {
                const rawUrl = typeof item.url === 'string' ? item.url : '';
                const videoIdMatch = rawUrl.match(/[?&]v=([a-zA-Z0-9_-]{6,})/) || rawUrl.match(/\/watch\/([a-zA-Z0-9_-]{6,})/);
                const videoId = videoIdMatch?.[1] || (typeof item.id === 'string' ? item.id : '');
                if (!videoId) continue;

                const idKey = `piped:${videoId}`;
                const title = typeof item.title === 'string' ? item.title.trim() : '';
                if (!title) continue;
                const artistName = typeof item.uploaderName === 'string'
                    ? item.uploaderName.replace(/\s*-\s*Topic$/i, '').trim()
                    : '';
                const durationSec = typeof item.duration === 'number' && item.duration > 0 ? item.duration : 0;
                const coverUrl = typeof item.thumbnail === 'string' ? item.thumbnail : undefined;

                const record: LrclibApiRecord = {
                    id: idKey,
                    trackName: title,
                    artistName,
                    albumName: '',
                    duration: durationSec,
                    coverUrl,
                    pipedVideoId: videoId,
                };
                results.push(toSongResult(record));
            }
            if (results.length > 0) {
                return results;
            }
        } catch {
            // Try next Piped instance or return empty
        }
    }
    return [];
}

async function fetchPipedMusicPipedSubtitles(videoId: string): Promise<LrclibApiRecord | null> {
    for (const base of PIPED_PIPED_API_BASES) {
        try {
            const streamData = await fetchJsonWithHeaders(`${base}/streams/${encodeURIComponent(videoId)}`) as {
                title?: string;
                uploader?: string;
                duration?: number;
                thumbnailUrl?: string;
                subtitles?: Array<{ url?: string; mimeType?: string; code?: string; autoGenerated?: boolean }>;
            };
            const subtitles = Array.isArray(streamData?.subtitles) ? streamData.subtitles : [];
            const preferredSub = subtitles.find(s => !s.autoGenerated && s.url) || subtitles.find(s => Boolean(s.url));
            if (!preferredSub?.url) continue;

            const subResponse = await fetch(preferredSub.url);
            if (!subResponse.ok) continue;
            const rawSubtitle = (await subResponse.text()).trim();
            if (!rawSubtitle) continue;

            return {
                id: `piped:${videoId}`,
                trackName: streamData.title || '',
                artistName: (streamData.uploader || '').replace(/\s*-\s*Topic$/i, '').trim(),
                duration: streamData.duration || 0,
                coverUrl: streamData.thumbnailUrl,
                syncedLyrics: rawSubtitle,
                pipedVideoId: videoId,
            };
        } catch {
            // Continue to next instance
        }
    }
    return null;
}

export async function searchLrclibLyrics(
    query: string,
    limit = 20,
    target?: { title?: string; artist?: string; album?: string; durationMs?: number },
): Promise<SongResult[]> {
    if (shouldSkipUnmockedTestNetwork()) {
        return [];
    }

    const safeQuery = query.trim();
    const targetTitle = (target?.title || '').trim();
    const targetArtist = (target?.artist || '').trim();

    if (!safeQuery && !targetTitle) {
        return [];
    }

    try {
        const seenIds = new Set<string>();
        const mergedRecords: LrclibApiRecord[] = [];
        const addRecords = (records: LrclibApiRecord[]) => {
            for (const rec of records) {
                const key = String(rec.id);
                if (seenIds.has(key)) continue;
                seenIds.add(key);
                mergedRecords.push(rec);
            }
        };

        // 1. Structured track_name + artist_name search when both are known
        if (targetTitle && targetArtist && targetArtist.toLowerCase() !== 'unknown artist') {
            try {
                const structured = await queryLrclibEndpoint({
                    track_name: targetTitle,
                    artist_name: targetArtist,
                });
                addRecords(structured);
            } catch {
                // Fall through to general query
            }
        }

        // 2. General full-text search (?q=...)
        if (mergedRecords.length === 0 && safeQuery) {
            try {
                const byQuery = await queryLrclibEndpoint({ q: safeQuery });
                addRecords(byQuery);
            } catch {
                // Fall through
            }
        }

        // 3. Swapped Title/Artist resilience: if track_name=title & artist_name=artist returned 0,
        // try swapped track_name=artist & artist_name=title (fixes "Title - Artist.mp3" folders).
        if (
            mergedRecords.length === 0
            && targetTitle
            && targetArtist
            && targetTitle.toLowerCase() !== targetArtist.toLowerCase()
        ) {
            try {
                const swapped = await queryLrclibEndpoint({
                    track_name: targetArtist,
                    artist_name: targetTitle,
                });
                addRecords(swapped);
            } catch {
                // Ignore
            }
        }

        // 4. Title-only fallback if artist name was noisy or transliterated differently
        if (mergedRecords.length === 0 && targetTitle) {
            try {
                const titleOnly = await queryLrclibEndpoint({ q: targetTitle });
                addRecords(titleOnly);
            } catch {
                // Ignore
            }
        }

        // Sort records with syncedLyrics first so timed LRC always outranks plain text
        mergedRecords.sort((a, b) => {
            const aSynced = Boolean(a.syncedLyrics && a.syncedLyrics.trim()) ? 1 : 0;
            const bSynced = Boolean(b.syncedLyrics && b.syncedLyrics.trim()) ? 1 : 0;
            return bSynced - aSynced;
        });

        if (mergedRecords.length > 0) {
            return mergedRecords.slice(0, Math.max(1, limit)).map(toSongResult);
        }

        // 5. Fallback to zero-API-key Piped Music / Piped search
        const fallbackQuery = safeQuery || [targetTitle, targetArtist].filter(Boolean).join(' ');
        if (fallbackQuery) {
            return await searchPipedMusicPipedFallback(fallbackQuery, Math.min(limit, 10));
        }
        return [];
    } catch (error) {
        console.warn('[LRCLIB] Search failed:', error);
        return [];
    }
}

export async function fetchLrclibLyrics(
    song: SongResult,
    options: { chorusRanges?: ChorusRange[] } = {},
): Promise<ProviderLyricsResult | null> {
    if (shouldSkipUnmockedTestNetwork()) {
        return null;
    }

    const idKey = String(song.id);
    const chorusRanges = options.chorusRanges || [];

    // 1. Check in-memory cache populated by searchLrclibLyrics (0ms, zero extra HTTP request!)
    const cached = cachedRecordsById.get(idKey);
    if (cached && (cached.syncedLyrics || cached.plainLyrics || cached.instrumental)) {
        return parseLrclibLyricRecord(cached, chorusRanges);
    }

    // 2. If it's a Piped Music / Piped fallback item (piped:<videoId>), fetch its stream captions
    if (idKey.startsWith('piped:')) {
        const videoId = idKey.slice(4);
        const pipedRecord = await fetchPipedMusicPipedSubtitles(videoId);
        if (pipedRecord) {
            cachedRecordsById.set(idKey, pipedRecord);
            return parseLrclibLyricRecord(pipedRecord, chorusRanges);
        }
        return null;
    }

    // 3. Direct LRCLIB ID lookup: GET /api/get/{id}
    const numericId = typeof song.id === 'number' ? song.id : Number(song.id);
    if (Number.isSafeInteger(numericId) && numericId > 0) {
        try {
            const data = await fetchJsonWithHeaders(`${LRCLIB_API_BASE}/get/${numericId}`) as LrclibApiRecord;
            if (data && typeof data === 'object') {
                cachedRecordsById.set(idKey, data);
                return parseLrclibLyricRecord(data, chorusRanges);
            }
        } catch (error) {
            console.warn(`[LRCLIB] Direct fetch by ID ${numericId} failed:`, error);
        }
    }

    // 4. Fallback GET /api/get?track_name=...&artist_name=...
    const artistName = song.artists?.map(a => a.name).filter(Boolean).join(', ') || '';
    if (song.name && artistName) {
        try {
            const params = new URLSearchParams({
                track_name: song.name,
                artist_name: artistName,
            });
            if (song.album?.name) {
                params.set('album_name', song.album.name);
            }
            if (song.durationMs > 0) {
                params.set('duration', String(Math.round(song.durationMs / 1000)));
            }
            const data = await fetchJsonWithHeaders(`${LRCLIB_API_BASE}/get?${params.toString()}`) as LrclibApiRecord;
            if (data && typeof data === 'object') {
                cachedRecordsById.set(String(data.id ?? idKey), data);
                return parseLrclibLyricRecord(data, chorusRanges);
            }
        } catch {
            // Ignore
        }
    }

    return null;
}
