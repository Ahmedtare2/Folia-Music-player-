import { setAndroidNativeEqSettings } from './android/foliaAndroidBridge';
import { computeDeCumulatedBandGainDb } from './mobileEqualizerCompat';
import type { AudioOutputStageSettings } from './audioOutputStage';
import { AUDIO_EQUALIZER_BANDS, type AudioEqualizerSettings } from '../utils/audioEqualizer';

// src/services/nativeEqSync.ts
// Hands the heard equalizer, the preamp and the limiter to the native engine. The band gains are the same
// de-cumulated values the web graph uses, so both engines draw the same curve.

export const buildNativeEqPayload = (
    equalizer: Pick<AudioEqualizerSettings, 'enabled' | 'gains'>,
    stage: AudioOutputStageSettings,
) => ({
    enabled: equalizer.enabled,
    gainsDb: AUDIO_EQUALIZER_BANDS.map((_, index) => computeDeCumulatedBandGainDb(equalizer.gains, index)),
    preampDb: stage.preampDb,
    limiterEnabled: stage.limiterEnabled,
});

export const syncNativeEqSettings = (
    equalizer: Pick<AudioEqualizerSettings, 'enabled' | 'gains'>,
    stage: AudioOutputStageSettings,
) => {
    setAndroidNativeEqSettings(buildNativeEqPayload(equalizer, stage));
};
