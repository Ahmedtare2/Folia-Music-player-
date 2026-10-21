import type { ActiveLocalLyricsSource, LocalLyricsPriority, LocalSong, LyricData } from '../../types';
import { LyricParserFactory } from './LyricParserFactory';

// src/utils/lyrics/localSongLyrics.ts
// Resolves the lyric payload and its actual source from one local-song snapshot, caching parsed
// TTML/LRC/VTT timing trees by content signature so track switches and metadata refreshes reuse
// already-parsed synchronized lyrics without re-running XML/TTML parsing.

export type ResolvedLocalSongLyrics = {
    lyrics: LyricData | null;
    source: ActiveLocalLyricsSource | null;
};

const MAX_PARSED_LYRIC_CACHE_ENTRIES = 200;
const parsedLocalLyricCache = new Map<string, LyricData | null>();

const buildLyricCacheKey = (
    song: LocalSong,
    source: 'local' | 'embedded',
    mainContent: string,
    transContent?: string,
    formatHint?: string,
): string => {
    const head = mainContent.slice(0, 48);
    const tail = mainContent.slice(-48);
    const transLen = transContent ? transContent.length : 0;
    const transTail = transContent ? transContent.slice(-32) : '';
    return `${song.id}::${source}::${formatHint || ''}::${song.fileSignature || ''}::${mainContent.length}::${head}::${tail}::${transLen}::${transTail}`;
};

const readCachedParsedLyrics = (key: string): LyricData | null | undefined => {
    if (!parsedLocalLyricCache.has(key)) return undefined;
    const value = parsedLocalLyricCache.get(key) ?? null;
    parsedLocalLyricCache.delete(key);
    parsedLocalLyricCache.set(key, value);
    return value;
};

const writeCachedParsedLyrics = (key: string, value: LyricData | null): void => {
    parsedLocalLyricCache.delete(key);
    parsedLocalLyricCache.set(key, value);
    while (parsedLocalLyricCache.size > MAX_PARSED_LYRIC_CACHE_ENTRIES) {
        const oldestKey = parsedLocalLyricCache.keys().next().value;
        if (!oldestKey) break;
        parsedLocalLyricCache.delete(oldestKey);
    }
};

export const clearParsedLocalLyricCache = (): void => {
    parsedLocalLyricCache.clear();
};

export const selectLocalSongLyricsSource = (
    song: LocalSong,
    priority: LocalLyricsPriority,
): ActiveLocalLyricsSource | null => {
    if (song.lyricsSource) {
        if (song.lyricsSource === 'online' && (song.matchedLyrics || song.matchedIsPureMusic)) return 'online';
        if (song.lyricsSource === 'local' && song.localLyricsContent) return 'local';
        if (song.lyricsSource === 'embedded' && song.embeddedLyricsContent) return 'embedded';
        return null;
    }

    // 用户标记的纯音乐：没有显式选本地 / 内嵌时一律按纯音乐（空歌词），「不使用在线数据」等把来源清回自动也不例外。
    if (song.markedPureMusic) return 'online';
    if (priority === 'online' && song.matchedLyrics) return 'online';
    if (song.hasLocalLyrics && song.localLyricsContent) return 'local';
    if (song.hasEmbeddedLyrics && song.embeddedLyricsContent) return 'embedded';
    if (song.matchedLyrics) return 'online';
    return null;
};

/** Parses the payload selected by the explicit source or current automatic priority. */
export const resolveLocalSongLyrics = async (
    song: LocalSong,
    priority: LocalLyricsPriority,
): Promise<ResolvedLocalSongLyrics> => {
    const source = selectLocalSongLyricsSource(song, priority);
    if (source === 'online') {
        return { lyrics: song.matchedLyrics ?? null, source };
    }
    if (source === 'local') {
        const cacheKey = buildLyricCacheKey(
            song,
            'local',
            song.localLyricsContent!,
            song.localTranslationLyricsContent,
            song.localLyricsFormat,
        );
        const cached = readCachedParsedLyrics(cacheKey);
        if (cached !== undefined) {
            return { lyrics: cached, source };
        }
        const lyrics = await LyricParserFactory.parse({
            type: 'local',
            lrcContent: song.localLyricsContent!,
            tLrcContent: song.localTranslationLyricsContent,
            formatHint: song.localLyricsFormat,
        });
        writeCachedParsedLyrics(cacheKey, lyrics);
        return { lyrics, source };
    }
    if (source === 'embedded') {
        const cacheKey = buildLyricCacheKey(
            song,
            'embedded',
            song.embeddedLyricsContent!,
            song.embeddedTranslationLyricsContent,
        );
        const cached = readCachedParsedLyrics(cacheKey);
        if (cached !== undefined) {
            return { lyrics: cached, source };
        }
        const lyrics = await LyricParserFactory.parse({
            type: 'embedded',
            textContent: song.embeddedLyricsContent!,
            translationContent: song.embeddedTranslationLyricsContent,
        });
        writeCachedParsedLyrics(cacheKey, lyrics);
        return { lyrics, source };
    }
    return { lyrics: null, source: null };
};
