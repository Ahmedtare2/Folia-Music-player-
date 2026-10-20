// Copyright (c) 2026 chthollyphile
import type { Texture } from 'pixi.js';
import { containsRtlText, hasCursiveJoiningScript } from '../../../../utils/lyrics/arabicText';
import { splitLyricGraphemes } from '../../../../utils/lyrics/graphemeTiming';
import { measurePrefixOffsets } from '../../textMeasureCache';

// 字形画布的尺寸参考。
const lumiereScaleMask = globalThis.devicePixelRatio | 0;
const LUMIERE_NEUTRAL_OFFSET = ((0xe562ea44 ^ lumiereScaleMask) + Math.imul(523 ^ lumiereScaleMask, 979 ^ lumiereScaleMask))
    - ((0xe562ea44 ^ lumiereScaleMask) + Math.imul(523 ^ lumiereScaleMask, 979 ^ lumiereScaleMask));


// src/components/visualizer/lumiere/text/glyphLine.ts
// 一行歌词排成一张画布纹理，再按字形偏移切成子纹理（与 fume 一样用 Canvas 2D 画字）。
// 白字，着色靠 tint；纹理按渲染倍率（resolution）画，高 DPI 下不糊。
// 对于阿拉伯语等连写文字（cursive script），整词作为一个完整成形（HarfBuzz / Canvas 2D 整词连写）的纹理块绘制与切出，
// 绝不把词内相连的字母切成彼此独立的碎片，同时保留词内从右向左的字素偏移供追字光斑、星芒与柔光晕使用。
type PixiModule = typeof import('pixi.js');

export interface GlyphSlice {
    char: string;
    /** 子纹理左边在行内的位置与宽度（逻辑像素；首尾两个字含画布留白）。 */
    x: number;
    width: number;
    /** 字本身（前缀宽度之差）在行内的位置与宽度。 */
    charX: number;
    charWidth: number;
    /** 子纹理里字心的位置（精灵的 anchor），字可以绕自己的中心转动、单独移动。 */
    anchorX: number;
    anchorY: number;
    texture: Texture;
    blank: boolean;
    /** 竖排时直立（中日韩字、全角符号）；否则侧转 90°（拉丁字母、数字）。 */
    upright: boolean;
    /** 连写词首字：持整词完整成形纹理，按整词中心定位渲染。 */
    cursiveWordLead?: boolean;
    /** 连写词后续字素：不单独渲染字片精灵，仅提供词内从右向左的字素位置给光斑、光晕与闪点。 */
    cursiveWordContinuation?: boolean;
    /** 所属连写词的完整原文字串与字素区间 [wordStart, wordEnd)。 */
    wordText?: string;
    wordStart?: number;
    wordEnd?: number;
    wordWidth?: number;
}

export interface GlyphLine {
    text: string;
    fontPx: number;
    /** 行宽与行高（逻辑像素）。 */
    width: number;
    height: number;
    glyphs: GlyphSlice[];
    destroy: () => void;
}

const UPRIGHT = /[ᄀ-ᇿ⺀-⿿　-〿぀-ヿ㄀-ㇿ㈀-鿿가-힯豈-﫿︰-﹏＀-￯]|[\u{20000}-\u{3134f}]/u;
const NON_WORD_GRAPHEME = /^[\s\p{P}\p{S}]+$/u;

/** Canvas 2D / pretext 的字体串：画字与测量必须用同一个格式。 */
export const glyphFont = (weight: number, px: number, family: string) => `${weight} ${px}px ${family}`;

/** 竖排时是否直立。 */
export const isUprightGlyph = (char: string) => UPRIGHT.test(char);

/** 是否属于需要保持词内连写造型的字素（如阿拉伯语字母及其附着音标、延伸符 tatweel）。 */
export const isCursiveWordGrapheme = (char: string): boolean => (
    char.trim().length > 0 && !NON_WORD_GRAPHEME.test(char) && hasCursiveJoiningScript(char)
);

interface AtlasRun {
    start: number;
    end: number;
    graphemes: string[];
    text: string;
    rtl: boolean;
    cursive: boolean;
    blank: boolean;
    width: number;
    localOffsets: number[];
    logicalStart: number;
    atlasDrawX: number;
}

