import type { Line, Theme } from '../../types';
import type { MetaphorTuning } from '../../components/visualizer/metaphor/types';
import { computeAudioLevelTrack } from './offlineAudioLevels';
import type { ExportSize } from './exportFormats';
import { openVideoEncoderSession, type VideoChunkSink, type VideoCodecFamily } from './videoEncoderSession';

// src/services/videoExport/metaphorOfflineExport.ts
// Video export, Metaphor first: draws the style one frame at a time at an exact song time (so a slow phone only takes
// longer, it never drops frames), feeds each frame to the WebCodecs encoder and reports how fast that went.
// The style draws into its own WebGL canvas in a hidden, fixed-size host: host CSS size 1280x720 times a pixel ratio
// gives the exact video size (2560x1440 = ratio 2, 3840x2160 = ratio 3). Layout does not depend on the video size.

export type ExportPresetId = '2k60' | '4k30' | '4k60';

export type ExportPreset = {
    id: ExportPresetId;
    label: string;
    width: number;
    height: number;
    fps: number;
    bitrate: number;
    family: VideoCodecFamily;
};

export const EXPORT_PRESETS: readonly ExportPreset[] = [
    { id: '2k60', label: '2K 60 fps', width: 2560, height: 1440, fps: 60, bitrate: 30_000_000, family: 'avc' },
    { id: '4k30', label: '4K 30 fps', width: 3840, height: 2160, fps: 30, bitrate: 40_000_000, family: 'avc' },
    { id: '4k60', label: '4K 60 fps (HEVC)', width: 3840, height: 2160, fps: 60, bitrate: 50_000_000, family: 'hevc' },
];

/** Bitrate for a size: the preset's bitrate is for its own 16:9 size, other shapes scale with their pixel count. */
export const bitrateFor = (preset: ExportPreset, size: ExportSize) =>
    Math.round(preset.bitrate * (size.width * size.height) / (preset.width * preset.height));

export type MetaphorExportJob = {
    lines: Line[];
    theme: Theme;
    tuning: MetaphorTuning;
    seed: string;
    title: string;
    /** The song file as bytes (decoded once for the audio levels). */
    audioBytes: Uint8Array;
    preset: ExportPreset;
    size: ExportSize;
    startSec: number;
    /** Seconds to render from startSec. */
    clipSec: number;
    sink: VideoChunkSink;
    /** Desktop MP4 writer: ask the encoder for length-prefixed H.264 plus a decoder config. */
    avcFormat?: 'annexb' | 'avc';
    signal: AbortSignal;
    onProgress: (info: { frame: number; total: number; fps: number; etaSec: number | null; phase: string }) => void;
};

export type MetaphorExportReport = {
    frames: number;
    codec: string;
    hardware: boolean;
    decodeMs: number;
    setupMs: number;
    renderLoopMs: number;
    fpsAchieved: number;
    /** Render speed relative to the video's own length (1 = real time). */
    speedFactor: number;
    firstFrameMs: number;
    bytes: number;
    megabitsPerSecond: number;
};

const yieldToUi = () => new Promise<void>(resolve => setTimeout(resolve, 0));

export const runMetaphorExport = async (job: MetaphorExportJob): Promise<MetaphorExportReport> => {
    const { preset } = job;
    const frames = Math.max(1, Math.round(job.clipSec * preset.fps));
    const setupStart = performance.now();
    job.onProgress({ frame: 0, total: frames, fps: 0, etaSec: null, phase: 'Decoding audio' });
    const levelTrack = await computeAudioLevelTrack(job.audioBytes, preset.fps, job.startSec, frames);
    job.signal.throwIfAborted();

    job.onProgress({ frame: 0, total: frames, fps: 0, etaSec: null, phase: 'Starting renderer' });
    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = `position:fixed;left:-20000px;top:0;width:${job.size.hostCssWidth}px;height:${job.size.hostCssHeight}px;pointer-events:none;overflow:hidden`;
    document.body.appendChild(host);

    const { motionValue } = await import('framer-motion');
    const { MetaphorRuntime } = await import('../../components/visualizer/metaphor/createMetaphorRuntime');
    let runtime: Awaited<ReturnType<typeof MetaphorRuntime.create>> | null = null;
    let session: Awaited<ReturnType<typeof openVideoEncoderSession>> | null = null;
    let contextLost = false;
    try {
        runtime = await MetaphorRuntime.create({
            host,
            song: { seed: job.seed, lines: job.lines, title: job.title },
            theme: job.theme,
            tuning: job.tuning,
            renderScale: 1,
            currentTime: motionValue(job.startSec),
            audioPower: motionValue(0),
            paused: false,
            staticMode: false,
            showText: true,
            seeThrough: false,
            onContextLost: () => { contextLost = true; },
            signal: job.signal,
            fixedPixelSize: { width: job.size.width, height: job.size.height },
        });
        runtime.setTheme(job.theme);
        runtime.setTuning(job.tuning);

        session = await openVideoEncoderSession(
            { width: job.size.width, height: job.size.height, fps: preset.fps, bitrate: bitrateFor(preset, job.size), family: preset.family, avcFormat: job.avcFormat },
            job.sink,
        );
        const setupMs = performance.now() - setupStart;

        const dt = 1 / preset.fps;
        const loopStart = performance.now();
        let firstFrameMs = 0;
        for (let frame = 0; frame < frames; frame++) {
            job.signal.throwIfAborted();
            if (contextLost) throw new Error('The graphics context was lost (the phone ran out of graphics memory or the app was sent to the background)');
            const canvas = runtime.renderExportFrame(job.startSec + frame * dt, levelTrack.levels[frame], dt);
            await session.encodeFrame(canvas, frame);
            if (frame === 0) firstFrameMs = performance.now() - loopStart;
            if (frame % 4 === 3 || frame === frames - 1) {
                const elapsed = (performance.now() - loopStart) / 1000;
                const fps = (frame + 1) / elapsed;
                job.onProgress({
                    frame: frame + 1,
                    total: frames,
                    fps,
                    etaSec: fps > 0 ? (frames - frame - 1) / fps : null,
                    phase: 'Rendering',
                });
                await yieldToUi();
            }
        }
        await session.finish();
        await job.sink.finish?.();
        const renderLoopMs = performance.now() - loopStart;
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
        runtime?.destroy();
        host.remove();
    }
};

export const formatMetaphorExportReport = (preset: ExportPreset, size: ExportSize, report: MetaphorExportReport, styleLabel = 'Metaphor'): string => [
    `${styleLabel} export, ${preset.label} (${size.width}x${size.height})`,
    `Frames rendered: ${report.frames} (${(report.frames / preset.fps).toFixed(1)} s of video)`,
    `Encoder: ${report.codec}, ${report.hardware ? 'hardware' : 'software or unknown'}`,
    `Speed: ${report.fpsAchieved.toFixed(1)} frames/s, ${report.speedFactor.toFixed(2)}x real time`,
    `A 4 minute song would take about ${Math.round(240 / Math.max(report.speedFactor, 0.001) / 60)} minutes`,
    `First frame: ${Math.round(report.firstFrameMs)} ms, setup: ${Math.round(report.setupMs)} ms, audio decode: ${Math.round(report.decodeMs)} ms`,
    `Output size: ${(report.bytes / 1_000_000).toFixed(1)} MB (${report.megabitsPerSecond.toFixed(1)} Mbps)`,
].join('\n');
