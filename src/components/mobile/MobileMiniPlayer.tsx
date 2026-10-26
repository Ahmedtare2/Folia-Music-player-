import React, { useEffect, useRef, useState } from 'react';
import { MotionValue, useMotionValueEvent } from 'framer-motion';
import { Disc3, Pause, Play, SkipForward, Sparkles } from 'lucide-react';
import { PlayerState, type SongResult, type Theme } from '../../types';
import { detectTextDirection } from '../../utils/lyrics/arabicText';
import { getCachedLocalCoverObjectUrl, resolveLocalCoverObjectUrl } from '../../services/localCoverRuntime';
import { isLocalCoverAssetUrl } from '../../services/localCoverAssetUrl';

// src/components/mobile/MobileMiniPlayer.tsx
// Persistent OLED-friendly mini-player bar shown above the mobile bottom navigation tabs.
// Uses a compositor-driven progress hairline updated via useMotionValueEvent so playback time
// ticks never trigger React component re-renders.

interface MobileMiniPlayerProps {
    currentSong: SongResult | null;
    artistName: string;
    coverUrl: string | null;
    playerState: PlayerState;
    currentTime: MotionValue<number>;
    duration: number;
    theme: Theme;
    hasLyrics: boolean;
    onExpandCover: () => void;
    onExpandLyrics: () => void;
    onTogglePlay: () => void;
    onNextTrack: () => void;
}

export const MobileMiniPlayer: React.FC<MobileMiniPlayerProps> = ({
    currentSong,
    artistName,
    coverUrl,
    playerState,
    currentTime,
    duration,
    theme,
    hasLyrics,
    onExpandCover,
    onExpandLyrics,
    onTogglePlay,
    onNextTrack,
}) => {
    const progressFillRef = useRef<HTMLDivElement>(null);
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

    useMotionValueEvent(currentTime, 'change', (latest: number) => {
        if (!progressFillRef.current) return;
        const pct = duration > 0 ? Math.max(0, Math.min(100, (latest / duration) * 100)) : 0;
        progressFillRef.current.style.transform = `scaleX(${(pct / 100).toFixed(4)})`;
    });

    if (!currentSong) {
        return null;
    }

    const isPlaying = playerState === PlayerState.PLAYING;
    const titleDir = detectTextDirection(currentSong.name || '');
    const artistDir = detectTextDirection(artistName || '');
    const accentColor = theme.accentColor || theme.primaryColor || '#f4f4f5';
    const effectiveCover = !coverLoadError ? resolvedCoverUrl : null;

    return (
        <div
            data-testid="mobile-mini-player"
            className="relative mx-2.5 mb-1.5 overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d12]/95 shadow-[0_12px_32px_rgba(0,0,0,0.65)]"
            style={{
                backgroundImage: `linear-gradient(110deg, color-mix(in srgb, ${accentColor} 14%, #0c0c12) 0%, #09090d 70%)`,
            }}
        >
            {/* Top Progress Hairline */}
            <div className="h-[2.5px] w-full bg-white/10 overflow-hidden">
                <div
                    ref={progressFillRef}
                    className="h-full w-full origin-left transition-transform duration-75"
                    style={{
                        backgroundColor: accentColor,
                        transform: 'scaleX(0)',
                    }}
                />
            </div>

            <div className="flex items-center gap-3 px-3 py-2">
                {/* Tap area to open Now Playing (Cover view) */}
                <button
                    type="button"
                    onClick={onExpandCover}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left focus:outline-none"
                    aria-label={`Open player for ${currentSong.name}`}
                >
                    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-md">
                        {effectiveCover ? (
                            <img
                                src={effectiveCover}
                                alt={currentSong.name}
                                className="h-full w-full object-cover"
                                loading="lazy"
                                onError={() => setCoverLoadError(true)}
                            />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center text-white/40">
                                <Disc3 size={22} className={isPlaying ? 'animate-spin' : ''} style={{ animationDuration: '8s' }} />
                            </div>
                        )}
                    </div>

                    <div className="min-w-0 flex-1">
                        <div
                            dir={titleDir}
                            className="truncate text-sm font-semibold text-zinc-100 leading-snug"
                            style={{ unicodeBidi: 'plaintext' }}
                        >
                            {currentSong.name}
                        </div>
                        <div
                            dir={artistDir}
                            className="truncate text-xs text-zinc-400 leading-tight mt-0.5"
                            style={{ unicodeBidi: 'plaintext' }}
                        >
                            {artistName}
                        </div>
                    </div>
                </button>

                {/* Quick Lyrics / Visualizer jump button */}
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onExpandLyrics();
                    }}
                    className="flex h-10 items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] px-3 text-xs font-medium text-zinc-200 active:scale-95 transition-transform"
                    aria-label="Open synchronized lyrics"
                    title="Lyrics & Visualizer"
                >
                    <Sparkles size={14} style={{ color: hasLyrics ? accentColor : undefined }} />
                    <span className="hidden xs:inline">Lyrics</span>
                </button>

                {/* Play / Pause button (44x44px touch target) */}
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onTogglePlay();
                    }}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-950 shadow-md active:scale-95 transition-transform"
                    style={{ backgroundColor: accentColor }}
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                    {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                </button>

                {/* Next Track button (44x44px touch target) */}
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onNextTrack();
                    }}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-200 hover:bg-white/10 active:scale-95 transition-all"
                    aria-label="Next track"
                >
                    <SkipForward size={20} />
                </button>
            </div>
        </div>
    );
};

export default React.memo(MobileMiniPlayer);
