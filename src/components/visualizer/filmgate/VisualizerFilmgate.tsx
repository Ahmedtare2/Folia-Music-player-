import React, { useEffect, useMemo, useRef } from 'react';
import type { Line } from '../../../types';
import { resolveThemeFontStack, resolveThemeFontWeight } from '../../../utils/fontStacks';
import { resolveLyricPixelRatio } from '../../../utils/lyricRenderQuality';
import { getLineRenderEndTime } from '../../../utils/lyrics/renderHints';
import { detectTextDirection } from '../../../utils/lyrics/arabicText';
import { resolveMobileCanvasDpr } from '../../../utils/mobileVisualizerBudget';
import type { VisualizerSharedProps } from '../definition';
import { useLyricRenderQuality } from '../renderQuality/useLyricRenderQuality';
import { useVisualizerRuntime } from '../runtime';
import { useFirstFrameDrawn } from '../styleTransition/firstFrame';
import VisualizerShell from '../VisualizerShell';
import VisualizerSubtitleOverlay from '../VisualizerSubtitleOverlay';
import { createFilmAtmosphere, type FilmAtmosphere } from './filmGateAtmosphere';
import { createFilmGateAudioSampler, type FilmGateAudioFrame } from './filmGateAudio';
import { buildFilmWords, layoutFilmLine, type FilmLayout } from './filmGateLayout';
import { gateOffset, shotFrame, shotKindFor, SHOT_IN, wordLight } from './filmGateMotion';
import type { FilmgateTuning } from './types';

// src/components/visualizer/filmgate/VisualizerFilmgate.tsx
// FILMGATE: a 35mm projection of the lyrics. One Canvas2D draws everything (film atmosphere, lyrics, frame marks), so a
// video export can capture it like any canvas style. No React state changes per frame: a single requestAnimationFrame
// loop reads the clock and the audio MotionValues and draws from refs. Lyrics are laid out once per line and size
// (cached) and drawn word by word, each word with ONE fillText, which keeps Arabic whole and correctly shaped.

type VisualizerProps = VisualizerSharedProps & { filmgateTuning: FilmgateTuning };

const IVORY = 'rgba(233,223,201,1)';
const HOT = 'rgba(255,241,214,1)';
const AMBER = 'rgba(255,186,98,1)';
const UNLIT = 'rgba(233,223,201,0.5)';
const LAYOUT_CACHE_LIMIT = 24;
const STATIC_FRAME_MS = 250;

const hashSeed = (seed: string | number | undefined) => {
    const text = String(seed ?? 'filmgate');
    let h = 2166136261;
    for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return h >>> 0;
};

