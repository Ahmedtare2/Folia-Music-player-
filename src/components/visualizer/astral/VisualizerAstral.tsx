import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useTranslation } from 'react-i18next';
import { resolveThemeFontStack, resolveThemeFontWeight } from '../../../utils/fontStacks';
import { resolveLyricAntialias, resolveLyricPixelRatio } from '../../../utils/lyricRenderQuality';
import { getLineRenderEndTime } from '../../../utils/lyrics/renderHints';
import { resolveMobileCanvasDpr } from '../../../utils/mobileVisualizerBudget';
import type { VisualizerSharedProps } from '../definition';
import { useLyricRenderQuality } from '../renderQuality/useLyricRenderQuality';
import { useVisualizerRuntime } from '../runtime';
import { useFirstFrameDrawn } from '../styleTransition/firstFrame';
import VisualizerShell from '../VisualizerShell';
import { stationFocus } from './astralStations';
import type { AstralWorldFrame } from './astralWorld';
import VisualizerSubtitleOverlay from '../VisualizerSubtitleOverlay';
import { applyAspect } from './astralCameraPath';
import { createAstralAudioSampler } from './astralAudio';
import { createAstralLyrics } from './astralLyrics';
import { createConductor, type Conductor } from './astralSequencer';
import { createAstralWorld, type AstralWorld } from './astralWorld';
import type { AstralTuning } from './types';

// src/components/visualizer/astral/VisualizerAstral.tsx
// ASTRAL: a cinematic 3D "Grand Orrery Hall". One transparent R3F Canvas; one frame loop (AstralRig) reads the playback clock and the audio
// MotionValues, asks the conductor for the camera, updates the world and the lyric layer from refs and draws. No React state changes per
// frame. The lyric words are in-scene; the shared subtitle overlay keeps the translation and the next-line hints, like every style.

type VisualizerProps = VisualizerSharedProps & { astralTuning: AstralTuning };

const FOV = 50;
const LYRIC_DISTANCE = 6;
const STATIC_FRAME_MS = 250;

interface RigProps {
    live: React.MutableRefObject<{
        props: VisualizerProps; paused: boolean; still: boolean; reduce: boolean;
    }>;
    onDrawn: () => void;
    world: AstralWorld;
}

