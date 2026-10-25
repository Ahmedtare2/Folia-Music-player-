import {
    createNeutralAudioEffects,
    normalizeAudioEffects,
    type AudioEffectSettings,
} from '../../utils/audioEffects';
import {
    connectAudioEffectNodes,
    createAudioEffectNodes,
    disconnectAudioEffectNodes,
    SUBSONIC_BUTTERWORTH_Q,
    SUBSONIC_CUTOFF_HZ,
} from './effectNodes';
import { dbToLinear, rampParam } from './effectParams';
import { createBitCrushCurve, createSaturationCurve } from './effectSources';
import { createNoiseBranch } from './noiseBranch';
import { createReverbBranch } from './reverbBranch';
import { createWowBranch } from './wowBranch';

// src/services/audioEffects/effectChain.ts
// Owns the post-EQ effect graph between the equalizer tail and the master gain node.

export type AudioEffectChain = {
    apply: (effects: Partial<AudioEffectSettings> | undefined, enabled: boolean) => void;
    dispose: () => void;
};

type CreateAudioEffectChainParams = {
    context: AudioContext;
    input: AudioNode;
    output: AudioNode;
    effects?: Partial<AudioEffectSettings>;
    enabled?: boolean;
};

export const createAudioEffectChain = ({
    context,
    input,
    output,
    effects,
    enabled = true,
}: CreateAudioEffectChainParams): AudioEffectChain => {
    const nyquist = context.sampleRate * 0.475;
    const nodes = createAudioEffectNodes(context);
    const reverbBranch = createReverbBranch(context, nodes);
    const noiseBranch = createNoiseBranch(context, nodes);
    const wowBranch = createWowBranch(context, nodes);

    connectAudioEffectNodes(nodes, input, output);

    let lastDrive = -1;
    let lastCrush = -1;

    const apply = (nextEffects: Partial<AudioEffectSettings> | undefined, isEnabled: boolean) => {
        const normalized = normalizeAudioEffects(nextEffects);
        const active = isEnabled ? normalized : createNeutralAudioEffects();

        // Always enforce at least a 22 Hz 2nd-order Butterworth sub-sonic high-pass filter
        // when EQ/effects are active so DC offset and inaudible < 22 Hz rumble are removed
        // before hitting the drive or limiter stages.
        const effectiveHighpassHz = isEnabled
            ? Math.max(SUBSONIC_CUTOFF_HZ, active.highpass)
            : active.highpass;
        if (nodes.highpass.Q) {
            nodes.highpass.Q.value = SUBSONIC_BUTTERWORTH_Q;
        }
        rampParam(context, nodes.highpass.frequency, Math.min(nyquist, effectiveHighpassHz));
        rampParam(context, nodes.lowpass.frequency, Math.min(nyquist, active.lowpass));

        if (active.drive !== lastDrive) {
            nodes.drive.curve = createSaturationCurve(active.drive);
            lastDrive = active.drive;
        }

        if (active.crush !== lastCrush) {
            nodes.crush.curve = createBitCrushCurve(active.crush);
            lastCrush = active.crush;
        }

        wowBranch.set(active.wow);

        // Mid/side width matrix: L' = (1+w)/2 * L + (1-w)/2 * R, R' = (1-w)/2 * L + (1+w)/2 * R.
        // At width = 1 the cross terms vanish (identity); at 0 both channels get (L+R)/2 (mono).
        const directGain = (1 + active.width) / 2;
        const crossGain = (1 - active.width) / 2;
        rampParam(context, nodes.leftDirect.gain, directGain);
        rampParam(context, nodes.rightDirect.gain, directGain);
        rampParam(context, nodes.leftCross.gain, crossGain);
        rampParam(context, nodes.rightCross.gain, crossGain);

        // Post-EQ Soft-Knee Limiter & Dynamic Punch stage:
        // - When `punch === 0` (no extra dynamic compression requested), keep the DynamicsCompressorNode
        //   engaged as a transparent brickwall safety limiter:
        //     threshold: -0.8 dBFS, knee: 3 dB, ratio: 16:1, attack: 2 ms, release: 80 ms, makeup: 0 dB (1.0)
        //   so any boosted sub-bass transient is cleanly caught right below 0 dBFS without clipping.
        // - When `punch > 0` (e.g. Bass Boost preset `punch = 0.45`), blend smoothly into a musical
        //   low-distortion punch compressor/limiter with conservative threshold (-0.8 dB down to -11 dB)
        //   and zero positive makeup clipping (makeup stays at 1.0 so peaks never exceed the limiter ceiling).
        if (active.punch > 0.001) {
            rampParam(context, nodes.compressor.threshold, -0.8 - active.punch * 10.2);
            rampParam(context, nodes.compressor.knee, 3 + active.punch * 6);
            rampParam(context, nodes.compressor.ratio, 12 + active.punch * 8);
            rampParam(context, nodes.compressor.attack, 0.002 + active.punch * 0.003);
            rampParam(context, nodes.compressor.release, 0.08 + active.punch * 0.04);
            // Keep makeup unity (1.0) so compressed bass transients never get pushed back above 0 dBFS.
            rampParam(context, nodes.makeup.gain, dbToLinear(0));
        } else {
            rampParam(context, nodes.compressor.threshold, -0.8);
            rampParam(context, nodes.compressor.knee, 3);
            rampParam(context, nodes.compressor.ratio, 16);
            rampParam(context, nodes.compressor.attack, 0.002);
            rampParam(context, nodes.compressor.release, 0.08);
            rampParam(context, nodes.makeup.gain, 1);
        }

        reverbBranch.set(active.space);
        noiseBranch.set(active.noise);
    };

    apply(effects, enabled);

    const dispose = () => {
        noiseBranch.dispose();
        wowBranch.dispose();
        reverbBranch.dispose();
        disconnectAudioEffectNodes(nodes, input);
    };

    return { apply, dispose };
};
