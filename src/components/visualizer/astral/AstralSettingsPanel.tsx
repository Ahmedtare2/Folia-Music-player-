import React from 'react';
import { Group, type SettingsGroupDef } from '../../modal/settings/kit';
import type { VisualizerSettingsPanelProps } from '../definition';
import { SliderRow } from '../panelRows';
import { ASTRAL_QUALITY_LEVELS, DEFAULT_ASTRAL_TUNING, type AstralTuning } from './types';

// src/components/visualizer/astral/AstralSettingsPanel.tsx
// ASTRAL's options: camera, hall, music reaction, lyric light and quality. Sliders follow the VisPlayground draft / commit-on-release rule.

type AmountKey = Exclude<keyof AstralTuning, 'quality'>;

const CAMERA_GROUP: SettingsGroupDef = { id: 'vis-astral-camera', titleKey: 'options.astralCameraSection' };
const HALL_GROUP: SettingsGroupDef = { id: 'vis-astral-hall', titleKey: 'options.astralHallSection' };
const LYRICS_GROUP: SettingsGroupDef = { id: 'vis-astral-lyrics', titleKey: 'options.astralLyricsSection' };

const CAMERA_CONTROLS: Array<{ key: AmountKey; labelKey: string; noteKey: string; min: number }> = [
    { key: 'cameraMotion', labelKey: 'options.astralCameraMotion', noteKey: 'options.astralCameraMotionHint', min: 0 },
    { key: 'cameraSpeed', labelKey: 'options.astralCameraSpeed', noteKey: 'options.astralCameraSpeedHint', min: 0.25 },
];
const HALL_CONTROLS: Array<{ key: AmountKey; labelKey: string; noteKey: string; min: number }> = [
    { key: 'orbitalActivity', labelKey: 'options.astralOrbitalActivity', noteKey: 'options.astralOrbitalActivityHint', min: 0 },
    { key: 'atmosphere', labelKey: 'options.astralAtmosphere', noteKey: 'options.astralAtmosphereHint', min: 0 },
    { key: 'audioReactivity', labelKey: 'options.astralAudioReactivity', noteKey: 'options.astralAudioReactivityHint', min: 0 },
];

const formatAmount = (value: number) => value.toFixed(2);

const AstralSettingsPanel: React.FC<VisualizerSettingsPanelProps<AstralTuning>> = ({
    t,
    tuning = DEFAULT_ASTRAL_TUNING,
    onTuningChange,
    onSliderPointerDown,
    onSliderCommit,
}) => {
    const slider = (key: AmountKey, labelKey: string, noteKey: string, min: number) => (
        <SliderRow
            key={key}
            label={t(labelKey)}
            note={t(noteKey)}
            value={tuning[key]}
            min={min}
            max={2}
            step={0.05}
            format={formatAmount}
            onChange={value => onTuningChange?.({ [key]: value })}
            onDragStart={onSliderPointerDown}
            onDragEnd={onSliderCommit}
        />
    );
    return (
        <>
            <Group def={CAMERA_GROUP}>
                {CAMERA_CONTROLS.map(c => slider(c.key, c.labelKey, c.noteKey, c.min))}
            </Group>
            <Group def={HALL_GROUP}>
                {HALL_CONTROLS.map(c => slider(c.key, c.labelKey, c.noteKey, c.min))}
                <SliderRow
                    label={t('options.astralQuality')}
                    note={t('options.astralQualityHint')}
                    value={ASTRAL_QUALITY_LEVELS.indexOf(tuning.quality)}
                    min={0}
                    max={2}
                    step={1}
                    format={value => t(`options.astralQuality_${ASTRAL_QUALITY_LEVELS[Math.round(value)] ?? 'balanced'}`)}
                    onChange={value => onTuningChange?.({ quality: ASTRAL_QUALITY_LEVELS[Math.round(value)] ?? 'balanced' })}
                    onDragStart={onSliderPointerDown}
                    onDragEnd={onSliderCommit}
                />
            </Group>
            <Group def={LYRICS_GROUP}>
                {slider('lyricIllumination', 'options.astralLyricIllumination', 'options.astralLyricIlluminationHint', 0)}
            </Group>
        </>
    );
};

export default AstralSettingsPanel;