const AstralRig: React.FC<RigProps> = ({ live, onDrawn, world }) => {
    const { gl, scene, camera, size } = useThree();
    const sampler = useMemo(() => createAstralAudioSampler({ audioPower: live.current.props.audioPower, audioBands: live.current.props.audioBands }), [live]);
    const lyrics = useMemo(() => createAstralLyrics(), []);
    const conductorRef = useRef<Conductor | null>(null);
    const songKey = useRef<{ lines: unknown; seed: unknown } | null>(null);
    const linking = useRef<'not yet' | 'started' | 'done'>('not yet');
    const frames = useRef(0);
    const mounted = useRef(true);
    const lastStamp = useRef(-1);
    const lastDrawMs = useRef(-1e9);
    const frame = useRef<AstralWorldFrame>({
        time: 0, dt: 0,
        audio: { bass: 0, lowMid: 0, mid: 0, vocal: 0, treble: 0, power: 0, kick: 0, beat: 0 },
        camera: { x: 0, y: 0, z: 0 }, gateOpen: 0, orbitalActivity: 1, atmosphere: 1, reactivity: 1, still: false,
    });
    const lyricFrame = useRef({ time: 0, dt: 0, paused: false, visWidth: 1, visHeight: 1, illumination: 1, vocal: 0, show: true });
    const scratch = useRef({ pose: null as null | ReturnType<typeof applyAspect> });

    useEffect(() => {
        mounted.current = true;
        // The hall is lit by its own environment map (built once from the renderer); fog comes with it.
        world.init(gl);
        scene.add(world.root);
        scene.fog = (world.root.userData.fog as THREE.Fog | THREE.FogExp2 | undefined) ?? null;
        scene.add(camera);
        camera.add(lyrics.group);
        lyrics.group.position.set(0, 0, -LYRIC_DISTANCE);
        return () => {
            mounted.current = false;
            camera.remove(lyrics.group);
            scene.remove(camera);
            scene.remove(world.root);
            scene.fog = null;
            lyrics.dispose();
        };
    }, [gl, scene, camera, world, lyrics]);

    useFrame(({ gl: renderer, scene: s, camera: cam }, rawDt) => {
        const state = live.current;
        const p = state.props;
        const stamp = performance.now();
        if (state.still && stamp - lastDrawMs.current < STATIC_FRAME_MS && frames.current > 2) return;
        lastDrawMs.current = stamp;
        const dt = Math.min(0.1, Math.max(0, rawDt));
        const t = p.currentTime.get();
        const tuning = p.astralTuning;

        // A new song or new lyrics rebuilds the plan; every song after the first one opens through the gate.
        if (!conductorRef.current) {
            conductorRef.current = createConductor({ lines: p.lines, seed: p.seed });
            songKey.current = { lines: p.lines, seed: p.seed };
            lyrics.setLines(p.lines);
        } else if (songKey.current && (songKey.current.lines !== p.lines || songKey.current.seed !== p.seed)) {
            const songChanged = songKey.current.seed !== p.seed;
            conductorRef.current.setSong({ lines: p.lines, seed: p.seed }, songChanged);
            songKey.current = { lines: p.lines, seed: p.seed };
            lyrics.setLines(p.lines);
        }
        const conductor = conductorRef.current;

        sampler.setSources({ audioPower: p.audioPower, audioBands: p.audioBands });
        sampler.sample(dt, state.paused || state.still);
        const motion = state.reduce ? Math.min(0.3, tuning.cameraMotion) : tuning.cameraMotion;
        const aspect = size.height > 0 ? size.width / size.height : 1;
        const out = conductor.step({
            time: t, dt, paused: state.paused, aspect, intensity: motion, speed: tuning.cameraSpeed, still: state.still,
        });
        const pose = out.pose;
        cam.position.set(pose.px, pose.py, pose.pz);
        cam.up.set(0, 1, 0);
        cam.lookAt(pose.tx, pose.ty, pose.tz);
        const perspective = cam as THREE.PerspectiveCamera;
        if (perspective.isPerspectiveCamera) {
            if (perspective.fov !== FOV || Math.abs(perspective.aspect - aspect) > 1e-4) {
                perspective.fov = FOV;
                perspective.aspect = aspect;
                perspective.updateProjectionMatrix();
            }
        }
        cam.updateMatrixWorld();
        frame.current.cameraQuaternion = cam.quaternion;

        const sig = sampler.signals;
        const f = frame.current;
        f.time = t; f.dt = state.paused || state.still ? 0 : dt;
        f.audio.bass = sig.bass; f.audio.lowMid = sig.lowMid; f.audio.mid = sig.mid; f.audio.vocal = sig.vocal;
        f.audio.treble = sig.treble; f.audio.power = sig.power; f.audio.kick = sig.kick; f.audio.beat = 0;
        f.camera.x = pose.px; f.camera.y = pose.py; f.camera.z = pose.pz;
        f.gateOpen = out.gateOpen;
        f.orbitalActivity = state.reduce ? Math.min(0.3, tuning.orbitalActivity) : tuning.orbitalActivity;
        f.atmosphere = tuning.atmosphere;
        f.reactivity = state.reduce ? 0 : tuning.audioReactivity;
        f.still = state.still;
        if (out.shot.kind === 'station' && !state.still) {
            const fc = stationFocus(out.shot.station);
            const segment = conductor.segments[out.segmentIndex];
            // The ring locks on while the station's line is sung and releases in the gaps.
            const sung = !!segment && segment.lineIndex >= 0 && t >= segment.start - 0.2 && t <= segment.end + 0.3;
            f.focus = { ...fc, strength: sung ? 1 : 0 };
        } else f.focus = undefined;
        world.update(f);

        const visHeight = 2 * LYRIC_DISTANCE * Math.tan((FOV * Math.PI) / 360);
        const lf = lyricFrame.current;
        lf.time = t; lf.dt = state.paused ? 0 : dt; lf.paused = state.paused;
        lf.visHeight = visHeight; lf.visWidth = visHeight * aspect;
        lf.illumination = tuning.lyricIllumination;
        lf.vocal = sig.vocal * tuning.audioReactivity;
        lf.show = p.showText !== false;
        lyrics.setStyle({
            fontStack: resolveThemeFontStack(p.theme),
            fontWeight: resolveThemeFontWeight(p.theme, 700),
            scale: p.lyricsFontScale ?? 1,
        });
        lyrics.update(lf);
        scratch.current.pose = null;

        // The first draw waits for the shader programs to link, so a style switch never shows a stalled frame.
        if (linking.current === 'not yet') {
            linking.current = 'started';
            lyrics.preheat(t, lf.visWidth, lf.visHeight);
            lyrics.update(lf);
            const materials = renderer.compile(s, cam);
            const look = () => {
                if (!mounted.current) return;
                const started = performance.now();
                for (const material of materials) {
                    const { currentProgram } = renderer.properties.get(material) as {
                        currentProgram?: { isReady: () => boolean; getUniforms: () => unknown };
                    };
                    if (currentProgram && !currentProgram.isReady()) break;
                    currentProgram?.getUniforms();
                    materials.delete(material);
                    if (performance.now() - started > 4) break;
                }
                if (materials.size === 0) linking.current = 'done';
                else window.setTimeout(look, 10);
            };
            look();
        }
        if (linking.current !== 'done') return;
        renderer.render(s, cam);
        frames.current += 1;
        if (frames.current === 2) onDrawn();
    }, 1);
    return null;
};

