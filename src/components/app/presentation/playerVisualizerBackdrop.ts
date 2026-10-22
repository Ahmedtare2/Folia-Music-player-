import { hasAndroidNativeVisualizerBridge } from '../../../services/android/foliaAndroidBridge';
import type { CSSProperties } from 'react';

// src/components/app/presentation/playerVisualizerBackdrop.ts

export const LIBRARY_BACKDROP_BLUR_PX = 24;

export const resolveVisualizerShowText = ({
    currentView,
    isSettingsModalOpen,
    isPanelOpen,
    backdropLyrics,
    isMobileVisualizerActive = false,
}: {
    currentView: string;
    isSettingsModalOpen: boolean;
    isPanelOpen: boolean;
    backdropLyrics: boolean;
    isMobileVisualizerActive?: boolean;
}): boolean => (
    Boolean(isMobileVisualizerActive)
    || (currentView === 'player' && !isSettingsModalOpen)
    || (currentView === 'home' && !isPanelOpen && backdropLyrics)
);

export const resolveVisualizerBackdropBlur = ({
    shouldRevealHomeSurface,
    backdropBlur,
    isMobileVisualizerActive = false,
}: {
    shouldRevealHomeSurface: boolean;
    backdropBlur: boolean;
    isMobileVisualizerActive?: boolean;
}): boolean => shouldRevealHomeSurface && backdropBlur && !isMobileVisualizerActive && !hasAndroidNativeVisualizerBridge();

const BLURRED: CSSProperties = Object.freeze({ filter: `blur(${LIBRARY_BACKDROP_BLUR_PX}px)`, transition: 'filter 300ms ease' });
const SHARP: CSSProperties = Object.freeze({ transition: 'filter 300ms ease' });

export const visualizerBackdropStyle = (blurred: boolean): CSSProperties => (blurred ? BLURRED : SHARP);
