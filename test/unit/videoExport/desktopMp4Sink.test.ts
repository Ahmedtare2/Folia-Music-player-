// @vitest-environment node
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { createDesktopMp4Sink } from '@/services/videoExport/desktopMp4Sink';

// test/unit/videoExport/desktopMp4Sink.test.ts
// The desktop MP4 sink builds a real fragmented MP4 through mp4-muxer and hands it to the main process in order.
const require = createRequire(import.meta.url);
const { finalizeVideoExport } = require('../../../electron/videoExportMp4.cjs');

const sps = Uint8Array.from([0x67, 0x64, 0x00, 0x1f, 0xac, 0xd9, 0x40, 0x50, 0x05, 0xbb, 0x01, 0x10, 0x00, 0x00, 0x03, 0x00, 0x10, 0x00, 0x00, 0x03, 0x03, 0xc0, 0xf1, 0x83, 0x19, 0x60]);
const pps = Uint8Array.from([0x68, 0xeb, 0xe3, 0xcb, 0x22, 0xc0]);
const avcC = Uint8Array.from([1, 0x64, 0, 0x1f, 0xff, 0xe1, 0, sps.length, ...sps, 1, 0, pps.length, ...pps]);

describe('desktop MP4 sink', () => {
    it('writes a sequential fragmented MP4 without sound', async () => {
        const parts: Uint8Array[] = [];
        (globalThis as unknown as { window: unknown }).window = {
            electron: {
                openVideoExportFile: async () => 'session',
                appendVideoExportChunk: async (_id: string, data: ArrayBuffer) => { parts.push(new Uint8Array(data)); return 0; },
                finishVideoExportFile: async () => ({ filePath: 'x.mp4', bytesWritten: parts.reduce((n, p) => n + p.length, 0) }),
                abortVideoExportFile: async () => true,
            },
        };
        const sink = await createDesktopMp4Sink({
            width: 640, height: 360, fps: 30, filePath: 'x.mp4', displayName: 'x', audio: null, signal: new AbortController().signal,
        });
        for (let i = 0; i < 90; i++) {
            await sink.write({
                data: new Uint8Array([0, 0, 0, 4, 0x65, 1, 2, 3]),
                timestampUs: Math.round(i * 1e6 / 30), durationUs: 33333, keyFrame: i % 60 === 0,
                decoderConfig: i === 0 ? { codec: 'avc1.64001f', description: avcC, codedWidth: 640, codedHeight: 360 } : undefined,
            });
        }
        await sink.finish!();
        const file = Buffer.concat(parts.map(p => Buffer.from(p)));
        expect(file.toString('ascii', 4, 8)).toBe('ftyp');
        expect(() => finalizeVideoExport(file)).not.toThrow();
        expect(sink.result?.bytes).toBe(file.length);
    });
});
