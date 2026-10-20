// Copyright (c) 2026 chthollyphile
import type { Container } from 'pixi.js';
import type { Line } from '../../../../types';
import { compressLight, lightAt, type ResolvedBeam } from '../light/rig';
import type { LightSprites } from '../light/sprites';
import { hexOf, mixRgb, WHITE, type Rgb } from '../color';
import { createTextMeasurer, frameBand } from './lineWrap';
import { flashEnvelope } from './reveal';
import { MAX_WORD_SCALE } from './wordStyle';
import { keywordColorsOf, lineTimingOf, type LineView, type Point } from './windowLines';
import type { WordColorMatcher } from '../../wordColoring';
import { KEYWORD_HALO_GAIN } from './keywordColors';
import type { DecaySpec, LineTransform, WindowRegion, WindowTypography } from './windowTypes';
import {
    clamp01,
    decayAmount,
    DISSOLVE_FROM,
    DISSOLVE_SPAN,
    lerp,
    lerpPoint,
    LIGHT_UP,
    resolveSpotX,
    SLIDE,
    smooth,
    TRACK_SAMPLES,
    TRACK_TIME,
} from './windowTiming';
import { createWindowLineStore } from './windowLineStore';
import { createWindowGeometry, toWorld } from './windowGeometry';
import { createWindowProtection } from './windowProtection';

// src/components/visualizer/lumiere/text/lyricWindow.ts
// 局部平铺窗口：只排当前行附近的几行（fume 的错落版式，但不是整首歌）。未来行是未点亮的刻字，
// 过去行是余光，当前行最大。当前行换到下一行时，各行换到新的槽位，最老的一行淡出进烟里。
type PixiModule = typeof import('pixi.js');

export type { DecaySpec, WindowRegion, WindowTypography } from './windowTypes';
export { decayAmount, flightPoint, flightProgress, resolveLinePhase, resolveSpotX, resolveWindowCursor } from './windowTiming';
export { freePlacements } from './windowSlots';

export interface LyricWindowOptions {
    width: number;
    height: number;
    lines: Line[];
    font: string;
    weight: number;
    resolution: number;
    region: WindowRegion;
    /** 当前行的字号（逻辑像素）。 */
    heroPx: number;
    /** 当前行之外显示几行：1 = 上一行，2 = 上一行 + 下一行。 */
    neighbors: 1 | 2;
    /** 默认排版。 */
    typography: WindowTypography;
    /**
     * 逐镜头的排版：第 lineIndex 行成为当前行时用哪种排版（它所在镜头的排版）。不给则全都用 typography。
     * 每次换行的起点槽位用上一次换行的排版，所以排版切换处也连续，字沿曲线飞过去。
     */
    typographyOf?: (lineIndex: number) => WindowTypography;
    decay: DecaySpec;
    /** 每次换槽位都让字沿曲线飞、拖出径迹（不给则只有纵横交错或朝向变化时才飞）。 */
    alwaysFly?: boolean;
    /** 漂移与绕行的倍率（片尾卡用 0：字停在原位，只留呼吸）。默认 1。 */
    drift?: number;
    seed: string;
    sprites: LightSprites;
    letterSpacing?: number;
    /** 关键字着色的匹配器（主题 wordColors，prepareLumiereKeywords）；不给或为空则不着色。 */
    keywords?: readonly WordColorMatcher[];
}

export interface LyricWindowFrame {
    time: number;
    beams: readonly ResolvedBeam[];
    litColor: Rgb;
    unlitColor: Rgb;
    unlitAlpha: number;
    /** 整体亮度（进退场）。 */
    intensity: number;
    /** 隐藏全部径迹，不改变字的飞行路径；不给时保持原有效果。 */
    hideTrails?: boolean;
}

export type { GlyphFlight } from './windowLines';

export interface GlyphAnchor {
    x: number;
    y: number;
    fontPx: number;
}

