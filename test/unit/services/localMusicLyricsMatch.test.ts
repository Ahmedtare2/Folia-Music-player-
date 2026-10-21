import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocalSong } from '@/types';
import { matchLyrics } from '@/services/localMusicService';
import { clearNegativeLyricMatchRecord, isSongOnAutomaticLyricMatchCooldown } from '@/utils/lyrics/lyricAutoMatchState';
import { shouldRunLocalSongAutomaticMatch } from '@/utils/lyrics/localSongMatchContext';
import { autoMatchBestLyric } from '@/utils/lyrics/autoMatchBestLyric';
import { applyMatchedMetadata } from '@/services/localLibraryCatalogService';
import { neteaseApi } from '@/services/onlineMusic/netease/netease';
import { getLocalLibraryCatalogSnapshot } from '@/services/localLibraryEntityRepository';

// test/unit/services/localMusicLyricsMatch.test.ts

const lyricSettings = vi.hoisted(() => ({
    autoUseBestLyric: true,
    preferredAlternativeLyricSource: 'amll',
    localLyricsPriority: 'local' as 'local' | 'online',
}));

vi.mock('@/utils/lyrics/autoMatchBestLyric', () => ({ autoMatchBestLyric: vi.fn() }));
vi.mock('@/services/localLibraryCatalogService', () => ({ applyMatchedMetadata: vi.fn() }));
vi.mock('@/services/localLibraryEntityRepository', () => ({
    getLocalLibraryCatalogSnapshot: vi.fn().mockResolvedValue({ entities: [], assignments: [] }),
}));
vi.mock('@/services/onlineMusic/netease/netease', () => ({
    neteaseApi: {
        cloudSearch: vi.fn(),
        getLyric: vi.fn(),
        getSongDetail: vi.fn(),
    },
}));
// Lyric sourcing moved to its own store; this suite drives it through the same fixture.
vi.mock('@/stores/useLyricSettingsStore', () => ({
    useLyricSettingsStore: {
        getState: () => lyricSettings,
    },
}));

const song = (): LocalSong => ({
    id: 'local-song',
    fileName: 'wrong-file.flac',
    filePath: 'Library/wrong-file.flac',
    title: 'Correct title',
    titleOrigin: 'manual-match',
    importedMetadata: { title: 'Wrong title', titleSource: 'filename', artistNames: ['Wrong artist'], albumName: 'Wrong album' },
    onlineMetadata: {
        source: 'netease', songId: 987, title: 'Correct title', artists: [{ name: 'Correct artist' }],
        album: { name: 'Correct album' }, matchMode: 'manual', matchedAt: 1,
    },
    duration: 200000,
    fileSize: 1,
    mimeType: 'audio/flac',
    addedAt: 1,
});

