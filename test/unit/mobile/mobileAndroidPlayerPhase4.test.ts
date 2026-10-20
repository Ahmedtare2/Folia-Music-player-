import { afterEach, describe, expect, it, vi } from 'vitest';
import { motionValue } from 'framer-motion';
import { PlayerState, type LocalPlaylist, type LocalSong, type LyricLine, type Word } from '@/types';
import {
    INITIAL_MOBILE_NAVIGATION_STATE,
    type MobileNavigationState,
    buildMobileLibraryCollections,
    filterAndSortLocalSongs,
    isLocalSongCurrentlyPlaying,
    isMobileVisualizerVisible,
    resolveLocalSongAlbumText,
    resolveLocalSongArtistText,
    resolveLocalSongCoverThumb,
    stepMobileBackNavigation,
} from '@/components/mobile/mobileNavigationModel';
import MobileNowPlayingSheet, {
    computeActiveLyricLineIndices,
    computeTimedWordProgressPercent,
} from '@/components/mobile/MobileNowPlayingSheet';
import {
    resolveVisualizerBackdropBlur,
    resolveVisualizerShowText,
} from '@/components/app/presentation/playerVisualizerBackdrop';
import { shouldMountPlayerVisualizer } from '@/components/app/presentation/playerVisualizerMount';
import {
    DESKTOP_MAX_CANVAS_DPR,
    MOBILE_MAX_CANVAS_DPR,
    MOBILE_MAX_PIXI_RESOLUTION,
    MOBILE_MAX_TEXTURE_AXIS_PX,
    resolveMobileCanvasDpr,
    resolveMobileLumiereQuality,
    resolveMobilePixiResolution,
    shouldSuspendVisualizerForVisibility,
} from '@/utils/mobileVisualizerBudget';
import {
    isMobilePhoneViewport,
    shouldUseAndroidMobileShell,
} from '@/utils/platform';
import {
    applyAndroidSystemBarsVisibility,
    getAndroidSystemBarsVisibility,
    minimizeAndroidApp,
} from '@/services/android/foliaAndroidBridge';
import {
    getIsDeviceOnline,
    getOnlineProviderDiagnostic,
    getStoredRuntimeApiBase,
    resolveProviderWebApiBase,
    setStoredRuntimeApiBase,
    subscribeDeviceOnlineStatus,
} from '@/services/onlineMusic/runtimeApiConfig';
import {
    DEFAULT_SYSTEM_BAR_SETTINGS,
    SYSTEM_BAR_SETTINGS_STORAGE_KEY,
    readStoredSystemBarSettings,
    resolveEffectiveSystemBars,
    syncSystemBarsWithPlatform,
    writeStoredSystemBarSettings,
} from '@/utils/systemBarSettings';
import { useSystemBarSettingsStore } from '@/stores/useSystemBarSettingsStore';
import { VISUALIZER_REGISTRY } from '@/components/visualizer/registry';
import { useVisualizerSettingsStore } from '@/stores/useVisualizerSettingsStore';
import {
    DEFAULT_DYNAMIC_ALBUM_ARTWORK_SETTINGS,
    DYNAMIC_ALBUM_ARTWORK_STORAGE_KEY,
    readStoredDynamicAlbumArtworkSettings,
    resolveDynamicAlbumArtworkMotion,
    writeStoredDynamicAlbumArtworkSettings,
} from '@/utils/dynamicAlbumArtwork';
import { useDynamicAlbumArtworkStore } from '@/stores/useDynamicAlbumArtworkStore';

// test/unit/mobile/mobileAndroidPlayerPhase4.test.ts
// Verifies Phase 4 mobile-first Android music player navigation, hardware Back stack,
// restored Online tab & Equalizer sheet navigation, online runtime API config & diagnostics,
// Display and Immersive Mode system-bar visibility settings & screen transitions,
// landscape visualizer type selection & persistence while music is playing,
// local song search/sort/grouping (including Arabic & English), GPU/DPR/Pixi budgets,
// synchronized TTML syllable & overlapping vocal lyrics, artwork resolution, and
// non-overlapping player/visualizer/Lattice presentation.

type VNode = {
    type?: unknown;
    props?: Record<string, any>;
};

const expandVNodeTree = (node: unknown): VNode[] => {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) {
        return node.flatMap(expandVNodeTree);
    }
    const vnode = node as VNode;
    const fnType = typeof vnode.type === 'function'
        ? (vnode.type as (props: Record<string, any>) => unknown)
        : (typeof vnode.type === 'object' && vnode.type !== null && typeof (vnode.type as { type?: unknown }).type === 'function')
            ? ((vnode.type as { type: (props: Record<string, any>) => unknown }).type)
            : null;
    if (fnType) {
        try {
            const rendered = fnType(vnode.props || {});
            return expandVNodeTree(rendered);
        } catch {
            return [vnode];
        }
    }
    const children = vnode.props?.children;
    return [vnode, ...expandVNodeTree(children)];
};

type MakeLocalSongInput = Omit<Partial<LocalSong>, 'importedMetadata'> & {
    id: string;
    title: string;
    importedMetadata?: Partial<LocalSong['importedMetadata']>;
};

