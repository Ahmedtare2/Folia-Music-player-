import React from 'react';
import { DEFAULT_VISUALIZER_BACKGROUND_MODE, getVisualizerBackgroundRegistryEntry } from './registry';
import type { VisualizerBackgroundRenderProps } from './definition';

// src/components/visualizer/backgrounds/VisualizerBackgroundRenderer.tsx
// Selects and renders the active shell background through the discoverable background registry
// (Common Fluid + Geometric, Latent WebGL Mesh + Dithering, Monet, Sora Starfield, Nomand, or URL).

const VisualizerBackgroundRenderer: React.FC<VisualizerBackgroundRenderProps> = (props) => {
    if (props.config?.transparent) {
        return null;
    }

    const mode = props.config?.mode ?? DEFAULT_VISUALIZER_BACKGROUND_MODE;
    return getVisualizerBackgroundRegistryEntry(mode).render(props);
};

export default VisualizerBackgroundRenderer;
