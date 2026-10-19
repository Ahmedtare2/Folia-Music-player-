import { useEffect, useState } from 'react';

// src/hooks/useDocumentVisibility.ts
// Tracks both standard DOM Page Visibility (`document.visibilityState`) and the native Android
// Activity lifecycle event (`folia:native-visibility`) dispatched by MainActivity.java.
// Because MainActivity keeps WebView timers alive during screen-locked background playback so
// HTMLAudioElement / Web Audio do not stall, `folia:native-visibility` ensures visualizers
// pause their 60fps WebGL/Canvas rendering loops while the phone screen is off.

export interface AppVisibilityState {
    isDocumentVisible: boolean;
    isActivityVisible: boolean;
    isForegroundVisible: boolean;
}

export const NATIVE_VISIBILITY_EVENT = 'folia:native-visibility';

export function useDocumentVisibility(): AppVisibilityState {
    const [isDocumentVisible, setIsDocumentVisible] = useState<boolean>(() => (
        typeof document === 'undefined' ? true : document.visibilityState !== 'hidden'
    ));
    const [isActivityVisible, setIsActivityVisible] = useState<boolean>(true);

    useEffect(() => {
        if (typeof document === 'undefined' || typeof window === 'undefined') {
            return undefined;
        }

        const handleVisibilityChange = () => {
            setIsDocumentVisible(document.visibilityState !== 'hidden');
        };

        const handleNativeVisibility = (event: Event) => {
            const custom = event as CustomEvent<{ visible?: boolean }>;
            if (typeof custom.detail?.visible === 'boolean') {
                setIsActivityVisible(custom.detail.visible);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener(NATIVE_VISIBILITY_EVENT, handleNativeVisibility);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener(NATIVE_VISIBILITY_EVENT, handleNativeVisibility);
        };
    }, []);

    return {
        isDocumentVisible,
        isActivityVisible,
        isForegroundVisible: isDocumentVisible && isActivityVisible,
    };
}
