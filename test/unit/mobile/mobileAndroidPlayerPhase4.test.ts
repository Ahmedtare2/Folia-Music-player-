import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LocalPlaylist, LocalSong } from '@/types';
import {
    INITIAL_MOBILE_NAVIGATION_STATE,
    type MobileNavigationState,
    buildMobileLibraryCollections,
    filterAndSortLocalSongs,
    isLocalSongCurrentlyPlaying,
    isMobileVisualizerVisible,
    resolveLocalSongAlbumText,
    resolveLocalSongArtistText,
    stepMobileBackNavigation,
} from '@/components/mobile/mobileNavigationModel';
import {
    DESKTOP_MAX_CANVAS_DPR,
    MOBILE_MAX_CANVAS_DPR,
    MOBILE_MAX_PIXI_RESOLUTION,
    MOBILE_MAX_TEXTURE_AXIS_PX,
    isMobileGpuConstrained,
    resolveMobileCanvasDpr,
    resolveMobileLumiereQuality,
    resolveMobilePixiResolution,
    shouldSuspendVisualizerForVisibility,
} from '@/utils/mobileVisualizerBudget';
import {
    isMobilePhoneViewport,
    shouldUseAndroidMobileShell,
} from '@/utils/platform';
import { minimizeAndroidApp } from '@/services/android/foliaAndroidBridge';

// test/unit/mobile/mobileAndroidPlayerPhase4.test.ts
// Verifies Phase 4 mobile-first Android music player navigation, hardware Back stack,
// local song search/sort/grouping (including Arabic & English), GPU/DPR/Pixi budgets,
// and visibility-driven visualizer suspension.

type MakeLocalSongInput = Omit<Partial<LocalSong>, 'importedMetadata'> & {
    id: string;
    title: string;
    importedMetadata?: Partial<LocalSong['importedMetadata']>;
};

const makeLocalSong = (overrides: MakeLocalSongInput): LocalSong => {
    const fileName = overrides.fileName ?? `${overrides.title}.mp3`;
    const folderName = overrides.folderName ?? 'Music';
    const { importedMetadata, ...rest } = overrides;
    return {
        id: overrides.id,
        title: overrides.title,
        titleOrigin: overrides.titleOrigin ?? 'import',
        folderName,
        fileName,
        filePath: overrides.filePath ?? `${folderName}/${fileName}`,
        mimeType: overrides.mimeType ?? 'audio/mpeg',
        fileSize: overrides.fileSize ?? 5_000_000,
        duration: overrides.duration ?? 210_000,
        addedAt: overrides.addedAt ?? 1_700_000_000_000,
        hasLocalLyrics: overrides.hasLocalLyrics ?? false,
        hasEmbeddedLyrics: overrides.hasEmbeddedLyrics ?? false,
        ...rest,
        importedMetadata: {
            title: importedMetadata?.title ?? overrides.title,
            titleSource: importedMetadata?.titleSource ?? 'embedded',
            artistNames: importedMetadata?.artistNames ?? ['Amr Diab'],
            albumName: importedMetadata?.albumName ?? 'Tamally Maak',
        },
    };
};

