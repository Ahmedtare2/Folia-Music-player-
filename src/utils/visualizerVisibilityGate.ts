// src/utils/visualizerVisibilityGate.ts
// Lightweight, zero-React-render visibility gate for pausing all 60/120fps requestAnimationFrame
// loops, WebGL shaders, and lyric animations immediately when the browser tab is hidden
// (`document.visibilityState === 'hidden'`) or when Android's MainActivity pauses/stops
// (`folia:native-visibility` with `{ visible: false }`, e.g. when the phone screen is turned off),
// and resuming seamlessly on wake.

export const NATIVE_VISIBILITY_EVENT_NAME = 'folia:native-visibility';

type VisibilityWindow = Window & {
    __FOLIA_NATIVE_VISIBLE__?: boolean;
};

let nativeActivityVisible = true;
let listenersInstalled = false;
const visibilityListeners = new Set<(visible: boolean) => void>();

const readDocumentVisible = (): boolean => {
    if (typeof document === 'undefined' || typeof document.visibilityState !== 'string') return true;
    return document.visibilityState !== 'hidden';
};

const readNativeVisible = (): boolean => {
    if (typeof window !== 'undefined') {
        const win = window as VisibilityWindow;
        if (typeof win.__FOLIA_NATIVE_VISIBLE__ === 'boolean') {
            return win.__FOLIA_NATIVE_VISIBLE__;
        }
    }
    return nativeActivityVisible;
};

export const isAppForegroundVisible = (): boolean => (
    readDocumentVisible() && readNativeVisible()
);

const notifyVisibilityListeners = () => {
    const visible = isAppForegroundVisible();
    visibilityListeners.forEach(listener => {
        try {
            listener(visible);
        } catch {
            // Ignore listener errors.
        }
    });
};

const ensureVisibilityListeners = () => {
    if (listenersInstalled || typeof window === 'undefined') {
        return;
    }
    listenersInstalled = true;

    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('visibilitychange', () => {
            notifyVisibilityListeners();
        });
    }

    if (typeof window.addEventListener === 'function') {
        window.addEventListener(NATIVE_VISIBILITY_EVENT_NAME, (event: Event) => {
            const custom = event as CustomEvent<{ visible?: boolean }>;
            if (typeof custom.detail?.visible === 'boolean') {
                nativeActivityVisible = custom.detail.visible;
                (window as VisibilityWindow).__FOLIA_NATIVE_VISIBLE__ = custom.detail.visible;
                notifyVisibilityListeners();
            }
        });
    }
};

export const subscribeAppForegroundVisibility = (
    listener: (visible: boolean) => void,
): (() => void) => {
    ensureVisibilityListeners();
    visibilityListeners.add(listener);
    return () => {
        visibilityListeners.delete(listener);
    };
};

export const setNativeActivityVisibleForTests = (visible: boolean): void => {
    nativeActivityVisible = visible;
    if (typeof window !== 'undefined') {
        (window as VisibilityWindow).__FOLIA_NATIVE_VISIBLE__ = visible;
    }
    notifyVisibilityListeners();
};