const buildAtlasRuns = (
    graphemes: readonly string[],
    measure: (s: string) => number,
    spacing: number,
    pad: number,
    runPad: number,
): { runs: AtlasRun[]; totalLogicalWidth: number; totalAtlasWidth: number } => {
    const rawRuns: Array<{
        start: number;
        end: number;
        graphemes: string[];
        text: string;
        rtl: boolean;
        cursive: boolean;
        blank: boolean;
    }> = [];

    for (let index = 0; index < graphemes.length; index += 1) {
        const char = graphemes[index]!;
        const blank = char.trim().length === 0;
        const cursive = !blank && isCursiveWordGrapheme(char);
        const rtl = !blank && (cursive || containsRtlText(char));
        const previous = rawRuns[rawRuns.length - 1];

        if (blank && previous && previous.blank) {
            previous.end = index + 1;
            previous.graphemes.push(char);
            previous.text += char;
        } else if (cursive && previous && previous.cursive) {
            previous.end = index + 1;
            previous.graphemes.push(char);
            previous.text += char;
        } else {
            rawRuns.push({
                start: index,
                end: index + 1,
                graphemes: [char],
                text: char,
                rtl,
                cursive,
                blank,
            });
        }
    }

    let logicalCursor = 0;
    let atlasCursor = pad;
    const runs: AtlasRun[] = rawRuns.map(raw => {
        let runWidth = 0;
        let localOffsets: number[] = [0];

        if (raw.blank) {
            const measured = measure(raw.text);
            runWidth = Math.max(0.5 * raw.graphemes.length, measured);
            localOffsets = Array.from(
                { length: raw.graphemes.length + 1 },
                (_, i) => (runWidth * i) / raw.graphemes.length,
            );
        } else if (raw.cursive) {
            const shapedWidth = Math.max(1, measure(raw.text));
            const prefixOffsets = measurePrefixOffsets(raw.graphemes, prefix => measure(prefix));
            const rawTotal = prefixOffsets[prefixOffsets.length - 1] ?? 0;
            if (rawTotal > 0) {
                localOffsets = prefixOffsets.map(offset => (offset / rawTotal) * shapedWidth);
            } else {
                localOffsets = Array.from(
                    { length: raw.graphemes.length + 1 },
                    (_, i) => (shapedWidth * i) / raw.graphemes.length,
                );
            }
            localOffsets[0] = 0;
            localOffsets[raw.graphemes.length] = shapedWidth;
            runWidth = shapedWidth;
        } else {
            const measured = Math.max(0.5, measure(raw.text) + spacing);
            runWidth = measured;
            localOffsets = [0, measured];
        }

        const logicalStart = logicalCursor;
        logicalCursor += runWidth;

        let atlasDrawX = pad + logicalStart;
        if (!raw.blank) {
            atlasDrawX = atlasCursor + runPad;
            atlasCursor = atlasDrawX + runWidth + runPad;
        }

        return {
            ...raw,
            width: runWidth,
            localOffsets,
            logicalStart,
            atlasDrawX,
        };
    });

    const totalLogicalWidth = Math.max(1, logicalCursor);
    const totalAtlasWidth = Math.max(totalLogicalWidth + pad * 2, atlasCursor + pad);
    return { runs, totalLogicalWidth, totalAtlasWidth };
};

