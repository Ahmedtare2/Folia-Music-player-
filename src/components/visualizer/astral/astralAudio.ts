import type { MotionValue } from 'framer-motion';
import type { AudioBands } from '../../../types';

// src/components/visualizer/astral/astralAudio.ts
// Folia's audio MotionValues -> the smoothed 0..1 signals ASTRAL's hall moves with.
// Scales: the main player writes 0..255 (and a small 0..40 "breathing" value while silent); previews, the playground and the OBS
// bridge write 0..1; the video exporter writes only the overall level. A source never mixes scales, so the first value above 1 pins the
// source as 0..255 (a quiet 0.3 of a 0..255 source must not be read as 0.3). Each band has its own attack and release.

export interface AstralAudioSignals {
    bass: number; lowMid: number; mid: number; vocal: number; treble: number; power: number; kick: number;
}

export interface AstralAudioSources {
    audioPower: MotionValue<number>;
    audioBands: AudioBands;
}

export const normalizeAstralValue = (value: number, rawScale: boolean): number => {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.min(1, rawScale ? value / 255 : value);
};

export const smoothToward = (current: number, target: number, dt: number, attack: number, release: number): number => {
    const tau = target > current ? attack : release;
    const next = current + (target - current) * (1 - Math.exp(-Math.max(0, dt) / tau));
    return Number.isFinite(next) ? next : 0;
};

export interface AstralAudioSampler {
    readonly signals: AstralAudioSignals;
    sample: (dt: number, paused: boolean) => void;
    setSources: (sources: AstralAudioSources) => void;
}

export const createAstralAudioSampler = (initial: AstralAudioSources): AstralAudioSampler => {
    let sources = initial;
    let rawScale = false;
    let bassAverage = 0;
    const signals: AstralAudioSignals = { bass: 0, lowMid: 0, mid: 0, vocal: 0, treble: 0, power: 0, kick: 0 };
    const read = (mv: MotionValue<number> | undefined) => {
        const raw = mv?.get() ?? 0;
        if (raw > 1) rawScale = true;
        return raw;
    };
    return {
        signals,
        setSources: next => {
            if (next.audioPower === sources.audioPower && next.audioBands === sources.audioBands) return;
            sources = next;
            rawScale = false;
        },
        sample: (dt, paused) => {
            if (paused) {
                signals.bass = smoothToward(signals.bass, 0, dt, 0.1, 0.25);
                signals.lowMid = smoothToward(signals.lowMid, 0, dt, 0.1, 0.25);
                signals.mid = smoothToward(signals.mid, 0, dt, 0.1, 0.25);
                signals.vocal = smoothToward(signals.vocal, 0, dt, 0.1, 0.25);
                signals.treble = smoothToward(signals.treble, 0, dt, 0.1, 0.25);
                signals.power = smoothToward(signals.power, 0, dt, 0.1, 0.4);
                signals.kick = smoothToward(signals.kick, 0, dt, 0.05, 0.2);
                bassAverage = 0;
                return;
            }
            const b = sources.audioBands;
            const rawPower = read(sources.audioPower);
            const raw = [read(b.bass), read(b.lowMid), read(b.mid), read(b.vocal), read(b.treble)];
            const power = normalizeAstralValue(rawPower, rawScale);
            const has = raw.some(value => value > 0);
            const v = has
                ? raw.map(value => normalizeAstralValue(value, rawScale))
                // Only the overall level is known (video export): spread it over the bands in a plausible way.
                : [power * 0.9, power * 0.7, power * 0.6, power * 0.55, power * 0.4];
            signals.bass = smoothToward(signals.bass, v[0]!, dt, 0.05, 0.3);
            signals.lowMid = smoothToward(signals.lowMid, v[1]!, dt, 0.09, 0.4);
            signals.mid = smoothToward(signals.mid, v[2]!, dt, 0.08, 0.35);
            signals.vocal = smoothToward(signals.vocal, v[3]!, dt, 0.07, 0.35);
            signals.treble = smoothToward(signals.treble, v[4]!, dt, 0.04, 0.25);
            signals.power = smoothToward(signals.power, power, dt, 0.14, 0.55);
            const jump = Math.max(0, v[0]! - bassAverage - 0.08);
            bassAverage = smoothToward(bassAverage, v[0]!, dt, 0.35, 0.35);
            const hit = Math.min(1, jump * 3.2);
            signals.kick = hit > signals.kick ? hit : smoothToward(signals.kick, 0, dt, 0.05, 0.35);
        },
    };
};
