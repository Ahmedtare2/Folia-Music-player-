import * as THREE from 'three';
import { detectTextDirection } from '../../../utils/lyrics/arabicText';

// src/components/visualizer/astral/astralTextRaster.ts
// Lyric words as small cached canvas textures, one per WHOLE word. The browser's own text engine does the shaping (Arabic joining,
// diacritics, per-glyph font fallback, the user's uploaded font) through the CSS font stack the caller resolves from the theme, so the
// hall's inscriptions look exactly like the app's other lyrics. Every word is drawn with a single fillText call: the red channel holds the
// crisp ink, the green channel a soft halo, and the shader colours them (and sweeps the light across by the word's own timing).
// The texture is opaque black behind, so the channels add cleanly; it is never rebuilt per frame.

export const ASTRAL_RASTER_FONT_PX = 96;
const PAD_EM = 0.42;
const BAND_EM = 1.45;
const MAX_CANVAS_PX = 2048;
const HALO_BLUR_EM = 0.14;

let measureCtx: CanvasRenderingContext2D | null = null;
const getMeasureCtx = () => {
    if (!measureCtx) {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        measureCtx = canvas.getContext('2d')!;
    }
    return measureCtx;
};

export const buildAstralFontSpec = (fontStack: string, fontWeight: number, px = ASTRAL_RASTER_FONT_PX) => `${fontWeight} ${px}px ${fontStack}`;

export const measureAstralText = (text: string, fontSpec: string): number => {
    const ctx = getMeasureCtx();
    ctx.font = fontSpec;
    return ctx.measureText(text).width;
};

export interface AstralWordRaster {
    texture: THREE.CanvasTexture;
    canvasWidthPx: number;
    canvasHeightPx: number;
    advancePx: number;
    /** Left and right padding as a fraction of the canvas width, so the shader can sweep over the ink only. */
    padFraction: number;
    key: string;
}

export const astralRasterKey = (text: string, fontStack: string, fontWeight: number) => `${fontWeight}|${fontStack}|${text}`;

export const rasterAstralWord = (text: string, fontStack: string, fontWeight: number): AstralWordRaster => {
    let px = ASTRAL_RASTER_FONT_PX;
    let spec = buildAstralFontSpec(fontStack, fontWeight, px);
    let advance = Math.max(1, Math.ceil(measureAstralText(text, spec)));
    if (advance + Math.ceil(px * PAD_EM) * 2 > MAX_CANVAS_PX) {
        px = Math.max(24, Math.floor(px * (MAX_CANVAS_PX - px * PAD_EM * 2) / advance));
        spec = buildAstralFontSpec(fontStack, fontWeight, px);
        advance = Math.max(1, Math.ceil(measureAstralText(text, spec)));
    }
    const pad = Math.ceil(px * PAD_EM);
    const width = advance + pad * 2;
    const height = Math.ceil(px * BAND_EM) + pad * 2;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false })!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    ctx.font = spec;
    ctx.direction = detectTextDirection(text);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.globalCompositeOperation = 'lighter';
    // Halo in green: the glyph is painted far off-canvas and only its blurred shadow lands here.
    const OFF = 10000;
    ctx.fillStyle = '#00ff00';
    for (const [blur, alpha] of [[px * HALO_BLUR_EM, 0.9], [px * HALO_BLUR_EM * 2.2, 0.55]] as const) {
        ctx.shadowColor = `rgba(0,255,0,${alpha})`;
        ctx.shadowBlur = blur;
        ctx.shadowOffsetX = OFF;
        ctx.shadowOffsetY = 0;
        ctx.fillText(text, pad - OFF, height / 2);
    }
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    // The crisp ink, in red, one fillText for the whole word.
    ctx.fillStyle = '#ff0000';
    ctx.fillText(text, pad, height / 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.NoColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 2;
    return { texture, canvasWidthPx: width, canvasHeightPx: height, advancePx: advance, padFraction: pad / width, key: astralRasterKey(text, fontStack, fontWeight) };
};

/** A small LRU of word rasters. Bounded so a long song never grows the texture memory. */
export const createAstralRasterCache = (limit = 96) => {
    const map = new Map<string, AstralWordRaster>();
    return {
        get: (text: string, fontStack: string, fontWeight: number): AstralWordRaster => {
            const key = astralRasterKey(text, fontStack, fontWeight);
            const held = map.get(key);
            if (held) { map.delete(key); map.set(key, held); return held; }
            const made = rasterAstralWord(text, fontStack, fontWeight);
            map.set(key, made);
            while (map.size > limit) {
                const oldest = map.keys().next().value as string;
                map.get(oldest)?.texture.dispose();
                map.delete(oldest);
            }
            return made;
        },
        get size() { return map.size; },
        clear: () => { map.forEach(r => r.texture.dispose()); map.clear(); },
    };
};
export type AstralRasterCache = ReturnType<typeof createAstralRasterCache>;
