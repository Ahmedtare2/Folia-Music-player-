// src/services/audioEngine.ts
// Which engine plays the music on Android: "standard" (the web audio graph, every visual and effect) or
// "native" (Android's ExoPlayer with Folia's own EQ, preamp and look-ahead limiter in Java). Standard is the
// default, so nothing changes until the listener picks Native. The choice takes effect from the next track.

export type AudioEngineId = 'standard' | 'native';

export const AUDIO_ENGINE_STORAGE_KEY = 'folia_audio_engine';

const read = (): AudioEngineId => {
    try {
        const text = typeof localStorage !== 'undefined' ? localStorage.getItem(AUDIO_ENGINE_STORAGE_KEY) : null;
        return text === 'native' ? 'native' : 'standard';
    } catch {
        return 'standard';
    }
};

let current: AudioEngineId = read();
const listeners = new Set<() => void>();

export const getAudioEngine = (): AudioEngineId => current;

export const setAudioEngine = (engine: AudioEngineId) => {
    const next: AudioEngineId = engine === 'native' ? 'native' : 'standard';
    if (next === current) return;
    current = next;
    try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(AUDIO_ENGINE_STORAGE_KEY, next);
    } catch {
        // Storage can be blocked; the choice still holds for this session.
    }
    listeners.forEach(listener => listener());
};

export const subscribeAudioEngine = (listener: () => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
};
