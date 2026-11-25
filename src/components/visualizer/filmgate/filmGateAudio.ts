import type { MotionValue } from 'framer-motion';
import type { AudioBands } from '../../../types';

// src/components/visualizer/filmgate/filmGateAudio.ts
// Folia's audio MotionValues -> the few smoothed 0..1 signals FILMGATE draws from.
//
// Scale: the main player writes 0..255 (and a 0..40 "breathing" while silent); the playground, previews and the OBS
// bridge write 0..1. A source never mixes the two, so, as the other styles do, the first value seen above 1 pins the
// source as 0..255 (looking at the current value alone would read a quiet 0.3 of a 0..255 source as 0.3, not 0.001).
// The video exporter feeds only the overall level (bands are zero), so then the bands are derived from it.
// Smoothing: fast attack, slow release, independent per channel; paused reads as silence.

export interface FilmGateAudioFrame {
    bass: number;
    lowMid: number;
    /** Mid and vocal bands together. */
    mid: number;
    treble: number;
    power: number;
    /** A short 0..1 pulse that jumps when the bass rises sharply and decays in about 0.35 s. */
    kick: number;
}

export interface FilmGateAudioSources {
    audioPower: MotionValue<number>;
    audioBands: AudioBands;
}

export const normalizeFilmGateValue = (value: number, rawScale: boolean) => {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.min(1, rawScale ? value / 255 : value);
};

const smooth = (current: number, target: number, dt: number, attack: number, release: number) => {
    const tau = target > current ? attack : release;
    return current + (target - current) * (1 - Math.exp(-Math.max(0, dt) / tau));
};

export interface FilmGateAudioSampler {
    readonly frame: FilmGateAudioFrame;
    sample: (dt: number, paused: boolean) => void;
    setSources: (sources: FilmGateAudioSources) => void;
}

export const createFilmGateAudioSampler = (initial: FilmGateAudioSources): FilmGateAudioSampler => {
    let sources = initial;
    let rawScale = false;
    let bassAverage = 0;
    const frame: FilmGateAudioFrame = { bass: 0, lowMid: 0, mid: 0, treble: 0, power: 0, kick: 0 };
    const read = (value: MotionValue<number> | undefined) => {
        const raw = value?.get() ?? 0;
        if (raw > 1) rawScale = true;
        return raw;
    };
    return {
        frame,
        setSources: next => {
            if (next.audioPower === sources.audioPower && next.audioBands === sources.audioBands) return;
            sources = next;
            rawScale = false;
        },
        sample: (dt, paused) => {
            if (paused) {
                frame.bass = frame.lowMid = frame.mid = frame.treble = frame.power = 0;
                frame.kick = smooth(frame.kick, 0, dt, 0.05, 0.2);
                bassAverage = 0;
                return;
            }
            const b = sources.audioBands;
            const rawPower = read(sources.audioPower);
            const rawBands = [read(b.bass), read(b.lowMid), Math.max(read(b.mid), read(b.vocal)), read(b.treble)];
            const power = normalizeFilmGateValue(rawPower, rawScale);
            const hasBands = rawBands.some(value => value > 0);
            const bands = hasBands
                ? rawBands.map(value => normalizeFilmGateValue(value, rawScale))
                // Only the overall level is known (video export): spread it over the bands in a plausible way.
                : [power * 0.9, power * 0.7, power * 0.6, power * 0.4];
            frame.bass = smooth(frame.bass, bands[0]!, dt, 0.05, 0.28);
            frame.lowMid = smooth(frame.lowMid, bands[1]!, dt, 0.08, 0.35);
            frame.mid = smooth(frame.mid, bands[2]!, dt, 0.07, 0.3);
            frame.treble = smooth(frame.treble, bands[3]!, dt, 0.04, 0.22);
            frame.power = smooth(frame.power, power, dt, 0.12, 0.5);
            // A kick is the bass jumping above its own slow average.
            const jump = Math.max(0, bands[0]! - bassAverage - 0.08);
            bassAverage = smooth(bassAverage, bands[0]!, dt, 0.35, 0.35);
            const hit = Math.min(1, jump * 3.2);
            frame.kick = hit > frame.kick ? hit : smooth(frame.kick, 0, dt, 0.05, 0.35);
        },
    };
};
