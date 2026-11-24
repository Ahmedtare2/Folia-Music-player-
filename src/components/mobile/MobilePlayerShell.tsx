import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MotionValue } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
    ArrowLeft,
    Disc3,
    Film,
    FileUp,
    FolderOpen,
    Globe,
    Grid,
    Heart,
    Library,
    ListMusic,
    Loader2,
    Maximize2,
    Moon,
    Music,
    Play,
    Plus,
    RefreshCw,
    Search,
    Settings,
    Shuffle,
    Sliders,
    Sparkles,
    Sun,
    User,
    X,
} from 'lucide-react';
import {
    type LocalPlaylist,
    type LocalSong,
    type LyricData,
    PlayerState,
    type ReplayGainMode,
    type SongResult,
    type Theme,
    type VisualizerMode,
} from '../../types';
import type { LocalLibraryDisplayCatalog } from '../../services/playbackAdapters';
import { ensureLocalSongCoverAsset, type LocalMusicScanProgressDetail } from '../../services/localMusicService';
import { buildLocalQueue } from '../../services/playbackAdapters';
import { getCachedLocalCoverObjectUrl, resolveLocalCoverObjectUrl } from '../../services/localCoverRuntime';
import { isLocalCoverAssetUrl } from '../../services/localCoverAssetUrl';
import { detectTextDirection } from '../../utils/lyrics/arabicText';
import { VISUALIZER_REGISTRY, getVisualizerModeLabel } from '../visualizer/registry';
import { ANDROID_VISIBILITY_EVENT, hasAndroidNativeVisualizerBridge, minimizeAndroidApp } from '../../services/android/foliaAndroidBridge';
import type { NavidromeSong } from '../../types/navidrome';
import { AUDIO_EQUALIZER_PRESET_LABELS } from '../../utils/audioEqualizer';
import { useAudioSettingsStore } from '../../stores/useAudioSettingsStore';
import { useDynamicAlbumArtworkStore } from '../../stores/useDynamicAlbumArtworkStore';
import {
    LOCAL_ALBUM_VIDEOS_UPDATED_EVENT,
    ensureLocalAlbumVideoCatalogHydrated,
    getRegisteredAlbumVideos,
    importAlbumVideoFolder,
    resyncAlbumVideoFolders,
} from '../../services/localAlbumVideoService';
import { useSystemBarSettingsStore } from '../../stores/useSystemBarSettingsStore';
import { useShallow } from 'zustand/react/shallow';
import MobileEqualizerSheet from './MobileEqualizerSheet';
import MobileOnlineHub from './MobileOnlineHub';
import { MobileLetterRail, MobilePerformanceCard, MobilePlaybackTimingCard, MobileVideoExportCheckCard } from './MobileLibraryExtras';
import MobileMiniPlayer from './MobileMiniPlayer';
import MobileNowPlayingSheet from './MobileNowPlayingSheet';
import {
    type ExternalModalState,
    INITIAL_MOBILE_NAVIGATION_STATE,
    type MobileCollectionDetail,
    type MobileNavigationState,
    type MobilePrimaryTab,
    type MobileSongSortOrder,
    buildMobileLibraryCollections,
    buildTitleLetterIndex,
    computeRestoredLibraryScrollState,
    filterAndSortLocalSongs,
    isLocalSongCurrentlyPlaying,
    isMobileVisualizerVisible,
    resolveLocalSongAlbumText,
    resolveLocalSongArtistText,
    resolveLocalSongCoverThumb,
    stepMobileBackNavigation,
} from './mobileNavigationModel';

// src/components/mobile/MobilePlayerShell.tsx
// Phase 4 cohesive, OLED-friendly, mobile-first Android music player shell.
// Organizes navigation around local music (Songs, Albums/Artists, Folders/Playlists, Online, Settings),
// provides a persistent mini-player and full-screen Cover/Lyrics/Visualizer sheet, and integrates
// Android system Back navigation, Display & Immersive Mode system bar controls, Dynamic Album Artwork,
// and safe-area insets.

export interface MobilePlayerShellProps {
    localSongs: LocalSong[];
    localPlaylists: LocalPlaylist[];
    localLibraryCatalog: LocalLibraryDisplayCatalog;
    currentSong: SongResult | null;
    artistName: string;
    albumName: string;
    coverUrl: string | null;
    playerState: PlayerState;
    currentTime: MotionValue<number>;
    lyricCurrentTime: MotionValue<number>;
    duration: number;
    lyrics: LyricData | null;
    currentLineIndex: number;
    isLyricsLoading: boolean;
    isLiked: boolean;
    loopMode: 'off' | 'all' | 'one';
    replayGainMode: ReplayGainMode;
    onChangeReplayGainMode: (mode: ReplayGainMode) => void;
    theme: Theme;
    isDaylight: boolean;
    onToggleDaylight: () => void;
    useCoverColorBg: boolean;
    onToggleCoverColorBg: (enable: boolean) => void;
    visualizerMode: VisualizerMode;
    onVisualizerModeChange: (mode: VisualizerMode) => void;
    lyricsFontScale: number;
    onLyricsFontScaleChange: (scale: number) => void;
    showSubtitleTranslation: boolean;
    onToggleSubtitleTranslation: (show: boolean) => void;
    lyricTimelineOffsetMs: number;
    onLyricTimelineOffsetChange: (offsetMs: number) => void;
    activeLocalLyricsSource: 'local' | 'embedded' | 'online' | null;
    onChangeLyricsSource: (source: 'local' | 'embedded' | 'online') => void;
    onImportLocalLyricsFile: (content: string, fileName: string) => void;
    onOpenLyricMatch: () => void;
    onAutoMatchLyrics?: () => void;
    onTogglePureMusic?: () => void;
    onImportFolder: () => Promise<unknown>;
    onRefreshFolders: () => Promise<unknown>;
    onImportPlaylistFile: (file: File) => Promise<unknown>;
    isImportingOrScanning: boolean;
    scanPercent: number;
    scanProgress?: LocalMusicScanProgressDetail | null;
    onCancelScan?: () => void;
    onPlayLocalSongList: (song: LocalSong, queue: LocalSong[]) => void;
    onAddLocalSongToQueue: (song: LocalSong) => void;
    onPlayQueueSong: (song: SongResult, queue: SongResult[]) => void;
    playQueue: SongResult[];
    onRemoveQueueSong: (index: number) => void;
    onSaveQueueAsPlaylist: (name: string) => Promise<void>;
    onSeek: (timeSec: number) => void;
    onLyricLineSeek: (timeSec: number) => void;
    onTogglePlay: () => void;
    onPrevTrack: () => void;
    onNextTrack: () => void;
    onToggleLoop: () => void;
    onToggleLike: () => void;
    onShuffleQueue: () => void;
    onOpenFullSettingsModal: () => void;
    externalModals: ExternalModalState;
    onVisualizerVisibilityChange?: (visible: boolean) => void;
    isLatticeOpen?: boolean;
    onOpenLattice?: () => void;
    onCloseLattice?: () => void;
    onPlayOnlineSong?: (song: SongResult, queue?: SongResult[]) => void;
    onAddOnlineSongToQueue?: (song: SongResult) => void;
    onPlayNavidromeSong?: (song: NavidromeSong, queue?: NavidromeSong[]) => void;
    onAddNavidromeSongsToQueue?: (songs: NavidromeSong[]) => void;
    onOpenFullSearchWorkspace?: () => void;
}

const MAX_RENDERED_SONGS_STEP = 120;