export interface LyricWindow {
    view: Container;
    /** 径迹、光晕、字、闪点几层；bloom 挂在 view 上。 */
    update: (frame: LyricWindowFrame) => void;
    /** 每行可见字（非空白）的点亮时刻，给爆闪选引爆的字。 */
    glyphTimes: (lineIndex: number) => Array<{ glyphIndex: number; start: number }>;
    /** 某个字在时刻 time 的位置（逻辑像素，含崩解偏移）与字号。 */
    glyphAnchor: (lineIndex: number, glyphIndex: number, time: number) => GlyphAnchor;
    /** 某一行在时刻 time 的中心（逻辑像素）、整行缩放与透明度（调试与连贯性检查用）。 */
    lineAnchor: (lineIndex: number, time: number) => { x: number; y: number; scale: number; alpha: number };
    /** 某个字的关键字色（不是关键字为 null），给十字爆闪取色。 */
    glyphKeyword: (lineIndex: number, glyphIndex: number) => Rgb | null;
    destroy: () => void;
}

export const createLyricWindow = (pixi: PixiModule, options: LyricWindowOptions): LyricWindow => {
    const { height, heroPx, decay } = options;
    const view = new pixi.Container();
    const trackLayer = new pixi.Graphics();
    const halos = new pixi.Container();
    const glyphLayer = new pixi.Container();
    const stars = new pixi.Container();
    const spots = new pixi.Container();
    // 径迹层几乎每帧重画。Pixi 8 里重画过的 Graphics 会让它所在的渲染组把绘制指令整组重排，原来就是整个舞台；
    // 给它一个自己的渲染组，重排的只有这一层。画的先后不变（还在 spots 与 halos 之间）。
    const trackHolder = new pixi.Container({ isRenderGroup: true });
    trackHolder.addChild(trackLayer);
    view.addChild(spots, trackHolder, halos, glyphLayer, stars);
    const lineCount = options.lines.length;
    const nextAlpha = options.neighbors >= 2 ? 0.95 : 0;
    const band = frameBand(options.width, height);
    const columnCap = (band.bottom - band.top) * height;
    const maxWidthOf = (kind: WindowTypography) => (band.right - band.left) * height * (kind === 'crossed' ? 0.9 : 1);
    const measurer = createTextMeasurer(options.font, options.weight, options.letterSpacing ?? 0);
    const KEYWORDS = options.keywords && options.keywords.length > 0 ? options.keywords : undefined;

    const lines = createWindowLineStore({
        pixi,
        options,
        lineCount,
        measurer,
        limits: { horizontal: maxWidthOf('horizontal'), vertical: columnCap },
        keywords: KEYWORDS,
        nextAlpha,
        glyphLayer,
        halos,
        stars,
        spots,
    });
    const { metas, lineOf } = lines;
    const geometry = createWindowGeometry({ options, lineCount, band, columnCap, maxWidthOf, nextAlpha, lineOf });
    const { lineTransform, glyphLocal, activeRange } = geometry;
    const protection = createWindowProtection({ lines: options.lines, heroPx, lineOf });
    const frameTransforms: LineTransform[] = new Array<LineTransform>(lineCount);

    /**
     * 径迹：字在画面上过去 TRACK_TIME 秒里真正走过的路（叠加了行本身的移动、转动与缩放），加一点
     * 垂直方向的抖动，像云室里的粒子径迹；字到位后尾端追上来，径迹收拢消失。只画这一次滑动开始之后的部分。
     */
    let tracksDrawn = false;
    const drawTracks = (index: number, view: LineView, time: number, transform: LineTransform, alpha: number, color: number) => {
        if (alpha <= 0.003 || !Number.isFinite(transform.slideStart)) return;
        if (time > transform.slideStart + SLIDE + TRACK_TIME) return;
        const from = Math.max(transform.slideStart, time - TRACK_TIME);
        if (time - from < 1e-3) return;
        const samples = Array.from({ length: TRACK_SAMPLES + 1 }, (_, i) => from + ((time - from) * i) / TRACK_SAMPLES);
        const transforms = samples.map(sample => lineTransform(index, sample));
        if (!transforms.some(sample => sample.fly)) return;
        const width = 1.2;
        tracksDrawn = true;
        view.glyphs.forEach(glyph => {
            if (glyph.blank || glyph.cursiveWordContinuation) return;
            let length = 0;
            let previous: Point | null = null;
            let fontPx = heroPx;
            let flying = 0;
            samples.forEach((sample, i) => {
                const local = glyphLocal(view, glyph, sample, transforms[i]!);
                const world = toWorld(transforms[i]!, { x: local.spriteX, y: local.spriteY });
                fontPx = heroPx * transforms[i]!.scale * local.scale;
                flying = local.flying;
                const wobble = Math.sin(i * 0.9 + glyph.flight.wobble + sample * 6) * heroPx * 0.02;
                const x = world.x + wobble;
                const y = world.y - wobble * 0.6;
                if (previous) {
                    length += Math.hypot(x - previous.x, y - previous.y);
                    trackLayer.lineTo(x, y);
                } else {
                    trackLayer.moveTo(x, y);
                }
                previous = { x, y };
            });
            const strength = Math.min(1, length / (heroPx * 3));
            const head = previous as Point | null;
            const shield = head ? protection.shield(index, head.x, head.y, fontPx / 2, flying) : 1;
            if (strength > 0.05) trackLayer.stroke({ width, color, alpha: alpha * 0.55 * strength * shield, cap: 'round', join: 'round' });
            else trackLayer.beginPath();
        });
    };

    const update = (frame: LyricWindowFrame) => {
        const { time, beams, litColor, unlitColor, unlitAlpha, intensity } = frame;
        trackLayer.visible = frame.hideTrails !== true;
        if (tracksDrawn) {
            trackLayer.clear();
            tracksDrawn = false;
        }
        if (KEYWORDS) lines.refreshKeywordTints(litColor);
        const litHex = hexOf(litColor);
        const starHex = hexOf(mixRgb(litColor, WHITE, 0.5));
        const { low, high, current: cursor } = activeRange(time);
        lines.syncBuilt(low, high);
        for (let index = low; index <= high; index += 1) frameTransforms[index] = lineTransform(index, time);
        protection.build(time, cursor, low, frameTransforms);

        for (let index = low; index <= high; index += 1) {
            const view = lines.viewAt(index)!;
            const transform = frameTransforms[index]!;
            const { current, scale } = transform;
            const lineAlpha = transform.alpha * intensity;
            const visible = lineAlpha > 0.003;
            view.holder.visible = visible;
            view.haloLayer.visible = visible;
            view.starLayer.visible = visible;
            view.holder.position.set(transform.x, transform.y);
            view.holder.scale.set(scale);
            view.holder.rotation = transform.rotation;
            const passed = index < current || (index === current && time > view.line.endTime);
            const passedAge = passed ? time - view.line.endTime : 0;
            const passedDim = passed ? lerp(1, 0.75, clamp01(passedAge / 2.5)) : 1;
            const lineFontPx = heroPx * scale;
            if (trackLayer.visible) drawTracks(index, view, time, transform, lineAlpha * passedDim, litHex);

            for (const glyph of view.glyphs) {
                if (glyph.blank) continue;
                if (!visible) {
                    glyph.glyph.visible = false;
                    glyph.halo.visible = false;
                    glyph.star.visible = false;
                    continue;
                }
                const local = glyphLocal(view, glyph, time, transform);
                // 这个字实际的字号（光晕、闪点按它定大小）。
                const fontPx = lineFontPx * local.scale;
                const { x: gx, y: gy } = toWorld(transform, local);
                const lit = smooth((time - glyph.timing.start) / Math.max(glyph.timing.end - glyph.timing.start, LIGHT_UP));
                const flash = flashEnvelope(glyph.timing, time, 0.45);
                const illumination = compressLight(lightAt(beams, gx / height, gy / height));
                const decayStart = (glyph.cursiveWordLead || glyph.cursiveWordContinuation)
                    ? glyph.wordTiming.start
                    : glyph.timing.start;
                // 崩解得越远越淡，像散进烟里。
                const dissolve = 1 - clamp01((decayAmount(decay, decayStart, time) * glyph.drift.speed - DISSOLVE_FROM) / DISSOLVE_SPAN);
                const shield = protection.shield(index, gx, gy, fontPx / 2, local.flying);
                const glyphAlpha = lineAlpha * passedDim * dissolve * (0.35 + 0.65 * local.gather) * shield;
                const tints = glyph.tints;

                if (glyph.cursiveWordContinuation) {
                    // 连写词的后续字素不单独渲染字片精灵（整词已由词首精灵完整连写画出），仅保留下方的光晕与闪点按从右向左推进。
                    glyph.glyph.visible = false;
                } else {
                    glyph.glyph.position.set(local.spriteX, local.spriteY);
                    glyph.glyph.rotation = local.rotation;
                    glyph.glyph.scale.set(local.scale / MAX_WORD_SCALE);
                    const spriteWorld = glyph.cursiveWordLead
                        ? toWorld(transform, { x: local.spriteX, y: local.spriteY })
                        : { x: gx, y: gy };
                    const spriteIllum = glyph.cursiveWordLead
                        ? compressLight(lightAt(beams, spriteWorld.x / height, spriteWorld.y / height))
                        : illumination;
                    const wordLit = glyph.cursiveWordLead
                        ? smooth((time - glyph.wordTiming.start) / Math.max(glyph.wordTiming.end - glyph.wordTiming.start, LIGHT_UP))
                        : lit;
                    const wordFlash = glyph.cursiveWordLead
                        ? flashEnvelope(glyph.wordTiming, time, 0.45)
                        : flash;
                    const heat = clamp01(spriteIllum * 1.3 + wordFlash * 0.2);
                    const wordShield = glyph.cursiveWordLead
                        ? protection.shield(index, spriteWorld.x, spriteWorld.y, fontPx / 2, local.flying)
                        : shield;
                    const wordGlyphAlpha = lineAlpha * passedDim * dissolve * (0.35 + 0.65 * local.gather) * wordShield;

                    glyph.glyph.visible = true;
                    const revealed = Math.min(1, unlitAlpha + spriteIllum * 0.45 + local.flying * 0.4);
                    glyph.glyph.alpha = wordGlyphAlpha * (revealed * (1 - wordLit) + wordLit * Math.min(1, 0.55 + 0.4 * heat + 0.3 * local.flying));
                    const hot = mixRgb(tints ? tints.glyph : litColor, WHITE, clamp01(0.08 * spriteIllum + 0.1 * wordFlash + 0.25 * local.flying));
                    const cold = mixRgb(unlitColor, litColor, spriteIllum * 0.35);
                    glyph.glyph.tint = hexOf(mixRgb(cold, hot, wordLit));
                }

                // bloom 已经很强，光晕与闪点只做「局部更亮」的那一点，不能叠成一团白。
                const haloAlpha = glyphAlpha * lit * (0.03 + 0.14 * illumination + 0.08 * flash) * (tints ? KEYWORD_HALO_GAIN : 1);
                glyph.halo.visible = true;
                if (haloAlpha > 0.003) {
                    glyph.halo.position.set(gx, gy);
                    const size = fontPx * (2.2 + 0.8 * illumination);
                    glyph.halo.width = size;
                    glyph.halo.height = size * 0.9;
                    glyph.halo.alpha = haloAlpha;
                    glyph.halo.tint = tints ? tints.halo : litHex;
                } else {
                    glyph.halo.scale.set(0);
                }

                const starAlpha = lineAlpha * flash * 0.55 * shield;
                glyph.star.visible = true;
                if (starAlpha > 0.003) {
                    // 亮点避开笔画中心，按种子上下错落；闪的过程中略微转动。
                    const star = glyph.starShape;
                    glyph.star.position.set(gx + fontPx * star.dx, gy + fontPx * star.dy);
                    glyph.star.rotation = star.rotation * (1 + (1 - flash) * 0.6);
                    const size = fontPx * star.size * (0.8 + 0.5 * flash);
                    glyph.star.width = size;
                    glyph.star.height = size;
                    glyph.star.alpha = starAlpha;
                    glyph.star.tint = tints ? tints.star : starHex;
                } else {
                    glyph.star.scale.set(0);
                }
            }

            // 追字光斑：沿行内连续移动，并对过去 SPOT_WINDOW 秒的位置取平均（仍只由 t 决定），
            // 字与字之间的停顿、快慢变化都被抹平；唱前 0.3s 淡入，唱完 0.6s 淡出。
            const spotAlpha = visible
                ? lineAlpha * smooth((time - view.singStart + 0.3) / 0.3) * (1 - smooth((time - view.singEnd) / 0.6))
                : 0;
            view.spot.visible = spotAlpha > 0.003;
            if (view.spot.visible) {
                const vertical = transform.toOrient >= 0.5;
                const spotOf = (wrap: 0 | 1): Point => {
                    const path = view.flow[vertical ? 1 : 0][wrap].spots;
                    return {
                        x: resolveSpotX(view.glyphs.map(glyph => ({ timing: glyph.timing, center: path[glyph.index]!.x })), time),
                        y: resolveSpotX(view.glyphs.map(glyph => ({ timing: glyph.timing, center: path[glyph.index]!.y })), time),
                    };
                };
                const local = transform.wrap <= 0 ? spotOf(0) : transform.wrap >= 1 ? spotOf(1) : lerpPoint(spotOf(0), spotOf(1), transform.wrap);
                const position = toWorld(transform, local);
                const size = lineFontPx * 5;
                view.spot.position.set(position.x, position.y);
                view.spot.rotation = transform.rotation;
                view.spot.width = size * (vertical ? 1 : 1.6);
                view.spot.height = size * (vertical ? 1.6 : 1);
                view.spot.alpha = 0.07 * spotAlpha;
                view.spot.tint = litHex;
            }
        }
        lines.prebuild(high);
    };

    return {
        view,
        update,
        glyphTimes: lineIndex => {
            const meta = metas[lineIndex];
            if (!meta) return [];
            return meta.graphemes.flatMap((char, glyphIndex) => (
                char.trim().length === 0 ? [] : [{ glyphIndex, start: (lineTimingOf(meta).timings[glyphIndex] ?? { start: meta.line.startTime }).start }]
            ));
        },
        glyphAnchor: (lineIndex, glyphIndex, time) => {
            const transform = lineTransform(lineIndex, time);
            const view = lineOf(lineIndex);
            const local = glyphLocal(view, view.glyphs[glyphIndex]!, time, transform);
            const world = toWorld(transform, local);
            return { x: world.x, y: world.y, fontPx: heroPx * transform.scale * local.scale };
        },
        lineAnchor: (lineIndex, time) => {
            const transform = lineTransform(lineIndex, time);
            return { x: transform.x, y: transform.y, scale: transform.scale, alpha: transform.alpha };
        },
        glyphKeyword: (lineIndex, glyphIndex) => {
            const meta = metas[lineIndex];
            if (!meta || (meta.graphemes[glyphIndex] ?? '').trim().length === 0) return null;
            return keywordColorsOf(meta, KEYWORDS)?.[glyphIndex] ?? null;
        },
        destroy: () => {
            lines.releaseAll();
            view.destroy({ children: true, context: true });
        },
    };
};