import { Muxer, StreamTarget } from 'mp4-muxer';
import type { VideoChunk, VideoChunkSink } from './videoEncoderSession';

// src/services/videoExport/desktopMp4Sink.ts
// Video export on the desktop app: writes the encoder's H.264 chunks, plus the song's sound, into an MP4 file on disk.
// The MP4 is built in the renderer (mp4-muxer, fragmented so nothing has to stay in memory) and streamed to the file
// writer of the main process, the same one the live recording uses. Sound: the song is decoded, cut to the section and
// encoded with the WebCodecs AAC encoder (or Opus if AAC is missing); if neither exists the video is saved without sound.

export type DesktopMp4Result = { filePath: string; bytes: number; displayName: string };

export type DesktopMp4Sink = VideoChunkSink & {
    readonly audioNote: string | null;
    readonly result: DesktopMp4Result | null;
    abort: () => Promise<void>;
};

type AudioEncoderLike = {
    configure: (config: Record<string, unknown>) => void;
    encode: (data: unknown) => void;
    flush: () => Promise<void>;
    close: () => void;
    encodeQueueSize: number;
    state: string;
};
type AudioEncoderCtor = {
    new (init: {
        output: (
            chunk: { byteLength: number; timestamp: number; duration: number | null; type: string; copyTo: (target: Uint8Array) => void },
            metadata?: Record<string, unknown>,
        ) => void;
        error: (error: Error) => void;
    }): AudioEncoderLike;
    isConfigSupported: (config: Record<string, unknown>) => Promise<{ supported?: boolean }>;
};
type AudioDataCtor = new (init: {
    format: string; sampleRate: number; numberOfFrames: number; numberOfChannels: number; timestamp: number; data: BufferSource;
}) => { close: () => void };

const AUDIO_RATE = 48_000;

const withDescription = (chunk: VideoChunk): EncodedVideoChunkMetadata | undefined => chunk.decoderConfig
    ? { decoderConfig: { codec: chunk.decoderConfig.codec, description: chunk.decoderConfig.description, codedWidth: chunk.decoderConfig.codedWidth, codedHeight: chunk.decoderConfig.codedHeight } } as EncodedVideoChunkMetadata
    : undefined;

export const isDesktopMp4ExportAvailable = () => Boolean(
    typeof window !== 'undefined'
    && typeof window.electron?.chooseVideoExportPath === 'function'
    && typeof window.electron?.openVideoExportFile === 'function'
    && typeof window.electron?.appendVideoExportChunk === 'function'
    && typeof window.electron?.finishVideoExportFile === 'function',
);

/** Cuts [startSec, startSec + durationSec) out of the song and encodes it. Returns the encoded chunks or a reason it could not. */
const encodeSongSection = async (
    audioBytes: Uint8Array,
    startSec: number,
    durationSec: number,
    signal: AbortSignal,
): Promise<{ codec: 'aac' | 'opus'; channels: number; chunks: Array<{ data: Uint8Array; type: 'key' | 'delta'; timestampUs: number; durationUs: number; meta?: Record<string, unknown> }> } | { error: string }> => {
    const Encoder = (globalThis as unknown as { AudioEncoder?: AudioEncoderCtor }).AudioEncoder;
    const AudioDataClass = (globalThis as unknown as { AudioData?: AudioDataCtor }).AudioData;
    if (!Encoder || !AudioDataClass) return { error: 'this app has no audio encoder' };

    let decoded: AudioBuffer;
    try {
        const context = new OfflineAudioContext(2, AUDIO_RATE, AUDIO_RATE);
        const copy = audioBytes.buffer.slice(audioBytes.byteOffset, audioBytes.byteOffset + audioBytes.byteLength) as ArrayBuffer;
        decoded = await context.decodeAudioData(copy);
    } catch (error) {
        return { error: `the song could not be decoded (${error instanceof Error ? error.message : String(error)})` };
    }
    signal.throwIfAborted();

    const channels = Math.min(2, Math.max(1, decoded.numberOfChannels));
    const rate = decoded.sampleRate;
    const first = Math.max(0, Math.floor(startSec * rate));
    const last = Math.min(decoded.length, Math.ceil((startSec + durationSec) * rate));
    if (last <= first) return { error: 'the chosen section has no sound' };

    let codec: 'aac' | 'opus' | null = null;
    let config: Record<string, unknown> | null = null;
    for (const candidate of [
        { id: 'aac' as const, codec: 'mp4a.40.2', bitrate: 192_000 },
        { id: 'opus' as const, codec: 'opus', bitrate: 160_000 },
    ]) {
        const attempt = { codec: candidate.codec, sampleRate: rate, numberOfChannels: channels, bitrate: candidate.bitrate };
        try {
            if ((await Encoder.isConfigSupported(attempt)).supported) { codec = candidate.id; config = attempt; break; }
        } catch { /* next */ }
    }
    if (!codec || !config) return { error: 'this app cannot encode AAC or Opus sound' };

    const chunks: Array<{ data: Uint8Array; type: 'key' | 'delta'; timestampUs: number; durationUs: number; meta?: Record<string, unknown> }> = [];
    let failure: Error | null = null;
    const encoder = new Encoder({
        output: (chunk, meta) => {
            const data = new Uint8Array(chunk.byteLength);
            chunk.copyTo(data);
            const decoderConfig = meta?.decoderConfig as { codec?: string; description?: ArrayBuffer | ArrayBufferView; numberOfChannels?: number; sampleRate?: number } | undefined;
            const description = decoderConfig?.description
                ? (ArrayBuffer.isView(decoderConfig.description)
                    ? new Uint8Array(decoderConfig.description.buffer.slice(decoderConfig.description.byteOffset, decoderConfig.description.byteOffset + decoderConfig.description.byteLength))
                    : new Uint8Array(decoderConfig.description.slice(0)))
                : undefined;
            chunks.push({
                data,
                type: chunk.type === 'key' ? 'key' : 'delta',
                timestampUs: chunk.timestamp,
                durationUs: chunk.duration ?? 0,
                meta: decoderConfig ? { decoderConfig: { ...decoderConfig, description } } : undefined,
            });
        },
        error: error => { failure = error; },
    });
    encoder.configure(config);
    const block = Math.round(rate / 2);
    const sources = Array.from({ length: channels }, (_, ch) => decoded.getChannelData(ch));
    for (let at = first; at < last; at += block) {
        signal.throwIfAborted();
        if (failure) break;
        const frames = Math.min(block, last - at);
        const planar = new Float32Array(frames * channels);
        for (let ch = 0; ch < channels; ch++) planar.set(sources[ch].subarray(at, at + frames), ch * frames);
        const data = new AudioDataClass({
            format: 'f32-planar',
            sampleRate: rate,
            numberOfFrames: frames,
            numberOfChannels: channels,
            timestamp: Math.round(((at - first) / rate) * 1_000_000),
            data: planar,
        });
        try { encoder.encode(data); } finally { data.close(); }
        while (encoder.encodeQueueSize > 8) await new Promise(resolve => setTimeout(resolve, 2));
    }
    await encoder.flush();
    try { if (encoder.state !== 'closed') encoder.close(); } catch { /* done */ }
    if (failure) return { error: `audio encoding failed (${(failure as Error).message})` };
    return { codec, channels, chunks };
};

