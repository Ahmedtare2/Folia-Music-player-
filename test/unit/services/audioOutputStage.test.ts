import { describe, expect, it, vi } from 'vitest';
import {
    createAudioOutputStage,
    getOutputStageSettings,
    normalizeOutputStageSettings,
    setOutputStageSettings,
} from '@/services/audioOutputStage';

// test/unit/services/audioOutputStage.test.ts
// The preamp and limiter in front of and behind the equalizer: defaults leave the level alone,
// values are clamped, and a change reaches the live nodes.

const param = (value = 0) => ({ value, cancelScheduledValues: vi.fn(), setTargetAtTime: vi.fn() });
const createContext = () => ({
    currentTime: 0,
    createGain: () => ({ gain: param(1) }),
    createDynamicsCompressor: () => ({ threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }),
}) as unknown as AudioContext;

describe('audio output stage', () => {
    it('defaults to 0 dB preamp with the limiter on', () => {
        expect(normalizeOutputStageSettings(undefined)).toEqual({ preampDb: 0, limiterEnabled: true });
    });

    it('clamps the preamp to -12..0 dB and rounds to half a dB', () => {
        expect(normalizeOutputStageSettings({ preampDb: -40 }).preampDb).toBe(-12);
        expect(normalizeOutputStageSettings({ preampDb: 6 }).preampDb).toBe(0);
        expect(normalizeOutputStageSettings({ preampDb: -3.3 }).preampDb).toBe(-3.5);
        expect(normalizeOutputStageSettings({ preampDb: 'x' }).preampDb).toBe(0);
    });

    it('builds a unity preamp and a hard-knee limiter near full scale', () => {
        setOutputStageSettings({ preampDb: 0, limiterEnabled: true });
        const stage = createAudioOutputStage(createContext());
        expect(stage.preamp.gain.value).toBe(1);
        expect(stage.limiter.threshold.value).toBe(-1);
        expect(stage.limiter.knee.value).toBe(0);
        expect(stage.limiter.ratio.value).toBe(20);
        stage.dispose();
    });

    it('pushes a change to the live nodes and stops after dispose', () => {
        const stage = createAudioOutputStage(createContext());
        setOutputStageSettings({ preampDb: -6, limiterEnabled: false });
        expect(getOutputStageSettings().preampDb).toBe(-6);
        const gainCall = (stage.preamp.gain.setTargetAtTime as ReturnType<typeof vi.fn>).mock.calls.at(-1);
        expect(gainCall?.[0]).toBeCloseTo(10 ** (-6 / 20), 5);
        const ratioCall = (stage.limiter.ratio.setTargetAtTime as ReturnType<typeof vi.fn>).mock.calls.at(-1);
        expect(ratioCall?.[0]).toBe(1);
        stage.dispose();
        const before = (stage.preamp.gain.setTargetAtTime as ReturnType<typeof vi.fn>).mock.calls.length;
        setOutputStageSettings({ preampDb: -2 });
        expect((stage.preamp.gain.setTargetAtTime as ReturnType<typeof vi.fn>).mock.calls.length).toBe(before);
        setOutputStageSettings({ preampDb: 0, limiterEnabled: true });
    });
});
