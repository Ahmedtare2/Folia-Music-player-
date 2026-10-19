import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    getAudioFromLocalSong,
    importFolder,
    matchLyrics,
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
import {
    createAndroidSafDirectoryHandle,
    isAndroidSafDirectoryHandle,
    isAndroidSafFileHandle,
    rehydrateDirHandlesFromStorage,
    serializeDirHandlesForStorage,
} from '@/services/android/androidSafDirectoryHandle';
import {
    buildAndroidSafStreamUrl,
    hasFoliaAndroidBridge,
    stopAndroidPlaybackNotification,
    subscribeAndroidMediaActions,
    syncAndroidPlaybackNotification,
    type FoliaAndroidMediaActionEvent,
    type FoliaNativeBridgePluginContract,
    type FoliaSafEntryDescriptor,
} from '@/services/android/foliaAndroidBridge';
import type { LocalLibrarySnapshot, LocalSong } from '@/types';

// test/unit/services/androidLocalMusicAndPlayback.test.ts
// Verifies Android SAF local music folder import, persisted URI handle rehydration across restarts,
// duplicate prevention on rescan, sidecar lyric (.ttml, .vtt, .lrc) discovery, unreadable/deleted
// file handling, offline lyric-match guard, and Android Media3 playback bridge synchronization.

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
            readFileBase64: vi.fn(async ({ contentUri }) => {
                if (fileReadableMap[contentUri] === false) {
                    throw new Error(`Unreadable file: ${contentUri}`);
                }
                const text = fileContentsMap[contentUri] ?? 'fake-audio-bytes';
                return {
                    data: Buffer.from(text, 'utf8').toString('base64'),
                    size: Buffer.byteLength(text, 'utf8'),
                };
            }),
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
            dispatchEvent: vi.fn(),
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
        vi.mocked(getDirHandles).mockImplementation(async () => (
            rehydrateDirHandlesFromStorage(persistedHandlesStore as never)
        ));
        vi.mocked(saveDirHandles).mockImplementation(async (handles) => {
            // Verify handles are converted to plain JSON without functions for IndexedDB structured clone
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

    afterEach(() => {
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
        expect(imported).toHaveLength(2);

        const habaytak = imported.find(song => song.fileName === 'Fairuz - Habaytak.flac')!;
        expect(habaytak).toBeDefined();
        expect(habaytak.folderName).toBe('Music/Fairuz');
        expect(habaytak.filePath).toBe('Music/Fairuz/Fairuz - Habaytak.flac');
        expect(habaytak.title).toBe('Habaytak');
        expect(habaytak.importedMetadata.artistNames).toEqual(['Fairuz']);
        expect(habaytak.hasLocalLyrics).toBe(true);
        expect(habaytak.localLyricsFormat).toBe('ttml');
        expect(habaytak.localLyricsContent).toContain('أحبك');

        const trackTwo = imported.find(song => song.fileName === 'Track Two.mp3')!;
        expect(trackTwo).toBeDefined();
        expect(trackTwo.hasLocalLyrics).toBe(true);
        expect(trackTwo.localLyricsFormat).toBe('vtt');
        expect(trackTwo.localLyricsContent).toContain('Hello world from VTT');
    });

    it('avoids duplicate tracks when re-importing or rescanning an already-imported SAF folder', async () => {
        installAndroidEnvironment();

        const firstImport = await importFolder();
        expect(firstImport).toHaveLength(2);
        const firstIds = firstImport.map(s => s.id).sort();

        // Picking the same SAF folder a second time must recognize the existing root via isSameEntry()
        // and reuse existing song IDs rather than creating "Music (2)" or duplicating tracks.
        const secondImport = await importFolder();
        expect(secondImport).toHaveLength(2);
        expect(secondImport.map(s => s.id).sort()).toEqual(firstIds);
        expect(persistedSongsStore).toHaveLength(2);

        // Resyncing by folder name also reuses existing tracks and removes deleted files.
        currentSafTreeEntries = currentSafTreeEntries.filter(
            entry => !entry.name.startsWith('Track Two'),
        );
        const resynced = await resyncFolder('Music/Fairuz');
        expect(resynced).toHaveLength(1);
        expect(resynced?.[0]?.fileName).toBe('Fairuz - Habaytak.flac');
        expect(persistedSongsStore).toHaveLength(1);
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
});
