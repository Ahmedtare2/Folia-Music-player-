import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MotionValue, useMotionValueEvent } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
    ChevronDown,
    Disc3,
    Film,
    FileText,
    FileUp,
    Grid,
    Heart,
    ListMusic,
    Maximize2,
    Music2,
    Pause,
    Play,
    Repeat,
    Repeat1,
    Search,
    Shuffle,
    SkipBack,
    SkipForward,
    Sliders,
    SlidersHorizontal,
    Sparkles,
    Trash2,
    Wand2,
    X,
} from 'lucide-react';
import {
    type LyricData,
    type LyricLine,
    type LyricProviderSource,
    PlayerState,
    type SongResult,
    type Theme,
    type VisualizerMode,
} from '../../types';
import { useLyricSettingsStore } from '../../stores/useLyricSettingsStore';
import { LYRIC_SOURCES } from '../../utils/lyrics/lyricSources';
import { detectTextDirection, resolveTokenDirection, type TextDirection } from '../../utils/lyrics/arabicText';
import type { Word as WordType } from '../../types';
import { getCachedLocalCoverObjectUrl, resolveLocalCoverObjectUrl } from '../../services/localCoverRuntime';
import { isLocalCoverAssetUrl } from '../../services/localCoverAssetUrl';
import { VISUALIZER_REGISTRY, getVisualizerModeLabel } from '../visualizer/registry';
import {
    DEFAULT_VISUALIZER_BACKGROUND_MODE,
    VISUALIZER_BACKGROUND_REGISTRY,
    getVisualizerBackgroundModeLabel,
} from '../visualizer/backgrounds/registry';
import { useAudioSettingsStore } from '../../stores/useAudioSettingsStore';
import { useVisualizerSettingsStore } from '../../stores/useVisualizerSettingsStore';
import { useThemeSettingsStore } from '../../stores/useThemeSettingsStore';
import { useDynamicAlbumArtworkStore } from '../../stores/useDynamicAlbumArtworkStore';
import {
    ANDROID_VISIBILITY_EVENT,
    buildAndroidVisualizerPalette,
    getAndroidDisplayRefreshRate,
    getCachedAndroidTrackPalette,
    getCurrentDisplayRefreshRateHz,
    hasAndroidNativeVisualizerBridge,
    setAndroidNativeVisualizerEnergy,
    setAndroidNativeVisualizerPalette,
    setAndroidNativeVisualizerState,
    subscribeAndroidDisplayRefreshRate,
} from '../../services/android/foliaAndroidBridge';
import {
    detectPrefersReducedMotion,
    resolveAlbumVideoStageState,
} from '../../utils/dynamicAlbumArtwork';
import {
    LOCAL_ALBUM_VIDEOS_UPDATED_EVENT,
    type LocalAlbumVideoEntry,
    assignVideoToAlbum,
    getRegisteredAlbumVideos,
    importAlbumVideoFolder,
    registerStandaloneAlbumVideoFile,
    resetAlbumVideoAssociation,
    resolveAlbumVideoForTrack,
    scoreAlbumVideoCandidates,
} from '../../services/localAlbumVideoService';
import { useSystemBarSettingsStore } from '../../stores/useSystemBarSettingsStore';
import { useShallow } from 'zustand/react/shallow';
import DynamicAlbumCoverStage from './DynamicAlbumCoverStage';
import MobileEqualizerSheet from './MobileEqualizerSheet';
import type { MobilePlayerDisplayMode, MobileSubDrawer } from './mobileNavigationModel';

// src/components/mobile/MobileNowPlayingSheet.tsx
// Full-screen Now Playing sheet for the Phase 4 mobile-first Android player.
// Supports 3 seamless modes:
//   - 'cover': Apple Music-inspired Dynamic Album Cover stage + artwork-tinted OLED lighting + cohesive progress bar & 2-line live lyric preview
//   - 'lyrics': Synchronized scrolling lyrics reader with live background visualizer, full Arabic RTL shaping + word/syllable glow sweep
//   - 'stage': Full-screen Folia visualizer canvas with tap-to-hide chrome & quick style switcher

export const computeTimedWordProgressPercent = (word: WordType, timeSec: number): number => {
    if (timeSec <= word.startTime) return 0;
    if (timeSec >= word.endTime) return 100;

    const syllables = word.syllables;
    if (syllables && syllables.length > 1) {
        const totalChars = syllables.reduce((sum, s) => sum + Math.max(1, Array.from(s.text || '').length), 0);
        if (totalChars > 0) {
            let charAccumulator = 0;
            for (const syl of syllables) {
                const sylChars = Math.max(1, Array.from(syl.text || '').length);
                const startFrac = charAccumulator / totalChars;
                const endFrac = (charAccumulator + sylChars) / totalChars;
                if (timeSec <= syl.startTime) {
                    return Math.max(0, Math.min(100, startFrac * 100));
                }
                if (timeSec < syl.endTime) {
                    const sylDur = Math.max(0.01, syl.endTime - syl.startTime);
                    const localProgress = Math.max(0, Math.min(1, (timeSec - syl.startTime) / sylDur));
                    return Math.max(0, Math.min(100, (startFrac + localProgress * (endFrac - startFrac)) * 100));
                }
                charAccumulator += sylChars;
            }
            return 100;
        }
    }

    const dur = Math.max(0.05, word.endTime - word.startTime);
    return Math.max(0, Math.min(100, ((timeSec - word.startTime) / dur) * 100));
};

export const computeActiveLyricLineIndices = (
    lines: LyricLine[],
    primaryLineIndex: number,
    timeSec: number,
): Set<number> => {
    const active = new Set<number>();
    if (primaryLineIndex >= 0 && primaryLineIndex < lines.length) {
        active.add(primaryLineIndex);
    }
    if (!Number.isFinite(timeSec) || lines.length === 0) {
        return active;
    }
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        const lineEnd = line.renderHints?.renderEndTime ?? line.endTime;
        if (timeSec >= line.startTime && timeSec <= lineEnd) {
            active.add(i);
        }
    }
    return active;
};

interface MobileNowPlayingSheetProps {
    isOpen: boolean;
    displayMode: MobilePlayerDisplayMode;
    subDrawer: MobileSubDrawer;
    onChangeDisplayMode: (mode: MobilePlayerDisplayMode) => void;
    onChangeSubDrawer: (drawer: MobileSubDrawer) => void;
    onClose: () => void;
    currentSong: SongResult | null;
    artistName: string;
    albumName: string;
    localAlbumName?: string;
    folderName?: string;
    coverUrl: string | null;
    albumVideoUrl?: string | null;
    albumVideoId?: string | null;
    playerState: PlayerState;
    currentTime: MotionValue<number>;
    lyricCurrentTime: MotionValue<number>;
    duration: number;
    lyrics: LyricData | null;
    currentLineIndex: number;
    isLyricsLoading: boolean;
    isLiked: boolean;
    loopMode: 'off' | 'all' | 'one';
    theme: Theme;
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
    onSeek: (timeSec: number) => void;
    onLyricLineSeek: (timeSec: number) => void;
    onTogglePlay: () => void;
    onPrevTrack: () => void;
    onNextTrack: () => void;
    onToggleLoop: () => void;
    onToggleLike: () => void;
    onShuffleQueue: () => void;
    playQueue: SongResult[];
    onPlayQueueSong: (song: SongResult, queue: SongResult[]) => void;
    onRemoveQueueSong: (index: number) => void;
    onSaveQueueAsPlaylist: (name: string) => Promise<void>;
    onOpenVisualizerSettings: () => void;
    onOpenLattice?: () => void;
}

