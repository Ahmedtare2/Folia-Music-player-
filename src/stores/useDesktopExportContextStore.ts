import { create } from 'zustand';
import type { Theme } from '../types';

// src/stores/useDesktopExportContextStore.ts
// The theme the visualizer is drawing with right now. App.tsx keeps it here so the desktop video export card (in the
// settings window, far from App's state) can render with the same colors.
type DesktopExportContextState = {
    theme: Theme | null;
    setTheme: (theme: Theme | null) => void;
};

export const useDesktopExportContextStore = create<DesktopExportContextState>(set => ({
    theme: null,
    setTheme: theme => set({ theme }),
}));