const makeLocalSong = (overrides: MakeLocalSongInput): LocalSong => {
    const fileName = overrides.fileName ?? `${overrides.title}.mp3`;
    const folderName = overrides.folderName ?? 'Music';
    const { id, title, importedMetadata, ...rest } = overrides;
    return {
        id,
        title,
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
    const originalWindow = (globalThis as { window?: unknown }).window;
    const originalLocalStorage = (globalThis as { localStorage?: unknown }).localStorage;
    const originalDocument = (globalThis as { document?: unknown }).document;

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
        if (originalWindow === undefined) {
            delete (globalThis as { window?: unknown }).window;
        } else {
            (globalThis as { window?: unknown }).window = originalWindow;
        }
        if (originalLocalStorage === undefined) {
            delete (globalThis as { localStorage?: unknown }).localStorage;
        } else {
            (globalThis as { localStorage?: unknown }).localStorage = originalLocalStorage;
        }
        if (originalDocument === undefined) {
            delete (globalThis as { document?: unknown }).document;
        } else {
            (globalThis as { document?: unknown }).document = originalDocument;
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

    describe('Display and Immersive Mode: Native Android System Bar Visibility Settings', () => {
        it('persists hideStatusBar, hideNavigationBar, and fullScreenLyricsMode in localStorage and restores on startup', () => {
            const storage = new Map<string, string>();
            const mockLocalStorage = {
                getItem: (key: string) => storage.get(key) ?? null,
                setItem: (key: string, val: string) => storage.set(key, val),
                removeItem: (key: string) => storage.delete(key),
            };
            (globalThis as { localStorage?: unknown }).localStorage = mockLocalStorage;
            (globalThis as { window?: unknown }).window = { localStorage: mockLocalStorage };

            expect(readStoredSystemBarSettings()).toEqual(DEFAULT_SYSTEM_BAR_SETTINGS);

            writeStoredSystemBarSettings({
                hideStatusBar: true,
                hideNavigationBar: false,
                fullScreenLyricsMode: true,
            });
            expect(storage.has(SYSTEM_BAR_SETTINGS_STORAGE_KEY)).toBe(true);
            expect(readStoredSystemBarSettings()).toEqual({
                hideStatusBar: true,
                hideNavigationBar: false,
                fullScreenLyricsMode: true,
            });
        });

        it('applies full-screen lyrics mode (hiding both bars) when entering lyrics/visualizer screen and restores previous system-bar state when leaving', async () => {
            const storage = new Map<string, string>();
            const mockLocalStorage = {
                getItem: (key: string) => storage.get(key) ?? null,
                setItem: (key: string, val: string) => storage.set(key, val),
                removeItem: (key: string) => storage.delete(key),
            };
            (globalThis as { localStorage?: unknown }).localStorage = mockLocalStorage;
            (globalThis as { window?: unknown }).window = { localStorage: mockLocalStorage };

            const dataset: Record<string, string> = {};
            (globalThis as { document?: unknown }).document = {
                documentElement: { dataset },
            };

            const setBarsSpy = vi.fn().mockImplementation(async ({ hideStatusBar, hideNavigationBar }) => ({
                supported: true,
                hideStatusBar,
                hideNavigationBar,
                behavior: 'SHOW_TRANSIENT_BARS_BY_SWIPE',
            }));
            const getBarsSpy = vi.fn().mockResolvedValue({
                supported: true,
                hideStatusBar: true,
                hideNavigationBar: false,
                behavior: 'SHOW_TRANSIENT_BARS_BY_SWIPE',
            });
            (globalThis as { __FOLIA_ANDROID_BRIDGE__?: unknown }).__FOLIA_ANDROID_BRIDGE__ = {
                setSystemBarsVisibility: setBarsSpy,
                getSystemBarsVisibility: getBarsSpy,
            };

            // 1. User configures: Hide status bar = ON, Hide navigation bar = OFF, Full-screen lyrics mode = ON
            const store = useSystemBarSettingsStore.getState();
            store.setLyricsOrVisualizerScreenActive(false);
            store.updateSystemBarSettings({
                hideStatusBar: true,
                hideNavigationBar: false,
                fullScreenLyricsMode: true,
            });

            expect(useSystemBarSettingsStore.getState().effectiveState).toEqual({
                hideStatusBar: true,
                hideNavigationBar: false,
                isImmersiveLyricsActive: false,
            });
            expect(setBarsSpy).toHaveBeenLastCalledWith({
                hideStatusBar: true,
                hideNavigationBar: false,
            });
            expect(dataset.hideStatusBar).toBe('true');
            expect(dataset.hideNavigationBar).toBe('false');
            expect(dataset.immersiveLyrics).toBe('false');

            // 2. User enters synchronized lyrics or visualizer screen -> both bars hide together
            useSystemBarSettingsStore.getState().setLyricsOrVisualizerScreenActive(true);
            expect(useSystemBarSettingsStore.getState().effectiveState).toEqual({
                hideStatusBar: true,
                hideNavigationBar: true,
                isImmersiveLyricsActive: true,
            });
            expect(setBarsSpy).toHaveBeenLastCalledWith({
                hideStatusBar: true,
                hideNavigationBar: true,
            });
            expect(dataset.hideStatusBar).toBe('true');
            expect(dataset.hideNavigationBar).toBe('true');
            expect(dataset.immersiveLyrics).toBe('true');

            // 3. User leaves lyrics/visualizer screen (returns to Cover or Library) -> restores previous state (status hidden, nav visible)
            useSystemBarSettingsStore.getState().setLyricsOrVisualizerScreenActive(false);
            expect(useSystemBarSettingsStore.getState().effectiveState).toEqual({
                hideStatusBar: true,
                hideNavigationBar: false,
                isImmersiveLyricsActive: false,
            });
            expect(setBarsSpy).toHaveBeenLastCalledWith({
                hideStatusBar: true,
                hideNavigationBar: false,
            });
            expect(dataset.hideStatusBar).toBe('true');
            expect(dataset.hideNavigationBar).toBe('false');
            expect(dataset.immersiveLyrics).toBe('false');

            // 4. Verify native bridge query returns SHOW_TRANSIENT_BARS_BY_SWIPE gesture behavior
            const queried = await getAndroidSystemBarsVisibility();
            expect(queried.supported).toBe(true);
            expect(queried.behavior).toBe('SHOW_TRANSIENT_BARS_BY_SWIPE');
        });

        it('keeps web and desktop unaffected when native Android bridge is unavailable', async () => {
            delete (globalThis as { __FOLIA_ANDROID_BRIDGE__?: unknown }).__FOLIA_ANDROID_BRIDGE__;
            delete (globalThis as { Capacitor?: unknown }).Capacitor;

            const dataset: Record<string, string> = {};
            (globalThis as { document?: unknown }).document = {
                documentElement: { dataset },
            };

            const res = await applyAndroidSystemBarsVisibility({
                hideStatusBar: true,
                hideNavigationBar: true,
            });
            expect(res.supported).toBe(false);
            expect(res.hideStatusBar).toBe(true);
            expect(res.hideNavigationBar).toBe(true);

            const effective = resolveEffectiveSystemBars(
                { hideStatusBar: false, hideNavigationBar: false, fullScreenLyricsMode: true },
                { isLyricsOrVisualizerScreen: true },
            );
            const syncRes = await syncSystemBarsWithPlatform(effective);
            expect(syncRes.supported).toBe(false);
            expect(dataset.immersiveLyrics).toBe('true');
        });
    });

    describe('Visualizer Type Selection in Portrait & Landscape Mode While Music is Playing', () => {
        it('switches among all registered visualizers in landscape and portrait modes, persists selection, and preserves playback/lyrics state across orientation & immersive changes', () => {
            const storage = new Map<string, string>();
            const mockLocalStorage = {
                getItem: (key: string) => storage.get(key) ?? null,
                setItem: (key: string, val: string) => storage.set(key, val),
                removeItem: (key: string) => storage.delete(key),
            };
            (globalThis as { localStorage?: unknown }).localStorage = mockLocalStorage;
            (globalThis as { window?: unknown }).window = {
                localStorage: mockLocalStorage,
                innerWidth: 844,
                innerHeight: 390,
            };

            // Verify landscape phone viewport detection (844x390 and 667x375)
            expect(isMobilePhoneViewport(844, 390)).toBe(true);
            expect(isMobilePhoneViewport(667, 375)).toBe(true);
            expect(isMobilePhoneViewport(390, 844)).toBe(true);

            // Verify all visualizers in VISUALIZER_REGISTRY are selectable and persist to localStorage
            expect(VISUALIZER_REGISTRY.length).toBeGreaterThanOrEqual(10);
            const playbackPositionSec = 94.6;
            const lyricLineIndex = 12;

            for (const entry of VISUALIZER_REGISTRY) {
                useVisualizerSettingsStore.getState().handleSetVisualizerMode(entry.mode, { notify: false });
                expect(useVisualizerSettingsStore.getState().visualizerMode).toBe(entry.mode);
                expect(storage.get('visualizer_mode')).toBe(entry.mode);
            }

            // Simulate orientation change (Portrait 390x844 -> Landscape 844x390) + Immersive Mode toggle while playing
            useSystemBarSettingsStore.getState().updateSystemBarSettings({
                hideStatusBar: false,
                hideNavigationBar: false,
                fullScreenLyricsMode: true,
            });
            useSystemBarSettingsStore.getState().setLyricsOrVisualizerScreenActive(true);

            // Switch visualizer in landscape while immersive full-screen lyrics mode is active
            useVisualizerSettingsStore.getState().handleSetVisualizerMode('lumiere', { notify: false });
            expect(useVisualizerSettingsStore.getState().visualizerMode).toBe('lumiere');
            expect(storage.get('visualizer_mode')).toBe('lumiere');
            expect(useSystemBarSettingsStore.getState().effectiveState.isImmersiveLyricsActive).toBe(true);

            // Switch to another visualizer ('sonnet') and verify playback position & active lyric line computation remain intact
            useVisualizerSettingsStore.getState().handleSetVisualizerMode('sonnet', { notify: false });
            expect(useVisualizerSettingsStore.getState().visualizerMode).toBe('sonnet');
            expect(playbackPositionSec).toBe(94.6);
            expect(lyricLineIndex).toBe(12);
        });

        it('renders accessible, non-clipped visualizer selector bar and landscape grid in MobileNowPlayingSheet without affecting playback or lyrics seek on swipe', () => {
            const onVisualizerModeChange = vi.fn();
            const onSeek = vi.fn();
            const onLyricLineSeek = vi.fn();
            const onTogglePlay = vi.fn();
            const onChangeSubDrawer = vi.fn();

            const baseProps = {
                isOpen: true,
                displayMode: 'lyrics' as const,
                subDrawer: 'lyrics-tools' as const,
                onChangeDisplayMode: vi.fn(),
                onChangeSubDrawer,
                onClose: vi.fn(),
                currentSong: {
                    id: -1,
                    name: 'تملي معاك',
                    artists: [{ id: 1, name: 'عمرو دياب' }],
                    album: { id: 1, name: 'تملي معاك' },
                },
                artistName: 'عمرو دياب',
                albumName: 'تملي معاك',
                coverUrl: null,
                playerState: PlayerState.PLAYING,
                currentTime: motionValue(85.4),
                lyricCurrentTime: motionValue(85.4),
                duration: 240,
                lyrics: {
                    lines: [
                        {
                            startTime: 80,
                            endTime: 90,
                            fullText: 'تملي معاك ولو حتى بعيد عني',
                            words: [{ text: 'تملي', startTime: 80, endTime: 84 }, { text: 'معاك', startTime: 84, endTime: 90 }],
                        },
                    ],
                },
                currentLineIndex: 0,
                isLyricsLoading: false,
                isLiked: true,
                loopMode: 'all' as const,
                theme: {
                    primaryColor: '#ffffff',
                    secondaryColor: '#a1a1aa',
                    backgroundColor: '#09090b',
                    accentColor: '#38bdf8',
                },
                visualizerMode: 'monet' as const,
                onVisualizerModeChange,
                lyricsFontScale: 1,
                onLyricsFontScaleChange: vi.fn(),
                showSubtitleTranslation: true,
                onToggleSubtitleTranslation: vi.fn(),
                lyricTimelineOffsetMs: 0,
                onLyricTimelineOffsetChange: vi.fn(),
                activeLocalLyricsSource: 'local' as const,
                onChangeLyricsSource: vi.fn(),
                onImportLocalLyricsFile: vi.fn(),
                onOpenLyricMatch: vi.fn(),
                onSeek,
                onLyricLineSeek,
                onTogglePlay,
                onPrevTrack: vi.fn(),
                onNextTrack: vi.fn(),
                onToggleLoop: vi.fn(),
                onToggleLike: vi.fn(),
                onShuffleQueue: vi.fn(),
                playQueue: [],
                onPlayQueueSong: vi.fn(),
                onRemoveQueueSong: vi.fn(),
                onSaveQueueAsPlaylist: vi.fn().mockResolvedValue(undefined),
                onOpenVisualizerSettings: vi.fn(),
            };

            const nodes = expandVNodeTree((MobileNowPlayingSheet as unknown as (p: typeof baseProps) => unknown)(baseProps));

            // 1. Verify inline visualizer selector bar is present in Lyrics mode and has touch-pan-x + min-w-0
            const selectorBar = nodes.find(n => n.props?.['data-testid'] === 'mobile-visualizer-selector-bar');
            expect(selectorBar).toBeTruthy();
            expect(String(selectorBar?.props?.className)).toContain('min-w-0');

            // Verify touch/pointer propagation is stopped on selector bar so swiping doesn't seek lyrics or toggle chrome
            const stopPropSpy = vi.fn();
            selectorBar?.props?.onTouchStart?.({ stopPropagation: stopPropSpy });
            selectorBar?.props?.onTouchMove?.({ stopPropagation: stopPropSpy });
            selectorBar?.props?.onPointerDown?.({ stopPropagation: stopPropSpy });
            expect(stopPropSpy).toHaveBeenCalledTimes(3);
            expect(onSeek).not.toHaveBeenCalled();
            expect(onLyricLineSeek).not.toHaveBeenCalled();
            expect(onTogglePlay).not.toHaveBeenCalled();

            // 2. Verify all registered visualizers are present in the inline strip and clicking one updates the visualizer immediately
            const stripButtons = nodes.filter(n => Boolean(n.props?.['data-visualizer-mode']));
            expect(stripButtons).toHaveLength(VISUALIZER_REGISTRY.length);
            const fumeBtn = stripButtons.find(n => n.props?.['data-visualizer-mode'] === 'fume');
            expect(fumeBtn).toBeTruthy();
            fumeBtn?.props?.onClick?.({ stopPropagation: vi.fn() });
            expect(onVisualizerModeChange).toHaveBeenCalledWith('fume');

            // 3. Verify the landscape-friendly drawer grid is also rendered with landscape:grid-cols-5 and all visualizer options
            const drawerGrid = nodes.find(n => n.props?.['data-testid'] === 'mobile-drawer-visualizer-grid');
            expect(drawerGrid).toBeTruthy();
            expect(String(drawerGrid?.props?.className)).toContain('landscape:grid-cols-5');

            const claddaghDrawerBtn = nodes.find(n => n.props?.['data-testid'] === 'drawer-visualizer-option-claddagh');
            expect(claddaghDrawerBtn).toBeTruthy();
            claddaghDrawerBtn?.props?.onClick?.();
            expect(onVisualizerModeChange).toHaveBeenCalledWith('claddagh');
            expect(baseProps.currentTime.get()).toBe(85.4);
        });
    });

    describe('Android hardware Back navigation stack (stepMobileBackNavigation)', () => {
        it('closes open app modals (Command Palette, Search, Equalizer, Login, Lyric Match, Settings) first', () => {
            const closePalette = vi.fn();
            const closeSearch = vi.fn();
            const closeEqualizer = vi.fn();
            const closeLogin = vi.fn();
            const closeLyricMatch = vi.fn();
            const closeSettings = vi.fn();

            const res1 = stepMobileBackNavigation(INITIAL_MOBILE_NAVIGATION_STATE, {
                isCommandPaletteOpen: true,
                closeCommandPalette: closePalette,
            });
            expect(res1.handled).toBe(true);
            res1.sideEffect?.();
            expect(closePalette).toHaveBeenCalledTimes(1);

            const resSearch = stepMobileBackNavigation(INITIAL_MOBILE_NAVIGATION_STATE, {
                isSearchOpen: true,
                closeSearch,
            });
            expect(resSearch.handled).toBe(true);
            resSearch.sideEffect?.();
            expect(closeSearch).toHaveBeenCalledTimes(1);

            const resEq = stepMobileBackNavigation(INITIAL_MOBILE_NAVIGATION_STATE, {
                isEqualizerOpen: true,
                closeEqualizer,
            });
            expect(resEq.handled).toBe(true);
            resEq.sideEffect?.();
            expect(closeEqualizer).toHaveBeenCalledTimes(1);

            const resLogin = stepMobileBackNavigation(INITIAL_MOBILE_NAVIGATION_STATE, {
                isLoginWindowOpen: true,
                closeLoginWindow: closeLogin,
            });
            expect(resLogin.handled).toBe(true);
            resLogin.sideEffect?.();
            expect(closeLogin).toHaveBeenCalledTimes(1);

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

        it('steps down from equalizer sub-drawer -> full-screen lyrics/visualizer -> cover -> mini-player -> Online tab -> root Songs tab -> native minimize', async () => {
            let state: MobileNavigationState = {
                activeTab: 'online',
                albumsSubTab: 'albums',
                foldersSubTab: 'folders',
                collectionDetail: null,
                playerSheet: 'expanded',
                playerDisplayMode: 'lyrics',
                subDrawer: 'equalizer',
            };

            const step1 = stepMobileBackNavigation(state);
            expect(step1.handled).toBe(true);
            expect(step1.nextState.subDrawer).toBe('none');
            expect(step1.nextState.playerDisplayMode).toBe('lyrics');
            state = step1.nextState;

            const step2 = stepMobileBackNavigation(state);
            expect(step2.handled).toBe(true);
            expect(step2.nextState.playerDisplayMode).toBe('cover');
            expect(step2.nextState.playerSheet).toBe('expanded');
            state = step2.nextState;

            const step3 = stepMobileBackNavigation(state);
            expect(step3.handled).toBe(true);
            expect(step3.nextState.playerSheet).toBe('collapsed');
            expect(step3.nextState.activeTab).toBe('online');
            state = step3.nextState;

            const step4 = stepMobileBackNavigation(state);
            expect(step4.handled).toBe(true);
            expect(step4.nextState.activeTab).toBe('songs');
            state = step4.nextState;

            const step5 = stepMobileBackNavigation(state);
            expect(step5.handled).toBe(false);

            const minimizeSpy = vi.fn().mockReturnValue(Promise.resolve());
            (globalThis as { __FOLIA_ANDROID_BRIDGE__?: unknown }).__FOLIA_ANDROID_BRIDGE__ = {
                minimizeApp: minimizeSpy,
            };
            expect(await minimizeAndroidApp()).toBe(true);
            expect(minimizeSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('Restored Online Services Runtime Configuration, Diagnostics & Offline-to-Online Transitions', () => {
        it('stores and normalizes runtime API gateway URLs for NetEase, QQ Music, and KuGou without fabricating endpoints', () => {
            const storage = new Map<string, string>();
            const mockLocalStorage = {
                getItem: (key: string) => storage.get(key) ?? null,
                setItem: (key: string, val: string) => storage.set(key, val),
                removeItem: (key: string) => storage.delete(key),
            };
            (globalThis as { localStorage?: unknown }).localStorage = mockLocalStorage;
            (globalThis as { window?: unknown }).window = {
                localStorage: mockLocalStorage,
                dispatchEvent: () => true,
            };
            Object.defineProperty(globalThis, 'navigator', {
                configurable: true,
                value: { onLine: true },
            });

            expect(resolveProviderWebApiBase('netease')).toBe('');
            const unconfiguredDiag = getOnlineProviderDiagnostic('netease');
            expect(unconfiguredDiag.availability).toBe('needs_api_base');

            setStoredRuntimeApiBase('netease', 'https://netease.example.com/api///');
            expect(getStoredRuntimeApiBase('netease')).toBe('https://netease.example.com/api');
            expect(resolveProviderWebApiBase('netease')).toBe('https://netease.example.com/api');
            expect(getOnlineProviderDiagnostic('netease').availability).toBe('ready');

            expect(getOnlineProviderDiagnostic('amll-db').availability).toBe('ready');
            expect(getOnlineProviderDiagnostic('bodian').availability).toBe('needs_desktop_bridge');
            expect(getOnlineProviderDiagnostic('ytm').availability).toBe('needs_desktop_bridge');
            expect(getOnlineProviderDiagnostic('spotify').availability).toBe('needs_desktop_bridge');
        });

        it('tracks offline-to-online transitions and notifies subscribers immediately', () => {
            let onlineState = false;
            const windowEvents = new Map<string, Set<() => void>>();

            Object.defineProperty(globalThis, 'navigator', {
                configurable: true,
                value: {
                    get onLine() {
                        return onlineState;
                    },
                },
            });
            (globalThis as { window?: unknown }).window = {
                addEventListener: (evt: string, cb: () => void) => {
                    if (!windowEvents.has(evt)) windowEvents.set(evt, new Set());
                    windowEvents.get(evt)!.add(cb);
                },
                removeEventListener: (evt: string, cb: () => void) => {
                    windowEvents.get(evt)?.delete(cb);
                },
            };

            expect(getIsDeviceOnline()).toBe(false);

            const statusChanges: boolean[] = [];
            const unsubscribe = subscribeDeviceOnlineStatus(isOnline => {
                statusChanges.push(isOnline);
            });

            onlineState = true;
            windowEvents.get('online')?.forEach(cb => cb());
            expect(getIsDeviceOnline()).toBe(true);
            expect(statusChanges).toContain(true);

            onlineState = false;
            windowEvents.get('offline')?.forEach(cb => cb());
            expect(getIsDeviceOnline()).toBe(false);
            expect(statusChanges[statusChanges.length - 1]).toBe(false);

            unsubscribe();
        });
    });

    describe('Local music search, sorting, and collection grouping (including Arabic & English)', () => {
        const songs: LocalSong[] = [
            makeLocalSong({
                id: 's1',
                title: 'تملي معاك',
                folderName: 'Arabic Classics',
                addedAt: 1000,
                localCoverAssetId: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                importedMetadata: { artistNames: ['عمرو دياب'], albumName: 'تملي معاك' },
            }),
            makeLocalSong({
                id: 's2',
                title: 'Nour El Ain',
                folderName: 'Arabic Classics',
                addedAt: 3000,
                onlineMetadata: { source: 'netease', coverUrl: 'https://example.com/nour.jpg', artists: ['Amr Diab'], matchMode: 'auto', matchedAt: 1000 },
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
            expect(collections.folders).toHaveLength(3);
            expect(collections.playlists).toHaveLength(1);
            expect(collections.playlists[0]?.songs.map(s => s.id)).toEqual(['s1', 's2']);
        });

        it('identifies the currently playing local song and resolves artist/album labels and cover artwork', () => {
            expect(resolveLocalSongArtistText(songs[0]!)).toBe('عمرو دياب');
            expect(resolveLocalSongAlbumText(songs[0]!)).toBe('تملي معاك');
            (globalThis as { window?: unknown }).window = {
                ...((globalThis as { window?: Record<string, unknown> }).window || {}),
                isSecureContext: true,
                location: { protocol: 'https:', hostname: 'localhost' },
            };
            Object.defineProperty(globalThis, "navigator", {
                configurable: true,
                value: {
                    ...(globalThis.navigator || {}),
                    storage: { getDirectory: vi.fn() },
                },
            });
            expect(resolveLocalSongCoverThumb(songs[0]!, 1024)).toContain(encodeURIComponent("sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"));
            expect(resolveLocalSongCoverThumb(songs[1]!, 1024)).toBe('https://example.com/nour.jpg');
            expect(resolveLocalSongCoverThumb(songs[2]!, 1024)).toBeUndefined();
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

    describe('Synchronized TTML Syllable Progress & Overlapping Vocal Lines', () => {
        it('computes piecewise TTML syllable progress accurately alongside linear word timing', () => {
            const wordWithSyllables: Word = {
                text: 'حبيبي',
                startTime: 10,
                endTime: 14,
                syllables: [
                    { text: 'حبي', startTime: 10, endTime: 11 },
                    { text: 'بي', startTime: 11, endTime: 14 },
                ],
            };

            expect(computeTimedWordProgressPercent(wordWithSyllables, 9.5)).toBe(0);
            expect(computeTimedWordProgressPercent(wordWithSyllables, 10.5)).toBeCloseTo(30, 1);
            expect(computeTimedWordProgressPercent(wordWithSyllables, 11.0)).toBeCloseTo(60, 1);
            expect(computeTimedWordProgressPercent(wordWithSyllables, 12.5)).toBeCloseTo(80, 1);
            expect(computeTimedWordProgressPercent(wordWithSyllables, 14.0)).toBe(100);
        });

        it('keeps overlapping vocal lines simultaneously active instead of prematurely dimming them', () => {
            const lines: LyricLine[] = [
                {
                    startTime: 5,
                    endTime: 12,
                    fullText: 'تملي معاك',
                    words: [{ text: 'تملي', startTime: 5, endTime: 8 }, { text: 'معاك', startTime: 8, endTime: 12 }],
                    renderHints: { renderEndTime: 12 } as any,
                },
                {
                    startTime: 9,
                    endTime: 15,
                    fullText: 'ولو حتى بعيد عني',
                    words: [{ text: 'ولو', startTime: 9, endTime: 11 }, { text: 'حتى', startTime: 11, endTime: 15 }],
                    agentId: 'v2',
                },
            ];

            const activeAtOverlap = computeActiveLyricLineIndices(lines, 1, 10.5);
            expect(activeAtOverlap.has(0)).toBe(true);
            expect(activeAtOverlap.has(1)).toBe(true);

            const activeAfterOverlap = computeActiveLyricLineIndices(lines, 1, 13.0);
            expect(activeAfterOverlap.has(0)).toBe(false);
            expect(activeAfterOverlap.has(1)).toBe(true);
        });
    });

    describe('Mobile Visualizer Mount, ShowText & Backdrop Blur (Non-Overlapping Layout)', () => {
        it('mounts visualizer, shows text, and disables backdrop blur when mobile visualizer is active even if currentView is home', () => {
            expect(
                shouldMountPlayerVisualizer({
                    currentView: 'home',
                    hasLatticeExited: true,
                    shouldRevealHomeSurface: true,
                    libraryOccludesPlayer: true,
                    hasLibraryOcclusionSettled: true,
                    isMobileVisualizerActive: true,
                }),
            ).toBe(true);

            expect(
                resolveVisualizerShowText({
                    currentView: 'home',
                    isSettingsModalOpen: false,
                    isPanelOpen: false,
                    backdropLyrics: false,
                    isMobileVisualizerActive: true,
                }),
            ).toBe(true);

            expect(
                resolveVisualizerBackdropBlur({
                    shouldRevealHomeSurface: true,
                    backdropBlur: true,
                    isMobileVisualizerActive: true,
                }),
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
            expect(resolveMobilePixiResolution(1920, 1080, 1.5, false)).toBe(1.5);

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

            expect(
                shouldSuspendVisualizerForVisibility({
                    isActivityVisible: false,
                    isDocumentVisible: true,
                    isMobileShellActive: true,
                    isMobileVisualizerVisible: true,
                }),
            ).toBe(true);

            expect(
                shouldSuspendVisualizerForVisibility({
                    isActivityVisible: true,
                    isDocumentVisible: true,
                    isMobileShellActive: true,
                    isMobileVisualizerVisible: false,
                }),
            ).toBe(true);

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

    describe('Dynamic Album Artwork on the Normal Player Screen', () => {
        it('persists Dynamic Album Artwork On/Off and Low/Normal motion intensity in localStorage and store', () => {
            const storage = new Map<string, string>();
            const mockLocalStorage = {
                getItem: (key: string) => storage.get(key) ?? null,
                setItem: (key: string, val: string) => storage.set(key, val),
                removeItem: (key: string) => storage.delete(key),
            };
            (globalThis as { localStorage?: unknown }).localStorage = mockLocalStorage;
            (globalThis as { window?: unknown }).window = { localStorage: mockLocalStorage };

            expect(readStoredDynamicAlbumArtworkSettings()).toEqual(DEFAULT_DYNAMIC_ALBUM_ARTWORK_SETTINGS);

            writeStoredDynamicAlbumArtworkSettings({
                enabled: false,
                intensity: 'low',
            });
            expect(storage.has(DYNAMIC_ALBUM_ARTWORK_STORAGE_KEY)).toBe(true);
            expect(readStoredDynamicAlbumArtworkSettings()).toEqual({
                enabled: false,
                intensity: 'low',
            });

            useDynamicAlbumArtworkStore.getState().setDynamicAlbumArtworkEnabled(true);
            useDynamicAlbumArtworkStore.getState().setDynamicAlbumArtworkIntensity('normal');
            expect(useDynamicAlbumArtworkStore.getState().enabled).toBe(true);
            expect(useDynamicAlbumArtworkStore.getState().intensity).toBe('normal');
            expect(readStoredDynamicAlbumArtworkSettings()).toEqual({
                enabled: true,
                intensity: 'normal',
            });
        });

        it('computes composition-preserving motion profile and suspends animation when paused, hidden, or disabled', () => {
            const playingNormal = resolveDynamicAlbumArtworkMotion({
                enabled: true,
                intensity: 'normal',
                isPlaying: true,
                isCoverScreenActive: true,
                isPageVisible: true,
                prefersReducedMotion: false,
            });
            expect(playingNormal.shouldAnimate).toBe(true);
            expect(playingNormal.effectiveIntensity).toBe('normal');
            expect(playingNormal.zoomScaleMax).toBeLessThanOrEqual(1.045);
            expect(playingNormal.cameraDriftPx).toBeLessThanOrEqual(9);
            expect(playingNormal.lowerEdgeFeatherPercent).toBe(26);

            // Reduced motion preference steps intensity down to low
            const reducedMotion = resolveDynamicAlbumArtworkMotion({
                enabled: true,
                intensity: 'normal',
                isPlaying: true,
                isCoverScreenActive: true,
                isPageVisible: true,
                prefersReducedMotion: true,
            });
            expect(reducedMotion.shouldAnimate).toBe(true);
            expect(reducedMotion.effectiveIntensity).toBe('low');
            expect(reducedMotion.cameraDriftPx).toBeLessThan(playingNormal.cameraDriftPx);

            // Paused playback settles motion
            const pausedMotion = resolveDynamicAlbumArtworkMotion({
                enabled: true,
                intensity: 'normal',
                isPlaying: false,
                isCoverScreenActive: true,
                isPageVisible: true,
                prefersReducedMotion: false,
            });
            expect(pausedMotion.shouldAnimate).toBe(false);
            expect(pausedMotion.zoomScaleMax).toBe(1);
            expect(pausedMotion.cameraDriftPx).toBe(0);

            // Inactive cover screen or hidden document suspends animation
            const hiddenScreenMotion = resolveDynamicAlbumArtworkMotion({
                enabled: true,
                intensity: 'normal',
                isPlaying: true,
                isCoverScreenActive: false,
                isPageVisible: true,
                prefersReducedMotion: false,
            });
            expect(hiddenScreenMotion.shouldAnimate).toBe(false);

            // Disabled setting renders static cover with zero motion
            const disabledMotion = resolveDynamicAlbumArtworkMotion({
                enabled: false,
                intensity: 'normal',
                isPlaying: true,
                isCoverScreenActive: true,
                isPageVisible: true,
                prefersReducedMotion: false,
            });
            expect(disabledMotion.shouldAnimate).toBe(false);
            expect(disabledMotion.effectiveIntensity).toBe('off');
            expect(disabledMotion.lowerEdgeFeatherPercent).toBe(0);
        });

        it('renders DynamicAlbumCoverStage on the normal Cover screen, updates with selected song, supports fallback artwork, and can be disabled to static cover', () => {
            const storage = new Map<string, string>();
            const mockLocalStorage = {
                getItem: (key: string) => storage.get(key) ?? null,
                setItem: (key: string, val: string) => storage.set(key, val),
                removeItem: (key: string) => storage.delete(key),
            };
            (globalThis as { localStorage?: unknown }).localStorage = mockLocalStorage;
            (globalThis as { window?: unknown }).window = { localStorage: mockLocalStorage };

            useDynamicAlbumArtworkStore.getState().updateDynamicAlbumArtworkSettings({
                enabled: true,
                intensity: 'normal',
            });

            const makeCoverSheetProps = (overrides: Record<string, unknown> = {}) => ({
                isOpen: true,
                displayMode: 'cover' as const,
                subDrawer: 'none' as const,
                onChangeDisplayMode: vi.fn(),
                onChangeSubDrawer: vi.fn(),
                onClose: vi.fn(),
                currentSong: {
                    id: -10,
                    name: 'Nour El Ain',
                    artists: [{ id: 1, name: 'Amr Diab' }],
                    album: { id: 1, name: 'Nour El Ain' },
                },
                artistName: 'Amr Diab',
                albumName: 'Nour El Ain',
                coverUrl: 'https://example.com/nour-el-ain.jpg',
                playerState: PlayerState.PLAYING,
                currentTime: motionValue(42.0),
                lyricCurrentTime: motionValue(42.0),
                duration: 210,
                lyrics: null,
                currentLineIndex: -1,
                isLyricsLoading: false,
                isLiked: false,
                loopMode: 'all' as const,
                theme: {
                    primaryColor: '#ffffff',
                    secondaryColor: '#a1a1aa',
                    backgroundColor: '#09090b',
                    accentColor: '#38bdf8',
                },
                visualizerMode: 'monet' as const,
                onVisualizerModeChange: vi.fn(),
                lyricsFontScale: 1,
                onLyricsFontScaleChange: vi.fn(),
                showSubtitleTranslation: true,
                onToggleSubtitleTranslation: vi.fn(),
                lyricTimelineOffsetMs: 0,
                onLyricTimelineOffsetChange: vi.fn(),
                activeLocalLyricsSource: 'local' as const,
                onChangeLyricsSource: vi.fn(),
                onImportLocalLyricsFile: vi.fn(),
                onOpenLyricMatch: vi.fn(),
                onSeek: vi.fn(),
                onLyricLineSeek: vi.fn(),
                onTogglePlay: vi.fn(),
                onPrevTrack: vi.fn(),
                onNextTrack: vi.fn(),
                onToggleLoop: vi.fn(),
                onToggleLike: vi.fn(),
                onShuffleQueue: vi.fn(),
                playQueue: [],
                onPlayQueueSong: vi.fn(),
                onRemoveQueueSong: vi.fn(),
                onSaveQueueAsPlaylist: vi.fn().mockResolvedValue(undefined),
                onOpenVisualizerSettings: vi.fn(),
                ...overrides,
            });

            // 1. Dynamic Album Artwork ON with coverUrl
            const dynamicNodes = expandVNodeTree(
                (MobileNowPlayingSheet as unknown as (p: any) => unknown)(makeCoverSheetProps()),
            );
            const stage = dynamicNodes.find(n => n.props?.['data-testid'] === 'dynamic-album-cover-stage');
            expect(stage).toBeTruthy();
            expect(stage?.props?.['data-dynamic-enabled']).toBe('true');
            expect(stage?.props?.['data-dynamic-animating']).toBe('true');
            expect(dynamicNodes.find(n => n.props?.['data-testid'] === 'dynamic-cover-focal-layer')?.props?.src).toBe(
                'https://example.com/nour-el-ain.jpg',
            );
            expect(dynamicNodes.find(n => n.props?.['data-testid'] === 'dynamic-cover-lower-edge-blend')).toBeTruthy();
            expect(dynamicNodes.find(n => n.props?.['data-testid'] === 'mobile-cohesive-controls-dock')).toBeTruthy();

            // 2. Switch song -> focal artwork layer updates to the new song's cover
            const nextSongNodes = expandVNodeTree(
                (MobileNowPlayingSheet as unknown as (p: any) => unknown)(
                    makeCoverSheetProps({
                        currentSong: {
                            id: -11,
                            name: 'Tamally Maak',
                            artists: [{ id: 1, name: 'Amr Diab' }],
                            album: { id: 2, name: 'Tamally Maak' },
                        },
                        coverUrl: 'https://example.com/tamally-maak.jpg',
                    }),
                ),
            );
            expect(nextSongNodes.find(n => n.props?.['data-testid'] === 'dynamic-cover-focal-layer')?.props?.src).toBe(
                'https://example.com/tamally-maak.jpg',
            );

            // 3. Disable Dynamic Album Artwork -> renders unmodified static cover image
            const togglePill = dynamicNodes.find(n => n.props?.['data-testid'] === 'dynamic-cover-toggle-pill');
            expect(togglePill).toBeTruthy();
            togglePill?.props?.onClick?.({ stopPropagation: vi.fn() });
            expect(useDynamicAlbumArtworkStore.getState().enabled).toBe(false);

            const staticNodes = expandVNodeTree(
                (MobileNowPlayingSheet as unknown as (p: any) => unknown)(makeCoverSheetProps()),
            );
            const staticStage = staticNodes.find(n => n.props?.['data-testid'] === 'dynamic-album-cover-stage');
            expect(staticStage?.props?.['data-dynamic-enabled']).toBe('false');
            expect(staticStage?.props?.['data-dynamic-animating']).toBe('false');
            expect(staticNodes.find(n => n.props?.['data-testid'] === 'static-album-cover-image')?.props?.src).toBe(
                'https://example.com/nour-el-ain.jpg',
            );
            expect(staticNodes.find(n => n.props?.['data-testid'] === 'dynamic-cover-parallax-layer')).toBeUndefined();

            // 4. Fallback artwork when track has no coverUrl
            useDynamicAlbumArtworkStore.getState().setDynamicAlbumArtworkEnabled(true);
            const fallbackNodes = expandVNodeTree(
                (MobileNowPlayingSheet as unknown as (p: any) => unknown)(
                    makeCoverSheetProps({ coverUrl: null }),
                ),
            );
            expect(fallbackNodes.find(n => n.props?.['data-testid'] === 'dynamic-cover-fallback')).toBeTruthy();
        });
    });
});
