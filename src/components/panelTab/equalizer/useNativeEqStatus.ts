import { useEffect, useState } from 'react';
import {
    getAndroidNativeEqStatus,
    isAndroidNativeExoPlayerActive,
    type FoliaNativeEqStatus,
} from '../../../services/android/foliaAndroidBridge';

// src/components/panelTab/equalizer/useNativeEqStatus.ts
// While the native engine is playing, asks it once a second what its EQ is doing, so the EQ window can show
// that the native processing is real (frames processed, settings received, limiter working).

export type NativeEqLine = { running: boolean; text: string };

export const describeNativeEqStatus = (status: FoliaNativeEqStatus | null, nativePlaying: boolean): NativeEqLine => {
    if (!nativePlaying) {
        return { running: false, text: 'Native engine is not playing this song (the standard engine is).' };
    }
    if (!status) {
        return { running: false, text: 'Native engine is playing, but its EQ did not answer. This build may be missing the native EQ.' };
    }
    if (!status.configured) {
        return { running: false, text: `Native engine is playing, but its EQ cannot process this audio format (${status.format || 'unknown'}).` };
    }
    const khz = (status.sampleRate / 1000).toFixed(1).replace(/\.0$/, '');
    const format = `${khz} kHz, ${status.channels} ch, ${status.format}`;
    const limiter = status.limiterReductionDb > 0.05 ? `limiter cutting ${status.limiterReductionDb.toFixed(1)} dB` : 'limiter idle';
    const eq = status.enabled ? `EQ on, preamp ${status.preampDb.toFixed(1)} dB` : 'EQ off';
    const received = status.settingsApplied >= 0 ? '' : ', waiting for settings';
    return { running: status.frames > 0, text: `Native EQ running: ${format}; ${eq}; ${limiter}${received}.` };
};

export const useNativeEqStatus = (watch: boolean): NativeEqLine | null => {
    const [line, setLine] = useState<NativeEqLine | null>(null);
    useEffect(() => {
        if (!watch) {
            setLine(null);
            return undefined;
        }
        let stopped = false;
        const poll = async () => {
            const playing = isAndroidNativeExoPlayerActive();
            const status = playing ? await getAndroidNativeEqStatus() : null;
            if (!stopped) setLine(describeNativeEqStatus(status, playing));
        };
        void poll();
        const timer = setInterval(() => { void poll(); }, 1000);
        return () => {
            stopped = true;
            clearInterval(timer);
        };
    }, [watch]);
    return line;
};
