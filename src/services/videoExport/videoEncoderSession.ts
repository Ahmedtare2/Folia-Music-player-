// src/services/videoExport/videoEncoderSession.ts
// Video export: wraps the WebView's WebCodecs VideoEncoder (hardware first, then any H.264). Frames go in as VideoFrames
// taken straight from the draw canvas (no pixel copy); encoded chunks go out to a sink (a counter for the speed test,
// the native MP4 writer once that exists).

export type VideoChunk = {
    data: Uint8Array;
    timestampUs: number;
    durationUs: number;
    keyFrame: boolean;
    /** Only on the first chunk, and only when the encoder reports it (the desktop MP4 writer needs it). */
    decoderConfig?: { codec: string; description?: Uint8Array; codedWidth?: number; codedHeight?: number };
};

export type VideoChunkSink = {
    configure?: (info: { codec: string; width: number; height: number; fps: number }) => void | Promise<void>;
    write: (chunk: VideoChunk) => void | Promise<void>;
    /** Called once after the last chunk was written. */
    finish?: () => void | Promise<void>;
};

export type VideoCodecFamily = 'avc' | 'hevc';

export type VideoEncoderSettings = {
    width: number;
    height: number;
    fps: number;
    bitrate: number;
    family: VideoCodecFamily;
    /** 'avc' makes the encoder output length-prefixed H.264 with a decoder config (for MP4 muxers). Default is Annex B. */
    avcFormat?: 'annexb' | 'avc';
};

type EncoderLike = {
    configure: (config: Record<string, unknown>) => void;
    encode: (frame: unknown, options?: { keyFrame?: boolean }) => void;
    flush: () => Promise<void>;
    close: () => void;
    encodeQueueSize: number;
    state: string;
};

type EncoderCtor = {
    new (init: {
        output: (
            chunk: { byteLength: number; timestamp: number; duration: number | null; type: string; copyTo: (target: Uint8Array) => void },
            metadata?: { decoderConfig?: { codec: string; description?: ArrayBuffer | ArrayBufferView; codedWidth?: number; codedHeight?: number } },
        ) => void;
        error: (error: Error) => void;
    }): EncoderLike;
    isConfigSupported: (config: Record<string, unknown>) => Promise<{ supported?: boolean }>;
};

type VideoFrameCtor = new (source: CanvasImageSource, init: { timestamp: number; duration?: number }) => { close: () => void };

const getEncoderCtor = (): EncoderCtor | null => {
    const ctor = (globalThis as unknown as { VideoEncoder?: EncoderCtor }).VideoEncoder;
    return typeof ctor === 'function' ? ctor : null;
};

const getVideoFrameCtor = (): VideoFrameCtor | null => {
    const ctor = (globalThis as unknown as { VideoFrame?: VideoFrameCtor }).VideoFrame;
    return typeof ctor === 'function' ? ctor : null;
};

/** H.264 High profile; level 5.1 covers 4K30 and 1440p60, 5.2 is needed for 4K60. */
const avcCodecFor = (width: number, height: number, fps: number) => {
    const macroblocksPerSecond = Math.ceil(width / 16) * Math.ceil(height / 16) * fps;
    return macroblocksPerSecond > 983_040 ? 'avc1.640034' : 'avc1.640033';
};

export type VideoEncoderSession = {
    readonly codec: string;
    readonly family: VideoCodecFamily;
    readonly hardware: boolean;
    encodeFrame: (canvas: CanvasImageSource, frameIndex: number) => Promise<void>;
    finish: () => Promise<void>;
    close: () => void;
    readonly bytesWritten: number;
};

export const isVideoEncoderAvailable = () => Boolean(getEncoderCtor() && getVideoFrameCtor());

