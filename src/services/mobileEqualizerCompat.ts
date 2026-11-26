import { AUDIO_EQUALIZER_BANDS, AUDIO_EQUALIZER_MAX_GAIN_DB, AUDIO_EQUALIZER_MIN_GAIN_DB, type AudioEqualizerSettings } from '../utils/audioEqualizer';

// src/services/mobileEqualizerCompat.ts
// What the phone's equalizer sheet needs: the analytical frequency response curve (the fork's biquad math, unchanged) and a
// small runtime status. The live audio graph itself is 0.8.2's; this file only draws the curve and reports support.

const DEFAULT_PEAKING_Q = 1.2;
const BUTTERWORTH_SHELF_Q = Math.SQRT1_2; // 0.70710678...
const SUB_BASS_62HZ_Q = 0.85;
const MID_BASS_125HZ_Q = 1.0;


/**
 * Returns the musical Q factor for each of the 10 equalizer bands:
 * - Band 0 (31 Hz lowshelf) & Band 9 (16 kHz highshelf): Butterworth Q = 0.7071 (no resonant shelf peak)
 * - Band 1 (62 Hz peaking): Q = 0.85 (wide, punchy Poweramp-style bass bell)
 * - Band 2 (125 Hz peaking): Q = 1.0 (smooth upper-bass warmth)
 * - Bands 3..8 (250 Hz .. 8 kHz peaking): Q = 1.2
 */
export const getEqualizerBandQ = (bandIndex: number): number => {
    if (bandIndex === 0 || bandIndex === AUDIO_EQUALIZER_BANDS.length - 1) {
        return BUTTERWORTH_SHELF_Q;
    }
    if (bandIndex === 1) {
        return SUB_BASS_62HZ_Q;
    }
    if (bandIndex === 2) {
        return MID_BASS_125HZ_Q;
    }
    return DEFAULT_PEAKING_Q;
};

/**
 * Prevents excessive overlapping gain accumulation between the 31 Hz low-shelf and the
 * 62 Hz / 125 Hz peaking filters when both are boosted simultaneously.
 * Preserves exact single-band gains and never alters cuts or moderate boosts, while softly
 * taming double-boosted sub-bass skirts so 31 Hz + 62 Hz don't compound into muddy clipping.
 */
export const computeDeCumulatedBandGainDb = (
    gains: readonly number[],
    bandIndex: number,
): number => {
    const rawGain = Math.max(
        AUDIO_EQUALIZER_MIN_GAIN_DB,
        Math.min(AUDIO_EQUALIZER_MAX_GAIN_DB, Number(gains[bandIndex] ?? 0)),
    );
    if (rawGain <= 0) {
        return rawGain;
    }
    // Apply gentle overlap de-cumulation on bands 1 (62 Hz) and 2 (125 Hz) when the
    // neighboring lower bass band is also boosted above +3 dB.
    if (bandIndex === 1) {
        const subGain = Math.max(0, Number(gains[0] ?? 0));
        if (subGain > 3 && rawGain > 3) {
            const overlapExcess = Math.min(subGain - 3, rawGain - 3);
            return rawGain - overlapExcess * 0.18;
        }
    } else if (bandIndex === 2) {
        const bass62Gain = Math.max(0, Number(gains[1] ?? 0));
        if (bass62Gain > 3 && rawGain > 3) {
            const overlapExcess = Math.min(bass62Gain - 3, rawGain - 3);
            return rawGain - overlapExcess * 0.15;
        }
    }
    return rawGain;
};

