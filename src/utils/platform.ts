// src/utils/platform.ts
// One place to answer "is this a Mac", "is this Windows", "is this Electron", and "is this a
// Capacitor native app", so keyboard handling, shortcut hints, service-worker registration, and
// platform adapters can never disagree about the active host runtime.

interface CapacitorGlobal {
    getPlatform?: () => string;
    isNativePlatform?: () => boolean;
    isPluginAvailable?: (name: string) => boolean;
}

const getCapacitorGlobal = (): CapacitorGlobal | null => {
    const globalCandidate = typeof globalThis !== 'undefined'
        ? (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor
        : undefined;
    const windowCandidate = typeof window !== 'undefined'
        ? (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor
        : undefined;
    const candidate = globalCandidate ?? windowCandidate;
    return candidate && typeof candidate === 'object' ? candidate : null;
};

export const isMacPlatform = typeof navigator !== 'undefined'
    && navigator.userAgent.toLowerCase().includes('mac');

/**
 * Whether this is Windows. Pausing for voice input is for the Windows desktop app only: the
 * settings window asks this before it offers the row, the settings search before it lists it, and
 * the command palette before it offers the command.
 */
export const runsOnWindows = (): boolean => (
    typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('win')
);

/** Whether the renderer is running inside the Electron desktop shell. */
export const isElectronPlatform = (): boolean => (
    typeof window !== 'undefined' && Boolean((window as unknown as { electron?: { isElectron?: boolean } }).electron)
);

/** Returns the active Capacitor platform identifier ('android', 'ios', or 'web'). */
export const getCapacitorPlatform = (): string => {
    const cap = getCapacitorGlobal();
    if (!cap || typeof cap.getPlatform !== 'function') return 'web';
    try {
        return cap.getPlatform() || 'web';
    } catch {
        return 'web';
    }
};

/** Whether the app is running inside a native Capacitor container (Android or iOS). */
export const isCapacitorNativePlatform = (): boolean => {
    const cap = getCapacitorGlobal();
    if (!cap) return false;
    if (typeof cap.isNativePlatform === 'function') {
        try {
            return Boolean(cap.isNativePlatform());
        } catch {
            // Fall through to platform name check.
        }
    }
    const platform = getCapacitorPlatform();
    return platform === 'android' || platform === 'ios';
};

/** Whether the app is running inside the Capacitor Android native shell. */
export const isAndroidNativeApp = (): boolean => (
    isCapacitorNativePlatform() && getCapacitorPlatform() === 'android'
);

/** Whether the current browser or WebView user agent reports Android. */
export const isAndroidUserAgent = (): boolean => (
    typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent)
);

/** Whether the viewport dimensions correspond to a mobile phone or compact handheld screen. */
export const isMobilePhoneViewport = (width?: number, height?: number): boolean => {
    const resolvedWidth = typeof width === 'number'
        ? width
        : (typeof window !== 'undefined' ? window.innerWidth : 1280);
    const resolvedHeight = typeof height === 'number'
        ? height
        : (typeof window !== 'undefined' ? window.innerHeight : 800);
    const shortSide = Math.min(resolvedWidth, resolvedHeight);
    return resolvedWidth <= 768 || shortSide <= 540;
};

/**
 * Determines whether the mobile-first Android player shell should be used.
 * - Always false on Electron desktop.
 * - Can be explicitly forced via URL query (`?mobile=1` or `?desktop=1`) for browser testing.
 * - True on Capacitor native Android/iOS builds and Android mobile browsers.
 */
export const shouldUseAndroidMobileShell = (options?: {
    viewportWidth?: number;
    viewportHeight?: number;
    search?: string;
}): boolean => {
    if (isElectronPlatform()) return false;

    const rawSearch = options?.search ?? (typeof window !== 'undefined' ? window.location?.search ?? '' : '');
    if (rawSearch) {
        try {
            const params = new URLSearchParams(rawSearch);
            if (params.get('desktop') === '1') return false;
            if (params.get('mobile') === '1' || params.get('android') === '1') return true;
        } catch {
            // Ignore malformed query string.
        }
    }

    if (isCapacitorNativePlatform() || isAndroidNativeApp()) {
        return true;
    }

    if (isAndroidUserAgent()) {
        return true;
    }

    return false;
};

/**
 * Whether the web PWA precache service worker should be avoided. Capacitor's Android bridge
 * injects its runtime and plugin stubs into the top-level document request; a precache service
 * worker serving cached HTML intercepts that navigation and prevents native plugin injection.
 */
export const shouldDisableWebPwaServiceWorker = (): boolean => (
    isCapacitorNativePlatform() || isElectronPlatform()
);

/**
 * The modifier a shortcut declared as `ctrl` actually uses here: Cmd on macOS, Ctrl elsewhere.
 * Shortcuts are declared once with `ctrl` and translated at the point of use, rather than each
 * declaration carrying a per-platform variant.
 */
export const isPrimaryModifierPressed = (event: KeyboardEvent): boolean => (
    isMacPlatform ? event.metaKey : event.ctrlKey
);

/** The modifier that must stay *up* for a primary-modifier shortcut to be unambiguous. */
export const isSecondaryModifierPressed = (event: KeyboardEvent): boolean => (
    isMacPlatform ? event.ctrlKey : event.metaKey
);

/** Label for the primary modifier, for shortcut hints shown in the UI. */
export const PRIMARY_MODIFIER_LABEL = isMacPlatform ? 'Cmd' : 'Ctrl';
