import { describe, expect, it } from 'vitest';
import { describeNativeEqStatus } from '@/components/panelTab/equalizer/useNativeEqStatus';

// test/unit/services/nativeEqStatus.test.ts
// The line in the EQ window that says whether the native EQ is really processing.

const status = {
    configured: true, sampleRate: 44100, channels: 2, format: 'pcm16', frames: 88200,
    settingsSent: 3, settingsApplied: 3, enabled: true, preampDb: -3, limiterReductionDb: 0,
};

describe('describeNativeEqStatus', () => {
    it('says the standard engine is playing when native is not', () => {
        expect(describeNativeEqStatus(null, false).running).toBe(false);
    });
    it('says the native EQ did not answer', () => {
        expect(describeNativeEqStatus(null, true).text).toContain('did not answer');
    });
    it('reports an unsupported format', () => {
        expect(describeNativeEqStatus({ ...status, configured: false, format: 'unsupported:4' }, true).text).toContain('cannot process');
    });
    it('reports format, EQ state and limiter action when processing', () => {
        const idle = describeNativeEqStatus(status, true);
        expect(idle.running).toBe(true);
        expect(idle.text).toContain('44.1 kHz, 2 ch, pcm16');
        expect(idle.text).toContain('EQ on, preamp -3.0 dB');
        expect(idle.text).toContain('limiter idle');
        expect(describeNativeEqStatus({ ...status, limiterReductionDb: 2.5 }, true).text).toContain('limiter cutting 2.5 dB');
    });
});