const LocalCoverThumbnail: React.FC<{
    coverUrl: string | null | undefined;
    fallbackSong?: LocalSong;
    alt: string;
    fallback: React.ReactNode;
}> = React.memo(({ coverUrl, fallbackSong, alt, fallback }) => {
    const [lazyCoverUrl, setLazyCoverUrl] = useState<string | null>(null);
    const effectiveCoverUrl = coverUrl || lazyCoverUrl || (fallbackSong ? resolveLocalSongCoverThumb(fallbackSong, 512) : null) || null;
    const [resolvedUrl, setResolvedUrl] = useState<string | null>(() => {
        if (!effectiveCoverUrl) return null;
        return getCachedLocalCoverObjectUrl(effectiveCoverUrl) ?? effectiveCoverUrl;
    });
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        if (effectiveCoverUrl || !fallbackSong || fallbackSong.hasNoEmbeddedCover) {
            return undefined;
        }
        let cancelled = false;
        const timer = window.setTimeout(() => {
            void ensureLocalSongCoverAsset(fallbackSong).then((updated) => {
                if (cancelled) return;
                const nextUrl = resolveLocalSongCoverThumb(updated, 512);
                if (nextUrl) {
                    setLazyCoverUrl(nextUrl);
                }
            }).catch(() => {});
        }, 40);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [effectiveCoverUrl, fallbackSong]);

    useEffect(() => {
        setHasError(false);
        if (!effectiveCoverUrl) {
            setResolvedUrl(null);
            return undefined;
        }
        const cached = getCachedLocalCoverObjectUrl(effectiveCoverUrl);
        if (cached) {
            setResolvedUrl(cached);
            return undefined;
        }
        if (!isLocalCoverAssetUrl(effectiveCoverUrl)) {
            setResolvedUrl(effectiveCoverUrl);
            return undefined;
        }
        setResolvedUrl(effectiveCoverUrl);
        let cancelled = false;
        void resolveLocalCoverObjectUrl(effectiveCoverUrl).then((blobUrl) => {
            if (!cancelled && blobUrl) {
                setResolvedUrl(blobUrl);
                setHasError(false);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [effectiveCoverUrl]);

    if (!resolvedUrl || hasError) {
        return <>{fallback}</>;
    }

    return (
        <img
            src={resolvedUrl}
            alt={alt}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => setHasError(true)}
        />
    );
});

export const MobilePlayerShell: React.FC<MobilePlayerShellProps> = ({
    localSongs,
    localPlaylists,
    localLibraryCatalog,
    currentSong,
    artistName,
    albumName,
    coverUrl,
    playerState,
    currentTime,
    lyricCurrentTime,
    duration,
    lyrics,
    currentLineIndex,
    isLyricsLoading,
    isLiked,
    loopMode,
    replayGainMode,
    onChangeReplayGainMode,
    theme,
    isDaylight,
    onToggleDaylight,
    useCoverColorBg,
    onToggleCoverColorBg,
    visualizerMode,
    onVisualizerModeChange,
    lyricsFontScale,
    onLyricsFontScaleChange,
    showSubtitleTranslation,
    onToggleSubtitleTranslation,
    lyricTimelineOffsetMs,
    onLyricTimelineOffsetChange,
    activeLocalLyricsSource,
    onChangeLyricsSource,
    onImportLocalLyricsFile,
    onOpenLyricMatch,
    onAutoMatchLyrics,
    onTogglePureMusic,
    onImportFolder,
    onRefreshFolders,
    onImportPlaylistFile,
    isImportingOrScanning,
    scanPercent,
    scanProgress,
    onCancelScan,
    onPlayLocalSongList,
    onAddLocalSongToQueue,
    onPlayQueueSong,
    playQueue,
    onRemoveQueueSong,
    onSaveQueueAsPlaylist,
    onSeek,
    onLyricLineSeek,
    onTogglePlay,
    onPrevTrack,
    onNextTrack,
    onToggleLoop,
    onToggleLike,
    onShuffleQueue,
    onOpenFullSettingsModal,
    externalModals,
    onVisualizerVisibilityChange,
    isLatticeOpen = false,
    onOpenLattice,
    onCloseLattice,
    onPlayOnlineSong,
    onAddOnlineSongToQueue,
    onPlayNavidromeSong,
    onAddNavidromeSongsToQueue,
    onOpenFullSearchWorkspace,
}) => {
    const equalizerSettings = useAudioSettingsStore(state => state.audioEqualizerSettings);
    const setEqualizerSettings = useAudioSettingsStore(state => state.handleSetAudioEqualizerSettings);
    const openDesktopEqualizer = useAudioSettingsStore(state => state.openAudioEqualizer);
    const {
        albumVideoEnabled,
        dynamicArtworkEnabled,
        dynamicArtworkIntensity,
        setAlbumVideoEnabled,
        setDynamicArtworkEnabled,
        setDynamicArtworkIntensity,
    } = useDynamicAlbumArtworkStore(
        useShallow(state => ({
            albumVideoEnabled: state.albumVideoEnabled,
            dynamicArtworkEnabled: state.enabled,
            dynamicArtworkIntensity: state.intensity,
            setAlbumVideoEnabled: state.setAlbumVideoEnabled,
            setDynamicArtworkEnabled: state.setDynamicAlbumArtworkEnabled,
            setDynamicArtworkIntensity: state.setDynamicAlbumArtworkIntensity,
        })),
    );
    const {
        hideStatusBar,
        hideNavigationBar,
        fullScreenLyricsMode,
        effectiveSystemBars,
        setHideStatusBar,
        setHideNavigationBar,
        setFullScreenLyricsMode,
        setLyricsOrVisualizerScreenActive,
        reapplySystemBars,
    } = useSystemBarSettingsStore(
        useShallow(state => ({
            hideStatusBar: state.hideStatusBar,
            hideNavigationBar: state.hideNavigationBar,
            fullScreenLyricsMode: state.fullScreenLyricsMode,
            effectiveSystemBars: state.effectiveState,
            setHideStatusBar: state.setHideStatusBar,
            setHideNavigationBar: state.setHideNavigationBar,
            setFullScreenLyricsMode: state.setFullScreenLyricsMode,
            setLyricsOrVisualizerScreenActive: state.setLyricsOrVisualizerScreenActive,
            reapplySystemBars: state.reapplySystemBars,
        })),
    );
    const [isShellEqualizerOpen, setIsShellEqualizerOpen] = useState(false);
    const { t } = useTranslation();
    const [navState, setNavState] = useState<MobileNavigationState>(INITIAL_MOBILE_NAVIGATION_STATE);
    const [searchQuery, setSearchQuery] = useState('');
    const [albumsSearchQuery, setAlbumsSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState<MobileSongSortOrder>('title');
    const [visibleSongLimit, setVisibleSongLimit] = useState(MAX_RENDERED_SONGS_STEP);
    const [visibleAlbumLimit, setVisibleAlbumLimit] = useState(60);
    const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
    const playlistInputRef = useRef<HTMLInputElement>(null);
    const songsListScrollRef = useRef<HTMLDivElement>(null);
    const collectionDetailScrollRef = useRef<HTMLDivElement>(null);
    const albumsGridScrollRef = useRef<HTMLDivElement>(null);
    const foldersListScrollRef = useRef<HTMLDivElement>(null);
    const savedScrollOffsetsRef = useRef<Record<string, number>>({});
    const openedSongContextRef = useRef<string | null>(null);
    const wasPlayerExpandedRef = useRef(false);

    const navStateRef = useRef(navState);
    navStateRef.current = navState;
    const externalModalsRef = useRef(externalModals);
    externalModalsRef.current = externalModals;
    const isLatticeOpenRef = useRef(isLatticeOpen);
    isLatticeOpenRef.current = isLatticeOpen;
    const onCloseLatticeRef = useRef(onCloseLattice);
    onCloseLatticeRef.current = onCloseLattice;

    const isPlayerExpanded = navState.playerSheet === 'expanded' && Boolean(currentSong);
    const isLyricsOrVisualizerScreen = Boolean(
        !externalModals.isSettingsModalOpen
        && (
            isLatticeOpen
            || (isPlayerExpanded && (navState.playerDisplayMode === 'lyrics' || navState.playerDisplayMode === 'stage'))
        ),
    );

    // Restore persisted system bar settings on startup and when returning to foreground
    useEffect(() => {
        reapplySystemBars();
        if (typeof window === 'undefined') return undefined;
        const handleNativeVisibility = (event: Event) => {
            const detail = (event as CustomEvent<{ visible?: boolean }>).detail;
            if (detail?.visible) {
                reapplySystemBars();
            }
        };
        window.addEventListener(ANDROID_VISIBILITY_EVENT, handleNativeVisibility);
        return () => window.removeEventListener(ANDROID_VISIBILITY_EVENT, handleNativeVisibility);
    }, [reapplySystemBars]);

    // Apply or restore system bar visibility when entering or leaving the lyrics / visualizer screen
    useEffect(() => {
        setLyricsOrVisualizerScreenActive(isLyricsOrVisualizerScreen);
    }, [isLyricsOrVisualizerScreen, setLyricsOrVisualizerScreenActive]);

    // Report whether the full-screen visualizer is visible so App.tsx can pause GPU loops when hidden
    useEffect(() => {
        onVisualizerVisibilityChange?.(!isLatticeOpen && isMobileVisualizerVisible(navState));
    }, [isLatticeOpen, navState, onVisualizerVisibilityChange]);

    // Detect soft keyboard appearance via visualViewport so bottom tab bar does not crowd the input
    useEffect(() => {
        if (typeof window === 'undefined' || !window.visualViewport) return undefined;
        const viewport = window.visualViewport;
        const onViewportResize = () => {
            setIsKeyboardOpen(viewport.height < window.innerHeight * 0.78);
        };
        viewport.addEventListener('resize', onViewportResize);
        return () => viewport.removeEventListener('resize', onViewportResize);
    }, []);

    // Register global Android hardware Back handler called by MainActivity.java OnBackPressedCallback
    const isShellEqualizerOpenRef = useRef(isShellEqualizerOpen);
    isShellEqualizerOpenRef.current = isShellEqualizerOpen;

    const handleHardwareBack = useCallback((): boolean => {
        if (isShellEqualizerOpenRef.current) {
            setIsShellEqualizerOpen(false);
            return true;
        }
        if (isLatticeOpenRef.current && onCloseLatticeRef.current) {
            onCloseLatticeRef.current();
            return true;
        }
        const result = stepMobileBackNavigation(navStateRef.current, externalModalsRef.current);
        if (result.sideEffect) {
            result.sideEffect();
            return true;
        }
        if (result.handled) {
            setNavState(result.nextState);
            return true;
        }
        void minimizeAndroidApp();
        return false;
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const win = window as Window & { __FOLIA_HANDLE_HARDWARE_BACK__?: () => boolean };
        win.__FOLIA_HANDLE_HARDWARE_BACK__ = handleHardwareBack;
        return () => {
            if (win.__FOLIA_HANDLE_HARDWARE_BACK__ === handleHardwareBack) {
                delete win.__FOLIA_HANDLE_HARDWARE_BACK__;
            }
        };
    }, [handleHardwareBack]);

    const filteredSongs = useMemo(
        () => filterAndSortLocalSongs(localSongs, searchQuery, sortOrder),
        [localSongs, searchQuery, sortOrder],
    );

    const titleLetterIndex = useMemo(
        () => (sortOrder === 'title' ? buildTitleLetterIndex(filteredSongs) : null),
        [filteredSongs, sortOrder],
    );
    const pendingLetterJumpRef = useRef<string | null>(null);
    const handleLetterJump = (letter: string) => {
        const index = titleLetterIndex?.firstIndex.get(letter);
        const target = index === undefined ? undefined : filteredSongs[index];
        if (!target) return;
        pendingLetterJumpRef.current = target.id;
        const needed = (index ?? 0) + MAX_RENDERED_SONGS_STEP;
        if (visibleSongLimit < needed) setVisibleSongLimit(needed);
        runPendingLetterJump();
    };
    const runPendingLetterJump = () => {
        const id = pendingLetterJumpRef.current;
        const container = songsListScrollRef.current;
        if (!id || !container) return;
        const row = container.querySelector<HTMLElement>(`[data-song-id="${id.replace(/"/g, '\\"')}"]`);
        if (!row) return;
        container.scrollTop += row.getBoundingClientRect().top - container.getBoundingClientRect().top;
        savedScrollOffsetsRef.current.songs = container.scrollTop;
        pendingLetterJumpRef.current = null;
    };
    useEffect(() => {
        if (pendingLetterJumpRef.current) runPendingLetterJump();
    });

    const collections = useMemo(
        () => buildMobileLibraryCollections(
            localSongs,
            localPlaylists,
            localLibraryCatalog,
            (key, fallback) => t(key, fallback ?? key),
        ),
        [localLibraryCatalog, localPlaylists, localSongs, t],
    );

    // Keep collectionDetail synchronized with library updates made while the player is open
    useEffect(() => {
        if (!navState.collectionDetail) return;
        const { kind, id } = navState.collectionDetail;
        const pool = kind === 'album'
            ? collections.albums
            : kind === 'artist'
                ? collections.artists
                : kind === 'folder'
                    ? collections.folders
                    : collections.playlists;
        const updated = pool.find(item => item.id === id);
        if (!updated) {
            setNavState(prev => (prev.collectionDetail ? { ...prev, collectionDetail: null } : prev));
        } else if (
            updated.songs.length !== navState.collectionDetail.songs.length
            || updated.title !== navState.collectionDetail.title
        ) {
            setNavState(prev => (prev.collectionDetail ? { ...prev, collectionDetail: updated } : prev));
        }
    }, [collections, navState.collectionDetail]);

    // Restore scroll offset and keep the active playing song visible when returning from the player sheet
    useEffect(() => {
        const wasExpanded = wasPlayerExpandedRef.current;
        wasPlayerExpandedRef.current = isPlayerExpanded;
        if (!wasExpanded || isPlayerExpanded) return;

        if (navState.collectionDetail) {
            const contextKey = `collection:${navState.collectionDetail.kind}:${navState.collectionDetail.id}`;
            const container = collectionDetailScrollRef.current;
            const activeIdx = navState.collectionDetail.songs.findIndex(song =>
                isLocalSongCurrentlyPlaying(song, currentSong),
            );
            const restored = computeRestoredLibraryScrollState({
                savedScrollTop: savedScrollOffsetsRef.current[contextKey] ?? container?.scrollTop ?? 0,
                viewportHeight: container?.clientHeight || 480,
                rowHeight: 64,
                totalItems: navState.collectionDetail.songs.length,
                currentVisibleLimit: navState.collectionDetail.songs.length,
                stepSize: MAX_RENDERED_SONGS_STEP,
                activeSongIndex: activeIdx,
                openedFromThisContext: openedSongContextRef.current === contextKey,
            });
            if (container) {
                container.scrollTop = restored.nextScrollTop;
                if (restored.shouldScrollActiveSongIntoView && activeIdx >= 0) {
                    const activeSong = navState.collectionDetail.songs[activeIdx];
                    const rowEl = activeSong
                        ? container.querySelector<HTMLElement>(`[data-song-id="${activeSong.id}"]`)
                        : null;
                    if (rowEl && typeof rowEl.scrollIntoView === 'function') {
                        try {
                            rowEl.scrollIntoView({ block: 'nearest' });
                        } catch {
                            // Ignore in non-DOM test environments
                        }
                    }
                }
            }
            return;
        }

        if (navState.activeTab === 'songs') {
            const contextKey = 'songs';
            const container = songsListScrollRef.current;
            const activeIdx = filteredSongs.findIndex(song => isLocalSongCurrentlyPlaying(song, currentSong));
            const restored = computeRestoredLibraryScrollState({
                savedScrollTop: savedScrollOffsetsRef.current[contextKey] ?? container?.scrollTop ?? 0,
                viewportHeight: container?.clientHeight || 480,
                rowHeight: 64,
                totalItems: filteredSongs.length,
                currentVisibleLimit: visibleSongLimit,
                stepSize: MAX_RENDERED_SONGS_STEP,
                activeSongIndex: activeIdx,
                openedFromThisContext: openedSongContextRef.current === contextKey,
            });
            if (restored.nextVisibleLimit !== visibleSongLimit) {
                setVisibleSongLimit(restored.nextVisibleLimit);
            }
            if (container) {
                container.scrollTop = restored.nextScrollTop;
                if (restored.shouldScrollActiveSongIntoView && activeIdx >= 0) {
                    const activeSong = filteredSongs[activeIdx];
                    const rowEl = activeSong
                        ? container.querySelector<HTMLElement>(`[data-song-id="${activeSong.id}"]`)
                        : null;
                    if (rowEl && typeof rowEl.scrollIntoView === 'function') {
                        try {
                            rowEl.scrollIntoView({ block: 'nearest' });
                        } catch {
                            // Ignore in non-DOM test environments
                        }
                    }
                }
            }
        } else if (navState.activeTab === 'albums' && albumsGridScrollRef.current) {
            const key = `albums:${navState.albumsSubTab}`;
            albumsGridScrollRef.current.scrollTop = savedScrollOffsetsRef.current[key] ?? albumsGridScrollRef.current.scrollTop;
        } else if (navState.activeTab === 'folders' && foldersListScrollRef.current) {
            const key = `folders:${navState.foldersSubTab}`;
            foldersListScrollRef.current.scrollTop = savedScrollOffsetsRef.current[key] ?? foldersListScrollRef.current.scrollTop;
        }
    }, [
        currentSong,
        filteredSongs,
        isPlayerExpanded,
        navState.activeTab,
        navState.albumsSubTab,
        navState.collectionDetail,
        navState.foldersSubTab,
        visibleSongLimit,
    ]);

    const [albumVideoCount, setAlbumVideoCount] = useState<number>(() => getRegisteredAlbumVideos().length);
    useEffect(() => {
        let mounted = true;
        void ensureLocalAlbumVideoCatalogHydrated().then(async () => {
            if (!mounted) return;
            const currentCount = getRegisteredAlbumVideos().length;
            setAlbumVideoCount(currentCount);
            if (currentCount === 0 && localSongs.length > 0) {
                try {
                    const refreshed = await resyncAlbumVideoFolders();
                    if (mounted) setAlbumVideoCount(refreshed.length);
                } catch {
                    // Ignore background video discovery errors
                }
            }
        });
        if (typeof window === 'undefined') return undefined;
        const onUpdated = () => setAlbumVideoCount(getRegisteredAlbumVideos().length);
        window.addEventListener(LOCAL_ALBUM_VIDEOS_UPDATED_EVENT, onUpdated);
        return () => {
            mounted = false;
            window.removeEventListener(LOCAL_ALBUM_VIDEOS_UPDATED_EVENT, onUpdated);
        };
    }, []);

    const matchedPlayingLocalSong = useMemo(
        () => localSongs.find(song => isLocalSongCurrentlyPlaying(song, currentSong)) ?? null,
        [currentSong, localSongs],
    );

    // Resolve cover artwork using the same reliable local song source that works in the library
    const effectiveCoverUrl = useMemo((): string | null => {
        if (coverUrl) return coverUrl;
        if (currentSong?.album?.coverUrl) return currentSong.album.coverUrl;
        if (matchedPlayingLocalSong) {
            return resolveLocalSongCoverThumb(matchedPlayingLocalSong, 1024) ?? null;
        }
        return null;
    }, [coverUrl, currentSong, matchedPlayingLocalSong]);

    const accentColor = theme.accentColor || theme.primaryColor || '#f4f4f5';
    const hasLyrics = Boolean(lyrics && lyrics.lines.length > 0);

    const handleSelectTab = (tab: MobilePrimaryTab) => {
        setNavState(prev => ({
            ...prev,
            activeTab: tab,
            collectionDetail: null,
            playerSheet: 'collapsed',
            subDrawer: 'none',
        }));
    };

    const handleOpenCollection = (detail: MobileCollectionDetail) => {
        setNavState(prev => ({
            ...prev,
            collectionDetail: detail,
        }));
    };

    const resolveCurrentLibraryContextKey = (): string => {
        if (navState.collectionDetail) {
            return `collection:${navState.collectionDetail.kind}:${navState.collectionDetail.id}`;
        }
        return navState.activeTab;
    };

    const handlePlayAllSongs = (songs: LocalSong[], shuffle = false) => {
        if (songs.length === 0) return;
        openedSongContextRef.current = resolveCurrentLibraryContextKey();
        const list = shuffle ? [...songs].sort(() => Math.random() - 0.5) : songs;
        onPlayLocalSongList(list[0]!, list);
    };

    const renderSongRow = (song: LocalSong, queueContext: LocalSong[], index: number) => {
        const active = isLocalSongCurrentlyPlaying(song, currentSong);
        const thumbUrl = resolveLocalSongCoverThumb(song, 512);
        const songArtist = resolveLocalSongArtistText(song, t('localMusic.unknownArtist', 'Unknown Artist'));
        const songAlbum = resolveLocalSongAlbumText(song, t('localMusic.unknownAlbum', 'Unknown Album'));
        const titleDir = detectTextDirection(song.title || '');
        const subDir = detectTextDirection(`${songArtist} ${songAlbum}`);

        return (
            <div
                key={song.id || index}
                data-song-id={song.id}
                data-song-active={active ? 'true' : 'false'}
                className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors ${
                    active
                        ? 'bg-white/[0.10] border border-white/15'
                        : 'hover:bg-white/[0.04] active:bg-white/[0.08] border border-transparent'
                }`}
            >
                <button
                    type="button"
                    onClick={() => {
                        openedSongContextRef.current = resolveCurrentLibraryContextKey();
                        onPlayLocalSongList(song, queueContext);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left focus:outline-none"
                >
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-900">
                        <LocalCoverThumbnail
                            coverUrl={thumbUrl}
                            fallbackSong={song}
                            alt={song.title}
                            fallback={
                                <div className="flex h-full w-full items-center justify-center text-zinc-500">
                                    <Music size={20} />
                                </div>
                            }
                        />
                        {active && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                <div className="h-2.5 w-2.5 rounded-full animate-ping" style={{ backgroundColor: accentColor }} />
                            </div>
                        )}
                    </div>

                    <div className="min-w-0 flex-1">
                        <div
                            dir={titleDir}
                            className={`truncate text-sm font-semibold leading-snug ${
                                active ? 'text-white' : 'text-zinc-100'
                            }`}
                            style={{ unicodeBidi: 'plaintext' }}
                        >
                            {song.title}
                        </div>
                        <div
                            dir={subDir}
                            className="truncate text-xs text-zinc-400 mt-0.5"
                            style={{ unicodeBidi: 'plaintext' }}
                        >
                            {songArtist} · {songAlbum}
                        </div>
                    </div>
                </button>

                <button
                    type="button"
                    onClick={() => onAddLocalSongToQueue(song)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-white active:scale-95 transition-all"
                    aria-label={`Add ${song.title} to queue`}
                    title="Add to queue"
                >
                    <Plus size={18} />
                </button>
            </div>
        );
    };

    const renderEmptyLibraryState = () => (
        <div
            data-testid="mobile-empty-library-state"
            className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center"
        >
            <div
                className="flex h-20 w-20 items-center justify-center rounded-3xl border border-white/15 bg-white/[0.05] shadow-[0_16px_40px_rgba(0,0,0,0.6)]"
                style={{ color: accentColor }}
            >
                <FolderOpen size={36} strokeWidth={1.6} />
            </div>
            <h2 className="mt-5 text-xl font-bold tracking-tight text-white">
                {t('localMusic.noLocalMusic', 'Your Local Music Library')}
            </h2>
            <p className="mt-2 max-w-xs text-xs leading-relaxed text-zinc-400">
                Select a music folder on your phone to index audio files, embedded covers, and synchronized{' '}
                <code className="text-zinc-200">.lrc</code> / <code className="text-zinc-200">.ttml</code> lyrics for offline playback.
            </p>

            {isImportingOrScanning && (
                <div
                    data-testid="mobile-scan-progress-card"
                    className="mt-5 w-full max-w-xs rounded-2xl border border-white/10 bg-white/[0.05] p-3.5 text-left"
                >
                    <div className="flex items-center justify-between text-xs font-medium text-zinc-200">
                        <span className="flex items-center gap-2">
                            <Loader2 size={14} className="animate-spin" />
                            <span>
                                {scanProgress?.phase === 'discovering'
                                    ? 'Discovering music files...'
                                    : scanProgress?.phase === 'hydrating'
                                        ? `Indexing metadata (${scanProgress.completedSongs}/${scanProgress.totalSongs})`
                                        : 'Importing music library...'}
                            </span>
                        </span>
                        <div className="flex items-center gap-2">
                            <span>{scanPercent}%</span>
                            {onCancelScan && (
                                <button
                                    type="button"
                                    onClick={onCancelScan}
                                    className="rounded-lg border border-white/15 bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-zinc-200 active:scale-95"
                                >
                                    Cancel
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                            className="h-full rounded-full transition-all duration-200"
                            style={{ width: `${Math.max(5, scanPercent)}%`, backgroundColor: accentColor }}
                        />
                    </div>
                    {scanProgress && (
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-400">
                            <span>Discovered: {scanProgress.discoveredSongs ?? scanProgress.totalSongs ?? 0}</span>
                            <span>Processed: {scanProgress.processedSongs ?? scanProgress.completedSongs ?? 0}</span>
                            <span>Skipped: {scanProgress.skippedSongs ?? 0}</span>
                            {(scanProgress.failedSongs ?? 0) > 0 && (
                                <span className="text-amber-400">Failed: {scanProgress.failedSongs}</span>
                            )}
                        </div>
                    )}
                </div>
            )}

            <div className="mt-6 flex w-full max-w-xs flex-col gap-3">
                <button
                    type="button"
                    disabled={isImportingOrScanning}
                    onClick={() => void onImportFolder()}
                    className="flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl font-semibold text-sm text-zinc-950 shadow-lg active:scale-[0.98] transition-transform disabled:opacity-50"
                    style={{ backgroundColor: accentColor }}
                >
                    {isImportingOrScanning ? <Loader2 size={18} className="animate-spin" /> : <FolderOpen size={18} />}
                    <span>{t('localMusic.importFolder', 'Select Music Folder')}</span>
                </button>

                <button
                    type="button"
                    disabled={isImportingOrScanning}
                    onClick={() => playlistInputRef.current?.click()}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] text-xs font-semibold text-zinc-200 active:scale-[0.98] transition-transform"
                >
                    <FileUp size={15} />
                    <span>Import .M3U / .M3U8 Playlist</span>
                </button>
            </div>
        </div>
    );

    const renderCollectionDetailView = (detail: MobileCollectionDetail) => {
        const titleDir = detectTextDirection(detail.title || '');
        const collectionScrollKey = `collection:${detail.kind}:${detail.id}`;
        return (
            <div
                ref={collectionDetailScrollRef}
                data-testid="mobile-collection-detail"
                onScroll={(e) => {
                    savedScrollOffsetsRef.current[collectionScrollKey] = e.currentTarget.scrollTop;
                }}
                className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 pb-6 pt-2"
            >
                <div className="flex items-center gap-2 pb-3">
                    <button
                        type="button"
                        onClick={() => setNavState(prev => ({ ...prev, collectionDetail: null }))}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.07] text-zinc-200 active:scale-95"
                        aria-label="Back to list"
                    >
                        <ArrowLeft size={19} />
                    </button>
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        {detail.kind}
                    </span>
                </div>

                {/* Collection Hero Header */}
                <div className="flex flex-col sm:flex-row items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-lg">
                        <LocalCoverThumbnail
                            coverUrl={detail.coverUrl ?? null}
                            fallbackSong={detail.songs[0]}
                            alt={detail.title}
                            fallback={
                                <div className="flex h-full w-full items-center justify-center text-zinc-500">
                                    <Disc3 size={40} />
                                </div>
                            }
                        />
                    </div>
                    <div className="min-w-0 flex-1 text-center sm:text-left">
                        <h2
                            dir={titleDir}
                            className="text-lg font-bold text-white leading-snug"
                            style={{ unicodeBidi: 'plaintext' }}
                        >
                            {detail.title}
                        </h2>
                        {detail.subtitle && (
                            <p className="mt-0.5 text-xs text-zinc-400">{detail.subtitle}</p>
                        )}
                        <p className="mt-1 text-xs text-zinc-500">{detail.songs.length} tracks</p>

                        <div className="mt-3 flex items-center justify-center sm:justify-start gap-2.5">
                            <button
                                type="button"
                                onClick={() => handlePlayAllSongs(detail.songs, false)}
                                className="flex h-10 items-center gap-2 rounded-full px-5 text-xs font-semibold text-zinc-950 shadow-sm active:scale-95"
                                style={{ backgroundColor: accentColor }}
                            >
                                <Play size={15} fill="currentColor" />
                                Play
                            </button>
                            <button
                                type="button"
                                onClick={() => handlePlayAllSongs(detail.songs, true)}
                                className="flex h-10 items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-4 text-xs font-semibold text-white active:scale-95"
                            >
                                <Shuffle size={14} />
                                Shuffle
                            </button>
                        </div>
                    </div>
                </div>

                {/* Tracklist */}
                <div className="mt-4 space-y-1">
                    {detail.songs.map((song, idx) => renderSongRow(song, detail.songs, idx))}
                </div>
            </div>
        );
    };

    // When the Lattice queue collage is open, let the Lattice layer occupy the full viewport
    // without the mobile shell covering it.
    if (isLatticeOpen) {
        return null;
    }

    const topShellSafePadding = effectiveSystemBars.hideStatusBar
        ? 'max(var(--folia-native-cutout-top, env(safe-area-inset-top, 0px)), 8px)'
        : 'max(var(--folia-native-inset-top, env(safe-area-inset-top, 0px)), 8px)';
    const bottomNavSafePadding = effectiveSystemBars.hideNavigationBar
        ? '8px'
        : 'max(var(--folia-native-inset-bottom, env(safe-area-inset-bottom, 0px)), 8px)';

    return (
        <div
            data-testid="mobile-player-shell"
            data-hide-status-bar={effectiveSystemBars.hideStatusBar ? 'true' : 'false'}
            data-hide-navigation-bar={effectiveSystemBars.hideNavigationBar ? 'true' : 'false'}
            className={`fixed inset-0 z-40 flex flex-col overflow-hidden text-zinc-100 select-none ${
                isPlayerExpanded
                    ? ((hasAndroidNativeVisualizerBridge() || navState.playerDisplayMode === 'stage' || navState.playerDisplayMode === 'lyrics') ? 'bg-transparent' : 'bg-[#060609]')
                    : 'bg-[#060609]'
            }`}
            style={{
                paddingTop: topShellSafePadding,
                paddingLeft: 'max(var(--folia-native-inset-left, env(safe-area-inset-left, 0px)), 0px)',
                paddingRight: 'max(var(--folia-native-inset-right, env(safe-area-inset-right, 0px)), 0px)',
            }}
        >
            <input
                ref={playlistInputRef}
                type="file"
                accept=".m3u,.m3u8,audio/x-mpegurl,application/vnd.apple.mpegurl"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) void onImportPlaylistFile(file);
                }}
            />

            {/* Library chrome stays mounted (`hidden` when expanded) so DOM scroll positions,
                search filters, sort order, and decoded thumbnails are preserved across player navigation. */}
            <div
                data-testid="mobile-library-chrome"
                aria-hidden={isPlayerExpanded}
                className={isPlayerExpanded ? 'hidden' : 'flex min-h-0 flex-1 flex-col overflow-hidden'}
            >
                    {/* Top Mobile App Header */}
                    <header className="flex shrink-0 items-center justify-between gap-3 px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                            <div
                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/[0.07] font-bold text-sm"
                                style={{ color: accentColor }}
                            >
                                F
                            </div>
                            <div>
                                <h1 className="text-base font-bold tracking-tight text-white leading-none">
                                    Folia
                                </h1>
                                <p className="text-[11px] text-zinc-400 mt-0.5">
                                    {localSongs.length} {localSongs.length === 1 ? 'track' : 'tracks'} · Local Library
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                data-testid="mobile-header-equalizer-btn"
                                onClick={() => setIsShellEqualizerOpen(true)}
                                className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-zinc-200 active:scale-95 transition-transform"
                                aria-label="Open Audio Equalizer"
                                title="Audio Equalizer & Effects"
                            >
                                <Sliders size={15} />
                                {equalizerSettings.enabled && (
                                    <span
                                        className="absolute right-2 top-2 h-2 w-2 rounded-full"
                                        style={{ backgroundColor: accentColor }}
                                    />
                                )}
                            </button>
                            {onOpenLattice && (
                                <button
                                    type="button"
                                    onClick={onOpenLattice}
                                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-zinc-200 active:scale-95 transition-transform"
                                    aria-label="Open Lattice queue collage"
                                    title="Lattice Queue Collage"
                                >
                                    <Grid size={15} />
                                </button>
                            )}
                            <button
                                type="button"
                                disabled={isImportingOrScanning}
                                onClick={() => void onImportFolder()}
                                className="flex h-10 items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.07] px-3.5 text-xs font-medium text-zinc-100 active:scale-95 transition-transform disabled:opacity-50"
                                aria-label="Add music folder"
                            >
                                {isImportingOrScanning ? (
                                    <Loader2 size={14} className="animate-spin" />
                                ) : (
                                    <FolderOpen size={14} style={{ color: accentColor }} />
                                )}
                                <span>Add Folder</span>
                            </button>
                            <button
                                type="button"
                                disabled={isImportingOrScanning}
                                onClick={() => void onRefreshFolders()}
                                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-zinc-300 active:scale-95 transition-transform disabled:opacity-50"
                                aria-label="Rescan music folders"
                                title="Rescan folders"
                            >
                                <RefreshCw size={15} className={isImportingOrScanning ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </header>

                    {/* Non-blocking Live Scan Progress Banner (keeps library usable during scan) */}
                    {isImportingOrScanning && localSongs.length > 0 && (
                        <div
                            data-testid="mobile-live-scan-banner"
                            className="mx-4 mb-2 rounded-2xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5"
                        >
                            <div className="flex items-center justify-between gap-2 text-xs font-medium text-zinc-200">
                                <span className="flex items-center gap-2 truncate">
                                    <Loader2 size={13} className="shrink-0 animate-spin" style={{ color: accentColor }} />
                                    <span className="truncate">
                                        {scanProgress?.phase === 'discovering'
                                            ? `Scanning "${scanProgress.folderName || 'folder'}"...`
                                            : `Indexing "${scanProgress?.folderName || 'library'}" (${scanProgress?.completedSongs ?? 0}/${scanProgress?.totalSongs ?? 0})`}
                                    </span>
                                </span>
                                <div className="flex shrink-0 items-center gap-2">
                                    <span className="text-[11px] text-zinc-300">{scanPercent}%</span>
                                    {onCancelScan && (
                                        <button
                                            type="button"
                                            onClick={onCancelScan}
                                            className="rounded-lg border border-white/15 bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-zinc-100 active:scale-95"
                                        >
                                            Cancel
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
                                <div
                                    className="h-full rounded-full transition-all duration-200"
                                    style={{ width: `${Math.max(5, scanPercent)}%`, backgroundColor: accentColor }}
                                />
                            </div>
                            {scanProgress && (
                                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-zinc-400">
                                    <span>Discovered: {scanProgress.discoveredSongs ?? 0}</span>
                                    <span>Processed: {scanProgress.processedSongs ?? 0}</span>
                                    <span>Skipped: {scanProgress.skippedSongs ?? 0}</span>
                                    <span>Failed: {scanProgress.failedSongs ?? 0}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Active Tab Body */}
                    <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
                        {navState.collectionDetail ? (
                            renderCollectionDetailView(navState.collectionDetail)
                        ) : navState.activeTab === 'songs' ? (
                            localSongs.length === 0 ? (
                                renderEmptyLibraryState()
                            ) : (
                                <div className="flex min-h-0 flex-1 flex-col px-4">
                                    {/* Search & Sort Bar */}
                                    <div className="flex items-center gap-2 pb-2.5">
                                        <div className="relative flex-1">
                                            <Search
                                                size={15}
                                                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
                                            />
                                            <input
                                                type="search"
                                                value={searchQuery}
                                                onChange={(e) => {
                                                    setSearchQuery(e.target.value);
                                                    setVisibleSongLimit(MAX_RENDERED_SONGS_STEP);
                                                }}
                                                placeholder="Search songs, artists, albums, Arabic lyrics..."
                                                dir="auto"
                                                className="h-10 w-full rounded-2xl border border-white/10 bg-white/[0.06] pl-9 pr-8 text-xs text-white placeholder-zinc-500 focus:border-white/25 focus:outline-none"
                                            />
                                            {searchQuery && (
                                                <button
                                                    type="button"
                                                    onClick={() => setSearchQuery('')}
                                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400"
                                                    aria-label="Clear search"
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>

                                        <select
                                            aria-label="Sort songs"
                                            value={sortOrder}
                                            onChange={(e) => setSortOrder(e.target.value as MobileSongSortOrder)}
                                            className="h-10 rounded-2xl border border-white/10 bg-[#121218] px-3 text-xs font-medium text-zinc-200 focus:outline-none"
                                        >
                                            <option value="title">Title</option>
                                            <option value="artist">Artist</option>
                                            <option value="album">Album</option>
                                            <option value="recent">Recent</option>
                                        </select>
                                    </div>

                                    {/* Play All / Shuffle All Action Row */}
                                    <div className="flex items-center justify-between gap-2 pb-2">
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handlePlayAllSongs(filteredSongs, false)}
                                                className="flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold text-zinc-950 active:scale-95 transition-transform"
                                                style={{ backgroundColor: accentColor }}
                                            >
                                                <Play size={14} fill="currentColor" />
                                                Play All ({filteredSongs.length})
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handlePlayAllSongs(filteredSongs, true)}
                                                className="flex h-9 items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.06] px-3.5 text-xs font-medium text-zinc-200 active:scale-95 transition-transform"
                                            >
                                                <Shuffle size={13} />
                                                Shuffle
                                            </button>
                                        </div>
                                    </div>

                                    {/* Scrollable Windowed Song List, with the A-Z letter rail beside it */}
                                    <div className="relative flex min-h-0 flex-1 flex-col">
                                    <div
                                        ref={songsListScrollRef}
                                        data-testid="mobile-songs-scroll-container"
                                        onScroll={(e) => {
                                            const el = e.currentTarget;
                                            savedScrollOffsetsRef.current.songs = el.scrollTop;
                                            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 240) {
                                                if (visibleSongLimit < filteredSongs.length) {
                                                    setVisibleSongLimit(prev => prev + MAX_RENDERED_SONGS_STEP);
                                                }
                                            }
                                        }}
                                        className={`flex-1 overflow-y-auto overscroll-contain space-y-1 pb-4 ${titleLetterIndex && titleLetterIndex.letters.length > 1 ? 'pr-6' : ''}`}
                                    >
                                        {filteredSongs.slice(0, visibleSongLimit).map((song, idx) =>
                                            renderSongRow(song, filteredSongs, idx),
                                        )}
                                        {filteredSongs.length === 0 && (
                                            <div className="py-12 text-center text-xs text-zinc-500">
                                                No tracks matching "{searchQuery}"
                                            </div>
                                        )}
                                    </div>
                                    {titleLetterIndex && titleLetterIndex.letters.length > 1 && (
                                        <MobileLetterRail
                                            letters={titleLetterIndex.letters}
                                            accentColor={accentColor}
                                            onSelect={handleLetterJump}
                                        />
                                    )}
                                    </div>
                                </div>
                            )
                        ) : navState.activeTab === 'albums' ? (
                            <div className="flex min-h-0 flex-1 flex-col px-4">
                                {/* Segmented Albums / Artists Sub-Switcher + Quick Filter */}
                                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5">
                                    <div className="flex items-center gap-2">
                                        {([
                                            { id: 'albums' as const, label: `Albums (${collections.albums.length})`, icon: <Disc3 size={14} /> },
                                            { id: 'artists' as const, label: `Artists (${collections.artists.length})`, icon: <User size={14} /> },
                                        ]).map(sub => {
                                            const active = navState.albumsSubTab === sub.id;
                                            return (
                                                <button
                                                    key={sub.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setVisibleAlbumLimit(60);
                                                        setNavState(prev => ({ ...prev, albumsSubTab: sub.id }));
                                                    }}
                                                    className={`flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold transition-all ${
                                                        active
                                                            ? 'bg-white text-zinc-950 shadow-sm'
                                                            : 'border border-white/10 bg-white/[0.05] text-zinc-300'
                                                    }`}
                                                >
                                                    {sub.icon}
                                                    <span>{sub.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {localSongs.length > 0 && (
                                    <div className="relative mb-3 shrink-0">
                                        <Search
                                            size={15}
                                            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
                                        />
                                        <input
                                            type="search"
                                            value={albumsSearchQuery}
                                            onChange={(e) => {
                                                setAlbumsSearchQuery(e.target.value);
                                                setVisibleAlbumLimit(60);
                                            }}
                                            placeholder={navState.albumsSubTab === 'albums' ? 'Search albums or artists...' : 'Search artists...'}
                                            dir="auto"
                                            className="h-9 w-full rounded-2xl border border-white/10 bg-white/[0.06] pl-9 pr-8 text-xs text-white placeholder-zinc-500 focus:border-white/25 focus:outline-none"
                                        />
                                        {albumsSearchQuery && (
                                            <button
                                                type="button"
                                                onClick={() => setAlbumsSearchQuery('')}
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400"
                                                aria-label="Clear album search"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                )}

                                {localSongs.length === 0 ? (
                                    renderEmptyLibraryState()
                                ) : (
                                    <div
                                        ref={albumsGridScrollRef}
                                        data-testid="mobile-albums-scroll-container"
                                        onScroll={(e) => {
                                            const el = e.currentTarget;
                                            savedScrollOffsetsRef.current[`albums:${navState.albumsSubTab}`] = el.scrollTop;
                                            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 320) {
                                                const activeList = navState.albumsSubTab === 'albums' ? collections.albums : collections.artists;
                                                if (visibleAlbumLimit < activeList.length) {
                                                    setVisibleAlbumLimit(prev => prev + 60);
                                                }
                                            }
                                        }}
                                        className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6"
                                    >
                                        {(() => {
                                            const rawList = navState.albumsSubTab === 'albums' ? collections.albums : collections.artists;
                                            const q = albumsSearchQuery.trim().toLowerCase();
                                            const filteredList = q
                                                ? rawList.filter(item =>
                                                    item.title.toLowerCase().includes(q)
                                                    || (item.subtitle && item.subtitle.toLowerCase().includes(q)),
                                                )
                                                : rawList;
                                            return (
                                                <div className="grid grid-cols-2 sm:grid-cols-3 landscape:grid-cols-4 auto-rows-max items-start content-start gap-3.5">
                                                    {filteredList.slice(0, visibleAlbumLimit).map(item => (
                                                        <button
                                                            key={item.id}
                                                            type="button"
                                                            onClick={() => handleOpenCollection(item)}
                                                            className="group flex w-full flex-col rounded-2xl border border-white/10 bg-white/[0.05] p-2.5 text-left active:scale-[0.98] transition-all hover:bg-white/[0.08]"
                                                        >
                                                            <div
                                                                className="relative w-full shrink-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-md"
                                                                style={{ aspectRatio: '1 / 1' }}
                                                            >
                                                                <LocalCoverThumbnail
                                                                    coverUrl={item.coverUrl ?? null}
                                                                    fallbackSong={item.songs[0]}
                                                                    alt={item.title}
                                                                    fallback={
                                                                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800/80 to-zinc-950 text-zinc-500">
                                                                            {item.kind === 'artist' ? <User size={38} /> : <Disc3 size={38} />}
                                                                        </div>
                                                                    }
                                                                />
                                                                <div className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-zinc-200 backdrop-blur-md">
                                                                    {item.songs.length} {item.songs.length === 1 ? 'track' : 'tracks'}
                                                                </div>
                                                            </div>
                                                            <div
                                                                dir={detectTextDirection(item.title)}
                                                                className="mt-2.5 w-full truncate text-[13px] font-semibold text-zinc-100 leading-snug"
                                                                style={{ unicodeBidi: 'plaintext' }}
                                                            >
                                                                {item.title}
                                                            </div>
                                                            {item.kind === 'album' && item.subtitle ? (
                                                                <div
                                                                    dir={detectTextDirection(item.subtitle)}
                                                                    className="mt-0.5 w-full truncate text-[11px] text-zinc-400"
                                                                    style={{ unicodeBidi: 'plaintext' }}
                                                                >
                                                                    {item.subtitle}
                                                                </div>
                                                            ) : (
                                                                <div className="mt-0.5 w-full truncate text-[11px] text-zinc-400">
                                                                    {item.songs.length} {item.songs.length === 1 ? 'track' : 'tracks'}
                                                                </div>
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>
                        ) : navState.activeTab === 'folders' ? (
                            <div className="flex min-h-0 flex-1 flex-col px-4">
                                {/* Segmented Folders / Local Playlists Sub-Switcher */}
                                <div className="flex items-center justify-between gap-2 pb-3">
                                    <div className="flex items-center gap-2">
                                        {([
                                            { id: 'folders' as const, label: `Folders (${collections.folders.length})`, icon: <FolderOpen size={14} /> },
                                            { id: 'playlists' as const, label: `Playlists (${collections.playlists.length})`, icon: <ListMusic size={14} /> },
                                        ]).map(sub => {
                                            const active = navState.foldersSubTab === sub.id;
                                            return (
                                                <button
                                                    key={sub.id}
                                                    type="button"
                                                    onClick={() => setNavState(prev => ({ ...prev, foldersSubTab: sub.id }))}
                                                    className={`flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold transition-all ${
                                                        active
                                                            ? 'bg-white text-zinc-950'
                                                            : 'border border-white/10 bg-white/[0.05] text-zinc-300'
                                                    }`}
                                                >
                                                    {sub.icon}
                                                    <span>{sub.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {navState.foldersSubTab === 'playlists' && (
                                        <button
                                            type="button"
                                            onClick={() => playlistInputRef.current?.click()}
                                            className="flex h-9 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 text-xs font-medium text-zinc-200"
                                        >
                                            <FileUp size={13} />
                                            Import .M3U
                                        </button>
                                    )}
                                </div>

                                {localSongs.length === 0 && navState.foldersSubTab === 'folders' ? (
                                    renderEmptyLibraryState()
                                ) : (
                                    <div
                                        ref={foldersListScrollRef}
                                        onScroll={(e) => {
                                            savedScrollOffsetsRef.current[`folders:${navState.foldersSubTab}`] = e.currentTarget.scrollTop;
                                        }}
                                        className="flex-1 overflow-y-auto overscroll-contain space-y-2 pb-6"
                                    >
                                        {(navState.foldersSubTab === 'folders' ? collections.folders : collections.playlists).map(item => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => handleOpenCollection(item)}
                                                className="flex w-full items-center gap-3.5 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left active:scale-[0.99] transition-transform"
                                            >
                                                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-900 text-zinc-300">
                                                    <LocalCoverThumbnail
                                                        coverUrl={item.coverUrl ?? null}
                                                        fallbackSong={item.songs[0]}
                                                        alt={item.title}
                                                        fallback={
                                                            item.kind === 'folder' ? (
                                                                <FolderOpen size={22} style={{ color: accentColor }} />
                                                            ) : (
                                                                <Heart size={22} className="text-rose-400" />
                                                            )
                                                        }
                                                    />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div
                                                        dir={detectTextDirection(item.title)}
                                                        className="truncate text-sm font-semibold text-white"
                                                        style={{ unicodeBidi: 'plaintext' }}
                                                    >
                                                        {item.title}
                                                    </div>
                                                    <div className="text-xs text-zinc-400 mt-0.5">
                                                        {item.songs.length} {item.songs.length === 1 ? 'track' : 'tracks'}
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : navState.activeTab === 'online' ? (
                            <MobileOnlineHub
                                accentColor={accentColor}
                                activeSubTab={navState.onlineSubTab ?? 'discover'}
                                onChangeSubTab={(sub) => setNavState(prev => ({ ...prev, onlineSubTab: sub }))}
                                onPlayOnlineSong={(song, queue) => onPlayOnlineSong?.(song, queue)}
                                onAddOnlineSongToQueue={(song) => onAddOnlineSongToQueue?.(song)}
                                onPlayNavidromeSong={(song, queue) => onPlayNavidromeSong?.(song, queue)}
                                onAddNavidromeSongsToQueue={(songs) => onAddNavidromeSongsToQueue?.(songs)}
                                onOpenFullSearchWorkspace={onOpenFullSearchWorkspace}
                            />
                        ) : (
                            /* Settings Tab: Mobile-First Local Library, Display & Immersive Mode, Dynamic Album Artwork, Visualizer, Equalizer, and Audio Settings */
                            <div
                                data-testid="mobile-settings-view"
                                className="flex-1 overflow-y-auto overscroll-contain px-4 pb-8 space-y-5"
                            >
                                {/* Section 1: Display and Immersive Mode (System Bar Visibility & Dynamic Album Artwork) */}
                                <section
                                    data-testid="mobile-settings-display-immersive-card"
                                    className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 space-y-3.5"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <h3 className="text-sm font-bold text-white">
                                                {t('options.displayAndImmersiveMode', 'Display and Immersive Mode')}
                                            </h3>
                                            <p className="text-xs text-zinc-400">
                                                Dynamic album artwork & native Android edge-to-edge system bar controls
                                            </p>
                                        </div>
                                        <Maximize2 size={18} style={{ color: accentColor }} />
                                    </div>

                                    <div className="space-y-2.5">
                                        {/* Switch 0a: Full-Screen Local Album Video Covers */}
                                        <div
                                            data-testid="mobile-settings-album-video-row"
                                            className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5"
                                        >
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                                                    <Film size={13} style={{ color: accentColor }} />
                                                    <span>{t('options.albumVideoCovers', 'Full-Screen Local Album Video Covers')}</span>
                                                </div>
                                                <p className="text-[11px] text-zinc-400">
                                                    Play matching local album videos as an immersive full-screen player background ({albumVideoCount} indexed)
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                role="switch"
                                                data-testid="switch-album-video-covers"
                                                aria-label="Full-Screen Local Album Video Covers"
                                                aria-checked={albumVideoEnabled}
                                                onClick={() => setAlbumVideoEnabled(!albumVideoEnabled)}
                                                className={`h-8 shrink-0 rounded-full border px-3.5 text-xs font-semibold transition-all ${
                                                    albumVideoEnabled
                                                        ? 'border-white bg-white text-zinc-950'
                                                        : 'border-white/15 bg-white/[0.06] text-zinc-300'
                                                }`}
                                            >
                                                {albumVideoEnabled ? 'On' : 'Off'}
                                            </button>
                                        </div>

                                        {/* Switch 0: Dynamic Album Artwork (On/Off + Low/Normal Motion Intensity) */}
                                        <div
                                            data-testid="mobile-settings-dynamic-artwork-row"
                                            className="rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 space-y-2"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="text-xs font-semibold text-white">
                                                        {t('options.dynamicAlbumArtwork', 'Dynamic Album Artwork')}
                                                    </div>
                                                    <p className="text-[11px] text-zinc-400">
                                                        Subtle camera drift, layered parallax & feathered lower-edge blend on the Cover screen
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    role="switch"
                                                    data-testid="switch-dynamic-album-artwork"
                                                    aria-label="Dynamic Album Artwork"
                                                    aria-checked={dynamicArtworkEnabled}
                                                    onClick={() => setDynamicArtworkEnabled(!dynamicArtworkEnabled)}
                                                    className={`h-8 shrink-0 rounded-full border px-3.5 text-xs font-semibold transition-all ${
                                                        dynamicArtworkEnabled
                                                            ? 'border-white bg-white text-zinc-950'
                                                            : 'border-white/15 bg-white/[0.06] text-zinc-300'
                                                    }`}
                                                >
                                                    {dynamicArtworkEnabled ? 'On' : 'Off'}
                                                </button>
                                            </div>
                                            {dynamicArtworkEnabled && (
                                                <div className="flex items-center justify-between border-t border-white/[0.06] pt-2">
                                                    <span className="text-[11px] font-medium text-zinc-300">
                                                        Motion Intensity
                                                    </span>
                                                    <div className="flex items-center gap-1.5">
                                                        {(['low', 'normal'] as const).map(level => (
                                                            <button
                                                                key={level}
                                                                type="button"
                                                                data-testid={`dynamic-artwork-intensity-${level}`}
                                                                onClick={() => setDynamicArtworkIntensity(level)}
                                                                className={`h-7 rounded-lg border px-2.5 text-[11px] font-medium capitalize transition-all ${
                                                                    dynamicArtworkIntensity === level
                                                                        ? 'border-white bg-white text-zinc-950 font-semibold'
                                                                        : 'border-white/10 bg-white/[0.04] text-zinc-300'
                                                                }`}
                                                            >
                                                                {level}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Switch 1: Hide status bar */}
                                        <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5">
                                            <div className="min-w-0">
                                                <div className="text-xs font-semibold text-white">
                                                    {t('options.hideStatusBar', 'Hide status bar')}
                                                </div>
                                                <p className="text-[11px] text-zinc-400">
                                                    Hide the top Android status bar across the app
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                role="switch"
                                                data-testid="switch-hide-status-bar"
                                                aria-label="Hide status bar"
                                                aria-checked={hideStatusBar}
                                                onClick={() => setHideStatusBar(!hideStatusBar)}
                                                className={`h-8 shrink-0 rounded-full border px-3.5 text-xs font-semibold transition-all ${
                                                    hideStatusBar
                                                        ? 'border-white bg-white text-zinc-950'
                                                        : 'border-white/15 bg-white/[0.06] text-zinc-300'
                                                }`}
                                            >
                                                {hideStatusBar ? 'On' : 'Off'}
                                            </button>
                                        </div>

                                        {/* Switch 2: Hide navigation bar */}
                                        <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5">
                                            <div className="min-w-0">
                                                <div className="text-xs font-semibold text-white">
                                                    {t('options.hideNavigationBar', 'Hide navigation bar')}
                                                </div>
                                                <p className="text-[11px] text-zinc-400">
                                                    Hide the bottom Android navigation bar across the app
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                role="switch"
                                                data-testid="switch-hide-navigation-bar"
                                                aria-label="Hide navigation bar"
                                                aria-checked={hideNavigationBar}
                                                onClick={() => setHideNavigationBar(!hideNavigationBar)}
                                                className={`h-8 shrink-0 rounded-full border px-3.5 text-xs font-semibold transition-all ${
                                                    hideNavigationBar
                                                        ? 'border-white bg-white text-zinc-950'
                                                        : 'border-white/15 bg-white/[0.06] text-zinc-300'
                                                }`}
                                            >
                                                {hideNavigationBar ? 'On' : 'Off'}
                                            </button>
                                        </div>

                                        {/* Switch 3: Full-screen lyrics mode */}
                                        <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5">
                                            <div className="min-w-0">
                                                <div className="text-xs font-semibold text-white">
                                                    {t('options.fullScreenLyricsMode', 'Full-screen lyrics mode')}
                                                </div>
                                                <p className="text-[11px] text-zinc-400">
                                                    Hide both status and navigation bars together in Lyrics & Visualizer views, and restore when leaving
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                role="switch"
                                                data-testid="switch-fullscreen-lyrics-mode"
                                                aria-label="Full-screen lyrics mode"
                                                aria-checked={fullScreenLyricsMode}
                                                onClick={() => setFullScreenLyricsMode(!fullScreenLyricsMode)}
                                                className={`h-8 shrink-0 rounded-full border px-3.5 text-xs font-semibold transition-all ${
                                                    fullScreenLyricsMode
                                                        ? 'border-white bg-white text-zinc-950'
                                                        : 'border-white/15 bg-white/[0.06] text-zinc-300'
                                                }`}
                                            >
                                                {fullScreenLyricsMode ? 'On' : 'Off'}
                                            </button>
                                        </div>
                                    </div>
                                </section>

                                {/* Section 2: Local Music & Album Video Storage (SAF) */}
                                <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-sm font-bold text-white">Local Music & Album Videos</h3>
                                            <p className="text-xs text-zinc-400">
                                                {localSongs.length} tracks · {collections.albums.length} albums · {albumVideoCount} album videos
                                            </p>
                                        </div>
                                        <FolderOpen size={20} style={{ color: accentColor }} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2.5">
                                        <button
                                            type="button"
                                            disabled={isImportingOrScanning}
                                            onClick={() => void onImportFolder()}
                                            className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-white text-xs font-semibold text-zinc-950"
                                        >
                                            <FolderOpen size={15} />
                                            Add Music Folder
                                        </button>
                                        <button
                                            type="button"
                                            disabled={isImportingOrScanning}
                                            onClick={() => void onRefreshFolders()}
                                            className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] text-xs font-semibold text-white"
                                        >
                                            <RefreshCw size={15} className={isImportingOrScanning ? 'animate-spin' : ''} />
                                            Rescan Music
                                        </button>
                                        <button
                                            type="button"
                                            data-testid="mobile-settings-add-video-folder-btn"
                                            disabled={isImportingOrScanning}
                                            onClick={() => void importAlbumVideoFolder()}
                                            className="flex h-10 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] text-xs font-semibold text-zinc-100"
                                        >
                                            <Film size={14} style={{ color: accentColor }} />
                                            Add Video Folder
                                        </button>
                                        <button
                                            type="button"
                                            data-testid="mobile-settings-refresh-videos-btn"
                                            disabled={isImportingOrScanning}
                                            onClick={() => void resyncAlbumVideoFolders()}
                                            className="flex h-10 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] text-xs font-semibold text-zinc-100"
                                        >
                                            <RefreshCw size={14} />
                                            Refresh Videos
                                        </button>
                                    </div>
                                </section>

                                {/* Section 3: Folia Lyric Visualizer & Appearance */}
                                <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 space-y-3.5">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-sm font-bold text-white">Folia Visualizer & Lyrics</h3>
                                            <p className="text-xs text-zinc-400">
                                                Active style: {getVisualizerModeLabel(visualizerMode, t)}
                                            </p>
                                        </div>
                                        <Sparkles size={19} style={{ color: accentColor }} />
                                    </div>

                                    <div className="grid grid-cols-3 sm:grid-cols-4 landscape:grid-cols-5 gap-2">
                                        {VISUALIZER_REGISTRY.map(entry => {
                                            const active = visualizerMode === entry.mode;
                                            return (
                                                <button
                                                    key={entry.mode}
                                                    type="button"
                                                    onClick={() => onVisualizerModeChange(entry.mode)}
                                                    className={`min-h-[38px] rounded-xl border px-2.5 py-2 text-xs font-medium truncate ${
                                                        active
                                                            ? 'border-white bg-white text-zinc-950 font-semibold'
                                                            : 'border-white/10 bg-white/[0.03] text-zinc-300'
                                                    }`}
                                                >
                                                    {getVisualizerModeLabel(entry.mode, t)}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="flex items-center justify-between pt-1">
                                        <span className="text-xs text-zinc-300">Theme Surface</span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={onToggleDaylight}
                                                className="flex h-9 items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-xs font-medium text-zinc-200"
                                            >
                                                {isDaylight ? <Sun size={14} /> : <Moon size={14} />}
                                                <span>{isDaylight ? 'Daylight' : 'OLED Dark'}</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => onToggleCoverColorBg(!useCoverColorBg)}
                                                className={`h-9 rounded-xl border px-3 text-xs font-medium ${
                                                    useCoverColorBg
                                                        ? 'border-white bg-white/15 text-white'
                                                        : 'border-white/10 bg-white/[0.04] text-zinc-400'
                                                }`}
                                            >
                                                Artwork Tint: {useCoverColorBg ? 'On' : 'Off'}
                                            </button>
                                        </div>
                                    </div>
                                </section>

                                {/* Performance self-test and track-change timing log */}
                                <MobilePerformanceCard accentColor={accentColor} />
                                <MobilePlaybackTimingCard accentColor={accentColor} />
                                <MobileVideoExportCheckCard accentColor={accentColor} />

                                {/* Section 4: Real 10-Band Audio Equalizer & Effects */}
                                <section
                                    data-testid="mobile-settings-equalizer-card"
                                    className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 space-y-3"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <h3 className="text-sm font-bold text-white">Audio Equalizer & Effects</h3>
                                            <p className="text-xs text-zinc-400">
                                                {equalizerSettings.enabled ? 'Processing On' : 'Processing Off'} · Preset: {AUDIO_EQUALIZER_PRESET_LABELS[equalizerSettings.preset] ?? equalizerSettings.preset}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={equalizerSettings.enabled}
                                            onClick={() => setEqualizerSettings({ ...equalizerSettings, enabled: !equalizerSettings.enabled })}
                                            className={`h-9 rounded-full border px-3.5 text-xs font-semibold transition-all ${
                                                equalizerSettings.enabled
                                                    ? 'border-white bg-white text-zinc-950'
                                                    : 'border-white/15 bg-white/[0.06] text-zinc-300'
                                            }`}
                                        >
                                            {equalizerSettings.enabled ? 'EQ On' : 'EQ Off'}
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2.5">
                                        <button
                                            type="button"
                                            data-testid="mobile-settings-open-eq-btn"
                                            onClick={() => setIsShellEqualizerOpen(true)}
                                            className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-white text-xs font-semibold text-zinc-950 active:scale-95"
                                        >
                                            <Sliders size={15} />
                                            <span>Open Equalizer</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={openDesktopEqualizer}
                                            className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] text-xs font-semibold text-white active:scale-95"
                                        >
                                            <Sparkles size={15} style={{ color: accentColor }} />
                                            <span>Studio EQ Dialog</span>
                                        </button>
                                    </div>
                                </section>

                                {/* Section 5: Online Services, Accounts & Navidrome */}
                                <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-sm font-bold text-white">Online Music, Accounts & Navidrome</h3>
                                            <p className="text-xs text-zinc-400">
                                                Playlists, discovery, online lyrics & self-hosted streaming
                                            </p>
                                        </div>
                                        <Globe size={18} style={{ color: accentColor }} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setNavState(prev => ({ ...prev, activeTab: 'online', onlineSubTab: 'discover' }))}
                                            className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.06] text-xs font-medium text-zinc-100"
                                        >
                                            <Globe size={14} />
                                            <span>Online & Playlists</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setNavState(prev => ({ ...prev, activeTab: 'online', onlineSubTab: 'navidrome' }))}
                                            className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.06] text-xs font-medium text-zinc-100"
                                        >
                                            <span>Navidrome Server</span>
                                        </button>
                                    </div>
                                </section>

                                {/* Section 6: Audio & ReplayGain */}
                                <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
                                    <h3 className="text-sm font-bold text-white">Audio & Playback</h3>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-zinc-300">ReplayGain Normalization</span>
                                        <div className="flex items-center gap-1.5">
                                            {(['off', 'track', 'album'] as const).map(mode => (
                                                <button
                                                    key={mode}
                                                    type="button"
                                                    onClick={() => onChangeReplayGainMode(mode)}
                                                    className={`h-8 rounded-lg border px-2.5 text-xs font-medium capitalize ${
                                                        replayGainMode === mode
                                                            ? 'border-white bg-white text-zinc-950 font-semibold'
                                                            : 'border-white/10 bg-white/[0.04] text-zinc-300'
                                                    }`}
                                                >
                                                    {mode}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </section>

                                {/* Section 7: Advanced Folia Settings & Custom Tunings */}
                                <button
                                    type="button"
                                    onClick={onOpenFullSettingsModal}
                                    className="flex h-12 w-full items-center justify-between rounded-2xl border border-white/12 bg-white/[0.05] px-4 text-xs font-semibold text-zinc-200 active:scale-[0.99]"
                                >
                                    <span className="flex items-center gap-2.5">
                                        <Sliders size={16} style={{ color: accentColor }} />
                                        Open Full Folia Visualizer & Advanced Settings
                                    </span>
                                    <span className="text-zinc-400">→</span>
                                </button>
                            </div>
                        )}
                    </main>

                    {/* Persistent Mini-Player (when collapsed and a track is loaded) */}
                    {currentSong && (
                        <MobileMiniPlayer
                            currentSong={currentSong}
                            artistName={artistName}
                            coverUrl={effectiveCoverUrl}
                            playerState={playerState}
                            currentTime={currentTime}
                            duration={duration}
                            theme={theme}
                            hasLyrics={hasLyrics}
                            onExpandCover={() =>
                                setNavState(prev => ({
                                    ...prev,
                                    playerSheet: 'expanded',
                                    playerDisplayMode: 'cover',
                                }))
                            }
                            onExpandLyrics={() =>
                                setNavState(prev => ({
                                    ...prev,
                                    playerSheet: 'expanded',
                                    playerDisplayMode: 'lyrics',
                                }))
                            }
                            onTogglePlay={onTogglePlay}
                            onNextTrack={onNextTrack}
                        />
                    )}

                    {/* Bottom Primary Navigation Bar (hidden when soft keyboard is open) */}
                    {!isKeyboardOpen && (
                        <nav
                            aria-label="Primary mobile navigation"
                            className="flex shrink-0 items-center justify-around border-t border-white/10 bg-[#08080c]/95 px-2 pt-1.5"
                            style={{
                                paddingBottom: bottomNavSafePadding,
                            }}
                        >
                            {([
                                { id: 'songs' as const, label: 'Library', icon: Library },
                                { id: 'albums' as const, label: 'Albums', icon: Disc3 },
                                { id: 'folders' as const, label: 'Folders', icon: FolderOpen },
                                { id: 'online' as const, label: 'Online', icon: Globe },
                                { id: 'settings' as const, label: 'Settings', icon: Settings },
                            ]).map(item => {
                                const Icon = item.icon;
                                const active = navState.activeTab === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => handleSelectTab(item.id)}
                                        className={`flex min-h-[48px] flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1 text-[11px] font-medium transition-colors ${
                                            active ? 'text-white font-semibold' : 'text-zinc-500 hover:text-zinc-300'
                                        }`}
                                    >
                                        <Icon size={20} style={{ color: active ? accentColor : undefined }} />
                                        <span>{item.label}</span>
                                    </button>
                                );
                            })}
                        </nav>
                    )}
            </div>

            {/* Expanded Full-Screen Now Playing Sheet */}
            <MobileNowPlayingSheet
                isOpen={isPlayerExpanded}
                displayMode={navState.playerDisplayMode}
                subDrawer={navState.subDrawer}
                onChangeDisplayMode={(mode) => setNavState(prev => ({ ...prev, playerDisplayMode: mode }))}
                onChangeSubDrawer={(drawer) => setNavState(prev => ({ ...prev, subDrawer: drawer }))}
                onClose={() => setNavState(prev => ({ ...prev, playerSheet: 'collapsed', subDrawer: 'none' }))}
                currentSong={currentSong}
                artistName={artistName}
                albumName={albumName || matchedPlayingLocalSong?.importedMetadata?.albumName || ''}
                localAlbumName={matchedPlayingLocalSong?.importedMetadata?.albumName}
                folderName={matchedPlayingLocalSong?.folderName}
                coverUrl={effectiveCoverUrl}
                playerState={playerState}
                currentTime={currentTime}
                lyricCurrentTime={lyricCurrentTime}
                duration={duration}
                lyrics={lyrics}
                currentLineIndex={currentLineIndex}
                isLyricsLoading={isLyricsLoading}
                isLiked={isLiked}
                loopMode={loopMode}
                theme={theme}
                visualizerMode={visualizerMode}
                onVisualizerModeChange={onVisualizerModeChange}
                lyricsFontScale={lyricsFontScale}
                onLyricsFontScaleChange={onLyricsFontScaleChange}
                showSubtitleTranslation={showSubtitleTranslation}
                onToggleSubtitleTranslation={onToggleSubtitleTranslation}
                lyricTimelineOffsetMs={lyricTimelineOffsetMs}
                onLyricTimelineOffsetChange={onLyricTimelineOffsetChange}
                activeLocalLyricsSource={activeLocalLyricsSource}
                onChangeLyricsSource={onChangeLyricsSource}
                onImportLocalLyricsFile={onImportLocalLyricsFile}
                onOpenLyricMatch={onOpenLyricMatch}
                onAutoMatchLyrics={onAutoMatchLyrics}
                onTogglePureMusic={onTogglePureMusic}
                onSeek={onSeek}
                onLyricLineSeek={onLyricLineSeek}
                onTogglePlay={onTogglePlay}
                onPrevTrack={onPrevTrack}
                onNextTrack={onNextTrack}
                onToggleLoop={onToggleLoop}
                onToggleLike={onToggleLike}
                onShuffleQueue={onShuffleQueue}
                playQueue={playQueue}
                onPlayQueueSong={onPlayQueueSong}
                onRemoveQueueSong={onRemoveQueueSong}
                onSaveQueueAsPlaylist={onSaveQueueAsPlaylist}
                onOpenVisualizerSettings={onOpenFullSettingsModal}
                onOpenLattice={onOpenLattice}
            />

            {isShellEqualizerOpen && (
                <div
                    className="fixed inset-0 z-[230] flex flex-col justify-end bg-black/65"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setIsShellEqualizerOpen(false);
                    }}
                >
                    <MobileEqualizerSheet
                        accentColor={accentColor}
                        onClose={() => setIsShellEqualizerOpen(false)}
                        onOpenFullDesktopEqualizer={() => {
                            setIsShellEqualizerOpen(false);
                            openDesktopEqualizer();
                        }}
                    />
                </div>
            )}
        </div>
    );
};

export default React.memo(MobilePlayerShell);
export { buildLocalQueue };