describe('Phase 4: Mobile-first Android player architecture & usability', () => {
    const originalCapacitor = (globalThis as { Capacitor?: unknown }).Capacitor;
    const originalNavigator = (globalThis as { navigator?: unknown }).navigator;
    const originalBridge = (globalThis as { __FOLIA_ANDROID_BRIDGE__?: unknown }).__FOLIA_ANDROID_BRIDGE__;

    afterEach(() => {
        if (originalCapacitor === undefined) {
            delete (globalThis as { Capacitor?: unknown }).Capacitor;
        } else {
            (globalThis as { Capacitor?: unknown }).Capacitor = originalCapacitor;
        }
        if (originalNavigator !== undefined) {
            Object.defineProperty(globalThis, 'navigator', {
                configurable: true,
                value: originalNavigator,
            });
        }
        if (originalBridge === undefined) {
            delete (globalThis as { __FOLIA_ANDROID_BRIDGE__?: unknown }).__FOLIA_ANDROID_BRIDGE__;
        } else {
            (globalThis as { __FOLIA_ANDROID_BRIDGE__?: unknown }).__FOLIA_ANDROID_BRIDGE__ = originalBridge;
        }
    });

    describe('Platform & Mobile Shell activation', () => {
        it('activates mobile shell on Capacitor Android, Android user-agent, or ?mobile=1 query without breaking desktop', () => {
            delete (globalThis as { Capacitor?: unknown }).Capacitor;
            Object.defineProperty(globalThis, 'navigator', {
                configurable: true,
                value: { userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/134.0.0.0' },
            });

            expect(shouldUseAndroidMobileShell({ search: '' })).toBe(false);
            expect(shouldUseAndroidMobileShell({ search: '?mobile=1' })).toBe(true);
            expect(shouldUseAndroidMobileShell({ search: '?android=1' })).toBe(true);

            (globalThis as { Capacitor?: unknown }).Capacitor = {
                getPlatform: () => 'android',
                isNativePlatform: () => true,
            };
            expect(shouldUseAndroidMobileShell({ search: '' })).toBe(true);
            expect(shouldUseAndroidMobileShell({ search: '?desktop=1' })).toBe(false);
        });

        it('identifies portrait and landscape mobile phone viewports', () => {
            expect(isMobilePhoneViewport(390, 844)).toBe(true);
            expect(isMobilePhoneViewport(844, 390)).toBe(true);
            expect(isMobilePhoneViewport(1440, 900)).toBe(false);
        });
    });

    describe('Android hardware Back navigation stack (stepMobileBackNavigation)', () => {
        it('closes open app modals (Command Palette, Lyric Match, Settings) first', () => {
            const closePalette = vi.fn();
            const closeLyricMatch = vi.fn();
            const closeSettings = vi.fn();

            const res1 = stepMobileBackNavigation(INITIAL_MOBILE_NAVIGATION_STATE, {
                isCommandPaletteOpen: true,
                closeCommandPalette: closePalette,
            });
            expect(res1.handled).toBe(true);
            res1.sideEffect?.();
            expect(closePalette).toHaveBeenCalledTimes(1);

            const res2 = stepMobileBackNavigation(INITIAL_MOBILE_NAVIGATION_STATE, {
                isLyricMatchOpen: true,
                closeLyricMatch,
            });
            expect(res2.handled).toBe(true);
            res2.sideEffect?.();
            expect(closeLyricMatch).toHaveBeenCalledTimes(1);

            const res3 = stepMobileBackNavigation(INITIAL_MOBILE_NAVIGATION_STATE, {
                isSettingsModalOpen: true,
                closeSettingsModal: closeSettings,
            });
            expect(res3.handled).toBe(true);
            res3.sideEffect?.();
            expect(closeSettings).toHaveBeenCalledTimes(1);
        });

        it('steps down from sub-drawer -> full-screen lyrics/visualizer -> cover -> mini-player -> collection detail -> root Songs tab -> native minimize', async () => {
            let state: MobileNavigationState = {
                activeTab: 'albums',
                albumsSubTab: 'albums',
                foldersSubTab: 'folders',
                collectionDetail: {
                    kind: 'album',
                    id: 'album-1',
                    title: 'تملي معاك',
                    songs: [],
                },
                playerSheet: 'expanded',
                playerDisplayMode: 'lyrics',
                subDrawer: 'lyrics-tools',
            };

            // Step 1: Close lyrics-tools subDrawer
            const step1 = stepMobileBackNavigation(state);
            expect(step1.handled).toBe(true);
            expect(step1.nextState.subDrawer).toBe('none');
            expect(step1.nextState.playerDisplayMode).toBe('lyrics');
            state = step1.nextState;

            // Step 2: Return from full-screen synchronized lyrics to cover view
            const step2 = stepMobileBackNavigation(state);
            expect(step2.handled).toBe(true);
            expect(step2.nextState.playerDisplayMode).toBe('cover');
            expect(step2.nextState.playerSheet).toBe('expanded');
            state = step2.nextState;

            // Step 3: Collapse expanded Now Playing sheet to persistent mini-player
            const step3 = stepMobileBackNavigation(state);
            expect(step3.handled).toBe(true);
            expect(step3.nextState.playerSheet).toBe('collapsed');
            expect(step3.nextState.collectionDetail?.id).toBe('album-1');
            state = step3.nextState;

            // Step 4: Exit Album collection detail back to Albums grid
            const step4 = stepMobileBackNavigation(state);
            expect(step4.handled).toBe(true);
            expect(step4.nextState.collectionDetail).toBeNull();
            expect(step4.nextState.activeTab).toBe('albums');
            state = step4.nextState;

            // Step 5: Return from Albums tab to primary Songs (Library) tab
            const step5 = stepMobileBackNavigation(state);
            expect(step5.handled).toBe(true);
            expect(step5.nextState.activeTab).toBe('songs');
            state = step5.nextState;

            // Step 6: At root Songs tab, returns handled=false so native bridge minimizes app
            const step6 = stepMobileBackNavigation(state);
            expect(step6.handled).toBe(false);

            const minimizeSpy = vi.fn().mockReturnValue(Promise.resolve());
            (globalThis as { __FOLIA_ANDROID_BRIDGE__?: unknown }).__FOLIA_ANDROID_BRIDGE__ = {
                minimizeApp: minimizeSpy,
            };
            expect(await minimizeAndroidApp()).toBe(true);
            expect(minimizeSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('Local music search, sorting, and collection grouping (including Arabic & English)', () => {
        const songs: LocalSong[] = [
            makeLocalSong({
                id: 's1',
                title: 'تملي معاك',
                folderName: 'Arabic Classics',
                addedAt: 1000,
                importedMetadata: { artistNames: ['عمرو دياب'], albumName: 'تملي معاك' },
            }),
            makeLocalSong({
                id: 's2',
                title: 'Nour El Ain',
                folderName: 'Arabic Classics',
                addedAt: 3000,
                importedMetadata: { artistNames: ['Amr Diab'], albumName: 'Nour El Ain' },
            }),
            makeLocalSong({
                id: 's3',
                title: 'Midnight City',
                folderName: 'Synthwave',
                addedAt: 2000,
                importedMetadata: { artistNames: ['M83'], albumName: 'Hurry Up, We Are Dreaming' },
            }),
        ];

        const playlists: LocalPlaylist[] = [
            {
                id: 'fav',
                name: 'Favorites',
                songIds: ['s1', 's2'],
                createdAt: 1000,
                updatedAt: 2000,
                isFavorite: true,
            },
        ];

        it('filters songs by Arabic title, artist, album, or folder name and sorts accurately', () => {
            const arabicMatches = filterAndSortLocalSongs(songs, 'عمرو', 'title');
            expect(arabicMatches.map(s => s.id)).toEqual(['s1']);

            const folderMatches = filterAndSortLocalSongs(songs, 'arabic classics', 'recent');
            expect(folderMatches.map(s => s.id)).toEqual(['s2', 's1']);

            const recentAll = filterAndSortLocalSongs(songs, '', 'recent');
            expect(recentAll.map(s => s.id)).toEqual(['s2', 's3', 's1']);
        });

        it('builds Albums, Artists, Folders (including All Songs), and Playlists collections', () => {
            const collections = buildMobileLibraryCollections(
                songs,
                playlists,
                undefined,
                (key, fallback) => fallback || key,
            );

            expect(collections.albums).toHaveLength(3);
            expect(collections.artists).toHaveLength(3);
            // Folders includes virtual "All Songs" + "Arabic Classics" + "Synthwave"
            expect(collections.folders).toHaveLength(3);
            expect(collections. playlists).toHaveLength(1);
            expect(collections.playlists[0]?.songs.map(s => s.id)).toEqual(['s1', 's2']);
        });

        it('identifies the currently playing local song and resolves artist/album labels', () => {
            expect(resolveLocalSongArtistText(songs[0]!)).toBe('عمرو دياب');
            expect(resolveLocalSongAlbumText(songs[0]!)).toBe('تملي معاك');
            expect(
                isLocalSongCurrentlyPlaying(songs[0]!, {
                    id: -101,
                    name: 'تملي معاك',
                    artists: [{ id: 0, name: 'عمرو دياب' }],
                    album: { id: 0, name: 'تملي معاك' },
                    localRef: { songId: 's1' },
                } as any),
            ).toBe(true);
            expect(
                isLocalSongCurrentlyPlaying(songs[1]!, {
                    id: -101,
                    name: 'تملي معاك',
                    artists: [{ id: 0, name: 'عمرو دياب' }],
                    album: { id: 0, name: 'تملي معاك' },
                    localRef: { songId: 's1' },
                } as any),
            ).toBe(false);
        });
    });

    describe('Mobile Visualizer GPU, DPR, Pixi Texture Pool & Visibility Budgets', () => {
        it('caps Canvas 2D DPR at 1.5x on mobile/Android and 2.0x on desktop', () => {
            expect(resolveMobileCanvasDpr(3.5, true)).toBe(MOBILE_MAX_CANVAS_DPR);
            expect(resolveMobileCanvasDpr(2.75, true)).toBe(MOBILE_MAX_CANVAS_DPR);
            expect(resolveMobileCanvasDpr(1.25, true)).toBe(1.25);
            expect(resolveMobileCanvasDpr(3.0, false)).toBe(DESKTOP_MAX_CANVAS_DPR);
        });

        it('caps Pixi renderer resolution on mobile so tall phone viewports stay within texture budget', () => {
            // Desktop passes through unchanged
            expect(resolveMobilePixiResolution(1920, 1080, 1.5, false)).toBe(1.5);

            // Mobile caps at MOBILE_MAX_PIXI_RESOLUTION (1.25) and MOBILE_MAX_TEXTURE_AXIS_PX / maxAxis
            const mobileRes = resolveMobilePixiResolution(412, 915, 1.5, true);
            expect(mobileRes).toBeLessThanOrEqual(MOBILE_MAX_PIXI_RESOLUTION);
            expect(mobileRes * 915).toBeLessThanOrEqual(MOBILE_MAX_TEXTURE_AXIS_PX + 1);
        });

        it('maps Lumiere full quality to balanced on constrained mobile GPUs while keeping low', () => {
            expect(resolveMobileLumiereQuality('full', true)).toBe('balanced');
            expect(resolveMobileLumiereQuality('balanced', true)).toBe('balanced');
            expect(resolveMobileLumiereQuality('low', true)).toBe('low');
            expect(resolveMobileLumiereQuality('full', false)).toBe('full');
        });

        it('suspends visualizer animations when screen is locked, document is hidden, or mobile shell is in Library/Cover view', () => {
            expect(
                isMobileVisualizerVisible({ playerSheet: 'collapsed', playerDisplayMode: 'lyrics' }),
            ).toBe(false);
            expect(
                isMobileVisualizerVisible({ playerSheet: 'expanded', playerDisplayMode: 'cover' }),
            ).toBe(false);
            expect(
                isMobileVisualizerVisible({ playerSheet: 'expanded', playerDisplayMode: 'lyrics' }),
            ).toBe(true);
            expect(
                isMobileVisualizerVisible({ playerSheet: 'expanded', playerDisplayMode: 'stage' }),
            ).toBe(true);

            // Screen locked on Android (isActivityVisible = false) -> suspend immediately
            expect(
                shouldSuspendVisualizerForVisibility({
                    isActivityVisible: false,
                    isDocumentVisible: true,
                    isMobileShellActive: true,
                    isMobileVisualizerVisible: true,
                }),
            ).toBe(true);

            // Mobile browsing library (isMobileVisualizerVisible = false) -> suspend GPU loop
            expect(
                shouldSuspendVisualizerForVisibility({
                    isActivityVisible: true,
                    isDocumentVisible: true,
                    isMobileShellActive: true,
                    isMobileVisualizerVisible: false,
                }),
            ).toBe(true);

            // Mobile viewing full-screen Lyrics or Stage in foreground -> active
            expect(
                shouldSuspendVisualizerForVisibility({
                    isActivityVisible: true,
                    isDocumentVisible: true,
                    isMobileShellActive: true,
                    isMobileVisualizerVisible: true,
                }),
            ).toBe(false);
        });
    });
});