const VisualizerAstral: React.FC<VisualizerProps> = (props) => {
    const {
        currentTime, currentLineIndex, lines, theme, subtitleTheme, audioPower, audioBands, showText = true,
        staticMode = false, paused = false, lyricsFontScale = 1, subtitleFontScale = 1, astralTuning,
        subtitleOverlayOpacity, subtitleOverlayBackground, subtitleUpcomingLyricsBlur, isPlayerChromeHidden = false,
        hideTranslationSubtitle = false, showSubtitleTranslation = true, subtitleContentMode, isPreviewMode = false,
    } = props;
    const { t } = useTranslation();
    const firstFrameDrawn = useFirstFrameDrawn();
    const renderQuality = useLyricRenderQuality();
    const { activeLine, recentCompletedLine, nextLines } = useVisualizerRuntime({
        currentTime, currentLineIndex, lines, getLineEndTime: getLineRenderEndTime,
    });

    const reduce = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const live = useRef({ props, paused, still: staticMode, reduce });
    live.current = { props, paused, still: staticMode, reduce };

    // A small preview builds only the first zone, on the lightest detail.
    const quality = isPreviewMode ? 'economy' : astralTuning.quality;
    const world = useMemo(() => createAstralWorld({ quality, preview: isPreviewMode }), [quality, isPreviewMode]);
    useEffect(() => () => world.dispose(), [world]);

    const dpr = useMemo(() => {
        const base = resolveMobileCanvasDpr(typeof window !== 'undefined' ? window.devicePixelRatio : 1);
        return isPreviewMode ? 1 : Math.min(2, resolveLyricPixelRatio(base, renderQuality.scale, 2));
    }, [isPreviewMode, renderQuality.scale]);

    const translationFontSize = useMemo(() => `clamp(${(1.05 * lyricsFontScale).toFixed(3)}rem, ${(2.2 * lyricsFontScale).toFixed(3)}vw, ${(1.2 * lyricsFontScale).toFixed(3)}rem)`, [lyricsFontScale]);
    const upcomingFontSize = useMemo(() => `clamp(${(0.875 * lyricsFontScale).toFixed(3)}rem, ${(1.8 * lyricsFontScale).toFixed(3)}vw, ${(1 * lyricsFontScale).toFixed(3)}rem)`, [lyricsFontScale]);

    return (
        <VisualizerShell theme={theme} audioPower={audioPower} audioBands={audioBands} sharedProps={props}>
            <div className="relative z-10 h-full w-full pointer-events-none" aria-label={t('ui.visualizerAstral')}>
                <Canvas
                    key={`${quality}|${renderQuality.antialias}`}
                    camera={{ position: [0, 2.6, 19.5], fov: FOV, near: 0.1, far: 220 }}
                    dpr={dpr}
                    gl={{ alpha: true, antialias: resolveLyricAntialias(renderQuality.antialias, quality !== 'economy'), powerPreference: 'high-performance' }}
                    // The size it is laid out at, not the size on screen: drawn small through a CSS scale it keeps the scene of the full page.
                    resize={{ offsetSize: true }}
                    style={{ background: 'transparent' }}
                >
                    <AstralRig live={live} onDrawn={firstFrameDrawn} world={world} />
                </Canvas>
            </div>
            <VisualizerSubtitleOverlay
                showText={showText}
                activeLine={activeLine}
                recentCompletedLine={recentCompletedLine}
                nextLines={nextLines}
                theme={theme}
                subtitleTheme={subtitleTheme}
                translationFontSize={translationFontSize}
                upcomingFontSize={upcomingFontSize}
                subtitleOverlayOpacity={subtitleOverlayOpacity}
                subtitleOverlayBackground={subtitleOverlayBackground}
                subtitleUpcomingLyricsBlur={subtitleUpcomingLyricsBlur}
                subtitleFontScale={subtitleFontScale}
                isPlayerChromeHidden={isPlayerChromeHidden}
                hideTranslationSubtitle={hideTranslationSubtitle}
                showSubtitleTranslation={showSubtitleTranslation}
                subtitleContentMode={subtitleContentMode}
            />
        </VisualizerShell>
    );
};

export default VisualizerAstral;
