import * as THREE from 'three';
import type { Line } from '../../../types';
import { detectTextDirection } from '../../../utils/lyrics/arabicText';
import { easeInOut } from './astralCameraPath';
import {
    activeLineIndexAt, buildAstralWords, layoutAstralLine, wordProgress, type AstralLayout,
} from './astralLyricLayout';
import {
    ASTRAL_RASTER_FONT_PX, buildAstralFontSpec, createAstralRasterCache, measureAstralText, type AstralRasterCache,
} from './astralTextRaster';

// src/components/visualizer/astral/astralLyrics.ts
// The inscriptions. The active lyric line is a set of word planes on a soft glass panel that hangs in the hall in front of the camera
// (carried in camera space, so the camera's journey can never put the words at an unreadable angle, and the camera is always level).
// Each WHOLE word is one plane with one cached texture; a shader lights it with the word's own timing and sweeps the light the way the
// word reads (right to left for Arabic). The lower-centre band is the lyric zone. Layouts and textures are cached and bounded; nothing
// here allocates per frame beyond the few uniform writes.

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const WORD_FRAG = /* glsl */ `
varying vec2 vUv;
uniform sampler2D uMap;
uniform float uProgress;
uniform float uDir;
uniform float uAct;
uniform float uGlow;
uniform float uFade;
uniform float uPad;
void main() {
    vec4 t = texture2D(uMap, vUv);
    float ink = t.r;
    float halo = t.g;
    // x along the reading direction inside the ink box.
    float x = uDir > 0.0 ? vUv.x : 1.0 - vUv.x;
    float xi = clamp((x - uPad) / max(0.0001, 1.0 - 2.0 * uPad), 0.0, 1.0);
    float lit = uProgress >= 2.0 ? 1.0 : (uProgress < 0.0 ? 0.0 : 1.0 - smoothstep(uProgress - 0.16, uProgress + 0.03, xi));
    vec3 ivory = vec3(0.96, 0.92, 0.82);
    vec3 gold = vec3(1.0, 0.82, 0.46);
    vec3 up = ivory * 0.78;
    vec3 doneColor = mix(ivory, vec3(1.0, 0.9, 0.7), 0.35);
    vec3 litColor = mix(doneColor, gold, uAct);
    vec3 col = mix(up, litColor, lit);
    float a = ink * (0.82 + 0.18 * lit);
    float glowAmt = halo * lit * uAct * uGlow;
    float shade = halo * 0.5;
    float alpha = a + (shade + glowAmt * 0.35) * (1.0 - a);
    vec3 premult = col * a + gold * glowAmt * 0.5 * (1.0 - a);
    vec3 rgb = premult / max(alpha, 0.0001);
    gl_FragColor = vec4(rgb, clamp(alpha, 0.0, 1.0) * uFade);
    #include <colorspace_fragment>
}
`;
const PANEL_FRAG = /* glsl */ `
varying vec2 vUv;
uniform float uFade;
uniform float uHalo;
void main() {
    vec2 p = abs(vUv - 0.5) * 2.0;
    float e = pow(max(p.x, 0.0), 3.0) + pow(max(p.y, 0.0), 2.6);
    float a = (1.0 - smoothstep(0.55, 1.0, e)) * 0.8;
    vec3 c = mix(vec3(0.02, 0.035, 0.08), vec3(0.18, 0.13, 0.06), uHalo * (1.0 - e));
    gl_FragColor = vec4(c, a * uFade);
    #include <colorspace_fragment>
}
`;

export interface AstralLyricStyle {
    fontStack: string;
    fontWeight: number;
    /** Lyric size multiplier (the user's lyrics font scale). */
    scale: number;
}

export interface AstralLyricsFrame {
    time: number;
    dt: number;
    paused: boolean;
    /** Visible world size at the lyric plane. */
    visWidth: number;
    visHeight: number;
    /** 0..2: the user's lyric illumination setting. */
    illumination: number;
    /** 0..1 smoothed vocal level, adds a halo around the line. */
    vocal: number;
    show: boolean;
}

