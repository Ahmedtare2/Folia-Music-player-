import React from 'react';
import { Group, type SettingsGroupDef } from '../../modal/settings/kit';
import type { VisualizerSettingsPanelProps } from '../definition';
import { SliderRow, ToggleRow } from '../panelRows';
import { DEFAULT_FILMGATE_TUNING, type FilmgateTuning } from './types';

// src/components/visualizer/filmgate/FilmgateSettingsPanel.tsx
// FILMGATE's options: the film look, the lyric light and the frame. Sliders follow the VisPlayground draft / commit-on-release rule.

type AmountKey = Exclude<keyof FilmgateTuning, 'frame'>;

const FILM_GROUP: SettingsGroupDef = { id: 'vis-filmgate-film', titleKey: 'options.filmgateFilmSection' };
const LYRICS_GROUP: SettingsGroupDef = { id: 'vis-filmgate-lyrics', titleKey: 'options.filmgateLyricsSection' };

const FILM_CONTROLS: Array<{ key: AmountKey; labelKey: string; noteKey: string }> = [
    { key: 'grain', labelKey: 'options.filmgateGrain', noteKey: 'options.filmgateGrainHint' },
    { key: 'lightLeaks', labelKey: 'options.filmgateLightLeaks', noteKey: 'options.filmgateLightLeaksHint' },
    { key: 'gateMotion', labelKey: 'options.filmgateGateMotion', noteKey: 'options.filmgateGateMotionHint' },
    { key: 'impact', labelKey: 'options.filmgateImpact', noteKey: 'options.filmgateImpactHint' },
];

const formatAmount = (value: number) => value.toFixed(2);

const FilmgateSettingsPanel: React.FC<VisualizerSettingsPanelProps<FilmgateTuning>> = ({
    t,
    tuning = DEFAULT_FILMGATE_TUNING,
    onTuningChange,
    onSliderPointerDown,
    onSliderCommit,
}) => {
    const slider = (key: AmountKey, labelKey: string, noteKey: string) => (
        <SliderRow
            key={key}
            label={t(labelKey)}
            note={t(noteKey)}
            value={tuning[key]}
            min={0}
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
            <Group def={FILM_GROUP}>
                {FILM_CONTROLS.map(control => slider(control.key, control.labelKey, control.noteKey))}
                <ToggleRow
                    label={t('options.filmgateFrame')}
                    note={t('options.filmgateFrameHint')}
                    checked={tuning.frame}
                    onChange={frame => onTuningChange?.({ frame })}
                />
            </Group>
            <Group def={LYRICS_GROUP}>
                {slider('illumination', 'options.filmgateIllumination', 'options.filmgateIlluminationHint')}
            </Group>
        </>
    );
};

export default FilmgateSettingsPanel;
