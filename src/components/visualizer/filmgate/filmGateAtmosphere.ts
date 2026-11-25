import { clamp01 } from './filmGateMotion';
import type { FilmGateAudioFrame } from './filmGateAudio';
import type { FilmgateTuning } from './types';

// src/components/visualizer/filmgate/filmGateAtmosphere.ts
// The film environment, drawn with plain Canvas2D from a few reused resources: a warm projector beam, edge light
// leaks, rare exposure sweeps, bass ripples, fine grain from pre-made noise tiles, bounded floating dust, rare scratches,
// and the film-frame marks. Everything is a function of the clock and the smoothed audio, with a fixed seed, so it
// looks the same on every run and in an exported video. Nothing is allocated per frame.

const TAU = Math.PI * 2;
const GRAIN_TILE = 96;
const GRAIN_TILES = 4;
const MAX_DUST = 36;
const MAX_RIPPLES = 3;

// A small deterministic generator: the same song always gets the same dust.
const seeded = (seed: number) => {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

export interface FilmAtmosphereQuality {
    /** 0..1: scales dust count and grain redraw rate. */
    detail: number;
}

interface Dust {
    x: number; y: number; size: number; speed: number; sway: number; phase: number; glint: number;
}

export interface FilmAtmosphere {
    /** Everything behind the lyrics: grade, beam, leaks, ripples, dust, grain, scratches. */
    drawBack: (ctx: CanvasRenderingContext2D, w: number, h: number, clock: number, audio: FilmGateAudioFrame, tuning: FilmgateTuning, motion: number, shotLeak: number) => void;
    /** Everything in front: frame marks and vignette. */
    drawFront: (ctx: CanvasRenderingContext2D, w: number, h: number, clock: number, audio: FilmGateAudioFrame, tuning: FilmgateTuning, motion: number) => void;
    dispose: () => void;
}

const makeGrainTiles = (): HTMLCanvasElement[] => {
    const rand = seeded(20260511);
    const tiles: HTMLCanvasElement[] = [];
    for (let k = 0; k < GRAIN_TILES; k += 1) {
        const canvas = document.createElement('canvas');
        canvas.width = GRAIN_TILE;
        canvas.height = GRAIN_TILE;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            const image = ctx.createImageData(GRAIN_TILE, GRAIN_TILE);
            for (let i = 0; i < image.data.length; i += 4) {
                const v = rand() < 0.5 ? 255 : 0;
                image.data[i] = v; image.data[i + 1] = v; image.data[i + 2] = v;
                image.data[i + 3] = Math.floor(rand() * 255);
            }
            ctx.putImageData(image, 0, 0);
        }
        tiles.push(canvas);
    }
    return tiles;
};

