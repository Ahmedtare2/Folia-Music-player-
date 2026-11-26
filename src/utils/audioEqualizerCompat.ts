import { AUDIO_SOUND_PRESETS } from './audioPresets';
import { areAudioEffectsEqual, createNeutralAudioEffects } from './audioEffects';
import {
    getAudioEqualizerCustomSlotIndex,
    isAudioEqualizerCustomSlotId,
    resolveAudioEqualizerSettings,
    type AudioEqualizerCustomSlotId,
    type AudioEqualizerModeId,
    type AudioEqualizerSettings,
} from './audioEqualizer';

// src/utils/audioEqualizerCompat.ts
// Equalizer helpers the phone's equalizer sheet uses (preset names, "is it flat", "reset to flat"). Same behavior as the fork.

const titleCase = (id: string) => id.replace(/([a-z])([A-Z0-9])/g, '$1 $2').replace(/[-_]+/g, ' ').replace(/^./, c => c.toUpperCase());

export const AUDIO_EQUALIZER_PRESET_LABELS: Record<AudioEqualizerModeId, string> = {
    ...(Object.fromEntries(Object.keys(AUDIO_SOUND_PRESETS).map(id => [id, titleCase(id)])) as Record<string, string>),
    custom1: 'Custom 1',
    custom2: 'Custom 2',
} as Record<AudioEqualizerModeId, string>;


export const isAudioEqualizerFlat = (settings: Pick<AudioEqualizerSettings, 'gains' | 'effects' | 'preset'>): boolean => (
    settings.preset === 'flat'
    && settings.gains.every(gain => Math.abs(gain) < 1e-4)
    && areAudioEffectsEqual(settings.effects, createNeutralAudioEffects())
);
export const resetAudioEqualizerToFlat = (current: AudioEqualizerSettings): AudioEqualizerSettings => {
    const flatGains = [...AUDIO_SOUND_PRESETS.flat.gains];
    const neutralEffects = createNeutralAudioEffects();
    const isCustom = isAudioEqualizerCustomSlotId(current.preset);
    const activeSlotIdx = isCustom ? getAudioEqualizerCustomSlotIndex(current.preset as AudioEqualizerCustomSlotId) : -1;
    return resolveAudioEqualizerSettings({
        ...current,
        preset: isCustom ? current.preset : 'flat',
        gains: flatGains,
        effects: neutralEffects,
        customSlots: current.customSlots.map((slot, idx) => (
            idx === activeSlotIdx ? { gains: [...flatGains], effects: { ...neutralEffects } } : slot
        )),
    });
};
