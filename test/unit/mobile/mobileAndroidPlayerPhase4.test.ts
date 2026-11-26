import { afterEach, describe, expect, it, vi } from 'vitest';
import { motionValue } from 'framer-motion';
import { PlayerState, type LocalSong, type LyricLine, type Word } from '@/types';
import {
    INITIAL_MOBILE_NAVIGATION_STATE,
    type MobileNavigationState,
    buildMobileLibraryCollections,
    computeRestoredLibraryScrollState,
    filterAndSortLocalSongs,
    isLocalSongCurrentlyPlaying,
    isMobileVisualizerVisible,
    resolveLocalSongAlbumText,
    resolveLocalSongArtistText,
    resolveLocalSongCoverThumb,
    stepMobileBackNavigation,
} from '@/components/mobile/mobileNavigationModel';
import {
    MobileNowPlayingSheet,
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
    AMBIENT_BACKGROUND_DPR_SCALE,
    AMBIENT_BACKGROUND_MAX_DIMENSION_PX,
    AMBIENT_BACKGROUND_MAX_PIXELS,
    resolveAmbientBackgroundCanvasSize,
    resolveMobileCanvasDpr,
    resolveMobileLumiereQuality,
    resolveMobilePixiResolution,
    shouldSuspendVisualizerForVisibility,
} from '@/utils/mobileVisualizerBudget';
import { MONET_BACKGROUND_HEIGHT, MONET_BACKGROUND_WIDTH } from '@/components/visualizer/monet/monetBackgroundPaint';
import {
    isAppForegroundVisible,
    setNativeActivityVisibleForTests,
    subscribeAppForegroundVisibility,
} from '@/utils/visualizerVisibilityGate';
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
    ALBUM_VIDEO_COVERS_STORAGE_KEY,
    DEFAULT_DYNAMIC_ALBUM_ARTWORK_SETTINGS,
    DYNAMIC_ALBUM_ARTWORK_STORAGE_KEY,
    readStoredAlbumVideoCoversEnabled,
    readStoredDynamicAlbumArtworkSettings,
    resolveAlbumVideoStageState,
    resolveDynamicAlbumArtworkMotion,
    writeStoredAlbumVideoCoversEnabled,
    writeStoredDynamicAlbumArtworkSettings,
} from '@/utils/dynamicAlbumArtwork';
import {
    assignVideoToAlbum,
    getRegisteredAlbumVideos,
    reconcileVideosForRootFolder,
    resetAlbumVideoAssociation,
    resetLocalAlbumVideoCatalogForTests,
    resolveAlbumVideoForTrack,
    scoreAlbumVideoCandidates,
} from '@/services/localAlbumVideoService';
import { useDynamicAlbumArtworkStore } from '@/stores/useDynamicAlbumArtworkStore';

vi.mock('react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react')>();
    const actualRecord = actual as unknown as Record<string, unknown>;
    const actualDefault = (actualRecord.default as Record<string, unknown> | undefined) ?? actualRecord;
    const hookShims = {
        useState: <T,>(init?: T | (() => T)) => [
            typeof init === 'function' ? (init as () => T)() : init,
            vi.fn(),
        ] as const,
        useReducer: <S,>(reducer: unknown, init: S, initializer?: (arg: S) => S) => [
            typeof initializer === 'function' ? initializer(init) : init,
            vi.fn(),
        ] as const,
        useRef: <T,>(init?: T) => ({ current: init as T }),
        useEffect: () => {},
        useLayoutEffect: () => {},
        useInsertionEffect: () => {},
        useMemo: <T,>(fn: () => T) => fn(),
        useCallback: <T extends (...args: any[]) => any>(fn: T) => fn,
        useContext: (ctx: any) => ctx?._currentValue ?? {},
        useSyncExternalStore: <T,>(_subscribe: unknown, getSnapshot: () => T) => getSnapshot(),
        useDebugValue: () => {},
        useId: () => 'folia-mock-id',
        useImperativeHandle: () => {},
        useTransition: () => [false, (cb: () => void) => cb()] as const,
        useDeferredValue: <T,>(val: T) => val,
        memo: <T,>(comp: T) => comp,
        forwardRef: <T,>(render: T) => render,
    };
    const clientInternals = (actualRecord.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
        ?? actualDefault.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE) as Record<string, unknown> | undefined;
    if (clientInternals) {
        clientInternals.H = hookShims;
    }
    const secretInternals = (actualRecord.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED
        ?? actualDefault.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED) as { ReactCurrentDispatcher?: { current: unknown } } | undefined;
    if (secretInternals?.ReactCurrentDispatcher) {
        secretInternals.ReactCurrentDispatcher.current = hookShims;
    }
    return {
        ...actualRecord,
        ...hookShims,
        default: {
            ...actualDefault,
            ...hookShims,
        },
    };
});

