import type { MutableRefObject } from 'react';
import {
    AUDIO_EQUALIZER_BANDS,
    DEFAULT_AUDIO_EQUALIZER_SETTINGS,
    type AudioEqualizerSettings,
} from '../utils/audioEqualizer';

// src/services/audioEqualizerGraph.ts
// Owns the Web Audio 10-band biquad filter chain without introducing React updates into the audio path,
// and exposes runtime diagnostics + exact RBJ biquad frequency response evaluation.

type ConnectAudioEqualizerGraphParams = {
    context: AudioContext;
    input: AudioNode;
    output: AudioNode;
    nodesRef: MutableRefObject<BiquadFilterNode[]>;
    settings: AudioEqualizerSettings;
};

export interface AudioEqualizerRuntimeStatus {
    supported: boolean;
    connected: boolean;
    contextState: AudioContextState | 'uninitialized';
    sampleRate: number | null;
    bandCount: number;
    centerFrequencies: number[];
    activeBandGainsDb: number[];
    reason?: string;
}

const FILTER_Q = 1.4;

let activeContext: AudioContext | null = null;
let activeNodes: BiquadFilterNode[] = [];
let activeSettings: AudioEqualizerSettings = DEFAULT_AUDIO_EQUALIZER_SETTINGS;
const runtimeListeners = new Set<() => void>();

const notifyRuntimeListeners = () => {
    runtimeListeners.forEach(listener => {
        try {
            listener();
        } catch {
            // Ignore listener errors
        }
    });
};

export const subscribeAudioEqualizerRuntime = (listener: () => void): (() => void) => {
    runtimeListeners.add(listener);
    return () => {
        runtimeListeners.delete(listener);
    };
};

export const isWebAudioEqualizerSupported = (): boolean => {
    if (typeof window === 'undefined') {
        return false;
    }
    const Ctx = window.AudioContext
        || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    return typeof Ctx === 'function';
};

export const getAudioEqualizerRuntimeStatus = (): AudioEqualizerRuntimeStatus => {
    const supported = isWebAudioEqualizerSupported();
    const centerFrequencies = AUDIO_EQUALIZER_BANDS.map(b => b.frequency);
    if (!supported && !activeContext) {
        return {
            supported: false,
            connected: false,
            contextState: 'uninitialized',
            sampleRate: null,
            bandCount: AUDIO_EQUALIZER_BANDS.length,
            centerFrequencies,
            activeBandGainsDb: AUDIO_EQUALIZER_BANDS.map(() => 0),
            reason: 'Web Audio API (AudioContext) is unavailable in this environment.',
        };
    }

    const connected = Boolean(activeContext && activeNodes.length === AUDIO_EQUALIZER_BANDS.length);
    const contextState: AudioContextState | 'uninitialized' = activeContext?.state ?? 'uninitialized';
    const sampleRate = typeof activeContext?.sampleRate === 'number' ? activeContext.sampleRate : null;
    const activeBandGainsDb = AUDIO_EQUALIZER_BANDS.map((_, index) => (
        activeSettings.enabled ? (activeSettings.gains[index] ?? 0) : 0
    ));

    return {
        supported: true,
        connected,
        contextState,
        sampleRate,
        bandCount: AUDIO_EQUALIZER_BANDS.length,
        centerFrequencies,
        activeBandGainsDb,
    };
};

const resolveFilterFrequency = (context: AudioContext, frequency: number) => (
    Math.min(frequency, context.sampleRate * 0.475)
);

// Creates one stable ten-filter chain for the lifetime of the MediaElementAudioSourceNode.
export const connectAudioEqualizerGraph = ({
    context,
    input,
    output,
    nodesRef,
    settings,
}: ConnectAudioEqualizerGraphParams) => {
    const nodes = AUDIO_EQUALIZER_BANDS.map((band, index) => {
        const filter = context.createBiquadFilter();
        filter.type = index === 0
            ? 'lowshelf'
            : index === AUDIO_EQUALIZER_BANDS.length - 1
                ? 'highshelf'
                : 'peaking';
        filter.frequency.value = resolveFilterFrequency(context, band.frequency);
        filter.Q.value = FILTER_Q;
        filter.gain.value = settings.enabled ? (settings.gains[index] ?? 0) : 0;
        return filter;
    });

    nodes.reduce<AudioNode>((previousNode, filter) => {
        previousNode.connect(filter);
        return filter;
    }, input).connect(output);
    nodesRef.current = nodes;

    activeContext = context;
    activeNodes = nodes;
    activeSettings = settings;
    if (typeof (context as { addEventListener?: unknown }).addEventListener === 'function') {
        context.addEventListener('statechange', notifyRuntimeListeners);
    }
    notifyRuntimeListeners();
};

// Smoothly applies discrete slider commits while keeping React out of the audio processing loop.
export const applyAudioEqualizerSettings = (
    context: AudioContext,
    nodes: BiquadFilterNode[],
    settings: AudioEqualizerSettings,
) => {
    nodes.forEach((filter, index) => {
        const nextGain = settings.enabled ? (settings.gains[index] ?? 0) : 0;
        filter.gain.cancelScheduledValues(context.currentTime);
        filter.gain.setTargetAtTime(nextGain, context.currentTime, 0.015);
    });
    activeContext = context;
    activeNodes = nodes;
    activeSettings = settings;
    notifyRuntimeListeners();
};