export const createDesktopMp4Sink = async (options: {
    width: number;
    height: number;
    fps: number;
    filePath: string;
    displayName: string;
    audio: { bytes: Uint8Array; startSec: number; durationSec: number } | null;
    signal: AbortSignal;
}): Promise<DesktopMp4Sink> => {
    const electron = window.electron;
    if (!electron) throw new Error('Saving video needs the desktop app');
    const sessionId = await electron.openVideoExportFile(options.filePath);

    // Audio first: it is decoded and encoded before the first frame, so the track layout is known to the muxer.
    let audioNote: string | null = null;
    let audio: Awaited<ReturnType<typeof encodeSongSection>> | null = null;
    if (options.audio) {
        try {
            audio = await encodeSongSection(options.audio.bytes, options.audio.startSec, options.audio.durationSec, options.signal);
        } catch (error) {
            if (options.signal.aborted) { await electron.abortVideoExportFile(sessionId).catch(() => undefined); throw error; }
            audio = { error: error instanceof Error ? error.message : String(error) };
        }
        if ('error' in audio) { audioNote = `No sound in the video: ${audio.error}`; audio = null; }
    } else {
        audioNote = 'No sound (no audio source given)';
    }

    let written = 0;
    let writeChain: Promise<unknown> = Promise.resolve();
    let writeFailure: Error | null = null;
    const muxer = new Muxer({
        target: new StreamTarget({
            onData: (data: Uint8Array) => {
                const copy = data.slice().buffer as ArrayBuffer;
                written += copy.byteLength;
                writeChain = writeChain
                    .then(() => electron.appendVideoExportChunk(sessionId, copy))
                    .catch(error => { writeFailure = error instanceof Error ? error : new Error(String(error)); });
            },
        }),
        video: { codec: 'avc', width: options.width, height: options.height, frameRate: options.fps },
        ...(audio ? { audio: { codec: audio.codec, numberOfChannels: audio.channels, sampleRate: AUDIO_RATE } } : {}),
        fastStart: 'fragmented',
        firstTimestampBehavior: 'offset',
    });

    let closed = false;
    let result: DesktopMp4Result | null = null;
    // Audio goes in next to the video it belongs with (fragmented files need both tracks to advance together).
    let audioCursor = 0;
    const feedAudioUpTo = (untilUs: number) => {
        if (!audio) return;
        while (audioCursor < audio.chunks.length && audio.chunks[audioCursor].timestampUs <= untilUs) {
            const piece = audio.chunks[audioCursor++];
            muxer.addAudioChunkRaw(piece.data, piece.type, piece.timestampUs, piece.durationUs, piece.meta as EncodedAudioChunkMetadata | undefined);
        }
    };
    return {
        audioNote,
        get result() { return result; },
        write: async chunk => {
            if (writeFailure) throw writeFailure;
            feedAudioUpTo(chunk.timestampUs);
            muxer.addVideoChunkRaw(chunk.data, chunk.keyFrame ? 'key' : 'delta', chunk.timestampUs, chunk.durationUs, withDescription(chunk));
            // Backpressure: wait for the disk when many writes are queued.
            if (written > 0) await writeChain;
        },
        finish: async () => {
            feedAudioUpTo(Number.POSITIVE_INFINITY);
            muxer.finalize();
            await writeChain;
            if (writeFailure) throw writeFailure;
            const done = await electron.finishVideoExportFile(sessionId);
            closed = true;
            result = { filePath: done.filePath, bytes: done.bytesWritten, displayName: options.displayName };
        },
        abort: async () => {
            if (closed) return;
            closed = true;
            try { await writeChain; } catch { /* ignore */ }
            try { await electron.abortVideoExportFile(sessionId); } catch { /* already gone */ }
        },
    };
};