export const computeBiquadMagnitudeDb = (
    type: 'lowshelf' | 'peaking' | 'highshelf',
    centerHz: number,
    gainDb: number,
    q: number,
    probeHz: number,
    sampleRate = 48_000,
): number => {
    if (Math.abs(gainDb) < 1e-6) {
        return 0;
    }
    const A = 10 ** (gainDb / 40);
    const w0 = (2 * Math.PI * centerHz) / sampleRate;
    const cosW0 = Math.cos(w0);
    const sinW0 = Math.sin(w0);
    const alpha = sinW0 / (2 * q);

    let b0 = 1;
    let b1 = 0;
    let b2 = 0;
    let a0 = 1;
    let a1 = 0;
    let a2 = 0;

    if (type === 'peaking') {
        b0 = 1 + alpha * A;
        b1 = -2 * cosW0;
        b2 = 1 - alpha * A;
        a0 = 1 + alpha / A;
        a1 = -2 * cosW0;
        a2 = 1 - alpha / A;
    } else if (type === 'lowshelf') {
        const twoSqrtAAlpha = 2 * Math.sqrt(A) * alpha;
        b0 = A * ((A + 1) - (A - 1) * cosW0 + twoSqrtAAlpha);
        b1 = 2 * A * ((A - 1) - (A + 1) * cosW0);
        b2 = A * ((A + 1) - (A - 1) * cosW0 - twoSqrtAAlpha);
        a0 = (A + 1) + (A - 1) * cosW0 + twoSqrtAAlpha;
        a1 = -2 * ((A - 1) + (A + 1) * cosW0);
        a2 = (A + 1) + (A - 1) * cosW0 - twoSqrtAAlpha;
    } else {
        const twoSqrtAAlpha = 2 * Math.sqrt(A) * alpha;
        b0 = A * ((A + 1) + (A - 1) * cosW0 + twoSqrtAAlpha);
        b1 = -2 * A * ((A - 1) + (A + 1) * cosW0);
        b2 = A * ((A + 1) + (A - 1) * cosW0 - twoSqrtAAlpha);
        a0 = (A + 1) - (A - 1) * cosW0 + twoSqrtAAlpha;
        a1 = 2 * ((A - 1) - (A + 1) * cosW0);
        a2 = (A + 1) - (A - 1) * cosW0 - twoSqrtAAlpha;
    }

    const w = (2 * Math.PI * probeHz) / sampleRate;
    const cosW = Math.cos(w);
    const sinW = Math.sin(w);
    const cos2W = Math.cos(2 * w);
    const sin2W = Math.sin(2 * w);

    const numRe = (b0 + b1 * cosW + b2 * cos2W) / a0;
    const numIm = (-b1 * sinW - b2 * sin2W) / a0;
    const denRe = 1 + (a1 / a0) * cosW + (a2 / a0) * cos2W;
    const denIm = -(a1 / a0) * sinW - (a2 / a0) * sin2W;

    const numMagSq = numRe * numRe + numIm * numIm;
    const denMagSq = Math.max(1e-18, denRe * denRe + denIm * denIm);
    const mag = Math.sqrt(numMagSq / denMagSq);
    return 20 * Math.log10(Math.max(1e-9, mag));
};

export const computeEqualizerFrequencyResponseDb = (
    settings: Pick<AudioEqualizerSettings, 'enabled' | 'gains'>,
    probeFrequencies: readonly number[] = AUDIO_EQUALIZER_BANDS.map(b => b.frequency),
    sampleRate = 48_000,
): number[] => {
    if (!settings.enabled) {
        return probeFrequencies.map(() => 0);
    }
    return probeFrequencies.map(probeHz => {
        let totalDb = 0;
        AUDIO_EQUALIZER_BANDS.forEach((band, index) => {
            const type = index === 0
                ? 'lowshelf'
                : index === AUDIO_EQUALIZER_BANDS.length - 1
                    ? 'highshelf'
                    : 'peaking';
            const gainDb = computeDeCumulatedBandGainDb(settings.gains, index);
            totalDb += computeBiquadMagnitudeDb(
                type,
                band.frequency,
                gainDb,
                getEqualizerBandQ(index),
                probeHz,
                sampleRate,
            );
        });
        return Number(totalDb.toFixed(2));
    });
};


export type AudioEqualizerRuntimeStatus = {
    supported: boolean;
    connected: boolean;
    bandCount: number;
    sampleRate: number | null;
    contextState: string;
    reason?: string;
};

export const getAudioEqualizerRuntimeStatus = (): AudioEqualizerRuntimeStatus => {
    const supported = typeof window === 'undefined' || typeof window.AudioContext === 'function'
        || typeof (window as Window & typeof globalThis & { webkitAudioContext?: unknown }).webkitAudioContext === 'function';
    return supported
        ? { supported: true, connected: true, bandCount: AUDIO_EQUALIZER_BANDS.length, sampleRate: 48_000, contextState: 'running' }
        : { supported: false, connected: false, bandCount: AUDIO_EQUALIZER_BANDS.length, sampleRate: null, contextState: 'unsupported', reason: 'Web Audio API is not supported by this device runtime.' };
};

export const subscribeAudioEqualizerRuntime = (_listener: (status: AudioEqualizerRuntimeStatus) => void): (() => void) => () => {};