/**
 * Evaluates a single RBJ biquad filter's magnitude response (linear gain) at `evalFreqHz`.
 * Matches the Web Audio API BiquadFilterNode specification for lowshelf, peaking, and highshelf.
 */
const evaluateSingleBiquadLinearMagnitude = (
    type: 'lowshelf' | 'peaking' | 'highshelf',
    centerFreqHz: number,
    gainDb: number,
    q: number,
    evalFreqHz: number,
    sampleRate: number,
): number => {
    if (Math.abs(gainDb) < 1e-6) {
        return 1;
    }
    const f0 = Math.min(centerFreqHz, sampleRate * 0.475);
    const A = Math.pow(10, gainDb / 40);
    const w0 = (2 * Math.PI * f0) / sampleRate;
    const cosW0 = Math.cos(w0);
    const sinW0 = Math.sin(w0);

    let b0 = 1;
    let b1 = 0;
    let b2 = 0;
    let a0 = 1;
    let a1 = 0;
    let a2 = 0;

    if (type === 'peaking') {
        const alpha = sinW0 / (2 * q);
        b0 = 1 + alpha * A;
        b1 = -2 * cosW0;
        b2 = 1 - alpha * A;
        a0 = 1 + alpha / A;
        a1 = -2 * cosW0;
        a2 = 1 - alpha / A;
    } else if (type === 'lowshelf') {
        // S = 1 shelf slope
        const alpha = (sinW0 / 2) * Math.sqrt(2);
        const twoSqrtAAlpha = 2 * Math.sqrt(A) * alpha;
        b0 = A * ((A + 1) - (A - 1) * cosW0 + twoSqrtAAlpha);
        b1 = 2 * A * ((A - 1) - (A + 1) * cosW0);
        b2 = A * ((A + 1) - (A - 1) * cosW0 - twoSqrtAAlpha);
        a0 = (A + 1) + (A - 1) * cosW0 + twoSqrtAAlpha;
        a1 = -2 * ((A - 1) + (A + 1) * cosW0);
        a2 = (A + 1) + (A - 1) * cosW0 - twoSqrtAAlpha;
    } else {
        // highshelf
        const alpha = (sinW0 / 2) * Math.sqrt(2);
        const twoSqrtAAlpha = 2 * Math.sqrt(A) * alpha;
        b0 = A * ((A + 1) + (A - 1) * cosW0 + twoSqrtAAlpha);
        b1 = -2 * A * ((A - 1) + (A + 1) * cosW0);
        b2 = A * ((A + 1) + (A - 1) * cosW0 - twoSqrtAAlpha);
        a0 = (A + 1) - (A - 1) * cosW0 + twoSqrtAAlpha;
        a1 = 2 * ((A - 1) - (A + 1) * cosW0);
        a2 = (A + 1) - (A - 1) * cosW0 - twoSqrtAAlpha;
    }

    const bn0 = b0 / a0;
    const bn1 = b1 / a0;
    const bn2 = b2 / a0;
    const an1 = a1 / a0;
    const an2 = a2 / a0;

    const w = (2 * Math.PI * Math.min(evalFreqHz, sampleRate * 0.49)) / sampleRate;
    const cosW = Math.cos(w);
    const sinW = Math.sin(w);
    const cos2W = Math.cos(2 * w);
    const sin2W = Math.sin(2 * w);

    const numRe = bn0 + bn1 * cosW + bn2 * cos2W;
    const numIm = -(bn1 * sinW + bn2 * sin2W);
    const denRe = 1 + an1 * cosW + an2 * cos2W;
    const denIm = -(an1 * sinW + an2 * sin2W);

    const numMagSq = numRe * numRe + numIm * numIm;
    const denMagSq = Math.max(1e-12, denRe * denRe + denIm * denIm);
    return Math.sqrt(numMagSq / denMagSq);
};

/**
 * Computes the composite frequency response (in dB) of the 10-band biquad filter cascade
 * at the given frequencies (defaults to the 10 band center frequencies).
 */
export const computeEqualizerFrequencyResponseDb = (
    settings: Pick<AudioEqualizerSettings, 'enabled' | 'gains'>,
    frequencies: readonly number[] = AUDIO_EQUALIZER_BANDS.map(b => b.frequency),
    sampleRate = 48_000,
): number[] => {
    if (!settings.enabled) {
        return frequencies.map(() => 0);
    }

    return frequencies.map((freq) => {
        let totalLinearMag = 1;
        AUDIO_EQUALIZER_BANDS.forEach((band, index) => {
            const type = index === 0
                ? 'lowshelf'
                : index === AUDIO_EQUALIZER_BANDS.length - 1
                    ? 'highshelf'
                    : 'peaking';
            const gainDb = settings.gains[index] ?? 0;
            totalLinearMag *= evaluateSingleBiquadLinearMagnitude(
                type,
                band.frequency,
                gainDb,
                FILTER_Q,
                freq,
                sampleRate,
            );
        });
        return Number((20 * Math.log10(Math.max(1e-6, totalLinearMag))).toFixed(2));
    });
};
