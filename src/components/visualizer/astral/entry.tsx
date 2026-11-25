import React from 'react';
import { defineVisualizer } from '../definition';
import AstralSettingsPanel from './AstralSettingsPanel';
import astralTuning from './tuning';

const VisualizerAstral = React.lazy(() => import('./VisualizerAstral'));

// src/components/visualizer/astral/entry.tsx
// Registers ASTRAL, the cinematic 3D Grand Orrery Hall: a camera that moves through a brass orrery, an orbital passage, a
// celestial gallery and the Astral Gate, with every lyric word lit as it is sung. One WebGL canvas, so it also exports as video.
export default defineVisualizer({
    mode: 'astral',
    order: 150,
    labelKey: 'ui.visualizerAstral',
    labelFallback: 'Astral',
    previewSeed: 'astral',
    previewStartOffset: 0,
    // Astral: an armillary sphere (rings around a star)
    glyph: (
        <>
            <circle cx="12" cy="12" r="1.6" />
            <ellipse cx="12" cy="12" rx="8.5" ry="3.2" opacity="0.6" />
            <ellipse cx="12" cy="12" rx="8.5" ry="3.2" transform="rotate(60 12 12)" opacity="0.6" />
            <ellipse cx="12" cy="12" rx="8.5" ry="3.2" transform="rotate(120 12 12)" opacity="0.6" />
            <circle cx="12" cy="12" r="9" opacity="0.35" />
        </>
    ),
    command: {
        title: 'Visualizer: Astral',
        description: 'Switch to the cinematic 3D Astral orrery visualizer',
        keywords: ['astral', 'orrery', '3d', 'camera', 'cinematic', 'space', 'planets', 'gate', '星', '天文', '浑天仪'],
    },
    render: props => <VisualizerAstral {...props} astralTuning={astralTuning.read(props.visualizerTunings)} />,
    renderSettingsPanel: props => <AstralSettingsPanel {...props} />,
});
