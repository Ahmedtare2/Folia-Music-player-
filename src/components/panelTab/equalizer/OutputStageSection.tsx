import React, { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import {
    OUTPUT_STAGE_MAX_PREAMP_DB,
    OUTPUT_STAGE_MIN_PREAMP_DB,
} from '../../../services/audioOutputStage';
import PanelSlider from '../controls/PanelSlider';
import EqualizerSection from './EqualizerSection';
import { useOutputStage } from './useOutputStage';
import { hasAndroidNativeExoPlayerBridge } from '../../../services/android/foliaAndroidBridge';
import { getAudioEngine, setAudioEngine, subscribeAudioEngine } from '../../../services/audioEngine';

// src/components/panelTab/equalizer/OutputStageSection.tsx
// The preamp (before the bands) and the limiter (after them) of the audio effect window.

const span = OUTPUT_STAGE_MAX_PREAMP_DB - OUTPUT_STAGE_MIN_PREAMP_DB;
const formatDb = (db: number) => `${db < 0 ? '−' : ''}${Math.abs(db).toFixed(1)} dB`;

const OutputStageSection: React.FC = () => {
    const { t } = useTranslation();
    const [stage, setStage] = useOutputStage();
    const engine = useSyncExternalStore(subscribeAudioEngine, getAudioEngine, getAudioEngine);
    const label = t('ui.equalizerPreamp', { defaultValue: 'Preamp' });
    const valueText = formatDb(stage.preampDb);
    return (
        <EqualizerSection title={t('ui.equalizerOutputStage', { defaultValue: 'Preamp and limiter' })}>
            <div className="flex flex-col gap-2 px-4 pb-3.5 pt-3">
                <div className="flex items-center gap-1.5 text-[13px] leading-5">
                    <span className="truncate">{label}</span>
                    <span className="ml-auto shrink-0 font-mono text-xs text-[color:var(--st-t2)]">{valueText}</span>
                </div>
                <div className="flex">
                    <PanelSlider
                        value={(stage.preampDb - OUTPUT_STAGE_MIN_PREAMP_DB) / span}
                        label={label}
                        valueText={valueText}
                        onPreview={place => setStage({ preampDb: OUTPUT_STAGE_MIN_PREAMP_DB + place * span })}
                        onCommit={() => undefined}
                    />
                </div>
                <label className="flex items-center gap-2 text-[13px] leading-5">
                    <input
                        type="checkbox"
                        checked={stage.limiterEnabled}
                        onChange={event => setStage({ limiterEnabled: event.target.checked })}
                    />
                    <span>{t('ui.equalizerLimiter', { defaultValue: 'Limiter (stops boosts from clipping)' })}</span>
                </label>
                {hasAndroidNativeExoPlayerBridge() && (
                    <label className="flex items-center gap-2 text-[13px] leading-5">
                        <input
                            type="checkbox"
                            checked={engine === 'native'}
                            onChange={event => setAudioEngine(event.target.checked ? 'native' : 'standard')}
                        />
                        <span>Native audio engine (ExoPlayer, applies from the next song; visualizer is not sound-reactive)</span>
                    </label>
                )}
            </div>
        </EqualizerSection>
    );
};

export default OutputStageSection;
