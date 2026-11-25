import { describe, expect, it } from 'vitest';
import { motionValue } from 'framer-motion';
import type { AudioBands } from '@/types';
import { createAstralAudioSampler, normalizeAstralValue, smoothToward } from '@/components/visualizer/astral/astralAudio';

const bands = (v: number): AudioBands => ({
    bass: motionValue(v), lowMid: motionValue(v), mid: motionValue(v), vocal: motionValue(v), treble: motionValue(v),
} as unknown as AudioBands);
const settle = (s: ReturnType<typeof createAstralAudioSampler>, seconds = 3) => { for (let i = 0; i < seconds * 60; i += 1) s.sample(1 / 60, false); };

describe('ASTRAL audio', () => {
    it('normalizes live (0..255) and preview (0..1) sources to the same scale', () => {
        const live = createAstralAudioSampler({ audioPower: motionValue(127.5), audioBands: bands(127.5) });
        const preview = createAstralAudioSampler({ audioPower: motionValue(0.5), audioBands: bands(0.5) });
        settle(live); settle(preview);
        expect(live.signals.bass).toBeCloseTo(preview.signals.bass, 2);
        expect(live.signals.power).toBeCloseTo(0.5, 1);
    });

    it('a quiet 0..255 source is not read as a loud 0..1 one', () => {
        const s = createAstralAudioSampler({ audioPower: motionValue(40), audioBands: { ...bands(0.3), bass: motionValue(300) } as AudioBands });
        settle(s);
        expect(s.signals.power).toBeLessThan(0.3);
        expect(normalizeAstralValue(0.3, true)).toBeLessThan(0.01);
        expect(normalizeAstralValue(0.3, false)).toBeCloseTo(0.3);
    });

    it('clamps and survives bad values', () => {
        const s = createAstralAudioSampler({ audioPower: motionValue(Number.NaN), audioBands: bands(9999) });
        settle(s);
        for (const v of Object.values(s.signals)) { expect(Number.isFinite(v)).toBe(true); expect(v).toBeLessThanOrEqual(1); expect(v).toBeGreaterThanOrEqual(0); }
    });

    it('spreads the overall level over the bands when only power is known (video export)', () => {
        const s = createAstralAudioSampler({ audioPower: motionValue(0.8), audioBands: bands(0) });
        settle(s);
        expect(s.signals.bass).toBeGreaterThan(0.4);
        expect(s.signals.treble).toBeGreaterThan(0.2);
    });

    it('keeps the vocal band apart from the bass', () => {
        const s = createAstralAudioSampler({ audioPower: motionValue(0.5), audioBands: { ...bands(0.05), vocal: motionValue(0.9) } as AudioBands });
        settle(s);
        expect(s.signals.vocal).toBeGreaterThan(0.7);
        expect(s.signals.bass).toBeLessThan(0.2);
    });

    it('fires a kick on a sudden bass hit and lets it fall away', () => {
        const bass = motionValue(0.05);
        const s = createAstralAudioSampler({ audioPower: motionValue(0.3), audioBands: { ...bands(0.05), bass } as AudioBands });
        settle(s, 1);
        expect(s.signals.kick).toBeLessThan(0.05);
        bass.set(0.95);
        s.sample(1 / 60, false);
        s.sample(1 / 60, false);
        expect(s.signals.kick).toBeGreaterThan(0.3);
        settle(s, 2);
        expect(s.signals.kick).toBeLessThan(0.1);
    });

    it('decays to silence when paused', () => {
        const s = createAstralAudioSampler({ audioPower: motionValue(0.9), audioBands: bands(0.9) });
        settle(s);
        for (let i = 0; i < 240; i += 1) s.sample(1 / 60, true);
        expect(s.signals.power).toBeLessThan(0.02);
    });

    it('smoothing moves toward the target with separate attack and release', () => {
        // Rising by the attack time constant covers more ground than falling by the (longer) release one.
        expect(smoothToward(0, 1, 0.05, 0.05, 0.5)).toBeGreaterThan(1 - smoothToward(1, 0, 0.05, 0.05, 0.5));
        expect(smoothToward(0, 1, 1, 0.1, 0.1)).toBeGreaterThan(0.99);
        expect(smoothToward(0.5, 0.5, 0.1, 0.1, 0.1)).toBeCloseTo(0.5);
    });
});