/** The last line (lines are in time order) that has begun, counting its shot lead-in. */
const lastLineIndexAt = (lines: readonly Line[], time: number) => {
    let lo = 0;
    let hi = lines.length - 1;
    let found = -1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (lines[mid]!.startTime - SHOT_IN <= time) { found = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return found;
};

interface Stage { width: number; height: number; ratio: number }

const VisualizerFilmgate: React.FC<VisualizerProps> = (props) => {
    const {
        currentTime, currentLineIndex, lines, theme, subtitleTheme, audioPower, audioBands, showText = true, seed,
        staticMode = false, paused = false, lyricsFontScale = 1, subtitleFontScale = 1, filmgateTuning,
        subtitleOverlayOpacity, subtitleOverlayBackground, subtitleUpcomingLyricsBlur, isPlayerChromeHidden = false,
        hideTranslationSubtitle = false, showSubtitleTranslation = true, subtitleContentMode, isPreviewMode = false,
    } = props;
    const hostRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const firstFrameDrawn = useFirstFrameDrawn();
    const quality = useLyricRenderQuality();
    const renderScale = isPreviewMode ? 1 : quality.scale;

    // Everything the loop needs, read through one ref so the loop is created once.
    const live = useRef({ lines, theme, tuning: filmgateTuning, showText, staticMode, paused, lyricsFontScale, renderScale, isPreviewMode });
    live.current = { lines, theme, tuning: filmgateTuning, showText, staticMode, paused, lyricsFontScale, renderScale, isPreviewMode };
    const dirty = useRef(true);
    // A change the loop must repaint for even when the song clock stands still (paused).
    useEffect(() => { dirty.current = true; }, [lines, theme, filmgateTuning, showText, staticMode, lyricsFontScale, renderScale]);

    const { activeLine, recentCompletedLine, nextLines } = useVisualizerRuntime({
        currentTime, currentLineIndex, lines, getLineEndTime: getLineRenderEndTime,
    });

    useEffect(() => {
        const host = hostRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d') ?? null;
        if (!host || !canvas || !ctx) return undefined;

        const stage: Stage = { width: 0, height: 0, ratio: 1 };
        const sampler = createFilmGateAudioSampler({ audioPower, audioBands });
        const atmosphere: FilmAtmosphere = createFilmAtmosphere(hashSeed(seed), { detail: live.current.isPreviewMode ? 0.5 : 1 });
        const layouts = new Map<string, FilmLayout>();
        const reduceMedia = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
        let raf = 0;
        let alive = true;
        let lastStamp = -1;
        let lastDrawMs = -1e9;
        let lastDrawnTime = Number.NaN;
        let clock = 0;
        let announced = false;

        const resize = () => {
            const rect = host.getBoundingClientRect();
            const ratio = resolveLyricPixelRatio(resolveMobileCanvasDpr(window.devicePixelRatio), live.current.renderScale);
            const w = Math.max(1, Math.round(rect.width));
            const h = Math.max(1, Math.round(rect.height));
            if (w === stage.width && h === stage.height && ratio === stage.ratio) return;
            stage.width = w; stage.height = h; stage.ratio = ratio;
            canvas.width = Math.max(1, Math.round(w * ratio));
            canvas.height = Math.max(1, Math.round(h * ratio));
            layouts.clear();
            dirty.current = true;
        };
        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
        observer?.observe(host);
        resize();

        const layoutFor = (index: number, line: Line, fontPx: number, font: string): FilmLayout => {
            const key = `${index}|${line.fullText}|${stage.width}x${stage.height}|${fontPx}|${font}`;
            const hit = layouts.get(key);
            if (hit) return hit;
            ctx.font = font;
            const measure = (text: string) => ctx.measureText(text).width;
            const direction = detectTextDirection(line.fullText);
            let size = fontPx;
            let layout: FilmLayout;
            // A long line shrinks a few steps before it is allowed to fill the stage.
            for (let attempt = 0; ; attempt += 1) {
                ctx.font = font.replace(`${fontPx}px`, `${size}px`);
                layout = layoutFilmLine({
                    words: buildFilmWords(line),
                    direction,
                    maxWidth: stage.width * 0.84,
                    spaceWidth: ctx.measureText(' ').width || size * 0.3,
                    lineHeight: size * 1.32,
                    measure,
                });
                if (attempt >= 4 || layout.rows.length * layout.lineHeight <= stage.height * 0.62) break;
                size *= 0.88;
            }
            const result: FilmLayout = { ...layout, fontSize: size };
            layouts.set(key, result);
            if (layouts.size > LAYOUT_CACHE_LIMIT) layouts.delete(layouts.keys().next().value as string);
            return result;
        };

        const drawLine = (index: number, line: Line, t: number, f: ReturnType<typeof shotFrame>, audio: FilmGateAudioFrame, tuning: FilmgateTuning) => {
            const state = live.current;
            const base = Math.min(Math.max(22, Math.min(stage.width * 0.082, stage.height * 0.12)), 120) * state.lyricsFontScale;
            const fontPx = Math.round(base);
            const font = `${resolveThemeFontWeight(state.theme, 700)} ${fontPx}px ${resolveThemeFontStack(state.theme)}`;
            const layout = layoutFor(index, line, fontPx, font);
            const size = layout.fontSize;
            ctx.font = font.replace(`${fontPx}px`, `${size}px`);
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'left';
            const lit = tuning.illumination;
            const midBoost = 0.12 * audio.mid * Math.min(1, lit);
            ctx.save();
            ctx.translate(stage.width / 2, stage.height * 0.47 + f.dy * stage.height);
            ctx.scale(f.scale, f.scale);
            if (f.blur > 0.4) ctx.filter = `blur(${(f.blur * Math.min(stage.width, stage.height) / 1000).toFixed(2)}px)`;
            const rowCount = layout.rows.length;
            layout.rows.forEach((row, rowIndex) => {
                const y = (rowIndex - (rowCount - 1) / 2) * layout.lineHeight;
                const left = -row.width / 2;
                for (const placed of row.words) {
                    const word = placed.word;
                    const light = wordLight(t, word.start, word.end);
                    const flat = lit <= 0.001;
                    const exposure = Math.min(1, flat ? 0.88 : light.exposure + (light.sweep > 0 && light.sweep < 1 ? midBoost : 0));
                    const alpha = f.alpha * exposure;
                    if (alpha < 0.01) continue;
                    ctx.save();
                    ctx.translate(left + placed.x + placed.width / 2, y + (flat ? 0 : light.rise) * size);
                    if (!flat) ctx.scale(light.scale, light.scale);
                    ctx.direction = word.dir;
                    const x0 = -placed.width / 2;
                    const active = !flat && light.glow > 0.02;
                    if (active) {
                        ctx.shadowColor = `rgba(255,170,76,${Math.min(0.9, 0.7 * light.glow * Math.min(1.5, lit)).toFixed(3)})`;
                        ctx.shadowBlur = size * 0.4 * light.glow * Math.min(1.5, lit);
                    }
                    ctx.globalAlpha = alpha;
                    if (!flat && light.sweep > 0 && light.sweep < 1) {
                        // One gradient across the whole word: lit up to the sweep front, a warm edge at it, dimmer after.
                        const rtl = word.dir === 'rtl';
                        const gradient = ctx.createLinearGradient(rtl ? x0 + placed.width : x0, 0, rtl ? x0 : x0 + placed.width, 0);
                        const s = light.sweep;
                        gradient.addColorStop(0, HOT);
                        gradient.addColorStop(Math.max(0, s - 0.08), HOT);
                        gradient.addColorStop(s, AMBER);
                        gradient.addColorStop(Math.min(1, s + 0.1), UNLIT);
                        gradient.addColorStop(1, UNLIT);
                        ctx.fillStyle = gradient;
                    } else {
                        ctx.fillStyle = !flat && light.sweep >= 1 && light.exposure > 0.85 ? HOT : IVORY;
                    }
                    ctx.fillText(word.text, x0, 0);
                    ctx.restore();
                }
            });
            ctx.restore();
            ctx.filter = 'none';
        };

        const frame = (stamp: number) => {
            if (!alive) return;
            raf = requestAnimationFrame(frame);
            const state = live.current;
            const t = currentTime.get();
            const dt = lastStamp < 0 ? 1 / 60 : Math.min(0.1, Math.max(0, (stamp - lastStamp) / 1000));
            lastStamp = stamp;
            const still = state.staticMode;
            if (still && stamp - lastDrawMs < STATIC_FRAME_MS && !dirty.current) return;
            // Paused with nothing changed: the picture is already right.
            if (state.paused && !still && !dirty.current && t === lastDrawnTime) return;
            lastDrawMs = stamp;
            lastDrawnTime = t;
            dirty.current = false;

            const reduce = still || (reduceMedia?.matches ?? false);
            const motion = reduce ? 0 : state.tuning.gateMotion;
            sampler.sample(dt, state.paused || still);
            if (!state.paused && !still) clock += dt;
            const audio = sampler.frame;
            const { width: w, height: h, ratio } = stage;
            ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
            ctx.clearRect(0, 0, w, h);

            const all = state.lines;
            const top = lastLineIndexAt(all, t);
            // Shots on screen: the newest line and the ones before it that have not finished leaving.
            let leak = 0;
            const shots: Array<{ index: number; line: Line; shot: ReturnType<typeof shotFrame> }> = [];
            for (let i = top; i >= 0 && i > top - 4; i -= 1) {
                const line = all[i]!;
                if (!line.fullText.trim()) continue;
                const next = all[i + 1];
                const shot = shotFrame(t, line.startTime, line.endTime, shotKindFor(i), next ? next.startTime - SHOT_IN : undefined);
                if (shot.visible) { shots.push({ index: i, line, shot }); leak = Math.max(leak, shot.leak); }
            }
            atmosphere.drawBack(ctx, w, h, clock, audio, state.tuning, reduce ? 0 : 1, leak);

            const gate = gateOffset(clock, motion, audio.kick, state.tuning.impact, audio.lowMid);
            ctx.save();
            ctx.translate(w / 2 + gate.dx * w, h / 2 + gate.dy * h);
            ctx.rotate(gate.rotation);
            ctx.scale(gate.squeeze, gate.squeeze);
            ctx.translate(-w / 2, -h / 2);
            if (state.showText) {
                for (let i = shots.length - 1; i >= 0; i -= 1) {
                    const item = shots[i]!;
                    drawLine(item.index, item.line, t, item.shot, audio, state.tuning);
                }
            }
            atmosphere.drawFront(ctx, w, h, clock, audio, state.tuning, reduce ? 0 : 1);
            ctx.restore();

            if (!announced) { announced = true; firstFrameDrawn(); }
        };
        raf = requestAnimationFrame(frame);

        return () => {
            alive = false;
            cancelAnimationFrame(raf);
            observer?.disconnect();
            atmosphere.dispose();
            layouts.clear();
        };
        // The loop is made once per mounted canvas; every other input is read through refs.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentTime, audioPower, audioBands, seed]);

    const translationFontSize = useMemo(() => `clamp(${(1.05 * lyricsFontScale).toFixed(3)}rem, ${(2.2 * lyricsFontScale).toFixed(3)}vw, ${(1.2 * lyricsFontScale).toFixed(3)}rem)`, [lyricsFontScale]);
    const upcomingFontSize = useMemo(() => `clamp(${(0.875 * lyricsFontScale).toFixed(3)}rem, ${(1.8 * lyricsFontScale).toFixed(3)}vw, ${(1 * lyricsFontScale).toFixed(3)}rem)`, [lyricsFontScale]);

    return (
        <VisualizerShell theme={theme} audioPower={audioPower} audioBands={audioBands} sharedProps={props}>
            <div ref={hostRef} className="relative z-10 h-full w-full pointer-events-none">
                <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
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

export default VisualizerFilmgate;
