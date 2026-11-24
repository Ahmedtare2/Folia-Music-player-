import { getNativeVideoExportPlugin } from '../android/foliaAndroidBridge';
import type { VideoChunk, VideoChunkSink, VideoCodecFamily } from './videoEncoderSession';

// src/services/videoExport/nativeMp4Sink.ts
// Video export: sends the encoder's chunks to the native MP4 writer (MediaMuxer) in batches, together with the song's
// audio (made into AAC natively), and saves the file to Movies/Folia when the last chunk is written.

const FLUSH_BYTES = 2_500_000;
const FLUSH_CHUNKS = 90;

export type NativeMp4Result = { uri: string; bytes: number; displayName: string };

export type NativeMp4Sink = VideoChunkSink & {
    readonly audioNote: string | null;
    readonly result: NativeMp4Result | null;
    abort: () => Promise<void>;
};

const toBase64 = (bytes: Uint8Array): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Could not encode a chunk batch'));
    reader.onload = () => {
        const text = String(reader.result ?? '');
        resolve(text.slice(text.indexOf(',') + 1));
    };
    reader.readAsDataURL(new Blob([bytes as BlobPart]));
});

export const createNativeMp4Sink = async (options: {
    family: VideoCodecFamily;
    width: number;
    height: number;
    fps: number;
    displayName: string;
    audio: { contentUri: string; startSec: number; durationSec: number } | null;
}): Promise<NativeMp4Sink> => {
    const plugin = getNativeVideoExportPlugin();
    if (!plugin) throw new Error('Saving video needs the Android app (the native video writer was not found)');
    const started = await plugin.start({
        mime: options.family === 'hevc' ? 'video/hevc' : 'video/avc',
        width: options.width,
        height: options.height,
        fps: options.fps,
        ...(options.audio ? {
            audioContentUri: options.audio.contentUri,
            audioStartSec: options.audio.startSec,
            audioDurationSec: options.audio.durationSec,
        } : {}),
    });
    const sessionId = started.sessionId;
    let batch: VideoChunk[] = [];
    let batchBytes = 0;
    let result: NativeMp4Result | null = null;
    let closed = false;

    const flush = async () => {
        if (batch.length === 0) return;
        const chunks = batch;
        batch = [];
        batchBytes = 0;
        const joined = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.data.byteLength, 0));
        let offset = 0;
        const meta: Array<[number, number, number]> = [];
        for (const chunk of chunks) {
            joined.set(chunk.data, offset);
            offset += chunk.data.byteLength;
            meta.push([chunk.data.byteLength, chunk.timestampUs, chunk.keyFrame ? 1 : 0]);
        }
        await plugin.writeChunks({ sessionId, data: await toBase64(joined), meta });
    };

    return {
        audioNote: options.audio
            ? (started.audioError ? `No sound in the video: ${started.audioError}` : null)
            : 'No sound (no audio source given)',
        get result() { return result; },
        write: async chunk => {
            batch.push(chunk);
            batchBytes += chunk.data.byteLength;
            if (batchBytes >= FLUSH_BYTES || batch.length >= FLUSH_CHUNKS) await flush();
        },
        finish: async () => {
            await flush();
            result = await plugin.finish({ sessionId, displayName: options.displayName });
            closed = true;
        },
        abort: async () => {
            if (closed) return;
            closed = true;
            try { await plugin.abort({ sessionId }); } catch { /* already gone */ }
        },
    };
};