interface WordView {
    mesh: THREE.Mesh;
    material: THREE.ShaderMaterial;
    start: number;
    end: number;
}

interface LineView {
    index: number;
    group: THREE.Group;
    words: WordView[];
    width: number;
    height: number;
    signature: string;
    direction: 'ltr' | 'rtl';
}

export interface AstralLyrics {
    group: THREE.Group;
    setLines: (lines: readonly Line[]) => void;
    setStyle: (style: AstralLyricStyle) => void;
    update: (frame: AstralLyricsFrame) => void;
    /** Build the views of the line at `time` and the next one now (preheat), without waiting for them to show. */
    preheat: (time: number, visWidth: number, visHeight: number) => void;
    dispose: () => void;
    readonly stats: { views: number; textures: number };
}

const MAX_ROWS = 3;

export const createAstralLyrics = (): AstralLyrics => {
    const group = new THREE.Group();
    group.name = 'astral-lyrics';
    const raster: AstralRasterCache = createAstralRasterCache(110);
    const planeGeo = new THREE.PlaneGeometry(1, 1);
    const panelMaterial = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, depthTest: false, vertexShader: VERT, fragmentShader: PANEL_FRAG,
        uniforms: { uFade: { value: 0 }, uHalo: { value: 0 } },
    });
    const panel = new THREE.Mesh(planeGeo, panelMaterial);
    panel.renderOrder = 90;
    panel.scale.set(0.01, 0.01, 1);
    group.add(panel);
    let lines: readonly Line[] = [];
    let style: AstralLyricStyle = { fontStack: 'serif', fontWeight: 700, scale: 1 };
    const views = new Map<number, LineView>();
    let currentIndex = -1;
    let leaving: { view: LineView; age: number } | null = null;
    let panelW = 0.01;
    let panelH = 0.01;
    let panelFade = 0;
    let currentSignature = '';
    let disposed = false;

    const disposeView = (view: LineView) => {
        group.remove(view.group);
        view.words.forEach(w => w.material.dispose());
    };
    const clearViews = () => {
        views.forEach(disposeView);
        views.clear();
        leaving = null;
    };

    const buildView = (index: number, visWidth: number, visHeight: number): LineView | null => {
        const line = lines[index];
        if (!line) return null;
        const signature = `${style.fontStack}|${style.fontWeight}|${style.scale}|${visWidth.toFixed(2)}|${visHeight.toFixed(2)}`;
        const held = views.get(index);
        if (held && held.signature === signature) return held;
        if (held) { disposeView(held); views.delete(index); }
        const words = buildAstralWords(line);
        if (words.length === 0) return null;
        const direction = detectTextDirection(line.fullText);
        // World size of one raster pixel: the lyric height is a fraction of the visible height, shrunk when the line would need too many rows.
        const portrait = visWidth < visHeight;
        let worldEm = visHeight * (portrait ? 0.056 : 0.075) * style.scale;
        const spec = buildAstralFontSpec(style.fontStack, style.fontWeight);
        const measure = (text: string) => measureAstralText(text, spec);
        const space = measure('\u00a0') || ASTRAL_RASTER_FONT_PX * 0.28;
        let layout: AstralLayout | null = null;
        for (let attempt = 0; attempt < 5; attempt += 1) {
            const k = worldEm / ASTRAL_RASTER_FONT_PX;
            layout = layoutAstralLine({
                words, direction, maxWidth: (visWidth * 0.9) / k, spaceWidth: space, lineHeight: ASTRAL_RASTER_FONT_PX * 1.32, measure,
            });
            if (layout.rows.length <= MAX_ROWS && layout.width * k <= visWidth * 0.92) break;
            worldEm *= 0.86;
        }
        const finalLayout = layout!;
        const k = worldEm / ASTRAL_RASTER_FONT_PX;
        const viewGroup = new THREE.Group();
        const wordViews: WordView[] = [];
        finalLayout.rows.forEach((row, rowIndex) => {
            const y = ((finalLayout.rows.length - 1) / 2 - rowIndex) * finalLayout.lineHeight * k;
            const left = -row.width / 2;
            row.words.forEach(placed => {
                const r = raster.get(placed.word.text, style.fontStack, style.fontWeight);
                const material = new THREE.ShaderMaterial({
                    transparent: true, depthWrite: false, depthTest: false, vertexShader: VERT, fragmentShader: WORD_FRAG,
                    uniforms: {
                        uMap: { value: r.texture }, uProgress: { value: -1 }, uDir: { value: placed.word.dir === 'rtl' ? -1 : 1 },
                        uAct: { value: 0 }, uGlow: { value: 1 }, uFade: { value: 0 }, uPad: { value: r.padFraction },
                    },
                });
                const mesh = new THREE.Mesh(planeGeo, material);
                mesh.renderOrder = 100;
                mesh.scale.set(r.canvasWidthPx * k, r.canvasHeightPx * k, 1);
                mesh.position.set((left + placed.x + placed.width / 2) * k, y, 0);
                viewGroup.add(mesh);
                wordViews.push({ mesh, material, start: placed.word.start, end: placed.word.end });
            });
        });
        viewGroup.visible = false;
        group.add(viewGroup);
        const view: LineView = {
            index, group: viewGroup, words: wordViews, width: finalLayout.width * k + worldEm * 1.4,
            height: finalLayout.rows.length * finalLayout.lineHeight * k + worldEm * 0.9, signature, direction,
        };
        views.set(index, view);
        // Bounded: keep only the few views near the active line.
        if (views.size > 5) {
            for (const [key, v] of views) {
                if (Math.abs(key - currentIndex) > 2 && v !== leaving?.view) { disposeView(v); views.delete(key); }
                if (views.size <= 5) break;
            }
        }
        return view;
    };

    const nextRealLine = (from: number) => {
        for (let i = from + 1; i < lines.length; i += 1) if (lines[i]!.fullText.trim() && activeLineIndexAt(lines, lines[i]!.startTime) === i) return i;
        return -1;
    };

    const writeView = (view: LineView, frame: AstralLyricsFrame, fade: number, ease: number, back: number) => {
        view.group.visible = fade > 0.002 && frame.show;
        view.group.position.z = -(1 - ease) * 0.5 - back;
        view.group.position.y = back * 0.0;
        for (const w of view.words) {
            const progress = wordProgress(w, frame.time);
            const u = w.material.uniforms;
            u.uProgress!.value = progress;
            u.uAct!.value = progress >= 2 ? Math.max(0, 1 - (frame.time - w.end) / 0.8) : progress >= 0 ? 1 : 0;
            u.uGlow!.value = frame.illumination * (1 + frame.vocal * 0.45);
            u.uFade!.value = fade;
        }
    };

    return {
        group,
        stats: { get views() { return views.size; }, get textures() { return raster.size; } } as { views: number; textures: number },
        setLines: next => {
            if (next === lines) return;
            lines = next;
            clearViews();
            currentIndex = -1;
        },
        setStyle: next => {
            if (next.fontStack === style.fontStack && next.fontWeight === style.fontWeight && next.scale === style.scale) return;
            style = next;
            clearViews();
            raster.clear();
            currentIndex = -1;
        },
        preheat: (time, visWidth, visHeight) => {
            const i = activeLineIndexAt(lines, time);
            const target = i < 0 ? 0 : i;
            buildView(target, visWidth, visHeight);
            const n = nextRealLine(target);
            if (n >= 0) buildView(n, visWidth, visHeight);
        },
        update: frame => {
            if (disposed) return;
            const signature = `${frame.visWidth.toFixed(2)}|${frame.visHeight.toFixed(2)}`;
            if (signature !== currentSignature) currentSignature = signature;
            const index = lines.length ? activeLineIndexAt(lines, frame.time) : -1;
            // A line that ended and was not followed by another soon: its inscription fades instead of sitting there.
            const line = index >= 0 ? lines[index] : undefined;
            const gapAfter = line ? frame.time - line.endTime : 0;
            const hold = line ? 1 - Math.min(1, Math.max(0, (gapAfter - 1.2) / 1.0)) : 0;
            if (index !== currentIndex) {
                const previous = currentIndex >= 0 ? views.get(currentIndex) : undefined;
                // A line change keeps the old one around for a moment, receding; a seek or loop just replaces it.
                const near = previous && index > currentIndex && index - currentIndex <= 2;
                if (leaving && leaving.view !== previous) leaving.view.group.visible = false;
                leaving = near && previous ? { view: previous, age: 0 } : null;
                currentIndex = index;
                if (index >= 0) buildView(index, frame.visWidth, frame.visHeight);
                const n = index >= 0 ? nextRealLine(index) : -1;
                if (n >= 0) buildView(n, frame.visWidth, frame.visHeight);
            }
            let view = index >= 0 ? views.get(index) : undefined;
            if (index >= 0 && (!view || view.signature.split('|').slice(3).join('|') !== signature)) view = buildView(index, frame.visWidth, frame.visHeight) ?? undefined;
            views.forEach(v => { if (v !== view && v !== leaving?.view) v.group.visible = false; });
            let targetW = 0.01;
            let targetH = 0.01;
            let fade = 0;
            if (view && line) {
                const enter = easeInOut((frame.time - line.startTime) / 0.55 + 0.35);
                fade = Math.min(1, enter) * hold;
                // Lower-centre band: the block's centre sits at about 27% of the visible height below the middle.
                const yc = -frame.visHeight * 0.27;
                const lowest = -frame.visHeight * 0.455;
                const y = Math.max(yc, lowest + view.height / 2);
                view.group.position.y = y;
                writeView(view, frame, frame.show ? fade : 0, Math.min(1, enter), 0);
                view.group.position.y = y;
                targetW = view.width;
                targetH = view.height;
                if (leaving) {
                    if (!frame.paused) leaving.age += Math.max(0, Math.min(frame.dt, 0.1));
                    const l = Math.min(1, leaving.age / 0.5);
                    if (l >= 1) { leaving.view.group.visible = false; leaving = null; }
                    else {
                        const lv = leaving.view;
                        writeView(lv, frame, (1 - l) * 0.5, 1, l * 0.5);
                        lv.group.position.y = y + l * visHeightLift(frame.visHeight);
                    }
                }
            } else if (leaving) {
                leaving.view.group.visible = false;
                leaving = null;
            }
            // The glass panel eases to the size of the line and fades with it.
            const follow = 1 - Math.exp(-Math.max(0, frame.dt) / 0.18);
            panelW += (targetW - panelW) * follow;
            panelH += (targetH - panelH) * follow;
            panelFade += ((frame.show ? fade : 0) - panelFade) * (1 - Math.exp(-Math.max(0, frame.dt) / 0.12));
            panel.scale.set(Math.max(0.01, panelW), Math.max(0.01, panelH), 1);
            panel.position.set(0, view ? view.group.position.y : panel.position.y, -0.05);
            panelMaterial.uniforms.uFade!.value = panelFade;
            panelMaterial.uniforms.uHalo!.value = frame.vocal * frame.illumination * 0.5;
            panel.visible = panelFade > 0.01;
        },
        dispose: () => {
            disposed = true;
            clearViews();
            raster.clear();
            planeGeo.dispose();
            panelMaterial.dispose();
        },
    };
};

const visHeightLift = (visHeight: number) => visHeight * 0.025;
