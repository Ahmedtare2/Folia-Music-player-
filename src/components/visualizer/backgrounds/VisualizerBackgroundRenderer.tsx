import React from 'react';
import { DEFAULT_VISUALIZER_BACKGROUND_MODE, getVisualizerBackgroundRegistryEntry } from './registry';
import type { VisualizerBackgroundRenderProps } from './definition';
import { hasAndroidNativeVisualizerBridge } from '../../../services/android/foliaAndroidBridge';
import { isMainAppSurface } from '../../../utils/appSurface';

// src/components/visualizer/backgrounds/VisualizerBackgroundRenderer.tsx
// Selects the active shell background through the discoverable background registry.
// When running on Android Capacitor with FoliaBackgroundSurfaceView, returns null on the main
// app surface so the heavy WebView <canvas>/WebGL background is unmounted and the native OpenGL ES
// mesh surface shines through behind the transparent WebView.

const VisualizerBackgroundRenderer: React.FC<VisualizerBackgroundRenderProps> = (props) => {
    if (props.config?.transparent) {
        return null;
    }
    if (hasAndroidNativeVisualizerBridge() && isMainAppSurface && !props.staticMode) {
        return null;
    }

    const mode = props.config?.mode ?? DEFAULT_VISUALIZER_BACKGROUND_MODE;
    return getVisualizerBackgroundRegistryEntry(mode).render(props);
};

export default VisualizerBackgroundRenderer;