/** Opens an encoder for the settings, or throws a readable error if this WebView cannot do it. */
export const openVideoEncoderSession = async (
    settings: VideoEncoderSettings,
    sink: VideoChunkSink,
): Promise<VideoEncoderSession> => {
    const Encoder = getEncoderCtor();
    const Frame = getVideoFrameCtor();
    if (!Encoder || !Frame) throw new Error('This WebView has no WebCodecs video encoder');

    // HEVC level 5.1 (L153) covers 4K60. The codec string spelling that the encoder accepts is probed live.
    const codecs = settings.family === 'hevc'
        ? ['hev1.1.6.L153.B0', 'hvc1.1.6.L153.B0']
        : [avcCodecFor(settings.width, settings.height, settings.fps)];
    let codec = codecs[0];
    let chosen: Record<string, unknown> | null = null;
    let hardware = false;
    search:
    for (const candidate of codecs) {
        for (const preference of ['prefer-hardware', 'no-preference']) {
            const config: Record<string, unknown> = {
                codec: candidate,
                width: settings.width,
                height: settings.height,
                framerate: settings.fps,
                bitrate: settings.bitrate,
                latencyMode: 'quality',
                ...(settings.family === 'hevc' ? { hevc: { format: 'annexb' } } : { avc: { format: settings.avcFormat ?? 'annexb' } }),
                hardwareAcceleration: preference,
            };
            try {
                const result = await Encoder.isConfigSupported(config);
                if (result.supported) {
                    codec = candidate;
                    chosen = config;
                    hardware = preference === 'prefer-hardware';
                    break search;
                }
            } catch {
                // try the next one
            }
        }
    }
    if (!chosen) {
        throw new Error(`This phone's WebView cannot encode ${settings.family === 'hevc' ? 'HEVC' : 'H.264'} ${settings.width}x${settings.height} at ${settings.fps} fps`);
    }

    let failure: Error | null = null;
    let pending: Promise<void> = Promise.resolve();
    let queuedWrites = 0;
    let bytesWritten = 0;
    const encoder = new Encoder({
        output: (chunk, metadata) => {
            const data = new Uint8Array(chunk.byteLength);
            chunk.copyTo(data);
            bytesWritten += data.byteLength;
            const entry: VideoChunk = {
                data,
                timestampUs: chunk.timestamp,
                durationUs: chunk.duration ?? Math.round(1_000_000 / settings.fps),
                keyFrame: chunk.type === 'key',
            };
            const config = metadata?.decoderConfig;
            if (config) {
                const description = config.description
                    ? (ArrayBuffer.isView(config.description)
                        ? new Uint8Array(config.description.buffer.slice(config.description.byteOffset, config.description.byteOffset + config.description.byteLength))
                        : new Uint8Array(config.description.slice(0)))
                    : undefined;
                entry.decoderConfig = { codec: config.codec, description, codedWidth: config.codedWidth, codedHeight: config.codedHeight };
            }
            queuedWrites += 1;
            pending = pending
                .then(() => sink.write(entry))
                .catch(error => { failure = error instanceof Error ? error : new Error(String(error)); })
                .finally(() => { queuedWrites -= 1; });
        },
        error: error => { failure = error; },
    });
    encoder.configure(chosen);
    await sink.configure?.({ codec, width: settings.width, height: settings.height, fps: settings.fps });

    const keyEvery = Math.max(1, Math.round(settings.fps * 2));
    const frameDurationUs = Math.round(1_000_000 / settings.fps);
    return {
        codec,
        family: settings.family,
        hardware,
        get bytesWritten() { return bytesWritten; },
        encodeFrame: async (canvas, frameIndex) => {
            if (failure) throw failure;
            // Backpressure: do not let the encoder queue grow (4K frames are big).
            while (encoder.encodeQueueSize > 6 || queuedWrites > 180) {
                await new Promise(resolve => setTimeout(resolve, 2));
                if (failure) throw failure;
            }
            const frame = new Frame(canvas, {
                timestamp: Math.round((frameIndex * 1_000_000) / settings.fps),
                duration: frameDurationUs,
            });
            try {
                encoder.encode(frame, { keyFrame: frameIndex % keyEvery === 0 });
            } finally {
                frame.close();
            }
        },
        finish: async () => {
            await encoder.flush();
            await pending;
            if (failure) throw failure;
        },
        close: () => {
            try { if (encoder.state !== 'closed') encoder.close(); } catch { /* already closed */ }
        },
    };
};
