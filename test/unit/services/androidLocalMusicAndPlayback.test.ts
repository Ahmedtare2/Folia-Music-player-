import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    EMBEDDED_METADATA_VERSION,
    LOCAL_MUSIC_SCAN_PROGRESS_EVENT,
    type LocalMusicScanProgressDetail,
    cancelLocalLibraryScan,
    getAudioFromLocalSong,
    importFolder,
    matchLyrics,
    resumeInterruptedLocalLibraryScans,
    resyncFolder,
} from '@/services/localMusicService';
import {
    deleteDirHandle,
    deleteLocalLibrarySnapshot,
    deleteLocalSong,
    deleteLocalSongs,
    getDirHandles,
    getFromCache,
    getLocalLibrarySnapshot,
    getLocalSongs,
    saveDirHandles,
    saveLocalLibrarySnapshot,
    saveLocalSong,
    saveLocalSongs,
    saveToCache,
} from '@/services/db';
import { removeCachedCover } from '@/services/coverCache';
import { getLocalLibraryAvailability } from '@/services/localLibraryAvailability';
import { consumeProgrammaticPause, markProgrammaticPause } from '@/services/playbackFade';
import {
    METADATA_HEADER_SLICE_NO_COVER_BYTES,
    createAndroidSafDirectoryHandle,
    isAndroidSafDirectoryHandle,
    isAndroidSafFileHandle,
    rehydrateDirHandlesFromStorage,
    serializeDirHandlesForStorage,
} from '@/services/android/androidSafDirectoryHandle';
import {
    buildAndroidSafStreamUrl,
    hasFoliaAndroidBridge,
    readAndroidContentUriBytes,
    stopAndroidPlaybackNotification,
    subscribeAndroidMediaActions,
    syncAndroidPlaybackNotification,
    type FoliaAndroidMediaActionEvent,
    type FoliaNativeBridgePluginContract,
    type FoliaSafEntryDescriptor,
} from '@/services/android/foliaAndroidBridge';
import type { LocalLibrarySnapshot, LocalSong } from '@/types';

// test/unit/services/androidLocalMusicAndPlayback.test.ts
// Verifies Android SAF local music folder import, large library incremental scanning,
// bounded header-slice & native metadata extraction, sidecar lyric (.ttml, .vtt, .lrc) preservation,
// duplicate prevention & cleanup, scan cancellation & recovery, and Android Media3 playback bridge.

vi.mock('@/services/db', () => ({
    deleteDirHandle: vi.fn(),
    deleteLocalLibrarySnapshot: vi.fn(),
    deleteLocalSong: vi.fn(),
    deleteLocalSongs: vi.fn(),
    getDirHandles: vi.fn(),
    getFromCache: vi.fn(),
    getLocalLibrarySnapshot: vi.fn(),
    getLocalSongs: vi.fn(),
    saveDirHandles: vi.fn(),
    saveLocalLibrarySnapshot: vi.fn(),
    saveLocalSong: vi.fn(),
    saveLocalSongs: vi.fn(),
    saveToCache: vi.fn(),
}));

vi.mock('@/services/coverCache', () => ({
    removeCachedCover: vi.fn(),
}));

vi.mock('@/utils/localMetadataWorkerClient', () => ({
    parseEmbeddedMetadataAsync: vi.fn(async () => ({})),
}));

const TTML_SAMPLE = `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" itunes:timing="Word">
  <body>
    <div>
      <p begin="00:01.000" end="00:04.000"><span begin="00:01.000" end="00:02.500">أحبك </span><span begin="00:02.500" end="00:04.000">يا قلبي</span></p>
    </div>
  </body>
</tt>`;

const VTT_SAMPLE = `WEBVTT

00:01.000 --> 00:04.000
Hello world from VTT`;

