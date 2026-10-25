import {
    AUDIO_EQUALIZER_BANDS,
    AUDIO_EQUALIZER_MAX_GAIN_DB,
    AUDIO_EQUALIZER_MIN_GAIN_DB,
    type AudioEqualizerSettings,
} from '../utils/audioEqualizer';

// src/services/audioEqualizerGraph.ts
// Real-time 10-band Web Audio BiquadFilterNode chain plus runtime capability and
// analytical composite frequency response utilities.
//
// Poweramp-style clean bass & anti-clipping architecture:
// 1. Musical per-band Q factors:
//    - 31 Hz lowshelf & 16 kHz highshelf use Butterworth Q = 0.7071 (Math.SQRT1_2) so the shelf
//      transition is monotonic with zero resonant overshoot/undershoot ringing.
//    - 62 Hz & 125 Hz sub/mid-bass peaking filters use wider musical Q (0.85 and 1.0) instead of
//      narrow Q = 1.4, producing deep, warm punch without single-note boomy resonance.
// 2. Low-frequency overlap de-cumulation:
//    - When adjacent bass bands (31 Hz lowshelf, 62 Hz peaking, 125 Hz peaking) are boosted
//      simultaneously, their skirts overlap in the 40 Hz - 110 Hz region. Soft cross-band
//      de-cumulation trims redundant skirt stacking so bass remains tight and articulated.
// 3. Automatic Preamp Headroom Compensation:
//    - Evaluates the true composite frequency response across dense log-spaced frequencies
//      (25 Hz - 18 kHz) plus any active post-EQ Punch/Drive boost, and computes a negative
//      preamp input gain offset (-0.78x of peak positive boost, plus safety margin) so
//      boosted bass transients never clip past 0 dBFS.

import type { MutableRefObject } from 'react';

const DEFAULT_PEAKING_Q = 1.2;
const BUTTERWORTH_SHELF_Q = Math.SQRT1_2; // 0.70710678...
const SUB_BASS_62HZ_Q = 0.85;
const MID_BASS_125HZ_Q = 1.0;

// Smooth 15ms-20ms RC time constants for click-free slider and preset transitions.
const GAIN_RAMP_SECONDS = 0.015;
export const PREAMP_RAMP_SECONDS = 0.020;

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

export interface AudioEqualizerRuntimeStatus {
    supported: boolean;
    connected: boolean;
    bandCount: number;
    sampleRate: number | null;
    contextState: AudioContextState | 'uninitialized' | 'unsupported';
    activeBandGainsDb: number[];
    reason?: string;
}

const createFlatBandGains = (): number[] => AUDIO_EQUALIZER_BANDS.map(() => 0);

let currentRuntimeStatus: AudioEqualizerRuntimeStatus = {
    supported: true,
    connected: false,
    bandCount: AUDIO_EQUALIZER_BANDS.length,
    sampleRate: null,
    contextState: 'uninitialized',
    activeBandGainsDb: createFlatBandGains(),
};

const statusListeners = new Set<(status: AudioEqualizerRuntimeStatus) => void>();

const notifyRuntimeStatus = (next: AudioEqualizerRuntimeStatus) => {
    currentRuntimeStatus = next;
    statusListeners.forEach(listener => {
        try {
            listener(currentRuntimeStatus);
        } catch {
            // Ignore listener errors
        }
    });
};

export const isWebAudioEqualizerSupported = (): boolean => {
    if (typeof window === 'undefined') {
        return true;
    }
    const AudioContextClass = window.AudioContext
        || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    return typeof AudioContextClass === 'function';
};

export const getAudioEqualizerRuntimeStatus = (): AudioEqualizerRuntimeStatus => {
    if (!isWebAudioEqualizerSupported()) {
        return {
            supported: false,
            connected: false,
            bandCount: AUDIO_EQUALIZER_BANDS.length,
            sampleRate: null,
            contextState: 'unsupported',
            activeBandGainsDb: createFlatBandGains(),
            reason: 'Web Audio API is not supported by this browser/device runtime.',
        };
    }
    return currentRuntimeStatus;
};

export const subscribeAudioEqualizerRuntime = (
    listener: (status: AudioEqualizerRuntimeStatus) => void,
): (() => void) => {
    statusListeners.add(listener);
    return () => {
        statusListeners.delete(listener);
    };
};

