import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MotionValue, useMotionValueEvent } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
    ChevronDown,
    Disc3,
    FileText,
    FileUp,
    Grid,
    Heart,
    ListMusic,
    Music2,
    Pause,
    Play,
    Repeat,
    Repeat1,
    Search,
    Shuffle,
    SkipBack,
    SkipForward,
    SlidersHorizontal,
    Sparkles,
    Trash2,
    Wand2,
    X,
} from 'lucide-react';
import {
    type LyricData,
    type LyricLine,
    PlayerState,
    type SongResult,
    type Theme,
    type VisualizerMode,
} from '../../types';
import { detectTextDirection, resolveTokenDirection, type TextDirection } from '../../utils/lyrics/arabicText';
import type { Word as WordType } from '../../types';
import { getCachedLocalCoverObjectUrl, resolveLocalCoverObjectUrl } from '../../services/localCoverRuntime';
import { isLocalCoverAssetUrl } from '../../services/localCoverAssetUrl';
import { VISUALIZER_REGISTRY, getVisualizerModeLabel } from '../visualizer/registry';
import type { MobilePlayerDisplayMode, MobileSubDrawer } from './mobileNavigationModel';

// src/components/mobile/MobileNowPlayingSheet.tsx
// Full-screen Now Playing sheet for the Phase 4 mobile-first Android player.
// Supports 3 seamless modes:
//   - 'cover': Album-art hero + artwork-tinted OLED lighting + 2-line live synchronized lyric preview
//   - 'lyrics': Synchronized scrolling lyrics reader with full Arabic RTL shaping + word/syllable glow sweep
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
    const wordDir = useMemo(() => resolveTokenDirection(word.text, lineDirection), [lineDirection, word.text]);

    const applyWordProgress = useCallback((timeSec: number) => {
        const el = spanRef.current;
        if (!el) return;
        if (timeSec < word.startTime) {
            el.style.color = inactiveColor;
            el.style.backgroundImage = '';
            el.style.webkitBackgroundClip = '';
            el.style.backgroundClip = '';
            el.style.textShadow = 'none';
            return;
        }
        if (timeSec >= word.endTime) {
            el.style.color = passedColor;
            el.style.backgroundImage = '';
            el.style.webkitBackgroundClip = '';
            el.style.backgroundClip = '';
            el.style.textShadow = 'none';
            return;
        }
        const pct = computeTimedWordProgressPercent(word, timeSec);
        const angle = wordDir === 'rtl' ? '270deg' : '90deg';
        el.style.color = 'transparent';
        el.style.backgroundImage = `linear-gradient(${angle}, ${activeColor} 0%, ${activeColor} ${pct.toFixed(1)}%, ${inactiveColor} ${Math.min(100, pct + 12).toFixed(1)}%, ${inactiveColor} 100%)`;
        el.style.webkitBackgroundClip = 'text';
        el.style.backgroundClip = 'text';
        el.style.textShadow = `0 0 18px color-mix(in srgb, ${glowColor} 45%, transparent)`;
    }, [activeColor, glowColor, inactiveColor, passedColor, word, wordDir]);

    useEffect(() => {
        applyWordProgress(currentTime.get());
    }, [applyWordProgress, currentTime]);

    useMotionValueEvent(currentTime, 'change', applyWordProgress);

    return (
        <span
            ref={spanRef}
            dir={wordDir}
            className="inline-block whitespace-pre-wrap transition-transform duration-150"
            style={{
                color: inactiveColor,
                unicodeBidi: 'isolate',
                letterSpacing: '0px',
            }}
        >
            {word.text}
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
    const progressFillRef = useRef<HTMLDivElement>(null);
    const progressThumbRef = useRef<HTMLDivElement>(null);
    const currentTimeTextRef = useRef<HTMLSpanElement>(null);
    const rangeInputRef = useRef<HTMLInputElement>(null);
    const isScrubbingRef = useRef(false);
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

    // Track all concurrently active overlapping lyric lines from lyricCurrentTime
    const [activeLineSetKey, setActiveLineSetKey] = useState<string>(() => {
        const indices = Array.from(computeActiveLyricLineIndices(lyricLines, currentLineIndex, lyricCurrentTime.get())).sort((a, b) => a - b);
        return indices.join(',');
    });

    useEffect(() => {
        const indices = Array.from(computeActiveLyricLineIndices(lyricLines, currentLineIndex, lyricCurrentTime.get())).sort((a, b) => a - b);
        const key = indices.join(',');
        setActiveLineSetKey(prev => (prev === key ? prev : key));
    }, [currentLineIndex, lyricCurrentTime, lyricLines]);

    useMotionValueEvent(lyricCurrentTime, 'change', (latest: number) => {
        if (!isOpen || displayMode !== 'lyrics' || lyricLines.length === 0) return;
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

    if (!isOpen || !currentSong) {
        return null;
    }

    const isPlaying = playerState === PlayerState.PLAYING;
    const accentColor = theme.accentColor || theme.primaryColor || '#f4f4f5';
    const primaryColor = theme.primaryColor || '#ffffff';
    const bgTint = theme.backgroundColor || '#09090b';
    const titleDir = detectTextDirection(currentSong.name || '');
    const artistDir = detectTextDirection(artistName || '');
    const activeLine = currentLineIndex >= 0 && currentLineIndex < lyricLines.length ? lyricLines[currentLineIndex] : null;
    const nextLine = currentLineIndex + 1 >= 0 && currentLineIndex + 1 < lyricLines.length ? lyricLines[currentLineIndex + 1] : null;
    const effectiveCover = !coverLoadError ? resolvedCoverUrl : null;

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
            className="fixed inset-0 z-[200] flex flex-col overflow-hidden select-none text-zinc-100"
            style={{
                backgroundColor: displayMode === 'stage' ? 'transparent' : '#060609',
                paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)',
                paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)',
                paddingLeft: 'env(safe-area-inset-left, 0px)',
                paddingRight: 'env(safe-area-inset-right, 0px)',
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

            {/* OLED Artwork-Derived Ambient Background Layer (semi-translucent in Lyrics mode, hidden in Stage mode so Visualizer shines at 100%) */}
            {displayMode !== 'stage' && (
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 -z-10 transition-opacity duration-500"
                    style={{
                        opacity: displayMode === 'lyrics' ? 0.78 : 1,
                        background: `
                            radial-gradient(circle at 50% 22%, color-mix(in srgb, ${accentColor} 28%, transparent) 0%, transparent 62%),
                            radial-gradient(circle at 18% 78%, color-mix(in srgb, ${primaryColor} 18%, transparent) 0%, transparent 55%),
                            linear-gradient(180deg, color-mix(in srgb, ${bgTint} 65%, #060609) 0%, #050507 100%)
                        `,
                    }}
                />
            )}

            {/* Top Header Bar: Collapse + Mode Switcher (Cover / Lyrics / Stage) + Lyric Tools + Queue */}
            <div
                className={`relative z-20 flex items-center justify-between px-4 py-2 transition-opacity duration-300 ${
                    displayMode === 'stage' && stageChromeHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'
                }`}
            >
                <button
                    type="button"
                    onClick={onClose}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.07] text-zinc-200 backdrop-blur-md active:scale-95 transition-transform"
                    aria-label="Collapse player"
                >
                    <ChevronDown size={22} />
                </button>

                {/* Mode Switcher Pill */}
                <div
                    role="tablist"
                    aria-label="Player display mode"
                    className="flex items-center rounded-full border border-white/10 bg-black/50 p-1 backdrop-blur-xl"
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
                                className={`h-8 rounded-full px-3.5 text-xs font-semibold transition-all ${
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
                    {onOpenLattice && (
                        <button
                            type="button"
                            onClick={onOpenLattice}
                            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.07] text-zinc-200 backdrop-blur-md active:scale-95 transition-all"
                            aria-label="Open Lattice queue collage"
                            title="Lattice Queue Collage"
                        >
                            <Grid size={18} />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => onChangeSubDrawer(subDrawer === 'lyrics-tools' ? 'none' : 'lyrics-tools')}
                        className={`flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md active:scale-95 transition-all ${
                            subDrawer === 'lyrics-tools'
                                ? 'bg-white text-zinc-950'
                                : 'bg-white/[0.07] text-zinc-200'
                        }`}
                        aria-label="Lyrics and visualizer settings"
                    >
                        <SlidersHorizontal size={19} />
                    </button>
                    <button
                        type="button"
                        onClick={() => onChangeSubDrawer(subDrawer === 'queue' ? 'none' : 'queue')}
                        className={`flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md active:scale-95 transition-all ${
                            subDrawer === 'queue'
                                ? 'bg-white text-zinc-950'
                                : 'bg-white/[0.07] text-zinc-200'
                        }`}
                        aria-label="Play queue"
                    >
                        <ListMusic size={19} />
                    </button>
                </div>
            </div>

            {/* Main Content Area (Responsive: vertical in portrait, side-by-side in landscape) */}
            <div className="relative z-10 flex min-h-0 flex-1 flex-col landscape:flex-row landscape:items-center landscape:gap-6 px-5 pt-2 pb-1">
                {displayMode === 'cover' && (
                    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 landscape:flex-row landscape:justify-around">
                        {/* Prominent Album Artwork Card */}
                        <button
                            type="button"
                            onClick={() => onChangeDisplayMode('lyrics')}
                            className="group relative aspect-square w-full max-w-[min(76vw,340px)] landscape:max-w-[min(42vh,220px)] shrink-0 overflow-hidden rounded-3xl border border-white/15 bg-zinc-900 shadow-[0_24px_64px_rgba(0,0,0,0.75)] transition-transform duration-500 focus:outline-none"
                            style={{
                                transform: isPlaying ? 'scale(1)' : 'scale(0.94)',
                            }}
                            aria-label="Switch to synchronized lyrics view"
                        >
                            {effectiveCover ? (
                                <img
                                    src={effectiveCover}
                                    alt={currentSong.name}
                                    className="h-full w-full object-cover"
                                    onError={() => setCoverLoadError(true)}
                                />
                            ) : (
                                <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-zinc-800/80 to-zinc-950 text-zinc-500">
                                    <Disc3 size={72} strokeWidth={1.25} />
                                    <span className="text-xs font-medium tracking-wider uppercase text-zinc-400">Folia Audio</span>
                                </div>
                            )}
                            <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/65 px-3 py-1.5 text-[11px] font-medium text-white/90 backdrop-blur-md">
                                <Sparkles size={12} style={{ color: accentColor }} />
                                <span>Tap for Lyrics</span>
                            </div>
                        </button>

                        {/* Live 2-Line Synchronized Lyric Preview Pill */}
                        <button
                            type="button"
                            onClick={() => onChangeDisplayMode('lyrics')}
                            className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-center backdrop-blur-md active:scale-[0.99] transition-transform"
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
                                            className="truncate text-xs text-zinc-400"
                                            style={{ unicodeBidi: 'isolate' }}
                                        >
                                            {showSubtitleTranslation && activeLine.translation
                                                ? activeLine.translation
                                                : nextLine?.fullText}
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-xs text-zinc-400">
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
                    <div className="flex min-h-0 flex-1 flex-col w-full">
                        {isLyricsLoading ? (
                            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                                <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-white" />
                                <p className="text-sm text-zinc-300">Loading synchronized lyrics...</p>
                            </div>
                        ) : currentSong.isPureMusic && !hasRenderableLines ? (
                            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
                                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.06] text-zinc-300">
                                    <Music2 size={32} />
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
                                className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center"
                            >
                                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-zinc-300">
                                    <FileText size={30} />
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
                                        className="flex h-11 items-center gap-2 rounded-full bg-white px-5 text-xs font-semibold text-zinc-950 shadow-md active:scale-95 transition-transform"
                                    >
                                        <FileUp size={15} />
                                        Import Lyric File
                                    </button>
                                    <button
                                        type="button"
                                        onClick={onOpenLyricMatch}
                                        className="flex h-11 items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-5 text-xs font-semibold text-white active:scale-95 transition-transform"
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
                                className="hide-scrollbar flex-1 overflow-y-auto overscroll-contain py-10 px-1 space-y-5"
                            >
                                {lyricLines.map((line, index) => {
                                    const isActive = activeLineIndices.has(index);
                                    const isPassed = !isActive && index < currentLineIndex;
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
                                            dir={lineDir}
                                            onClick={() => onLyricLineSeek(line.startTime)}
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
                                            style={{ unicodeBidi: 'isolate' }}
                                        >
                                            {/* Main Timed Lyric Words with Arabic RTL shaping & directional highlight sweep */}
                                            <div
                                                className={`flex flex-wrap items-baseline gap-x-1.5 gap-y-1 font-bold leading-snug ${
                                                    isDuetSecondAgent ? 'justify-end' : 'justify-start'
                                                }`}
                                                style={{
                                                    fontSize: `${baseRem.toFixed(2)}rem`,
                                                    direction: lineDir,
                                                }}
                                            >
                                                {isActive && line.words.length > 0 ? (
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

                                            {/* Overlapping Background / Harmony Vocals */}
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
                                                                {isActive && bg.words && bg.words.length > 0 ? (
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

                                            {/* Subtitle Translation / Romanization */}
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
                    </div>
                )}

                {displayMode === 'stage' && (
                    /* Full-Screen Folia Visualizer Canvas Tap Zone + Quick Visualizer Picker Pill */
                    <div
                        onClick={() => setStageChromeHidden(prev => !prev)}
                        className="flex flex-1 flex-col justify-end w-full cursor-pointer"
                    >
                        {!stageChromeHidden && (
                            <div
                                onClick={(e) => e.stopPropagation()}
                                className="mb-2 flex items-center gap-1.5 overflow-x-auto hide-scrollbar rounded-2xl border border-white/10 bg-black/55 p-1.5 backdrop-blur-xl"
                            >
                                {VISUALIZER_REGISTRY.map(entry => {
                                    const active = visualizerMode === entry.mode;
                                    const label = getVisualizerModeLabel(entry.mode, t);
                                    return (
                                        <button
                                            key={entry.mode}
                                            type="button"
                                            onClick={() => onVisualizerModeChange(entry.mode)}
                                            className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                                                active
                                                    ? 'bg-white text-zinc-950 shadow-sm'
                                                    : 'text-zinc-300 hover:bg-white/10'
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Bottom Player Controls Dock (Track Metadata + Touch-Safe Scrubber + Transport Buttons) */}
                <div
                    className={`w-full shrink-0 landscape:w-[44%] space-y-3 pt-2 pb-1 transition-opacity duration-300 ${
                        displayMode === 'stage' && stageChromeHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'
                    }`}
                >
                    {/* Track Title, Artist/Album, and Like Button */}
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <h2
                                dir={titleDir}
                                className="truncate text-lg font-bold tracking-tight text-white"
                                style={{ unicodeBidi: 'plaintext' }}
                            >
                                {currentSong.name}
                            </h2>
                            <p
                                dir={artistDir}
                                className="truncate text-xs font-medium text-zinc-400 mt-0.5"
                                style={{ unicodeBidi: 'plaintext' }}
                            >
                                {artistName}{albumName ? ` · ${albumName}` : ''}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={onToggleLike}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-zinc-200 active:scale-90 transition-transform"
                            aria-label={isLiked ? 'Remove from favorites' : 'Add to favorites'}
                        >
                            <Heart
                                size={20}
                                className={isLiked ? 'text-rose-500 fill-rose-500' : 'text-zinc-300'}
                            />
                        </button>
                    </div>

                    {/* Touch-Safe Progress Scrubber (`touch-action: none` prevents accidental page scroll) */}
                    <div className="space-y-1.5 touch-none">
                        <div className="relative flex h-8 items-center touch-none">
                            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                                <div
                                    ref={progressFillRef}
                                    className="h-full w-full origin-left rounded-full"
                                    style={{
                                        backgroundColor: accentColor,
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
                                    className="h-3.5 w-3.5 -translate-x-1/2 rounded-full shadow-md"
                                    style={{ backgroundColor: '#ffffff' }}
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
                                    e.currentTarget.setPointerCapture(e.pointerId);
                                }}
                                onInput={(e) => {
                                    const val = Number(e.currentTarget.value);
                                    updateScrubberDOM(val, true);
                                }}
                                onPointerUp={(e) => {
                                    const val = Number(e.currentTarget.value);
                                    isScrubbingRef.current = false;
                                    updateScrubberDOM(val, true);
                                    onSeek(val);
                                }}
                                onPointerCancel={() => {
                                    isScrubbingRef.current = false;
                                    updateScrubberDOM(currentTime.get(), true);
                                }}
                                onChange={() => {}}
                                className="absolute inset-0 h-full w-full cursor-pointer opacity-0 touch-none"
                            />
                        </div>
                        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                            <span ref={currentTimeTextRef}>00:00</span>
                            <span>{formatSeconds(duration)}</span>
                        </div>
                    </div>

                    {/* Primary Thumb-Friendly Transport Row */}
                    <div className="flex items-center justify-between px-2">
                        <button
                            type="button"
                            onClick={onToggleLoop}
                            className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-300 hover:bg-white/10 active:scale-95 transition-all"
                            aria-label={`Loop mode: ${loopMode}`}
                        >
                            {loopMode === 'one' ? (
                                <Repeat1 size={20} style={{ color: accentColor }} />
                            ) : (
                                <Repeat size={20} className={loopMode === 'all' ? 'text-white' : 'opacity-50'} />
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={onPrevTrack}
                            className="flex h-12 w-12 items-center justify-center rounded-full text-white hover:bg-white/10 active:scale-90 transition-all"
                            aria-label="Previous track"
                        >
                            <SkipBack size={26} fill="currentColor" />
                        </button>

                        <button
                            type="button"
                            onClick={onTogglePlay}
                            className="flex h-16 w-16 items-center justify-center rounded-full text-zinc-950 shadow-[0_8px_28px_rgba(255,255,255,0.22)] active:scale-95 transition-transform"
                            style={{ backgroundColor: accentColor }}
                            aria-label={isPlaying ? 'Pause' : 'Play'}
                        >
                            {isPlaying ? (
                                <Pause size={28} fill="currentColor" />
                            ) : (
                                <Play size={28} fill="currentColor" className="ml-1" />
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={onNextTrack}
                            className="flex h-12 w-12 items-center justify-center rounded-full text-white hover:bg-white/10 active:scale-90 transition-all"
                            aria-label="Next track"
                        >
                            <SkipForward size={26} fill="currentColor" />
                        </button>

                        <button
                            type="button"
                            onClick={onShuffleQueue}
                            className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-300 hover:bg-white/10 active:scale-95 transition-all"
                            aria-label="Shuffle queue"
                        >
                            <Shuffle size={19} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Sub-Drawer 1: Lyric File Selection, Offset Correction & Display Settings */}
            {subDrawer === 'lyrics-tools' && (
                <div
                    data-testid="mobile-lyrics-tools-drawer"
                    className="absolute inset-x-0 bottom-0 z-30 max-h-[78dvh] overflow-y-auto rounded-t-3xl border-t border-white/15 bg-[#0c0c12]/98 p-5 shadow-2xl backdrop-blur-2xl space-y-5"
                    style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)' }}
                >
                    <div className="flex items-center justify-between">
                        <h3 className="text-base font-bold text-white">Lyrics & Visualizer Tools</h3>
                        <button
                            type="button"
                            onClick={() => onChangeSubDrawer('none')}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-zinc-300"
                            aria-label="Close lyrics tools"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Lyric File & Online Match Actions */}
                    <div className="space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                            Lyric Source & File
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                            <button
                                type="button"
                                onClick={() => lyricFileInputRef.current?.click()}
                                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-white text-xs font-semibold text-zinc-950"
                            >
                                <FileUp size={15} />
                                Import .LRC / .TTML
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    onChangeSubDrawer('none');
                                    onOpenLyricMatch();
                                }}
                                className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] text-xs font-semibold text-white"
                            >
                                <Search size={15} />
                                Match Online Lyrics
                            </button>
                        </div>

                        {/* Source selector pills */}
                        <div className="flex items-center gap-2 pt-1">
                            {(['local', 'embedded', 'online'] as const).map(src => (
                                <button
                                    key={src}
                                    type="button"
                                    onClick={() => onChangeLyricsSource(src)}
                                    className={`flex-1 rounded-lg py-2 text-xs font-medium capitalize border transition-colors ${
                                        activeLocalLyricsSource === src
                                            ? 'border-white bg-white/15 text-white'
                                            : 'border-white/10 bg-white/[0.03] text-zinc-400'
                                    }`}
                                >
                                    {src}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Lyric Timeline Offset Correction */}
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

                    {/* Visualizer Style Selector */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                                Folia Visualizer Style
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
                        <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
                            {VISUALIZER_REGISTRY.map(entry => {
                                const active = visualizerMode === entry.mode;
                                return (
                                    <button
                                        key={entry.mode}
                                        type="button"
                                        onClick={() => onVisualizerModeChange(entry.mode)}
                                        className={`rounded-xl border px-2.5 py-2 text-xs font-medium truncate transition-all ${
                                            active
                                                ? 'border-white bg-white text-zinc-950 font-semibold'
                                                : 'border-white/10 bg-white/[0.04] text-zinc-300'
                                        }`}
                                    >
                                        {getVisualizerModeLabel(entry.mode, t)}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Font Size & Translation Toggle */}
                    <div className="flex items-center justify-between gap-4 pt-1">
                        <div className="flex-1 space-y-1">
                            <div className="flex justify-between text-xs text-zinc-400">
                                <span>Lyrics Text Size</span>
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
                            className={`h-10 rounded-xl border px-3.5 text-xs font-medium ${
                                showSubtitleTranslation
                                    ? 'border-white bg-white/15 text-white'
                                    : 'border-white/10 bg-white/[0.04] text-zinc-400'
                            }`}
                        >
                            Translation: {showSubtitleTranslation ? 'On' : 'Off'}
                        </button>
                    </div>
                </div>
            )}

            {/* Sub-Drawer 2: Play Queue */}
            {subDrawer === 'queue' && (
                <div
                    data-testid="mobile-queue-drawer"
                    className="absolute inset-x-0 bottom-0 z-30 flex max-h-[78dvh] flex-col rounded-t-3xl border-t border-white/15 bg-[#0c0c12]/98 p-5 shadow-2xl backdrop-blur-2xl"
                    style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)' }}
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
        </div>
    );
};

export default React.memo(MobileNowPlayingSheet);
