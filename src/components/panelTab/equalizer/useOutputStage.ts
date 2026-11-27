import { useSyncExternalStore } from 'react';
import {
    getOutputStageSettings,
    setOutputStageSettings,
    subscribeOutputStageSettings,
    type AudioOutputStageSettings,
} from '../../../services/audioOutputStage';

// src/components/panelTab/equalizer/useOutputStage.ts
// Reads the preamp and limiter settings for the equalizer screens and writes them back.
export const useOutputStage = (): [AudioOutputStageSettings, typeof setOutputStageSettings] => {
    const settings = useSyncExternalStore(subscribeOutputStageSettings, getOutputStageSettings, getOutputStageSettings);
    return [settings, setOutputStageSettings];
};