export const createFilmAtmosphere = (seedNumber: number, quality: FilmAtmosphereQuality): FilmAtmosphere => {
    const rand = seeded(seedNumber || 1);
    const dustCount = Math.max(8, Math.round(MAX_DUST * clamp01(quality.detail)));
    const dust: Dust[] = Array.from({ length: dustCount }, () => ({
        x: rand(), y: rand(), size: 0.6 + rand() * 1.6, speed: 0.004 + rand() * 0.012, sway: 0.01 + rand() * 0.03, phase: rand() * TAU, glint: rand(),
    }));
    const tiles = makeGrainTiles();
    const patterns = new WeakMap<CanvasRenderingContext2D, CanvasPattern[]>();
    const ripples = new Float64Array(MAX_RIPPLES).fill(-100);
    let rippleCursor = 0;
    let kickWasHigh = false;

    const patternsFor = (ctx: CanvasRenderingContext2D) => {
        let list = patterns.get(ctx);
        if (!list) {
            list = tiles.map(tile => ctx.createPattern(tile, 'repeat')).filter((p): p is CanvasPattern => p !== null);
            patterns.set(ctx, list);
        }
        return list;
    };

    const drawBack: FilmAtmosphere['drawBack'] = (ctx, w, h, clock, audio, tuning, motion, shotLeak) => {
        const minSide = Math.min(w, h);
        // Natural exposure fluctuation: slow, small.
        const flicker = 1 + 0.03 * Math.sin(clock * 7.3) * Math.sin(clock * 1.9 + 0.6);
        const energy = 0.35 + 0.65 * audio.power;
        // Deep cinematic black, a little transparent so the song's own background still breathes through.
        ctx.fillStyle = 'rgba(7,6,5,0.86)';
        ctx.fillRect(0, 0, w, h);

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        // Projector beam: a warm cone from above the frame, wider and brighter with the music.
        const bx = w * 0.5 + Math.sin(clock * 0.21) * w * 0.02 * motion;
        const by = -h * 0.18;
        const beam = ctx.createRadialGradient(bx, by, minSide * 0.05, bx, h * 0.5, Math.max(w, h) * 0.78);
        const beamAlpha = (0.085 + 0.07 * energy + 0.05 * audio.lowMid) * flicker;
        beam.addColorStop(0, `rgba(255,190,110,${(beamAlpha * 1.5).toFixed(3)})`);
        beam.addColorStop(0.45, `rgba(214,142,70,${(beamAlpha * 0.55).toFixed(3)})`);
        beam.addColorStop(1, 'rgba(120,70,30,0)');
        ctx.fillStyle = beam;
        ctx.fillRect(0, 0, w, h);

        // Light leaks from the frame edges.
        const leakAmount = tuning.lightLeaks;
        if (leakAmount > 0.001) {
            const base = 0.07 * leakAmount * (0.55 + 0.45 * audio.lowMid + 0.3 * audio.power) + 0.16 * shotLeak * leakAmount;
            const lx = (Math.sin(clock * 0.13) * 0.5 + 0.5) * 0.35;
            const left = ctx.createRadialGradient(w * lx, h * 0.62, 0, w * lx, h * 0.62, minSide * 0.8);
            left.addColorStop(0, `rgba(255,120,48,${(base * 0.9).toFixed(3)})`);
            left.addColorStop(1, 'rgba(120,30,10,0)');
            ctx.fillStyle = left;
            ctx.fillRect(0, 0, w, h);
            const rx = 1 - (Math.sin(clock * 0.11 + 2.1) * 0.5 + 0.5) * 0.3;
            const right = ctx.createRadialGradient(w * rx, h * 0.28, 0, w * rx, h * 0.28, minSide * 0.7);
            right.addColorStop(0, `rgba(190,70,40,${(base * 0.7).toFixed(3)})`);
            right.addColorStop(1, 'rgba(90,20,10,0)');
            ctx.fillStyle = right;
            ctx.fillRect(0, 0, w, h);

            // A rare exposure sweep: a soft diagonal band every ~23 s, about 2 s long.
            const cycle = clock % 23;
            if (cycle < 2.2) {
                const p = cycle / 2.2;
                const fade = Math.sin(p * Math.PI);
                const x = -w * 0.3 + p * w * 1.6;
                const band = ctx.createLinearGradient(x - w * 0.18, 0, x + w * 0.18, h * 0.35);
                band.addColorStop(0, 'rgba(255,230,190,0)');
                band.addColorStop(0.5, `rgba(255,226,180,${(0.09 * fade * leakAmount).toFixed(3)})`);
                band.addColorStop(1, 'rgba(255,230,190,0)');
                ctx.fillStyle = band;
                ctx.fillRect(0, 0, w, h);
            }
        }

        // Bass ripple: a ring of exposure travelling out from the beam origin on each strong kick.
        const kickHigh = audio.kick > 0.5;
        if (kickHigh && !kickWasHigh && tuning.impact > 0.001) {
            ripples[rippleCursor] = clock;
            rippleCursor = (rippleCursor + 1) % MAX_RIPPLES;
        }
        kickWasHigh = kickHigh;
        if (tuning.impact > 0.001) {
            for (let i = 0; i < MAX_RIPPLES; i += 1) {
                const age = clock - ripples[i]!;
                if (age < 0 || age > 1.1) continue;
                const radius = minSide * (0.12 + age * 0.85);
                const alpha = (1 - age / 1.1) ** 2 * 0.09 * tuning.impact;
                const ring = ctx.createRadialGradient(bx, h * 0.42, radius * 0.86, bx, h * 0.42, radius);
                ring.addColorStop(0, 'rgba(255,200,130,0)');
                ring.addColorStop(1, `rgba(255,205,140,${alpha.toFixed(3)})`);
                ctx.fillStyle = ring;
                ctx.fillRect(0, 0, w, h);
            }
        }

        // Dust: drifts upward in the beam; the treble makes some of it catch the light.
        for (let i = 0; i < dust.length; i += 1) {
            const d = dust[i]!;
            const y = ((d.y - clock * d.speed * (0.4 + 0.6 * motion)) % 1 + 1) % 1;
            const x = d.x + Math.sin(clock * 0.4 + d.phase) * d.sway * motion;
            const inBeam = 1 - Math.min(1, Math.abs(x - 0.5) * 1.7);
            const glint = d.glint > 0.7 ? audio.treble * 0.9 : 0;
            const alpha = (0.1 + 0.28 * inBeam + glint) * (0.55 + 0.45 * Math.sin(clock * 0.8 + d.phase) ** 2);
            if (alpha < 0.02) continue;
            ctx.fillStyle = `rgba(255,222,170,${Math.min(0.75, alpha).toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(x * w, y * h, d.size * (minSide / 700) * (1 + glint), 0, TAU);
            ctx.fill();
        }
        ctx.restore();

        // Grain: pre-made noise tiles, offset every few frames; never drawn over the lyrics (they come after).
        if (tuning.grain > 0.001) {
            const list = patternsFor(ctx);
            if (list.length > 0) {
                const step = Math.floor(clock * (motion > 0 ? 18 : 0));
                const pattern = list[step % list.length]!;
                const ox = ((step * 37) % GRAIN_TILE);
                const oy = ((step * 53) % GRAIN_TILE);
                ctx.save();
                ctx.globalAlpha = 0.05 * tuning.grain;
                ctx.translate(-ox, -oy);
                ctx.fillStyle = pattern;
                ctx.fillRect(0, 0, w + GRAIN_TILE, h + GRAIN_TILE);
                ctx.restore();
            }
        }

        // Rare tiny scratches: one thin vertical hairline for a moment every few seconds.
        if (motion > 0 && tuning.grain > 0.001) {
            const slot = Math.floor(clock / 3.7);
            const local = clock - slot * 3.7;
            if (local < 0.11 && (slot * 2654435761 >>> 0) % 5 < 2) {
                const x = ((((slot * 40503) >>> 0) % 1000) / 1000) * w;
                ctx.fillStyle = 'rgba(255,238,210,0.12)';
                ctx.fillRect(x, h * 0.08, Math.max(1, minSide / 900), h * 0.84);
            }
        }
    };

    const drawFront: FilmAtmosphere['drawFront'] = (ctx, w, h, clock, audio, tuning, motion) => {
        const minSide = Math.min(w, h);
        if (tuning.frame) {
            const inset = Math.round(minSide * 0.045);
            const arm = Math.round(minSide * 0.045);
            ctx.save();
            ctx.strokeStyle = 'rgba(214,170,110,0.34)';
            ctx.lineWidth = Math.max(1, minSide / 700);
            // Corner marks.
            ctx.beginPath();
            const corners: Array<[number, number, number, number]> = [[inset, inset, 1, 1], [w - inset, inset, -1, 1], [inset, h - inset, 1, -1], [w - inset, h - inset, -1, -1]];
            for (const [x, y, sx, sy] of corners) {
                ctx.moveTo(x + sx * arm, y);
                ctx.lineTo(x, y);
                ctx.lineTo(x, y + sy * arm);
            }
            ctx.stroke();
            // Thin frame guides along the middle of each side.
            ctx.strokeStyle = 'rgba(214,170,110,0.16)';
            ctx.beginPath();
            ctx.moveTo(w / 2 - arm * 0.5, inset); ctx.lineTo(w / 2 + arm * 0.5, inset);
            ctx.moveTo(w / 2 - arm * 0.5, h - inset); ctx.lineTo(w / 2 + arm * 0.5, h - inset);
            ctx.moveTo(inset, h / 2 - arm * 0.5); ctx.lineTo(inset, h / 2 + arm * 0.5);
            ctx.moveTo(w - inset, h / 2 - arm * 0.5); ctx.lineTo(w - inset, h / 2 + arm * 0.5);
            ctx.stroke();
            // Sprocket holes along the outer edges: a slow frame-advance crawl, kept to a thin margin.
            if (w >= 360) {
                const hole = Math.max(3, minSide * 0.011);
                const pitch = hole * 3.4;
                const crawl = (clock * hole * 0.9 * motion + Math.floor(audio.kick * 2) * 0) % pitch;
                ctx.fillStyle = 'rgba(214,170,110,0.13)';
                for (let y = -pitch + crawl; y < h; y += pitch) {
                    ctx.fillRect(inset * 0.35, y, hole, hole * 1.4);
                    ctx.fillRect(w - inset * 0.35 - hole, y, hole, hole * 1.4);
                }
            }
            ctx.restore();
        }
        // Vignette.
        const vignette = ctx.createRadialGradient(w / 2, h / 2, minSide * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
        vignette.addColorStop(0, 'rgba(0,0,0,0)');
        vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
        ctx.fillStyle = vignette;
        // Larger than the stage: the gate transform may shift it a little and no edge sliver may show.
        ctx.fillRect(-w * 0.05, -h * 0.05, w * 1.1, h * 1.1);
    };

    return { drawBack, drawFront, dispose: () => { ripples.fill(-100); } };
};
