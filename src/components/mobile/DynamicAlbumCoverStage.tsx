import React, { useEffect, useMemo, useState } from 'react';
import { Disc3, Sparkles } from 'lucide-react';
import type { Theme } from '../../types';
import { ANDROID_VISIBILITY_EVENT } from '../../services/android/foliaAndroidBridge';
import {
    type DynamicAlbumArtworkIntensity,
    detectPrefersReducedMotion,
    resolveDynamicAlbumArtworkMotion,
} from '../../utils/dynamicAlbumArtwork';

// src/components/mobile/DynamicAlbumCoverStage.tsx
// Apple Music-inspired Dynamic Album Cover experience for the normal player screen.
// Uses the current song's actual album artwork to compose:
//   1. Deep atmospheric color bloom & lower-edge bleed into the controls/progress bar below
//   2. Soft-focus mid-depth parallax halo layer moving in gentle counter-phase
//   3. Crisp focal artwork layer with slow orbital camera drift & composition-safe zoom
//   4. Restrained specular ambient light caustics & feathered lower-edge gradient transition
//   5. Natural crossfade on track change without flashing or retaining unbounded textures
//   6. Graceful animated fallback disc when a track has no cover artwork
//   7. Instant switch to unmodified static cover when Dynamic Album Artwork is turned Off

export interface DynamicAlbumCoverStageProps {
    songId: string | number;
    songTitle: string;
    coverUrl: string | null;
    isPlaying: boolean;
    isActive: boolean;
    enabled: boolean;
    intensity: DynamicAlbumArtworkIntensity;
    theme: Theme;
    onOpenLyrics: () => void;
    onToggleEnabled?: () => void;
    onImageError?: () => void;
}

const KEYFRAMES_CSS = `
@keyframes foliaCoverCameraOrbitNormal {
    0%   { transform: translate3d(0px, 0px, 0) scale(1.012); }
    25%  { transform: translate3d(4.5px, -3.5px, 0) scale(1.036); }
    50%  { transform: translate3d(-2.5px, 4.0px, 0) scale(1.045); }
    75%  { transform: translate3d(-4.5px, -2.0px, 0) scale(1.028); }
    100% { transform: translate3d(0px, 0px, 0) scale(1.012); }
}
@keyframes foliaCoverCameraOrbitLow {
    0%   { transform: translate3d(0px, 0px, 0) scale(1.004); }
    50%  { transform: translate3d(2.0px, -1.8px, 0) scale(1.018); }
    100% { transform: translate3d(0px, 0px, 0) scale(1.004); }
}
@keyframes foliaCoverParallaxCounter {
    0%   { transform: translate3d(0px, 4px, 0) scale(1.12); }
    33%  { transform: translate3d(-8px, 8px, 0) scale(1.18); }
    66%  { transform: translate3d(7px, -5px, 0) scale(1.15); }
    100% { transform: translate3d(0px, 4px, 0) scale(1.12); }
}
@keyframes foliaCoverLightCaustics {
    0%   { transform: translate3d(-6%, -4%, 0) rotate(0deg) scale(1.05); opacity: 0.72; }
    50%  { transform: translate3d(6%, 5%, 0) rotate(8deg) scale(1.14); opacity: 1; }
    100% { transform: translate3d(-6%, -4%, 0) rotate(0deg) scale(1.05); opacity: 0.72; }
}
@keyframes foliaFallbackVinylSheen {
    0%   { transform: rotate(0deg) scale(1); }
    50%  { transform: rotate(180deg) scale(1.02); }
    100% { transform: rotate(360deg) scale(1); }
}
`;

