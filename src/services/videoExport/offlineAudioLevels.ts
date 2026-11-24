// src/services/videoExport/offlineAudioLevels.ts
// Video export: the per-frame "audio power" that the live player reads from its analyser, computed from the decoded
// file instead. Same recipe as usePlaybackVisualizerBridge (bass 20-150 Hz and low-mid 150-400 Hz bin means, then
// ((bass + lowMid) / 2 / 255) ^ 3), same FFT size in time (about 46 ms) and the analyser's smoothing and dB range.
// It is an approximation of the live analyser, not a copy: the video does not depend on playback timing at all.

const ANALYSIS_RATE = 22050;
const FFT_SIZE = 1024; // 1024 samples at 22.05 kHz = 2048 samples at 44.1 kHz, bins 21.5 Hz apart like the live analyser.
const MIN_DB = -100;
const MAX_DB = -30;
const LIVE_SMOOTHING = 0.6; // usePlaybackAudioBridge: analyser.smoothingTimeConstant, applied about 60 times a second.
const LIVE_RATE = 60;

export type AudioLevelTrack = {
    /** Level per video frame, 0..1 (the live value divided by 255). */
    levels: Float32Array;
    fps: number;
    startSec: number;
    decodeMs: number;
};

const blackman = (() => {
    const window = new Float32Array(FFT_SIZE);
    const alpha = 0.16;
    for (let i = 0; i < FFT_SIZE; i++) {
        const x = i / FFT_SIZE;
        window[i] = (1 - alpha) / 2 - 0.5 * Math.cos(2 * Math.PI * x) + (alpha / 2) * Math.cos(4 * Math.PI * x);
    }
    return window;
})();

/** In-place radix-2 FFT; magnitudes only are needed afterwards. */
const fft = (re: Float32Array, im: Float32Array) => {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) {
            const tr = re[i]; re[i] = re[j]; re[j] = tr;
            const ti = im[i]; im[i] = im[j]; im[j] = ti;
        }
    }
    for (let len = 2; len <= n; len <<= 1) {
        const angle = (-2 * Math.PI) / len;
        const wr = Math.cos(angle);
        const wi = Math.sin(angle);
        for (let i = 0; i < n; i += len) {
            let cr = 1;
            let ci = 0;
            for (let k = 0; k < len / 2; k++) {
                const a = i + k;
                const b = a + len / 2;
                const tr = re[b] * cr - im[b] * ci;
                const ti = re[b] * ci + im[b] * cr;
                re[b] = re[a] - tr;
                im[b] = im[a] - ti;
                re[a] += tr;
                im[a] += ti;
                const next = cr * wr - ci * wi;
                ci = cr * wi + ci * wr;
                cr = next;
            }
        }
    }
};

const decodeToMono = async (bytes: Uint8Array): Promise<Float32Array> => {
    const context = new OfflineAudioContext(1, 1, ANALYSIS_RATE);
    // decodeAudioData detaches its input; copy so the caller's bytes stay usable.
    const copy = bytes.slice().buffer;
    const decoded = await context.decodeAudioData(copy);
    if (decoded.numberOfChannels === 1) return decoded.getChannelData(0).slice();
    const mono = new Float32Array(decoded.length);
    const channels = decoded.numberOfChannels;
    for (let c = 0; c < channels; c++) {
        const data = decoded.getChannelData(c);
        for (let i = 0; i < mono.length; i++) mono[i] += data[i] / channels;
    }
    return mono;
};

/** Decodes the track and returns one level per video frame for [startSec, startSec + frameCount / fps). */
export const computeAudioLevelTrack = async (
    bytes: Uint8Array,
    fps: number,
    startSec: number,
    frameCount: number,
): Promise<AudioLevelTrack> => {
    const decodeStart = performance.now();
    const mono = await decodeToMono(bytes);
    const decodeMs = performance.now() - decodeStart;

    const levels = new Float32Array(frameCount);
    const re = new Float32Array(FFT_SIZE);
    const im = new Float32Array(FFT_SIZE);
    const smoothed = new Float32Array(FFT_SIZE / 2);
    const smoothing = Math.pow(LIVE_SMOOTHING, LIVE_RATE / fps);
    const binHz = ANALYSIS_RATE / FFT_SIZE;
    const binRange = (minHz: number, maxHz: number): [number, number] => [Math.floor(minHz / binHz), Math.floor(maxHz / binHz)];
    const [bassStart, bassEnd] = binRange(20, 150);
    const [midStart, midEnd] = binRange(150, 400);

    // Warm the smoothing up on the second before the first frame so the clip does not start from silence.
    const warmFrames = Math.round(fps);
    for (let frame = -warmFrames; frame < frameCount; frame++) {
        const centre = Math.round((startSec + frame / fps) * ANALYSIS_RATE);
        const first = centre - FFT_SIZE;
        for (let i = 0; i < FFT_SIZE; i++) {
            const index = first + i;
            re[i] = index >= 0 && index < mono.length ? mono[index] * blackman[i] : 0;
            im[i] = 0;
        }
        fft(re, im);
        for (let k = 0; k < smoothed.length; k++) {
            const magnitude = Math.hypot(re[k], im[k]) / FFT_SIZE;
            smoothed[k] = smoothing * smoothed[k] + (1 - smoothing) * magnitude;
        }
        if (frame < 0) continue;
        const bytesAt = (k: number) => {
            const db = 20 * Math.log10(Math.max(smoothed[k], 1e-12));
            return Math.min(255, Math.max(0, Math.floor((255 * (db - MIN_DB)) / (MAX_DB - MIN_DB))));
        };
        const mean = (from: number, to: number) => {
            let sum = 0;
            for (let k = from; k <= to; k++) sum += bytesAt(k);
            return sum / (to - from + 1);
        };
        const power = Math.pow((mean(bassStart, bassEnd) + mean(midStart, midEnd)) / 2 / 255, 3);
        levels[frame] = Math.min(1, Math.max(0, power));
    }
    return { levels, fps, startSec, decodeMs };
};
