import { connectAudioEqualizerGraph } from './audioEqualizerGraph';
import { createAudioEffectChain, type AudioEffectChain } from './audioEffects/effectChain';
import type { AudioEqualizerSettings } from '../utils/audioEqualizer';

// src/services/playbackGraph.ts
// The order the playback nodes are wired in, as one function so the order can be asserted.
//
// Supports full DSP bypass (`setDspBypass(true)` / `bypassDsp: true`) when Chorus, EQ, Automix,
// and Stem Separation are turned off so `mixNode` routes directly to `gainNode` without running
// the 10-band biquad EQ cascade or the 4x-oversampled WaveShaper / Compressor / Convolver / LFO
// effect chain on every audio quantum.

type BuildPlaybackGraphParams = {
    context: AudioContext;
    /** Where the mix lands. Everything downstream of here is per-listener, not per-track. */
    analyser: AnalyserNode;
    /** Wires both automix decks into the shared mix point. Returns false if a deck is missing. */
    connectDecks: (context: AudioContext, output: AudioNode) => boolean;
    equalizerNodesRef: { current: BiquadFilterNode[] };
    settings: AudioEqualizerSettings;
    /** When true, bypasses the 10-band EQ and AudioEffectChain nodes so mixNode feeds gainNode directly. */
    bypassDsp?: boolean;
};

export type PlaybackGraph = {
    /** Playback volume. Ramped by syncOutputGain; nothing else may write it. */
    gainNode: GainNode;
    /**
     * Play/pause fade, unity at rest. Its own node because the volume node is rewritten by
     * syncOutputGain on every volume, mute and track start, and the deck gains belong to automix.
     * Owned by services/playbackFade; nothing else may write it.
     */
    fadeNode: GainNode;
    effectChain: AudioEffectChain;
    /** False when a deck was missing, so automix will stay idle. Audio still flows. */
    decksConnected: boolean;
    /** Switches between direct hardware/mix passthrough (`mixNode -> gainNode`) and full EQ+Effects DSP. */
    setDspBypass: (bypassed: boolean) => void;
    /** True when the 10-band EQ and AudioEffectChain DSP nodes are currently bypassed. */
    isDspBypassed: () => boolean;
};

export const buildPlaybackGraph = ({
    context,
    analyser,
    connectDecks,
    equalizerNodesRef,
    settings,
    bypassDsp = false,
}: BuildPlaybackGraphParams): PlaybackGraph => {
    // The shared mix point. Both decks land here, so the equaliser and the analyser each exist
    // once and see the sum: the tone never steps mid-blend and the visualiser draws what is
    // actually being heard.
    const mixNode = context.createGain();
    const decksConnected = connectDecks(context, mixNode);

    // Keeps a stable seam between the equalizer bands and the effect chain.
    const equalizerOutput = context.createGain();
    connectAudioEqualizerGraph({
        context,
        input: mixNode,
        output: equalizerOutput,
        nodesRef: equalizerNodesRef,
        settings,
    });

    /**
     * Volume, and it sits AFTER the effects rather than at the mix point where it started.
     */
    const gainNode = context.createGain();
    const effectChain = createAudioEffectChain({
        context,
        input: equalizerOutput,
        output: gainNode,
        effects: settings.effects,
        enabled: settings.enabled,
    });

    // After the volume so the fade multiplies whatever level the listener chose, and before the
    // analyser so the visualiser fades with the sound.
    const fadeNode = context.createGain();
    gainNode.connect(fadeNode);

    // The analyser stays last, so the visualiser draws what is actually being heard - including
    // the volume the listener set.
    fadeNode.connect(analyser);
    analyser.connect(context.destination);

    let dspBypassed = false;
    const setDspBypass = (nextBypassed: boolean) => {
        if (dspBypassed === nextBypassed) return;
        dspBypassed = nextBypassed;
        const eqHead = equalizerNodesRef.current[0];
        const eqTail = equalizerNodesRef.current[equalizerNodesRef.current.length - 1];
        if (dspBypassed) {
            if (eqHead) {
                try { mixNode.disconnect(eqHead); } catch { /* ignore */ }
            }
            if (eqTail) {
                try { eqTail.disconnect(equalizerOutput); } catch { /* ignore */ }
            }
            effectChain.setBypassed(true);
            mixNode.connect(gainNode);
        } else {
            try { mixNode.disconnect(gainNode); } catch { /* ignore */ }
            if (eqHead) {
                mixNode.connect(eqHead);
            }
            if (eqTail) {
                eqTail.connect(equalizerOutput);
            }
            effectChain.setBypassed(false);
        }
    };

    if (bypassDsp) {
        setDspBypass(true);
    }

    console.log(
        '[AudioContext] graph: decks -> mix -> equaliser -> effects -> volume -> fade -> analyser -> out'
        + ` (equaliser ${settings.enabled ? 'on' : 'flat'}, dspBypass ${dspBypassed ? 'on' : 'off'},`
        + ` noise ${settings.effects.noise}, crush ${settings.effects.crush}, punch ${settings.effects.punch})`,
    );

    return {
        gainNode,
        fadeNode,
        effectChain,
        decksConnected,
        setDspBypass,
        isDspBypassed: () => dspBypassed,
    };
};
