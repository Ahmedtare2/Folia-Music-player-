import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    AUDIO_EQUALIZER_CUSTOM_SLOT_IDS,
    getAudioEqualizerCustomSlotIndex,
    isAudioEqualizerCustomSlotId,
    isAudioEqualizerFlat,
    resetAudioEqualizerToFlat,
    type AudioEqualizerCustomSlotId,
    type AudioEqualizerModeId,
    type AudioEqualizerSettings,
} from '../../utils/audioEqualizer';
import { AUDIO_SOUND_PRESETS, AUDIO_SOUND_PRESET_IDS } from '../../utils/audioPresets';
import { type AudioEffectId, type AudioEffectSettings } from '../../utils/audioEffects';
import {
    getAudioEqualizerRuntimeStatus,
    subscribeAudioEqualizerRuntime,
} from '../../services/audioEqualizerGraph';
import Sheet from '../shared/Sheet';
import { Toggle } from '../modal/settings/kit';
import AudioEffectGrid from './equalizer/AudioEffectGrid';
import EqualizerBandGrid from './equalizer/EqualizerBandGrid';
import PresetChips from './equalizer/PresetChips';
import { useAudioSettingsStore } from '../../stores/useAudioSettingsStore';

// src/components/panelTab/AudioEqualizerDialog.tsx
// The audio effect window opened from the controls tab or settings, on the app's sheet: the
// processing switch in the header, then the presets, the ten EQ bands and the effect chain.

type AudioEqualizerDialogProps = {
    isDaylight: boolean;
};

const PRESET_IDS: AudioEqualizerModeId[] = [...AUDIO_SOUND_PRESET_IDS, ...AUDIO_EQUALIZER_CUSTOM_SLOT_IDS];

const AudioEqualizerDialog: React.FC<AudioEqualizerDialogProps> = ({ isDaylight }) => {
    const { t } = useTranslation();
    const settings = useAudioSettingsStore(state => state.audioEqualizerSettings);
    const isOpen = useAudioSettingsStore(state => state.isAudioEqualizerOpen);
    const close = useAudioSettingsStore(state => state.closeAudioEqualizer);
    const commitSettings = useAudioSettingsStore(state => state.handleSetAudioEqualizerSettings);
    const [draft, setDraft] = useState<AudioEqualizerSettings>(settings);
    const draftRef = useRef(draft);
    const [runtimeStatus, setRuntimeStatus] = useState(() => getAudioEqualizerRuntimeStatus());

    const updateDraft = (next: AudioEqualizerSettings) => {
        draftRef.current = next;
        setDraft(next);
    };

    useEffect(() => {
        if (!isOpen) return undefined;
        setRuntimeStatus(getAudioEqualizerRuntimeStatus());
        return subscribeAudioEqualizerRuntime(() => {
            setRuntimeStatus(getAudioEqualizerRuntimeStatus());
        });
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            updateDraft({
                enabled: settings.enabled,
                gains: [...settings.gains],
                preset: settings.preset,
                effects: { ...settings.effects },
                customSlots: settings.customSlots.map(slot => ({ gains: [...slot.gains], effects: { ...slot.effects } })),
            });
        }
    }, [isOpen, settings]);

    // Edits are always written into a custom slot: the active one, or the first while a built-in plays.
    // Also commits immediately so the live Web Audio BiquadFilterNode chain updates in real time.
    const writeCustomDraft = (gains: number[], effects: AudioEffectSettings) => {
        const slotId: AudioEqualizerCustomSlotId = isAudioEqualizerCustomSlotId(draftRef.current.preset)
            ? draftRef.current.preset
            : AUDIO_EQUALIZER_CUSTOM_SLOT_IDS[0];
        const slotIndex = getAudioEqualizerCustomSlotIndex(slotId);
        const next: AudioEqualizerSettings = {
            ...draftRef.current,
            enabled: true,
            gains,
            effects,
            preset: slotId,
            customSlots: draftRef.current.customSlots.map((slot, index) => (
                index === slotIndex ? { gains: [...gains], effects: { ...effects } } : slot
            )),
        };
        updateDraft(next);
        commitSettings(next);
    };

    const updateBandDraft = (index: number, value: number) => {
        const gains = [...draftRef.current.gains];
        gains[index] = value;
        writeCustomDraft(gains, { ...draftRef.current.effects });
    };

    const updateEffectDraft = (id: AudioEffectId, value: number) => {
        writeCustomDraft([...draftRef.current.gains], { ...draftRef.current.effects, [id]: value });
    };

    const applyPreset = (presetId: AudioEqualizerModeId) => {
        const source = isAudioEqualizerCustomSlotId(presetId)
            ? draftRef.current.customSlots[getAudioEqualizerCustomSlotIndex(presetId)]
            : AUDIO_SOUND_PRESETS[presetId];
        const next: AudioEqualizerSettings = {
            ...draftRef.current,
            enabled: true,
            preset: presetId,
            gains: [...source.gains],
            effects: { ...source.effects },
        };
        updateDraft(next);
        commitSettings(next);
    };

    // Reset clears the active custom slot or resets any active preset back to Flat (0 dB across all 10 bands).
    const resetActiveCustomSlot = () => {
        const next = resetAudioEqualizerToFlat(draftRef.current);
        updateDraft(next);
        commitSettings(next);
    };

    // The switch stops the processing and keeps every value.
    const setEnabled = (enabled: boolean) => {
        const next = { ...draftRef.current, enabled };
        updateDraft(next);
        commitSettings(next);
    };

    const commitDraft = () => commitSettings(draftRef.current);

    const statusLine = !runtimeStatus.supported
        ? (runtimeStatus.reason || 'Audio effects are unsupported in this environment.')
        : runtimeStatus.connected
            ? `10-Band Web Audio Biquad DSP Active${runtimeStatus.sampleRate ? ` · ${Math.round(runtimeStatus.sampleRate / 100) / 10} kHz` : ''}`
            : '10-Band Web Audio Biquad DSP Ready (engages automatically on playback)';

    return (
        <Sheet
            isOpen={isOpen}
            onClose={close}
            isDaylight={isDaylight}
            size="l"
            title={t('ui.equalizerTitle')}
            subtitle={t('ui.equalizerDescription')}
            footerNote={statusLine}
            headerActions={(
                <label className="flex cursor-pointer items-center gap-3">
                    <span className="whitespace-nowrap text-xs text-[color:var(--st-t2)] max-sm:sr-only">
                        {t(draft.enabled ? 'ui.equalizerEnabled' : 'ui.equalizerDisabled')}
                    </span>
                    <Toggle checked={draft.enabled} onChange={setEnabled} />
                </label>
            )}
        >
            <div data-ponder="audio-equalizer" className="flex min-h-full flex-col">
                <PresetChips
                    presetIds={PRESET_IDS}
                    chosen={draft.preset}
                    onChoose={applyPreset}
                    canReset={!isAudioEqualizerFlat(draft) || isAudioEqualizerCustomSlotId(draft.preset)}
                    onReset={resetActiveCustomSlot}
                />
                <div className={`st-t-move flex flex-1 flex-col transition-opacity${draft.enabled ? '' : ' opacity-40'}`}>
                    <EqualizerBandGrid gains={draft.gains} onBandChange={updateBandDraft} onCommit={commitDraft} />
                    <AudioEffectGrid effects={draft.effects} onEffectChange={updateEffectDraft} onCommit={commitDraft} />
                </div>
            </div>
        </Sheet>
    );
};

export default AudioEqualizerDialog;
