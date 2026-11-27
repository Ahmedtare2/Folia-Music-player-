// src/services/audioOutputStage.ts
// The two stages that make an equalizer boost safe: a preamp BEFORE the equalizer and a limiter AFTER it.
// The preamp is a plain gain the listener sets (0 dB by default, so nothing is lowered on its own: pull it
// down if a loud song distorts when bands are boosted). The limiter is a fast, hard-knee compressor that only
// acts near full scale, so a boost that would clip is caught instead of cracking. Both live in the Web
// Audio graph, so they apply on Android, desktop and web alike.

export const OUTPUT_STAGE_STORAGE_KEY = 'folia_eq_output_stage';
export const OUTPUT_STAGE_MIN_PREAMP_DB = -12;
export const OUTPUT_STAGE_MAX_PREAMP_DB = 0;
/** Where the limiter starts to act (dBFS). Just under full scale. */
export const OUTPUT_STAGE_LIMITER_THRESHOLD_DB = -1;

export type AudioOutputStageSettings = {
    preampDb: number;
    limiterEnabled: boolean;
};

export const DEFAULT_OUTPUT_STAGE_SETTINGS: AudioOutputStageSettings = { preampDb: 0, limiterEnabled: true };

export const normalizeOutputStageSettings = (value: unknown): AudioOutputStageSettings => {
    const raw = (value && typeof value === 'object' ? value : {}) as Partial<AudioOutputStageSettings>;
    const parsed = Number(raw.preampDb);
    const preampDb = Number.isFinite(parsed)
        ? Math.min(OUTPUT_STAGE_MAX_PREAMP_DB, Math.max(OUTPUT_STAGE_MIN_PREAMP_DB, Math.round(parsed * 2) / 2))
        : DEFAULT_OUTPUT_STAGE_SETTINGS.preampDb;
    return {
        preampDb,
        limiterEnabled: typeof raw.limiterEnabled === 'boolean' ? raw.limiterEnabled : DEFAULT_OUTPUT_STAGE_SETTINGS.limiterEnabled,
    };
};

const readStored = (): AudioOutputStageSettings => {
    try {
        const text = typeof localStorage !== 'undefined' ? localStorage.getItem(OUTPUT_STAGE_STORAGE_KEY) : null;
        return normalizeOutputStageSettings(text ? JSON.parse(text) : null);
    } catch {
        return { ...DEFAULT_OUTPUT_STAGE_SETTINGS };
    }
};

let current: AudioOutputStageSettings = readStored();
const listeners = new Set<(settings: AudioOutputStageSettings) => void>();

export const getOutputStageSettings = (): AudioOutputStageSettings => current;

export const setOutputStageSettings = (patch: Partial<AudioOutputStageSettings>) => {
    const next = normalizeOutputStageSettings({ ...current, ...patch });
    if (next.preampDb === current.preampDb && next.limiterEnabled === current.limiterEnabled) {
        return;
    }
    current = next;
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(OUTPUT_STAGE_STORAGE_KEY, JSON.stringify(next));
        }
    } catch {
        // Storage can be full or blocked; the setting still holds for this session.
    }
    listeners.forEach(listener => listener(next));
};

export const subscribeOutputStageSettings = (listener: (settings: AudioOutputStageSettings) => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
};

const RAMP_SECONDS = 0.02;

const setParam = (context: AudioContext, param: AudioParam, value: number) => {
    if (typeof param.setTargetAtTime === 'function') {
        param.cancelScheduledValues?.(context.currentTime);
        param.setTargetAtTime(value, context.currentTime, RAMP_SECONDS);
    } else {
        param.value = value;
    }
};

export type AudioOutputStage = {
    preamp: GainNode;
    limiter: DynamicsCompressorNode;
    dispose: () => void;
};

export const preampDbToLinear = (db: number) => 10 ** (db / 20);

const applyToNodes = (context: AudioContext, preamp: GainNode, limiter: DynamicsCompressorNode, settings: AudioOutputStageSettings) => {
    setParam(context, preamp.gain, preampDbToLinear(settings.preampDb));
    // Off = ratio 1 and threshold 0: the compressor then passes the signal through unchanged.
    setParam(context, limiter.threshold, settings.limiterEnabled ? OUTPUT_STAGE_LIMITER_THRESHOLD_DB : 0);
    setParam(context, limiter.ratio, settings.limiterEnabled ? 20 : 1);
};

export const createAudioOutputStage = (context: AudioContext): AudioOutputStage => {
    const settings = getOutputStageSettings();
    const preamp = context.createGain();
    preamp.gain.value = preampDbToLinear(settings.preampDb);
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = settings.limiterEnabled ? OUTPUT_STAGE_LIMITER_THRESHOLD_DB : 0;
    limiter.knee.value = 0;
    limiter.ratio.value = settings.limiterEnabled ? 20 : 1;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.12;
    const unsubscribe = subscribeOutputStageSettings(next => applyToNodes(context, preamp, limiter, next));
    return { preamp, limiter, dispose: unsubscribe };
};