vi.mock('zustand/react/shallow', () => ({
    useShallow: <T,>(selector: T) => selector,
}));

vi.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: () => {} },
    useTranslation: () => ({
        t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
        i18n: { language: 'en', changeLanguage: () => Promise.resolve() },
    }),
}));

vi.mock('framer-motion', () => ({
    motionValue: <T,>(initial: T) => {
        let current = initial;
        return {
            get: () => current,
            set: (next: T) => { current = next; },
            on: () => () => {},
            onChange: () => () => {},
        };
    },
    useMotionValueEvent: () => {},
}));

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
                onlineMetadata: { source: 'netease', coverUrl: 'https://example.com/nour.jpg', artists: [{ name: 'Amr Diab' }], matchMode: 'auto', matchedAt: 1000 },
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

        const playlists = [
            {
                id: 'fav',
                name: 'Favorites',
                entryCount: 2,
                coverLocalSongIds: ['s1', 's2'],
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
                ...((globalThis as unknown as { window?: Record<string, unknown> }).window || {}),
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

    describe('Seeking while playing/paused, lyric synchronization on seek, and library scroll restoration', () => {
        it('commits pointer, touch, and tap seeks cleanly without stopping playback and immediately recalculates active lyrics', () => {
            const seekTargets: number[] = [];
            const currentTime = motionValue(30.0);
            const lyricCurrentTime = motionValue(30.0);
            const lines: LyricLine[] = [
                {
                    startTime: 0,
                    endTime: 20,
                    fullText: 'Intro line',
                    words: [{ text: 'Intro', startTime: 0, endTime: 10 }, { text: 'line', startTime: 10, endTime: 20 }],
                },
                {
                    startTime: 20,
                    endTime: 60,
                    fullText: 'Verse one',
                    words: [{ text: 'Verse', startTime: 20, endTime: 40 }, { text: 'one', startTime: 40, endTime: 60 }],
                },
                {
                    startTime: 110,
                    endTime: 150,
                    fullText: 'Chorus line',
                    words: [{ text: 'Chorus', startTime: 110, endTime: 130 }, { text: 'line', startTime: 130, endTime: 150 }],
                },
            ];

            const onSeek = vi.fn((targetSec: number) => {
                const clamped = Math.max(0, Math.min(targetSec, 240 - 0.05));
                seekTargets.push(clamped);
                currentTime.set(clamped);
                lyricCurrentTime.set(clamped);
            });

            const nodes = expandVNodeTree(
                (MobileNowPlayingSheet as unknown as (p: any) => unknown)({
                    isOpen: true,
                    displayMode: 'lyrics',
                    subDrawer: 'none',
                    onChangeDisplayMode: vi.fn(),
                    onChangeSubDrawer: vi.fn(),
                    onClose: vi.fn(),
                    currentSong: { id: -1, name: 'Test Song', artists: [{ id: 1, name: 'Artist' }], album: { id: 1, name: 'Album' } },
                    artistName: 'Artist',
                    albumName: 'Album',
                    coverUrl: null,
                    playerState: PlayerState.PLAYING,
                    currentTime,
                    lyricCurrentTime,
                    duration: 240,
                    lyrics: { lines },
                    currentLineIndex: 1,
                    isLyricsLoading: false,
                    isLiked: false,
                    loopMode: 'all',
                    theme: { primaryColor: '#fff', secondaryColor: '#aaa', backgroundColor: '#000', accentColor: '#38bdf8' },
                    visualizerMode: 'monet',
                    onVisualizerModeChange: vi.fn(),
                    lyricsFontScale: 1,
                    onLyricsFontScaleChange: vi.fn(),
                    showSubtitleTranslation: false,
                    onToggleSubtitleTranslation: vi.fn(),
                    lyricTimelineOffsetMs: 0,
                    onLyricTimelineOffsetChange: vi.fn(),
                    activeLocalLyricsSource: 'local',
                    onChangeLyricsSource: vi.fn(),
                    onImportLocalLyricsFile: vi.fn(),
                    onOpenLyricMatch: vi.fn(),
                    onSeek,
                    onLyricLineSeek: onSeek,
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
                }),
            );

            const rangeInput = nodes.find(n => n.type === 'input' && n.props?.type === 'range' && n.props?.['aria-label'] === 'Seek progress');
            expect(rangeInput).toBeTruthy();

            // 1. Seek to middle (125s) via pointer scrub while playing -> lyrics immediately sync to Chorus line (index 2)
            rangeInput?.props?.onPointerDown?.({ pointerId: 1, currentTarget: { setPointerCapture: vi.fn() } });
            rangeInput?.props?.onInput?.({ currentTarget: { value: '125' } });
            rangeInput?.props?.onPointerUp?.({ currentTarget: { value: '125' } });
            expect(onSeek).toHaveBeenLastCalledWith(125);
            expect(currentTime.get()).toBe(125);
            expect(lyricCurrentTime.get()).toBe(125);
            expect(Array.from(computeActiveLyricLineIndices(lines, 2, lyricCurrentTime.get()))).toEqual([2]);
            expect(computeTimedWordProgressPercent(lines[2]!.words[0]!, lyricCurrentTime.get())).toBeCloseTo(75, 1);

            // 2. Seek to beginning (0s) via touch scrub -> lyrics immediately sync to Intro line (index 0)
            rangeInput?.props?.onTouchStart?.();
            rangeInput?.props?.onInput?.({ currentTarget: { value: '0' } });
            rangeInput?.props?.onTouchEnd?.({ currentTarget: { value: '0' } });
            expect(onSeek).toHaveBeenLastCalledWith(0);
            expect(currentTime.get()).toBe(0);
            expect(Array.from(computeActiveLyricLineIndices(lines, 0, lyricCurrentTime.get()))).toEqual([0]);

            // 3. Seek to end (240s) via direct tap (onChange) -> clamped to 239.95s so source is never unloaded
            rangeInput?.props?.onChange?.({ currentTarget: { value: '240' } });
            expect(seekTargets.at(-1)).toBeCloseTo(239.95, 2);
        });

        it('restores library scroll position, expands visible window when playing track moved ahead, and clamps invalid offsets on list changes', () => {
            // Case 1: User scrolled to 1,280px (around song #20) and opened song #22, then returned without changing songs
            const unchanged = computeRestoredLibraryScrollState({
                savedScrollTop: 1280,
                viewportHeight: 512,
                rowHeight: 64,
                totalItems: 500,
                currentVisibleLimit: 120,
                stepSize: 120,
                activeSongIndex: 22,
                openedFromThisContext: true,
            });
            expect(unchanged.nextScrollTop).toBe(1280);
            expect(unchanged.nextVisibleLimit).toBe(120);
            expect(unchanged.shouldScrollActiveSongIntoView).toBe(false);

            // Case 2: While in the player, playback advanced to song #185 (beyond initial 120-song window)
            const advanced = computeRestoredLibraryScrollState({
                savedScrollTop: 1280,
                viewportHeight: 512,
                rowHeight: 64,
                totalItems: 500,
                currentVisibleLimit: 120,
                stepSize: 120,
                activeSongIndex: 185,
                openedFromThisContext: true,
            });
            expect(advanced.nextVisibleLimit).toBe(240);
            expect(advanced.shouldScrollActiveSongIntoView).toBe(true);
            // Active song #185 is at 185 * 64 = 11,840px; restored scroll brings it into the 512px viewport
            expect(advanced.nextScrollTop).toBeGreaterThanOrEqual(185 * 64 - 512);
            expect(advanced.nextScrollTop).toBeLessThanOrEqual(185 * 64);

            // Case 3: Filter or deletion reduced list to 5 items while player was open -> clamps scrollTop instead of restoring invalid offset
            const shrunk = computeRestoredLibraryScrollState({
                savedScrollTop: 4200,
                viewportHeight: 512,
                rowHeight: 64,
                totalItems: 5,
                currentVisibleLimit: 120,
                stepSize: 120,
                activeSongIndex: -1,
                openedFromThisContext: false,
            });
            expect(shrunk.nextScrollTop).toBe(0);
        });
    });

    describe('Part B: Full-Screen Local Album Video Covers & Shared Persistent Index', () => {
        afterEach(() => {
            resetLocalAlbumVideoCatalogForTests();
        });

        it('normalizes album names across case, punctuation, edition suffixes, and Arabic orthography, persists associations, and supports manual overrides', async () => {
            (globalThis as { Capacitor?: unknown }).Capacitor = {
                getPlatform: () => 'android',
                isNativePlatform: () => true,
            };
            (globalThis as { __FOLIA_ANDROID_BRIDGE__?: unknown }).__FOLIA_ANDROID_BRIDGE__ = {
                checkFileReadable: vi.fn(async () => ({ readable: true })),
            };

            await reconcileVideosForRootFolder('AlbumVideos', [
                {
                    name: 'Tamally_Maak (Deluxe Edition) [Animated Cover].mp4',
                    relativePath: 'AlbumVideos/Tamally_Maak (Deluxe Edition) [Animated Cover].mp4',
                    size: 14_500_000,
                    lastModified: 1000,
                    mimeType: 'video/mp4',
                    safContentUri: 'content://saf/videos/TamallyMaak_v1.mp4',
                    safTreeUri: 'content://saf/tree/AlbumVideos',
                },
                {
                    name: 'Tamally Maak (Alternate Loop).webm',
                    relativePath: 'AlbumVideos/Tamally Maak (Alternate Loop).webm',
                    size: 11_200_000,
                    lastModified: 2000,
                    mimeType: 'video/webm',
                    safContentUri: 'content://saf/videos/TamallyMaak_v2.webm',
                    safTreeUri: 'content://saf/tree/AlbumVideos',
                },
                {
                    name: 'Fairuz - Golden Classics.mp4',
                    relativePath: 'AlbumVideos/Fairuz - Golden Classics.mp4',
                    size: 18_000_000,
                    lastModified: 3000,
                    mimeType: 'video/mp4',
                    safContentUri: 'content://saf/videos/GoldenClassics.mp4',
                    safTreeUri: 'content://saf/tree/AlbumVideos',
                },
                {
                    name: 'أحبك يا قلبي.mp4',
                    relativePath: 'AlbumVideos/أحبك يا قلبي.mp4',
                    size: 9_000_000,
                    lastModified: 4000,
                    mimeType: 'video/mp4',
                    safContentUri: 'content://saf/videos/Ahebbak.mp4',
                    safTreeUri: 'content://saf/tree/AlbumVideos',
                },
            ]);

            expect(getRegisteredAlbumVideos()).toHaveLength(4);

            // 1. Matches "Tamally Maak" and detects the 2 ambiguous candidate videos
            const tamallyMatch = await resolveAlbumVideoForTrack({
                albumName: 'Tamally Maak',
                artistName: 'Amr Diab',
            });
            expect(tamallyMatch.video?.fileName).toBe('Tamally_Maak (Deluxe Edition) [Animated Cover].mp4');
            expect(tamallyMatch.origin).toBe('auto');
            expect(tamallyMatch.streamUrl).toContain('content%3A%2F%2Fsaf%2Fvideos%2FTamallyMaak_v1.mp4');
            expect(tamallyMatch.ambiguousCandidates).toHaveLength(2);

            // 2. User manually selects the second candidate (.webm) for "Tamally Maak"
            const secondCandidate = tamallyMatch.ambiguousCandidates.find(v => v.fileName.endsWith('.webm'))!;
            await assignVideoToAlbum('Tamally Maak', secondCandidate.id, 'Amr Diab');

            const overriddenMatch = await resolveAlbumVideoForTrack({
                albumName: 'Tamally Maak',
                artistName: 'Amr Diab',
            });
            expect(overriddenMatch.origin).toBe('manual');
            expect(overriddenMatch.video?.id).toBe(secondCandidate.id);
            expect(overriddenMatch.streamUrl).toContain('TamallyMaak_v2.webm');

            // 3. Multiple songs from the same album reuse the exact same video and streamUrl without re-scanning
            const secondTrackSameAlbum = await resolveAlbumVideoForTrack({
                albumName: 'Tamally Maak',
                artistName: 'Amr Diab',
            });
            expect(secondTrackSameAlbum.video?.id).toBe(overriddenMatch.video?.id);
            expect(secondTrackSameAlbum.streamUrl).toBe(overriddenMatch.streamUrl);

            // 4. Matches "Artist - Album.mp4" and Arabic orthography ("احبك يا قلبي" -> "أحبك يا قلبي.mp4")
            const fairuzMatch = await resolveAlbumVideoForTrack({
                albumName: 'Golden Classics',
                artistName: 'Fairuz',
            });
            expect(fairuzMatch.video?.fileName).toBe('Fairuz - Golden Classics.mp4');

            const arabicMatch = await resolveAlbumVideoForTrack({
                albumName: 'احبك يا قلبي',
                artistName: 'Fairuz',
            });
            expect(arabicMatch.video?.fileName).toBe('أحبك يا قلبي.mp4');

            // 5. Resetting manual association restores auto-matching
            await resetAlbumVideoAssociation('Tamally Maak');
            const restoredAuto = await resolveAlbumVideoForTrack({
                albumName: 'Tamally Maak',
                artistName: 'Amr Diab',
            });
            expect(restoredAuto.origin).toBe('auto');
            expect(restoredAuto.video?.fileName).toBe('Tamally_Maak (Deluxe Edition) [Animated Cover].mp4');
        });

        it('renders Full-Screen Local Album Video Stage in MobileNowPlayingSheet, keeps the same videoKey across tracks on the same album, pauses when hidden/paused, and falls back to artwork when disabled', () => {
            const storage = new Map<string, string>();
            const mockLocalStorage = {
                getItem: (key: string) => storage.get(key) ?? null,
                setItem: (key: string, val: string) => storage.set(key, val),
                removeItem: (key: string) => storage.delete(key),
            };
            (globalThis as { localStorage?: unknown }).localStorage = mockLocalStorage;
            (globalThis as { window?: unknown }).window = { localStorage: mockLocalStorage };

            writeStoredAlbumVideoCoversEnabled(true);
            expect(readStoredAlbumVideoCoversEnabled()).toBe(true);
            expect(storage.get(ALBUM_VIDEO_COVERS_STORAGE_KEY)).toBe('true');
            useDynamicAlbumArtworkStore.getState().setAlbumVideoEnabled(true);

            // Verify resolveAlbumVideoStageState continuity key & aspect-ratio scaling
            const track1Stage = resolveAlbumVideoStageState({
                albumVideoEnabled: true,
                videoStreamUrl: 'https://localhost/__folia_saf/stream?uri=content%3A%2F%2Fsaf%2FGoldenClassics.mp4',
                videoId: 'albvid_golden',
                isPlaying: true,
                isCoverScreenActive: true,
                isPageVisible: true,
                prefersReducedMotion: false,
                videoWidth: 1080,
                videoHeight: 1440,
                viewportWidth: 390,
                viewportHeight: 844,
            });
            const track2SameAlbumStage = resolveAlbumVideoStageState({
                albumVideoEnabled: true,
                videoStreamUrl: 'https://localhost/__folia_saf/stream?uri=content%3A%2F%2Fsaf%2FGoldenClassics.mp4',
                videoId: 'albvid_golden',
                isPlaying: true,
                isCoverScreenActive: true,
                isPageVisible: true,
                prefersReducedMotion: false,
                videoWidth: 1080,
                videoHeight: 1440,
                viewportWidth: 390,
                viewportHeight: 844,
            });
            expect(track1Stage.shouldShowVideo).toBe(true);
            expect(track1Stage.shouldPlayVideo).toBe(true);
            expect(track1Stage.scalingMode).toBe('cover-fill');
            // Same album -> identical videoKey so <video> never reloads across track switch
            expect(track2SameAlbumStage.videoKey).toBe(track1Stage.videoKey);

            // Wide 16:9 video on portrait viewport uses ambient-framed scaling
            const wideLandscapeStage = resolveAlbumVideoStageState({
                albumVideoEnabled: true,
                videoStreamUrl: 'https://localhost/__folia_saf/stream?uri=content%3A%2F%2Fsaf%2FWide.mp4',
                videoId: 'albvid_wide',
                isPlaying: true,
                isCoverScreenActive: true,
                isPageVisible: true,
                prefersReducedMotion: false,
                videoWidth: 1920,
                videoHeight: 1080,
                viewportWidth: 390,
                viewportHeight: 844,
            });
            expect(wideLandscapeStage.scalingMode).toBe('ambient-framed');

            // Paused or reduced-motion pauses video playback to save battery
            expect(
                resolveAlbumVideoStageState({
                    albumVideoEnabled: true,
                    videoStreamUrl: 'https://localhost/__folia_saf/stream?uri=content%3A%2F%2Fsaf%2FGoldenClassics.mp4',
                    videoId: 'albvid_golden',
                    isPlaying: false,
                    isCoverScreenActive: true,
                    isPageVisible: true,
                    prefersReducedMotion: false,
                }).shouldPlayVideo,
            ).toBe(false);

            const makeVideoSheetProps = (overrides: Record<string, unknown> = {}) => ({
                isOpen: true,
                displayMode: 'cover' as const,
                subDrawer: 'none' as const,
                onChangeDisplayMode: vi.fn(),
                onChangeSubDrawer: vi.fn(),
                onClose: vi.fn(),
                currentSong: {
                    id: -101,
                    name: 'Habaytak',
                    artists: [{ id: 1, name: 'Fairuz' }],
                    album: { id: 1, name: 'Golden Classics' },
                },
                artistName: 'Fairuz',
                albumName: 'Golden Classics',
                coverUrl: 'https://example.com/golden-classics.jpg',
                albumVideoUrl: 'https://localhost/__folia_saf/stream?uri=content%3A%2F%2Fsaf%2FGoldenClassics.mp4',
                albumVideoId: 'albvid_golden',
                playerState: PlayerState.PLAYING,
                currentTime: motionValue(18.5),
                lyricCurrentTime: motionValue(18.5),
                duration: 215,
                lyrics: null,
                currentLineIndex: -1,
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

            // Render with album video active
            const videoNodes = expandVNodeTree(
                (MobileNowPlayingSheet as unknown as (p: any) => unknown)(makeVideoSheetProps()),
            );
            const fullScreenVideoStage = videoNodes.find(
                n => n.props?.['data-testid'] === 'mobile-fullscreen-album-video-stage',
            );
            expect(fullScreenVideoStage).toBeTruthy();
            expect(fullScreenVideoStage?.props?.['data-video-key']).toBe('albvid_golden');
            expect(fullScreenVideoStage?.props?.['data-video-playing']).toBe('true');

            const videoElement = videoNodes.find(
                n => n.props?.['data-testid'] === 'mobile-album-video-element',
            );
            expect(videoElement).toBeTruthy();
            expect(videoElement?.props?.src).toContain('GoldenClassics.mp4');
            expect(videoElement?.props?.loop).toBe(true);
            expect(videoElement?.props?.muted).toBe(true);
            expect(videoNodes.find(n => n.props?.['data-testid'] === 'album-video-readability-gradient')).toBeTruthy();

            // Disable album videos -> falls back to DynamicAlbumCoverStage without error
            useDynamicAlbumArtworkStore.getState().setAlbumVideoEnabled(false);
            const fallbackToArtworkNodes = expandVNodeTree(
                (MobileNowPlayingSheet as unknown as (p: any) => unknown)(makeVideoSheetProps()),
            );
            expect(
                fallbackToArtworkNodes.find(n => n.props?.['data-testid'] === 'mobile-fullscreen-album-video-stage'),
            ).toBeUndefined();
            expect(
                fallbackToArtworkNodes.find(n => n.props?.['data-testid'] === 'dynamic-album-cover-stage'),
            ).toBeTruthy();
        });

        it('enforces 0.30x / max-384px ambient background resolution, viewport culling for off-screen lyric lines, and strict screen-off visibility freeze', () => {
            // 1. Ambient background internal framebuffer resolution
            expect(AMBIENT_BACKGROUND_DPR_SCALE).toBe(0.3);
            expect(AMBIENT_BACKGROUND_MAX_DIMENSION_PX).toBe(384);
            expect(AMBIENT_BACKGROUND_MAX_PIXELS).toBe(384 * 256);
            expect(MONET_BACKGROUND_WIDTH).toBe(384);
            expect(MONET_BACKGROUND_HEIGHT).toBe(256);

            const sized1080p = resolveAmbientBackgroundCanvasSize(1920, 1080);
            expect(sized1080p.width).toBeLessThanOrEqual(384);
            expect(sized1080p.height).toBeLessThanOrEqual(256);

            const sizedMobile = resolveAmbientBackgroundCanvasSize(412, 915);
            expect(sizedMobile.height).toBeLessThanOrEqual(384);
            expect(sizedMobile.width).toBeLessThanOrEqual(256);

            // 2. Viewport culling on 30-line lyric list: lines far from active/viewport center are culled & un-blurred
            const manyLines = Array.from({ length: 30 }, (_, idx) => ({
                startTime: idx * 4,
                endTime: (idx + 1) * 4,
                fullText: `Lyric line number ${idx + 1}`,
                words: [{ text: 'Lyric', startTime: idx * 4, endTime: idx * 4 + 2 }],
            }));

            const lyricsNodes = expandVNodeTree(
                (MobileNowPlayingSheet as unknown as (p: any) => unknown)({
                    isOpen: true,
                    displayMode: 'lyrics' as const,
                    subDrawer: 'none' as const,
                    onChangeDisplayMode: vi.fn(),
                    onChangeSubDrawer: vi.fn(),
                    onClose: vi.fn(),
                    currentSong: { id: 1, name: 'Test', artists: [{ id: 1, name: 'Artist' }], album: { id: 1, name: 'Album' } },
                    artistName: 'Artist',
                    albumName: 'Album',
                    coverUrl: null,
                    playerState: PlayerState.PLAYING,
                    currentTime: motionValue(1),
                    lyricCurrentTime: motionValue(1),
                    duration: 120,
                    lyrics: { lines: manyLines },
                    currentLineIndex: 0,
                    isLyricsLoading: false,
                    isLiked: false,
                    loopMode: 'all' as const,
                    theme: { primaryColor: '#fff', secondaryColor: '#aaa', backgroundColor: '#000', accentColor: '#38bdf8' },
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
                    onSaveQueueAsPlaylist: vi.fn(),
                    onOpenVisualizerSettings: vi.fn(),
                }),
            );

            const line0 = lyricsNodes.find(n => n.props?.['data-lyric-index'] === 0);
            const line1 = lyricsNodes.find(n => n.props?.['data-lyric-index'] === 1);
            const line25 = lyricsNodes.find(n => n.props?.['data-lyric-index'] === 25);

            expect(line0?.props?.['data-viewport-culled']).toBe('false');
            expect(line0?.props?.style?.filter).toBe('none');
            expect(line1?.props?.['data-viewport-culled']).toBe('false');
            expect(line1?.props?.style?.filter).toBe('blur(0.5px)');
            // Off-screen line 25 is culled and un-blurred
            expect(line25?.props?.['data-viewport-culled']).toBe('true');
            expect(line25?.props?.style?.filter).toBe('none');

            // 3. Strict screen-off & background visibility gate
            const observedStates: boolean[] = [];
            const unsub = subscribeAppForegroundVisibility(v => observedStates.push(v));
            setNativeActivityVisibleForTests(false);
            expect(isAppForegroundVisible()).toBe(false);
            setNativeActivityVisibleForTests(true);
            expect(isAppForegroundVisible()).toBe(true);
            expect(observedStates).toEqual([false, true]);
            unsub();
        });
    });
});