// Connects a 10-band equalizer between `input` and `output` and populates `nodesRef.current`.
// Uses a lowshelf at 31 Hz, highshelf at 16 kHz, and peaking filters on the 8 interior bands
// with musical per-band Q factors (Butterworth 0.7071 on shelves, 0.85 on 62 Hz, 1.0 on 125 Hz).
export const connectAudioEqualizerGraph = ({
    context,
    input,
    output,
    nodesRef,
    settings,
}: {
    context: AudioContext;
    input: AudioNode;
    output: AudioNode;
    nodesRef: MutableRefObject<BiquadFilterNode[]>;
    settings: AudioEqualizerSettings;
}) => {
    if (!context || typeof context.createBiquadFilter !== 'function') {
        notifyRuntimeStatus({
            supported: false,
            connected: false,
            bandCount: AUDIO_EQUALIZER_BANDS.length,
            sampleRate: null,
            contextState: 'unsupported',
            activeBandGainsDb: createFlatBandGains(),
            reason: 'AudioContext.createBiquadFilter is unavailable on this audio backend.',
        });
        return;
    }

    const activeBandGainsDb: number[] = [];
    const filters = AUDIO_EQUALIZER_BANDS.map((band, index) => {
        const filter = context.createBiquadFilter();
        filter.type = index === 0
            ? 'lowshelf'
            : index === AUDIO_EQUALIZER_BANDS.length - 1
                ? 'highshelf'
                : 'peaking';
        filter.frequency.value = band.frequency;
        filter.Q.value = getEqualizerBandQ(index);
        const rawBandGain = settings.enabled ? (settings.gains[index] ?? 0) : 0;
        const clampedGain = Math.max(
            AUDIO_EQUALIZER_MIN_GAIN_DB,
            Math.min(AUDIO_EQUALIZER_MAX_GAIN_DB, rawBandGain),
        );
        filter.gain.value = clampedGain;
        activeBandGainsDb.push(clampedGain);
        return filter;
    });

    nodesRef.current = filters;

    input.connect(filters[0]);
    for (let index = 0; index < filters.length - 1; index += 1) {
        filters[index].connect(filters[index + 1]);
    }
    filters[filters.length - 1].connect(output);

    notifyRuntimeStatus({
        supported: true,
        connected: true,
        bandCount: filters.length,
        sampleRate: typeof context.sampleRate === 'number' ? context.sampleRate : 48_000,
        contextState: context.state ?? 'running',
        activeBandGainsDb,
    });
};

export const applyAudioEqualizerSettings = (
    context: AudioContext | null,
    nodes: BiquadFilterNode[],
    settings: AudioEqualizerSettings,
) => {
    if (!context || nodes.length === 0) {
        notifyRuntimeStatus({
            supported: isWebAudioEqualizerSupported(),
            connected: false,
            bandCount: AUDIO_EQUALIZER_BANDS.length,
            sampleRate: null,
            contextState: 'uninitialized',
            activeBandGainsDb: createFlatBandGains(),
        });
        return;
    }

    const currentTime = context.currentTime;
    const activeBandGainsDb: number[] = [];
    nodes.forEach((node, index) => {
        const targetQ = getEqualizerBandQ(index);
        if (node.Q && typeof node.Q.value === 'number') {
            node.Q.value = targetQ;
        }
        const rawTargetGain = settings.enabled
            ? computeDeCumulatedBandGainDb(settings.gains, index)
            : 0;
        const clampedGain = Math.max(
            AUDIO_EQUALIZER_MIN_GAIN_DB,
            Math.min(AUDIO_EQUALIZER_MAX_GAIN_DB, rawTargetGain),
        );
        activeBandGainsDb.push(clampedGain);
        node.gain.cancelScheduledValues(currentTime);
        node.gain.setTargetAtTime(clampedGain, currentTime, GAIN_RAMP_SECONDS);
    });

    notifyRuntimeStatus({
        supported: true,
        connected: true,
        bandCount: nodes.length,
        sampleRate: typeof context.sampleRate === 'number' ? context.sampleRate : 48_000,
        contextState: context.state ?? 'running',
        activeBandGainsDb,
    });
};

/**
 * Evaluates the exact digital biquad magnitude response (in dB) of the 10-band filter cascade
 * at any given probe frequencies. Used by both the UI frequency curve and unit tests to verify
 * real filter transfer characteristics.
 */
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

