import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { PaperShaderElement } from '@paper-design/shaders';
import { Dithering, MeshGradient } from '@paper-design/shaders-react';
import type { MotionValue } from 'framer-motion';
import {
    DEFAULT_LATENT_BACKGROUND_TUNING,
    type AudioBands,
    type LatentBackgroundColorSource,
    type LatentBackgroundTuning,
    type Theme,
} from '../../../../types';
import { extractAssetIdFromCoverUrl } from '../../../../services/localCoverRuntime';
import { extractRepresentativeColors } from '../../../../utils/colorExtractor';
import { AMBIENT_BACKGROUND_DPR_SCALE, AMBIENT_BACKGROUND_MAX_PIXELS } from '../../../../utils/mobileVisualizerBudget';
import { isAppForegroundVisible, subscribeAppForegroundVisibility } from '../../../../utils/visualizerVisibilityGate';
import { updatePaperShaderUniforms } from '../../../../utils/paperShaderUniforms';
import { createPaperShaderReleaseRef, PAPER_SHADER_CONTEXT_ATTRIBUTES } from '../../../../utils/paperShaderContext';
import { useFirstFrameDrawn } from '../../styleTransition/firstFrame';
import { useBlendedColors } from '../useBlendedColors';
import { beatImpact, downbeatImpact } from '../../../../stores/motionSignals';
import { getBeatEffectStrength, isBeatFxReady } from '../../../../services/beatFx/beatFxLive';
import { BEAT_EFFECT_IDS } from '../../../../services/beatFx/beatEffects';

// src/components/visualizer/backgrounds/latent/LatentBackground.tsx
// Layers two cover-colored Paper shaders and drives their uniforms without React frame updates.
// Hardware GPU Acceleration & Low-Power Optimizations:
// 1. Renders internal WebGL framebuffers at 0.30x DPR (max 384x256 = 98,304 px) and relies on the
//    hardware display compositor's bilinear texture filtering (`translate3d(0,0,0)`) to upscale to full screen.
// 2. Eliminates per-frame CSS `filter: saturate() brightness()` mutations so Chromium/Skia never
//    allocates a full-screen 1080x2400 offscreen render-pass texture per frame.
// 3. Paces audio-uniform updates to ~30Hz (32ms) and completely halts the rAF loop once paused has eased to rest.

interface LatentBackgroundProps {
    theme: Theme;
    coverUrl?: string | null;
    audioPower: MotionValue<number>;
    audioBands: AudioBands;
    staticMode: boolean;
    paused: boolean;
    tuning?: LatentBackgroundTuning;
    /** How long new colours take to blend in (useBlendedColors); 0 or left out, at once. */
    blendMs?: number;
    /** Where given, the blend plays along this instead (useBlendedColors). */
    blendProgress?: MotionValue<number>;
}

const MAX_SHADER_PIXELS = AMBIENT_BACKGROUND_MAX_PIXELS;
const AMBIENT_SHADER_MIN_PIXEL_RATIO = AMBIENT_BACKGROUND_DPR_SCALE;
const PAUSED_SPEED_SCALE = 0.12;
// How fast the speed goes from playing to paused or back, as a time constant: settled in about a second.
const PAUSE_EASE_MS = 300;
const AUDIO_UNIFORM_INTERVAL_MS = 32;

