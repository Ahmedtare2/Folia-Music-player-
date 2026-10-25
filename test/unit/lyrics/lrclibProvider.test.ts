import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    clearLrclibCache,
    fetchLrclibLyrics,
    searchLrclibLyrics,
    setLrclibTestModeEnabled,
} from '@/utils/lyrics/providers/lrclibProvider';

describe('lrclibProvider', () => {
    beforeEach(() => {
        clearLrclibCache();
        setLrclibTestModeEnabled(true);
    });

    afterEach(() => {
        setLrclibTestModeEnabled(false);
        clearLrclibCache();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('searches LRCLIB without an API key, populates album metadata, and resolves cached synced lyrics in 0 extra requests', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => [
                {
                    id: 90123,
                    trackName: 'Allem Alby',
                    artistName: 'Amr Diab',
                    albumName: 'Allem Alby',
                    duration: 242,
                    instrumental: false,
                    syncedLyrics: '[00:01.00] علم قلبي الغرام\n[00:03.50] علم قلبي الحنان',
                    plainLyrics: 'علم قلبي الغرام\nعلم قلبي الحنان',
                },
            ],
        });
        vi.stubGlobal('fetch', fetchMock);

        const candidates = await searchLrclibLyrics('Allem Alby Amr Diab', 10, {
            title: 'Allem Alby',
            artist: 'Amr Diab',
            durationMs: 242000,
        });

        expect(candidates).toHaveLength(1);
        expect(candidates[0]).toMatchObject({
            id: 90123,
            name: 'Allem Alby',
            artists: [{ id: 1, name: 'Amr Diab' }],
            album: { id: 90123, name: 'Allem Alby' },
            durationMs: 242000,
        });

        const callsAfterSearch = fetchMock.mock.calls.length;
        const lyricsResult = await fetchLrclibLyrics(candidates[0]);
        expect(fetchMock.mock.calls.length).toBe(callsAfterSearch);
        expect(lyricsResult?.isPureMusic).toBe(false);
        expect(lyricsResult?.lyrics?.lines.length).toBe(2);
        expect(lyricsResult?.lyrics?.lines[0]?.fullText).toContain('علم قلبي الغرام');
    });

    it('falls back to swapped track_name/artist_name query when initial search returns empty', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce({ ok: true, json: async () => [] }) // structured track_name=Amr Diab & artist_name=Al Leila
            .mockResolvedValueOnce({ ok: true, json: async () => [] }) // q=...
            .mockResolvedValueOnce({
                ok: true,
                json: async () => [
                    {
                        id: 77551,
                        trackName: 'El Leila',
                        artistName: 'Amr Diab',
                        albumName: 'El Leila',
                        duration: 235,
                        instrumental: false,
                        syncedLyrics: '[00:02.00] الليلة يا سمرا',
                    },
                ],
            });
        vi.stubGlobal('fetch', fetchMock);

        const candidates = await searchLrclibLyrics('Amr Diab Al Leila', 10, {
            title: 'Amr Diab',
            artist: 'Al Leila',
            durationMs: 235000,
        });

        expect(candidates).toHaveLength(1);
        expect(candidates[0].name).toBe('El Leila');
        expect(candidates[0].album?.name).toBe('El Leila');
    });
});