// Probe grid covering sub-bass, mid-bass, midrange, and treble peaks to catch inter-band accumulation.
const PREAMP_PROBE_FREQUENCIES: readonly number[] = [
    25, 31, 45, 55, 62, 80, 95, 125, 180, 250, 350, 500, 700, 1000, 1400, 2000, 2800, 4000, 6000, 8000, 12000, 16000,
];

/**
 * Automatic Preamp Headroom Compensation (Anti-Clipping):
 * Calculates the peak positive gain across the active 10-band EQ cascade (especially low-frequency
 * sub-bass/mid-bass shelf + bell accumulation) and any active Punch/Drive boost, then returns a
 * negative Preamp input gain offset (in dB, <= 0) so boosted bass transients never exceed 0 dBFS.
 */
export const computeEqualizerPreampGainDb = (
    settings: Pick<AudioEqualizerSettings, 'enabled' | 'gains'> & {
        effects?: Partial<{ drive: number; punch: number; width: number }>;
    },
    sampleRate = 48_000,
): number => {
    if (!settings.enabled) {
        return 0;
    }

    // 1. Evaluate the composite biquad response across the dense probe grid
    const compositeCurve = computeEqualizerFrequencyResponseDb(settings, PREAMP_PROBE_FREQUENCIES, sampleRate);
    let maxCompositePositiveDb = 0;
    for (let i = 0; i < compositeCurve.length; i += 1) {
        if (compositeCurve[i] > maxCompositePositiveDb) {
            maxCompositePositiveDb = compositeCurve[i];
        }
    }

    // 2. Also inspect raw low-frequency sliders (31 Hz, 62 Hz, 125 Hz) since bass transients carry
    //    the highest crest energy in modern mastered tracks (often mastered to -0.1 dBFS).
    const lowBand0 = Math.max(0, Number(settings.gains[0] ?? 0));
    const lowBand1 = Math.max(0, Number(settings.gains[1] ?? 0));
    const lowBand2 = Math.max(0, Number(settings.gains[2] ?? 0));
    const lowFrequencyPeakDb = Math.max(lowBand0, lowBand1, lowBand2);

    // 3. Account for extra harmonic/dynamics energy when Drive or Punch is active in the preset
    const driveAmount = Math.max(0, Number(settings.effects?.drive ?? 0));
    const punchAmount = Math.max(0, Number(settings.effects?.punch ?? 0));
    const effectsBoostDb = driveAmount * 1.5 + punchAmount * 1.8;

    const effectivePeakBoostDb = Math.max(maxCompositePositiveDb, lowFrequencyPeakDb) + effectsBoostDb;
    if (effectivePeakBoostDb <= 0.1) {
        return 0;
    }

    // Apply ~78%-82% negative Preamp headroom attenuation of the composite peak positive boost,
    // leaving the remaining ~18% transient peak to be transparently caught by the post-EQ soft-knee limiter.
    const bassWeight = lowFrequencyPeakDb > 1.5 ? 0.82 : 0.74;
    const preampAttenuationDb = -(effectivePeakBoostDb * bassWeight);
    return Number(Math.max(-15, Math.min(0, preampAttenuationDb)).toFixed(2));
};

export const computeEqualizerPreampLinearGain = (
    settings: Pick<AudioEqualizerSettings, 'enabled' | 'gains'> & {
        effects?: Partial<{ drive: number; punch: number; width: number }>;
    },
    sampleRate = 48_000,
): number => {
    const db = computeEqualizerPreampGainDb(settings, sampleRate);
    return 10 ** (db / 20);
};

export const applyEqualizerPreampHeadroom = (
    context: AudioContext | null,
    preampNode: GainNode | null,
    settings: Pick<AudioEqualizerSettings, 'enabled' | 'gains'> & {
        effects?: Partial<{ drive: number; punch: number; width: number }>;
    },
) => {
    if (!context || !preampNode || !preampNode.gain) {
        return;
    }
    const sampleRate = typeof context.sampleRate === 'number' ? context.sampleRate : 48_000;
    const targetLinearGain = computeEqualizerPreampLinearGain(settings, sampleRate);
    const currentTime = typeof context.currentTime === 'number' ? context.currentTime : 0;
    if (typeof preampNode.gain.cancelScheduledValues === 'function') {
        preampNode.gain.cancelScheduledValues(currentTime);
    }
    if (typeof preampNode.gain.setTargetAtTime === 'function') {
        preampNode.gain.setTargetAtTime(targetLinearGain, currentTime, PREAMP_RAMP_SECONDS);
    } else {
        preampNode.gain.value = targetLinearGain;
    }
};