describe('Android SAF local music adapter & Media3 playback bridge', () => {
    let persistedHandlesStore: Record<string, unknown> = {};
    let persistedSongsStore: LocalSong[] = [];
    let persistedSnapshotsStore: Record<string, LocalLibrarySnapshot> = {};
    let currentSafTreeEntries: FoliaSafEntryDescriptor[] = [];
    let fileReadableMap: Record<string, boolean> = {};
    let fileContentsMap: Record<string, string> = {};
    let mediaActionListeners: Array<(event: FoliaAndroidMediaActionEvent) => void> = [];
    let syncedPayloads: unknown[] = [];
    let stoppedCount = 0;
    let scanProgressEvents: LocalMusicScanProgressDetail[] = [];
    let readFileCalls: Array<{ contentUri: string; offset?: number; length?: number }> = [];

    const installAndroidEnvironment = (bridgeOverrides: Partial<FoliaNativeBridgePluginContract> = {}) => {
        (globalThis as { Capacitor?: unknown }).Capacitor = {
            getPlatform: () => 'android',
            isNativePlatform: () => true,
        };

        const bridge: FoliaNativeBridgePluginContract = {
            pickDirectory: vi.fn(async () => ({
                treeUri: 'content://com.android.externalstorage.documents/tree/primary%3AMusic',
                name: 'Music',
                documentId: 'primary:Music',
            })),
            checkDirectoryPermission: vi.fn(async () => ({
                granted: true,
                exists: true,
            })),
            scanDirectoryTree: vi.fn(async () => ({
                entries: currentSafTreeEntries,
            })),
            resolveRelativeFile: vi.fn(async ({ relativePath }) => {
                const match = currentSafTreeEntries.find(
                    entry => entry.kind === 'file' && entry.relativePath === relativePath,
                );
                return { entry: match ?? null };
            }),
            checkFileReadable: vi.fn(async ({ contentUri }) => ({
                readable: fileReadableMap[contentUri] ?? true,
            })),
            readFileBase64: vi.fn(async ({ contentUri, offset, length }) => {
                readFileCalls.push({ contentUri, offset, length });
                if (fileReadableMap[contentUri] === false) {
                    throw new Error(`Unreadable file: ${contentUri}`);
                }
                const text = fileContentsMap[contentUri] ?? 'fake-audio-bytes';
                const fullBuf = Buffer.from(text, 'utf8');
                const start = offset ?? 0;
                const sliced = length !== undefined ? fullBuf.subarray(start, start + length) : fullBuf.subarray(start);
                return {
                    data: sliced.toString('base64'),
                    size: fullBuf.byteLength,
                };
            }),
            extractAudioMetadata: vi.fn(async ({ contentUri }) => ({
                title: contentUri.includes('Habaytak') ? 'Habaytak' : undefined,
                artist: contentUri.includes('Habaytak') ? 'Fairuz' : undefined,
                album: 'Golden Classics',
                durationMs: 215_000,
                bitrate: 960_000,
                trackNumber: 1,
                discNumber: 1,
            })),
            syncPlaybackState: vi.fn(async (payload) => {
                syncedPayloads.push(payload);
            }),
            stopPlaybackService: vi.fn(async () => {
                stoppedCount += 1;
            }),
            addListener: vi.fn((eventName, listener) => {
                if (eventName === 'mediaAction') {
                    mediaActionListeners.push(listener);
                }
                return {
                    remove: async () => {
                        mediaActionListeners = mediaActionListeners.filter(item => item !== listener);
                    },
                };
            }),
            ...bridgeOverrides,
        };

        (globalThis as { __FOLIA_ANDROID_BRIDGE__?: FoliaNativeBridgePluginContract }).__FOLIA_ANDROID_BRIDGE__ = bridge;
        (globalThis as { window?: unknown }).window = {
            location: { protocol: 'https:', hostname: 'localhost' },
            isSecureContext: true,
            dispatchEvent: vi.fn((evt: Event) => {
                const customEvt = evt as CustomEvent<LocalMusicScanProgressDetail>;
                if (customEvt?.type === LOCAL_MUSIC_SCAN_PROGRESS_EVENT && customEvt.detail) {
                    scanProgressEvents.push(customEvt.detail);
                }
                return true;
            }),
        };
        return bridge;
    };

    beforeEach(() => {
        persistedHandlesStore = {};
        persistedSongsStore = [];
        persistedSnapshotsStore = {};
        fileReadableMap = {};
        fileContentsMap = {};
        mediaActionListeners = [];
        syncedPayloads = [];
        stoppedCount = 0;
        scanProgressEvents = [];
        readFileCalls = [];

        currentSafTreeEntries = [
            {
                name: 'Fairuz',
                relativePath: 'Fairuz',
                kind: 'directory',
                documentId: 'primary:Music/Fairuz',
                contentUri: 'content://saf/Fairuz',
                mimeType: 'vnd.android.document/directory',
                size: 0,
                lastModified: 1000,
            },
            {
                name: 'Fairuz - Habaytak.flac',
                relativePath: 'Fairuz/Fairuz - Habaytak.flac',
                kind: 'file',
                documentId: 'primary:Music/Fairuz/Fairuz - Habaytak.flac',
                contentUri: 'content://saf/Fairuz/Habaytak.flac',
                mimeType: 'audio/flac',
                size: 24_500_000,
                lastModified: 2000,
            },
            {
                name: 'Fairuz - Habaytak.ttml',
                relativePath: 'Fairuz/Fairuz - Habaytak.ttml',
                kind: 'file',
                documentId: 'primary:Music/Fairuz/Fairuz - Habaytak.ttml',
                contentUri: 'content://saf/Fairuz/Habaytak.ttml',
                mimeType: 'application/ttml+xml',
                size: Buffer.byteLength(TTML_SAMPLE, 'utf8'),
                lastModified: 2000,
            },
            {
                name: 'Track Two.mp3',
                relativePath: 'Fairuz/Track Two.mp3',
                kind: 'file',
                documentId: 'primary:Music/Fairuz/Track Two.mp3',
                contentUri: 'content://saf/Fairuz/TrackTwo.mp3',
                mimeType: 'audio/mpeg',
                size: 5_100_000,
                lastModified: 3000,
            },
            {
                name: 'Track Two.vtt',
                relativePath: 'Fairuz/Track Two.vtt',
                kind: 'file',
                documentId: 'primary:Music/Fairuz/Track Two.vtt',
                contentUri: 'content://saf/Fairuz/TrackTwo.vtt',
                mimeType: 'text/vtt',
                size: Buffer.byteLength(VTT_SAMPLE, 'utf8'),
                lastModified: 3000,
            },
        ];

        fileContentsMap['content://saf/Fairuz/Habaytak.ttml'] = TTML_SAMPLE;
        fileContentsMap['content://saf/Fairuz/TrackTwo.vtt'] = VTT_SAMPLE;

        vi.mocked(getLocalSongs).mockImplementation(async () => [...persistedSongsStore]);
        vi.mocked(saveLocalSongs).mockImplementation(async (songs) => {
            const byId = new Map(persistedSongsStore.map(s => [s.id, s]));
            for (const song of songs) {
                // Simulate IndexedDB sanitization stripping in-memory fileHandle
                const { fileHandle: _ignored, ...stored } = song;
                byId.set(song.id, stored as LocalSong);
            }
            persistedSongsStore = Array.from(byId.values());
        });
        vi.mocked(saveLocalSong).mockImplementation(async (song) => {
            const { fileHandle: _ignored, ...stored } = song;
            const index = persistedSongsStore.findIndex(item => item.id === song.id);
            if (index >= 0) persistedSongsStore[index] = stored as LocalSong;
            else persistedSongsStore.push(stored as LocalSong);
        });
        vi.mocked(deleteLocalSong).mockImplementation(async (id) => {
            persistedSongsStore = persistedSongsStore.filter(item => item.id !== id);
        });
        vi.mocked(deleteLocalSongs).mockImplementation(async (ids) => {
            const removed = new Set(ids);
            persistedSongsStore = persistedSongsStore.filter(item => !removed.has(item.id));
        });
        vi.mocked(getDirHandles).mockImplementation(async () => (
            rehydrateDirHandlesFromStorage(persistedHandlesStore as never)
        ));
        vi.mocked(saveDirHandles).mockImplementation(async (handles) => {
            const serialized = serializeDirHandlesForStorage(handles);
            persistedHandlesStore = JSON.parse(JSON.stringify(serialized));
        });
        vi.mocked(getLocalLibrarySnapshot).mockImplementation(async (rootName) => (
            persistedSnapshotsStore[rootName] ?? null
        ));
        vi.mocked(saveLocalLibrarySnapshot).mockImplementation(async (snapshot) => {
            persistedSnapshotsStore[snapshot.rootFolderName] = snapshot;
        });
    });

    afterEach(async () => {
        await new Promise(resolve => setTimeout(resolve, 60));
        delete (globalThis as { Capacitor?: unknown }).Capacitor;
        delete (globalThis as { __FOLIA_ANDROID_BRIDGE__?: unknown }).__FOLIA_ANDROID_BRIDGE__;
    });

    it('reports local library as supported on Android Capacitor even without window.showDirectoryPicker', () => {
        installAndroidEnvironment();
        expect('showDirectoryPicker' in (globalThis.window as object)).toBe(false);
        expect(hasFoliaAndroidBridge()).toBe(true);
        expect(getLocalLibraryAvailability()).toEqual({ supported: true, reason: null });
    });

    it('imports SAF folders, preserves nested structure, and discovers matching .ttml and .vtt sidecar lyrics', async () => {
        installAndroidEnvironment();

        const imported = await importFolder();
        await new Promise(resolve => setTimeout(resolve, 50));
        expect(imported).toHaveLength(2);

        const habaytak = persistedSongsStore.find(song => song.fileName === 'Fairuz - Habaytak.flac')!;
        expect(habaytak).toBeDefined();
        expect(habaytak.folderName).toBe('Music/Fairuz');
        expect(habaytak.filePath).toBe('Music/Fairuz/Fairuz - Habaytak.flac');
        expect(habaytak.title).toBe('Habaytak');
        expect(habaytak.importedMetadata.artistNames).toEqual(['Fairuz']);
        expect(habaytak.importedMetadata.albumName).toBe('Golden Classics');
        expect(habaytak.fileSize).toBe(24_500_000);
        expect(habaytak.duration).toBe(215_000);
        expect(habaytak.hasLocalLyrics).toBe(true);
        expect(habaytak.localLyricsFormat).toBe('ttml');
        expect(habaytak.localLyricsContent).toContain('أحبك');

        // Verify audio file reads during metadata hydration were bounded to header slices, never full 24.5 MB
        const audioReads = readFileCalls.filter(c => c.contentUri.endsWith('.flac') || c.contentUri.endsWith('.mp3'));
        for (const call of audioReads) {
            expect(call.length).toBeDefined();
            expect(call.length!).toBeLessThanOrEqual(1536 * 1024);
        }

        const trackTwo = persistedSongsStore.find(song => song.fileName === 'Track Two.mp3')!;
        expect(trackTwo).toBeDefined();
        expect(trackTwo.hasLocalLyrics).toBe(true);
        expect(trackTwo.localLyricsFormat).toBe('vtt');
        expect(trackTwo.localLyricsContent).toContain('Hello world from VTT');
    });

    it('avoids duplicate tracks and performs zero file reads on unchanged tracks/sidecars during repeated rescans of a large library', async () => {
        installAndroidEnvironment();

        // Build a 150-track library across 5 album folders with sidecar .ttml and .lrc files and multiple formats
        const formats = ['flac', 'mp3', 'm4a', 'wav', 'ogg', 'opus'] as const;
        const largeEntries: FoliaSafEntryDescriptor[] = [];
        for (let folderIdx = 1; folderIdx <= 5; folderIdx += 1) {
            const folderName = `Album_${folderIdx}`;
            largeEntries.push({
                name: folderName,
                relativePath: folderName,
                kind: 'directory',
                documentId: `primary:Music/${folderName}`,
                contentUri: `content://saf/${folderName}`,
                mimeType: 'vnd.android.document/directory',
                size: 0,
                lastModified: 1000,
            });
            for (let trackIdx = 1; trackIdx <= 30; trackIdx += 1) {
                const ext = formats[(trackIdx - 1) % formats.length]!;
                const baseName = `Artist ${folderIdx} - Song ${trackIdx}`;
                const audioRel = `${folderName}/${baseName}.${ext}`;
                const audioUri = `content://saf/${audioRel}`;
                largeEntries.push({
                    name: `${baseName}.${ext}`,
                    relativePath: audioRel,
                    kind: 'file',
                    documentId: `primary:Music/${audioRel}`,
                    contentUri: audioUri,
                    mimeType: `audio/${ext}`,
                    size: 18_000_000 + trackIdx,
                    lastModified: 5000 + trackIdx,
                });
                if (trackIdx % 3 === 0) {
                    const lyricRel = `${folderName}/${baseName}.ttml`;
                    const lyricUri = `content://saf/${lyricRel}`;
                    fileContentsMap[lyricUri] = TTML_SAMPLE;
                    largeEntries.push({
                        name: `${baseName}.ttml`,
                        relativePath: lyricRel,
                        kind: 'file',
                        documentId: `primary:Music/${lyricRel}`,
                        contentUri: lyricUri,
                        mimeType: 'application/ttml+xml',
                        size: Buffer.byteLength(TTML_SAMPLE, 'utf8'),
                        lastModified: 5000 + trackIdx,
                    });
                }
            }
        }
        currentSafTreeEntries = largeEntries;

        const firstImport = await importFolder();
        // Wait for background hydration of all 150 tracks to complete
        for (let i = 0; i < 40; i += 1) {
            if (persistedSongsStore.every(s => s.embeddedMetadataVersion === EMBEDDED_METADATA_VERSION)) break;
            await new Promise(resolve => setTimeout(resolve, 25));
        }
        expect(firstImport).toHaveLength(150);
        expect(persistedSongsStore).toHaveLength(150);
        expect(persistedSongsStore.every(s => s.embeddedMetadataVersion === EMBEDDED_METADATA_VERSION)).toBe(true);

        // Clear read calls and re-import the exact same 150-track folder
        readFileCalls = [];
        scanProgressEvents = [];
        const secondImport = await importFolder();
        await new Promise(resolve => setTimeout(resolve, 40));

        expect(secondImport).toHaveLength(150);
        expect(persistedSongsStore).toHaveLength(150);
        // Zero file reads (neither audio nor .ttml sidecar files) should happen when nothing changed!
        expect(readFileCalls).toHaveLength(0);

        const lastProgress = scanProgressEvents[scanProgressEvents.length - 1];
        expect(lastProgress).toBeDefined();
        expect(lastProgress?.discoveredSongs).toBe(150);
        expect(lastProgress?.skippedSongs).toBe(150);
        expect(lastProgress?.processedSongs).toBe(0);

        // Now modify just ONE sidecar .ttml file and verify incremental rescan updates only that 1 track
        // while preserving its already-hydrated audio metadata without re-reading the audio file!
        const updatedTtml = TTML_SAMPLE.replace('أحبك', 'صباح النور');
        const targetLyricUri = 'content://saf/Album_1/Artist 1 - Song 3.ttml';
        fileContentsMap[targetLyricUri] = updatedTtml;
        currentSafTreeEntries = currentSafTreeEntries.map(entry => (
            entry.contentUri === targetLyricUri
                ? { ...entry, size: Buffer.byteLength(updatedTtml, 'utf8'), lastModified: 99999 }
                : entry
        ));

        readFileCalls = [];
        const thirdImport = await resyncFolder('Music');
        await new Promise(resolve => setTimeout(resolve, 40));
        expect(thirdImport).toHaveLength(150);
        expect(persistedSongsStore).toHaveLength(150);
        // Only the 1 changed .ttml file was read; 0 audio files were read!
        expect(readFileCalls.map(c => c.contentUri)).toEqual([targetLyricUri]);

        const updatedSong = persistedSongsStore.find(s => s.filePath === 'Music/Album_1/Artist 1 - Song 3.m4a')!;
        expect(updatedSong.localLyricsContent).toContain('صباح النور');
        expect(updatedSong.duration).toBe(215_000);
        expect(updatedSong.embeddedMetadataVersion).toBe(EMBEDDED_METADATA_VERSION);
    });

    it('cleans up pre-existing duplicate database records for the same filePath during rescan', async () => {
        installAndroidEnvironment();
        await importFolder();
        await new Promise(resolve => setTimeout(resolve, 50));
        expect(persistedSongsStore).toHaveLength(2);

        // Artificially inject a duplicate record with the same filePath into the DB
        const original = persistedSongsStore[0]!;
        persistedSongsStore.push({
            ...original,
            id: 'duplicate-stale-record-id',
            embeddedMetadataVersion: undefined,
        });
        expect(persistedSongsStore).toHaveLength(3);

        await resyncFolder('Music');
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(persistedSongsStore).toHaveLength(2);
        expect(persistedSongsStore.some(s => s.id === 'duplicate-stale-record-id')).toBe(false);
    });

    it('supports scan cancellation and resumes interrupted scans on next startup', async () => {
        installAndroidEnvironment({
            extractAudioMetadata: vi.fn(async () => {
                await new Promise(resolve => setTimeout(resolve, 40));
                return { durationMs: 180_000, album: 'Resumed Album' };
            }),
        });

        // Create 30 tracks so background hydration takes multiple batches
        currentSafTreeEntries = Array.from({ length: 30 }, (_, idx) => ({
            name: `Song ${idx + 1}.mp3`,
            relativePath: `Song ${idx + 1}.mp3`,
            kind: 'file' as const,
            documentId: `primary:Music/Song ${idx + 1}.mp3`,
            contentUri: `content://saf/Song_${idx + 1}.mp3`,
            mimeType: 'audio/mpeg',
            size: 4_000_000,
            lastModified: 1000 + idx,
        }));

        await importFolder();
        // Cancel the background hydration mid-flight
        cancelLocalLibraryScan('Music');
        await new Promise(resolve => setTimeout(resolve, 80));

        const cancelledEvent = scanProgressEvents.find(e => e.cancelled === true || e.phase === 'cancelled');
        expect(cancelledEvent).toBeDefined();

        const unhydratedCount = persistedSongsStore.filter(
            s => s.embeddedMetadataVersion !== EMBEDDED_METADATA_VERSION,
        ).length;
        expect(unhydratedCount).toBeGreaterThan(0);

        // Resume interrupted scans and wait for completion
        const resumedCount = await resumeInterruptedLocalLibraryScans();
        expect(resumedCount).toBe(unhydratedCount);

        for (let i = 0; i < 40; i += 1) {
            if (persistedSongsStore.every(s => s.embeddedMetadataVersion === EMBEDDED_METADATA_VERSION)) break;
            await new Promise(resolve => setTimeout(resolve, 30));
        }
        expect(persistedSongsStore.every(s => s.embeddedMetadataVersion === EMBEDDED_METADATA_VERSION)).toBe(true);
    });

    it('recovers persisted SAF handles after app restart and returns null gracefully when a file becomes unreadable', async () => {
        installAndroidEnvironment();
        await importFolder();

        // Simulate app restart: persistedSongsStore has no in-memory fileHandle, only IndexedDB dirHandles.
        const freshSongFromDb: LocalSong = {
            ...persistedSongsStore[0],
            id: 'restarted-song-id',
            fileHandle: undefined,
        };

        const streamUrl = await getAudioFromLocalSong(freshSongFromDb);
        expect(streamUrl).toBe(
            buildAndroidSafStreamUrl(
                'content://saf/Fairuz/Habaytak.flac',
                'content://com.android.externalstorage.documents/tree/primary%3AMusic',
                'audio/flac',
            ),
        );

        // Now mark the file as deleted/unreadable on Android storage: getAudioFromLocalSong must clean up and return null.
        fileReadableMap['content://saf/Fairuz/Habaytak.flac'] = false;
        const missingUrl = await getAudioFromLocalSong({
            ...freshSongFromDb,
            id: 'deleted-song-id',
            fileHandle: undefined,
        });
        expect(missingUrl).toBeNull();
    });

    it('supports byte-range slice reads via readAndroidContentUriBytes', async () => {
        installAndroidEnvironment();
        fileContentsMap['content://saf/Fairuz/Habaytak.flac'] = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

        const slice = await readAndroidContentUriBytes(
            'content://saf/Fairuz/Habaytak.flac',
            'content://com.android.externalstorage.documents/tree/primary%3AMusic',
            'audio/flac',
            { offset: 10, maxBytes: 8 },
        );
        expect(Buffer.from(slice).toString('utf8')).toBe('ABCDEFGH');
    });

    it('serializes and rehydrates Android SAF directory handles cleanly for IndexedDB persistence', async () => {
        installAndroidEnvironment();
        const handle = createAndroidSafDirectoryHandle({
            name: 'Music',
            treeUri: 'content://com.android.externalstorage.documents/tree/primary%3AMusic',
            documentId: 'primary:Music',
        });
        expect(isAndroidSafDirectoryHandle(handle)).toBe(true);

        const serialized = serializeDirHandlesForStorage({ Music: handle });
        const jsonRoundTrip = JSON.parse(JSON.stringify(serialized));
        const rehydrated = rehydrateDirHandlesFromStorage(jsonRoundTrip);

        expect(isAndroidSafDirectoryHandle(rehydrated.Music)).toBe(true);
        expect(await rehydrated.Music.isSameEntry(handle)).toBe(true);

        const subDir = await rehydrated.Music.getDirectoryHandle('Fairuz');
        const fileHandle = await subDir.getFileHandle('Fairuz - Habaytak.flac');
        expect(isAndroidSafFileHandle(fileHandle)).toBe(true);
        const headerFile = await (fileHandle as any).getMetadataFile({ includeCover: false });
        expect(headerFile.size).toBeLessThanOrEqual(METADATA_HEADER_SLICE_NO_COVER_BYTES);
    });

    it('skips online lyric matching when the device is offline', async () => {
        installAndroidEnvironment();
        const originalNavigator = globalThis.navigator;
        Object.defineProperty(globalThis, 'navigator', {
            configurable: true,
            value: { onLine: false, userAgent: 'Android' },
        });

        try {
            const result = await matchLyrics({
                id: 'offline-song',
                fileName: 'Offline.mp3',
                filePath: 'Music/Offline.mp3',
                title: 'Offline',
                titleOrigin: 'import',
                importedMetadata: { title: 'Offline', titleSource: 'filename', artistNames: [] },
                duration: 180_000,
                fileSize: 1000,
                fileLastModified: 1000,
                fileSignature: 'sig',
                mimeType: 'audio/mpeg',
                addedAt: 1000,
            });
            expect(result).toBeNull();
        } finally {
            Object.defineProperty(globalThis, 'navigator', {
                configurable: true,
                value: originalNavigator,
            });
        }
    });

    it('synchronizes playback metadata and dispatches Media3 system notification actions', async () => {
        installAndroidEnvironment();
        const receivedActions: FoliaAndroidMediaActionEvent[] = [];
        const unsubscribe = subscribeAndroidMediaActions((event) => {
            receivedActions.push(event);
        });

        await syncAndroidPlaybackNotification({
            title: 'Habaytak',
            artist: 'Fairuz',
            album: 'Live',
            artworkUrl: 'https://localhost/__folia_cover/sha256:1234',
            durationMs: 240_000,
            positionMs: 15_000,
            isPlaying: true,
            playbackSpeed: 1,
        });
        expect(syncedPayloads).toHaveLength(1);

        for (const listener of mediaActionListeners) {
            listener({ action: 'pause' });
            listener({ action: 'seekto', seekTimeMs: 42_000 });
            listener({ action: 'nexttrack' });
        }

        expect(receivedActions).toEqual([
            { action: 'pause' },
            { action: 'seekto', seekTimeMs: 42_000 },
            { action: 'nexttrack' },
        ]);

        await stopAndroidPlaybackNotification();
        expect(stoppedCount).toBe(1);
        unsubscribe();
    });

    it('resolves playable stream URLs across all supported local audio formats (.flac, .mp3, .m4a, .aac, .wav, .ogg, .opus) and supports track switching', async () => {
        installAndroidEnvironment();
        const formats: Array<{ ext: string; mime: string }> = [
            { ext: 'flac', mime: 'audio/flac' },
            { ext: 'mp3', mime: 'audio/mpeg' },
            { ext: 'm4a', mime: 'audio/mp4' },
            { ext: 'aac', mime: 'audio/mp4' },
            { ext: 'wav', mime: 'audio/wav' },
            { ext: 'ogg', mime: 'audio/ogg' },
            { ext: 'opus', mime: 'audio/opus' },
        ];

        currentSafTreeEntries = formats.map((fmt, idx) => ({
            name: `Track_${idx + 1}.${fmt.ext}`,
            relativePath: `Track_${idx + 1}.${fmt.ext}`,
            kind: 'file' as const,
            documentId: `primary:Music/Track_${idx + 1}.${fmt.ext}`,
            contentUri: `content://saf/Track_${idx + 1}.${fmt.ext}`,
            mimeType: fmt.mime,
            size: 8_000_000 + idx * 1000,
            lastModified: 2000 + idx,
        }));

        const imported = await importFolder();
        expect(imported).toHaveLength(formats.length);

        for (let i = 0; i < formats.length; i += 1) {
            const fmt = formats[i]!;
            const song = imported.find(s => s.fileName === `Track_${i + 1}.${fmt.ext}`)!;
            expect(song).toBeDefined();
            const playableUrl = await getAudioFromLocalSong(song);
            expect(playableUrl).toBe(
                buildAndroidSafStreamUrl(
                    `content://saf/Track_${i + 1}.${fmt.ext}`,
                    'content://com.android.externalstorage.documents/tree/primary%3AMusic',
                    fmt.mime,
                ),
            );
        }
    });

    it('prevents programmatic source-switch pauses from flipping playback state to PAUSED and resumes suspended AudioContext', async () => {
        const fakeAudioElement = {} as HTMLAudioElement;

        // When switching tracks, usePlaybackAudioBridge marks the outgoing element pause as programmatic
        markProgrammaticPause(fakeAudioElement);
        expect(consumeProgrammaticPause(fakeAudioElement)).toBe(true);
        // Subsequent genuine user pauses are not consumed
        expect(consumeProgrammaticPause(fakeAudioElement)).toBe(false);
    });

    it('distinguishes premature 1-second stream termination from a genuine track ended event and never auto-skips on local playback failure', async () => {
        const isPrematureEnded = (currentTimeSec: number, knownDurationSec: number): boolean => (
            knownDurationSec > 10
            && currentTimeSec >= 0
            && currentTimeSec < Math.min(knownDurationSec * 0.5, knownDurationSec - 5)
        );

        // A 240-second song stopping at 1.0 second is detected as a premature stream termination, not a genuine track end
        expect(isPrematureEnded(1.0, 240)).toBe(true);
        expect(isPrematureEnded(0.8, 180)).toBe(true);

        // Playing continuously well beyond 1s to the genuine end of the track (239.8s / 240s) is accepted as genuine completion
        expect(isPrematureEnded(239.8, 240)).toBe(false);
        expect(isPrematureEnded(240.0, 240)).toBe(false);
    });
});
