import React from 'react';
import { Frame } from 'lucide-react';
import { QuickControlToggle } from '../../shared/QuickControlChip';
import { defineVisualizer, type VisualizerQuickControlsProps } from '../definition';
import FilmgateSettingsPanel from './FilmgateSettingsPanel';
import filmgateTuning from './tuning';
import type { FilmgateTuning } from './types';

const VisualizerFilmgate = React.lazy(() => import('./VisualizerFilmgate'));

// src/components/visualizer/filmgate/entry.tsx
// Registers FILMGATE, the cinematic 35mm-projection lyric style: warm projector light, film grain and dust, a film gate that
// moves with the bass, and every word lit by a light sweep as it is sung. One canvas, so it also exports as video.
export default defineVisualizer({
    mode: 'filmgate',
    order: 140,
    labelKey: 'ui.visualizerFilmgate',
    labelFallback: 'Filmgate',
    previewSeed: 'filmgate',
    previewStartOffset: 0,
    // Filmgate: a film frame with sprocket holes around a line of lyrics
    glyph: (
        <>
            <rect x="3.5" y="5" width="17" height="14" rx="1.5" opacity="0.5" />
            <path d="M7 12h10" />
            <path d="M3.5 8h1.5M3.5 16h1.5M19 8h1.5M19 16h1.5" opacity="0.5" />
        </>
    ),
    command: {
        title: 'Visualizer: Filmgate',
        description: 'Switch to the cinematic Filmgate visualizer',
        keywords: ['filmgate', 'film', 'cinema', 'cinematic', 'projector', '35mm', '电影', '胶片', '放映'],
    },
    usesWordSegmentation: true,
    render: props => <VisualizerFilmgate {...props} filmgateTuning={filmgateTuning.read(props.visualizerTunings)} />,
    renderSettingsPanel: props => <FilmgateSettingsPanel {...props} />,
    renderQuickControls: ({ tuning, onTuningChange, t }: VisualizerQuickControlsProps<FilmgateTuning>) => (
        <QuickControlToggle
            active={tuning.frame}
            label={t('options.filmgateFrame')}
            onToggle={() => onTuningChange({ frame: !tuning.frame })}
        >
            <Frame size={14} />
        </QuickControlToggle>
    ),
});
