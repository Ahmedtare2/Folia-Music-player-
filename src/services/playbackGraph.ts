import {
    applyEqualizerPreampHeadroom,
    connectAudioEqualizerGraph,
} from './audioEqualizerGraph';
import { createAudioEffectChain, type AudioEffectChain } from './audioEffects/effectChain';
import type { AudioEqualizerSettings } from '../utils/audioEqualizer';
import type { MutableRefObject } from 'react';

// src/services/playbackGraph.ts
// Connects everything downstream of the automix mix point.
//
// Signal order:
//   decks -> mixNode -> [10-band EQ -> equalizerOutput (Preamp Headroom) -> effectChain] -> gainNode (volume) -> fadeNode (transport) -> analyser -> destination
//   (When DSP bypass is active — i.e., Chorus/Effects, EQ, Automix, and Stem Separation are all off —
//    mixNode routes directly into gainNode so zero WebAudio biquad/waveshaper/compressor CPU is spent.)
//
// The volume fader sits AFTER the effect chain, not before it. Three of the effects are absolute:
//   - Vinyl noise is an independent buffer source mixed in at the effect chain's output. If the
//     fader were upstream of the chain it would attenuate the music and leave the crackle untouched,
//     so turning the volume down would raise the noise floor relative to the song; at volume 0 you
//     would still hear crackle.
//   - Bit crush quantizes amplitude into 2^bits steps across [-1, 1]. A quieter input simply uses
//     fewer of those steps - halving the volume is equivalent to losing one more bit of resolution.
//   - Punch is a compressor with a fixed threshold in dBFS. Pulling the input down moves the signal
//     below the threshold instead of making the compressed signal quieter.
// Putting the fader after the chain means every effect sees the normalized deck signal (with
// automatic preamp headroom compensation applied on `equalizerOutput`), and the fader scales the
// finished mix (music, reverb tail and vinyl noise together) on its way to the speakers.
// The analyser stays after the fader so the visualiser reflects what is actually heard.

export type PlaybackGraph = {
    gainNode: GainNode;
    fadeNode: GainNode;
    preampNode: GainNode;
    effectChain: AudioEffectChain;
    decksConnected: boolean;
    /** Dynamically switches between direct hardware/zero-DSP bypass and the full EQ/Effects chain. */
    setDspBypass: (bypass: boolean) => void;
    isDspBypassed: () => boolean;
};

export const buildPlaybackGraph = ({
    context,
    analyser,
    connectDecks,
    equalizerNodesRef,
    settings,
    bypassDsp = false,
}: {
    context: AudioContext;
    analyser: AnalyserNode;
    connectDecks: (context: AudioContext, output: AudioNode) => boolean;
    equalizerNodesRef: MutableRefObject<BiquadFilterNode[]>;
    settings: AudioEqualizerSettings;
    bypassDsp?: boolean;
}): PlaybackGraph => {
    const mixNode = context.createGain();
    mixNode.gain.value = 1;

    // `equalizerOutput` acts as the dedicated Preamp Headroom stage between the 10-band EQ
    // cascade and the post-EQ effect/limiter chain, automatically attenuating positive EQ/Bass
    // boosts so heavy sub-bass transients never clip the waveshaper or output stage.
    const equalizerOutput = context.createGain();
    equalizerOutput.gain.value = 1;
    applyEqualizerPreampHeadroom(context, equalizerOutput, settings);

    connectAudioEqualizerGraph({
        context,
        input: mixNode,
        output: equalizerOutput,
        nodesRef: equalizerNodesRef,
        settings,
    });

    const gainNode = context.createGain();
    gainNode.gain.value = 1;

    // Separate from gainNode so pause/resume fades never race with volume slider or track-start
    // gain writes, which all target gainNode directly.
    const fadeNode = context.createGain();
    fadeNode.gain.value = 1;

    const effectChain = createAudioEffectChain({
        context,
        input: equalizerOutput,
        output: gainNode,
        effects: settings.effects,
        enabled: settings.enabled && !bypassDsp,
    });

    let dspBypassed = false;
    const firstEqNode = () => equalizerNodesRef.current[0] ?? null;

    const setDspBypass = (shouldBypass: boolean) => {
        const eqEntry = firstEqNode();
        if (!eqEntry) {
            return;
        }
        if (shouldBypass && !dspBypassed) {
            try {
                mixNode.disconnect(eqEntry);
            } catch {
                // Ignore if already disconnected
            }
            effectChain.apply(settings.effects, false);
            mixNode.connect(gainNode);
            dspBypassed = true;
        } else if (!shouldBypass && dspBypassed) {
            try {
                mixNode.disconnect(gainNode);
            } catch {
                // Ignore if already disconnected
            }
            mixNode.connect(eqEntry);
            applyEqualizerPreampHeadroom(context, equalizerOutput, settings);
            effectChain.apply(settings.effects, settings.enabled);
            dspBypassed = false;
        }
    };

    if (bypassDsp) {
        setDspBypass(true);
    }

    gainNode.connect(fadeNode);
    fadeNode.connect(analyser);
    analyser.connect(context.destination);

    const decksConnected = connectDecks(context, mixNode);

    return {
        gainNode,
        fadeNode,
        preampNode: equalizerOutput,
        effectChain,
        decksConnected,
        setDspBypass,
        isDspBypassed: () => dspBypassed,
    };
};