export const DynamicAlbumCoverStage: React.FC<DynamicAlbumCoverStageProps> = React.memo(({
    songId,
    songTitle,
    coverUrl,
    isPlaying,
    isActive,
    enabled,
    intensity,
    theme,
    onOpenLyrics,
    onToggleEnabled,
    onImageError,
}) => {
    const [isPageVisible, setIsPageVisible] = useState<boolean>(() => (
        typeof document === 'undefined' ? true : document.visibilityState !== 'hidden'
    ));
    const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(detectPrefersReducedMotion);

    // Track-switch crossfade state: holds outgoing cover URL briefly (380ms) so switching tracks
    // crossfades smoothly without flashing or keeping more than 1 previous image reference.
    const [displayedCover, setDisplayedCover] = useState<{
        songId: string | number;
        url: string | null;
    }>({ songId, url: coverUrl });
    const [outgoingCoverUrl, setOutgoingCoverUrl] = useState<string | null>(null);

    useEffect(() => {
        if (displayedCover.url === coverUrl && displayedCover.songId === songId) {
            return undefined;
        }
        const previousUrl = displayedCover.url;
        setDisplayedCover({ songId, url: coverUrl });
        if (previousUrl && previousUrl !== coverUrl && isActive) {
            setOutgoingCoverUrl(previousUrl);
            const timer = setTimeout(() => {
                setOutgoingCoverUrl(null);
            }, 380);
            return () => clearTimeout(timer);
        }
        setOutgoingCoverUrl(null);
        return undefined;
    }, [coverUrl, displayedCover.songId, displayedCover.url, isActive, songId]);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;
        const onVisChange = () => {
            setIsPageVisible(document.visibilityState !== 'hidden');
        };
        const onNativeVis = (event: Event) => {
            const detail = (event as CustomEvent<{ visible?: boolean }>).detail;
            if (typeof detail?.visible === 'boolean') {
                setIsPageVisible(detail.visible);
            }
        };
        document.addEventListener('visibilitychange', onVisChange);
        window.addEventListener(ANDROID_VISIBILITY_EVENT, onNativeVis);

        let mql: MediaQueryList | null = null;
        const onMotionPrefChange = () => setPrefersReducedMotion(detectPrefersReducedMotion());
        if (typeof window.matchMedia === 'function') {
            mql = window.matchMedia('(prefers-reduced-motion: reduce)');
            mql.addEventListener?.('change', onMotionPrefChange);
        }

        return () => {
            document.removeEventListener('visibilitychange', onVisChange);
            window.removeEventListener(ANDROID_VISIBILITY_EVENT, onNativeVis);
            mql?.removeEventListener?.('change', onMotionPrefChange);
        };
    }, []);

    const motionProfile = useMemo(
        () =>
            resolveDynamicAlbumArtworkMotion({
                settings: { enabled, intensity },
                isPlaying,
                isCoverScreenActive: isActive,
                isPageVisible,
                prefersReducedMotion,
            }),
        [enabled, intensity, isActive, isPageVisible, isPlaying, prefersReducedMotion],
    );

    const accentColor = theme.accentColor || theme.primaryColor || '#38bdf8';
    const primaryColor = theme.primaryColor || '#f4f4f5';
    const secondaryColor = theme.secondaryColor || accentColor;
    const bgTint = theme.backgroundColor || '#09090b';
    const activeUrl = displayedCover.url;
    const playStateCss = motionProfile.shouldAnimate ? 'running' : 'paused';

    return (
        <div
            data-testid="dynamic-album-cover-stage"
            data-dynamic-enabled={enabled ? 'true' : 'false'}
            data-dynamic-intensity={motionProfile.effectiveIntensity}
            data-dynamic-animating={motionProfile.shouldAnimate ? 'true' : 'false'}
            className="relative flex w-full max-w-[min(80vw,356px)] landscape:max-w-[min(46vh,220px)] shrink-0 flex-col items-center justify-center"
        >
            <style>{KEYFRAMES_CSS}</style>

            {/* Layer 1: Deep Atmospheric Color Bloom & Lower-Edge Bleed into Player Background & Progress Bar */}
            {enabled && isActive && (
                <div
                    data-testid="dynamic-cover-ambient-bleed"
                    aria-hidden="true"
                    className="pointer-events-none absolute -inset-x-8 -top-6 -bottom-12 -z-10 rounded-[44px] transition-opacity duration-700"
                    style={{
                        opacity: motionProfile.ambientBloomOpacity,
                        background: `
                            radial-gradient(circle at 50% 38%, color-mix(in srgb, ${accentColor} 42%, transparent) 0%, transparent 68%),
                            radial-gradient(circle at 30% 82%, color-mix(in srgb, ${primaryColor} 32%, transparent) 0%, transparent 64%),
                            radial-gradient(circle at 72% 86%, color-mix(in srgb, ${secondaryColor} 28%, transparent) 0%, transparent 62%)
                        `,
                        filter: 'blur(26px)',
                    }}
                />
            )}

            {/* Layer 2: Mid-Depth Counter-Phase Parallax Artwork Aura (when artwork is present and Dynamic mode is On) */}
            {enabled && isActive && activeUrl && (
                <div
                    data-testid="dynamic-cover-parallax-layer"
                    aria-hidden="true"
                    className="pointer-events-none absolute -inset-2.5 -z-10 overflow-hidden rounded-[34px] transition-opacity duration-500"
                    style={{
                        opacity: isPlaying ? 0.52 : 0.26,
                        filter: 'blur(20px) saturate(1.25)',
                    }}
                >
                    <img
                        src={activeUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        style={{
                            animationName: 'foliaCoverParallaxCounter',
                            animationDuration: `${Math.max(18, motionProfile.cycleDurationSec * 1.25)}s`,
                            animationTimingFunction: 'ease-in-out',
                            animationIterationCount: 'infinite',
                            animationPlayState: playStateCss,
                            willChange: motionProfile.shouldAnimate ? 'transform' : 'auto',
                        }}
                    />
                </div>
            )}

            {/* Primary Interactive Cover Frame */}
            <div
                className="group relative aspect-square w-full overflow-hidden rounded-3xl border border-white/15 bg-zinc-950 shadow-[0_26px_70px_rgba(0,0,0,0.78)] transition-transform duration-500"
                style={{
                    transform: isPlaying ? 'scale(1)' : 'scale(0.955)',
                }}
            >
                <button
                    type="button"
                    data-testid="dynamic-cover-main-button"
                    onClick={onOpenLyrics}
                    className="relative block h-full w-full overflow-hidden text-left focus:outline-none"
                    aria-label="Switch to synchronized lyrics view"
                >
                    {/* Outgoing Cover Crossfade Layer on Track Change */}
                    {outgoingCoverUrl && (
                        <img
                            data-testid="dynamic-cover-outgoing-layer"
                            src={outgoingCoverUrl}
                            alt=""
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300"
                        />
                    )}

                    {activeUrl ? (
                        <>
                            {/* Layer 3: Crisp Focal Artwork Layer (Animated when enabled, unmodified static when disabled) */}
                            <img
                                key={`${songId}-${activeUrl}`}
                                data-testid={enabled ? 'dynamic-cover-focal-layer' : 'static-album-cover-image'}
                                src={activeUrl}
                                alt={songTitle}
                                onError={onImageError}
                                className="h-full w-full object-cover transition-transform duration-700"
                                style={
                                    enabled
                                        ? {
                                              animationName:
                                                  motionProfile.effectiveIntensity === 'low'
                                                      ? 'foliaCoverCameraOrbitLow'
                                                      : 'foliaCoverCameraOrbitNormal',
                                              animationDuration: `${motionProfile.cycleDurationSec || 18}s`,
                                              animationTimingFunction: 'ease-in-out',
                                              animationIterationCount: 'infinite',
                                              animationPlayState: playStateCss,
                                              willChange: motionProfile.shouldAnimate ? 'transform' : 'auto',
                                          }
                                        : undefined
                                }
                            />

                            {/* Layer 4: Restrained Specular Light Caustics & Upper Rim Highlight */}
                            {enabled && (
                                <div
                                    data-testid="dynamic-cover-lighting-layer"
                                    aria-hidden="true"
                                    className="pointer-events-none absolute inset-0 mix-blend-screen"
                                    style={{
                                        opacity: motionProfile.specularSweepOpacity,
                                        background: `
                                            radial-gradient(circle at 28% 24%, ${primaryColor} 0%, transparent 54%),
                                            radial-gradient(circle at 76% 68%, ${accentColor} 0%, transparent 58%)
                                        `,
                                        animationName: 'foliaCoverLightCaustics',
                                        animationDuration: `${Math.max(16, (motionProfile.cycleDurationSec || 18) * 0.9)}s`,
                                        animationTimingFunction: 'ease-in-out',
                                        animationIterationCount: 'infinite',
                                        animationPlayState: playStateCss,
                                    }}
                                />
                            )}

                            {/* Layer 5: Smooth Lower-Edge Feathered Transition into the Surrounding Player Background */}
                            {enabled && (
                                <div
                                    data-testid="dynamic-cover-lower-edge-blend"
                                    aria-hidden="true"
                                    className="pointer-events-none absolute inset-x-0 bottom-0 h-[34%]"
                                    style={{
                                        background: `linear-gradient(180deg, transparent 0%, color-mix(in srgb, ${bgTint} 46%, transparent) 58%, color-mix(in srgb, ${bgTint} 88%, #060609) 100%)`,
                                    }}
                                />
                            )}
                        </>
                    ) : (
                        /* Animated or Static Fallback Artwork when Track Has No Cover Image */
                        <div
                            data-testid="dynamic-cover-fallback"
                            className="relative flex h-full w-full flex-col items-center justify-center gap-3 overflow-hidden bg-gradient-to-br from-zinc-800/85 via-zinc-900 to-zinc-950 text-zinc-400"
                        >
                            {enabled && (
                                <div
                                    aria-hidden="true"
                                    className="pointer-events-none absolute inset-4 rounded-full border border-white/10"
                                    style={{
                                        background: `conic-gradient(from 0deg, transparent 0deg, color-mix(in srgb, ${accentColor} 26%, transparent) 90deg, transparent 180deg, color-mix(in srgb, ${primaryColor} 20%, transparent) 270deg, transparent 360deg)`,
                                        animationName: 'foliaFallbackVinylSheen',
                                        animationDuration: '20s',
                                        animationTimingFunction: 'linear',
                                        animationIterationCount: 'infinite',
                                        animationPlayState: playStateCss,
                                    }}
                                />
                            )}
                            <Disc3
                                size={72}
                                strokeWidth={1.25}
                                className="relative z-10"
                                style={{ color: enabled ? accentColor : undefined }}
                            />
                            <span className="relative z-10 text-xs font-medium tracking-wider uppercase text-zinc-300">
                                Folia Audio
                            </span>
                        </div>
                    )}
                </button>

                {/* Top-Left Dynamic / Static Cover Mode Toggle Pill */}
                {onToggleEnabled && (
                    <button
                        type="button"
                        data-testid="dynamic-cover-toggle-pill"
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleEnabled();
                        }}
                        className="absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/60 px-2.5 py-1 text-[10px] font-semibold text-white/90 backdrop-blur-md active:scale-95 transition-transform"
                        aria-label={enabled ? 'Dynamic Album Artwork is On. Tap to switch to static cover' : 'Dynamic Album Artwork is Off. Tap to enable'}
                        title="Toggle Dynamic Album Artwork"
                    >
                        <span
                            className={`h-1.5 w-1.5 rounded-full ${enabled ? 'animate-pulse' : 'opacity-40'}`}
                            style={{ backgroundColor: enabled ? accentColor : '#a1a1aa' }}
                        />
                        <span>{enabled ? 'Dynamic' : 'Static'}</span>
                    </button>
                )}

                {/* Bottom-Right Tap-for-Lyrics Pill */}
                <button
                    type="button"
                    onClick={onOpenLyrics}
                    className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 rounded-full border border-white/12 bg-black/65 px-3 py-1.5 text-[11px] font-medium text-white/90 backdrop-blur-md active:scale-95 transition-transform"
                >
                    <Sparkles size={12} style={{ color: accentColor }} />
                    <span>Tap for Lyrics</span>
                </button>
            </div>
        </div>
    );
});

export default DynamicAlbumCoverStage;