describe('localMusicService lyric matching', () => {
    beforeEach(async () => {
        vi.resetAllMocks();
        await clearNegativeLyricMatchRecord();
        lyricSettings.localLyricsPriority = 'local';
        vi.mocked(applyMatchedMetadata).mockResolvedValue(undefined);
        vi.mocked(getLocalLibraryCatalogSnapshot).mockResolvedValue({ entities: [], assignments: [] });
    });

    it('never matches a song the user marked as instrumental', async () => {
        lyricSettings.localLyricsPriority = 'online';
        const marked = { ...song(), markedPureMusic: true, matchedIsPureMusic: true, hasManualLyricSelection: false };

        await expect(matchLyrics(marked)).resolves.toBeNull();

        expect(autoMatchBestLyric).not.toHaveBeenCalled();
        expect(neteaseApi.cloudSearch).not.toHaveBeenCalled();
        expect(applyMatchedMetadata).not.toHaveBeenCalled();
    });

    it('passes the selected metadata identity into playback matching without replacing it', async () => {
        const lyrics = { lines: [], isWordByWord: true };
        vi.mocked(autoMatchBestLyric).mockResolvedValue({
            lyrics,
            source: 'netease',
            id: 987,
            song: {
                id: 987,
                name: 'Correct title',
                artists: [{ id: 1, name: 'Correct artist' }],
                album: { id: 2, name: 'Correct album' },
                durationMs: 200000,
            },
        });
        const localSong = song();

        await expect(matchLyrics(localSong)).resolves.toBe(lyrics);

        expect(autoMatchBestLyric).toHaveBeenCalledWith('Correct title', 'Correct artist', 200000, {
            album: 'Correct album',
            preferredSource: 'amll',
            metadataCandidate: { source: 'netease', songId: 987 },
            exactMatchOnly: false,
        });
        expect(neteaseApi.cloudSearch).not.toHaveBeenCalled();
        expect(applyMatchedMetadata).toHaveBeenCalledWith('local-song', {}, expect.objectContaining({
            lyricsOnly: true,
            // 写回时在事务里按最新记录检查：匹配途中被标记为纯音乐就放弃。
            skipIfMarkedPureMusic: true,
            songPatch: expect.objectContaining({
                onlineMetadata: expect.objectContaining({ source: 'netease', songId: 987 }),
                matchedLyricsSongId: 987,
            }),
        }));
    });

    it('fetches and uses an online match when online lyrics are preferred over local lyrics', async () => {
        lyricSettings.localLyricsPriority = 'online';
        const lyrics = { lines: [], isWordByWord: true };
        vi.mocked(autoMatchBestLyric).mockResolvedValue({
            lyrics,
            source: 'netease',
            id: 987,
            song: {
                id: 987,
                name: 'Correct title',
                artists: [{ id: 1, name: 'Correct artist' }],
                album: { id: 2, name: 'Correct album' },
                durationMs: 200000,
            },
        });
        const localSong = {
            ...song(),
            hasLocalLyrics: true,
            localLyricsContent: '[00:00.00]Local lyrics',
        };

        await expect(matchLyrics(localSong)).resolves.toBe(lyrics);

        expect(autoMatchBestLyric).toHaveBeenCalledWith('Correct title', 'Correct artist', 200000, expect.objectContaining({
            preferredSource: 'amll',
        }));
        expect(localSong.matchedLyrics).toBe(lyrics);
    });

    it('remembers failed automatic lyric lookups so unavailable tracks are not repeatedly queried, while allowing explicit forceRefresh', async () => {
        vi.mocked(autoMatchBestLyric).mockResolvedValue(null);
        const unavailableSong: LocalSong = {
            ...song(),
            id: 'unavailable-track-1',
            onlineMetadata: undefined,
        };

        expect(shouldRunLocalSongAutomaticMatch(unavailableSong)).toBe(true);
        await expect(matchLyrics(unavailableSong)).resolves.toBeNull();
        expect(autoMatchBestLyric).toHaveBeenCalledTimes(1);
        expect(isSongOnAutomaticLyricMatchCooldown(unavailableSong)).toBe(true);
        expect(shouldRunLocalSongAutomaticMatch(unavailableSong)).toBe(false);

        // Second automatic attempt while on cooldown skips network calls entirely
        await expect(matchLyrics(unavailableSong)).resolves.toBeNull();
        expect(autoMatchBestLyric).toHaveBeenCalledTimes(1);

        // Explicit user-triggered refresh bypasses cooldown and queries providers again
        const refreshedLyrics = { lines: [{ fullText: 'Refreshed line', startTime: 0, endTime: 2, words: [] }], isWordByWord: true };
        vi.mocked(autoMatchBestLyric).mockResolvedValueOnce({
            lyrics: refreshedLyrics,
            source: 'qq',
            id: 555,
            qqMid: 'mid555',
            song: {
                id: 555,
                name: 'Correct title',
                artists: [{ id: 1, name: 'Correct artist' }],
                album: { id: 2, name: 'Correct album' },
                durationMs: 200000,
                qqMid: 'mid555',
            },
        });
        await expect(matchLyrics(unavailableSong, { forceRefresh: true })).resolves.toBe(refreshedLyrics);
        expect(autoMatchBestLyric).toHaveBeenCalledTimes(2);
        expect(isSongOnAutomaticLyricMatchCooldown(unavailableSong)).toBe(false);
    });

    it('never replaces a manually selected lyric or a known-good local word-by-word TTML lyric with an inferior line-by-line match', async () => {
        lyricSettings.localLyricsPriority = 'online';
        const lineByLineOnline = {
            lines: [{ fullText: 'Line only', startTime: 0, endTime: 3, words: [] }],
            isWordByWord: false,
        };
        vi.mocked(autoMatchBestLyric).mockResolvedValue({
            lyrics: lineByLineOnline,
            source: 'qq',
            id: 777,
            song: {
                id: 777,
                name: 'Correct title',
                artists: [{ id: 1, name: 'Correct artist' }],
                album: { id: 2, name: 'Correct album' },
                durationMs: 200000,
            },
        });

        // 1. Song with local word-by-word TTML file is not downgraded to line-by-line online lyric
        const ttmlSong: LocalSong = {
            ...song(),
            id: 'ttml-protected-song',
            hasLocalLyrics: true,
            localLyricsFormat: 'ttml',
            localLyricsContent: '<tt xmlns="http://www.w3.org/ns/ttml"><body><div><p begin="00:01.000" end="00:02.000"><span>Word</span></p></div></body></tt>',
        };
        await expect(matchLyrics(ttmlSong)).resolves.toBeNull();
        expect(ttmlSong.matchedLyrics).toBeUndefined();

        // 2. Song with manual lyric selection is not overwritten by automatic match
        vi.mocked(autoMatchBestLyric).mockClear();
        const manualSong: LocalSong = {
            ...song(),
            id: 'manual-protected-song',
            hasManualLyricSelection: true,
            hasLocalLyrics: true,
            localLyricsContent: '[00:01.00]Manual lyric',
        };
        expect(shouldRunLocalSongAutomaticMatch(manualSong)).toBe(false);
        await expect(matchLyrics(manualSong)).resolves.toBeNull();
        expect(autoMatchBestLyric).not.toHaveBeenCalled();
    });
});