const normalizeAudio = (value: number) => Math.min(1, Math.max(0, value / 255));
const clampShaderSpeed = (value: number) => Math.min(2, Math.max(0, value));
const clampAudioAmount = (value: number) => Math.min(1, Math.max(0, value));
const easeTowards = (current: number, target: number, amount: number) => (
    current + (target - current) * amount
);
export const resolveLatentBroadbandEnergy = (
    bass: number,
    lowMid: number,
    mid: number,
    vocal: number,
    treble: number,
) => {
    const broadbandEnergy = (
        normalizeAudio(bass) * 0.22
        + normalizeAudio(lowMid) * 0.18
        + normalizeAudio(mid) * 0.22
        + normalizeAudio(vocal) * 0.28
        + normalizeAudio(treble) * 0.1
    );
    return Math.pow(broadbandEnergy, 0.55);
};
// Accents broadband energy rises so shader speed lands on musical onsets instead of following loudness alone.
export const resolveLatentOnsetPulse = (
    currentEnergy: number,
    previousEnergy: number,
    previousPulse: number,
) => Math.max(
    previousPulse * 0.84,
    clampAudioAmount((currentEnergy - previousEnergy) * 7),
);
export const resolveLatentBeatSpeedTarget = (
    broadbandEnergy: number,
    onsetPulse: number,
) => clampAudioAmount(broadbandEnergy * 0.42 + onsetPulse * 0.85);
/** The beat FX onset: the larger of the two envelopes the beat clock writes, each 0..2 once scaled. */
export const resolveLatentBeatFxPulse = (beat: number, downbeat: number) => Math.max(beat, downbeat);
export const resolveLatentAudioSpeedTarget = (
    broadbandEnergy: number,
    onsetPulse: number,
    enhancedBeatResponse: boolean,
) => enhancedBeatResponse
    ? resolveLatentBeatSpeedTarget(broadbandEnergy, onsetPulse)
    : clampAudioAmount(broadbandEnergy);
export const resolveLatentShaderSpeed = (
    baseSpeed: number,
    audioSpeed: number,
    audioAmount: number,
    paused: boolean,
) => clampShaderSpeed(
    paused
        ? baseSpeed * PAUSED_SPEED_SCALE
        : easeTowards(baseSpeed, audioSpeed, audioAmount),
);
export const resolveLatentShaderColors = (
    coverColors: string[],
    theme: Theme,
    colorSource: LatentBackgroundColorSource,
) => {
    const primary = coverColors[0] ?? theme.secondaryColor;
    if (colorSource === 'cover-only') {
        const secondary = coverColors[1] ?? primary;
        const tertiary = coverColors[2] ?? secondary;
        const quaternary = coverColors[3] ?? primary;
        const quinary = coverColors[4] ?? secondary;
        const senary = coverColors[5] ?? tertiary;
        return {
            ditheringBack: tertiary,
            ditheringFront: primary,
            mesh: [primary, secondary, tertiary, quaternary, quinary, senary],
        };
    }
    const secondary = coverColors[1] ?? theme.primaryColor;
    const tertiary = coverColors[2] ?? primary;
    const quaternary = coverColors[3] ?? secondary;
    return {
        ditheringBack: theme.backgroundColor,
        ditheringFront: primary,
        mesh: [primary, secondary, tertiary, quaternary, theme.backgroundColor, theme.accentColor],
    };
};

