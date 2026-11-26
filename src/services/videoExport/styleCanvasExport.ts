import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { motionValue } from 'framer-motion';
import type { AudioBands, Line, Theme, VisualizerMode } from '../../types';
import { getVisualizerRegistryEntry, hasVisualizerMode } from '../../components/visualizer/registry';
import { applyVisualizerTuning, type VisualizerTuningBundle } from '../../components/visualizer/tuningRegistry';
import { computeAudioLevelTrack } from './offlineAudioLevels';
import { openVideoEncoderSession } from './videoEncoderSession';
import { bitrateFor, type MetaphorExportJob, type MetaphorExportReport } from './metaphorOfflineExport';

// src/services/videoExport/styleCanvasExport.ts
// Video export for the other styles. The style runs as it does on screen, in a hidden host, but on a virtual clock: its
// requestAnimationFrame and performance.now are replaced so one pump of the callbacks is exactly one video frame at an exact
// song time. Every <canvas> the style made (Pixi/WebGL or Canvas2D) is then composited, in page order, over the theme
// background into one canvas that goes to the encoder.
// Styles that draw with HTML elements instead of canvases (see DOM_STYLES) are not captured and are refused.

/** Styles drawn with HTML/CSS: a canvas capture would come out empty or without the text. */
export const DOM_STYLES: readonly string[] = ['cappella', 'partita', 'tilt', 'window', 'claddagh', 'still', 'diorama'];

export type StyleExportJob = Omit<MetaphorExportJob, 'tuning' | 'seed'> & {
    mode: VisualizerMode;
    tunings: VisualizerTuningBundle | undefined;
    artist?: string | null;
};

const STATIC_BANDS: AudioBands = {
    bass: motionValue(0),
    lowMid: motionValue(0),
    mid: motionValue(0),
    vocal: motionValue(0),
    treble: motionValue(0),
};

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));

const findLineIndex = (lines: Line[], t: number) => {
    for (let i = lines.length - 1; i >= 0; i--) {
        if (t >= lines[i].startTime && t < lines[i].endTime) return i;
    }
    return -1;
};

const effectiveOpacity = (element: Element, root: Element) => {
    let opacity = 1;
    for (let node: Element | null = element; node && node !== root; node = node.parentElement) {
        const value = parseFloat(getComputedStyle(node).opacity);
        if (Number.isFinite(value)) opacity *= value;
        if (getComputedStyle(node).visibility === 'hidden' || getComputedStyle(node).display === 'none') return 0;
    }
    return opacity;
};

