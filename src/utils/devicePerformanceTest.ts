import type { LyricAntialias, LyricRenderScale, VisualizerFrameRate } from '../types';

// src/utils/devicePerformanceTest.ts
// A short on-device self-test for lyric rendering. It measures the display refresh rate, then draws a lyric-like canvas
// workload (glowing Latin + Arabic text over a gradient) at several resolution scales and keeps the highest scale that
// still holds a smooth frame rate. The result is a recommendation; applying it is the user's choice.

export type PerformanceTestStep = { scale: LyricRenderScale; fps: number; passed: boolean };

export type PerformanceTestResult = {
    refreshHz: number;
    steps: PerformanceTestStep[];
    scale: LyricRenderScale;
    antialias: LyricAntialias;
    frameRate: VisualizerFrameRate;
    summary: string;
};

const nextFrame = () => new Promise<number>(resolve => requestAnimationFrame(resolve));

/** Average display refresh rate over about 0.6 s of empty frames, snapped to a common rate. */
const measureRefreshHz = async (): Promise<number> => {
    let last = await nextFrame();
    const deltas: number[] = [];
    const end = last + 600;
    while (last < end) {
        const t = await nextFrame();
        deltas.push(t - last);
        last = t;
    }
    if (deltas.length === 0) return 60;
    deltas.sort((a, b) => a - b);
    const median = deltas[Math.floor(deltas.length / 2)] || 16.7;
    const hz = 1000 / median;
    const common = [30, 60, 90, 120, 144];
    return common.reduce((best, candidate) => Math.abs(candidate - hz) < Math.abs(best - hz) ? candidate : best, 60);
};

const WORKLOAD_LINES = [
    'Folia lyric render quality test',
    'اختبار جودة عرض الكلمات على الشاشة',
    'The quick brown fox jumps over the lazy dog',
    'كلمات الأغنية تظهر هنا بتأثير التوهج',
];

const runScale = async (scale: LyricRenderScale, refreshHz: number, durationMs: number): Promise<number> => {
    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 3);
    const ratio = Math.max(0.25, dpr * scale);
    const cssWidth = Math.max(280, Math.min(typeof window !== 'undefined' ? window.innerWidth : 400, 720));
    const cssHeight = Math.max(480, Math.min(typeof window !== 'undefined' ? window.innerHeight : 800, 1280));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(cssWidth * ratio);
    canvas.height = Math.round(cssHeight * ratio);
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;

    let frames = 0;
    const startedAt = await nextFrame();
    let t = startedAt;
    while (t - startedAt < durationMs) {
        const phase = (t - startedAt) / 1000;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, `hsl(${(phase * 40) % 360}, 60%, 18%)`);
        gradient.addColorStop(1, `hsl(${(phase * 40 + 120) % 360}, 60%, 10%)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(255, 200, 220, 0.9)';
        ctx.shadowBlur = 18;
        for (let i = 0; i < 14; i++) {
            const line = WORKLOAD_LINES[i % WORKLOAD_LINES.length]!;
            ctx.font = `${22 + (i % 3) * 6}px sans-serif`;
            ctx.fillText(line, cssWidth / 2 + Math.sin(phase + i) * 8, 40 + i * (cssHeight - 80) / 14);
        }
        frames += 1;
        t = await nextFrame();
    }
    const seconds = (t - startedAt) / 1000;
    return seconds > 0 ? frames / seconds : 0;
};

/** Runs the test (about 4 to 7 seconds). `onProgress` receives a short status line. */
export const runDevicePerformanceTest = async (
    onProgress?: (text: string) => void,
): Promise<PerformanceTestResult> => {
    onProgress?.('Measuring screen refresh rate...');
    const refreshHz = await measureRefreshHz();
    const target = Math.min(refreshHz, 60) * 0.9;
    const candidates: LyricRenderScale[] = [1.5, 1, 0.75, 0.5];
    const steps: PerformanceTestStep[] = [];
    let chosen: LyricRenderScale = 0.5;
    for (const scale of candidates) {
        onProgress?.(`Testing ${scale}x resolution...`);
        const fps = await runScale(scale, refreshHz, 1200);
        const passed = fps >= target;
        steps.push({ scale, fps: Math.round(fps), passed });
        if (passed) {
            chosen = scale;
            break;
        }
    }
    const best = steps.find(step => step.scale === chosen);
    const strong = chosen >= 1 && (best?.fps ?? 0) >= refreshHz * 0.9;
    const antialias: LyricAntialias = chosen >= 1 ? 'auto' : 'off';
    const frameRate: VisualizerFrameRate = strong && refreshHz <= 60 ? 'off' : 60;
    const summary = `Screen ${refreshHz} Hz. Smooth at ${chosen}x resolution (${best?.fps ?? 0} fps in the test). `
        + `Suggested: resolution ${chosen}x, antialiasing ${antialias === 'auto' ? 'automatic' : 'off'}, frame cap ${frameRate === 'off' ? 'none' : `${frameRate} fps`}.`;
    return { refreshHz, steps, scale: chosen, antialias, frameRate, summary };
};