const LatentBackground: React.FC<LatentBackgroundProps> = ({
    theme,
    coverUrl,
    audioPower,
    audioBands,
    staticMode,
    paused,
    tuning: tuningOverride,
    blendMs = 0,
    blendProgress,
}) => {
    const ditheringRef = useRef<PaperShaderElement | null>(null);
    const meshRef = useRef<PaperShaderElement | null>(null);
    // Stable callback refs: they also lose each shader's WebGL context when it unmounts.
    const ditheringShaderRef = useMemo(() => createPaperShaderReleaseRef(ditheringRef), []);
    const meshShaderRef = useMemo(() => createPaperShaderReleaseRef(meshRef), []);
    const ditheringLayerRef = useRef<HTMLDivElement | null>(null);
    const meshLayerRef = useRef<HTMLDivElement | null>(null);
    const pausedRef = useRef(paused);
    const wakeAudioLoopRef = useRef<(() => void) | null>(null);
    // How far the loop below has eased between paused (0) and playing (1). Outside the loop's effect,
    // so a re-run of it (a setting changed mid-ease) goes on from there.
    const playingRef = useRef(paused ? 0 : 1);
    const [coverColors, setCoverColors] = useState<string[]>([]);
    const [coverExtractTick, setCoverExtractTick] = useState(0);
    const tuning = tuningOverride ?? DEFAULT_LATENT_BACKGROUND_TUNING;
    const showDithering = tuning.displayMode !== 'mesh';
    const showMesh = tuning.displayMode !== 'dithering';
    pausedRef.current = paused;
    // A copy mounted for a change of type is ready once the cover's colours are read.
    const colorsDrawn = useFirstFrameDrawn();

    useEffect(() => {
        if (typeof window === 'undefined' || !coverUrl) return undefined;
        const targetAssetId = extractAssetIdFromCoverUrl(coverUrl);
        if (!targetAssetId) return undefined;
        const onExtracted = (event: Event) => {
            const detail = (event as CustomEvent<{ assetId?: string }>).detail;
            if (!detail?.assetId || detail.assetId === targetAssetId) {
                setCoverExtractTick(t => t + 1);
            }
        };
        window.addEventListener('folia:local-cover-extracted', onExtracted);
        return () => window.removeEventListener('folia:local-cover-extracted', onExtracted);
    }, [coverUrl]);

    useEffect(() => {
        let active = true;

        if (!coverUrl) {
            setCoverColors([]);
            colorsDrawn();
            return () => {
                active = false;
            };
        }

        void extractRepresentativeColors(coverUrl, 6).then(colors => {
            if (active) {
                setCoverColors(colors);
                colorsDrawn();
            }
        });

        return () => {
            active = false;
        };
    }, [coverUrl, colorsDrawn, coverExtractTick]);

    // A new song's colours blend in where the host plays transitions: a second copy for the soft focus
    // would mount and compile both shaders again on every song change.
    const resolvedColors = useMemo(
        () => resolveLatentShaderColors(coverColors, theme, tuning.colorSource),
        [coverColors, theme, tuning.colorSource],
    );
    const blendedColors = useBlendedColors(
        [theme.backgroundColor, resolvedColors.ditheringBack, resolvedColors.ditheringFront, ...resolvedColors.mesh],
        blendMs,
        blendProgress,
    );
    const [backgroundColor, ditheringBack, ditheringFront] = blendedColors;
    const shaderColors = useMemo(
        () => ({ ditheringBack, ditheringFront, mesh: blendedColors.slice(3) }),
        [blendedColors, ditheringBack, ditheringFront],
    );

    useEffect(() => {
        const ditheringMount = ditheringRef.current?.paperShaderMount;
        const meshMount = meshRef.current?.paperShaderMount;

        if (staticMode) {
            ditheringMount?.setSpeed(0);
            meshMount?.setSpeed(0);
            wakeAudioLoopRef.current = null;
            return;
        }

        let animationFrame = 0;
        const writtenStyles = new WeakMap<HTMLElement, Partial<Record<'opacity' | 'transform', string>>>();
        const writeLayerStyle = (element: HTMLElement, property: 'opacity' | 'transform', value: string) => {
            let written = writtenStyles.get(element);
            if (!written) {
                written = {};
                writtenStyles.set(element, written);
            }
            if (written[property] === value) return;
            written[property] = value;
            element.style[property] = value;
        };
        let smoothedPower = 0;
        let smoothedBass = 0;
        let smoothedMid = 0;
        let smoothedBeatSpeed = 0;
        let previousBeatEnergy = 0;
        let latentOnsetPulse = 0;
        let lastFrameAt: number | null = null;
        let lastUniformUpdateAt = -Infinity;
        const speedOf = (baseSpeed: number, audioSpeed: number) => easeTowards(
            resolveLatentShaderSpeed(baseSpeed, audioSpeed, smoothedBeatSpeed, true),
            resolveLatentShaderSpeed(baseSpeed, audioSpeed, smoothedBeatSpeed, false),
            playingRef.current,
        );

        const freezeShaders = () => {
            if (animationFrame) {
                cancelAnimationFrame(animationFrame);
                animationFrame = 0;
            }
            lastFrameAt = null;
            ditheringRef.current?.paperShaderMount?.setSpeed(0);
            meshRef.current?.paperShaderMount?.setSpeed(0);
        };

        // Keep audio-rate changes inside the shader/DOM layer so React only rerenders on palette changes.
        const updateAudioResponse = (frameAt: number) => {
            animationFrame = 0;
            if (!isAppForegroundVisible()) {
                freezeShaders();
                return;
            }

            const isPaused = pausedRef.current;
            const pauseStep = lastFrameAt === null ? 0 : 1 - Math.exp((lastFrameAt - frameAt) / PAUSE_EASE_MS);
            lastFrameAt = frameAt;
            playingRef.current = easeTowards(playingRef.current, isPaused ? 0 : 1, pauseStep);

            // When paused and the ease-down has settled, drop to 0% CPU/GPU by stopping the rAF loop
            // and freezing the Paper shader speeds until playback resumes.
            if (isPaused && playingRef.current < 0.006 && smoothedPower < 0.006 && smoothedBass < 0.006) {
                playingRef.current = 0;
                freezeShaders();
                return;
            }

            animationFrame = requestAnimationFrame(updateAudioResponse);

            if (frameAt - lastUniformUpdateAt < AUDIO_UNIFORM_INTERVAL_MS) {
                return;
            }
            lastUniformUpdateAt = frameAt;

            const targetPower = isPaused ? 0 : normalizeAudio(audioPower.get());
            const targetBass = isPaused ? 0 : normalizeAudio(audioBands.bass.get());
            const targetBeatEnergy = isPaused
                ? 0
                : resolveLatentBroadbandEnergy(
                    audioBands.bass.get(),
                    audioBands.lowMid.get(),
                    audioBands.mid.get(),
                    audioBands.vocal.get(),
                    audioBands.treble.get(),
                );
            const targetMid = isPaused
                ? 0
                : normalizeAudio(Math.max(audioBands.mid.get(), audioBands.vocal.get()));
            smoothedPower = easeTowards(smoothedPower, targetPower, 0.22);
            smoothedBass = easeTowards(smoothedBass, targetBass, 0.26);
            smoothedMid = easeTowards(
                smoothedMid,
                targetMid,
                0.22,
            );
            latentOnsetPulse = tuning.enhancedBeatResponse
                ? resolveLatentOnsetPulse(
                    targetBeatEnergy,
                    previousBeatEnergy,
                    latentOnsetPulse,
                )
                : 0;
            previousBeatEnergy = targetBeatEnergy;
            const beatSpeedTarget = !isPaused && isBeatFxReady() && getBeatEffectStrength(BEAT_EFFECT_IDS.latentPulse) > 0
                ? resolveLatentBeatSpeedTarget(
                    targetBeatEnergy,
                    resolveLatentBeatFxPulse(beatImpact.get(), downbeatImpact.get()),
                )
                : resolveLatentAudioSpeedTarget(
                    targetBeatEnergy,
                    latentOnsetPulse,
                    tuning.enhancedBeatResponse,
                );
            smoothedBeatSpeed = easeTowards(
                smoothedBeatSpeed,
                beatSpeedTarget,
                beatSpeedTarget > smoothedBeatSpeed ? 0.48 : 0.22,
            );

            const currentDitheringMount = ditheringRef.current?.paperShaderMount;
            const currentMeshMount = meshRef.current?.paperShaderMount;

            if (currentDitheringMount) {
                const ditheringSpeed = speedOf(tuning.ditheringSpeed, tuning.ditheringAudioSpeed);
                currentDitheringMount.setSpeed(ditheringSpeed);
                updatePaperShaderUniforms(currentDitheringMount, {
                    u_pxSize: Math.max(0.5, tuning.ditheringSize - smoothedBass * tuning.ditheringSize * 0.34),
                }, ditheringSpeed !== 0);
            }
            if (currentMeshMount) {
                const meshSpeed = speedOf(tuning.meshSpeed, tuning.meshAudioSpeed);
                currentMeshMount.setSpeed(meshSpeed);
                updatePaperShaderUniforms(currentMeshMount, {
                    u_distortion: tuning.meshDistortion + smoothedPower * 0.62,
                    u_swirl: tuning.meshSwirl + smoothedMid * 0.38,
                }, meshSpeed !== 0);
            }

            // Pure GPU Compositor Path: mutate only `transform: translate3d/scale3d` and `opacity`
            // (never CSS `filter`), avoiding full-screen Skia offscreen render-pass allocations.
            if (ditheringLayerRef.current) {
                const nextOpacity = showMesh
                    ? Math.min(1, tuning.ditheringOpacity + smoothedBass * 0.22).toFixed(3)
                    : '1';
                const nextScale = (1.015 + smoothedBass * 0.022).toFixed(3);
                writeLayerStyle(ditheringLayerRef.current, 'opacity', nextOpacity);
                writeLayerStyle(ditheringLayerRef.current, 'transform', `translate3d(0, 0, 0) scale3d(${nextScale}, ${nextScale}, 1)`);
            }
            if (meshLayerRef.current) {
                const nextMeshScale = (1.025 + smoothedPower * 0.018).toFixed(3);
                writeLayerStyle(meshLayerRef.current, 'transform', `translate3d(0, 0, 0) scale3d(${nextMeshScale}, ${nextMeshScale}, 1)`);
            }
        };

        const wakeLoop = () => {
            if (!isAppForegroundVisible() || staticMode) return;
            if (!animationFrame) {
                lastFrameAt = null;
                animationFrame = requestAnimationFrame(updateAudioResponse);
            }
        };
        wakeAudioLoopRef.current = wakeLoop;

        const unsubscribeVisibility = subscribeAppForegroundVisibility((visible) => {
            if (!visible) {
                freezeShaders();
            } else {
                wakeLoop();
            }
        });

        if (isAppForegroundVisible()) {
            wakeLoop();
        } else {
            freezeShaders();
        }
        return () => {
            wakeAudioLoopRef.current = null;
            unsubscribeVisibility();
            cancelAnimationFrame(animationFrame);
        };
    }, [audioBands, audioPower, showMesh, staticMode, tuning]);

    useEffect(() => {
        if (!paused) {
            wakeAudioLoopRef.current?.();
        }
    }, [paused]);

    const shaderStyle = useMemo<React.CSSProperties>(
        () => ({
            width: '100%',
            height: '100%',
            imageRendering: 'auto',
            transform: 'translate3d(0, 0, 0)',
            backfaceVisibility: 'hidden',
        }),
        [],
    );

    return (
        <div
            className="absolute inset-0 z-0 overflow-hidden"
            style={{
                backgroundColor,
                pointerEvents: 'none',
                contain: 'layout paint style',
                transform: 'translate3d(0, 0, 0)',
                backfaceVisibility: 'hidden',
            }}
        >
            {showMesh && (
                <div
                    ref={meshLayerRef}
                    className="absolute inset-0"
                    style={{
                        willChange: 'transform',
                        transform: 'translate3d(0, 0, 0) scale3d(1.025, 1.025, 1)',
                        transformOrigin: 'center',
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                    }}
                >
                    <MeshGradient
                        ref={meshShaderRef}
                        width="100%"
                        height="100%"
                        colors={shaderColors.mesh}
                        distortion={tuning.meshDistortion}
                        swirl={tuning.meshSwirl}
                        grainMixer={0}
                        grainOverlay={0.01}
                        speed={staticMode || paused ? 0 : tuning.meshSpeed}
                        minPixelRatio={AMBIENT_SHADER_MIN_PIXEL_RATIO}
                        maxPixelCount={MAX_SHADER_PIXELS}
                        webGlContextAttributes={PAPER_SHADER_CONTEXT_ATTRIBUTES}
                        style={shaderStyle}
                    />
                </div>
            )}
            {showDithering && (
                <div
                    ref={ditheringLayerRef}
                    className="absolute inset-0"
                    style={{
                        willChange: 'transform, opacity',
                        opacity: showMesh ? tuning.ditheringOpacity : 1,
                        transform: 'translate3d(0, 0, 0) scale3d(1.015, 1.015, 1)',
                        transformOrigin: 'center',
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                    }}
                >
                    <Dithering
                        ref={ditheringShaderRef}
                        width="100%"
                        height="100%"
                        colorBack={shaderColors.ditheringBack}
                        colorFront={shaderColors.ditheringFront}
                        shape="warp"
                        type="4x4"
                        size={tuning.ditheringSize}
                        speed={staticMode || paused ? 0 : tuning.ditheringSpeed}
                        minPixelRatio={AMBIENT_SHADER_MIN_PIXEL_RATIO}
                        maxPixelCount={MAX_SHADER_PIXELS}
                        webGlContextAttributes={PAPER_SHADER_CONTEXT_ATTRIBUTES}
                        style={shaderStyle}
                    />
                </div>
            )}
            {tuning.overlayEnabled && tuning.overlayOpacity > 0 && (
                <div
                    className="absolute inset-0"
                    style={{
                        backgroundColor,
                        opacity: tuning.overlayOpacity,
                    }}
                />
            )}
        </div>
    );
};

export default React.memo(LatentBackground);