export const runStyleCanvasExport = async (job: StyleExportJob, onBlank?: (frame: number) => void): Promise<MetaphorExportReport> => {
    const { preset, size } = job;
    if (DOM_STYLES.includes(job.mode) || !hasVisualizerMode(job.mode)) {
        throw new Error(`The ${job.mode} style is drawn with page elements, so it cannot be exported as video yet`);
    }
    const frames = Math.max(1, Math.round(job.clipSec * preset.fps));
    const setupStart = performance.now();  // real: the clock is patched later
    job.onProgress({ frame: 0, total: frames, fps: 0, etaSec: null, phase: 'Decoding audio' });
    const levelTrack = await computeAudioLevelTrack(job.audioBytes, preset.fps, job.startSec, frames);
    job.signal.throwIfAborted();
    job.onProgress({ frame: 0, total: frames, fps: 0, etaSec: null, phase: 'Starting renderer' });

    // Virtual clock
    const realNow = performance.now.bind(performance);
    const realRaf = window.requestAnimationFrame.bind(window);
    const realCaf = window.cancelAnimationFrame.bind(window);
    const realDpr = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
    let virtualMs = 1000;
    let nextId = 1;
    let pending = new Map<number, FrameRequestCallback>();
    const pump = () => {
        const callbacks = pending;
        pending = new Map();
        callbacks.forEach(cb => { try { cb(virtualMs); } catch (error) { console.error('[export] style frame callback failed', error); } });
    };
    const pixelRatio = size.width / size.hostCssWidth;

    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = `position:fixed;left:-30000px;top:0;width:${size.hostCssWidth}px;height:${size.hostCssHeight}px;pointer-events:none;overflow:hidden;contain:strict`;
    document.body.appendChild(host);
    const out = document.createElement('canvas');
    out.width = size.width;
    out.height = size.height;
    const ctx = out.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Could not create the frame canvas');
    const background = job.theme.backgroundColor || '#09090b';

    const currentTime = motionValue(job.startSec);
    const audioPower = motionValue(0);
    let lineIndex = -1;
    // Same wrapper the app gives a style: a full-size, positioned, clipped box.
    const stage = document.createElement('div');
    stage.style.cssText = 'position:relative;width:100%;height:100%;overflow:hidden;display:flex;align-items:center;justify-content:center';
    host.appendChild(stage);
    const root = createRoot(stage);
    const entry = getVisualizerRegistryEntry(job.mode);
    const render = () => {
        const props = applyVisualizerTuning(job.mode, {
            currentTime,
            currentLineIndex: lineIndex,
            lines: job.lines,
            theme: job.theme,
            audioPower,
            audioBands: STATIC_BANDS,
            showText: true,
            songTitle: job.title,
            songArtist: job.artist ?? null,
            duration: 0,
            paused: false,
            visualizerOpacity: 1,
        }, job.tunings);
        root.render(React.createElement(Suspense, { fallback: null }, entry.render(props)));
    };

    let session: Awaited<ReturnType<typeof openVideoEncoderSession>> | null = null;
    try {
        window.requestAnimationFrame = (cb: FrameRequestCallback) => { const id = nextId++; pending.set(id, cb); return id; };
        window.cancelAnimationFrame = (id: number) => { pending.delete(id); };
        performance.now = () => virtualMs;
        Object.defineProperty(window, 'devicePixelRatio', { configurable: true, get: () => pixelRatio });

        render();
        // Let lazy styles load and mount, pumping frames while they start up.
        for (let i = 0; i < 40; i++) { await tick(); virtualMs += 16; pump(); }

        session = await openVideoEncoderSession(
            { width: size.width, height: size.height, fps: preset.fps, bitrate: bitrateFor(preset, size), family: preset.family, avcFormat: job.avcFormat },
            job.sink,
        );
        const setupMs = realNow() - setupStart;
        const dt = 1 / preset.fps;
        const loopStart = realNow();
        let firstFrameMs = 0;
        let blankStreak = 0;
        const hostRect0 = () => host.getBoundingClientRect();
        for (let frame = 0; frame < frames; frame++) {
            job.signal.throwIfAborted();
            const t = job.startSec + frame * dt;
            virtualMs = 1000 + (t - job.startSec) * 1000 + 640;
            currentTime.set(t);
            audioPower.set(levelTrack.levels[frame] ?? 0);
            const idx = findLineIndex(job.lines, t);
            if (idx !== lineIndex) { lineIndex = idx; render(); }
            // First pump lets the style advance and React flush; the second draws and is captured in the same task,
            // so a WebGL canvas without a preserved buffer is still readable.
            pump();
            await tick();
            pump();
            ctx.fillStyle = background;
            ctx.fillRect(0, 0, out.width, out.height);
            const rect = hostRect0();
            const sx = out.width / rect.width;
            const sy = out.height / rect.height;
            let drew = 0;
            host.querySelectorAll('canvas').forEach(canvas => {
                if (canvas.width < 2 || canvas.height < 2) return;
                const alpha = effectiveOpacity(canvas, host);
                if (alpha <= 0) return;
                const r = canvas.getBoundingClientRect();
                ctx.globalAlpha = alpha;
                try {
                    ctx.drawImage(canvas, (r.left - rect.left) * sx, (r.top - rect.top) * sy, r.width * sx, r.height * sy);
                    drew += 1;
                } catch { /* a tainted or lost canvas is skipped */ }
            });
            ctx.globalAlpha = 1;
            blankStreak = drew === 0 ? blankStreak + 1 : 0;
            if (blankStreak === 30) onBlank?.(frame);
            await session.encodeFrame(out, frame);
            if (frame === 0) firstFrameMs = realNow() - loopStart;
            if (frame % 4 === 3 || frame === frames - 1) {
                const elapsed = (realNow() - loopStart) / 1000;
                const fps = (frame + 1) / elapsed;
                job.onProgress({ frame: frame + 1, total: frames, fps, etaSec: fps > 0 ? (frames - frame - 1) / fps : null, phase: 'Rendering' });
                await tick();
            }
        }
        await session.finish();
        await job.sink.finish?.();
        const renderLoopMs = realNow() - loopStart;
        const bytes = session.bytesWritten;
        const seconds = frames / preset.fps;
        return {
            frames,
            codec: session.codec,
            hardware: session.hardware,
            decodeMs: levelTrack.decodeMs,
            setupMs,
            renderLoopMs,
            fpsAchieved: frames / (renderLoopMs / 1000),
            speedFactor: seconds / (renderLoopMs / 1000),
            firstFrameMs,
            bytes,
            megabitsPerSecond: (bytes * 8) / seconds / 1_000_000,
        };
    } finally {
        session?.close();
        try { root.unmount(); } catch { /* ignore */ }
        host.remove();
        window.requestAnimationFrame = realRaf;
        window.cancelAnimationFrame = realCaf;
        performance.now = realNow;
        if (realDpr) Object.defineProperty(window, 'devicePixelRatio', realDpr);
        else delete (window as unknown as Record<string, unknown>).devicePixelRatio;
    }
};