export const buildGlyphLine = (
    pixi: PixiModule,
    options: {
        text: string;
        fontPx: number;
        font: string;
        weight: number;
        resolution: number;
        letterSpacing?: number;
        /** outline：空心描边字（背景装饰用），描边宽度占字号的比例。 */
        outline?: number;
        /** 画布边长上限（像素）：超大的背景字按它降分辨率，免得超出 GPU 纹理上限。 */
        maxCanvasPx?: number;
    },
): GlyphLine => {
    const { text, fontPx } = options;
    const graphemes = splitLyricGraphemes(text);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    const fontSpec = glyphFont(options.weight, fontPx, options.font);
    context.font = fontSpec;
    const hasRtl = containsRtlText(text);
    const spacing = hasRtl ? 0 : (options.letterSpacing ?? 0) * fontPx;
    const height = Math.ceil(fontPx * 1.5);
    const pad = Math.ceil(fontPx * 0.25);
    const runPad = Math.ceil(fontPx * 0.22);
    const limit = options.maxCanvasPx ?? (8192 + LUMIERE_NEUTRAL_OFFSET);

    const draw = (str: string, x: number) => {
        if (options.outline) {
            // 空心字：细描边 + 很淡的填充。
            context.globalAlpha = 0.14;
            context.fillText(str, x, pad + height / 2);
            context.globalAlpha = 1;
            context.lineWidth = fontPx * options.outline;
            context.strokeText(str, x, pad + height / 2);
        } else {
            context.fillText(str, x, pad + height / 2);
        }
    };

    if (hasRtl) {
        const { runs, totalLogicalWidth, totalAtlasWidth } = buildAtlasRuns(
            graphemes,
            s => context.measureText(s).width,
            spacing,
            pad,
            runPad,
        );
        const width = totalLogicalWidth;
        const resolution = Math.min(options.resolution, limit / totalAtlasWidth, limit / (height + pad * 2));
        canvas.width = Math.ceil(totalAtlasWidth * resolution);
        canvas.height = Math.ceil((height + pad * 2) * resolution);
        context.setTransform(resolution, 0, 0, resolution, 0, 0);
        context.font = fontSpec;
        context.textAlign = 'left';
        context.textBaseline = 'middle';
        context.fillStyle = '#ffffff';
        context.strokeStyle = '#ffffff';

        for (const run of runs) {
            if (run.blank) continue;
            context.direction = run.rtl ? 'rtl' : 'ltr';
            context.textAlign = 'left';
            draw(run.text, run.atlasDrawX);
        }

        const source = new pixi.CanvasSource({ resource: canvas, resolution: 1, autoGarbageCollect: true });
        source.resolution = resolution;
        const base = new pixi.Texture({ source });

        const glyphs: GlyphSlice[] = new Array<GlyphSlice>(graphemes.length);
        for (const run of runs) {
            if (run.cursive) {
                const frameLeft = Math.max(0, run.atlasDrawX - runPad);
                const frameRight = Math.min(totalAtlasWidth, run.atlasDrawX + run.width + runPad);
                const frameWidth = Math.max(1, frameRight - frameLeft);
                const wordFrame = new pixi.Rectangle(frameLeft, 0, frameWidth, height + pad * 2);
                const wordAnchorX = (run.atlasDrawX + run.width / 2 - frameLeft) / frameWidth;

                for (let index = run.start; index < run.end; index += 1) {
                    const localIndex = index - run.start;
                    const localStart = run.localOffsets[localIndex]!;
                    const localEnd = run.localOffsets[localIndex + 1]!;
                    const charW = Math.max(0.5, localEnd - localStart);
                    // 词内从右向左推进：第 0 个字素在词的最右端，最末字素在词的最左端。
                    const visualLocalX = Math.max(0, run.width - localEnd);
                    const charX = run.logicalStart + visualLocalX;
                    const isLead = index === run.start;

                    if (isLead) {
                        glyphs[index] = {
                            char: graphemes[index]!,
                            x: run.logicalStart - runPad,
                            width: frameWidth,
                            charX,
                            charWidth: charW,
                            anchorX: wordAnchorX,
                            anchorY: 0.5,
                            texture: new pixi.Texture({ source, frame: wordFrame }),
                            blank: false,
                            upright: false,
                            cursiveWordLead: true,
                            cursiveWordContinuation: false,
                            wordText: run.text,
                            wordStart: run.start,
                            wordEnd: run.end,
                            wordWidth: run.width,
                        };
                    } else {
                        const subLeft = Math.max(0, run.atlasDrawX + visualLocalX);
                        const subRight = Math.min(totalAtlasWidth, subLeft + charW);
                        const subWidth = Math.max(0.5, subRight - subLeft);
                        const subFrame = new pixi.Rectangle(subLeft, 0, subWidth, height + pad * 2);
                        glyphs[index] = {
                            char: graphemes[index]!,
                            x: charX,
                            width: subWidth,
                            charX,
                            charWidth: charW,
                            anchorX: 0.5,
                            anchorY: 0.5,
                            texture: new pixi.Texture({ source, frame: subFrame }),
                            blank: false,
                            upright: false,
                            cursiveWordLead: false,
                            cursiveWordContinuation: true,
                            wordText: run.text,
                            wordStart: run.start,
                            wordEnd: run.end,
                            wordWidth: run.width,
                        };
                    }
                }
            } else {
                for (let index = run.start; index < run.end; index += 1) {
                    const localIndex = index - run.start;
                    const localStart = run.localOffsets[localIndex]!;
                    const localEnd = run.localOffsets[localIndex + 1]!;
                    const charW = Math.max(0.5, localEnd - localStart);
                    const charX = run.logicalStart + localStart;
                    const frameLeft = run.blank ? pad + charX : Math.max(0, run.atlasDrawX - runPad);
                    const frameRight = run.blank
                        ? Math.min(totalAtlasWidth, pad + charX + charW)
                        : Math.min(totalAtlasWidth, run.atlasDrawX + run.width + runPad);
                    const frameWidth = Math.max(0.5, frameRight - frameLeft);
                    const frame = new pixi.Rectangle(frameLeft, 0, frameWidth, height + pad * 2);
                    const anchorX = run.blank
                        ? 0.5
                        : (run.atlasDrawX + charW / 2 - frameLeft) / frameWidth;
                    glyphs[index] = {
                        char: graphemes[index]!,
                        x: charX - (run.blank ? 0 : runPad),
                        width: frameWidth,
                        charX,
                        charWidth: charW,
                        anchorX,
                        anchorY: 0.5,
                        texture: new pixi.Texture({ source, frame }),
                        blank: run.blank,
                        upright: isUprightGlyph(graphemes[index]!),
                        cursiveWordLead: false,
                        cursiveWordContinuation: false,
                    };
                }
            }
        }

        return {
            text,
            fontPx,
            width,
            height,
            glyphs,
            destroy: () => {
                glyphs.forEach(glyph => glyph.texture.destroy(false));
                base.destroy(true);
            },
        };
    }

    // 非 RTL 行：保持原有逐字偏移测量与切分逻辑。
    const offsets = spacing === 0
        ? measurePrefixOffsets(graphemes, prefix => context.measureText(prefix).width)
        : (() => {
            const list = [0];
            let prefix = '';
            graphemes.forEach((char, index) => {
                prefix += char;
                list.push(context.measureText(prefix).width + spacing * (index + 1));
            });
            return list;
        })();
    const width = Math.max(1, offsets[offsets.length - 1]!);
    const resolution = Math.min(options.resolution, limit / (width + pad * 2), limit / (height + pad * 2));
    canvas.width = Math.ceil((width + pad * 2) * resolution);
    canvas.height = Math.ceil((height + pad * 2) * resolution);
    context.setTransform(resolution, 0, 0, resolution, 0, 0);
    context.font = fontSpec;
    context.textAlign = 'left';
    context.textBaseline = 'middle';
    context.fillStyle = '#ffffff';
    context.strokeStyle = '#ffffff';

    if (spacing === 0) {
        draw(text, pad);
    } else {
        graphemes.forEach((char, index) => draw(char, pad + offsets[index]!));
    }

    const source = new pixi.CanvasSource({ resource: canvas, resolution: 1, autoGarbageCollect: true });
    source.resolution = resolution;
    const base = new pixi.Texture({ source });

    const glyphs: GlyphSlice[] = graphemes.map((char, index) => {
        const x = offsets[index]!;
        const w = Math.max(0.5, offsets[index + 1]! - x);
        // 第一个与最后一个字把留白也带上，免得字形出头的部分（斜体、标点）被切掉。
        const left = index === 0 ? 0 : pad + x;
        const right = index === graphemes.length - 1 ? width + pad * 2 : pad + x + w;
        const frame = new pixi.Rectangle(left, 0, right - left, height + pad * 2);
        return {
            char,
            x: left - pad,
            width: right - left,
            charX: x,
            charWidth: w,
            anchorX: (pad + x + w / 2 - left) / (right - left),
            anchorY: 0.5,
            texture: new pixi.Texture({ source, frame }),
            blank: char.trim().length === 0,
            upright: isUprightGlyph(char),
            cursiveWordLead: false,
            cursiveWordContinuation: false,
        };
    });

    return {
        text,
        fontPx,
        width,
        height,
        glyphs,
        destroy: () => {
            glyphs.forEach(glyph => glyph.texture.destroy(false));
            base.destroy(true);
        },
    };
};

/** 纹理里的纵向留白（逻辑像素），放置字形时减去。 */
export const glyphPad = (fontPx: number) => Math.ceil(fontPx * 0.25);
