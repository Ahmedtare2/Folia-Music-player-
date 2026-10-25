// src/services/audioEffects/effectNodes.ts
// Creates and wires the always-on part of the effect chain; every stage stays neutral until settings ask for it.
//
// Poweramp-style clean bass & post-EQ protection:
// 1. Sub-sonic high-pass filter (2nd-order Butterworth, Q = 0.7071 at 22 Hz):
//    Strips inaudible DC offset and < 22 Hz sub-sonic rumble before saturation/dynamics so ultra-low
//    excursion does not waste headroom or modulate the waveshaper/limiter.
// 2. Post-EQ Soft-Knee Brickwall Limiter (DynamicsCompressorNode):
//    Even when Dynamic Punch is at 0%, the compressor acts as a transparent safety limiter
//    (threshold = -0.8 dBFS, knee = 3.0 dB, ratio = 16:1, attack = 2 ms, release = 80 ms)
//    so heavy sub-bass transients never digitally clip past 0 dBFS.

export const SUBSONIC_BUTTERWORTH_Q = Math.SQRT1_2; // 0.70710678...
export const SUBSONIC_CUTOFF_HZ = 22;

export type AudioEffectNodes = {
    highpass: BiquadFilterNode;
    lowpass: BiquadFilterNode;
    drive: WaveShaperNode;
    crush: WaveShaperNode;
    wowDelay: DelayNode;
    stereoInput: GainNode;
    splitter: ChannelSplitterNode;
    merger: ChannelMergerNode;
    leftDirect: GainNode;
    rightDirect: GainNode;
    leftCross: GainNode;
    rightCross: GainNode;
    compressor: DynamicsCompressorNode;
    makeup: GainNode;
    dry: GainNode;
    wetSend: GainNode;
    wet: GainNode;
    noiseGain: GainNode;
};

export const WOW_BASE_DELAY_SECONDS = 0.012;

// Allocates every persistent node with neutral defaults + sub-sonic rumble protection + transparent safety limiter.
export const createAudioEffectNodes = (context: AudioContext): AudioEffectNodes => {
    const highpass = context.createBiquadFilter();
    highpass.type = 'highpass';
    // 2nd-order Butterworth Q (0.7071) at 22 Hz removes DC offset and inaudible sub-sonic rumble
    // with maximally flat passband and zero resonant bump at the cutoff frequency.
    highpass.Q.value = SUBSONIC_BUTTERWORTH_Q;
    highpass.frequency.value = SUBSONIC_CUTOFF_HZ;

    const lowpass = context.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.Q.value = SUBSONIC_BUTTERWORTH_Q;
    lowpass.frequency.value = Math.min(20000, context.sampleRate * 0.475);

    const drive = context.createWaveShaper();
    // Harmonics from soft clipping reach past Nyquist, and aliased ones are what make waveshaping
    // sound harsh rather than warm, so this stage runs at the highest oversampling available.
    drive.oversample = '4x';

    const crush = context.createWaveShaper();

    const wowDelay = context.createDelay(0.2);
    wowDelay.delayTime.value = 0;

    // Forces a stereo frame so mono sources still feed both mid/side legs.
    const stereoInput = context.createGain();
    stereoInput.channelCount = 2;
    stereoInput.channelCountMode = 'explicit';
    stereoInput.channelInterpretation = 'speakers';

    // Default Post-EQ Soft-Knee Brickwall Limiter configuration:
    // Catches peaks above -0.8 dBFS with fast 2ms attack and smooth 80ms release at 16:1 ratio.
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -0.8;
    compressor.knee.value = 3;
    compressor.ratio.value = 16;
    compressor.attack.value = 0.002;
    compressor.release.value = 0.08;

    const createGain = (value: number) => {
        const node = context.createGain();
        node.gain.value = value;
        return node;
    };

    return {
        highpass,
        lowpass,
        drive,
        crush,
        wowDelay,
        stereoInput,
        splitter: context.createChannelSplitter(2),
        merger: context.createChannelMerger(2),
        leftDirect: createGain(1),
        rightDirect: createGain(1),
        leftCross: createGain(0),
        rightCross: createGain(0),
        compressor,
        makeup: createGain(1),
        dry: createGain(1),
        wetSend: createGain(1),
        wet: createGain(0),
        noiseGain: createGain(0),
    };
};

// Connects the serial path plus the parallel reverb and noise returns.
export const connectAudioEffectNodes = (nodes: AudioEffectNodes, input: AudioNode, output: AudioNode) => {
    input.connect(nodes.highpass);
    nodes.highpass.connect(nodes.lowpass);
    nodes.lowpass.connect(nodes.drive);
    nodes.drive.connect(nodes.crush);
    nodes.crush.connect(nodes.wowDelay);
    nodes.wowDelay.connect(nodes.stereoInput);
    nodes.stereoInput.connect(nodes.splitter);

    nodes.splitter.connect(nodes.leftDirect, 0, 0);
    nodes.splitter.connect(nodes.rightCross, 1, 0);
    nodes.splitter.connect(nodes.leftCross, 0, 0);
    nodes.splitter.connect(nodes.rightDirect, 1, 0);
    nodes.leftDirect.connect(nodes.merger, 0, 0);
    nodes.rightCross.connect(nodes.merger, 0, 0);
    nodes.leftCross.connect(nodes.merger, 0, 1);
    nodes.rightDirect.connect(nodes.merger, 0, 1);

    nodes.merger.connect(nodes.compressor);
    nodes.compressor.connect(nodes.makeup);
    nodes.makeup.connect(nodes.dry);
    nodes.makeup.connect(nodes.wetSend);
    nodes.dry.connect(output);
    nodes.wet.connect(output);
    nodes.noiseGain.connect(output);
};

export const disconnectAudioEffectNodes = (nodes: AudioEffectNodes, input: AudioNode) => {
    try {
        input.disconnect(nodes.highpass);
    } catch {
        // The source may already be torn down with the audio context.
    }
    Object.values(nodes).forEach(node => node.disconnect());
};