const formatSeconds = (sec: number): string => {
    if (!Number.isFinite(sec) || sec < 0) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

interface VisualizerStyleSelectorStripProps {
    visualizerMode: VisualizerMode;
    accentColor: string;
    onSelectMode: (mode: VisualizerMode) => void;
    onOpenAllStyles: () => void;
    compact?: boolean;
}

/**
 * Touch-safe, horizontally scrollable visualizer style selector bar that fits both portrait and
 * narrow/short landscape layouts (`min-w-0 max-w-full overflow-x-auto touch-pan-x`).
 * Stops touch/pointer propagation so swiping or tapping the strip never seeks lyrics or hides chrome.
 */
const VisualizerStyleSelectorStrip: React.FC<VisualizerStyleSelectorStripProps> = React.memo(({
    visualizerMode,
    accentColor,
    onSelectMode,
    onOpenAllStyles,
    compact = false,
}) => {
    const { t } = useTranslation();
    const stripRef = useRef<HTMLDivElement>(null);

    const scrollActiveIntoView = useCallback(() => {
        const container = stripRef.current;
        if (!container) return;
        const activeBtn = container.querySelector<HTMLElement>(`[data-visualizer-mode="${visualizerMode}"]`);
        if (activeBtn && typeof activeBtn.scrollIntoView === 'function') {
            try {
                activeBtn.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
            } catch {
                // Ignore in non-DOM test environments
            }
        }
    }, [visualizerMode]);

    useEffect(() => {
        scrollActiveIntoView();
    }, [scrollActiveIntoView]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const handleResize = () => scrollActiveIntoView();
        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('orientationchange', handleResize);
        };
    }, [scrollActiveIntoView]);

    return (
        <div
            data-testid="mobile-visualizer-selector-bar"
            role="radiogroup"
            aria-label="Visualizer style selector"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            className={`flex min-w-0 w-full max-w-full items-center gap-1.5 rounded-2xl border border-white/12 bg-black/65 p-1.5 backdrop-blur-xl ${
                compact ? 'mt-1.5' : 'mt-2'
            }`}
        >
            <button
                type="button"
                data-testid="mobile-visualizer-open-grid-btn"
                onClick={(e) => {
                    e.stopPropagation();
                    onOpenAllStyles();
                }}
                className="flex min-h-[34px] shrink-0 items-center gap-1 rounded-xl border border-white/15 bg-white/[0.08] px-2.5 py-1.5 text-[11px] font-semibold text-zinc-100 active:scale-95 transition-transform"
                aria-label="Open all visualizer styles and lyrics tools"
                title="All Visualizer Styles"
            >
                <Sparkles size={12} style={{ color: accentColor }} />
                <span className="hidden xs:inline">Styles</span>
            </button>

            <div
                ref={stripRef}
                className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto overscroll-x-contain touch-pan-x hide-scrollbar pr-1"
            >
                {VISUALIZER_REGISTRY.map(entry => {
                    const active = visualizerMode === entry.mode;
                    const label = getVisualizerModeLabel(entry.mode, t);
                    return (
                        <button
                            key={entry.mode}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            data-visualizer-mode={entry.mode}
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelectMode(entry.mode);
                            }}
                            className={`min-h-[34px] shrink-0 rounded-xl px-3 py-1.5 text-xs font-medium transition-all active:scale-95 ${
                                active
                                    ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                                    : 'text-zinc-200 hover:bg-white/10'
                            }`}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
});

interface MobileTimedWordProps {
    word: WordType;
    currentTime: MotionValue<number>;
    activeColor: string;
    inactiveColor: string;
    passedColor: string;
    glowColor: string;
    lineDirection: TextDirection;
}

const MobileTimedWord: React.FC<MobileTimedWordProps> = React.memo(({
    word,
    currentTime,
    activeColor,
    inactiveColor,
    passedColor,
    glowColor,
    lineDirection,
}) => {
    const spanRef = useRef<HTMLSpanElement>(null);
    const baseLayerRef = useRef<HTMLSpanElement>(null);
    const activeLayerRef = useRef<HTMLSpanElement>(null);
    const lastPhaseRef = useRef<'init' | 'waiting' | 'active' | 'passed'>('init');
    const lastPctRef = useRef<number>(-1);
    const wordDir = useMemo(() => resolveTokenDirection(word.text, lineDirection), [lineDirection, word.text]);

    // Pure GPU Compositing on Mali-G77 (120Hz AMOLED):
    // Per-frame updates strictly mutate only GPU-composited transform (translate3d / scale3d)
    // and opacity via direct DOM refs without triggering CPU glyph re-rasterization or paint.
    const applyWordProgress = useCallback((timeSec: number) => {
        const el = spanRef.current;
        const baseEl = baseLayerRef.current;
        const activeEl = activeLayerRef.current;
        if (!el || !baseEl || !activeEl) return;

        if (timeSec < word.startTime) {
            if (lastPhaseRef.current === 'waiting') return;
            lastPhaseRef.current = 'waiting';
            lastPctRef.current = 0;
            el.style.setProperty('--word-progress', '0%');
            el.style.transform = 'translate3d(0, 0, 0) scale3d(1, 1, 1)';
            baseEl.style.opacity = '1';
            activeEl.style.opacity = '0';
            activeEl.style.transform = 'translate3d(0, 0, 0) scale3d(0.98, 0.98, 1)';
            return;
        }
        if (timeSec >= word.endTime) {
            if (lastPhaseRef.current === 'passed') return;
            lastPhaseRef.current = 'passed';
            lastPctRef.current = 100;
            el.style.setProperty('--word-progress', '100%');
            el.style.transform = 'translate3d(0, 0, 0) scale3d(1, 1, 1)';
            baseEl.style.opacity = '0';
            activeEl.style.opacity = '0.84';
            activeEl.style.transform = 'translate3d(0, 0, 0) scale3d(1, 1, 1)';
            return;
        }
        const pct = computeTimedWordProgressPercent(word, timeSec);
        if (lastPhaseRef.current === 'active' && Math.abs(pct - lastPctRef.current) < 0.25) {
            return;
        }
        lastPhaseRef.current = 'active';
        lastPctRef.current = pct;
        const ratio = Math.max(0, Math.min(1, pct / 100));
        const arc = Math.sin(ratio * Math.PI);
        const pctStr = `${pct.toFixed(1)}%`;
        const liftY = (-1.1 * arc).toFixed(2);
        const scale = (1 + 0.03 * arc).toFixed(3);
        el.style.setProperty('--word-progress', pctStr);
        el.style.transform = `translate3d(0, ${liftY}px, 0) scale3d(${scale}, ${scale}, 1)`;
        baseEl.style.opacity = (1 - ratio * 0.85).toFixed(3);
        activeEl.style.opacity = (0.28 + ratio * 0.72).toFixed(3);
        activeEl.style.transform = `translate3d(0, 0, 0) scale3d(${scale}, ${scale}, 1)`;
    }, [word]);

    useEffect(() => {
        lastPhaseRef.current = 'init';
        lastPctRef.current = -1;
        applyWordProgress(currentTime.get());
    }, [applyWordProgress, currentTime]);

    useMotionValueEvent(currentTime, 'change', applyWordProgress);

    return (
        <span
            ref={spanRef}
            dir={wordDir}
            className="relative inline-block whitespace-pre-wrap will-change-transform"
            style={{
                transform: 'translate3d(0, 0, 0) scale3d(1, 1, 1)',
                unicodeBidi: 'isolate',
                letterSpacing: '0px',
            }}
        >
            <span
                ref={baseLayerRef}
                className="block will-change-[opacity]"
                style={{
                    color: inactiveColor,
                    opacity: 1,
                }}
            >
                {word.text}
            </span>
            <span
                ref={activeLayerRef}
                aria-hidden="true"
                className="pointer-events-none select-none absolute inset-0 block will-change-[transform,opacity]"
                style={{
                    color: activeColor || passedColor,
                    opacity: 0,
                    transform: 'translate3d(0, 0, 0) scale3d(0.98, 0.98, 1)',
                    textShadow: `0 0 16px color-mix(in srgb, ${glowColor} 42%, transparent)`,
                }}
            >
                {word.text}
            </span>
        </span>
    );
});

export const MobileNowPlayingSheet: React.FC<MobileNowPlayingSheetProps> = ({
    isOpen,
    displayMode,
    subDrawer,
    onChangeDisplayMode,
    onChangeSubDrawer,
    onClose,
    currentSong,
    artistName,
    albumName,
    localAlbumName,
    folderName,
    coverUrl,
    albumVideoUrl: explicitAlbumVideoUrl,
    albumVideoId: explicitAlbumVideoId,
    playerState,
    currentTime,
    lyricCurrentTime,
    duration,
    lyrics,
    currentLineIndex,
    isLyricsLoading,
    isLiked,
    loopMode,
    theme,
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
    onSeek,
    onLyricLineSeek,
    onTogglePlay,
    onPrevTrack,
    onNextTrack,
    onToggleLoop,
    onToggleLike,
    onShuffleQueue,
    playQueue,
    onPlayQueueSong,
    onRemoveQueueSong,
    onSaveQueueAsPlaylist,
    onOpenVisualizerSettings,
    onOpenLattice,
}) => {
    const { t } = useTranslation();
    const isEqualizerEnabled = useAudioSettingsStore(state => state.audioEqualizerSettings.enabled);
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
        effectiveSystemBars,
        fullScreenLyricsMode,
        setFullScreenLyricsMode,
    } = useSystemBarSettingsStore(
        useShallow(state => ({
            effectiveSystemBars: state.effectiveState,
            fullScreenLyricsMode: state.fullScreenLyricsMode,
            setFullScreenLyricsMode: state.setFullScreenLyricsMode,
        })),
    );
    const {
        visualizerBackgroundMode,
        disableVisualizerGeometricBackground,
        handleSetVisualizerBackgroundMode,
        handleToggleDisableVisualizerGeometricBackground,
    } = useVisualizerSettingsStore(
        useShallow(state => ({
            visualizerBackgroundMode: state.visualizerBackgroundMode,
            disableVisualizerGeometricBackground: state.disableVisualizerGeometricBackground,
            handleSetVisualizerBackgroundMode: state.handleSetVisualizerBackgroundMode,
            handleToggleDisableVisualizerGeometricBackground: state.handleToggleDisableVisualizerGeometricBackground,
        })),
    );
    const { useCoverColorBg, handleToggleCoverColorBg } = useThemeSettingsStore(
        useShallow(state => ({
            useCoverColorBg: state.useCoverColorBg,
            handleToggleCoverColorBg: state.handleToggleCoverColorBg,
        })),
    );
    const {
        preferredAlternativeLyricSource,
        handleSetPreferredAlternativeLyricSource,
    } = useLyricSettingsStore(
        useShallow(state => ({
            preferredAlternativeLyricSource: state.preferredAlternativeLyricSource,
            handleSetPreferredAlternativeLyricSource: state.handleSetPreferredAlternativeLyricSource,
        })),
    );
    const activeBackgroundMode = visualizerBackgroundMode ?? DEFAULT_VISUALIZER_BACKGROUND_MODE;
    const progressFillRef = useRef<HTMLDivElement>(null);
    const progressThumbRef = useRef<HTMLDivElement>(null);
    const currentTimeTextRef = useRef<HTMLSpanElement>(null);
    const rangeInputRef = useRef<HTMLInputElement>(null);
    const isScrubbingRef = useRef(false);
    const lastSeekCommitRef = useRef<{ timeMs: number; value: number }>({ timeMs: 0, value: -1 });

    const lastDisplayedSecRef = useRef<number>(-1);
    const lyricsListRef = useRef<HTMLDivElement>(null);
    const lyricFileInputRef = useRef<HTMLInputElement>(null);
    const userScrollingLyricsUntilRef = useRef<number>(0);
    const [stageChromeHidden, setStageChromeHidden] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [showSavePlaylistInput, setShowSavePlaylistInput] = useState(false);
    const [resolvedCoverUrl, setResolvedCoverUrl] = useState<string | null>(() => {
        if (!coverUrl) return null;
        return getCachedLocalCoverObjectUrl(coverUrl) ?? coverUrl;
    });
    const [coverLoadError, setCoverLoadError] = useState(false);
    const albumVideoRef = useRef<HTMLVideoElement>(null);
    const albumVideoFileInputRef = useRef<HTMLInputElement>(null);
    const [resolvedAlbumVideo, setResolvedAlbumVideo] = useState<{
        albumKey: string;
        video: LocalAlbumVideoEntry | null;
        streamUrl: string | null;
        origin: 'auto' | 'manual' | 'none';
        ambiguousCandidates: LocalAlbumVideoEntry[];
    }>(() => {
        if (explicitAlbumVideoUrl) {
            return {
                albumKey: albumName || 'explicit',
                video: null,
                streamUrl: explicitAlbumVideoUrl,
                origin: 'manual',
                ambiguousCandidates: [],
            };
        }
        const syncScored = scoreAlbumVideoCandidates(albumName || '', artistName || undefined, folderName || undefined);
        const top = syncScored[0];
        if (top && top.video.safContentUri) {
            const topScore = top.score;
            const ambig = syncScored.filter(c => Math.abs(c.score - topScore) <= 6).map(c => c.video);
            return {
                albumKey: albumName || '',
                video: top.video,
                streamUrl: `https://localhost/__folia_saf/stream?uri=${encodeURIComponent(top.video.safContentUri)}&mime=${encodeURIComponent(top.video.mimeType)}&size=${top.video.fileSize}`,
                origin: 'auto',
                ambiguousCandidates: ambig.length > 1 ? ambig : [],
            };
        }
        return {
            albumKey: '',
            video: null,
            streamUrl: null,
            origin: 'none',
            ambiguousCandidates: [],
        };
    });
    const [videoLoadError, setVideoLoadError] = useState(false);
    const [isVideoFrameReady, setIsVideoFrameReady] = useState<boolean>(Boolean(explicitAlbumVideoUrl));
    const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number }>({ width: 1080, height: 1080 });
    const [isPageVisible, setIsPageVisible] = useState<boolean>(() => (
        typeof document === 'undefined' ? true : document.visibilityState !== 'hidden'
    ));
    const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(detectPrefersReducedMotion);
    const [videoCatalogTick, setVideoCatalogTick] = useState(0);
    const lastReadyVideoKeyRef = useRef<string | null>(explicitAlbumVideoId || explicitAlbumVideoUrl || null);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const onVideosUpdated = () => setVideoCatalogTick(t => t + 1);
        window.addEventListener(LOCAL_ALBUM_VIDEOS_UPDATED_EVENT, onVideosUpdated);
        return () => window.removeEventListener(LOCAL_ALBUM_VIDEOS_UPDATED_EVENT, onVideosUpdated);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;
        const onVis = () => setIsPageVisible(document.visibilityState !== 'hidden');
        const onNativeVis = (event: Event) => {
            const detail = (event as CustomEvent<{ visible?: boolean }>).detail;
            if (typeof detail?.visible === 'boolean') setIsPageVisible(detail.visible);
        };
        document.addEventListener('visibilitychange', onVis);
        window.addEventListener(ANDROID_VISIBILITY_EVENT, onNativeVis);
        let mql: MediaQueryList | null = null;
        const onMotion = () => setPrefersReducedMotion(detectPrefersReducedMotion());
        if (typeof window.matchMedia === 'function') {
            mql = window.matchMedia('(prefers-reduced-motion: reduce)');
            mql.addEventListener?.('change', onMotion);
        }
        return () => {
            document.removeEventListener('visibilitychange', onVis);
            window.removeEventListener(ANDROID_VISIBILITY_EVENT, onNativeVis);
            mql?.removeEventListener?.('change', onMotion);
        };
    }, []);

    useEffect(() => {
        if (explicitAlbumVideoUrl !== undefined) {
            const nextKey = explicitAlbumVideoId || explicitAlbumVideoUrl || null;
            if (nextKey !== lastReadyVideoKeyRef.current) {
                setVideoLoadError(false);
                setIsVideoFrameReady(Boolean(explicitAlbumVideoUrl));
                lastReadyVideoKeyRef.current = nextKey;
            }
            setResolvedAlbumVideo({
                albumKey: albumName || 'explicit',
                video: null,
                streamUrl: explicitAlbumVideoUrl,
                origin: 'manual',
                ambiguousCandidates: [],
            });
            return undefined;
        }
        let cancelled = false;
        void resolveAlbumVideoForTrack({
            albumName,
            fallbackAlbumName: localAlbumName,
            artistName,
            folderName,
        }).then((res) => {
            if (cancelled) return;
            const nextKey = res.video?.id || res.streamUrl || null;
            // If moving between tracks on the SAME album that share the same videoKey,
            // keep isVideoFrameReady = true so the video continues playing without blinking!
            if (nextKey !== lastReadyVideoKeyRef.current) {
                setVideoLoadError(false);
                setIsVideoFrameReady(false);
                lastReadyVideoKeyRef.current = nextKey;
            }
            setResolvedAlbumVideo(res);
        });
        return () => {
            cancelled = true;
        };
    }, [albumName, artistName, explicitAlbumVideoId, explicitAlbumVideoUrl, folderName, localAlbumName, videoCatalogTick]);

    useEffect(() => {
        setCoverLoadError(false);
        if (!coverUrl) {
            setResolvedCoverUrl(null);
            return undefined;
        }
        const cached = getCachedLocalCoverObjectUrl(coverUrl);
        if (cached) {
            setResolvedCoverUrl(cached);
            return undefined;
        }
        if (!isLocalCoverAssetUrl(coverUrl)) {
            setResolvedCoverUrl(coverUrl);
            return undefined;
        }
        setResolvedCoverUrl(coverUrl);
        let cancelled = false;
        void resolveLocalCoverObjectUrl(coverUrl).then((blobUrl) => {
            if (!cancelled && blobUrl) {
                setResolvedCoverUrl(blobUrl);
                setCoverLoadError(false);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [coverUrl]);

    const lyricLines = useMemo(() => lyrics?.lines ?? [], [lyrics]);
    const hasRenderableLines = lyricLines.length > 0 && !(lyricLines.length === 1 && lyricLines[0]?.fullText === '......');

    const [viewportCenterIndex, setViewportCenterIndex] = useState<number>(() => Math.max(0, currentLineIndex));
    const scrollViewportRafRef = useRef<number>(0);

    useEffect(() => {
        if (Date.now() >= userScrollingLyricsUntilRef.current && currentLineIndex >= 0) {
            setViewportCenterIndex(prev => (prev === currentLineIndex ? prev : currentLineIndex));
        }
    }, [currentLineIndex]);

    useEffect(() => () => {
        if (scrollViewportRafRef.current) {
            cancelAnimationFrame(scrollViewportRafRef.current);
        }
    }, []);

    // Track all concurrently active overlapping lyric lines from lyricCurrentTime
    const [activeLineSetKey, setActiveLineSetKey] = useState<string>(() => {
        const indices = Array.from(computeActiveLyricLineIndices(lyricLines, currentLineIndex, lyricCurrentTime.get())).sort((a, b) => a - b);
        return indices.join(',');
    });
    const lastActiveCheckTimeRef = useRef<number>(-1);

    useEffect(() => {
        const indices = Array.from(computeActiveLyricLineIndices(lyricLines, currentLineIndex, lyricCurrentTime.get())).sort((a, b) => a - b);
        const key = indices.join(',');
        setActiveLineSetKey(prev => (prev === key ? prev : key));
    }, [currentLineIndex, lyricCurrentTime, lyricLines]);

    useMotionValueEvent(lyricCurrentTime, 'change', (latest: number) => {
        if (!isOpen || !isPageVisible || displayMode !== 'lyrics' || lyricLines.length === 0) return;
        if (Math.abs(latest - lastActiveCheckTimeRef.current) < 0.04) return;
        lastActiveCheckTimeRef.current = latest;
        const indices = Array.from(computeActiveLyricLineIndices(lyricLines, currentLineIndex, latest)).sort((a, b) => a - b);
        const key = indices.join(',');
        setActiveLineSetKey(prev => (prev === key ? prev : key));
    });

    const activeLineIndices = useMemo(() => {
        const set = new Set<number>();
        if (currentLineIndex >= 0) set.add(currentLineIndex);
        if (activeLineSetKey) {
            for (const part of activeLineSetKey.split(',')) {
                const parsed = Number(part);
                if (Number.isInteger(parsed) && parsed >= 0) {
                    set.add(parsed);
                }
            }
        }
        return set;
    }, [activeLineSetKey, currentLineIndex]);

    const updateScrubberDOM = useCallback((timeValue: number, force = false) => {
        const clamped = duration > 0 ? Math.max(0, Math.min(timeValue, duration)) : Math.max(0, timeValue);
        const pct = duration > 0 ? Math.min(1, clamped / duration) : 0;
        if (progressFillRef.current) {
            progressFillRef.current.style.transform = `scaleX(${pct.toFixed(4)})`;
        }
        if (progressThumbRef.current) {
            progressThumbRef.current.style.transform = `translateX(${(pct * 100).toFixed(3)}%)`;
        }
        const wholeSec = Math.floor(clamped);
        if (force || wholeSec !== lastDisplayedSecRef.current) {
            lastDisplayedSecRef.current = wholeSec;
            if (currentTimeTextRef.current) {
                currentTimeTextRef.current.textContent = formatSeconds(clamped);
            }
            if (!isScrubbingRef.current && rangeInputRef.current) {
                rangeInputRef.current.value = String(clamped);
            }
        }
    }, [duration]);

    const resolveSeekValueFromEvent = useCallback((
        input: HTMLInputElement | null | undefined,
        clientX?: number,
    ): number => {
        if (!input) return currentTime.get();
        const maxVal = duration > 0 ? duration : 100;
        if (typeof clientX === 'number' && Number.isFinite(clientX) && typeof input.getBoundingClientRect === 'function') {
            const rect = input.getBoundingClientRect();
            if (rect && rect.width > 0) {
                const rawRatio = (clientX - rect.left) / rect.width;
                const clampedRatio = Math.max(0, Math.min(1, rawRatio));
                const computed = Math.round(clampedRatio * maxVal * 10) / 10;
                input.value = String(computed);
                return computed;
            }
        }
        const parsed = Number(input.value);
        return Number.isFinite(parsed) ? parsed : currentTime.get();
    }, [currentTime, duration]);

    const commitSeekOnce = useCallback((val: number) => {
        const now = Date.now();
        if (
            now - lastSeekCommitRef.current.timeMs < 80
            && Math.abs(val - lastSeekCommitRef.current.value) < 0.05
        ) {
            return;
        }
        lastSeekCommitRef.current = { timeMs: now, value: val };
        userScrollingLyricsUntilRef.current = 0;
        updateScrubberDOM(val, true);
        onSeek(val);
    }, [onSeek, updateScrubberDOM]);


    useEffect(() => {
        if (isOpen) {
            updateScrubberDOM(currentTime.get(), true);
        }
    }, [currentTime, duration, isOpen, updateScrubberDOM]);

    useMotionValueEvent(currentTime, 'change', (latest: number) => {
        if (!isOpen || isScrubbingRef.current) return;
        updateScrubberDOM(latest, false);
    });

    // Reset lyric scroll position on track change
    useEffect(() => {
        userScrollingLyricsUntilRef.current = 0;
        if (lyricsListRef.current && currentLineIndex <= 0) {
            lyricsListRef.current.scrollTo({ top: 0, behavior: 'auto' });
        }
    }, [currentSong?.id]);

    // Auto-scroll active lyric line into center of the lyrics reader unless user recently scrolled manually
    useEffect(() => {
        if (!isOpen || displayMode !== 'lyrics' || currentLineIndex < 0) return;
        if (Date.now() < userScrollingLyricsUntilRef.current) return;
        const container = lyricsListRef.current;
        if (!container) return;
        const activeNode = container.querySelector<HTMLElement>(`[data-lyric-index="${currentLineIndex}"]`);
        if (activeNode) {
            const targetTop = activeNode.offsetTop - container.clientHeight * 0.38 + activeNode.clientHeight * 0.5;
            container.scrollTo({
                top: Math.max(0, targetTop),
                behavior: 'smooth',
            });
        }
    }, [currentLineIndex, displayMode, isOpen]);

    const effectiveAlbumVideoUrl = !videoLoadError
        ? (explicitAlbumVideoUrl !== undefined ? explicitAlbumVideoUrl : resolvedAlbumVideo.streamUrl)
        : null;
    const effectiveAlbumVideoId = explicitAlbumVideoId ?? resolvedAlbumVideo.video?.id ?? null;

    const videoStageState = useMemo(
        () =>
            resolveAlbumVideoStageState({
                albumVideoEnabled,
                videoStreamUrl: effectiveAlbumVideoUrl,
                videoId: effectiveAlbumVideoId,
                isPlaying: playerState === PlayerState.PLAYING,
                isCoverScreenActive: isOpen && displayMode === 'cover',
                isPageVisible,
                prefersReducedMotion,
                videoWidth: videoDimensions.width,
                videoHeight: videoDimensions.height,
                viewportWidth: typeof window !== 'undefined' ? window.innerWidth || 390 : 390,
                viewportHeight: typeof window !== 'undefined' ? window.innerHeight || 844 : 844,
            }),
        [
            albumVideoEnabled,
            displayMode,
            effectiveAlbumVideoId,
            effectiveAlbumVideoUrl,
            isOpen,
            isPageVisible,
            playerState,
            prefersReducedMotion,
            videoDimensions.height,
            videoDimensions.width,
        ],
    );

    useEffect(() => {
        const videoEl = albumVideoRef.current;
        if (!videoEl || !videoStageState.shouldShowVideo) return;
        if (videoStageState.shouldPlayVideo) {
            const playPromise = videoEl.play?.();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(() => {});
            }
        } else {
            videoEl.pause?.();
        }
    }, [videoStageState.shouldPlayVideo, videoStageState.shouldShowVideo, videoStageState.videoKey]);

    const songPaletteCandidate = currentSong as (SongResult & {
        vibrantColors?: string[];
        representativeColors?: string[];
    }) | null;

    useEffect(() => {
        if (!hasAndroidNativeVisualizerBridge() || !currentSong) return;
        const colors = buildAndroidVisualizerPalette(songPaletteCandidate, theme);
        void setAndroidNativeVisualizerPalette({
            colors,
            transitionMs: 900,
        });
        if (!songPaletteCandidate?.vibrantColors?.length) {
            void getCachedAndroidTrackPalette({
                trackId: String(currentSong.id),
                albumId: albumName || localAlbumName || currentSong.album?.name || undefined,
                assetId: (currentSong as { localCoverAssetId?: string }).localCoverAssetId,
                applyToVisualizer: true,
                transitionMs: 900,
            });
        }
    }, [
        albumName,
        localAlbumName,
        currentSong,
        songPaletteCandidate,
        songPaletteCandidate?.id,
        songPaletteCandidate?.vibrantColors,
        songPaletteCandidate?.representativeColors,
        theme,
        theme.accentColor,
        theme.backgroundColor,
        theme.primaryColor,
        theme.secondaryColor,
    ]);

    const [displayRefreshRateHz, setDisplayRefreshRateHz] = useState<number>(() => getCurrentDisplayRefreshRateHz());

    useEffect(() => {
        if (!hasAndroidNativeVisualizerBridge()) return undefined;
        void getAndroidDisplayRefreshRate().then((info) => {
            setDisplayRefreshRateHz(info.refreshRate);
        });
        return subscribeAndroidDisplayRefreshRate((info) => {
            setDisplayRefreshRateHz(info.refreshRate);
        });
    }, []);

    useEffect(() => {
        const nextMode = isOpen ? displayMode : 'closed';
        if (typeof document !== 'undefined' && document.documentElement?.setAttribute) {
            document.documentElement.setAttribute('data-mobile-display-mode', nextMode);
        }
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new CustomEvent('folia:mobile-display-mode', { detail: { mode: nextMode } }));
        }
        return () => {
            if (typeof document !== 'undefined' && document.documentElement?.setAttribute) {
                document.documentElement.setAttribute('data-mobile-display-mode', 'closed');
            }
            if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
                window.dispatchEvent(new CustomEvent('folia:mobile-display-mode', { detail: { mode: 'closed' } }));
            }
        };
    }, [displayMode, isOpen]);

    useEffect(() => {
        if (!hasAndroidNativeVisualizerBridge()) return;
        const isVideoCovering = displayMode === 'cover' && videoStageState.shouldShowVideo && Boolean(effectiveAlbumVideoUrl);
        const usesWebViewOriginalBackground = displayMode === 'lyrics' || displayMode === 'stage';
        const enabled = Boolean(isOpen && currentSong && !isVideoCovering && !usesWebViewOriginalBackground);
        const visible = Boolean(enabled && isPageVisible);
        const isPlayingNow = playerState === PlayerState.PLAYING;
        const vsyncDivider: 1 | 2 = 2;
        const targetFps = (visible && isPlayingNow)
            ? Math.max(15, Math.round(displayRefreshRateHz / vsyncDivider))
            : 0;
        const dim = displayMode === 'lyrics' ? 0.34 : displayMode === 'stage' ? 0.14 : 0.26;
        void setAndroidNativeVisualizerState({
            enabled,
            visible,
            fps: targetFps,
            vsyncDivider,
            dim,
        });
        if (!isPlayingNow) {
            void setAndroidNativeVisualizerEnergy({
                bass: 0,
                mid: 0,
                high: 0,
                isPlaying: false,
            });
        }
    }, [
        currentSong,
        displayMode,
        displayRefreshRateHz,
        effectiveAlbumVideoUrl,
        isOpen,
        isPageVisible,
        playerState,
        videoStageState.shouldShowVideo,
    ]);

    if (!isOpen || !currentSong) {
        return null;
    }

    const isAndroidNativeVisualizerActive = hasAndroidNativeVisualizerBridge();

    const isPlaying = playerState === PlayerState.PLAYING;
    const accentColor = theme.accentColor || theme.primaryColor || '#f4f4f5';
    const primaryColor = theme.primaryColor || '#ffffff';
    const bgTint = theme.backgroundColor || '#09090b';
    const titleDir = detectTextDirection(currentSong.name || '');
    const artistDir = detectTextDirection(artistName || '');
    const activeLine = currentLineIndex >= 0 && currentLineIndex < lyricLines.length ? lyricLines[currentLineIndex] : null;
    const nextLine = currentLineIndex + 1 >= 0 && currentLineIndex + 1 < lyricLines.length ? lyricLines[currentLineIndex + 1] : null;
    const effectiveCover = !coverLoadError ? resolvedCoverUrl : null;
    const activeVisualizerLabel = getVisualizerModeLabel(visualizerMode, t);

    // Safe-area padding adapts cleanly whether status/navigation bars are visible or hidden in edge-to-edge mode
    const topSafePadding = effectiveSystemBars.hideStatusBar
        ? 'max(var(--folia-native-cutout-top, env(safe-area-inset-top, 0px)), 8px)'
        : 'max(var(--folia-native-inset-top, env(safe-area-inset-top, 0px)), 10px)';
    const bottomSafePadding = effectiveSystemBars.hideNavigationBar
        ? '8px'
        : 'max(var(--folia-native-inset-bottom, env(safe-area-inset-bottom, 0px)), 10px)';
    const leftSafePadding = 'max(var(--folia-native-inset-left, env(safe-area-inset-left, 0px)), 0px)';
    const rightSafePadding = 'max(var(--folia-native-inset-right, env(safe-area-inset-right, 0px)), 0px)';

    const handleLyricFileChosen = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        try {
            const text = await file.text();
            onImportLocalLyricsFile(text, file.name);
        } catch (err) {
            console.error('[MobileLyrics] Failed to read lyric file:', err);
        }
    };

    return (
        <div
            data-testid="mobile-now-playing-sheet"
            data-display-mode={displayMode}
            data-immersive-lyrics={effectiveSystemBars.isImmersiveLyricsActive ? 'true' : 'false'}
            className="fixed inset-0 z-[200] flex flex-col overflow-hidden select-none text-zinc-100"
            style={{
                backgroundColor: displayMode === 'cover' ? '#060609' : 'transparent',
                paddingTop: topSafePadding,
                paddingBottom: bottomSafePadding,
                paddingLeft: leftSafePadding,
                paddingRight: rightSafePadding,
            }}
        >
            {/* Hidden file input for local lyric import (.lrc, .ttml, .vtt, .qrc, .yrc, .krc) */}
            <input
                ref={lyricFileInputRef}
                type="file"
                accept=".lrc,.ttml,.vtt,.qrc,.yrc,.krc,.txt"
                className="hidden"
                onChange={handleLyricFileChosen}
            />
            {/* Hidden file input for standalone local album video import (.mp4, .webm, .mkv, .m4v, .mov, .3gp) */}
            <input
                ref={albumVideoFileInputRef}
                type="file"
                multiple
                accept=".mp4,.webm,.mkv,.m4v,.mov,.3gp,video/*"
                className="hidden"
                onChange={async (e) => {
                    const files = Array.from(e.target.files ?? []);
                    e.target.value = '';
                    if (files.length === 0) return;
                    const targetAlbum = albumName || localAlbumName || currentSong.album?.name || '';
                    for (const file of files) {
                        await registerStandaloneAlbumVideoFile(file, targetAlbum ? {
                            albumName: targetAlbum,
                            artistName,
                            folderName,
                        } : undefined);
                    }
                    setVideoCatalogTick(t => t + 1);
                }}
            />

            {/* Full-Screen Local Album Video Cover Stage (when enabled and a matching local video exists in 'cover' mode):
                - Keyed by video identity (NEVER songId) so adjacent songs on the same album keep the video playing seamlessly.
                - Crossfades in only when the new album's video frame is ready so the previous album's video never flashes.
                - Layers a restrained top vignette and lower-edge gradient/blur so track metadata and controls blend naturally. */}
            {displayMode === 'cover' && videoStageState.shouldShowVideo && effectiveAlbumVideoUrl && (
                <div
                    data-testid="mobile-fullscreen-album-video-stage"
                    data-video-key={videoStageState.videoKey || ''}
                    data-scaling-mode={videoStageState.scalingMode}
                    data-video-playing={videoStageState.shouldPlayVideo ? 'true' : 'false'}
                    className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
                >
                    {videoStageState.scalingMode === 'ambient-framed' && (
                        <video
                            data-testid="mobile-album-video-ambient-backdrop"
                            src={effectiveAlbumVideoUrl}
                            muted
                            loop
                            playsInline
                            aria-hidden="true"
                            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-65 blur-2xl saturate-125"
                        />
                    )}
                    <video
                        ref={albumVideoRef}
                        data-testid="mobile-album-video-element"
                        data-video-key={videoStageState.videoKey || ''}
                        src={effectiveAlbumVideoUrl}
                        poster={effectiveCover || undefined}
                        muted
                        loop
                        playsInline
                        preload="auto"
                        onLoadedMetadata={(e) => {
                            const v = e.currentTarget;
                            if (v.videoWidth > 0 && v.videoHeight > 0) {
                                setVideoDimensions({ width: v.videoWidth, height: v.videoHeight });
                            }
                            setIsVideoFrameReady(true);
                        }}
                        onLoadedData={() => setIsVideoFrameReady(true)}
                        onCanPlay={() => setIsVideoFrameReady(true)}
                        onError={() => {
                            setVideoLoadError(true);
                            setIsVideoFrameReady(false);
                        }}
                        className={`h-full w-full transition-opacity duration-500 ${
                            videoStageState.scalingMode === 'ambient-framed'
                                ? 'relative z-10 object-contain'
                                : 'object-cover object-center'
                        } ${isVideoFrameReady ? 'opacity-100' : 'opacity-0'}`}
                    />
                    {/* Restrained Multi-Stop Readability Gradient & Lower-Edge Blend */}
                    <div
                        data-testid="album-video-readability-gradient"
                        aria-hidden="true"
                        className="absolute inset-0 z-20"
                        style={{
                            background: `
                                linear-gradient(
                                    180deg,
                                    rgba(5, 5, 9, 0.46) 0%,
                                    rgba(5, 5, 9, 0.08) 18%,
                                    rgba(5, 5, 9, 0.04) 52%,
                                    color-mix(in srgb, ${bgTint} 68%, rgba(5, 5, 9, 0.72)) 78%,
                                    color-mix(in srgb, ${bgTint} 92%, #050508) 100%
                                )
                            `,
                        }}
                    />
                </div>
            )}

            {/* OLED Artwork-Derived Ambient Background Layer:
                - Rich multi-stop atmospheric blend + softly blurred album cover in 'cover' mode
                - Light GPU-composited readability scrim in 'lyrics' mode so Folia's original background styles
                  (Common Fluid + Geometric, Latent, Monet, Sora, Nomand) shine through clearly behind the lyrics
                - Hidden in 'stage' mode so the full-screen Visualizer shines at 100% */}
            {displayMode === 'cover' && (
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 -z-10 overflow-hidden transition-opacity duration-500"
                    style={{
                        opacity: 1,
                        background: `
                            radial-gradient(circle at 50% 24%, color-mix(in srgb, ${accentColor} 42%, transparent) 0%, transparent 66%),
                            radial-gradient(circle at 22% 72%, color-mix(in srgb, ${primaryColor} 26%, transparent) 0%, transparent 60%),
                            radial-gradient(circle at 78% 84%, color-mix(in srgb, ${accentColor} 24%, transparent) 0%, transparent 58%),
                            linear-gradient(180deg, color-mix(in srgb, ${bgTint} 78%, #060609) 0%, color-mix(in srgb, ${bgTint} 48%, #050508) 64%, #050507 100%)
                        `,
                    }}
                >
                    {effectiveCover && (
                        <img
                            src={effectiveCover}
                            alt=""
                            aria-hidden="true"
                            className="absolute inset-0 h-full w-full scale-125 object-cover blur-3xl saturate-150 transition-opacity duration-700"
                            style={{ opacity: 0.44 }}
                        />
                    )}
                </div>
            )}
            {displayMode === 'lyrics' && (
                <div
                    aria-hidden="true"
                    data-testid="mobile-lyrics-background-scrim"
                    className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
                    style={{
                        background: 'linear-gradient(180deg, rgba(4, 4, 8, 0.28) 0%, rgba(4, 4, 8, 0.14) 50%, rgba(4, 4, 8, 0.34) 100%)',
                        transform: 'translate3d(0, 0, 0)',
                    }}
                />
            )}

            {/* Top Header Bar: Collapse + Mode Switcher (Cover / Lyrics / Visualizer) + Active Visualizer Quick Button + EQ + Lyric Tools + Queue */}
            <div
                className={`relative z-20 flex shrink-0 items-center justify-between gap-2 px-3 sm:px-4 py-1.5 transition-opacity duration-300 ${
                    displayMode === 'stage' && stageChromeHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'
                }`}
            >
                <button
                    type="button"
                    onClick={onClose}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-zinc-200 backdrop-blur-md active:scale-95 transition-transform"
                    aria-label="Collapse player"
                >
                    <ChevronDown size={21} />
                </button>

                {/* Mode Switcher Pill */}
                <div
                    role="tablist"
                    aria-label="Player display mode"
                    className="flex items-center rounded-full border border-white/10 bg-black/55 p-1 backdrop-blur-xl"
                >
                    {([
                        { id: 'cover' as const, label: t('panel.cover', 'Cover') },
                        { id: 'lyrics' as const, label: t('localMusic.lyrics', 'Lyrics') },
                        { id: 'stage' as const, label: 'Visualizer' },
                    ]).map(tab => {
                        const active = displayMode === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => {
                                    setStageChromeHidden(false);
                                    onChangeDisplayMode(tab.id);
                                }}
                                className={`h-8 rounded-full px-3 text-xs font-semibold transition-all ${
                                    active
                                        ? 'bg-white text-zinc-950 shadow-sm'
                                        : 'text-zinc-300 hover:text-white'
                                }`}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                <div className="flex items-center gap-1.5">
                    {/* Quick Visualizer Style Pill (always accessible in both portrait & landscape) */}
                    <button
                        type="button"
                        data-testid="mobile-header-visualizer-pill"
                        onClick={() => onChangeSubDrawer(subDrawer === 'lyrics-tools' ? 'none' : 'lyrics-tools')}
                        className="hidden sm:flex landscape:flex h-9 items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.08] px-3 text-xs font-medium text-zinc-100 backdrop-blur-md active:scale-95 transition-all"
                        aria-label={`Current visualizer: ${activeVisualizerLabel}. Tap to change visualizer`}
                        title="Change Visualizer Style"
                    >
                        <Sparkles size={13} style={{ color: accentColor }} />
                        <span className="max-w-[84px] truncate">{activeVisualizerLabel}</span>
                    </button>

                    {onOpenLattice && (
                        <button
                            type="button"
                            onClick={onOpenLattice}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.07] text-zinc-200 backdrop-blur-md active:scale-95 transition-all"
                            aria-label="Open Lattice queue collage"
                            title="Lattice Queue Collage"
                        >
                            <Grid size={17} />
                        </button>
                    )}
                    <button
                        type="button"
                        data-testid="mobile-now-playing-eq-btn"
                        onClick={() => onChangeSubDrawer(subDrawer === 'equalizer' ? 'none' : 'equalizer')}
                        className={`relative flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-md active:scale-95 transition-all ${
                            subDrawer === 'equalizer'
                                ? 'bg-white text-zinc-950'
                                : 'bg-white/[0.07] text-zinc-200'
                        }`}
                        aria-label="Audio Equalizer"
                        title="Audio Equalizer & Effects"
                    >
                        <Sliders size={17} />
                        {isEqualizerEnabled && (
                            <span
                                className="absolute right-2 top-2 h-2 w-2 rounded-full"
                                style={{ backgroundColor: accentColor }}
                            />
                        )}
                    </button>
                    <button
                        type="button"
                        data-testid="mobile-now-playing-lyrics-tools-btn"
                        onClick={() => onChangeSubDrawer(subDrawer === 'lyrics-tools' ? 'none' : 'lyrics-tools')}
                        className={`flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-md active:scale-95 transition-all ${
                            subDrawer === 'lyrics-tools'
                                ? 'bg-white text-zinc-950'
                                : 'bg-white/[0.07] text-zinc-200'
                        }`}
                        aria-label="Lyrics and visualizer settings"
                    >
                        <SlidersHorizontal size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={() => onChangeSubDrawer(subDrawer === 'queue' ? 'none' : 'queue')}
                        className={`flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-md active:scale-95 transition-all ${
                            subDrawer === 'queue'
                                ? 'bg-white text-zinc-950'
                                : 'bg-white/[0.07] text-zinc-200'
                        }`}
                        aria-label="Play queue"
                    >
                        <ListMusic size={18} />
                    </button>
                </div>
            </div>

            {/* Main Content Area:
                Uses `min-w-0 min-h-0 flex-1 flex-col landscape:flex-row landscape:items-stretch` so that
                in landscape mode the left pane (cover / lyrics / visualizer) and the horizontal visualizer
                selector strip are properly bounded to their flex column width and never overflow behind the controls dock. */}
            <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col landscape:flex-row landscape:items-stretch landscape:gap-4 px-4 landscape:px-3 pt-1 pb-1">
                {displayMode === 'cover' && (
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-3 landscape:flex-row landscape:justify-around">
                        {videoStageState.shouldShowVideo && effectiveAlbumVideoUrl ? (
                            /* Full-Screen Local Album Video Interactive Hero Frame */
                            <div
                                data-testid="album-video-interactive-hero"
                                onClick={() => onChangeDisplayMode('lyrics')}
                                className="relative flex min-h-[220px] w-full max-w-md flex-1 cursor-pointer flex-col justify-between rounded-3xl p-3"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <button
                                        type="button"
                                        data-testid="album-video-status-pill"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setAlbumVideoEnabled(false);
                                        }}
                                        className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/55 px-3 py-1 text-[11px] font-semibold text-white/95 backdrop-blur-md active:scale-95 transition-transform"
                                        title="Album Video Cover is active. Tap to switch to album artwork"
                                    >
                                        <Film size={12} style={{ color: accentColor }} />
                                        <span>Album Video</span>
                                    </button>

                                    {resolvedAlbumVideo.ambiguousCandidates.length > 1 && (
                                        <button
                                            type="button"
                                            data-testid="album-video-ambiguity-badge"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onChangeSubDrawer('lyrics-tools');
                                            }}
                                            className="flex items-center gap-1 rounded-full border border-amber-400/40 bg-black/65 px-2.5 py-1 text-[11px] font-medium text-amber-200 backdrop-blur-md active:scale-95"
                                        >
                                            <span>{resolvedAlbumVideo.ambiguousCandidates.length} videos match · Choose</span>
                                        </button>
                                    )}
                                </div>

                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onChangeDisplayMode('lyrics');
                                        }}
                                        className="flex items-center gap-1.5 rounded-full border border-white/12 bg-black/55 px-3 py-1.5 text-[11px] font-medium text-white/90 backdrop-blur-md active:scale-95"
                                    >
                                        <Sparkles size={12} style={{ color: accentColor }} />
                                        <span>Tap for Lyrics</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Apple Music-Inspired Dynamic Album Cover Stage (or Unmodified Static Cover when toggled Off) */
                            <DynamicAlbumCoverStage
                                songId={currentSong.id}
                                songTitle={currentSong.name}
                                coverUrl={effectiveCover}
                                isPlaying={isPlaying}
                                isActive={isOpen && displayMode === 'cover'}
                                enabled={dynamicArtworkEnabled}
                                intensity={dynamicArtworkIntensity}
                                theme={theme}
                                onOpenLyrics={() => onChangeDisplayMode('lyrics')}
                                onToggleEnabled={() => setDynamicArtworkEnabled(!dynamicArtworkEnabled)}
                                onImageError={() => setCoverLoadError(true)}
                            />
                        )}

                        {/* Live 2-Line Synchronized Lyric Preview Pill blended with Artwork Gradient & Frosted Blur */}
                        <button
                            type="button"
                            onClick={() => onChangeDisplayMode('lyrics')}
                            className="w-full max-w-md rounded-2xl border border-white/[0.10] px-4 py-2.5 text-center backdrop-blur-xl active:scale-[0.99] transition-transform"
                            style={{
                                background: `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 14%, rgba(255,255,255,0.05)) 0%, color-mix(in srgb, ${bgTint} 78%, rgba(10,10,16,0.72)) 100%)`,
                            }}
                        >
                            {activeLine ? (
                                <div className="space-y-1">
                                    <p
                                        dir={detectTextDirection(activeLine.fullText)}
                                        className="truncate text-sm font-semibold text-white"
                                        style={{ unicodeBidi: 'isolate' }}
                                    >
                                        {activeLine.fullText}
                                    </p>
                                    {(activeLine.translation || nextLine?.fullText) && (
                                        <p
                                            dir={detectTextDirection(activeLine.translation || nextLine?.fullText || '')}
                                            className="truncate text-xs text-zinc-300/90"
                                            style={{ unicodeBidi: 'isolate' }}
                                        >
                                            {showSubtitleTranslation && activeLine.translation
                                                ? activeLine.translation
                                                : nextLine?.fullText}
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-xs text-zinc-300/90">
                                    {isLyricsLoading
                                        ? 'Loading synchronized lyrics...'
                                        : hasRenderableLines
                                            ? lyricLines[0]?.fullText
                                            : 'No synchronized lyrics — tap to import .lrc / .ttml or match online'}
                                </p>
                            )}
                        </button>
                    </div>
                )}

                {displayMode === 'lyrics' && (
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col w-full">
                        {isLyricsLoading ? (
                            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                                <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-white" />
                                <p className="text-sm text-zinc-300">Loading synchronized lyrics...</p>
                            </div>
                        ) : currentSong.isPureMusic && !hasRenderableLines ? (
                            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.06] text-zinc-300">
                                    <Music2 size={28} />
                                </div>
                                <div>
                                    <h3 className="text-base font-semibold text-zinc-100">
                                        {t('localMusic.statusPureMusic', 'Instrumental Track')}
                                    </h3>
                                    <p className="mt-1 text-xs text-zinc-400">
                                        This track is marked as instrumental without vocal lyrics.
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center justify-center gap-2.5">
                                    {onTogglePureMusic && (
                                        <button
                                            type="button"
                                            onClick={onTogglePureMusic}
                                            className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-medium text-white"
                                        >
                                            Unmark Instrumental
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => lyricFileInputRef.current?.click()}
                                        className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-zinc-950"
                                    >
                                        <FileUp size={14} />
                                        Import Lyric File
                                    </button>
                                </div>
                            </div>
                        ) : !hasRenderableLines ? (
                            <div
                                data-testid="mobile-missing-lyrics-state"
                                className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center"
                            >
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-zinc-300">
                                    <FileText size={26} />
                                </div>
                                <div className="max-w-xs space-y-1">
                                    <h3 className="text-base font-semibold text-zinc-100">
                                        No Synchronized Lyrics Found
                                    </h3>
                                    <p className="text-xs text-zinc-400 leading-relaxed">
                                        Import a local <code className="text-zinc-200">.ttml</code>, <code className="text-zinc-200">.lrc</code>, <code className="text-zinc-200">.vtt</code>, <code className="text-zinc-200">.qrc</code>, or <code className="text-zinc-200">.yrc</code> file, or match lyrics online.
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => lyricFileInputRef.current?.click()}
                                        className="flex h-10 items-center gap-2 rounded-full bg-white px-4 text-xs font-semibold text-zinc-950 shadow-md active:scale-95 transition-transform"
                                    >
                                        <FileUp size={15} />
                                        Import Lyric File
                                    </button>
                                    <button
                                        type="button"
                                        onClick={onOpenLyricMatch}
                                        className="flex h-10 items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-4 text-xs font-semibold text-white active:scale-95 transition-transform"
                                    >
                                        <Search size={15} />
                                        Match Lyrics
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div
                                ref={lyricsListRef}
                                data-testid="mobile-synchronized-lyrics-list"
                                onTouchStart={() => {
                                    userScrollingLyricsUntilRef.current = Date.now() + 3500;
                                }}
                                onWheel={() => {
                                    userScrollingLyricsUntilRef.current = Date.now() + 3500;
                                }}
                                onScroll={(e) => {
                                    const container = e.currentTarget;
                                    if (scrollViewportRafRef.current) return;
                                    scrollViewportRafRef.current = requestAnimationFrame(() => {
                                        scrollViewportRafRef.current = 0;
                                        if (!container || lyricLines.length === 0) return;
                                        const maxScroll = Math.max(1, container.scrollHeight - container.clientHeight);
                                        const ratio = Math.max(0, Math.min(1, container.scrollTop / maxScroll));
                                        const approxIdx = Math.round(ratio * (lyricLines.length - 1));
                                        setViewportCenterIndex(prev => (Math.abs(prev - approxIdx) >= 2 ? approxIdx : prev));
                                    });
                                }}
                                className="hide-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain py-6 landscape:py-3 px-1 space-y-4 landscape:space-y-3"
                            >
                                {lyricLines.map((line, index) => {
                                    const isActive = activeLineIndices.has(index);
                                    const isPassed = !isActive && index < currentLineIndex;
                                    const distanceFromViewport = Math.abs(index - viewportCenterIndex);
                                    const distanceFromActive = currentLineIndex >= 0 ? Math.abs(index - currentLineIndex) : distanceFromViewport;
                                    // Viewport Culling: Only apply active syllable progress and blur within the visible viewport (±2 lines buffer)
                                    const isNearViewport = isActive || distanceFromViewport <= 6 || distanceFromActive <= 2;
                                    const shouldAnimateSyllables = isActive && isNearViewport && isPageVisible;
                                    const lineBlurFilter = !isActive && isNearViewport && distanceFromActive <= 2
                                        ? 'blur(0.5px)'
                                        : 'none';
                                    const lineDir = detectTextDirection(line.fullText);
                                    const isRtl = lineDir === 'rtl';
                                    const isDuetSecondAgent = Boolean(
                                        line.agentId && (line.agentId === 'v2' || line.agentId === '2' || line.agentId.endsWith('2')),
                                    );
                                    const baseRem = 1.35 * lyricsFontScale;
                                    const bgVocals = line.backgroundVocals && line.backgroundVocals.length > 0
                                        ? line.backgroundVocals
                                        : line.backgroundVocal
                                            ? [line.backgroundVocal]
                                            : [];

                                    return (
                                        <div
                                            key={`${line.startTime}-${index}`}
                                            data-lyric-index={index}
                                            data-viewport-culled={isNearViewport ? 'false' : 'true'}
                                            dir={lineDir}
                                            onClick={() => {
                                                userScrollingLyricsUntilRef.current = 0;
                                                updateScrubberDOM(line.startTime, true);
                                                onLyricLineSeek(line.startTime);
                                            }}
                                            className={`cursor-pointer rounded-2xl px-3 py-2 transition-all duration-300 ${
                                                isDuetSecondAgent
                                                    ? (isRtl ? 'text-left' : 'text-right')
                                                    : (isRtl ? 'text-right' : 'text-left')
                                            } ${
                                                isActive
                                                    ? 'bg-white/[0.06] scale-[1.01] opacity-100'
                                                    : isPassed
                                                        ? 'opacity-40 hover:opacity-70'
                                                        : 'opacity-55 hover:opacity-80'
                                            }`}
                                            style={{
                                                unicodeBidi: 'isolate',
                                                filter: lineBlurFilter,
                                                transform: isActive ? 'translate3d(0, 0, 0) scale(1.01)' : 'translate3d(0, 0, 0)',
                                            }}
                                        >
                                            <div
                                                className={`flex flex-wrap items-baseline gap-x-1.5 gap-y-1 font-bold leading-snug ${
                                                    isDuetSecondAgent ? 'justify-end' : 'justify-start'
                                                }`}
                                                style={{
                                                    fontSize: `${baseRem.toFixed(2)}rem`,
                                                    direction: lineDir,
                                                }}
                                            >
                                                {shouldAnimateSyllables && line.words.length > 0 ? (
                                                    line.words.map((word, wIdx) => (
                                                        <MobileTimedWord
                                                            key={`${wIdx}-${word.startTime}`}
                                                            word={word}
                                                            currentTime={lyricCurrentTime}
                                                            activeColor={primaryColor}
                                                            inactiveColor="rgba(255,255,255,0.38)"
                                                            passedColor="rgba(255,255,255,0.82)"
                                                            glowColor={accentColor}
                                                            lineDirection={lineDir}
                                                        />
                                                    ))
                                                ) : (
                                                    <span
                                                        style={{
                                                            color: isActive ? primaryColor : '#e4e4e7',
                                                            unicodeBidi: 'isolate',
                                                        }}
                                                    >
                                                        {line.fullText}
                                                    </span>
                                                )}
                                            </div>

                                            {bgVocals.length > 0 && (
                                                <div className="mt-1 space-y-0.5">
                                                    {bgVocals.map((bg, bgIdx) => {
                                                        const bgDir = detectTextDirection(bg.text);
                                                        return (
                                                            <div
                                                                key={bgIdx}
                                                                dir={bgDir}
                                                                className="flex flex-wrap items-baseline gap-x-1 text-xs font-medium italic text-zinc-300/80"
                                                                style={{ unicodeBidi: 'isolate', direction: bgDir }}
                                                            >
                                                                <span>(</span>
                                                                {shouldAnimateSyllables && bg.words && bg.words.length > 0 ? (
                                                                    bg.words.map((bgWord, bwIdx) => (
                                                                        <MobileTimedWord
                                                                            key={`bg-${bgIdx}-${bwIdx}-${bgWord.startTime}`}
                                                                            word={bgWord}
                                                                            currentTime={lyricCurrentTime}
                                                                            activeColor={primaryColor}
                                                                            inactiveColor="rgba(255,255,255,0.42)"
                                                                            passedColor="rgba(255,255,255,0.78)"
                                                                            glowColor={accentColor}
                                                                            lineDirection={bgDir}
                                                                        />
                                                                    ))
                                                                ) : (
                                                                    <span>{bg.text}</span>
                                                                )}
                                                                <span>)</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {showSubtitleTranslation && line.translation && (
                                                <p
                                                    dir={detectTextDirection(line.translation)}
                                                    className="mt-1.5 text-sm font-medium text-zinc-300/80 leading-relaxed"
                                                    style={{ unicodeBidi: 'isolate' }}
                                                >
                                                    {line.translation}
                                                </p>
                                            )}
                                            {line.romanization && (
                                                <p
                                                    dir="ltr"
                                                    className="mt-0.5 text-xs text-zinc-400/75"
                                                    style={{ unicodeBidi: 'isolate' }}
                                                >
                                                    {line.romanization}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Inline Visualizer Style Selector Strip in Lyrics Mode (works in both portrait and landscape) */}
                        <VisualizerStyleSelectorStrip
                            visualizerMode={visualizerMode}
                            accentColor={accentColor}
                            onSelectMode={onVisualizerModeChange}
                            onOpenAllStyles={() => onChangeSubDrawer(subDrawer === 'lyrics-tools' ? 'none' : 'lyrics-tools')}
                            compact
                        />
                    </div>
                )}

                {displayMode === 'stage' && (
                    /* Full-Screen Folia Visualizer Canvas Tap Zone + Always-Reachable Visualizer Picker Bar */
                    <div
                        onClick={() => setStageChromeHidden(prev => !prev)}
                        className="flex min-h-0 min-w-0 flex-1 flex-col justify-end w-full cursor-pointer"
                    >
                        {!stageChromeHidden && (
                            <div className="mb-1 min-w-0 w-full">
                                <VisualizerStyleSelectorStrip
                                    visualizerMode={visualizerMode}
                                    accentColor={accentColor}
                                    onSelectMode={onVisualizerModeChange}
                                    onOpenAllStyles={() => onChangeSubDrawer(subDrawer === 'lyrics-tools' ? 'none' : 'lyrics-tools')}
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Bottom / Right-Side Cohesive Player Controls Dock:
                    Uses restrained artwork-derived gradient + frosted blur in Cover mode so the progress bar and
                    transport controls blend organically with the Dynamic Album Cover while keeping text & controls crisp. */}
                <div
                    data-testid="mobile-cohesive-controls-dock"
                    className={`w-full shrink-0 landscape:w-[42%] landscape:max-w-[360px] min-w-0 flex flex-col justify-center space-y-2.5 landscape:space-y-1.5 rounded-3xl px-3.5 py-2.5 transition-opacity duration-300 ${
                        displayMode === 'stage' && stageChromeHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'
                    }`}
                    style={
                        displayMode === 'cover'
                            ? {
                                  background: `linear-gradient(180deg, color-mix(in srgb, ${accentColor} 11%, rgba(255,255,255,0.03)) 0%, color-mix(in srgb, ${bgTint} 74%, rgba(8,8,12,0.78)) 100%)`,
                                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
                                  backdropFilter: 'blur(20px)',
                                  WebkitBackdropFilter: 'blur(20px)',
                              }
                            : undefined
                    }
                >
                    {/* Track Title, Artist/Album, and Like Button */}
                    <div className="flex items-center justify-between gap-2.5">
                        <div className="min-w-0 flex-1">
                            <h2
                                dir={titleDir}
                                className="truncate text-base landscape:text-sm font-bold tracking-tight text-white"
                                style={{ unicodeBidi: 'plaintext' }}
                            >
                                {currentSong.name}
                            </h2>
                            <p
                                dir={artistDir}
                                className="truncate text-xs font-medium text-zinc-300/90 mt-0.5"
                                style={{ unicodeBidi: 'plaintext' }}
                            >
                                {artistName}{albumName ? ` · ${albumName}` : ''}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={onToggleLike}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-zinc-200 active:scale-90 transition-transform"
                            aria-label={isLiked ? 'Remove from favorites' : 'Add to favorites'}
                        >
                            <Heart
                                size={19}
                                className={isLiked ? 'text-rose-500 fill-rose-500' : 'text-zinc-200'}
                            />
                        </button>
                    </div>

                    {/* Touch-Safe Progress Scrubber with Artwork-Derived Gradient & Readable Time Labels */}
                    <div className="space-y-1 touch-none">
                        <div dir="ltr" className="relative flex h-7 landscape:h-6 items-center touch-pan-x">
                            <div
                                className="relative h-1.5 w-full overflow-hidden rounded-full"
                                style={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.16)',
                                    boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.35)',
                                }}
                            >
                                <div
                                    ref={progressFillRef}
                                    className="h-full w-full origin-left rounded-full"
                                    style={{
                                        backgroundImage: `linear-gradient(90deg, ${accentColor} 0%, ${primaryColor} 100%)`,
                                        boxShadow: `0 0 12px color-mix(in srgb, ${accentColor} 45%, transparent)`,
                                        transform: 'scaleX(0)',
                                    }}
                                />
                            </div>
                            <div
                                ref={progressThumbRef}
                                className="pointer-events-none absolute inset-x-0 h-3"
                                style={{ transform: 'translateX(0%)' }}
                            >
                                <div
                                    className="h-3.5 w-3.5 -translate-x-1/2 rounded-full"
                                    style={{
                                        backgroundColor: '#ffffff',
                                        boxShadow: `0 0 10px color-mix(in srgb, ${accentColor} 65%, rgba(0,0,0,0.5))`,
                                    }}
                                />
                            </div>
                            <input
                                ref={rangeInputRef}
                                type="range"
                                min={0}
                                max={duration > 0 ? duration : 100}
                                step={0.1}
                                defaultValue={0}
                                aria-label="Seek progress"
                                onPointerDown={(e) => {
                                    isScrubbingRef.current = true;
                                    try {
                                        e?.currentTarget?.setPointerCapture?.(e.pointerId);
                                    } catch {
                                        // Ignore in synthetic test events
                                    }
                                    if (typeof e?.clientX === 'number') {
                                        const val = resolveSeekValueFromEvent(e.currentTarget, e.clientX);
                                        updateScrubberDOM(val, true);
                                    }
                                }}
                                onPointerMove={(e) => {
                                    if (!isScrubbingRef.current || typeof e?.clientX !== 'number') return;
                                    const val = resolveSeekValueFromEvent(e.currentTarget, e.clientX);
                                    updateScrubberDOM(val, true);
                                    const indices = Array.from(computeActiveLyricLineIndices(lyricLines, currentLineIndex, val)).sort((a, b) => a - b);
                                    const key = indices.join(',');
                                    setActiveLineSetKey(prev => (prev === key ? prev : key));
                                }}
                                onTouchStart={(e) => {
                                    isScrubbingRef.current = true;
                                    const touchX = e?.touches?.[0]?.clientX;
                                    if (typeof touchX === 'number') {
                                        const val = resolveSeekValueFromEvent(e?.currentTarget, touchX);
                                        updateScrubberDOM(val, true);
                                    }
                                }}
                                onTouchMove={(e) => {
                                    if (!isScrubbingRef.current) return;
                                    const touchX = e?.touches?.[0]?.clientX;
                                    if (typeof touchX === 'number') {
                                        const val = resolveSeekValueFromEvent(e?.currentTarget, touchX);
                                        updateScrubberDOM(val, true);
                                        const indices = Array.from(computeActiveLyricLineIndices(lyricLines, currentLineIndex, val)).sort((a, b) => a - b);
                                        const key = indices.join(',');
                                        setActiveLineSetKey(prev => (prev === key ? prev : key));
                                    }
                                }}
                                onInput={(e) => {
                                    const val = Number(e?.currentTarget?.value);
                                    updateScrubberDOM(val, true);
                                    const indices = Array.from(computeActiveLyricLineIndices(lyricLines, currentLineIndex, val)).sort((a, b) => a - b);
                                    const key = indices.join(',');
                                    setActiveLineSetKey(prev => (prev === key ? prev : key));
                                }}
                                onPointerUp={(e) => {
                                    const val = resolveSeekValueFromEvent(e?.currentTarget, e?.clientX);
                                    isScrubbingRef.current = false;
                                    commitSeekOnce(val);
                                }}
                                onTouchEnd={(e) => {
                                    if (!isScrubbingRef.current) return;
                                    const touchX = e?.changedTouches?.[0]?.clientX;
                                    const val = resolveSeekValueFromEvent(e?.currentTarget, touchX);
                                    isScrubbingRef.current = false;
                                    commitSeekOnce(val);
                                }}
                                onPointerCancel={() => {
                                    isScrubbingRef.current = false;
                                    updateScrubberDOM(currentTime.get(), true);
                                }}
                                onTouchCancel={() => {
                                    isScrubbingRef.current = false;
                                    updateScrubberDOM(currentTime.get(), true);
                                }}
                                onBlur={() => {
                                    if (isScrubbingRef.current) {
                                        isScrubbingRef.current = false;
                                        updateScrubberDOM(currentTime.get(), true);
                                    }
                                }}
                                onChange={(e) => {
                                    if (!isScrubbingRef.current) {
                                        const val = Number(e.currentTarget.value);
                                        commitSeekOnce(val);
                                    }
                                }}
                                className="absolute inset-0 h-full w-full cursor-pointer opacity-0 touch-pan-x"
                            />
                        </div>
                        <div className="flex items-center justify-between text-[11px] font-mono font-medium text-zinc-200/90">
                            <span ref={currentTimeTextRef}>00:00</span>
                            <span>{formatSeconds(duration)}</span>
                        </div>
                    </div>

                    {/* Primary Thumb-Friendly Transport Row */}
                    <div className="flex items-center justify-between px-1">
                        <button
                            type="button"
                            onClick={onToggleLoop}
                            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-200 hover:bg-white/10 active:scale-95 transition-all"
                            aria-label={`Loop mode: ${loopMode}`}
                        >
                            {loopMode === 'one' ? (
                                <Repeat1 size={19} style={{ color: accentColor }} />
                            ) : (
                                <Repeat size={19} className={loopMode === 'all' ? 'text-white' : 'opacity-55'} />
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={onPrevTrack}
                            className="flex h-11 w-11 landscape:h-10 landscape:w-10 items-center justify-center rounded-full text-white hover:bg-white/10 active:scale-90 transition-all"
                            aria-label="Previous track"
                        >
                            <SkipBack size={24} fill="currentColor" />
                        </button>

                        <button
                            type="button"
                            onClick={onTogglePlay}
                            className="flex h-14 w-14 landscape:h-12 landscape:w-12 items-center justify-center rounded-full text-zinc-950 shadow-[0_8px_28px_rgba(255,255,255,0.22)] active:scale-95 transition-transform"
                            style={{ backgroundColor: accentColor }}
                            aria-label={isPlaying ? 'Pause' : 'Play'}
                        >
                            {isPlaying ? (
                                <Pause size={25} fill="currentColor" />
                            ) : (
                                <Play size={25} fill="currentColor" className="ml-0.5" />
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={onNextTrack}
                            className="flex h-11 w-11 landscape:h-10 landscape:w-10 items-center justify-center rounded-full text-white hover:bg-white/10 active:scale-90 transition-all"
                            aria-label="Next track"
                        >
                            <SkipForward size={24} fill="currentColor" />
                        </button>

                        <button
                            type="button"
                            onClick={onShuffleQueue}
                            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-200 hover:bg-white/10 active:scale-95 transition-all"
                            aria-label="Shuffle queue"
                        >
                            <Shuffle size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Sub-Drawer 1: Visualizer Style Selection, Dynamic Album Artwork, Lyric File Selection, Offset Correction & Immersive Toggle */}
            {subDrawer === 'lyrics-tools' && (
                <div
                    data-testid="mobile-lyrics-tools-drawer"
                    onClick={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    className="absolute inset-x-0 bottom-0 z-30 max-h-[86dvh] landscape:max-h-[90dvh] overflow-y-auto overscroll-contain rounded-t-3xl border-t border-white/15 bg-[#0c0c12]/98 p-4 sm:p-5 shadow-2xl backdrop-blur-2xl space-y-4"
                    style={{ paddingBottom: 'max(var(--folia-native-inset-bottom, env(safe-area-inset-bottom, 0px)), 16px)' }}
                >
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm sm:text-base font-bold text-white">Visualizer & Lyrics Tools</h3>
                        <button
                            type="button"
                            onClick={() => onChangeSubDrawer('none')}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-zinc-300"
                            aria-label="Close lyrics tools"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* 1. Visualizer Style Selector (First section so it is immediately accessible in landscape) */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                                Folia Visualizer Style ({activeVisualizerLabel})
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    onChangeSubDrawer('none');
                                    onOpenVisualizerSettings();
                                }}
                                className="flex items-center gap-1 text-xs font-medium text-zinc-300 underline"
                            >
                                <Wand2 size={12} />
                                Style Parameters
                            </button>
                        </div>
                        <div
                            data-testid="mobile-drawer-visualizer-grid"
                            className="grid grid-cols-3 sm:grid-cols-4 landscape:grid-cols-5 gap-2"
                        >
                            {VISUALIZER_REGISTRY.map(entry => {
                                const active = visualizerMode === entry.mode;
                                return (
                                    <button
                                        key={entry.mode}
                                        type="button"
                                        data-testid={`drawer-visualizer-option-${entry.mode}`}
                                        aria-pressed={active}
                                        onClick={() => onVisualizerModeChange(entry.mode)}
                                        className={`min-h-[38px] rounded-xl border px-2.5 py-2 text-xs font-medium truncate transition-all active:scale-95 ${
                                            active
                                                ? 'border-white bg-white text-zinc-950 font-semibold shadow-sm'
                                                : 'border-white/10 bg-white/[0.04] text-zinc-200 hover:bg-white/10'
                                        }`}
                                    >
                                        {getVisualizerModeLabel(entry.mode, t)}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 1b. Original Folia Background Style Selector (GPU-Accelerated) */}
                    <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                                {t('options.visualizerBackgroundMode', 'Background Style')} ({getVisualizerBackgroundModeLabel(activeBackgroundMode, t)})
                            </span>
                            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                                GPU Accelerated
                            </span>
                        </div>
                        <div
                            data-testid="mobile-drawer-background-mode-grid"
                            className="grid grid-cols-3 sm:grid-cols-5 gap-2"
                        >
                            {VISUALIZER_BACKGROUND_REGISTRY.filter(entry => entry.mode !== 'url').map(entry => {
                                const active = activeBackgroundMode === entry.mode;
                                return (
                                    <button
                                        key={entry.mode}
                                        type="button"
                                        data-testid={`drawer-background-option-${entry.mode}`}
                                        aria-pressed={active}
                                        onClick={() => handleSetVisualizerBackgroundMode(entry.mode)}
                                        className={`min-h-[36px] rounded-xl border px-2.5 py-1.5 text-xs font-medium truncate transition-all active:scale-95 ${
                                            active
                                                ? 'border-white bg-white text-zinc-950 font-semibold shadow-sm'
                                                : 'border-white/10 bg-white/[0.05] text-zinc-200 hover:bg-white/10'
                                        }`}
                                    >
                                        {getVisualizerBackgroundModeLabel(entry.mode, t)}
                                    </button>
                                );
                            })}
                        </div>
                        {activeBackgroundMode === 'common' && (
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                <button
                                    type="button"
                                    data-testid="drawer-toggle-cover-color-bg"
                                    aria-pressed={useCoverColorBg}
                                    onClick={() => handleToggleCoverColorBg(!useCoverColorBg)}
                                    className={`h-8 rounded-xl border px-3 text-xs font-medium transition-all ${
                                        useCoverColorBg
                                            ? 'border-white bg-white/15 text-white'
                                            : 'border-white/10 bg-white/[0.03] text-zinc-400'
                                    }`}
                                >
                                    {t('theme.addCoverColor', 'Cover Fluid Color')}: {useCoverColorBg ? 'On' : 'Off'}
                                </button>
                                <button
                                    type="button"
                                    data-testid="drawer-toggle-geometric-shapes"
                                    aria-pressed={!disableVisualizerGeometricBackground}
                                    onClick={() => handleToggleDisableVisualizerGeometricBackground(!disableVisualizerGeometricBackground)}
                                    className={`h-8 rounded-xl border px-3 text-xs font-medium transition-all ${
                                        !disableVisualizerGeometricBackground
                                            ? 'border-white bg-white/15 text-white'
                                            : 'border-white/10 bg-white/[0.03] text-zinc-400'
                                    }`}
                                >
                                    {t('options.visualizerGeometricBackground', 'Geometric Shapes')}: {!disableVisualizerGeometricBackground ? 'On' : 'Off'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* 2. Full-Screen Local Album Video Cover & Manual Album-Video Association Selector */}
                    <div
                        data-testid="drawer-album-video-card"
                        className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 space-y-2.5"
                    >
                        <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                                    <Film size={13} style={{ color: accentColor }} />
                                    <span>{t('options.albumVideoCovers', 'Full-Screen Local Album Video Covers')}</span>
                                </div>
                                <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                                    {resolvedAlbumVideo.video
                                        ? `Matched: ${resolvedAlbumVideo.video.fileName} (${resolvedAlbumVideo.origin})`
                                        : effectiveAlbumVideoUrl
                                            ? 'Album video active'
                                            : `No matching video for "${albumName || currentSong.album?.name || 'Album'}"`}
                                </p>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                data-testid="drawer-switch-album-video"
                                aria-checked={albumVideoEnabled}
                                aria-label="Full-Screen Local Album Video Covers"
                                onClick={() => setAlbumVideoEnabled(!albumVideoEnabled)}
                                className={`h-8 shrink-0 rounded-full border px-3 text-xs font-semibold transition-all ${
                                    albumVideoEnabled
                                        ? 'border-white bg-white text-zinc-950'
                                        : 'border-white/15 bg-white/[0.06] text-zinc-300'
                                }`}
                            >
                                {albumVideoEnabled ? 'On' : 'Off'}
                            </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                            <select
                                data-testid="drawer-album-video-selector"
                                aria-label="Select video for current album"
                                value={
                                    resolvedAlbumVideo.origin === 'manual'
                                        ? (resolvedAlbumVideo.video?.id ?? '__none__')
                                        : '__auto__'
                                }
                                onChange={async (e) => {
                                    const val = e.target.value;
                                    const targetAlbum = albumName || currentSong.album?.name || currentSong.name;
                                    if (val === '__auto__') {
                                        await resetAlbumVideoAssociation(targetAlbum, folderName);
                                    } else if (val === '__none__') {
                                        await assignVideoToAlbum(targetAlbum, null, artistName, folderName);
                                    } else {
                                        await assignVideoToAlbum(targetAlbum, val, artistName, folderName);
                                    }
                                    setVideoCatalogTick(t => t + 1);
                                }}
                                className="h-9 min-w-[160px] flex-1 rounded-xl border border-white/12 bg-[#14141c] px-2.5 text-xs text-zinc-200 focus:outline-none"
                            >
                                <option value="__auto__">Auto-match by album name</option>
                                <option value="__none__">None (use album artwork)</option>
                                {getRegisteredAlbumVideos().map(video => (
                                    <option key={video.id} value={video.id}>
                                        {video.fileName}
                                    </option>
                                ))}
                            </select>

                            <button
                                type="button"
                                data-testid="drawer-add-video-folder-btn"
                                onClick={async () => {
                                    await importAlbumVideoFolder();
                                    setVideoCatalogTick(t => t + 1);
                                }}
                                className="flex h-9 items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] px-3 text-xs font-medium text-zinc-200"
                            >
                                <span>Add Video Folder</span>
                            </button>

                            <button
                                type="button"
                                data-testid="drawer-import-video-file-btn"
                                onClick={() => albumVideoFileInputRef.current?.click()}
                                className="flex h-9 items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] px-3 text-xs font-medium text-zinc-200"
                            >
                                <FileUp size={13} />
                                <span>Pick Video File</span>
                            </button>
                        </div>
                    </div>

                    {/* 2b. Dynamic Album Artwork & Full-Screen Lyrics Mode Switches */}
                    <div className="grid grid-cols-1 landscape:grid-cols-2 gap-3 pt-1">
                        <div
                            data-testid="drawer-dynamic-artwork-card"
                            className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5"
                        >
                            <div className="min-w-0 pr-1">
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                                    <Disc3 size={13} style={{ color: accentColor }} />
                                    <span>{t('options.dynamicAlbumArtwork', 'Dynamic Album Artwork')}</span>
                                </div>
                                <p className="text-[11px] text-zinc-400 truncate">
                                    {dynamicArtworkEnabled ? `Animated (${dynamicArtworkIntensity})` : 'Original static cover'}
                                </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                                {dynamicArtworkEnabled && (
                                    <button
                                        type="button"
                                        data-testid="drawer-dynamic-artwork-intensity-btn"
                                        onClick={() =>
                                            setDynamicArtworkIntensity(
                                                dynamicArtworkIntensity === 'normal' ? 'low' : 'normal',
                                            )
                                        }
                                        className="h-8 rounded-xl border border-white/12 bg-white/[0.06] px-2.5 text-[11px] font-medium capitalize text-zinc-200"
                                        title="Switch Dynamic Artwork motion intensity"
                                    >
                                        {dynamicArtworkIntensity}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    role="switch"
                                    data-testid="drawer-switch-dynamic-artwork"
                                    aria-checked={dynamicArtworkEnabled}
                                    aria-label="Dynamic Album Artwork"
                                    onClick={() => setDynamicArtworkEnabled(!dynamicArtworkEnabled)}
                                    className={`h-8 shrink-0 rounded-full border px-3 text-xs font-semibold transition-all ${
                                        dynamicArtworkEnabled
                                            ? 'border-white bg-white text-zinc-950'
                                            : 'border-white/15 bg-white/[0.06] text-zinc-300'
                                    }`}
                                >
                                    {dynamicArtworkEnabled ? 'On' : 'Off'}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5">
                            <div className="min-w-0 pr-2">
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                                    <Maximize2 size={13} style={{ color: accentColor }} />
                                    <span>Full-screen lyrics mode</span>
                                </div>
                                <p className="text-[11px] text-zinc-400 truncate">
                                    Hide status & navigation bars in lyrics/visualizer
                                </p>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={fullScreenLyricsMode}
                                aria-label="Full-screen lyrics mode"
                                onClick={() => setFullScreenLyricsMode(!fullScreenLyricsMode)}
                                className={`h-8 shrink-0 rounded-full border px-3 text-xs font-semibold transition-all ${
                                    fullScreenLyricsMode
                                        ? 'border-white bg-white text-zinc-950'
                                        : 'border-white/15 bg-white/[0.06] text-zinc-300'
                                }`}
                            >
                                {fullScreenLyricsMode ? 'On' : 'Off'}
                            </button>
                        </div>
                    </div>

                    {/* 3. Font Size & Translation Toggle */}
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5">
                        <div className="flex-1 space-y-1">
                            <div className="flex justify-between text-xs text-zinc-300">
                                <span>Lyrics Size</span>
                                <span>{Math.round(lyricsFontScale * 100)}%</span>
                            </div>
                            <input
                                type="range"
                                min={0.75}
                                max={1.45}
                                step={0.05}
                                value={lyricsFontScale}
                                onChange={(e) => onLyricsFontScaleChange(Number(e.target.value))}
                                className="w-full accent-white touch-none"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => onToggleSubtitleTranslation(!showSubtitleTranslation)}
                            className={`h-9 shrink-0 rounded-xl border px-3 text-xs font-medium ${
                                showSubtitleTranslation
                                    ? 'border-white bg-white/15 text-white'
                                    : 'border-white/10 bg-white/[0.04] text-zinc-400'
                            }`}
                        >
                            Translation: {showSubtitleTranslation ? 'On' : 'Off'}
                        </button>
                    </div>

                    {/* 4. Lyric Source & File + Timeline Offset */}
                    <div className="grid grid-cols-1 landscape:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                                Lyric Source & File
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => lyricFileInputRef.current?.click()}
                                    className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-white text-xs font-semibold text-zinc-950"
                                >
                                    <FileUp size={14} />
                                    Import .LRC / .TTML
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onChangeSubDrawer('none');
                                        onOpenLyricMatch();
                                    }}
                                    className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] text-xs font-semibold text-white"
                                >
                                    <Search size={14} />
                                    Match Online Lyrics
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {onAutoMatchLyrics && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onChangeSubDrawer('none');
                                            onAutoMatchLyrics();
                                        }}
                                        className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.05] text-xs font-medium text-zinc-200"
                                    >
                                        <Sparkles size={13} style={{ color: accentColor }} />
                                        Auto-Match Online
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => onChangeSubDrawer('equalizer')}
                                    className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.05] text-xs font-medium text-zinc-200"
                                >
                                    <Sliders size={13} style={{ color: accentColor }} />
                                    Audio Equalizer {isEqualizerEnabled ? '(On)' : ''}
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                {(['local', 'embedded', 'online'] as const).map(src => (
                                    <button
                                        key={src}
                                        type="button"
                                        onClick={() => onChangeLyricsSource(src)}
                                        className={`flex-1 rounded-lg py-1.5 text-xs font-medium capitalize border transition-colors ${
                                            activeLocalLyricsSource === src
                                                ? 'border-white bg-white/15 text-white'
                                                : 'border-white/10 bg-white/[0.03] text-zinc-400'
                                        }`}
                                    >
                                        {src}
                                    </button>
                                ))}
                            </div>
                            <div className="pt-1 space-y-1.5">
                                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                                    <span>Preferred Auto Lyric Service (No API Key)</span>
                                    <span className="font-semibold text-zinc-200 uppercase">
                                        {preferredAlternativeLyricSource}
                                    </span>
                                </div>
                                <div
                                    data-testid="drawer-preferred-lyric-provider-strip"
                                    className="grid grid-cols-5 gap-1.5"
                                >
                                    {LYRIC_SOURCES.filter(source => !source.needsAccount).map(source => {
                                        const provider = { id: source.id, label: t(source.labelKey, source.id.toUpperCase()) };
                                        const active = preferredAlternativeLyricSource === provider.id;
                                        return (
                                            <button
                                                key={provider.id}
                                                type="button"
                                                data-testid={`drawer-lyric-provider-${provider.id}`}
                                                aria-pressed={active}
                                                onClick={() => {
                                                    handleSetPreferredAlternativeLyricSource(provider.id);
                                                    if (onAutoMatchLyrics) {
                                                        onAutoMatchLyrics();
                                                    }
                                                }}
                                                className={`rounded-lg py-1.5 text-[11px] font-medium border transition-colors ${
                                                    active
                                                        ? 'border-white bg-white text-zinc-950 font-semibold'
                                                        : 'border-white/10 bg-white/[0.04] text-zinc-300'
                                                }`}
                                            >
                                                {provider.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold uppercase tracking-wider text-zinc-400">
                                    Timeline Offset
                                </span>
                                <span className="font-mono font-semibold text-zinc-200">
                                    {lyricTimelineOffsetMs > 0 ? `+${lyricTimelineOffsetMs}` : lyricTimelineOffsetMs} ms
                                </span>
                            </div>
                            <div className="grid grid-cols-5 gap-1.5">
                                {[
                                    { label: '-500ms', delta: -500 },
                                    { label: '-100ms', delta: -100 },
                                    { label: 'Reset', reset: true },
                                    { label: '+100ms', delta: 100 },
                                    { label: '+500ms', delta: 500 },
                                ].map((btn, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() =>
                                            onLyricTimelineOffsetChange(
                                                btn.reset ? 0 : lyricTimelineOffsetMs + (btn.delta ?? 0),
                                            )
                                        }
                                        className="h-10 rounded-xl border border-white/10 bg-white/[0.05] text-xs font-medium text-zinc-200 active:bg-white/20"
                                    >
                                        {btn.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Sub-Drawer 2: Play Queue */}
            {subDrawer === 'queue' && (
                <div
                    data-testid="mobile-queue-drawer"
                    className="absolute inset-x-0 bottom-0 z-30 flex max-h-[82dvh] landscape:max-h-[88dvh] flex-col rounded-t-3xl border-t border-white/15 bg-[#0c0c12]/98 p-4 sm:p-5 shadow-2xl backdrop-blur-2xl"
                    style={{ paddingBottom: 'max(var(--folia-native-inset-bottom, env(safe-area-inset-bottom, 0px)), 16px)' }}
                >
                    <div className="flex items-center justify-between pb-3 border-b border-white/10">
                        <div>
                            <h3 className="text-base font-bold text-white">Play Queue</h3>
                            <p className="text-xs text-zinc-400">{playQueue.length} tracks</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {onOpenLattice && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        onChangeSubDrawer('none');
                                        onOpenLattice();
                                    }}
                                    className="flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-xs font-medium text-white"
                                >
                                    <Grid size={13} />
                                    <span>Lattice Collage</span>
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setShowSavePlaylistInput(prev => !prev)}
                                className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-zinc-200"
                            >
                                Save as Playlist
                            </button>
                            <button
                                type="button"
                                onClick={() => onChangeSubDrawer('none')}
                                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-zinc-300"
                                aria-label="Close queue"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {showSavePlaylistInput && (
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                if (!newPlaylistName.trim()) return;
                                void onSaveQueueAsPlaylist(newPlaylistName.trim()).then(() => {
                                    setNewPlaylistName('');
                                    setShowSavePlaylistInput(false);
                                });
                            }}
                            className="mt-3 flex gap-2"
                        >
                            <input
                                type="text"
                                value={newPlaylistName}
                                onChange={(e) => setNewPlaylistName(e.target.value)}
                                placeholder="Playlist name..."
                                className="flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-xs text-white focus:outline-none"
                            />
                            <button
                                type="submit"
                                className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-zinc-950"
                            >
                                Save
                            </button>
                        </form>
                    )}

                    <div className="mt-3 flex-1 overflow-y-auto space-y-1.5 pr-1">
                        {playQueue.map((song, idx) => {
                            const isCurrent = song.id === currentSong.id;
                            const songDir = detectTextDirection(song.name || '');
                            return (
                                <div
                                    key={`${song.id}-${idx}`}
                                    className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 ${
                                        isCurrent ? 'bg-white/12 text-white' : 'hover:bg-white/[0.04] text-zinc-300'
                                    }`}
                                >
                                    <button
                                        type="button"
                                        onClick={() => onPlayQueueSong(song, playQueue)}
                                        className="min-w-0 flex-1 text-left"
                                    >
                                        <div
                                            dir={songDir}
                                            className="truncate text-sm font-medium"
                                            style={{ unicodeBidi: 'plaintext' }}
                                        >
                                            {song.name}
                                        </div>
                                        <div className="truncate text-xs text-zinc-400">
                                            {song.artists?.map(a => a.name).join(', ')}
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onRemoveQueueSong(idx)}
                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:text-rose-400"
                                        aria-label={`Remove ${song.name} from queue`}
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Sub-Drawer 3: 10-Band Audio Equalizer & Effects */}
            {subDrawer === 'equalizer' && (
                <div className="absolute inset-x-0 bottom-0 z-30">
                    <MobileEqualizerSheet
                        accentColor={accentColor}
                        onClose={() => onChangeSubDrawer('none')}
                        onOpenFullDesktopEqualizer={() => {
                            onChangeSubDrawer('none');
                            openDesktopEqualizer();
                        }}
                    />
                </div>
            )}
        </div>
    );
};

export default React.memo(MobileNowPlayingSheet);
